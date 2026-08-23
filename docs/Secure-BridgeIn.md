# Secure BridgeIn with MMR Merkle Roots

**User:** Anonymous  
**Created:** 8/22/2026 21:06:51  
**Updated:** 8/23/2026 14:06:10  
**Exported:** 8/23/2026 14:07:23  
**Link:** [https://chatgpt.com/c/6a8a71da-6e94-83e8-9cfc-8e7f257d609e](https://chatgpt.com/c/6a8a71da-6e94-83e8-9cfc-8e7f257d609e)  

## Response:
8/23/2026, 1:55:25 PM

I’ll inspect the current `develop` bridge contract, storage layout, helpers, and tests, then give you a copy-paste LLM brief with the exact function shape and checks.

I’m mapping the static validator-root path to the rolling API-attestor certificate while preserving storage and mint logic, and checking that SuperGenius signatures are EVM-verifiable.

> **Clarifying bridge requirements**
>
> I’m identifying the bridge’s core changes: count only signature-verified votes, ensure slot hashes represent successful RPC verification, and design certificate validation around trusted genesis attestations plus later attestors.
>
> **Clarified bridge requirements**
>
> 
>
> **Refining certificate trust**
>
> I’m distinguishing claim authorization from attestor-set updates: current trusted attestors should sign each claim, while their certificate can authorize a successor root, creating a verifiable transition chain without requiring every participant’s prior registration.
>
> **Refined certificate trust configuration**
>
> 
>
> **Designing certificate fields**
>
> I’m defining certificates around source-event identifiers, claims, signer proofs, and a rolling attestor root. The stored root advances only after quorum approval, with bootstrap rules allowing genesis authorization before the stronger steady-state threshold.
>
> **Designed certificate fields**
>
> 
>
> **Inspected GNUSBridge contracts and computed minimal validator root state**
>
> 
>
> **Integrating signature compatibility**
>
> I’m ensuring bridge certificates use EVM-verifiable signatures, not native vote signatures blindly. Attestor identities should map consistently to EVM addresses, while hashing and scalar encoding must match the contract’s verification rules exactly.
>
> **Integrated signature compatibility**
>
> 
>
> **Investigated SuperGenius signature verification and designed attestor bridge updates**
>
> 
>
> Worked for 6m 7s

The current `GNUSBridge` already has the right basic safeguards: destination-chain binding, contract binding, replay protection before minting, bridge-fee handling, and global-supply accounting. The part to replace is the permanent validator root plus admin-controlled `setValidatorSet()`. 

One key warning belongs in the task: **do not submit native `ConsensusVote.signature` bytes directly to Solidity.** SuperGenius currently creates a 64-byte, non-recoverable secp256k1 signature over a double-SHA-256 hash, with each scalar stored least-significant byte first. `ECDSAUpgradeable.tryRecover()` expects an Ethereum-compatible recoverable signature over the contract’s EIP-191 digest. The SuperGenius bridge exporter must create a separate 65-byte recoverable signature for the EVM certificate.  

Here is the prompt I would give the coding LLM.

---

# Implement rolling API-attestor security for `GNUSBridge.bridgeIn`

## Repository and branch

```text
Repository: GeniusVentures/gnus-ai-contracts
Branch: develop
Primary files:
- GNUSBridge.sol
- GNUSBridgeValidatorStorage.sol
```

Read the existing contracts before changing them. Preserve the diamond storage layout and the existing bridge fee, global supply, chain supply, pause, and replay behavior.

## Goal

Replace the current permanent validator-set design with a small, rolling **bridge attestor root**.

The EVM bridge must not try to verify the complete SuperGenius validator registry or native consensus certificate.

The bridge attestor root contains only SuperGenius nodes that:

1. Have an API-backed or otherwise trusted slot-0 RPC endpoint.
2. Actually succeeded in verifying the relevant public-chain claim.
3. Were accepted into the next bridge-attestor set by the previously authorized bridge attestors.

Do not include:

- Public-RPC-only nodes.
- Ordinary non-API validators.
- Consensus reputation weights.
- The full SuperGenius validator registry.
- RPC URLs.
- An MMR.
- A Solidity implementation of SuperGenius consensus.

The trust chain is:

```text
Genesis bridge attestor
        |
        | signs first bridge claim and first API-attestor root
        v
API-attestor root R1
        |
        | threshold of R1 signs next claim and optional root R2
        v
API-attestor root R2
        |
        v
...
```

The initial genesis root is one trusted Genesis EVM address with a threshold of one.

After the first transition, every bridge claim requires at least two authorized API attestors.

## Important SuperGenius prerequisites

Issues `GeniusVentures/SuperGenius#363` and `#364` must be fixed before production use:

- Bridge slot quorum must use only signature-verified votes for the correct proposal.
- Slot 0 must identify an API RPC that actually succeeded for that exact claim, not merely an endpoint present in configuration.

The Solidity contract should assume it receives an EVM-specific certificate produced only after those checks.

Do not use the native `ConsensusVote.signature` as an EVM signature.

SuperGenius must export a separate bridge signature with these properties:

```text
Algorithm: secp256k1 ECDSA
Input: exact 32-byte EIP-191 digest produced by Solidity
Encoding: 65 bytes, r || s || v
r and s: 32-byte big-endian values
v: 27 or 28
s: low-s canonical form
```

The corresponding EVM address is:

```text
last 20 bytes of keccak256(uncompressedPublicKeyWithout04Prefix)
```

Add shared C++/Solidity test vectors for the exact digest and signature format.

## Do not reuse the legacy validator fields for new semantics

`GNUSBridgeValidatorStorage.Layout` currently contains:

```solidity
mapping(bytes32 => bool) processedMessages;
bytes32 validatorMerkleRoot;
uint256 validatorThreshold;
```

The storage layout is append-only. Do not reorder, remove, or change the types of these fields. 

Append the V2 fields:

```solidity
struct Layout {
    // Existing fields: do not move or modify.
    mapping(bytes32 => bool) processedMessages;
    bytes32 validatorMerkleRoot;
    uint256 validatorThreshold;

    // V2 rolling API-attestor state.
    bytes32 bridgeAttestorRoot;
    uint64 bridgeAttestorEpoch;
    bool bridgeAttestorV2Initialized;
}
```

The signature threshold is derived from the epoch:

```solidity
uint256 private constant GENESIS_ATTESTOR_THRESHOLD = 1;
uint256 private constant ACTIVE_ATTESTOR_THRESHOLD = 2;
uint256 private constant MAX_ATTESTOR_SIGNATURES = 16;
```

Use:

```solidity
function _bridgeAttestorThreshold(uint64 epoch) internal pure returns (uint256) {
    return epoch == 0
        ? GENESIS_ATTESTOR_THRESHOLD
        : ACTIVE_ATTESTOR_THRESHOLD;
}
```

Do not allow the certificate to choose its own threshold.

## Initialization

Add a one-time initializer:

```solidity
function initializeBridgeAttestorV2(
    address genesisAttestor
) external onlySuperAdminRole;
```

It must:

1. Require that V2 is not already initialized.
2. Require `genesisAttestor != address(0)`.
3. Calculate the one-leaf root:

```solidity
keccak256(abi.encodePacked(genesisAttestor))
```

4. Store:

```solidity
bridgeAttestorRoot = genesisLeaf;
bridgeAttestorEpoch = 0;
bridgeAttestorV2Initialized = true;
```

5. Emit:

```solidity
event BridgeAttestorSetInitialized(
    bytes32 indexed root,
    address indexed genesisAttestor
);
```

The first successful bridge certificate must advance from the single Genesis root to a different API-attestor root. Do not permit the bridge to remain permanently in one-signature Genesis mode.

## New bridge message structure

Use a canonical source-event identity rather than accepting a free-form `transferId`.

Add:

```solidity
struct BridgeMessage {
    uint256 srcChainID;

    // Canonical identifier of the bridge contract or bridge subsystem
    // on the source network. For an EVM source this can be the source
    // bridge address left-padded to bytes32.
    bytes32 sourceBridgeID;

    // Source transaction hash or equivalent source-ledger transaction ID.
    bytes32 sourceTxHash;

    // EVM log index, SuperGenius output index, or another canonical
    // event index within sourceTxHash.
    uint256 sourceEventIndex;

    address recipient;

    // Pre-fee GNUS amount. _mintWithBridgeFee applies the destination fee.
    uint256 amount;
}
```

Derive the replay key on-chain:

```solidity
bytes32 private constant BRIDGE_MESSAGE_ID_V2 =
    keccak256("GNUS_BRIDGE_MESSAGE_ID_V2");

function _bridgeMessageId(
    BridgeMessage calldata message
) internal pure returns (bytes32) {
    return keccak256(
        abi.encode(
            BRIDGE_MESSAGE_ID_V2,
            message.srcChainID,
            message.sourceBridgeID,
            message.sourceTxHash,
            message.sourceEventIndex
        )
    );
}
```

This permits two valid bridge events in the same transaction to remain distinct because their event indexes differ.

## Rolling-root behavior

Each certificate is verified against the root already stored in the contract.

The certificate also commits to `nextAttestorRoot`.

Rules:

```text
current root:
    always read from contract storage

signers:
    must be members of the current root

next root:
    signed by the current root's threshold
```

`nextAttestorRoot` may equal the current root after bootstrap. This means no rotation is needed for every bridge message.

If:

```text
nextAttestorRoot == current bridgeAttestorRoot
```

then:

```text
do not change the root
do not increment bridgeAttestorEpoch
```

This permits several bridge claims based on the same root to execute without forcing a strict global sequence.

If:

```text
nextAttestorRoot != current bridgeAttestorRoot
```

then:

```text
install nextAttestorRoot
increment bridgeAttestorEpoch by exactly one
```

At epoch zero, require:

```solidity
nextAttestorRoot != currentRoot
```

This forces the first Genesis-authorized certificate to leave one-signature bootstrap mode.

The new root may contain newly accepted API attestors. Those new attestors do not authorize the certificate that installs them. They become eligible to sign the following certificate.

## Certificate digest

Keep EIP-191 for compatibility with the current contract, but add an explicit protocol domain and bind the root transition.

Add:

```solidity
bytes32 private constant BRIDGE_CERTIFICATE_V2 =
    keccak256("GNUS_BRIDGE_CERTIFICATE_V2");
```

Implement:

```solidity
function _bridgeInDigestV2(
    BridgeMessage calldata message,
    bytes32 currentAttestorRoot,
    uint64 currentAttestorEpoch,
    bytes32 nextAttestorRoot
) internal view returns (bytes32) {
    bytes32 structHash = keccak256(
        abi.encode(
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
        )
    );

    return ECDSAUpgradeable.toEthSignedMessageHash(structHash);
}
```

The field order and Solidity types are part of the protocol. Document them and add fixed cross-language test vectors.

The signatures authorize all of the following together:

- The exact source event.
- The destination chain.
- The destination diamond.
- The recipient.
- The GNUS token ID.
- The pre-fee amount.
- The current attestor root and epoch.
- The optional next attestor root.

## Certificate verification

Replace `_verifyThresholdCertificate` with a helper that accepts the current root and current epoch-derived threshold:

```solidity
function _verifyBridgeAttestorCertificate(
    bytes32 digest,
    bytes32 currentRoot,
    uint256 requiredSignatures,
    bytes[] calldata signatures,
    bytes32[][] calldata merkleProofs
) internal view;
```

Requirements:

```solidity
require(signatures.length == merkleProofs.length, ...);
require(signatures.length >= requiredSignatures, ...);
require(signatures.length <= MAX_ATTESTOR_SIGNATURES, ...);
```

For every signature:

1. Recover the EVM address with `ECDSAUpgradeable.tryRecover`.
2. Reject any recovery error.
3. Require recovered addresses to be strictly ascending.
4. Derive the leaf:

```solidity
bytes32 leaf = keccak256(abi.encodePacked(signer));
```

5. Verify the signer against `currentRoot`.
6. Require every supplied signature and proof to be valid.

Strict ascending order provides deterministic ordering and duplicate protection:

```solidity
require(signer > lastSigner, "Signers not strictly ascending");
```

Do not verify signers against `nextAttestorRoot`.

Do not count public-RPC-only validators.

Do not use validator consensus weights.

For this small set, keep individual proofs. Do not add an MMR or Merkle multiproof in this change.

## New `bridgeIn` interface

Implement approximately:

```solidity
function bridgeIn(
    BridgeMessage calldata message,
    bytes32 nextAttestorRoot,
    bytes[] calldata signatures,
    bytes32[][] calldata merkleProofs
) external;
```

Its execution order must be:

```solidity
function bridgeIn(
    BridgeMessage calldata message,
    bytes32 nextAttestorRoot,
    bytes[] calldata signatures,
    bytes32[][] calldata merkleProofs
) external {
    // 1. Pause and initialization checks.
    require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused");

    GNUSBridgeValidatorStorage.Layout storage v =
        GNUSBridgeValidatorStorage.layout();

    require(v.bridgeAttestorV2Initialized, "Bridge attestor V2 not initialized");

    // 2. Basic destination and message checks.
    require(
        block.chainid == GNUSControlStorage.layout().chainID,
        "Wrong destination chain"
    );
    require(message.srcChainID != block.chainid, "Cannot bridge from same chain");
    require(message.sourceBridgeID != bytes32(0), "Invalid source bridge");
    require(message.sourceTxHash != bytes32(0), "Invalid source transaction");
    require(message.recipient != address(0), "Invalid recipient");
    require(message.amount > 0, "Invalid amount");
    require(nextAttestorRoot != bytes32(0), "Invalid next attestor root");

    bytes32 messageId = _bridgeMessageId(message);

    // 3. Replay check.
    require(!v.processedMessages[messageId], "Message already processed");

    bytes32 currentRoot = v.bridgeAttestorRoot;
    uint64 currentEpoch = v.bridgeAttestorEpoch;

    require(currentRoot != bytes32(0), "Bridge attestor root not configured");

    // Genesis mode must end with the first successful bridge certificate.
    if (currentEpoch == 0) {
        require(
            nextAttestorRoot != currentRoot,
            "Genesis certificate must install API attestors"
        );
    }

    // 4. Create exact signed digest.
    bytes32 digest = _bridgeInDigestV2(
        message,
        currentRoot,
        currentEpoch,
        nextAttestorRoot
    );

    // 5. Verify current/previous API attestors.
    _verifyBridgeAttestorCertificate(
        digest,
        currentRoot,
        _bridgeAttestorThreshold(currentEpoch),
        signatures,
        merkleProofs
    );

    // 6. Effects before mint.
    v.processedMessages[messageId] = true;

    if (nextAttestorRoot != currentRoot) {
        v.bridgeAttestorRoot = nextAttestorRoot;
        v.bridgeAttestorEpoch = currentEpoch + 1;

        emit BridgeAttestorSetAdvanced(
            currentEpoch,
            currentEpoch + 1,
            currentRoot,
            nextAttestorRoot
        );
    }

    // 7. Existing fee, cap, chain-supply and mint behavior.
    _mintWithBridgeFee(
        message.recipient,
        GNUS_TOKEN_ID,
        message.amount
    );

    // 8. Emit release event using the canonical source-event message ID.
    emit BridgeReleased(
        messageId,
        message.recipient,
        message.amount,
        message.srcChainID,
        block.chainid
    );
}
```

Add:

```solidity
event BridgeAttestorSetAdvanced(
    uint64 indexed oldEpoch,
    uint64 indexed newEpoch,
    bytes32 indexed oldRoot,
    bytes32 newRoot
);
```

Root update and replay marking occur before mint. If minting reverts, all state changes revert as part of the transaction.

## Legacy function removal

The existing function selector is:

```solidity
bridgeIn(
    bytes32,
    uint256,
    address,
    uint256,
    bytes[],
    bytes32[][]
)
```

The diamond upgrade must remove this legacy selector or replace it with a function that always reverts.

Do not leave the old `bridgeIn` callable alongside V2. It would bypass the rolling API-attestor design.

The current `setValidatorSet()` routine setter must also stop acting as the normal root-update path.

Either:

1. Remove its selector during the diamond upgrade; or
2. Change it into an explicitly named emergency recovery operation.

An emergency recovery function must:

- Require the contract to be paused.
- Require `onlySuperAdminRole`.
- Require a nonzero new root.
- Never restore one-signature Genesis mode after bootstrap.
- Increment the attestor epoch.
- Emit a clear emergency-reset event.

Do not let the Super Admin silently rotate the normal root while the bridge is unpaused.

## SuperGenius root construction

The SuperGenius bridge exporter must construct `nextAttestorRoot` from the approved API-attestor policy.

At minimum:

```text
eligible for next root =
    valid node signature
    AND actual successful slot-0/API verification
    AND finalized certificate
    AND not suspended or revoked
```

Public-RPC-only success can contribute to native SuperGenius validation, but those nodes must not appear in the EVM bridge-attestor root.

Use a deterministic Merkle-tree format:

```text
leaf = keccak256(abi.encodePacked(evmAddress))
leaves sorted by address
pairs hashed using the same sorted-pair convention as
MerkleProofUpgradeable.verify
```

For the Genesis one-leaf tree:

```text
root = leaf
```

Do not make the next root consist of only whichever two nodes happened to answer fastest unless that is the explicit policy. Prefer a rolling set of recently successful API-backed attestors so ordinary downtime does not collapse the root to two addresses.

## Tests

Add tests covering all of the following.

### Bootstrap

- [ ] Initialization accepts one nonzero Genesis attestor.
- [ ] Initialization cannot run twice.
- [ ] Epoch zero accepts one valid Genesis signature.
- [ ] Epoch zero rejects zero signatures.
- [ ] Epoch zero rejects a certificate that keeps the Genesis root unchanged.
- [ ] First valid certificate installs a different API-attestor root.
- [ ] After the first transition, one signature is no longer enough.

### Current-root verification

- [ ] Two current-root API attestors can authorize a claim.
- [ ] A signer in `nextAttestorRoot` but not `currentRoot` cannot authorize the transition.
- [ ] A public-only or unknown validator cannot authorize a claim.
- [ ] Invalid signature fails.
- [ ] Invalid Merkle proof fails.
- [ ] Duplicate signer fails.
- [ ] Unsorted signers fail.
- [ ] More than `MAX_ATTESTOR_SIGNATURES` fails.

### Root transitions

- [ ] `nextRoot == currentRoot` processes a claim without incrementing the epoch.
- [ ] Multiple claims can execute against an unchanged root.
- [ ] A changed root increments the epoch exactly once.
- [ ] A certificate signed against an old root fails after rotation.
- [ ] Two competing rotations from the same old root cannot both succeed.
- [ ] Failed minting reverts the root update and replay marker.

### Replay and domain binding

- [ ] The same source event cannot execute twice.
- [ ] Two event indexes in the same source transaction produce different message IDs.
- [ ] Changing `sourceBridgeID` changes the message ID and digest.
- [ ] Changing the source chain changes the digest.
- [ ] Changing the recipient changes the digest.
- [ ] Changing the amount changes the digest.
- [ ] A certificate for another destination chain fails.
- [ ] A certificate for another diamond address fails.
- [ ] A signature over the native SuperGenius vote bytes fails.

### Existing token behavior

- [ ] Bridge fee remains applied to the pre-fee amount.
- [ ] Zero post-fee amount reverts.
- [ ] Global max supply remains enforced.
- [ ] `globalSupply` and destination `chainSupply` update correctly.
- [ ] `BridgeReleased` reports the pre-fee amount.
- [ ] Pause check occurs before certificate work.

### Cross-language vectors

Add fixed test vectors containing:

```text
Genesis or API private key
SuperGenius 64-byte public key
derived EVM address
current root
current epoch
next root
all BridgeMessage fields
raw ABI struct hash
EIP-191 digest
65-byte r || s || v signature
recovered EVM address
Merkle proof
```

The C++ exporter and Solidity test must calculate identical values.

## Non-goals

Do not add any of these in this task:

- MMR verification.
- ZK proofs.
- Full SuperGenius certificate decoding in Solidity.
- Consensus-weight calculations.
- Public-RPC validator registration.
- RPC URLs in Solidity.
- Per-validator reputation in Solidity.
- Admin-driven routine root rotation.
- Child-token bridge-in support.
- Changes to `_mintWithBridgeFee` except those strictly required for integration.

## Deliverables

Return:

1. The updated `GNUSBridge.sol`.
2. The append-only `GNUSBridgeValidatorStorage.sol` change.
3. All unit tests.
4. The diamond-cut instructions that remove the old `bridgeIn` selector and add the new one.
5. The exact ABI and digest specification for the SuperGenius exporter.
6. At least one complete C++/Solidity signature test vector.
7. A brief security note explaining:
   - Genesis bootstrap.
   - Two-of-N API-attestor operation.
   - Root rotation.
   - Replay protection.
   - Why native `ConsensusVote.signature` cannot be used directly.
   - Why non-API nodes are excluded.

---

That gives you a very small on-chain model:

```text
stored:
    current API-attestor root
    root epoch
    processed source events

each bridgeIn:
    current API attestors sign exact claim
    current API attestors optionally approve next root
    contract verifies signatures and membership
    contract advances root if needed
    contract mints
```

No MMR, no five-million-node registry, and no attempt to reproduce SuperGenius consensus inside Solidity.



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)