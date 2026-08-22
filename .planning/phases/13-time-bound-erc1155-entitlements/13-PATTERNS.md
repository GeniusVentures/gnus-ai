# Phase 13: Time-Bound ERC-1155 Entitlements - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** 14 (8 new, 6 modified)
**Analogs found:** 14 / 14 (all files have strong in-repo analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `contracts/gnus-ai/GNUSLifecycle.sol` (NEW) | facet (diamond) | request-response + state-transition | `contracts/gnus-ai/GNUSRedeemAdapter.sol` | exact (facet + setter + burn/mint pair) |
| `contracts/gnus-ai/GNUSLifecycleStorage.sol` (NEW) | storage library | CRUD (mapping) | `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` | exact (per-account mapping + diamond storage pattern) |
| `contracts/gnus-ai/interfaces/ICredentialVerifier.sol` (NEW) | interface (plug-in) | request-response (external call) | `contracts/mocks/MockRedeemCaller.sol` (interface decl style) | role-match |
| `contracts/gnus-ai/interfaces/IAllowlistRegistry.sol` (NEW) | interface (plug-in) | request-response (external call) | `contracts/mocks/MockRedeemCaller.sol` (interface decl style) | role-match |
| `contracts/gnus-ai/testing/MockCredentialVerifier.sol` (NEW) | test mock | request-response (reentrant) | `contracts/mocks/MockRedeemCaller.sol` | exact (mock holder + diamond driver) |
| `contracts/gnus-ai/testing/MockAllowlistRegistry.sol` (NEW) | test mock | request-response | `contracts/mocks/MockRedeemCaller.sol` | exact |
| `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (MOD — struct append) | storage library | CRUD (struct) | existing file (Phase 9 D5/D7 appends at +7/+8) | exact (same file, append-only pattern) |
| `contracts/gnus-ai/GNUSNFTFactory.sol` (MOD — beforeMint anti-scalping) | facet (diamond) | request-response + CEI | existing file (`beforeMint` at lines 87-96) | exact (in-place extension) |
| `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` (MOD — predicate insertion) | facet (diamond) | request-response (hook) | existing file (`_beforeTokenTransfer` at lines 32-85) | exact (in-place extension) |
| `contracts/gnus-ai/GNUSBridge.sol` (MOD — bridgeOut policy) | facet (diamond) | request-response + burn | existing file (`bridgeOut` at lines 228-267) | exact (in-place extension) |
| `test/unit/GNUSLifecycle.test.ts` (NEW) | test (unit) | request-response | `test/unit/GNUSTreasury.test.ts` | exact (LocalDiamondDeployer boot, multichain fixture) |
| `test/unit/GNUSLifecycleUpgrade.test.ts` (NEW) | test (upgrade/decode) | file-I/O (storage slot) | `test/unit/GNUSTreasury.test.ts` lines 884-934 | exact (legacy decode + `hardhat_setStorageAt`) |
| `test/unit/GNUSNFTFactoryAntiScalping.test.ts` (NEW) | test (unit + mock) | request-response + reentrancy | `test/unit/GNUSRedeemAdapter.test.ts` + `contracts/mocks/MockRedeemCaller.sol` | role-match |
| `test/foundry/invariant/LifecycleInvariant.t.sol` (NEW) | test (invariant) | event-driven (fuzz) | `test/foundry/invariant/ConservationInvariant.t.sol` | exact (GeniusDiamondTestBase + Handler + ghost sums) |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` (MOD) | config | static | existing `GNUSRedeemAdapter` entry at lines 120-127 | exact (facet add + priority + fromVersions) |

---

## Pattern Assignments

### `contracts/gnus-ai/GNUSLifecycle.sol` (NEW facet)

**Analog:** `contracts/gnus-ai/GNUSRedeemAdapter.sol` (entire file, 127 lines)

**Imports pattern** (lines 1-11):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Storage.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GNUSWithdrawLimiterStorage.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
```

**Facet declaration pattern** (line 24):
```solidity
contract GNUSRedeemAdapter is GNUSERC1155MaxSupply, GeniusAccessControl, IERC1155ReceiverUpgradeable {
```
`GNUSLifecycle` follows the same shape: inherits `GNUSERC1155MaxSupply` (for `_burn`/`_mint`/`balanceOf`/`_beforeTokenTransfer` access) and `GeniusAccessControl` (for `hasRole(DEFAULT_ADMIN_ROLE, ...)`).

**Authorization + storage-read pattern** (lines 103-122 — the canonical "external setter / state transition" body):
```solidity
function redeem(uint256 childId, uint256 amount) external {
    address from = _msgSender();

    require(childId != GNUS_TOKEN_ID, "Cannot redeem GNUS itself");
    require(amount > 0, "Amount must be greater than zero");

    NFT storage childNft = GNUSNFTFactoryStorage.layout().NFTs[childId];
    require(childNft.nftCreated, "Token not created.");
    require(!childNft.nonConvertible, "Token is non-convertible");

    // ... limiter / bypass ...
    _burn(from, childId, amount);
    _mint(from, GNUS_TOKEN_ID, amount, "");

    emit Redeemed(from, childId, amount);
}
```
This is the exact template for `settleExpired(account, id)` and for `_settleRedeemToParent` (Q3 locked: `_burn(account, id, amount)` + `_mint(account, parentId, amount, "")` as direct pair).

**Creator/Admin authorization pattern** (from `GNUSNFTFactory.sol:92`):
```solidity
require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Creator or Admin can only mint NFT");
```
Used by `setValidFrom`/`setValidUntil`/`configureLifecycle` per D4.

**First-mint detection** (Pattern 9 in 13-RESEARCH):
```solidity
uint256 supply = ERC1155SupplyStorage.layout()._totalSupply[id];
require(supply == 0, "Policy immutable after first mint");
```
Requires import `"@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyStorage.sol"`.

---

### `contracts/gnus-ai/GNUSLifecycleStorage.sol` (NEW storage library)

**Analog:** `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` (entire file, 243 lines) — same per-account mapping shape; and `contracts/gnus-ai/GNUSTreasuryStorage.sol` (35 lines) — same minimal library skeleton.

**Library skeleton** (GNUSTreasuryStorage.sol:9-34 — copy this exactly):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title GNUSLifecycleStorage
/// @notice Diamond storage library for the GNUS Lifecycle facet (Phase 13)
/// @custom:security-contact support@gnus.ai

library GNUSLifecycleStorage {
    struct Layout {
        // PerHolder expiry clocks (D2)
        mapping(uint256 => mapping(address => uint64)) holderExpiresAt;
        // Per-wallet mint cap state (D10)
        mapping(uint256 => mapping(address => uint256)) mintedPerWallet;
        mapping(uint256 => uint256) perWalletMintCap;
        // Allowlist registry hook (D5 ALLOWLISTED)
        mapping(uint256 => address) allowlistRegistry;
    }

    bytes32 constant GNUS_LIFECYCLE_STORAGE_POSITION = keccak256("gnus.ai.lifecycle.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_LIFECYCLE_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }
}
```

**Per-account mapping precedent** (GNUSWithdrawLimiterStorage.sol:37-44):
```solidity
struct Layout {
    mapping(address => AccountState) accountStates;      // per-account
    mapping(address => AccountConfig) accountConfigs;    // per-account
    // ...
}
```
`GNUSLifecycleStorage.holderExpiresAt[tokenId][holder]` is the same shape nested one level deeper.

**Storage slot naming convention** (verified across 4 libraries): `gnus.ai.nft.factory.storage`, `gnus.ai.treasury.storage`, `gnus.ai.bridge.validator.storage`, `gnus.ai.withdraw.limiter.storage` → **`gnus.ai.lifecycle.storage`** (RESEARCH §A2).

---

### `contracts/gnus-ai/interfaces/ICredentialVerifier.sol` + `IAllowlistRegistry.sol` (NEW)

**Analog:** no in-repo interface-only file matches exactly; the closest is `contracts/mocks/MockRedeemCaller.sol:7-10` (inline interface declaration style).

**Pattern to copy:**
```solidity
interface IGNUSRedeemDiamond {
    function redeem(uint256 childId, uint256 amount) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
}
```
Two NEW interface files in `contracts/gnus-ai/interfaces/` (new directory). Full content already spec'd in 13-RESEARCH §Code Examples "Credential Verifier Interface" and "Allowlist Registry Interface" — copy verbatim from those code blocks.

---

### `contracts/gnus-ai/testing/MockCredentialVerifier.sol` + `MockAllowlistRegistry.sol` (NEW)

**Analog:** `contracts/mocks/MockRedeemCaller.sol` (entire file, 63 lines)

**Mock shape** (lines 19-47):
```solidity
contract MockRedeemCaller is IERC1155ReceiverUpgradeable {
    /// @dev Post-fix this always succeeds (the receiver magic value is returned).
    ///      Flipped to true by the WR-01 test via hardhat_setStorageAt to simulate
    ///      a recipient that rejects the mint-back ...
    bool public rejectTransfers;

    function redeem(address diamond, uint256 childId, uint256 amount) external {
        IGNUSRedeemDiamond(diamond).redeem(childId, amount);
    }
    // ...
}
```

**Key conventions to replicate:**
- Public bool flag (`rejectTransfers` analog) that tests flip via `hardhat_setStorageAt` to switch mock behavior (accept vs. reject; for verifier, valid vs. invalid credential; for reentrancy test, callback-into-mint vs. no callback).
- Thin pass-through function that drives the diamond via the minimal interface (`MockCredentialVerifier.reenterMint(diamond, to, id, amount, credential)`).
- Tests locate the mock's storage slot for the flag by reading the artifact and computing `keccak256` slot by hand.

**Placement:** RESEARCH Wave 0 lists these under `contracts/gnus-ai/testing/` (new directory). Existing mocks live at `contracts/mocks/` — planner picks one location and keeps it consistent (recommend `contracts/mocks/` to match existing convention; `contracts/gnus-ai/testing/` from the research prompt is also acceptable).

---

### `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (MOD — append 8 fields to `NFT` struct)

**Analog:** the file itself (Phase 9 D5/D7 appends at slots +7/+8, lines 19-21).

**Append pattern to copy** (GNUSNFTFactoryStorage.sol:19-21):
```solidity
// Phase 9 appends below - do not reorder, do not insert above this line
uint256 parentId;       ///< D7 - parent token ID; 0 = direct child of GNUS (zero-default correct for existing direct children)
bool nonConvertible;    ///< D5 - false (zero-default) = convertible, opt-out; true = burn-only (Phase 13 sets at creation)
```

**Phase 13 append** (per D1, packed at slots +9/+10/+11 — verified by 13-RESEARCH §Pattern 1):
```solidity
// Phase 13 appends below - do not reorder, do not insert above this line
uint64  validFrom;             // slot +9 bytes 0-7
uint64  validUntil;            // slot +9 bytes 8-15
uint64  defaultDuration;       // slot +9 bytes 16-23
uint8   expirationMode;        // slot +10 byte 0
uint8   transferPolicy;        // slot +10 byte 1
uint8   expirationDisposition; // slot +10 byte 2
address expirationRecipient;   // slot +10 bytes 3-22
address credentialVerifier;    // slot +11 bytes 0-19
```
Field order is **load-bearing** — the `uint64×3` pack into one slot and `uint8×3 + address` pack into one slot. Do not reorder.

---

### `contracts/gnus-ai/GNUSNFTFactory.sol` (MOD — `beforeMint` anti-scalping)

**Analog:** the existing `beforeMint` at GNUSNFTFactory.sol:87-96.

**Current body** (lines 87-96):
```solidity
function beforeMint(address to, uint256 id, NFT storage nft, uint256 amount) internal {
    address sender = _msgSender();
    require(id != GNUS_TOKEN_ID, "Shouldn't mint GNUS tokens tokens, only deposit and withdraw");
    require(to != address(0), "ERC1155: mint to the zero address");
    require(nft.nftCreated, "Cannot mint NFT that doesn't exist");
    require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Creator or Admin can only mint NFT");
    require((id >> 128) == GNUS_TOKEN_ID, "Direct children only; use convert() for descendants"); // D6 depth gate
    require(balanceOf(sender, GNUS_TOKEN_ID) >= amount, "Not enough GNUS_TOKEN to convert");
    _burn(sender, GNUS_TOKEN_ID, amount); // D1: 1:1 minion move; amount IS minions
}
```

**Insertion point** (per 13-RESEARCH §Pattern 7): append sale-window check, per-wallet cap CEI update, and credential-verifier call BETWEEN the existing requires and the `_burn`. The cap increment MUST come before the verifier call (D10 CEI).

**EIP-170 budget constraint:** GNUSNFTFactory is at 23,417 B / 24,576 B (1,159 headroom). Keep the insertion minimal (~200-400 B). If exceeded, move the logic into `GNUSLifecycle` and have `beforeMint` call an internal helper.

---

### `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` (MOD — predicate insertion)

**Analog:** the existing `_beforeTokenTransfer` at lines 32-85.

**Loop body pattern** (lines 46-64):
```solidity
uint256 totalGNUSAmount = 0;
bool isMinting = from == address(0);
for (uint256 i = 0; i < ids.length; ++i) {
    uint256 id = ids[i];

    if (!isMinting && id == GNUS_TOKEN_ID) {
        totalGNUSAmount += amounts[i];
    }

    require(!GNUSControlStorage.isBannedTransferor(id, operator), "Blocked transferor");

    if (isMinting) {
        require(
            totalSupply(id) <= GNUSNFTFactoryStorage.layout().NFTs[id].maxSupply,
            "Max Supply for NFT would be exceeded"
        );
    }
}
```

**Insertion point** (per 13-RESEARCH §Pattern 4): call `_enforceTransferPolicy(operator, from, to, id, amounts[i])` inside the loop, AFTER the existing `require`s but BEFORE the closing brace. The predicate lives on the `GNUSLifecycle` facet (or as internal on this contract — planner picks by EIP-170 budget; this facet has 13,037 B headroom, plenty).

---

### `contracts/gnus-ai/GNUSBridge.sol` (MOD — `bridgeOut` policy check)

**Analog:** the existing `bridgeOut` at lines 228-267.

**Current outer requires** (lines 235-240):
```solidity
address sender = _msgSender();
require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
require(sgnsDestination != bytes32(0), "Invalid destination key");
require(destChainID != GNUSControlStorage.layout().chainID, "Cannot bridge to same chain");
```

**Limiter-charge pattern** (lines 249-255 — copy this exact conditional-shape for the policy check):
```solidity
if (id != GNUS_TOKEN_ID) {
    if (LibDiamond.diamondStorage().contractOwner != sender) {
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(sender, amount);
    } else {
        emit GNUSWithdrawLimiterStorage.SuperAdminBypass(sender, amount, "GNUSBridge.bridgeOut");
    }
}
```

**Insertion point** (per 13-RESEARCH §Pattern 5): call `_enforceBridgePolicy(sender, id)` immediately AFTER the four `require`s at lines 235-240 and BEFORE the limiter charge at line 249. This ensures policy-bound tokens revert with a clear reason before any state change.

---

### `test/unit/GNUSLifecycle.test.ts` (NEW unit test)

**Analog:** `test/unit/GNUSTreasury.test.ts` (the entire file structure).

**Boot pattern** (lines 1-19 — copy imports verbatim):
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
```

**Multichain provider fixture** (lines 47-56):
```typescript
const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
        networkProviders.set('hardhat', ethers.provider as any);
    }
} else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    networkProviders.set('hardhat', ethers.provider as any);
}
```

**Per-network describe wrapper** (lines 87-100): outer `for (const [networkName, provider] of networkProviders.entries())` + inner `describe(...)` declaring `diamond`, `signers`, `owner`, `geniusDiamond`, `signer0Diamond`, etc.

**Time control:** use `time.increase` / `time.setNextBlockTimestamp` from `@nomicfoundation/hardhat-network-helpers` (RESEARCH §Time-Mocking Requirement). Never `Date.now()` drift-based assertions.

---

### `test/unit/GNUSLifecycleUpgrade.test.ts` (NEW upgrade/decode test)

**Analog:** `test/unit/GNUSTreasury.test.ts` lines 884-934 (the `describe('legacy decode')` block).

**Storage slot helpers** (lines 62-85 — copy verbatim and extend with `+9`, `+10`, `+11`):
```typescript
const FACTORY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.nft.factory.storage'));

