# Phase 10: Lock/Release Bridge Vault - Research

**Researched:** 2026-08-17
**Domain:** EVM cross-chain bridge destination execution (bridgeIn) with threshold ECDSA certificate authorization, diamond storage extension, replay protection
**Confidence:** HIGH

## Summary

Phase 10 adds the destination-side bridge execution path (`bridgeIn`) to the GNUS.AI diamond under the **provenance-relocation** model — no vault, no escrow, no custody contract. Bridge-out on the source chain burns tokens from `chainSupply[srcChainID]`; bridge-in on the destination chain mints them into `chainSupply[destChainID]` via the existing `_mintWithBridgeFee` helper, which already enforces the global cap and updates the provenance counter. The bridge itself is authorized by an **m-of-n threshold ECDSA certificate** produced by SuperGenius validators off-chain and verified on-chain via `ecrecover`. The validator set is committed to the diamond as a merkle root + threshold (mechanism for keeping it fresh is deferred per D-16).

Every piece of infrastructure this phase needs already exists on the diamond: the pausability flag (`GNUSControlStorage.paused`, wired into `_beforeTokenTransfer` by Phase 5 SEC-08) automatically pauses both `bridgeOut` and `bridgeIn` because both traverse mint/burn; the `_mintWithBridgeFee` helper already enforces fee + cap + per-chain accounting; `MINTER_ROLE` is already granted to Super Admin by `DiamondInitFacet` so the manual multisig path (`mint(user, 0, amount)`) requires no new code. The new work is: (1) a validator-set storage library with its own `keccak256("gnus.ai.bridge.validator.storage")` slot, (2) a `processedMessages` replay mapping, (3) a `bridgeIn` external function that verifies the threshold certificate and delegates to `_mintWithBridgeFee`, and (4) admin setters for the validator merkle root / threshold.

The SuperGenius side must be extended to emit a purpose-built **EVM envelope**: validators sign `keccak256(abi.encode(transferId, srcChainID, destChainID, diamondAddress, recipient, tokenId, amount))` (EIP-191 wrapped or raw — see D-10) using libsecp256k1's `secp256k1_ecdsa_sign_recoverable` to produce `r‖s‖v`. The existing SG sign function uses double-SHA256 and little-endian scalars with no recovery ID and **cannot be reused** (D-11). SG already has keccak available (`nil::crypto3::hashes::keccak_1600<256>` used in `EthereumKeyPairParams.hpp`) and the same secp256k1 private key, so producing EVM signatures is additive — no key registry changes.

**Primary recommendation:** Implement `bridgeIn` as a new function inside the existing `GNUSBridge` facet (it has ~6.4 KB headroom under the 24,576-byte EIP-170 limit), backed by a new `GNUSBridgeValidatorStorage` library at slot `keccak256("gnus.ai.bridge.validator.storage")`. Use OpenZeppelin's `ECDSAUpgradeable.tryRecover` (already vendored via `@gnus.ai/contracts-upgradeable-diamond`) for signature recovery. Require signatures sorted strictly ascending by recovered address. Adopt the EIP-191 personal_sign wrapper (`toEthSignedMessageHash`) for the digest to match off-the-shelf wallet tooling and to future-proof the testnet auto-relayer path.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Provenance Relocation (not Escrow / Vault)**
- **D-01:** No vault, no escrow, no lock-then-release custody. Bridging is pure provenance relocation between chains. The destination chain's bridge-in mint is the `+` side; source-side bridge-out burn is the `-` side on that chain only. Global supply is untouched by bridging.
- **D-02:** Per-chain `chainSupply[chainid]` tracks attribution/partition; `totalSupplyOfAll()` (Phase 9 `globalSupply`) is the invariant and never moves during a bridge, even while a message is in-flight.
- **D-03:** Source-side sufficiency check: the source chain must hold the tokens/provenance it is relocating. The existing `balanceOf(sender, id) >= amount` check in `bridgeOut` already enforces this; no additional vault-balance check is needed.

**State Machine and Replay Protection**
- **D-04:** Transfer state machine is `NONE → INITIATED → RELEASED`. `LOCK_CONFIRMED` has no meaning in the provenance-relocation model and is dropped.
- **D-05:** No `CANCELLED`/`EXPIRED` branch. The eventual-consistency stance ("who cares if the message arrives late?") is sufficient. In-flight is a first-class concept only insofar as Phase 12's cross-chain ledger tracks `pendingOutbound`/`pendingInbound`; the state machine itself does not expire or cancel.
- **D-06:** Canonical `transferId` = the source-chain burn transaction hash (keccak of the source EVM tx). This matches the SG-side identity scheme (`/bridge/executed/{chainid}:{tx_hash}`) and keeps the two systems aligned.
- **D-07:** Replay protection is enforced on the diamond: `mapping(bytes32 => bool) processedMessages`, set exactly once on successful `bridgeIn`. `require(!processedMessages[transferId])` at the top.
- **D-08:** The digest the validators sign commits to `transferId`, `srcChainID`, `destChainID`, `address(diamond)`, `recipient`, `tokenId`, and `amount`. This prevents cross-chain, cross-diamond, and cross-recipient replay.

**Bridge-In Authorization — Threshold ECDSA Certificate**
- **D-09:** Bridge-in is authorized by a threshold ECDSA certificate from trusted SuperGenius validators, verified on-chain by the diamond. No trusted relay address is required for authorization; anyone may submit the transaction (permissionless relay).
- **D-10:** Validators sign an EVM-compatible digest: `keccak256(abi.encode(transferId, srcChainID, destChainID, address(diamond), recipient, tokenId, amount))`. Signatures are standard secp256k1 `r‖s‖v` (EIP-191 or raw-digest) so the diamond can use `ecrecover`.
- **D-11:** The SG consensus envelope (double-SHA256, little-endian scalars, no recovery ID) is **not** used on-chain. SG's aggregator produces a purpose-built EVM envelope after slot quorum is reached. This is net-new SG-side work but is cheaper and more robust than trying to verify SG-native certificates on-chain.
- **D-12:** On-chain threshold: `m-of-n` over a diamond-registered validator set (e.g., 2/3 + 1 of registered validators). SG's >3/4 slot-weighted quorum remains off-chain; the on-chain threshold is the attestation floor.
- **D-13:** Signatures must be submitted sorted ascending by recovered signer address, with strictly ascending addresses required (duplicate-proof). The diamond recovers each signer and checks membership in the registered set.
- **D-14:** `tokenId` must be `GNUS_TOKEN_ID` (0) on bridge-in. Child-token bridge-in is effected as a mint of id 0 followed by `convert` via GNUSTreasury, per Phase 9 D10.

**Validator Set Management**
- **D-15:** For now, use option (b): the diamond stores a threshold plus a merkle root (or equivalent commitment) of the authorized validator set. Rotation is less frequent than per-validator admin calls.
- **D-16:** The exact mechanism for how the EVM chain learns the current SG validator set is **deliberately deferred**. SG's `ValidatorRegistry` is CRDT-driven, weight-based, and open (anyone can be a validator). A future decision will determine the fastest/most secure way to export the current set to the diamond. Until then, a manually-updated merkle root is acceptable.
- **D-17:** SG validator keys are derived from Ethereum private keys (`GenerateGeniusAddress` uses `EthereumKeyGenerator` over secp256k1), so the same keypair can sign both SG-native consensus messages and EVM-compatible digests. This makes the threshold-ECDSA certificate practical without a separate key registry.

**Interim / Progressive Authorization (per user 2026-08-17)**
- **D-18:** For the current phase, a manual path is acceptable: Super Admin multisig can execute bridge-in directly, or an automatic relayer can operate on testnets (e.g., Sepolia) while mainnets require Super Admin approval.
- **D-19:** Longer-term, an amount-based two-tier policy is desired: bridge-in amounts `<= 100 GNUS per 24 hours` may be automatic (relay-executed with the certificate), while amounts `>= 100 GNUS in 24 hours` require Super Admin release. This tiered policy is **deferred to a later phase** and is not required for Phase 10 completion, but the design should not preclude it.

