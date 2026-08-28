# Synthesized Context

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest); **Updated:** 2026-08-23 (Secure-BridgeIn SPEC ingest)
**Mode:** merge

## Smart Contract Ecosystem (from 2026-05-26 ingest — unchanged)

### Diamond Architecture Confirmed

The GeniusDiamond (`docs/GeniusDiamond.md`) implements EIP-2535 with ERC165 and ERC1155 compatibility. 11 facets are deployed on testnet. The diamond proxy delegates all calls to facet contracts with DiamondCutFacet managing upgrades. Storage is namespaced per facet using the diamond storage pattern.

### Facet-by-Facet Documentation Available

Full API reference documentation exists for every facet in the diamond: GeniusDiamond, GeniusAccessControl, GeniusOwnershipFacet, GNUSBridge, GNUSERC1155MaxSupply, GNUSNFTFactory, GNUSControl, GNUSWithdrawLimiter, ERC20TransferBatch, ERC1155ProxyOperator, GNUSContractAssets, GNUSNFTCollectionName, GeniusAI (DEAD CODE), GeniusAIStorage (DEAD CODE).

### Storage Libraries

- `GNUSControlStorage`: banned transferor mappings, bridge fee, protocol version, chain ID
- `GNUSNFTFactoryStorage`: NFT Factory diamond storage layout — the `NFT` struct is the append target for Phase 13 (lifecycle) and Phase 14 (network scope) fields
- `GNUSBridgeValidatorStorage`: Bridge validator storage (Phase 10) — `processedMessages`, `validatorMerkleRoot`, `validatorThreshold`. Append target for the proposed V2 rolling attestor fields (`bridgeAttestorRoot`, `bridgeAttestorEpoch`, `bridgeAttestorV2Initialized`) per `docs/Secure-BridgeIn.md`.

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
- **Phase 12 (Supply Ledger):** Convention shared — expired-unsettled balances count as circulating (Phase 13 D9). **Phase 12 retired 2026-08-21** — the convention is now owned by Phase 13 itself.

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

## Secure BridgeIn with Rolling API-Attestor Roots (NEW — 2026-08-23 ingest)

**Source:** `docs/Secure-BridgeIn.md` (SPEC, classified 2026-08-23, confidence high, `locked: false`)
**Format note:** The source doc is a ChatGPT-conversation export with implementation-ready LLM prompts embedded. The technical content is intact and unambiguous.

### Topic: Problem statement — replace permanent validator set with rolling attestor root

The current `GNUSBridge` ships (Phase 10) with a permanent validator merkle root + threshold, rotated by admin via `setValidatorSet()`. The SPEC argues this is an operational liability:

- Manual rotation requires Super Admin multisig action per rotation
- No way to retire compromised attestors without admin intervention
- Genesis-style one-signature mode never auto-escalates

The proposed replacement is a **rolling API-attestor root** that rotates as a side-effect of normal `bridgeIn` calls. Each certificate optionally commits to `nextAttestorRoot`; if it differs from the stored root, the contract installs it and increments `bridgeAttestorEpoch`. Trust chain:

```
Genesis bridge attestor (threshold 1)
    ↓ signs first claim + first API-attestor root
API-attestor root R1 (threshold 2)
    ↓ threshold of R1 signs next claim + optional root R2
API-attestor root R2 (threshold 2)
    ↓
...
```

### Topic: Bridge attestor set definition (restrictive)

The bridge attestor root contains ONLY SuperGenius nodes that:

1. Have an API-backed or otherwise trusted slot-0 RPC endpoint
2. Actually succeeded in verifying the relevant public-chain claim
3. Were accepted into the next bridge-attestor set by the previously authorized bridge attestors

**Excluded:**
- Public-RPC-only nodes
- Ordinary non-API validators
- Consensus reputation weights
- The full SuperGenius validator registry
- RPC URLs
- An MMR
- A Solidity implementation of SuperGenius consensus

### Topic: Storage layout (append-only V2)

`GNUSBridgeValidatorStorage.Layout` gains three V2 fields appended after the Phase 10 fields:

```solidity
struct Layout {
    // Phase 10 fields (locked, do not move or modify):
    mapping(bytes32 => bool) processedMessages;
    bytes32 validatorMerkleRoot;
    uint256 validatorThreshold;

    // V2 rolling API-attestor state:
    bytes32 bridgeAttestorRoot;
    uint64 bridgeAttestorEpoch;
    bool bridgeAttestorV2Initialized;
}
```

The legacy `validatorMerkleRoot`/`validatorThreshold` fields are NOT repurposed — they become dead once V2 is active. Append-only invariant preserves existing deployed state.

### Topic: Epoch-derived thresholds

```solidity
GENESIS_ATTESTOR_THRESHOLD = 1   // epoch 0 only
ACTIVE_ATTESTOR_THRESHOLD  = 2   // epoch >= 1
MAX_ATTESTOR_SIGNATURES    = 16  // gas bound
```

