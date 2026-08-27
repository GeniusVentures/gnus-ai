---
phase: 15-secure-bridgein-phase-10-amendment
verified: 2026-08-27T00:39:56Z
status: gaps_found
score: 7/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "BRIDGE-18: checked-in cross-language vectors are valid conformance contracts the Solidity verifier accepts as recorded"
    status: failed
    reason: "CR-01 (15-REVIEW.md, independently re-confirmed by this verifier): the 'active-root-claim' vector (vectors[1]) records its two signers DESCENDING by address (attestor-1 0x335B... before attestor-2 0x1697...); the on-chain verifier requires signer > lastSigner (strictly ascending) and the exporter doc §2.3 says 'Signatures MUST be submitted sorted strictly ascending by recovered address' — a certificate assembled in the recorded array order ALWAYS reverts 'Signers not strictly ascending'. Vector 1 is also never submitted on-chain anywhere (V3 round-trip consumes vectors[0] only, single signer — ordering vacuous), so CI cannot catch the defect."
    artifacts:
      - path: "test/fixtures/bridge-attestor-vectors.json"
        issue: "vectors[1].signers array is in descending address order, contradicting GNUSBridgeAttestor.sol:364 and docs/Secure-BridgeIn-Exporter-ABI.md:149-151"
      - path: "test/unit/GNUSBridgeAttestorIn.test.ts"
        issue: "V3 on-chain round-trip (line 509) submits fixture.vectors[0] only; no on-chain leg for the multi-signer vector, so fixture ordering is unenforced"
    missing:
      - "Reorder vectors[1].signers so attestor-2 (0x1697...) precedes attestor-1 (0x335B...), moving each signer's signature/merkleProof/recoveredAddress with them; DO NOT touch attestorSet array order (leaf order determines the root 0x0391...)"
      - "Add an on-chain round-trip leg for vector 1 (bootstrap -> genesis-transition via vector 0 -> active-root-claim via vector 1) so CI permanently enforces fixture ordering against the verifier"
      - "State the ascending-order invariant explicitly in the fixture constants block and doc §3"
  - truth: "Epoch-derived threshold enforcement is proven for override values, not only the init defaults"
    status: partial
    reason: "WR-01 (15-REVIEW.md, confirmed): setBridgeAttestorActiveThreshold is tested only for bounds (1/17 revert) and the raw slot write; no test raises the threshold and proves the live verifier enforces it (e.g. threshold 3 + 2-sig cert reverting 'Below threshold', 3-sig passing), and the zero-guard fallback is unexercised. A regression where _bridgeAttestorThreshold ignores the override would pass the entire suite."
    artifacts:
      - path: "test/unit/GNUSBridgeAttestorUpgrade.test.ts"
        issue: "Threshold coverage is bounds + slot only; no live-verification rows at a non-default threshold"
    missing:
      - "Matrix row: after transition, setBridgeAttestorActiveThreshold(3); 2-of-3 cert reverts 'Below threshold'; 3-of-3 passes"
      - "Optional: hardhat_setStorageAt slot +6 to 0 and assert activeBridgeAttestorThreshold() == 2 (zero-guard)"
  - truth: "bridgeIn mint-leg coupling to the lifecycle mint gate is documented and pinned by CI"
    status: partial
    reason: "WR-02 (15-REVIEW.md, factually confirmed by this verifier: GNUSERC1155MaxSupply.sol:121 calls GNUSLifecyclePolicy.enforceMintGate from _beforeTokenTransfer, and bridgeIn's _mint leg runs that hook): the bridgeIn natspec says 'No D-24 policy gate and no limiter charge on this path by design' — true for the transfer-policy predicate and the limiter, but the mint leg silently inherits enforceMintGate (sale window, per-wallet mint cap for id 0, factory maxSupply) with no carve-out, no test, and an inaccurate doc comment at the call site."
    artifacts:
      - path: "contracts/gnus-ai/GNUSBridgeAttestor.sol"
        issue: "bridgeIn natspec (lines 461-463) understates the mint-leg gates; enforceMintGate inheritance is undocumented and untested"
    missing:
      - "Amend the bridgeIn natspec to state the mint leg still runs enforceMintGate (factory max-supply, sale window, per-wallet cap for id 0)"
      - "Add a matrix row (e.g. E7) setting perWalletMintCap[0] and asserting the bridge-in revert/consumption behavior"
  - truth: "The TS reference module routes the C++ exporter to the live on-chain twin"
    status: partial
    reason: "WR-03 (15-REVIEW.md, confirmed): test/utils/bridge-certificate.ts header still points at GNUSBridge.sol::bridgeIn / _verifyThresholdCertificate — both deleted by D-06 in this same phase — and the dead Phase-10 V1 exports (computeBridgeInStructHash, signBridgeInCertificate, BridgeInMessage) have zero consumers after the legacy suite rewrite."
    artifacts:
      - path: "test/utils/bridge-certificate.ts"
        issue: "Header references removed functions; dead V1 exports retained"
    missing:
      - "Update header to route V2 readers to GNUSBridgeAttestor.sol::_bridgeInDigestV2 / _verifyBridgeAttestorCertificate; mark the Phase-10 block as retained-for-history or delete the unconsumed V1 exports (aggregateCertificate must stay — aggregateCertificateV2 delegates to it)"
