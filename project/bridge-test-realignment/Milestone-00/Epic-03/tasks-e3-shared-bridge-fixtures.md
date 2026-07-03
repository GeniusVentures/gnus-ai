# Tasks — Shared Bridge Test Fixtures (M0-E3)

> **PRD:** [prd-e3-shared-bridge-fixtures](./prd-e3-shared-bridge-fixtures.md) ·
> **Epic:** [e3-shared-bridge-fixtures](./overview/e3-shared-bridge-fixtures.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md)

## Relevant Files

- `test/utils/bridge-fixtures.ts` - **Created.** Single TS source of truth for bridge constants (`SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, `DEST_CHAIN_ID`) and a re-export of `GNUS_TOKEN_ID`.
- `scripts/common.ts` - Existing home of `GNUS_TOKEN_ID` (`0n`); re-exported by the new fixture (value unchanged, file not modified).
- `test/unit/GNUSBridgeEnhanced.test.ts` - **Modified.** Imports from the fixture; inline `SGNS_DESTINATION`/`SGNS_DESTINATION_Y_ODD` consts removed; `137` destChainID literals → `DEST_CHAIN_ID`.
- `test/foundry/base/GeniusDiamondTestBase.sol` - **Modified.** Added `bytes32 SGNS_DESTINATION` + `bool SGNS_DESTINATION_Y_ODD` (paired with the TS fixture); `TEST_SGNS_DEST` kept + marked deprecated with a `TODO(M0-E4)` (still referenced by `BridgeFuzz.t.sol` and `GeniusDiamondHandler.sol`).
- `test/gas/withdraw-limiter-gas-comparison.test.ts` - **Not edited here** (wired to the fixture in M0-E1); downstream consumer.
- `test/foundry/fuzz/BridgeFuzz.t.sol` - **Not edited here** (migrated in M0-E4); downstream consumer.
- `test/foundry/handlers/GeniusDiamondHandler.sol` - **Not edited here** (discovered consumer of old `bridgeOut(...,bytes)`; migrate in M0-E4).

### Notes

- This is a Solidity (Diamond/ERC-2535) repo: Hardhat tests live under `test/unit`/`test/integration`/`test/gas`; Foundry tests under `test/foundry`; shared TS helpers under `test/utils`.
- Run `yarn test` (Hardhat) and `yarn forge:test` (Foundry, requires a running **`anvil`**), or `yarn test:all` for both. Run `yarn clean-compile` after changing the Foundry base.
- **Value fidelity is the core constraint:** copy `SGNS_DESTINATION` / Y-parity verbatim from the currently-passing `GNUSBridgeEnhanced.test.ts` so no test changes behavior.
- Scope is the **three known bridge sites only** — do not touch unrelated files.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Confirm the current branch is `feature/bridge-out-initiated`, then create and checkout a working branch off it: `git checkout -b chore/shared-bridge-fixtures`
  - [x] 0.2 Confirm a clean baseline: run `yarn test` and (with `anvil` running) `yarn clean-compile && yarn forge:test`, and record the starting pass/fail/pending counts to compare against later - **Baseline (2026-06-19, branch `chore/shared-bridge-fixtures`):** - Hardhat (`yarn test`): **366 passing, 2 pending, 5 failing** (5 not 6 — E2's OpenEscrow test already commented out in the working tree). - Foundry (`yarn forge:test`, anvil chain 31337): **216 passed, 1 failed, 1 skipped** (the 1 failure is `BridgeFuzz` — owned by M0-E4, not E3). - **Gating note:** baseline is intentionally red (this milestone exists to fix it). E3 is gated on **no regression vs. these counts**, not all-green.

- [x] 1.0 Create the TypeScript bridge fixture module (`test/utils/bridge-fixtures.ts`)
  - [x] 1.1 Create `test/utils/bridge-fixtures.ts`
  - [x] 1.2 Import `ethers` and export `SGNS_DESTINATION = ethers.zeroPadValue('0x1234', 32)` — copied verbatim from `GNUSBridgeEnhanced.test.ts` (the 32-byte X component of the SGNS destination key)
  - [x] 1.3 Export `SGNS_DESTINATION_Y_ODD = false` (the boolean Y-parity, matching the current value)
  - [x] 1.4 Export `DEST_CHAIN_ID = 137` as the single canonical destination chain id (Polygon; guaranteed `!=` local Hardhat/anvil chain id so the same-chain `bridgeOut` guard passes). Match the literal type used at existing call sites (number)
  - [x] 1.5 Re-export `GNUS_TOKEN_ID` from `scripts/common` (e.g. `export { GNUS_TOKEN_ID } from '../../scripts/common';`) — do NOT redefine it with a new literal
  - [x] 1.6 Add a top-of-file comment stating this is the single source of truth for Hardhat bridge constants and that the X value must stay in lockstep with the Foundry base (Task 2.0)

- [x] 2.0 Add matching bridge constants to the Foundry test base (`bytes32` X + `bool` Y-parity)
  - [x] 2.1 In `test/foundry/base/GeniusDiamondTestBase.sol`, add `bytes32 public constant SGNS_DESTINATION = bytes32(uint256(0x1234));` — the same X value as the TS fixture (`0x1234` left-padded to 32 bytes)
  - [x] 2.2 Add `bool public constant SGNS_DESTINATION_Y_ODD = false;` matching the TS Y-parity
  - [x] 2.3 Add a comment pairing these constants with `test/utils/bridge-fixtures.ts` so the two cannot silently drift
  - [x] 2.4 Do NOT yet delete `TEST_SGNS_DEST` if other Foundry files still reference it (its consumer `BridgeFuzz.t.sol` is migrated in M0-E4); deletion is handled in Task 4.0 once it is unreferenced
  - [x] 2.5 Run `yarn clean-compile` to confirm the base still compiles

- [x] 3.0 Migrate `GNUSBridgeEnhanced.test.ts` to import from the shared fixture
  - [x] 3.1 Add an import of `SGNS_DESTINATION`, `SGNS_DESTINATION_Y_ODD`, and `DEST_CHAIN_ID` from `../utils/bridge-fixtures` (file does not use `GNUS_TOKEN_ID`, so not imported)
  - [x] 3.2 Remove the inline `const SGNS_DESTINATION = ...` and `const SGNS_DESTINATION_Y_ODD = ...` definitions
  - [x] 3.3 Replace any inline `137` destination-chain literal in `bridgeOut(...)` calls with `DEST_CHAIN_ID` (4 calls + 1 `withArgs`; the `srcChainID` literal `1` left untouched)
  - [x] 3.4 Run `npx hardhat test test/unit/GNUSBridgeEnhanced.test.ts` and confirm the file's tests still pass unchanged — **31 passing, 0 failing**

- [x] 4.0 Remove obsolete/duplicate literals and verify no drift between runners
  - [x] 4.1 Confirm `TEST_SGNS_DEST` reference state. **Still referenced** by `test/foundry/fuzz/BridgeFuzz.t.sol` (E4) and `test/foundry/handlers/GeniusDiamondHandler.sol` — so kept, with a `// TODO(M0-E4): remove after BridgeFuzz migration` note added in `GeniusDiamondTestBase.sol`.
  - [x] 4.2 Grep the migrated site (`GNUSBridgeEnhanced.test.ts`) for leftover inline literals (`zeroPadValue('0x1234', 32)`, standalone `SGNS_DESTINATION =`) — **none remain**. (Gas test + BridgeFuzz still hold their own literals; migrating those is M0-E1 / M0-E4, out of E3 scope.)
  - [x] 4.3 Verified TS `zeroPadValue('0x1234', 32)` == Foundry `bytes32(uint256(0x1234))` == `0x00…1234` (identical 32-byte X value).
  - [x] 4.4 Confirmed no production contract or `scripts/common` value changed (`git status` on `contracts/`/`scripts/` shows no tracked changes).
  - [x] 4.5 **(discovered)** `test/foundry/handlers/GeniusDiamondHandler.sol:275` also calls the old `bridgeOut(...,bytes)` form — out of E3 scope; logged for **M0-E4** to migrate alongside `BridgeFuzz.t.sol` (and only then can `TEST_SGNS_DEST` be deleted).

- [x] 5.0 Verify both suites are green with no regressions
  - [x] 5.1 `yarn test` (Hardhat) → **366 passing, 2 pending, 5 failing** — identical to baseline, no regression (the 5 failures are the gas test, owned by M0-E1).
  - [x] 5.2 `yarn clean-compile && yarn forge:test` (Foundry, anvil 31337) → **216 passed, 1 failed, 1 skipped** — identical to baseline; base compiles with the new constants. The 1 failure is `BridgeFuzz::testFuzz_bridgeAmountEdgeCases` (owned by M0-E4). NOTE: `forge:test` requires a fresh `yarn clean-compile` first, else HH701 "multiple artifacts for GeniusDiamond".
  - [x] 5.3 Final counts recorded here and in the commit message.
  - [x] 5.4 Commit the change on `chore/shared-bridge-fixtures` referencing M0-E3 (no merge — owner gate).
