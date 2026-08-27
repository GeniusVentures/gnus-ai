---
phase: 15-secure-bridgein-phase-10-amendment
verified: 2026-08-27T01:28:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "BRIDGE-18 vector conformance defect (CR-01): vectors[1].signers reordered strictly ascending + V5 on-chain round-trip leg + ordering invariant in fixture constants and doc §3 (commit 0a9f912)"
    - "Threshold-override live enforcement untested (WR-01): threshold-3 2-of-3 revert / 3-of-3 release rows + zero-guard slot+6 row (commit 466e7db)"
    - "Undocumented enforceMintGate coupling on the bridgeIn mint leg (WR-02): natspec amended + matrix row E7 pins consumption + enforcement (nested a244fbb + outer 0d8ff2c) — resolved by documentation + CI pin per the review's prescribed minimal fix; carve-out remains an open product decision (see notes)"
    - "Stale TS reference header + dead V1 exports (WR-03): header routes at GNUSBridgeAttestor twins; dead exports deleted, aggregateCertificate retained for V2 delegation (commit 1b58131)"
  gaps_remaining: []
  regressions: []
notes:
  - id: PD-WR-02
    kind: open_product_decision
    summary: "Whether bridgeIn's mint leg should be EXEMPT from the lifecycle mint gate (sale window + perWalletMintCap for id 0). WR-02 was resolved by accurate documentation + CI pinning (E7), NOT by a carve-out — the 15-REVIEW.md fix path explicitly defers an exemption to a product decision ('raise it rather than silently relying'). Owner: khurley. Until decided, configuring perWalletMintCap[GNUS_TOKEN_ID] or an id-0 sale window rate-limits or blocks the permissionless bridge-in path; current defaults (cap 0 / no window) leave the path open. Raising this note does not affect phase status."
deferred: []
human_verification: []
---

# Phase 15: Secure BridgeIn (Phase 10 Amendment) Verification Report

**Phase Goal:** Replace the manual validator-set bridgeIn surface with the rolling API-attestor certificate design from `docs/Secure-BridgeIn.md` (PD-BR-1..8) — rolling attestor root rotated as a side-effect of `bridgeIn`, canonical `BridgeMessage` identity, domain-separated `BRIDGE_CERTIFICATE_V2` digest, epoch-derived thresholds, and legacy-selector removal (pre-deployment amendment).
**Verified:** 2026-08-27T01:28:00Z (re-verification after gap-closure fixes)
**Status:** passed
**Re-verification:** Yes — initial verification found 4 gaps (1 truth FAILED + 3 partial); all 4 fixed and independently re-verified below.

## Goal Achievement

