// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";

/// @notice Minimal Safe v1.3.0 interface for execTransaction + getTransactionHash + approveHash.
interface ISafe {
    function getTransactionHash(
        address to, uint256 value, bytes calldata data, uint8 operation,
        uint256 safeTxGas, uint256 baseGas, uint256 gasPrice,
        address gasToken, address refundReceiver, uint256 _nonce
    ) external view returns (bytes32);
    function execTransaction(
        address to, uint256 value, bytes calldata data, uint8 operation,
        uint256 safeTxGas, uint256 baseGas, uint256 gasPrice,
        address gasToken, address refundReceiver, bytes memory signatures
    ) external payable returns (bool success);
    function approveHash(bytes32 hashToApprove) external;
}

/// @notice Minimal Safe proxy factory v1.3.0 interface.
interface ISafeProxyFactory {
    function createProxyWithNonce(
        address _singleton, bytes memory initializer, uint256 saltNonce
    ) external returns (address proxy);
}

/// @title SafeDiamondCutTest
/// @notice Forge fork test: deploy a 1-of-1 test Safe, transfer diamond ownership to it,
///         then exercise Safe.execTransaction() with a diamondCut to prove the multisig
///         execution path works at the contract level.
/// @dev Forks Sepolia at the latest block — requires --fork-url <sepolia-rpc>.
contract SafeDiamondCutTest is Test {
    // Sepolia canonical Safe singleton v1.3.0
    address private constant SAFE_SINGLETON     = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    // Sepolia canonical Safe proxy factory v1.3.0
    address private constant SAFE_PROXY_FACTORY = 0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC;
    // GeniusDiamond on Sepolia
    address private constant DIAMOND             = 0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70;

    // Facet selectors
    bytes4 private constant OWNER_SELECTOR               = bytes4(keccak256("owner()"));
    bytes4 private constant TRANSFER_OWNERSHIP_SELECTOR   = bytes4(keccak256("transferOwnership(address)"));
    bytes4 private constant DIAMOND_CUT_SELECTOR          = bytes4(keccak256("diamondCut((address,uint8,bytes4[])[],address,bytes)"));

    address private safeAddress;
    address private safeOwner;

    function setUp() public {
        safeOwner = makeAddr("safeOwner");
        vm.deal(safeOwner, 10 ether);

        // Deploy a 1-of-1 Safe using canonical Sepolia factory
        address[] memory owners = new address[](1);
        owners[0] = safeOwner;

        bytes memory setupCalldata = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners,
            uint256(1),          // threshold = 1-of-1
            address(0),          // to
            bytes(""),           // data
            address(0),          // fallbackHandler
            address(0),          // paymentToken
            uint256(0),          // payment
            address(0)           // paymentReceiver
        );

        safeAddress = ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(
            SAFE_SINGLETON, setupCalldata, uint256(keccak256(abi.encodePacked("gnus-safe-diamond-cut-test-2")))
        );

        vm.label(safeAddress, "TestSafe-1-of-1");
        vm.label(safeOwner, "SafeOwner");
    }

    /// @notice Get the current diamond owner via low-level diamond proxy call.
    function _diamondOwner() internal view returns (address) {
        (bool ok, bytes memory data) = DIAMOND.staticcall(abi.encodeWithSelector(OWNER_SELECTOR));
        require(ok, "owner() call failed");
        return abi.decode(data, (address));
    }

    /// @notice Transfer diamond ownership via low-level diamond proxy call.
    function _transferDiamondOwnership(address newOwner) internal {
        (bool ok,) = DIAMOND.call(abi.encodeWithSelector(TRANSFER_OWNERSHIP_SELECTOR, newOwner));
        require(ok, "transferOwnership(address) call failed");
    }

    /// @notice Read Safe nonce from storage slot 5.
    function _safeNonce(address safe) internal view returns (uint256) {
        return uint256(vm.load(safe, bytes32(uint256(5))));
    }

    /// @notice Build Safe approved-hash signatures: encodes the owner address and v=1
    ///         to signal that approvedHashes[owner][txHash] is set.
    function _approvedHashSig(address owner) internal pure returns (bytes memory) {
        // v = 1 means "approved hash" signature type.
        // r = uint256(uint160(owner)), s = 0
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(uint256(0)), uint8(1));
    }

    /// @notice Test: Safe can own the diamond and execute a no-op diamondCut.
    ///         Proves the end-to-end multisig execution path using Safe's approvedHash flow,
    ///         which bypasses EIP-712/191 signature incompatibility with forge's vm.sign.
    function test_SafeOwnsAndExecutesDiamondCut() public {
        // 1. Transfer diamond ownership to Safe
        address currentOwner = _diamondOwner();
        vm.startPrank(currentOwner);
        _transferDiamondOwnership(safeAddress);
        vm.stopPrank();

        assertEq(_diamondOwner(), safeAddress, "Safe should own diamond after transfer");

        // 2. Build no-op diamondCut calldata
        bytes memory diamondCutCalldata = abi.encodeWithSelector(
            DIAMOND_CUT_SELECTOR,
            new address[](0),   // empty facet cuts (no-op)
            address(0),         // init address
            bytes("")           // init calldata
        );

        // 3. Get transaction hash and pre-approve it
        ISafe safe = ISafe(payable(safeAddress));
        uint256 nonce = _safeNonce(safeAddress);
        bytes32 txHash = safe.getTransactionHash(
            DIAMOND, 0, diamondCutCalldata, 0, 0, 0, 0, address(0), address(0), nonce
        );

        // Owner pre-approves the hash (Safe's approvedHashes mapping)
        vm.prank(safeOwner);
        safe.approveHash(txHash);

        // 4. Execute diamondCut via Safe using approved-hash signature (v=1)
        bytes memory signatures = _approvedHashSig(safeOwner);
        vm.prank(safeOwner);
        bool success = safe.execTransaction(
            DIAMOND, 0, diamondCutCalldata, 0, 0, 0, 0, address(0), address(0), signatures
        );
        assertTrue(success, "Safe.execTransaction must succeed");

        // 5. Diamond still owned by Safe
        assertEq(_diamondOwner(), safeAddress, "Safe retains ownership after cut");
    }

    /// @notice Test: non-owner CANNOT approve or execute transactions through the Safe.
    ///         Only registered Safe owners can call approveHash (GS030), providing
    ///         an additional layer of defense beyond signature validation.
    function test_RevertWhen_NonOwnerApprovesHash() public {
        // Transfer ownership to Safe
        address currentOwner = _diamondOwner();
        vm.startPrank(currentOwner);
        _transferDiamondOwnership(safeAddress);
        vm.stopPrank();

        bytes memory diamondCutCalldata = abi.encodeWithSelector(
            DIAMOND_CUT_SELECTOR,
            new address[](0), address(0), bytes("")
        );

        ISafe safe = ISafe(payable(safeAddress));
        uint256 nonce = _safeNonce(safeAddress);
        bytes32 txHash = safe.getTransactionHash(
            DIAMOND, 0, diamondCutCalldata, 0, 0, 0, 0, address(0), address(0), nonce
        );

        // Attacker is NOT a Safe owner — approveHash reverts with GS030
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(); // GS030 — Only owners can approve a hash
        safe.approveHash(txHash);
    }

    /// @notice Test: diamondCut calldata with the correct selector is built correctly.
    function test_DiamondCutCalldataHasCorrectSelector() public pure {
        bytes memory calldata_ = abi.encodeWithSelector(
            DIAMOND_CUT_SELECTOR,
            new address[](0), address(0), bytes("")
        );

        bytes4 selector;
        assembly {
            selector := mload(add(calldata_, 32))
        }
        assertEq(selector, DIAMOND_CUT_SELECTOR, "calldata must start with diamondCut selector");
    }
}
