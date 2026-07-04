---
phase: 01-preliminary-cleanup
plan: 02
subsystem: configuration
tags: [hardhat, config, typescript, networks, cleanup]

# Dependency graph
requires: []
provides:
  - Clean hardhat.config.ts with zero commented-out network blocks
  - 8 active networks remaining fully configured
affects:
  [
    02-dead-code-removal,
    03-input-validation,
    04-access-control,
    05-circuit-breaker,
    06-test-coverage,
    07-dependency-hardening,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Targeted config cleanup: removed only commented blocks, preserved all active entries"

key-files:
  created: []
  modified:
    - hardhat.config.ts

key-decisions:
  - "Removed 11 commented-out network blocks in two batches: (1) polygon duplicate, (2) 10 stale/deprecated blocks at end of networks object"
  - "All 8 active networks preserved with full configuration: sepolia, polygon, mainnet, bsc, base, polygon_amoy, base_sepolia, bsc_testnet"
  - "No replacement needed — removed blocks were duplicates of active entries or deprecated networks (arbitrum, local)"

patterns-established:
  - "Config cleanup pattern: validate with grep for commented blocks and active entries, then compilation gate"

requirements-completed:
  - DEBT-06

# Metrics
duration: 2min
completed: 2026-05-27
---

# Phase 01 Plan 02: Config Cleanup — Remove Commented-Out Network Blocks

**Removed 11 commented-out network configuration blocks from hardhat.config.ts (DEBT-06)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-27
- **Completed:** 2026-05-27
- **Tasks:** 1
- **Files modified:** 1 (hardhat.config.ts, 48 lines deleted)

## Accomplishments

- Removed commented-out duplicate of active `polygon` network (lines 237-241)
- Removed 10 stale/deprecated commented-out network blocks (lines 282-324): arbitrum_sepolia, arbitrum, base_sepolia copy, bsc_testnet copy, polygon_amoy copy, local, mainnet copy, bsc copy, base copy
- All 8 active networks preserved with their full configuration intact
- Hardhat config remains valid TypeScript — compilation passes

## Task Commits

| Commit    | Type                                                                     |
| --------- | ------------------------------------------------------------------------ |
| `f929fd0` | chore: remove commented-out network config blocks from hardhat.config.ts |

## Files Modified

- `hardhat.config.ts` — 48 deletions, zero additions

## Acceptance Criteria Verification

| #   | Criterion                                                                                                                        | Result |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | `grep "//.*arbitrum\|//.*local:\|//.*polygon:\|//.*mainnet:\|//.*bsc\|//.*base:"` returns zero matches                           | PASS   |
| 2   | All 8 active networks (sepolia, polygon, mainnet, bsc, base, polygon_amoy, base_sepolia, bsc_testnet) present in networks object | PASS   |
| 3   | `yarn hardhat compile` exits 0                                                                                                   | PASS   |

## Threat Mitigation

| Threat ID                 | Disposition                             | Status                                                                                                        |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| T-01-04 (DoS)             | Avoid accidental active network removal | Resolved — targeted removal of only commented blocks, grep verification confirms all 8 active entries present |
| T-01-05 (Info Disclosure) | Accept risk                             | Accepted — commented-out configs reference env var names only, no literal secrets                             |

## Decisions Made

- Removed all commented blocks in one commit — scope is limited to a single file with clear before/after verification
- No refactoring of active network config — plan scope is removal only

## Deviations from Plan

None — executed exactly as planned.

## Issues Encountered

None.

## Next Phase Readiness

- hardhat.config.ts is clean with only active network entries
- Phase 1 complete — all 3 requirements (DEBT-02, DEBT-03, DEBT-06) satisfied
- Ready for Phase 2: Dead Code Removal

## Self-Check: PASSED

- SUMMARY.md: FOUND at `.planning/phases/01-preliminary-cleanup/01-02-SUMMARY.md`
- Commit: `f929fd0` (chore)
- All acceptance criteria verified: zero commented-out networks, 8 active networks present, compilation passes

---

_Phase: 01-preliminary-cleanup_
_Completed: 2026-05-27_
