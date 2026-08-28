---
phase: 15
title: Secure BridgeIn (Phase 10 Amendment)
status: locked
created: 2026-08-26
owners: khurley
---

# Phase 15 CONTEXT — Secure BridgeIn (Phase 10 Amendment)

**Source of truth:** `docs/Secure-BridgeIn.md` (SPEC) → PD-BR-1..8 (`.planning/intel/decisions.md`) → `BRIDGE-10..19` (REQUIREMENTS.md) → ROADMAP §Phase 15. Research: `15-RESEARCH.md` (0d43bd4, HIGH confidence). Patterns: `15-PATTERNS.md` (84aeb11).

## Phase Boundary

- **In scope:** rolling attestor root + epoch storage, one-time Genesis bootstrap, canonical `BridgeMessage` identity, `BRIDGE_CERTIFICATE_V2` digest, per-signer Merkle-proof certificate verification, new `bridgeIn` with CEI root transition, legacy-selector removal, `setValidatorSet` → emergency-recovery conversion, threshold-override setter, amended Hardhat/Foundry suites, checked-in EVM-side test vectors (BRIDGE-18).
- **Out of scope:** C++ SuperGenius exporter parity (SuperGenius repo; vectors define the contract side only), SuperGenius#363/#364 fixes (parallel, production-activation gate only), production activation itself.

## Amendment of Locked Phase 10 Decisions (explicit, verified not-deprecated 2026-08-26)

The six engaged decisions are live and shipped in `GNUSBridge.sol`; this phase explicitly supersedes/amends them. No silent drift.

| Phase 10 decision | Superseded by | Shape |
|---|---|---|
| D-06 (transferId = source tx hash) | PD-BR-3 / BRIDGE-12 | Canonical `BridgeMessage {srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex, recipient, amount}`; replay key = `keccak256(abi.encode(BRIDGE_MESSAGE_ID_V2, ...))`. SG-side `/bridge/executed/{chainid}:{tx_hash}` divergence accepted by SPEC. |
| D-08 + D-10 (7-field digest) | PD-BR-4 / BRIDGE-13 | `BRIDGE_CERTIFICATE_V2` domain + binds `currentAttestorRoot, currentAttestorEpoch, nextAttestorRoot`. Dest-chain + diamond-address binding preserved. |
| D-12 (operator-set m-of-n) | PD-BR-2 / D-03 below | Epoch-derived thresholds defaulting to SPEC constants, superAdmin-override bounded 2..16. |
| D-15 + D-16 (manual merkle root via setValidatorSet) | PD-BR-1/PD-BR-6 / BRIDGE-10/11/16 | Rolling attestor root rotated by certificates; `setValidatorSet` converted to emergency-recovery (D-05 below). |

**Carried forward unchanged:** D-01..D-05 (provenance relocation, chainSupply, state machine, eventual consistency), D-07 (processedMessages replay reuse), D-09 (permissionless relay), D-11 (SG envelope not used on-chain), D-13 (strict-ascending signers — extended by PD-BR-5 cap/proofs), D-14 (GNUS_TOKEN_ID-only bridgeIn), D-17 (shared secp256k1 keys), D-20/D-21 (pause semantics; emergency recovery REQUIRES paused), D-22 (`_mintWithBridgeFee` routing).

## Implementation Decisions

