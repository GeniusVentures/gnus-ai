# Phase 14: Private-Network AI Licensing - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning (2 research-open decisions, see D-09/D-11)

<domain>
## Phase Boundary

Per-company tenant licensing on the public EVM canonical layer with SuperGenius private-network execution: License NFTs as tenant/network identity, company AI Credits as spendable children of the License NFT, a payment/purchase path for license creation + renewal + credit minting, and the `LicenseActivated` event as the sole SuperGenius-side license-state source. Storage append (`networkScope`, `privateNetworkId`, `publicSettlementEnabled`) after Phase 13 fields. Private-spend settlement reuses existing rails — NO new bridge mechanism this phase.

</domain>

<decisions>
## Implementation Decisions

### Promoted from intel PD-1..PD-6 (owner-resolved at 2026-08-03 ingest — locked here)
- **D-01 (PD-1):** Public EVM diamond = canonical billing/settlement/audit layer; SuperGenius chain = private execution/usage layer. Existing GNUS↔SG bridge (Phases 8/10); no new mirroring system.
- **D-02 (PD-2):** GNUS AI Product Root token IS the public AI network. Company License NFTs are its children; company AI Credits are children of the License NFT (grandchildren of the product root). Individual AI Credits stay direct product-root children (Phase 13 D11 unamended).
- **D-03 (PD-3):** Append `NetworkScope networkScope` ({PublicOnly=0, PrivateOnly, Hybrid}), `uint256 privateNetworkId`, `bool publicSettlementEnabled` after Phase 13's lifecycle fields — append-only, zero-default (PublicOnly/0/false) decode-compat upgrade test required.
- **D-04 (PD-4):** SKU/Product registry with fixed minion-denominated prices (`priceInMinions`, `creditAmount`, `duration`, `createsLicense`, `renewsLicense`, `active`). NO USD oracle, no `priceUsd`.
- **D-05 (PD-5):** Hybrid-scope tokens MUST be REDEEM_TO_PARENT-capable: `exchangeRate > 0`, Phase 13 D8 disposition, Phase 9 `mintBackedChild` collateralization. Burn-only AI Credits remain non-redeemable.
- **D-06 (PD-6):** Phase 13 mechanisms (TransferPolicy, ExpirationMode, ExpirationDisposition, settlement, enforcement) are referenced, never redefined or extended.

