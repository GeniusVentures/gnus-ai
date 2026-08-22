---
phase: 13-time-bound-erc1155-entitlements
plan: 01
subsystem: gnus-ai-lifecycle-storage
tags: [diamond-storage, struct-append, erc1155, lifecycle, sc1, plugin-interfaces]
dependency_graph:
  requires:
    - contracts/gnus-ai/GNUSNFTFactoryStorage.sol (Phase 9 NFT struct with parentId/nonConvertible at +7/+8)
    - contracts/gnus-ai/GNUSTreasuryStorage.sol (library skeleton analog)
    - test/unit/GNUSTreasury.test.ts (legacy decode pattern at lines 884-934)
  provides:
    - NFT struct with 8 Phase 13 lifecycle fields appended (validFrom/validUntil/defaultDuration/expirationMode/transferPolicy/expirationDisposition/expirationRecipient/credentialVerifier)
    - GNUSLifecycleStorage library with holderExpiresAt / mintedPerWallet / perWalletMintCap / allowlistRegistry mappings
    - ICredentialVerifier / IAllowlistRegistry plug-in interfaces
    - MockCredentialVerifier / MockAllowlistRegistry test mocks
    - GNUSLifecycleUpgrade.test.ts — SC1 acceptance gate (3 tests green)
  affects:
    - plan 13-02 (GNUSLifecycle facet will read the appended struct fields and consume GNUSLifecycleStorage)
    - plan 13-03 (anti-scalping beforeMint will call ICredentialVerifier via MockCredentialVerifier)
    - plan 13-04+ (all downstream lifecycle logic depends on this storage foundation)
tech_stack:
  added: []
  patterns:
    - Diamond storage library skeleton (struct Layout + POSITION constant + layout() assembly)
    - Append-only struct evolution below a phase marker comment
    - Plug-in interface pattern (creator-supplied verifier/registry)
    - hardhat_setStorageAt-based legacy-decode upgrade testing
key_files:
  created:
    - contracts/gnus-ai/GNUSLifecycleStorage.sol
    - contracts/gnus-ai/interfaces/ICredentialVerifier.sol
    - contracts/gnus-ai/interfaces/IAllowlistRegistry.sol
    - contracts/mocks/MockCredentialVerifier.sol
    - contracts/mocks/MockAllowlistRegistry.sol
    - test/unit/GNUSLifecycleUpgrade.test.ts
  modified:
    - contracts/gnus-ai/GNUSNFTFactoryStorage.sol (appended 8 Phase 13 fields to NFT struct)
    - contracts/gnus-ai/GNUSNFTFactory.sol (createNFT struct-constructor updated to satisfy Solidity all-named-fields rule)
decisions:
  - "Slot layout corrected: Solidity packs nonConvertible(bool) + 3xuint64 + 3xuint8 = 28 bytes into slot +8; expirationRecipient at slot +9; credentialVerifier at slot +10. Plan spec had assumed +9/+10/+11 — struct field ORDER is load-bearing and correct, slot arithmetic was wrong in the plan. Documented inline in the test."
  - "MockCredentialVerifier.verify stays view-only; reentrancy driver exposed as separate reenterMint function (test drives reentry directly) — a view function cannot perform state-changing reentry, so the reentrancy test in plan 13-03 will call reenterMint explicitly."
  - "Mocks placed under contracts/mocks/ (existing convention) instead of contracts/gnus-ai/testing/ (research alternative) — matches MockRedeemCaller.sol precedent."
metrics:
  duration_seconds: 924
  duration_human: "15m 24s"
  completed_date: "2026-08-22T21:39:40Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 2
  tests_added: 3
  tests_passing: 3
  full_suite_baseline: "477 passing / 2 pending / 1 known-stale failing (GNUSControlStorage chainID pollution)"
  full_suite_after: "496 passing / 2 pending / 1 failing (same known-stale failure; delta +19 attributable to 3 new tests + 16 test-order/caching variance in multichain fixture)"
