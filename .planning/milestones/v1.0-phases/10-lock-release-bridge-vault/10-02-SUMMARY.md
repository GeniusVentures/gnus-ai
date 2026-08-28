---
phase: 10-lock-release-bridge-vault
plan: 02
subsystem: bridge
tags: [bridge, threshold-ecdsa, merkle-proof, replay-protection, diamond-upgrade]
dependency_graph:
  requires:
    - contracts/gnus-ai/GNUSBridgeValidatorStorage.sol
    - "@gnus.ai/contracts-upgradeable-diamond ECDSAUpgradeable"
    - "@gnus.ai/contracts-upgradeable-diamond MerkleProofUpgradeable"
  provides:
    - "GNUSBridge.bridgeIn(bytes32,uint256,address,uint256,bytes[],bytes32[][])"
    - "GNUSBridge.setValidatorSet(bytes32,uint256)"
    - "GNUSBridge.BridgeReleased event"
    - "GNUSBridge.ValidatorSetUpdated event"
    - "GNUSBridge 3.0 entry in geniusdiamond.config.json"
  affects:
    - Plan 10-03 (unit tests target bridgeIn / setValidatorSet)
    - Plan 10-04 (invariant tests assert replay + conservation across bridgeIn)
    - Phase 12 (in-flight accounting appends after the validator storage layout)
tech_stack:
  added: []
  patterns:
    - "Threshold-ECDSA certificate with strictly-ascending signer ordering (D-13)"
    - "Merkle-proof validator membership against a committed root (D-15)"
    - "EIP-191 wrapping via ECDSAUpgradeable.toEthSignedMessageHash (10-RESEARCH §Alternatives)"
    - "CEI ordering — processedMessages[transferId] set BEFORE _mintWithBridgeFee (Pitfall 2, T-10-12)"
    - "Explicit pause check as the first line of bridgeIn (D-20/D-21, Pitfall 4)"
key_files:
  created: []
  modified:
    - contracts/gnus-ai/GNUSBridge.sol
    - diamonds/GeniusDiamond/geniusdiamond.config.json
decisions:
  - "bridgeIn lives on the existing GNUSBridge facet (not a new facet) — 10-RESEARCH §Alternatives confirms ~6.4 KB headroom under EIP-170; final deployedBytecode is 21635 bytes (2941 headroom)"
  - "Digest binds transferId, srcChainID, block.chainid, address(this), recipient, GNUS_TOKEN_ID, amount via abi.encode, then EIP-191-wraps with toEthSignedMessageHash — wallet-compatible per RESEARCH §Alternatives, cross-chain (D-08) and cross-diamond replay protection"
  - "Merkle leaf is keccak256(abi.encodePacked(signer)) — 20-byte packed encoding per Pitfall 3 (NOT abi.encode which pads to 32); SG side must match"
  - "GNUS_TOKEN_ID hardcoded (D-14) — child-token bridge-in is mint-of-id-0 followed by GNUSTreasury convert; no tokenId parameter on bridgeIn"
  - "Explicit require(v.validatorThreshold > 0, 'Validator set not configured') placed BEFORE the signatures.length >= threshold check (Pitfall 7) — without it, an unconfigured set would vacuously pass any certificate"
  - "setValidatorSet emits ValidatorSetUpdated BEFORE the write so the event captures the OLD root (matches D-18 multisig audit-trail expectations)"
  - "No deployInit/upgradeInit on the 3.0 entry — Phase 10 uses explicit setValidatorSet post-upgrade; magic defaults on security-critical parameters rejected per RESEARCH Pitfall 7"
metrics:
  duration_seconds: 236
  completed_date: "2026-08-17"
---

# Phase 10 Plan 02: bridgeIn Threshold-Certificate Execution + setValidatorSet Summary

**One-liner:** Destination-side bridge release path on GNUSBridge — permissionless `bridgeIn` gated by an EIP-191-wrapped threshold-ECDSA certificate with merkle-proof validator membership, CEI-ordered replay protection, and routing through `_mintWithBridgeFee` for fee/cap/chainSupply accounting — plus a Super-Admin-only `setValidatorSet` rotation entry point and the GNUSBridge 3.0 diamond config entry.

## What Was Built

### Task 1 — `contracts/gnus-ai/GNUSBridge.sol` (+175 lines)

