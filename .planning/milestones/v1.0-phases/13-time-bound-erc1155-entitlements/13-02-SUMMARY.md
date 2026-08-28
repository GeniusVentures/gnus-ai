---
phase: 13-time-bound-erc1155-entitlements
plan: 02
subsystem: gnus-ai-lifecycle-facet
tags: [diamond-facet, erc1155, lifecycle, settlement, sc2, sc5, sc8, d2, d3, d4, d8, d9, d13]
dependency_graph:
  requires:
    - contracts/gnus-ai/GNUSNFTFactoryStorage.sol (Phase 13 struct fields from 13-01)
    - contracts/gnus-ai/GNUSLifecycleStorage.sol (13-01 library)
    - contracts/gnus-ai/GNUSRedeemAdapter.sol (facet shell + no-custody burn/mint pair template)
    - contracts/gnus-ai/GNUSNFTFactory.sol:92 (creator-or-admin auth pattern)
    - @gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyStorage.sol (first-mint gate)
  provides:
    - GNUSLifecycle facet (30 selectors) — views, config, setters, settleExpired, renewal helper
    - Diamond registration at priority 119 / protocolVersion 2.7
    - Smoke test suite (6 tests green)
  affects:
    - plan 13-03 (beforeMint will call _applyPerHolderRenewal BEFORE _mint)
    - plan 13-04 (transfer-policy predicate reads config written by configureLifecycle)
    - plan 13-05 (exhaustive behavior matrices on this facet)
tech_stack:
  added: []
  patterns:
    - Facet shell (supportsInterface diamond-aware override)
    - Creator-or-admin auth helper (_requireCreatorOrAdmin)
    - First-mint immutability gate (ERC1155SupplyStorage._totalSupply[id] == 0)
    - Shared disposition dispatch (_dispatchSettlement) used by settleExpired + renewal
    - No-custody settle pair (Q3 _settleRedeemToParent — direct _burn + _mint)
    - Settle-first renewal with PRE-MINT balance semantics (D3, Pitfall P5)
    - CEI clock-clear before disposition transition (T-13-02-04)
key_files:
  created:
    - contracts/gnus-ai/GNUSLifecycle.sol (submodule gnus-ai)
    - test/unit/GNUSLifecycle.test.ts (outer)
  modified:
    - diamonds/GeniusDiamond/geniusdiamond.config.json (submodule GeniusDiamond)
decisions:
  - "Facet holds no state of its own — reads NFT struct via GNUSNFTFactoryStorage.layout() and per-holder clocks via GNUSLifecycleStorage.layout(); storage discipline matches existing facets"
  - "settleExpired reverts 'Not expired' (locked discretion from 13-RESEARCH §A3); the revert is the documented idempotency shape — after BURN settles, clock is cleared and _isExpired returns false, so a second call reverts cleanly with no state change"
  - "_applyPerHolderRenewal runs BEFORE _mint with PRE-MINT balance semantics (Pitfall P5 resolution) — documented in Doxygen so plan 13-03 wires beforeMint correctly"
  - "Shared _dispatchSettlement internal is the single source of truth for the five-disposition routing (13-RESEARCH 'single biggest risk' insight) — called by settleExpired and by the settle-first branch of _applyPerHolderRenewal"
  - "No deployInit/upgradeInit on GNUSLifecycle diamond-config entry (Phase 10 10-02 precedent: explicit configuration beats magic defaults) — facet holds no state that needs initialization"
  - "DiamondInitFacet extended with a 2.7 entry mirroring 2.6 — REQUIRED because hardhat-diamonds looks up protocolInitFacet.versions[protocolVersion] to find the protocol-wide initializer, and skipping it on fresh 2.7 deploys leaves MINTER_ROLE ungranted"
metrics:
  duration_seconds: 1469
  duration_human: "24m 29s"
  completed_date: "2026-08-22T22:15:19Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
  tests_added: 6
  tests_passing: 6
  full_suite_baseline: "496 passing / 2 pending / 1 known-stale failing (GNUSControlStorage chainID pollution)"
  full_suite_after: "502 passing / 2 pending / 1 failing (same known-stale failure; delta +6 = the new smoke suite)"
---

# Phase 13 Plan 02: GNUSLifecycle Facet Summary

**One-liner:** GNUSLifecycle facet shipped at priority 119 / protocol 2.7 with D13 views, D4 creator-gated setters, Q1/Q2/Q6 config gates, permissionless settleExpired with five-disposition dispatch (D8/D9), and D3 settle-first renewal helper — 6 smoke tests green, 20,210-byte deployedBytecode (4,366 B headroom under EIP-170).

## What Was Built

