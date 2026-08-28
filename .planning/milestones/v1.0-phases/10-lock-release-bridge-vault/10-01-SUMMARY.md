---
phase: 10-lock-release-bridge-vault
plan: 01
subsystem: bridge
tags: [bridge, storage, diamond, validator, replay-protection]
dependency_graph:
  requires: []
  provides:
    - contracts/gnus-ai/GNUSBridgeValidatorStorage.sol
    - keccak256("gnus.ai.bridge.validator.storage") storage slot
  affects:
    - Plan 10-02 (bridgeIn consumes this layout)
    - Plan 10-03 (unit tests assert against this layout)
    - Plan 10-04 (invariant tests assert against this layout)
tech_stack:
  added: []
  patterns:
    - "Diamond storage library (struct-first, position constant, layout() accessor)"
key_files:
  created:
    - contracts/gnus-ai/GNUSBridgeValidatorStorage.sol
  modified: []
decisions:
  - "Pure storage library with no imports — mirrors GNUSTreasuryStorage.sol exactly (no LibDiamond dependency needed for a data-only layout)"
  - "Slot string is 'gnus.ai.bridge.validator.storage' (with .validator infix), NOT 'gnus.ai.bridge.storage' — Pitfall 6 in 10-RESEARCH.md reserves the shorter name for a future facet"
  - "No Initialize function — Phase 10 uses explicit configuration via setValidatorSet (10-RESEARCH.md Pitfall 7: explicit configuration beats magic defaults)"
metrics:
  duration_seconds: 90
  completed_date: "2026-08-17"
---

# Phase 10 Plan 01: GNUSBridgeValidatorStorage Diamond Storage Library Summary

**One-liner:** Diamond storage library at slot `keccak256("gnus.ai.bridge.validator.storage")` exposing `processedMessages` (replay), `validatorMerkleRoot` (validator set commitment), and `validatorThreshold` (m-of-n floor) — pure data layout, no behavior, mirrors `GNUSTreasuryStorage.sol` shape.

## What Was Built

Created `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` (33 lines), the foundation for all subsequent Phase 10 work. The library declares:

- `Layout` struct with three fields in fixed order (append-only contract for Phase 12 compatibility):
  1. `mapping(bytes32 => bool) processedMessages` — replay protection per CONTEXT D-07; set exactly once per `transferId` on successful `bridgeIn`
  2. `bytes32 validatorMerkleRoot` — merkle root of the authorized SG validator set per CONTEXT D-15; each leaf is `keccak256(abi.encodePacked(validatorAddress))`
  3. `uint256 validatorThreshold` — m in "m-of-n" per CONTEXT D-12; minimum number of distinct validator signatures required
- `GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION` constant bound to `keccak256("gnus.ai.bridge.validator.storage")`
- `layout()` internal pure accessor using the standard assembly pattern

The file compiles cleanly under `npx hardhat compile` with Solidity `^0.8.19` (DEBT-03 standard). No imports, no events, no errors, no functions other than `layout()` — a pure storage layout library in the exact shape of `GNUSTreasuryStorage.sol`.

## Commits

- `4a7efaf` — `feat(10-01): add GNUSBridgeValidatorStorage diamond storage library` (submodule `contracts/gnus-ai`)
- `f16369d` — `chore(10-01): bump contracts/gnus-ai submodule — add GNUSBridgeValidatorStorage library` (main tree)

## Verification Results

All acceptance criteria pass:

| Check | Result |
| --- | --- |
| File exists at exact path | PASS |
| Compiles under `npx hardhat compile` (no errors/warnings attributable) | PASS (`Compiled 1 Solidity file successfully (evm target: paris)`) |
| Contains `keccak256("gnus.ai.bridge.validator.storage")` | PASS |
| `GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION` appears ≥2 times | PASS (2 occurrences: declaration + layout() use) |
| All three Layout field identifiers present | PASS (`processedMessages`, `validatorMerkleRoot`, `validatorThreshold`) |
| `library GNUSBridgeValidatorStorage` (not `contract`) | PASS |
| `pragma solidity ^0.8.19;` | PASS |
| `function layout() internal pure returns (Layout storage l)` | PASS |
| No `import` statement | PASS |
| No `event`/`error` declarations | PASS |
| No `"gnus.ai.bridge.storage"` substring (would-be collision per Pitfall 6) | PASS |
| Line count ≥ 25 | PASS (33 lines) |

## Deviations from Plan

None — plan executed exactly as written. The storage library mirrors `GNUSTreasuryStorage.sol` byte-for-byte in shape (header → struct → constant → accessor) and matches the PATTERNS.md spec verbatim.

## Threat Flags

None. This plan introduces a storage layout only; no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's threat_model already covers (T-10-01-S slot collision mitigated by the `.validator` infix; T-10-02-S field-order corruption mitigated by the append-only comment).

## Self-Check: PASSED

- File `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` exists on disk (33 lines).
- Submodule commit `4a7efaf` exists: `git -C contracts/gnus-ai log --oneline -1` → `4a7efaf feat(10-01): add GNUSBridgeValidatorStorage diamond storage library`.
- Main-tree commit `f16369d` exists: `git log --oneline -1` → `f16369d chore(10-01): bump contracts/gnus-ai submodule — add GNUSBridgeValidatorStorage library`.
- Compilation verified clean post-commit.

## Next Steps

Plan 10-02 (`bridgeIn` + `setValidatorSet` + `BridgeReleased`/`ValidatorSetUpdated` events + diamond config 3.0 entry) can now proceed. It imports this library and consumes the `Layout` fields.
