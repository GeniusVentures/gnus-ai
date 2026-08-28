---
phase: 09-per-child-gnus-treasury-reserve
plan: 01
subsystem: contracts/gnus-ai (storage + factory) + test scaffolds
tags: [phase-9, conversion-native, storage-layout, wave-0]
dependency_graph:
  requires:
    - GNUSNFTFactoryStorage.sol (existing NFT struct + Layout pattern)
    - GNUSNFTFactory.sol (existing createNFTs at lines 152-181)
    - test/unit/GNUSBridge.test.ts (fixture pattern source)
    - test/foundry/handlers/GeniusDiamondHandler.sol (existing handler skeleton)
  provides:
    - GNUSTreasuryStorage.Layout with globalSupply + provenanceInitialized (D8)
    - NFT struct with parentId + nonConvertible appended at END (D5/D7)
    - createNFTs collision guard + parentId/nonConvertible recording (D7/D5)
    - GNUSTreasury.test.ts two-diamond fixture + 13 describe-suite stubs (Wave 0)
    - GeniusDiamondHandler.handler_convert action + ghost_convertCalls (Wave 0)
  affects:
    - Plan 09-02 (GNUSTreasury facet implementation — reads the new storage library)
    - Plan 09-04 (beforeMint rewrite — same file as Task 2 but disjoint edits)
    - Plan 09-05 (invariant + cross-chain tests — fills in Wave-0 stubs)
    - Phase 13 (struct append coordination — appends AFTER Phase 9's parentId/nonConvertible)
tech_stack:
  added: []
  patterns:
    - "keccak256-slotted Layout library (existing project pattern, copied verbatim)"
    - "append-only struct evolution (parentId/nonConvertible at END of NFT struct)"
    - "two-diamond fixture for cross-chain provenance testing (NEW pattern)"
    - "low-level diamond.call for handler_convert so the file compiles pre-09-02"
key_files:
  created:
    - contracts/gnus-ai/GNUSTreasuryStorage.sol
    - test/unit/GNUSTreasury.test.ts
  modified:
    - contracts/gnus-ai/GNUSNFTFactoryStorage.sol
    - contracts/gnus-ai/GNUSNFTFactory.sol
    - test/foundry/handlers/GeniusDiamondHandler.sol
decisions:
  - "GNUSTreasuryStorage slot is keccak256('gnus.ai.treasury.storage') — distinct from all existing storage slots (verified against GNUSNFTFactoryStorage, GNUSControlStorage, GNUSWithdrawLimiterStorage)"
  - "Field order inside GNUSTreasuryStorage.Layout is globalSupply then provenanceInitialized per D8 / research §B — Phase 13 will append after these"
  - "NFT struct appends go strictly at END; comment 'Phase 9 appends below - do not reorder' inserted as coordination marker for Phase 13"
  - "handler_convert uses low-level diamond.call (not a typed facet call) so the handler compiles before Plan 09-02 ships the convert selector"
  - "Two-diamond fixture uses a distinct diamondName ('GeniusDiamondChainB') per 09-PATTERNS.md 'No Analog Found' guidance"
metrics:
  duration_seconds: ~600
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 3
  completed_date: 2026-08-05
---

# Phase 09 Plan 01: Storage Foundation + Wave-0 Scaffolding — Summary

**One-liner:** Landed the storage foundation (GNUSTreasuryStorage library + parentId/nonConvertible NFT struct appends) and the Wave-0 test scaffolds (GNUSTreasury.test.ts two-diamond fixture + handler_convert ghost) so subsequent waves have stable storage shapes and a working harness to write assertions against.

## Tasks Completed

| Task | Name | Inner Commit | Outer Commit | Files |
|------|------|--------------|--------------|-------|
| 1 | GNUSTreasuryStorage library + NFT struct appends | `0cef477` (contracts/gnus-ai) | — | contracts/gnus-ai/GNUSTreasuryStorage.sol (NEW), contracts/gnus-ai/GNUSNFTFactoryStorage.sol (MOD) |
| 2 | createNFTs collision guard + parentId/nonConvertible | `926f4ae` (contracts/gnus-ai) | — | contracts/gnus-ai/GNUSNFTFactory.sol (MOD) |
| 3 | Wave-0 test scaffolds | — | `54b3e48` + `a2e1d21` | test/unit/GNUSTreasury.test.ts (NEW), test/foundry/handlers/GeniusDiamondHandler.sol (MOD), contracts/gnus-ai submodule bump |

## Acceptance Verification

- `npx hardhat clean && npx hardhat compile` → **green** (59 Solidity files compiled, 124 typechain typings generated)
- `forge build` in `test/foundry/` → **exit 0** (warnings only, all pre-existing in unrelated files)
- `grep -c "uint256 parentId" contracts/gnus-ai/GNUSNFTFactoryStorage.sol` → **1**
- `grep -c "bool nonConvertible" contracts/gnus-ai/GNUSNFTFactoryStorage.sol` → **1**
- `grep -c "gnus.ai.treasury.storage" contracts/gnus-ai/GNUSTreasuryStorage.sol` → **1**
- `grep -c "Token ID collision" contracts/gnus-ai/GNUSNFTFactory.sol` → **1** (positioned BEFORE the struct write)
- `grep -c "parentId: parentID" contracts/gnus-ai/GNUSNFTFactory.sol` → **1**
- `grep -c "nonConvertible: false" contracts/gnus-ai/GNUSNFTFactory.sol` → **1**
- `grep -c "handler_convert" test/foundry/handlers/GeniusDiamondHandler.sol` → **1** (function definition)
- `grep -c "ghost_convertCalls" test/foundry/handlers/GeniusDiamondHandler.sol` → **3** (declaration + increment + comment)
- All 13 describe-suite names present in `test/unit/GNUSTreasury.test.ts` as literal strings
- `beforeMint` byte-identical to pre-plan state (deferred to Plan 09-04 per plan task 2 action item 4)

## Deviations from Plan

### Pre-staged work folded in

**[Rule 3 — Blocking] Storage-layer work (Tasks 1 & 2) was already applied to the working tree but never committed.**
- **Found during:** Pre-execution repository survey
- **Issue:** A prior session had applied the storage edits and `createNFTs` guard to the inner `contracts/gnus-ai` submodule, leaving them staged-but-uncommitted. The outer repo showed `M contracts/gnus-ai` (submodule pointer mismatch).
- **Fix:** Verified each edit against the plan's acceptance criteria (slot name, field order, NatSpec updates, collision-guard position, struct literal appends), then committed in two atomic chunks matching the task boundaries (Task 1: storage files; Task 2: GNUSNFTFactory.sol edit). This preserves the per-task commit protocol without redoing the work.
- **Files modified:** contracts/gnus-ai/GNUSTreasuryStorage.sol, contracts/gnus-ai/GNUSNFTFactoryStorage.sol, contracts/gnus-ai/GNUSNFTFactory.sol
- **Commits:** inner `0cef477`, inner `926f4ae`, outer `a2e1d21` (submodule bump)

No other deviations. The plan was executed exactly as written for Task 3.

## Authentication Gates

None.

## Threat Model Notes

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-01 (Tampering — NFT struct append) | mitigate | ✅ Append-only at struct END; existing field order verified unchanged by `git diff` |
| T-09-02 (Tampering — createNFTs id collision) | mitigate | ✅ `require(!NFTs[newTokenID].nftCreated, "Token ID collision")` positioned BEFORE the struct write |
| T-09-03 (Tampering — GNUSTreasuryStorage slot) | mitigate | ✅ `keccak256("gnus.ai.treasury.storage")` — distinct from `gnus.ai.nft.factory.storage`, `gnus.ai.control.storage`, `gnus.ai.withdraw.limiter.storage` (verified by inspection) |
| T-09-SC (Tampering — npm installs) | accept | ✅ No new dependencies added |

## Known Stubs

| Stub | File | Reason | Resolved By |
|------|------|--------|-------------|
| 13 empty `it.skip(...)` blocks | test/unit/GNUSTreasury.test.ts | Wave-0 scaffolding per 09-VALIDATION.md — assertion bodies intentionally empty | Plan 09-04 (suites 1-8) and Plan 09-05 (suites 9-13) |
| `chainBDiamond`/`chainBGeniusDiamond` declared but unused in any `it` body | test/unit/GNUSTreasury.test.ts `cross chain` suite | Two-diamond fixture is scaffolded but no cross-chain assertion runs yet | Plan 09-05 (I3 provenance consistency test) |
| `handler_convert` reverts at runtime (selector absent) | test/foundry/handlers/GeniusDiamondHandler.sol | Deliberate: low-level call compiles before the convert selector lands; ghost_convertCalls stays 0 until then | Plan 09-02 (GNUSTreasury facet ships the selector) |

All three stubs are intentional Wave-0 placeholders documented in the plan and tracked by the Per-Task Verification Map in 09-VALIDATION.md. They do not block the plan's stated goal (storage foundation + scaffolds compile cleanly).

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's `<threat_model>` already enumerates.

## Files Created/Modified (Absolute Paths)

- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSTreasuryStorage.sol` (NEW, 31 lines)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (MOD, +5/-2 lines)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSNFTFactory.sol` (MOD, +4/-1 lines)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/test/unit/GNUSTreasury.test.ts` (NEW, 226 lines)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/test/foundry/handlers/GeniusDiamondHandler.sol` (MOD, +48 lines)

## Self-Check: PASSED

- `GNUSTreasuryStorage.sol` exists in the inner submodule ✓
- `GNUSTreasury.test.ts` exists in the outer repo ✓
- Inner commits `0cef477` and `926f4ae` present in `git log` of contracts/gnus-ai ✓
- Outer commits `54b3e48` and `a2e1d21` present in `git log` of gnus-ai ✓
- `npx hardhat compile` exit 0 ✓
- `forge build` exit 0 ✓
