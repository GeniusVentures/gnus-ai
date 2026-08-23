# Synthesized Requirements

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest); **Updated:** 2026-08-23 (Secure-BridgeIn SPEC ingest)
**Mode:** merge

## Existing Requirements (unchanged)

The 22 existing requirements in `.planning/REQUIREMENTS.md` (DEBT-01 through DEP-01, plus BRIDGE-01..04, TREASURY-01..03, PROXY-01..03, SC1..SC8, LIC-01..07) cover the smart-contract remediation + Phase 8-14 scope. They are not modified by either ingest.

## New Requirement Candidates (DOC-derived, 2026-08-03, pending roadmapper acceptance)

The following requirement candidates are extracted from `private-network-ai.md` and clarified by owner resolutions delivered 2026-08-03. They are **candidates** for a new Phase 14 ("Private-Network AI Licensing"). They are NOT yet in `.planning/REQUIREMENTS.md` — the roadmapper owns that file.

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

---

## New Requirement Candidates (SPEC-derived, 2026-08-23, pending roadmapper acceptance)

The following requirement candidates are extracted from `docs/Secure-BridgeIn.md` (SPEC, classified 2026-08-23, high confidence). They are **candidates** for a new bridge-security phase (tentatively "Phase 15" or a Phase 10 amendment). They are NOT yet in `.planning/REQUIREMENTS.md`. **They would amend locked Phase 10 decisions if accepted** — the roadmapper must route through CONTEXT amendment before any implementation work begins.

### REQ-bridge-attestor-v2-storage (parent: schema)

- **Source:** `docs/Secure-BridgeIn.md` (lines 153-179)
- **Description:** Append three V2 fields to `GNUSBridgeValidatorStorage.Layout` to support a rolling API-attestor root: `bridgeAttestorRoot`, `bridgeAttestorEpoch`, `bridgeAttestorV2Initialized`.
- **Acceptance:**
  - Existing fields (`processedMessages`, `validatorMerkleRoot`, `validatorThreshold`) preserved byte-for-byte (append-only)
  - V2 fields appended in the specified order with the specified types
  - Legacy fields become dead once V2 is active but remain in storage
  - Diamond storage upgrade test proves existing deployed state decodes correctly

### REQ-bridge-attestor-v2-initializer

- **Source:** `docs/Secure-BridgeIn.md` (lines 201-238)
- **Description:** One-time `initializeBridgeAttestorV2(address genesisAttestor) external onlySuperAdminRole` initializer that bootstraps the rolling root with a single trusted Genesis attestor.
- **Acceptance:**
  - Requires V2 not already initialized
  - Requires `genesisAttestor != address(0)`
  - Stores one-leaf root = `keccak256(abi.encodePacked(genesisAttestor))`, epoch = 0, initialized = true
  - Emits `BridgeAttestorSetInitialized(root, genesisAttestor)`
  - First successful bridge certificate must advance to a different root (no permanent Genesis mode)

### REQ-bridge-message-struct