- **D-01 (facet strategy):** Sibling facet `GNUSBridgeAttestor` owns the new `bridgeIn` + attestor verification + admin functions. Probe-verified with production settings (0.8.19, optimizer 1000, no viaIR): all-in-one 25,772 B and library-split 24,723 B both exceed EIP-170; split = 19,938 B (GNUSBridge minus bridge-in) + 21,461 B (attestor) — multi-KB headroom. `_mintWithBridgeFee` is internal to GNUSBridge: replicate inline per the facet-split discipline (sibling facets never call each other). Priority: above GNUSBridge (115), no collisions — exact value to planner per `geniusdiamond.config.json` scan.
- **D-02 (digest encoding):** The SPEC's flat 13-field `abi.encode` fails compilation (stack-too-deep) in every facet shape; use the byte-identical `bytes.concat` split-encode (three partial groups, value-type fields only). Equivalence to the flat encoding is PROVEN by the BRIDGE-18 vectors — a vector that doesn't match kills the split.
- **D-03 (thresholds):** Defaults set at init: `GENESIS_ATTESTOR_THRESHOLD = 1` (epoch 0 only, immutable), `ACTIVE_ATTESTOR_THRESHOLD = 2`, `MAX_ATTESTOR_SIGNATURES = 16`. SuperAdmin setter may override the ACTIVE threshold within `2 <= newThreshold <= 16` — the floor structurally prevents recreating 1-of-N. Named constants only.
- **D-04 (Genesis bootstrap):** `initializeBridgeAttestorV2(address genesisAttestor)` — one-time (one-shot bool, GNUSTreasury `SetSeedSupply` pattern), arg-taking so it runs as a manual superAdmin call post-cut; NO config `deployInit`/`upgradeInit` (keeps the genesis address out of the repo). One-leaf root, epoch 0. First successful certificate MUST advance to a different root — epoch 0 cannot persist.
- **D-05 (emergency recovery):** `emergencyRecoverAttestorSet` converted from `setValidatorSet`: requires paused + `onlySuperAdminRole` + nonzero new root; always writes `epoch = oldEpoch + 1` (post-state can never be epoch 0 → Genesis structurally unrecoverable); emits emergency-reset event. Not a genesis path, not routine rotation.
- **D-06 (legacy removal):** Legacy `bridgeIn(bytes32,uint256,address,uint256,bytes[],bytes32[][])` and `setValidatorSet` are deleted from `GNUSBridge` source — full removal, not revert-stubs (nothing deployed has these selectors; sepolia 2.5 predates them). The diamonds registry diff emits Remove cuts automatically on redeploy. Selector IDs (computed): `bridgeIn` V2 `0x4d2e0756`, init `0x8c864f52`, threshold `0x604c3b10`, emergency `0x669588d5`.
- **D-07 (new bridgeIn ordering):** pause/init check → dest/message validation → replay check → digest → certificate verify → **replay-mark + root update BEFORE `_mintWithBridgeFee`** (CEI; failed mint reverts root update + replay marker). Root transition installs `nextAttestorRoot` + `epoch += 1` + `BridgeAttestorSetAdvanced`; unchanged root = no epoch bump. Phase 13 D-24 policy gate and limiter ordering (policy before limiter) carry into the new path unchanged.
- **D-08 (vectors, BRIDGE-18):** Fixed test vectors checked into the repo and run in CI — private key, 64-byte SG pubkey, EVM address, roots, epoch, BridgeMessage fields, struct hash, EIP-191 digest, 65-byte r‖s‖v signature, recovered address, Merkle proof. C++ exporter parity is the SuperGenius repo's job against these vectors.
- **D-09 (external deps):** SuperGenius#363 (OPEN) / #364 (CLOSED) are parallel work, NOT local blockers (owner ruling 2026-08-26). Production activation is gated on both closing (BRIDGE-17).
- **D-10 (test rewrites):** Legacy path lives in `GNUSBridgeIn.test.ts` (21 refs) + Foundry `GeniusDiamondHandler.sol` (`handler_bridgeIn`, selector string :450-460) + `BridgeInvariant`. Rewrite for the new surface; `bridgeOut`/D-24 policy tests untouched. BRIDGE-19 matrix per SPEC lines 657-727 extends the Phase 10 suite.
- **D-11 (storage, BRIDGE-10):** Append `bridgeAttestorRoot, bridgeAttestorEpoch, bridgeAttestorV2Initialized` (+ threshold-override field) to `GNUSBridgeValidatorStorage.Layout` — slots +3..+6; legacy `validatorMerkleRoot`/`validatorThreshold` preserved byte-for-byte, dead once active. Slot-probe upgrade test adapted from `GNUSLifecycleUpgrade.test.ts`.

## Constraints

protocolVersion stays **2.6** (new facet re-keys into `versions["2.6"]`; fromVersions [0.0, 2.4, 2.5] — never a 2.7 key). Solidity ^0.8.19; no viaIR; no delegatecall trampolines; append-only storage; named constants (no magic numbers/strings); EIP-170 ≤ 24,576 B per facet asserted in verify. Baselines: Hardhat **606 passing / 2 pending / 1 known-stale failing** (GNUSControlStorage chainID — never fix); Foundry 215/2/3 (known-stale Phase 08.1 setUp reverts).

## Deferred / Parallel

- C++ vector parity + exporter implementation (SuperGenius repo).
- Production activation (blocked on #363).
- Gas measurement for 16-signer certificates (research A1 — measure in the test matrix, ~150-250k assumed).
- Frame-sensitivity recompile check of the split-encode digest (research A4 — Wave 0 verify).