deferred: []
human_verification: []
---

# Phase 15: Secure BridgeIn (Phase 10 Amendment) Verification Report

**Phase Goal:** Replace the manual validator-set bridgeIn surface with the rolling API-attestor certificate design from `docs/Secure-BridgeIn.md` (PD-BR-1..8) — rolling attestor root rotated as a side-effect of `bridgeIn`, canonical `BridgeMessage` identity, domain-separated `BRIDGE_CERTIFICATE_V2` digest, epoch-derived thresholds, and legacy-selector removal (pre-deployment amendment).
**Verified:** 2026-08-27T00:39:56Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truth set = the 8 ROADMAP §Phase 15 Success Criteria (the roadmap contract). Plan-level must_haves were checked beneath each and are noted in evidence; no plan truth subtracted roadmap scope.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (BRIDGE-10/11): rolling-attestor storage appended, legacy preserved byte-for-byte, one-time Genesis bootstrap, first certificate advances off Genesis | ✓ VERIFIED | `GNUSBridgeValidatorStorage.sol` Layout has exactly 7 fields in order (processedMessages, validatorMerkleRoot, validatorThreshold, bridgeAttestorRoot/Epoch/V2Initialized, activeAttestorThreshold) below the append banner. git diff 4a7efaf→722d6cb shows legacy slots +0..+2 fields + NatSpec byte-identical (only the two permitted stale header `@dev` lines changed). `initializeBridgeAttestorV2` (:207-216) is one-shot with one-leaf root at epoch 0 + threshold 2. Epoch-0 must-advance gate at :496-498. Slot-probe upgrade suite: 10 passing (run by this verifier). B2/B5/B6/B7 matrix rows green. |
| 2 | SC2 (BRIDGE-12): canonical BridgeMessage + BRIDGE_MESSAGE_ID_V2 composite replay key; processedMessages reuse | ✓ VERIFIED | File-scope `struct BridgeMessage` (:21-36, six SPEC fields); `_bridgeMessageId` (:281-291) = keccak256(abi.encode(BRIDGE_MESSAGE_ID_V2, 4 identity fields)); replay check + mark on slot-0 `processedMessages` (:490-491, :510). Verifier independently re-derived both fixture messageIds — match. D2 (two event indexes both bridge in) green. |
| 3 | SC3 (BRIDGE-13): BRIDGE_CERTIFICATE_V2 digest binding currentRoot/Epoch/nextRoot + dest-chain + diamond binding | ✓ VERIFIED | `_bridgeInDigestV2` (:311-327) split-encode binds all 13 fields (three abi.encode groups via bytes.concat, toEthSignedMessageHash-wrapped). Independent re-derivation by this verifier: flat == split == fixture structHash and eip191Digest for BOTH vectors — the D-02 byte-identity is proven, not assumed. D3-D8 domain rows green. |
| 4 | SC4 (BRIDGE-14): strict-ascending per-signer Merkle verification, epoch-derived thresholds, 16-sig cap | ✓ VERIFIED | `_verifyBridgeAttestorCertificate` (:347-369): sig/proof parity, `>= requiredSignatures`, `<= MAX_ATTESTOR_SIGNATURES` (16), tryRecover+NoError, `signer > lastSigner`, 20-byte packed leaf, `MerkleProofUpgradeable.verify(..., currentRoot, ...)` ONLY. `_bridgeAttestorThreshold` (:261-270) epoch-derived with zero-guard. C1-C8 green. **Caveat:** override values 3..16 never exercised against the live verifier (WR-01 → gap 2). |
| 5 | SC5 (BRIDGE-15): atomic bridgeIn — replay-mark + root transition before mint (CEI); failed mint reverts root update | ✓ VERIFIED | Source order machine-checked by this verifier: replay mark at :510, root/epoch transition :511-520, `_mintWithBridgeFee` call at :522. Root transition guarded by `nextAttestorRoot != currentRoot` with exactly-one epoch increment; unchanged root = no bump/no event. R1-R6 green (R6 proves the reverting mint rolls back root+epoch+replay marker atomically). |
| 6 | SC6 (BRIDGE-16): legacy bridgeIn removed; setValidatorSet converted to emergency-recovery (paused + superAdmin + never restores Genesis) | ✓ VERIFIED | Artifact ABI check (this verifier): GNUSBridge has no `bridgeIn(...)` and no `setValidatorSet(...)` (selectors 0x0bee6121/0x1abd0f1e absent; only NatSpec mentions remain in source). `emergencyRecoverAttestorSet` (:242-252): requires paused + onlySuperAdminRole + nonzero root + initialized; writes epoch = oldEpoch+1; never touches the init flag — Genesis structurally unrecoverable. Loupe removal proof in rewritten suite green. |
| 7 | SC7 (BRIDGE-18 vectors + BRIDGE-19 matrix): vectors checked in and run in CI; matrix extends Phase 10 suite | ✗ FAILED | BRIDGE-19 VERIFIED: 42-test matrix (36 SPEC checkpoints B1-B7/C1-C8/R1-R6/D1-D9/E1-E6 + V1-V4 + fee-replica + [GAS] 313,824) passing, run by this verifier; header maps every `it` to SPEC lines. BRIDGE-18 PARTIAL→FAILED: fixture exists and its digests/signatures/proofs/roots all re-derive correctly (independently confirmed: messageId, structHash flat==split, eip191Digest, both signature recoveries, 3-attestor root 0x0391da16..., genesis one-leaf root 0xe9707d0e...), BUT vectors[1].signers is recorded DESCENDING — the vector cannot round-trip on-chain as recorded and is never submitted on-chain, so the multi-signer conformance contract is defective and unenforced (CR-01 → gap 1). |
| 8 | SC8 (BRIDGE-17): SuperGenius#363/#364 tracked as parallel non-blockers; gate recorded | ✓ VERIFIED | The EVM-side deliverable is the gate RECORD: `docs/Secure-BridgeIn-Exporter-ABI.md` §5 exists with both issue numbers and status (#363 OPEN / #364 CLOSED, owner ruling 2026-08-26, no .planning/SUBREPOS.md in this submodule) and the 15-04 SUMMARY carries the same gate section. REQUIREMENTS.md consistently keeps BRIDGE-17 unchecked (Pending) — pending BY DESIGN (external parallel work), not a local gap. |

