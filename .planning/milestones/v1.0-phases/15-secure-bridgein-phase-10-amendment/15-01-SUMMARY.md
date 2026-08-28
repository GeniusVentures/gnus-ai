---
phase: 15-secure-bridgein-phase-10-amendment
plan: "01"
subsystem: bridge
tags: [diamond, eip-2535, solidity, storage-append, attestor, merkle, upgrade-safety]

requires:
  - phase: 10-lock-release-bridge-vault
    provides: GNUSBridgeValidatorStorage layout (slots +0..+2), GNUSBridge facet frame, bridge-certificate test conventions
provides:
  - V2 attestor storage append (slots +3..+6) on GNUSBridgeValidatorStorage — BRIDGE-10, D-11
  - GNUSBridgeAttestor sibling facet with the admin surface — initializeBridgeAttestorV2 (one-shot Genesis bootstrap), setBridgeAttestorActiveThreshold (bounded 2..16), emergencyRecoverAttestorSet (paused-gated, epoch = old+1), _bridgeAttestorThreshold epoch-derived helper, 3 view getters
  - IGNUSBridgeAttestorEvents interface (4 V2 events, uint64 indexed epochs) on the facet ABI
  - Forward-declared constants BRIDGE_MESSAGE_ID_V2 / BRIDGE_CERTIFICATE_V2 (consumed by Plan 15-02)
  - Facet registration at priority 116 under versions["2.6"] (fromVersions 0.0/2.4/2.5) — D-01
  - Slot-probe upgrade test proving the append map and admin semantics
affects: [15-02 (certificate path consumes these slots/constants/events), 15-03/15-04 (test matrices), GNUSBridge (untouched this plan)]

tech-stack:
  added: []
  patterns:
    - "Phase 15 append banner discipline (do not reorder / do not insert above this line) with per-field slot Doxygen"
    - "Sibling-facet admin split: GNUSBridgeAttestor never calls GNUSBridge; state shared only via diamond storage"
    - "Inverted pause gate: emergency recovery REQUIRES paused (D-20/D-21 inverse)"
    - "Epoch-derived threshold with zero-guard fallback (WR-04 defense-in-depth style)"

key-files:
  created:
    - contracts/gnus-ai/GNUSBridgeAttestor.sol
    - test/unit/GNUSBridgeAttestorUpgrade.test.ts
  modified:
    - contracts/gnus-ai/GNUSBridgeValidatorStorage.sol
    - diamonds/GeniusDiamond/geniusdiamond.config.json

key-decisions:
  - "activeBridgeAttestorThreshold() returns the EFFECTIVE epoch-derived threshold (1 at epoch 0, stored override at epoch > 0) per the Task 2 facet spec — the stored default 2 is asserted via the raw slot +6 probe (see Deviations)"
  - "Emergency recovery requires bridgeAttestorV2Initialized, so with the one-shot init there is no path back to epoch 0 — Genesis structurally unrecoverable (T-15-04)"
  - "BRIDGE_MESSAGE_ID_V2 / BRIDGE_CERTIFICATE_V2 declared in 15-01 so 15-02 never re-opens the constants block"
  - "Config entry carries no deployInit/upgradeInit — the Genesis address is a manual post-cut superAdmin argument and never enters the repo (D-04, T-15-05)"
  - "BRIDGE-16 left pending: 15-01 delivered the emergency-recovery conversion half; the legacy-selector removal half is Plan 15-02 (which also claims BRIDGE-16)"

patterns-established:
  - "Full-slot append (no packing) for trust-boundary storage fields, verified by eth_getStorageAt probes at base + offset"
  - "hardhat_setStorageAt write-then-read probe proving legacy slots still decode as full 32-byte words after an append"

requirements-completed: [BRIDGE-10, BRIDGE-11]

duration: 11min
completed: 2026-08-26
---

# Phase 15 Plan 01: Secure BridgeIn Storage Append + Attestor Admin Facet Summary

Append-only V2 attestor storage (slots +3..+6) plus the `GNUSBridgeAttestor` sibling-facet admin skeleton — one-shot Genesis bootstrap, bounded threshold override, paused-gated emergency recovery — registered at priority 116 under `versions["2.6"]` and proven by a 10-test slot-probe upgrade suite; full Hardhat suite at 616/2/1 (baseline 606/2/1 + 10 new).

