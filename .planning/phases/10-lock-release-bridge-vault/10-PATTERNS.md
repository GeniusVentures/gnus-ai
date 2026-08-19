# Phase 10: Lock/Release Bridge Vault - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 6 (3 new, 3 modified/extended)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `contracts/gnus-ai/GNUSBridge.sol` (MODIFY) | facet (controller) | request-response + state mutation | `contracts/gnus-ai/GNUSControl.sol` (admin setters), itself (`bridgeOut`) | exact (same file) |
| `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` (NEW) | storage library | diamond-storage (mapping + scalar) | `contracts/gnus-ai/GNUSTreasuryStorage.sol` | exact |
| `test/unit/GNUSBridgeIn.test.ts` (NEW) | test (Hardhat/Mocha/Chai) | request-response | `test/unit/GNUSBridgeEnhanced.test.ts` | exact |
| `test/utils/bridge-certificate.ts` (NEW) | test utility | pure-function (signing, merkle) | `test/utils/bridge-fixtures.ts` (shape only) | role-match |
| `test/foundry/invariant/BridgeInvariant.t.sol` (EXTEND) | invariant test (Foundry) | fuzz + assertion | `test/foundry/invariant/ConservationInvariant.t.sol` | exact |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` (MODIFY) | config | deploy/upgrade manifest | existing `GNUSBridge` block at lines 99-110 | exact |

No SG-side C++ files are mapped here — Phase 10 EVM work only. The SG-side `SignEVM` addition is SuperGenius-repo work and is out of scope for this pattern map.

---

## Pattern Assignments

### `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` (NEW storage library)

**Analog:** `contracts/gnus-ai/GNUSTreasuryStorage.sol` (entire file, 35 lines)

**License + pragma + library header** (lines 1-9):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title GNUSTreasuryStorage
/// @notice Diamond storage library for the GNUS Treasury facet (Phase 9 - conversion-native model)
/// @dev Holds the B1 provenance counter and initialization guard. See 09-CONTEXT.md D8 for semantics.
/// @custom:security-contact support@gnus.ai

library GNUSTreasuryStorage {
```

**Layout struct + storage position constant + layout() accessor** (lines 15-34):
```solidity
struct Layout {
    uint256 globalSupply;
    bool provenanceInitialized;
    mapping(uint256 => uint256) chainSupply;
    uint256 ownChainId;
}

bytes32 constant GNUS_TREASURY_STORAGE_POSITION = keccak256("gnus.ai.treasury.storage");

function layout() internal pure returns (Layout storage l) {
    bytes32 slot = GNUS_TREASURY_STORAGE_POSITION;
    assembly {
        l.slot := slot
    }
}
```

**What to copy:**
- Exact NatSpec header layout (title, notice, dev, `@custom:security-contact`).
- `library` (not `contract`) declaration.
- Layout struct FIRST, position constant SECOND, `layout()` accessor LAST.
- Storage slot naming convention: `keccak256("gnus.ai.<feature>.storage")`. New slot: `keccak256("gnus.ai.bridge.validator.storage")` (verified to not collide with any existing slot).
- No imports needed unless adding helper functions (see `GNUSWithdrawLimiterStorage.sol` line 4 which imports `./GeniusAccessControl.sol` only because it has helper logic; a pure storage library needs none).

**What changes for Phase 10:**
- Layout fields become: `mapping(bytes32 => bool) processedMessages; bytes32 validatorMerkleRoot; uint256 validatorThreshold;`
- Add a `@dev Append-only; Phase 12 may add in-flight accounting after these fields.` comment on the struct.

---

### `contracts/gnus-ai/GNUSBridge.sol` (MODIFY — add `bridgeIn`, `setValidatorSet`, helpers)

**Analog A:** `contracts/gnus-ai/GNUSBridge.sol` itself — `bridgeOut` (lines 185-224), `_mintWithBridgeFee` (lines 79-101)

