# Phase 14 Security Audit — private-network-ai-licensing

**Auditor:** gsd-security-auditor
**Date:** 2026-08-25
**ASVS Level:** L2 | **block_on:** critical
**Method:** Every declared mitigation grep-verified in the implemented contracts at the cited location; code-review findings (CR-01..IN-03) verified with their regression tests; targeted sanity sweep of the two new facets.

## Threat Register

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-14-01-01 | Tampering / NFT struct append | mitigate | CLOSED | `contracts/gnus-ai/GNUSNFTFactoryStorage.sol:36-41` — 4 fields appended at slots +11 (companyAdmin), +12 (privateNetworkId), +13 (networkScope+publicSettlementEnabled packed) under Phase 14 banner; zero-default decode + packed-slot round-trip probes: `test/unit/GNUSLifecycleUpgrade.test.ts:424-435,453-457` (offsets [11n,12n,13n] asserted zero on fresh token); `test/unit/GNUSLicensing.test.ts:97,654-670` (slot +11 read-back, slot +12 poison helper) |
| T-14-01-02 | Repudiation / docs amendments | accept | CLOSED | Wording-only planning docs tracked in git (14-01 plan disposition) |
| T-14-02-01 | EoP / configureSKU·setSKUActive | mitigate | CLOSED | `contracts/gnus-ai/GNUSLicensing.sol:63-69` `_requireCreatorOrAdminRole` (CREATOR_ROLE ∥ DEFAULT_ADMIN_ROLE, "Only creator or admin"); applied at `configureSKU:77` and `setSKUActive:96`; revert test `test/unit/GNUSLicensing.test.ts:307-309` |
| T-14-02-02 | Tampering / SKU pricing data | mitigate | CLOSED | Same role gate; audit events `SKUConfigured(skuId, sku, indexed operator)` `GNUSLicensing.sol:51,88` and `SKUActiveToggled` `:55,100` |
| T-14-02-03 | DoS / EIP-170 facet size | mitigate | CLOSED | GNUSLicensing 16,549 B ≤ 24,576 (14-02-SUMMARY:43); GNUSNFTFactory EIP-170 relief refactor to non-zero stores, 24,155 B (14-01-SUMMARY:24) |
| T-14-03-01 | Spoofing/Repudiation / purchaseCredits | mitigate | CLOSED | `GNUSLicensingPurchase.sol:204,443-459` — payment pulled via allowance from `_msgSender()` then direct `_burn(buyer, GNUS_TOKEN_ID, amount)` (no custody); `:212` mint destination = caller-paid deviceWallet; SOULBOUND policy (license `:311`/credit D-17 shape) prevents resale of minted credits; exact-delta test `GNUSLicensing.test.ts:343-353`, allowance-revert-no-mint `:364-371`, zero diamond balance `:353` |
| T-14-03-02 | Tampering / renewal extension | mitigate | CLOSED | `GNUSLicensingPurchase.sol:378-382` — `base = max(nft.validUntil, block.timestamp)`, `newExpiry = base + sku.duration` (operator-SKU payload, never caller-supplied); `LicenseActivated` re-emitted `:382`; stacking test `GNUSLicensing.test.ts:514-518` |
| T-14-03-03 | DoS / whale exhaustion | accept | CLOSED | Bounded by per-token maxSupply + perWalletMintCap in the shared hook (`_mint` → GNUSLifecyclePolicy.enforceMintGate, doc `GNUSLicensingPurchase.sol:211`); attacker burns own GNUS (D-11 table, 14-03 plan) |
| T-14-03-04 | EoP / createLicense | mitigate | CLOSED | `GNUSLicensingPurchase.sol:268` `hasRole(DEFAULT_ADMIN_ROLE) ∥ hasRole(_CREATOR_ROLE)` gate ("Only Creators or Admins can create NFT child of GNUS"); permissionless surface limited to purchaseCredits/renewLicense (D-27) |
| T-14-03-05 | Information / payment burn | accept | CLOSED | Deflationary by design (D-10); no custody to drain — verified `_burnPayment` direct-buyer-burn pattern |
| T-14-04-01 | EoP / SOULBOUND bridge allowance | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:341-346` — SOULBOUND bridges only for ADMIN/CREATOR callers; non-privileged reverts "Policy-bound token cannot bridge in v1"; tests `GNUSBridgePolicy.test.ts:336,345,194` |
| T-14-04-02 | Tampering / expired value transport | mitigate | CLOSED | `GNUSBridge.sol:347-361` — D-23 expiry gate covering PerTokenId `validUntil` and PerHolder `holderExpiresAt` (both `== 0` passes); tests `GNUSBridgePolicy.test.ts:355,362` (revert "License expired" even for admin) |
| T-14-04-03 | DoS / limiter griefing | mitigate | CLOSED | Gate ordering: `_enforceBridgePolicy` `GNUSBridge.sol:257` BEFORE `checkAndRecordWithdraw` `:268` and `_burn` `:274`; ordering proof tests `GNUSBridgePolicy.test.ts:290,370` (limiter NOT charged on revert) |
| T-14-04-04 | Tampering / expired burn path | accept | CLOSED | Phase 13 D5 carve-out intentional — regression test `GNUSBridgePolicy.test.ts:386-397` (settleExpired still succeeds while expired SOULBOUND bridge reverts) |
| T-14-05-01 | Spoofing / createLicense network identity | mitigate | CLOSED | `GNUSLicensingPurchase.sol:275-279` — `require(privateNetworkId != 0)` + `networkIdToLicense[id] == 0` uniqueness; registry write `:344`; tests `GNUSLicensing.test.ts:700,718` ("Private network id required" / "Network id already licensed") |
| T-14-05-02 | Tampering / lazy propagation | mitigate | CLOSED | `GNUSLicensingPurchase.sol:192-200` — propagated `privateNetworkId` read ONLY from `licenseNft` (CREATOR-gated storage); buyer input never reaches the write; mismatch reverts `_ERR_CREDIT_NETWORK_MISMATCH` |
| T-14-05-03 | Tampering / public-leg network binding | mitigate | CLOSED | `GNUSLicensingPurchase.sol:225` `require(publicNft.privateNetworkId == 0)`; tests `GNUSLicensing.test.ts:787` (public leg zero network) and `:790` (poisoned public token reverts) |
| T-14-05-04 | Repudiation / split-mint audit | mitigate | CLOSED | Both legs mint via shared hook `_mint` (`:212,233` — Transfer events) behind ONE `_burnPayment` (`:204`) emitting ERC-20 `Transfer(to=0)` (`:459`); test `GNUSLicensing.test.ts:765-787` (both legs minted, totalSupply delta == price regardless of split) |
| T-14-05-05 | DoS / EIP-170 facet overflow | mitigate | CLOSED | GNUSLicensingPurchase 22,725 B ≤ 24,576 post-fix (14-REVIEW-FIX.md:89); GNUSLicensing 16,549 B (14-02-SUMMARY); GNUSBridge 23,309 B (14-04-SUMMARY:41); GNUSNFTFactory 24,155 B (14-01-SUMMARY:24) |
| T-14-05-06 | EoP / SKU leg amounts | mitigate | CLOSED | `publicCreditAmount` fixed in CREATOR/ADMIN-gated SKU (`GNUSLicensing.sol:77-88`); purchase signature `purchaseCredits(skuId, licenseId, deviceWallet)` (`GNUSLicensingPurchase.sol:157`) — no amount parameter on the permissionless surface |
| T-14-05-SC | Tampering / package installs | accept | CLOSED | No new dependencies — pure Solidity edits to existing files (14-05 plan; verified: no new import sources beyond existing project files) |

## Code-Review Findings (verified mitigated, with regression tests)

| ID | Severity | Status | Evidence |
|----|----------|--------|----------|
| CR-01 | Critical — permissionless renewLicense mutated validUntil on ANY created NFT / forged LicenseActivated | CLOSED | `GNUSLicensingPurchase.sol:364-368` `require(licenseSku[licenseId] != 0, "Not a license token")`; regression tests `GNUSLicensing.test.ts:553-563` (credit token id AND `GNUS_TOKEN_ID` revert); fixes 60964e0/db5510a |
| WR-01 | Warning — purchase under an expired license | CLOSED | `GNUSLicensingPurchase.sol:168-170` `require(validUntil == 0 \|\| now < validUntil, "License expired")`; test `GNUSLicensing.test.ts:392-402` (revert, no burn/mint); c3921e5/a5ef8d7 |
| WR-02 | Warning — licenseSku write-only dead storage | CLOSED | Resolved via CR-01 read at `GNUSLicensingPurchase.sol:368`; mapping retained append-only (`GNUSLicensingStorage.sol:19-20`) |
| WR-03 | Warning — public-only SKU required private token / verifier with amount=0 | CLOSED | `GNUSLicensingPurchase.sol:176-186` private-leg existence + verifier inside `if (sku.creditAmount > 0)`; test (public-only purchase after zeroing first-child record) per 14-REVIEW-FIX c1f08a2 |
| IN-01 | Info — unused import | CLOSED | Removed (no `IERC20Upgradeable` import remains; local topic-equal Transfer/Approval at `:127,131`); 3a8dd65 |
| IN-02 | Info — networkScope not propagated | CLOSED | `GNUSLicensingPurchase.sol:197` `creditNft.networkScope = licenseNft.networkScope` in the lazy branch; test extended (865aa06) |
| IN-03 | Info — misleading test name | CLOSED | Renamed "a credit SKU cannot renew (type gate)"; non-license coverage via CR-01 regression |

## Sanity Sweep (registers' residual check — nothing unregistered found)

- **Role gates:** all mutating surfaces covered — `configureSKU`/`setSKUActive` (GNUSLicensing:63-69), `createLicense` (Purchase:268). Permissionless surface is exactly `purchaseCredits` + `renewLicense` (D-27), both economically bounded by operator SKUs.
- **Reentrancy around burn→mint:** CEI holds — allowance spend + buyer burn (`_burnPayment`, no external callbacks) precede `_mint`; credential verifier (external call) runs pre-burn; `_applyCreditRenewal` pre-mint settle-first with clock cleared before dispatch (Purchase:489-496).
- **configureSKU input validation:** price > 0, duration > 0, mode conflict rejected, credit SKUs require ≥1 leg (`GNUSLicensing.sol:78-85`).
- **createLicense input validation:** networkScope range (`Purchase:269`), privateNetworkId ≠ 0 + uniqueness (`:275-279`), D7 token-collision guard (`:406`).
- **EIP-170:** all four touched facets ≤ 24,576 B (see T-14-05-05).
- **Storage slot uniqueness:** `keccak256("gnus.ai.licensing.storage")` (`GNUSLicensingStorage.sol:27`) — distinct from all prior `*StoragePosition` constants.
- Informational residual (non-blocking): a license created under a SKU configured at `skuId == 0` is not renewable (`licenseSku[licenseId] != 0` sentinel collision) — operator-config convention only; note for Phase 15.

## Accepted Risks Log

| ID | Risk | Evidence |
|----|------|----------|
| T-14-01-02 | Docs amendments repudiation | 14-01 plan; git-tracked wording-only docs |
| T-14-03-03 | Whale/maxSupply exhaustion DoS | 14-03 plan; bounded by maxSupply + perWalletMintCap; attacker pays burn |
| T-14-03-05 | Payment burn (deflationary) | 14-03 plan D-10; no custody to drain |
| T-14-04-04 | Expired burn/settlement path (Phase 13 D5 carve-out) | 14-04 plan; regression-tested (GNUSBridgePolicy.test.ts:386) |
| T-14-05-SC | No new package installs | 14-05 plan; verified pure-Solidity edits |

## Unregistered Flags

None. SUMMARY files carry no `## Threat Flags` sections; review findings all map to closed register entries above.

## Constraints Acknowledged (not gaps)

protocol 2.6; GNUS-burn rail only; D-27 permissionless purchase; D-24 privileged SOULBOUND bridgeOut; known-stale chainID test (out of scope); Ed25519 verification intentionally off-chain.

## Audit Trail

- Threat models extracted from 14-01..14-05 PLAN.md `<threat_model>` blocks (23 threats + 7 review findings).
- Implementation greps against contracts/gnus-ai/{GNUSLicensing,GNUSLicensingTypes,GNUSLicensingStorage,GNUSLicensingPurchase,GNUSNFTFactoryStorage,GNUSBridge}.sol; test evidence against test/unit/{GNUSLicensing,GNUSBridgePolicy,GNUSLifecycleUpgrade}.test.ts.
- Tests not re-run by auditor; 14-REVIEW-FIX verification reports 604 passing / 2 pending / 1 known-stale failure (chainID test).
- Implementation files not modified.

**Threats open: 0 / 23** (+ 7/7 review findings closed)
