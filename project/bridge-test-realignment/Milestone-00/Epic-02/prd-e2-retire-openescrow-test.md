# PRD — Retire OpenEscrow Test (M0-E2)

> **Epic:** [e2-retire-openescrow-test](./overview/e2-retire-openescrow-test.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md) ·
> **Plan:** [project-plan §5 M0-E2](../../bridge-test-realignment-project-plan.md)
> **Status:** 📋 ready for `/generate-tasks` · **Author:** Am0rfu5 · **Date:** 2026-06-19

## 1. Introduction / Overview

The `GeniusAI` contract — which provided the `OpenEscrow` payable function — was removed
from the diamond. One `GeniusOwnershipFacet` test, "should maintain contract state across
ownership transfer," used `OpenEscrow` to create on-contract state, then checked the state
survived a `transferOwnership`. With `OpenEscrow` gone, the test was **commented out** to
keep the suite green — leaving an undocumented commented block.

This feature **rewrites that test escrow-free** so the original intent — _contract state
persists across an ownership transfer_ — is still verified, without depending on the
removed escrow feature. It is a test-only change.

## 2. Goals

- **G1** — The commented-out `OpenEscrow` test block is removed.
- **G2** — An **active** test verifies that contract state persists across `transferOwnership`,
  using state that still exists after the GeniusAI removal (token balances and/or roles).
- **G3** — No reference to `OpenEscrow` or `GeniusAI` remains in the file, including comments.
- **G4** — No new pending/skipped test is introduced.

## 3. User Stories

- **As a maintainer,** I want the ownership-transfer test to verify real, current state, so
  I keep coverage of "ownership transfer doesn't disturb contract state" without the dead
  escrow dependency.
- **As a reviewer,** I want no commented-out test blocks, so the suite reflects exactly
  what is and isn't tested.

## 4. Functional Requirements

1. The system must delete the commented-out block at
   [GeniusOwnershipFacet.test.ts:259-276](../../../../../test/unit/GeniusOwnershipFacet.test.ts#L259-L276).
2. The system must add an active test in the `Edge Cases` describe block that:
   1. establishes observable contract state **without** `OpenEscrow` — e.g. mint a GNUS
      balance to an account and/or grant a role to an account;
   2. records that state before the transfer;
   3. calls `transferOwnership` (the path already exercised by neighboring tests);
   4. asserts the recorded state (balance and/or role assignment) is **unchanged** after
      the transfer.
3. The test must use only functions that exist on the current diamond (e.g. `mint`,
   `balanceOf`, `grantRole`/`hasRole`, `transferOwnership`, `owner`).
4. The file must contain no `OpenEscrow` or `GeniusAI` text after the change (verified by grep).
5. The `GeniusOwnershipFacet` suite must pass under `npx hardhat test` with no new skips.

## 5. Non-Goals (Out of Scope)

- Asserting that the `OpenEscrow` **selector is absent from the diamond** — that negative
  test belongs to milestone M2 (M2-E1).
- Any change to ownership or access-control contract logic.
- Re-introducing escrow functionality in any form.

## 6. Technical Considerations

- **State vehicle:** prefer a GNUS balance (`mint` then `balanceOf`) and/or a role
  (`grantRole` then `hasRole`) as the persisted state, since those clearly survive an
  ownership transfer and use existing facets.
- **Intent fidelity:** keep the assertion focused on _state persistence across ownership
  transfer_; only the mechanism for creating state changes (no escrow).
- **Existing patterns:** neighboring tests in the same file already use
  `transferOwnership`, `owner()`, and signer connections — follow their style.

## 7. Success Metrics

- The `GeniusOwnershipFacet` suite is green with one **active** state-persistence test (not
  commented, not skipped).
- `grep -n "OpenEscrow\|GeniusAI"` on the file returns nothing.

## 8. Open Questions

- Which state vehicle to assert — balance, role, or both? _Default: assert both a minted
  GNUS balance and a granted role for stronger coverage._ Resolve during `/generate-tasks`.
