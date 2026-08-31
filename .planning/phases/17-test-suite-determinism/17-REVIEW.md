---
phase: 17-test-suite-determinism
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - test/deployment/GeniusDiamondDeployment.test.ts
  - test/foundry/invariant/AccessControlInvariant.t.sol
  - test/foundry/unit/SafeDiamondCut.t.sol
  - test/foundry/unit/SafeSingleShotUpgrade.t.sol
  - test/gas/withdraw-limiter-gas-comparison.test.ts
  - test/integration/erc1155-transfer-hook-limiter.test.ts
  - test/integration/erc20-transfer-batch-limiter.test.ts
  - test/integration/withdraw-limiter-integration.test.ts
  - test/unit/DiamondInitFacet-limiter.test.ts
  - test/unit/ERC1155ProxyOperator.test.ts
  - test/unit/ERC20TransferBatch.test.ts
  - test/unit/GNUSBridge.test.ts
  - test/unit/GNUSBridgeAttestorIn.test.ts
  - test/unit/GNUSBridgeAttestorUpgrade.test.ts
  - test/unit/GNUSBridgeEnhanced.test.ts
  - test/unit/GNUSBridgeIn.test.ts
  - test/unit/GNUSContractAssets.test.ts
  - test/unit/GNUSControlStorage.test.ts
  - test/unit/GNUSLicensing.test.ts
  - test/unit/GNUSLifecycleAICredits.test.ts
  - test/unit/GNUSLifecycleSettle.test.ts
  - test/unit/GNUSLifecycleUpgrade.test.ts
  - test/unit/GNUSNFTFactoryEnhanced.test.ts
  - test/unit/GNUSRedeemAdapter.test.ts
  - test/unit/GNUSTreasury.test.ts
  - test/unit/GNUSWithdrawLimiter.test.ts
  - test/unit/GNUSWithdrawLimiterStorage.test.ts
  - test/unit/GeniusOwnershipFacet.test.ts
  - test/unit/NFTFactory.test.ts
  - test/utils/diamond-baseline.ts
  - test/utils/test-template.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Reviewed the TEST-04/05/06 determinism changes: the new `ensureDiamondTestBaseline()` helper (`test/utils/diamond-baseline.ts`), its wiring into 26 Hardhat suites plus the template, the `AccessControlInvariant` re-target to `attacker`, and the `vm.skip` fork-dependency declarations in both Safe setUp()s.

**Verified sound (no defects found):**

- **D-01 (invariant re-target).** `attacker` is `makeAddr("attacker")` in `GeniusDiamondTestBase.sol:97` and is outside `GeniusDiamondHandler.actors` (`[address(this), user1, user2, user3]`, handler `:81-88`). Every handler function that can grant (`handler_grantRole` `:535`, `handler_revokeRole` `:587`) selects its target as `actors[targetSeed % actors.length]` — no handler function takes a raw address parameter. The assertion at `AccessControlInvariant.t.sol:278` is now unfalsifiable by any fuzz sequence, and the stale `:257` comment is corrected. `user3` is still consumed by the base/handler, so no dead variable was left in this file.
- **D-04 (Safe setUp skips).** `vm.skip(bool, string)` exists in the vendored forge-std (`lib/forge-std/src/Vm.sol:2540`); in both files it is the first statement of `setUp()` before any state mutation, probing `SAFE_PROXY_FACTORY.code.length` (canonical Sepolia factory `0xC228...10BC`). The skip arithmetic in the phase ledger (3→5, one reason-bearing skip per contract) matches the recorded observed runs.
- **Baseline ordering.** All 26 suite call sites precede their first `evm_snapshot` (verified per-file). Bridge suites re-alias correctly: `GNUSBridgeIn.test.ts` baseline `:256` → `setChainID(31337)` `:263` → snapshot `:272`; `GNUSBridgeAttestorIn.test.ts` `:393` → `:400` → `:410`. The 7 multichain-shape suites all rebind `ethersMultichain.provider = provider` before the baseline call, so the helper's probe and writes currently target the same network. No unused imports were left behind by the guard deletions.
- **Intentional boundaries honored.** The 8 shared-diamond suites without a baseline call (`Erc20Batch`, `GNUSBridgePolicy`, `GNUSERC20`, `GNUSLifecycle`, `GNUSLifecyclePolicy`, `GNUSNFTFactoryAntiScalping`, `Phase5-circuit-breaker`, `TransferHelper`) are the explicit operator scope ruling at `17-03-PLAN.md:110`, and grep confirms none of them read `protocolInfo`/`totalSupplyOfAll`/diamond `chainID` — no defect. GNUSTreasury's remaining test-body `SetSeedSupply` calls and `GNUSControlStorage.test.ts:408`'s own `setChainID(0)` are the documented non-folded boundaries.