function nftParentIdSlot(tokenId: bigint): string {
    const mappingSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [tokenId, FACTORY_STORAGE_SLOT]),
    );
    return ethers.toBeHex(BigInt(mappingSlot) + 7n, 32);
}
```

**Legacy decode shape** (lines 884-934): create token → `hardhat_setStorageAt` to zero appended slots → read via `getNFTInfo` → assert zero-defaults → assert pre-existing fields unchanged → behavioral check (token still works).

The Phase 13 version adds three new slot-zero calls (offsets 9, 10, 11) and asserts each new field decodes to its zero default (`validFrom=0`, `expirationMode=0`, `transferPolicy=0`, etc.) per RESEARCH §Code Examples "Upgrade Test: Legacy NFT Decode".

---

### `test/unit/GNUSNFTFactoryAntiScalping.test.ts` (NEW anti-scalping test)

**Analog:** `test/unit/GNUSRedeemAdapter.test.ts` (mock-driven test against diamond) + `contracts/mocks/MockRedeemCaller.sol` (the mock pattern).

**Mock-deployment pattern:** deploy `MockCredentialVerifier` (or `MockAllowlistRegistry`), wire it into `NFT.credentialVerifier` via `configureLifecycle`, then drive mints. For reentrancy test, the mock's `verify` implementation calls back into the diamond's `mint` — the assertion is that the cap check correctly counts the outer mint, blocking the reentrant one.

**Storage-flag flip pattern** (from MockRedeemCaller.sol:25 + GNUSTreasury.test.ts usage): the mock exposes a public bool; tests flip it via `hardhat_setStorageAt` to change behavior mid-test (e.g., start valid → flip to invalid → assert revert).

---

### `test/foundry/invariant/LifecycleInvariant.t.sol` (NEW invariant test)

**Analog:** `test/foundry/invariant/ConservationInvariant.t.sol` (entire file, 229 lines).

**Imports + class shell** (lines 1-7, 30):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

contract LifecycleInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;
    // ghost state...
}
```