- **Source:** `docs/Secure-BridgeIn.md` (lines 240-291)
- **Description:** Replace free-form `transferId` with a canonical `BridgeMessage` struct carrying `srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex, recipient, amount`. Derive replay message ID on-chain from the composite key.
- **Acceptance:**
  - Struct fields exactly as specified (ordering matters — it's part of the protocol)
  - Message ID derivation uses `BRIDGE_MESSAGE_ID_V2` domain constant + composite key
  - Two events in the same source transaction produce distinct message IDs via `sourceEventIndex`
  - Replay protection uses the existing `processedMessages` mapping (Phase 10 D-07 unchanged)
  - **Conflicts with Phase 10 D-06** (locked: canonical transferId = source-chain burn tx hash) — requires CONTEXT amendment

### REQ-bridge-certificate-v2-digest

- **Source:** `docs/Secure-BridgeIn.md` (lines 351-408)
- **Description:** Introduce `BRIDGE_CERTIFICATE_V2` domain constant and bind `currentAttestorRoot, currentAttestorEpoch, nextAttestorRoot` into the EIP-191 signed digest alongside the existing fields.
- **Acceptance:**
  - Digest computed via `ECDSAUpgradeable.toEthSignedMessageHash(structHash)`
  - Struct hash includes all fields in the specified order (part of the protocol)
  - Binds destination chain (`block.chainid`) and diamond address (`address(this)`) — cross-chain and cross-diamond replay protection preserved
  - Binds root transition (current + next root + epoch)
  - **Extends Phase 10 D-08/D-10** (locked digest shape) — requires CONTEXT amendment
  - Cross-language (C++/Solidity) fixed test vectors must agree on the exact digest

### REQ-bridge-attestor-certificate-verification

- **Source:** `docs/Secure-BridgeIn.md` (lines 411-458)
- **Description:** Replace `_verifyThresholdCertificate` with `_verifyBridgeAttestorCertificate` that enforces strict-ascending signer ordering, per-signer Merkle proof against `currentRoot`, epoch-derived threshold, and a 16-signature cap.
- **Acceptance:**
  - `signatures.length == merkleProofs.length`
  - `signatures.length >= requiredSignatures`
  - `signatures.length <= MAX_ATTESTOR_SIGNATURES (16)`
  - Each signature recovers via `ECDSAUpgradeable.tryRecover`; recovery errors rejected
  - Recovered addresses strictly ascending (`signer > lastSigner`)
  - Each signer verified against `currentRoot` via individual Merkle proof
  - Signers NOT verified against `nextAttestorRoot`
  - No MMR, no multiproof

### REQ-bridgeIn-v2-interface

- **Source:** `docs/Secure-BridgeIn.md` (lines 460-568)
- **Description:** Replace the legacy `bridgeIn(bytes32, uint256, address, uint256, bytes[], bytes32[][])` with a new `bridgeIn(BridgeMessage calldata message, bytes32 nextAttestorRoot, bytes[] calldata signatures, bytes32[][] calldata merkleProofs) external`.
- **Acceptance:**
  - Execution order: pause/init checks → destination/message checks → replay check → digest creation → certificate verification → replay marking + root update → mint via `_mintWithBridgeFee` → emit `BridgeReleased`
  - Pause check occurs BEFORE certificate work (Phase 10 D-21 aligned)
  - Replay marking + root update occur BEFORE mint (CEI)
  - Failed minting reverts the root update and replay marker (atomic transaction)
  - Genesis epoch (0) requires `nextAttestorRoot != currentRoot`
  - Root transition: if `nextAttestorRoot != currentRoot`, install and increment epoch by exactly one, emit `BridgeAttestorSetAdvanced`
  - Root unchanged: process claim without epoch increment
  - Mint routes through `_mintWithBridgeFee` (Phase 10 D-22 unchanged)
  - `BridgeReleased` event uses the canonical message ID and pre-fee amount

### REQ-legacy-selector-removal

- **Source:** `docs/Secure-BridgeIn.md` (lines 583-618)
- **Description:** Diamond upgrade must remove the legacy `bridgeIn` selector AND restrict `setValidatorSet` from being the routine rotation path.
- **Acceptance:**
  - Legacy `bridgeIn(bytes32, uint256, address, uint256, bytes[], bytes32[][])` selector removed OR replaced with always-reverting stub
  - `setValidatorSet()` either removed OR converted to explicitly named emergency-recovery function
  - Emergency recovery must: require paused state, require `onlySuperAdminRole`, require nonzero root, never restore Genesis mode, increment epoch, emit emergency-reset event
  - **Amends Phase 10 D-15** (locked: manual merkle-root rotation via setValidatorSet) — requires CONTEXT amendment

### REQ-supergenius-prerequisites

- **Source:** `docs/Secure-BridgeIn.md` (lines 123-131)
- **Description:** SuperGenius-repo issues #363 (signature-verified slot quorum) and #364 (slot-0 API verification success check) must land before production use of the new bridge.
- **Acceptance:**
  - SuperGenius#363 closed (slot quorum uses only signature-verified votes for correct proposal)
  - SuperGenius#364 closed (slot 0 identifies API RPC that actually succeeded for that exact claim)
  - EVM-side implementation can proceed in parallel, but production activation gates on these SG-side fixes
  - Cross-repo dependency tracked in `.planning/SUBREPOS.md` if/when this phase is scheduled

### REQ-cross-language-test-vectors

- **Source:** `docs/Secure-BridgeIn.md` (lines 709-727)
- **Description:** Fixed test vectors proving the C++ SuperGenius exporter and the Solidity verifier compute identical digests, signatures, and proofs.
- **Acceptance:**
  - Test vector contains: private key, 64-byte SG public key, derived EVM address, current root, current epoch, next root, all BridgeMessage fields, raw ABI struct hash, EIP-191 digest, 65-byte r‖s‖v signature, recovered EVM address, Merkle proof
  - C++ and Solidity implementations agree byte-for-byte
  - Vectors checked into the repo and run as part of CI

### REQ-bridge-v2-test-matrix

- **Source:** `docs/Secure-BridgeIn.md` (lines 654-727)
- **Description:** Comprehensive test suite covering bootstrap, current-root verification, root transitions, replay/domain binding, existing token behavior, and cross-language vectors.
- **Acceptance:** All checkbox items in the source doc (lines 657-707) covered. Includes bootstrap, current-root verification, root transitions, replay/domain binding, existing token behavior, and cross-language vectors. **Extends Phase 10 test suite** — does not replace it; the Phase 10 tests cover the legacy path which is being removed.

---

## Infrastructure PRDs (Out of Scope — unchanged from 2026-05-26)

Three PRD-type documents ingested 2026-05-26 define requirements for DevContainer infrastructure. Acknowledged for context, not added to Active requirements:

- **INFRA-PRD-01**: DevContainer Docker-Compose and HashiCorp Vault Integration (`.devcontainer/project/prd/docker-compose-prd.md`)
- **INFRA-PRD-02**: HashiCorp Vault Persistence & CLI Installation (`.devcontainer/project/prd/vault-persistence-cli-prd.md`)
- **INFRA-PRD-03**: HashiCorp Vault Remote Connectivity (`.devcontainer/project/prd/vault-remote-connectivity-prd.md`)

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended REQ-private-network-licensing through REQ-private-network-spend-design from `private-network-ai.md` + owner resolutions_
_Updated: 2026-08-23 — appended REQ-bridge-attestor-v2-storage through REQ-bridge-v2-test-matrix from `docs/Secure-BridgeIn.md` SPEC_
