# Secure BridgeIn — Exporter ABI & Digest Specification

**Audience:** the SuperGenius-side C++ exporter (the node software that observes source
bridge-out events and emits V2 attestor certificates for EVM `bridgeIn`).

**Status:** Phase 15 (Secure BridgeIn, Phase 10 Amendment), Plan 15-04 — SPEC deliverables 5
and 7 from `docs/Secure-BridgeIn.md:744-761`.

**Conformance vectors:** `test/fixtures/bridge-attestor-vectors.json` (BRIDGE-18, frozen).
**Executable reference:** `test/utils/bridge-certificate.ts` (TypeScript, side-effect free).
**On-chain implementation:** `contracts/gnus-ai/GNUSBridgeAttestor.sol`.

Every constant below was cross-checked against the facet source and the fixture. If this
document and the facet ever disagree, **the facet and the vectors win** — file a correction
against this document.

---

## 1. EVM-side ABI

All functions live on the GeniusDiamond proxy; `bridgeIn` and the admin/views resolve to the
`GNUSBridgeAttestor` facet. Selectors are `keccak256(signature)[0..4]`.

### 1.1 Certificate bridge-in (the exporter's target)

| Field | Value |
|---|---|
| Signature | `bridgeIn((uint256,bytes32,bytes32,uint256,address,uint256),bytes32,bytes[],bytes32[][])` |
| Selector | `0x4d2e0756` |
| Mutability | `external` (nonpayable, permissionless — the certificate is the authorization) |

**`BridgeMessage` tuple** (field order is protocol — SPEC :247-290, BRIDGE-12):

| # | Name | Type | Notes |
|---|------|------|-------|
| 1 | `srcChainID` | `uint256` | Chain the bridge-out was initiated on; must differ from `block.chainid` |
| 2 | `sourceBridgeID` | `bytes32` | Source bridge identifier — for an EVM source, the source bridge address left-padded to 32 bytes; nonzero |
| 3 | `sourceTxHash` | `bytes32` | Source transaction hash (or equivalent source-ledger transaction id); nonzero |
| 4 | `sourceEventIndex` | `uint256` | EVM log index / SuperGenius output index within `sourceTxHash` |
| 5 | `recipient` | `address` | Receiver of the post-fee mint; nonzero |
| 6 | `amount` | `uint256` | PRE-FEE GNUS amount (the destination bridge fee applies on-chain) |

**Trailing arguments:**

| Name | Type | Notes |
|---|---|---|
| `nextAttestorRoot` | `bytes32` | Root this certificate installs; nonzero; may equal the current root (claim-only); at epoch 0 it MUST differ |
| `signatures` | `bytes[]` | 65-byte EIP-191 signatures, strictly ascending by recovered address |
| `merkleProofs` | `bytes32[][]` | One proof per signature, parallel array, against the CURRENT root only |

