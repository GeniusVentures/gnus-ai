# Epic 1 — Fix Gas-Test bridgeOut (M0-E1)

> **Parent milestone:** [Milestone 1 — Green Baseline (M0)](../../overview/milestone-01-green-baseline.md)
> **Maps to:** [project-plan §5 M0-E1](../../../bridge-test-realignment-project-plan.md)
> **Owner:** Engineer · **Impact/blast radius:** Test-only; 5 failing Hardhat gas cases · **Estimated effort:** S (≈30–60 min)
> **Status:** 📋 ready for `/create-prd`

## Objective

Restore the 5 failing gas-comparison cases by updating the stale 3-arg `bridgeOut` call to
the current 5-arg signature. The gas test exists to track per-operation gas across bin
counts (6/12/24/48/96); it can't run while ethers fails to resolve the `bridgeOut`
fragment. This epic only repairs the call site — it does not deepen assertions (that is
M1).

## Acceptance criteria

- [ ] [withdraw-limiter-gas-comparison.test.ts:205](../../../../../test/gas/withdraw-limiter-gas-comparison.test.ts#L205) calls `bridgeOut(amount, GNUS_TOKEN_ID, destChainID, sgnsDestination, destinationYOdd)`.
- [ ] Destination args come from the shared fixture (M0-E3), not new inline literals.
- [ ] All bin-count variants (6, 12, 24, 48, 96) pass and record a gas value.
- [ ] No change to gas-recording logic or thresholds beyond the call signature.
- [ ] `npx hardhat test` shows these 5 cases passing; total Hardhat failures drop by 5.

## Tasks

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | Import `SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, `GNUS_TOKEN_ID`, canonical `destChainID` from the shared fixture (E3) | Engineer | imports resolve; no inline duplicates |
| 2 | Update the `bridgeOut(...)` call at line ~205 to the 5-arg form | Engineer | call matches contract ABI |
| 3 | Run the gas suite for all bin counts | Engineer | 5 cases green, gas recorded |
| 4 | Grep the file for any other stale 3-arg `bridgeOut` references | Engineer | none remain |

## Dependencies & owner gates

- **Upstream:** M0-E3 (shared-bridge-fixtures) should land first so step 1 imports rather
  than re-declares constants. If E3 is not yet ready, use the same literal values as
  `GNUSBridgeEnhanced.test.ts` temporarily and refactor when E3 lands.
- **Owner gates:** none. Fully agent-executable.

## Risks

| Risk | Mitigation |
|---|---|
| Inline literals re-introduced, re-creating drift | Pull from E3 fixture; grep for stray literals |
| Gas value shifts vs prior baseline confuse readers | This is a signature fix; note that the 5-arg call's gas is the new baseline |

## Notes

- Reference implementation for the exact call shape already exists at
  [GNUSBridgeEnhanced.test.ts:413](../../../../../test/unit/GNUSBridgeEnhanced.test.ts#L413).
- Reversible: test-only, single file. Contract code stays untouched.
