---
phase: 15-secure-bridgein-phase-10-amendment
plan: "03"
subsystem: bridge
tags: [bridge-in, attestor, ecdsa, merkle, test-vectors, cross-language-parity, hardhat, tdd]

requires:
  - phase: 15-secure-bridgein-phase-10-amendment
    provides: V2 certificate bridgeIn [0x4d2e0756] on GNUSBridgeAttestor (15-02) — split-encode BRIDGE_CERTIFICATE_V2 digest, epoch-derived thresholds, 16-sig cap, CEI root-transition, twin _mintWithBridgeFee replicas
provides:
  - V2 attestor certificate helpers in test/utils/bridge-certificate.ts — computeBridgeMessageId, computeBridgeInStructHashV2 (flat 13-field reference form), signBridgeInCertificateV2, aggregateCertificateV2, buildAttestorCertificate (side-effect-free, explicit environment)
  - test/fixtures/bridge-attestor-vectors.json — frozen BRIDGE-18 cross-language parity vectors (genesis-transition + active-root-claim; frozen keys/roots/proofs/structHash/eip191Digest/signatures)
  - test/unit/GNUSBridgeAttestorIn.test.ts — 42 tests: BRIDGE-18 vector consumer (V1-V4) + BRIDGE-19 amendment matrix (B1-B7, C1-C8, R1-R6, D1-D9, E1-E6, SPEC :657-707) + fee-replica pairing + [GAS] A1 measurement
  - [GAS] 16-signature certificate: 313,844 gas (research A1 answer — inside the assumed 150-250k-per-sig envelope is NOT applicable; per-sig marginal cost visible in the matrix)
affects: [15-04 (Foundry handler/invariant rewrite consumes the helpers + fixture; full-suite baseline gate closes the EXPECTED RED window)]

tech-stack:
  added: []
  patterns:
    - "Cross-language parity fixture: frozen field/key/proof values with structHash/eip191Digest/signatures bound to the frozen C++ conformance environment (31337 / 0x1111...11); on-chain legs re-sign over the LIVE chainid + deployed diamondAddress"
    - "Digest-mismatch determinism harness: genesis-epoch SINGLE-signature certificates make the foreign recovery always satisfy strict-ascending and always fail membership, pinning the revert to 'Not a registered attestor'; active-epoch 2-sig mismatches (R4) assert bare reversion (Phase-10 precedent GNUSBridgeIn.test.ts:416-448)"
    - "Off-chain sort-by-recovered-address for adversarial sig sets (D9 native vote-bytes): compute the garbage recoveries against the on-chain digest and sort so ordering passes and membership is the pinned failure"
    - "Proof-tree decoupled from cert root in signAndAttach: negatives attach next-tree proofs against the current root (C2/C3, T-15-10)"

key-files:
  created:
    - test/fixtures/bridge-attestor-vectors.json
    - test/unit/GNUSBridgeAttestorIn.test.ts
  modified:
    - test/utils/bridge-certificate.ts

key-decisions:
  - "Off-chain reference computes the FLAT 13-field abi.encode while the chain computes the D-02 split bytes.concat form — byte-identity is PROVEN by V1 (flat == split == fixture structHash for both vectors), never assumed"
  - "buildAttestorCertificate takes an explicit environment ({destChainID, diamondAddress}) with no default — the utility is side-effect-free and cannot query the chain; the live-value override pattern lives in the test wrapper (GNUSBridgeIn.test.ts:139-150 pattern)"
  - "Frozen fixture genesis = Hardhat account-0 key (never used for transactions, Phase-10 vector convention); matrix wallets are Wallet.createRandom() per suite run since roots are env-independent"
  - "transitionTo() directs the genesis-transition mint at the OWNER (sink) so per-test recipient-balance assertions on user1 start from exactly zero"
  - "R6 replay-marker proof: resubmit the SAME over-cap certificate and assert it fails on 'Global max supply exceeded' (not 'Message already processed'), then a corrected fresh-message resubmission succeeds"
  - "D5/D6 assert messageId-UNCHANGED alongside the digest failure — pins BRIDGE-12's replay-key/digest split (recipient/amount are digest-bound only)"