**Emergency Pause**
- **D-20:** Both `bridgeOut` and `bridgeIn` must be pausable by Super Admin (or a designated guardian role). Pause blocks new initiations and new releases.
- **D-21:** Pause semantics are strict: when paused, `bridgeIn` reverts even if a valid certificate exists. The certificate remains valid and can be submitted after unpause; no expiration is introduced in this phase.

**Fee and Cap Integration**
- **D-22:** Bridge-in mint routes through `_mintWithBridgeFee`, so the existing bridge fee, global cap check (`globalSupply + amount <= GNUS_MAX_SUPPLY`), and `chainSupply[block.chainid] += amount` hook all apply automatically.

### Claude's Discretion
- Exact function names for `bridgeIn` and any helper views (e.g., `isValidator`, `getValidatorThreshold`) are left to the planner.
- Whether the validator commitment is a simple `mapping(address => bool)` plus threshold, or a merkle root, is left to the planner unless gas or upgradeability concerns force a choice.

### Deferred Ideas (OUT OF SCOPE)
- Amount-based two-tier bridge-in authorization (<=100 GNUS / 24h automatic; >=100 GNUS / 24h Super Admin release) — future phase, not required for Phase 10.
- Optimal validator-set export mechanism — how the EVM chain learns the current SG validator set (merkle root update frequency, who pays for updates, whether to use a light-client proof vs. governance multisig) is deferred pending further research.
- SG-native certificate verification on-chain — verifying the double-SHA256/little-endian SG envelope directly on-chain was rejected for this phase; a future phase could add it if BLS or a keccak-based aggregate scheme is adopted.
- Bridge-out-of-SuperGenius (SG → EVM) — the SG side currently has no burn transaction type or EVM write path. The EVM-side `bridgeIn` designed here is ready to receive it, but the SG-side outbound leg is SuperGenius-repo work.
- Direct EVM ↔ EVM bridging without SG mediation — currently not supported by SG architecture; all cross-chain transfers are SG-mediated.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRIDGE-02 | Lock/release vaults, state machine, replay protection | CONTEXT D-01..D-07 supersede "vault" framing — replay protection is `processedMessages` mapping in a new storage library (§Architecture Patterns Pattern 1); state machine is `NONE → INITIATED → RELEASED` via the tuple of (`BridgeOutInitiated` event on source, `processedMessages[transferId]` flag on destination). |
| BRIDGE-03 | Replay protection | §Architecture Patterns Pattern 1 — `mapping(bytes32 => bool) processedMessages` in `GNUSBridgeValidatorStorage`; requires no new packages; verified in existing code (no current mapping(bytes32) on diamond). |
| BRIDGE-04 | Per-chain vault liquidity checks / no mint on any chain | CONTEXT D-01/D-02 supersede "no mint" — mint-on-destination is the provenance-relocation model. The global cap (`GNUS_MAX_SUPPLY`) is enforced by `_mintWithBridgeFee` (verified in `GNUSBridge.sol:93-98`). Per-chain attribution is enforced by `chainSupply` (Phase 9). |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Burn on source chain (provenance `-`) | EVM source chain (diamond) | — | `bridgeOut` already does this; no changes needed in Phase 10. |
| Mint on destination chain (provenance `+`) | EVM destination chain (diamond) | — | New `bridgeIn` function on `GNUSBridge` facet. |
| Global supply invariant | All EVM chains (diamond) | — | `_mintWithBridgeFee` + `burn` already keep `globalSupply` and `chainSupply` consistent (Phase 9 D8/D9). |
| Replay protection | EVM destination chain (diamond) | — | `processedMessages` mapping in new storage library. |
| Validator set commitment | EVM destination chain (diamond) | SuperGenius chain (source of truth) | Diamond stores a merkle root commitment + threshold; SG maintains the live registry. Update mechanism is deferred (D-16). |
| Threshold certificate production | SuperGenius chain (off-chain aggregator) | — | SG's `ConsensusManager` reaches slot quorum off-chain, then aggregator produces a purpose-built EVM envelope (D-11). |
| Threshold certificate verification | EVM destination chain (diamond) | — | `bridgeIn` uses `ecrecover` per signature + sorted-ascending check + merkle membership proof. |
| Pause / unpause | EVM chain (diamond) | — | `GNUSControl.emergencyPause`/`emergencyUnpause` (Phase 5 SEC-08) — already wired into `_beforeTokenTransfer`, so both `bridgeOut` and `bridgeIn` are pausable for free. |
| Manual Super Admin bridge-in (D-18) | EVM destination chain (diamond) | Safe multisig (off-chain coordination) | Existing `mint(user, 0, amount)` via `MINTER_ROLE` — no new code needed; only documentation and runbook. |
| Cross-chain event relay | SuperGenius `BridgeRelayer` (off-chain) | — | Watches `BridgeOutInitiated`, calls `MintFunds` on SG; in the return direction the relayer submits `bridgeIn` to the destination chain (permissionless, D-09). |
| SG-side replay protection | SuperGenius chain (`/bridge/executed/{chainid}:{tx_hash}`) | — | Already implemented in `TransactionManager::MintFunds` (line 618-638); aligned with diamond-side `processedMessages` via shared `transferId` (D-06). |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@gnus.ai/contracts-upgradeable-diamond` (ECDSAUpgradeable) | already vendored | `tryRecover`, `toEthSignedMessageHash` | OZ reference implementation; already in `node_modules`; handles malleability (low-s check, v ∈ {27,28}). [VERIFIED: file exists at `node_modules/@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/ECDSAUpgradeable.sol`] |
| `@gnus.ai/contracts-upgradeable-diamond` (MerkleProofUpgradeable) | already vendored | `verify`, `processProof` | OZ reference; already in `node_modules`. [VERIFIED: file exists at `node_modules/@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/MerkleProofUpgradeable.sol`] |
| `contracts-starter` (LibDiamond) | already vendored | Diamond storage pattern | Already used by every existing storage library. |
| Solidity | ^0.8.19 | Compiler | Project standard (DEBT-03 complete). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hardhat | 3.13.0 [VERIFIED: `npx hardhat --version` on dev machine] | Test runner, diamond deployer | Unit + integration tests in `test/unit/`. |
| Foundry (forge) | 1.7.1 [VERIFIED: `forge --version` on dev machine] | Fuzz + invariant tests | `test/foundry/invariant/BridgeInvariant.t.sol` already exists as a stub — extend it. |
| ethers.js | via hardhat | Off-chain signing in tests | `ethers.signMessage` produces EIP-191 sigs compatible with `toEthSignedMessageHash` + `tryRecover`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ECDSAUpgradeable.tryRecover` | Hand-rolled assembly `ecrecover` | OZ handles malleability + v validation; hand-rolled saves ~50 gas per call but duplicates audit surface. Not worth it. |
| Merkle root commitment (D-15) | `mapping(address => bool)` + threshold | Mapping is simpler to reason about but rotation costs O(n) SSTOREs and admin calls; merkle root is one SSTORE per rotation but each `bridgeIn` call includes an O(log n) proof. CONTEXT explicitly tags this as planner's discretion — **this research recommends merkle root** (matches D-15 wording). |
| EIP-191 `personal_sign` | Raw keccak digest | Raw is 78 gas cheaper and 1 hash shorter; EIP-191 is what every wallet (`personal_sign`, `eth_sign`) produces by default and prevents confusion with transaction preimages. **Recommend EIP-191** because SG validators are already running EVM-compatible key infrastructure. |
| `bridgeIn` inside `GNUSBridge` facet | New `GNUSBridgeIn` facet | Facet split adds a diamondCut + new facet deploy; keeping it inside `GNUSBridge` reuses `_mintWithBridgeFee` directly and avoids cross-facet call overhead. Current GNUSBridge is 18,181 bytes deployed — ~6.4 KB headroom under EIP-170's 24,576-byte limit. Estimated `bridgeIn` + storage lib adds 1.5–2 KB. **Recommend keeping inside `GNUSBridge`.** |

**Installation:**
```bash
# No new packages required. All crypto primitives are already vendored.
# If the planner chooses to split bridgeIn into its own facet, no new packages either.
```

**Version verification:** All libraries above are already in `node_modules/` and were verified by direct file inspection on 2026-08-17. No `npm view` calls were needed because this phase does not introduce new dependencies.

