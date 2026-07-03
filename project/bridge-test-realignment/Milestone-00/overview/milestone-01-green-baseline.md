# Milestone 1 — Green Baseline (M0)

> **Maps to:** [`bridge-test-realignment-project-plan.md` → §5 M0](../../bridge-test-realignment-project-plan.md) · design: [`bridge-test-realignment-architecture.md` §1, §5](../../bridge-test-realignment-architecture.md)
> **Status:** 📋 planned — ready for `/breakout-epics`
> **Prod/impact:** None at runtime (test-only). High developer impact — unblocks a trustworthy CI signal.
> **Author:** Am0rfu5 · **Date:** 2026-06-19
>
> **Epic breakouts** (resolve after `/breakout-epics`):
> [E1 fix-gas-test-bridgeout](../Epic-01/overview/e1-fix-gas-test-bridgeout.md) ·
> [E2 retire-openescrow-test](../Epic-02/overview/e2-retire-openescrow-test.md) ·
> [E3 shared-bridge-fixtures](../Epic-03/overview/e3-shared-bridge-fixtures.md) ·
> [E4 fix-foundry-fuzz-bridgeout](../Epic-04/overview/e4-fix-foundry-fuzz-bridgeout.md)

---

## 1. Why this milestone exists

The contracts on `feature/bridge-out-initiated` are refactored and correct, but **both**
test runners are red against them:

- **Hardhat:** 6 failures — 5 from the gas test calling the old 3-arg `bridgeOut`, 1 from
  a removed `OpenEscrow` reference (already commented out in the working tree).
- **Foundry:** 1 failure + hidden false-greens — `BridgeFuzz.t.sol` targets the _interim_
  `bridgeOut(...,bytes)` selector that no longer exists on the diamond, so calls silently
  revert.

A red suite means no trustworthy regression signal for any later work. M0 is the **root of
the critical path**: every other milestone (conformance, removal coverage, the zero-debt
gate) builds on a green, fixture-centralized baseline. The milestone also fixes the _cause_
of the drift — per-file constant duplication — not just the symptoms, so the same failure
class can't silently recur.

## 2. Goal & exit criteria

**Goal:** Eliminate the 6 Hardhat failures and the 1 Foundry fuzz failure, repair the
Foundry false-greens, and centralize bridge test constants so a future signature change is
a one-file edit per runner — leaving both runners green.

**Exit criteria:**