patterns-established:
  - "Vector-fixture schema: environment + constants + attestorSet(with sgPublicKey64 for the C++ side) + vectors[{message, messageId, structHash, eip191Digest, signers[{signature, recoveredAddress, merkleProof}]}] — the schema 15-04 and the C++ exporter consume"

requirements-completed: [BRIDGE-18, BRIDGE-19]

duration: 25min
completed: 2026-08-26
---

# Phase 15 Plan 03: BRIDGE-18 Vectors + BRIDGE-19 Amendment Matrix Summary

Added the V2 attestor-certificate reference helpers, the frozen cross-language parity fixture, and the full BRIDGE-19 amendment matrix — 42 tests covering the 36 SPEC :657-707 checkpoints plus the fee-replica pairing and the A1 gas measurement (313,844 gas for a 16-signature certificate), with the 15-01 regression suite still green.

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-26T23:12:00Z (approx.)
- **Completed:** 2026-08-26T23:37:04Z
- **Tasks:** 3/3
- **Files:** 3 (2 created, 1 modified)

## Accomplishments

### Task 1 — V2 helpers in test/utils/bridge-certificate.ts (927caad)

- Additive-only extension; every Phase-10 export untouched. New surface: `BRIDGE_MESSAGE_ID_V2_DOMAIN` / `BRIDGE_CERTIFICATE_V2_DOMAIN` / `GNUS_TOKEN_ID` constants (with derivations documented), `BridgeMessageV2` (11-field interface, field-order lockstep comment), `BridgeMessageFields` (six canonical SPEC fields), `computeBridgeMessageId` (5-word composite replay key), `computeBridgeInStructHashV2` (FLAT 13-field reference form), `signBridgeInCertificateV2` (EIP-191 wrapped), `aggregateCertificateV2` (delegates to the Phase-10 aggregator), `AttestorMerkleTree`/`AttestorCertificate` types, and `buildAttestorCertificate` (sign → sort → attach proofs from the CALLER-supplied tree; throws on a missing proof; explicit environment, side-effect free).

### Task 2 — BRIDGE-18 fixture + consumer test (96723e9)

- `test/fixtures/bridge-attestor-vectors.json`: two vectors — genesis-transition (1-sig, threshold 1, root 0xe970...52d9 → 0x0391...598d) and active-root-claim (2-of-3, unchanged root). All uint fields stored as strings; frozen keys carry `sgPublicKey64` (X‖Y, 0x04-stripped) for the SuperGenius C++ side; genesis = Hardhat account-0 (never transacts).
- Consumer legs: **V1** flat == split == fixture structHash (D-02 byte-identity, split computed inline); **V2** signatures recover to the recorded addresses, re-sign deterministically (regenerate-and-diff), trees/roots/proofs rebuild from frozen keys; **V3** on-chain round-trip with environment-bound re-sign (LIVE chainid + LIVE diamondAddress) asserting BridgeReleased + BridgeAttestorSetAdvanced(0,1,...) + recipient balance; **V4** native non-EIP-191 vote-bytes signature never verifies (PD-BR-7).

### Task 3 — BRIDGE-19 amendment matrix (a04d848)