---

## Package Legitimacy Audit

> **No new packages installed for Phase 10.** All required cryptography primitives (ECDSA, MerkleProof) are already vendored through `@gnus.ai/contracts-upgradeable-diamond` (in-repo dependency). The audit table is empty.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| —       | —        | —   | —         | —           | —         | No new packages |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
SOURCE CHAIN (e.g., Ethereum, Sepolia)            SUPERGENIUS CHAIN                  DESTINATION CHAIN (e.g., Polygon)
─────────────────────────────────────             ──────────────────                 ──────────────────────────────────

User
  │
  │ bridgeOut(amount, id, destChainID,
  │           sgnsDestination, destinationYOdd)
  ▼
┌──────────────────────┐
│ GNUSBridge (diamond) │                                 ┌────────────────────┐
│  • balanceOf check   │                                 │ BridgeRelayer      │
│  • limiter charge    │   BridgeOutInitiated event      │  (off-chain watch) │
│  • _burn(sender,id)  │ ──────────────────────────────► │  • ParseBurnEvent  │
│  • emit BridgeOut... │                                 │  • MintFunds call  │
└──────────────────────┘                                 └─────────┬──────────┘
        │                                                          │
        │ chainSupply[srcChainID] -= amount                        │ MintTransactionV2
        │ globalSupply unchanged (B1)                              ▼
        │                                                  ┌────────────────────┐
        │                                                  │ ConsensusManager   │
        │                                                  │  • NonceSubject    │
        │                                                  │  • slot quorum     │
        │                                                  │  • CreateCertificate
        │                                                  └─────────┬──────────┘
        │                                                            │
        │                              SG validators reach >3/4 slot quorum
        │                                                            │
        │                                                            ▼
        │                                                  ┌────────────────────┐
        │                                                  │ EVM Envelope       │
        │                                                  │ Aggregator (NEW)   │
        │                                                  │  • build digest =  │
        │                                                  │    keccak256(abi.  │
        │                                                  │    encode(...))    │
        │                                                  │  • collect m sigs  │
        │                                                  │  • sort by address │
        │                                                  └─────────┬──────────┘
        │                                                            │
        │                                       (transferId, srcChainID, recipient,
        │                                        tokenId, amount, signatures[],
        │                                        merkleProofs[]?)
        │                                                            │
        │                                                            ▼
        │                                                  ┌────────────────────┐
        │                                                  │ Permissionless     │
        │                                                  │ Relayer (anyone)   │
        │                                                  └─────────┬──────────┘
        │                                                            │
        │                                                            │ bridgeIn(...)
        │                                                            ▼
        │                                                  ┌────────────────────────┐
        │                                                  │ GNUSBridge (diamond)   │
        │                                                  │  • require !paused     │
        │                                                  │  • require !processed  │
        │                                                  │    [transferId]        │
        │                                                  │  • require destChainID │
        │                                                  │    == block.chainid    │
        │                                                  │  • compute digest      │
        │                                                  │  • for each sig:       │
        │                                                  │      tryRecover ->     │
        │                                                  │      strictly-         │
        │                                                  │      ascending addr    │
        │                                                  │      merkle verify     │
        │                                                  │  • require count >=    │
        │                                                  │    threshold           │
        │                                                  │  • processedMessages   │
        │                                                  │    [transferId] = true │
        │                                                  │  • _mintWithBridgeFee  │
        │                                                  │    (recipient, 0, amt) │
        │                                                  │  • emit BridgeReleased │
        │                                                  └────────────────────────┘
        │                                                            │
        │                                                            │ chainSupply[dstChainID] += postFeeAmount
        │                                                            │ globalSupply += postFeeAmount
        │                                                            ▼
        │                                                  Recipient's ERC-1155 balance
        │                                                  of GNUS_TOKEN_ID increases
```

**Trace the primary use case:** User calls `bridgeOut` on source → tokens burned on source, event emitted → SG `BridgeRelayer` observes event → `MintFunds` runs on SG → consensus produces certificate → aggregator builds EVM envelope → permissionless relayer submits `bridgeIn` on destination → diamond verifies threshold certificate → mints to recipient → provenance relocated; `globalSupply` unchanged end-to-end (the source-side `-` and the destination-side `+` sum to zero).

### Recommended Project Structure

```
contracts/gnus-ai/
├── GNUSBridge.sol                          # ADD: bridgeIn() external; ADD: validator setters; ADD: BridgeReleased event
├── GNUSBridgeValidatorStorage.sol          # NEW FILE — diamond storage library
│                                            #   Layout { processedMessages, validatorMerkleRoot, validatorThreshold }
│                                            #   Position: keccak256("gnus.ai.bridge.validator.storage")
└── (no other contract changes required)

test/unit/
├── GNUSBridgeIn.test.ts                    # NEW FILE — unit tests for bridgeIn
└── (existing GNUSBridgeEnhanced.test.ts unchanged)

test/foundry/invariant/
└── BridgeInvariant.t.sol                   # EXTEND — add I-bridgeIn invariants (see Validation Architecture)

diamonds/GeniusDiamond/
└── geniusdiamond.config.json               # ADD: new version entry (e.g. 3.0 or 2.7) for GNUSBridge with fromVersions
```

### Pattern 1: Diamond Storage Library for Bridge Validators

**What:** A new storage library, separate from `GNUSTreasuryStorage` and `GNUSControlStorage`, holding all bridge-in state.

**When to use:** Always — mixing new fields into existing layouts risks slot collisions and breaks upgrade compatibility.

**Example:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title GNUSBridgeValidatorStorage
/// @notice Diamond storage library for Phase 10 bridge-in (validator set commitment + replay protection)
/// @custom:security-contact support@gnus.ai
library GNUSBridgeValidatorStorage {
    /// @notice Storage layout for the bridge validator subsystem.
    /// @dev Append-only; Phase 12 may add in-flight accounting after these fields.
    struct Layout {
        /// @dev Replay protection — set exactly once per transferId on successful bridgeIn (D-07).
        mapping(bytes32 => bool) processedMessages;
        /// @dev Merkle root of the authorized validator set (D-15). Each leaf is keccak256(abi.encodePacked(validatorAddress)).
        bytes32 validatorMerkleRoot;
        /// @dev m in "m-of-n" — minimum number of distinct validator signatures required (D-12).
        uint256 validatorThreshold;
    }

    bytes32 constant GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION = keccak256("gnus.ai.bridge.validator.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION;
        assembly { l.slot := slot }
    }
}
```

**Storage slot naming convention (verified):** Existing libraries use `keccak256("gnus.ai.<feature>.storage")`:
- `GNUS_CONTROL_STORAGE_POSITION = keccak256("gnus.ai.control.storage")` [CITED: GNUSControlStorage.sol:32]
- `GNUS_NFT_FACTORY_STORAGE_POSITION = keccak256("gnus.ai.nft.factory.storage")` [CITED: GNUSNFTFactoryStorage.sol:34]
- `GNUS_TREASURY_STORAGE_POSITION = keccak256("gnus.ai.treasury.storage")` [CITED: GNUSTreasuryStorage.sol:23]
- `GNUS_WITHDRAW_LIMITER_STORAGE_POSITION` follows the same pattern [CITED: GNUSWithdrawLimiterStorage.sol:47]

The new `gnus.ai.bridge.validator.storage` slot does not collide with any existing slot (verified by grep).

### Pattern 2: Threshold Signature Verification with Strictly-Ascending Signer Order

**What:** Loop over a sorted signature array, recover each signer, enforce strictly-ascending order (this is the duplicate check), verify each signer against the merkle root, and require `count >= threshold`.

**When to use:** In `bridgeIn` — the only place in this phase that verifies threshold certificates.

