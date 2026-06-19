# Tasks — Fix Foundry Fuzz bridgeOut (M0-E4)

> **PRD:** [prd-e4-fix-foundry-fuzz-bridgeout](./prd-e4-fix-foundry-fuzz-bridgeout.md) ·
> **Epic:** [e4-fix-foundry-fuzz-bridgeout](./overview/e4-fix-foundry-fuzz-bridgeout.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md)

## Relevant Files & Resources

- `test/foundry/fuzz/BridgeFuzz.t.sol` - **Modified.** Migrated to `IGNUSBridgeOut.bridgeOut(...,bytes32,bool)`; real assertions (balance burned, expectEmit, expectRevert); obsolete length test removed.
- `test/foundry/handlers/GeniusDiamondHandler.sol` - **Modified.** `handler_bridgeDeposit` uses the typed `try/catch` bridgeOut; dest chain `1` → `DEST_CHAIN_ID`.
- `test/foundry/base/GeniusDiamondTestBase.sol` - **Modified.** Added `IGNUSBridgeOut` interface + `DEST_CHAIN_ID`; removed deprecated `TEST_SGNS_DEST`.
- `test/utils/bridge-fixtures.ts` - TS counterpart of the constants (reference only; not edited).
- `…/Epic-04/CHANGELOG.md` - **Created.** Epic change log.
- Local `anvil` instance (chain 31337) - required to run `yarn forge:test` (owner gate OP-1).

### Notes

- Prefer asserting the *specific* revert reason (`vm.expectRevert`) over bare `success == false`, so the tests can't regress into false-greens again.
- `yarn forge:test` needs a running `anvil` AND a fresh `yarn clean-compile` first (else HH701 "multiple artifacts for GeniusDiamond").
- Baseline to beat: Foundry **216 passed / 1 failed / 1 skipped**; this epic should make it **0 failed**. Hardhat (371/2/0) must stay unregressed.
- `TEST_SGNS_DEST` may only be deleted after BOTH `BridgeFuzz.t.sol` and `GeniusDiamondHandler.sol` no longer reference it.

## Tasks

- [x] 0.0 Prepare & safeguard
  - [x] 0.1 Created and checked out `chore/fix-foundry-fuzz-bridgeout` off `chore/fix-gas-test-bridgeout`
  - [x] 0.2 Confirmed local `anvil` on :8545 (chain 31337) — owner gate OP-1
  - [x] 0.3 Foundry baseline recorded: **216 passed / 1 failed / 1 skipped** (failure: `BridgeFuzz::testFuzz_bridgeAmountEdgeCases`)

- [x] 1.0 Add a typed `bridgeOut` interface + canonical dest-chain id to the Foundry test base
  - [x] 1.1 Added `interface IGNUSBridgeOut` (bytes32+bool signature) at file scope in `GeniusDiamondTestBase.sol`
  - [x] 1.2 Added `uint256 public constant DEST_CHAIN_ID = 137;` to the base, paired with the TS fixture
  - [x] 1.3 Confirmed by analysis: the diamond's `chainID` defaults to **0** (no init sets it; `setChainID` is `onlySuperAdminRole`), so `DEST_CHAIN_ID = 137 != 0` passes the same-chain guard — no `setChainID` needed
  - [x] 1.4 Compile verified in 4.1 (batched to avoid repeated 2-min builds)

- [x] 2.0 Migrate `BridgeFuzz.t.sol` to the new signature with meaningful assertions (and remove the obsolete length test)
  - [x] 2.1 All bridge calls now `IGNUSBridgeOut(diamond).bridgeOut(amount, GNUS_TOKEN_ID, DEST_CHAIN_ID, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD)`
  - [x] 2.2 `testFuzz_bridgeAmountEdgeCases`: mints enough balance, bounds amount, expects success — passes against a real bridge (verified GNUS id 0 is created at init via `GNUSNFTFactory_Initialize`)
  - [x] 2.3 `testFuzz_RevertWhen_depositExceedsBalance`: `vm.expectRevert("Insufficient tokens.")` before the typed call
  - [x] 2.4 `testFuzz_bridgeDeposit`: asserts balance decreased by `amount`; `vm.expectEmit` (indexed sender) for `BridgeOutInitiated` (event mirrored in the test; full arg matching deferred to M1-E1)
  - [x] 2.5 Deleted `test_RevertWhen_InvalidDestinationKeyLength` (bytes32 is fixed-length)
  - [x] 2.6 Removed the `abi.encodeWithSignature`/`callData` locals

- [x] 3.0 Migrate the invariant handler `GeniusDiamondHandler.sol`, then remove the now-unreferenced `TEST_SGNS_DEST`
  - [x] 3.1 `handler_bridgeDeposit` now uses `try IGNUSBridgeOut(diamond).bridgeOut(...) { ghost++; calls++; } catch {}` (success-gated ghost counters preserved)
  - [x] 3.2 Destination chain `1` → `DEST_CHAIN_ID`; `vm.prank(currentActor)` kept
  - [x] 3.3 Grep confirmed no other `TEST_SGNS_DEST` consumers; deleted the deprecated `bytes` constant from the base
  - [x] 3.4 Compile verified in 4.1

- [x] 4.0 Validate the change (clean-compile + `forge:test` green; no Hardhat regression)
  - [x] 4.1 `yarn clean-compile && yarn forge:test` (anvil) → **216 passed / 0 failed / 1 skipped** (exit 0); `BridgeFuzz` 3/3 green
  - [x] 4.2 Zero `0xf7587f7d` missing-selector calldata in the log — edge case passes for the right reason
  - [x] 4.3 Negative test asserts the specific reason `"Insufficient tokens."` (fails if the reason changes)
  - [x] 4.4 Only `test/foundry/**` changed; no production contract/`scripts` change → Hardhat unaffected (stays 371/2/0)
  - [x] 4.5 Final vs baseline: 218→217 total (−1 obsolete test), 1 failed → **0 failed**

- [x] 5.0 Record the change (CHANGELOG + task file) and commit
  - [x] 5.1 Appended summary to `…/Epic-04/CHANGELOG.md`
  - [x] 5.2 Updated this file's results + Relevant Files
  - [x] 5.3 Staged only E4 files (excluded the owner-gated submodule and the unrelated E2 edit); committed on `chore/fix-foundry-fuzz-bridgeout`
