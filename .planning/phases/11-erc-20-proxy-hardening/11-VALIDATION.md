---
phase: 11
slug: erc-20-proxy-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-19
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Scope: PROXY-03 only (diamond-side redeem adapter). PROXY-01/02 validation lives in the erc20-gnus-proxy workstream.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Hardhat + Mocha + Chai (chai-as-promised), TypeScript, ethers v6; Foundry (forge) for invariants |
| **Config file** | `hardhat.config.ts` (existing); `test/foundry/GeniusDiamond.forge.config.json` (existing) |
| **Quick run command** | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts` |
| **Full suite command** | `npx hardhat test` + `yarn forge:test` |
| **Estimated runtime** | ~60 seconds (single file); ~10 min (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts`
- **After every plan wave:** Run `npx hardhat test` + `yarn forge:test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PROXY-03 | T-11-01 / — | Happy path: user → proxy → adapter → convert → GNUS minted to recipient | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "happy path"` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | PROXY-03 | T-11-02 | Revert: childId == GNUS_TOKEN_ID (adapter rejects GNUS self-redeem) | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "GNUS_TOKEN_ID"` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | PROXY-03 | — | Revert: amount == 0 / recipient == address(0) | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "zero"` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | PROXY-03 | T-11-03 | Revert: nonConvertible child token (Phase 9 D5; AI Credits forward-compat per D-09) | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "nonConvertible"` | ❌ W0 | ⬜ pending |
| 11-01-05 | 01 | 1 | PROXY-03 | — | Revert: insufficient child balance / caller not approved operator | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "insufficient\|not approved"` | ❌ W0 | ⬜ pending |
| 11-01-06 | 01 | 1 | PROXY-03 | T-11-04 | Limiter charge (WR-07) fires on GNUS-terminal convert via adapter; super-admin bypass event | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "limiter\|SuperAdminBypass"` | ❌ W0 | ⬜ pending |
| 11-01-07 | 01 | 1 | PROXY-03 | — | Callable by a contract (simulated external proxy); selector on diamond (loupe check post-upgrade) | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "proxy\|loupe"` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | PROXY-03 | — | (Optional, planner decides) Invariant: conservation of supply under arbitrary redeem calls | invariant | `forge test --match-contract RedeemAdapterInvariant` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/GNUSRedeemAdapter.test.ts` — stubs for all PROXY-03 behaviors above
- [ ] (Optional) `test/foundry/invariant/RedeemAdapterInvariant.t.sol` — conservation invariant if planner includes Foundry coverage

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Known Baseline Failures (pre-existing, NOT Phase 11 regressions)

- 1 unit failure: `GNUSControlStorage.test.ts` "should return initial protocol info" (chainID cross-suite pollution — Phase 9 sweep item)
- 2 Foundry failures: `SafeDiamondCut` / `SafeSingleShotUpgrade` setUp reverts (Phase 08.1 sweep item)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
