---
phase: 09-per-child-gnus-treasury-reserve
plan: 02
subsystem: contracts/gnus-ai (GNUSTreasury facet)
tags: [phase-9, conversion-native, facet, wave-1]
dependency_graph:
  requires:
    - contracts/gnus-ai/GNUSTreasuryStorage.sol (09-01)
    - contracts/gnus-ai/GNUSNFTFactoryStorage.sol (09-01 NFT struct with parentId + nonConvertible)
    - contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol (checkAndRecordWithdraw + SuperAdminBypass)
    - contracts/gnus-ai/GNUSERC1155MaxSupply.sol (hook semantics for limiter charge matrix)
    - contracts/gnus-ai/GeniusAccessControl.sol (onlySuperAdminRole, DEFAULT_ADMIN_ROLE)
  provides:
    - GNUSTreasury.convert(fromId,toId,minionAmount,to) — supply-neutral reallocation (D3)
    - GNUSTreasury.unitsOf / totalUnitsOf — display views (D2)
    - GNUSTreasury.totalSupplyOfAll — cross-chain provenance view (D8)
    - GNUSTreasury.GNUSTreasury_Initialize300 — one-shot super-admin provenance seed
    - GNUSTreasury.syncGlobalSupply — DEFAULT_ADMIN honesty valve with audit event
    - convert selector for Plan 09-04 (beforeMint rewrite) and Plan 09-05 (tests)
  affects:
    - Plan 09-03 (geniusdiamond.config.json must register the new facet + initializer)
    - Plan 09-04 (beforeMint rewrite defers to convert for depth >= 2 mints)
    - Plan 09-05 (unit tests + invariant tests assert against this facet's ABI)
    - test/foundry/handlers/GeniusDiamondHandler.sol (handler_convert low-level call now resolves)
tech_stack:
  added: []
  patterns:
    - "WR-07 charge matrix: explicit limiter charge ONLY on GNUS-terminal convert leg"
    - "Super-admin bypass via LibDiamond.diamondStorage().contractOwner check (matches GNUSBridge.sol:181-187)"
    - "One-shot bool guard for chain-specific seed (not a version compare)"
    - "Event-before-write for audit (GlobalSupplySynced captures old value)"
    - "require-string validation (no custom errors — matches project convention)"
key_files:
  created:
    - contracts/gnus-ai/GNUSTreasury.sol
  modified: []
decisions:
  - "Deployed bytecode for GNUSTreasury: 17347 bytes after both tasks (16716 after Task 1 alone). Well under EIP-170 24576 budget."
  - "Measurement path: hardhat size-contracts plugin NOT present in hardhat.config.ts / package.json; used the deterministic fallback (`node -e` reading artifacts/.../GNUSTreasury.json deployedBytecode) per plan acceptance criteria."
  - "NFT struct reference uses file-scope `NFT` (not `GNUSNFTFactoryStorage.NFT`) — struct is declared at file scope in GNUSNFTFactoryStorage.sol (line 10), not inside the library. Initial draft used library-qualified name and failed DeclarationError; corrected inline."
  - "Event declarations live on the facet (not on GNUSTreasuryStorage library). Plan action item 4 explicitly permits this; matches GNUSControl.sol precedent."
  - "convert never touches GNUSTreasuryStorage.layout() — Pitfall 2 compliance verified by grep (globalSupply hits confined to totalSupplyOfAll + Initialize300 + syncGlobalSupply)."
metrics:
  duration_seconds: 291
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
  completed_date: 2026-08-05
---

# Phase 09 Plan 02: GNUSTreasury Facet — Summary

**One-liner:** Shipped the conversion-native facet — `convert` for supply-neutral reallocation with the WR-07 charge matrix, D2 display views, D8 provenance view + one-shot initializer + auditable sync — in a single new file under 17.4 KB deployed bytecode.

## Tasks Completed

| Task | Name | Inner Commit | Files |
|------|------|--------------|-------|
| 1 | GNUSTreasury facet — convert + display views + revert matrix | `7c0ef13` (contracts/gnus-ai) | contracts/gnus-ai/GNUSTreasury.sol (NEW, 148 lines) |
| 2 | GNUSTreasury — Initialize300 + syncGlobalSupply | `82b7832` (contracts/gnus-ai) | contracts/gnus-ai/GNUSTreasury.sol (MOD, +27 lines) |

## Acceptance Verification

### Task 1

- `npx hardhat compile` → **green** (1 Solidity file compiled, 44 typechain typings generated)
- `grep -c 'function convert(' GNUSTreasury.sol` → **1**
- `grep -c 'function unitsOf(' GNUSTreasury.sol` → **1**
- `grep -c 'function totalUnitsOf(' GNUSTreasury.sol` → **1**
- `grep -c 'function totalSupplyOfAll(' GNUSTreasury.sol` → **1**
- `grep -c 'event Converted(' GNUSTreasury.sol` → **1**
- `grep -c 'event GlobalSupplyInitialized(' GNUSTreasury.sol` → **1**
- `grep -c 'event GlobalSupplySynced(' GNUSTreasury.sol` → **1**
- `grep -c 'RATE_SCALE' GNUSTreasury.sol` → **3** (declaration + 2 uses)
- `grep -c 'checkAndRecordWithdraw' GNUSTreasury.sol` → **1** (single charge site, inside `if (toId == GNUS_TOKEN_ID)` block)
- `grep -c 'GNUSTreasury.convert' GNUSTreasury.sol` → **1** (SuperAdminBypass context string)
- `grep -c 'Global supply not initialized' GNUSTreasury.sol` → **1**
- `grep -n 'globalSupply' GNUSTreasury.sol` → only docstrings + `totalSupplyOfAll` body (NO references inside `convert`)
- Custom error syntax: **none** (only string-message `require`)
- **Bytecode size: 16716 bytes** (measurement path: deterministic fallback `node -e` reading artifacts — no `hardhat-contract-sizer` plugin present in `hardhat.config.ts` or `package.json`)

### Task 2

- `npx hardhat compile` → **green**
- `grep -c 'GNUSTreasury_Initialize300' GNUSTreasury.sol` → **2** (function def + NatSpec @notice reference)
- `grep -c 'syncGlobalSupply' GNUSTreasury.sol` → **2** (function def + NatSpec @notice reference)
- `grep -c 'onlySuperAdminRole' GNUSTreasury.sol` → **1** (on Initialize300)
- `grep -c 'onlyRole(DEFAULT_ADMIN_ROLE)' GNUSTreasury.sol` → **1** (on syncGlobalSupply)
- `grep -c 'Already initialized' GNUSTreasury.sol` → **1** (one-shot guard)
- `grep -c 'Not initialized' GNUSTreasury.sol` → **1** (syncGlobalSupply pre-init guard)
- **Bytecode size after Task 2: 17347 bytes** (still well under EIP-170 24576 budget)

### Charge matrix verification (source inspection)

- `convert` contains exactly ONE `checkAndRecordWithdraw(sender, minionAmount)` call.
- That call is inside `if (toId == GNUS_TOKEN_ID) { ... }` (GNUS-terminal leg, where the mint leg is hook-exempt).
- NO explicit charge exists outside that block — the GNUS→child leg relies on `_burn(sender, GNUS_TOKEN_ID, ...)` routing through `_beforeTokenTransfer` (non-mint, id == 0) which charges the hook automatically.
- child→child has no limiter interaction at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Initial `NFT` reference used library-qualified name**
- **Found during:** Task 1 compile
- **Issue:** Initial draft wrote `GNUSNFTFactoryStorage.NFT storage fromNft = ...` but the `NFT` struct is declared at FILE scope in `GNUSNFTFactoryStorage.sol` (line 10), NOT inside the `library GNUSNFTFactoryStorage { ... }` block. Compilation failed with `DeclarationError: Identifier not found or not unique`.
- **Fix:** Dropped the library qualifier — `NFT storage fromNft = ...`. Matches the usage pattern in `GNUSNFTFactory.sol` and `GNUSBridge.sol` (both use bare `NFT`).
- **Files modified:** contracts/gnus-ai/GNUSTreasury.sol (pre-commit, folded into Task 1 commit `7c0ef13`)
- **Commit:** `7c0ef13` (single commit, no separate fixup)

No other deviations. Both tasks executed exactly as written otherwise.

## Authentication Gates

None.

## Threat Model Notes

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-04 (EoP — syncGlobalSupply) | mitigate | ✅ `onlyRole(DEFAULT_ADMIN_ROLE)` gate; every call emits `GlobalSupplySynced` (auditable) |
| T-09-05 (Tampering — Initialize300) | mitigate | ✅ `onlySuperAdminRole` + one-shot `provenanceInitialized` bool guard; second call reverts `"Already initialized"` |
| T-09-06 (Tampering — convert double-charge) | mitigate | ✅ Explicit charge ONLY inside `if (toId == GNUS_TOKEN_ID)` block; grep confirms 1 occurrence; unit tests in Plan 09-04 will pin the matrix |
| T-09-07 (EoP — convert limiter bypass) | mitigate | ✅ GNUS-terminal leg has explicit charge (mint leg is hook-exempt per research §G); super-admin bypass emits `SuperAdminBypass` with context `"GNUSTreasury.convert"` |
| T-09-08 (Tampering — convert unbacked mint) | mitigate | ✅ `_burn(sender, fromId, minionAmount)` reverts on insufficient balance (ERC1155Storage check); no mint-from-nothing path |
| T-09-09 (Tampering — nonConvertible bypass) | mitigate | ✅ `nonConvertible` checked on both source and destination (when id != GNUS_TOKEN_ID) before state transition |
| T-09-10 (Info Disclosure — uninitialized totalSupplyOfAll) | mitigate | ✅ Reverts `"Global supply not initialized"` when `!provenanceInitialized` |
| T-09-11 (Tampering — unitsOf/totalUnitsOf on id 0) | mitigate | ✅ Explicit `require(id != GNUS_TOKEN_ID, "GNUS has no child units")` |
| T-09-12 (Tampering — convert reentrancy) | accept | ✅ `_burn` before `_mint` (checks-effects-interactions); both calls are intra-diamond ERC1155 primitives, no external calls |
| T-09-SC (Tampering — npm installs) | accept | ✅ No new dependencies added |

## Known Stubs

None. The facet is functionally complete per the plan's success criteria. (Test-side stubs from Plan 09-01 — the 13 `it.skip(...)` suites in `test/unit/GNUSTreasury.test.ts` and the `handler_convert` runtime revert — are resolved by Plans 09-04/09-05, not this plan.)

## Threat Flags

None. The facet's surface (convert + views + 2 admin functions) is fully enumerated in the plan's `<threat_model>`. No new network endpoints, auth paths, file access patterns, or schema changes beyond what was threat-modeled.

## Files Created/Modified (Absolute Paths)

- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSTreasury.sol` (NEW, 175 lines after both tasks)

## Self-Check: PASSED

- `GNUSTreasury.sol` exists at the expected path ✓
- Inner commits `7c0ef13` (Task 1) and `82b7832` (Task 2) present in `git log` of contracts/gnus-ai ✓
- `npx hardhat compile` exit 0 after each task ✓
- Deployed bytecode 17347 bytes < 24576 (EIP-170) ✓
- Single charge site inside GNUS-terminal block ✓
- No `globalSupply` reference inside `convert` ✓
- All required functions/events/constants present per grep ✓
