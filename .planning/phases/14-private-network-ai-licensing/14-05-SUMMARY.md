---
phase: 14-private-network-ai-licensing
plan: "05"
subsystem: licensing-purchase
tags: [licensing, network-key, gap-closure, sku-split, append-only]
requires:
  - "14-01 NFT struct fields (companyAdmin/privateNetworkId/networkScope/publicSettlementEnabled)"
  - "14-02 SKU registry (GNUSLicensingTypes/Storage)"
  - "14-03 purchase facet (purchaseCredits/createLicense/renewLicense)"
provides:
  - "createLicense zero/duplicate privateNetworkId rejection (networkIdToLicense uniqueness registry)"
  - "purchaseCredits lazy network-id propagation onto zero-default credit tokens + mismatch revert"
  - "Split-mint SKUs: private leg (creditAmount) + public leg (publicCreditAmount → license child index 1) behind ONE price burn"
affects: []
tech-stack:
  added: []
  patterns:
    - "Uniqueness claim checked pre-creation, registry written at finalization (licenseId unknown before creation)"
    - "Lazy propagation of CREATOR-gated provenance by permissionless callers (D-27-safe: value never caller-supplied)"
    - "Fixed-in-SKU leg amounts — buyer picks SKUs, never amounts (research question #5 resolution)"
key-files:
  created: []
  modified:
    - contracts/gnus-ai/GNUSLicensingTypes.sol
    - contracts/gnus-ai/GNUSLicensingStorage.sol
    - contracts/gnus-ai/GNUSLicensing.sol
    - contracts/gnus-ai/GNUSLicensingPurchase.sol
    - test/unit/GNUSLicensing.test.ts
decisions:
  - "Zero-amount legs skip _applyCreditRenewal AND the mint — a zero-mint would start a renewal clock on a token the buyer received nothing of"
  - "Public leg = license child index 1, created by the operator through the EXISTING createNFTWithLifecycle (no lazy creation in the purchase facet)"
  - "Buyer-chosen splits DEFERRED; per-leg amounts fixed in the CREATOR/ADMIN-gated SKU"
metrics:
  duration: "~2h"
  completed: 2026-08-25
---

# Phase 14 Plan 05: Network-Key Mint Validation + Split-Mint SKU Summary

Closes the network-key mint-validation gap: privateNetworkId (the network's raw-uint256 Ed25519
pubkey) is now zero/duplicate-rejected at license creation, lazily propagated + consistency-checked
onto credit tokens at purchase, and split-mint SKUs mint private + public legs in one transaction
behind one price burn.

## What Was Built

- **GNUSLicensingTypes.sol** — appended `uint256 publicCreditAmount` to `SKU` after `active`
  (zero-default = private-only, decode-compatible). `creditAmount` documented as the PRIVATE leg.
- **GNUSLicensingStorage.sol** — appended `networkIdToLicense` after `licenseSku` (uniqueness
  registry; 0 = unclaimed sentinel).
- **GNUSLicensing.sol** — `configureSKU` gate: credit SKUs must mint at least one leg
  ("SKU mints no credits"); license/renewal SKUs unaffected.
- **GNUSLicensingPurchase.sol** —
  - `createLicense`: `privateNetworkId != 0` + unclaimed-network requires pre-creation; registry
    write in `_finalizeLicense` (where licenseId exists; license ids always nonzero).
  - `purchaseCredits`: lazy propagation (zero → write license value) / mismatch revert
    ("Credit network mismatch"); private leg guarded by `sku.creditAmount > 0`; public leg
    (`(licenseId << 128) | 1`) gated on existence + network-zero ("Public credit token not
    created" / "Public credit network mismatch"), same verifier/renewal/shared-hook mint
    discipline, ONE `_burnPayment` (D-10 exact delta preserved).
  - Facet header @dev documents the gap-closure rules + the deferred buyer-chosen split.

## Tasks & Commits (nested submodule contracts/gnus-ai, develop)

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 (RED) + 2 | 80150db | SKU append + registry + configure gate; 7 gap tests RED (compiled with the types change per plan guidance) |
| 3 (GREEN) | 4423300 | Purchase-facet network validation + split mint |

Middle-repo (gnus-ai) commits: b2b0914 (test file RED), pointer bump + planning docs (final).

## Verification

- `npx hardhat test test/unit/GNUSLicensing.test.ts` → **22 passing** (14 original + 8 gap-closure), 0 failing.
- Full `npx hardhat test` → **601 passing / 2 pending / 1 failing** (known-stale GNUSControlStorage chainID — untouched, never fixed). Matches the plan-predicted 593+8.
- Bytecode (EIP-170): GNUSLicensingPurchase **12,767 B**; GNUSLicensing **8,213 B** (artifact bytecode; both ≤ 24,576 — no helper-split fallback needed).
- Append-only audit: `git diff develop~2 develop` on GNUSNFTFactoryStorage.sol empty (frozen slots +11..+13 untouched); Types/Storage diffs are additions after the last pre-existing field only.
- No "2.7" in geniusdiamond.config.json; pragma ^0.8.19 unchanged; protocolVersion 2.6.

## Deviations from Plan

- **Plan ordering (allowed by Task 1 action note):** the RED test commit landed together with the
  Task 2 types/storage/gate changes — the suite cannot compile without the appended
  `publicCreditAmount` field. RED was confirmed against the types change: 15 passing / 7 failing
  for the exact new-revert reasons (test 8, the configureSKU gate, was GREEN immediately because
  its code belongs to Task 2).
- **[Checker refinement 1 applied]** explicit `if (sku.creditAmount > 0)` guard around the private
  leg's renewal + mint (never zero-mint).
- **[Checker refinement 2 applied]** round-trip test renamed to cover all eight fields.

None others — plan executed as written.

## TDD Gate Compliance

RED gate: b2b0914 (test commit, 7 assertion-level failures confirmed). GREEN gate: 4423300.
Sequence valid.

## Known Stubs

None.

## Self-Check: PASSED

All modified files exist on disk; commits 80150db + 4423300 verified in the nested submodule
(contracts/gnus-ai, develop) and b2b0914 in the middle repo.