### Private-spend settlement (PD-7 — resolved this discussion)
- **D-07:** NO new on-chain spend-settlement mechanism in Phase 14. Pattern: SuperGenius-side spend routes credits to the GeniusVentures wallet → credits re-enter EVM via the existing Phase 10 `bridgeIn` → resulting burns are operational actions using existing burn paths.
- **D-08:** `publicSettlementEnabled` is a policy/informational flag consumed by the SuperGenius side (whether this token's spends may settle publicly). It does NOT gate a new on-chain settlement path.

### Payment rails
- **D-09 (RESEARCH-OPEN):** Rail scope NOT locked. User's working model: a company pays ~$20 fiat off-chain (credit card / bank transfer to GV); GV uses ~$5 to acquire GNUS and mints the private child/license token (operator-mediated). Separately the user leans toward allowing permissionless self-serve purchase in GNUS ("who cares if they buy more NFT AI tokens — it's $5/month, non-transferrable, time-boxed"). Research must evaluate: operator-mediated-only vs permissionless-self-serve + operator hybrid, and whether any direct USDC contract rail is warranted given GeniusWallet already owns acquisition (Banxa on-ramp + Squid Router swaps; users arrive holding GNUS).
- **D-10:** Where an on-chain GNUS payment exists, the paid GNUS is BURNED (totalSupply decreases). Deflationary revenue; no treasury custody in the router.

### Purchase/creation authorization
- **D-11 (RESEARCH-OPEN):** Permissionless self-serve purchase vs operator-gated creation — user leans permissionless for credit SKUs (cheap, SOULBOUND, time-boxed) with an operator path retained for fiat-paying companies. Research must deliver a pros/cons table (griefing/Sybil, SKU exhaustion, refund/dispute handling for fiat, gas, ops burden) before the planner locks the auth model. License NFT creation itself remains creator-role-gated (see D-12).

### License lifecycle
- **D-12:** License NFTs use **PerTokenId** `validUntil` (the license IS the account object); renewal SKUs extend it. Credits under the license keep Phase 13 PerHolder + BURN. NFT/token creation stays behind the existing CREATOR_ROLE / Genius Ventures multisig ADMIN_ROLE pattern (existing `_CREATOR_ROLE`/`DEFAULT_ADMIN_ROLE` gates in `GNUSNFTFactory`/`GNUSLifecycle`).
- **D-13:** `companyAdmin` is a data field set at license creation by the creator (operator) and emitted in `LicenseActivated`; admin changes are operator-gated. No on-chain self-managed admin/seat rotation in v1.
- **D-14:** `LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)` on creation AND every renewal (LIC-05); SuperGenius consumers derive license state from events alone. License expiry/deactivation is SG-side, driven by events (no new on-chain enforcement beyond PerTokenId validUntil semantics).

### Exploration refinements (2026-08-25 /gsd-explore session)
- **D-19:** Credits are minted **directly into device wallets** — embedded wallets generated inside the device software that performs the AI. GV (manually or automated, after payment) mints into the identified device wallets. p2p private keys are the true SG-side access control; on-chain data serves billing/renewal/audit only.
- **D-20:** The per-company child token is a **metadata namespace** (tenant grouping of its AI tokens) — NOT a governed admin object. No on-chain companyAdmin governance machinery (supersedes D-13's admin-change semantics; `companyAdmin` remains at most an event/config data field).
- **D-21:** Expiry crosses to SuperGenius via the **bridge attestation's EVM RPC lookup** (`holderExpiresAt` / `validUntil`) — NO bridgeOut event/message change in Phase 14. Determinism (snapshot at burn block) is a research question, not a contract change.
- **D-22:** SG-side timed UTXOs (extensible GeniusUTXO metadata: `expiresAt` field 1, consensus-enforced unspendable-when-expired + pruning; future meta.json URI pointer) are the designated destination — tracked as seed `seeds/sg-extensible-utxo-metadata.md`, implemented in the SuperGenius repo. No app-level lazy-validation interim layer to build.
- **D-23:** Consider an EVM-side "expired tokens cannot bridgeOut" gate for symmetry with SG-side rejection of past-expiry attestations (placement is a research question; note: EVM mint-side expiry gating already exists — `"Sale ended"` in `enforceMintGate` on both mint paths).

### Standing project constraints (carried from prior phases)
- **D-15:** `protocolVersion` stays **2.6** — new facets re-key into `versions["2.6"]` with fromVersions [0.0, 2.4, 2.5]. NEVER bump past 2.6 until 2.6 deploys.
- **D-16:** Facet-split pattern with no delegatecall trampolines; shared logic in compile-time-linked libraries (GNUSLifecyclePolicy precedent) only.
- **D-17:** PerHolder expiry requires a balance-removing disposition (Phase 13 Codex PR #77 fix) — all credit SKU configs must comply (BURN/RETURN/REDEEM, never NONE/KEEP_INERT with PerHolder).
- **D-18:** Solidity 0.8.19; diamond storage append-only; EIP-170 ≤ 24,576 bytes per facet; no magic numbers; no viaIR.

### Claude's Discretion
- SKU registry administration details: managed via existing CREATOR_ROLE/ADMIN roles; SKU enable/disable via the LIC-03 `active` flag (no new role machinery unless research shows need).
- Placement of router/registry logic across facets honoring the facet-split + bytecode-budget constraints.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase source & requirements
- `.planning/private-network-ai.md` — original product doc (hierarchy, flows, structs). SUPERSEDED in parts by owner resolutions: `priceUsd`→`priceInMinions` (PD-4), Individual License NFT branch rejected (PD-2), USDC/Banxa contract rails questioned by D-09.
- `.planning/intel/decisions.md` — PD-1..PD-7 full text (owner resolutions) + PD-BR-1..8 (Phase 10 amendment candidates — NOT this phase).
- `.planning/REQUIREMENTS.md` LIC-01..LIC-07 — requirement definitions.
- `.planning/ROADMAP.md` §Phase 14 — goal + success criteria 1-7.

### Locked prior-phase context
- `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` — D1-D13 (lifecycle, policies, dispositions, D11 AI Credits shape).
- `.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` — D-01..D-22 (bridgeIn/certificates — reused by D-07).
- `.planning/phases/09-per-child-gnus-treasury-reserve/09-CONTEXT.md` — reserve/collateral model (D-05 dependency).

### Implementation surface
- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — NFT struct (Phase 13 fields at +8..+10; D-03 appends after).
- `contracts/gnus-ai/GNUSLifecycle.sol`, `GNUSLifecycleMint.sol`, `GNUSLifecyclePolicy.sol`, `GNUSLifecycleStorage.sol` — lifecycle/policy/settlement machinery referenced by D-06.
- `contracts/gnus-ai/GNUSBridge.sol` — bridgeOut policy gate + Phase 10 bridgeIn (D-07 reuse).
- `diamonds/GeniusDiamond/geniusdiamond.config.json` — facet registration (D-15: re-key into 2.6).

### Adjacent repo (read-only context)
- `../GeniusWallet/.planning/PROJECT.md` — confirms Banxa fiat on-ramp + Squid Router already shipped wallet-side (basis for D-09).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createNFTWithLifecycle` — combined creation + lifecycle config, no UNRESTRICTED-default window (Q5); template for license/credit creation.
- Phase 13 `configureLifecycle` validation gates (Q1/Q2/Q6, enum ranges, PerHolder balance-removing-disposition) — reused for any new config surface.
- Phase 10 `bridgeIn` certificate machinery — reused as-is per D-07 (no changes).
- `GeniusAccessControl` roles (`_CREATOR_ROLE`, `DEFAULT_ADMIN_ROLE`, `NFT_PROXY_OPERATOR_ROLE`) — D-12 gating.

### Established Patterns
- Facet split + compile-time-linked library (GNUSLifecyclePolicy) for shared predicates.
- Append-only storage with slot-annotated decode-compat upgrade tests (Phase 13 SC1 pattern) — D-03 follows it.
- Events as the cross-system contract: Phase 13 `HolderExpiryUpdated`/`Settled`; Phase 14 adds `LicenseActivated` in the same spirit (D-14).

### Integration Points
- NFT struct append (D-03) — after Phase 13 fields; slot-math + legacy decode tests required.
- Phase 9 `mintBackedChild` collateralization for Hybrid tokens (D-05).
- `GNUS_TOKEN_ID` early-return in the policy predicate — new public/licensing facets must not break the GNUS lockout.

</code_context>

<specifics>
## Specific Ideas

- User's fiat flow sketch (D-09): "a private network will pay via credit card or bank transfer to us $20.00, then we will use $5.00 to buy GNUS tokens and mint their private child token."
- User's permissionless lean (D-11): "who cares if they buy more NFT AI Tokens? It's only $5.00 for the month in their NFT, not transferrable, just a time window for use."
- PD-7 resolution sketch (D-07): "probably not an actual burn on SuperGenius chain — it may just go to the GeniusVentures wallet, which could bridgeIn to EVM and then burn them manually."

</specifics>

<deferred>
## Deferred Ideas

- On-chain Banxa/USDC contract-side payment rails (LIC-04 as written) — pending D-09 research; may be amended to GNUS-only + operator fiat path.
- PD-BR-1..PD-BR-8 (Secure-BridgeIn SPEC) — Phase 10 amendment candidates, queued separately post-Phase-13; NOT Phase 14 scope.
- On-chain seat/operator management for company tenants (D-13 defers to v2).

</deferred>

---

*Phase: 14-Private-Network AI Licensing*
*Context gathered: 2026-08-25*
