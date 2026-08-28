---
phase: 03-input-validation
plan: 02
subsystem: contracts
tags: [solidity, security, input-validation, bridge, withdraw]

# Dependency graph
requires:
  - "Phase 03-01 — GNUSControl guards (chainID used by same-chain check)"
provides:
  - withdraw() exchangeRate validation (SEC-02)
  - bridgeOut() same-chain guard (SEC-03)
affects: [04-access-control, 05-circuit-breaker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hoisted storage read pattern: extract exchangeRate to local var before validation and division"

key-files:
  modified:
    - contracts/gnus-ai/GNUSBridge.sol

key-decisions:
  - "Hoisted exchangeRate to local variable — eliminates double storage read and makes validation explicit"
  - "Same-chain guard placed after balance check, before _burn — earliest safe rejection point"

patterns-established:
  - "Bridge guard pattern: validate numeric parameters before token operations"

requirements-completed:
  - SEC-02
  - SEC-03

# Metrics
duration: 2min
completed: 2026-05-28
---

# Phase 03 Plan 02: withdraw & bridgeOut Validation

**Added exchangeRate validation to withdraw() and same-chain guard to bridgeOut() (SEC-02, SEC-03)**

Code: `4c1ce30` (submodule) / `eda3733` (parent)

### Changes

- **GNUSBridge.withdraw()** — `require(exchangeRate > 0)` + `require(amount >= exchangeRate)`, hoisted to local var
- **GNUSBridge.bridgeOut()** — `require(destChainID != GNUSControlStorage.layout().chainID)`

### Verification

- Compilation: PASS (2 Solidity files)
- Guard count: 3 guards added in 1 file

### Threat Mitigation

- T-03-04 (division truncation): Resolved — exchangeRate validated before division
- T-03-05 (self-bridging): Resolved — same-chain guard prevents fake bridge events

## Self-Check: PASSED

---

_Phase: 03-input-validation_
_Completed: 2026-05-28_
