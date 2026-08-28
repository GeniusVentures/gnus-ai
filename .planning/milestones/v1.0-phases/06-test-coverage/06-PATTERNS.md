# Phase 6: Test Coverage - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 4 (3 modified, 1 deleted)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `test/foundry/fuzz/ExampleFuzz.t.sol` (DELETE) | test (foundry fuzz scaffolding) | fuzz | `test/foundry/fuzz/NFTFactoryFuzz.t.sol` (1 of 12 real siblings) | n/a — file is being removed, not written |
| `test/unit/NFTFactory.test.ts` (modify lines 371, 375, 522-525) | test (hardhat unit, mocha/chai) | request-response via diamond proxy | self — existing assertions at lines 383-386, 502-504, 546-548 in the same file | exact (in-file) |
| `contracts/gnus-ai/GNUSControl.sol` (add `getBannedTransferor` view) | facet (diamond) | request-response (view) | `isEmergencyPaused()` in same file, lines 84-89 | exact (in-file) |
| `test/unit/GNUSControlStorage.test.ts` (extend with getter tests) | test (hardhat unit, mocha/chai) | request-response via diamond proxy | existing `describe('Global banned transferors')` block, lines 128-178 of same file | exact (in-file) |

## Pattern Assignments

### `test/foundry/fuzz/ExampleFuzz.t.sol` (DELETE — no analog to copy)

**Action:** `git rm test/foundry/fuzz/ExampleFuzz.t.sol`. All five `testFuzz_*` functions are stubs that call `assertTrue(true, "Replace with actual fuzz test")`. Real fuzz coverage already exists in 12 sibling files (AccessControlFuzz, BridgeFuzz, DiamondAccessControl, DiamondCoreFuzz, DiamondInvariants, DiamondOwnership, DiamondRouting, ERC1155Fuzz, ERC20Fuzz, GNUSWithdrawLimiterFuzz, NFTFactoryFuzz, SecurityFuzz).

No code pattern to copy — file is being deleted.

---

### `contracts/gnus-ai/GNUSControl.sol` — add `getBannedTransferor` view

**Analog:** `isEmergencyPaused()` in the same file (lines 84-89).

**Imports pattern** (lines 1-10 — already in place, no new imports needed):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./GNUSConstants.sol";
import "./GNUSControlStorage.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
import "./GNUSBridge.sol";
```

**Library-using directive** (line 20 — already in place, makes `GNUSControlStorage.isBannedTransferor` callable on the layout):
```solidity
using GNUSControlStorage for GNUSControlStorage.Layout;
```

**View getter pattern to copy** (lines 84-89, the closest in-facet analog — Doxygen header, `external view returns (bool)`, single delegation to storage library):
```solidity
/**
 * @notice Returns whether the diamond is currently emergency-paused.
 */
function isEmergencyPaused() external view returns (bool) {
    return GNUSControlStorage.layout().paused;
}
```

**Internal library target the new getter delegates to** (`contracts/gnus-ai/GNUSControlStorage.sol` lines 45-53):
```solidity
/**
 * @notice Checks if a transferor is banned for a specific token ID.
 * @param tokenId The ID of the token.
 * @param sender The address of the transferor.
 * @return bool True if the transferor is banned, otherwise false.
 */
function isBannedTransferor(uint256 tokenId, address sender) internal view returns (bool) {
    return layout().gBannedTransferors[sender] || layout().bannedTransferors[tokenId][sender];
}
```

**New function skeleton** (planner instantiates; mirrors `isEmergencyPaused` Doxygen + naming, but takes the two args and calls the library `internal view` directly):
```solidity
/**
 * @notice Returns whether an address is banned from transferring a given token ID.
 * @dev Delegates to GNUSControlStorage.isBannedTransferor; checks both the
 *      global ban map (gBannedTransferors) and the per-token ban map
 *      (bannedTransferors[tokenId]). Passing GNUS_TOKEN_ID (0) is the
 *      caller-side convention for querying global-ban status.
 * @param tokenId The ID of the token (0 = GNUS, used as the global-ban check).
 * @param transferor The address to check.
 * @return bool True if the transferor is banned, otherwise false.
 */