**setUp pattern** (lines 41-109): `super.setUp()` → seed initializer via low-level `diamond.call` with idempotent catch → instantiate `Handler` → register target selectors via `targetSelector(FuzzSelector({...}))` → `targetContract(address(handler))` → capture baseline state → log header.

**Invariant assertion shape** (lines 118-124):
```solidity
function invariant_I1_conservation() public view {
    uint256 expected = treeSupplyAtSeed +
        handler.ghost_totalMinted() -
        handler.ghost_totalBurned() -
        handler.ghost_totalBridgedOutAmount();
    assertEq(_treeSupply(), expected, "I1 violated: tree-wide supply drifted");
}
```

**Coverage guard** (lines 191-197 — `afterInvariant` pattern):
```solidity
function afterInvariant() public {
    assertGt(
        handler.ghost_convertCalls(),
        0,
        "convert path never exercised: ghost_convertCalls == 0 after campaign"
    );
}
```
This pattern ensures the fuzz campaign actually exercised the target path (not vacuous success). LifecycleInvariant must add equivalent guards for `settleExpired` and `renewal` paths.

**Diamond staticcall reader pattern** (lines 213-227):
```solidity
function _totalSupplyOf(uint256 id) internal view returns (uint256) {
    (bool ok, bytes memory data) = diamond.staticcall(
        abi.encodeWithSignature("totalSupply(uint256)", id)
    );
    if (!ok) return 0;
    return abi.decode(data, (uint256));
}
```
Reuse for `holderExpiresAt`, `isTokenActive`, etc.

