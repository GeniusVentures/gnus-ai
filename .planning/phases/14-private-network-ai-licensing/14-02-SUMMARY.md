---
phase: 14-private-network-ai-licensing
plan: "02"
subsystem: licensing-registry
tags: [licensing, sku-registry, diamond-storage, facet-split]
requires: []
provides:
  - "SKU struct + NetworkScope enum + LicenseActivated event (GNUSLicensingTypes.sol)"
  - "GNUSLicensingStorage diamond layout {skus, licenseSku}"
  - "configureSKU / setSKUActive / getSKU registry facet (CREATOR_ROLE/ADMIN-gated)"
affects:
  - "diamonds/GeniusDiamond/geniusdiamond.config.json (GNUSLicensing @ priority 122, versions[\"2.6\"])"
tech-stack:
  added: []
  patterns:
    - "GNUSLifecycle facet-split precedent (config facet vs action facet)"
    - "Diamond storage library at keccak slot (gnus.ai.licensing.storage)"
key-files:
  created:
    - contracts/gnus-ai/GNUSLicensingTypes.sol
    - contracts/gnus-ai/GNUSLicensingStorage.sol
    - contracts/gnus-ai/GNUSLicensing.sol
  modified:
    - diamonds/GeniusDiamond/geniusdiamond.config.json
decisions:
  - "LicenseActivated declared in IGNUSLicensingEvents interface (0.8.19 lacks file-level events); facets inherit to emit"
  - "SKU admin gate is role-based (CREATOR_ROLE || DEFAULT_ADMIN_ROLE), not per-NFT creator"
metrics:
  duration: "~1h"
  completed: 2026-08-25
---

# Phase 14 Plan 02: Licensing Types, Storage & SKU Registry Summary

SKU registry facet (LIC-03) with the seven-field D-04 SKU struct, diamond storage at `gnus.ai.licensing.storage`, CREATOR_ROLE/ADMIN-gated CRUD, and the D-14 `LicenseActivated` event surface — registered in the diamond config at `versions["2.6"]` priority 122.

## What Was Done

### Task 1: Types + storage library + registry facet
- `contracts/gnus-ai/GNUSLicensingTypes.sol` — `NetworkScope` enum (PublicOnly=0 zero-default documented), `SKU` struct (priceInMinions, creditAmount, duration, createsLicense, renewsLicense, active — no USD field), `LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)` with fixed D-14 field order.
- `contracts/gnus-ai/GNUSLicensingStorage.sol` — `Layout { skus, licenseSku }`, `GNUS_LICENSING_STORAGE_POSITION = keccak256("gnus.ai.licensing.storage")`, assembly `layout()` accessor.
- `contracts/gnus-ai/GNUSLicensing.sol` — facet-split Doxygen header, local `_CREATOR_ROLE`, `configureSKU` (validates price>0, duration>0, !(createsLicense && renewsLicense) via named string constants), `setSKUActive`, `getSKU`, events `SKUConfigured`/`SKUActiveToggled` with indexed operator, diamond-aware `supportsInterface` triple-OR override.
- Compile clean; GNUSLicensing bytecode **16,549 bytes** (EIP-170 limit 24,576 — OK).

### Task 2: Diamond config registration (D-15)
- `diamonds/GeniusDiamond/geniusdiamond.config.json`: `"GNUSLicensing"` at priority 122, `versions["2.6"]` with fromVersions [0.0, 2.4, 2.5]. No `2.7` string anywhere.
- `npx hardhat diamond:generate-abi-typechain --diamond-name GeniusDiamond` ran clean; `GNUSLicensing` present in `diamond-abi/GeniusDiamond.json`.

## Verification Evidence

- `npx hardhat compile` → "Compiled 5 Solidity files successfully"
- Acceptance greps: `enum NetworkScope` present; `priceUsd` count 0; `gnus.ai.licensing.storage` present; `Only creator or admin` present; config grep → `CONFIG-OK`
- Bytecode size asserted via artifact (16,549 ≤ 24,576)
- Test deferral: behavioral tests deferred to 14-03 Task 2 `GNUSLicensing.test.ts` per plan design (compile-only verify here)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] LicenseActivated moved into `IGNUSLicensingEvents` interface**
- **Found during:** Task 1 compile
- **Issue:** Plan specified a file-level `event` in GNUSLicensingTypes.sol; file-level events require Solidity ≥0.8.22 and D-18 pins ^0.8.19.
- **Fix:** Event declared inside `interface IGNUSLicensingEvents` in the types file; `GNUSLicensing` inherits it. ABI signature identical.
- **Files:** GNUSLicensingTypes.sol, GNUSLicensing.sol

**2. [Rule 3 - Blocking] GNUSLicensingStorage imports GNUSLicensingTypes**
- **Issue:** Plan said "no imports" (mirroring GNUSLifecycleStorage), but Layout references the file-level `SKU` type — unresolvable without an import.
- **Fix:** Single `import "./GNUSLicensingTypes.sol";` (analog needed none only because it referenced no file-level types).

**3. [Process] Commits made inside nested submodules**
- gsd-sdk commit cannot stage paths inside `contracts/gnus-ai` (nested submodule). Committed directly in `contracts/gnus-ai` (3b0b2e2) and `diamonds/GeniusDiamond` (376f5ae), then bumped pointers in the parent — matching the repo's established bump pattern.

## Commits

| Task | Repo | Commit |
|------|------|--------|
| 1 | contracts/gnus-ai | 3b0b2e2 |
| 1 (pointer) | parent | 4287a5f |
| 2 | diamonds/GeniusDiamond | 376f5ae |
| 2 (pointer) | parent | 07cd704 |

## Self-Check: PASSED

All 5 files exist; all 4 commits verified present.

## Known Stubs

None — registry facet is fully functional; purchase rail is 14-03 scope by design.
