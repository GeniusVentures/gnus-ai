# Phase 4: Access Control & Observability — Context

## Phase Goal

Harden admin-only code paths with proper modifiers, add event emissions for super-admin bypass paths, and enable Slither static analysis on all production contracts.

## Locked Decisions

### D1: Initialize protection scope — all `*_Initialize*` functions
**Decision:** All facets' `*_Initialize*` functions must be protected by `onlySuperAdminRole`, not just `diamondInitialize250()`. Audit every production facet for unprotected initializers.

### D2: Bypass event design — shared event
**Decision:** A single shared `SuperAdminBypass` event across all contracts, emitted whenever the super-admin bypasses a limiter/guard. Keeps the interface consistent and consumers only need to listen for one event signature.

### D3: Slither triage — fix all
**Decision:** All Slither findings on `contracts/gnus-ai/` must be fixed — no suppress/document-only resolutions. Remove the exclusion from `slither.config.json` and address every finding.

## Success Criteria (from ROADMAP)

1. `DiamondInitFacet.diamondInitialize250()` is protected by `onlySuperAdminRole` modifier.
2. All three super-admin withdrawal limiter bypass paths (`GNUSBridge.sol:159`, `GNUSERC1155MaxSupply.sol:57`, `ERC20TransferBatch.sol:155`) emit events when bypassed.
3. `slither.config.json` no longer excludes `contracts/gnus-ai/`. `yarn slither:scan` runs successfully and any findings are triaged.

## Scope

- Audit all `_Initialize*` functions across production facets for missing access control
- Add `onlySuperAdminRole` to any unprotected initializers
- Design and implement a shared `SuperAdminBypass` event
- Emit the event at the three identified bypass paths (plus any others found during audit)
- Remove `contracts/gnus-ai/` from Slither exclusions
- Fix all Slither findings

## Out of Scope

- New access control roles or role hierarchy changes
- Runtime monitoring/alerting on bypass events (separate observability phase)
- Slither on non-production/third-party contracts
