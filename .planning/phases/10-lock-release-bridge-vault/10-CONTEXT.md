# Phase 10: Lock/Release Bridge Vault - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the destination-side bridge execution path (bridge-in) on the GNUS.AI diamond, plus source-side bridge-out hardening, using the **provenance relocation** model — not escrow, not vault custody. Bridge-out removes tokens from the source chain's provenance attribution; bridge-in adds them to the destination chain's attribution. Global `totalSupplyOfAll()` is invariant under bridging and moves only on true mint/burn-to-zero.

This phase replaces the "lock in vault" framing in ROADMAP.md with the Phase-9-native provenance model, adds the destination execution path (`bridgeIn`), and lands the SuperGenius-mediated authorization layer.
</domain>

<decisions>
## Implementation Decisions

### Provenance Relocation (not Escrow / Vault)
- **D-01:** No vault, no escrow, no lock-then-release custody. Bridging is pure provenance relocation between chains. The destination chain's bridge-in mint is the `+` side; source-side bridge-out burn is the `-` side on that chain only. Global supply is untouched by bridging.
- **D-02:** Per-chain `chainSupply[chainid]` tracks attribution/partition; `totalSupplyOfAll()` (Phase 9 `globalSupply`) is the invariant and never moves during a bridge, even while a message is in-flight.
- **D-03:** Source-side sufficiency check: the source chain must hold the tokens/provenance it is relocating. The existing `balanceOf(sender, id) >= amount` check in `bridgeOut` already enforces this; no additional vault-balance check is needed.

### State Machine and Replay Protection
- **D-04:** Transfer state machine is `NONE → INITIATED → RELEASED`. `LOCK_CONFIRMED` has no meaning in the provenance-relocation model and is dropped.
- **D-05:** No `CANCELLED`/`EXPIRED` branch. The eventual-consistency stance ("who cares if the message arrives late?") is sufficient. In-flight is a first-class concept only insofar as Phase 12's cross-chain ledger tracks `pendingOutbound`/`pendingInbound`; the state machine itself does not expire or cancel.
- **D-06:** Canonical `transferId` = the source-chain burn transaction hash (keccak of the source EVM tx). This matches the SG-side identity scheme (`/bridge/executed/{chainid}:{tx_hash}`) and keeps the two systems aligned.
- **D-07:** Replay protection is enforced on the diamond: `mapping(bytes32 => bool) processedMessages`, set exactly once on successful `bridgeIn`. `require(!processedMessages[transferId])` at the top.
- **D-08:** The digest the validators sign commits to `transferId`, `srcChainID`, `destChainID`, `address(diamond)`, `recipient`, `tokenId`, and `amount`. This prevents cross-chain, cross-diamond, and cross-recipient replay.

### Bridge-In Authorization — Threshold ECDSA Certificate
- **D-09:** Bridge-in is authorized by a threshold ECDSA certificate from trusted SuperGenius validators, verified on-chain by the diamond. No trusted relay address is required for authorization; anyone may submit the transaction (permissionless relay).
- **D-10:** Validators sign an EVM-compatible digest: `keccak256(abi.encode(transferId, srcChainID, destChainID, address(diamond), recipient, tokenId, amount))`. Signatures are standard secp256k1 `r‖s‖v` (EIP-191 or raw-digest) so the diamond can use `ecrecover`.
- **D-11:** The SG consensus envelope (double-SHA256, little-endian scalars, no recovery ID) is **not** used on-chain. SG's aggregator produces a purpose-built EVM envelope after slot quorum is reached. This is net-new SG-side work but is cheaper and more robust than trying to verify SG-native certificates on-chain.
- **D-12:** On-chain threshold: `m-of-n` over a diamond-registered validator set (e.g., 2/3 + 1 of registered validators). SG's >3/4 slot-weighted quorum remains off-chain; the on-chain threshold is the attestation floor.
- **D-13:** Signatures must be submitted sorted ascending by recovered signer address, with strictly ascending addresses required (duplicate-proof). The diamond recovers each signer and checks membership in the registered set.
- **D-14:** `tokenId` must be `GNUS_TOKEN_ID` (0) on bridge-in. Child-token bridge-in is effected as a mint of id 0 followed by `convert` via GNUSTreasury, per Phase 9 D10.

### Validator Set Management
- **D-15:** For now, use option (b): the diamond stores a threshold plus a merkle root (or equivalent commitment) of the authorized validator set. Rotation is less frequent than per-validator admin calls.
- **D-16:** The exact mechanism for how the EVM chain learns the current SG validator set is **deliberately deferred**. SG's `ValidatorRegistry` is CRDT-driven, weight-based, and open (anyone can be a validator). A future decision will determine the fastest/most secure way to export the current set to the diamond. Until then, a manually-updated merkle root is acceptable.
- **D-17:** SG validator keys are derived from Ethereum private keys (`GenerateGeniusAddress` uses `EthereumKeyGenerator` over secp256k1), so the same keypair can sign both SG-native consensus messages and EVM-compatible digests. This makes the threshold-ECDSA certificate practical without a separate key registry.

### Interim / Progressive Authorization (per user 2026-08-17)
- **D-18:** For the current phase, a manual path is acceptable: Super Admin multisig can execute bridge-in directly, or an automatic relayer can operate on testnets (e.g., Sepolia) while mainnets require Super Admin approval.
- **D-19:** Longer-term, an amount-based two-tier policy is desired: bridge-in amounts `<= 100 GNUS per 24 hours` may be automatic (relay-executed with the certificate), while amounts `>= 100 GNUS in 24 hours` require Super Admin release. This tiered policy is **deferred to a later phase** and is not required for Phase 10 completion, but the design should not preclude it.