**Example:**
```solidity
// Source: OpenZeppelin Contracts Utils — ECDSA + MerkleProof
// https://docs.openzeppelin.com/contracts/4.x/api/utils

import "@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/ECDSAUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/MerkleProofUpgradeable.sol";

function _verifyThresholdCertificate(
    bytes32 digest,
    bytes[] calldata signatures,
    bytes32[][] calldata merkleProofs
) internal view returns (uint256 validCount) {
    GNUSBridgeValidatorStorage.Layout storage v = GNUSBridgeValidatorStorage.layout();
    require(signatures.length == merkleProofs.length, "Sig/proof length mismatch");
    require(signatures.length >= v.validatorThreshold, "Below threshold");

    address lastSigner = address(0);
    for (uint256 i = 0; i < signatures.length; ++i) {
        (address signer, ECDSAUpgradeable.RecoverError err) =
            ECDSAUpgradeable.tryRecover(digest, signatures[i]);
        require(err == ECDSAUpgradeable.RecoverError.NoError, "Bad signature");
        // Strictly-ascending addresses -> duplicates rejected (D-13).
        require(signer > lastSigner, "Signers not strictly ascending");
        lastSigner = signer;
        // Merkle membership proof (D-15).
        bytes32 leaf = keccak256(abi.encodePacked(signer));
        require(
            MerkleProofUpgradeable.verify(merkleProofs[i], v.validatorMerkleRoot, leaf),
            "Not a registered validator"
        );
        unchecked { ++validCount; }
    }
}
```

**Why strictly-ascending rather than a bitmap:** A bitmap costs one SSTORE per call (5,000+ gas for a cold slot). Strictly-ascending ordering is free — it falls out of a single `>` comparison. The off-chain aggregator is responsible for sorting; on-chain we only verify the order.

### Pattern 3: bridgeIn External Function

**What:** The new destination-side entry point.

**Example:**
```solidity
event BridgeReleased(
    bytes32 indexed transferId,
    address indexed recipient,
    uint256 amount,           // pre-fee amount (matches BridgeOutInitiated)
    uint256 srcChainID,
    uint256 destChainID
);

/// @notice Release tokens on the destination chain after SG consensus reached quorum.
/// @dev Authorized by an m-of-n threshold ECDSA certificate from registered SG validators.
///      Permissionless: anyone may submit a valid certificate (D-09).
/// @param transferId Source-chain burn tx hash (D-06).
/// @param srcChainID Chain ID where the burn occurred.
/// @param recipient Destination-chain recipient.
/// @param amount Amount of GNUS minions burned on the source chain (pre-fee).
/// @param signatures Validator ECDSA signatures, sorted ascending by recovered address.
/// @param merkleProofs Merkle proofs of validator membership, parallel to `signatures`.
function bridgeIn(
    bytes32 transferId,
    uint256 srcChainID,
    address recipient,
    uint256 amount,
    bytes[] calldata signatures,
    bytes32[][] calldata merkleProofs
) external {
    // Pause check (D-20, D-21) — explicit so bridgeIn reverts before any work is done
    // when the diamond is paused. Belt-and-braces: _beforeTokenTransfer also checks,
    // but this gives a clearer revert reason and avoids burning gas on signature
    // verification when the call will fail anyway.
    require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused");

    // Replay protection (D-07).
    GNUSBridgeValidatorStorage.Layout storage v = GNUSBridgeValidatorStorage.layout();
    require(!v.processedMessages[transferId], "Message already processed");

    // Cross-chain routing (D-08).
    require(block.chainid == GNUSControlStorage.layout().chainID, "Wrong destination chain");
    require(srcChainID != block.chainid, "Cannot bridge from same chain");
    require(recipient != address(0), "Invalid recipient");
    require(amount > 0, "Invalid amount");

    // Compute the digest the validators signed (D-08, D-10).
    // EIP-191 wrapper to match off-the-shelf wallet tooling.
    bytes32 structHash = keccak256(abi.encode(
        transferId,
        srcChainID,
        block.chainid,
        address(this),                  // diamond address — prevents cross-diamond replay
        recipient,
        GNUS_TOKEN_ID,                  // D-14: only id 0 is bridgeable-in
        amount
    ));
    bytes32 digest = ECDSAUpgradeable.toEthSignedMessageHash(structHash);

    // Verify threshold certificate (D-12, D-13, D-15).
    uint256 validCount = _verifyThresholdCertificate(digest, signatures, merkleProofs);
    require(validCount >= v.validatorThreshold, "Threshold not met");

    // Mark processed BEFORE the mint (CEI: checks-effects-interactions). The mint
    // path is trusted (it's our own code) but marking first is still the correct
    // idiom for replay protection.
    v.processedMessages[transferId] = true;

    // Route through the existing helper: bridge fee, global cap, per-chain
    // supply accounting all apply automatically (D-22).
    _mintWithBridgeFee(recipient, GNUS_TOKEN_ID, amount);

    emit BridgeReleased(transferId, recipient, amount, srcChainID, block.chainid);
}
```

### Pattern 4: Admin Setters for Validator Set

**What:** `onlySuperAdminRole` setters for the merkle root and threshold.

**Example:**
```solidity
event ValidatorSetUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot, uint256 newThreshold);

function setValidatorSet(bytes32 newRoot, uint256 newThreshold) external onlySuperAdminRole {
    require(newRoot != bytes32(0), "Invalid root");
    require(newThreshold > 0, "Invalid threshold");
    GNUSBridgeValidatorStorage.Layout storage v = GNUSBridgeValidatorStorage.layout();
    emit ValidatorSetUpdated(v.validatorMerkleRoot, newRoot, newThreshold);
    v.validatorMerkleRoot = newRoot;
    v.validatorThreshold = newThreshold;
}
```

### Anti-Patterns to Avoid

- **Storing the full validator set on-chain in a mapping:** Rotation costs O(n) SSTOREs and admin calls; the merkle root commitment is one slot and one event. D-15 explicitly chose the merkle root path.
- **Verifying SG's native double-SHA256 envelope on-chain:** Would require SHA256 precompile + custom little-endian scalar handling + a public-key registry (since the SG envelope has no recovery ID, you'd need to try `ecrecover` against every registered pubkey — O(n) per signature instead of O(1)). Rejected by D-11.
- **Using raw `ecrecover` without malleability checks:** OZ's `tryRecover` rejects `s` values in the upper half of the curve order and requires `v ∈ {27, 28}`. Hand-rolling skips these checks and admits signature malleability (an attacker who sees a valid `(r, s, v)` can submit `(r, n - s, v ^ 1)` and recover the same signer, breaking the strictly-ascending invariant if they front-run). **Use the OZ library.**
- **Trusting `signatures.length` as the threshold count:** A caller could submit the same valid signature n times. The strictly-ascending check (Pattern 2) prevents this. Do not skip it.
- **Skipping the `address(this)` in the digest:** Without it, the same certificate is valid on every chain where this diamond is deployed — cross-diamond replay. D-08 explicitly commits to the diamond address.
- **Marking `processedMessages` AFTER the mint:** CEI violation. If the mint path ever calls out to user code (e.g., a future hook), a re-entrant call to `bridgeIn` would succeed. Mark first, then mint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ECDSA signature recovery with malleability protection | Custom assembly calling `ecrecover` | `ECDSAUpgradeable.tryRecover` (already vendored) | OZ handles low-s check + v validation; hand-rolled assembly is a classic source of critical bugs. |
| Merkle proof verification | Custom hash-pair loop | `MerkleProofUpgradeable.verify` (already vendored) | OZ handles leaf/internal-node distinction and edge cases (empty proof, single-leaf tree). |
| EIP-191 message hash wrapping | `keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash))` by hand | `ECDSAUpgradeable.toEthSignedMessageHash` | Same result, but the library function is the canonical reference and easier to audit. |
| Replay protection | Custom nonce counter / bitmap | `mapping(bytes32 => bool) processedMessages` | transferId is already a unique 32-byte value (tx hash); a simple boolean mapping is sufficient and cheapest. |
| Pause mechanism | New `Pausable` modifier | Existing `GNUSControlStorage.paused` + `_beforeTokenTransfer` | Phase 5 SEC-08 already wired this in; `bridgeIn` inherits it for free via `_mintWithBridgeFee` → `_mint` → `_beforeTokenTransfer`. Add an explicit `require(!paused)` at the top of `bridgeIn` for clearer error messages. |
| Threshold signature deduplication | Bitmap / `mapping(address => bool) seen` | Strictly-ascending address check (`signer > lastSigner`) | Zero SSTORE cost; ordering is the deduplication. Off-chain aggregator sorts. |
| Manual bridge-in path (D-18) | New role / new function | Existing `mint(user, 0, amount)` via `MINTER_ROLE` | Super Admin already has `MINTER_ROLE` from `DiamondInitFacet` (verified at line 49). The 3-arg `mint(user, tokenID, amount)` is already restricted to `tokenID == GNUS_TOKEN_ID` (Phase 9 D10, GNUSBridge.sol:122). |

