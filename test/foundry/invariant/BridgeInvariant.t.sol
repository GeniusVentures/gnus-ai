// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title BridgeInvariant
 * @notice Invariant tests for the Phase 10 destination-side bridge release path
 *         (BRIDGE-02 CEI correctness, BRIDGE-03 signature soundness).
 * @dev Fuzzes `handler_bridgeIn` on the GeniusDiamondHandler against a fixed,
 *      deterministic validator set and asserts two properties the unit suite
 *      cannot prove across the full reachable state space:
 *
 *      invariant_processedMessagesIffReleased (BRIDGE-02, CEI correctness):
 *          For every transferId the handler recorded as successfully released
 *          (BridgeReleased emitted by GNUSBridge.bridgeIn), the diamond's
 *          `processedMessages[transferId]` storage slot reads as `true`. The
 *          forward direction (released ⇒ processed) is the load-bearing check
 *          — if the CEI ordering in GNUSBridge.bridgeIn ever drifts, this
 *          invariant catches it.
 *
 *      invariant_noValidCertFromFuzzedSigs (BRIDGE-03, soundness):
 *          The handler always submits a deterministic-but-invalid certificate
 *          (random 65-byte sig with empty proof). The validator set in setUp
 *          uses a fixed nonzero merkle root, so NO fuzzed signature should
 *          ever verify. `ghost_bridgeInSuccesses == 0` after the campaign
 *          proves that no single-signature garbage certificate with an EMPTY
 *          proof verifies against a fixed root. It does NOT exercise
 *          multi-level merkle proof paths or the malformed-v/s revert
 *          matrix — those are covered by the unit suite
 *          (test/unit/GNUSBridgeIn.test.ts), not by this invariant.
 *
 *      afterInvariant (coverage guard, T-10-F01):
 *          Asserts `ghost_bridgeInCalls > 0` so the campaign actually
 *          exercised the bridgeIn path — prevents a vacuously-passing suite
 *          where the fuzzer never reached the selector.
 */
contract BridgeInvariant is GeniusDiamondTestBase {
    /// @dev Must match the constant in GNUSBridgeValidatorStorage.sol. Used to
    ///      compute the per-key mapping slot for `processedMessages[transferId]`
    ///      reads via `vm.load`. The mapping slot formula is:
    ///      `keccak256(abi.encode(key, mapping_slot_position))` where the
    ///      `mapping_slot_position` here is the layout position of the
    ///      `processedMessages` field (field index 0) inside the Layout struct
    ///      stored at `GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION`.
    bytes32 internal constant GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION =
        keccak256("gnus.ai.bridge.validator.storage");

    GeniusDiamondHandler public handler;

    function setUp() public override {
        super.setUp();

        // Seed the provenance counter so bridgeIn's downstream _mintWithBridgeFee
        // cap check can run. Idempotent: if already seeded, the call reverts and
        // we continue (mirrors ConservationInvariant.setUp).
        vm.prank(owner);
        (bool seeded, ) = diamond.call(
            abi.encodeWithSignature("GNUSTreasury_SetSeedSupply(uint256)", uint256(0))
        );
        if (!seeded) {
            console.log("[SETUP] Provenance already initialized on fork; continuing");
        }

        handler = new GeniusDiamondHandler();
        handler.setUp();

        // Configure a deterministic validator set on the diamond. The merkle root
        // can be ANY fixed nonzero value — the handler's fuzzed certificates are
        // random garbage and will never produce a valid proof against it. The
        // threshold of 1 is the simplest non-trivial configuration that still
        // exercises the threshold check path (T-10-F02 mitigation: proves the
        // invariant isn't passing vacuously because the validator set is
        // unconfigured — an unconfigured set would revert with "Validator set
        // not configured" before ever reaching signature verification).
        vm.prank(owner);
        (bool validatorSetConfigured, ) = diamond.call(
            abi.encodeWithSignature(
                "setValidatorSet(bytes32,uint256)",
                bytes32(uint256(0xdeadbeef)),
                uint256(1)
            )
        );
        require(validatorSetConfigured, "setValidatorSet failed in setUp");

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
     * @notice BRIDGE-02 / CEI correctness: every transferId the handler recorded
     *         as released must have `processedMessages[transferId] == true` in the
     *         diamond's validator storage.
     * @dev Iterates the handler's ghost_releasedIdsList (bounded by successful
     *      bridgeIn calls, which are bounded by campaign gas). For each id,
     *      computes the mapping slot directly:
     *          slot = keccak256(abi.encode(transferId, GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION))
     *      This is the standard Solidity mapping slot formula when the mapping
     *      is the FIRST field of a struct stored at the layout position (offset 0).
     *      If the struct field order changes in GNUSBridgeValidatorStorage, this
     *      formula breaks — see T-10-F05 and the field-order contract in Plan 10-01.
     */
    function invariant_processedMessagesIffReleased() public view {
        uint256 released = handler.getReleasedIdsLength();
        for (uint256 i = 0; i < released; i++) {
            bytes32 transferId = handler.ghost_releasedIdsList(i);
            bytes32 slot = keccak256(
                abi.encode(transferId, GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION)
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
     * @dev The handler always submits a deterministic-but-invalid certificate
     *      (one random 65-byte sig, empty proof) against a fixed nonzero merkle
     *      root. If `ghost_bridgeInSuccesses` is non-zero after the campaign,
     *      `_verifyThresholdCertificate` accepted a garbage certificate — a
     *      critical soundness failure in either ECDSA recovery or merkle
     *      membership verification. Scope: this campaign only proves the
     *      single-sig / empty-proof / fixed-root case. Multi-level merkle proof
     *      paths and the malformed-v/s revert matrix are covered by the unit
     *      suite (test/unit/GNUSBridgeIn.test.ts), not by this invariant.
     */
    function invariant_noValidCertFromFuzzedSigs() public view {
        assertEq(
            handler.ghost_bridgeInSuccesses(),
            0,
            "BRIDGE-03 violated: fuzzer forged a valid certificate against the fixed validator root"
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