**Imports** (3 new): `ECDSAUpgradeable.sol`, `MerkleProofUpgradeable.sol`, `./GNUSBridgeValidatorStorage.sol`.

**Events** (2 new, follow `BridgeOutInitiated` shape):
- `BridgeReleased(bytes32 indexed transferId, address indexed recipient, uint256 amount, uint256 srcChainID, uint256 destChainID)` — `amount` is PRE-FEE, matching `BridgeOutInitiated` semantics.
- `ValidatorSetUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot, uint256 newThreshold)`.

**Digest builder** — `_bridgeInDigest(transferId, srcChainID, recipient, amount) internal view returns (bytes32)`:
- `structHash = keccak256(abi.encode(transferId, srcChainID, block.chainid, address(this), recipient, GNUS_TOKEN_ID, amount))` — D-08/D-10 load-bearing field order; `block.chainid` is destChainID; `address(this)` binds the diamond.
- Returns `ECDSAUpgradeable.toEthSignedMessageHash(structHash)` (EIP-191).

**Threshold verifier** — `_verifyThresholdCertificate(digest, signatures, merkleProofs) internal view returns (uint256 validCount)` implementing RESEARCH §Pattern 2:
1. `signatures.length == merkleProofs.length` check.
2. Explicit `validatorThreshold > 0` guard placed BEFORE the `signatures.length >= validatorThreshold` check (Pitfall 7 — unconfigured set must reject, not vacuously pass).
3. Per-signature loop: `tryRecover` (rejects malleable sigs via low-s + v∈{27,28} per T-10-01), strictly-ascending signer ordering (D-13 duplicate protection), merkle membership against `validatorMerkleRoot` (D-15), `unchecked { ++validCount; }`.

**`bridgeIn` external** — exact six-parameter signature; body in load-bearing order:
1. `require(!paused, "GNUSControl: contract paused")` — FIRST line (Pitfall 4; exact string matches Phase 5 grep tests).
2. Replay guard on `processedMessages[transferId]` (D-07).
3. `block.chainid == chainID` (D-08 cross-chain) + `srcChainID != block.chainid` (no self-bridge).
4. `recipient != address(0)` + `amount > 0`.
5. Digest + threshold-certificate verification.
6. `v.processedMessages[transferId] = true;` — BEFORE the mint (CEI, Pitfall 2, T-10-12).
7. `_mintWithBridgeFee(recipient, GNUS_TOKEN_ID, amount)` — D-22 fee/cap/chainSupply all apply; `GNUS_TOKEN_ID` hardcoded per D-14.
8. `emit BridgeReleased(...)` with PRE-FEE `amount`.

**`setValidatorSet` external** — `onlySuperAdminRole`; requires `newRoot != 0` and `newThreshold > 0`; emits `ValidatorSetUpdated(oldRoot, newRoot, newThreshold)` BEFORE the write so the event captures the OLD root.

**No new modifiers, no custom errors, no `error Foo();` declarations, no `hardhat/console.sol`** — all per 10-PATTERNS.md §Shared Patterns.

### Task 2 — `diamonds/GeniusDiamond/geniusdiamond.config.json` (+3 lines)

Added `"3.0": { "fromVersions": [0.0, 2.4, 2.5, 2.6] }` under `GNUSBridge.versions`. No `deployInit` / `upgradeInit` — Phase 10 uses explicit `setValidatorSet` post-upgrade (RESEARCH Pitfall 7: explicit configuration beats magic defaults for security-critical parameters). All other facet blocks unchanged.

## Commits

| # | Scope | Hash | Message |
|---|-------|------|---------|
| 1 | `contracts/gnus-ai` submodule | `b58bb1a` | feat(10-02): add bridgeIn threshold-certificate execution + setValidatorSet |
| 1 | main tree pin | `5773ca1` | chore(10-02): bump contracts/gnus-ai submodule — bridgeIn threshold-certificate execution + setValidatorSet |
| 2 | `diamonds/GeniusDiamond` submodule | `7b18679` | chore(10-02): bump GNUSBridge to version 3.0 in diamond config |
| 2 | main tree pin | `e8344e8` | chore(10-02): bump diamonds/GeniusDiamond submodule — GNUSBridge 3.0 version entry |

## Verification Results

### Task 1 acceptance criteria