**Key insight:** This phase is predominantly an integration exercise — almost every primitive it needs already exists. The genuinely new code is: (1) the storage library, (2) `bridgeIn` itself, (3) the admin setter, (4) the SG-side EVM envelope aggregator. The rest is composition of existing pieces.

---

## Common Pitfalls

### Pitfall 1: Digest mismatch between SG signer and diamond verifier
**What goes wrong:** SG signs `keccak256(abi.encode(...))` but the diamond expects `keccak256(abi.encodePacked(...))`, or the EIP-191 wrapper is applied on one side but not the other. All certificate verification fails.
**Why it happens:** `abi.encode` pads each argument to 32 bytes; `abi.encodePacked` packs tightly. For fixed-size types (`bytes32`, `uint256`, `address`) they happen to produce the same output, but mixing them up or forgetting the EIP-191 wrapper is a one-character bug with catastrophic failure mode.
**How to avoid:** Write the digest-builder as a single internal pure function on the diamond (`_bridgeInDigest(...)`) and use it both for verification and in tests. On the SG side, write a corresponding C++ function with a unit test that produces the exact same bytes for a known input vector. Cross-test: take a digest produced by the SG code and verify it in a Foundry test against the diamond.
**Warning signs:** All certificate verifications revert with "Not a registered validator" or "Bad signature" even with correct keys.

### Pitfall 2: Forgetting to mark `processedMessages` before minting (CEI violation)
**What goes wrong:** Reentrancy via the mint hook allows the same certificate to be used twice, doubling the destination-side mint.
**Why it happens:** `_mintWithBridgeFee` → `_mint` → `_beforeTokenTransfer` and `_afterTokenTransfer`. If any future hook calls out to user-controlled code, the replay protection is bypassed.
**How to avoid:** Set `processedMessages[transferId] = true` BEFORE calling `_mintWithBridgeFee`. Add a Foundry invariant test that asserts `processedMessages[id]` is set whenever `BridgeReleased` was emitted for that id.
**Warning signs:** Fuzzer finds a path where the same transferId emits `BridgeReleased` twice.

### Pitfall 3: Merkle leaf construction mismatch
**What goes wrong:** SG-side merkle tree uses `keccak256(abi.encode(addr))` (32-byte padded), diamond uses `keccak256(abi.encodePacked(addr))` (20-byte packed). All proofs fail.
**Why it happens:** `abi.encode` pads an address to 32 bytes; `abi.encodePacked` uses 20. OZ's `MerkleProof` docs recommend `abi.encodePacked` for addresses, but the SG-side C++ code must match byte-for-byte.
**How to avoid:** Pick one convention (this research recommends `abi.encodePacked(signer)` — see Pattern 2) and document it in BOTH codebases with a cross-repo test vector.
**Warning signs:** All merkle proofs revert with "Not a registered validator" even when the address is correct.

### Pitfall 4: Assuming `_beforeTokenTransfer` will catch pause for bridgeIn
**What goes wrong:** When paused, `bridgeIn` spends ~15k gas on signature verification before `_beforeTokenTransfer` reverts, instead of reverting immediately with a clear error.
**Why it happens:** The implicit pause via `_beforeTokenTransfer` fires late in the call chain, after the expensive signature work.
**How to avoid:** Add an explicit `require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused")` as the FIRST line of `bridgeIn`. This is also more consistent with the `ERC20TransferBatch.sol:123` pattern.
**Warning signs:** Gas-report shows successful certificate verification followed by revert when paused.

### Pitfall 5: SG's existing `Sign()` produces the wrong envelope
**What goes wrong:** Developer on SG side reuses `GeniusAccount::Sign()` for the bridge envelope. The diamond cannot recover the signer because (a) the digest is double-SHA256 (not keccak), (b) r and s are little-endian (EVM expects big-endian), (c) there is no recovery ID `v`.
**Why it happens:** `GeniusAccount::Sign()` is the only signing function in the SG codebase and looks like the obvious choice.
**How to avoid:** Add a NEW function (e.g., `GeniusAccount::SignEVM()` or a free function `ProduceEVMBridgeCertificate()`) that uses `secp256k1_ecdsa_sign_recoverable` + keccak + EIP-191 prefix + big-endian r,s + v ∈ {27, 28}. Do NOT modify `Sign()` — it is used by UTXO inputs and consensus votes (CONTEXT D-11).
**Warning signs:** Diamond recovers garbage addresses; `ecrecover` returns zero address; tests fail with "Bad signature".

### Pitfall 6: Storage slot collision with a future facet
**What goes wrong:** Planner picks `keccak256("gnus.ai.bridge.storage")` and a future phase picks the same name for different data; layouts silently overwrite each other.
**Why it happens:** Storage slot strings are convention, not enforced.
**How to avoid:** Use the specific name `gnus.ai.bridge.validator.storage` (not just `bridge.storage`). Document the slot in the storage library header comment and in `.planning/codebase/ARCHITECTURE.md` (or its equivalent) so future phases can grep for collisions.
**Warning signs:** Tests pass individually but fail when run together (state pollution between facets).

### Pitfall 7: Not handling `validatorThreshold = 0` on fresh deploys
**What goes wrong:** Diamond upgrades add the new storage but leave `validatorThreshold` at zero. `bridgeIn` reverts with "Below threshold" on every call, even with valid certificates.
**Why it happens:** Diamond storage starts at zero; no initializer was added to set the threshold.
**How to avoid:** Either (a) add a `GNUSBridge_Initialize270()` (or whatever version) upgrade-initializer that sets a sensible default threshold, or (b) require `validatorThreshold > 0` in `bridgeIn` with a clear error message ("Validator set not configured"). This research recommends (b) plus a Super Admin setter — explicit configuration beats magic defaults for security-critical parameters.
**Warning signs:** First `bridgeIn` call on a fresh deployment reverts even with correct signatures.

---

## Code Examples

### Bridge-In Digest Construction (Verified Pattern)

```solidity
// Source: OpenZeppelin Contracts v4.x — ECDSA.toEthSignedMessageHash
// https://docs.openzeppelin.com/contracts/4.x/api/utils#ECDSA
// Pattern: bind transferId, srcChainID, destChainID, diamond address, recipient,
// tokenId, and amount into the signed payload (CONTEXT D-08).

function _bridgeInDigest(
    bytes32 transferId,
    uint256 srcChainID,
    address recipient,
    uint256 amount
) internal view returns (bytes32) {
    bytes32 structHash = keccak256(abi.encode(
        transferId,
        srcChainID,
        block.chainid,                  // destChainID
        address(this),                  // diamond address (cross-diamond replay protection)
        recipient,
        GNUS_TOKEN_ID,                  // tokenId — always 0 (D-14)
        amount
    ));
    return ECDSAUpgradeable.toEthSignedMessageHash(structHash);
}
```

### Off-Chain Signing (ethers.js — for tests and the testnet relayer)

```typescript
// Source: ethers.js v6 — signMessage produces an EIP-191 wrapped signature.
// https://docs.ethers.org/v6/api/providers/#Signer-signMessage

import { ethers } from 'ethers';

async function signBridgeInCertificate(
    validatorWallet: ethers.Wallet,
    transferId: string,
    srcChainID: bigint,
    destChainID: bigint,
    diamondAddress: string,
    recipient: string,
    tokenId: bigint,           // always 0n for GNUS
    amount: bigint
): Promise<string> {
    const structHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'uint256', 'uint256', 'address', 'address', 'uint256', 'uint256'],
            [transferId, srcChainID, destChainID, diamondAddress, recipient, tokenId, amount]
        )
    );
    // signMessage applies the EIP-191 prefix internally and returns r‖s‖v (65 bytes).
    return validatorWallet.signMessage(ethers.getBytes(structHash));
}

// Off-chain aggregation: collect signatures, sort by recovered address ascending.
async function aggregateCertificate(
    signatures: { wallet: ethers.Wallet; sig: string }[],
    structHash: string
): Promise<string[]> {
    const withAddr = signatures.map(({ sig }) => ({
        sig,
        addr: ethers.recoverAddress(
            ethers.hashMessage(ethers.getBytes(structHash)),
            sig
        ),
    }));
    withAddr.sort((a, b) => (a.addr.toLowerCase() < b.addr.toLowerCase() ? -1 : 1));
    return withAddr.map(({ sig }) => sig);
}
```