---

### `diamonds/GeniusDiamond/geniusdiamond.config.json` (MOD — add GNUSLifecycle facet)

**Analog:** the `GNUSRedeemAdapter` entry at lines 120-127.

**Current entry shape:**
```json
"GNUSRedeemAdapter": {
  "priority": 118,
  "versions": {
    "2.6": {
      "fromVersions": [0.0, 2.4, 2.5]
    }
  }
}
```

**Phase 13 addition** (per RESEARCH §A8, priority 119 confirmed free this session, protocolVersion bumps 2.6 → 2.7):
```json
"GNUSLifecycle": {
  "priority": 119,
  "versions": {
    "2.7": {
      "fromVersions": [0.0, 2.4, 2.5, 2.6]
    }
  }
}
```
Top-level `"protocolVersion": 2.6` becomes `2.7`. If the facet needs an init function, add `"deployInit": "GNUSLifecycle_Initialize270()"` per the GNUSTreasury 117 example.

---

## Shared Patterns

### Diamond Storage Library Convention
**Source:** `contracts/gnus-ai/GNUSTreasuryStorage.sol:9-34`
**Apply to:** All new storage libraries (`GNUSLifecycleStorage.sol`)
```solidity
library XStorage {
    struct Layout { /* fields */ }
    bytes32 constant X_STORAGE_POSITION = keccak256("gnus.ai.<domain>.storage");
    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = X_STORAGE_POSITION;
        assembly { l.slot := slot }
    }
}
```

