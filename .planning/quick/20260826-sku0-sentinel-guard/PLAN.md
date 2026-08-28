---
type: quick
slug: sku0-sentinel-guard
created: 2026-08-26
requirements: [LIC-03, LIC-05]
---

# Quick: SKU id 0 sentinel guard on createLicense

## Problem

`_finalizeLicense` writes `licenseSku[licenseId] = skuId` (GNUSLicensingPurchase.sol:345).
`renewLicense` (:372) and `purchaseCredits` (:171) treat `licenseSku[licenseId] == 0` as
"not a license". If an operator configures SKU id 0 with `createsLicense: true` and runs
`createLicense(0, ...)`, the stored 0 is indistinguishable from the sentinel: the license is
permanently non-renewable and its credits unpurchasable (bricked license — liveness bug
logged in 14-SECURITY.md).

PD-BR-1..8 (Phase 10 bridgeIn amendment) was checked and is intentionally NOT in scope:
#363 still OPEN, and the proposals amend locked Phase 10 CONTEXT — phase-sized work.

## Fix (minimal, root cause at the write-path invariant)

- New named constant `_ERR_SKU_ID_ZERO = "SKU id zero is reserved"` in
  GNUSLicensingPurchase.sol constants block.
- In `createLicense`'s SKU validation block (beside `require(sku.active && sku.createsLicense,
  _ERR_NOT_LICENSE_SKU)`): add `require(skuId != 0, _ERR_SKU_ID_ZERO)` — forbids writing the
  sentinel value into the registry. Credit/renewal SKUs at id 0 remain legal (their ids are
  never stored in `licenseSku`).

## Tests (RED → GREEN, no mocks — real diamond fixture)

- `createLicense` under a configured SKU id 0 reverts `"SKU id zero is reserved"`; no NFT
  created (child count unchanged).
- Existing suite untouched; full Hardhat run must stay 605 passing / 2 pending / 1
  known-stale failing (GNUSControlStorage chainID — never fix).

## Files

- contracts/gnus-ai/GNUSLicensingPurchase.sol (constant + guard)
- test/unit/GNUSLicensing.test.ts (regression test)

## Commits

Nested contracts/gnus-ai on develop (no -S local signing), then outer gnus-ai pointer bump
+ test + docs.
