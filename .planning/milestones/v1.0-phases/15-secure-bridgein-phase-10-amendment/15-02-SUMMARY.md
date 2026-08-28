---
phase: 15-secure-bridgein-phase-10-amendment
plan: "02"
subsystem: bridge
tags: [diamond, eip-2535, solidity, bridge-in, attestor, ecdsa, merkle, cei, eip-170, selector-removal]

requires:
  - phase: 15-secure-bridgein-phase-10-amendment
    provides: GNUSBridgeValidatorStorage slots +3..+6, GNUSBridgeAttestor admin skeleton + constants (BRIDGE_MESSAGE_ID_V2 / BRIDGE_CERTIFICATE_V2), facet registration at priority 116
provides:
  - V2 certificate bridgeIn((uint256,bytes32,bytes32,uint256,address,uint256),bytes32,bytes[],bytes32[][]) [0x4d2e0756] on GNUSBridgeAttestor — BRIDGE-12..15
  - Canonical BridgeMessage struct + BRIDGE_MESSAGE_ID_V2 composite replay key reusing the slot-0 processedMessages mapping (D-07)
  - BRIDGE_CERTIFICATE_V2 split-encode digest (D-02) binding currentRoot/Epoch + nextAttestorRoot + dest-chain + diamond + recipient + GNUS_TOKEN_ID + amount
  - _verifyBridgeAttestorCertificate — sig/proof parity, epoch-derived threshold, 16-sig cap, strict-ascending signers, per-signer proofs vs currentRoot ONLY (T-15-08/T-15-10)
  - CEI bridgeIn ordering (D-07) — replay-mark + root/epoch transition strictly before the fee-mint; epoch-0 must-advance gate (Pitfall 5)
  - Inline _mintWithBridgeFee + _mint twin replicas with bidirectional cross-references (Pitfall 1)
  - Legacy bridgeIn [0x0bee6121] and setValidatorSet [0x1abd0f1e] fully removed from GNUSBridge source + ABI — BRIDGE-16, D-06
affects: [15-03 (Hardhat V2 matrix + vectors + legacy suite rewrite), 15-04 (Foundry handler/invariant rewrite + full-suite baseline gate)]

tech-stack:
  added: []
  patterns:
    - "Split-encode digest: keccak256(bytes.concat(abi.encode(g1), abi.encode(g2), abi.encode(g3))) byte-identical to the flat 13-field encode — 0.8.19 stack-limit workaround, pinned by BRIDGE-18 vectors (D-02)"
    - "CEI root-transition state machine: certificate effects (replay mark + root/epoch writes) strictly before the external-visible mint; reverting mint reverts the transition atomically"
    - "Twin-replica discipline for cross-facet economics: verbatim _mintWithBridgeFee/_mint copies with MUST-MIRROR comments in both files"
    - "Byte-identical event relocation: BridgeReleased re-declared in the attestor facet with the Phase-10 parameter name kept (topic0 preserved, rename is docs-only)"

key-files:
  created: []
  modified:
    - contracts/gnus-ai/GNUSBridgeAttestor.sol
    - contracts/gnus-ai/GNUSBridge.sol

key-decisions:
  - "Transfer event in the attestor facet is a LOCAL topic0-identical declaration (GNUSLicensingPurchase.sol:125-128 precedent) — Solidity 0.8.19 cannot emit through a non-inherited imported interface (qualified event access is 0.8.21+); the plan's 'import IERC20Upgradeable' wording is unimplementable at this compiler pin (Rule 3 deviation, semantics unchanged)"
  - "currentEpoch cached as uint256 (the storage type) and cast to uint64 only at the _bridgeInDigestV2 call site + event emissions — keeps the epoch+1 transition and threshold derivation in storage-width arithmetic; the uint64 truncation domain is unreachable (one increment per certificate)"
  - "bridgeIn carries NO D-24 policy gate and NO limiter charge by design: it mints GNUS_TOKEN_ID only (the Phase-13 predicate's carve-out) and bridge-in never charged the withdrawal limiter (bridgeOut-only) — the D-07 carry-forward is satisfied by Task 2's byte-for-byte preservation of bridgeOut/_enforceBridgePolicy"
  - "Verifier drops the legacy 'Validator set not configured' pre-check in favor of the epoch-derived threshold path: bridgeIn's bridgeAttestorV2Initialized + currentRoot != 0 gates close the same vacuous-acceptance hole (Pitfall 7 analogue) before _verifyBridgeAttestorCertificate runs, and _bridgeAttestorThreshold zero-guards its own fallback"

patterns-established:
  - "Split-encode as the house style for >10-field domain-separated digests under 0.8.19 + no viaIR (do not flatten; field order is protocol)"
  - "Registry-diff selector removal: delete from source, recompile, let @geniusventures/diamonds emit the Remove cuts — never hand-write cut entries"

requirements-completed: [BRIDGE-12, BRIDGE-13, BRIDGE-14, BRIDGE-15, BRIDGE-16]