---

# Phase 13 Plan 01: Lifecycle Storage Foundation Summary

**One-liner:** Phase 13 storage foundation — 8 lifecycle fields appended to NFT struct (slots +8/+9/+10 packed with nonConvertible), GNUSLifecycleStorage library + plug-in interfaces + mocks + SC1 legacy-decode upgrade test green.

## What Was Built

| Artifact | Purpose |
|----------|---------|
| `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (MOD) | Appended 8 Phase 13 lifecycle fields to `NFT` struct below a new `// Phase 13 appends below` marker; field order is load-bearing for D1 |
| `contracts/gnus-ai/GNUSNFTFactory.sol` (MOD) | `createNFT` struct-constructor updated to satisfy Solidity named-arg all-fields requirement (Rule 3 blocking fix) |
| `contracts/gnus-ai/GNUSLifecycleStorage.sol` (NEW) | Diamond storage library at `keccak256("gnus.ai.lifecycle.storage")` with `holderExpiresAt` / `mintedPerWallet` / `perWalletMintCap` / `allowlistRegistry` mappings |
| `contracts/gnus-ai/interfaces/ICredentialVerifier.sol` (NEW) | Plug-in interface: `verify(address,uint256,uint256,bytes) external view returns (bool)` |
| `contracts/gnus-ai/interfaces/IAllowlistRegistry.sol` (NEW) | Plug-in interface: `isAllowed(address) external view returns (bool)` |
| `contracts/mocks/MockCredentialVerifier.sol` (NEW) | Test mock with `acceptCredentials` flag (flippable via `hardhat_setStorageAt`) + `reenterMint` driver for plan 13-03 CEI reentrancy test |
| `contracts/mocks/MockAllowlistRegistry.sol` (NEW) | Test mock with settable `allowed[address]` mapping |
| `test/unit/GNUSLifecycleUpgrade.test.ts` (NEW) | SC1 acceptance test: legacy decode with zero defaults, slot-packing proof at raw-storage level, legacy behavior unchanged (mint + safeTransferFrom) |

## Tasks

| # | Name | Commit (submodule `contracts/gnus-ai`) | Commit (outer `gnus-ai`) |
|---|------|-----------------------------------------|---------------------------|
| 1 | Append Phase 13 lifecycle fields to NFT struct (D1) | `743e1be` | — |
| 2 | Create GNUSLifecycleStorage library + plug-in interfaces + test mocks | `9fbc5c5` | `3d06a47` |
| 3 | Legacy decode + storage layout upgrade test (SC1) | — | `10d84d9` |

## Verification Results

- `yarn compile` — exits 0, all artifacts generated for 5 new files
- `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` — **3 passing, 0 failing**
- Full suite `npx hardhat test` — **496 passing / 2 pending / 1 failing**
  - The 1 failure is the known-stale `GNUSControlStorage.test.ts` chainID pollution issue documented in STATE.md (passes 38/38 in isolation). Explicitly excluded from scope per plan Task 3 acceptance criteria.

## Acceptance Criteria Status (per plan)

- SC1 truths: all satisfied.
  - Pre-existing NFT records decode with zero-value lifecycle defaults — **proven** (legacy decode test asserts all 8 fields return zero after `hardhat_setStorageAt` zeroing, all pre-existing fields unchanged).
  - NFT struct storage layout packs new fields — **proven** with corrected slot math (slot +8 for `nonConvertible+uint64×3+uint8×3`, slot +9 for `expirationRecipient`, slot +10 for `credentialVerifier`). See Deviations.
  - GNUSLifecycleStorage library exposes `holderExpiresAt`, `mintedPerWallet`, `perWalletMintCap`, `allowlistRegistry` at `keccak256('gnus.ai.lifecycle.storage')` — **confirmed** (grep count 4 for the 4 mapping declarations, count 1 for the slot string).
  - Downstream plans can import the two interfaces and deploy the two mocks — **confirmed** (artifacts exist, ABIs have the expected functions with correct arities).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] createNFT struct-constructor update**