Truth set = the 8 ROADMAP §Phase 15 Success Criteria (the roadmap contract). Plan-level must_haves were checked beneath each; no plan truth subtracted roadmap scope.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (BRIDGE-10/11): rolling-attestor storage appended, legacy preserved byte-for-byte, one-time Genesis bootstrap, first certificate advances off Genesis | ✓ VERIFIED | `GNUSBridgeValidatorStorage.sol` Layout has exactly 7 fields in order below the append banner. git diff 4a7efaf→722d6cb: legacy slots +0..+2 byte-identical (only the two permitted stale header `@dev` lines changed). `initializeBridgeAttestorV2` one-shot, one-leaf root at epoch 0, threshold 2. Epoch-0 must-advance gate. Slot-probe suite 12 passing (re-run post-fix). B2/B5/B6/B7 green. |
| 2 | SC2 (BRIDGE-12): canonical BridgeMessage + BRIDGE_MESSAGE_ID_V2 composite replay key; processedMessages reuse | ✓ VERIFIED | `struct BridgeMessage` (six SPEC fields); `_bridgeMessageId` = keccak256(abi.encode(BRIDGE_MESSAGE_ID_V2, 4 identity fields)); slot-0 `processedMessages` reuse. Verifier independently re-derived both fixture messageIds — match. D2 row green. |
| 3 | SC3 (BRIDGE-13): BRIDGE_CERTIFICATE_V2 digest binding currentRoot/Epoch/nextRoot + dest-chain + diamond binding | ✓ VERIFIED | `_bridgeInDigestV2` split-encode binds all 13 fields. Independent re-derivation post-fix: flat == split == fixture structHash and eip191Digest for BOTH vectors — D-02 byte-identity proven, not assumed. D3-D8 green. |
| 4 | SC4 (BRIDGE-14): strict-ascending per-signer Merkle verification, epoch-derived thresholds, 16-sig cap | ✓ VERIFIED | `_verifyBridgeAttestorCertificate`: parity, threshold floor, 16 cap, tryRecover+NoError, `signer > lastSigner`, 20-byte packed leaf, proofs vs currentRoot ONLY. Epoch-derived threshold now proven at ALL operating points incl. override: threshold-3 row (2-of-3 reverts "Below threshold", 3-of-3 emits BridgeReleased) + zero-guard row (slot+6 forced 0 → effective 2) — WR-01 closed (466e7db). C1-C8 green. |
| 5 | SC5 (BRIDGE-15): atomic bridgeIn — replay-mark + root transition before mint (CEI); failed mint reverts root update | ✓ VERIFIED | Source order re-machine-checked post-fix: replay mark :527, mint :539 (IN-01 guard shifted lines; ordering intact). Root transition = exactly-one epoch increment, unchanged root = no bump/no event. R1-R6 green (R6 proves atomic rollback). |
| 6 | SC6 (BRIDGE-16): legacy bridgeIn removed; setValidatorSet converted to emergency-recovery (paused + superAdmin + never restores Genesis) | ✓ VERIFIED | Artifact ABI (re-checked): GNUSBridge has no legacy `bridgeIn`/`setValidatorSet` (0x0bee6121/0x1abd0f1e absent from artifact AND diamond ABI; source carries NatSpec mentions only). `emergencyRecoverAttestorSet`: paused + superAdmin + nonzero root + initialized, epoch = old+1, never touches the init flag. Loupe removal proof green. |
| 7 | SC7 (BRIDGE-18 vectors + BRIDGE-19 matrix): vectors checked in, valid conformance contracts, run in CI; matrix extends Phase 10 suite | ✓ VERIFIED (was FAILED — CR-01 closed by 0a9f912) | Fixture re-verified independently post-fix: vectors[1].signers now strictly ascending (attestor-2 0x1697... → attestor-1 0x335B...); attestorSet array order untouched (3-attestor root 0x0391da16... intact — re-derived); ALL values still re-derive (messageId, structHash flat==split, eip191Digest, recoveries for both vectors — the reorder changed no digest input). New V5 leg submits vector 1 on-chain IN THE RECORDED ARRAY ORDER (deliberately unsorted) after the V3-style bootstrap/transition — permanent CI enforcement of the ordering contract. Ordering invariant stated in fixture `constants.signerOrdering` and doc §3 ("Signer ordering", :206). Matrix 44 passing (re-run). |
| 8 | SC8 (BRIDGE-17): SuperGenius#363/#364 tracked as parallel non-blockers; gate recorded | ✓ VERIFIED | Gate record deliverable present: `docs/Secure-BridgeIn-Exporter-ABI.md` §5 with both issue numbers + status (#363 OPEN / #364 CLOSED, owner ruling 2026-08-26) and the 15-04 SUMMARY gate section. REQUIREMENTS.md keeps BRIDGE-17 unchecked — pending BY DESIGN (external parallel work), not a local gap. |

**Score:** 8/8 truths verified

### Gap Closure Record (re-verification)

