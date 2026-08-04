# Synthesized Decisions

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest)
**Mode:** merge

## No New ADR-Locked Decisions Surfaced

No ADR-type documents are present in either ingest set. The 2026-08-03 ingest added one DOC (`private-network-ai.md`) classified as `DOC` with `locked: false` — it carries design rationale, not a locked decision. All existing locked decisions remain in:

- `.planning/PROJECT.md` — remediation project decisions (remove GeniusAI facet, Solidity 0.8.19, version pinning, etc.)
- `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` — Phase 13 locked decisions D1-D13

## Proposed Decisions (DOC-derived, pending roadmapper/ADR promotion)

The following decisions are **proposed** by `private-network-ai.md` and clarified by owner resolutions delivered with the ingest (2026-08-03). They are NOT locked. They are recorded here so `gsd-roadmapper` can promote them into Phase 14 planning artifacts.

### PD-1: Public-canonical layer = existing EVM diamond; Private layer = SuperGenius chain

- **Status:** proposed (owner-resolved at ingest)
- **Source:** `.planning/private-network-ai.md` ("Bridge/mirror layer" section), clarified by owner resolution #1
- **Decision:** The "bridge/mirror layer" in the doc maps onto the **existing GNUS↔SuperGenius bridge** (roadmap Phases 8 and 10). No new mirroring system is introduced. The public EVM diamond contracts in this repo remain the canonical billing/settlement/audit layer. The SuperGenius chain is the private execution/usage layer.
- **Scope:** Phase 14 (Private-Network AI Licensing)

### PD-2: License NFT hierarchy — Company tenants only; no Individual User License NFTs

- **Status:** proposed (owner-resolved at ingest)
- **Source:** `.planning/private-network-ai.md` (hierarchy diagram, lines 19-34), clarified by owner resolution #2
- **Decision:** The "GNUS AI Product Root" token IS the public AI network. Company tenants get per-tenant License NFTs under it; their AI Credits are children of the License NFT. Individual users hold AI Credits **directly under the product root** (no Individual User License NFT branch). The doc's "Individual User AI License NFT" branch is rejected.
- **Coherence with Phase 13 D11:** Phase 13 D11 locked "no grandchildren needed" for individual AI Credits. PD-2 does NOT amend D11 — D11 stands for individuals. PD-2 introduces a NEW scope (company tenants) where credits are grandchildren-of-GNUS / children-of-License-NFT. See INGEST-CONFLICTS.md INFO entry.
- **Scope:** Phase 14

### PD-3: New NFT struct fields for network scope

- **Status:** proposed (owner-resolved at ingest)
- **Source:** `.planning/private-network-ai.md` (lines 410-438), clarified by owner resolution #3
- **Decision:** Append three fields to the `NFT` struct (in addition to Phase 13 D1 lifecycle fields):
  - `NetworkScope networkScope` — enum { PublicOnly, PrivateOnly, Hybrid }
  - `uint256 privateNetworkId` — identifies which SuperGenius private network / tenant the AI processing belongs to
  - `bool publicSettlementEnabled`
- **Storage note:** Appended alongside Phase 13's appended fields (`validFrom`, `validUntil`, `defaultDuration`, `expirationMode`, `transferPolicy`, `expirationDisposition`, `expirationRecipient`, `credentialVerifier`). Whichever phase lands second appends after the other's struct diff (per Phase 13 D1 storage note — the same rule applies transitively).
- **Scope:** Phase 14

### PD-4: Pricing — fixed minion-denominated SKU prices, no USD oracle

- **Status:** proposed (owner-resolved at ingest)
- **Source:** `.planning/private-network-ai.md` (lines 277-321), clarified by owner resolution #4
- **Decision:** Product/SKU registry stores `priceInMinions` (fixed "$5.00 worth of minions" — NO USD oracle). Product struct fields: `priceInMinions`, `creditAmount`, `duration`, `createsLicense`, `renewsLicense`, `active`. The doc's `priceUsd` field and `quoteUsdToGnusMinions` helper are superseded. Consistent with Phase 13 D11 "fixed GNUS amount per SKU (no oracle)".
- **Scope:** Phase 14

### PD-5: Hybrid-scope tokens must be REDEEM_TO_PARENT-capable

- **Status:** proposed (owner-resolved at ingest)
- **Source:** `.planning/private-network-ai.md` (lines 441-460), clarified by owner resolution #5
- **Decision:** License NFTs and AI Credits configured as `Hybrid` scope MUST support conversion back to GNUS for public payouts — i.e., `exchangeRate > 0`, `expirationDisposition = REDEEM_TO_PARENT` (Phase 13 D8), and collateralized under Phase 9's `mintBackedChild` reserve path. Pure burn-only AI Credits (SOULBOUND, PerHolder expiry) remain non-redeemable per Phase 13 D11.
- **Scope:** Phase 14

### PD-6: Phase 13 mechanisms are referenced, not redefined

- **Status:** proposed (owner-resolved at ingest)
- **Source:** `.planning/private-network-ai.md` (multiple struct/enum references), clarified by owner resolution #6
- **Decision:** Where the doc proposes mechanisms Phase 13 already defines (TransferPolicy, ExpirationMode, ExpirationDisposition, settlement semantics, transfer enforcement), Phase 14 treats them as **references to Phase 13 D1-D13**, not new decisions. No redefinition, no extension of the locked enums beyond what Phase 13 already specifies.
- **Scope:** Phase 14

### PD-7: Open design question — private-spend against public-canonical balance

- **Status:** OPEN (recorded per owner resolution #7 — NOT a blocker)
- **Source:** Owner resolution #7, informed by `.planning/private-network-ai.md` Step 3
- **Question:** How do AI credits get spent on SuperGenius against the public-canonical balance? Two candidate patterns: (a) bridged burn events settled on the public chain, or (b) private mirror + periodic settlement. Bridge-protocol design belongs to the new phase, informed by Phase 10 vault work.
- **Action:** Roadmapper must surface this as an explicit design question in Phase 14 CONTEXT, not paper over it.

---

## Existing Locked Decisions (unchanged)

From `.planning/PROJECT.md` "Key Decisions" (remediation project — unrelated to Phase 14):

- Remove GeniusAI facet entirely
- Use events for init logging
- Standardize on Solidity 0.8.19
- Exact version pinning (no ranges)
- 7-day minimum package age check

From `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` (LOCKED 2026-08-03): D1-D13. See source file for full text.

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended PD-1 through PD-7 from `private-network-ai.md` + owner resolutions_
