// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {
    LifecycleConfig,
    ExpirationMode,
    TransferPolicy,
    ExpirationDisposition
} from "../../../contracts/gnus-ai/GNUSLifecycleTypes.sol";
import {console} from "forge-std/console.sol";

/**
 * @title LifecycleInvariant
 * @notice Invariant tests for Phase 13 time-bound entitlements (SC2/SC5, plan 13-05 Task 3)
 * @dev Fuzzes the diamond through GeniusDiamondHandler's three lifecycle handlers
 *      (handler_mintPerHolder / handler_advanceTime / handler_settleExpired) and asserts:
 *
 *      L1 (settle-first no-resurrect): after any renewal onto an expired PerHolder clock,
 *          the holder's balance equals ONLY post-settlement mints — the expired pile was
 *          burned by the renewal's settle-first step (BURN disposition) and never
 *          resurrected (T-13-05-01). Implemented as ghost_resurrections == 0.
 *      L2 (settle conservation): tree-wide supply == seed + ghost_totalMinted -
 *          ghost_totalBurned - ghost_totalSettleBurned. Only BURN settles destroy supply;
 *          NONE/KEEP_INERT are supply-neutral, RETURN moves between holders, REDEEM moves
 *          between ids (T-13-05-02). With the fuzzer restricted to the three lifecycle
 *          selectors, ghost_totalMinted / ghost_totalBurned stay zero — they are in the
 *          formula so it remains correct if the target set is later extended.
 *
 *      afterInvariant coverage guards (T-13-05-03): ghost_settleCalls > 0 and
 *      ghost_renewalCalls > 0 — the campaign fails if either path went unexercised
 *      (vacuous-success guard per the ConservationInvariant precedent). A deterministic
 *      mint -> expire -> settle cycle is seeded in setUp so the guards hold even under a
 *      shallow campaign (ConservationInvariant.seedConversion precedent, Codex P2).
 *
 *      Tokens configured in setUp (via low-level diamond.call with the facet selectors):
 *        - lifecyclePerHolderId: PerHolder + SOULBOUND + BURN, defaultDuration 1 day.
 *          createNFTWithLifecycle forces nonConvertible=true for BURN (D11).
 *        - lifecyclePerTokenId: PerTokenId + UNRESTRICTED + BURN, validUntil = now + 30 days.
 */