| Gap | Fix commit(s) | Fix verified | Evidence |
|-----|--------------|--------------|----------|
| 1. CR-01 vector signer ordering (BLOCKER) | 0a9f912 (outer) | ✓ RESOLVED | Independent node re-derivation: both vectors strictly ascending; root 0x0391da16 intact; all values re-derive. V5 on-chain leg at GNUSBridgeAttestorIn.test.ts:593 submits recorded order unsorted; constants.signerOrdering + doc §3 :206 present. Suite 44 passing. |
| 2. WR-01 threshold override untested at live verification | 466e7db | ✓ RESOLVED | Upgrade suite :272-341: setBridgeAttestorActiveThreshold(3) → 2-of-3 reverts "Below threshold" (:292-299), 3-of-3 emits BridgeReleased + balance (:318-330); zero-guard row forces slot+6 = 0 at active epoch → getter returns 2 (:333-341). Suite 12 passing. |
| 3. WR-02 enforceMintGate coupling undocumented/unpinned | a244fbb (contracts) + 0d8ff2c (outer) | ✓ RESOLVED (doc + CI pin) | Natspec :468-476 now states the full coupling (factory maxSupply, sale window, perWalletMintCap consumption, "an exemption would be a product decision"); E7 row (:1357) proves both halves: first claim consumes the cap allowance, second reverts "Per-wallet mint cap exceeded". No carve-out — intentional, per the review's fix prescription; open product decision recorded in frontmatter notes (PD-WR-02). |
| 4. WR-03 stale TS header + dead V1 exports | 1b58131 | ✓ RESOLVED | Header :10 routes V2 readers at GNUSBridgeAttestor twins; :30-35 retained-for-history markers document the D-06 removal; V1 exports (`computeBridgeInStructHash`, `signBridgeInCertificate`, `BridgeInMessage`) deleted — zero live consumers (grep); `aggregateCertificate` retained (:59) because `aggregateCertificateV2` delegates to it. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` | V2 append (BRIDGE-10) | ✓ VERIFIED | 7 fields, banner, per-slot Doxygen; legacy byte-identical (git diff) |
| `contracts/gnus-ai/GNUSBridgeAttestor.sol` | Full V2 facet | ✓ VERIFIED | Admin fns, digest, verifier, CEI bridgeIn, twin replicas, views, events. IN-01 epoch-overflow guard added (:253, :512). EIP-170: 21,723 B |
| `contracts/gnus-ai/GNUSBridge.sol` | Legacy block deleted; bridgeOut/D-24 survive | ✓ VERIFIED | No legacy functions in source/ABI; `_enforceBridgePolicy` before the limiter charge — D-24 ordering preserved. IN-04 docblock corrected (:181). 19,938 B |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` | Priority 116, versions["2.6"] only | ✓ VERIFIED | priority 116 (between 115 and 117), `2.6` only, fromVersions [0.0,2.4,2.5], no deployInit/upgradeInit, protocolVersion 2.6 |
| `test/unit/GNUSBridgeAttestorUpgrade.test.ts` | Slot-probe upgrade test | ✓ VERIFIED | 12 tests (10 + 2 WR-01 rows), real eth_getStorageAt/hardhat_setStorageAt probes; passing (re-run) |
| `test/utils/bridge-certificate.ts` | V2 helpers + reference doc | ✓ VERIFIED | V2 surface intact; header routes at the V2 verifier; dead V1 exports deleted with retained-for-history markers |
| `test/fixtures/bridge-attestor-vectors.json` | Frozen cross-language vectors | ✓ VERIFIED | All SPEC :712-725 fields; every value independently re-derived including post-reorder; signers strictly ascending in both vectors; ordering invariant in constants.signerOrdering |
| `test/unit/GNUSBridgeAttestorIn.test.ts` | BRIDGE-19 matrix + vector consumer | ✓ VERIFIED | 44 tests (42 + V5 + E7) passing (re-run); [GAS] 16-sig = 313,957 |
| `test/unit/GNUSBridgeIn.test.ts` | Rewritten legacy suite | ✓ VERIFIED | 23 passing (re-run); 0 setValidatorSet refs; loupe removal proof; carried semantics re-keyed; IN-02 user2 removed |
| `test/foundry/handlers/GeniusDiamondHandler.sol` | handler_bridgeIn on 0x4d2e0756 | ✓ VERIFIED | V2 tuple encoding; IN-03 cap comment corrected to 50 million |
| `test/foundry/invariant/BridgeInvariant.t.sol` | V2 bootstrap setUp + messageId slot probe | ✓ VERIFIED | initializeBridgeAttestorV2 + setChainID setUp; vm.load keyed by messageId |
| `test/foundry/invariant/ConservationInvariant.t.sol` | Bootstrap + conservation invariants | ✓ VERIFIED | Same bootstrap; IN-05 fee==0 precondition noted (:179) |
| `docs/Secure-BridgeIn-Exporter-ABI.md` | Exporter ABI + digest spec + security note + gate | ✓ VERIFIED | ABI table, flat 13-field order, Merkle/EIP-191 conventions, §3 signer-ordering invariant, §5 gate |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| geniusdiamond.config.json | GNUSBridgeAttestor.sol | facet registration → deployment | ✓ WIRED | 116/2.6; diamond ABI exposes all four V2 selectors + 3 views; deployer tests green |
| GNUSBridgeAttestor.sol | GNUSBridgeValidatorStorage.layout() | appended slot writes | ✓ WIRED | All four slot writes; probes confirm +3..+6 |
| GNUSBridgeAttestor.sol | GNUSControlStorage paused | inverted pause gate | ✓ WIRED | recovery requires paused; bridgeIn requires unpaused |
| bridgeIn | processedMessages + root transition | CEI before mint | ✓ WIRED | :527→:539 (re-checked post-IN-01); R6 rollback |
| bridgeIn | inline _mintWithBridgeFee | verbatim replica | ✓ WIRED | Fee-replica pairing test green |
| _verifyBridgeAttestorCertificate | MerkleProofUpgradeable.verify vs currentRoot | membership vs CURRENT root only | ✓ WIRED | currentRoot only; C2/C3 |
| computeBridgeInStructHashV2 (TS) | _bridgeInDigestV2 (Solidity) | identical field order | ✓ WIRED | flat==split==fixture both vectors (independently re-derived) |
| bridge-attestor-vectors.json | GNUSBridgeAttestorIn.test.ts | fixture consumed by round-trip tests | ✓ WIRED | V3 (vector 0) + V5 (vector 1, recorded order) on-chain round-trips; V1/V2 off-chain legs |
| GNUSBridgeIn.test.ts | bridge-certificate.ts | V2 helper imports | ✓ WIRED | Multi-line import incl. buildAttestorCertificate |
| GeniusDiamondHandler.sol | diamond bridgeIn 0x4d2e0756 | abi.encodeWithSignature V2 tuple | ✓ WIRED | Signature string + imported struct |
| BridgeInvariant.t.sol | validator storage slot 0 | vm.load keyed by messageId | ✓ WIRED | Formula unchanged, V2 key derivation |

