---
phase: 13-time-bound-erc1155-entitlements
plan: 05
subsystem: testing
tags: [erc1155, diamond, eip2535, foundry, invariant-testing, hardhat, solidity-library-linking, lifecycle, expiry]

# Dependency graph
requires:
  - phase: 13-time-bound-erc1155-entitlements (plans 13-02/13-03/13-04)
    provides: GNUSLifecycle + GNUSLifecycleMint facets, GNUSLifecyclePolicy library, D3 renewal, D8 dispositions, D9 settleExpired
provides:
  - 25-test unit matrix proving the D8 settlement/disposition matrix, D3 renewal semantics, and D4 mutability rules (SC2/SC5/SC8/D4/D9 acceptance gate)
  - LifecycleInvariant foundry suite: L1 settle-first no-resurrect + L2 settle conservation with ghost-state accounting and anti-vacuity coverage guards
  - Process-wide lazy GNUSLifecyclePolicy linker (extendEnvironment) that closes the diamonds-forge:test in-process deployment linking gap
affects: [13-time-bound-erc1155-entitlements, any future phase adding facets that link GNUSLifecyclePolicy, any future forge invariant suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extendEnvironment-installed lazy library linker: patch ethers.getContractFactory once per process, deploy-on-first-use, shared module state with the per-suite eager installer"
    - "Handler ghost-state settle accounting: track burn quanta (ghost_totalSettleBurned) across BOTH permissionless settleExpired and renewal settle-first paths; baseline tree supply captured pre-seed so L2 stays exact"
    - "Deterministic coverage-guard seeding (seedLifecycleCycle) so afterInvariant guards hold under shallow campaigns (ConservationInvariant.seedConversion precedent)"

key-files:
  created:
    - test/unit/GNUSLifecycleSettle.test.ts
    - test/foundry/invariant/LifecycleInvariant.t.sol
  modified:
    - test/foundry/handlers/GeniusDiamondHandler.sol
    - scripts/utils/GNUSLifecyclePolicyLinking.ts
    - hardhat.config.ts

key-decisions:
  - "Forge linking gap closed OUTSIDE the framework via a lazy self-bootstrapping linker installed with extendEnvironment in hardhat.config.ts — deploys GNUSLifecyclePolicy on first linking getContractFactory call against hre.network, cached per process, no-op otherwise; shares module state with the per-suite setupLifecyclePolicyLinking() so the two never double-deploy or double-patch. Chosen over a framework pre-deploy hook because DeploymentManager/ForgeFuzzingFramework expose no supported hook."
  - "L2 conservation baseline captured BEFORE seedLifecycleCycle() — ghost_totalSettleBurned includes the seed burn, so a post-seed baseline would double-count it"
  - "Handler selectors restricted to the three lifecycle handlers (targetSelector) so L1/L2 are exercised densely and ghost_totalMinted/ghost_totalBurned stay zero during the campaign"

patterns-established:
  - "Lazy library linker: hardhat.config.ts extendEnvironment + module-level {linkedLibraryAddress, linkerInstalled} shared with per-suite installer"
  - "Settle-conservation invariant: expected = preSeedTreeSupply + ghost_totalMinted - ghost_totalBurned - ghost_totalSettleBurned"

requirements-completed: [SC2, SC5, SC8, D4, D9]

# Metrics
duration: 7h 20m wall across a session continuation (~1h active execution)
completed: 2026-08-24
---

# Phase 13 Plan 05: Lifecycle Settlement + Invariant Acceptance Gate Summary

**25-test unit matrix plus a 2-invariant Foundry campaign proving the Phase 13 lifecycle mechanism: all five D8 dispositions, D3 renewal stacking/settle-first, D4 mutability/immutability gates, D9 circulating-supply semantics, and ghost-accounted settle conservation — with the diamonds-forge:test library-linking gap closed via a process-wide lazy GNUSLifecyclePolicy linker.**

## Performance

- **Duration:** 7h 20m wall across a session continuation (~1h active execution)
- **Started:** 2026-08-24T14:05:00Z
- **Completed:** 2026-08-24T21:28:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **Task 1 — settlement/disposition matrix (14 tests):** all five dispositions verified end-to-end on a locally deployed diamond — NONE and KEEP_INERT leave the balance and emit `Settled` with amount 0; BURN zeroes the balance, decrements `totalSupply` by exactly the settled amount, and emits `Settled(account, id, amount, BURN, 0x0)`; RETURN_TO_ADDRESS pays only the configured `expirationRecipient` (a third-party caller captures nothing — no-redirect proven); REDEEM_TO_PARENT is supply-neutral at the tree level (child supply down, parent GNUS supply up, `totalSupplyOfAll()` unchanged) with `Settled` destination == account. Idempotency (second settle reverts "Not expired"), clock clearing (`holderExpiresAt` → 0), revert-on-unexpired for both modes, and the "RETURN_TO_ADDRESS needs recipient" configure gate all covered.
- **Task 2 — renewal + mutability matrix (11 tests):** validFrom/validUntil boundaries (exclusive validUntil via `time.increaseTo`), D3 renewal stacking asserted numerically (`clock_new == clock_old + D`, NOT `now + D`, with both `HolderExpiryUpdated` events), settle-first renewal through `mintWithCredential` (Settled + HolderExpiryUpdated on one tx; expired pile never resurrected — `totalSupply == 2` after settle-first of 5 + mint 2), zero-balance fresh clock (with and without a pre-existing expired clock — the latter asserts NO `Settled` event), creator-only timestamp mutation with `ValidFromUpdated`/`ValidUntilUpdated` events, unauthorized mutation revert ("Only creator or admin"), admin-path via `grantRole`, `configureLifecycle` immutable after first mint, and the full Q2 matrix (PerHolder + UNRESTRICTED/ALLOWLISTED/CONTROLLED_RESALE/LOCKED_AFTER_START revert "PerHolder requires non-transferable policy"; + SOULBOUND/ISSUER_ONLY accepted with `LifecycleConfigured`).
- **Task 3 — Foundry invariants:** `LifecycleInvariant.t.sol` with L1 (settle-first no-resurrect: `ghost_resurrections == 0`) and L2 (settle conservation: tree supply == pre-seed baseline − `ghost_totalSettleBurned`) plus `afterInvariant` coverage guards (`ghost_settleCalls > 0`, `ghost_renewalCalls > 0`, deterministically seeded by `seedLifecycleCycle()`). Campaign result: **2 passed, runs 5, calls 50, reverts 0** — handlers hit 16/18/16 calls each (mintPerHolder/advanceTime/settleExpired), non-vacuous.
- **Forge linking gap closed:** `diamonds-forge:test` deploys the diamond in-process via the framework's DeploymentManager, so the per-suite mocha linking hook never runs there. Solved outside the framework with a lazy linker installed via `extendEnvironment` in `hardhat.config.ts` (see Decisions). Verified live: the campaign deployed the diamond with all 105 functions routed, including every facet linking GNUSLifecyclePolicy.

## Task Commits

Each task was committed atomically:

1. **Forge linking prerequisite: lazy GNUSLifecyclePolicy linker** — `acee64c` (fix)
2. **Task 1: settlement + disposition matrix (SC5, D9)** — `e32a3c7` (test)
3. **Task 2: renewal + mutability matrix (SC2, SC8, D4)** — `36a9087` (test)
4. **Task 3: LifecycleInvariant foundry suite + lifecycle handlers** — `d84913b` (test)

**Plan metadata:** _(final docs commit — see git log)_

## Files Created/Modified

- `test/unit/GNUSLifecycleSettle.test.ts` — 25-test settlement/renewal/mutability matrix (created)
- `test/foundry/invariant/LifecycleInvariant.t.sol` — L1/L2 invariants + afterInvariant coverage guards (created)
- `test/foundry/handlers/GeniusDiamondHandler.sol` — append-only lifecycle ghost state + 3 handlers + `seedLifecycleCycle()` (modified)
- `scripts/utils/GNUSLifecyclePolicyLinking.ts` — lazy `installLazyLifecyclePolicyLinker(hre)` + config-load-safe lazy HRE resolution + shared patch installer (modified)
- `hardhat.config.ts` — `extendEnvironment` wiring for the lazy linker (modified, +16 lines)

## Decisions Made

- **Linking solution (the plan's mandated forge-gap fix):** lazy self-bootstrapping linker installed process-wide via `extendEnvironment`. The patched `ethers.getContractFactory` inspects the artifact's `linkReferences`; on the first factory request that links GNUSLifecyclePolicy it deploys the library against `hre.network` (cached in module state) and injects `libraries: { 'contracts/gnus-ai/GNUSLifecyclePolicy.sol:GNUSLifecyclePolicy': address }`. Tasks that never create a factory (compile etc.) are unaffected. Module state is shared with the per-suite `setupLifecyclePolicyLinking()` — whichever runs first installs the patch and the eager mocha path reuses the cached address, so there is no double-deploy and no double-patch. Chosen over modifying the framework (forbidden) or adding a framework hook (none exists: DeploymentManager/ForgeFuzzingFramework expose no pre-deploy extension point). Config-load safety: the module never imports 'hardhat' at top level (`LIB_IMPORTED_FROM_THE_CONFIG` throws during config load); the HRE is resolved lazily or passed explicitly.
- **L2 baseline ordering:** `treeSupplyAtSeed` is captured BEFORE `seedLifecycleCycle()` because `ghost_totalSettleBurned` starts at zero at handler construction and includes the seed burn — a post-seed baseline would double-count it.
- **Target selector restriction:** only the three lifecycle handlers are targeted so the campaign is dense and `ghost_totalMinted`/`ghost_totalBurned` stay zero (kept in the L2 formula so it remains correct if the target set is extended later).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] L2 baseline double-counted the deterministic seed burn**
- **Found during:** Task 3 (LifecycleInvariant authoring, before first run)
- **Issue:** First draft captured `treeSupplyAtSeed` AFTER `seedLifecycleCycle()`, but the ghost counter already included the seed settle burn — the invariant would have failed by exactly `LIFECYCLE_SEED_AMOUNT` on its first check
- **Fix:** Moved the baseline capture ahead of the seed call with an explanatory comment
- **Files modified:** test/foundry/invariant/LifecycleInvariant.t.sol
- **Verification:** Campaign passes with runs 5 / calls 50 / reverts 0
- **Committed in:** d84913b (Task 3 commit)

**2. [Rule 3 - Blocking] Plan's verbatim forge command rejected by the task parser**
- **Found during:** Task 3 verification
- **Issue:** `npx hardhat diamonds-forge:test ... -- --match-contract LifecycleInvariant -vvv` fails with HH305 (Unrecognized param `--`) — the task declares `--match-contract`/`--verbosity` as native params, not pass-through forge args
- **Fix:** Invoked as `--match-contract LifecycleInvariant --verbosity 3` (same semantics)
- **Files modified:** none (invocation only)
- **Verification:** Campaign ran green

### Plan-doc vs shipped-code discrepancies (documentation only, no code changes)

- The plan's Task 3 text names `handler_mintPerHolder(uint256 durationSeed, uint256 amountSeed)`; shipped signature is `(uint256 actorSeed, uint256 amountSeed)` — duration is fixed at token configuration and read via `_getDefaultDuration()`, so a duration seed had nothing to drive. Behavior matches the plan's intent (fuzz-picked actor, bounded amount).
- The plan's context block still references `GNUSLifecycle.sol` for settle/mint entry points that actually live in `GNUSLifecycleMint.sol` after the 13-03 facet split (protocol 2.7); tests were authored against the shipped split.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, both in test harness/invocation) + 2 documentation notes
**Impact on plan:** No production code touched (contracts/gnus-ai submodule untouched at dc1a0f2). No assertions weakened. No scope creep.

## Issues Encountered

- **Config-load crash risk (preempted):** the linking helper originally imported 'hardhat' at top level; hardhat.config.ts imports it during config loading, where hardhat-lib.js throws `LIB_IMPORTED_FROM_THE_CONFIG`. Restructured to resolve the HRE lazily (`require('hardhat')` at call time) or accept an explicit `hre` parameter, registered via `extendEnvironment`. Verified: `npx hardhat compile` clean, mocha path unaffected (GNUSLifecyclePolicy.test.ts 14 passing).
- No test failures from production behavior — all 25 unit tests passed on first run; no contracts-submodule commits were needed (as expected for a test-only plan).

## Verification Results

| Gate | Result |
|------|--------|
| `npx hardhat test test/unit/GNUSLifecycleSettle.test.ts` | **25 passing** (14 Task 1 + 11 Task 2) — ≥22 required |
| `diamonds-forge:test --match-contract LifecycleInvariant` | **2 passed, 0 failed** — runs 5, calls 50, reverts 0; coverage guards non-zero (seeded + fuzz-exercised); exits 0 |
| Full Hardhat regression `npx hardhat test` | **550 passing** (525 baseline + 25 new) / 2 pending / 1 failing — the failing test is the known-stale GNUSControlStorage chainID assertion (31337 vs 0), unchanged per plan constraints |
| Full Foundry regression `yarn forge:test` | **215 passed** (213 baseline + 2 new LifecycleInvariant) / 2 failed (known-stale Phase 08.1 SafeDiamondCut/SafeSingleShotUpgrade setUp reverts, unchanged) / 3 skipped — NO new failures |

Bytecode sizes untouched: no production contract changes; `npx hardhat compile` reports "Nothing to compile" delta from test-only work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 13 acceptance gates SC2/SC5/SC8/D4/D9 are now test-locked; the lifecycle mechanism (13-02/13-03/13-04) is fully covered by unit + invariant suites.
- Any future facet linking GNUSLifecyclePolicy automatically works in both mocha and forge paths via the shared linker — no per-phase rewiring needed.
- Pre-existing uncommitted 13-03-REPLAN.md addendum swept into this plan's metadata commit.
- No blockers.

---
*Phase: 13-time-bound-erc1155-entitlements*
*Completed: 2026-08-24*

## Self-Check: PASSED

- All 6 claimed files verified on disk (2 created, 3 modified, 1 SUMMARY)
- All 4 claimed commits verified in git history (acee64c, e32a3c7, 36a9087, d84913b)
