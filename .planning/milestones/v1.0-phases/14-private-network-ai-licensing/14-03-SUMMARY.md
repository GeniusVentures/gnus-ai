---
phase: 14-private-network-ai-licensing
plan: "03"
subsystem: licensing-purchase
tags: [licensing, purchase-rail, gnus-burn, facet-split, d-10]
requires:
  - "14-01 NFT struct appends (companyAdmin/privateNetworkId/networkScope/publicSettlementEnabled)"
  - "14-02 SKU registry + LicenseActivated event surface (GNUSLicensingTypes/Storage)"
provides:
  - "purchaseCredits(skuId, licenseId, deviceWallet) — permissionless GNUS-burn credit rail (D-27/D-19/D-10)"
  - "createLicense(skuId, LicenseCreateParams) — CREATOR/ADMIN license NFT creation with D-14 LicenseActivated"
  - "renewLicense(skuId, licenseId) — permissionless renewal, max(current,now)+duration stacking, LicenseActivated re-emit"
affects:
  - "diamonds/GeniusDiamond/geniusdiamond.config.json (GNUSLicensingPurchase @ priority 123, versions[\"2.6\"])"
tech-stack:
  added: []
  patterns:
    - "Direct buyer burn (GNUSBridge.burn pattern) for payment — zero diamond custody"
    - "Mint gates inherited via the shared _mint hook (enforceMintGate single write point)"
    - "Topic-equal event re-declarations across facets (LifecycleConfigured/Settled/HolderExpiryUpdated precedent)"
    - "Calldata param struct to fit the 0.8.19 stack (no viaIR per D-18)"
key-files:
  created:
    - contracts/gnus-ai/GNUSLicensingPurchase.sol
    - test/unit/GNUSLicensing.test.ts
  modified:
    - diamonds/GeniusDiamond/geniusdiamond.config.json
decisions:
  - "Payment = ERC-20 allowance pull + direct buyer id-0 burn (NOT pull-to-diamond-then-burn) — keeps Phase 10 no-custody invariant and never charges the diamond's withdraw limiter"
  - "createLicense replicates createNFTWithLifecycle's GNUS-root creation branch inline (facet split forbids sibling calls; _isExpired duplication precedent)"
  - "renewLicense accepts ANY active renewsLicense SKU (licenseSku records the creation SKU only); extension surface is exactly max(current,now)+sku.duration"
  - "Company credit token = first child (index 0) of the license NFT (D-02 deterministic grandchild)"
  - "_LICENSE_MAX_SUPPLY = 1M minions — hybrid REDEEM_TO_PARENT children redeem INTO the license token and the parent-mint leg keeps the hard max-supply check (WR-04)"
metrics:
  duration: "~3h"
  completed: 2026-08-25
---

# Phase 14 Plan 03: Licensing Purchase Rail & Unit Suite Summary

Permissionless GNUS-burn purchase/renewal facet (paid GNUS burned with exact totalSupply-delta proof, D-10) + operator license creation with D-14 LicenseActivated events, proven by a 14-test LIC-01/03/04/05/06 suite; facet registered at protocol 2.6, full suite at known baseline.

## What Was Done

### Task 1: GNUSLicensingPurchase facet (contracts/gnus-ai bfb379d + 51ae7a2)
- `purchaseCredits(skuId, licenseId, deviceWallet)` — permissionless (D-27): active credit-SKU check ("SKU inactive" / "SKU does not mint credits"), credential-verifier gate when configured, ERC-20 allowance pull + DIRECT buyer burn through the ERC-1155 id-0 machinery with the GNUSBridge.burn globalSupply/chainSupply decrements, D3 settle-first per-holder renewal (compact `_applyCreditRenewal` + `_dispatchCreditSettlement` covering BURN / RETURN_TO_ADDRESS / REDEEM_TO_PARENT with the WR-04 transient carve-out), then `_mint` through the shared hook so max-supply / validFrom / "Sale ended" / per-wallet cap all fire.
- `createLicense(skuId, LicenseCreateParams)` — CREATOR_ROLE/ADMIN-gated (D-12): License NFT as direct child of the GNUS product root, PerTokenId validUntil = now + sku.duration, PerTokenId + SOULBOUND + BURN namespace shape (nonConvertible per D11 mapping), Phase 14 fields (companyAdmin D-25, privateNetworkId, networkScope with enum-range validation, publicSettlementEnabled D-08) from calldata, topic-equal LifecycleConfigured, licenseSku stored, LicenseActivated emitted in the exact D-14 field order.
- `renewLicense(skuId, licenseId)` — permissionless: any active renewsLicense SKU, same burn payment, validUntil = max(current, block.timestamp) + sku.duration (internal — the role-gated setValidUntil setter NOT widened), LicenseActivated re-emitted with stored companyAdmin/privateNetworkId.
- CEI throughout; all error strings named constants; **bytecode 21,494 B** (EIP-170 limit 24,576); GNUSNFTFactory untouched at 24,188 B (still under).

