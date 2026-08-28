// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title BridgeInvariant
 * @notice Invariant tests for the destination-side bridge release path
 *         (BRIDGE-02 CEI correctness, BRIDGE-03 signature soundness).
 * @dev Fuzzes `handler_bridgeIn` on the GeniusDiamondHandler against a fixed,
 *      deterministic Genesis attestor root and asserts two properties the unit
 *      suite cannot prove across the full reachable state space:
 *
 *      invariant_processedMessagesIffReleased (BRIDGE-02, CEI correctness):
 *          For every messageId the handler recorded as successfully released
 *          (BridgeReleased emitted by GNUSBridgeAttestor.bridgeIn), the diamond's
 *          `processedMessages[messageId]` storage slot reads as `true`. The
 *          forward direction (released ⇒ processed) is the load-bearing check
 *          — if the CEI ordering in GNUSBridgeAttestor.bridgeIn ever drifts,
 *          this invariant catches it. Plan 15-04 (D-10): the key derivation is
 *          now the V2 composite messageId the handler derives off-chain in
 *          lockstep with `_bridgeMessageId`; the mapping slot FORMULA is
 *          UNCHANGED (mapping at field index 0 of the Layout struct).
 *
 *      invariant_noValidCertFromFuzzedSigs (BRIDGE-03, soundness):
 *          The handler always submits a deterministic-but-invalid V2 certificate
 *          (random 65-byte sig with empty proof, seed-derived pseudo next-root).
 *          The attestor set bootstrapped in setUp uses a fixed nonzero one-leaf
 *          Genesis root, so NO fuzzed signature should ever verify.
 *          `ghost_bridgeInSuccesses == 0` after the campaign proves that no
 *          single-signature garbage certificate with an EMPTY proof verifies
 *          against a fixed root. It does NOT exercise multi-level merkle proof
 *          paths or the malformed-v/s revert matrix — those are covered by the
 *          unit suites (test/unit/GNUSBridgeAttestorIn.test.ts and
 *          test/unit/GNUSBridgeIn.test.ts), not by this invariant.
 *
 *      afterInvariant (coverage guard, T-10-F01):
 *          Asserts `ghost_bridgeInCalls > 0` so the campaign actually
 *          exercised the bridgeIn path — prevents a vacuously-passing suite
 *          where the fuzzer never reached the selector.
 */
