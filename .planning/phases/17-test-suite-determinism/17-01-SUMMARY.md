---
phase: 17-test-suite-determinism
plan: 01
subsystem: testing
tags: [hardhat, mocha, evm-snapshot, determinism, eip-2535-diamond, localdiamonddeployer]

# Dependency graph
requires:
  - phase: v1.0-phase-7
    provides: 07-04 root-cause record (cross-suite pollution diagnosis; stale 665/2/1 Hardhat baseline)
provides:
  - "ensureDiamondTestBaseline() + TREASURY_STORAGE_SLOT in test/utils/diamond-baseline.ts — the single canonical probe-guarded protocol baseline declaration (D-03)"
  - "TEST-04 victim fix: GNUSControlStorage 'should return initial protocol info' green in the FULL suite with the test-side guard deleted"
  - "test-template.ts inheritance — new suites copied from the scaffold declare the baseline automatically"
  - "Observed full-suite figure 666 passing / 2 pending / 0 failing — the Phase 17 baseline input 17-05 consumes for the ledger"
affects: [17-test-suite-determinism]

# Tech tracking
tech-stack:
  added: [] # none — phase locked: no new dependencies
  patterns:
    - "Scaffold baseline declaration: ensureDiamondTestBaseline(diamond, address) called in before() BEFORE initialSnapshotId so snapshot reverts restore the declared baseline"
    - "Probe-guarded one-shot seed: eth_getStorageAt(treasurySlot+1) gates the only GNUSTreasury_SetSeedSupply(0n) call"

key-files:
  created:
    - test/utils/diamond-baseline.ts
  modified:
    - test/unit/GNUSControlStorage.test.ts
    - test/utils/test-template.ts

key-decisions:
  - "Helper signature (geniusDiamond, diamondAddress) parameterized per the GNUSTreasury.test.ts:167-178 precedent; module conventions copied from test/utils/network-utils.ts (JSDoc, bottom export block, no default export)"
  - "One-line ordering comment added at both call sites ('declare BEFORE the snapshot') so future editors do not reorder the fix"
  - "No dedicated test file for the helper — it is exercised by every suite that calls it; the full-suite gate is its correctness signal (17-RESEARCH Wave 0)"

patterns-established:
  - "Baseline-before-snapshot: every scaffold calls ensureDiamondTestBaseline() after loadDiamondContract and before the first evm_snapshot; bridge suites re-alias setChainID(31337n) AFTER it, inside their own snapshot window"
  - "Single canonical probe guard: TREASURY_STORAGE_SLOT + the slot+1 probe live in one module; 17-02/17-03 fold the 13 duplicated copies into it"

requirements-completed: [TEST-04]

# Metrics
duration: 5min
completed: 2026-08-31
---

# Phase 17 Plan 01: Test-Suite Determinism — Shared Baseline Helper Summary

**Probe-guarded `ensureDiamondTestBaseline()` helper declares the protocol baseline (seeded provenance, chainID 0, bridgeFee 0) before every snapshot — TEST-04's victim now passes the full 666/2/0 suite with the test-side `setChainID(0)` guard deleted.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-31T20:53:00Z
- **Completed:** 2026-08-31T20:58:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `test/utils/diamond-baseline.ts` created: the D-03 shared helper generalizing the probe-guard body duplicated across 13 suites — probe `eth_getStorageAt(TREASURY_STORAGE_SLOT + 1)`, conditional one-shot `GNUSTreasury_SetSeedSupply(0n)`, then `setChainID(0)` and `updateBridgeFee(0)`
- TEST-04 root fix landed in the victim suite: baseline declared in `before()` before `initialSnapshotId`; the test-side normalization guard (4 comment lines + `setChainID(0)`) deleted from `it('should return initial protocol info')`
- `test/utils/test-template.ts` wired via `ownerDiamond` before the first `evm_snapshot` — new suites inherit the baseline by default
- Full-suite gate observed: **666 passing / 2 pending / 0 failing, exit 0** (two consecutive runs: "666 passing (17s)" then "666 passing (16s)"); the victim test shows ✔ inside the full alphabetical-order run

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test/utils/diamond-baseline.ts (the D-03 shared helper)** - `690f7e9` (feat)
2. **Task 2: Wire the TEST-04 victim + scaffold template; delete the test-side guard** - `b97aaa2` (fix)

**Plan metadata:** (see final docs commit)

## Files Created/Modified

- `test/utils/diamond-baseline.ts` - (created) canonical `ensureDiamondTestBaseline()` + `TREASURY_STORAGE_SLOT`; JSDoc pins the ordering contract (before `initialSnapshotId`), the probe-guard reason, and the caller-role requirement
- `test/unit/GNUSControlStorage.test.ts` - baseline call inserted between `loadDiamondContract` and the initial snapshot; guard at the old :69-73 deleted; zero-chain-ID edge-case test (:408-region) intentionally untouched
- `test/utils/test-template.ts` - baseline call inserted after `ownerDiamond` connection (:124-region), immediately before `// Take initial snapshot`

## Decisions Made

- Helper takes the connected instance + diamond address explicitly (GNUSTreasury.test.ts `seedProvenanceIfNeeded` signature precedent) so both default-connected `geniusDiamond` and `ownerDiamond` callers work
- `ethers.provider` (from `import { ethers } from 'hardhat'`) used for the probe — identical provider the template registers for the `hardhat` network entry
- No dedicated unit test for the helper: every wired suite exercises it; the full-suite mocha gate is the correctness signal (per 17-RESEARCH Wave 0)
- TEST-04 marked complete on this plan per its frontmatter: the requirement's literal criterion (victim passes in the FULL suite, root fix, no test-side workaround) is verified; 17-05 re-claims TEST-04 for the N-run determinism proof leg

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. (Pre-existing repo-wide `tsc --noEmit` errors — 42, all in `scripts/deploy/` and similar — are unchanged and out of scope; zero errors reference the new file.)

## Observed Baseline (verbatim, for the 17-05 ledger)

```
$ yarn test
  666 passing (17s)
  2 pending
```

- No "N failing" line (mocha omits it at zero failures); exit code 0
- Second confirmation run: `666 passing (16s)` / `2 pending`, exit 0
- Delta vs the 07-04 stale baseline (665/2/1): +1 passing = exactly the TEST-04 victim flipping green; matches PROJECT.md's previously recorded 666/2/0 claim

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 17-02 (Tier A bridge + plain scaffolds) and 17-03 (Tier B probe-fold suites) wire the remaining ~25 scaffolds to the helper created here; both depend_on 17-01 and can proceed immediately
- The one-line ordering comment convention at call sites should be replicated in 17-02/17-03 edits
- 17-05 consumes the observed 666/2/0 figure as the pre-sweep baseline input for the STATE.md ledger

## Self-Check: PASSED

All 4 claimed files exist on disk; both task commits (690f7e9, b97aaa2) present in git log.

---
*Phase: 17-test-suite-determinism*
*Completed: 2026-08-31*
