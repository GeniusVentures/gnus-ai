# Changelog — Epic M0-E2 (retire-openescrow-test)

## 2026-06-19 — Replaced the commented-out OpenEscrow test with an escrow-free equivalent

**What changed**
- Removed the commented-out `should maintain contract state across ownership transfer` block in `test/unit/GeniusOwnershipFacet.test.ts` that depended on the removed escrow function.
- Added an active test asserting that persistent state survives `transferOwnership` without escrow:
  - mints a GNUS balance to `user1` and grants `MINTER_ROLE` to `user2`,
  - transfers ownership to `user1`,
  - asserts the balance and the role assignment are both unchanged afterwards.
- Reworded the explanatory comment so no `OpenEscrow`/`GeniusAI` text remains anywhere in the file.

**Result**
- Hardhat: **371 passing / 2 pending / 0 failing → 372 passing / 2 pending / 0 failing** (one new active test; no commented/skipped tests remain).
- Foundry untouched. No production contract or `scripts/` changes.

**Notes**
- Coverage is arguably stronger than the original: it checks two independent kinds of persisted state (a token balance and an AccessControl role), meaningful because the diamond `owner` is separate from AccessControl roles.
