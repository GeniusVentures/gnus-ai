# Synthesized Decisions

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest); **Updated:** 2026-08-23 (Secure-BridgeIn SPEC ingest)
**Mode:** merge

## No New ADR-Locked Decisions Surfaced

No ADR-type documents are present in any ingest set. The 2026-08-23 ingest adds one SPEC (`docs/Secure-BridgeIn.md`) classified `SPEC` with `locked: false` — it proposes implementation details but does not lock decisions. All existing locked decisions remain in:

- `.planning/PROJECT.md` — remediation project decisions (remove GeniusAI facet, Solidity 0.8.19, version pinning, etc.)
- `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` — Phase 13 locked decisions D1-D13
- `.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` — Phase 10 locked decisions D-01..D-22 (provenance-relocation bridge, validator set via manual merkle root, threshold-ECDSA certificate, EIP-191 digest, replay protection via `processedMessages`)

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

## Proposed Decisions (SPEC-derived, 2026-08-23 — Secure BridgeIn)

The following decisions are **proposed** by `docs/Secure-BridgeIn.md` (SPEC, classified 2026-08-23, confidence high, `locked: false`). They are NOT locked. They directly engage the bridge validator-set management and `bridgeIn` authorization surface owned by Phase 10 (locked decisions D-09..D-17), and would require explicit Phase 10 CONTEXT amendment before any implementation work. Recorded here so the roadmapper can decide whether to open a Phase 15 (or revisit Phase 10) CONTEXT.

### PD-BR-1: Replace permanent validator merkle root with rolling API-attestor root

- **Status:** proposed (SPEC, NOT locked — would AMEND locked Phase 10 D-15/D-16 if accepted)
- **Source:** `docs/Secure-BridgeIn.md` ("Goal" section, lines 80-122)
- **Decision:** Replace the current permanent validator-set design (manual merkle root + threshold, rotated by `setValidatorSet()`) with a small, rolling **bridge attestor root** that rotates as a side-effect of normal `bridgeIn` calls. Each certificate commits to an optional `nextAttestorRoot`; if it differs from the stored root, the contract installs it and increments `bridgeAttestorEpoch`.
- **Conflicts with:**
  - **Phase 10 D-15** (locked): "the diamond stores a threshold plus a merkle root … Rotation is less frequent than per-validator admin calls."
  - **Phase 10 D-16** (locked): "The exact mechanism for how the EVM chain learns the current SG validator set is **deliberately deferred**. … a manually-updated merkle root is acceptable."
- **Scope:** proposed new phase (candidate Phase 15 or Phase 10 amendment)
- **Resolution path:** requires Phase 10 CONTEXT amendment via `/gsd:context` on Phase 10, OR a new phase CONTEXT explicitly superseding D-15/D-16. Until then, D-15/D-16 stand.

### PD-BR-2: Genesis bootstrap → two-of-N active attestor threshold

- **Status:** proposed (SPEC, NOT locked — refines Phase 10 D-12 threshold shape)
- **Source:** `docs/Secure-BridgeIn.md` (lines 119-122, 183-197)
- **Decision:** One trusted Genesis EVM address with threshold 1 initializes the root (epoch 0). After the first successful transition, every certificate requires at least 2 authorized API attestors (`GENESIS_ATTESTOR_THRESHOLD = 1`, `ACTIVE_ATTESTOR_THRESHOLD = 2`, `MAX_ATTESTOR_SIGNATURES = 16`). The first certificate MUST advance to a different root — epoch 0 cannot persist.
- **Conflicts with:**
  - **Phase 10 D-12** (locked): "On-chain threshold: `m-of-n` over a diamond-registered validator set (e.g., 2/3 + 1 of registered validators)." — Phase 10 leaves threshold policy to the operator via `setValidatorSet`; the SPEC hard-codes epoch-derived thresholds.
- **Scope:** proposed new phase

### PD-BR-3: Canonical BridgeMessage struct + derived message ID