### Creator-or-Admin Authorization
**Source:** `contracts/gnus-ai/GNUSNFTFactory.sol:92`
**Apply to:** All lifecycle setters (`setValidFrom`, `setValidUntil`, `configureLifecycle`)
```solidity
require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Creator or Admin can only ...");
```

### Super-Admin Limiter Bypass (context string)
**Source:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:115-119` and `GNUSBridge.sol:249-255`
**Apply to:** Any new path that touches the GNUS limiter (likely NOT needed for Phase 13 — settlement targets child tokens)
```solidity
if (LibDiamond.diamondStorage().contractOwner != from) {
    GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(from, amount);
} else {
    emit GNUSWithdrawLimiterStorage.SuperAdminBypass(from, amount, "GNUS<Facet>.<function>");
}
```

### Revert-With-String Error Handling
**Source:** every existing facet
**Apply to:** All new requires/reverts
Convention: `require(cond, "ShortCamelCase: descriptive message")` or `revert("...")`. No custom errors (yet) — match existing style.

### No-Custody Settlement Pair
**Source:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:121-122`
**Apply to:** `_settleRedeemToParent` (Q3 locked)
```solidity
_burn(from, childId, amount);
_mint(from, GNUS_TOKEN_ID, amount, "");
```
Substitute `account` for `from` and `parentId` for `GNUS_TOKEN_ID`. Tokens never sit on the diamond contract address (Phase 10 D-01 invariant).