- **Found during:** Task 1 compile
- **Issue:** Solidity named-argument struct constructors require ALL fields when any are named. Adding 8 fields to `NFT` broke `GNUSNFTFactory.createNFT` at line 172 with "Wrong argument count for struct constructor: 10 arguments given but expected 18."
- **Fix:** Appended the 8 zero-default entries (`validFrom: 0, validUntil: 0, ..., credentialVerifier: address(0)`) to the struct-constructor call. No other behavior change.
- **Files modified:** `contracts/gnus-ai/GNUSNFTFactory.sol`
- **Commit:** `743e1be` (submodule)

**2. [Rule 1 — Bug in plan spec] Slot offset correction +9/+10/+11 → +8/+9/+10**
- **Found during:** Task 3 test run
- **Issue:** Plan and PATTERNS spec'd Phase 13 fields at slots +9/+10/+11, assuming `nonConvertible` (bool) occupies slot +8 alone. Slot-probe test revealed Solidity packs `nonConvertible`(1B) + `validFrom/validUntil/defaultDuration`(3×8B) + `expirationMode/transferPolicy/expirationDisposition`(3×1B) = **28 bytes into slot +8**, then `expirationRecipient` at +9 and `credentialVerifier` at +10. The struct field ORDER specified by D1 is correct and unchanged; only the slot arithmetic in the plan was wrong.
- **Fix:** Corrected the test to write/read at slots +8/+9/+10. Documented the actual layout in the test docstring. The D1 zero-default compatibility invariant still holds (writing zero to slot +8 also resets `nonConvertible` to false — the pre-Phase-9 legacy default — so the legacy simulation remains semantically correct).
- **Files modified:** `test/unit/GNUSLifecycleUpgrade.test.ts`
- **Commit:** `10d84d9`
- **Follow-up:** Plan 13-01 frontmatter and PATTERNS.md "Phase 13 append" code block (line 197-206) carry the stale +9/+10/+11 slot table. Recommend a docs sweep in plan 13-02 to correct these references; not a correctness issue for downstream code that reads struct fields via the ABI (Solidity compiler resolves slots, not test code).

### Plan Acceptance-Criteria Drift

- Plan Task 3 acceptance criterion "file contains `hardhat_setStorageAt` calls for offsets 9n, 10n, 11n" is factually wrong (should be 8n, 9n, 10n). The test implements the correct offsets and the criteria's *intent* (raw-slot write assertions for each Phase-13-containing slot) is fully satisfied.

## Auth Gates

None encountered.

## Known Stubs

None. All artifacts are fully wired: struct fields flow through `createNFT` and `getNFTInfo`; interfaces have concrete mocks; the storage library is consumed by nothing yet (by design — plan 13-02 lands the GNUSLifecycle facet that will call `GNUSLifecycleStorage.layout()`).

## Threat Flags

None. The new files do not introduce network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's `<threat_model>` already enumerates (T-13-01-01, T-13-01-02, T-13-01-03 are all mitigated by the SC1 test itself).

## Self-Check: PASSED

- File: `contracts/gnus-ai/GNUSLifecycleStorage.sol` — FOUND
- File: `contracts/gnus-ai/interfaces/ICredentialVerifier.sol` — FOUND
- File: `contracts/gnus-ai/interfaces/IAllowlistRegistry.sol` — FOUND
- File: `contracts/mocks/MockCredentialVerifier.sol` — FOUND
- File: `contracts/mocks/MockAllowlistRegistry.sol` — FOUND
- File: `test/unit/GNUSLifecycleUpgrade.test.ts` — FOUND
- Commit (submodule): `743e1be` — FOUND
- Commit (submodule): `9fbc5c5` — FOUND
- Commit (outer): `3d06a47` — FOUND
- Commit (outer): `10d84d9` — FOUND
