---
phase: 17-test-suite-determinism
plan: 02
subsystem: testing
tags: [hardhat, mocha, evm-snapshot, determinism, eip-2535-diamond, localdiamonddeployer, test-scaffold]

# Dependency graph
requires:
  - phase: 17-test-suite-determinism
    provides: 17-01 ensureDiamondTestBaseline() in test/utils/diamond-baseline.ts + the one-line "declare BEFORE the snapshot" comment convention
provides:
  - "All 13 test/unit Tier-A scaffold-snapshot suites (12 here + GNUSControlStorage in 17-01) declare the shared protocol baseline before their initialSnapshotId — order-independent by construction"
  - "Zero duplicated probe-guard bodies or local TREASURY_STORAGE_SLOT constants remain in the 5 folded unit files — test/utils/diamond-baseline.ts is the only copy in test/unit"
  - "Bridge re-alias preserved: setChainID(localChainId) AFTER the baseline call, inside each bridge suite's own snapshot window (T-17-04 mitigated)"
  - "Full-suite gate re-observed at 666 passing / 2 pending / 0 failing, exit 0, two runs — counts identical to 17-01, no suite gained or lost tests"
affects: [17-test-suite-determinism]

# Tech tracking
tech-stack:
  added: [] # none — phase locked: no new dependencies, zero installs
  patterns:
    - "Bridge scaffold shape: load diamond → ensureDiamondTestBaseline() → setChainID(localChainId) re-alias → attestor setup → evm_snapshot (baseline normalizes, re-alias re-specializes inside the snapshot window)"
    - "Multichain-shaped scaffolds pass deployedDiamondData.DiamondAddress! (no diamondAddress local exists in that shape)"

key-files:
  created: []
  modified:
    - test/unit/GNUSBridgeIn.test.ts
    - test/unit/GNUSBridgeAttestorIn.test.ts
    - test/unit/GNUSBridgeAttestorUpgrade.test.ts
    - test/unit/GNUSBridgeEnhanced.test.ts
    - test/unit/GNUSNFTFactoryEnhanced.test.ts
    - test/unit/DiamondInitFacet-limiter.test.ts
    - test/unit/ERC1155ProxyOperator.test.ts
    - test/unit/ERC20TransferBatch.test.ts
    - test/unit/GNUSContractAssets.test.ts
    - test/unit/GNUSWithdrawLimiter.test.ts
    - test/unit/GNUSWithdrawLimiterStorage.test.ts
    - test/unit/GeniusOwnershipFacet.test.ts

key-decisions:
  - "Bridge files carry a two-line ordering comment ('baseline BEFORE the snapshot; the 31337 re-alias below re-applies the bridge chainID inside this window') extending the 17-01 one-line convention to cover the re-alias rule"
  - "The 3 multichain-shaped limiter scaffolds (DiamondInitFacet-limiter, GNUSWithdrawLimiter, GNUSWithdrawLimiterStorage) have no diamondAddress local — baseline called with deployedDiamondData.DiamondAddress!; geniusDiamond stays default-connected (signer0 = contractOwner + DEFAULT_ADMIN on the shared diamond)"
  - "GNUSBridgeAttestorUpgrade's in-test setChainID (WR-01 live-verification leg, now :236) left untouched — in-test mutation reverted by afterEach, not scaffold pollution"

patterns-established:
  - "Every test/unit scaffold-snapshot suite now opens its before() with the shared baseline declaration between the diamond loader and the first evm_snapshot"

requirements-completed: [TEST-04]

# Metrics
duration: 4.5min
completed: 2026-08-31
---

# Phase 17 Plan 02: Test-Suite Determinism — Tier-A Unit Scaffold Sweep Summary

**All 12 remaining test/unit Tier-A scaffolds now declare the shared protocol baseline before their snapshot — 5 duplicated probe-guard bodies folded into the one helper copy, bridge 31337 re-alias preserved, full suite still 666/2/0.**

## Performance

- **Duration:** ~4.5 min
- **Started:** 2026-08-31T21:10:00Z
- **Completed:** 2026-08-31T21:14:25Z
- **Tasks:** 3
- **Files modified:** 12 (all test scaffolds; zero production code, zero installs)

## Accomplishments

