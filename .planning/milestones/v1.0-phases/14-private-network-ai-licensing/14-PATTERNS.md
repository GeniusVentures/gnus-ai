# Phase 14: Private-Network AI Licensing - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 9 (6 new, 3 modified, plus 2 docs amendments)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (modify: D-03 append) | model/storage | CRUD | Phase 13 append block (same file, lines 22-33) | exact |
| `contracts/gnus-ai/GNUSLicensingTypes.sol` (new) | model/types | — | `GNUSLifecycleTypes.sol` | exact |
| `contracts/gnus-ai/GNUSLicensingStorage.sol` (new) | model/storage | CRUD | `GNUSLifecycleStorage.sol` | exact |
| `contracts/gnus-ai/GNUSLicensing.sol` (new) | facet (registry/config) | CRUD | `GNUSLifecycle.sol` (config facet half of split) | exact |
| `contracts/gnus-ai/GNUSLicensingPurchase.sol` (new) | facet (payment/mint rail) | request-response | `GNUSLifecycleMint.sol` (mint facet half of split) | role-match |
| `contracts/gnus-ai/GNUSBridge.sol` (modify: `_enforceBridgePolicy` D-24 gate) | facet (bridge policy) | request-response | same file, existing `_enforceBridgePolicy` | exact |
| `test/unit/GNUSLicensing.test.ts` (new) | test | CRUD + payment | `test/unit/GNUSLifecycleAICredits.test.ts` | exact |
| `test/unit/GNUSLifecycleUpgrade.test.ts` (extend slot probe) | test | file-I/O (storage probe) | same file, Phase 13 slot-probe | exact |
| `test/unit/GNUSBridgePolicy.test.ts` (extend) | test | request-response | same file, Phase 13 D7 tests | exact |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` (modify) | config | — | `GNUSLifecycle`/`GNUSLifecycleMint` entries | exact |
| `.planning/REQUIREMENTS.md` LIC-04, `.planning/ROADMAP.md` SC4/SC7 (docs amend) | docs | — | prior phase amendment precedent | role-match |

## Pattern Assignments

### `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (modify — D-03 struct append)

**Analog:** same file, Phase 13 append block (lines 22-33)

**Append discipline** — banner comment + slot-annotated fields (copy lines 22-25 structure):
```solidity
// Phase 13 appends below - do not reorder, do not insert above this line
// Slot annotations verified by storage probe in GNUSLifecycleUpgrade.test.ts (IN-04, 13 review):
// nonConvertible (1B) + 3x uint64 (24B) + 3x uint8 (3B) = 28B pack into slot +8;
// the two addresses occupy full slots +9 and +10.
```
Phase 14 appends AFTER line 33 (`credentialVerifier`, slot +10):
- `address companyAdmin` → slot +11 (D-25)
- `uint256 privateNetworkId` → slot +12 (full slot; uint256 cannot share)
- `uint8 networkScope` + `bool publicSettlementEnabled` → packed into slot +13 (1B + 1B)

Follow the existing Doxygen style: `///< D-03/PD-3 — ...; 0 = PublicOnly (zero-default)`. Note the uint256 field must occupy its own slot — ordering of the two packed 1-byte fields after it is flexible, but declare them adjacent.

---

### `contracts/gnus-ai/GNUSLicensingTypes.sol` (new — NetworkScope enum, SKU struct, LicenseActivated event)

**Analog:** `contracts/gnus-ai/GNUSLifecycleTypes.sol` — pure types file, no imports, `pragma solidity ^0.8.19`, SPDX MIT, `@custom:security-contact support@gnus.ai`, enum ordinals documented with zero-default semantics. Define:
- `enum NetworkScope { PublicOnly, PrivateOnly, Hybrid }` (D-03 — PublicOnly = 0 is the zero default)
- `struct SKU { uint256 priceInMinions; uint256 creditAmount; uint64 duration; bool createsLicense; bool renewsLicense; bool active; }` (D-04 — no `priceUsd`)
- `event LicenseActivated(address indexed companyAdmin, uint256 indexed licenseId, uint256 privateNetworkId, uint64 expiresAt)` (D-14 — field order is the SG cross-system contract; do not reorder)

