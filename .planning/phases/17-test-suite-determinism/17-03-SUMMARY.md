---
phase: 17-test-suite-determinism
plan: 03
subsystem: testing
tags: [hardhat, mocha, evm-snapshot, determinism, eip-2535-diamond, localdiamonddeployer, test-scaffold, dedup]

# Dependency graph
requires:
  - phase: 17-test-suite-determinism
    provides: 17-01 ensureDiamondTestBaseline() in test/utils/diamond-baseline.ts + the one-line "declare BEFORE the snapshot" comment convention; 17-02 Tier-A unit sweep precedent (multichain shapes pass deployedDiamondData.DiamondAddress!)
provides:
  - "D-03 sweep complete: every duplicated probe-guard body under test/ is folded — test/utils/diamond-baseline.ts is provably the repo's single probe-guard copy (slot-string grep returns nothing else repo-wide)"
  - "All 17 Tier-A snapshot scaffolds repo-wide declare the baseline before their first evm_snapshot (13 unit in 17-01/17-02 + gas, 2x integration, deployment here)"
  - "GNUSTreasury one-shot test bodies preserved byte-identical (diff hunks confined to old lines 18-425; the only SetSeedSupply diff line is the deleted local fn's seed)"
  - "Full-suite gate re-observed at 666 passing / 2 pending / 0 failing, exit 0, two runs — counts identical to 17-01/17-02"
affects: [17-test-suite-determinism]

# Tech tracking
tech-stack:
  added: [] # none — phase locked: no new dependencies, zero installs
  patterns:
    - "Tier-B fold shape: local probe block / seedProvenanceIfNeeded fn / TREASURY_STORAGE_SLOT const deleted; ONE scaffold-level ensureDiamondTestBaseline() call at the end of before() (beforeEvery-snapshot isolation suites), after the owner-connected instance is in scope"
    - "Bare mid-test guard calls of the removed local fn are deleted outright (NOT replaced with helper calls — the helper also resets chainID/fee and must never run mid-test)"

key-files:
  created: []
  modified:
    - test/unit/GNUSBridge.test.ts
    - test/unit/GNUSTreasury.test.ts
    - test/unit/NFTFactory.test.ts
    - test/unit/GNUSLifecycleSettle.test.ts
    - test/unit/GNUSLifecycleUpgrade.test.ts
    - test/unit/GNUSLifecycleAICredits.test.ts
    - test/unit/GNUSLicensing.test.ts
    - test/unit/GNUSRedeemAdapter.test.ts
    - test/integration/withdraw-limiter-integration.test.ts
    - test/gas/withdraw-limiter-gas-comparison.test.ts
    - test/integration/erc1155-transfer-hook-limiter.test.ts
    - test/integration/erc20-transfer-batch-limiter.test.ts
    - test/deployment/GeniusDiamondDeployment.test.ts

key-decisions:
  - "GNUSTreasury.test.ts keeps the TREASURY_STORAGE_SLOT identifier by IMPORTING it from the helper — the protected one-shot test bodies (:504-:987 old lines) probe the constant directly, so the plan's 'delete only after grep confirms no remaining references' rule keeps the name in scope while the constant's only definition lives in the helper"
  - "withdraw-limiter-integration's probe sat INSIDE beforeEach (after snapshotId_2); the fold moves the declaration to before() before snapshotId_1 per the helper-never-mid-test rule and the ordering acceptance criterion — the beforeEach's snapshot-rationale comment rewritten to describe the remaining per-test NFT setup"
  - "Instance selection per the plan's proven-signer rule: ownerDiamond everywhere an owner-connected instance exists (GNUSBridge, NFTFactory, Settle, Upgrade, RedeemAdapter, withdraw-limiter-integration, deployment); geniusDiamond (signer0) in AICredits/Licensing/gas/erc1155/erc20 where the existing probe used the default instance"
  - "Deployment scaffold passes ownerDiamond (DeployerAddress-resolved signer at :106-region), not the default geniusDiamond — T-17-08; the two limiter integration files pass deployedDiamondData.DiamondAddress! (17-02 multichain-shape precedent)"

patterns-established:
  - "The probe-guard idiom (eth_getStorageAt(slot+1) gating GNUSTreasury_SetSeedSupply(0n)) now exists in exactly one module; any new suite declares the baseline via the helper instead of re-copying the block"

requirements-completed: [TEST-04]

# Metrics
duration: 7.5min
completed: 2026-08-31
---

# Phase 17 Plan 03: Test-Suite Determinism — D-03 Sweep (Tier-B Folds + Non-Unit Tier A) Summary

**All 9 remaining duplicated probe-guard suites folded into the one helper copy and the 4 non-unit Tier-A scaffolds (gas, 2x integration, deployment) wired — the repo-wide slot-string grep is empty and the full suite holds at 666/2/0.**

## Performance

- **Duration:** ~7.5 min
- **Started:** 2026-08-31T21:17:50Z
- **Completed:** 2026-08-31T21:25:15Z
- **Tasks:** 2
- **Files modified:** 13 (all test scaffolds; zero production code, zero installs)

## Accomplishments