### Unit-Test Diamond Boot
**Source:** `test/unit/GNUSTreasury.test.ts:1-100`
**Apply to:** All three new `test/unit/*.test.ts` files
- `chai.use(chaiAsPromised)` at top
- `multichain.getProviders()` fixture
- `LocalDiamondDeployer` in `before` hook
- `this.timeout(0)` for diamond-deploy time
- Per-network `for ... of networkProviders.entries()` wrapper

### Storage-Slot Helper Pattern (upgrade tests)
**Source:** `test/unit/GNUSTreasury.test.ts:62-85`
**Apply to:** `GNUSLifecycleUpgrade.test.ts`
```typescript
const FACTORY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.nft.factory.storage'));
function nftSlot(tokenId: bigint, offset: bigint): string {
    const mappingSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [tokenId, FACTORY_STORAGE_SLOT]),
    );
    return ethers.toBeHex(BigInt(mappingSlot) + offset, 32);
}
await provider.send('hardhat_setStorageAt', [diamondAddress, nftSlot(id, 9n), ethers.toBeHex(0n, 32)]);
```

### Foundry Invariant Shell
**Source:** `test/foundry/invariant/ConservationInvariant.t.sol`
**Apply to:** `LifecycleInvariant.t.sol`
- Extends `GeniusDiamondTestBase`
- Instantiates `GeniusDiamondHandler` in `setUp`
- `targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}))` to restrict fuzzer
- Ghost state on handler; `invariant_*` functions assert relationships; `afterInvariant` guards path-coverage

---

## No Analog Found

None. Every file in the Phase 13 file list has at least one exact or role-match analog already in the codebase. The closest to "no analog" is `ICredentialVerifier.sol` / `IAllowlistRegistry.sol` (no existing standalone interface-only files in `contracts/gnus-ai/interfaces/` — the directory does not yet exist), but the interface declaration style is established by `MockRedeemCaller.sol:7-10` and the full content is already spec'd in 13-RESEARCH §Code Examples.

---

## Metadata

**Analog search scope:**
- `contracts/gnus-ai/*.sol` (facets, storage libraries, access control)
- `contracts/mocks/*.sol` (mock patterns)
- `test/unit/*.test.ts` (Hardhat unit/upgrade test patterns)
- `test/foundry/invariant/*.t.sol` (Foundry invariant patterns)
- `diamonds/GeniusDiamond/geniusdiamond.config.json` (facet registration)

**Files scanned:** 12 source files + 4 test files + 1 config file = 17 total reads.

**Pattern extraction date:** 2026-08-22

**Load-bearing line references (all verified this session):**
- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol:10-22` — `NFT` struct current state (Phase 9 fields at +7/+8)
- `contracts/gnus-ai/GNUSNFTFactory.sol:87-96` — `beforeMint` insertion point
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol:32-85` — `_beforeTokenTransfer` hook insertion point
- `contracts/gnus-ai/GNUSBridge.sol:228-267` — `bridgeOut` insertion point
- `contracts/gnus-ai/GNUSRedeemAdapter.sol:103-125` — `redeem` template for `settleExpired`
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol:34-89` — storage library skeleton
- `contracts/gnus-ai/GNUSTreasuryStorage.sol:9-34` — minimal library template
- `contracts/mocks/MockRedeemCaller.sol:19-62` — mock shape
- `test/unit/GNUSTreasury.test.ts:62-85` — slot helper pattern
- `test/unit/GNUSTreasury.test.ts:884-934` — legacy decode test pattern
- `test/foundry/invariant/ConservationInvariant.t.sol:30-228` — invariant test shell
- `diamonds/GeniusDiamond/geniusdiamond.config.json:120-127` — facet registration shape
