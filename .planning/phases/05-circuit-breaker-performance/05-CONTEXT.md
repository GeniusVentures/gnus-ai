# Phase 5: Circuit Breaker & Performance — Context

## Phase Goal

Implement a diamond-level emergency pause mechanism and optimize gas-heavy loops in the withdrawal limiter and token transfer paths.

## Locked Decisions

### D1: Pause mechanism — diamond-wide via GNUSControlStorage
**Decision:** Store `bool paused` in `GNUSControlStorage.Layout` (already manages protocol-level state: chainID, bridgeFee, protocolVersion). Add `pause()` and `unpause()` functions to `GNUSControl` facet, guarded by `onlySuperAdminRole`. All state-changing facet functions check `GNUSControlStorage.layout().paused` via a `whenNotPaused` modifier or inline check. Diamond-wide only — no per-facet granularity.

**Rationale:** `LibDiamond.DiamondStorage` lives in an external dependency (`contracts-starter`) and can't be modified. `GNUSControl` is the existing protocol configuration facet — natural home for a pause flag.

### D2: Loop merge — single pass in _beforeTokenTransfer
**Decision:** `GNUSERC1155MaxSupply._beforeTokenTransfer()` currently has two sequential loops: GNUS aggregation + transferor validation. Merge into one pass. No ordering dependencies between the two operations.

### D3: Bin count cap — 256
**Decision:** `setDefaultBinCount()` max cap at 256. Fix type consistency — per-account `binCount` is `uint32` but default is `uint256`. Either upcast per-account to `uint256` or clamp default to `uint32`.

## Success Criteria (from ROADMAP)

1. Diamond-level emergency pause halts all state-changing operations. Admin can pause/unpause via dedicated function. All mutative facet functions check the pause flag.
2. `GNUSERC1155MaxSupply._beforeTokenTransfer()` uses a single loop instead of two.
3. `GNUSWithdrawLimiterStorage.setDefaultBinCount()` has a maximum cap (256). Type consistency between default (`uint256`) and per-account (`uint32`) `binCount` is fixed.

## Out of Scope

- Granular per-function pause controls
- Automatic pause triggers (price feeds, anomaly detection)
- Gas golfing beyond the identified loops