- **Task 1 (9 Tier-B folds):** GNUSBridge, GNUSTreasury, NFTFactory, GNUSLifecycleSettle, GNUSLifecycleUpgrade, GNUSLifecycleAICredits, GNUSLicensing, GNUSRedeemAdapter, integration/withdraw-limiter-integration — each gained ONE scaffold-level `ensureDiamondTestBaseline()` call at the end of `before()` (before any snapshot); local probe blocks, `seedProvenanceIfNeeded` fns (4 files), bare mid-test guard call sites (10 call lines), and local `TREASURY_STORAGE_SLOT` constants deleted. The 10th operator-ruled tree-grep discovery (withdraw-limiter-integration) carried its probe inside `beforeEach` — folded to `before()` per the ordering criterion. One-process run of all 9 suites: **138 passing, 0 failing**.
- **Task 2 (4 non-unit Tier-A scaffolds + full gate):** gas/withdraw-limiter-gas-comparison (probe relocated from AFTER the snapshot to BEFORE it — the relocation is the fix; slot const deleted), integration/erc1155-transfer-hook-limiter + erc20-transfer-batch-limiter (insert between diamond loading and `initialSnapshotId`), deployment/GeniusDiamondDeployment (last statement of `before()`, `ownerDiamond` per T-17-08). Full `yarn test`: **666 passing / 2 pending / 0 failing, exit 0, two consecutive runs (17s each)**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fold the 9 duplicated probe-guard suites into the helper** - `5b581d4` (refactor)
2. **Task 2: Non-unit Tier-A scaffolds (gas, 2x integration, deployment) + full-suite gate** - `f1ce697` (feat)

**Plan metadata:** (see final docs commit)

## Verification Evidence

- Fold gate: `grep -rn "gnus.ai.treasury.storage" test/ --include='*.ts' | grep -v utils/diamond-baseline.ts` → **empty** (verified after both tasks)
- Seed gate: `grep -rln "GNUSTreasury_SetSeedSupply(0n)" test/ --include='*.ts' | grep -v foundry` → **exactly** test/unit/GNUSTreasury.test.ts + test/utils/diamond-baseline.ts
- Local-fn gate: `grep -c seedProvenanceIfNeeded` = 0 in GNUSTreasury, GNUSLifecycleUpgrade, GNUSLifecycleSettle, GNUSRedeemAdapter
- Ordering gate: all 13 files report `line(ensureDiamondTestBaseline() < line(first evm_snapshot/beforeEach)` OK, exactly one call per file, zero occurrences inside any `it(`/`beforeEach(` body
- T-17-06 boundary: GNUSTreasury diff hunks confined to old lines 18-425 (`@@ -425 +404,0 @@` is the last) — the :504-:987 one-shot bodies byte-untouched; the single `GNUSTreasury_SetSeedSupply` diff line is the deleted local fn's seed (`-` line only)
- T-17-08: `ensureDiamondTestBaseline(ownerDiamond, deployedDiamondData.DiamondAddress!)` at GeniusDiamondDeployment.test.ts:110
- gas file: `grep -c TREASURY_STORAGE_SLOT` = 0
- Full suite (verbatim, both runs): `666 passing (17s)` / `2 pending`, exit 0, no failing line

## Decisions Made

- GNUSTreasury imports `TREASURY_STORAGE_SLOT` from the helper instead of deleting the identifier — its one-shot test bodies (the specification for the guard behavior) reference the constant ~15 times; the fold goal (single constant definition) is met either way
- The helper call in every Tier-B file uses the same signer the deleted probe used (proven role-holder), per the plan's instance-selection rule
- Three stale comment words trimmed where a deleted seed call made them wrong (GNUSTreasury "Initialize and create/build" → "Create/Build"; RedeemAdapter bootWithChild JSDoc "seed provenance, mint GNUS" → "mint GNUS") — comment-only, inside the scaffold region

## Deviations from Plan

None material - plan executed exactly as written. Two execution notes:

- The withdraw-limiter-integration probe block was replaced by a call placed in `before()` (before `snapshotId_1`), not in-place inside `beforeEach` — the plan's key_links phrasing ("probe block :114-122 replaced by helper call") is satisfied at the location its own acceptance criteria mandate (call line < first snapshot; zero occurrences inside `beforeEach(`), since the helper must never run mid-test
- An initial scaffold comment in GNUSTreasury quoted the slot string literally and tripped the acceptance grep; reworded to name only the identifier before any commit landed

## Issues Encountered

None. No Pitfall-2 self-alias deviations were needed — no suite failed on chain/destination-chain guards after the sweep (same as 17-02; research A3's moderate risk did not materialize in either wave).

## Observed Baseline (for the 17-05 ledger)

```
$ yarn test
  666 passing (17s)
  2 pending
```

- No "N failing" line (mocha omits it at zero failures); exit code 0
- Identical figure on the second run (`666 passing (17s)` / `2 pending`, exit 0)
- Unchanged from 17-01/17-02 — the sweep is isolation-hardening/dedup, not test-adding
- Intermediate evidence: the 9 folded suites in one process = 138 passing / 0 failing

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 17-05 (D-06 ledger) consumes 666/2/0 as the post-sweep Hardhat figure and the two-run evidence from 17-01/17-02/17-03
- The D-03 helper sweep is fully closed: any future suite copies test/utils/test-template.ts (baseline inherited) or calls the helper directly; a repo-wide grep for the slot string is the permanent regression check

## Self-Check: PASSED

All 13 modified files exist on disk and carry the baseline call; both task commits (5b581d4, f1ce697) present in git log.

---
*Phase: 17-test-suite-determinism*
*Completed: 2026-08-31*