- [ ] `npx hardhat test` reports **0 failing** (was 6).
- [ ] `yarn clean-compile && yarn forge:test` (against a running **`anvil`**) reports **0 failing** (was 1).
- [ ] The gas test ([withdraw-limiter-gas-comparison.test.ts:205](../../../../test/gas/withdraw-limiter-gas-comparison.test.ts#L205)) calls the 5-arg `bridgeOut(amount, id, destChainID, sgnsDestination, destinationYOdd)`.
- [ ] The commented-out `OpenEscrow` ownership test is **resolved** (rewritten escrow-free or deleted with a written reason) — no commented test left behind.
- [ ] `BridgeFuzz.t.sol` uses the `bridgeOut(uint256,uint256,uint256,bytes32,bool)` selector; `testFuzz_bridgeAmountEdgeCases` passes for the right reason.
- [ ] The two Foundry **false-green** negative tests assert the _intended_ revert reason, not bare `success == false`.
- [ ] The obsolete `test_RevertWhen_InvalidDestinationKeyLength` is removed (a `bytes32` cannot be the wrong length).
- [ ] Bridge constants (`SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, canonical `destChainID`, `GNUS_TOKEN_ID`) come from **one shared module per runner**; duplicate per-file definitions removed.
- [ ] Suite-health counts recorded at milestone close (Hardhat + Foundry).

## 3. Scope

**In scope**

- Updating Hardhat gas-test `bridgeOut` call sites to the 5-arg form.
- Resolving the commented-out `OpenEscrow` ownership test.
- Migrating `BridgeFuzz.t.sol` + the Foundry test base to the `bytes32,bool` destination.
- Repairing Foundry false-green negative tests and removing the obsolete length test.
- Extracting shared bridge-fixture modules (one for Hardhat TS, one for the Foundry base).

**Out of scope (deferred)**

- Deepened conformance assertions (full 7-field `BridgeOutInitiated` matching, destination-key
  edge cases, guard-reason coverage) → **M1**.
- `OpenEscrow`-selector-absent negative test and DiamondInitFacet facet-set coverage → **M2**.
- Resolving the 2 pending/skipped tests (rpc-deployment, test-template) → **M3**.
- Any contract change. If a failure traces to a contract defect, **stop and escalate** (see Roles).

## 4. Roles on this milestone

| Role                            | Responsibility                                                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engineer** (agent-executable) | All test-file and fixture edits in E1–E4; run both suites locally; record counts.                                                                                                                                                                     |
| **Owner (Am0rfu5)**             | **Blocking:** confirm a local **`anvil`** instance is available for `yarn forge:test`; decide keep-vs-delete if any test cannot be made meaningful escrow-free; approve any escalation. No submodule-pointer or merge action is required _within_ M0. |

Contract-bug escalation is a **blocking owner gate**: if a test only goes green by weakening
an assertion against intended contract behavior, the Engineer stops and the Owner rules on it.

## 5. Epics

| Epic  | Title                      | Owner    | Impact | Breakout                                                   |
| ----- | -------------------------- | -------- | ------ | ---------------------------------------------------------- |
| M0-E1 | fix-gas-test-bridgeout     | Engineer | High   | [e1](../Epic-01/overview/e1-fix-gas-test-bridgeout.md)     |
| M0-E2 | retire-openescrow-test     | Engineer | High   | [e2](../Epic-02/overview/e2-retire-openescrow-test.md)     |
| M0-E3 | shared-bridge-fixtures     | Engineer | High   | [e3](../Epic-03/overview/e3-shared-bridge-fixtures.md)     |
| M0-E4 | fix-foundry-fuzz-bridgeout | Engineer | High   | [e4](../Epic-04/overview/e4-fix-foundry-fuzz-bridgeout.md) |

### M0-E1 — fix-gas-test-bridgeout

The 5 failing bin-count cases in [withdraw-limiter-gas-comparison.test.ts:205](../../../../test/gas/withdraw-limiter-gas-comparison.test.ts#L205) call `bridgeOut(gnusAmount, GNUS_TOKEN_ID, 137)` — the old 3-arg form — so ethers can't resolve a fragment. **Acceptance:** all 5 cases construct gas with the 5-arg call (destination + Y-parity sourced from the shared fixture once E3 lands), and the gas-comparison still records a value. **Risk:** low; the sibling `GNUSBridgeEnhanced.test.ts` already demonstrates the exact call shape. **Key tasks:** update the call; pull `SGNS_DESTINATION`/`SGNS_DESTINATION_Y_ODD` from the shared module; re-run the gas suite.

### M0-E2 — retire-openescrow-test

The `GeniusOwnershipFacet` "maintain contract state across ownership transfer" test referenced the removed `OpenEscrow`; it is currently **commented out** ([GeniusOwnershipFacet.test.ts:259-276](../../../../test/unit/GeniusOwnershipFacet.test.ts#L259-L276)). A commented test is undocumented debt. **Acceptance:** the intent (state survives an ownership transfer) is either re-expressed **without** escrow — e.g. mint a balance, transfer ownership, assert balance/roles unchanged — or the test is deleted with a one-line reason. No commented-out block remains. **Risk:** low. **Key tasks:** decide rewrite-vs-delete; implement; ensure no `OpenEscrow` text survives even in comments.

### M0-E3 — shared-bridge-fixtures

Root-cause fix. Constants are redefined per file, which is exactly why `GNUSBridgeEnhanced.test.ts` was updated but the gas test and Foundry suite drifted. **Acceptance:** one Hardhat/TS fixture module exports `SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, canonical `destChainID`, `GNUS_TOKEN_ID`; the Foundry `GeniusDiamondTestBase.sol` exposes the matching `bytes32` X + `bool` Y-parity (replacing the 64-byte `bytes TEST_SGNS_DEST`). All bridge specs import from these; no duplicate literals remain. **Risk:** low–medium (touches multiple files; must keep values identical to current passing tests). **Key tasks:** create the modules; refactor E1/E4 call sites to import; grep for stray literals. **Sequencing:** logically lands with/just before E1 and E4 so they consume it.

### M0-E4 — fix-foundry-fuzz-bridgeout

[BridgeFuzz.t.sol](../../../../test/foundry/fuzz/BridgeFuzz.t.sol) uses the interim `bridgeOut(uint256,uint256,uint256,bytes)` selector (`0xf7587f7d`), absent from the diamond — so every call reverts. This both **fails** `testFuzz_bridgeAmountEdgeCases` (`assertTrue(success)` on run 0) and **false-greens** `testFuzz_RevertWhen_depositExceedsBalance` and `test_RevertWhen_InvalidDestinationKeyLength` (they pass only because the selector is missing). **Acceptance:** all calls use `bridgeOut(uint256,uint256,uint256,bytes32,bool)` via the E3 Foundry fixture; the edge-case test passes against a real bridge; the balance-exceeded test asserts the _specific_ revert; the obsolete length test is removed (`bytes32` is fixed-length). **Risk:** medium — requires a running `anvil` and correct fixture migration. **Key tasks:** migrate selectors + fixtures; rewrite negative tests to check the real revert reason; delete obsolete test; run `yarn clean-compile && yarn forge:test`.

## 6. Dependencies & sequencing

- **Upstream:** none — M0 is the first milestone and the project's critical-path root.
- **Internal ordering:** **E3 first (or alongside)** so E1 and E4 import the shared
  fixtures rather than re-introducing literals. E2 is independent and can run in parallel.
  E1 (Hardhat) and E4 (Foundry) are independent of each other once E3 exists.
- **Owner gate (blocking):** a usable **`anvil`** instance must be confirmed before E4 can
  be verified.
- **Downstream:** M1 (conformance) and M2 (removal/submodule) both depend on this green,
  fixture-centralized baseline; M3 is the final gate.

## 7. Rollback posture

Test-only and fully revertible via git. Reverting M0's commits returns the suites to the
known baseline (Hardhat 6 failing; Foundry 1 failing + 1 skipped). No system, deployment,
or submodule-pointer state is touched in this milestone.

## 8. Risks (milestone-scoped)

| Risk                                                                          | Mitigation                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A failure actually signals a contract bug                                     | Escalate to Owner; never weaken an assertion to pass (blocking gate).                       |
| Shared-fixture extraction changes a value and breaks a currently-passing test | Copy values verbatim from existing passing specs; diff before/after pass counts.            |
| Foundry suite can't run / misreports because `anvil` isn't up                 | Confirm `anvil` + `yarn clean-compile` prerequisite before E4 verification.                 |
| False-greens "fixed" into still-meaningless tests                             | Require negative tests to assert the _specific_ revert reason, not bare `success == false`. |
| Residual `OpenEscrow`/old-selector literals left in comments or other files   | grep sweep as an exit check across `test/`.                                                 |

## 9. Definition of Done for Milestone 1 (M0)

M0 is closeable when **all** §2 exit-criteria boxes are checked: both runners green, all
seven originally-failing assertions fixed or properly retired, false-greens repaired,
obsolete length test removed, constants centralized per runner, and suite-health counts
recorded at the boundary — with no contract changes and no undocumented commented/skipped
tests introduced.

---

**▶ Next:** run `/breakout-epics` to expand M0's four epics (E1–E4) into their own
`Epic-MM/` directories with epic-overview docs ready for `/create-prd`.