Two warnings remain: a fragile ambient-provider probe in the shared helper, and a silent coverage loss in GNUSTreasury's provenance tests caused by the baseline seeding.

## Critical Issues

None found.

## Warnings

### WR-01: Baseline helper probes storage via ambient `ethers.provider` instead of the passed contract's provider

**File:** `test/utils/diamond-baseline.ts:37`
**Issue:** The `eth_getStorageAt` probe is sent through the module-global `ethers.provider` (from `import { ethers } from 'hardhat'`), while the two state-changing calls (`setChainID`, `updateBridgeFee`) go through the passed `geniusDiamond` instance. The helper is therefore only correct when `hre.ethers.provider` happens to point at the network that owns `diamondAddress`. Today that invariant is satisfied by convention — every multichain suite performs the `ethersMultichain.provider = provider as any` mutation *before* calling the helper (verified in all 7 multichain-shape suites and the template) — but nothing in the helper enforces it. A suite that calls the helper with a diamond address on a non-default network before (or without) that mutation will probe the wrong chain: the guard reads an empty slot, concludes "uninitialized", and `GNUSTreasury_SetSeedSupply(0n)` then reverts with "Already initialized" on the real chain, failing the suite's `before()` for a reason unrelated to the suite's own logic. The old per-suite guards probed via each suite's own `provider` variable, so this coupling is new with the helper.
**Fix:** Derive the provider from the passed contract instead of the ambient module state:

```ts
async function ensureDiamondTestBaseline(
	geniusDiamond: GeniusDiamond,
	diamondAddress: string,
): Promise<void> {
	const provider = geniusDiamond.runner?.provider;
	if (!provider) {
		throw new Error('ensureDiamondTestBaseline: contract has no provider runner');
	}
	const initialized = await provider.send('eth_getStorageAt', [
		diamondAddress,
		ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
	]);
	// ... unchanged
}
```

This makes probe and writes share one provider by construction.

### WR-02: Baseline seeding makes GNUSTreasury's pre-seed assertion branches unreachable — silent coverage loss

**File:** `test/unit/GNUSTreasury.test.ts:151` (cause), `:452-493` (effect)
**Issue:** The new `ensureDiamondTestBaseline()` at `:151` seed-initializes the shared diamond *before* the first snapshot whenever the provenance slot is zero — in both standalone and full-suite runs. Consequently, inside every test the probe at `:460`/`:478` now always observes `initialized != 0`, and the `if (BigInt(initialized) === 0n)` branches are dead code:

- `:464-467` — the assertion that `totalSupplyOfAll()` reverts with `'Global supply not initialized'` can no longer execute; the test silently falls into the `gte(0n)` else-branch every run.
- `:482-487` — the assertions that `GNUSTreasury_SetSeedSupply(0n)` emits `GlobalSupplyInitialized(0n, owner)` and yields `totalSupplyOfAll() == 0` are likewise unreachable; the one-shot success path is no longer asserted anywhere in the suite.

