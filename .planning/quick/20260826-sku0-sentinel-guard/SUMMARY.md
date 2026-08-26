---
status: complete
slug: sku0-sentinel-guard
completed: 2026-08-26
files_changed:
  - contracts/gnus-ai/GNUSLicensingPurchase.sol
  - test/unit/GNUSLicensing.test.ts
commits:
  nested: 1554c34
---

# Quick: SKU id 0 sentinel guard — COMPLETE

`createLicense` now rejects `skuId == 0` ("SKU id zero is reserved") beside the existing
SKU checks, closing the 14-SECURITY.md informational: a license created under SKU id 0
would write the not-a-license sentinel into `licenseSku` and brick itself (non-renewable,
credits unpurchasable). Credit/renewal SKUs at id 0 remain legal.

- Regression test: configured SKU id 0 → `createLicense` reverts, `childCurIndex`
  unchanged (real diamond fixture, no mocks).
- Full suite: **606 passing / 2 pending / 1 failing** (known-stale GNUSControlStorage
  chainID — untouched). Was 605/2/1.
- EIP-170: GNUSLicensingPurchase 22,919 B ≤ 24,576 B.
- Out of scope (checked, intentionally not done here): PD-BR-1..8 Phase 10 bridgeIn
  amendment — SuperGenius#363 still OPEN, and the proposals amend locked Phase 10
  CONTEXT; belongs to a future phase (natural Phase 15 candidate).