- **Status:** proposed (SPEC, NOT locked — replaces Phase 10 D-06 transferId derivation)
- **Source:** `docs/Secure-BridgeIn.md` (lines 240-291)
- **Decision:** Introduce a `BridgeMessage` struct `{srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex, recipient, amount}`. Derive replay key on-chain as `keccak256(abi.encode(BRIDGE_MESSAGE_ID_V2, srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex))`. Two valid events in the same source transaction remain distinct by event index.
- **Conflicts with:**
  - **Phase 10 D-06** (locked): "Canonical `transferId` = the source-chain burn transaction hash (keccak of the source EVM tx). This matches the SG-side identity scheme (`/bridge/executed/{chainid}:{tx_hash}`)."
  - The SPEC's composite key diverges from the locked "source-chain burn tx hash" identity. Alignment with the SG-side `/bridge/executed/{chainid}:{tx_hash}` path is NOT preserved by the SPEC.
- **Scope:** proposed new phase

### PD-BR-4: Domain-separated certificate digest (BRIDGE_CERTIFICATE_V2)

- **Status:** proposed (SPEC, NOT locked — extends Phase 10 D-08/D-10 digest shape)
- **Source:** `docs/Secure-BridgeIn.md` (lines 351-408)
- **Decision:** Add explicit domain constant `BRIDGE_CERTIFICATE_V2` and bind `currentAttestorRoot`, `currentAttestorEpoch`, `nextAttestorRoot` into the EIP-191 signed digest along with the existing fields (`transferId`-equivalents, srcChainID, destChainID, diamond address, recipient, tokenId, amount).
- **Conflicts with:**
  - **Phase 10 D-08** (locked): digest commits to `transferId, srcChainID, destChainID, address(diamond), recipient, tokenId, amount` — the SPEC adds three more fields and a new domain constant.
  - **Phase 10 D-10** (locked): digest shape — same observation.
- **Scope:** proposed new phase

### PD-BR-5: Strict-ascending signer order + per-signer Merkle proof

- **Status:** proposed (SPEC, NOT locked — already aligned with Phase 10 D-13, adds hardening)
- **Source:** `docs/Secure-BridgeIn.md` (lines 411-458)
- **Decision:** Recovered signer addresses must be strictly ascending (duplicate-proof). Each signer carries an individual Merkle proof against `currentRoot`. No MMR, no multiproof. Cap of 16 signatures per certificate.
- **Conflicts with:** None — already aligned with Phase 10 D-13. The cap and per-signer proof requirements are extensions, not contradictions.
- **Scope:** proposed new phase

### PD-BR-6: Remove legacy `bridgeIn` selector + restrict `setValidatorSet`

- **Status:** proposed (SPEC, NOT locked — would AMEND the Phase 10-shipped surface)
- **Source:** `docs/Secure-BridgeIn.md` (lines 583-618)
- **Decision:** Diamond upgrade must remove the legacy `bridgeIn(bytes32, uint256, address, uint256, bytes[], bytes32[][])` selector. `setValidatorSet()` must either be removed or converted to an explicitly named emergency-recovery function (requires paused state, `onlySuperAdminRole`, nonzero root, never restores one-signature Genesis mode, increments epoch, emits emergency-reset event).
- **Conflicts with:**
  - **Phase 10-shipped implementation** (locked in deployed bytecode): `setValidatorSet()` is currently the routine rotation path.
  - **Phase 10 D-15** (locked): manual merkle-root rotation via `setValidatorSet` is the current commitment.
- **Scope:** proposed new phase
- **Note:** Phase 13-06-PLAN.md explicitly states "No changes to bridgeIn" — Phase 13 work does not conflict, but the SPEC's selector removal WOULD collide with any in-flight Phase 13 testing that exercises the existing `bridgeIn` shape. Roadmapper must sequence this carefully.

### PD-BR-7: Native ConsensusVote.signature NOT directly verifiable on EVM

