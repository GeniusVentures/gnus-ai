---
phase: 17
slug: test-suite-determinism
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Hardhat/Mocha (TS) + Foundry forge 1.7.1 (dual framework — see `.planning/codebase/TESTING.md`) |
| **Config file** | `hardhat.config.ts` · `foundry.toml` · `.mocharc` absent (alphabetical glob order is load-bearing — see 17-CONTEXT.md) |
| **Quick run command** | `npx hardhat test test/unit/<file>.test.ts` (single-suite Hardhat) |
| **Full suite command** | `yarn test:all` (Hardhat + Foundry via `yarn forge:test`; Foundry needs `npx hardhat node` running in a second terminal — wrapper does NOT spawn it) |
| **Estimated runtime** | Unknown — no recorded wall-time (RESEARCH A1); capture actuals on proof run 1 and record in STATE ledger |

---

## Sampling Rate

- **After every task commit:** Run `npx hardhat test test/unit/<touched-file>.test.ts`
- **After every plan wave:** Run `yarn test` (full Hardhat; Foundry leg after the wave that touches `.t.sol` files: `yarn forge:test` with node up)
- **Before `/gsd:verify-work`:** Full suite must be green — N=5 `yarn test:all` + N=10 invariant-only per D-06
- **Max feedback latency:** ~minutes (single-suite Hardhat); full-suite actuals recorded on run 1

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-XX-XX | XX | X | TEST-04/05/06 | — | N/A (test-harness-only phase; no production surface change) | unit/invariant | `{per task}` | ✅ existing suites | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Per-task rows backfilled from PLAN.md tasks during execution (Phase-16 precedent).*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — both frameworks, harness templates, and all target suites already exist. No Wave 0 installs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Safe setUp fork-path actually runs (not skipped) | TEST-06 | Requires sepolia fork state / anvil + `ENCODED_CUT_PATH` — cannot exist on the localhost bridge node (D-04) | Manual fork flow per `test/foundry/unit/SafeSingleShotUpgrade.t.sol` / `SafeDiamondCut.t.sol` docs — declared-skip in gate is the recorded criterion state (D-05) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency recorded on proof run 1
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
