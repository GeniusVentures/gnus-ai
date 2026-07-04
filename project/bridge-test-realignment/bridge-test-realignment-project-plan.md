# Bridge Test Realignment — Project Plan

> **Status:** 📋 Plan of record — for owner approval
> **Author:** Am0rfu5 · **Date:** 2026-06-19
> **Companion design doc:** [bridge-test-realignment-architecture.md](./bridge-test-realignment-architecture.md) — **read this first**; it is the source of truth for the contract behavior the tests must verify.
>
> **Governing constraint:** The contracts are already refactored and are the source of
> truth. This project changes **tests only** — it must not alter contract behavior. "Done"
> means **both** test runners green — Hardhat (`npx hardhat test`) **and** Foundry
> (`yarn forge:test`) — with assertions that reflect the new bridge design, **zero**
> pending or commented-out tests left undocumented, and **zero false-greens** (tests that
> pass for the wrong reason, e.g. because a stale selector simply doesn't exist).

---

## 1. How to read this plan

Work is decomposed into **milestones** (independently-valuable, releasable steps that each
leave the suite in a working state) and **epics** (coherent units of work tracked
together). Stable IDs used across the whole pipeline:

- **Milestones:** `M0`…`M3` (zero-indexed; `M0` is the green-baseline foundation).
- **Epics:** `M<n>-E<m>` (e.g. `M1-E2`).
- **Slugs:** short kebab-case.

**Roles referenced:**

- **Engineer** — writes/edits test code (the bulk of this work; agent-executable).
- **Owner (Am0rfu5)** — approves the plan, owns the `diamonds/GeniusDiamond` **submodule
  pointer commit**, and any merge/push to `feature/bridge-out-initiated` or `main`.
  Submodule-pointer and merge decisions are **blocking owner tasks** (see §7).

---

## 2. Objectives & success criteria

| #   | Objective                       | Measurable definition of done                                                                                                                                    |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Green test suites               | `npx hardhat test` **and** `yarn forge:test` (with a running `anvil`) both report **0 failing**; the 6 Hardhat failures and the 1 Foundry fuzz failure are gone. |
| O1b | No false-greens                 | No test passes because a stale/missing selector reverts; negative tests assert the _intended_ revert reason.                                                     |
| O2  | Tests reflect new bridge design | Every `bridgeOut` call site uses the 5-arg form; `BridgeOutInitiated` is asserted with all 7 fields including `sgnsDestination` + `destinationYOdd`.             |
| O3  | Removal coverage                | No test references `OpenEscrow`/`GeniusAI`; a negative test asserts the `OpenEscrow` selector is absent from the diamond.                                        |
| O4  | Submodule conformance           | Diamond-init tests assert the current facet set (WithdrawLimiter present, GeniusAI absent); stale submodule pointer fails a test rather than passing silently.   |
| O5  | No undocumented debt            | **0** pending/`skip`/`xit`/commented tests remain without a tracked, written decision; ideally **0** pending tests.                                              |
| O6  | Drift prevention                | Bridge test constants live in **one** shared fixture imported by all bridge specs.                                                                               |

**Overarching acceptance gate:** `npx hardhat test` green (0 failing) **and** O2–O6
verified by review, on `feature/bridge-out-initiated`.

---

## 3. Guiding execution principles

- **Tests follow contracts, never the reverse.** If a test failure reveals a _contract_
  bug, stop and escalate to the Owner — do not "fix" by weakening the test.
- **One behavior per test; assert the full event.** Prefer complete `withArgs` matching
  over partial/`emit`-only checks for `BridgeOutInitiated`.
- **Root-cause, don't patch.** The failures stem from per-file constant drift — fix the
  cause (shared fixtures) not just the symptom.
- **Green at every milestone boundary.** Each milestone ends with the suite at least as
  green as it started; no milestone leaves it broken.
- **No silent skips.** Any test that stays skipped exits with a `// reason:` comment and a
  tracked decision.
- **Owner-gate irreversible/outward actions.** Submodule-pointer commits, branch
  merges, and pushes are Owner-only.

---

## 4. Milestone map (at a glance)

| Milestone | Title                        | Outcome                                                                                          | Impact / Risk                          | Realizes design § |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------------- |
| **M0**    | Green baseline               | 6 Hardhat + 1 Foundry failures fixed; Foundry false-greens repaired; shared fixtures established | High value / Low risk                  | §1, §5            |
| **M1**    | Bridge-design conformance    | Suite asserts new signature, event, destination-key semantics                                    | High value / Low risk                  | §1, §2            |
| **M2**    | Removal & submodule coverage | GeniusAI/OpenEscrow removal + DiamondInit facet set covered                                      | Medium value / Medium risk (submodule) | §3, §4            |
| **M3**    | Zero-debt green gate         | Pending tests resolved; final full-suite gate + CI                                               | Medium value / Low risk                | all               |

**Critical path:** `M0 → M1 → M3`. `M2` depends on `M0` and can run **in parallel with
M1**. `M3` is the final gate and depends on M1 + M2.

```
        ┌──────────────┐
M0 ────►│ M1 (conform) │────┐
  │     └──────────────┘    ▼
  │                      ┌───────────────┐
  └────►┌──────────────┐ │ M3 (green gate)│
        │ M2 (removal) │►┘ └───────────────┘
        └──────────────┘
```

---

## 5. Milestones & epics

### M0 — Green baseline (`green-baseline`)

**Goal:** Eliminate the 6 Hardhat failures **and** the 1 Foundry fuzz failure, establish
the shared fixtures that prevent recurrence, and repair the Foundry false-greens — leaving
both `npx hardhat test` and `yarn forge:test` at 0 failing.

**Exit criteria:** All 7 originally-failing tests pass or are properly retired; the two
Foundry false-green negative tests fail-for-the-right-reason; bridge constants come from
one shared module per runner; both suites green (Foundry run against a live `anvil`).

| Epic  | Title                        | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                      | Owner    | Impact |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| M0-E1 | `fix-gas-test-bridgeout`     | Update `test/gas/withdraw-limiter-gas-comparison.test.ts:205` (the 5 failing bin-count cases) to the 5-arg `bridgeOut(amount, id, destChainID, sgnsDestination, destinationYOdd)` form.                                                                                                                                                                                                                                                      | Engineer | High   |
| M0-E2 | `retire-openescrow-test`     | Replace the commented-out `GeniusOwnershipFacet` "maintain state across ownership transfer" test with an escrow-free state-persistence assertion (or delete with a written reason). No commented test left behind.                                                                                                                                                                                                                           | Engineer | High   |
| M0-E3 | `shared-bridge-fixtures`     | Hoist `SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, canonical `destChainID`, `GNUS_TOKEN_ID` into a shared test helper; refactor `GNUSBridgeEnhanced.test.ts` + gas test to import it. (Foundry mirror: replace the 64-byte `bytes TEST_SGNS_DEST` in `GeniusDiamondTestBase.sol` with a `bytes32` X + `bool` Y-parity.)                                                                                                                     | Engineer | High   |
| M0-E4 | `fix-foundry-fuzz-bridgeout` | Migrate `test/foundry/fuzz/BridgeFuzz.t.sol` from the obsolete `bridgeOut(uint256,uint256,uint256,bytes)` selector to `bridgeOut(uint256,uint256,uint256,bytes32,bool)`. Fixes the `testFuzz_bridgeAmountEdgeCases` failure, repairs the two **false-green** negative tests (currently revert only because the selector is missing), and removes the now-obsolete `test_RevertWhen_InvalidDestinationKeyLength` (`bytes32` is fixed-length). | Engineer | High   |

### M1 — Bridge-design conformance (`bridge-conformance`)

**Goal:** Ensure the suite _verifies_ the new contract semantics, not merely that calls
compile.

**Exit criteria:** Full-field `BridgeOutInitiated` assertions; destination-key edge cases
covered; guard reverts covered.

| Epic  | Title                      | Summary                                                                                                                                                                                                                                                                        | Owner    | Impact |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| M1-E1 | `event-arg-assertions`     | Audit all `bridgeOut` specs (Hardhat **and** Foundry); assert `BridgeOutInitiated` with all 7 args incl. `srcChainID` from storage, `sgnsDestination`, `destinationYOdd`. Upgrade `emit`-only checks to `withArgs`; in Foundry use `vm.expectEmit`.                            | Engineer | High   |
| M1-E2 | `destination-key-coverage` | Add cases for X = zero, X = max `bytes32`, and both Y-parity values; assert the contract forwards the opaque key faithfully (no on-chain curve validation).                                                                                                                    | Engineer | Medium |
| M1-E3 | `bridge-guard-coverage`    | Cover the three reverts (`Token not created.`, `Insufficient tokens.`, `Cannot bridge to same chain`) and burn-then-emit ordering — asserting the **specific** revert reason (closes the Foundry false-green class where a missing selector masqueraded as a guard rejection). | Engineer | Medium |

### M2 — Removal & submodule coverage (`removal-submodule`)

**Goal:** Lock in the GeniusAI/OpenEscrow removal and DiamondInitFacet submodule change
with positive and negative coverage.

**Exit criteria:** Negative test for absent `OpenEscrow` selector; diamond-init tests
reflect the current facet set (WithdrawLimiter present, GeniusAI absent).

| Epic  | Title                         | Summary                                                                                                                                                                                                   | Owner                          | Impact |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| M2-E1 | `openescrow-removal-coverage` | Assert no `OpenEscrow`/GeniusAI selector is wired into the diamond (guards re-introduction). Remove any dangling references.                                                                              | Engineer                       | Medium |
| M2-E2 | `diamond-init-coverage`       | Verify `DiamondInitFacet` init wiring against the new submodule config (WithdrawLimiter registered; `chainID`/`bridgeFee` defaults). Confirm submodule pointer (`diamonds/GeniusDiamond`) is intentional. | Engineer + **Owner** (pointer) | Medium |

### M3 — Zero-debt green gate (`green-gate`)

**Goal:** Resolve remaining pending tests and lock the green state.

**Exit criteria:** 0 failing, 0 undocumented pending; final full-suite run recorded.

| Epic  | Title                   | Summary                                                                                                                                                                                                  | Owner                        | Impact |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------ |
| M3-E1 | `resolve-rpc-pending`   | Resolve `test/integration/rpc/rpc-deployment.test.ts` skips (`this.skip()` @19, `it.skip` @71): rewrite to run, or delete with a written reason.                                                         | Engineer                     | Medium |
| M3-E2 | `resolve-template-skip` | Resolve the `it.skip` in `test/utils/test-template.ts:163` (template placeholder — likely keep with documented reason or remove from active runs).                                                       | Engineer                     | Low    |
| M3-E3 | `full-suite-green-gate` | Final `npx hardhat test` **and** `yarn clean-compile && yarn forge:test` (against a running `anvil`) both at 0 failing; record pass counts; confirm CI runs **both** runners (with `anvil` provisioned). | Engineer + **Owner** (merge) | High   |

---

## 6. Cross-cutting workstreams

- **Change log:** maintain `CHANGELOG.md` per epic dir as tests are edited.
- **Contract-bug escalation:** any failure tracing to a contract (not a test) defect is
  logged and escalated to the Owner — never silently patched in the test.
- **Suite-health tracking:** record passing/failing/pending counts at each milestone
  boundary. Baselines — **Hardhat:** 366 passing, 2 pending, 6 failing; **Foundry:** 216
  passed, 1 failed, 1 skipped (218 total).
- **Foundry environment:** `yarn forge:test` requires a running **`anvil`** instance (and
  `yarn clean-compile` first). Document the exact local + CI invocation so contributors
  reproduce the run; this is a prerequisite for every Foundry-touching epic and the M3 gate.
- **Review:** each milestone's test diffs reviewed before the next begins.

---

## 7. Dependencies & sequencing rules

- **M0 first** — everything depends on a green baseline and the shared fixtures (M0-E3).
- **M1 ∥ M2** — both depend only on M0 and may proceed in parallel.
- **M3 last** — depends on M1 + M2; it is the final gate.
- **Blocking owner tasks:**
  - **M2-E2 / M3-E3:** committing the `diamonds/GeniusDiamond` **submodule pointer** and
    any **merge/push** of `feature/bridge-out-initiated` are Owner-only and block project
    sign-off until done.

---

## 8. Risk register (plan-level)

| Risk                                                                                            | Likelihood             | Impact | Mitigation                                                                   | Owner            |
| ----------------------------------------------------------------------------------------------- | ---------------------- | ------ | ---------------------------------------------------------------------------- | ---------------- |
| A failure actually signals a contract bug, not a test gap                                       | Low                    | High   | Escalation rule (§6); never weaken a test to pass                            | Owner            |
| Submodule pointer drifts / not committed                                                        | Medium                 | Medium | M2-E2 asserts facet set; Owner commits pointer explicitly                    | Owner            |
| Constant drift recurs across files                                                              | Medium                 | Medium | M0-E3 single shared fixture                                                  | Engineer         |
| Partial event assertions hide field regressions                                                 | Medium                 | Medium | M1-E1 enforces full `withArgs`                                               | Engineer         |
| False-greens: tests pass only because a stale selector reverts (Foundry `assertFalse(success)`) | High (already present) | High   | M0-E4 + M1-E3 assert the _specific_ revert reason, not bare failure          | Engineer         |
| Foundry suite skipped/misreported because `anvil` isn't running                                 | Medium                 | Medium | Document the `anvil` + `clean-compile` prerequisite; wire it into CI (M3-E3) | Engineer + Owner |
| Pending tests silently re-accumulate                                                            | Low                    | Low    | O5 zero-debt gate; documented reasons required                               | Engineer         |

---

## 9. Rollback posture per milestone

| Milestone | Primary rollback lever                                                           |
| --------- | -------------------------------------------------------------------------------- |
| M0        | Revert test-file commits; suite returns to known 6-failing baseline.             |
| M1        | Revert conformance commits; M0 green state retained.                             |
| M2        | Revert coverage commits; **do not** revert submodule pointer (Owner-controlled). |
| M3        | Revert pending-test edits; suite remains green from M1/M2.                       |

All milestones are test-only and fully revertible via git; no system/state changes occur.

---

## 10. Deliverables checklist (project-level)

- [ ] M0: Hardhat gas test uses 5-arg `bridgeOut`; Foundry `BridgeFuzz.t.sol` migrated to the `bytes32,bool` selector (failing test fixed, false-greens repaired, obsolete length test removed); OpenEscrow test retired; shared fixtures in place per runner; both suites green.
- [ ] M1: full-field `BridgeOutInitiated` assertions; destination-key + guard coverage.
- [ ] M2: negative `OpenEscrow`-selector test; diamond-init facet-set coverage; submodule pointer confirmed.
- [ ] M3: pending tests resolved; final `npx hardhat test` at 0 failing, 0 undocumented pending.
- [ ] Suite-health counts recorded at each milestone boundary.
- [ ] Companion design doc kept in sync with any clarified contract behavior.

---

## 11. Next step — breaking this out

Expand the first milestone with `/breakout-milestone`. The pipeline fills this tree:

```
project/bridge-test-realignment/
├── bridge-test-realignment-project-plan.md     ← this file (plan of record)
├── bridge-test-realignment-architecture.md     ← companion design doc
├── Milestone-00/                               ← M0 (green-baseline)
│   ├── overview/
│   │   └── milestone-01-green-baseline.md       ← /breakout-milestone (file # is 1-based)
│   ├── Epic-01/                                 ← M0-E1 fix-gas-test-bridgeout
│   │   ├── overview/e1-fix-gas-test-bridgeout.md ← /breakout-epics
│   │   ├── prd-e1-fix-gas-test-bridgeout.md      ← /create-prd
│   │   ├── tasks-e1-fix-gas-test-bridgeout.md    ← /generate-tasks
│   │   └── CHANGELOG.md
│   ├── Epic-02/ …                               ← M0-E2 retire-openescrow-test
│   ├── Epic-03/ …                               ← M0-E3 shared-bridge-fixtures
│   └── Epic-04/ …                               ← M0-E4 fix-foundry-fuzz-bridgeout
├── Milestone-01/ …                             ← M1 (bridge-conformance)
├── Milestone-02/ …                             ← M2 (removal-submodule)
└── Milestone-03/ …                             ← M3 (green-gate)
```

Indexing: directory `Milestone-NN` is zero-padded to the `M<n>` id (`M0`→`Milestone-00`);
the overview filename/H1 uses the 1-based human number (`M0`→`milestone-01-…`,
"Milestone 1"). Epic dirs/files use the `E<m>` number (`M0-E1`→`Epic-01/overview/e1-<slug>.md`).

**▶ Run `/breakout-milestone` for M0 (green-baseline) to continue.**