contract LifecycleInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    /// @dev PerHolder purchase duration for the invariant token (seconds).
    uint64 internal constant PER_HOLDER_DURATION = 1 days;
    /// @dev PerTokenId shared sale/expiry window length (seconds).
    uint256 internal constant PER_TOKEN_WINDOW = 30 days;
    /// @dev Generous per-id minion cap — campaigns must never hit it (1M ether in minions).
    uint256 internal constant TEST_TOKEN_MAX_SUPPLY = 1_000_000 ether;
    /// @dev Display exchange rate (minions per unit, 1e18 scale) — 1.0 like AI Credits (D11).
    uint256 internal constant TEST_TOKEN_EXCH_RATE = 1e18;

    /// @dev The PerHolder BURN SOULBOUND token created in setUp.
    uint256 internal lifecyclePerHolderId;
    /// @dev The PerTokenId BURN token created in setUp.
    uint256 internal lifecyclePerTokenId;

    /// @dev Tree-wide supply captured BEFORE seedLifecycleCycle (pre-seed, pre-fuzz baseline).
    uint256 internal treeSupplyAtSeed;

    function setUp() public override {
        super.setUp();

        // D8: seed the provenance counter (one-shot; reverts uninitialized views). If a
        // prior suite already seeded on this fork, the initializer reverts — catch and
        // continue (idempotent harness bring-up, ConservationInvariant precedent).
        vm.prank(owner);
        (bool seeded, ) = diamond.call(
            abi.encodeWithSignature("GNUSTreasury_SetSeedSupply(uint256)", uint256(0))
        );
        if (!seeded) {
            console.log("[SETUP] Provenance already initialized on fork; continuing");
        }

        // Configure the two lifecycle tokens via low-level diamond.call with the
        // createNFTWithLifecycle selector (config facet, priority 119).
        lifecyclePerHolderId = _createLifecycleToken(
            "Inv PerHolder",
            "INVPH",
            LifecycleConfig({
                validFrom: 0,
                validUntil: 0,
                defaultDuration: PER_HOLDER_DURATION,
                expirationMode: uint8(ExpirationMode.PerHolder),
                transferPolicy: uint8(TransferPolicy.SOULBOUND),
                expirationDisposition: uint8(ExpirationDisposition.BURN),
                expirationRecipient: address(0),
                credentialVerifier: address(0)
            })
        );

        lifecyclePerTokenId = _createLifecycleToken(
            "Inv PerTokenId",
            "INVPT",
            LifecycleConfig({
                validFrom: 0,
                validUntil: uint64(block.timestamp + PER_TOKEN_WINDOW),
                defaultDuration: 0,
                expirationMode: uint8(ExpirationMode.PerTokenId),
                transferPolicy: uint8(TransferPolicy.UNRESTRICTED),
                expirationDisposition: uint8(ExpirationDisposition.BURN),
                expirationRecipient: address(0),
                credentialVerifier: address(0)
            })
        );

        handler = new GeniusDiamondHandler();
        handler.setUp();
        handler.setLifecycleTokens(lifecyclePerHolderId, lifecyclePerTokenId);

        // L2 baseline MUST be captured before the seed cycle: ghost_totalSettleBurned
        // starts at 0 at handler construction and INCLUDES the seed cycle's settle burn,
        // so the baseline must be the pre-seed tree supply for
        //   actual == baseline - ghost_totalSettleBurned
        // to hold (capturing after the seed would double-count the seed burn).
        treeSupplyAtSeed = _treeSupply();

        // Deterministically exercise one mint (renewal) + one settle so the afterInvariant
        // coverage guards hold regardless of fuzz luck. All mints are tree-neutral (handler
        // GNUS burned 1:1); the seed settle burn is tracked in ghost_totalSettleBurned.
        handler.seedLifecycleCycle();

        // Restrict the fuzzer to the three lifecycle handlers so L1/L2 are exercised densely.
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = GeniusDiamondHandler.handler_mintPerHolder.selector;
        selectors[1] = GeniusDiamondHandler.handler_advanceTime.selector;
        selectors[2] = GeniusDiamondHandler.handler_settleExpired.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));

        console.log("===== Lifecycle Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("PerHolder token:", lifecyclePerHolderId);
        console.log("PerTokenId token:", lifecyclePerTokenId);
        console.log("Tree supply at seed:", treeSupplyAtSeed);
        console.log("=====================================");
    }

    /**
     * @notice L1: settle-first renewal NEVER resurrects an expired balance (SC2, T-13-05-01).
     * @dev The handler increments ghost_resurrections whenever a renewal onto an expired
     *      clock leaves more than the incoming mint in the holder's balance.
     */
    function invariant_L1_settleFirstNoResurrect() public view {
        assertEq(
            handler.ghost_resurrections(),
            0,
            "L1 violated: expired balance resurrected by renewal"
        );
    }

    /**
     * @notice L2: settle conservation — tree supply moves ONLY by settle burns (SC5, T-13-05-02).
     * @dev Expected = seed + ghost_totalMinted - ghost_totalBurned - ghost_totalSettleBurned.
     *      mintWithCredential is tree-neutral (burns handler GNUS 1:1, mints the child);
     *      BURN settles (direct and renewal settle-first) destroy exactly the settled amount;
     *      NONE/KEEP_INERT/RETURN/REDEEM are supply-neutral at the tree level.
     */
    function invariant_L2_settleConservation() public view {
        uint256 expected = treeSupplyAtSeed +
            handler.ghost_totalMinted() -
            handler.ghost_totalBurned() -
            handler.ghost_totalSettleBurned();
        assertEq(_treeSupply(), expected, "L2 violated: tree-wide supply drifted across settle");
    }

    /**
     * @notice Post-campaign coverage guard: both the settle path and the renewal path must
     *         actually have been exercised (T-13-05-03 anti-vacuity).
     * @dev Seeded deterministically in setUp (seedLifecycleCycle), so these hold even when
     *      the fuzz campaign draws no successful settle/mint sequence.
     */
    function afterInvariant() public {
        assertGt(
            handler.ghost_settleCalls(),
            0,
            "settle path never exercised: ghost_settleCalls == 0 after campaign"
        );
        assertGt(
            handler.ghost_renewalCalls(),
            0,
            "renewal path never exercised: ghost_renewalCalls == 0 after campaign"
        );
    }

    // ========================================
    // Internal helpers
    // ========================================

    /**
     * @notice Create + configure a lifecycle token atomically via createNFTWithLifecycle.
     * @dev Caller is `owner` (DEFAULT_ADMIN_ROLE passes the GNUS-child creation gate).
     *      Uses a low-level diamond.call with the tuple-typed selector; the LifecycleConfig
     *      struct ABI-encodes as its tuple. Deterministic in setUp — a failure here is a
     *      harness break, so require() rather than swallow.
     * @param name Token name
     * @param symbol Token symbol
     * @param cfg Full lifecycle configuration payload
     * @return newTokenId The id of the newly created token
     */
    function _createLifecycleToken(
        string memory name,
        string memory symbol,
        LifecycleConfig memory cfg
    ) internal returns (uint256 newTokenId) {
        vm.prank(owner);
        (bool ok, bytes memory data) = diamond.call(
            abi.encodeWithSignature(
                "createNFTWithLifecycle(uint256,string,string,uint256,uint256,string,(uint64,uint64,uint64,uint8,uint8,uint8,address,address))",
                GNUS_TOKEN_ID,
                name,
                symbol,
                TEST_TOKEN_EXCH_RATE,
                TEST_TOKEN_MAX_SUPPLY,
                "",
                cfg
            )
        );
        require(ok, "createNFTWithLifecycle failed in setUp");
        newTokenId = abi.decode(data, (uint256));
    }

    // ========================================
    // Live-state readers (diamond is source of truth)
    // ========================================

    /// @dev Tree-wide supply over the ids this suite can hold: id 0 (GNUS) plus the two
    ///      lifecycle tokens created in setUp. No other ids are created by the targeted
    ///      handlers.
    function _treeSupply() internal view returns (uint256 sum) {
        sum = _getTotalGNUSSupply();
        sum += _totalSupplyOf(lifecyclePerHolderId);
        sum += _totalSupplyOf(lifecyclePerTokenId);
    }

    function _totalSupplyOf(uint256 id) internal view returns (uint256) {
        (bool ok, bytes memory data) = diamond.staticcall(
            abi.encodeWithSignature("totalSupply(uint256)", id)
        );
        if (!ok) return 0;
        return abi.decode(data, (uint256));
    }
}