**Imports pattern** (lines 1-13) — copy exactly, then add two new lines:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/IERC20Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSControlStorage.sol";
import "./GNUSWithdrawLimiterStorage.sol";
import "./GNUSTreasuryStorage.sol";
// ADD for Phase 10:
import "@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/ECDSAUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/MerkleProofUpgradeable.sol";
import "./GNUSBridgeValidatorStorage.sol";
```

**Bridge event pattern** (lines 46-54) — copy structure for the new `BridgeReleased` event:
```solidity
event BridgeOutInitiated(
    address indexed sender,
    uint256 id,
    uint256 amount,
    uint256 srcChainID,
    uint256 destChainID,
    bytes32 sgnsDestination,
    bool destinationYOdd
);
```
The new `BridgeReleased` event should follow the same shape (indexed first field, multiple non-indexed scalars).

**Validation / revert-string pattern** (lines 192-197 of `bridgeOut`) — copy for `bridgeIn`'s input guards:
```solidity
address sender = _msgSender();
require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
require(sgnsDestination != bytes32(0), "Invalid destination key");
require(destChainID != GNUSControlStorage.layout().chainID, "Cannot bridge to same chain");
```
Note the style: short human-readable revert strings, no error codes, direct `require(...)` (not custom errors). Match this exactly.

**Delegate to `_mintWithBridgeFee`** (lines 79-101) — already exists; `bridgeIn` should call it as-is:
```solidity
function _mintWithBridgeFee(address user, uint256 tokenID, uint256 amount) internal {
    uint256 bridgeFee = GNUSControlStorage.layout().bridgeFee;
    if (bridgeFee != 0) {
        require(bridgeFee <= FEE_DENOMINATOR, "Bridge fee exceeds denominator");
        amount = (amount * (FEE_DENOMINATOR - bridgeFee)) / FEE_DENOMINATOR;
    }
    if (tokenID == GNUS_TOKEN_ID) {
        GNUSTreasuryStorage.Layout storage t = GNUSTreasuryStorage.layout();
        require(t.globalSupply + amount <= GNUS_MAX_SUPPLY, "Global max supply exceeded");
        t.globalSupply += amount;
        t.chainSupply[block.chainid] += amount;
    }
    _mint(user, tokenID, amount, "");
    emit Transfer(address(0), user, amount);
}
```

**Analog B:** `contracts/gnus-ai/GNUSControl.sol` — `emergencyPause`/`emergencyUnpause`/`setChainID` admin setter pattern (lines 70-89)

**Admin setter with `onlySuperAdminRole` + event emission** (lines 70-82 of `GNUSControl.sol`):
```solidity
function emergencyPause() external onlySuperAdminRole {
    GNUSControlStorage.layout().paused = true;
    emit Paused(_msgSender());
}

