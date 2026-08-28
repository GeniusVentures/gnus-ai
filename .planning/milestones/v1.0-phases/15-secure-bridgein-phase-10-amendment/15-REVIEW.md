---
phase: 15-secure-bridgein-phase-10-amendment
reviewed: 2026-08-27T00:32:02Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - contracts/gnus-ai/GNUSBridgeAttestor.sol
  - contracts/gnus-ai/GNUSBridge.sol
  - contracts/gnus-ai/GNUSBridgeValidatorStorage.sol
  - diamonds/GeniusDiamond/geniusdiamond.config.json
  - docs/Secure-BridgeIn-Exporter-ABI.md
  - test/fixtures/bridge-attestor-vectors.json
  - test/foundry/handlers/GeniusDiamondHandler.sol
  - test/foundry/invariant/BridgeInvariant.t.sol
  - test/foundry/invariant/ConservationInvariant.t.sol
  - test/unit/GNUSBridgeAttestorIn.test.ts
  - test/unit/GNUSBridgeAttestorUpgrade.test.ts
  - test/unit/GNUSBridgeIn.test.ts
  - test/utils/bridge-certificate.ts
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-27T00:32:02Z
**Depth:** standard (with cryptographic re-derivation of all vector/selector claims)
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 15 V2 bridge-in surface end to end: the `GNUSBridgeAttestor` facet (certificate `bridgeIn`, Genesis bootstrap, threshold override, emergency recovery), the storage append, the config wiring, the exporter ABI spec, the frozen BRIDGE-18 vectors, the Foundry handler/invariants, the three rewritten Hardhat suites, and the TS reference module.

Independently re-derived every load-bearing constant rather than trusting the docs: all nine documented selectors (V2 `0x4d2e0756`/`0x8c864f52`/`0x604c3b10`/`0x669588d5`, views `0xe1dee3b1`/`0x74980350`/`0xed8e3b94`, legacy `0x0bee6121`/`0x1abd0f1e`), both domain constants, both fixture roots, both structHashes, both EIP-191 digests, both messageIds, all signature recoveries, and both merkle proofs — every one MATCHES. The split-encode digest is byte-identical to the flat 13-field form (re-proven against the fixture). EIP-170 verified from compiled artifacts: `GNUSBridgeAttestor` 21,536 B, `GNUSBridge` 19,938 B (both ≤ 24,576). D-06 removal is clean — only doc references to the legacy selectors remain. The OZ v4.5 `tryRecover` used by the verifier rejects high-`s` and `v ∉ {27,28}`, so signature malleability is closed; duplicates are structurally impossible via the strict-ascending check; CEI ordering (replay mark + root transition before the fee-mint) is implemented exactly per D-07 and the twin `_mintWithBridgeFee`/`_mint` replicas are verbatim identical to `GNUSBridge`.

One Critical data defect: the frozen `active-root-claim` conformance vector records its two signers OUT of strictly-ascending address order, contradicting both the on-chain verifier and the exporter ABI doc's own §2.3 rule — the vector cannot round-trip on-chain as recorded, and the repo's tests never submit it, so CI cannot catch it. Three Warnings: the threshold override's effect on live verification is untested; the bridgeIn mint leg silently inherits the lifecycle `enforceMintGate` (sale window + per-wallet cap) with no carve-out or test; the TS reference module's header still points at the removed `GNUSBridge.sol::bridgeIn` and carries dead V1 exports.

## Critical Issues

### CR-01: Frozen vector `active-root-claim` signers are NOT in strictly-ascending address order — the vector cannot round-trip on-chain as recorded

**File:** `test/fixtures/bridge-attestor-vectors.json:89-113` (contradicting rule: `docs/Secure-BridgeIn-Exporter-ABI.md:149-151`)
**Issue:** The `active-root-claim` vector lists its signers as `attestor-1` (`0x335B5C68...`) followed by `attestor-2` (`0x16972DdF...`). Compared as integers, `0x335B... > 0x1697...`, so the recorded order is DESCENDING. The on-chain verifier (`GNUSBridgeAttestor.sol:364`, `require(signer > lastSigner, _ERR_NOT_ASCENDING)`) and the exporter ABI doc §2.3 ("Signatures MUST be submitted sorted strictly ascending by recovered address") both require ascending order. Verified computationally: `v1 signer ascending: false`.

Consequences:

1. A certificate assembled from the frozen vector in the recorded `signers` array order (the natural reading of BRIDGE-18's "The C++ exporter must reproduce every value byte-for-byte from the frozen inputs" — array order is the only submission order the fixture conveys) ALWAYS reverts with `"Signers not strictly ascending"`. The vector is a conformance contract for a certificate that is invalid as recorded.
2. This escaped the repo's own tests: the on-chain round-trip leg V3 (`GNUSBridgeAttestorIn.test.ts:509-558`) submits only vector 0 (`genesis-transition`, single signer — ordering vacuous). Vector 1 is never submitted anywhere, so nothing in CI enforces the ordering contract against the fixture.
3. The doc says "if this document and the facet ever disagree, the facet and the vectors win" — here the vectors disagree with BOTH the facet and the document's own §2.3, leaving the exporter implementer with no consistent source of truth for multi-signer ordering.

**Fix:** Reorder only `vectors[1].signers` so attestor-2 (`0x1697...`) precedes attestor-1 (`0x335B...`), moving each signer's `signature`/`merkleProof`/`recoveredAddress` entries with them. Do NOT touch the `attestorSet` array — leaf array order determines the tree structure, and reordering it would change the root `0x0391da16...` and invalidate every recorded root/proof. Signer order carries no digest input, so `messageId`/`structHash`/`eip191Digest`/signatures/proofs are all unchanged by the fix. Then add an on-chain round-trip leg for vector 1 (mirroring V3: bootstrap → genesis-transition via vector 0 → `active-root-claim` claim via vector 1) so CI permanently enforces fixture ordering against the verifier, and state the ordering invariant explicitly in the fixture `constants` block and doc §3.

## Warnings

### WR-01: The threshold override's effect on live certificate verification is never tested

**File:** `test/unit/GNUSBridgeAttestorUpgrade.test.ts:187-209` (facet under test: `contracts/gnus-ai/GNUSBridgeAttestor.sol:261-270`)
**Issue:** `setBridgeAttestorActiveThreshold` is tested only for its bounds (1 → floor revert, 17 → cap revert) and its raw slot write (+6 == 5). No test raises the active threshold and proves the verifier actually enforces it — e.g., threshold 3 with a 2-sig certificate reverting `"Below threshold"` and a 3-sig certificate passing. The zero-guard fallback (`_bridgeAttestorThreshold` returning `ACTIVE_ATTESTOR_THRESHOLD` when slot +6 reads 0) is also unexercised. A regression in which `_bridgeAttestorThreshold` ignores the stored override (or misfires the zero-guard) would pass the entire suite, since every verification test runs at the default 2 installed by init. This is the security-relevant parameter of the whole construction (the structural 1-of-N prevention).
**Fix:** Add a matrix row: after `transitionToActive()`, call `setBridgeAttestorActiveThreshold(3)`, submit a valid 2-of-3 certificate → expect `"Below threshold"`; submit 3-of-3 → expect `BridgeReleased`. Optionally a storage-probe row forcing slot +6 to 0 via `hardhat_setStorageAt` asserting `activeBridgeAttestorThreshold() == 2`.

### WR-02: bridgeIn's mint leg silently inherits `enforceMintGate` (sale window + per-wallet cap) with no carve-out, test, or accurate doc

**File:** `contracts/gnus-ai/GNUSBridgeAttestor.sol:460-463, 522` (gate: `contracts/gnus-ai/GNUSERC1155MaxSupply.sol:120-122` → `contracts/gnus-ai/GNUSLifecyclePolicy.sol:61-105`)
**Issue:** The `bridgeIn` natspec states "No D-24 policy gate and no limiter charge on this path by design" — accurate for the transfer-policy predicate (`enforceTransferPolicy` carves out `GNUS_TOKEN_ID`) and the limiter (mint branch skips it). But `_mintWithBridgeFee` → `_mint` → `_beforeTokenTransfer` also runs `GNUSLifecyclePolicy.enforceMintGate`, which has NO `GNUS_TOKEN_ID` carve-out: the factory `maxSupply` bound for id 0, the `validFrom` sale-window gate ("Token not yet active"), the PerTokenId `validUntil` gate ("Sale ended"), and the `perWalletMintCap[0]` check-AND-INCREMENT all apply to every bridge-in mint — and bridge-in mints consume the recipient's `mintedPerWallet[0]` allowance. Consequences: configuring `perWalletMintCap[GNUS_TOKEN_ID]` or `NFTs[0].validFrom/validUntil` would rate-limit, consume, or outright brick the permissionless bridge-in path, and none of this is documented at the bridgeIn call site or covered by a test. This is carried behavior from the Phase 10 path (the `mint()` twin shares it), so it is not a phase regression — but the new permissionless entry point is exactly where an operator would least expect lifecycle-sale semantics, and the doc comment as written invites the belief that no gate applies.
**Fix:** Minimal: amend the `bridgeIn` natspec to state explicitly that the mint leg still runs `enforceMintGate` (factory max-supply, sale window, per-wallet cap for id 0), and add a matrix row (e.g., E7) setting `perWalletMintCap[0]` and asserting the bridge-in revert/consumption behavior so the coupling is pinned by CI. If bridge-in must be exempt from sale-window/per-wallet-cap semantics, that is a product decision requiring an explicit carve-out in `enforceMintGate` — raise it rather than silently relying on cap == 0 defaults.

### WR-03: TS reference module still points at the removed `GNUSBridge.sol::bridgeIn` and carries dead Phase-10 exports

**File:** `test/utils/bridge-certificate.ts:5-35, 47-124`
**Issue:** The module header states it "Produces EIP-191 wrapped ECDSA certificates that round-trip against the on-chain verifier in `contracts/gnus-ai/GNUSBridge.sol::bridgeIn` / `_verifyThresholdCertificate`" — both functions were deleted from `GNUSBridge` by D-06 in this same phase. Additionally, the Phase-10 V1 exports (`BridgeInMessage`, `computeBridgeInStructHash`, `signBridgeInCertificate`, `aggregateCertificate` as a direct export) now have zero consumers: grep across `test/` and `scripts/` finds no non-V2 import of them after the legacy suite rewrite. This file is the declared executable reference for the SuperGenius C++ exporter (BRIDGE-18); a header that routes the reader to a non-existent on-chain twin plus an unused V1 digest implementation is an active trap for the exact cross-repo consumer this file exists to serve.
**Fix:** Update the header: route V2 readers to `GNUSBridgeAttestor.sol::_bridgeInDigestV2`/`_verifyBridgeAttestorCertificate`, and mark the Phase-10 block as retained-for-history with its on-chain counterpart removed in Phase 15 (D-06). Preferably delete the unconsumed V1 exports (`computeBridgeInStructHash`, `signBridgeInCertificate`, `BridgeInMessage`; `aggregateCertificate` must stay — `aggregateCertificateV2` delegates to it).

## Info

### IN-01: Silent uint256→uint64 epoch narrowing without an equivalence guard

**File:** `contracts/gnus-ai/GNUSBridgeAttestor.sol:250-251, 500, 514-516`
**Issue:** Storage epoch is `uint256` while the digest and both events consume `uint64(currentEpoch)`/`uint64(oldEpoch + 1)`. If the epoch ever reached 2^64 the cast would silently alias epochs in the signed digest and the indexed event topics. Practically unreachable (2^64 verified transitions), but the truncation class is silent.
**Fix:** Either store the epoch as `uint64` (append-only concern is nil — slot +4 semantics unchanged for values < 2^64) or add `require(currentEpoch < type(uint64).max)` defense-in-depth at the transition sites. Low priority.

### IN-02: Unused `user2` test variable

**File:** `test/unit/GNUSBridgeIn.test.ts:88, 255`
**Issue:** `user2` is declared and assigned but never referenced in this suite (the copied scaffold kept it from `GNUSBridgeAttestorIn.test.ts`, where it IS used in D5).
**Fix:** Delete the declaration and drop it from the `getSigners()` destructure.

### IN-03: Stale "10 billion GNUS" cap in handler doc

**File:** `test/foundry/handlers/GeniusDiamondHandler.sol:271`
**Issue:** `handler_mint`'s RATIONALE block claims "Validates max supply cap enforcement (10 billion GNUS)". The actual cap is 50M (`GNUSConstants.sol:21`, mirrored by `ConservationInvariant.GNUS_MAX_SUPPLY`). Stale comment only — the handler asserts nothing about the cap value.
**Fix:** Correct the comment to 50 million.

### IN-04: `_mint` docblock in GNUSBridge claims an ERC-1155 receiver check the implementation deliberately omits

**File:** `contracts/gnus-ai/GNUSBridge.sol:179-182`
**Issue:** The inherited `_mint` doc says "If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the acceptance magic value" — the code performs no receiver call (intentional, so contracts can receive bridged GNUS). The attestor twin (`GNUSBridgeAttestor.sol:409-413`) documents the omission correctly; the `GNUSBridge` copy's requirement text is false and now duplicated across both twins ("any change here MUST be mirrored" invites mirroring the wrong doc too).
**Fix:** Replace the requirement bullet in `GNUSBridge._mint` with the attestor twin's wording (no receiver-acceptance check, contract recipients can receive bridged GNUS).

### IN-05: `invariant_bridgePairConservation` comment overstates its robustness (pre-fee ghost vs post-fee counter)

**File:** `test/foundry/invariant/ConservationInvariant.t.sol:171-177`
**Issue:** The comment says the formula is "written to be correct under arbitrary fuzz luck so the invariant remains meaningful if the handler is later extended to submit valid certificates" — but `ghost_totalBridgedInAmount` and `ghost_totalMinted` accumulate PRE-fee amounts while `totalSupplyOfAll()` accrues POST-fee amounts inside `_mintWithBridgeFee`. The identity holds only while `bridgeFee == 0` (true today: no handler sets a fee). Same caveat applies to I2's `ghost_totalMinted` term.
**Fix:** Either note the fee == 0 precondition in the comment, or have the ghosts track post-fee deltas (read `totalSupplyOfAll()` before/after, like the Hardhat E4 row) if the handler is ever extended.

---

_Reviewed: 2026-08-27T00:32:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
