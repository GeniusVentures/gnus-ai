// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {IDiamondCut} from "contracts-starter/contracts/interfaces/IDiamondCut.sol";

/// @notice Minimal Safe v1.3.0 interface.
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

interface ISafeProxyFactory {
    function createProxyWithNonce(
        address _singleton, bytes memory initializer, uint256 saltNonce
    ) external returns (address proxy);
}

interface IDiamondLoupe {
    function facetAddresses() external view returns (address[] memory);
    function facetFunctionSelectors(address facet) external view returns (bytes4[] memory);
}

/// @title SafeTwoStepUpgradeTest
/// @notice Forge fork test for the Sepolia two-step diamond upgrade through a Safe wallet.
///         Step 1: Remove GeniusAI shell + mystery escrow (v2.4 → v2.41)
///         Step 2: Add DiamondInitFacet v2.5 + GNUSWithdrawLimiter + diamondInitialize250 (v2.41 → v2.5)
/// @dev Requires --fork-url <sepolia-rpc>
contract SafeTwoStepUpgradeTest is Test {
    address private constant SAFE_SINGLETON     = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_PROXY_FACTORY = 0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC;
    address private constant DIAMOND             = 0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70;

    // Facets to remove in Step 1
    address private constant GENIUS_AI_SHELL = 0xa7A35Bf2035C35be384532D897C7E8Daf6692F12; // 2 selectors
    address private constant ESCROW_FACET    = 0x182b78dDfd52199ec6582EbD2987E0aBe1C1bDF7; // 7 selectors

    bytes4 private constant OWNER_SELECTOR             = bytes4(keccak256("owner()"));
    bytes4 private constant TRANSFER_OWNERSHIP_SELECTOR = bytes4(keccak256("transferOwnership(address)"));

    address private safeAddress;
    address private safeOwner;

    function setUp() public {
        safeOwner = makeAddr("safeOwner");
        vm.deal(safeOwner, 10 ether);

        address[] memory owners = new address[](1);
        owners[0] = safeOwner;

        bytes memory setupCalldata = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners, uint256(1), address(0), bytes(""), address(0), address(0), uint256(0), address(0)
        );

        safeAddress = ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(
            SAFE_SINGLETON, setupCalldata, uint256(keccak256(abi.encodePacked("gnus-two-step-v2")))
        );

        vm.label(safeAddress, "TestSafe");
        vm.label(safeOwner, "SafeOwner");
        vm.label(DIAMOND, "GeniusDiamond");
    }

    // ── helpers ──────────────────────────────────────────────

    function _diamondOwner() internal view returns (address) {
        (bool ok, bytes memory data) = DIAMOND.staticcall(abi.encodeWithSelector(OWNER_SELECTOR));
        require(ok, "owner() failed");
        return abi.decode(data, (address));
    }

    function _transferDiamondOwnership(address newOwner) internal {
        (bool ok,) = DIAMOND.call(abi.encodeWithSelector(TRANSFER_OWNERSHIP_SELECTOR, newOwner));
        require(ok, "transferOwnership failed");
    }

    function _safeNonce(address safe) internal view returns (uint256) {
        return uint256(vm.load(safe, bytes32(uint256(5))));
    }

    function _approvedHashSig(address owner) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(uint256(0)), uint8(1));
    }

    function _execViaSafe(address target, bytes memory calldata_) internal {
        ISafe safe = ISafe(payable(safeAddress));
        uint256 nonce = _safeNonce(safeAddress);
        bytes32 txHash = safe.getTransactionHash(target, 0, calldata_, 0, 0, 0, 0, address(0), address(0), nonce);

        vm.prank(safeOwner);
        safe.approveHash(txHash);

        bytes memory sig = _approvedHashSig(safeOwner);
        vm.prank(safeOwner);
        bool ok = safe.execTransaction(target, 0, calldata_, 0, 0, 0, 0, address(0), address(0), sig);
        require(ok, "Safe.execTransaction failed");
    }

    function _transferToSafe() internal {
        address currentOwner = _diamondOwner();
        vm.startPrank(currentOwner);
        _transferDiamondOwnership(safeAddress);
        vm.stopPrank();
        assertEq(_diamondOwner(), safeAddress, "Safe should own diamond");
    }

    function _getSelectors(address facet) internal view returns (bytes4[] memory) {
        return IDiamondLoupe(DIAMOND).facetFunctionSelectors(facet);
    }

    function _facetCount() internal view returns (uint256) {
        return IDiamondLoupe(DIAMOND).facetAddresses().length;
    }

    /// @notice Build a diamondCut to remove a facet (all its registered selectors).
    function _buildRemoveCut(address facet) internal view returns (IDiamondCut.FacetCut memory) {
        bytes4[] memory selectors = _getSelectors(facet);
        return IDiamondCut.FacetCut({
            facetAddress: address(0),
            action: IDiamondCut.FacetCutAction.Remove,
            functionSelectors: selectors
        });
    }

    /// @notice Encode diamondCut calldata from an array of FacetCuts.
    function _encodeDiamondCut(
        IDiamondCut.FacetCut[] memory cuts,
        address init,
        bytes memory initCalldata_
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "diamondCut((address,uint8,bytes4[])[],address,bytes)",
            cuts, init, initCalldata_
        );
    }

    // ── tests ────────────────────────────────────────────────

    /// @notice Baseline: verify current Sepolia diamond state.
    function test_SepoliaCurrentState() public view {
        assertEq(_facetCount(), 12, "Sepolia diamond: 12 facets");
        assertEq(_getSelectors(GENIUS_AI_SHELL).length, 2, "GeniusAI shell: 2 selectors");
        assertEq(_getSelectors(ESCROW_FACET).length, 7, "Escrow facet: 7 selectors");
    }

    /// @notice Step 1: Remove GeniusAI shell + mystery escrow via Safe.
    function test_Step1_RemoveEscrow() external {
        _transferToSafe();

        uint256 initialCount = _facetCount();
        assertEq(_getSelectors(GENIUS_AI_SHELL).length, 2);
        assertEq(_getSelectors(ESCROW_FACET).length, 7);

        // Build diamondCut: remove both facets
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](2);
        cuts[0] = _buildRemoveCut(GENIUS_AI_SHELL);
        cuts[1] = _buildRemoveCut(ESCROW_FACET);

        bytes memory step1Calldata = _encodeDiamondCut(cuts, address(0), bytes(""));
        _execViaSafe(DIAMOND, step1Calldata);

        // Verify both removed
        assertEq(_getSelectors(GENIUS_AI_SHELL).length, 0, "GeniusAI shell removed");
        assertEq(_getSelectors(ESCROW_FACET).length, 0, "Escrow facet removed");

        assertEq(_facetCount(), initialCount - 2, "Should have 2 fewer facets");
        assertEq(_diamondOwner(), safeAddress, "Safe retains ownership");
    }

    /// @notice Full two-step upgrade: remove escrow facets (step 1), then (step 2)
    ///         the add/replace operations are encoded in the provided step2 calldata.
    ///         Step 1 is built inline; step 2 is provided externally from upgrade-rpc analysis.
    function test_TwoStepUpgrade(bytes calldata step2DiamondCut) external {
        _transferToSafe();

        uint256 initialCount = _facetCount();

        // ── Step 1: Remove escrow facets (built inline) ──
        IDiamondCut.FacetCut[] memory step1Cuts = new IDiamondCut.FacetCut[](2);
        step1Cuts[0] = _buildRemoveCut(GENIUS_AI_SHELL);
        step1Cuts[1] = _buildRemoveCut(ESCROW_FACET);

        _execViaSafe(DIAMOND, _encodeDiamondCut(step1Cuts, address(0), bytes("")));

        assertEq(_getSelectors(GENIUS_AI_SHELL).length, 0, "GeniusAI shell removed");
        assertEq(_getSelectors(ESCROW_FACET).length, 0, "Escrow facet removed");

        assertEq(_facetCount(), initialCount - 2, "10 facets after step 1");

        // ── Step 2: Add DiamondInitFacet + GNUSWithdrawLimiter (externally provided) ──
        _execViaSafe(DIAMOND, step2DiamondCut);

        assertGt(_facetCount(), 10, "Should have more than 10 facets after step 2");
        assertEq(_diamondOwner(), safeAddress, "Safe retains ownership after full upgrade");
    }
}
