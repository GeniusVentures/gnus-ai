---
phase: 15-secure-bridgein-phase-10-amendment
plan: "04"
subsystem: bridge
tags: [bridge-in, attestor, legacy-removal, foundry-invariants, exporter-abi, cross-language-parity, phase-exit]

requires:
  - phase: 15-secure-bridgein-phase-10-amendment
    provides: V2 certificate bridgeIn + legacy-selector removal (15-02), BRIDGE-18 fixture + BRIDGE-19 matrix + V2 helpers (15-03)
provides:
  - Rewritten test/unit/GNUSBridgeIn.test.ts — loupe-proven legacy-selector removal (0x0bee6121/0x1abd0f1e), D-05 emergency-recovery block, carried Phase-10 semantics re-keyed to V2 (BRIDGE-19 extension)
  - Foundry surface retarget — handler_bridgeIn on 0x4d2e0756 (tuple encoding, seed-derived pseudo next-root, messageId-keyed ghosts); Bridge/Conservation setUps bootstrap via initializeBridgeAttestorV2
  - docs/Secure-BridgeIn-Exporter-ABI.md — SPEC deliverables 5+7: exact ABI, flat 13-field digest spec, Merkle/EIP-191 conventions, security note, BRIDGE-17 production gate (#363 OPEN / #364 CLOSED)
  - Phase-exit baselines — Hardhat 661/2/1 (only the known-stale GNUSControlStorage chainID), Foundry 215/2/3 (only the two Phase 08.1 setUp reverts + 3 skips)
affects: []
tech-stack:
  added: []
  patterns:
    - "Loupe-based removal proof: facetAddress(selector) == zero for removed selectors + facet selector-list containment for the V2 quartet — hex selector literals only, so the zero-legacy-reference grep gate cannot match its own assertions"
    - "Handler-derived replay keys: the Foundry handler computes the V2 messageId off-chain (keccak over the domain + four identity fields) in lockstep with _bridgeMessageId, keeping the vm.load slot formula (mapping at field index 0) byte-identical while only the key derivation changed"
    - "Seed-derived pseudo next-root keccak256(abi.encode(seed)): never zero and never the Genesis one-leaf root, so epoch-0 fuzz calls pass the genesis-advance gate and die inside the verifier — the soundness invariant keeps testing the verifier, not an earlier guard"

key-files:
  created:
    - docs/Secure-BridgeIn-Exporter-ABI.md
  modified:
    - test/unit/GNUSBridgeIn.test.ts
    - test/foundry/handlers/GeniusDiamondHandler.sol
    - test/foundry/invariant/BridgeInvariant.t.sol
    - test/foundry/invariant/ConservationInvariant.t.sol

key-decisions:
  - "Removal is proven through the diamond loupe, not the typechain: facetAddress on the two removed selectors returns the zero address across ALL facets, the bridge facet's selector list (identified via bridgeOut) contains neither, and all four V2 selectors resolve to one facet that lists them — registry wiring proven end-to-end; the raw legacy-selector call reverts (no fallback)"
  - "[Rule 3] Both Foundry invariant setUps now call setChainID(block.chainid) alongside initializeBridgeAttestorV2 — nothing in the Foundry harness ever set the diamond's chainID (default 0), so every bridgeIn call would have reverted at the dest-chain guard; the Phase-10 Foundry campaign had the same latent gap (the legacy path carried the same guard), so the soundness invariant now reaches the verifier for the first time"
  - "ghost_releasedIds keyed by the handler-derived V2 messageId (not the fuzzed sourceTxHash) — correctness over convenience; BridgeInvariant's slot formula is unchanged, only the key derivation"
  - "Exporter doc pins the FLAT 13-field abi.encode as the C++ contract (what the exporter computes) and documents the on-chain split-encode as byte-identical-by-proof (vector leg V1), never by assumption (T-15-24)"
  - "BRIDGE-17 left Pending in REQUIREMENTS.md by design: the EVM-side deliverable (gate recorded) is done, but the requirement text gates PRODUCTION activation on #363 (OPEN) closing"

patterns-established:
  - "Post-removal suite shape: describe('legacy selector removal') with hex-selector loupe asserts + raw-call revert, followed by carried-semantics blocks re-keyed through the shared buildAttestorCertificate helper — the template for any future removed-selector rewrite"

requirements-completed: [BRIDGE-19]

duration: 35min
completed: 2026-08-27
---

# Phase 15 Plan 04: Legacy Suite Rewrite + Foundry Retarget + Exporter Spec Summary

Closed the EXPECTED RED window: rewrote the legacy Hardhat bridge-in suite for the post-removal V2 surface (23 tests — loupe removal proof, D-05 emergency recovery, all carried Phase-10 semantics re-keyed), retargeted the Foundry handler and both bridge-touching invariant suites to selector 0x4d2e0756 with the one-time Genesis bootstrap, wrote the SuperGenius exporter ABI/digest spec with the BRIDGE-17 production-activation gate, and re-established the full-suite baselines at the phase exit.

## Performance

- **Duration:** ~35 min (2026-08-26T23:43:02Z → 2026-08-27T00:18:11Z)
- **Tasks:** 4/4
- **Files:** 5 (1 created, 4 modified) — all outer-repo; zero contract-source touches

## Accomplishments

### Task 1 — Rewrite GNUSBridgeIn.test.ts (8c8320a)

- **legacy selector removal (BRIDGE-16/D-06):** loupe proof — `facetAddress` returns zero for `0x0bee6121`/`0x1abd0f1e` across all facets; the bridge facet (identified via its surviving `bridgeOut` selector) lists neither; all four V2 selectors (`0x4d2e0756`/`0x8c864f52`/`0x604c3b10`/`0x669588d5`) resolve to one facet whose selector list contains them; a raw hand-encoded call to the legacy selector reverts (no fallback). Hex literals only — zero function-name strings, so the grep gate holds.
- **emergencyRecoverAttestorSet (D-05):** non-superAdmin / unpaused / zero-root / uninitialized reverts; success emits `BridgeAttestorEmergencyReset(oldEpoch, oldEpoch+1, oldRoot, newRoot)` with epoch increment and the init flag staying one-shot (Genesis structurally unrecoverable); post-recovery `bridgeIn` works 2-of-N against the recovery root and 1-of-N fails `Below threshold`.
- **carried Phase-10 semantics re-keyed to V2 (BRIDGE-19):** below-threshold, happy-path mint + `BridgeReleased(messageId, ...)`, bridge fee (event pre-fee / balance post-fee), globalSupply delta, replay, wrong-dest-chain + cross-diamond (bare-revert precedent), unsorted + duplicate signers, non-attestor, paused, global cap, and the D-18 `mint(address,uint256)` regression verbatim. Helpers copied in-lockstep from `GNUSBridgeAttestorIn.test.ts` (no divergent duplicates).
- Dropped the Phase-10 canonical-vector console.log block (superseded by the BRIDGE-18 fixture); threshold-setter coverage deliberately omitted with a pointer to `GNUSBridgeAttestorUpgrade.test.ts`.

### Task 2 — Foundry retarget (4039f5b)

- `handler_bridgeIn` keeps its fuzz signature (param renamed `sourceTxHash`) and now calls `0x4d2e0756` with the `BridgeMessage` tuple (imported from the facet — no mirror struct), `nextRoot = keccak256(abi.encode(seed))` (never zero, never the one-leaf Genesis root → epoch-0 calls pass the genesis-advance gate and die in verification), the same deterministic-invalid 65-byte seed signature + empty proof, and ghosts keyed by the handler-derived V2 messageId.
- Both invariant setUps bootstrap via `initializeBridgeAttestorV2(0x…deadbeef)` (fixed nonzero one-leaf root — T-10-F02 non-vacuity preserved) and now alias `setChainID(block.chainid)` (see Deviations). Conservation keeps `selectors[6] = handler_bridgeIn.selector`; slot formula unchanged (mapping at field index 0).
- `grep setValidatorSet test/foundry` → 0.

### Task 3 — Exporter ABI + digest spec (88d8621)

- `docs/Secure-BridgeIn-Exporter-ABI.md`: exact `bridgeIn` ABI + BridgeMessage field table, admin/view signatures with access/pause preconditions and every guard revert string in execution order; the flat 13-field `abi.encode` digest spec with both domain constants, EIP-191 wrapping, 65-byte low-s `r||s||v` form, Merkle conventions (20-byte packed leaves, sorted pairs, odd-node promotion, one-leaf root==leaf), and the epoch/threshold rules; pointers to the BRIDGE-18 fixture + `bridge-certificate.ts`; the deliverable-7 security note (bootstrap, 2-of-N, rotation-as-side-effect + emergency-only admin path, replay protection, PD-BR-7 native-signature exclusion, non-API-node exclusion); and the BRIDGE-17 gate table.

### Task 4 — Phase-exit baseline gate

| Check | Result |
|---|---|
| `npx hardhat test` (full) | **661 passing / 2 pending / 1 failing** — the only failure is the known-stale `GNUSControlStorage` chainID cross-suite pollution (NEVER fixed) |
| `yarn forge:test` | **215 passed / 2 failed / 3 skipped** — only the two Phase 08.1 Safe-proposer setUp reverts; Bridge (2 passed) + Conservation (4 passed) suites green with the afterInvariant coverage guard proving `ghost_bridgeInCalls > 0` and `ghost_bridgeInSuccesses == 0` |
| Bytecode (EIP-170 ≤ 24,576 B) | GNUSBridge **19,938 B**, GNUSBridgeAttestor **21,536 B** — both OK |
| `GNUSBridgePolicy.test.ts` spot-check | 13 passing (D-24 surface unaffected) |
| Count shift vs 606/2/1 baseline | Intentional: rewritten legacy suite (23) + 15-03 matrix (42) + 15-01 upgrade suite (10) replace/augment the original bridge-in coverage; no failures beyond the known-stale set |

## BRIDGE-17 Production-Activation Gate (tracking record)

Production activation of `bridgeIn` requires BOTH SuperGenius issues closed — **#363 (slot quorum uses only signature-verified votes) OPEN**, **#364 (slot 0 identifies the API RPC that actually succeeded for that exact claim) CLOSED**. Parallel work in the SuperGenius repo, not local blockers (owner ruling 2026-08-26). No `.planning/SUBREPOS.md` exists in this submodule — this section and `docs/Secure-BridgeIn-Exporter-ABI.md` §5 are the tracking record.

## Commits

| Repo | Hash | Subject |
|---|---|---|
| gnus-ai (develop) | 8c8320a | test(15-04): rewrite GNUSBridgeIn suite for the post-removal V2 surface |
| gnus-ai (develop) | 4039f5b | test(15-04): retarget Foundry handler + Bridge/Conservation invariants to the V2 selector |
| gnus-ai (develop) | 88d8621 | docs(15-04): add Secure BridgeIn exporter ABI + digest spec (SPEC deliverables 5+7) |

No branches, no pushes, unsigned commits, no Co-Authored-By trailers, no contract-source changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Foundry setUps required `setChainID(block.chainid)`

- **Found during:** Task 2 (invariant retarget)
- **Issue:** the plan requires the fuzz campaign to "get past the genesis-advance gate and die in verification", but nothing in the Foundry harness ever sets the diamond's `chainID` storage (defaults to 0) while `block.chainid` is 31337 — every `bridgeIn` call would revert at `Wrong destination chain`, never reaching the verifier. (The Phase-10 campaign had the same latent gap: the legacy path carried the identical guard at line 476 of the pre-removal source, so its soundness invariant was unknowingly testing the chain guard.)
- **Fix:** added `setChainID(block.chainid)` (mirroring the Hardhat suites' Phase-10 10-03 pattern) to both `BridgeInvariant.setUp` and `ConservationInvariant.setUp`, alongside the planned `initializeBridgeAttestorV2` bootstrap. Verified safe for the other Conservation handlers (`bridgeOut`'s different-chain guard: 137 != 31337 passes exactly as 137 != 0 did).
- **Files modified:** test/foundry/invariant/BridgeInvariant.t.sol, test/foundry/invariant/ConservationInvariant.t.sol
- **Commit:** 4039f5b

**2. [Rule 3 - Blocking] Handler needed the facet's `BridgeMessage` type

- **Found during:** Task 2 (handler retarget)
- **Issue:** `abi.encodeWithSignature` cannot encode a tuple argument from loose values — the V2 call needs the struct type.
- **Fix:** import the canonical file-scope `BridgeMessage` from `contracts/gnus-ai/GNUSBridgeAttestor.sol` (foundry remappings already resolve the facet's imports) instead of declaring a mirror struct that could drift. No behavioral surface added.
- **Files modified:** test/foundry/handlers/GeniusDiamondHandler.sol
- **Commit:** 4039f5b

Otherwise the plan executed exactly as written — the rewritten suite, retarget, exporter doc, and gate all matched their specified shapes.

## Threat Model Coverage

- **T-15-22 (weakened carried tests):** every carried semantic enumerated and re-keyed (fee/cap/supply/replay/domain/pause/D-18); removal proven via loupe selector ownership, not absence-of-compile.
- **T-15-23 (campaign silently skipping bridgeIn):** afterInvariant coverage guard (`ghost_bridgeInCalls > 0`) passed in both suites; setUp `require`s on bootstrap + chainID alias success.
- **T-15-24 (wrong digest spec exported):** every doc constant cross-checked against the facet source and the fixture (`BRIDGE_CERTIFICATE_V2`/`BRIDGE_MESSAGE_ID_V2` literals, all six selectors recomputed); flat form pinned with split==flat proven by V1.
- **T-15-25 (BRIDGE-17 gate lost):** recorded in the exporter doc §5 AND this SUMMARY with issue numbers + status.
- **T-15-26 (baseline drift masked as known-stale):** exact final counts recorded above; only the two documented known-stale classes appear.

## Known Stubs

None — every test exercises the real deployed diamond; the doc contains no placeholder values.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model (the Foundry `setChainID` call is test-harness-only configuration mirroring the Hardhat pattern).

## Self-Check: PASSED

All 5 deliverable files exist on disk; all 3 task commits (8c8320a, 4039f5b, 88d8621) verified on develop via `git log`.