| Artifact | Purpose |
|----------|---------|
| `contracts/gnus-ai/GNUSLifecycle.sol` (NEW, submodule gnus-ai) | The facet. Three enums (ExpirationMode / TransferPolicy / ExpirationDisposition) with ordinal 0 = backwards-compatible default. LifecycleConfig struct (calldata-only). D13 views (`isTokenActive`, `isSpendable`, `holderExpiresAt` — revert on uncreated id, uri() precedent). Creator-gated setters (`setValidFrom`, `setValidUntil`, `setPerWalletMintCap`, `setAllowlistRegistry`). `configureLifecycle` with Q6 first-mint gate + Q2 PerHolder-requires-non-transferable + Q1 REDEEM_TO_PARENT-requires-convertible + RETURN_TO_ADDRESS recipient check. `settleExpired` permissionless fixed-outcome. `_settleRedeemToParent` Q3 no-custody pair. `_applyPerHolderRenewal` D3 settle-first. Shared `_dispatchSettlement` internal. |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` (MOD, submodule GeniusDiamond) | protocolVersion 2.6 → 2.7; GNUSLifecycle entry at priority 119 with fromVersions [0.0, 2.4, 2.5, 2.6]; DiamondInitFacet extended with a 2.7 entry (deployInit+upgradeInit diamondInitialize250(), fromVersions extended with 2.6) so fresh 2.7 deploys still run the protocol-wide initializer. |
| `test/unit/GNUSLifecycle.test.ts` (NEW, outer) | Smoke suite: 6 tests covering deploy-with-collision-check, view reverts on uncreated id, configureLifecycle happy path + event, Q2 and Q1 revert paths, settleExpired "Not expired" revert. Boot pattern copied from GNUSTreasury.test.ts. |

## Tasks

| # | Name | Commit (submodule `contracts/gnus-ai`) | Commit (submodule `diamonds/GeniusDiamond`) | Commit (outer `gnus-ai`) |
|---|------|------------------------------------------|-----------------------------------------------|---------------------------|
| 1 | GNUSLifecycle facet — enums, config, views, setters, configureLifecycle | `2283370` | — | `a05dcd8` |
| 2 | settleExpired + disposition dispatch + renewal helpers (D3/D8/D9, Q3) | `3858acc` | — | `9e6f9c0` |
| 3 | Diamond config registration (priority 119, protocol 2.7) + smoke test suite | — | `6ce23b3` | `21633ba` + `85d5886` |

## Verification Results

- `yarn compile` — exits 0. `GNUSLifecycle.deployedBytecode = 20,210 bytes` (4,366 B headroom under the 24,576 EIP-170 limit).
- ABI contains all 8 external functions listed in the plan plus `settleExpired`: `isTokenActive`, `isSpendable`, `holderExpiresAt`, `configureLifecycle`, `setValidFrom`, `setValidUntil`, `setPerWalletMintCap`, `setAllowlistRegistry`, `settleExpired`. Events: `LifecycleConfigured`, `ValidFromUpdated`, `ValidUntilUpdated`, `PerWalletCapSet`, `Settled`, `HolderExpiryUpdated`.
- Source assertions (per plan acceptance criteria):
  - `grep -c "enum ExpirationMode\|enum TransferPolicy\|enum ExpirationDisposition"` = **3** ✓
  - `grep -c "_totalSupply[id] == 0"` = **4** (configureLifecycle + setAllowlistRegistry gates, plus their Doxygen references) ✓ (≥2 required)
  - `grep -A2 "PerHolder" | grep -c "SOULBOUND"` = **3** ✓ (≥1 required — Q2 gate present)
  - `grep -c "function settleExpired(address account, uint256 id) external"` = **1** ✓ (exactly 2 params, no recipient — P9)
  - Clock-clear `lc.holderExpiresAt[id][account] = 0;` precedes `_dispatchSettlement` in `settleExpired` body ✓ (CEI)
  - `_settleRedeemToParent` body contains `_burn(account, id, amount);` + `_mint(account, parentId, amount, "");` and does NOT contain `convert(` ✓
  - `event Settled(` has 5 fields, `event HolderExpiryUpdated(` has 4 fields ✓
- `npx hardhat test test/unit/GNUSLifecycle.test.ts` — **6 passing, 0 failing**.
- `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` — **3 passing, 0 failing** (13-01 regression suite still green after the DiamondInitFacet 2.7 entry was added).
- Full suite `npx hardhat test` — **502 passing / 2 pending / 1 failing**. The 1 failure is the documented stale `GNUSControlStorage.test.ts` chainID pollution issue (passes 38/38 in isolation; explicitly excluded from scope). Delta vs. 496 baseline: +6 passing (the new smoke suite).

## Acceptance Criteria Status (per plan)

- Task 1: facet compiles; ABI complete; enum/gate source assertions pass — **all green**.
- Task 2: `settleExpired` signature has exactly 2 parameters; CEI ordering verified; `_settleRedeemToParent` has the Q3 no-custody pair with no `convert(` call; Settled + HolderExpiryUpdated events present; deployed size 20,210 B ≤ 24,576 B — **all green**.
- Task 3: config grep counts = 1/1/1 (`protocolVersion 2.7` / `GNUSLifecycle` / `priority 119`); diamond deploy inside smoke test (a) succeeds = selector-collision-free; 6/6 tests pass; full-suite regression shows no new failures — **all green**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Missing `supportsInterface` diamond-aware override**
- **Found during:** Task 1 compile
- **Issue:** Initial draft inherited from `GNUSERC1155MaxSupply` (which itself inherits from `ERC1155SupplyUpgradeable`) and `GeniusAccessControl` (which inherits from `AccessControlEnumerableUpgradeable`). Solidity rejected with "Derived contract must override function supportsInterface — two or more base classes define function with same name and parameter types." Both base trees implement `supportsInterface(bytes4)` but with different override paths.
- **Fix:** Added the canonical override that matches `GNUSNFTFactory.sol:129-132` and `GNUSRedeemAdapter.sol:38-46` — combines `ERC1155Upgradeable.supportsInterface`, `AccessControlEnumerableUpgradeable.supportsInterface`, and `LibDiamond.diamondStorage().supportedInterfaces`. This is the required pattern for every diamond facet in this codebase; the plan's "Facet declaration pattern" interface comment implies it but didn't call it out as a required import.
- **Files modified:** `contracts/gnus-ai/GNUSLifecycle.sol`
- **Commit:** `2283370` (submodule)

**2. [Rule 1 — Bug] Missing DiamondInitFacet "2.7" entry broke fresh-deploy protocol initializer**
- **Found during:** Task 3 verification — `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` regressed (2 of 3 tests failing) after the protocolVersion bump to 2.7.
- **Issue:** `hardhat-diamonds`'s `getInitCalldata` looks up the protocol-wide initializer via `deployConfig.facets[protocolInitFacet].versions[getVersionKey(versions, protocolVersion)]`. After bumping `protocolVersion` to 2.7 without a matching `DiamondInitFacet.versions["2.7"]` entry, the lookup returned undefined and the deploy skipped `diamondInitialize250()` entirely — leaving the deployer without MINTER_ROLE / DEFAULT_ADMIN_ROLE / UPGRADER_ROLE. The plan's behavior block covered the `protocolVersion` bump and the new GNUSLifecycle entry but did not mention this required DiamondInitFacet companion entry.
- **Fix:** Added `DiamondInitFacet.versions["2.7"]` mirroring the `2.6` entry shape (same `deployInit`/`upgradeInit` = `diamondInitialize250()`, `fromVersions` extended with 2.6). Matches the pattern Phase 11 used for its protocol-bump commits (`75af59b`, `cabf015`).
- **Files modified:** `diamonds/GeniusDiamond/geniusdiamond.config.json`
- **Commit:** `6ce23b3` (submodule)

### Plan Acceptance-Criteria Drift

None. All criteria are implementable as written.

## Auth Gates

None encountered.

## Known Stubs

None. All artifacts are fully wired: the facet reads NFT struct fields (consuming the storage append from 13-01) and writes them via `configureLifecycle`; the per-holder clock mapping is read/written by `holderExpiresAt` / `settleExpired` / `_applyPerHolderRenewal`; the smoke suite exercises the full deploy + configure + settle-revert path against the real LocalDiamondDeployer fixture.

## Threat Flags

None. The new facet introduces no network endpoints and no auth paths beyond what the plan's `<threat_model>` already enumerates:
- **T-13-02-01 (EoP via settleExpired)** — mitigated: no recipient parameter, caller triggers transition only, disposition read from immutable config.
- **T-13-02-02 (Tampering via configureLifecycle)** — mitigated: Q6 first-mint gate + creator-or-admin auth + Q1/Q2 configuration validation.
- **T-13-02-03 (REDEEM_TO_PARENT supply inflation)** — mitigated: Q3 no-custody pair, never calls `convert`, supply-neutral.
- **T-13-02-04 (Expired-balance resurrection)** — mitigated: D3 settle-first ordering inside `_applyPerHolderRenewal`, pre-mint balance semantics documented in Doxygen.
- **T-13-02-05 (Selector collision)** — mitigated: hardhat-diamonds collision check at LocalDiamondDeployer boot; smoke test (a) is the executable assertion.
- **T-13-02-06 (Unbounded loops)** — mitigated: `settleExpired` settles exactly one (account, id); `_applyPerHolderRenewal` does no iteration.

## Self-Check: PASSED

- File: `contracts/gnus-ai/GNUSLifecycle.sol` — FOUND
- File: `test/unit/GNUSLifecycle.test.ts` — FOUND
- File: `diamonds/GeniusDiamond/geniusdiamond.config.json` (MOD) — FOUND (priority 119, protocolVersion 2.7, DiamondInitFacet 2.7 entry)
- Commit (submodule gnus-ai): `2283370` — FOUND
- Commit (submodule gnus-ai): `3858acc` — FOUND
- Commit (submodule GeniusDiamond): `6ce23b3` — FOUND
- Commit (outer): `a05dcd8` — FOUND
- Commit (outer): `9e6f9c0` — FOUND
- Commit (outer): `21633ba` — FOUND
- Commit (outer): `85d5886` — FOUND
