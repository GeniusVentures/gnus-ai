---
phase: 17-test-suite-determinism
plan: 04
subsystem: testing
tags: [foundry, forge, invariant-testing, vm-skip, access-control, safe-wallet, determinism]

# Dependency graph
requires:
  - phase: 08.1-safe-wallet-proposer-retrofit-for-diamondcut-proposals
    provides: the Safe fork tests (SafeSingleShotUpgrade/SafeDiamondCut) whose setUp fork dependency is declared here
  - phase: 07 (STATE 07-04 record)
    provides: the recorded AccessControlInvariant flake root cause this plan fixes
provides:
  - AccessControlInvariant asserts the never-granted subject `attacker` — deterministic by construction (TEST-05 root fix)
  - Both Safe test setUps declare their sepolia/anvil fork dependency via vm.skip (TEST-06 root fix, D-04)
  - Verified full-gate arithmetic for the 17-05 ledger: 215 passed / 0 failed / 5 skipped (was 215/2/3)
affects: [17-05 baseline ledger, every future phase that cites the Foundry gate baseline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Invariant subjects must sit OUTSIDE the handler's fuzz surface (GeniusDiamondHandler.actors + roles[]); the never-granted convention is `attacker` (declared in GeniusDiamondTestBase, never pushed into actors)"
    - "setUp-level fork-dependency declaration: `vm.skip(<canonical-deployment>.code.length == 0, \"reason\")` as the first setUp statement — one [SKIP] entry per contract on forge 1.7.1"

key-files:
  created: []
  modified:
    - test/foundry/invariant/AccessControlInvariant.t.sol
    - test/foundry/unit/SafeSingleShotUpgrade.t.sol
    - test/foundry/unit/SafeDiamondCut.t.sol

key-decisions:
  - "Task 1 soundness comment avoids the literal token `user3` (phrased as 'the former subject actors[3]') so the plan's own zero-`user3` acceptance gate holds — comment wording is delegated discretion per 17-CONTEXT.md"
  - "forge 1.7.1 renders custom skip reasons with a `skipped: ` infix: observed `[SKIP: skipped: requires sepolia/anvil fork with canonical Safe deployments] setUp()` — reason-string count is exactly 2 as required; the plan's expected literal omitted the infix"

patterns-established:
  - "Fork-dependent Foundry tests skip at setUp on code-presence probes of the canonical deployment they require, never revert on the default bridge-node gate"

requirements-completed: [TEST-05, TEST-06]

# Metrics
duration: 4min
completed: 2026-08-31
---

# Phase 17 Plan 04: Foundry Failure Root Fixes Summary

**Re-targeted the flaky AccessControlInvariant assertion from `user3` (inside the handler's fuzz grant surface) to the never-granted `attacker`, and declared both Safe-test fork dependencies via setUp `vm.skip` — full Foundry gate 215 passed / 0 failed / 5 skipped (was 215/2/3)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-31T20:59:43Z
- **Completed:** 2026-08-31T21:03:35Z
- **Tasks:** 3 (2 code tasks + 1 verification-only)
- **Files modified:** 3 (4 line-level changes: 1 doc line, 1 comment block, 1 assertion, 2 identical skip insertions)

## Accomplishments
- `invariant_revokingUnownedRoleIsSafe` now asserts `_hasRole(UPGRADER_ROLE, attacker)` — `attacker` is declared in `GeniusDiamondTestBase` (:97 `makeAddr("attacker")`) and never pushed into `GeniusDiamondHandler.actors` (:85-88), so no fuzz sequence can grant it any role; the former subject `user3` = `actors[3]` was legitimately grantable via `handler_grantRole` (`roles[3]` = UPGRADER_ROLE, :540-547) — the 07-04 flake's root cause (TEST-05 / D-01)
- Both Safe setUps open with `vm.skip(SAFE_PROXY_FACTORY.code.length == 0, "requires sepolia/anvil fork with canonical Safe deployments")` — the canonical Sepolia factory `0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC` has no code on the bridge-node fork, so the `createProxyWithNonce` call was an undeclared environmental dependency, now declared (TEST-06 / D-04)
- Gate proof through the required wrapper path: bridge node spawned + polled, full `yarn forge:test` 0 failed with exactly 2 reason-bearing setUp skips, invariant-only run green, node killed

## Gate Record (D-05 — observed counts for the 17-05 ledger)

| Run | Command | Result | Log |
|---|---|---|---|
| Full Foundry gate | `yarn forge:test` (bridge node at 127.0.0.1:8545) | **215 passed / 0 failed / 5 skipped** (220 total, 37 suites), exit 0 — was 215/2/3; passed unchanged, 2 failed → 0, skips 3 → 5 | /tmp/17-04-forge-full.log |
| Invariant-only | `npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --network localhost --force --match-contract AccessControlInvariant` | **8 passed / 0 failed / 0 skipped**, exit 0; `invariant_revokingUnownedRoleIsSafe() (runs: 5, calls: 50, reverts: 1)` PASS | /tmp/17-04-invariant.log |

Skip-entry detail (forge 1.7.1 prefixes custom reasons with `skipped: `):
- SafeDiamondCutTest → `[SKIP: skipped: requires sepolia/anvil fork with canonical Safe deployments] setUp() (gas: 0)`
- SafeSingleShotUpgradeTest → `[SKIP: skipped: requires sepolia/anvil fork with canonical Safe deployments] setUp() (gas: 0)`
- The other 3 skips are the pre-existing runtime-conditional `deployment.t.sol` entries (unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: D-01 — re-target invariant_revokingUnownedRoleIsSafe from user3 to attacker** - `2100c5a` (fix)
2. **Task 2: D-04 — vm.skip fork gate as first statement of both Safe setUps** - `1cdb275` (fix)
3. **Task 3: Gate proof through the bridge node** - no commit (verification-only per plan; results above)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `test/foundry/invariant/AccessControlInvariant.t.sol` - stale `:257` NatSpec doc now references `attacker`; `:275-279` soundness comment + assertion re-targeted to the never-granted subject with updated revert string
- `test/foundry/unit/SafeSingleShotUpgrade.t.sol` - setUp opens with the 4-line fork-dependency comment + `vm.skip` probe (new first statement at :67)
- `test/foundry/unit/SafeDiamondCut.t.sol` - identical gate (new first statement at :54)

Untouched as required: `test/foundry/handlers/GeniusDiamondHandler.sol`, `foundry.toml`, no import lines in either Safe file (verified empty import diff).

## Decisions Made
- Task 1 comment phrasing: the plan's example soundness comment contained the literal `user3`, which would trip the plan's own `grep -c "user3" = 0` acceptance gate; 17-CONTEXT.md delegates comment wording to Claude, so it reads "the former subject actors[3] was legitimately grantable via handler_grantRole (roles[3] = UPGRADER_ROLE)" — full rule stated, zero `user3` references (case-insensitive) remain
- No `invariant.seed` / `fuzz.seed` reliance anywhere (D-02 DO-NOT-REPROPOSE honored — the fix is subject soundness, not seeding)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- forge 1.7.1 renders setUp skip reasons as `[SKIP: skipped: <reason>]` — the plan's expected literal `[SKIP: requires sepolia/anvil fork ...]` differs by the `skipped: ` infix. Purely cosmetic; the acceptance substance (exactly 2 reason-bearing skips, one per Safe contract, 0 failed) holds. Recorded so 17-05's ledger greps use the actual rendering.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TEST-05 and TEST-06 root fixes proven; the Foundry gate has zero known-stale/failing entries at 215/0/5
- 17-05 (baseline ledger) consumes the counts above plus 17-02/17-03's Hardhat-side figures; D-06's N-run determinism proof runs there

## Self-Check: PASSED

- 17-04-SUMMARY.md, AccessControlInvariant.t.sol, SafeSingleShotUpgrade.t.sol, SafeDiamondCut.t.sol all present
- must_haves artifacts verified on disk: `_hasRole(UPGRADER_ROLE, attacker)` x1; `vm.skip(SAFE_PROXY_FACTORY.code.length == 0` x1 per Safe file
- Commits 2100c5a and 1cdb275 present in git log
- TEST-05/TEST-06 exist in REQUIREMENTS.md (lines 11-12, traceability rows 48-49)

---
*Phase: 17-test-suite-determinism*
*Completed: 2026-08-31*
