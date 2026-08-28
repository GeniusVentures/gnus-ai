# Phase 9: Per-Child GNUS Treasury/Reserve - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 11 (4 NEW, 7 MOD)
**Analogs found:** 10 / 11 (one NEW file is greenfield with no direct analog — noted below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `contracts/gnus-ai/GNUSTreasury.sol` (NEW) | facet | request-response (state transition + views) | `contracts/gnus-ai/GNUSBridge.sol` (facet shape) + `GNUSControl.sol` (role-gated admin setters) | exact |
| `contracts/gnus-ai/GNUSTreasuryStorage.sol` (NEW) | storage library | keccak256-slotted Layout | `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (bare Layout library) + `GNUSWithdrawLimiterStorage.sol` (Layout + helpers + events) | exact |
| `contracts/gnus-ai/GNUSTreasury_Initialize300` (NEW — lives on the GNUSTreasury facet) | initializer | one-shot, guarded | `DiamondInitFacet.sol` `diamondInitialize250` + `GNUSControl_Initialize230` | exact |
| `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (MOD — struct append) | storage struct | append-only struct evolution | Self (existing `NFT` struct) + Phase 6/2.3-era appends (see git log) | exact |
| `contracts/gnus-ai/GNUSNFTFactory.sol` (MOD — `beforeMint`, `createNFTs`) | facet | state transition (mint/create) | Self (lines 83-94, 152-181) — in-place rewrite, not a new pattern | exact |
| `contracts/gnus-ai/GNUSBridge.sol` (MOD — remove `withdraw`, add provenance hooks, restrict MINTER mint) | facet | state transition | Self — in-place edit. The `_mintWithBridgeFee` lines 77-89 is the anchor for the counter/cap hook. | exact |
| `geniusdiamond.config.json` (MOD) | diamond config | facet/selector registration | Self — version-bump pattern at lines 90-98 (GNUSBridge `"2.5": { "fromVersions": [0.0, 2.4] }`) | exact |
| `test/unit/GNUSTreasury.test.ts` (NEW) | unit test | request-response (Hardhat + Chai) | `test/unit/GNUSBridge.test.ts` (fixture + `withdraw` cases being replaced) | exact |
| `test/unit/NFTFactory.test.ts` (MOD — minion-semantics rewrite) | unit test | request-response | Self — existing `mint(...)` cases at lines 278, 315, 364, 407, 458 | exact |
| `test/foundry/handlers/GeniusDiamondHandler.sol` (MOD — add convert/mint-depth actions) | fuzz handler | bounded actions + ghost vars | Self — existing handler skeleton | exact |
| `test/foundry/invariant/` (NEW invariant for I1/I2/I3/I5) | invariant test | fuzz | `test/foundry/invariant/EconomicInvariant.t.sol`, `NFTFactoryInvariant.t.sol` | role-match |

---

## Pattern Assignments

### 1. `contracts/gnus-ai/GNUSTreasury.sol` (NEW facet)

**Analogs:** `GNUSBridge.sol` (facet header, supportsInterface, _msgSender usage), `GNUSControl.sol` (role-gated setters), `DiamondInitFacet.sol` (versioned initializer precedent)

**Facet header + inheritance pattern** (GNUSBridge.sol:1-18, GNUSNFTFactory.sol:1-16):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "./GNUSERC1155MaxSupply.sol";      // picks up ERC1155 supply + burn + hook chain
import "./GeniusAccessControl.sol";       // onlySuperAdminRole / onlyRole(DEFAULT_ADMIN_ROLE)
import "./GNUSConstants.sol";             // GNUS_TOKEN_ID, GNUS_MAX_SUPPLY
import "./GNUSNFTFactoryStorage.sol";     // NFT struct (exchangeRate read for display views)
import "./GNUSTreasuryStorage.sol";       // NEW — globalSupply + provenanceInitialized
import "./GNUSWithdrawLimiterStorage.sol";// checkAndRecordWithdraw + SuperAdminBypass event
import "contracts-starter/contracts/libraries/LibDiamond.sol"; // for contractOwner super-admin check

contract GNUSTreasury is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using GNUSTreasuryStorage for GNUSTreasuryStorage.Layout;
```

**supportsInterface pattern** (GNUSBridge.sol:57-69 — copy verbatim):

```solidity
function supportsInterface(bytes4 interfaceId)
    public view virtual
    override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool)
{
    return (ERC1155Upgradeable.supportsInterface(interfaceId) ||
        AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
}
```

**WR-07 explicit limiter charge on GNUS-terminal leg** (transplant of GNUSBridge.sol:181-187 — read the source comment block at lines 175-180 for the one-charge invariant):

```solidity
if (toId == GNUS_TOKEN_ID) {
    if (LibDiamond.diamondStorage().contractOwner != sender) {
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(sender, minionAmount);
    } else {
        emit GNUSWithdrawLimiterStorage.SuperAdminBypass(sender, minionAmount, "GNUSTreasury.convert");
    }
}
```

**Super-admin bypass modifier usage** (GeniusAccessControl.sol:73-76):

```solidity
modifier onlySuperAdminRole {
    require(LibDiamond.diamondStorage().contractOwner == msg.sender, "Only SuperAdmin allowed");
    _;
}
```

**Role-gated admin setter pattern** (GNUSControl.sol:56-64 — `onlySuperAdminRole`, versioned require, storage write):

```solidity
function syncGlobalSupply(uint256 newGlobal) external onlyRole(DEFAULT_ADMIN_ROLE) {
    GNUSTreasuryStorage.Layout storage l = GNUSTreasuryStorage.layout();
    require(l.provenanceInitialized, "Not initialized");
    emit GlobalSupplySynced(l.globalSupply, newGlobal, _msgSender());
    l.globalSupply = newGlobal;
}
```

**NFT struct read for display views** (GNUSBridge.sol:164-169 — same lookup idiom used by `unitsOf`):

```solidity
require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
uint256 exchangeRate = GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
require(exchangeRate > 0, "Exchange rate must be greater than zero");
```

---

### 2. `contracts/gnus-ai/GNUSTreasuryStorage.sol` (NEW storage library)

**Analogs:** `GNUSNFTFactoryStorage.sol` (minimal library), `GNUSWithdrawLimiterStorage.sol` (library + events + helpers)

**Keccak-slotted Layout pattern** (GNUSNFTFactoryStorage.sol:22-42 — copy verbatim, replace slot name):

```solidity
/// @custom:security-contact support@gnus.ai
library GNUSTreasuryStorage {
    struct Layout {
        uint256 globalSupply;          // B1 provenance counter (minions)
        bool provenanceInitialized;    // one-time initializer guard
    }

    bytes32 constant GNUS_TREASURY_STORAGE_POSITION = keccak256("gnus.ai.treasury.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_TREASURY_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }
}
```

**Events declared on the library, not the facet** (GNUSWithdrawLimiterStorage.sol:55-78 — precedent: `WithdrawRecorded`, `SuperAdminBypass`, `WithdrawLimiterTriggered` all live on the storage library, facets emit them).

---

### 3. `GNUSTreasury_Initialize300` (versioned initializer — lives on the GNUSTreasury facet)

**Analogs:** `DiamondInitFacet.sol:43-57` (`diamondInitialize250`), `GNUSControl.sol:56-64` (`GNUSControl_Initialize230`), `GNUSNFTFactory.sol:41-45` (`GNUSNFTFactory_Initialize230`)

**Versioned-initializer pattern** (DiamondInitFacet.sol:43-57):

```solidity
function diamondInitialize250() public onlySuperAdminRole {
    address sender = _msgSender();
    emit InitLog(sender, "diamondInitialize Function called");
    _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    // ...
}
```

**Guarded-re-init pattern** (GNUSControl.sol:56-64 — version-bump require):

```solidity
function GNUSControl_Initialize230() external onlySuperAdminRole {
    require(
        GNUSControlStorage.layout().protocolVersion < 230,
        "Constructor was already initialized >= 2.30"
    );
    GNUSControlStorage.layout().protocolVersion = 230;
    InitializableStorage.layout()._initialized = true;
}
```

**Applied to Phase 9** (one-shot bool guard, NOT a version compare, because `globalSupply` seed is chain-specific):

```solidity
function GNUSTreasury_Initialize300(uint256 seedGlobalSupply) external onlySuperAdminRole {
    GNUSTreasuryStorage.Layout storage l = GNUSTreasuryStorage.layout();
    require(!l.provenanceInitialized, "Already initialized");
    l.globalSupply = seedGlobalSupply;
    l.provenanceInitialized = true;
    emit GlobalSupplyInitialized(seedGlobalSupply, _msgSender());
}
```

---

### 4. `GNUSNFTFactoryStorage.sol` (MOD — append `parentId` + `nonConvertible` to `NFT` struct)

**Analog:** Self (GNUSNFTFactoryStorage.sol:10-19) — append-only, never reorder

**Append rule:** new fields go at the END of the struct. Phase 13 will append after Phase 9's fields. Existing fields MUST stay in current order.

```solidity
struct NFT {
    string name;            // existing
    string symbol;          // existing
    string uri;             // existing
    uint256 exchangeRate;   // existing — semantics change to display-only (NatSpec update only)
    uint256 maxSupply;      // existing — semantics change to minion cap (NatSpec update only)
    address creator;        // existing
    uint128 childCurIndex;  // existing
    bool nftCreated;        // existing
    // Phase 9 appends below — do not reorder, do not insert above this line
    uint256 parentId;       // D7 — 0 = direct child of GNUS (zero-default correct for existing records)
    bool nonConvertible;    // D5 — false (zero-default) = convertible, opt-out
}
```

---

### 5. `GNUSNFTFactory.sol` (MOD — `beforeMint` rewrite, `createNFTs` collision guard + parentId)

**Analog:** Self — in-place edit of lines 83-94 and 152-181

**`beforeMint` rewrite** (replaces lines 83-94; kills the `amount * nft.exchangeRate` multiplication at line 90 and the `(id >> 128) == GNUS_TOKEN_ID` conditional at line 89):

```solidity
function beforeMint(address to, uint256 id, NFT storage nft, uint256 amount) internal {
    address sender = _msgSender();
    require(id != GNUS_TOKEN_ID, "Shouldn't mint GNUS tokens tokens, only deposit and withdraw");
    require(to != address(0), "ERC1155: mint to the zero address");
    require(nft.nftCreated, "Cannot mint NFT that doesn't exist");
    require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Creator or Admin can only mint NFT");
    require((id >> 128) == GNUS_TOKEN_ID, "Direct children only; use convert() for descendants"); // D6 depth gate
    require(balanceOf(sender, GNUS_TOKEN_ID) >= amount, "Not enough GNUS_TOKEN to convert");
    _burn(sender, GNUS_TOKEN_ID, amount);   // D1: amount IS minions, 1:1 with the subsequent _mint
}
```

**`createNFTs` collision guard + parentId** (insert into lines 164-178 — new `require` before the struct write, plus two new fields in the struct literal):

```solidity
uint256 newTokenID = (parentID << 128) | nft.childCurIndex++;
require(!GNUSNFTFactoryStorage.layout().NFTs[newTokenID].nftCreated, "Token ID collision"); // D7
GNUSNFTFactoryStorage.layout().NFTs[newTokenID] = NFT({
    name: names[i],
    symbol: symbols[i],
    exchangeRate: exchRates[i],
    maxSupply: max_supplies[i],
    uri: newuris[i],
    creator: sender,
    childCurIndex: 0,
    nftCreated: true,
    parentId: parentID,           // D7 — recorded, not derived
    nonConvertible: false         // D5 — default convertible; set true post-creation for burn-only tokens
});
```

---

### 6. `GNUSBridge.sol` (MOD — remove `withdraw`, hook `_mintWithBridgeFee` + `burn`, restrict 3-arg mint, drop bridgeOut rate math)

**Analog:** Self — in-place edits at lines 77-89, 108-110, 118-121, 162-191, 217-230

**DELETE `withdraw(uint256 amount, uint256 id)`** (lines 162-191) — selector removed in the same diamondCut that adds GNUSTreasury. The WR-07 limiter charge at lines 181-187 is transplanted to `GNUSTreasury.convert` (see pattern #1 above).

**Restrict 3-arg MINTER mint to id 0** (D10 — insert one require at lines 108-110):

```solidity
function mint(address user, uint256 tokenID, uint256 amount) public onlyRole(MINTER_ROLE) {
    require(tokenID == GNUS_TOKEN_ID, "MINTER_ROLE mints GNUS only"); // D10
    _mintWithBridgeFee(user, tokenID, amount);
}
```

**Provenance hook + global cap on `_mintWithBridgeFee`** (D8/D9 — insert AFTER the fee adjustment at line 85, BEFORE `_mint` at line 87 — Pitfall 3 in RESEARCH):

```solidity
function _mintWithBridgeFee(address user, uint256 tokenID, uint256 amount) internal {
    uint256 bridgeFee = GNUSControlStorage.layout().bridgeFee;
    if (bridgeFee != 0) {
        require(bridgeFee <= FEE_DENOMINATOR, "Bridge fee exceeds denominator");
        amount = (amount * (FEE_DENOMINATOR - bridgeFee)) / FEE_DENOMINATOR;
    }
    // Phase 9 D8/D9: counter + cap AFTER fee adjustment (post-fee amount is what enters existence)
    if (tokenID == GNUS_TOKEN_ID) {
        GNUSTreasuryStorage.Layout storage t = GNUSTreasuryStorage.layout();
        require(t.globalSupply + amount <= GNUS_MAX_SUPPLY, "Global max supply exceeded"); // D9
        t.globalSupply += amount; // D8 — post-fee amount only (Pitfall 3)
    }
    _mint(user, tokenID, amount, "");
    emit Transfer(address(0), user, amount);
}
```

**Provenance hook on `burn`** (D8 — after `_burn` at line 119):

```solidity
function burn(address user, uint256 amount) public onlyRole(MINTER_ROLE) {
    _burn(user, GNUS_TOKEN_ID, amount);
    GNUSTreasuryStorage.layout().globalSupply -= amount; // D8 — admin destruction
    emit Transfer(user, address(0), amount);
}
```

**`bridgeOut` limiter math simplification** (D4 — drop the `/ exchangeRate` division at lines 222-224; child amount is already minions):

```solidity
// BEFORE (lines 221-229):
if (id != GNUS_TOKEN_ID) {
    uint256 exchangeRate = GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
    require(exchangeRate > 0, "Exchange rate must be greater than zero");
    uint256 convAmount = amount / exchangeRate;
    // ...
}

// AFTER: charge the limiter with `amount` directly (already minions)
if (id != GNUS_TOKEN_ID) {
    if (LibDiamond.diamondStorage().contractOwner != sender) {
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(sender, amount);
    } else {
        emit GNUSWithdrawLimiterStorage.SuperAdminBypass(sender, amount, "GNUSBridge.bridgeOut");
    }
}
```

**No counter touch on `bridgeOut`** under B1 — destination chain's bridge-in mint is the + side; global total conserved across the pair.

---

### 7. `geniusdiamond.config.json` (MOD)

**Analog:** Self — version-bump pattern at lines 90-98

**Add the new facet** (priority 117 sits between GNUSBridge@115 and GNUSWithdrawLimiter@120):

```jsonc
"GNUSTreasury": {
  "priority": 117,
  "versions": {
    "3.0": {
      "deployInit": "GNUSTreasury_Initialize300(uint256)",
      "upgradeInit": "GNUSTreasury_Initialize300(uint256)"
    }
  }
},
```

**Bump GNUSBridge** (remove `withdraw(uint256,uint256)` selector; the diamonds tooling computes the cut from ABI diff):

```jsonc
"GNUSBridge": {
  "priority": 115,
  "versions": {
    "0.0": {},
    "2.5": { "fromVersions": [0.0, 2.4] },
    "3.0": { "fromVersions": [0.0, 2.4, 2.5] }
  }
},
```

**Bump GNUSNFTFactory** (storage-layout change via struct append — no selector change but bump for provenance):

```jsonc
"GNUSNFTFactory": {
  "priority": 40,
  "versions": {
    "0.0": { "deployInit": "GNUSNFTFactory_Initialize()" },
    "2.3": { "deployInit": "GNUSNFTFactory_Initialize230()", "upgradeInit": "GNUSNFTFactory_Initialize230()", "fromVersions": [0.0, 2.0] },
    "3.0": { "fromVersions": [0.0, 2.0, 2.3] }
  }
},
```

**Top-level `protocolVersion`:** `2.5 → 3.0`.

---

### 8. `test/unit/GNUSTreasury.test.ts` (NEW)

**Analog:** `test/unit/GNUSBridge.test.ts` (the test whose `withdraw` cases are being replaced)

**Fixture pattern** (GNUSBridge.test.ts:21-115 — copy verbatim, rename `describe`):

```typescript
describe('GNUS Treasury Tests', async function () {
    const diamondName = 'GeniusDiamond';
    this.timeout(0);

    const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();
    // ... hardhat / multichain provider setup identical to GNUSBridge.test.ts lines 26-36 ...

    for (const [networkName, provider] of networkProviders.entries()) {
        describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
            let diamond: Diamond;
            let geniusDiamond: GeniusDiamond;
            let ownerDiamond: GeniusDiamond;
            // ... signers, LocalDiamondDeployer fixture identical to lines 58-105 ...

            beforeEach(async function () {
                snapshotId = await provider.send('evm_snapshot', []);
            });
            afterEach(async () => {
                if (snapshotId) { await provider.send('evm_revert', [snapshotId]); }
            });
```

**Two-diamond fixture for I3 cross-chain provenance:** reuse `LocalDiamondDeployer.getInstance(hre, config)` a second time with a different `diamondName` (e.g., `'GeniusDiamondChainB'`) in a separate `describe` block. No existing analog does this — **NEW pattern for this phase** (see "No Analog Found" below).

**Overload-resolution idiom for mint** (GNUSBridge.test.ts pattern, used throughout NFTFactory.test.ts):

```typescript
await ownerDiamond['mint(address,uint256)'](signer1, toWei(1000));            // 2-arg root mint
await signer1Diamond['mint(address,uint256,uint256,bytes)'](signer2, childId, toWei(5), '0x'); // 4-arg factory mint
```

**Snapshot-per-test isolation** (GNUSBridge.test.ts:107-115) is mandatory — the provenance counter is diamond storage and leaks between tests without reverts.

---

### 9. `test/unit/NFTFactory.test.ts` (MOD — minion-semantics rewrite)

**Analog:** Self — in-place assertion updates

**Call sites to update** (per RESEARCH §E): lines 173, 297, 364, 407, 458.

**Assertion flips** (the "burn correct amount" test at line 468 is the canonical example):

```typescript
// BEFORE: caller passes child units, pays units * exchangeRate minions
await signer1Diamond['mint(address,uint256,uint256,bytes)'](signer2, newParentNFTID, toWei(5), '0x');
// expected GNUS burned = toWei(5) * exchangeRate (e.g., 2.0 -> toWei(10))
// expected child balance = toWei(5)

// AFTER (D1): caller passes minions, pays exactly amount
await signer1Diamond['mint(address,uint256,uint256,bytes)'](signer2, newParentNFTID, toWei(5), '0x');
// expected GNUS burned = toWei(5) (1:1, exchangeRate never applied)
// expected child balance = toWei(5) (same number — child balance IS minions)
```

**2nd-gen mint tests** (lines 371-375, 522-525 per REQUIREMENTS.md:149) change from asserting "no burn on deeper mints" to asserting "deeper mints REVERT with depth-gate message; convert issues them instead."

---

### 10. `test/foundry/handlers/GeniusDiamondHandler.sol` (MOD)

**Analog:** Self — existing handler skeleton (lines 81, 173, 210, 262, 415, 465, 511)

**Add convert action** (new handler — pattern matches `handler_transfer` at line 81):

```solidity
function handler_convert(
    uint256 actorSeed,
    uint256 fromIdSeed,
    uint256 toIdSeed,
    uint256 amount
) public {
    // bound actors/ids/amounts against ghost state, then call convert(fromId, toId, amount, to)
    // on success: ghost_convertCalls++, no supply-affecting ghost var changes (I2 neutrality)
}
```

**Bound the depth gate** in `handler_mint1155` (line 465): if the fuzzed `tokenId` is at depth ≥2, expect revert (D6). The handler must NOT count a reverted depth-2 mint as a successful action.

**Ghost variables** (existing lines 14-21): add `ghost_totalConverted` for call-count tracking; conservation invariants (I1/I2) are enforced by the invariant contract reading `totalSupply(id)` directly, not by ghost sums.

---

### 11. `test/foundry/invariant/` (NEW invariant contract for I1/I2/I3/I5)

**Analogs:** `test/foundry/invariant/EconomicInvariant.t.sol`, `NFTFactoryInvariant.t.sol` (role-match — same directory, same harness)

**Pattern:** inherit from `GeniusDiamondTestBase`, wire `targetContract(address(handler))` in `setUp`, write `invariant_*` functions that read live diamond state. No code excerpt included here — the analog files are short and self-describing; the planner should read them at plan time.

---

## Shared Patterns

### Diamond storage (keccak256-slotted Layout library)

**Source:** `GNUSNFTFactoryStorage.sol:22-42`, `GNUSWithdrawLimiterStorage.sol:34-88`
**Apply to:** All new storage libraries (GNUSTreasuryStorage) and struct appends (NFT)

Every storage library follows: `library X { struct Layout { ... }; bytes32 constant X_STORAGE_POSITION = keccak256("..."); function layout() internal pure returns (Layout storage l) { bytes32 slot = X_STORAGE_POSITION; assembly { l.slot := slot } } }`.

**Append-only evolution rule:** never reorder existing struct fields; new fields go at the END. Cross-phase coordination with Phase 13 recorded in D7 ("whichever lands second appends after the other").

### Super-admin bypass convention (limiter)

**Source:** `GNUSBridge.sol:181-187` (withdraw — being deleted), `GNUSERC1155MaxSupply.sol:77-83` (hook), `GeniusAccessControl.sol:73-76` (modifier)
**Apply to:** `GNUSTreasury.convert` GNUS-terminal leg

```solidity
if (LibDiamond.diamondStorage().contractOwner != sender) {
    GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(sender, amount);
} else {
    emit GNUSWithdrawLimiterStorage.SuperAdminBypass(sender, amount, "<context string>");
}
```

The context string identifies the call site (`"GNUSTreasury.convert"`, `"GNUSBridge.bridgeOut"`, etc.) for audit.

### Role gates

**Source:** `GeniusAccessControl.sol:73-76` (`onlySuperAdminRole`), `GNUSControl.sol:50,56` (`onlyRole(DEFAULT_ADMIN_ROLE)`)
**Apply to:** `GNUSTreasury_Initialize300` (`onlySuperAdminRole`), `syncGlobalSupply` (`onlyRole(DEFAULT_ADMIN_ROLE)`)

### Versioned initializer convention

**Source:** `DiamondInitFacet.sol:36-57` (`diamondInitialize250`), `GNUSControl.sol:51-64` (`GNUSControl_Initialize230`), `GNUSNFTFactory.sol:39-45` (`GNUSNFTFactory_Initialize230`)
**Apply to:** `GNUSTreasury_Initialize300`

Each protocol version gets its own uniquely-named initializer so upgrades target one and prior initializers are never re-executed. Guard mechanism varies: DiamondInitFacet uses InitLog + role grants (idempotent), GNUSControl uses version compare, GNUSTreasury uses one-shot bool (`provenanceInitialized`).

### `require`-based validation (no custom errors)

**Source:** All of `contracts/gnus-ai/` — the codebase uses string-message `require`, not Solidity custom errors
**Apply to:** All new code in GNUSTreasury / GNUSNFTFactory / GNUSBridge edits

Examples: `"Token not created."`, `"Creator or Admin can only mint NFT"`, `"Only SuperAdmin allowed"`, `"Max Supply for NFT would be exceeded"`. Match this style; do NOT introduce `error Foo();` syntax in this phase.

### `_msgSender()` over `msg.sender`

**Source:** All facets (GNUSBridge.sol:163, 210; GNUSNFTFactory.sol:60, 84, 153)
**Apply to:** All new external/public functions on GNUSTreasury

The diamond pattern routes through a proxy — `_msgSender()` (from `ContextUpgradeable`) is the canonical way to recover the original caller.

### `using X for X.Layout` declaration

**Source:** `GNUSBridge.sol:19-21`, `GNUSNFTFactory.sol:16-17`, `GNUSERC1155MaxSupply.sol:20-21`
**Apply to:** GNUSTreasury facet

Declare `using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;` etc. at the top of the facet even though `layout()` is called statically — matches existing convention.

---

## No Analog Found

Files with no close match in the codebase (planner should rely on RESEARCH.md §B + the new-facet skeleton in RESEARCH "Code Examples"):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Two-diamond fixture for I3 cross-chain provenance test | test fixture | two `LocalDiamondDeployer` instances in one test | No existing test deploys two diamonds side-by-side. Pattern: extend the single-diamond fixture from `GNUSBridge.test.ts:58-105` to a second `diamondName` + separate `LocalDiamondDeployerConfig`. RESEARCH §I (I3) is the spec. |
| Global-supply counter + `totalSupplyOfAll()` view | facet view | read-side counter | Greenfield — grep for `bridgeIn\|totalSupplyOfAll\|globalSupply` returns zero hits in `contracts/`. RESEARCH §B is the authoritative design; the skeleton at RESEARCH "Code Examples" (lines 524-596 of 09-RESEARCH.md) is the planner reference. |

---

## Metadata

**Analog search scope:** `contracts/gnus-ai/`, `test/unit/`, `test/foundry/`, `diamonds/GeniusDiamond/`
**Files scanned:** ~25 (8 contract files read in full, 3 test files sampled, 1 config file read, 1 foundry base + handler sampled, directory listings of test trees)
**Pattern extraction date:** 2026-08-04

**Key line-number anchors (verified this session):**

- GNUSBridge.sol — `_mintWithBridgeFee`: 77-89; 2-arg `mint`: 97-99; 3-arg `mint`: 108-110; `burn`: 118-121; `_mint` override: 137-155; `withdraw` (DELETED): 162-191; `bridgeOut`: 203-242; `totalSupply()` facade: 250-252; `_safeTransferFrom`: 369-394
- GNUSNFTFactory.sol — `GNUSNFTFactory_Initialize`: 24-37; `GNUSNFTFactory_Initialize230`: 41-45; `beforeMint`: 83-94; `mint`: 102-106; `mintBatch`: 114-121; `createNFTs`: 152-181; `getNFTInfo`: 187-190
- GNUSNFTFactoryStorage.sol — `NFT` struct: 10-19; Layout + slot: 22-42
- GNUSERC1155MaxSupply.sol — `_beforeTokenTransfer` hook: 32-85 (isMinting: 45; GNUS aggregation: 50; max-supply check: 58-63; limiter block: 75-84); WR-03/WR-07 comments: 66-74
- GNUSWithdrawLimiterStorage.sol — Layout: 37-44; slot: 47-48; `checkAndRecordWithdraw`: 192-242; `SuperAdminBypass` event: 66
- GNUSControl.sol — `GNUSControl_Initialize230`: 56-64; MAX_FEE: 24
- GNUSConstants.sol — `GNUS_DECIMALS`: 17; `GNUS_MAX_SUPPLY`: 21; `GNUS_TOKEN_ID`: 29; `PARENT_MASK`: 37; `CHILD_MASK`: 41
- DiamondInitFacet.sol — `diamondInitialize250`: 43-57; `initializeGNUSWithdrawLimiter`: 61-67
- GeniusAccessControl.sol — `onlySuperAdminRole`: 73-76; `UPGRADER_ROLE`: 15
- geniusdiamond.config.json — protocolVersion: 2; facets block: 5-124; GNUSBridge entry: 90-98; DiamondInitFacet entry: 105-123
