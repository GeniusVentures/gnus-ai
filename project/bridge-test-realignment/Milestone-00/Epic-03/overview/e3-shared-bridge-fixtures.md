# Epic 3 — Shared Bridge Fixtures (M0-E3)

> **Parent milestone:** [Milestone 1 — Green Baseline (M0)](../../overview/milestone-01-green-baseline.md)
> **Maps to:** [project-plan §5 M0-E3](../../../bridge-test-realignment-project-plan.md)
> **Owner:** Engineer · **Impact/blast radius:** Test-only; multiple bridge specs + Foundry base · **Estimated effort:** M (≈1–2 h)
> **Status:** 📋 ready for `/create-prd`

## Objective

Root-cause fix for the drift this whole project is cleaning up. Bridge test constants are
currently redefined per file — which is exactly why `GNUSBridgeEnhanced.test.ts` got the
new 5-arg shape while the gas test (E1) and the Foundry fuzz suite (E4) were left on stale
signatures. This epic establishes **one shared fixture per runner** so a future signature
change is a single-file edit, not a scavenger hunt.

## Acceptance criteria

- [ ] A Hardhat/TS fixture module exports `SGNS_DESTINATION` (`bytes32` X), `SGNS_DESTINATION_Y_ODD` (`bool`), canonical `destChainID`, and `GNUS_TOKEN_ID`.
- [ ] The Foundry test base ([GeniusDiamondTestBase.sol:18](../../../../../test/foundry/base/GeniusDiamondTestBase.sol#L18)) exposes a matching `bytes32` X constant + `bool` Y-parity, **replacing** the 64-byte `bytes TEST_SGNS_DEST`.
- [ ] Values are byte-for-byte identical to those in the currently-passing `GNUSBridgeEnhanced.test.ts` so no passing test changes behavior.
- [ ] `GNUSBridgeEnhanced.test.ts` (and any other bridge spec with inline literals) imports from the shared module.
- [ ] A grep finds no duplicate inline `SGNS_DESTINATION`/`zeroPadValue('0x1234', 32)`/`TEST_SGNS_DEST` literals outside the fixtures.
- [ ] Full Hardhat + Foundry suites pass after refactor (no regressions vs pre-refactor counts).

## Tasks

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | Choose fixture locations (e.g. `test/utils/` for TS; constants on the Foundry base) consistent with repo conventions | Engineer | paths agreed, conventions matched |
| 2 | Create the TS fixture exporting the four constants | Engineer | module compiles, exports resolve |
| 3 | Replace `bytes TEST_SGNS_DEST` in the Foundry base with `bytes32` X + `bool` Y-parity | Engineer | base compiles; consumers updated |
| 4 | Refactor `GNUSBridgeEnhanced.test.ts` to import the TS fixture | Engineer | no inline literals; test green |
| 5 | grep sweep across `test/` for residual literals | Engineer | none outside fixtures |
| 6 | Run both suites to confirm no regression | Engineer | counts ≥ pre-refactor pass counts |

## Dependencies & owner gates

- **Upstream:** none. **This epic should land first within M0** so E1 and E4 import from it.
- **Downstream:** E1 (Hardhat gas) and E4 (Foundry fuzz) consume these fixtures.
- **Owner gates:** none. Agent-executable. (Foundry steps still need `anvil` to *verify*
  via E4, but E3 itself is just compile + refactor.)

## Risks

| Risk | Mitigation |
|---|---|
| A copied value differs subtly and breaks a passing test | Copy verbatim from `GNUSBridgeEnhanced.test.ts`; diff pass counts before/after |
| TS and Foundry fixtures drift from each other | Keep the X value identical across both; document the pairing in the fixture comment |
| Over-refactoring unrelated constants | Scope strictly to the four bridge constants |

## Notes

- Reversible: test-only.
- This is the durable defense against the exact failure class M0 is fixing — prioritize
  clarity of the single source of truth over breadth.
- Cross-reference: design doc [§5 source-of-truth & fixtures](../../../bridge-test-realignment-architecture.md).
