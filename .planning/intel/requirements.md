# Synthesized Requirements

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest)
**Mode:** merge

## Existing Requirements (unchanged)

The 22 existing requirements in `.planning/REQUIREMENTS.md` (DEBT-01 through DEP-01) cover the smart-contract remediation scope. They are not modified by this ingest.

## New Requirement Candidates (DOC-derived, pending roadmapper acceptance)

The following requirement candidates are extracted from `private-network-ai.md` and clarified by owner resolutions delivered 2026-08-03. They are **candidates** for a new Phase 14 ("Private-Network AI Licensing" or similar). They are NOT yet in `.planning/REQUIREMENTS.md` — the roadmapper owns that file.

### REQ-private-network-licensing (parent)

- **Source:** `.planning/private-network-ai.md` (full doc); owner resolutions #1, #2
- **Description:** Introduce a hierarchical License NFT model where the existing GNUS AI Product Root token serves as the public AI network, and per-company tenant License NFTs live under it. Company AI Credits are children of the tenant License NFT. Individual AI Credits remain directly under the product root (Phase 13 D11 unchanged).
- **Acceptance (owner-clarified):**
  - "GNUS AI Product Root" token is identified/instantiated as the public AI network
  - Per-company License NFTs can be created as children of the product root
  - Per-company AI Credits can be created as children of the company's License NFT
  - Individual AI Credits continue to be created as direct children of the product root (no Individual License NFT branch)
  - License NFT's `privateNetworkId` identifies which SuperGenius private network/tenant the AI processing belongs to

### REQ-network-scope-struct

- **Source:** `.planning/private-network-ai.md` (lines 410-438); owner resolution #3
- **Description:** Extend the `NFT` struct with three fields to support public/private/hybrid network scope.
- **Acceptance (owner-clarified):**
  - `NetworkScope` enum added with exactly three values: `PublicOnly`, `PrivateOnly`, `Hybrid` (ordinal 0 = `PublicOnly` for backwards-compatible default per Phase 13 D1 enum rule)
  - `NFT` struct gains `networkScope`, `privateNetworkId`, `publicSettlementEnabled` fields appended alongside Phase 13's lifecycle fields
  - Storage append-only invariant preserved; existing deployed token IDs decode with zero-value defaults (PublicOnly, 0, false) and remain behaviorally unchanged
  - Upgrade test proves pre-existing NFT records decode correctly

### REQ-product-sku-registry

- **Source:** `.planning/private-network-ai.md` (lines 277-321); owner resolution #4
- **Description:** On-chain Product/SKU registry mapping SKUs to fixed minion-denominated prices, credit amounts, durations, and license-creation flags. NO USD oracle.
- **Acceptance (owner-clarified):**
  - Product struct stores `priceInMinions`, `creditAmount`, `duration`, `createsLicense`, `renewsLicense`, `active`
  - No `priceUsd` field, no `quoteUsdToGnusMinions` helper
  - Prices are fixed minion amounts set by admin (consistent with Phase 13 D11 "no oracle")
  - Purchase paths support USDC, GNUS-minions, and BANXA-confirmed external purchase

### REQ-payment-router

- **Source:** `.planning/private-network-ai.md` (lines 105-118, 246-321)
- **Description:** A payment router facet that turns USDC / GNUS-minions / BANXA-confirmed payment into License NFT creation/renewal and AI Credit minting/top-up.
- **Acceptance:**
  - `purchaseCompanyLicense(companyAdmin, productId, paymentToken)` flow exists
  - `renewLicenseWithUSDC(licenseId, productId)`, `renewLicenseWithGNUS(licenseId, productId, maxGnusIn)`, `grantExternalPurchase(licenseId, productId, banxaPaymentId)` flows exist
  - Payment token and access/license token remain distinct assets (no conflation)
  - All three rails produce equivalent final state: License NFT created/renewed + AI Credits minted/extended + private-network authorization event emitted

### REQ-license-activation-event

- **Source:** `.planning/private-network-ai.md` (lines 200-226, 362-368)
- **Description:** Public chain emits `LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)` event consumed by the private SuperGenius network to activate mirrored usage.
- **Acceptance:**
  - Event emitted on license creation and on every renewal
  - Event fields: `companyAdmin`, `licenseId`, `privateNetworkId`, `expiresAt`
  - Off-chain / SuperGenius consumers can derive license state from events alone (no additional RPC surface required)

### REQ-hybrid-redeemability

- **Source:** `.planning/private-network-ai.md` (lines 441-460); owner resolution #5
- **Description:** Hybrid-scope License NFTs and AI Credits must support redemption back to GNUS via Phase 13 D8's `REDEEM_TO_PARENT` path.
- **Acceptance (owner-clarified):**
  - Hybrid-scope tokens configured with `exchangeRate > 0` and `expirationDisposition = REDEEM_TO_PARENT`
  - Collateralization uses Phase 9's `mintBackedChild` reserve path
  - Pure burn-only AI Credits (SOULBOUND, PerHolder expiry) remain non-redeemable (Phase 13 D11 unchanged)

### REQ-private-network-spend-design (OPEN — design question, not yet a requirement)

- **Source:** Owner resolution #7; `.planning/private-network-ai.md` Step 3
- **Description:** How AI credits are spent on SuperGenius against public-canonical balances. Candidate patterns: bridged burn events vs mirror + periodic settlement.
- **Status:** Recorded as open design question in `.planning/intel/decisions.md` PD-7. The roadmapper must surface this in Phase 14 CONTEXT as a question to resolve during planning, not a blocker.

## Infrastructure PRDs (Out of Scope — unchanged from 2026-05-26)

Three PRD-type documents ingested 2026-05-26 define requirements for DevContainer infrastructure. Acknowledged for context, not added to Active requirements:

- **INFRA-PRD-01**: DevContainer Docker-Compose and HashiCorp Vault Integration (`.devcontainer/project/prd/docker-compose-prd.md`)
- **INFRA-PRD-02**: HashiCorp Vault Persistence & CLI Installation (`.devcontainer/project/prd/vault-persistence-cli-prd.md`)
- **INFRA-PRD-03**: HashiCorp Vault Remote Connectivity (`.devcontainer/project/prd/vault-remote-connectivity-prd.md`)

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended REQ-private-network-licensing through REQ-private-network-spend-design from `private-network-ai.md` + owner resolutions_
