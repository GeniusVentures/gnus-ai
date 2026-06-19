# Tasks — Retire OpenEscrow Test (M0-E2)

> **PRD:** [prd-e2-retire-openescrow-test](./prd-e2-retire-openescrow-test.md) ·
> **Epic:** [e2-retire-openescrow-test](./overview/e2-retire-openescrow-test.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md)

## Relevant Files & Resources

- `test/unit/GeniusOwnershipFacet.test.ts` - **Modified.** Commented-out `OpenEscrow` test replaced with an active escrow-free state-persistence test (balance + role survive `transferOwnership`).
- `…/Epic-02/CHANGELOG.md` - **Created.** Epic change log.
- Hardhat only — this epic does not touch Foundry or `anvil`.

### Notes

- Reversible, test-only change; rollback = `git revert` the commit.
- The diamond `owner` (LibDiamond `contractOwner`) is separate from AccessControl roles, so both a token balance and a granted role should persist across `transferOwnership` — that is what the new test asserts.
- `owner` (signer 0) is the deployer/super-admin and already holds `MINTER_ROLE` (used to `mint`) and role-admin rights (used to `grantRole`).
- Baseline to beat (no regression): Hardhat **371 passing / 2 pending / 0 failing**; the new active test should make it **372 passing**. Foundry untouched.
- Exit-criterion for M0: **no** `OpenEscrow`/`GeniusAI` text remains (not even in comments) and no new skipped/commented test.

## Tasks

- [x] 0.0 Prepare & safeguard
  - [x] 0.1 Created and checked out `chore/retire-openescrow-test` off `chore/fix-foundry-fuzz-bridgeout`
  - [x] 0.2 Baseline: **371 passing / 2 pending / 0 failing**; file carried the commented-out `OpenEscrow` block

- [x] 1.0 Replace the commented-out `OpenEscrow` test with an escrow-free state-persistence test
  - [x] 1.1 Deleted the commented-out block (~lines 259-276)
  - [x] 1.2 Added active test: mint 100 GNUS to `user1`; `grantRole(MINTER_ROLE, user2)`
  - [x] 1.3 Recorded pre-transfer balance + asserted `hasRole` true
  - [x] 1.4 `transferOwnership(user1)`; asserted `owner()` == `user1`
  - [x] 1.5 Asserted balance unchanged and role still held after transfer
  - [x] 1.6 Self-contained (suite `afterEach` reverts snapshot)

- [x] 2.0 Verify no `OpenEscrow`/`GeniusAI` references remain
  - [x] 2.1 `grep` → no matches (reworded my own comment to avoid the literal tokens)
  - [x] 2.2 No commented-out / `.skip` / `xit` tests in the file

- [x] 3.0 Validate the change
  - [x] 3.1 `npx hardhat test test/unit/GeniusOwnershipFacet.test.ts` → new test passes; **19 passing**
  - [x] 3.2 `yarn test` → **372 passing / 2 pending / 0 failing** (was 371/2/0); no new failures
  - [x] 3.3 No production contract or `scripts/` change (only the test file edited)

- [x] 4.0 Record the change and commit
  - [x] 4.1 Appended summary to `…/Epic-02/CHANGELOG.md`
  - [x] 4.2 Updated results + Relevant Files
  - [x] 4.3 Staged only the test file + task file + CHANGELOG; committed on `chore/retire-openescrow-test`
