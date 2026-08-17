---
phase: 10
slug: lock-release-bridge-vault
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-17
planned: 2026-08-17
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Wave 0 artifacts (test files + helpers + invariant extensions) are planned in 10-03 and 10-04.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit)** | Hardhat + Mocha + Chai + ethers.js v6 |
| **Framework (invariant/fuzz)** | Foundry (forge) |
| **Config file (Hardhat)** | `hardhat.config.ts` |
| **Config file (Foundry)** | `test/foundry/GeniusDiamond.forge.config.json` |
| **Quick run command (unit)** | `npx hardhat test test/unit/GNUSBridgeIn.test.ts` |
| **Quick run command (Foundry)** | `forge test --match-contract BridgeInvariant -vvv` |
| **Full suite command** | `npx hardhat test && yarn forge:test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx hardhat test test/unit/GNUSBridgeIn.test.ts`
- **After every plan wave:** Run `npx hardhat test && forge test --match-contract BridgeInvariant`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Plan → Coverage Map

| Plan | Wave | Files | Covers Validation Rows |
|------|------|-------|------------------------|
| 10-01 | 1 | contracts/gnus-ai/GNUSBridgeValidatorStorage.sol | (storage library — no behavior to test alone) |
| 10-02 | 2 | contracts/gnus-ai/GNUSBridge.sol, diamonds/GeniusDiamond/geniusdiamond.config.json | (production code; tested by 10-03 + 10-04) |
| 10-03 | 3 | test/utils/bridge-certificate.ts, test/unit/GNUSBridgeIn.test.ts | 10-01-01 .. 10-01-14 (all 14 unit rows) |
| 10-04 | 3 | test/foundry/invariant/BridgeInvariant.t.sol, test/foundry/invariant/ConservationInvariant.t.sol, test/foundry/handlers/GeniusDiamondHandler.sol | 10-02-01, 10-02-02, 10-02-03 (all 3 invariant rows) |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 03 | 3 | BRIDGE-02 | T-10-10 | bridgeIn reverts when paused | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "paused"` | Planned in 10-03 | ⬜ pending |
| 10-01-02 | 03 | 3 | BRIDGE-02 | T-10-08 | bridgeIn reverts on unconfigured validator set | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "unconfigured validator set"` | Planned in 10-03 | ⬜ pending |
| 10-01-03 | 03 | 3 | BRIDGE-02 | — | bridgeIn mints on valid certificate | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "mints on valid certificate"` | Planned in 10-03 | ⬜ pending |
| 10-01-04 | 03 | 3 | BRIDGE-03 | T-10-02 | bridgeIn reverts on duplicate transferId | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "replay"` | Planned in 10-03 | ⬜ pending |
| 10-01-05 | 03 | 3 | BRIDGE-03 | T-10-03 | bridgeIn reverts on wrong destination chain | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "wrong destination"` | Planned in 10-03 | ⬜ pending |
| 10-01-06 | 03 | 3 | BRIDGE-03 | T-10-04 | bridgeIn reverts on cross-diamond replay | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "cross-diamond"` | Planned in 10-03 | ⬜ pending |
| 10-01-07 | 03 | 3 | BRIDGE-03 | T-10-06 | bridgeIn reverts on unsorted signatures | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "not strictly ascending"` | Planned in 10-03 | ⬜ pending |
| 10-01-08 | 03 | 3 | BRIDGE-03 | T-10-06 | bridgeIn reverts on duplicate signer | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "duplicate signer"` | Planned in 10-03 | ⬜ pending |
| 10-01-09 | 03 | 3 | BRIDGE-03 | T-10-07 | bridgeIn reverts on non-validator signature | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "not a registered validator"` | Planned in 10-03 | ⬜ pending |
| 10-01-10 | 03 | 3 | BRIDGE-03 | T-10-08 | bridgeIn reverts below threshold | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "below threshold"` | Planned in 10-03 | ⬜ pending |
| 10-01-11 | 03 | 3 | BRIDGE-04 | T-10-14 | bridgeIn enforces global cap | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "global cap"` | Planned in 10-03 | ⬜ pending |
| 10-01-12 | 03 | 3 | BRIDGE-04 | — | bridgeIn applies bridge fee | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "applies bridge fee"` | Planned in 10-03 | ⬜ pending |
| 10-01-13 | 03 | 3 | BRIDGE-04 | — | bridgeIn increments chainSupply and globalSupply | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "chain supply"` | Planned in 10-03 | ⬜ pending |
| 10-01-14 | 03 | 3 | BRIDGE-02 | T-10-13 | setValidatorSet only by Super Admin | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "setValidatorSet"` | Planned in 10-03 | ⬜ pending |
| 10-02-01 | 04 | 3 | BRIDGE-02 | T-10-12 | processedMessages set iff BridgeReleased emitted | invariant | `forge test --match-contract BridgeInvariant --match-test invariant_processedMessagesIffReleased` | Planned in 10-04 | ⬜ pending |
| 10-02-02 | 04 | 3 | BRIDGE-03 | T-10-01/06/07 | arbitrary signatures never pass verification | fuzz | `forge test --match-contract BridgeInvariant --match-test invariant_noValidCertFromFuzzedSigs` | Planned in 10-04 | ⬜ pending |
| 10-02-03 | 04 | 3 | BRIDGE-04 | — | globalSupply unchanged across bridgeOut + bridgeIn | invariant | `forge test --match-contract ConservationInvariant --match-test invariant_bridgePairConservation` | Planned in 10-04 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 artifacts are now planned (not blocking — they ARE the work of Plans 10-03 and 10-04):

- [x] `test/unit/GNUSBridgeIn.test.ts` — Plan 10-03 Task 2
- [x] `test/utils/bridge-certificate.ts` — Plan 10-03 Task 1
- [x] Extend `test/foundry/invariant/BridgeInvariant.t.sol` — Plan 10-04 Task 2
- [x] Extend `test/foundry/invariant/ConservationInvariant.t.sol` — Plan 10-04 Task 2
- [x] Extend `test/foundry/handlers/GeniusDiamondHandler.sol` — Plan 10-04 Task 1
- [x] No framework install needed — Hardhat and Foundry already wired

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Super Admin manual bridge-in via multisig | D-18 | Requires Safe multisig coordination | 1. Deploy to Sepolia. 2. Create Safe tx calling `mint(recipient, 0, amount)`. 3. Execute via multisig. 4. Verify recipient balance increased and `globalSupply`/`chainSupply` updated. |
| Initial validator set configuration | D-15/D-16 | Requires off-chain merkle root computation | 1. Generate validator list. 2. Compute merkle root off-chain (helper at `test/utils/bridge-certificate.ts::buildValidatorMerkleTree` is the reference). 3. Call `setValidatorSet(root, threshold)` via Super Admin. 4. Verify `ValidatorSetUpdated` event emitted. |
| SG-side SignEVM cross-check | D-10/D-11 | SuperGenius-repo work | Use the canonical test vector logged by `GNUSBridgeIn.test.ts`'s "emits a canonical test vector" test to verify SG's `SignEVM` produces byte-identical output. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (now planned in 10-03 and 10-04)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-08-17 — ready for execution
