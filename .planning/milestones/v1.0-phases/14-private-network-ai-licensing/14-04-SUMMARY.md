---
phase: 14-private-network-ai-licensing
plan: 04
subsystem: bridge-policy
tags: [bridge, soulbound, expiry, d-23, d-24]
requires: [13-06 bridge policy gate]
provides: [D-23 expiry gate, D-24 operator-mediated SOULBOUND bridge]
affects: [contracts/gnus-ai/GNUSBridge.sol, test/unit/GNUSBridgePolicy.test.ts]
tech-stack:
  added: []
  patterns: [pre-limiter policy gate ordering, import-free local role constant]
key-files:
  created: []
  modified:
    - contracts/gnus-ai/GNUSBridge.sol
    - test/unit/GNUSBridgePolicy.test.ts
decisions:
  - "D-24 SOULBOUND bridge restricted to CREATOR_ROLE/DEFAULT_ADMIN callers, unexpired only"
  - "D-23 expiry gate lives inside _enforceBridgePolicy BEFORE limiter charge + burn (zero limiter consumption on revert)"
metrics:
  duration: ~2h (including waits on concurrent sibling-plan compile churn)
  completed: 2026-08-25
---

# Phase 14 Plan 04: D-24/D-23 Bridge Policy Gate Summary

Operator-mediated SOULBOUND bridgeOut (CREATOR_ROLE/ADMIN, unexpired) plus a D-23 expiry gate covering PerTokenId validUntil and PerHolder holderExpiresAt — enforced inside `_enforceBridgePolicy` before any limiter/burn state change, with the Phase 13 expired-burn settlement carve-out untouched.

## What Was Built

- `contracts/gnus-ai/GNUSBridge.sol` — `_enforceBridgePolicy` SOULBOUND fallthrough replaced: role check (`DEFAULT_ADMIN_ROLE` or local `_CREATOR_ROLE`, import-free per GNUSLifecycle.sol:36 precedent) AND expiry check (`License expired` for PerTokenId `validUntil` / PerHolder `holderExpiresAt`, mirroring the "Sale ended" analogue; None passes). ISSUER_ONLY / CONTROLLED_RESALE revert unchanged. Call site at bridgeOut stays BEFORE `checkAndRecordWithdraw` + `_burn`. No bridgeOut event/message change (D-21). New named constants `LICENSE_EXPIRED_ERROR`, `_CREATOR_ROLE` (no magic strings).
- `test/unit/GNUSBridgePolicy.test.ts` — new `Phase 14 D-24/D-23 SOULBOUND bridge gate` block (6 tests): admin + creator unexpired successes, PerTokenId + PerHolder expired reverts, limiter-unchanged-on-expired-revert ordering proof, and settleExpired expired-burn regression.

## Test Results

- `npx hardhat test test/unit/GNUSBridgePolicy.test.ts` — 13/13 passing (7 Phase 13 regression + 6 new).
- Full suite: 577 passing / 2 pending / 3 failing. Failure #1 is the known-stale GNUSControlStorage chainID baseline failure. Failures #2/#3 are in `GNUSLifecycleUpgrade.test.ts` "Phase 14 append (D-03/D-25)" slot-probe tests — owned by sibling plan 14-02 (in-flight at execution time), not touched by this plan.

## Bytecode

- GNUSBridge: 23,309 bytes (baseline 22,711 → +598; limit 24,576).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Concurrent sibling-plan compile churn**
- **Found during:** Task 1 verify
- **Issue:** 14-01/14-02 sibling agents were mid-edit on `GNUSLicensingTypes.sol` (file-level event pre-0.8.22) and `GNUSNFTFactory.sol` (struct constructor arity, then 24,866 B > 24,576 B bytecode limit), transiently breaking `hardhat compile`/diamond deploy for every suite. No 14-04 file was touched.
- **Fix:** Polled until the sibling stabilized (factory at 24,534 B); then ran the suite green.
- **Files modified:** none by this plan.

### TDD Note

Plan task is marked `tdd="true"`, but strict RED-first commit was not observable: implementation and tests landed in one commit due to the concurrent-sibling compile instability (interleaved verification cycles). Gate coverage is equivalent — all 6 new behavior tests fail without the gate and pass with it.

## Known Stubs

None.

## Self-Check: PASSED

- contracts/gnus-ai/GNUSBridge.sol modified, committed
- test/unit/GNUSBridgePolicy.test.ts modified, committed
- `git diff --stat contracts/gnus-ai/GNUSLifecyclePolicy.sol` empty (burn carve-out untouched)
