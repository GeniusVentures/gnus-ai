---
phase: 02-dead-code-removal
plan: 02
subsystem: contracts
tags: [solidity, cleanup, facet, diamond, config]

# Dependency graph
requires:
  - "Phase 02-01 — DiamondInitFacet refactored (no more references to GeniusAI)"
provides:
  - GeniusAI facet removed — escrow moved to SuperGenius chain
  - 3 diamond configs cleaned of GeniusAI entries
  - All generated types, artifacts, and cache verified clean
affects: [03-input-validation, 04-access-control]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead code removal pattern: inventory imports → delete → config cleanup → recompile → verify generated output"

key-files:
  created:
    - test/unit/cleanup-02-02.test.sh
  deleted:
    - contracts/gnus-ai/GeniusAI.sol
    - contracts/gnus-ai/GeniusAIStorage.sol
    - test/unit/GeniusAI.test.ts
    - test/unit/GeniusAIStorage.test.ts
    - docs/GeniusAI.md
    - docs/GeniusAIStorage.md
  modified:
    - diamonds/GeniusDiamond/geniusdiamond.config.json
    - diamonds/GeniusDiamond/geniusdiamond-erc1155override.config.json
    - test-assets/test-diamonds/GeniusDiamond/geniusdiamond.config.json

key-decisions:
  - "No other contracts imported GeniusAI — confirmed via grep before deletion"
  - "Removed GeniusAI from ALL 3 active configs (primary, override, test) — no stale refs"
  - "Used yarn instead of npx for compilation due to npm config incompatibility"

patterns-established:
  - "Facet removal pattern: verify zero external imports → delete source → clean configs → recompile → verify typechain/cache/artifacts"

requirements-completed:
  - DEBT-01

# Metrics
duration: 3min
completed: 2026-05-28
---

# Phase 02 Plan 02: Remove GeniusAI Facet

**Removed GeniusAI facet from the codebase — escrow functionality moved to SuperGenius chain (DEBT-01)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-28
- **Completed:** 2026-05-28
- **Tasks:** 3 (all completed)
- **Files deleted:** 6 (2 .sol, 2 .ts, 2 .md)
- **Files modified:** 3 (diamond configs)

## Accomplishments

### Task 1: Delete GeniusAI Source Files

- Deleted `contracts/gnus-ai/GeniusAI.sol` (40 lines — escrow facet)
- Deleted `contracts/gnus-ai/GeniusAIStorage.sol` (39 lines — AI escrow storage)
- Deleted `test/unit/GeniusAI.test.ts` and `test/unit/GeniusAIStorage.test.ts`
- Deleted `docs/GeniusAI.md` and `docs/GeniusAIStorage.md`
- Verified zero other Solidity contracts imported GeniusAI before deletion
- Cleaned Hardhat cache with `yarn hardhat clean`

### Task 2: Remove from Diamond Configs

- Removed GeniusAI facet entries from `diamonds/GeniusDiamond/geniusdiamond.config.json` (primary)
- Removed GeniusAI facet entries from `diamonds/GeniusDiamond/geniusdiamond-erc1155override.config.json` (override)
- Removed GeniusAI facet entries from `test-assets/test-diamonds/GeniusDiamond/geniusdiamond.config.json` (test)
- All 3 configs validated as valid JSON after removal

### Task 3: Recompile and Verify

- Full recompilation: 60 Solidity files compiled successfully
- 128 TypeChain typings generated
- Zero "GeniusAI" references in typechain-types/, artifacts/, or cache/

## Task Commits

| Commit (parent) | Commit (gnus-ai) | Commit (diamond) | Task      |
| --------------- | ---------------- | ---------------- | --------- |
| `20d1b92`       | `7261772`        | `4bc74c3`        | Tasks 1-3 |

## Acceptance Criteria Verification

| #   | Criterion                        | Result |
| --- | -------------------------------- | ------ |
| 1   | GeniusAI.sol deleted             | PASS   |
| 2   | GeniusAIStorage.sol deleted      | PASS   |
| 3   | Test files deleted               | PASS   |
| 4   | No "GeniusAI" in primary config  | PASS   |
| 5   | No "GeniusAI" in override config | PASS   |
| 6   | No "GeniusAI" in test config     | PASS   |
| 7   | All configs valid JSON           | PASS   |
| 8   | `yarn hardhat compile` exits 0   | PASS   |
| 9   | No GeniusAI in typechain-types   | PASS   |

## Threat Mitigation

| Threat ID                                   | Status                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| T-02-03 (DoS — config JSON breakage)        | Resolved — all 3 configs validated as valid JSON after removal |
| T-02-04 (Info Disclosure — stale typechain) | Resolved — zero GeniusAI references in generated output        |

## Decisions Made

- Committed deletions atomically by submodule (gnus-ai, diamonds) with single parent commit
- Used `yarn` instead of `npx` consistently due to npm `.npmrc` config issue

## Issues Encountered

- `diamonds/GeniusDiamond` is a separate git submodule — config changes committed there separately from parent repo

## Next Phase Readiness

- Phase 2 complete: DiamondInitFacet refactored, GeniusAI facet removed
- All 4 requirements (DEBT-01, DEBT-04, DEBT-05, QUAL-01) satisfied
- Ready for Phase 3: Input Validation

## Self-Check: PASSED

- SUMMARY.md: FOUND at `.planning/phases/02-dead-code-removal/02-02-SUMMARY.md`
- gnus-ai submodule: `7261772` (GeniusAI files deleted)
- diamond submodule: `4bc74c3` (config entries removed)
- Parent commit: `20d1b92` (all files tracked)
- TDD script: 9/9 tests pass

---

_Phase: 02-dead-code-removal_
_Completed: 2026-05-28_