### Emergency Pause
- **D-20:** Both `bridgeOut` and `bridgeIn` must be pausable by Super Admin (or a designated guardian role). Pause blocks new initiations and new releases.
- **D-21:** Pause semantics are strict: when paused, `bridgeIn` reverts even if a valid certificate exists. The certificate remains valid and can be submitted after unpause; no expiration is introduced in this phase.

### Fee and Cap Integration
- **D-22:** Bridge-in mint routes through `_mintWithBridgeFee`, so the existing bridge fee, global cap check (`globalSupply + amount <= GNUS_MAX_SUPPLY`), and `chainSupply[block.chainid] += amount` hook all apply automatically.

### Claude's Discretion
- Exact function names for `bridgeIn` and any helper views (e.g., `isValidator`, `getValidatorThreshold`) are left to the planner.
- Whether the validator commitment is a simple `mapping(address => bool)` plus threshold, or a merkle root, is left to the planner unless gas or upgradeability concerns force a choice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 9 provenance model
- `.planning/phases/09-per-child-gnus-treasury-reserve/09-CONTEXT.md` — B1 provenance mechanism, D8 per-chain supply, D9 global cap, D10 MINTER restriction to id 0.
- `contracts/gnus-ai/GNUSBridge.sol` — current `bridgeOut` implementation, `_mintWithBridgeFee`, `burn`, limiter hooks.
- `contracts/gnus-ai/GNUSTreasuryStorage.sol` — `globalSupply`, `chainSupply`, `ownChainId` layout.

### SuperGenius bridge / consensus
- `../SuperGenius/src/blockchain/Consensus.hpp` — `ConsensusManager::CreateCertificate`, `IsBridgeMintSubject`, slot-quorum rules.
- `../SuperGenius/src/blockchain/impl/proto/Consensus.proto` — `ConsensusCertificate`, `ConsensusVote`, `NonceSubject`, `MintTxV2` fields.
- `../SuperGenius/src/account/BridgeRelayer.hpp` — event watch and ingestion of `BridgeOutInitiated` / `BridgeSourceBurned`.
- `../SuperGenius/src/account/TransactionManager.cpp` — `MintFunds`, `OnConsensusCertificate`, `/bridge/executed/{chainid}:{tx_hash}` replay protection.
- `../SuperGenius/src/account/GeniusAccount.cpp` — `GenerateGeniusAddress` (SG keys derived from Ethereum private keys) and `VerifySignature` (SG-native envelope).

### Roadmap and requirements
- `.planning/ROADMAP.md` §Phase 10 — original lock/release framing; this context supersedes the vault mechanism but preserves the state-machine, replay-protection, and per-chain-check goals.
- `.planning/REQUIREMENTS.md` — BRIDGE-02, BRIDGE-03, BRIDGE-04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GNUSBridge.sol::_mintWithBridgeFee` — already applies bridge fee, global cap check, and per-chain supply accounting; `bridgeIn` should call this.
- `GNUSBridge.sol::bridgeOut` — already performs sufficiency check (`balanceOf`), same-chain guard, non-zero destination key, limiter charge for child tokens, and burn. No vault logic to remove.
- `GNUSTreasuryStorage.Layout::chainSupply` and `ownChainId` — added by Phase 9 redesign; ready for attribution tracking.
- `GeniusAccessControl` / `MINTER_ROLE` — role infrastructure for minter and admin roles.

### Established Patterns
- Diamond storage pattern via `LibDiamond.diamondStorage()` and per-facet storage libraries.
- Role-based access control (`onlyRole(MINTER_ROLE)`) for mint/burn.
- Bridge fee in thousandths with `FEE_DENOMINATOR = 1000` and cap at `GNUSControl.MAX_FEE`.

### Integration Points
- `bridgeIn` will live in `GNUSBridge.sol` (or a new facet if the planner prefers separation).
- Validator set storage should use a new storage library (e.g., `GNUSBridgeValidatorStorage.sol`) to avoid colliding with existing facet layouts.
- Phase 12 will consume in-flight state for `pendingOutbound`/`pendingInbound`; the `INITIATED` state and `processedMessages` mapping are the hooks.

</code_context>

<specifics>
## Specific Ideas

- User explicitly rejected the escrow/vault-float model: "bridgeOut shouldn't escrow anything... it will just remove them from its own provenance supply and put them into the destination chains supply... Total Supply for all chain will be the same."
- User confirmed the state machine should drop `LOCK_CONFIRMED`: "no lock_confirmed has no meaning any more."
- User wants the ability to run manual bridge-in via Super Admin multisig now, with automatic relay on testnets and a future amount-based auto/manual split (<=100 GNUS / 24h automatic; >=100 GNUS / 24h Super Admin release).

</specifics>

<deferred>
## Deferred Ideas

- **Amount-based two-tier bridge-in authorization** (<=100 GNUS per 24h automatic, >=100 GNUS per 24h Super Admin release) — future phase, not required for Phase 10.
- **Optimal validator-set export mechanism** — how the EVM chain learns the current SG validator set (merkle root update frequency, who pays for updates, whether to use a light-client proof vs. governance multisig) is deferred pending further research.
- **SG-native certificate verification on-chain** — verifying the double-SHA256/little-endian SG envelope directly on-chain was rejected for this phase; a future phase could add it if BLS or a keccak-based aggregate scheme is adopted.
- **Bridge-out-of-SuperGenius (SG → EVM)** — the SG side currently has no burn transaction type or EVM write path. The EVM-side `bridgeIn` designed here is ready to receive it, but the SG-side outbound leg is SuperGenius-repo work.
- **Direct EVM ↔ EVM bridging without SG mediation** — currently not supported by SG architecture; all cross-chain transfers are SG-mediated.

</deferred>

---

*Phase: 10-lock-release-bridge-vault*
*Context gathered: 2026-08-17*
