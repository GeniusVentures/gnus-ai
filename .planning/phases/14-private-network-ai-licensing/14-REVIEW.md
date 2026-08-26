---
phase: 14-private-network-ai-licensing
reviewed: 2026-08-25T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - contracts/gnus-ai/GNUSLicensingTypes.sol
  - contracts/gnus-ai/GNUSLicensing.sol
  - contracts/gnus-ai/GNUSLicensingStorage.sol
  - contracts/gnus-ai/GNUSLicensingPurchase.sol
  - contracts/gnus-ai/GNUSNFTFactoryStorage.sol
  - contracts/gnus-ai/GNUSBridge.sol
  - test/unit/GNUSLicensing.test.ts
  - test/unit/GNUSLifecycleUpgrade.test.ts
  - test/unit/GNUSBridgePolicy.test.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-08-25
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Phase 14 licensing facets (types/storage/registry/purchase), the NFT-struct append, the D-24/D-23 SOULBOUND bridge gate, and the three test suites. Overall the implementation is disciplined: CEI ordering in the purchase path is correct (credential verifier before burn, `_applyCreditRenewal` pre-mint, `_burnPayment` before any extension), the split-mint accounting holds one burn for both legs, the network-id uniqueness claim is atomic within `createLicense`, and the D-24 bridge carve-out correctly gates roles plus both expiration modes before the limiter charge.

One Critical finding: `renewLicense` is permissionless but performs exactly the mutation that `GNUSLifecycle.setValidUntil` reserves behind CREATOR_ROLE/ADMIN — with only an `nftCreated` check, no verification that the target IS a license. Any caller paying a renewal-SKU price can extend `validUntil` on ANY created NFT and emit a forged-semantics `LicenseActivated` for it.

## Critical Issues

### CR-01: Permissionless `renewLicense` mutates `validUntil` on ANY created NFT — bypasses role-gated `setValidUntil` and forges `LicenseActivated`

**File:** `contracts/gnus-ai/GNUSLicensingPurchase.sol:347-364`
**Issue:** `renewLicense(skuId, licenseId)` requires only (a) an active `renewsLicense` SKU and (b) `NFTs[licenseId].nftCreated`. It never verifies the target is a license NFT — there is no check against `GNUSLicensingStorage.layout().licenseSku[licenseId] != 0` (the governing-license registry that IS written in `_finalizeLicense:328` but never read anywhere in the codebase), no check that the NFT was created via `createLicense`, and no parent/scope check. Consequences for any buyer with `priceInMinions` GNUS:

1. The exact mutation `nft.validUntil = <new value>` is gated behind CREATOR_ROLE/ADMIN on every other surface (`GNUSLifecycle.setValidUntil:252` uses `_requireCreatorOrAdmin`). A permissionless caller can extend `validUntil` on any token, including non-license tokens and even `GNUS_TOKEN_ID` itself if its record is `nftCreated`.
2. For a PerTokenId token whose mint gate had legitimately closed ("Sale ended" via `validUntil`), renewal re-opens the mint window on that token — an unintended reactivation path.
3. `emit LicenseActivated(nft.companyAdmin, licenseId, nft.privateNetworkId, newExpiry)` is emitted for a non-license token id. D-14 makes this event the SOLE SuperGenius-side license-state source; since credit tokens lazily carry the license's `privateNetworkId`, a permissionless caller can emit `LicenseActivated` for an arbitrary token id with a legitimate-looking network key — poisoning the SG cross-system event stream.

The facet's own doc (line 344: "any such SKU may renew any license") states license-to-license generality, but the code does not even check "license".

**Fix:** Bind renewal to licenses created through the licensing facet:

```solidity
GNUSLicensingStorage.Layout storage ls = GNUSLicensingStorage.layout();
require(ls.licenseSku[licenseId] != 0, "Not a license token");
```

(and optionally verify the SKU mode matches the stored governing SKU family, or at minimum that `nft.parentId == GNUS_TOKEN_ID` and `nft.expirationMode == uint8(ExpirationMode.PerTokenId)`). Add a regression test: renewing a non-license created NFT (e.g. a credit token id) reverts; renewing `GNUS_TOKEN_ID` reverts.

## Warnings

### WR-01: `purchaseCredits` has no license-expiry gate — credits are purchasable under an EXPIRED license