### SuperGenius-Side EVM Envelope Signer (NEW — SuperGenius repo work)

```cpp
// Source: net-new function for SuperGenius repo — does NOT exist yet.
// Required because GeniusAccount::Sign() (GeniusAccount.cpp:854) uses
// double-SHA256 + little-endian scalars + no recovery ID and cannot be reused.
//
// Add to GeniusAccount.hpp/.cpp:

/**
 * @brief Sign a 32-byte digest with EVM-compatible ECDSA (EIP-191 wrapped).
 * @param[in] struct_hash  32-byte keccak256 digest of the abi.encode'd bridge payload.
 * @return 65-byte signature r‖s‖v with v ∈ {27, 28}, big-endian scalars.
 */
std::vector<uint8_t> GeniusAccount::SignEVM( const std::array<uint8_t, 32> &struct_hash ) const
{
    const auto *context = GetSecp256k1Context();

    // EIP-191 personal_sign prefix: "\x19Ethereum Signed Message:\n32" || struct_hash
    std::array<uint8_t, 28 + 32> prefixed{};
    constexpr std::string_view PREFIX = "\x19""Ethereum Signed Message:\n32";
    std::copy( PREFIX.begin(), PREFIX.end(), prefixed.begin() );
    std::copy( struct_hash.begin(), struct_hash.end(), prefixed.begin() + 28 );

    // keccak256 of the prefixed message
    const std::array<uint8_t, 32> message_hash =
        nil::crypto3::hash<nil::crypto3::hashes::keccak_1600<256>>(
            std::vector<uint8_t>( prefixed.begin(), prefixed.end() ) );

    // Recoverable signature so we can extract v.
    std::array<uint8_t, 32> secret_key{};
    const auto private_key = eth_keypair_->get_private_key();
    nil::marshalling::bincode::field<ecdsa_t::scalar_field_type>::field_element_to_bytes<
        std::array<uint8_t, 32>::iterator>( private_key.private_key_data(),
                                            secret_key.begin(), secret_key.end() );
    std::reverse( secret_key.begin(), secret_key.end() );  // to big-endian for libsecp256k1

    secp256k1_ecdsa_recoverable_signature recoverable_sig;
    if ( secp256k1_ecdsa_sign_recoverable( context, &recoverable_sig,
                                           message_hash.data(), secret_key.data(),
                                           nullptr, nullptr ) == 0 )
    {
        genius_account_logger()->error( "Could not produce EVM recoverable signature" );
        return {};
    }

    std::array<uint8_t, 64> compact{};
    int recid = 0;
    secp256k1_ecdsa_recoverable_signature_serialize_compact(
        context, compact.data(), &recid, &recoverable_sig );

    std::vector<uint8_t> out( 65 );
    // r and s are ALREADY big-endian from serialize_compact (do NOT reverse).
    std::copy( compact.begin(), compact.end(), out.begin() );
    out[64] = static_cast<uint8_t>( 27 + recid );
    return out;
}
```

**Critical differences from existing `Sign()`:**
1. Hash is **keccak256 of EIP-191 prefixed message**, not double-SHA256.
2. Scalars are **big-endian**, NOT reversed (this matches what `secp256k1_ecdsa_recoverable_signature_serialize_compact` produces natively).
3. Output is **65 bytes with recovery ID** `v ∈ {27, 28}`, not 64 bytes.
4. Uses `secp256k1_ecdsa_sign_recoverable`, not `secp256k1_ecdsa_sign`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lock/release vault custody on each chain | Provenance relocation (burn on source, mint on destination) | Phase 10 CONTEXT D-01 (2026-08-17) | No vault to drain, no vault-balance checks, no cross-chain accounting of locked float. `globalSupply` is invariant under bridging. |
| SG-native envelope (double-SHA256, LE scalars, no `v`) verified on-chain | Purpose-built EVM envelope (keccak + EIP-191 + recoverable sig) produced by SG aggregator | Phase 10 CONTEXT D-11 | On-chain verification is a simple `ecrecover` per sig. No SHA256 precompile needed. No pubkey registry needed. |
| Trusted relayer address | Permissionless relaying with on-chain threshold certificate | Phase 10 CONTEXT D-09 | No relayer key to compromise; relayer is just a gas payer. Authorization is the certificate. |
| `mapping(address => bool) authorizedRelayers` | Merkle root commitment of validator set + threshold | Phase 10 CONTEXT D-15 | One SSTORE per rotation; proofs scale O(log n). |
| `TransferStatus` enum with `LOCK_CONFIRMED`/`CANCELLED`/`EXPIRED` | Two states implied by `processedMessages` boolean | Phase 10 CONTEXT D-04, D-05 | No state machine storage; replay flag IS the state. Phase 12 will layer in-flight accounting on top. |

**Deprecated/outdated:**
- `LOCK_CONFIRMED` state: Dropped because there is no lock to confirm in the provenance-relocation model. Superseded by the `BridgeOutInitiated` event on source + `processedMessages` flag on destination.
- Vault-balance sufficiency check: Dropped. D-03 says the source chain's `balanceOf(sender, id) >= amount` check is sufficient — there is no vault to check.
- CANCELED/EXPIRED branches: Dropped per D-05. Eventual consistency means a late-arriving message is just a valid message that arrived late; the certificate does not expire in this phase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 24,576-byte EIP-170 contract size limit still applies to facet contracts on the target chains. | Architecture Patterns / Standard Stack | If a target chain has a lower limit (e.g., some L2s historically had different limits), `bridgeIn` may need to be split into its own facet. |
| A2 | The current GNUSBridge facet has ~6.4 KB headroom based on the 18,181-byte size noted in STATE.md (Phase 9 decisions log). | Standard Stack / Alternatives | If Phase 9's bytecode size has drifted, the planner should re-measure with `yarn hardhat size-contracts` (or equivalent) before committing to the in-facet approach. |
| A3 | SG validators are running with Ethereum-compatible private keys already (D-17) and adding a `SignEVM()` function is purely additive. | Code Examples | If D-17 is wrong (e.g., some validators use different key types), the validator set may need to be a subset of "EVM-capable" validators. |
| A4 | The OZ `ECDSAUpgradeable.tryRecover` in `@gnus.ai/contracts-upgradeable-diamond` behaves identically to upstream OZ Contracts 4.x. | Code Examples | If the gnus.ai fork diverges, the malleability protections may differ. Verified by direct file inspection — `tryRecover` exists at line 57 with the standard low-s and v checks. |
| A5 | Approximately 3,000 gas per `ecrecover` precompile call. | State of the Art | If repricing EIPs land, gas estimates shift linearly. This is the long-standing Yellow Paper value. |
| A6 | The planner will choose the merkle root option (not `mapping(address => bool)` + threshold) because D-15 phrased it as the chosen option ("use option (b): the diamond stores a threshold plus a merkle root"). | Architecture Patterns | If the planner chooses the mapping, Patterns 2 and 3 simplify (no merkle proofs needed) but rotation becomes more expensive. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **How will the SG-side aggregator service be deployed and operated?**
   - What we know: D-11 says "SG's aggregator produces a purpose-built EVM envelope after slot quorum is reached." The consensus round scheme in `ConsensusManager::GetAggregatorRole` already picks a `CurrentAggregator` per round.
   - What's unclear: Is the EVM envelope built by the same `CurrentAggregator` node, or by a separate process? Where does the aggregated certificate get published so a permissionless relayer can pick it up (pubsub topic, HTTP endpoint, IPFS)?
   - Recommendation: Treat this as SuperGenius-repo work to be planned in parallel. The EVM-side `bridgeIn` does not care — it accepts any properly-formed certificate from any submitter.