---

### `contracts/gnus-ai/GNUSLicensingStorage.sol` (new — diamond storage library)

**Analog:** `contracts/gnus-ai/GNUSLifecycleStorage.sol` (41 lines — copy wholesale structure)

**Layout pattern** (lines 10-41 of analog):
```solidity
library GNUSLicensingStorage {
    /// @dev Field order is load-bearing for append-only compatibility — Phase 15+ appends after these.
    struct Layout {
        mapping(uint256 => SKU) skus;            // D-04 registry
        mapping(uint256 => uint256) licenseSku;  // license token id → SKU id (planner's discretion on shape)
    }
    bytes32 constant GNUS_LICENSING_STORAGE_POSITION = keccak256("gnus.ai.licensing.storage");
    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_LICENSING_STORAGE_POSITION;
        assembly { l.slot := slot }
    }
}
```
Pure library, no imports (analog header states "Pure library with no imports — mirrors GNUSTreasuryStorage precedent").

---

### `contracts/gnus-ai/GNUSLicensing.sol` (new — registry facet: SKU CRUD, views)

**Analog:** `contracts/gnus-ai/GNUSLifecycle.sol` (config facet of the 13-03 split)

**Contract header pattern** (lines 1-36): imports of `GNUSERC1155MaxSupply`, `GeniusAccessControl`, `GNUSConstants`, `GNUSNFTFactoryStorage`, storage + types files; facet-split Doxygen paragraph ("this facet owns configuration + read paths only. Minting lives on the sibling facet. The two facets NEVER call each other — they share state only through diamond storage"); local re-declaration of `_CREATOR_ROLE = keccak256("CREATOR_ROLE")` to avoid the circular import (lines 33-36).

