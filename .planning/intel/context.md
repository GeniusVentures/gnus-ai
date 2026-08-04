# Synthesized Context

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest)
**Mode:** merge

## Smart Contract Ecosystem (from 2026-05-26 ingest — unchanged)

### Diamond Architecture Confirmed

The GeniusDiamond (`docs/GeniusDiamond.md`) implements EIP-2535 with ERC165 and ERC1155 compatibility. 11 facets are deployed on testnet. The diamond proxy delegates all calls to facet contracts with DiamondCutFacet managing upgrades. Storage is namespaced per facet using the diamond storage pattern.

### Facet-by-Facet Documentation Available

Full API reference documentation exists for every facet in the diamond: GeniusDiamond, GeniusAccessControl, GeniusOwnershipFacet, GNUSBridge, GNUSERC1155MaxSupply, GNUSNFTFactory, GNUSControl, GNUSWithdrawLimiter, ERC20TransferBatch, ERC1155ProxyOperator, GNUSContractAssets, GNUSNFTCollectionName, GeniusAI (DEAD CODE), GeniusAIStorage (DEAD CODE).

### Storage Libraries

- `GNUSControlStorage`: banned transferor mappings, bridge fee, protocol version, chain ID
- `GNUSNFTFactoryStorage`: NFT Factory diamond storage layout — the `NFT` struct is the append target for Phase 13 (lifecycle) and Phase 14 (network scope) fields

### Smart Contracts Overview

`docs/Smart-Contracts-Overview.md`: GNUS token is the base currency with 50M total supply cap. NFTs have exchange rates and can be burned for GNUS. Hierarchical NFT system: parent-child-grandchild relationships. Cross-chain bridging via burn/mint pattern. AI escrow integration is dead code per DEBT-01.

### Total Supply Cap

50M GNUS total supply cap (Smart-Contracts-Overview.md line 28). Protocol constant.

---

## Testing Infrastructure (from 2026-05-26 ingest — unchanged)

Foundry suite has 12 fuzz + 8 invariant + 1 security + 3 PoC files. TEST-01 targets only the `ExampleFuzz.t.sol` stub. See INGEST-CONFLICTS.md (2026-05-26) INFO entry.

---

## Deployment Infrastructure (from 2026-05-26 ingest — unchanged)

- RPC-based deployment pipeline (validated in PROJECT.md)
- OpenZeppelin Defender alternative path (DefenderDiamondDeployer with Safe multisig) — INFO in 2026-05-26 conflicts report

---

## DevContainer Infrastructure (from 2026-05-26 ingest — unchanged)

Vault, Docker Compose, Snyk, Git auth, portability infrastructure documented. Three infra PRDs (INFRA-PRD-01..03) acknowledged as out-of-scope for smart-contract work.

---

## Private-Network AI Licensing (NEW — 2026-08-03 ingest)

**Source:** `.planning/private-network-ai.md` (DOC, classified 2026-08-03, confidence medium)
**Owner resolutions applied:** 2026-08-03 ingest prompt — see `.planning/intel/decisions.md` PD-1 through PD-7

### Topic: Two-layer architecture (public canonical + private execution)

The doc proposes a two-layer model where the public chain is canonical for billing/settlement/audit and the private SuperGenius chain is the execution/usage layer. Owner resolution #1 clarifies:

- **Public layer** = the existing EVM diamond contracts in this repo (Phases 1-13 already build on this)
- **Private layer** = the SuperGenius chain
- **Bridge** = the existing GNUS↔SuperGenius bridge (roadmap Phases 8 and 10), NOT a new mirroring system

The doc's "private mirror + periodic settlement" and "bridged burn events" sketches are candidate patterns for the OPEN design question (PD-7) — not committed mechanisms.

### Topic: License NFT hierarchy (owner-resolved shape)

The doc proposes a hierarchy where each company/person gets a License NFT. Owner resolution #2 narrows this:

