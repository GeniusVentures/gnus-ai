# Phase 11: ERC-20 Proxy Hardening — Pattern Map

**Mapped:** 2026-08-19
**Scope:** gnus-ai diamond-side ONLY (PROXY-03 redeem adapter). Proxy-side work (PROXY-01/02) is out of scope and lives in the erc20-gnus-proxy workstream.
**Files analyzed:** 4 (1 new facet, 1 modified config, 1 new unit test, 1 optional new invariant test)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `contracts/gnus-ai/GNUSRedeemAdapter.sol` (NEW) | facet (Solidity contract) | request-response (external tx → pull → convert → event) | `contracts/gnus-ai/GNUSTreasury.sol` (facet structure, `convert()` semantics, `supportsInterface` override, Initializable base) | exact |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` (MODIFY) | config | static registration (facets map) | existing entries: `GNUSTreasury` (priority 117) and `GNUSBridge` (priority 115, `3.0.fromVersions`) | exact |
| `test/unit/GNUSRedeemAdapter.test.ts` (NEW) | test (Hardhat + Chai + ethers v6) | request-response (deploy fixture, drive tx, assert events/state/reverts) | `test/unit/GNUSTreasury.test.ts` (LocalDiamondDeployer fixture + convert assertions + limiter/bypass probes) | exact |
| `test/foundry/invariant/RedeemAdapterInvariant.t.sol` (NEW, optional — planner decides) | test (Foundry invariant) | event-driven fuzz (handler calls, ghost vars, invariant_*) | `test/foundry/invariant/BridgeInvariant.t.sol` (most recent invariant pattern, Phase 10) | role-match |

No analog search needed for storage library — Phase 11 does NOT add a new storage library. The adapter is stateless; it composes existing `GNUSNFTFactoryStorage` (read-only) + `GNUSTreasury.convert()` (external self-call). This matches the RESEARCH's "no new accounting" claim.

---

## Pattern Assignments

### `contracts/gnus-ai/GNUSRedeemAdapter.sol` (facet, request-response)

**Primary analog:** `contracts/gnus-ai/GNUSTreasury.sol` (most recent facet added to the diamond, Phase 9)

**Imports pattern** (GNUSTreasury.sol:1-11):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GNUSTreasuryStorage.sol";
import "./GNUSWithdrawLimiterStorage.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
```
For the adapter, the minimal subset is: `Initializable`, `GNUSERC1155MaxSupply` (for `_safeTransferFrom` + `_burn`/`_mint` hooks), `GeniusAccessControl`, `GNUSConstants` (for `GNUS_TOKEN_ID`), `GNUSTreasury` (the type for the `GNUSTreasury(address(this)).convert(...)` self-call). No new storage libraries needed.

**Contract header / inheritance pattern** (GNUSTreasury.sol:13-21):
```solidity
/// @title GNUSTreasury
/// @notice Conversion-native facet for the GNUS ecosystem (Phase 9 - D1/D2/D3/D5/D8).
/// @dev ...
/// @custom:security-contact support@gnus.ai
contract GNUSTreasury is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using GNUSTreasuryStorage for GNUSTreasuryStorage.Layout;
```
Copy this inheritance order exactly. The adapter's `using` directives will only include libraries it actually touches (likely none — the adapter does not own state).

**`supportsInterface` override pattern** (GNUSTreasury.sol:45-56):
```solidity
function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool)
{
    return (ERC1155Upgradeable.supportsInterface(interfaceId) ||
        AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
}
```
Copy verbatim. This is mandatory because the adapter inherits from both ERC1155SupplyUpgradeable (via GNUSERC1155MaxSupply) and AccessControlEnumerableUpgradeable (via GeniusAccessControl).