function getBannedTransferor(uint256 tokenId, address transferor) external view returns (bool) {
    return GNUSControlStorage.layout().isBannedTransferor(tokenId, transferor);
}
```

**Placement convention:** put it next to the other view functions (`isEmergencyPaused` at line 87, `protocolInfo` at line 172). Do not gate behind `onlySuperAdminRole` — view getters on this facet are unauthenticated.

**No access guard pattern** (views on GNUSControl are unauthenticated — confirmed by `isEmergencyPaused` and `protocolInfo`).

---

### `test/unit/GNUSControlStorage.test.ts` — extend with getter tests (D-06)

**Analog:** the existing `describe('Global banned transferors')` and `describe('Token-specific banned transferors')` blocks in the same file (lines 128-259). The new getter tests should be added as a new `describe('getBannedTransferor view', ...)` block within this file — the file already sets up the diamond deployment, snapshots, signers, and constants the tests need.

**Imports pattern** (lines 1-8 — already in place, no new imports needed):
```typescript
import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';
```

**Diamond deployment fixture pattern** (lines 26-62 — reused as-is, do not duplicate):
```typescript
before(async function () {
	const signers = await hre.ethers.getSigners();
	owner = signers[0]; // Owner has SUPER_ADMIN_ROLE by default
	user1 = signers[1];
	user2 = signers[2];
	user3 = signers[3];

	const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
	const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
	const diamond = await diamondDeployer.getDiamondDeployed();
	const deployedDiamondData = diamond.getDeployedDiamondData();
	const diamondAddress = deployedDiamondData.DiamondAddress || '';

	geniusDiamond = await loadDiamondContract<GeniusDiamond>(
		diamond,
		diamondAddress,
		hre.ethers,
	);

	initialSnapshotId = await hre.network.provider.send('evm_snapshot');
});

beforeEach(async function () {
	snapshotId = await hre.network.provider.send('evm_snapshot');
});

afterEach(async function () {
	await hre.network.provider.send('evm_revert', [snapshotId]);
});
```

**Constants already declared** (lines 20-24 — reuse in new tests):
```typescript
const SUPER_ADMIN_ROLE =
	'0x0000000000000000000000000000000000000000000000000000000000000000';
const GNUS_TOKEN_ID = 0;
const NFT_TOKEN_ID_1 = 1;
const NFT_TOKEN_ID_2 = 2;
```

**Ban/allow call pattern the getter tests assert against** (lines 128-163, 180-240 — setters used to drive state):
```typescript
// Global ban:
await geniusDiamond.banTransferorForAll(await user1.getAddress());
await geniusDiamond.allowTransferorForAll(await user1.getAddress());

