# Tasks — Fix Gas-Test bridgeOut (M0-E1)

> **PRD:** [prd-e1-fix-gas-test-bridgeout](./prd-e1-fix-gas-test-bridgeout.md) ·
> **Epic:** [e1-fix-gas-test-bridgeout](./overview/e1-fix-gas-test-bridgeout.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md)

## Relevant Files

- `test/gas/withdraw-limiter-gas-comparison.test.ts` - The gas test whose `bridgeOut` call (line ~205) still uses the old 3-arg signature; the only file edited by this epic.
- `test/utils/bridge-fixtures.ts` - Shared fixture (from M0-E3) providing `SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, `DEST_CHAIN_ID`; consumed here.
- `test/unit/GNUSBridgeEnhanced.test.ts` - Reference for the correct 5-arg call shape (not edited).

### Notes

- This is a Solidity (Diamond/ERC-2535) repo: Hardhat tests under `test/unit`/`test/integration`/`test/gas`; shared TS helpers under `test/utils`.
- The M0-E3 fixtures are already committed on branch `chore/shared-bridge-fixtures`; branch E1 off it so the import resolves.
- Run `yarn test` (Hardhat). Foundry is unaffected by this epic.
- Baseline to beat (no regression): Hardhat **366 passing / 2 pending / 5 failing** — this epic should turn the 5 failures into passes (→ ~371 passing / 0 of these failing).

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 From `chore/shared-bridge-fixtures` (which carries the M0-E3 fixtures), create and checkout `git checkout -b chore/fix-gas-test-bridgeout`
  - [x] 0.2 Record the starting count from the last run for reference: Hardhat **366 passing / 2 pending / 5 failing** (the 5 failures are the `GNUSBridge.bridgeOut()` gas cases this epic fixes)

- [x] 1.0 Update the gas-test `bridgeOut` call to the 5-argument signature via the shared fixture
  - [x] 1.1 In `test/gas/withdraw-limiter-gas-comparison.test.ts`, add an import of `SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, and `DEST_CHAIN_ID` from `../utils/bridge-fixtures`
  - [x] 1.2 Update the `bridgeOut(...)` call (~line 205) to `bridgeOut(gnusAmount, GNUS_TOKEN_ID, DEST_CHAIN_ID, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD)`
  - [x] 1.3 Left the file's local `const GNUS_TOKEN_ID = 0` (line 46) unchanged (number; used as `createNFT` parent arg)
  - [x] 1.4 Did not change `recordGas(...)`, thresholds, or the report format

- [x] 2.0 Verify the five bin-count gas cases pass and no stale 3-arg literals remain
  - [x] 2.1 `npx hardhat test test/gas/withdraw-limiter-gas-comparison.test.ts` → all five `GNUSBridge.bridgeOut()` cases pass; **50 passing, 0 failing** in the file
  - [x] 2.2 Grep found no 3-arg `bridgeOut(` call and no bare `137` destination literal (only a doc-comment mention of `bridgeOut()` on line 8)
  - [x] 2.3 No `no matching fragment ... key: "bridgeOut"` error in the run

- [ ] 3.0 Verify full-suite no-regression and commit
  - [ ] 3.1 Run `yarn test` (Hardhat) — confirm the 5 prior failures are gone and pass count rose by ~5 (≈371 passing / 2 pending / 0 of these failing), with no new failures
  - [ ] 3.2 Confirm no production contract or `scripts/common` change (only the gas test edited)
  - [ ] 3.3 Stage only `test/gas/withdraw-limiter-gas-comparison.test.ts` + this task file (exclude the owner-gated submodule pointer and unrelated files), then commit on `chore/fix-gas-test-bridgeout` referencing M0-E1 (no merge — owner gate). Body lines ≤ 100 chars (commitlint)
