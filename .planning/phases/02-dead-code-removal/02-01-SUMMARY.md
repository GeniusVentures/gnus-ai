---
phase: 02-dead-code-removal
plan: 01
subsystem: contracts
tags: [solidity, diamond, access-control, erc-165, inheritance]

# Dependency graph
requires:
  - "Phase 01 — ^0.8.19 pragmas standardized (for consistent compilation)"
provides:
  - DiamondInitFacet inherits GeniusAccessControl — no duplicate modifier
  - diamondInitialize250() uses _setupRole only — no duplicate _grantRole calls
  - supportsInterface() override with LibDiamond storage integration
affects: [04-access-control, 05-circuit-breaker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ERC-165 supportsInterface pattern: super call + LibDiamond.diamondStorage().supportedInterfaces"

key-files:
  created:
    - test/unit/cleanup-02-01.test.sh
  modified:
    - contracts/gnus-ai/DiamondInitFacet.sol

key-decisions:
  - "Changed inheritance from AccessControlEnumerableUpgradeable direct to GeniusAccessControl (which extends AccessControlEnumerableUpgradeable) — eliminates duplicate onlySuperAdminRole modifier"
  - "Removed _grantRole calls because _setupRole internally calls _grantRole AND sets admin role — the standalone calls were redundant"
  - "Used super.supportsInterface() pattern instead of explicit parent references — only one parent provides supportsInterface in this hierarchy"
  - "Removed UPGRADER_ROLE constant from DiamondInitFacet since GeniusAccessControl already defines it"

patterns-established:
  - "Single-inheritance diamond facet pattern: facet inherits abstract base for access control"
  - "_setupRole as sole role assignment — no companion _grantRole calls"

requirements-completed:
  - DEBT-04
  - DEBT-05
  - QUAL-01

# Metrics
duration: 4min
completed: 2026-05-28
---

# Phase 02 Plan 01: DiamondInitFacet Refactor

**Refactored DiamondInitFacet.sol to eliminate duplicated code and add ERC-165 support (DEBT-04, DEBT-05, QUAL-01)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-28
- **Completed:** 2026-05-28
- **Tasks:** 3 (all completed)
- **Files modified:** 1 (.sol) + 1 (test script)

## Accomplishments

### Task 1: Inheritance Change (DEBT-05)

- Replaced `AccessControlEnumerableUpgradeable` with `GeniusAccessControl` in contract declaration
- Added `import "./GeniusAccessControl.sol"`
- Removed local `onlySuperAdminRole` modifier (now inherited from GeniusAccessControl — byte-identical check)
- Removed `UPGRADER_ROLE` constant (now inherited from GeniusAccessControl)

### Task 2: Deduplicate Role Assignment (DEBT-04)

- Removed 3 redundant `_grantRole()` calls from `diamondInitialize250()`
- `_setupRole()` already calls `_grantRole()` internally AND sets the role's admin — the standalone calls were redundant

### Task 3: ERC-165 Support (QUAL-01)

- Added `supportsInterface()` override following the GNUSBridge/GNUSNFTFactory pattern
- Checks both `super.supportsInterface(interfaceId)` and `LibDiamond.diamondStorage().supportedInterfaces[interfaceId]`
- Used `virtual override` since there is only one parent with `supportsInterface`

## Task Commits

| Commit (parent) | Commit (submodule) | Task                                             |
| --------------- | ------------------ | ------------------------------------------------ |
| `41de1e1`       | `de09bba`          | Tasks 1-3: inheritance, dedup, supportsInterface |

## Files Created/Modified

**Modified:**

- `contracts/gnus-ai/DiamondInitFacet.sol` — 9 insertions, 18 deletions

**Created:**

- `test/unit/cleanup-02-01.test.sh` — 8 tests verifying DEBT-04, DEBT-05, QUAL-01 compliance

## Acceptance Criteria Verification

| #   | Criterion                                                              | Result |
| --- | ---------------------------------------------------------------------- | ------ |
| 1   | No local `onlySuperAdminRole` modifier                                 | PASS   |
| 2   | `contract DiamondInitFacet is ContextUpgradeable, GeniusAccessControl` | PASS   |
| 3   | Zero `_grantRole` calls in DiamondInitFacet.sol                        | PASS   |
| 4   | 3 `_setupRole` calls preserved                                         | PASS   |
| 5   | `supportsInterface()` override present                                 | PASS   |
| 6   | LibDiamond.diamondStorage().supportedInterfaces check                  | PASS   |
| 7   | `super.supportsInterface(interfaceId)` call                            | PASS   |
| 8   | `yarn hardhat compile` exits 0                                         | PASS   |

## Threat Mitigation

| Threat ID                                    | Status                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| T-02-01 (Tampering — inheritance change)     | Resolved — GeniusAccessControl modifier is byte-identical to removed local modifier |
| T-02-02 (Elevation — role assignment change) | Resolved — `_setupRole` internally calls `_grantRole`, no access control change     |

## Deviations from Plan

- All 3 tasks committed atomically (single commit in submodule + parent) — all changes affect same file, separating would create unnecessary intermediate compilation states
- TDD script created and verified — 8/8 tests pass
- `npx`→`yarn` in test script due to npm config incompatibility

## Issues Encountered

- `((PASS++))` bashism with `set -e` causes script exit when PASS=0 — fixed with helper functions
- `npx hardhat compile` fails due to npm `before` config value — switched to `yarn hardhat compile`

## Next Phase Readiness

- DiamondInitFacet.sol is now properly structured with inherited access control and ERC-165 support
- Ready for Plan 02-02: GeniusAI facet removal

## Self-Check: PASSED

- SUMMARY.md: FOUND at `.planning/phases/02-dead-code-removal/02-01-SUMMARY.md`
- Submodule commit: `de09bba` (feat)
- Parent commit: `41de1e1` (refactor)
- TDD script: 8/8 tests pass

---

_Phase: 02-dead-code-removal_
_Completed: 2026-05-28_