function emergencyUnpause() external onlySuperAdminRole {
    GNUSControlStorage.layout().paused = false;
    emit Unpaused(_msgSender());
}
```
**Copy this exact shape for `setValidatorSet`** — storage write then event emission, no return value, no revert beyond `onlySuperAdminRole` (plus your own input-validation `require`s).

**`onlySuperAdminRole` modifier** (`contracts/gnus-ai/GeniusAccessControl.sol` lines 73-76):
```solidity
modifier onlySuperAdminRole {
    require(LibDiamond.diamondStorage().contractOwner == msg.sender, "Only SuperAdmin allowed");
    _;
}
```
Already inherited by `GNUSBridge` via `GeniusAccessControl`. No new auth code needed.

**Pause check pattern** (from `GNUSERC1155MaxSupply.sol` line 40):
```solidity
require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused");
```
**Copy this exact `require` string** as the first line of `bridgeIn` (D-20/D-21). Match the message exactly so existing Phase 5 tests for pause behavior remain valid (`test/unit/Phase5-circuit-breaker.test.ts` line 64, 92, 100 — already greps for `'GNUSControl: contract paused'`).

---

### `test/unit/GNUSBridgeIn.test.ts` (NEW Hardhat test file)

**Analog:** `test/unit/GNUSBridgeEnhanced.test.ts` (entire file, 569 lines)

**Imports + deployer pattern** (lines 1-14):
```typescript
import {
    LocalDiamondDeployer,
    loadDiamondContract,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
import {
    SGNS_DESTINATION,
    SGNS_DESTINATION_Y_ODD,
    DEST_CHAIN_ID,
} from '../utils/bridge-fixtures';
```

**Diamond deploy + treasury seeding in `before()`** (lines 27-60) — copy this verbatim, including the storage-slot read to detect whether the seed has already run:
```typescript
before(async function () {
    const config = {
        diamondName: 'GeniusDiamond',
        network: 'hardhat',
    };

    const deployer = await LocalDiamondDeployer.getInstance(hre, config);
    const diamond = await deployer.getDiamondDeployed();
    const deployedData = diamond.getDeployedDiamondData();
    const diamondAddress = deployedData.DiamondAddress || '';

    geniusDiamond = await loadDiamondContract<GeniusDiamond>(
        diamond,
        diamondAddress,
        hre.ethers,
    );

    [owner, user1, user2, user3] = await ethers.getSigners();

    // Seed provenance counter (Phase 9 D8) if not already initialized.
    const initialized = await hre.network.provider.send('eth_getStorageAt', [
        diamondAddress,
        ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
    ]);
    if (BigInt(initialized) === 0n) {
        await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
    }

    initialSnapshotId = await hre.network.provider.send('evm_snapshot');
});
```

**Snapshot isolation pattern** (lines 62-72):
```typescript
beforeEach(async function () {
    snapshotId = await hre.network.provider.send('evm_snapshot');
});

afterEach(async function () {
    await hre.network.provider.send('evm_revert', [snapshotId]);
});

after(async function () {
    await hre.network.provider.send('evm_revert', [initialSnapshotId]);
});
```

**Event assertion pattern** (lines 432-443):
```typescript
await expect(tx)
    .to.emit(geniusDiamond, 'BridgeOutInitiated')
    .withArgs(
        user1.address,
        1,
        50,
        1,
        DEST_CHAIN_ID,
        SGNS_DESTINATION,
        SGNS_DESTINATION_Y_ODD,
    );
```

**Revert assertion pattern** (lines 213-215):
```typescript
await expect(
    geniusDiamond.connect(user2).transferFrom(user1.address, user3.address, toWei(200)),
).to.be.revertedWith('ERC20: insufficient allowance');
```

**What to copy:**
- Use `geniusDiamond['mint(address,uint256)'](...)` bracket syntax when there are overloads (e.g., the 2-arg vs 3-arg `mint`).
- Always `connect(user)` before non-admin calls (see lines 178, 193, 251).
- Bridge tests use `bridge-fixtures.ts` constants — extend that file rather than redefining.

---

### `test/utils/bridge-certificate.ts` (NEW test utility)

**Analog:** `test/utils/bridge-fixtures.ts` (shape only — small utility module that re-exports constants and helpers)

**Pattern to copy** (entire 29-line file):
```typescript
import { ethers } from 'hardhat';

/**
 * Shared bridge test fixtures (Hardhat).
 * ...
 */

/** 32-byte X component of the SuperGenius destination public key (not an Ethereum address). */
export const SGNS_DESTINATION = ethers.zeroPadValue('0x1234', 32);

/** Parity of the destination key's Y component (false = even, true = odd). */
export const SGNS_DESTINATION_Y_ODD = false;

/** Canonical destination chain id for bridge tests (Polygon). */
export const DEST_CHAIN_ID = 137;

/** Re-exported so bridge specs get every constant from one import. */
export { GNUS_TOKEN_ID } from '../../scripts/common';
```

**What to copy:**
- Module-level docstring explaining purpose.
- `export const` for primitives.
- Re-export from `scripts/common` when a constant already exists.
- Keep this file **pure** (no Hardhat network calls); just signing/aggregation helpers using `ethers.Wallet` + `ethers.keccak256` + `ethers.AbiCoder`.

**New helpers to add** (these have no direct analog in the codebase — implement per RESEARCH.md §Code Examples):
- `signBridgeInCertificate(wallet, transferId, srcChainID, destChainID, diamondAddress, recipient, tokenId, amount): Promise<string>` — builds structHash, calls `wallet.signMessage(getBytes(structHash))`.
- `aggregateCertificate(signatures, structHash): Promise<string[]>` — recovers addresses, sorts ascending, returns sorted sigs.
- `buildValidatorMerkleTree(validatorAddresses: string[]): { root: string; proofs: Map<string, string[]> }` — build a keccak256 merkle tree over `abi.encodePacked(address)` leaves.

---

### `test/foundry/invariant/BridgeInvariant.t.sol` (EXTEND)

**Analog:** `test/foundry/invariant/ConservationInvariant.t.sol` (entire file, 172 lines)

**Header + imports + base class** (lines 1-30):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ConservationInvariant
 * @notice Invariant tests for the Phase 9 conversion-native model (TREASURY-01/02/03)
 * @dev ...
 */
contract ConservationInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;
```

**setUp + selector targeting** (lines 41-85) — copy this `setUp` shape:
```solidity
function setUp() public override {
    super.setUp();

    // Seed provenance counter via raw call (catches reverts if already seeded)
    vm.prank(owner);
    (bool seeded, ) = diamond.call(
        abi.encodeWithSignature("GNUSTreasury_SetSeedSupply(uint256)", uint256(0))
    );
    if (!seeded) {
        console.log("[SETUP] Provenance already initialized on fork; continuing");
    }

    handler = new GeniusDiamondHandler();
    handler.setUp();
    handler.seedConversion();   // deterministic coverage of the convert path

    // Restrict fuzzer to specific selectors
    bytes4[] memory selectors = new bytes4[](6);
    selectors[0] = GeniusDiamondHandler.handler_mint.selector;
    // ...
    targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    targetContract(address(handler));

    treeSupplyAtSeed = _treeSupply();
    globalSupplyAtSeed = _totalSupplyOfAll();
}
```

**Invariant function shape** (lines 94-100):
```solidity
function invariant_I1_conservation() public view {
    uint256 expected = treeSupplyAtSeed +
        handler.ghost_totalMinted() -
        handler.ghost_totalBurned() -
        handler.ghost_totalBridgedOutAmount();
    assertEq(_treeSupply(), expected, "I1 violated: tree-wide supply drifted");
}
```

**afterInvariant coverage guard** (lines 134-140):
```solidity
function afterInvariant() public {
    assertGt(
        handler.ghost_convertCalls(),
        0,
        "convert path never exercised: ghost_convertCalls == 0 after campaign"
    );
}
```

**Live-state readers via `staticcall`** (lines 156-170):
```solidity
function _totalSupplyOf(uint256 id) internal view returns (uint256) {
    (bool ok, bytes memory data) = diamond.staticcall(
        abi.encodeWithSignature("totalSupply(uint256)", id)
    );
    if (!ok) return 0;
    return abi.decode(data, (uint256));
}
```

**What to copy:**
- `vm.prank(owner)` + raw `diamond.call(abi.encodeWithSignature(...))` for any new admin setter (avoids needing a typed ABI for the new function).
- `targetSelector(FuzzSelector(...))` + `targetContract(...)` to restrict the fuzzer.
- `assertEq(actual, expected, "Ix violated: ...")` failure message format.
- Console log header in `setUp` (`===== Bridge Invariant Tests =====` already in BridgeInvariant.t.sol; keep it).

The current `BridgeInvariant.t.sol` is a stub with two placeholder tests. Replace the stubs with real invariants per RESEARCH.md §Validation Architecture (`invariant_processedMessagesIffReleased`, `invariant_noValidCertFromFuzzedSigs`).

---

### `diamonds/GeniusDiamond/geniusdiamond.config.json` (MODIFY)

**Analog:** the existing `GNUSBridge` block at lines 99-110:
```json
"GNUSBridge": {
  "priority": 115,
  "versions": {
    "0.0": {},
    "2.5": {
      "fromVersions": [0.0, 2.4]
    },
    "2.6": {
      "fromVersions": [0.0, 2.4, 2.5]
    }
  }
},
```

**Version-bump pattern (with initializer):** see `GNUSTreasury` block at lines 111-119:
```json
"GNUSTreasury": {
  "priority": 117,
  "versions": {
    "2.6": {
      "deployInit": "GNUSTreasury_Initialize260()",
      "upgradeInit": ""
    }
  }
},
```

**What to copy:**
- Bump `GNUSBridge` to `"3.0"` with `"fromVersions": [0.0, 2.4, 2.5, 2.6]`.
- If the planner adds an upgrade initializer (e.g., to set a default validator threshold), follow the `GNUSTreasury_Initialize260()` shape: a `onlySuperAdminRole` external function on the facet that writes to the new storage library.
- If no initializer is added (the recommended path per RESEARCH.md Pitfall 7 — explicit configuration beats magic defaults), use `"upgradeInit": ""` and document that Super Admin must call `setValidatorSet` post-upgrade.

---

## Shared Patterns

### Diamond Storage Library

**Source:** `contracts/gnus-ai/GNUSTreasuryStorage.sol` (entire file)
**Apply to:** `GNUSBridgeValidatorStorage.sol`

The single-file pattern for a pure storage library:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title <LibraryName>
/// @notice <one-line summary>
/// @dev <longer note about the layout + phase reference>
/// @custom:security-contact support@gnus.ai
library <LibraryName> {
    struct Layout {
        // fields
    }

    bytes32 constant <LIBRARY>_STORAGE_POSITION = keccak256("gnus.ai.<feature>.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = <LIBRARY>_STORAGE_POSITION;
        assembly { l.slot := slot }
    }
}
```

Existing slot strings (verified by grep; do NOT collide):
- `gnus.ai.control.storage` (GNUSControlStorage.sol:32)
- `gnus.ai.nft.factory.storage` (GNUSNFTFactoryStorage.sol:34)
- `gnus.ai.treasury.storage` (GNUSTreasuryStorage.sol:23)
- `gnus.ai.withdraw.limiter.storage` (GNUSWithdrawLimiterStorage.sol:47-48)

**New slot for Phase 10:** `gnus.ai.bridge.validator.storage` — confirmed no collision.

### Role-Based Access

**Source:** `contracts/gnus-ai/GeniusAccessControl.sol` lines 73-76
**Apply to:** `setValidatorSet` (and any future admin setters on `GNUSBridge`)

```solidity
modifier onlySuperAdminRole {
    require(LibDiamond.diamondStorage().contractOwner == msg.sender, "Only SuperAdmin allowed");
    _;
}
```

Already inherited by `GNUSBridge`. Do NOT add new modifiers. Do NOT use `onlyRole(DEFAULT_ADMIN_ROLE)` — the project convention is `onlySuperAdminRole` for security-critical admin setters (see `GNUSControl.emergencyPause`, `GNUSControl.updateBridgeFee`, `DiamondInitFacet.diamondInitialize250`).

### Pause Check

**Source:** `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` line 40
**Apply to:** first line of `bridgeIn`

```solidity
require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused");
```

Use the exact revert string `"GNUSControl: contract paused"`. Phase 5 tests already grep for it (test/unit/Phase5-circuit-breaker.test.ts:64, 92, 100).

### Revert String Style

**Source:** `contracts/gnus-ai/GNUSBridge.sol` lines 193-197 (and throughout the file)
**Apply to:** all new `require` statements in `bridgeIn` and `setValidatorSet`

Pattern: short sentence-case strings with punctuation, no error codes, no custom errors. Examples already in the codebase:
- `"Token not created."`
- `"Insufficient tokens."`
- `"Invalid destination key"`
- `"Cannot bridge to same chain"`
- `"Global max supply exceeded"`
- `"Only SuperAdmin allowed"`

Match this style exactly. Do NOT introduce Solidity custom errors (`error Foo();`) — the codebase has not adopted them.

### Event Emission

**Source:** `contracts/gnus-ai/GNUSControl.sol` lines 70-82, `contracts/gnus-ai/GNUSBridge.sol` lines 215-223
**Apply to:** `BridgeReleased` and `ValidatorSetUpdated` events

Pattern: emit AFTER state changes, with the previous value available if relevant:
```solidity
function emergencyPause() external onlySuperAdminRole {
    GNUSControlStorage.layout().paused = true;
    emit Paused(_msgSender());
}
```

For the validator setter, follow the "emit-with-old-and-new" pattern from RESEARCH.md Pattern 4:
```solidity
emit ValidatorSetUpdated(v.validatorMerkleRoot, newRoot, newThreshold);
v.validatorMerkleRoot = newRoot;
v.validatorThreshold = newThreshold;
```

### Bridge Mint Routing

**Source:** `contracts/gnus-ai/GNUSBridge.sol` lines 79-101 (`_mintWithBridgeFee`)
**Apply to:** `bridgeIn` body

`bridgeIn` MUST route through `_mintWithBridgeFee(recipient, GNUS_TOKEN_ID, amount)` — never call `_mint` directly. The helper applies the bridge fee, enforces `GNUS_MAX_SUPPLY`, and updates `chainSupply[block.chainid]` (D-22). Calling `_mint` directly would bypass all three.

### Test Snapshot Isolation

**Source:** `test/unit/GNUSBridgeEnhanced.test.ts` lines 62-72
**Apply to:** all new Hardhat test files

```typescript
beforeEach(async function () {
    snapshotId = await hre.network.provider.send('evm_snapshot');
});
afterEach(async function () {
    await hre.network.provider.send('evm_revert', [snapshotId]);
});
```

Do NOT use `loadFixture` from `@nomicfoundation/hardhat-network-helpers` — the project standard is raw `evm_snapshot`/`evm_revert` (verified across all existing test files).

### Foundry Invariant Skeleton

**Source:** `test/foundry/invariant/ConservationInvariant.t.sol` (entire file)
**Apply to:** extended `BridgeInvariant.t.sol`

- Inherit `GeniusDiamondTestBase`.
- Use `vm.prank(owner)` + raw `diamond.call(abi.encodeWithSignature(...))` for admin calls to functions not yet in the typed ABI.
- Use `targetSelector(FuzzSelector(...))` to restrict the fuzzer.
- Use `assertEq(actual, expected, "Ix violated: ...")` failure format.
- Add an `afterInvariant` coverage guard for any path that must be exercised.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none — all 6 files have analogs) | — | — | — |

The `signBridgeInCertificate` / `aggregateCertificate` / `buildValidatorMerkleTree` helpers inside `test/utils/bridge-certificate.ts` are net-new logic (no existing analog), but the **file shape** (small utility module, pure functions, exported constants) matches `test/utils/bridge-fixtures.ts`. Use RESEARCH.md §Code Examples → "Off-Chain Signing (ethers.js)" for the actual implementation.

---

## Metadata

**Analog search scope:**
- `contracts/gnus-ai/` — all 16 facets and storage libraries
- `test/unit/` — 17 test files
- `test/utils/` — 4 utility files
- `test/foundry/invariant/` — 9 invariant contracts
- `diamonds/GeniusDiamond/` — config layout

**Files scanned:** ~50
**Pattern extraction date:** 2026-08-17

**Verified by direct file read:**
- `contracts/gnus-ai/GNUSBridge.sol` (full, 437 lines)
- `contracts/gnus-ai/GNUSTreasuryStorage.sol` (full, 35 lines)
- `contracts/gnus-ai/GNUSControlStorage.sol` (full, 70 lines)
- `contracts/gnus-ai/GNUSControl.sol` (partial, lines 1-120)
- `contracts/gnus-ai/GeniusAccessControl.sol` (full, 78 lines)
- `contracts/gnus-ai/DiamondInitFacet.sol` (full, 69 lines)
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` (partial, lines 1-60)
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` (full, 244 lines)
- `test/unit/GNUSBridgeEnhanced.test.ts` (full, 569 lines)
- `test/unit/Phase5-circuit-breaker.test.ts` (partial, lines 1-100)
- `test/utils/bridge-fixtures.ts` (full, 29 lines)
- `test/utils/test-template.ts` (full, 182 lines)
- `test/foundry/invariant/BridgeInvariant.t.sol` (full, 50 lines)
- `test/foundry/invariant/ConservationInvariant.t.sol` (full, 172 lines)
- `diamonds/GeniusDiamond/geniusdiamond.config.json` (partial, lines 90-150)
- `node_modules/@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/ECDSAUpgradeable.sol` (partial, lines 1-80)
