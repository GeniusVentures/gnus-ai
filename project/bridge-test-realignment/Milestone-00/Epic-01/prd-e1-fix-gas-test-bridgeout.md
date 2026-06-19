# PRD — Fix Gas-Test bridgeOut (M0-E1)

> **Epic:** [e1-fix-gas-test-bridgeout](./overview/e1-fix-gas-test-bridgeout.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md) ·
> **Plan:** [project-plan §5 M0-E1](../../bridge-test-realignment-project-plan.md)
> **Status:** 📋 ready for `/generate-tasks` · **Author:** Am0rfu5 · **Date:** 2026-06-19

## 1. Introduction / Overview

The gas-comparison test that measures `bridgeOut` gas across bin counts (6/12/24/48/96)
still calls `bridgeOut` with the **old 3 arguments** `(amount, id, destChainID)`. The
contract's `bridgeOut` now takes **5 arguments** — it added `bytes32 sgnsDestination` and
`bool destinationYOdd`. Because ethers v6 can't find a matching function fragment for the
3-arg call, all 5 bin-count cases throw before any gas is measured.

This feature updates that single call site to the current 5-argument signature so the gas
measurement runs again. It is a **test-only** change; it does not alter contract code and
does not add new assertions (deeper bridge assertions are milestone M1).

## 2. Goals

- **G1** — The gas test calls `bridgeOut` with the current 5-argument signature.
- **G2** — All five bin-count cases run and record a gas value.
- **G3** — The 5 corresponding Hardhat failures are eliminated.
- **G4** — Destination arguments come from the shared fixture (M0-E3), not new inline literals.

## 3. User Stories

- **As a developer tracking gas,** I want the `bridgeOut` gas case to run, so I can compare
  its cost across bin counts again instead of seeing a fragment error.
- **As a maintainer,** I want this call site to use the shared bridge fixture, so the next
  signature change doesn't silently break it again.

## 4. Functional Requirements

1. The system must update the `bridgeOut(...)` call at
   [withdraw-limiter-gas-comparison.test.ts:205](../../../../../test/gas/withdraw-limiter-gas-comparison.test.ts#L205)
   to pass five arguments: `(amount, GNUS_TOKEN_ID, DEST_CHAIN_ID, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD)`.
2. The destination arguments (`SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`) and
   `DEST_CHAIN_ID` must be imported from `test/utils/bridge-fixtures.ts` (M0-E3), not
   redefined inline.
3. The system must not change the gas-recording logic, thresholds, or the `recordGas(...)`
   call beyond what the new signature requires.
4. All five bin-count variants (6, 12, 24, 48, 96) must pass and record a gas value.
5. The file must contain no remaining 3-argument `bridgeOut` calls.

## 5. Non-Goals (Out of Scope)

- Adding event assertions or guard/revert coverage for `bridgeOut` (milestone M1).
- Creating the shared fixture itself (that is M0-E3; this epic only consumes it).
- Changing gas thresholds or the comparison report format.
- Any production contract change.

## 6. Technical Considerations

- **Dependency:** M0-E3 must provide `test/utils/bridge-fixtures.ts`. If E1 is implemented
  before E3 lands, temporarily use the same literal values as `GNUSBridgeEnhanced.test.ts`
  and refactor to the import when E3 is ready.
- **Reference shape:** the correct 5-arg call already exists at
  [GNUSBridgeEnhanced.test.ts:413](../../../../../test/unit/GNUSBridgeEnhanced.test.ts#L413).
- **Same-chain guard:** `DEST_CHAIN_ID = 137` is safe — `bridgeOut` reverts only when the
  destination equals the local chain id.

## 7. Success Metrics

- `npx hardhat test` shows the 5 `GNUSBridge.bridgeOut()` gas cases passing; total Hardhat
  failures drop by exactly 5.
- No inline bridge literals remain in the gas test file.

## 8. Open Questions

- None. (If E3 is not yet merged when this is implemented, see the Technical Considerations
  fallback.)