## Performance

- **Duration:** ~11 min
- **Started:** 2026-08-26T22:43:09Z
- **Completed:** 2026-08-26T22:55:00Z
- **Tasks:** 3/3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

### Task 1 — V2 attestor storage append (BRIDGE-10, D-11)

- `GNUSBridgeValidatorStorage.Layout` now has exactly 7 fields in order: `processedMessages`, `validatorMerkleRoot`, `validatorThreshold`, `bridgeAttestorRoot` (+3), `bridgeAttestorEpoch` (+4, full slot — NOT packed with the bool), `bridgeAttestorV2Initialized` (+5), `activeAttestorThreshold` (+6).
- Legacy slots +0..+2 preserved byte-for-byte (git diff: 17 insertions, 2 deletions — the 2 deletions are the stale "Phase 12 may add" header/struct `@dev` lines updated to Phase 15 wording).
- Phase 15 append banner + per-field slot/decision Doxygen per the GNUSNFTFactoryStorage discipline.

### Task 2 — GNUSBridgeAttestor admin facet skeleton (D-01/D-03/D-04/D-05)

- Frame: `contract GNUSBridgeAttestor is GNUSERC1155MaxSupply, GeniusAccessControl, IGNUSBridgeAttestorEvents` with the RedeemAdapter-shape diamond-aware `supportsInterface` triple-OR override; facet-split header paragraph states the ownership split and the never-call-each-other rule.
- `initializeBridgeAttestorV2(address)`: onlySuperAdminRole, nonzero-genesis + one-shot requires, writes one-leaf root `keccak256(abi.encodePacked(genesisAttestor))` (20-byte packed leaf, Pitfall 3) at epoch 0, init flag true, `activeAttestorThreshold = 2`; emits after writes. No deployInit/upgradeInit wiring anywhere.
- `setBridgeAttestorActiveThreshold(uint256)`: bounded `2 <= n <= 16` via named constants — floor structurally prevents recreating 1-of-N.
- `emergencyRecoverAttestorSet(bytes32)`: requires `GNUSControlStorage.layout().paused` (inverted gate), nonzero root, initialized V2 set; writes root then `epoch = oldEpoch + 1` (never 0); never touches the init flag.
- `_bridgeAttestorThreshold(uint256 epoch)`: 1 at epoch 0; otherwise stored override with zero-guard fallback to 2.
- View getters: `bridgeAttestorRoot()`, `bridgeAttestorEpoch()`, `activeBridgeAttestorThreshold()` (effective value).
- Named constants: `GENESIS_ATTESTOR_THRESHOLD=1`, `ACTIVE_ATTESTOR_THRESHOLD=2`, `MAX_ATTESTOR_SIGNATURES=16`, `BRIDGE_MESSAGE_ID_V2`, `BRIDGE_CERTIFICATE_V2`, plus 7 named revert-string constants. No bridgeIn/digest/verifier code (only NatSpec references to Plan 15-02).

### Task 3 — Config registration + slot-probe upgrade test

- `geniusdiamond.config.json`: `GNUSBridgeAttestor` at priority 116 (between GNUSBridge 115 and GNUSTreasury 117), `versions["2.6"]` with `fromVersions [0.0, 2.4, 2.5]`, no deployInit/upgradeInit, GNUSBridge entry untouched, protocolVersion still 2.6.
- `test/unit/GNUSBridgeAttestorUpgrade.test.ts` (10 tests, all passing): legacy +1/+2 decode full 32-byte words after the append; +3..+6 zero on fresh deploy; non-superAdmin init reverts `Only SuperAdmin allowed`; owner bootstrap writes the exact one-leaf root/epoch 0/init flag/threshold-2 slots; second init reverts one-shot; threshold 1 and 17 revert at bounds, 5 succeeds with `BridgeAttestorActiveThresholdSet(2, 5)`; unpaused emergency reverts; paused recovery emits `BridgeAttestorEmergencyReset(0, 1, oldRoot, newRoot)`, keeps the init flag, and bootstrap stays impossible. Genesis addresses are fresh `Wallet.createRandom()` per run (T-15-05).

## Verification Results