- **Bootstrap B1-B7**: zero-address revert + one-leaf-root init event + epoch/threshold getters; double-init; 1-sig genesis claim; empty-sig 'Below threshold'; unchanged-root genesis gate; first-transition event (0,1,oldRoot,newRoot); 1-sig at active epoch fails.
- **Current-root C1-C8**: 2-of-3 happy claim; next-tree-only signers fail vs current root (T-15-10); non-attestor with a borrowed proof; 31-byte malformed sig 'Bad signature'; swapped proofs; duplicate signer; reversed order; 17-of-32 over-cap 'Too many attestor signatures'.
- **Root-transition R1-R6**: unchanged root = no epoch bump and no advance event (negative-event assert); multiple claims per root; changed root = exactly one increment with event args; old-root cert after rotation fails (bare revert — random foreign recoveries); competing rotations — second hits 'Message already processed' with root/epoch reflecting only the first; failed mint atomically reverts root + epoch + replay marker (same-cert re-fails on the cap; corrected resubmission succeeds).
- **Replay/domain D1-D9**: same-event replay; same-tx different eventIndex both bridge in (messageIds differ); sourceBridgeID/srcChainID perturbations change messageId + digest; recipient/amount perturbations change digest with messageId UNCHANGED (BRIDGE-12 split pinned); wrong destChainID; wrong diamondAddress; native vote-bytes at active epoch (sorted by off-chain recovered addresses → deterministic membership failure).
- **Existing-token E1-E6**: 10% fee → 90% received; 1 wei at max fee → 'Bridge fee consumes entire amount' (WR-02); GNUS_MAX_SUPPLY+1 → 'Global max supply exceeded'; totalSupplyOfAll delta is the post-fee amount; BridgeReleased reports the PRE-fee amount; garbage cert while paused → 'GNUSControl: contract paused' (pause-first ordering).
- **Fee-replica pairing (Pitfall 1)**: mint(address,uint256) path and bridgeIn path produce IDENTICAL post-fee balances under the same fee — no twin drift. **[GAS] A1**: 16-of-32 certificate = 313,844 gas.

## Verification Results

| Check | Result |
|---|---|
| Scoped tsc (Task 1 gate): errors mentioning test/utils/bridge-certificate | 0 |
| `npx hardhat test test/unit/GNUSBridgeAttestorIn.test.ts` | 42 passing, 0 failing |
| `npx hardhat test test/unit/GNUSBridgeAttestorUpgrade.test.ts` (15-01 regression) | 10 passing |
| [GAS] 16-sig certificate | 313,844 gas |
| Contract sources touched | none — tests/fixtures/utils only (facet frozen by waves 1-2) |

**EXPECTED RED (per phase plan, NOT gated, NOT modified):** `test/unit/GNUSBridgeIn.test.ts` and `test/foundry/**` still target the removed legacy selectors; their rewrites are owned by 15-03's successor work per the phase plan and the full-suite baseline gate runs at the end of 15-04. Neither file was run or modified here.

## Commits

| Repo | Hash | Subject |
|---|---|---|
| gnus-ai (develop) | 927caad | test(15-03): add V2 attestor certificate helpers to bridge-certificate.ts |
| gnus-ai (develop) | 96723e9 | test(15-03): add BRIDGE-18 vector fixture + consumer test (flat/split equivalence + on-chain round-trip) |
| gnus-ai (develop) | a04d848 | test(15-03): add BRIDGE-19 amendment matrix suite (SPEC 657-727) |

No branches created, no pushes, unsigned commits, no Co-Authored-By trailers. All three commits are outer-repo only (test/utils, test/fixtures, test/unit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixture generator wallet.publicKey unavailable**

- **Found during:** Task 2 (fixture generation script)
- **Issue:** this ethers version does not expose `wallet.publicKey`; the generator threw while emitting `sgPublicKey64`.
- **Fix:** used `wallet.signingKey.publicKey.slice(4)` (uncompressed 0x04‖X‖Y form — slice(4) yields X‖Y). Generator-only; no committed code affected.
- **Files modified:** temp generator script (deleted after use)
- **Commit:** n/a (fixture committed at 96723e9)

No other deviations — the helpers, fixture schema, consumer legs, and all 36 matrix checkpoints executed as designed.

## Threat Model Coverage

- **T-15-17 (digest parity)**: V1 proves flat == split == fixture; D3-D8 pin every digest-bound field's mismatch behavior.
- **T-15-18 (membership vs current root)**: C2/C3/C5 — proofs from any tree other than the current root fail.
- **T-15-19 (deterministic negative surface)**: B4/B5/B7, C4/C6/C7/C8, R4/R5, D1/D9, E2/E3/E6 all assert exact revert strings except R4 (documented bare-revert precedent).
- **T-15-20 (environment binding)**: D7/D8 + V3's environment-bound re-sign.
- **T-15-21 (replay atomicity)**: D1/D2, R5, R6.

## Known Stubs

None — no placeholder values; every test exercises the real deployed diamond facets.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model.

## Self-Check: PASSED

All 3 key files exist on disk; all 3 commits (927caad, 96723e9, a04d848) verified present on develop.