contract BridgeInvariant is GeniusDiamondTestBase {
    /// @dev Must match the constant in GNUSBridgeValidatorStorage.sol. Used to
    ///      compute the per-key mapping slot for `processedMessages[messageId]`
    ///      reads via `vm.load`. The mapping slot formula is:
    ///      `keccak256(abi.encode(key, mapping_slot_position))` where the
    ///      `mapping_slot_position` here is the layout position of the
    ///      `processedMessages` field (field index 0) inside the Layout struct
    ///      stored at `GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION`. Plan 15-04: only
    ///      the KEY derivation changed (transferId -> V2 messageId); the formula
    ///      is byte-for-byte the Phase 10 one.
    bytes32 internal constant GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION =
        keccak256("gnus.ai.bridge.validator.storage");

    GeniusDiamondHandler public handler;

    function setUp() public override {
        super.setUp();

        // Seed the provenance counter so bridgeIn's downstream fee-mint replica
        // cap check can run. Idempotent: if already seeded, the call reverts and
        // we continue (mirrors ConservationInvariant.setUp).
        vm.prank(owner);
        (bool seeded, ) = diamond.call(
            abi.encodeWithSignature("GNUSTreasury_SetSeedSupply(uint256)", uint256(0))
        );
        if (!seeded) {
            console.log("[SETUP] Provenance already initialized on fork; continuing");
        }

        // Point the diamond's configured chainID at the live chain so the V2
        // bridgeIn destination-chain guard passes and the campaign reaches the
        // certificate verifier (the Hardhat suites' setChainID(localChainId)
        // pattern, Phase 10 decision 10-03). Without this the calls would all
        // revert at "Wrong destination chain" and the soundness invariant would
        // only ever test the chain guard.
        vm.prank(owner);
        (bool chainIdAliased, ) = diamond.call(
            abi.encodeWithSignature("setChainID(uint256)", block.chainid)
        );
        require(chainIdAliased, "setChainID failed in setUp");

        handler = new GeniusDiamondHandler();
        handler.setUp();

        // Bootstrap the V2 attestor set with a fixed deterministic Genesis
        // address (Plan 15-04, D-10 — replaces the removed legacy admin root
        // setter). The one-leaf root is then fixed and nonzero — the same
        // non-vacuity property the old fixed root provided (T-10-F02): an
        // unbootstrapped set would revert with "Bridge attestor V2 not
        // initialized" before ever reaching signature verification. The epoch-0
        // threshold of 1 still exercises the threshold check path, and the
        // handler's seed-derived pseudo next-roots get past the genesis-advance
        // gate so the failure point stays inside the verifier.
        vm.prank(owner);
        (bool attestorBootstrapped, ) = diamond.call(
            abi.encodeWithSignature(
                "initializeBridgeAttestorV2(address)",
                address(uint160(uint256(0xdeadbeef)))
            )
        );
        require(attestorBootstrapped, "initializeBridgeAttestorV2 failed in setUp");

        // Target only the bridgeIn handler. The other supply-relevant handlers
        // are exercised by ConservationInvariant; this suite isolates the
        // bridgeIn path so the soundness invariant gets maximum density.
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = GeniusDiamondHandler.handler_bridgeIn.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));

        console.log("===== Bridge Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("==================================");
    }

    /**
     * @notice BRIDGE-02 / CEI correctness: every messageId the handler recorded
     *         as released must have `processedMessages[messageId] == true` in the
     *         diamond's validator storage.
     * @dev Iterates the handler's ghost_releasedIdsList (bounded by successful
     *      bridgeIn calls, which are bounded by campaign gas). For each id,
     *      computes the mapping slot directly:
     *          slot = keccak256(abi.encode(messageId, GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION))
     *      This is the standard Solidity mapping slot formula when the mapping
     *      is the FIRST field of a struct stored at the layout position (offset 0).
     *      If the struct field order changes in GNUSBridgeValidatorStorage, this
     *      formula breaks — see T-10-F05 and the field-order contract in Plan 10-01.
     */
    function invariant_processedMessagesIffReleased() public view {
        uint256 released = handler.getReleasedIdsLength();
        for (uint256 i = 0; i < released; i++) {
            bytes32 messageId = handler.ghost_releasedIdsList(i);
            bytes32 slot = keccak256(
                abi.encode(messageId, GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION)
            );
            bytes32 stored = vm.load(address(diamond), slot);
            assertEq(
                stored,
                bytes32(uint256(1)),
                "BRIDGE-02 violated: BridgeReleased emitted but processedMessages not set"
            );
        }
    }

    /**
     * @notice BRIDGE-03 / signature soundness: no fuzzed signature ever verifies.
     * @dev The handler always submits a deterministic-but-invalid V2 certificate
     *      (one random 65-byte sig, empty proof, seed-derived next-root) against
     *      the fixed nonzero one-leaf Genesis root. If `ghost_bridgeInSuccesses`
     *      is non-zero after the campaign, `_verifyBridgeAttestorCertificate`
     *      accepted a garbage certificate — a critical soundness failure in
     *      either ECDSA recovery or merkle membership verification. Scope: this
     *      campaign only proves the single-sig / empty-proof / fixed-root case.
     *      Multi-level merkle proof paths and the malformed-v/s revert matrix
     *      are covered by the unit suites, not by this invariant.
     */
    function invariant_noValidCertFromFuzzedSigs() public view {
        assertEq(
            handler.ghost_bridgeInSuccesses(),
            0,
            "BRIDGE-03 violated: fuzzer forged a valid certificate against the fixed attestor root"
        );
    }

    /**
     * @notice Coverage guard (T-10-F01): the fuzzer must actually exercise the
     *         bridgeIn path during the campaign. Prevents a vacuously-passing
     *         suite where the selector was never reached.
     */
    function afterInvariant() public {
        assertGt(
            handler.ghost_bridgeInCalls(),
            0,
            "bridgeIn path never exercised: ghost_bridgeInCalls == 0 after campaign"
        );
    }
}
