# Epic 4 — Fix Foundry Fuzz bridgeOut (M0-E4)

> **Parent milestone:** [Milestone 1 — Green Baseline (M0)](../../overview/milestone-01-green-baseline.md)
> **Maps to:** [project-plan §5 M0-E4](../../../bridge-test-realignment-project-plan.md)
> **Owner:** Engineer (Owner provides `anvil` gate) · **Impact/blast radius:** Test-only; Foundry fuzz suite + base · **Estimated effort:** M (≈1–2 h)
> **Status:** 📋 ready for `/create-prd`

## Objective

Migrate the Foundry bridge fuzz suite from the obsolete `bridgeOut(...,bytes)` selector to
the current `bridgeOut(uint256,uint256,uint256,bytes32,bool)`. Today every call in
[BridgeFuzz.t.sol](../../../../../test/foundry/fuzz/BridgeFuzz.t.sol) encodes selector
`0xf7587f7d`, which no longer exists on the diamond, so `diamond.call(...)` always reverts.
This both **fails** the edge-case test and produces **false-greens** in the negative tests
(they pass only because the selector is missing — not because the contract logic rejected
the input). This epic makes the suite test the real bridge.

## Acceptance criteria

- [ ] All `bridgeOut` calls in `BridgeFuzz.t.sol` use `bridgeOut(uint256,uint256,uint256,bytes32,bool)` via the E3 Foundry fixture.
- [ ] `testFuzz_bridgeAmountEdgeCases` passes against a **real** bridge call (not a missing selector).
- [ ] `testFuzz_RevertWhen_depositExceedsBalance` asserts the **specific** insufficient-balance revert, not bare `success == false`.
- [ ] `testFuzz_bridgeDeposit` gains a meaningful assertion (no more silent no-op pass).
- [ ] The obsolete `test_RevertWhen_InvalidDestinationKeyLength` is **removed** (a `bytes32` is fixed-length; "wrong length" is unreachable).
- [ ] `yarn clean-compile && yarn forge:test` (against a running **`anvil`**) reports 0 failing; the previously-failing fuzz test is green for the right reason.

## Tasks

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | Adopt the E3 Foundry `bytes32` X + `bool` Y-parity constants in place of `TEST_SGNS_DEST` | Engineer | base + suite compile |
| 2 | Migrate every `encodeWithSignature("bridgeOut(...)")` to the 5-param selector | Engineer | calls hit a real facet |
| 3 | Rewrite `testFuzz_RevertWhen_depositExceedsBalance` to assert the specific revert reason | Engineer | passes for the right reason |
| 4 | Add a real assertion to `testFuzz_bridgeDeposit` (e.g. balance burned / event emitted) | Engineer | no silent-pass path |
| 5 | Delete `test_RevertWhen_InvalidDestinationKeyLength` | Engineer | gone; no dead bytes-length logic |
| 6 | Run `yarn clean-compile && yarn forge:test` against `anvil` | Engineer | 0 failing |

## Dependencies & owner gates

- **Upstream:** M0-E3 (Foundry fixture migration) — step 1 depends on it.
- **Owner gate (OP-1, blocking):** a running **`anvil`** instance must be available for the
  Engineer to verify `yarn forge:test`. Without it the suite cannot execute against the
  diamond. Owner confirms availability (local and CI).
- **Downstream:** M1-E1/E3 deepen these Foundry assertions further (full event matching,
  guard-reason coverage); M3 is the final gate.

## Risks

| Risk | Mitigation |
|---|---|
| Negative tests re-pass for the wrong reason after migration | Assert the *specific* revert string/selector, not `success == false` |
| `anvil` not running → suite skipped/misreported as pass | OP-1 gate; document the prerequisite; wire into CI (M3) |
| `_boundUint256` / balance setup interacts badly with the real burn path | Verify against actual balances; mint as needed before bridging |
| Removing the length test loses a real coverage intent | Confirm intent is obsolete — `bytes32` cannot vary in length; superseded by destination-key edge cases in M1-E2 |

## Notes

- Reversible: test-only (`BridgeFuzz.t.sol` + Foundry base constants).
- Three `bridgeOut` forms exist across the tree (see design doc
  [§5 signature evolution](../../../bridge-test-realignment-architecture.md)); this epic
  retires the interim `bytes` form from Foundry, matching what M0-E1 does for the original
  3-arg form in Hardhat.