**Event + revert-reason style** (GNUSTreasury.sol:26-31, 74-79):
```solidity
event Converted(uint256 indexed fromId, uint256 indexed toId, uint256 minionAmount, address indexed to);

function convert(uint256 fromId, uint256 toId, uint256 minionAmount, address to) external {
    address sender = _msgSender();

    require(fromId != toId, "Cannot convert to same id");
    require(minionAmount > 0, "Amount must be greater than zero");
    require(to != address(0), "ERC1155: mint to the zero address");
    // ...
}
```
Adapter pattern: same "indexed ids, indexed recipient" event shape; same trio of input-validation reverts at the top before any state reads. Adapter adds one pre-validation unique to it: `require(childId != GNUS_TOKEN_ID, "Cannot redeem GNUS itself")` (per RESEARCH Pitfall 5).

**Self-call to `convert()` pattern** (NEW — no exact analog; RESEARCH Pattern 1):
```solidity
// In the adapter's redeem():
_safeTransferFrom(_msgSender(), address(this), childId, amount, "");
GNUSTreasury(address(this)).convert(childId, GNUS_TOKEN_ID, amount, recipient);
```
There is NO existing facet in this repo that calls another facet via `FacetType(address(this)).externalFn()`. The planner introduces this pattern for the first time. Reference RESEARCH.md "Pattern 1" for the full rationale (delegatecall msg.sender preservation + `_msgSender()` becomes `address(this)` inside the inner call).

