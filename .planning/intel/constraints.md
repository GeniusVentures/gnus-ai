# Synthesized Constraints

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest); **Updated:** 2026-08-23 (Secure-BridgeIn SPEC ingest)
**Mode:** merge

## Existing Constraints Confirmed (unchanged)

All constraints in `.planning/PROJECT.md` remain valid. The 2026-05-26 ingest confirmed them; the 2026-08-03 and 2026-08-23 ingests do not challenge them.

- Solidity 0.8.19 compiler target (confirmed by all 18 contract API docs)
- EIP-2535 Diamond storage pattern (confirmed by GeniusDiamond.md, GeniusAIStorage.md, GNUSNFTFactoryStorage.md, GNUSControlStorage.md, GNUSBridgeValidatorStorage.sol)
- Diamond upgrade via DiamondCutFacet
- Role-based access control (DEFAULT_ADMIN_ROLE, MINTER_ROLE, UPGRADER_ROLE)
- ERC-1155 token with max supply

## New Constraints (DOC-derived, schema/api-contract types — 2026-08-03)

The following constraints are extracted from `private-network-ai.md` and owner resolutions (2026-08-03). They apply to the proposed Phase 14 scope.

### C-PN-1: NetworkScope enum schema (type: schema)

- **Source:** `.planning/private-network-ai.md` (lines 410-415); owner resolution #3
- **Constraint:**
  ```solidity
  enum NetworkScope {
      PublicOnly,   // 0 — backwards-compatible default
      PrivateOnly,  // 1
      Hybrid        // 2
  }
  ```
- **Invariants:**
  - Ordinal 0 = `PublicOnly` (preserves Phase 13 D1 rule: enum ordinal 0 is the backwards-compatible default; append-only, never reorder)
  - Stored on-chain as `uint8`
  - Existing deployed token IDs decode to `PublicOnly` (zero default) and remain behaviorally unchanged

### C-PN-2: NFT struct field ordering (type: schema)

- **Source:** `.planning/private-network-ai.md` (lines 416-439); owner resolution #3; Phase 13 D1
- **Constraint:** `NFT` struct in `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` must append new fields in this order (whichever phase lands second appends after the other):
  - Phase 13 D1 fields: `validFrom`, `validUntil`, `defaultDuration`, `expirationMode`, `transferPolicy`, `expirationDisposition`, `expirationRecipient`, `credentialVerifier`
  - Phase 14 fields (this doc): `networkScope`, `privateNetworkId`, `publicSettlementEnabled`
- **Invariants:**
  - Append-only; never insert, never reorder
  - `NFT` lives behind `mapping(uint256 => NFT)` so appends are storage-safe
  - Single PR owns each struct diff (per Phase 13 D1 note)
  - Upgrade test must prove zero-default decoding of pre-existing records

### C-PN-3: Product/SKU registry — minion-denominated, no oracle (type: schema)

- **Source:** `.planning/private-network-ai.md` (lines 281-292); owner resolution #4; Phase 13 D11
- **Constraint:**
  ```solidity
  struct Product {
      uint256 priceInMinions;    // fixed minion price, NO USD oracle
      uint256 creditAmount;
      uint64  duration;
      bool    createsLicense;
      bool    renewsLicense;
      bool    active;
  }
  ```