Before this phase, a standalone run of GNUSTreasury reached those branches (its `before()` did not seed). The adaptive if/else keeps the tests green, masking the regression — the suite now verifies strictly less about the provenance lifecycle while reporting pass. The comment at `:454` ("provenanceInitialized == false after evm_revert") is also stale: after the baseline, no revert in this suite can ever restore an uninitialized provenance slot.
**Fix:** Restore the pre-seed semantics locally in the two affected tests using the Hardhat test-only cheat (no production change), e.g.:

```ts
it('totalSupplyOfAll reverts pre-seed', async function () {
	// Simulate a never-seeded diamond: zero provenanceInitialized (base slot + 1)
	// and globalSupply (base slot) — the suite baseline seeds both in before().
	await provider.send('hardhat_setStorageAt', [
		diamondAddress,
		ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
		'0x' + '0'.repeat(64),
	]);
	await expect(geniusDiamond.totalSupplyOfAll()).to.be.revertedWith(
		'Global supply not initialized',
	);
});
```

Apply the same slot-reset at the top of the `Initialize260 seeds globalSupply...` test (`:475-493`) so the emit/args assertions execute again, and update the `:454` comment to state that pre-seed state must be synthesized via `hardhat_setStorageAt` because the suite baseline seeds in `before()`.

## Info

### IN-01: Dead owner-fallback branch and no-op statement in deployment suite scaffold

**File:** `test/deployment/GeniusDiamondDeployment.test.ts:99-104`
**Issue:** `owner = diamond.getDeployedDiamondData().DeployerAddress!;` uses a non-null assertion, making the following `if (!owner)` fallback unreachable; inside that dead branch, the bare `ownerSigner;` statement (`:103`) is a no-op expression. Pre-existing, adjacent to the new baseline call at `:110`.
**Fix:** Drop the `!` (use `|| ''` as sibling suites do) so the fallback is live, and delete the `ownerSigner;` line.

### IN-02: Template crashes when `test-multichain` is passed without a `--chains` value

**File:** `test/utils/test-template.ts:48-49`
**Issue:** `process.argv[process.argv.indexOf('--chains') + 1].split(',')` dereferences index `indexOf(...) + 1` without a presence/bounds check; running `yarn test-multichain` with a missing `--chains` argument yields `undefined.split(...)` and a TypeError instead of a clear error. Pre-existing; every suite copied from the template inherits it.
**Fix:**

```ts
const chainsIdx = process.argv.indexOf('--chains');
const chainsArg = chainsIdx >= 0 ? process.argv[chainsIdx + 1] : undefined;
const networkNames = (chainsArg || '').split(',').filter(Boolean);
```

### IN-03: Template placeholder tests assert `true` and always pass

**File:** `test/utils/test-template.ts:167,181`
**Issue:** `assert(true, 'Test not implemented')` is vacuous — a suite scaffolded from the template without replacing the placeholders reports green tests that verify nothing. This affects test reliability silently, which is the failure mode this phase exists to eliminate.
**Fix:** Use `assert.fail('Test not implemented')` or declare the placeholders with `it.skip(...)` so an unmodified copy cannot pass.

### IN-04: Stale scaffold comment references the deleted treasury-seed probe

**File:** `test/unit/GNUSBridgeIn.test.ts:49`
**Issue:** The file-header scaffold description still reads "Scaffold (LocalDiamondDeployer / treasury-seed probe / setChainID / snapshot isolation ...)", but the treasury-seed probe was removed from this file and folded into `ensureDiamondTestBaseline()` (now called at `:256`). The comment misdirects the next maintainer to a pattern that no longer exists here (the file's own lockstep instruction at `:50-51` says to keep `GNUSBridgeAttestorIn.test.ts` in sync with this shape).
**Fix:** Update the header to "Scaffold (LocalDiamondDeployer / ensureDiamondTestBaseline / setChainID re-alias / snapshot isolation / random attestor wallets + tree)".

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
