---
phase: 03-input-validation
plan: 01
subsystem: contracts
tags: [solidity, security, input-validation, payable, batch]

# Dependency graph
requires:
  - "Phase 02-01 — DiamondInitFacet refactored (GeniusAccessControl provides onlySuperAdminRole used by GNUSControl guards)"
provides:
  - mintBatch() ETH rejection guard (SEC-01)
  - batch transferor array length validation (SEC-04)
affects: [05-circuit-breaker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "payable guard pattern: keep payable modifier for delegatecall compatibility, add require(msg.value == 0)"

key-files:
  modified:
    - contracts/gnus-ai/ERC20TransferBatch.sol
    - contracts/gnus-ai/GNUSControl.sol

key-decisions:
  - "Kept payable modifier on mintBatch — diamond delegatecall compatibility requires it"
  - "Used require(msg.value == 0) pattern rather than removing payable (success criteria allows either)"
  - "Array length check uses consistent error message 'Array length mismatch' in both functions"

patterns-established:
  - "Batch function guard pattern: require(array1.length == array2.length) before iteration"

requirements-completed:
  - SEC-01
  - SEC-04

# Metrics
duration: 2min
completed: 2026-05-28
---

# Phase 03 Plan 01: mintBatch & Batch Transferor Validation

**Added ETH rejection guard to mintBatch() and array length validation to batch transferor functions (SEC-01, SEC-04)**

Code: `52ad47d` (submodule) / `7b1596d` (parent)

### Changes

- **ERC20TransferBatch.sol** — `require(msg.value == 0, "ETH not accepted")` in `mintBatch()`
- **GNUSControl.sol** — `require(tokenIds.length == bannedAddresses.length)` in both `banTransferorBatch()` and `allowTransferorBatch()`

### Verification

- Compilation: PASS (2 Solidity files)
- Guard count: 3 guards added across 2 files

### Threat Mitigation

- T-03-01 (ETH locking): Resolved — mintBatch rejects ETH
- T-03-02/03 (misaligned arrays): Resolved — batch functions validate parity

## Self-Check: PASSED

---

_Phase: 03-input-validation_
_Completed: 2026-05-28_