**File:** `contracts/gnus-ai/GNUSLicensingPurchase.sol:165-168`
**Issue:** The license lookup checks only `licenseNft.nftCreated`. The license's PerTokenId `validUntil` is never consulted. A tenant whose license expired long ago can still permissionlessly buy and mint fresh PerHolder credits under it (the shared hook's "Sale ended" gate keys on the CREDIT token's own `validUntil`, which is 0 in PerHolder mode, so nothing stops the mint). CONTEXT D-14 says expiry enforcement is SG-side, but D-23's rationale ("expired value must not reach SuperGenius") argues symmetric EVM-side gating; at minimum the purchase path should not mint new private-network entitlements for an expired network identity. Either gate here or record the decision explicitly in CONTEXT.

**Fix:** After the `nftCreated` check:

```solidity
require(
    licenseNft.validUntil == 0 || block.timestamp < licenseNft.validUntil,
    "License expired"
);
```

### WR-02: `licenseSku` registry is write-only — dead storage that masks CR-01

**File:** `contracts/gnus-ai/GNUSLicensingStorage.sol:19-20`, `contracts/gnus-ai/GNUSLicensingPurchase.sol:328`
**Issue:** `licenseSku[licenseId] = skuId` is written in `_finalizeLicense` and documented as "renewal SKUs look up their governing license", but no code path ever reads it (grep across `contracts/gnus-ai/` confirms the only non-declaration reference is the write). It is dead state today and its unusedness is precisely what allowed CR-01. If the governing-SKU semantics are deferred, annotate as such; otherwise consume it (see CR-01 fix).

**Fix:** Read it in `renewLicense` as the license-identity check (CR-01), or remove/re-document the mapping until it has a consumer.

### WR-03: Public-only SKU still hard-requires the private first-child token and runs its verifier with `amount = 0`

**File:** `contracts/gnus-ai/GNUSLicensingPurchase.sol:166-168, 182-187`
**Issue:** For a `creditAmount == 0` SKU (public-only), the code still requires `(licenseId << 128) | 0` to exist (`_ERR_CREDIT_TOKEN_MISSING`) and still calls its credential verifier with `sku.creditAmount == 0` — a verifier leg for a leg that will never be minted. Two effects: (a) operators must create a private credit token even for pure-public offerings; (b) a verifier with an `amount > 0` expectation rejects valid public-only purchases, while a permissive verifier is consulted with meaningless arguments. The private-leg existence check and verifier call should be inside the `sku.creditAmount > 0` guard (the network-id propagation, by contrast, is reasonable to keep unconditional since it binds the token for future use).

**Fix:** Move lines 167-168 (private token existence) and 182-187 (private verifier) inside `if (sku.creditAmount > 0) { ... }`; keep the network-propagation block where it is.

## Info

### IN-01: Unused import `IERC20Upgradeable` in GNUSLicensingPurchase

**File:** `contracts/gnus-ai/GNUSLicensingPurchase.sol:4`
**Issue:** The import is referenced only in comments (lines 124, 129); the local topic-equal `Transfer`/`Approval` declarations make it unnecessary. Dead import.
**Fix:** Delete line 4.

### IN-02: `networkScope` is not propagated/validated on credit tokens — only `privateNetworkId`

**File:** `contracts/gnus-ai/GNUSLicensingPurchase.sol:174-178`
**Issue:** A license created `PrivateOnly`/`Hybrid` propagates its network id onto the credit token, but the credit token's own `networkScope` remains the zero default (`PublicOnly`). Downstream consumers reading token-level scope see "public" on a private-network-bound credit. Cosmetic today (no on-chain scope consumer), but an inconsistent record.
**Fix:** Also propagate/validate `networkScope` in the same block, or document that scope is license-level only.

### IN-03: Misleading test name — "renewal by a non-governing SKU" tests a wrong-TYPE SKU, not a non-governing renewal SKU

**File:** `test/unit/GNUSLicensing.test.ts:530-537`
**Issue:** The test reverts on `SKU does not renew licenses` (a credit SKU — type gate), which is fine, but no test covers the actual governing relationship (renewing a license through an unrelated `renewsLicense` SKU, or — once CR-01 is fixed — renewing a non-license token). Rename and extend after the CR-01 fix.
**Fix:** Rename to "credit SKU cannot renew"; add the CR-01 regression test.

---

_Reviewed: 2026-08-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
