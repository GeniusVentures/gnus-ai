---
phase: 10
slug: lock-release-bridge-vault
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-17
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

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

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | BRIDGE-02 | T-10-01 | bridgeIn reverts when paused | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "paused"` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | BRIDGE-02 | T-10-02 | bridgeIn reverts on unconfigured validator set | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "unconfigured validator set"` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | BRIDGE-02 | — | bridgeIn mints on valid certificate | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "mints on valid certificate"` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | BRIDGE-03 | T-10-03 | bridgeIn reverts on duplicate transferId | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "replay"` | ❌ W0 | ⬜ pending |
| 10-01-05 | 01 | 1 | BRIDGE-03 | T-10-04 | bridgeIn reverts on wrong destination chain | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "wrong destination"` | ❌ W0 | ⬜ pending |
| 10-01-06 | 01 | 1 | BRIDGE-03 | T-10-05 | bridgeIn reverts on cross-diamond replay | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "cross-diamond"` | ❌ W0 | ⬜ pending |
| 10-01-07 | 01 | 1 | BRIDGE-03 | T-10-06 | bridgeIn reverts on unsorted signatures | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "not strictly ascending"` | ❌ W0 | ⬜ pending |
| 10-01-08 | 01 | 1 | BRIDGE-03 | T-10-07 | bridgeIn reverts on duplicate signer | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "duplicate signer"` | ❌ W0 | ⬜ pending |
| 10-01-09 | 01 | 1 | BRIDGE-03 | T-10-08 | bridgeIn reverts on non-validator signature | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "not a registered validator"` | ❌ W0 | ⬜ pending |
| 10-01-10 | 01 | 1 | BRIDGE-03 | T-10-09 | bridgeIn reverts below threshold | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "below threshold"` | ❌ W0 | ⬜ pending |
| 10-01-11 | 01 | 1 | BRIDGE-04 | T-10-10 | bridgeIn enforces global cap | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "global cap"` | ❌ W0 | ⬜ pending |
| 10-01-12 | 01 | 1 | BRIDGE-04 | T-10-11 | bridgeIn applies bridge fee | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "applies bridge fee"` | ❌ W0 | ⬜ pending |
| 10-01-13 | 01 | 1 | BRIDGE-04 | T-10-12 | bridgeIn increments chainSupply and globalSupply | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "chain supply"` | ❌ W0 | ⬜ pending |
| 10-01-14 | 01 | 1 | BRIDGE-02 | — | setValidatorSet only by Super Admin | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "setValidatorSet"` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | BRIDGE-02 | T-10-13 | processedMessages set iff BridgeReleased emitted | invariant | `forge test --match-contract BridgeInvariant --match-test invariant_processedMessagesIffReleased` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | BRIDGE-03 | T-10-14 | arbitrary signatures never pass verification | fuzz | `forge test --match-contract BridgeInvariant --match-test invariant_noValidCertFromFuzzedSigs` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 2 | BRIDGE-04 | T-10-15 | globalSupply unchanged across bridgeOut + bridgeIn | invariant | `forge test --match-contract ConservationInvariant` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/GNUSBridgeIn.test.ts` — stubs for BRIDGE-02, BRIDGE-03, BRIDGE-04
- [ ] `test/utils/bridge-certificate.ts` — helper for producing valid EIP-191 certificates in tests
- [ ] Extend `test/foundry/invariant/BridgeInvariant.t.sol` — add `invariant_processedMessagesIffReleased`, `invariant_noValidCertFromFuzzedSigs`
- [ ] Extend `test/foundry/invariant/ConservationInvariant.t.sol` — add bridge-pair invariant
- [ ] No framework install needed — Hardhat and Foundry already wired

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Super Admin manual bridge-in via multisig | D-18 | Requires Safe multisig coordination | 1. Deploy to Sepolia. 2. Create Safe tx calling `mint(recipient, 0, amount)`. 3. Execute via multisig. 4. Verify recipient balance increased and `globalSupply`/`chainSupply` updated. |
| Initial validator set configuration | D-15/D-16 | Requires off-chain merkle root computation | 1. Generate validator list. 2. Compute merkle root off-chain. 3. Call `setValidatorSet(root, threshold)` via Super Admin. 4. Verify event emitted. |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