The certificate cannot choose its own threshold — the contract derives it from the stored epoch. Genesis epoch (0) accepts one signature; all later epochs require at least two. **First valid certificate MUST advance to a different root** — epoch 0 cannot persist.

### Topic: BridgeMessage struct (canonical source-event identity)

```solidity
struct BridgeMessage {
    uint256 srcChainID;
    bytes32 sourceBridgeID;      // bridge contract / subsystem on source
    bytes32 sourceTxHash;        // source-ledger tx ID
    uint256 sourceEventIndex;    // log/output index within sourceTxHash
    address recipient;
    uint256 amount;              // pre-fee
}
```

Replay key derived on-chain as `keccak256(abi.encode(BRIDGE_MESSAGE_ID_V2, srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex))`. Two valid events in the same source transaction remain distinct via `sourceEventIndex`.

**Divergence from Phase 10 D-06 (locked):** Phase 10 locked `transferId = source-chain burn tx hash` (matching SG's `/bridge/executed/{chainid}:{tx_hash}` path). The SPEC's composite key includes `sourceEventIndex` and `sourceBridgeID`, diverging from the SG-side identity scheme. This is a deliberate upgrade (enables multi-event transactions) but requires CONTEXT amendment.

### Topic: Certificate digest (BRIDGE_CERTIFICATE_V2)

EIP-191 wrapped digest binding:
- Domain constant `BRIDGE_CERTIFICATE_V2`
- `currentAttestorEpoch`, `currentAttestorRoot`, `nextAttestorRoot` (root transition)
- All BridgeMessage fields
- `block.chainid` (destination chain)
- `address(this)` (destination diamond)
- `GNUS_TOKEN_ID`

**Extension of Phase 10 D-08/D-10 (locked):** Phase 10 digest commits to `transferId, srcChainID, destChainID, address(diamond), recipient, tokenId, amount`. The SPEC adds three more fields (epoch, current root, next root) and a new domain constant. Field order and Solidity types are part of the protocol — cross-language test vectors required.

### Topic: Strict-ascending signer ordering (aligned with Phase 10 D-13)

- Recovered signer addresses must be strictly ascending (`signer > lastSigner`) — duplicate-proof
- Each signer carries an individual Merkle proof against `currentRoot` (NOT `nextAttestorRoot`)
- Leaf = `keccak256(abi.encodePacked(signer))`
- New attestors in `nextAttestorRoot` become eligible to sign the FOLLOWING certificate, not the one that installs them
- No MMR, no multiproof — individual proofs only

### Topic: Root transition semantics

- `nextAttestorRoot == currentRoot` → process claim, no root change, no epoch increment
- `nextAttestorRoot != currentRoot` → install next root, increment epoch by exactly one, emit `BridgeAttestorSetAdvanced`
- At epoch 0: `nextAttestorRoot != currentRoot` is REQUIRED
- Failed minting reverts the root update and replay marker (atomic transaction)

This permits multiple claims against an unchanged root without forcing a strict global sequence. Two competing rotations from the same old root cannot both succeed (replay protection via `processedMessages`).

### Topic: Legacy selector removal + setValidatorSet restriction

Diamond upgrade must:
1. Remove the legacy `bridgeIn(bytes32, uint256, address, uint256, bytes[], bytes32[][])` selector OR replace with always-reverting stub
2. Convert `setValidatorSet()` to emergency-recovery OR remove it

**Emergency recovery invariants:** paused state, `onlySuperAdminRole`, nonzero root, never restores Genesis mode, increments epoch, emits emergency-reset event. The Super Admin cannot silently rotate the root while the bridge is unpaused.

**Amends Phase 10 D-15 (locked):** Phase 10 locked `setValidatorSet` as the routine rotation path. The SPEC explicitly removes this routine path.

### Topic: Native ConsensusVote.signature NOT EVM-verifiable

SuperGenius's native `ConsensusVote.signature`:
- 64-byte, non-recoverable secp256k1
- Over double-SHA-256 hash
- Scalars stored least-significant byte first
- No recovery ID

Solidity `ECDSAUpgradeable.tryRecover` expects:
- 65-byte `r || s || v`
- Over EIP-191 digest
- Big-endian scalars
- `v` ∈ {27, 28}
- Low-s canonical form

The SG bridge exporter MUST produce a separate EVM-specific signature. EVM address = last 20 bytes of `keccak256(uncompressedPublicKeyWithout04Prefix)`. Cross-language test vectors required.

**Aligned with Phase 10 D-11 (locked):** "The SG consensus envelope (double-SHA256, little-endian scalars, no recovery ID) is **not** used on-chain."

### Topic: SuperGenius-side prerequisites (external dependency)

Two SuperGenius-repo issues gate production readiness:

- **SuperGenius#363:** Bridge slot quorum must use only signature-verified votes for the correct proposal
- **SuperGenius#364:** Slot 0 must identify an API RPC that actually succeeded for that exact claim (not merely an endpoint present in configuration)

The Solidity contract assumes it receives an EVM-specific certificate produced only after these checks. EVM-side implementation can proceed in parallel; production activation gates on the SG-side fixes.

### Topic: Test matrix (comprehensive)

The SPEC mandates a six-section test matrix:

1. **Bootstrap:** initialization, epoch-0 Genesis signature, first-certificate root transition, post-bootstrap threshold
2. **Current-root verification:** 2-of-N attestor claims, nextRoot-only signer rejection, public-only validator rejection, invalid signature/proof/duplicate/unsorted/overflow
3. **Root transitions:** unchanged root (no epoch bump), changed root (epoch +1), old-root certificate fails after rotation, competing rotations rejected, failed mint reverts everything
4. **Replay and domain binding:** same event cannot execute twice, distinct event indexes distinct, sourceBridgeID/chain/recipient/amount changes break digest, cross-chain and cross-diamond certificates fail, native SG vote bytes fail
5. **Existing token behavior:** bridge fee, zero post-fee revert, global max supply, chainSupply updates, BridgeReleased event, pause check before certificate work
6. **Cross-language vectors:** fixed C++/Solidity test vectors agreeing byte-for-byte

### Topic: Non-goals (explicit)

The SPEC explicitly excludes:
- MMR verification
- ZK proofs
- Full SuperGenius certificate decoding in Solidity
- Consensus-weight calculations
- Public-RPC validator registration
- RPC URLs in Solidity
- Per-validator reputation in Solidity
- Admin-driven routine root rotation
- Child-token bridge-in support
- Changes to `_mintWithBridgeFee` except those strictly required for integration

### Topic: Cross-references to existing planning

- **Phase 10 (locked D-01..D-22):** The SPEC would amend D-06 (transferId derivation), D-08 (digest shape), D-10 (digest shape), D-12 (threshold derivation), D-15 (manual rotation), D-16 (deferred rotation mechanism). It is aligned with D-01..D-05 (provenance relocation, state machine), D-07 (processedMessages replay), D-09 (threshold ECDSA), D-11 (no native SG envelope on-chain), D-13 (sorted-ascending signers), D-14 (GNUS_TOKEN_ID only), D-20..D-22 (pause semantics, _mintWithBridgeFee routing).
- **Phase 13 (13-06-PLAN):** "No changes to bridgeIn" — Phase 13 work is not blocked, but the SPEC's selector-removal requirement will collide with any in-flight Phase 13 testing that exercises the existing bridgeIn shape. The new phase must sequence AFTER Phase 13 completion OR explicitly amend Phase 13-06.
- **Phase 9 (treasury/reserve):** No interaction — the SPEC is orthogonal to the conversion-native model.

### Topic: Relationship to existing roadmap

This SPEC proposes **NEW scope** — a follow-on phase (tentatively "Phase 15: Secure BridgeIn V2" or "Phase 10 Amendment: Rolling Attestor Roots") that would land AFTER Phase 13 completes and AFTER the roadmapper opens CONTEXT for it. It does NOT fit within Phase 13's current scope (13-06 explicitly excludes bridgeIn changes). It does NOT fit within Phase 14 (Private-Network Licensing), which is layered on TOP of the existing bridge.

---

## Summary Statistics (cumulative)

- **37 documents ingested** across 37 classification files (35 from 2026-05-26 + 1 from 2026-08-03 + 1 from 2026-08-23)
- **18** smart contract API reference docs
- **4** deployment infrastructure docs
- **10** DevContainer infrastructure docs + 3 infrastructure PRDs
- **1** Foundry testing doc
- **1** smart contracts overview doc
- **1** private-network AI licensing design doc (2026-08-03)
- **1** Secure BridgeIn SPEC (2026-08-23, NEW)
- **7** requirement candidates proposed for Phase 14 (REQ-private-network-licensing through REQ-private-network-spend-design)
- **10** requirement candidates proposed for new bridge-security phase (REQ-bridge-attestor-v2-storage through REQ-bridge-v2-test-matrix)
- **7** constraints proposed for Phase 14 (C-PN-1 through C-PN-7)
- **11** constraints proposed for new bridge-security phase (C-BR-1 through C-BR-11)
- **7** proposed decisions for Phase 14 (PD-1 through PD-7, with PD-7 explicitly OPEN)
- **8** proposed decisions for new bridge-security phase (PD-BR-1 through PD-BR-8)

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended Private-Network AI Licensing section from `private-network-ai.md` + owner resolutions_
_Updated: 2026-08-23 — appended Secure BridgeIn section from `docs/Secure-BridgeIn.md` SPEC_
