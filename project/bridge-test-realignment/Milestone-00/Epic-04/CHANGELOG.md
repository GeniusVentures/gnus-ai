# Changelog — Epic M0-E4 (fix-foundry-fuzz-bridgeout)

## 2026-06-19 — Foundry bridge fuzz migrated to the bytes32+bool signature

**What changed**
- Added `IGNUSBridgeOut` typed interface + `DEST_CHAIN_ID = 137` to `GeniusDiamondTestBase.sol`; removed the deprecated `TEST_SGNS_DEST` bytes constant.
- Migrated `BridgeFuzz.t.sol` from the dead `bridgeOut(...,bytes)` selector to `bridgeOut(...,bytes32,bool)` via the typed interface:
  - `testFuzz_bridgeAmountEdgeCases` now bridges a real valid amount (was failing on a missing selector).
  - `testFuzz_RevertWhen_depositExceedsBalance` asserts the specific reason `"Insufficient tokens."` (was a false-green).
  - `testFuzz_bridgeDeposit` asserts the balance is burned and `BridgeOutInitiated` is emitted (was a no-op).
  - Removed the obsolete `test_RevertWhen_InvalidDestinationKeyLength` (bytes32 is fixed-length).
- Migrated `GeniusDiamondHandler.handler_bridgeDeposit` to the typed `try/catch` call (success-gated ghost counters preserved); dest chain `1` → `DEST_CHAIN_ID`.

**Result**
- Foundry: **216 passed / 1 failed / 1 skipped → 216 passed / 0 failed / 1 skipped** (total 218 → 217; −1 obsolete test). `forge:test` exit 0.
- Hardhat unaffected (test-only Foundry changes): stays 371 passing / 2 pending / 0 failing.
- No production contract or `scripts/` changes.

**Notes**
- `yarn forge:test` requires a running `anvil` (chain 31337) and a fresh `yarn clean-compile` (else HH701).
- The diamond's `chainID` defaults to 0 in tests, so `DEST_CHAIN_ID = 137` satisfies the same-chain guard without `setChainID`.