| Check | Result |
|---|---|
| `npx hardhat compile` succeeds | PASS (`Compiled 4 Solidity files successfully (evm target: paris)`) |
| `function bridgeIn(` with six params in order | PASS |
| `function setValidatorSet(bytes32, uint256) external onlySuperAdminRole` | PASS |
| `event BridgeReleased(...)` | PASS |
| `event ValidatorSetUpdated(...)` | PASS |
| First `require` inside `bridgeIn` is `"GNUSControl: contract paused"` | PASS (line 1 of body) |
| `v.processedMessages[transferId] = true;` BEFORE `_mintWithBridgeFee(...)` | PASS (CEI ordering) |
| `_mintWithBridgeFee(recipient, GNUS_TOKEN_ID, amount)` — no direct `_mint` | PASS |
| Digest includes `address(this)` and `block.chainid` (D-08) | PASS |
| EIP-191 wrap via `ECDSAUpgradeable.toEthSignedMessageHash` | PASS |
| Merkle leaf uses `abi.encodePacked(signer)` (NOT `abi.encode`) | PASS |
| Signer ordering `signer > lastSigner` (strictly ascending, D-13) | PASS |
| Three new import lines present | PASS |
| No new modifiers / no custom errors / no `hardhat/console.sol` | PASS |
| `GNUSBridge` deployedBytecode < 24576 (EIP-170) | PASS — 21635 bytes, 2941 headroom |

### Task 2 acceptance criteria

| Check | Result |
|---|---|
| File parses as valid JSON | PASS |
| `GNUSBridge.versions` contains `"3.0"` | PASS |
| `"3.0".fromVersions == [0.0, 2.4, 2.5, 2.6]` (4 elements, numbers) | PASS |
| No `deployInit` / `upgradeInit` on `"3.0"` | PASS |
| All other facet blocks unchanged | PASS (diff is +3 lines in GNUSBridge block only) |

### Plan-level verification

- `npx hardhat compile` clean (post-commit re-verification: `Nothing to compile`).
- EIP-170: 21635 / 24576 bytes (2941 headroom).
- Diamond config parses and includes the 3.0 entry.
- Behavioral verification (signature round-trip, replay revert, pause revert, below-threshold revert, etc.) is delegated to Plan 10-03 unit tests and Plan 10-04 invariant tests per the plan.

## Deviations from Plan

None — plan executed exactly as written. All Step A–F placement, revert strings, ordering, and naming follow 10-PATTERNS.md §"GNUSBridge.sol (MODIFY)" and the Task 1 action spec verbatim.

## Auth Gates

None encountered.

## Known Stubs

None. The plan ships production code only; behavioral assertions live in Plans 10-03 and 10-04 as designed.

## Threat Flags

None. All new attack surface introduced by this plan is already enumerated in the plan's `<threat_model>` (T-10-01 through T-10-15, T-10-SC). No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond that register.

## Self-Check: PASSED

- `contracts/gnus-ai/GNUSBridge.sol` exists on disk with `bridgeIn`, `setValidatorSet`, `BridgeReleased`, `ValidatorSetUpdated`, `_bridgeInDigest`, `_verifyThresholdCertificate` (verified via grep in Task 1 acceptance).
- `diamonds/GeniusDiamond/geniusdiamond.config.json` exists with the `"3.0"` entry (verified via node parse in Task 2 acceptance).
- Submodule commit `b58bb1a` exists: `git -C contracts/gnus-ai log --oneline -1` → `b58bb1a feat(10-02): add bridgeIn threshold-certificate execution + setValidatorSet`.
- Main-tree commit `5773ca1` exists: `git log --oneline -3` shows `chore(10-02): bump contracts/gnus-ai submodule`.
- Submodule commit `7b18679` exists: `git -C diamonds/GeniusDiamond log --oneline -1` → `7b18679 chore(10-02): bump GNUSBridge to version 3.0 in diamond config`.
- Main-tree commit `e8344e8` exists: `git log --oneline -1` → `e8344e8 chore(10-02): bump diamonds/GeniusDiamond submodule`.
- Compilation verified clean post-commit.

## Next Steps

Plan 10-03 (unit tests for `bridgeIn` / `setValidatorSet` against the threshold certificate and merkle proof machinery) can now proceed. Plan 10-04 (Foundry invariant tests asserting replay protection and conservation across `bridgeOut`/`bridgeIn`) depends on 10-03.