```
GNUS primary token
└── GNUS AI Product Root (= the public AI network)
    ├── Company A License NFT (per-tenant)
    │   ├── Company A AI Credits (child of license)
    │   └── ... seats / operators (out of scope for Phase 14)
    ├── Company B License NFT
    │   └── ...
    └── Individual AI Credits (direct child of product root, NO license NFT)
```

The doc's "Individual User AI License NFT" branch is **rejected** by owner resolution #2. Individuals hold AI Credits directly under the product root, preserving Phase 13 D11.

### Topic: What a License NFT represents

Per the doc (lines 36-52), a License NFT is a tenant/private-network namespace that can represent:

- private network membership
- company tenant identity
- API billing account
- allowed compute network
- public/private bridge permissions
- subscription ownership
- seats (deferred — not Phase 14 v1 scope per owner resolutions)
- credit policy
- payment plan
- KYC/BANXA relationship
- public-chain settlement anchor

The `privateNetworkId` field on the License NFT identifies which SuperGenius private network/tenant the AI processing belongs to (owner resolution #1).

### Topic: Three distinct asset types (kept separate)

The doc (lines 58-118) is emphatic that three asset types must NOT be conflated:

1. **License NFT** — account/network identity object. SOULBOUND or ADMIN_TRANSFER_ONLY. PerTokenId expiry recommended (the company license itself is the account).
2. **AI Credits** — spendable usage units. SOULBOUND. PerHolder expiry. BurnOnSpend / BurnOnExpire disposition. Children of the License NFT (for companies) or the product root (for individuals).
3. **Payment asset** — USDC, GNUS minions, BANXA/card/fiat. Distinct from license/credits. Buys or renews the former.

Owner resolutions #1-#5 preserve this separation.

### Topic: NetworkScope enum and struct fields

Doc proposes (lines 410-439), owner resolution #3 confirms:

```solidity
enum NetworkScope { PublicOnly, PrivateOnly, Hybrid }

// Appended to NFT struct alongside Phase 13 D1 fields:
NetworkScope networkScope;
uint256 privateNetworkId;
bool publicSettlementEnabled;
```

Phase 13 D1's append-only / ordinal-0-default / single-PR-per-struct-diff rules apply transitively. See `.planning/intel/constraints.md` C-PN-1, C-PN-2.

### Topic: Product/SKU registry (minion-denominated)

Doc proposes a `Product` struct (lines 281-292). Owner resolution #4 amends: **fixed minion-denominated price, no USD oracle**. The doc's `priceUsd` and `quoteUsdToGnusMinions` sketch is superseded. Consistent with Phase 13 D11 "fixed GNUS amount per SKU (no oracle)". See constraints.md C-PN-3.

### Topic: Payment router

Doc proposes a PaymentRouter (lines 105-118, 246-321) supporting USDC, GNUS-minions, and BANXA-confirmed external purchase. All three rails must converge on the same end state: license created/renewed + credits minted/extended + authorization event emitted. See requirements.md REQ-payment-router.

### Topic: Lifecycle (doc-proposed)

Doc proposes (lines 157-275):

1. **Step 1 — Company signs up.** Payment via USDC/GNUS/BANXA → `purchaseCompanyLicense(companyAdmin, productId, paymentToken)` mints/activates `COMPANY_LICENSE_ID`.
2. **Step 2 — Private network mirrors the license.** Public chain emits `LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)`; SuperGenius reads/proves the event and activates local usage. Owner resolution #1: this uses the existing bridge, not a new mirror system.
3. **Step 3 — Consume AI.** Private network checks `isLicenseActive(licenseId)`, `isOperatorAllowed(licenseId, user)`, `hasSpendableCredits(licenseId, account)`; burns/decrements credits privately. **How this hits the public-canonical balance is the OPEN design question (PD-7).**
4. **Step 4 — Renewal.** `renewLicenseWithUSDC` / `renewLicenseWithGNUS` / `grantExternalPurchase` extend `validUntil` (per-token) or `_holderExpiresAt` (per-holder), depending on token type. For company licenses, doc recommends per-token `validUntil`. For per-user credits under a license, per-holder expiry (consistent with Phase 13 D2 table).

### Topic: Configuration examples (doc-proposed)

Doc provides (lines 441-460):

- **Company private-network license:** `networkScope = Hybrid`, `privateNetworkId = 101`, `publicSettlementEnabled = true`, `transferPolicy = SOULBOUND or ADMIN_TRANSFER_ONLY`, `expirationMode = PerTokenId`, `validUntil = subscriptionEnd`
- **Company AI credits:** `networkScope = PrivateOnly or Hybrid`, `privateNetworkId = 101`, `transferPolicy = SOULBOUND`, `expirationMode = PerHolder`, `disposition = BurnOnSpendOrExpire`

Owner resolution #5 adds: Hybrid tokens MUST be REDEEM_TO_PARENT-capable (Phase 13 D8), `exchangeRate > 0`, collateralized via Phase 9 `mintBackedChild`. Pure burn-only AI Credits remain non-redeemable per Phase 13 D11.

### Topic: Cross-references to existing planning

- **Phase 9 (Treasury/Reserve):** Phase 14 depends on `mintBackedChild` reserve path for Hybrid-token collateralization (owner resolution #5; Phase 13 D8).
- **Phase 10 (Bridge Vault):** Phase 14 depends on the bridge for public-canonical ↔ private-execution portability (owner resolution #1). Phase 13 D7 already constrains policy-bound tokens to be non-bridgeable in v1 — Phase 14 must reconcile this with the LicenseActivated event pattern.
- **Phase 13 (Time-Bound Entitlements):** Phase 14 layers ON TOP. All lifecycle/transfer-policy/disposition/settlement mechanisms are referenced from Phase 13 D1-D13, not redefined (owner resolution #6).
- **Phase 12 (Supply Ledger):** Convention shared — expired-unsettled balances count as circulating (Phase 13 D9).

### Topic: Open design question (PD-7)

How AI credits are spent on SuperGenius against public-canonical balances:
- (a) Bridged burn events settled on the public chain
- (b) Private mirror + periodic settlement

Owner resolution #7 explicitly records this as **NOT a blocker** — it is a design question for the Phase 14 CONTEXT to resolve during planning, informed by Phase 10 vault work.

### Topic: Coherence with Phase 13 D11 (the "much better model" line)

The doc (line 11) states its license-NFT model "is a much better model than 'one AI Credits token for everybody'". Phase 13 D11 locked "no grandchildren needed" for AI Credits. Owner resolutions #2 and #6 clarify:

- Phase 13 D11 stands unchanged for **individual** AI Credits (direct children of the product root, no grandchildren).
- Phase 14 introduces a NEW scope (**company tenants**) where credits ARE children of License NFTs (i.e., grandchildren of the product root).

This is coherent — D11 was scoped to individuals; Phase 14 adds a new tenant dimension. Recorded as INFO (auto-resolved by owner clarification) in INGEST-CONFLICTS.md.

---

## Summary Statistics (cumulative)

- **36 documents ingested** across 36 classification files (35 from 2026-05-26 + 1 from 2026-08-03)
- **18** smart contract API reference docs
- **4** deployment infrastructure docs
- **10** DevContainer infrastructure docs + 3 infrastructure PRDs
- **1** Foundry testing doc
- **1** smart contracts overview doc
- **1** private-network AI licensing design doc (NEW — 2026-08-03)
- **7** requirement candidates proposed for Phase 14 (REQ-private-network-licensing through REQ-private-network-spend-design)
- **7** constraints proposed for Phase 14 (C-PN-1 through C-PN-7)
- **7** proposed decisions for Phase 14 (PD-1 through PD-7, with PD-7 explicitly OPEN)

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended Private-Network AI Licensing section from `private-network-ai.md` + owner resolutions_