| Check | Result |
|---|---|
| `yarn compile` (0.8.19, optimizer 1000, no viaIR) | clean; diamond ABI + typechain regenerated |
| GNUSBridgeAttestor deployedBytecode | 16,795 B (7,781 B under EIP-170) |
| GNUSBridge deployedBytecode | 23,276 B — unchanged (no unintended edit) |
| diamond ABI selectors | all 6 present (3 admin + 3 views); legacy `bridgeIn`/`setValidatorSet` still present (removal is Plan 15-02 per D-06) |
| `GNUSBridgeAttestorUpgrade.test.ts` | 10 passing |
| `GNUSBridgePolicy.test.ts` (bridgeOut baseline) | 13 passing |
| Full `npx hardhat test` | 616 passing / 2 pending / 1 failing — baseline 606/2/1 + 10 new; the 1 failure is the known-stale GNUSControlStorage chainID test (permanent, not fixed per constraints) |

## Commits

| Repo | Hash | Subject |
|---|---|---|
| contracts/gnus-ai (develop) | 722d6cb | feat(15-01): append V2 attestor fields to GNUSBridgeValidatorStorage (BRIDGE-10, D-11) |
| gnus-ai (develop) | f0a2db1 | chore(15-01): bump gnus-ai submodule — V2 attestor storage append (722d6cb) |
| contracts/gnus-ai (develop) | 4056c34 | feat(15-01): create GNUSBridgeAttestor admin facet skeleton (D-01/D-03/D-04/D-05) |
| gnus-ai (develop) | deecb1b | chore(15-01): bump gnus-ai submodule — GNUSBridgeAttestor admin facet skeleton (4056c34) |
| diamonds/GeniusDiamond (develop) | dfebdf0 | feat(15-01): register GNUSBridgeAttestor facet at priority 116 under versions["2.6"] (D-01) |
| gnus-ai (develop) | 2b27ea0 | test(15-01): slot-probe upgrade test + GeniusDiamond pointer bump (dfebdf0) |

No branches created, no pushes, unsigned commits, no Co-Authored-By trailers. The TokenContracts super-repo pointer is not bumped (ship-time per plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Effective-threshold getter expectation in the test**

- **Found during:** Task 3 (first test run — 9 passing / 1 failing)
- **Issue:** Plan Task 3 assertion (2) says "the `activeBridgeAttestorThreshold` getter == 2", but the plan's own Task 2 facet spec (and locked D-03 epoch-derived semantics) defines the getter as the EFFECTIVE value from `_bridgeAttestorThreshold(bridgeAttestorEpoch)` — which returns `GENESIS_ATTESTOR_THRESHOLD` (1) at epoch 0, immediately after bootstrap. The facet was correct; my initial test expectation copied the plan's conflated reading (stored override vs effective value).
- **Fix:** Test now asserts getter == 1 at epoch 0 AND raw slot +6 == 2 (the stored default per D-03 "defaults set at init"), plus a new post-recovery check that the getter == 2 at epoch 1 (override governs once past Genesis). Together these prove the epoch-derived behavior more strongly than the original single assertion.
- **Files modified:** test/unit/GNUSBridgeAttestorUpgrade.test.ts only
- **Commit:** 2b27ea0 (included in the Task 3 commit)

No other deviations — the plan otherwise executed exactly as written.

## Forward Declarations (intentional, Plan 15-02)

- `BRIDGE_MESSAGE_ID_V2` and `BRIDGE_CERTIFICATE_V2` constants in `GNUSBridgeAttestor.sol` are declared but not yet consumed — explicitly per plan ("declared now so 15-02 does not re-open the constants block"). Plan 15-02 uses both in the BridgeMessage replay key and the split-encode certificate digest.

## Threat Model Coverage

All `mitigate` dispositions from the plan's threat register are implemented and tested: T-15-01 (banner + slot probe), T-15-02 (floor/cap bounds + boundary tests), T-15-03 (paused + superAdmin + nonzero + epoch+1 + event + flag preserved), T-15-04 (init-required recovery + one-shot init + post-state epoch >= 1), T-15-05 (no init wiring; random genesis per run), T-15-06 (priority 116 > 115; deploy success + ABI check), T-15-07 (accepted; zero-default probe). No new security surface beyond the plan's threat model.

## Self-Check: PASSED

All 4 artifact files exist on disk; all 6 commits verified present (2 in contracts/gnus-ai, 1 in diamonds/GeniusDiamond, 3 in the gnus-ai outer repo).
