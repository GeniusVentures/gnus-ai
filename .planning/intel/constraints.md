# Synthesized Constraints

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest)
**Mode:** merge

## Existing Constraints Confirmed (unchanged)

All constraints in `.planning/PROJECT.md` remain valid. The 2026-05-26 ingest confirmed them; the 2026-08-03 ingest does not challenge them.

- Solidity 0.8.19 compiler target (confirmed by all 18 contract API docs)
- EIP-2535 Diamond storage pattern (confirmed by GeniusDiamond.md, GeniusAIStorage.md, GNUSNFTFactoryStorage.md, GNUSControlStorage.md)
- Diamond upgrade via DiamondCutFacet
- Role-based access control (DEFAULT_ADMIN_ROLE, MINTER_ROLE, UPGRADER_ROLE)
- ERC-1155 token with max supply

## New Constraints (DOC-derived, schema/api-contract types)

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

## DevContainer-Specific Constraints (unchanged from 2026-05-26, context only)

- Build-time vs runtime variable separation (`.devcontainer/docs/ARCHITECTURE.md`)
- Vault unseal requirement (`.devcontainer/docs/VAULT_SETUP.md`)
- Workspace portability via `WORKSPACE_NAME` (`.devcontainer/docs/PORTABILITY.md`)

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended C-PN-1 through C-PN-7 from `private-network-ai.md` + owner resolutions_