### Data-Flow Trace (Level 4)

Independent cryptographic re-derivation of the full fixture data flow (private keys → addresses/leaves → tree root/proofs → message fields → messageId → structHash → EIP-191 digest → signatures → recoveries): every recorded value re-derives correctly for BOTH vectors post-fix, and vectors[1].signers is now strictly ascending — the fixture is a valid, internally consistent conformance contract with its ordering contract enforced on-chain by V5.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 15-01 slot-probe/admin suite (post-fix) | `npx hardhat test test/unit/GNUSBridgeAttestorUpgrade.test.ts` | 12 passing | ✓ PASS |
| 15-03 V2 matrix + vectors (post-fix) | `npx hardhat test test/unit/GNUSBridgeAttestorIn.test.ts` | 44 passing; [GAS] 16-sig = 313,957 | ✓ PASS |
| 15-04 rewritten legacy suite (post-fix) | `npx hardhat test test/unit/GNUSBridgeIn.test.ts` | 23 passing | ✓ PASS |
| EIP-170 sizes (post-IN-01) | node artifact check | Attestor 21,723 B; Bridge 19,938 B (both ≤ 24,576) | ✓ PASS |
| V2/legacy selectors | ethers id() + artifact/diamond ABI | four V2 selectors present; 0x0bee6121/0x1abd0f1e absent everywhere | ✓ PASS |
| Vector ordering (CR-01 regression) | independent node check | both vectors strictly ascending = true | ✓ PASS |
| Vector internal consistency (post-reorder) | independent node re-derivation | messageId/structHash(flat==split)/eip191Digest/recoveries/roots all match | ✓ PASS |
| CEI ordering (post-IN-01 edit) | awk source check | replay :527 precedes mint :539 | ✓ PASS |
| Full-suite baselines | fixer-run + orchestrator re-run | Hardhat 665/2/1 (known-stale chainID only); Foundry 215/2/3 (known-stale 08.1 only) — corroborated by this verifier's scoped runs | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared by the plans or present in the repo; this phase's runnable checks are the Hardhat/Foundry suites (executed above / by orchestrator).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|---------------------|----------|----------|
| BRIDGE-10 | 15-01 | Rolling-attestor storage append + upgrade test | ✓ SATISFIED | Storage source + git diff + slot-probe tests |
| BRIDGE-11 | 15-01 | One-time Genesis bootstrap, must-advance | ✓ SATISFIED | One-shot init; epoch-0 gate; B1-B7 |
| BRIDGE-12 | 15-02 | Canonical BridgeMessage + V2 replay key | ✓ SATISFIED | Struct + _bridgeMessageId; D1-D6 |
| BRIDGE-13 | 15-02 | BRIDGE_CERTIFICATE_V2 digest | ✓ SATISFIED | Independent re-derivation match |
| BRIDGE-14 | 15-02 | Verifier: ascending/proofs/threshold/cap | ✓ SATISFIED | C1-C8 + WR-01 closure rows (threshold 3 live enforcement + zero-guard) |
| BRIDGE-15 | 15-02 | Atomic CEI bridgeIn | ✓ SATISFIED | Ordering re-checked post-fix; R1-R6 |
| BRIDGE-16 | 15-01, 15-02 | Legacy removal + emergency conversion | ✓ SATISFIED | ABI absence + loupe proof + emergency semantics |
| BRIDGE-17 | 15-04 | SuperGenius #363/#364 gate | ✓ SATISFIED (gate record; activation PENDING BY DESIGN) | doc §5 + 15-04 SUMMARY; external parallel work per owner ruling |
| BRIDGE-18 | 15-03 | Cross-language vectors checked in, run in CI | ✓ SATISFIED | Valid ascending vectors + V3/V5 on-chain round-trips both vectors + flat/split equivalence (CR-01 closed) |
| BRIDGE-19 | 15-03, 15-04 | Amendment matrix extending Phase 10 suite | ✓ SATISFIED | 44-test matrix + 23-test rewrite; both green |

