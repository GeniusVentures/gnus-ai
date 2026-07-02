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

/// @notice Read-only view onto the GNUSWithdrawLimiter facet for init-ran checks.
interface IGNUSWithdrawLimiterView {
    function getWithdrawLimiterConfig()
        external
        view
        returns (uint256 defaultLimitAmount, uint256 defaultWindowSeconds, uint256 defaultBinCount, bool limiterEnabled);
}

/// @title SafeSingleShotUpgradeTest
/// @notice Forge fork test for the Sepolia single-shot diamond upgrade through a Safe wallet.
///         Executes the TS-encoded artifact's diamondCut (which handles Remove for
///         GeniusAI + EscrowAIJob, Replace for updated facets, and Add for new facets)
///         and asserts the v2.5 post-state.
/// @dev Requires --fork-url <shared-anvil-fork>
contract SafeSingleShotUpgradeTest is Test {
    address private constant SAFE_SINGLETON     = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_PROXY_FACTORY = 0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC;
    address private constant DIAMOND             = 0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70;

    // Facets removed by the artifact's diamondCut (for baseline state checks)
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
            SAFE_SINGLETON, setupCalldata, uint256(keccak256(abi.encodePacked("gnus-single-shot-v2")))
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

    // ── tests ────────────────────────────────────────────────

    /// @notice Baseline: verify current Sepolia diamond state.
    function test_SepoliaCurrentState() public view {
        assertEq(_facetCount(), 12, "Sepolia diamond: 12 facets");
        assertEq(_getSelectors(GENIUS_AI_SHELL).length, 2, "GeniusAI shell: 2 selectors");
        assertEq(_getSelectors(ESCROW_FACET).length, 7, "Escrow facet: 7 selectors");
    }

    /// @notice Single-shot: Safe-execute the TS-encoded artifact's diamondCut and
    ///         verify the v2.5 post-state. The artifact's single diamondCut handles
    ///         Remove (GeniusAI + EscrowAIJob), Replace (updated facets), and Add
    ///         (new facets) atomically.
    /// @dev    Manual / anvil-only. Fork the anvil node — NOT Sepolia directly —
    ///         because the new facet addresses embedded in the artifact exist only
    ///         on the anvil fork:
    ///
    ///           # 1. start the shared fork node
    ///           anvil --fork-url $SEPOLIA_RPC_URL
    ///           # 2. TS encodes the cut against that node
    ///           npx ts-node --transpile-only scripts/deploy/rpc/upgrade-rpc.ts \
    ///             upgrade GeniusDiamond sepolia --encode-only
    ///           # 3. forge verifies execution on the same node
    ///           ENCODED_CUT_PATH=diamonds/GeniusDiamond/encoded-cuts/<file>.json \
    ///             forge test --fork-url http://localhost:8545 \
    ///               --match-test test_SingleShotUpgradeFromArtifact -vv
    ///
    ///         Skips cleanly when ENCODED_CUT_PATH is unset (e.g. CI).
    function test_SingleShotUpgradeFromArtifact() external {
        string memory cutPath = vm.envOr("ENCODED_CUT_PATH", string(""));
        if (bytes(cutPath).length == 0) {
            vm.skip(true, "ENCODED_CUT_PATH unset; anvil artifact test skipped");
        }

        // ── Read + decode the TS-encoded artifact ──
        string memory json = vm.readFile(cutPath);
        bytes memory calldata_ = vm.parseJsonBytes(json, ".calldata");
        address artifactDiamond = vm.parseJsonAddress(json, ".diamondAddress");
        // forge 1.7.1's JSON codec cannot decode an array of structs that nest a
        // dynamic array (bytes4[]), so read the flat parallel arrays emitted by the
        // TS pipeline via the typed array cheatcodes. Indices align 1:1 with each cut.
        address[] memory cutFacets = vm.parseJsonAddressArray(json, ".facetAddresses");
        uint256[] memory cutCounts = vm.parseJsonUintArray(json, ".facetSelectorCounts");

        assertEq(artifactDiamond, DIAMOND, "artifact diamondAddress must match the forked diamond");

        _transferToSafe();

        // ── Single-shot: Execute the TS-encoded diamondCut ──
        _execViaSafe(DIAMOND, calldata_);

        // ── Assert every non-Remove facet is registered with its selectors ──
        for (uint256 i = 0; i < cutFacets.length; i++) {
            if (cutFacets[i] == address(0)) {
                continue; // Remove cuts have no on-chain facet to verify
            }
            // Aggregate counts per unique facet address: the artifact emits one
            // cut entry per selector, so a facet with N selectors appears N times
            // with count=1 each.
            bool seen = false;
            for (uint256 j = 0; j < i; j++) {
                if (cutFacets[j] == cutFacets[i]) {
                    seen = true;
                    break;
                }
            }
            if (seen) continue;

            uint256 expected = cutCounts[i];
            for (uint256 j = i + 1; j < cutFacets.length; j++) {
                if (cutFacets[j] == cutFacets[i]) expected += cutCounts[j];
            }

            bytes4[] memory registered = _getSelectors(cutFacets[i]);
            assertGt(registered.length, 0, "facet not registered on diamond");
            assertEq(registered.length, expected, "selector count mismatch");
        }

        // ── Assert the initializer ran: diamondInitialize250() set limiter defaults ──
        (uint256 limitAmount, uint256 windowSeconds, uint256 binCount, bool enabled) =
            IGNUSWithdrawLimiterView(DIAMOND).getWithdrawLimiterConfig();
        assertTrue(enabled, "withdraw limiter should be enabled after diamondInitialize250");
        assertEq(limitAmount, 100_000 * 10 ** 18, "default limit amount");
        assertEq(windowSeconds, 86_400, "default window seconds");
        assertEq(binCount, 24, "default bin count");

        // Verify GeniusAI + EscrowAIJob were removed by the artifact's diamondCut
        assertEq(_getSelectors(GENIUS_AI_SHELL).length, 0, "GeniusAI shell should be removed");
        assertEq(_getSelectors(ESCROW_FACET).length, 0, "Escrow facet should be removed");

        assertEq(_diamondOwner(), safeAddress, "Safe retains ownership after upgrade");

        // 12 initial - 2 removed (GeniusAI + EscrowAIJob) + 2 added (WithdrawLimiter + DiamondInitFacet) = 12
        // Note: ERC1155ProxyOperator is a Replace (same facet slot, new address) so it doesn't change count
        assertEq(_facetCount(), 12, "should have 12 facets after upgrade");
    }
}