duration: 8min
completed: 2026-08-26
---

# Phase 15 Plan 02: V2 Certificate Path + Legacy Bridge-In Removal Summary

Implemented the V2 attestor certificate `bridgeIn` on `GNUSBridgeAttestor` (canonical `BridgeMessage` replay key, split-encode `BRIDGE_CERTIFICATE_V2` digest, per-signer Merkle verifier, CEI root/epoch transition before the fee-mint) and fully deleted the legacy bridge-in block from `GNUSBridge` — facet sizes 21,536 B / 19,938 B (the probe's exact prediction), V2 selector 0x4d2e0756 live on the diamond ABI, both legacy selectors gone from source and artifact.

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-26T23:00:25Z
- **Completed:** 2026-08-26T23:08:24Z
- **Tasks:** 2/2
- **Files modified:** 2 (0 created, 2 modified; no test files touched by design)

## Accomplishments

### Task 1 — V2 certificate path in GNUSBridgeAttestor (BRIDGE-12..15)

- File-scope `BridgeMessage` struct (six SPEC fields, per-field Doxygen) rendering the canonical tuple ABI type.
- `_bridgeMessageId`: keccak256 over (BRIDGE_MESSAGE_ID_V2, srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex) — feeds the reused slot-0 `processedMessages` mapping (D-07, no storage migration; domain separation keeps legacy keys collision-free).
- `_bridgeInDigestV2`: the locked D-02 split-encode — `keccak256(bytes.concat(abi.encode(cert-domain/epoch/root/nextRoot), abi.encode(4 message identity fields), abi.encode(chainid/diamond/recipient/tokenId/amount)))` wrapped by `toEthSignedMessageHash`. Compiled clean with production settings (0.8.19, optimizer 1000, no viaIR) — the research A4 frame-sensitivity check passed on the first compile.
- `_verifyBridgeAttestorCertificate`: sig/proof length parity, `signatures.length >= requiredSignatures`, `<= MAX_ATTESTOR_SIGNATURES` cap, `tryRecover` + NoError require, strictly-ascending recovered signers, 20-byte packed leaf (Pitfall 3), `MerkleProofUpgradeable.verify` against `currentRoot` ONLY (T-15-10: a rogue next-root attestor cannot authorize the installing certificate).
- `bridgeIn` per SPEC :476-567 steps (a)-(j) with named revert constants throughout: pause check FIRST → V2-init gate → dest/message validation (chainid/chainID match, cross-chain, five nonzero fields incl. nextAttestorRoot) → replay check → current root/epoch cache + root-configured gate + epoch-0 must-advance gate (Pitfall 5) → digest → verify → **effects before mint**: `v.processedMessages[messageId] = true`, then (only when next != current) root install + epoch+1 + `BridgeAttestorSetAdvanced` (unchanged root = no bump, no event) → inline `_mintWithBridgeFee` → `BridgeReleased`. Permissionless (D-09), GNUS_TOKEN_ID hardcoded (D-14).
- Inline twin replicas: `_mintWithBridgeFee` verbatim (fee math, WR-02/WR-04 guards, global cap + chainSupply, `_mint` + `Transfer`) and the receiver-hook-free `_mint` override — both with MUST-MIRROR cross-references naming the GNUSBridge twin (Pitfall 1, both directions).
- `BridgeReleased` re-declared in `IGNUSBridgeAttestorEvents` byte-identical to the Phase-10 signature (same topic0; the transferId→messageId rename is docs-only).

### Task 2 — Legacy block deletion from GNUSBridge (BRIDGE-16, D-06)

- Deleted: legacy `bridgeIn` (:445-487), `setValidatorSet` (:489-508), `_bridgeInDigest` (:367-397), `_verifyThresholdCertificate` (:399-443), the `BridgeReleased` and `ValidatorSetUpdated` event declarations (:68-102), and the now-dead `ECDSAUpgradeable`/`MerkleProofUpgradeable` imports (:7-8).
- git diff: 14 insertions / 182 deletions — every insertion is NatSpec (Phase-15 split header note + the `_mintWithBridgeFee` twin cross-reference). `_mintWithBridgeFee`, mint overloads, burn, `_mint`, `bridgeOut`, `_enforceBridgePolicy` (D-24 gate before limiter), the ERC-20 leg, and `supportsInterface` survive byte-for-byte.
- No config surgery: `geniusdiamond.config.json` untouched; the registry diff auto-emits Remove cuts on redeploy (nothing deployed carries the selectors — sepolia 2.5 predates them).

## Verification Results

| Check | Result |
|---|---|
| `yarn compile` (0.8.19, optimizer 1000, no viaIR) | clean both tasks; diamond ABI + typechain regenerated |
| GNUSBridgeAttestor deployedBytecode | 21,536 B (3,040 B under EIP-170; probe expected 21,461 B) |
| GNUSBridge deployedBytecode | 19,938 B (4,638 B under EIP-170) — exactly the research probe number |
| Facet ABI | bridgeIn(tuple,bytes32,bytes[],bytes32[][]), initializeBridgeAttestorV2, emergencyRecoverAttestorSet, setBridgeAttestorActiveThreshold all present; V2 selector computes to 0x4d2e0756 |
| Diamond ABI | exactly one bridgeIn entry — the V2 tuple form; setValidatorSet count 0; legacy signatures absent (would-be selectors 0x0bee6121 / 0x1abd0f1e computed and checked against the artifact) |
| CEI source ordering | grep + awk machine check: `processedMessages[messageId] = true` precedes `_mintWithBridgeFee(message.recipient` |
| GNUSBridgeAttestorUpgrade.test.ts (15-01 suite) | 10 passing (admin surface survived the extension) |
| GNUSBridgePolicy.test.ts (Task 2 gate) | 13 passing (bridgeOut + D-24 path undisturbed) |
| GNUSBridge.test.ts + GNUSBridgeEnhanced.test.ts + GNUSWithdrawLimiter.test.ts | 60 passing combined (untouched suites, no collateral regressions) |

**EXPECTED RED (per plan, NOT gated, NOT modified):** `test/unit/GNUSBridgeIn.test.ts` (removed selectors → typechain mismatches) and the Foundry Bridge/Conservation invariant setUp (raw `setValidatorSet` call fails). Rewrites are owned by Plans 15-03/15-04; the full-suite baseline gate runs at the end of 15-04.

## Commits

| Repo | Hash | Subject |
|---|---|---|
| contracts/gnus-ai (develop) | f932715 | feat(15-02): add V2 certificate bridgeIn path to GNUSBridgeAttestor (BRIDGE-12..15) |
| gnus-ai (develop) | ac18010 | chore(15-02): bump gnus-ai submodule — V2 certificate bridgeIn path (f932715) |
| contracts/gnus-ai (develop) | fbc38f8 | feat(15-02): remove legacy bridge-in block from GNUSBridge (BRIDGE-16, D-06) |
| gnus-ai (develop) | b5efa29 | chore(15-02): bump gnus-ai submodule — legacy bridge-in removal (fbc38f8) |

No branches created, no pushes, unsigned commits, no Co-Authored-By trailers. No test files modified. The TokenContracts super-repo pointer is not bumped (ship-time per plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Transfer event emission in GNUSBridgeAttestor**

- **Found during:** Task 1 (implementation of the `_mintWithBridgeFee` replica)
- **Issue:** The plan says "import IERC20Upgradeable for the Transfer event", but Solidity 0.8.19 cannot emit an event declared in a non-inherited imported interface — unqualified `emit Transfer(...)` does not resolve, and qualified event access (`emit IERC20Upgradeable.Transfer(...)`) is a 0.8.21+ feature. Inheriting the interface is not an option (it would require implementing the whole ERC-20 external surface on this facet).
- **Fix:** Declared the topic0-identical event locally in the facet — `event Transfer(address indexed from, address indexed to, uint256 value);` — the exact repo precedent from GNUSLicensingPurchase.sol:125-128, which documents the same compiler limitation.
- **Files modified:** contracts/gnus-ai/GNUSBridgeAttestor.sol only
- **Commit:** f932715

**2. [Process note] Plan `<output>` commit instruction skipped**

- The plan's output block asks for a `docs(15)` commit of `15-02-PLAN.md`, but that file was already committed at planning time (the Hardhat-root tree was clean at execution start). Nothing to commit; SUMMARY/state files are committed in the final docs commit instead.

No other deviations — the digest, verifier, bridgeIn ordering, replica bodies, and deletions executed exactly as written.

## Threat Model Coverage

All `mitigate` dispositions from the plan's STRIDE register are implemented in source: T-15-08 (13-field bound digest + strict-ascending + current-root membership, repo-pinned crypto only), T-15-09 (CEI — awk-machine-checked effects-before-mint ordering), T-15-10 (proofs vs currentRoot only), T-15-11 (V2 domain-separated replay key; legacy writer deleted), T-15-12 (epoch-0 must-advance gate + GENESIS threshold pin), T-15-13 (full source removal verified by artifact ABI diff; registry auto-Remove), T-15-14 (verbatim twin replicas + bidirectional cross-references; paired fee-path test lands in 15-03), T-15-16 (survivors byte-for-byte; policy suite 13 passing). T-15-15 remains `accept` per plan (16-sig cap bounds gas; rotation events emitted for monitors). Behavioral proof of the mitigations lands with the 15-03/15-04 test matrices as the plan schedules.

## Known Stubs

None — no placeholder values, no unwired data paths; both facets are complete production source.

## Threat Flags

None — no security-relevant surface beyond the plan's threat model.

## Self-Check: PASSED

Both modified artifact files exist on disk; all 4 commits verified present (2 in contracts/gnus-ai @ f932715/fbc38f8, 2 in the gnus-ai outer repo @ ac18010/b5efa29).