// Per-token ban (batch):
const tokenIds = [NFT_TOKEN_ID_1];
const addresses = [await user1.getAddress()];
await geniusDiamond.banTransferorBatch(tokenIds, addresses);
await geniusDiamond.allowTransferorBatch(tokenIds, addresses);
```

**Assertion pattern for the new getter** (modeled on `protocolInfo` reads at lines 65-89 — direct `expect` against a scalar return):
```typescript
it('should report banned address via tokenId 0 (global ban)', async function () {
	const addr = await user1.getAddress();
	expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(false);
	await geniusDiamond.banTransferorForAll(addr);
	expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(true);
	await geniusDiamond.allowTransferorForAll(addr);
	expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(false);
});
```

**Required test coverage per D-06** (planner expands into a `describe('getBannedTransferor view', ...)` block):
1. banned via `banTransferorBatch` for a specific tokenId → `getBannedTransferor(tokenId, addr) === true`, other tokenIds return `false`
2. allowed again via `allowTransferorBatch` → returns `false`
3. global ban via `banTransferorForAll` is visible via `getBannedTransferor(0, addr)` AND via any other tokenId (because `isBannedTransferor` ORs the global map)
4. batch ban/allow round-trips across multiple `(tokenId, address)` pairs

**Note on diamond ABI regeneration:** the existing tests already call `geniusDiamond.protocolInfo()` etc. against the diamond-typechain-types `GeniusDiamond` interface. After adding `getBannedTransferor` to `GNUSControl.sol`, the planner must run `yarn compile` (which invokes `diamond:generate-proxy-abi-typechain` and `diamond:generate-gnus-abi-typechain` per `package.json:9`) so the new selector appears in `diamond-typechain-types/GeniusDiamond.ts`. No additional script is required — the existing `compile` target handles ABI + typechain regeneration.

---

### `test/unit/NFTFactory.test.ts` — complete 2nd-gen assertions (D-02)

**Analog:** existing assertions inside the same `it(...)` blocks (lines 383-386 for supply-delta, lines 502-504 for balance checks). Use the same `assert` style (`assert(value === expected, 'message')`) for consistency with the surrounding code.

**File context — imports already in place** (lines 1-21):
```typescript
import { assert, expect } from 'chai';
// ...
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
```

**Line 371 — success assertion pattern.** The surrounding code already calls `await logEvents(tx)` where `tx` is a `ContractTransactionResponse`. The minimal addition is a receipt-status check using the pattern standard in ethers v6 + hardhat:
```typescript
// Line 371 replacement (current: "// TODO This needs an assert to check the transaction is successful.")
const receipt = await tx.wait();
assert(receipt !== null && receipt.status === 1, 'Child NFT mint transaction should succeed');
```

**Line 375 — split into its own `it()` test.** Per D-02, the supply-delta block (currently lines 375-389) is moved out of the parent test into its own `it('Should burn correct GNUS supply for 2nd gen child NFT mint', ...)` test. The structure to copy is the surrounding `it(...)` blocks (e.g., line 393 `'Should reject NFT Factory to mint child NFTs of Addr1 Token with Access deficient Signer'`).

**Lines 522-525 — assert current (no-burn) behavior.** The commented-out burn assertion is replaced with an explicit assertion of current behavior:
```typescript
// NOTE: GNUSNFTFactory does not currently burn GNUS for 2nd gen child tokens.
// Phase 9 (Treasury/Reserve) will replace this with explicit reserve accounting
// and restore the burn invariant.
assert(
	burntSupply === 0n,
	`2nd gen child mint should not burn GNUS (Phase 9 will change this), but burnt ${utils.formatEther(burntSupply)}`,
);
```

**BigInt literal convention:** the file already uses `50n`, `1n`, `0n` (lines 502-504, 546-548) — continue with `0n` for the burn assertion. Use `BigInt(burntSupply) === toWei(...)` (line 384) when comparing against `toWei(...)` results.

**No new helpers or fixtures** are required — both edits operate inside the existing `for (const [networkName, provider] of networkProviders.entries())` loop and use `geniusDiamond`, `signer1Diamond`, `startingSupply`, etc. that are already in scope.

---

## Shared Patterns

### Diamond deployment fixture for unit tests
**Source:** `test/unit/GNUSControlStorage.test.ts` lines 26-62 (also `test/unit/NFTFactory.test.ts` lines 47+)
**Apply to:** any new hardhat unit test that needs the GeniusDiamond proxy. Not needed in this phase — both target test files already have the fixture.

### Diamond ABI + typechain regeneration
**Source:** `package.json` line 9
**Apply to:** the `GNUSControl.sol` change. After editing the facet, run `yarn compile` — it chains `npx hardhat compile` → `diamond:generate-proxy-abi-typechain` → `diamond:generate-gnus-abi-typechain`, refreshing `diamond-typechain-types/GeniusDiamond.ts` so `geniusDiamond.getBannedTransferor(...)` is typed and callable in tests.
```json
"compile": "npx hardhat compile && yarn diamond:generate-proxy-abi-typechain && yarn diamond:generate-gnus-abi-typechain",
```

### Facet view-function convention
**Source:** `contracts/gnus-ai/GNUSControl.sol` lines 84-89 and 166-176
**Apply to:** `getBannedTransferor`. Views on this facet are `external view`, unauthenticated, Doxygen-headed, and delegate to `GNUSControlStorage.layout()` (or its `internal view` helpers via the `using ... for` directive at line 20).

### BigInt / chai assertion style in this repo
**Source:** `test/unit/NFTFactory.test.ts` lines 383-386, 502-504; `test/unit/GNUSControlStorage.test.ts` lines 65-89
**Apply to:** both test-file edits. Use `assert(x === y, 'msg')` for BigInt comparisons (NFTFactory file) and `expect(await geniusDiamond.foo()).to.equal(bar)` for scalar reads (ControlStorage file). Do not mix `.eq(...)` (ethers v5 BN style — commented-out at lines 524-525) with native BigInt.

## No Analog Found

None — every file in this phase has an in-file or in-directory exact analog.

## Metadata

**Analog search scope:**
- `contracts/gnus-ai/GNUSControl.sol`, `contracts/gnus-ai/GNUSControlStorage.sol`, `contracts/gnus-ai/GNUSBridge.sol`, `contracts/gnus-ai/GNUSWithdrawLimiter.sol`
- `test/unit/GNUSControlStorage.test.ts`, `test/unit/NFTFactory.test.ts`
- `test/foundry/fuzz/` (12 sibling files)
- `package.json` scripts

**Files scanned:** 8 source/test files + directory listings
**Pattern extraction date:** 2026-07-21