2. **What is the initial validator merkle root and threshold for each deployed chain?**
   - What we know: D-15 says the merkle root will be manually updated for now. D-16 says the export mechanism is deferred.
   - What's unclear: Who computes the initial root? What threshold (e.g., 2-of-3, 3-of-5, 5-of-7)? Where is the off-chain validator list documented?
   - Recommendation: Add a deployment-runbook task: "Super Admin generates the initial validator set file, computes the merkle root off-chain, and calls `setValidatorSet(root, threshold)` via the multisig." Test the full flow on Sepolia first.

3. **How does the SG-side aggregator know the destination chain's diamond address to include in the digest?**
   - What we know: D-08 requires `address(diamond)` in the digest.
   - What's unclear: Is the diamond address for each chain stored in SG's config? In `deployed-data.json`? In a CRDT registry?
   - Recommendation: SG-side aggregator should read from a chain-registry config file (similar to `ChainContractPair` already used by `BridgeRelayer`). Out of scope for this phase but flag for the SG-side plan.

4. **Does `BridgeOutInitiated` need to also be emitted on `bridgeIn` for symmetric SG-side tracking?**
   - What we know: The SG side tracks `/bridge/executed/{chainid}:{tx_hash}` for replay protection on its own books.
   - What's unclear: Does SG need to learn that the destination-side `bridgeIn` completed (for its own ledger), or is the EVM-side `processedMessages` flag sufficient?
   - Recommendation: Defer to Phase 12 (Cross-Chain Supply Ledger). The `BridgeReleased` event this phase adds is sufficient for SG to observe completion if/when it needs to.

5. **Should `bridgeIn` charge the GNUSWithdrawLimiter for the recipient?**
   - What we know: `bridgeOut` charges the limiter for child tokens (and the `_burn` hook charges it for GNUS). The `_mint` path explicitly skips the limiter (only non-mint transfers charge it — `GNUSERC1155MaxSupply._beforeTokenTransfer` checks `!isMinting`).
   - What's unclear: Is minting-on-destination a "withdrawal" from the user's perspective that should count against their limiter? Almost certainly not — they are RECEIVING tokens, not withdrawing. But the user might then immediately bridgeOut or sell, hitting the limiter on the way out.
   - Recommendation: **Do not charge the limiter on bridgeIn.** The limiter is a withdrawal-rate control, not a receipt-rate control. The user will hit it on the next outgoing transfer if applicable. Flag for planner/user confirmation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Hardhat test runner, ethers.js signing | ✓ | v24.13.0 | — |
| Hardhat | Diamond deploy, unit tests | ✓ | 3.13.0 | — |
| Foundry (forge) | Invariant tests | ✓ | 1.7.1 | — |
| `@gnus.ai/contracts-upgradeable-diamond` | ECDSAUpgradeable, MerkleProofUpgradeable | ✓ | vendored in node_modules | — |
| `contracts-starter` (LibDiamond) | Diamond storage pattern | ✓ | vendored | — |
| Solidity compiler | Contract compilation | ✓ | ^0.8.19 (per DEBT-03) | — |
| `secp256k1_ecdsa_sign_recoverable` (libsecp256k1) | SG-side `SignEVM` | ✓ | already linked in SG (`GetSecp256k1Context` used at GeniusAccount.cpp:806) | — |
| `nil::crypto3::hashes::keccak_1600<256>` | SG-side keccak for EIP-191 wrapper | ✓ | already used in `EthereumKeyPairParams.hpp:29` | — |
| SuperGenius build | SG-side `SignEVM` implementation | ✓ | SG repo at `../SuperGenius` | — |

**Missing dependencies with no fallback:**
- None.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (unit) | Hardhat + Mocha + Chai + ethers.js v6 |
| Framework (invariant/fuzz) | Foundry (forge) |
| Config file (Hardhat) | `hardhat.config.ts` |
| Config file (Foundry) | `test/foundry/GeniusDiamond.forge.config.json` |
| Quick run command (unit) | `npx hardhat test test/unit/GNUSBridgeIn.test.ts` |
| Quick run command (Foundry) | `forge test --match-contract BridgeInvariant -vvv` |
| Full unit suite | `npx hardhat test` |
| Full Foundry suite | `yarn forge:test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| BRIDGE-02 | `bridgeIn` succeeds with valid threshold certificate and mints to recipient | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "mints on valid certificate"` | ❌ Wave 0 |
| BRIDGE-02 | `bridgeIn` reverts when validator set not configured (threshold = 0) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "unconfigured validator set"` | ❌ Wave 0 |
| BRIDGE-02 | `bridgeIn` reverts when paused (D-21) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "paused"` | ❌ Wave 0 |
| BRIDGE-02 | `bridgeOut` reverts when paused (D-20) | unit | `npx hardhat test test/unit/Phase5-circuit-breaker.test.ts` | ✅ |
| BRIDGE-02 | `setValidatorSet` only by Super Admin; emits `ValidatorSetUpdated` | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "setValidatorSet"` | ❌ Wave 0 |
| BRIDGE-03 | `bridgeIn` reverts on duplicate `transferId` (replay) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "replay"` | ❌ Wave 0 |
| BRIDGE-03 | `bridgeIn` reverts on cross-chain replay (wrong `destChainID`) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "wrong destination"` | ❌ Wave 0 |
| BRIDGE-03 | `bridgeIn` reverts on cross-diamond replay (different diamond address in digest) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "cross-diamond"` | ❌ Wave 0 |
| BRIDGE-03 | `bridgeIn` reverts on unsorted signatures (strictly-ascending violated) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "not strictly ascending"` | ❌ Wave 0 |
| BRIDGE-03 | `bridgeIn` reverts on duplicate signer (same sig twice) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "duplicate signer"` | ❌ Wave 0 |
| BRIDGE-03 | `bridgeIn` reverts on signature from non-validator | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "not a registered validator"` | ❌ Wave 0 |
| BRIDGE-03 | `bridgeIn` reverts below threshold | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "below threshold"` | ❌ Wave 0 |
| BRIDGE-04 | `bridgeIn` enforces global cap via `_mintWithBridgeFee` (reverts if `globalSupply + amount > GNUS_MAX_SUPPLY`) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "global cap"` | ❌ Wave 0 |
| BRIDGE-04 | `bridgeIn` applies bridge fee via `_mintWithBridgeFee` (recipient receives post-fee amount) | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "applies bridge fee"` | ❌ Wave 0 |
| BRIDGE-04 | `bridgeIn` increments `chainSupply[block.chainid]` and `globalSupply` | unit | `npx hardhat test test/unit/GNUSBridgeIn.test.ts --grep "chain supply"` | ❌ Wave 0 |
| BRIDGE-04 | `bridgeIn` enforces `tokenId == GNUS_TOKEN_ID` (D-14) — implicit because `bridgeIn` hardcodes `GNUS_TOKEN_ID` | unit | covered by digest construction | n/a |
| BRIDGE-02 | Invariant: `processedMessages[id]` is set iff `BridgeReleased(id, ...)` was emitted | invariant | `forge test --match-contract BridgeInvariant --match-test invariant_processedMessagesIffReleased` | ❌ Wave 0 (extend existing) |
| BRIDGE-02 | Invariant: `globalSupply` unchanged across a bridgeOut + bridgeIn pair on the same diamond | invariant | `forge test --match-contract ConservationInvariant` | ✅ (extend with bridge case) |
| BRIDGE-03 | Fuzz: arbitrary signatures never pass verification | fuzz | `forge test --match-contract BridgeInvariant --match-test invariant_noValidCertFromFuzzedSigs` | ❌ Wave 0 |
| D-18 | Manual Super Admin bridge-in path via `mint(user, 0, amount)` works alongside certificate path | unit | covered by existing `GNUSBridgeEnhanced.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** `npx hardhat test test/unit/GNUSBridgeIn.test.ts` (< 30 seconds)
- **Per wave merge:** `npx hardhat test && forge test --match-contract BridgeInvariant`
- **Phase gate:** `npx hardhat test && yarn forge:test` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/unit/GNUSBridgeIn.test.ts` — covers all `bridgeIn` paths (BRIDGE-02, BRIDGE-03, BRIDGE-04). New file; modeled on `GNUSBridgeEnhanced.test.ts` pattern.
- [ ] `test/utils/bridge-certificate.ts` — helper that produces valid EIP-191 certificates for N test validators (uses `signBridgeInCertificate` + `aggregateCertificate` from Code Examples). New file.
- [ ] Extend `test/foundry/invariant/BridgeInvariant.t.sol` — add `invariant_processedMessagesIffReleased`, `invariant_noValidCertFromFuzzedSigs`. Existing file, currently a stub.
- [ ] Extend `test/foundry/invariant/ConservationInvariant.t.sol` — add bridge-pair invariant (global supply unchanged across bridgeOut + bridgeIn). Existing file.
- [ ] No framework install needed — Hardhat and Foundry are already wired up.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | m-of-n threshold ECDSA certificate via `ECDSAUpgradeable.tryRecover`; strictly-ascending signer order; merkle membership proof per signer |
| V3 Session Management | no | — |
| V4 Access Control | yes | `onlySuperAdminRole` on `setValidatorSet`; `MINTER_ROLE` for manual path (already in place); permissionless `bridgeIn` for the certificate path (D-09) |
| V5 Input Validation | yes | `require` on: paused, `!processedMessages[transferId]`, `block.chainid == chainID`, `srcChainID != block.chainid`, `recipient != address(0)`, `amount > 0`, `signatures.length == merkleProofs.length`, `signatures.length >= threshold`, strictly-ascending signers, merkle membership |
| V6 Cryptography | yes | `ECDSAUpgradeable.tryRecover` (low-s malleability protection, v ∈ {27, 28}); `MerkleProofUpgradeable.verify`; `keccak256` (native); EIP-191 wrapper |
| V7 Error Handling | yes | Explicit `require` messages (no silent failures); `tryRecover` returns error enum rather than reverting, enabling clean failure paths |
| V8 Data Protection | no | — |
| V9 Communications | yes | Cross-chain message authentication via threshold certificate; replay protection via `processedMessages`; cross-chain/diamond/recipient binding via digest |
| V10 Malicious Code | yes | Slither run on changed files per project convention |
| V12 Files/Resources | no | — |
| V13 API | yes | `bridgeIn` is a permissionless external function — must be robust to malformed calldata |
| V14 Configuration | yes | `validatorMerkleRoot` and `validatorThreshold` are security-critical configuration; changes emit events |