- **Task 1 (bridge scaffolds):** GNUSBridgeIn + GNUSBridgeAttestorIn probe blocks (:259-265 / :396-402) replaced with `ensureDiamondTestBaseline(geniusDiamond, diamondAddress)`; `setChainID(localChainId)` re-alias kept AFTER the baseline and BEFORE `evm_snapshot`; both local `TREASURY_STORAGE_SLOT` constants deleted. Targeted one-process run with GNUSControlStorage (the pollution direction): 105 passing, 0 failing.
- **Task 2 (probe-fold plain scaffolds):** GNUSBridgeAttestorUpgrade, GNUSBridgeEnhanced, GNUSNFTFactoryEnhanced — same fold, baseline before snapshot, slot constants deleted. Targeted run: 72 passing, 0 failing.
- **Task 3 (plain inserts, 7 files):** DiamondInitFacet-limiter, ERC1155ProxyOperator, ERC20TransferBatch, GNUSContractAssets, GNUSWithdrawLimiter, GNUSWithdrawLimiterStorage, GeniusOwnershipFacet — mechanical insertion between the diamond loader and the initial snapshot. GNUSWithdrawLimiterStorage's non-treasury limiter-slot probes untouched.
- **Full-suite gate:** `yarn test` — 666 passing / 2 pending / 0 failing, exit 0, **two consecutive runs** (18s each); counts byte-identical to the 17-01 observation, confirming no suite gained or lost tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridge scaffolds — replace probe block, keep re-alias AFTER baseline** - `a1c8443` (refactor)
2. **Task 2: Probe-fold plain scaffolds (3 files)** - `03de1bf` (refactor)
3. **Task 3: Plain inserts (7 files) + full-suite gate** - `81090d3` (feat)

**Plan metadata:** (see final docs commit)

## Verification Evidence

- Ordering gate: all 12 files report `line(ensureDiamondTestBaseline() < line(first evm_snapshot)` OK
- Fold gate: `grep -c GNUSTreasury_SetSeedSupply` = 0 and `grep -c TREASURY_STORAGE_SLOT` = 0 in all 5 folded files
- Re-alias gate (T-17-04): `setChainID(localChainId)` present exactly once in both bridge files, positioned after the baseline call
- In-test mutation gate: GNUSBridgeAttestorUpgrade `setChainID` inside the WR-01 `it(...)` intact
- Full suite (verbatim, second run): `666 passing (18s)` / `2 pending`, exit 0

## Decisions Made

- The 3 multichain-shaped limiter scaffolds pass `deployedDiamondData.DiamondAddress!` (that shape has no `diamondAddress` local); the default-connected `geniusDiamond` satisfies the helper's owner role requirement everywhere
- Bridge files got the extended two-line ordering comment so future editors know not to reorder baseline/re-alias; plain files use the 17-01 one-line comment verbatim
- No Pitfall-2 self-alias deviations were needed — no suite failed on chain/destination-chain guards after the sweep (research A3's moderate risk did not materialize)

## Deviations from Plan

None - plan executed exactly as written. (The `deployedDiamondData.DiamondAddress!` argument in the 3 multichain-shaped files is the plan's own "use what the scaffold has in scope" rule applied literally — those suites never had a `diamondAddress` local.)

## Issues Encountered

None.

## Observed Baseline (for the 17-05 ledger)

```
$ yarn test
  666 passing (18s)
  2 pending
```

- No "N failing" line (mocha omits it at zero failures); exit code 0
- Identical figure on the second run (`666 passing (18s)` / `2 pending`, exit 0)
- Unchanged from 17-01's post-Plan-1 observation — this sweep was isolation-hardening, not test-adding

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 17-03 (Tier B probe-fold + the 4 non-unit Tier A files: gas, 2x integration, deployment) proceeds against the same helper; the remaining duplicated probe bodies in test/unit Tier B suites (GNUSBridge, GNUSTreasury, NFTFactory, GNUSLifecycle*, GNUSLicensing, GNUSRedeemAdapter) are its scope, not this plan's
- 17-05 consumes 666/2/0 as the post-sweep Hardhat figure for the STATE.md baseline ledger

## Self-Check: PASSED

All 12 modified files exist on disk and carry the baseline call; all three task commits (a1c8443, 03de1bf, 81090d3) present in git log.

---
*Phase: 17-test-suite-determinism*
*Completed: 2026-08-31*
