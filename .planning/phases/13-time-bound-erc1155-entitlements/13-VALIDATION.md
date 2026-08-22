---
phase: 13
slug: time-bound-erc1155-entitlements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/13-time-bound-erc1155-entitlements/13-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit)** | Hardhat 2.26.5 + Mocha + Chai 4.5.0 + ethers.js 6.16.0 |
| **Framework (invariant/fuzz)** | Foundry (forge) via `@diamondslab/diamonds-hardhat-foundry` 2.4.0 |
| **Config file (Hardhat)** | `hardhat.config.ts` (no separate mocha config) |
| **Config file (Foundry)** | `test/foundry/GeniusDiamond.forge.config.json` |
| **Quick run command (unit)** | `npx hardhat test test/unit/GNUSLifecycle.test.ts` |
| **Quick run command (upgrade)** | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` |
| **Quick run command (Foundry)** | `npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --network localhost --force -- --match-contract LifecycleInvariant -vvv` |
| **Full suite command** | `npx hardhat test && yarn forge:test` |
| **Estimated runtime** | ~120 seconds (matching Phase 10 baseline) |

---

## Sampling Rate

- **After every task commit:** Run `npx hardhat test test/unit/GNUSLifecycle.test.ts` (fast, single-file; ~10-20 s warm cache)
- **After every plan wave:** Run `npx hardhat test test/unit/GNUSLifecycle.test.ts test/unit/GNUSLifecycleUpgrade.test.ts test/unit/GNUSNFTFactoryAntiScalping.test.ts` (three-file sweep; ~40-60 s)
- **Before `/gsd:verify-work`:** Full suite green — `npx hardhat test && yarn forge:test` (~120 s Hardhat + ~120 s Foundry)
- **Max feedback latency:** 20 s single-file; 120 s full Hardhat suite

---

## Per-Task Verification Map

Task IDs are assigned by the planner; requirement column maps to ROADMAP Success Criteria SC1-SC8 (+D4/D9 decision pins). Full behavior-to-command matrix lives in `13-RESEARCH.md` § "Phase Requirements → Test Map" (50 rows).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-PA1-* | PA-1 | 1 | SC1 | — | Legacy NFT decode with zero defaults; storage layout matches slots +9/+10/+11 | decode / unit | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` | ❌ W0 | ⬜ pending |
| 13-PA2-* | PA-2 | 2 | SC3 | — | All six transfer policies enforced in `_beforeTokenTransfer`; no operator exemptions; batch reverts atomically | unit + cross-repo | `npx hardhat test test/unit/GNUSLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 13-PA3-* | PA-3 | 2 | SC2 | — | PerHolder clocks in `expiresAt[tokenId][holder]`; settle-first renewal; never resurrected | unit + invariant | `npx hardhat test test/unit/GNUSLifecycle.test.ts`; `forge test --match-contract LifecycleInvariant` | ❌ W0 | ⬜ pending |
| 13-PA4-* | PA-4 | 3 | SC5 | — | Five dispositions; permissionless fixed-outcome `settleExpired()`; conservation invariants hold | unit + invariant | `npx hardhat test test/unit/GNUSLifecycle.test.ts`; `forge test --match-contract LifecycleInvariant` | ❌ W0 | ⬜ pending |
| 13-PA5-* | PA-5 | 3 | SC6 | — | Per-wallet mint cap; sale window; credential-verifier hook CEI-ordered; reentrancy cannot double-mint | unit + mock | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts` | ❌ W0 | ⬜ pending |
| 13-PA6-* | PA-6 | 4 | SC4, SC7, SC8, D4, D9 | — | Policy-bound non-bridgeable; AI Credits zero-credit; creator-only mutable timestamps; immutable policy/disposition/mode/recipient after first mint; events on all mutations | unit + deployment | `npx hardhat test test/unit/GNUSLifecycle.test.ts test/unit/GNUSLifecycleUpgrade.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/GNUSLifecycle.test.ts` — covers SC2-SC8 unit cases
- [ ] `test/unit/GNUSLifecycleUpgrade.test.ts` — covers SC1 (legacy decode, storage layout, selector collision)
- [ ] `test/unit/GNUSNFTFactoryAntiScalping.test.ts` — covers SC6 (anti-scalping)
- [ ] `test/foundry/invariant/LifecycleInvariant.t.sol` — settle-first renewal + REDEEM_TO_PARENT conservation invariants
- [ ] `contracts/gnus-ai/interfaces/ICredentialVerifier.sol` — NEW interface
- [ ] `contracts/gnus-ai/interfaces/IAllowlistRegistry.sol` — NEW interface
- [ ] `contracts/gnus-ai/GNUSLifecycle.sol` — NEW facet
- [ ] `contracts/gnus-ai/GNUSLifecycleStorage.sol` — NEW storage library
- [ ] `contracts/gnus-ai/testing/MockCredentialVerifier.sol` + `MockAllowlistRegistry.sol` — mocks
- [ ] Diamond config entry for `GNUSLifecycle` facet at priority 119, protocol 2.7

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Baseline & Failure Attribution

- **develop baseline (verified 2026-08-17/22):** 477 passing / 2 pending / 1 failing on `npx hardhat test`; 213 passed / 2 failed / 3 skipped on Foundry.
- **Known-stale failure:** `test/unit/GNUSControlStorage.test.ts` "should return initial protocol info" (chainID 31337 vs 0) — cross-suite pollution, owned by a future Phase 9 sweep. Phase 13 must not "fix" it.
- **Foundry known-stale:** 2 failures are Phase 08.1 `SafeDiamondCut` + `SafeSingleShotUpgrade` setUp reverts.
- **Phase 13 green definition:** all Phase-13-introduced tests pass; no new failures vs. documented baseline.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