- **Invariants:**
  - NO `priceUsd` field; NO `quoteUsdToGnusMinions` helper (doc sketch superseded by owner resolution #4)
  - Prices set administratively as fixed minion amounts (consistent with Phase 13 D11)
  - "5.00 USD worth" expressed as a minion-denominated fixed amount, not a live conversion

### C-PN-4: Hybrid-scope redeemability invariant (type: nfr)

- **Source:** Owner resolution #5; Phase 13 D8; Phase 9 mintBackedChild path
- **Constraint:** Any token with `networkScope == Hybrid` MUST satisfy all of:
  - `exchangeRate > 0`
  - `expirationDisposition == REDEEM_TO_PARENT` (Phase 13 D8)
  - Minted via Phase 9's `mintBackedChild` collateralized reserve path
- **Rationale:** Hybrid tokens must be convertible back to GNUS for public payouts. Pure burn-only AI Credits (SOULBOUND, PerHolder) remain non-redeemable per Phase 13 D11.

### C-PN-5: Public chain is canonical for billing/settlement/audit (type: protocol)

- **Source:** `.planning/private-network-ai.md` (lines 122-153); owner resolution #1
- **Constraint:** The EVM diamond (this repo) is the canonical source for:
  - USDC/GNUS payments
  - BANXA-confirmed purchases
  - Company license creation and renewal
  - Treasury accounting
  - Bridge events
  - Auditability
- The SuperGenius chain is the execution/usage layer for AI compute, fast credit spending, and per-tenant operations. The existing GNUS↔SuperGenius bridge (roadmap Phases 8 and 10) is the portability layer — no new mirroring system is introduced.

### C-PN-6: License activation event api-contract (type: api-contract)

- **Source:** `.planning/private-network-ai.md` (lines 209-213, 362-368)
- **Constraint:**
  ```solidity
  event LicenseActivated(
      address indexed companyAdmin,
      uint256 indexed licenseId,
      uint256 indexed privateNetworkId,
      uint64  expiresAt
  );
  ```
- **Invariants:**
  - Emitted on license creation and on every renewal
  - Off-chain / SuperGenius consumers can derive license state from events alone

### C-PN-7: Phase 13 mechanisms referenced, not redefined (type: protocol)

- **Source:** Owner resolution #6
- **Constraint:** Phase 14 must reference Phase 13 D1-D13 definitions for TransferPolicy, ExpirationMode, ExpirationDisposition, settlement semantics, and transfer-policy enforcement. No redefinition. No new enum values for these Phase 13 enums. Any new enforcement surface (e.g., `privateNetworkId` gating) must layer on top of the existing `_enforceTransferPolicy` predicate (Phase 13 D6), not bypass it.

---

## New Constraints (SPEC-derived, 2026-08-23 — Secure BridgeIn)

The following constraints are extracted from `docs/Secure-BridgeIn.md` (SPEC, classified 2026-08-23). They apply to a proposed new bridge-security phase. **None of these are active** — they are candidates for a future phase that would amend Phase 10's locked decisions (D-06, D-08, D-10, D-12, D-15, D-16). Until that phase's CONTEXT locks them, they are informational only.

### C-BR-1: Append-only storage layout for GNUSBridgeValidatorStorage V2 (type: schema)

- **Source:** `docs/Secure-BridgeIn.md` (lines 153-179)
- **Constraint:**
  ```solidity
  struct Layout {
      // Existing fields (Phase 10 D-15 shipped): do not move or modify.
      mapping(bytes32 => bool) processedMessages;
      bytes32 validatorMerkleRoot;
      uint256 validatorThreshold;

      // V2 rolling API-attestor state — appended.
      bytes32 bridgeAttestorRoot;
      uint64 bridgeAttestorEpoch;
      bool bridgeAttestorV2Initialized;
  }
  ```
- **Invariants:**
  - Append-only; never reorder, never remove, never change types of existing fields
  - Existing fields `validatorMerkleRoot` / `validatorThreshold` are NOT repurposed — V2 uses parallel fields
  - The legacy fields become dead once V2 is active, but remain in storage

### C-BR-2: BridgeMessage struct (type: api-contract)

- **Source:** `docs/Secure-BridgeIn.md` (lines 240-267)
- **Constraint:**
  ```solidity
  struct BridgeMessage {
      uint256 srcChainID;
      bytes32 sourceBridgeID;      // source bridge contract / subsystem identifier
      bytes32 sourceTxHash;        // source-ledger transaction ID
      uint256 sourceEventIndex;    // EVM log index, SG output index, etc.
      address recipient;
      uint256 amount;              // pre-fee GNUS amount
  }
  ```
- **Invariants:**
  - `sourceEventIndex` distinguishes multiple valid events in the same source transaction
  - `recipient` and `amount` are bound into the certificate digest (not just the message ID)

### C-BR-3: Replay message ID derivation (type: api-contract)

- **Source:** `docs/Secure-BridgeIn.md` (lines 269-291)
- **Constraint:**
  ```solidity
  bytes32 private constant BRIDGE_MESSAGE_ID_V2 =
      keccak256("GNUS_BRIDGE_MESSAGE_ID_V2");

  messageId = keccak256(abi.encode(
      BRIDGE_MESSAGE_ID_V2,
      message.srcChainID,
      message.sourceBridgeID,
      message.sourceTxHash,
      message.sourceEventIndex
  ));
  ```
- **Invariants:**
  - Composite key (not just `sourceTxHash`) — diverges from Phase 10 D-06's locked "source-chain burn tx hash" identity
  - Domain-separated via `BRIDGE_MESSAGE_ID_V2` constant
  - Replay protection still uses the existing `processedMessages` mapping (Phase 10 D-07 unchanged)

### C-BR-4: Certificate digest with BRIDGE_CERTIFICATE_V2 domain (type: protocol)

- **Source:** `docs/Secure-BridgeIn.md` (lines 351-408)
- **Constraint:**
  ```solidity
  bytes32 private constant BRIDGE_CERTIFICATE_V2 =
      keccak256("GNUS_BRIDGE_CERTIFICATE_V2");

  digest = ECDSAUpgradeable.toEthSignedMessageHash(keccak256(abi.encode(
      BRIDGE_CERTIFICATE_V2,
      currentAttestorEpoch,
      currentAttestorRoot,
      nextAttestorRoot,
      message.srcChainID,
      message.sourceBridgeID,
      message.sourceTxHash,
      message.sourceEventIndex,
      block.chainid,
      address(this),
      message.recipient,
      GNUS_TOKEN_ID,
      message.amount
  )));
  ```
- **Invariants:**
  - EIP-191 wrapped (consistent with Phase 10 D-10)
  - Binds root transition (current root + epoch + next root) into the signature
  - Binds destination chain and diamond address (cross-chain / cross-diamond replay protection, Phase 10 D-08 aligned)
  - Field order and Solidity types are part of the protocol — cross-language test vectors required

### C-BR-5: Epoch-derived signature thresholds (type: protocol)

- **Source:** `docs/Secure-BridgeIn.md` (lines 181-197)
- **Constraint:**
  ```solidity
  uint256 private constant GENESIS_ATTESTOR_THRESHOLD = 1;
  uint256 private constant ACTIVE_ATTESTOR_THRESHOLD = 2;
  uint256 private constant MAX_ATTESTOR_SIGNATURES = 16;

  threshold = (epoch == 0) ? GENESIS_ATTESTOR_THRESHOLD : ACTIVE_ATTESTOR_THRESHOLD;
  ```
- **Invariants:**
  - The certificate cannot choose its own threshold
  - Genesis epoch (0) accepts one signature; all later epochs require at least two
  - First valid certificate MUST advance to a different root (epoch 0 cannot persist)
  - Cap of 16 signatures per certificate (gas-bounds the verification loop)

### C-BR-6: Strict-ascending signer ordering + per-signer Merkle proof (type: protocol)

- **Source:** `docs/Secure-BridgeIn.md` (lines 411-458)
- **Constraint:**
  - Recovered signer addresses must be strictly ascending (`signer > lastSigner`)
  - Each signer carries an individual Merkle proof against `currentRoot`
  - Proof leaf = `keccak256(abi.encodePacked(signer))`
  - No MMR, no multiproof — individual proofs only
- **Invariants:**
  - Duplicate signers are rejected by the strict-ascending check (Phase 10 D-13 aligned)
  - Signers are verified against `currentRoot`, NOT `nextAttestorRoot`
  - New attestors in `nextAttestorRoot` become eligible to sign the FOLLOWING certificate, not the one that installs them

### C-BR-7: Rolling root transition semantics (type: protocol)

- **Source:** `docs/Secure-BridgeIn.md` (lines 292-349)
- **Constraint:**
  - `nextAttestorRoot == currentRoot` → process claim, do not change root, do not increment epoch
  - `nextAttestorRoot != currentRoot` → install `nextAttestorRoot`, increment `bridgeAttestorEpoch` by exactly one, emit `BridgeAttestorSetAdvanced`
  - At epoch 0: `nextAttestorRoot != currentRoot` is REQUIRED (forces bootstrap exit)
- **Invariants:**
  - Multiple claims against an unchanged root do not force a strict global sequence
  - Two competing rotations from the same old root cannot both succeed (replay via processedMessages)
  - Failed minting reverts the root update and replay marker (atomic transaction semantics)

### C-BR-8: EVM-specific certificate signature format (type: api-contract)

- **Source:** `docs/Secure-BridgeIn.md` (lines 132-151)
- **Constraint:**
  - Algorithm: secp256k1 ECDSA
  - Input: exact 32-byte EIP-191 digest produced by Solidity
  - Encoding: 65 bytes, `r || s || v`
  - `r` and `s`: 32-byte big-endian
  - `v`: 27 or 28
  - `s`: low-s canonical form
  - EVM address derivation: last 20 bytes of `keccak256(uncompressedPublicKeyWithout04Prefix)`
- **Invariants:**
  - Native SuperGenius `ConsensusVote.signature` (64-byte, non-recoverable, double-SHA-256, little-endian scalars) is NOT acceptable
  - SuperGenius bridge exporter must produce a separate EVM-specific signature
  - Cross-language test vectors required (C++ exporter + Solidity test must agree)

### C-BR-9: Legacy selector removal + setValidatorSet restriction (type: protocol)

- **Source:** `docs/Secure-BridgeIn.md` (lines 583-618)
- **Constraint:** Diamond upgrade must:
  - Remove the legacy `bridgeIn(bytes32, uint256, address, uint256, bytes[], bytes32[][])` selector OR replace it with a function that always reverts
  - Convert `setValidatorSet()` to an explicitly named emergency-recovery function OR remove it
- **Invariants (emergency recovery must):**
  - Require the contract to be paused
  - Require `onlySuperAdminRole`
  - Require a nonzero new root
  - Never restore one-signature Genesis mode after bootstrap
  - Increment the attestor epoch
  - Emit a clear emergency-reset event
  - NOT silently rotate the root while the bridge is unpaused

### C-BR-10: SuperGenius-side prerequisites (type: protocol, external dependency)

- **Source:** `docs/Secure-BridgeIn.md` (lines 123-131)
- **Constraint:**
  - SuperGenius issue #363: bridge slot quorum must use only signature-verified votes for the correct proposal
  - SuperGenius issue #364: slot 0 must identify an API RPC that actually succeeded for that exact claim
- **Invariants:**
  - The Solidity contract assumes it receives an EVM-specific certificate produced only after those checks
  - These are C++/SuperGenius-repo work — outside this repo's implementation scope but gating for production readiness

### C-BR-11: SuperGenius nextAttestorRoot construction policy (type: protocol, off-chain)

- **Source:** `docs/Secure-BridgeIn.md` (lines 620-651)
- **Constraint:** SG exporter constructs `nextAttestorRoot` from approved API-attestor policy:
  - Eligible for next root = valid node signature AND actual successful slot-0/API verification AND finalized certificate AND not suspended/revoked
  - Public-RPC-only success does NOT qualify a node for the EVM bridge-attestor root
  - Merkle tree: `leaf = keccak256(abi.encodePacked(evmAddress))`, leaves sorted by address, sorted-pair hashing per `MerkleProofUpgradeable.verify`
  - One-leaf Genesis tree: `root = leaf`
- **Invariants:**
  - No public-RPC-only nodes, no RPC URLs, no reputation weights, no full SG validator registry on-chain
  - No MMR, no Solidity implementation of SG consensus
  - Prefer a rolling set of recently successful API-backed attestors (not just the two fastest responders)

---

## DevContainer-Specific Constraints (unchanged from 2026-05-26, context only)

- Build-time vs runtime variable separation (`.devcontainer/docs/ARCHITECTURE.md`)
- Vault unseal requirement (`.devcontainer/docs/VAULT_SETUP.md`)
- Workspace portability via `WORKSPACE_NAME` (`.devcontainer/docs/PORTABILITY.md`)

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended C-PN-1 through C-PN-7 from `private-network-ai.md` + owner resolutions_
_Updated: 2026-08-23 — appended C-BR-1 through C-BR-11 from `docs/Secure-BridgeIn.md` SPEC_