- **Status:** proposed (SPEC, NOT locked — already aligned with Phase 10 D-11)
- **Source:** `docs/Secure-BridgeIn.md` (lines 60, 132-151)
- **Decision:** SuperGenius's native `ConsensusVote.signature` (64-byte non-recoverable secp256k1 over double-SHA-256, little-endian scalars) cannot be submitted to Solidity `ECDSAUpgradeable.tryRecover`. The SG bridge exporter must produce a separate 65-byte recoverable `r||s||v` signature over the EIP-191 digest with low-s canonical form.
- **Conflicts with:** None — already aligned with Phase 10 D-11 ("SG consensus envelope … is **not** used on-chain").
- **Scope:** proposed new phase (exporter-side prerequisite)

### PD-BR-8: SuperGenius issues #363 and #364 are blocking prerequisites

- **Status:** proposed (SPEC, NOT locked — external dependency)
- **Source:** `docs/Secure-BridgeIn.md` (lines 123-131)
- **Decision:** Bridge slot quorum must use only signature-verified votes for the correct proposal (SuperGenius#363). Slot 0 must identify an API RPC that actually succeeded for that exact claim, not merely an endpoint present in configuration (SuperGenius#364). The Solidity contract assumes it receives an EVM-specific certificate produced only after those checks.
- **Conflicts with:** None — but introduces an external dependency on SuperGenius-repo work that must land before the new bridge design can be considered secure in production.
- **Scope:** proposed new phase (cross-repo dependency)

> **OWNER RULING 2026-08-26:** #363/#364 are NOT local blockers — they are being fixed in
> parallel in the SuperGenius repo. EVM-side Phase 15 work proceeds concurrently; the issues
> gate **production activation only** (BRIDGE-17). #364 is already CLOSED; #363 remains OPEN.
> Also verified 2026-08-26: the six engaged Phase 10 decisions (D-06/D-08/D-10/D-12/D-15/D-16)
> are **NOT deprecated** — shipped `GNUSBridge.sol` implements them verbatim (digest `:384-393`,
> threshold `:423`, `setValidatorSet` `:499`); no later phase amended them. The Phase 15 CONTEXT
> must amend them explicitly. Scheduled as ROADMAP §Phase 15 (2026-08-26).

---

## Existing Locked Decisions (unchanged)

From `.planning/PROJECT.md` "Key Decisions" (remediation project — unrelated to Phase 14 or the new SPEC):

- Remove GeniusAI facet entirely
- Use events for init logging
- Standardize on Solidity 0.8.19
- Exact version pinning (no ranges)
- 7-day minimum package age check

From `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` (LOCKED 2026-08-03): D1-D13. See source file for full text.

From `.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` (LOCKED 2026-08-17): D-01..D-22. Of particular relevance to the 2026-08-23 SPEC ingest:

- D-01..D-03: Provenance relocation (no vault, no escrow)
- D-04..D-08: State machine and replay protection (NONE → INITIATED → RELEASED; `processedMessages` mapping; digest shape)
- D-09..D-14: Bridge-in authorization (threshold ECDSA certificate; EIP-191 digest; m-of-n over registered validator set; sorted-ascending signers; GNUS_TOKEN_ID only)
- D-15..D-17: Validator set management (manual merkle root + threshold; rotation deferred; SG keys derived from Ethereum keys)
- D-18..D-19: Interim / progressive authorization (manual multisig OK for current phase; amount-tiered policy deferred)
- D-20..D-21: Emergency pause semantics (strict — bridgeIn reverts when paused)
- D-22: Fee and cap integration (bridgeIn routes through `_mintWithBridgeFee`)

The 2026-08-23 SPEC does NOT unlock any of these. It proposes a follow-on phase that would amend D-06, D-08, D-10, D-12, D-15, D-16, and the shipped `setValidatorSet` path. Until that amendment is explicit via CONTEXT, the Phase 10 locked decisions stand.

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended PD-1 through PD-7 from `private-network-ai.md` + owner resolutions_
_Updated: 2026-08-23 — appended PD-BR-1 through PD-BR-8 from `docs/Secure-BridgeIn.md` SPEC_
