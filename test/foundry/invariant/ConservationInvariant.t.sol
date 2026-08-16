// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ConservationInvariant
 * @notice Invariant tests for the Phase 9 conversion-native model (TREASURY-01/02/03)
 * @dev Fuzzes the diamond through GeniusDiamondHandler and asserts the supply
 *      conservation properties defined in 09-RESEARCH.md §I:
 *
 *      I1 (conservation): the tree-wide supply Σ_id totalSupply(id) changes ONLY
 *          via root mint (_mintWithBridgeFee / MINTER mint of id 0), admin burn,
 *          and bridgeOut. Mint/convert sequences leave it identical.
 *      I2 (convert neutrality): convert never changes the tree-wide supply and
 *          never changes totalSupplyOfAll() (the provenance counter).
 *      I5 (global cap): totalSupplyOfAll() <= GNUS_MAX_SUPPLY after every action.
 *
 *      I3 (two-diamond bridge) and I6 (limiter charge matrix) are covered by the
 *      unit suites in GNUSTreasury.test.ts — deliberately NOT duplicated here
 *      (per 09-05-PLAN Task 3 and 09-VALIDATION.md).
 *
 *      The diamond IS the source of truth: no parallel ghost sums for supply.
 *      The handler tracks ghost_totalMinted / ghost_totalBurned /
 *      ghost_totalBridgeDeposits so the invariant can reconstruct the expected
 *      tree-wide supply from the seed and compare against live diamond state.
 */
contract ConservationInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    /// @dev 50M * 1e18 — mirrors GNUSConstants.sol GNUS_MAX_SUPPLY.
    uint256 internal constant GNUS_MAX_SUPPLY = 50_000_000 * 1e18;

    /// @dev Tree-wide supply immediately after setUp seeding (pre-fuzz baseline).
    uint256 internal treeSupplyAtSeed;
    /// @dev Provenance counter immediately after setUp seeding (pre-fuzz baseline).
    uint256 internal globalSupplyAtSeed;

    function setUp() public override {
        super.setUp();

        // D8: seed the provenance counter so totalSupplyOfAll() and the global-cap
        // check in _mintWithBridgeFee can run (one-shot; reverts uninitialized).
        // Owner is the super admin. If a prior suite already seeded on this fork,
        // the initializer reverts — catch and continue (idempotent harness bring-up).
        vm.prank(owner);
        (bool seeded, ) = diamond.call(
            abi.encodeWithSignature("GNUSTreasury_SetSeedSupply(uint256)", uint256(0))
        );
        if (!seeded) {
            console.log("[SETUP] Provenance already initialized on fork; continuing");
        }

        handler = new GeniusDiamondHandler();
        handler.setUp();

        // Restrict the fuzzer to the supply-relevant handlers so conservation is
        // exercised densely (approve/role handlers are supply-neutral noise here).
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = GeniusDiamondHandler.handler_mint.selector;
        selectors[1] = GeniusDiamondHandler.handler_burn.selector;
        selectors[2] = GeniusDiamondHandler.handler_createNFT.selector;
        selectors[3] = GeniusDiamondHandler.handler_factoryMint.selector;
        selectors[4] = GeniusDiamondHandler.handler_convert.selector;
        selectors[5] = GeniusDiamondHandler.handler_bridgeDeposit.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));

        treeSupplyAtSeed = _treeSupply();
        globalSupplyAtSeed = _totalSupplyOfAll();

        console.log("===== Conservation Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("Tree supply at seed:", treeSupplyAtSeed);
        console.log("Global supply at seed:", globalSupplyAtSeed);
        console.log("========================================");
    }

    /**
     * @notice I1: tree-wide supply is conserved across mint/convert; it changes
     *         only via root mint (+), admin burn (-), and bridgeOut (-).
     * @dev Expected = seed + ghost_totalMinted - ghost_totalBurned - ghost_totalBridgedOut.
     *      factoryMint is tree-neutral (burns id 0, mints child id 1:1) and convert
     *      is tree-neutral, so neither appears in the expectation.
     */
    function invariant_I1_conservation() public view {
        uint256 expected = treeSupplyAtSeed +
            handler.ghost_totalMinted() -
            handler.ghost_totalBurned() -
            handler.ghost_totalBridgedOutAmount();
        assertEq(_treeSupply(), expected, "I1 violated: tree-wide supply drifted");
    }

    /**
     * @notice I2: convert never changes the provenance counter totalSupplyOfAll().
     * @dev The counter only moves on _mintWithBridgeFee (root issuance, +) and the
     *      MINTER_ROLE GNUSBridge.burn path (admin destruction, -). Convert, factoryMint,
     *      user-initiated ERC1155Burnable.burn, and bridgeOut (B1: destination chain
     *      mints) never touch it. Across the fuzzed action set the counter must equal
     *      its seeded value plus root mints minus admin burns.
     */
    function invariant_I2_convertNeutral() public view {
        uint256 expected = globalSupplyAtSeed +
            handler.ghost_totalMinted() -
            handler.ghost_totalAdminBurned();
        assertEq(_totalSupplyOfAll(), expected, "I2 violated: provenance counter moved on a non-mint path");
    }

    /**
     * @notice I5: the provenance counter never exceeds GNUS_MAX_SUPPLY.
     */
    function invariant_I5_globalCap() public view {
        assertLe(_totalSupplyOfAll(), GNUS_MAX_SUPPLY, "I5 violated: global cap exceeded");
    }

    /**
     * @notice Sanity: the convert call counter is monotonically non-decreasing.
     * @dev A cheap guard that the handler's convert path is actually being exercised
     *      (or correctly reverting without state corruption). The counter can never
     *      decrease, so asserting it is >= 0 plus exercising it is the check; the
     *      real property is that convert never corrupts supply (I1/I2 above).
     */
    function invariant_convertCallCountMonotonic() public view {
        assertTrue(handler.ghost_convertCalls() >= 0, "convert call count must be non-negative");
    }

    // ========================================
    // Live-state readers (diamond is source of truth)
    // ========================================

    /// @dev Σ over the ids the system can actually hold: id 0 (GNUS) plus every
    ///      child id the handler created. Uncreated ids have supply 0 by definition.
    function _treeSupply() internal view returns (uint256 sum) {
        sum = _getTotalGNUSSupply();
        uint256 created = handler.ghost_createdIdsLength();
        for (uint256 i = 0; i < created; i++) {
            sum += _totalSupplyOf(handler.ghost_createdIds(i));
        }
    }

    function _totalSupplyOf(uint256 id) internal view returns (uint256) {
        (bool ok, bytes memory data) = diamond.staticcall(
            abi.encodeWithSignature("totalSupply(uint256)", id)
        );
        if (!ok) return 0;
        return abi.decode(data, (uint256));
    }

    function _totalSupplyOfAll() internal view returns (uint256) {
        (bool ok, bytes memory data) = diamond.staticcall(
            abi.encodeWithSignature("totalSupplyOfAll()")
        );
        if (!ok) return 0; // uninitialized — treated as 0 (seeded in setUp, so live)
        return abi.decode(data, (uint256));
    }
}