**Score:** 7/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` | V2 append (BRIDGE-10) | ✓ VERIFIED | 7 fields, banner, per-slot Doxygen; legacy byte-identical (git diff) |
| `contracts/gnus-ai/GNUSBridgeAttestor.sol` | Full V2 facet (admin + certificate path) | ✓ VERIFIED | 549 lines: all admin fns, digest, verifier, CEI bridgeIn, twin fee/mint replicas, 3 views, 5 events, named constants/reverts. EIP-170: 21,536 B |
| `contracts/gnus-ai/GNUSBridge.sol` | Legacy block deleted; bridgeOut/D-24 survive | ✓ VERIFIED | No legacy functions in source/ABI; bridgeOut (:213) calls `_enforceBridgePolicy` (:232) BEFORE the limiter charge — D-24 ordering preserved. 19,938 B |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` | Priority 116, versions["2.6"] only | ✓ VERIFIED | priority 116 (GNUSBridge 115 < 116 < GNUSTreasury 117), versions key `2.6` only, fromVersions [0.0,2.4,2.5], no deployInit/upgradeInit, protocolVersion 2.6 |
| `test/unit/GNUSBridgeAttestorUpgrade.test.ts` | Slot-probe upgrade test | ✓ VERIFIED | 10 tests, real eth_getStorageAt/hardhat_setStorageAt probes at base+offset; passing (run by this verifier) |
| `test/utils/bridge-certificate.ts` | V2 digest/messageId helpers + builders | ✓ VERIFIED | computeBridgeMessageId/computeBridgeInStructHashV2/signBridgeInCertificateV2/aggregateCertificateV2/buildAttestorCertificate present; flat==split==on-chain proven. WR-03: stale header + dead V1 exports (gap 4) |
| `test/fixtures/bridge-attestor-vectors.json` | Frozen cross-language vectors | ✗ STUB-DATA | Exists with all SPEC :712-725 fields, all values internally consistent (independently re-derived) — but vectors[1].signers order is descending (CR-01): invalid as a submission-order conformance contract (gap 1) |
| `test/unit/GNUSBridgeAttestorIn.test.ts` | BRIDGE-19 V2 matrix + vector consumer | ✓ VERIFIED | 42 `it(` passing (run by this verifier); header maps 36 checkpoints; [GAS] line in output. Gap: no on-chain leg for vector 1 |
| `test/unit/GNUSBridgeIn.test.ts` | Rewritten legacy suite | ✓ VERIFIED | 23 tests passing (run by this verifier); 0 `setValidatorSet` refs; loupe removal proof; carried Phase-10 semantics re-keyed (fee/cap/supply/replay/domain/pause/D-18) |
| `test/foundry/handlers/GeniusDiamondHandler.sol` | handler_bridgeIn on 0x4d2e0756 | ✓ VERIFIED | Imports canonical `BridgeMessage` from the facet; encodes the V2 tuple signature string |
| `test/foundry/invariant/BridgeInvariant.t.sol` | V2 bootstrap setUp + messageId slot probe | ✓ VERIFIED | `initializeBridgeAttestorV2` + `setChainID` in setUp with require; vm.load keyed by keccak(abi.encode(messageId, GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION)) |
| `test/foundry/invariant/ConservationInvariant.t.sol` | setValidatorSet setUp replaced | ✓ VERIFIED | Same bootstrap + chainID alias; `setValidatorSet` count in test/foundry = 0 |
| `docs/Secure-BridgeIn-Exporter-ABI.md` | Exporter ABI + digest spec + security note + BRIDGE-17 gate | ✓ VERIFIED | ABI table, flat 13-field order, Merkle/EIP-191 conventions, guard list, security note, §5 gate (#363 OPEN / #364 CLOSED) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| geniusdiamond.config.json | GNUSBridgeAttestor.sol | facet registration → deployment | ✓ WIRED | Config entry at 116; diamond ABI exposes 0x4d2e0756/0x8c864f52/0x604c3b10/0x669588d5 + 3 views; every deployer-based test green proves no selector collision |
| GNUSBridgeAttestor.sol | GNUSBridgeValidatorStorage.layout() | appended slot writes | ✓ WIRED | v.bridgeAttestorRoot/Epoch/V2Initialized/activeAttestorThreshold writes; slot probes confirm offsets +3..+6 |
| GNUSBridgeAttestor.sol | GNUSControlStorage paused | inverted pause gate | ✓ WIRED | `require(GNUSControlStorage.layout().paused, ...)` at :243 |
| bridgeIn | processedMessages + root transition | CEI before mint | ✓ WIRED | :510→:522 source order (awk machine check); R6 rollback test |
| bridgeIn | inline _mintWithBridgeFee | verbatim replica | ✓ WIRED | :522; fee-replica pairing test asserts mint()==bridgeIn() post-fee equality |
| _verifyBridgeAttestorCertificate | MerkleProofUpgradeable.verify vs currentRoot | membership vs CURRENT root only | ✓ WIRED | :367 — currentRoot only, never nextAttestorRoot; C2/C3 prove it |
| computeBridgeInStructHashV2 (TS) | _bridgeInDigestV2 (Solidity) | identical field order | ✓ WIRED | flat==split==fixture for both vectors (independently re-derived) + V3 on-chain round-trip for vector 0 |
| bridge-attestor-vectors.json | GNUSBridgeAttestorIn.test.ts | fixture consumed by round-trip test | ⚠️ PARTIAL | Imported and consumed by V1/V2 (off-chain) + V3 (on-chain, vector 0 only). Vector 1 never submitted on-chain (CR-01 consequence 2) |
| GNUSBridgeIn.test.ts | bridge-certificate.ts | V2 helper imports | ✓ WIRED | Multi-line import incl. `buildAttestorCertificate` (lines 12-22) |
| GeniusDiamondHandler.sol | diamond bridgeIn 0x4d2e0756 | abi.encodeWithSignature V2 tuple | ✓ WIRED | Signature string + imported struct at :485/:457 |
| BridgeInvariant.t.sol | validator storage slot 0 | vm.load keyed by messageId | ✓ WIRED | Formula unchanged (mapping at field index 0), key derivation = V2 messageId |

### Data-Flow Trace (Level 4)

Not a data-rendering phase (Solidity contracts + tests). Equivalent depth applied via independent cryptographic re-derivation of the fixture data flow: private keys → addresses/leaves → tree root/proofs → message fields → messageId → structHash → EIP-191 digest → signatures → recoveries. Every recorded value re-derives correctly for BOTH vectors — the fixture is real data, not placeholder, with the sole exception of vectors[1].signers ARRAY ORDER (CR-01).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 15-01 slot-probe/admin suite | `npx hardhat test test/unit/GNUSBridgeAttestorUpgrade.test.ts` | 10 passing | ✓ PASS |
| 15-03 V2 matrix + vectors | `npx hardhat test test/unit/GNUSBridgeAttestorIn.test.ts` | 42 passing; [GAS] 16-sig = 313,824 | ✓ PASS |
| 15-04 rewritten legacy suite | `npx hardhat test test/unit/GNUSBridgeIn.test.ts` | 23 passing | ✓ PASS |
| EIP-170 sizes | node artifact check | Attestor 21,536 B; Bridge 19,938 B (both ≤ 24,576) | ✓ PASS |
| V2/legacy selectors | ethers id() + artifact/diamond ABI | 0x4d2e0756/0x8c864f52/0x604c3b10/0x669588d5 present; 0x0bee6121/0x1abd0f1e absent from GNUSBridge artifact AND diamond ABI | ✓ PASS |
| Vector internal consistency | independent node re-derivation | messageId/structHash(flat==split)/eip191Digest/recoveries/roots all match | ✓ PASS |
| Vector signer ordering (CR-01) | independent node check | vectors[1] strictly ascending = **false** (descending) | ✗ FAIL |
| Full-suite baselines | orchestrator-run (661/2/1 Hardhat; 215/2/3 Foundry) | independently re-verified by orchestrator pre-delegation; scoped runs here corroborate | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared by the plans or present in the repo; this phase's runnable checks are the Hardhat/Foundry suites (executed above / by orchestrator).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|---------------------|----------|
| BRIDGE-10 | 15-01 | Rolling-attestor storage append + upgrade test | ✓ SATISFIED | Storage source + git diff + 10 slot-probe tests |
| BRIDGE-11 | 15-01 | One-time Genesis bootstrap, must-advance | ✓ SATISFIED | :207-216 one-shot; :496-498 gate; B1-B7 green |
| BRIDGE-12 | 15-02 | Canonical BridgeMessage + V2 replay key | ✓ SATISFIED | Struct + _bridgeMessageId; D1-D6 green |
| BRIDGE-13 | 15-02 | BRIDGE_CERTIFICATE_V2 digest | ✓ SATISFIED | :311-327; independent re-derivation match |
| BRIDGE-14 | 15-02 | Verifier: ascending/proofs/threshold/cap | ✓ SATISFIED | :347-369; C1-C8 green (WR-01 override-coverage note → gap 2) |
| BRIDGE-15 | 15-02 | Atomic CEI bridgeIn | ✓ SATISFIED | :509-524 ordering; R1-R6 green |
| BRIDGE-16 | 15-01, 15-02 | Legacy removal + emergency conversion | ✓ SATISFIED | ABI absence + emergency semantics + loupe proof |
| BRIDGE-17 | 15-04 | SuperGenius #363/#364 gate | ✓ SATISFIED (gate record; activation PENDING BY DESIGN) | doc §5 + 15-04 SUMMARY record; REQUIREMENTS.md unchecked consistently; external parallel work per owner ruling 2026-08-26 |
| BRIDGE-18 | 15-03 | Cross-language vectors checked in, run in CI | ✗ NEEDS FIX | Checked in + CI-consumed + all values re-derive, BUT vectors[1] signer order defect (CR-01) makes it an invalid multi-signer conformance contract as recorded → gap 1 |
| BRIDGE-19 | 15-03, 15-04 | Amendment matrix extending Phase 10 suite | ✓ SATISFIED | 42-test matrix + 23-test rewrite; both green |

Orphaned requirements: none — plans claim all 10 IDs mapped to Phase 15 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 12 phase files) | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER scan | — | None found (zero matches) |
| `test/fixtures/bridge-attestor-vectors.json` | 89-113 | Data defect: signers recorded descending | 🛑 Blocker | Gap 1 (CR-01) — conformance vector invalid as recorded; unenforced by CI |
| `contracts/gnus-ai/GNUSBridgeAttestor.sol` | 461-463, 522 | Understated mint-leg gate documentation | ⚠️ Warning | Gap 3 (WR-02) |
| `test/unit/GNUSBridgeAttestorUpgrade.test.ts` | 187-209 | Untested security parameter at live verification | ⚠️ Warning | Gap 2 (WR-01) |
| `test/utils/bridge-certificate.ts` | 5-35 | Header references removed functions; dead exports | ⚠️ Warning | Gap 4 (WR-03) |
| (from 15-REVIEW.md, INFO — not re-gated here) | — | IN-01 uint64 epoch narrowing; IN-02 unused user2; IN-03 stale 10-billion comment; IN-04 GNUSBridge _mint docblock; IN-05 conservation fee==0 precondition | ℹ️ Info | No gate impact; fold into --fix if convenient |