### Task 2: Unit suite + config registration (root 0828637, diamonds/GeniusDiamond ee3ed0e)
- `test/unit/GNUSLicensing.test.ts` (595 lines, 14 tests) — actor model deployer/creator/buyer/companyAdmin/deviceWallet/outsider per the GNUSLifecycleAICredits boot pattern:
  - LIC-03: non-privileged configureSKU reverts; getSKU round-trips all seven fields; setSKUActive(false) → "SKU inactive" with totalSupply unchanged.
  - LIC-04: **totalSupply delta == priceInMinions exact equality** (D-10); deviceWallet receives creditAmount with a fresh PerHolder clock; diamond holds zero GNUS after purchase; insufficient-allowance revert mints/burns nothing; top-up stacks the clock (D3/Pitfall 6).
  - LIC-01: license is a direct product-root child with all Phase 14 fields; non-creator createLicense reverts; company credits are license children (grandchildren) with parent-creator-only grandchild auth (GNUSLifecycle.sol:351-353); individual AI Credits stay direct root children (Phase 13 D11 unamended).
  - LIC-05: LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt==validUntil) on creation; renewal stacks to max(current,now)+duration (both unexpired and expired-renewal branches) and re-emits LicenseActivated; non-renewal SKU reverts "SKU does not renew licenses".
  - LIC-06 (config-only, D-05/D-28): exchangeRate>0 + REDEEM_TO_PARENT hybrid token redeems to the parent via the existing Phase 13 settle path (Settled(..., REDEEM_TO_PARENT, holder)); burn-only SOULBOUND credits are non-redeemable — convert reverts "Token is non-convertible" and expiry settle yields ZERO GNUS delta (Phase 13 SC7).
- Config: `"GNUSLicensingPurchase"` at priority 123, `versions["2.6"]`, fromVersions [0.0, 2.4, 2.5] — no 2.7 anywhere; ABI/typechain regenerated via `diamond:generate-abi-typechain`.

## Verification Evidence

- `npx hardhat compile` clean; acceptance greps: LicenseActivated ✓, safeTransferFrom ✓, `grep -c "convert("` == 0 ✓, "SKU inactive" ✓, config grep 2.6 ✓
- `npx hardhat test test/unit/GNUSLicensing.test.ts` → **14 passing**
- Full `npx hardhat test` → **593 passing / 2 pending / 1 failing** — exactly the known baseline (579 passing) + 14 new, with the single pre-existing GNUSControlStorage chainID failure (never fixed per instructions)
- Bytecode: GNUSLicensingPurchase 21,494 B ≤ 24,576; GNUSNFTFactory 24,188 B ≤ 24,576 (re-checked)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Payment burns directly from the buyer, not transfer-to-diamond-then-burn**
- **Found during:** Task 1 design
- **Issue:** The plan sketched `safeTransferFrom(msg.sender, diamond, price)` then burning the diamond's balance. Moving payment through the diamond address (a) violates the Phase 10 no-custody invariant, and (b) the withdrawal limiter charges `from` — the diamond address would accumulate limiter debt on every purchase and eventually rate-limit the whole rail.
- **Fix:** ERC-20 allowance pull (spender = diamond, infinite-allowance handled) + `_burn(buyer, GNUS_TOKEN_ID, amount)` with the GNUSBridge.burn (lines 178-186) globalSupply/chainSupply decrements — the exact pattern the plan itself cites. D-10 invariant (totalSupply delta == price) proven by exact-equality test; the limiter charges only the buyer (mintWithCredential precedent).
- **Files:** GNUSLicensingPurchase.sol `_burnPayment`

**2. [Rule 1 - Bug] renewLicense governing-SKU equality check removed**
- **Found during:** Task 2 test run
- **Issue:** Initial implementation required `licenseSku[licenseId] == skuId`, but that mapping stores the CREATION SKU — a renewal SKU can never match, making renewal impossible.
- **Fix:** Any active `renewsLicense` SKU may renew any license (price + duration come from the operator-controlled SKU payload; the extension surface stays max(current, now) + sku.duration — T-14-03-02 intact).
- **Commit:** contracts/gnus-ai 51ae7a2

**3. [Rule 1 - Bug] License maxSupply raised to 1M minions**
- **Issue:** Initial 1-minion namespace cap made hybrid REDEEM_TO_PARENT redemption impossible — the parent-mint leg runs the hook's hard max-supply check (WR-04 carves out only window/cap).
- **Fix:** `_LICENSE_MAX_SUPPLY = 1_000_000 * GNUS_DECIMALS` (redemption headroom; nothing in the facet mints license units).
- **Commit:** contracts/gnus-ai 51ae7a2

**4. [Rule 3 - Blocking] Solidity 0.8.19 stack limits (no viaIR per D-18)**
- **Issue:** `emit IERC20Upgradeable.Approval(...)` not allowed (qualified interface event emission needs ≥0.8.21); the flat 8-arg createLicense and the single NFT({...}) literal both overflowed the stack.
- **Fix:** Topic-equal local Transfer/Approval event declarations; LicenseCreateParams calldata struct; creation split into `_createLicenseNft` / `_licenseConfig` / `_finalizeLicense` helpers with scoped blocks.

**5. [Rule 1 - Bug] Test fixture contamination**
- **Issue:** Granting CREATOR_ROLE to a signer in `before` persisted on the shared diamond fixture and flipped Phase 13's non-creator tests and the D-24 non-privileged SOULBOUND bridgeOut test in other suites.
- **Fix:** Grant moved inside `beforeEach` (after evm_snapshot) so evm_revert undoes it; full suite back to baseline + new.

## Commits

| Task | Repo | Commit |
|------|------|--------|
| 1 | contracts/gnus-ai | bfb379d |
| 1 (pointer) | parent | a9766ab |
| 1 fixes | contracts/gnus-ai | 51ae7a2 |
| 2 (config) | diamonds/GeniusDiamond | ee3ed0e |
| 2 (tests + pointers) | parent | 0828637 |

## Self-Check: PASSED

contracts/gnus-ai/GNUSLicensingPurchase.sol, test/unit/GNUSLicensing.test.ts, diamonds/GeniusDiamond/geniusdiamond.config.json all present; all five commits verified in git log.

## Known Stubs

None — purchase, creation, renewal, and payment burn are fully functional and tested.