### Known Threat Patterns for EVM Bridge + Threshold ECDSA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Signature malleability (`(r, s, v)` → `(r, n-s, v^1)`) | Tampering | OZ `tryRecover` enforces low-s and `v ∈ {27, 28}`. |
| Replay on same chain | Tampering | `processedMessages[transferId]` boolean, set before mint (CEI). |
| Replay across chains | Tampering | `destChainID = block.chainid` in digest; `require(block.chainid == chainID)`. |
| Replay across diamonds (same chain, different deployments) | Tampering | `address(this)` in digest. |
| Replay across recipients | Tampering | `recipient` in digest. |
| Replay with different amount | Tampering | `amount` in digest. |
| Duplicate signer reaching threshold | Elevation of Privilege | Strictly-ascending signer addresses enforced on-chain. |
| Signature from non-validator | Elevation of Privilege | Merkle membership proof per signer against committed root. |
| Front-running the certificate | Information Disclosure | Not a threat — `bridgeIn` is permissionless and the certificate is bound to a specific recipient. Front-running only pays gas for the intended recipient. |
| Validator set rotation race | Tampering | `ValidatorSetUpdated` event emitted; old root becomes invalid immediately. In-flight certificates signed against the old root will fail verification. Acceptable because D-05 allows certificates to be re-signed. |
| DoS via huge `signatures` array | Denial of Service | Implicitly bounded by block gas limit (~30M gas / ~3k gas per ecrecover = ~10k signatures max). No explicit cap needed; threshold is reached long before. |
| Pause bypass | Tampering | Explicit `require(!paused)` at the top of `bridgeIn`; belt-and-braces with `_beforeTokenTransfer`. |
| Storage slot collision | Tampering | Unique storage slot string `gnus.ai.bridge.validator.storage`; verified by grep against existing slots. |
| Bridge fee arithmetic overflow | Tampering | `_mintWithBridgeFee` checks `bridgeFee <= FEE_DENOMINATOR` (WR-04 defense-in-depth). Solidity 0.8 reverts on overflow automatically. |
| Reentrancy via mint hook | Tampering | CEI order: mark `processedMessages` BEFORE `_mintWithBridgeFee`. The mint path is internal and does not call user code in the current design, but CEI is the correct idiom regardless. |

---

## Sources

### Primary (HIGH confidence)
- `contracts/gnus-ai/GNUSBridge.sol` — current `bridgeOut`, `_mintWithBridgeFee`, `burn`, `mint` overloads (read directly)
- `contracts/gnus-ai/GNUSTreasuryStorage.sol` — `globalSupply`, `chainSupply`, `ownChainId` layout (read directly)
- `contracts/gnus-ai/GNUSControlStorage.sol` — `paused` flag, `chainID` (read directly)
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` — `_beforeTokenTransfer` pause + limiter hook (read directly)
- `contracts/gnus-ai/GeniusAccessControl.sol` — `onlySuperAdminRole`, role setup (read directly)
- `contracts/gnus-ai/DiamondInitFacet.sol` — initial role grants (read directly)
- `node_modules/@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/ECDSAUpgradeable.sol` — `tryRecover`, `toEthSignedMessageHash` (read directly)
- `node_modules/@gnus.ai/contracts-upgradeable-diamond/utils/cryptography/MerkleProofUpgradeable.sol` — `verify`, `processProof` (read directly)
- `diamonds/GeniusDiamond/geniusdiamond.config.json` — facet versions and initializers (read directly)
- `../SuperGenius/src/account/GeniusAccount.cpp` — `Sign()` at line 854, `VerifySignature()` at line 788 (read directly)
- `../SuperGenius/src/blockchain/Consensus.hpp` — `ConsensusManager` API (read directly)
- `../SuperGenius/src/blockchain/impl/proto/Consensus.proto` — `ConsensusCertificate`, `ConsensusVote` schema (read directly)
- `../SuperGenius/src/account/BridgeRelayer.hpp` — event ingestion pattern (read directly)
- `../SuperGenius/src/account/TransactionManager.cpp` — `MintFunds` replay protection at lines 575-700 (read directly)
- `../SuperGenius/ProofSystem/include/ProofSystem/EthereumKeyGenerator.hpp` — key API (read directly)
- `.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` — locked decisions D-01..D-22 (read directly)
- `.planning/STATE.md` — Phase 9 bytecode size + decisions log (read directly)
- `.planning/phases/05-circuit-breaker-performance/05-CONTEXT.md` — pause mechanism design (read directly)

### Secondary (MEDIUM confidence)
- [OpenZeppelin Contracts v4.x Utils documentation](https://docs.openzeppelin.com/contracts/4.x/api/utils) — ECDSA + MerkleProof usage patterns, EIP-191 vs raw digest guidance. Verified against the vendored source.

### Tertiary (LOW confidence)
- WebSearch result on `ecrecover` gas cost (~3,000 gas) — long-standing Yellow Paper value, not expected to have changed, but flagged [ASSUMED] in the log.
- WebSearch result on multisig threshold gas estimates — used for rough sizing only; not load-bearing for any decision.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already vendored and inspected; no new packages
- Architecture: HIGH — patterns grounded in existing code (GNUSBridge, GNUSTreasuryStorage, Phase 5 pause); digest layout directly from CONTEXT D-08/D-10
- Pitfalls: HIGH — each pitfall cites a specific code path or CONTEXT decision
- SG-side integration: MEDIUM — `SignEVM` is net-new code; the shape is clear but the exact integration point in SG's aggregation flow needs SG-side planning

**Research date:** 2026-08-17
**Valid until:** 2026-09-16 (30 days — stable domain; no fast-moving dependencies)