**`_safeTransferFrom` internal call pattern** (GNUSBridge.sol:537 — bridgeOut's burn path uses the same internal helper):
```solidity
// GNUSBridge.sol bridgeOut:
_burn(_msgSender(), id, amount);
// The adapter uses the sibling helper from ERC1155Upgradeable:
_safeTransferFrom(_msgSender(), address(this), childId, amount, "");
```
The `_safeTransferFrom` used here is the internal ERC1155Upgradeable helper, not the external one. It fires `_beforeTokenTransfer` hooks (pause + banned-transferor checks via GNUSERC1155MaxSupply), which is exactly what we want — the pull is subject to the same circuit breakers as every other transfer.

**Diamond-as-recipient caveat** (Pitfall 1, NOT YET RESOLVED):
- `node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol:184` calls `_doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data)` after every safe transfer.
- Lines 461-475 show that when `to` is a contract, it calls `IERC1155ReceiverUpgradeable(to).onERC1155Received(...)` and expects the magic selector back.
- The diamond does NOT currently implement `onERC1155Received`. The planner MUST either (a) verify that the pull path bypasses the check when `to == address(this)` (unlikely — OZ reference doesn't special-case this), or (b) add an `onERC1155Received` implementation returning the magic value (and advertise IERC1155Receiver via `supportsInterface`). See RESEARCH Open Question 1.

---

### `diamonds/GeniusDiamond/geniusdiamond.config.json` (config)

**Primary analog:** existing `GNUSTreasury` entry (most recent facet added at a new major version) + `GNUSBridge` 3.0 entry (most recent facet entry with `fromVersions` migration).

**Facet entry shape — for a NEW facet joining at an existing version** (pattern from `GNUSTreasury`, geniusdiamond.config.json:114-122):
```json
"GNUSTreasury": {
  "priority": 117,
  "versions": {
    "2.6": {
      "deployInit": "GNUSTreasury_Initialize260()",
      "upgradeInit": ""
    }
  }
}
```

**Facet entry shape — for a facet carried forward across versions** (pattern from `GNUSBridge`, geniusdiamond.config.json:99-113):
```json
"GNUSBridge": {
  "priority": 115,
  "versions": {
    "0.0": {},
    "2.5": { "fromVersions": [0.0, 2.4] },
    "2.6": { "fromVersions": [0.0, 2.4, 2.5] },
    "3.0": { "fromVersions": [0.0, 2.4, 2.5, 2.6] }
  }
}
```

**Recommended addition for the adapter** (RESEARCH "Pattern 2" excerpt):
```json
"GNUSRedeemAdapter": {
  "priority": 118,
  "versions": {
    "3.0": {
      "fromVersions": [0.0, 2.4, 2.5, 2.6]
    }
  }
}
```
- Priority 118 sits between `GNUSTreasury` (117) and `GNUSWithdrawLimiter` (120) — matches the convention that higher-priority facets deploy later, and keeps the new facet adjacent to its treasury collaborator.
- The adapter has NO initializer (no state to set up), so neither `deployInit` nor `upgradeInit` keys are present. Compare with `DiamondCutFacet` (priority 10) — also no init.
- `fromVersions` matches `GNUSBridge` 3.0's list exactly (covers all currently-live chain versions per RESEARCH "Pattern 2").

**Pitfall (Pitfall 6 from RESEARCH):** version keys are strings (`"3.0"`); `fromVersions` is an array of unquoted numbers (`[0.0, 2.4, 2.5, 2.6]`). Copy the `GNUSBridge` 3.0 entry character-for-character on this point.

---

### `test/unit/GNUSRedeemAdapter.test.ts` (test, request-response)

**Primary analog:** `test/unit/GNUSTreasury.test.ts` (most recent unit test for a facet that drives `convert()`)

**Imports + suite header pattern** (GNUSTreasury.test.ts:1-45):
```typescript
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Diamond } from '@geniusventures/diamonds';
import {
	loadDiamondContract,
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { debug } from 'debug';
import { JsonRpcProvider } from 'ethers';
import hre, { ethers } from 'hardhat';
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';

chai.use(chaiAsPromised);

describe('GNUS Redeem Adapter Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug('GNUSRedeemAdapter:log:${diamondName}');
	this.timeout(0);
	// ...
});
```
Note: tabs (not spaces) for indentation, single quotes, semicolons — match GNUSTreasury.test.ts style. The `describe` name is a literal grep target for the validation map.

**LocalDiamondDeployer fixture pattern** (GNUSTreasury.test.ts:106-145):
```typescript
before(async function () {
	const config = {
		diamondName: diamondName,
		networkName: networkName,
		provider: provider,
		chainId: (await provider.getNetwork()).chainId,
		writeDeployedDiamondData: false,
		configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
	} as LocalDiamondDeployerConfig;
	const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
	await diamondDeployer.setVerbose(true);
	diamond = await diamondDeployer.getDiamondDeployed();
	// ... load contract, bind signer-connected diamonds:
	//     signer0Diamond = geniusDiamond.connect(signers[0]);
});
```
This same fixture is used in `test/unit/GNUSBridgeIn.test.ts:62-86` with a slightly leaner config shape (`{ diamondName, network: 'hardhat' }`). Either works; the GNUSTreasury variant is what a new test file should copy because it uses the multichain provider map.

**Snapshot isolation pattern** (GNUSTreasury.test.ts:147-155):
```typescript
beforeEach(async function () {
	snapshotId = await provider.send('evm_snapshot', []);
});
afterEach(async () => {
	if (snapshotId) {
		await provider.send('evm_revert', [snapshotId]);
	}
});
```
Mandatory for the adapter test — each test pulls and converts tokens, so state must reset between cases.

**Boot-with-child fixture pattern** (GNUSTreasury.test.ts:184-211):
```typescript
async function bootWithChild(): Promise<bigint> {
	await seedProvenanceIfNeeded();
	await ownerDiamond['mint(address,uint256)'](signer1, toWei('1000'));
	await ownerDiamond['mint(address,uint256)'](owner, toWei('1000'));
	const rate = toWei('2');
	await ownerDiamond.createNFT(
		GNUS_TOKEN_ID, 'Child', 'CHLD', rate, toWei('1000000'), 'ipfs://child',
	);
	const childId = 1n;
	await ownerDiamond['mint(address,uint256,uint256,bytes)'](
		signer1, childId, toWei('100'), '0x',
	);
	return childId;
}
```
The adapter test needs an analogous fixture, PLUS one extra step unique to it: `signer0Diamond.setApprovalForAll(diamondAddress, true)` (or `setApprovalForAll(proxyAddress, true)` for the two-hop model) so the pull has an operator approval.

**Event + revert assertion pattern** (GNUSTreasury.test.ts:235-237, 224-279):
```typescript
await expect(signer1Diamond.convert(childId, GNUS_TOKEN_ID, toWei('30'), signer1))
	.to.emit(geniusDiamond, 'Converted')
	.withArgs(childId, GNUS_TOKEN_ID, toWei('30'), signer1);

// For library-declared events that aren't in the diamond ABI (SuperAdminBypass):
const bypassTx = await ownerDiamond.convert(childId, GNUS_TOKEN_ID, toWei('10'), owner);
const bypassReceipt = await bypassTx.wait();
const bypassTopic = ethers.id('SuperAdminBypass(address,uint256,string)');
const bypassLog = bypassReceipt!.logs.find((log) => log.topics[0] === bypassTopic);
expect(bypassLog, 'SuperAdminBypass event not emitted').to.not.be.undefined;
```
The adapter test will use BOTH: `.to.emit(geniusDiamond, 'Converted')` (existing event from `convert()`), `.to.emit(geniusDiamond, 'RedeemedViaAdapter')` (new event), AND the raw-topic pattern if it needs to assert `SuperAdminBypass` (because that event lives in `GNUSWithdrawLimiterStorage` library and is absent from the diamond ABI).

**Revert matrix style** (GNUSTreasury.test.ts:266-279 is happy-path; revert tests use `chai-as-promised`'s `revertedWith`):
```typescript
await expect(
	signer1Diamond.redeem(GNUS_TOKEN_ID, toWei('10'), signer1),
).to.be.revertedWith('Cannot redeem GNUS itself');
```
Match revert strings EXACTLY against the adapter source. The plan's verification map will grep these suite names.

---

### `test/foundry/invariant/RedeemAdapterInvariant.t.sol` (test, event-driven fuzz) — OPTIONAL

**Primary analog:** `test/foundry/invariant/BridgeInvariant.t.sol` (Phase 10 invariant — most recent)

**Skeleton pattern** (BridgeInvariant.t.sol:1-80):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

contract RedeemAdapterInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    function setUp() public override {
        super.setUp();
        // Seed provenance counter (idempotent, mirrors ConservationInvariant.setUp)
        vm.prank(owner);
        (bool seeded, ) = diamond.call(
            abi.encodeWithSignature("GNUSTreasury_SetSeedSupply(uint256)", uint256(0))
        );
        if (!seeded) {
            console.log("[SETUP] Provenance already initialized on fork; continuing");
        }
        handler = new GeniusDiamondHandler();
        handler.setUp();
        // ... adapter-specific setup: create child id, mint to handler actors, approve diamond ...
    }

    // invariant_supplyConservedUnderRedeem: total child burned via adapter == total GNUS minted to recipients
    // invariant_noAdapterCallsWhenNonConvertible: ghost_redeemSuccesses for nonConvertible ids == 0
    // afterInvariant: assert ghost_redeemCalls > 0 (coverage guard, BridgeInvariant.t.sol T-10-F01 pattern)
}
```

**Caveat:** the planner may decide this invariant is redundant with the existing `ConservationInvariant.t.sol` (since the adapter just routes through `convert()`, which is already conservation-invariant). Default to NOT writing it unless the plan explicitly calls for it — RESEARCH flags it as "(optional, planner decides)".

---

## Shared Patterns

### Diamond facet `supportsInterface` (mandatory on every facet that touches ERC1155 or AccessControl)
**Source:** `contracts/gnus-ai/GNUSTreasury.sol:45-56` (and identically in `GNUSBridge.sol:98-110`)
**Apply to:** `GNUSRedeemAdapter.sol`
```solidity
function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool)
{
    return (ERC1155Upgradeable.supportsInterface(interfaceId) ||
        AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
}
```
If the adapter implements `onERC1155Received` (RESEARCH Open Question 1), this `supportsInterface` must ALSO return true for `type(IERC1155ReceiverUpgradeable).interfaceId` — add a clause for it.

### Validation-then-act ordering (CEI)
**Source:** `contracts/gnus-ai/GNUSTreasury.sol:74-113`
**Apply to:** `GNUSRedeemAdapter.redeem`
Pattern: (1) all `require()` input checks, (2) all storage reads, (3) all state changes / external calls. The adapter does NOT introduce reentrancy risk beyond what `convert()` already has (RESEARCH "Don't Hand-Roll" table), but the ordering discipline is the same.

### `_msgSender()` instead of `msg.sender`
**Source:** every external function in `GNUSTreasury.sol` and `GNUSBridge.sol`
**Apply to:** `GNUSRedeemAdapter.redeem`
Always `address sender = _msgSender();` at the top of the external function. Never `msg.sender` directly. Required because the codebase inherits from `ContextUpgradeable` and the diamond pattern delegates through it.

### Revert-reason strings are part of the ABI contract
**Source:** `GNUSTreasury.sol:77-90`, `GNUSBridge.sol` (all requires), and `test/unit/GNUSTreasury.test.ts` (which uses `revertedWith(...)` assertions)
**Apply to:** `GNUSRedeemAdapter.sol` AND its test
Tests will assert exact strings; do not paraphrase. RESEARCH Pitfall 5 names the exact string `"Cannot redeem GNUS itself"` for the `childId == GNUS_TOKEN_ID` guard.

### Diamond cut version key stringification
**Source:** `diamonds/GeniusDiamond/geniusdiamond.config.json:99-113` (GNUSBridge entry)
**Apply to:** the config edit
- Top-level `versions` keys: quoted strings (`"3.0"`).
- `fromVersions` array: unquoted numbers (`[0.0, 2.4, 2.5, 2.6]`).
- Mixing these breaks the deployer (RESEARCH Pitfall 6).

### Test fixture idempotence
**Source:** `test/unit/GNUSTreasury.test.ts:164-175` (`seedProvenanceIfNeeded` storage-slot probe)
**Apply to:** the adapter test's before-block
The diamond fixture is cached across suites in the same process. Any one-shot initializer (like `GNUSTreasury_SetSeedSupply`) must be guarded by a storage probe so re-runs against a cached diamond don't revert. The adapter test should reuse the `TREASURY_STORAGE_SLOT` + `eth_getStorageAt` pattern verbatim.

### Event declared in a library → assert via raw topic, not `.to.emit`
**Source:** `test/unit/GNUSTreasury.test.ts:262-276` (`SuperAdminBypass` assertion)
**Apply to:** the adapter test's limiter-bypass test case
`SuperAdminBypass` lives in `GNUSWithdrawLimiterStorage` (library), so it is absent from the diamond ABI. Chai's `.to.emit` will not find it; use `receipt.logs.find(log => log.topics[0] === ethers.id('SuperAdminBypass(address,uint256,string)'))`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All four files have strong in-repo analogs. The only GENUINELY new pattern is the `this.convert(...)` self-call (RESEARCH Pattern 1) — no existing facet does this; the planner introduces it. Reference RESEARCH.md "Architecture Patterns — Pattern 1" directly for that block. |

---

## Metadata

**Analog search scope:**
- `contracts/gnus-ai/*.sol` (21 files scanned; 4 strong matches: GNUSTreasury, GNUSBridge, GNUSBridgeValidatorStorage, ERC1155ProxyOperator)
- `test/unit/*.test.ts` (18 files scanned; 2 strong matches: GNUSTreasury.test.ts, GNUSBridgeIn.test.ts)
- `test/foundry/invariant/*.t.sol` (9 files scanned; 1 strong match: BridgeInvariant.t.sol)
- `diamonds/GeniusDiamond/geniusdiamond.config.json` (read in full)
- `node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol` (read for `_doSafeTransferAcceptanceCheck` behavior — RESEARCH Open Question 1)

**Files scanned:** 51
**Pattern extraction date:** 2026-08-19