**On-chain guard order** (diagnostics for rejected certificates — revert strings are the
facet's named constants):

1. `GNUSControl: contract paused` — pause gate is first.
2. `Bridge attestor V2 not initialized` — Genesis bootstrap has not run.
3. `Wrong destination chain` — `block.chainid != stored chainID`.
4. `Cannot bridge from same chain` — `srcChainID == block.chainid`.
5. `Invalid source bridge` / `Invalid source transaction` / `Invalid recipient` / `Invalid amount` / `Invalid next attestor root` — nonzero checks.
6. `Message already processed` — replay of the composite messageId.
7. `Bridge attestor root not configured` / `Genesis certificate must install API attestors` — epoch-0 gates.
8. `Sig/proof length mismatch`, `Below threshold`, `Too many attestor signatures`, `Bad signature`, `Signers not strictly ascending`, `Not a registered attestor` — verifier.
9. `Bridge fee consumes entire amount`, `Global max supply exceeded` — fee-mint.

**Success emits** (in order): `BridgeAttestorSetAdvanced(uint64 indexed oldEpoch, uint64
indexed newEpoch, bytes32 indexed oldRoot, bytes32 newRoot)` only when the root actually
changed; the ERC-20-style `Transfer`/`TransferSingle` mint events; and
`BridgeReleased(bytes32 indexed transferId, address indexed recipient, uint256 amount,
uint256 srcChainID, uint256 destChainID)` — `transferId` carries the **V2 messageId**
(topic0 byte-identical to the Phase 10 declaration for off-chain monitor continuity),
`amount` is the **pre-fee** amount.

### 1.2 Admin functions (superAdmin only — the exporter never calls these)

| Signature | Selector | Preconditions |
|---|---|---|
| `initializeBridgeAttestorV2(address)` | `0x8c864f52` | One-shot per diamond (never resets, not even by recovery); nonzero Genesis address; writes the one-leaf root at epoch 0 and the default active threshold 2; NOT wired as a config initializer (manual post-cut call) |
| `setBridgeAttestorActiveThreshold(uint256)` | `0x604c3b10` | `2 <= newThreshold <= 16` (`Threshold below active floor` / `Threshold above attestor cap`); emits `BridgeAttestorActiveThresholdSet(old, new)` |
| `emergencyRecoverAttestorSet(bytes32)` | `0x669588d5` | Requires paused (`GNUSControl: contract must be paused`), nonzero new root, initialized set; writes `epoch = oldEpoch + 1`; emits `BridgeAttestorEmergencyReset(oldEpoch, oldEpoch+1, oldRoot, newRoot)`; never touches the init flag |

### 1.3 Views

| Signature | Selector | Returns |
|---|---|---|
| `bridgeAttestorRoot()` | `0xe1dee3b1` | Current root (`bytes32(0)` = not bootstrapped) |
| `bridgeAttestorEpoch()` | `0x74980350` | Current epoch (`uint256`; 0 = Genesis or unbootstrapped) |
| `activeBridgeAttestorThreshold()` | `0xed8e3b94` | Effective threshold at the current epoch (1 at epoch 0, else the stored override with zero-guard fallback to 2) |

Exporters should read `bridgeAttestorRoot()` and `bridgeAttestorEpoch()` before building a
certificate so `currentRoot`/`currentEpoch` match the live set.

---

## 2. Digest specification (BRIDGE_CERTIFICATE_V2)

### 2.1 Domain constants

```
BRIDGE_CERTIFICATE_V2 = keccak256("GNUS_BRIDGE_CERTIFICATE_V2")
                      = 0x0c9113fc73963b588d64629e34320173d476269c17e86929f707794e43f12c5b

BRIDGE_MESSAGE_ID_V2  = keccak256("GNUS_BRIDGE_MESSAGE_ID_V2")
                      = 0xcad6f4b492a613b2322ad77e106df9e952c4686b8455874b7af1d7508943a434

GNUS_TOKEN_ID         = 0
```

### 2.2 Certificate struct hash — FLAT 13-field form (the exporter computes this)

```
structHash = keccak256(abi.encode(
    BRIDGE_CERTIFICATE_V2,     // bytes32  — domain
    currentAttestorEpoch,      // uint64 on-chain; encode as one zero-padded 32-byte word
    currentAttestorRoot,       // bytes32  — root verified against
    nextAttestorRoot,          // bytes32  — root the certificate installs
    srcChainID,                // uint256  — message identity group (also keys the messageId)
    sourceBridgeID,            // bytes32
    sourceTxHash,              // bytes32
    sourceEventIndex,          // uint256
    destChainID,               // uint256  — == block.chainid at verification time
    diamondAddress,            // address  — == address(diamond) at verification time
    recipient,                 // address
    GNUS_TOKEN_ID,             // uint256  — hardcoded 0
    amount                     // uint256  — PRE-FEE
))
```

**Field order and types are protocol.** The on-chain `_bridgeInDigestV2` computes a
`bytes.concat` of three partial `abi.encode` groups (the flat form exceeds the Solidity
0.8.19 stack limit without `viaIR`); every field is a value type occupying exactly one
32-byte word, so the split and flat encodings are **byte-identical** — proven, not assumed,
by vector leg V1 (flat == split == fixture `structHash`) in
`test/unit/GNUSBridgeAttestorIn.test.ts`.

### 2.3 EIP-191 wrapping and signature form

```
digest = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n32",   // 26-byte prefix + literal length "32"
    structHash
))
```

Each attestor signs `digest` with its secp256k1 key. The submitted `bytes` item is the
**65-byte canonical `r || s || v`** serialization: `r` and `s` big-endian 32-byte words,
`v ∈ {27, 28}`, low-`s` canonical (high-`s` signatures are rejected upstream of recovery —
submit the canonical low-`s` form and the matching `v`). Recovering the signature against
`digest` must yield the attestor's EVM address.

Signatures MUST be submitted **sorted strictly ascending by recovered address** (`Signers
not strictly ascending` otherwise; duplicates are thereby impossible).

### 2.4 Message identity — the replay key (BRIDGE-12)

```
messageId = keccak256(abi.encode(
    BRIDGE_MESSAGE_ID_V2,
    srcChainID,
    sourceBridgeID,
    sourceTxHash,
    sourceEventIndex
))
```

`recipient` and `amount` are deliberately NOT in the replay key — they are bound by the
certificate digest instead. The on-chain `processedMessages` slot-0 mapping is keyed by
`messageId`; two events in the same source transaction stay distinct via `sourceEventIndex`.

### 2.5 Attestor Merkle tree conventions

- **Leaf:** `keccak256(abi.encodePacked(evmAddress))` — the **20-byte packed** address, NOT
  `abi.encode` (which pads to 32).
- **Pairs:** each level sorts the pair (`lo = min`, `hi = max` by compare) and hashes
  `keccak256(concat(lo, hi))` — matches OpenZeppelin `MerkleProofUpgradeable.verify`.
- **Odd nodes:** the last unpaired node of a level is promoted unchanged.
- **One-leaf tree (Genesis):** `root == leaf`, proof is the empty array.
- **Proofs verify against the CURRENT root only** — never `nextAttestorRoot`. A signer that
  exists only in the next root cannot authorize the transition that installs it.

### 2.6 Epoch / threshold rules (D-03)

| Rule | Value |
|---|---|
| Genesis (epoch 0) threshold | 1 — immutable; the certificate cannot choose its own difficulty |
| Active (epoch > 0) default | 2 (two-of-N) |
| superAdmin override bounds | 2..16 (`setBridgeAttestorActiveThreshold`) |
| Max signatures per certificate | 16 (`Too many attestor signatures` above) |
| Genesis must-advance | At epoch 0, `nextAttestorRoot != currentRoot` is enforced |
| Root transition | Only inside a verified `bridgeIn`: root install + exactly one epoch increment; unchanged root = no bump |

---

## 3. Conformance vectors

`test/fixtures/bridge-attestor-vectors.json` (BRIDGE-18) contains two frozen vectors —
`genesis-transition` (1-sig, epoch 0→1) and `active-root-claim` (2-of-3, unchanged root) —
each with: private key, 64-byte SuperGenius public key (`sgPublicKey64`, X‖Y, `0x04`
stripped), derived EVM address, roots, epoch, all BridgeMessage fields, `messageId`,
`structHash`, `eip191Digest`, 65-byte signature, recovered address, and Merkle proofs.

The vectors are bound to the frozen C++ conformance environment
(`chainid = 31337`, `diamondAddress = 0x1111...11`). **The C++ exporter must reproduce
every value byte-for-byte from the frozen inputs.** At runtime the exporter substitutes the
LIVE `block.chainid` and deployed diamond address into the digest (environment-bound
fields); roots, proofs, and the messageId are environment-independent.

`test/utils/bridge-certificate.ts` is the executable reference — `computeBridgeMessageId`,
`computeBridgeInStructHashV2` (flat form), `signBridgeInCertificateV2`,
`aggregateCertificateV2`, and `buildValidatorMerkleTree` mirror the facet field-for-field.

---

## 4. Security note (SPEC deliverable 7)

**Genesis bootstrap.** `initializeBridgeAttestorV2` is a one-shot superAdmin call that
writes a one-leaf root at epoch 0 with an immutable threshold of 1. The bootstrap flag
never resets — not via recovery, not via any other path — so the 1-of-1 mode can never be
re-entered. The first successful certificate MUST install a different root (Genesis
must-advance), and every later epoch derives a threshold of at least 2. Bootstrap takes an
argument precisely so it is not an automated initializer: the Genesis address never appears
in this repository.

**Two-of-N API-attestor operation.** Steady state is a rolling Merkle root over the
recently-successful API-backed attestors, with a 2-of-N (default) signature floor. The
floor is structural — the superAdmin override cannot go below 2 — so a single compromised
attestor key can never authorize a mint or a root rotation.

**Root rotation.** Routine rotation is a SIDE EFFECT of a verified certificate: the
attestors co-sign `nextAttestorRoot` into the digest, and the transition (root install +
single epoch increment) executes before the mint under CEI ordering — a failed mint reverts
the rotation and the replay marker atomically. An admin path exists ONLY for emergencies:
`emergencyRecoverAttestorSet` requires the diamond to be paused, a superAdmin caller, a
nonzero root, and it always writes `epoch = oldEpoch + 1` — the post-state can never be
epoch 0, so Genesis is structurally unrecoverable. There is no admin-driven routine
rotation.

**Replay protection.** The replay key is the composite messageId (domain + the four
source-event identity fields), stored in the same slot-0 `processedMessages` mapping the
Phase 10 path used (domain-separated keys coexist collision-free). On top of the replay
marker, the digest itself binds the destination chain (`block.chainid`) and the target
diamond (`address(this)`), so a certificate for one chain/diamond is worthless on another:
wrong-chain or cross-diamond submissions fail signature recovery against the on-chain
digest.

**Why native `ConsensusVote.signature` cannot be used (PD-BR-7).** SuperGenius consensus
vote signatures are native secp256k1 over the vote bytes — they are not EIP-191-wrapped
and therefore are not recoverable by `ECDSAUpgradeable.tryRecover` against the on-chain
digest (the recovered address is foreign and fails attestor membership; proven by vector
leg V4 and matrix row D9). Exporters MUST re-sign the EIP-191-wrapped certificate digest as
a 65-byte `r||s||v` low-s signature. Reusing the shared secp256k1 key material (D-17) is
fine; reusing the consensus signature bytes is not.

**Why non-API/public-only nodes are excluded from the root.** The attestor set commits to
nodes that demonstrated an API RPC actually serving the claim flow. Non-API or public-RPC-
only nodes provide no verifiable liveness/identity for the bridge path — counting them
would dilute the two-of-N quorum with signers that cannot be held to the certificate
protocol. Slot-0/#363/#364 (below) tighten this to signature-verified, actually-succeeded
RPCs on the SuperGenius side.

---

## 5. BRIDGE-17 — production-activation gate

Production activation of `bridgeIn` is **gated on both SuperGenius issues closing**. They
are parallel work in the SuperGenius repository, not local blockers (owner ruling
2026-08-26):

| Issue | Description | Status |
|---|---|---|
| SuperGenius#363 | Slot quorum uses only signature-verified votes | **OPEN** |
| SuperGenius#364 | Slot 0 identifies the API RPC that actually succeeded for that exact claim | **CLOSED** |

EVM-side work (this repository) is complete and tested against the checked-in vectors; the
diamond remains non-production until #363 closes. There is no `.planning/SUBREPOS.md` in
this submodule — this document and the Phase 15 Plan 15-04 SUMMARY are the tracking record
for the gate (do not create additional planning scaffolding for it).
