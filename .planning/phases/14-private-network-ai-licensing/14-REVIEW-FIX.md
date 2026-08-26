---
phase: 14-private-network-ai-licensing
fixed_at: 2026-08-25T00:00:00Z
review_path: .planning/phases/14-private-network-ai-licensing/14-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-08-25
**Source review:** .planning/phases/14-private-network-ai-licensing/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical, 3 Warning, 3 Info)
- Fixed: 7
- Skipped: 0

Contract fixes live in the nested `contracts/gnus-ai` submodule (commits below); tests live
in the outer gnus-ai repo. All commits signed, no Co-Authored-By.

## Fixed Issues

### CR-01: Permissionless `renewLicense` mutates `validUntil` on ANY created NFT

**Files modified:** `contracts/gnus-ai/GNUSLicensingPurchase.sol`, `test/unit/GNUSLicensing.test.ts`
**Commit:** 60964e0 (submodule), db5510a (test)
**Applied fix:** `renewLicense` now requires `GNUSLicensingStorage.layout().licenseSku[licenseId] != 0`
("Not a license token") — renewal is bound to tokens created through `createLicense`. This also
gives the `licenseSku` registry its first read (resolves WR-02's dead-storage concern without
deleting the mapping). Regression test: renewal on the company credit token id and on
`GNUS_TOKEN_ID` both revert "Not a license token"; forged-LicenseActivated path closed.
Status: fixed (logic fix — human-verified via new regression tests and full suite).

### WR-01: `purchaseCredits` has no license-expiry gate

**Files modified:** `contracts/gnus-ai/GNUSLicensingPurchase.sol`, `test/unit/GNUSLicensing.test.ts`
**Commit:** c3921e5 (submodule), a5ef8d7 (test)
**Applied fix:** After the `nftCreated` check: `require(licenseNft.validUntil == 0 || block.timestamp < licenseNft.validUntil, "License expired")`
(`validUntil == 0` = non-expiring). Test: purchase past the license expiry reverts with no burn/mint.

### WR-02: `licenseSku` registry is write-only dead storage

**Files modified:** none beyond CR-01
**Commit:** 60964e0 (submodule, via CR-01)
**Applied fix:** Resolved by CR-01 — the mapping is now read in `renewLicense` as the
license-identity check. Mapping retained (append-only storage untouched).

### WR-03: Public-only SKU hard-requires the private first-child token and runs its verifier with amount = 0

**Files modified:** `contracts/gnus-ai/GNUSLicensingPurchase.sol`, `test/unit/GNUSLicensing.test.ts`
**Commit:** 820b18a (submodule), c1f08a2 (test)
**Applied fix:** The private-leg existence require and the credential-verifier call moved inside
`if (sku.creditAmount > 0)` (before the payment burn, preserving CEI); the network-id propagation
block stays unconditional per the reviewer. Test: public-only SKU purchase succeeds after the
private token's `nftCreated` flag is zeroed via `hardhat_setStorageAt` (slot +6).

### IN-01: Unused import `IERC20Upgradeable`

**Files modified:** `contracts/gnus-ai/GNUSLicensingPurchase.sol`
**Commit:** 3a8dd65 (submodule)
**Applied fix:** Import removed (topic-equal local `Transfer`/`Approval` declarations remain).

### IN-02: `networkScope` not propagated onto credit tokens

**Files modified:** `contracts/gnus-ai/GNUSLicensingPurchase.sol`, `test/unit/GNUSLicensing.test.ts`
**Commit:** 40c854c (submodule), 865aa06 (test)
**Applied fix:** `creditNft.networkScope = licenseNft.networkScope` inside the existing
zero-default lazy-propagation branch (same append-safe pattern as the network id). Test: extended
the lazy-propagation test to assert scope propagation.

### IN-03: Misleading "non-governing SKU" test name

**Files modified:** `test/unit/GNUSLicensing.test.ts`
**Commit:** 865aa06
**Applied fix:** Renamed to "a credit SKU cannot renew (type gate)"; non-license renewal coverage
added by the CR-01 regression test.

## Verification

- `npx hardhat compile` — clean (1 file, evm paris).
- `npx hardhat test` — **604 passing / 2 pending / 1 failing**; the single failure is the
  known-stale `GNUSControlStorage` chainID test, explicitly out of scope. 601 baseline + 3 new
  tests (CR-01, WR-01, WR-03; IN-02 extended an existing test).
- Bytecode size: `GNUSLicensingPurchase` = 22,725 bytes ≤ 24,576 (EIP-170 OK).
- Append-only storage untouched; no viaIR; protocol 2.6; sibling facets still never call each other.

---

_Fixed: 2026-08-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