### Human Verification Required

None raised by this verification. All checks were programmatically decidable; the full-suite/Foundry baselines were independently re-verified by the orchestrator and corroborated by this verifier's scoped runs.

### Gaps Summary

The phase's engineering core is genuinely done and independently proven: the storage append is byte-safe, the V2 certificate path (digest, verifier, CEI bridgeIn, emergency recovery, thresholds) is implemented exactly per the SPEC ordering and covered by 75 passing tests across three suites, both legacy selectors are gone from source, artifact, and diamond ABI, both facets are under EIP-170, and the BRIDGE-17 gate is recorded where the plans said it would be. The single truth-level failure is CR-01: the frozen BRIDGE-18 `active-root-claim` vector records its signers in descending order, contradicting the verifier and the exporter doc's own §2.3 rule — as a cross-language conformance contract for the C++ exporter (the entire point of BRIDGE-18), it is defective, and because no test ever submits vector 1 on-chain, CI structurally cannot catch this class of defect. The fix is mechanical (reorder signers with their proofs; add a vector-1 round-trip leg) and must land pre-ship per the orchestrator's --fix plan. Three review warnings (threshold-override live enforcement untested, undocumented enforceMintGate coupling on the bridgeIn mint leg, stale TS reference header) round out the gaps — none regress shipped behavior, but each leaves a security-relevant or cross-repo-contract surface under-pinned. No deferred items: Phase 15 is the final milestone phase; nothing later absorbs these.

---

_Verified: 2026-08-27T00:39:56Z_
_Verifier: Claude (gsd-verifier)_