**Auth pattern** (lines 86-92) — creator-or-admin helper:
```solidity
function _requireCreatorOrAdmin(NFT storage nft, address sender) internal view {
    require(nft.nftCreated, "Token not created");
    require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Only creator or admin");
}
```
SKU CRUD gates on `hasRole(_CREATOR_ROLE, sender) || hasRole(DEFAULT_ADMIN_ROLE, sender)` (D-12 / Claude's discretion — no new roles).

**Event pattern** (lines 50-79): every state mutation emits a NatSpec-documented event with `indexed id` + `indexed operator` (`LifecycleConfigured`, `PerWalletCapSet`). Mirror with `SKUConfigured(uint256 indexed skuId, SKU sku, address indexed operator)` / `SKUActiveToggled(...)`.

**supportsInterface** (lines 45-48): copy the triple-OR diamond-aware override verbatim.

---

### `contracts/gnus-ai/GNUSLicensingPurchase.sol` (new — purchase/renewal rail facet)

**Analog:** `contracts/gnus-ai/GNUSLifecycleMint.sol` (action facet of the split)

**Purchase validation** — reuse `createNFTWithLifecycle`'s gate ordering rather than writing lifecycle storage directly (Pitfall 3): enum range checks + PerHolder non-transferable + balance-removing-disposition gates live at `GNUSLifecycle.sol:356-379` and fire automatically when SKU-driven creation routes through the same creation path. NEVER write `GNUSNFTFactoryStorage` lifecycle fields or `GNUSLifecycleStorage` from the purchase facet except where the analog mint path does.

**PerHolder credit top-up gets renewal free:** `_applyPerHolderRenewal` (`GNUSLifecycleMint.sol:219-250`) already extends `holderExpiresAt` on the mint path — copy its clock-stacking semantics commentary (D3 branches: active → extend; expired → settle-first then fresh clock; CEI clears clock before dispatch).

**Mint gates inherited via `_checkMintPolicy`** (`GNUSLifecycleMint.sol:149-167`): "Sale not started" / "Sale ended" (PerTokenId `validUntil`) and credential-verifier-last ordering. The permissionless purchase MUST route through the policy hook's mint branch so `perWalletMintCap`/window gates still apply (Pitfall 6).

**Renewal (license PerTokenId `validUntil`):** extend to `max(current, block.timestamp) + duration` and re-emit `LicenseActivated` (LIC-05) — implement internally against storage; do NOT widen the role-gated `setValidUntil` external setter (follows the analog's "internal — callable only from this facet's mint path" discipline, line 131).

**Payment burn (D-10, new — no full analog):** `IERC20 safeTransferFrom(buyer, address(diamond), priceInMinions)` then burn the diamond's ERC-1155 id-0 balance through the existing burn machinery so `totalSupply` decreases. Reference burn internals: `GNUSBridge._burn(user, GNUS_TOKEN_ID, amount)` + `GNUSTreasuryStorage` globalSupply/chainSupply decrements (`GNUSBridge.sol:178-186`). Do NOT use `GNUSTreasury.convert()` (supply-neutral — Pitfall 5). Test must assert GNUS totalSupply delta == priceInMinions.

---

### `contracts/gnus-ai/GNUSBridge.sol` (modify — `_enforceBridgePolicy` D-24 gate)

**Analog:** same function, `GNUSBridge.sol:304-332`. The change sits in the final fallthrough (lines 330-331):

```solidity
// SOULBOUND, ISSUER_ONLY, CONTROLLED_RESALE: non-bridgeable in v1 (D7).
revert("Policy-bound token cannot bridge in v1");
```
becomes: SOULBOUND permitted when the caller holds CREATOR_ROLE/ADMIN_ROLE (D-24 operator-mediated mint→bridge) AND is unexpired (D-23 gate — PerTokenId `nft.validUntil`; PerHolder via `GNUSLifecycleStorage.layout().holderExpiresAt[id][sender]`, mirroring "Sale ended" at `GNUSLifecycleMint.sol:155`). ISSUER_ONLY / CONTROLLED_RESALE keep the revert.

**Ordering constraint (Pitfall 2):** the call site at `bridgeOut` line 251 runs `_enforceBridgePolicy` BEFORE the limiter charge and `_burn` — keep it there so a revert consumes no limiter allowance. Do NOT touch `GNUSLifecyclePolicy`'s burn carve-out (lines 186-190, always-returns): expired burn/settlement on EVM stays permitted by design.

Role checks: import-free pattern — `GeniusAccessControl` is already a base of GNUSBridge; use `hasRole(DEFAULT_ADMIN_ROLE, sender)` / local `_CREATOR_ROLE` constant (same value as `GNUSLifecycle.sol:36`).

---

### `test/unit/GNUSLicensing.test.ts` (new)

**Analog:** `test/unit/GNUSLifecycleAICredits.test.ts` (Phase 13 AI-Credits suite — same actor model: deployer/admin, creator, holder/device wallet). Cover: LIC-01 grandchild auth (parent-creator gate at `GNUSLifecycle.sol:351-353`), LIC-03 SKU CRUD + `active` gating + role reverts, LIC-04 purchase (totalSupply delta, mints to `deviceWallet`, reverts on inactive SKU / insufficient allowance), LIC-05 `LicenseActivated` on create + renewal with correct expiry.

### `test/unit/GNUSLifecycleUpgrade.test.ts` (extend — LIC-02 slot probe)

**Analog:** same file, lines 56-84 and 252-345 — `eth_getStorageAt` probe with `FACTORY_STORAGE_SLOT = keccak256("gnus.ai.nft.factory.storage")`, `nftSlot(tokenId, offset)` helper, known-pattern writes to packed slots, plus the "legacy token behaviorally unchanged after zeroing slots" test (line 347). Extend to slots +11/+12/+13; verify zero-default decode (PublicOnly/0/false) for pre-Phase-14 records. Note the file's own lesson (lines 77-80): the plan-13-01 spec assumed wrong offsets and the probe corrected them — write the probe assertions from the declared field order, then fix from compiled bytecode if they disagree.

### `test/unit/GNUSBridgePolicy.test.ts` (extend — D-24/D-23)

**Analog:** same file, Phase 13 D7 test block. Add: expired SOULBOUND holder `bridgeOut` reverts; unexpired CREATOR/ADMIN SOULBOUND passes; non-privileged SOULBOUND still reverts ("Policy-bound token cannot bridge in v1"); ISSUER_ONLY unchanged; expired burn path still permitted (regression for Pitfall 2).

---

### `diamonds/GeniusDiamond/geniusdiamond.config.json` (modify)

**Analog:** `GNUSLifecycle` / `GNUSLifecycleMint` entries (lines 128-144). Exact pattern:
```json
"GNUSLicensing": {
  "priority": <next free after 121>,
  "versions": {
    "2.6": { "fromVersions": [0.0, 2.4, 2.5] }
  }
}
```
Same for `GNUSLicensingPurchase`. NEVER a 2.7 key (D-15). Run the existing diamond-abi regeneration pipeline (Wave 0 gap item).

## Shared Patterns

### Diamond storage access
**Source:** `GNUSNFTFactoryStorage.sol:44-56` / `GNUSLifecycleStorage.sol:29-40`
**Apply to:** all new facet/storage files
```solidity
bytes32 constant GNUS_LICENSING_STORAGE_POSITION = keccak256("gnus.ai.licensing.storage");
function layout() internal pure returns (Layout storage l) {
    bytes32 slot = GNUS_LICENSING_STORAGE_POSITION;
    assembly { l.slot := slot }
}
```

### Creator/Admin authorization
**Source:** `GNUSLifecycle.sol:36, 86-92` — local `_CREATOR_ROLE` constant (avoids circular import), `hasRole(DEFAULT_ADMIN_ROLE, ...)` fallback.
**Apply to:** `GNUSLicensing` (SKU CRUD), `GNUSLicensingPurchase` (license creation), `GNUSBridge` D-24 gate.

### Events as the cross-system contract
**Source:** `GNUSLifecycle.sol:50-79` (NatSpec `@param`-per-field, `indexed id` + `indexed operator`).
**Apply to:** `LicenseActivated` (LIC-05) — signature is the SG indexer contract (A3): `(companyAdmin, licenseId, privateNetworkId, expiresAt)` exactly.

### Facet-split discipline (D-16)
**Source:** `GNUSLifecycle.sol:14-30` header paragraph — sibling facets never call each other; shared state only via diamond storage; shared predicates go in compile-time-linked libraries (`GNUSLifecyclePolicy` precedent), never delegatecall trampolines.
**Apply to:** `GNUSLicensing` / `GNUSLicensingPurchase` pair. Bytecode budget ≤ 24,576 B each (D-18) — if the purchase facet grows, split further rather than trampolining.

### Versioning constraint (D-15)
New facets re-key into `versions["2.6"]`, fromVersions `[0.0, 2.4, 2.5]` — never 2.7.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| GNUS-burn payment pull (`GNUSLicensingPurchase` payment leg) | facet | request-response | No GNUS-paid mint exists (Phase 13 used treasury-direct operator minting). Compose from: ERC-20 `safeTransferFrom` + `GNUSBridge.sol:178-186` burn internals (globalSupply/chainSupply decrements). See Pitfall 5: assert totalSupply delta in tests. |

Docs amendments (REQUIREMENTS LIC-04, ROADMAP SC4/SC7 per D-26/D-29) have no code analog — wording-only edits.

## Metadata

**Analog search scope:** `contracts/gnus-ai/`, `test/unit/`, `diamonds/GeniusDiamond/`
**Primary analogs:** GNUSLifecycle.sol, GNUSLifecycleMint.sol, GNUSLifecycleStorage.sol, GNUSNFTFactoryStorage.sol, GNUSBridge.sol, GNUSLifecycleUpgrade.test.ts, GNUSLifecycleAICredits.test.ts, geniusdiamond.config.json
**Pattern extraction date:** 2026-08-25
