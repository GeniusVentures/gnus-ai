# Epic 2 — Retire OpenEscrow Test (M0-E2)

> **Parent milestone:** [Milestone 1 — Green Baseline (M0)](../../overview/milestone-01-green-baseline.md)
> **Maps to:** [project-plan §5 M0-E2](../../../bridge-test-realignment-project-plan.md)
> **Owner:** Engineer (with Owner ruling if delete-vs-rewrite is ambiguous) · **Impact/blast radius:** Test-only; 1 ownership test · **Estimated effort:** S (≈30 min)
> **Status:** 📋 ready for `/create-prd`

## Objective

Resolve the orphaned `GeniusOwnershipFacet` test that referenced the removed `OpenEscrow`
function. It is currently **commented out** in the working tree — green, but as
undocumented debt. The original intent was to prove contract state survives an ownership
transfer; `OpenEscrow` was merely the vehicle for creating that state. This epic
re-expresses the intent without escrow, or deletes the test with a recorded reason, so no
commented-out block remains.

## Acceptance criteria

- [ ] The commented block at [GeniusOwnershipFacet.test.ts:259-276](../../../../../test/unit/GeniusOwnershipFacet.test.ts#L259-L276) is gone.
- [ ] Either: an active test asserts state survives `transferOwnership` **without** `OpenEscrow` (e.g. mint a balance / set a role, transfer ownership, assert it's unchanged); **or** the test is deleted with a one-line `// removed: …` reason in the suite or commit message.
- [ ] No `OpenEscrow` or `GeniusAI` reference survives in this file — including comments.
- [ ] `npx hardhat test` shows the `GeniusOwnershipFacet` suite green; no new pending/skip introduced.

## Tasks

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | Decide rewrite-vs-delete (default: rewrite escrow-free to preserve intent) | Engineer (Owner if ambiguous) | decision recorded |
| 2 | If rewrite: implement an escrow-free state-persistence assertion across `transferOwnership` | Engineer | test runs and passes |
| 3 | If delete: remove the block and record the reason | Engineer | no orphaned comment remains |
| 4 | grep the file (and suite) for residual `OpenEscrow`/`GeniusAI` text | Engineer | none remain |

## Dependencies & owner gates

- **Upstream:** none (independent of E1/E3/E4; can run in parallel).
- **Owner gate (conditional, blocking):** if no meaningful escrow-free state-persistence
  assertion is reasonable, the **Owner** rules on delete-vs-rewrite before closing. Note:
  the broader "`OpenEscrow` selector is absent from the diamond" negative test is **M2-E1**,
  not this epic.

## Risks

| Risk | Mitigation |
|---|---|
| Rewrite changes what's being verified vs original intent | Keep the assertion about *state persistence across ownership transfer*; only swap the state-creation vehicle |
| Residual `OpenEscrow` text left in a comment | grep sweep as exit check |

## Notes

- Reversible: test-only, single file.
- Scope boundary: this epic removes the *reference*; proving the *selector is gone from the
  diamond* belongs to M2-E1.