Orphaned requirements: none — plans claim all 10 IDs mapped to Phase 15 in REQUIREMENTS.md.

### Anti-Patterns Found

Zero debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) across all 12 phase files. All review findings resolved:

| Finding | Resolution |
|---------|------------|
| CR-01 (Critical) | Fixed — 0a9f912 (vector reorder + V5 enforcement leg + invariant statements) |
| WR-01 | Fixed — 466e7db (live-enforcement + zero-guard rows) |
| WR-02 | Fixed by doc + CI pin — a244fbb/0d8ff2c (natspec + E7); carve-out = open product decision (note PD-WR-02) |
| WR-03 | Fixed — 1b58131 (header reroute + dead export deletion) |
| IN-01..IN-05 | Fixed — epoch-overflow guard (21,723 B still ≤ EIP-170), unused var, 50M comment, _mint docblock, fee==0 note |

### Open Product Decision (not a gap)

**PD-WR-02 — lifecycle mint-gate exemption for bridgeIn.** The bridgeIn mint leg inherits `GNUSLifecyclePolicy.enforceMintGate` (sale window + `perWalletMintCap[GNUS_TOKEN_ID]` + factory maxSupply) through `_mint → _beforeTokenTransfer` with no carve-out. This is carried Phase 10 behavior, now accurately documented in the facet natspec and pinned by matrix row E7. Whether the permissionless bridge-in path should be EXEMPT from sale-window/per-wallet-cap semantics is a product decision for the owner (khurley) — the 15-REVIEW fix path explicitly prescribed "raise it rather than silently relying", and this note is that raise. Current defaults (cap 0, no sale window) leave the path unrestricted; configuring either for id 0 would rate-limit or block bridge-in. This note does not affect phase status.

### Human Verification Required

None. All checks were programmatically decidable; full-suite/Foundry baselines were re-run by the fixer and the orchestrator, and corroborated by this verifier's scoped runs (12/44/23 passing). The one open decision (PD-WR-02) is recorded above as a product decision, not a verification uncertainty.

### Gaps Summary

None remaining. Initial verification scored 7/8 with the BRIDGE-18 active-root-claim vector recorded in descending signer order (CR-01) plus three review warnings. All four gaps were subsequently fixed in commits 0a9f912, 466e7db, a244fbb/0d8ff2c, and 1b58131 (plus the five info fixes incl. the IN-01 epoch-overflow guard, growing the facet to 21,723 B — still 2,853 B under EIP-170). This re-verification independently re-derived every fixture value post-reorder (all match; root 0x0391da16 intact; both vectors now strictly ascending), confirmed the V5 leg enforces the ordering contract on-chain in the recorded order, confirmed the threshold override is now enforced and tested at live verification, confirmed the enforceMintGate coupling is documented and CI-pinned (E7), and confirmed the TS reference no longer routes readers at deleted functions. Post-fix suites: 12 + 44 + 23 passing locally; orchestrator baselines Hardhat 665/2/1 and Foundry 215/2/3 contain only the two documented known-stale classes. The phase goal is achieved.

---

_Verified: 2026-08-27T01:28:00Z (re-verification)_
_Verifier: Claude (gsd-verifier)_
