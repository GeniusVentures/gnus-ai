---
phase: 15
slug: secure-bridgein-phase-10-amendment
status: draft
nyquist_compliant: true
wave_0_complete: false  # flips true during execution: Wave-0 gaps are created inside 15-03/15-04 tasks (new files + rework), not a separate wave
created: 2026-08-26
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `15-RESEARCH.md` §Validation Architecture (task map rows filled from the four plans).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Hardhat/mocha (unit) + Foundry via `yarn forge:test` (invariants) |
| **Config file** | `hardhat.config.ts` (0.8.19, optimizer 1000) / `test/foundry/GeniusDiamond.forge.config.json` |
| **Quick run command** | `npx hardhat test test/unit/GNUSBridgeAttestorIn.test.ts` |
| **Full suite command** | `npx hardhat test` + `yarn forge:test` (Foundry needs a running `npx hardhat node`) |
| **Estimated runtime** | ~10-15 min full suite |

**Known baselines (never "fix" these):** Hardhat **606 passing / 2 pending / 1 known-stale GNUSControlStorage chainID failure**; Foundry 215 passed / 2 known-stale Phase 08.1 setUp reverts / 3 skipped. During waves 2-3 the legacy `GNUSBridgeIn.test.ts` suite and Foundry setUp are EXPECTED RED until 15-04 — encoded in the plans; do not modify tests before 15-04.

---

## Sampling Rate

- **After every task commit:** file-scoped `npx hardhat test test/unit/<file>.test.ts` for touched suites + `yarn compile` bytecode-size print (EIP-170 gate: `GNUSBridge ≤ 24,576` AND `GNUSBridgeAttestor ≤ 24,576`)
- **After every plan wave:** `npx hardhat test` full suite (+ `yarn forge:test` when invariants touched)
- **Before `/gsd:verify-work`:** full suite green at the known baselines (post-15-04 the counts shift intentionally — new matrix suite replaces the legacy one)
- **Max feedback latency:** ~10 minutes

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 15-01 | 1 | BRIDGE-10 | T-15-01 register | storage append decodes at slots +3..+6; legacy slots +1/+2 frozen | unit (storage probe, Phase-9/14 pattern) | `npx hardhat test test/unit/GNUSBridgeAttestorUpgrade.test.ts` * | ❌ Wave 0 (new) | ⬜ pending |
| 15-01-02 | 15-01 | 1 | BRIDGE-11, 16 | T-15-0x EoP | one-time init + threshold bounds 2..16 + emergency never-Genesis shape | unit + boundary tests | `npx hardhat test test/unit/GNUSBridgeAttestorUpgrade.test.ts` * | ❌ Wave 0 (new) | ⬜ pending |
| 15-01-03 | 15-01 | 1 | BRIDGE-10 | T-15-0x upgrade | facet registered at `versions["2.6"]` priority 116; ABI/typechain regenerated | compile + config assertion | `yarn compile` + node ABI check | ✅ exists | ⬜ pending |
| 15-02-01 | 15-02 | 2 | BRIDGE-12, 13 | T-15-0x spoofing | BridgeMessage + messageId derivation + BRIDGE_CERTIFICATE_V2 split-encode digest | compile + unit | `yarn compile` then attestor suite | ❌ Wave 0 (new) | ⬜ pending |
| 15-02-02 | 15-02 | 2 | BRIDGE-14, 15, 16 | T-15-0x tampering/DoS | verify matrix (8 SPEC rows); CEI root-transition atomicity; legacy selector removal + loupe proof | compile + unit | `yarn compile` + attestor suite + bytecode asserts | ❌ Wave 0 (new) | ⬜ pending |
| 15-03-01 | 15-03 | 3 | BRIDGE-18 | T-15-0x repudiation | V2 TS helpers type-clean; flat↔split equivalence proven | tsc scoped + unit | `npx tsc --noEmit` scoped assert | ✅ extend | ⬜ pending |
| 15-03-02 | 15-03 | 3 | BRIDGE-18, 19 | T-15-0x | checked-in vectors drive on-chain round-trip (env-bound chainid+diamond); 36-checkpoint matrix | unit | `npx hardhat test test/unit/GNUSBridgeAttestorIn.test.ts` | ❌ Wave 0 (new) | ⬜ pending |
| 15-04-01 | 15-04 | 4 | BRIDGE-16, 19 | T-15-0x | legacy suite rewritten; zero legacy references; loupe selector-ownership removal | unit + grep assertion | `npx hardhat test test/unit/GNUSBridgeIn.test.ts` + `! grep -qE …` | ✅ rework | ⬜ pending |
| 15-04-02 | 15-04 | 4 | BRIDGE-19 | T-15-0x | Foundry handler/invariant retarget to V2 selector | forge | `yarn forge:test` | ✅ rework | ⬜ pending |
| 15-04-03 | 15-04 | 4 | BRIDGE-17 | — | exporter ABI + digest spec + security note; production-gate record | docs (grep) | grep docs | ❌ Wave 0 (new) | ⬜ pending |
| 15-04-04 | 15-04 | 4 | all | — | full-suite baseline gate at known baselines | full suite | `npx hardhat test && yarn forge:test` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*\* Task-time gate for 15-01 tasks is compile + storage/upgrade probe (`GNUSBridgeAttestorUpgrade.test.ts`); the definitive behavioral coverage for these requirements arrives with the wave-3 `GNUSBridgeAttestorIn.test.ts` matrix (rows 15-03-01/02).*

---

## Wave 0 Requirements

- [ ] `test/unit/GNUSBridgeAttestorIn.test.ts` — V2 matrix (BRIDGE-10..16, 18, 19)
- [ ] Rework `test/unit/GNUSBridgeIn.test.ts` — legacy path rewritten to expect removal; carried semantics re-keyed to V2; emergency-recovery shape
- [ ] Extend `test/utils/bridge-certificate.ts` — V2 digest/messageId helpers + tree builders
- [ ] `test/fixtures/bridge-attestor-vectors.json` + generator (BRIDGE-18)
- [ ] Foundry: handler selector retarget + V2 handlers + BridgeInvariant extension
- [ ] Config: register `GNUSBridgeAttestor` (priority 116, `versions["2.6"]`) — regenerates ABI/typechain

*Existing infrastructure covers all phase requirements; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production activation gate (#363/#364 closed) | BRIDGE-17 | External SuperGenius-repo issues | Verify both issues CLOSED before any production activation; record in SUBREPOS.md when scheduled |
| Genesis attestor address selection | BRIDGE-11 | Out-of-band owner input (kept out of repo per D-04) | Manual superAdmin `initializeBridgeAttestorV2(genesis)` post-cut per deployment runbook |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10 min
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved at planning (plan-checker iteration 2 — no blockers; warnings resolved, `wave_0_complete` flips true when the 15-03/15-04 task files land during execution)
