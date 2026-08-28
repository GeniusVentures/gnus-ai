# Phase 10: Lock/Release Bridge Vault - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 10-lock-release-bridge-vault
**Areas discussed:** Provenance relocation vs escrow/vault, bridge-in authorization model, state machine depth, validator set management, emergency pause, interim authorization policy

---

## Provenance Relocation vs Escrow/Vault

| Option | Description | Selected |
|--------|-------------|----------|
| Lock/Release vault | Tokens locked in vault on source, released on destination | |
| Burn/Mint provenance relocation | Source burns, destination mints; global supply invariant | ✓ |
| Hybrid escrow-float | Vault holds float for liquidity, mint/burn for net settlement | |

**User's choice:** Burn/Mint provenance relocation
**Notes:** User explicitly rejected vault custody: "bridgeOut shouldn't escrow anything... it will just remove them from its own provenance supply and put them into the destination chains supply... Total Supply for all chain will be the same." This aligns with Phase 9's B1 model.

---

## Bridge-In Authorization Model

| Option | Description | Selected |
|--------|-------------|----------|
| On-chain SG certificate verification | Diamond verifies SG-native consensus certificate directly | |
| Trusted relay address | Diamond trusts a single relay address; SG consensus happens off-chain | |
| Threshold ECDSA certificate | Validators sign EVM-compatible digest; diamond verifies m-of-n threshold | ✓ |

**User's choice:** Threshold ECDSA certificate
**Notes:** Research showed SG-native certificates use double-SHA256/little-endian secp256k1 without recovery IDs — not ecrecover-compatible. However, SG validator keys are derived from Ethereum private keys, so validators can produce standard EVM signatures. The threshold ECDSA approach avoids a single trusted relay while keeping on-chain verification cheap.

---

## State Machine Depth

| Option | Description | Selected |
|--------|-------------|----------|
| NONE → LOCK_CONFIRMED → RELEASED | Roadmap's original three-state machine | |
| NONE → INITIATED → RELEASED | Two-state machine, no lock confirmation | ✓ |
| NONE → INITIATED → RELEASED / CANCELLED / EXPIRED | Adds cancel/timeout branches | |

**User's choice:** NONE → INITIATED → RELEASED
**Notes:** "no lock_confirmed has no meaning any more." User also confirmed no cancel/expire branch is needed — eventual consistency is sufficient.

---

## Validator Set Management

| Option | Description | Selected |
|--------|-------------|----------|
| Diamond stores full validator set | Admin-managed mapping, synced to SG ValidatorRegistry | |
| Diamond stores threshold + merkle root | Less frequent rotation, cheaper updates | ✓ |
| No on-chain set | Any N signatures accepted; weakest security | |

**User's choice:** Threshold + merkle root (option b) for now
**Notes:** "we built in a trusted crdt that allows changes to config, but anyone can be a validator, but there are, so maybe b for now, we can also delay this decision to find which is the faster more secure way for the EVM chain to know what validator set it can use."

---

## Emergency Pause

| Option | Description | Selected |
|--------|-------------|----------|
| Pausable bridgeOut only | Stop new initiations only | |
| Pausable bridgeIn only | Stop releases only | |
| Both pausable, strict | Pause blocks both initiation and release; certs remain valid | ✓ |
| Both pausable, lenient | Pause blocks new initiations but allows pending releases | |

**User's choice:** Both pausable, strict
**Notes:** "yes, for sure" on pausability. Strict semantics chosen — when paused, bridgeIn reverts even with valid certificate.

---

## Interim Authorization Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Fully automatic relay from day one | Certificate-only, no admin override | |
| Manual Super Admin only | All bridge-in requires multisig | |
| Hybrid: manual now, tiered later | Super Admin can bridge-in manually; testnet automatic; future amount-based split | ✓ |

**User's choice:** Hybrid: manual now, tiered later
**Notes:** "for now, we can just use the Super Admin multisig to bridge In manually or even keep it temporarily on a test net like sepolia automatic and on the mainnets a Super Admin call so we can verify transactions and eventually have a amount <= 100 GNUS per 24 hours is automatic, but >= 100 in 24 hours requires Super admin to release it."

---

## Claude's Discretion

- Exact function names for `bridgeIn` and validator-set helper views.
- Whether validator commitment is a simple mapping plus threshold or a full merkle root (planner decides based on gas and upgradeability).

## Deferred Ideas

- Amount-based two-tier bridge-in authorization (<=100 GNUS / 24h automatic; >=100 GNUS / 24h Super Admin release).
- Optimal validator-set export mechanism (merkle root update frequency, light-client proofs vs. governance multisig).
- SG-native certificate verification on-chain (would require BLS or keccak-based aggregate scheme).
- Bridge-out-of-SuperGenius (SG → EVM) — requires new SG-side burn transaction type and EVM write path.
- Direct EVM ↔ EVM bridging without SG mediation — not supported by current SG architecture.
