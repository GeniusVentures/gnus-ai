# Synthesis Summary

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest); **Updated:** 2026-08-23 (Secure-BridgeIn SPEC ingest)
**Mode:** merge
**Classifier output consumed from:** `.planning/intel/classifications/`

## This Run (2026-08-23)

| Metric | Count |
|--------|-------|
| Documents ingested this run | 1 |
| DOC | 0 |
| PRD | 0 |
| ADR | 0 |
| SPEC | 1 (`docs/Secure-BridgeIn.md`) |
| UNKNOWN | 0 |

## Cumulative Ingestion Statistics

| Metric | Count |
|--------|-------|
| Total documents classified | 37 |
| DOC | 33 |
| PRD | 3 |
| ADR | 0 |
| SPEC | 1 |
| UNKNOWN | 0 |

## What This Ingest Adds

The single SPEC (`docs/Secure-BridgeIn.md`, classified high-confidence, `locked: false`) proposes a **rolling API-attestor Merkle root** to replace the permanent validator set + manual `setValidatorSet()` rotation that Phase 10 shipped. The SPEC is implementation-ready: exact Solidity signatures, storage layout, digest format, threshold derivation, certificate verification algorithm, and a six-section test matrix.

**Scope classification: NEW phase (tentatively "Phase 15: Secure BridgeIn V2" or a Phase 10 amendment), NOT Phase 13 overlap.**

### Decisions

- **New locked decisions:** 0 (the SPEC is `locked: false`)
- **Proposed decisions recorded:** 8 (PD-BR-1 through PD-BR-8 in `.planning/intel/decisions.md`)
  - PD-BR-1: Replace permanent validator root with rolling API-attestor root (would amend Phase 10 D-15/D-16)
  - PD-BR-2: Genesis bootstrap → 2-of-N active attestor threshold (would amend Phase 10 D-12)
  - PD-BR-3: Canonical BridgeMessage struct + composite replay key (would amend Phase 10 D-06)
  - PD-BR-4: BRIDGE_CERTIFICATE_V2 domain-separated digest (would extend Phase 10 D-08/D-10)
  - PD-BR-5: Strict-ascending signers + per-signer Merkle proof (ALIGNED with Phase 10 D-13, adds hardening)
  - PD-BR-6: Remove legacy `bridgeIn` selector + restrict `setValidatorSet` (would amend shipped Phase 10 surface)
  - PD-BR-7: Native `ConsensusVote.signature` NOT directly verifiable on EVM (ALIGNED with Phase 10 D-11)
  - PD-BR-8: SuperGenius#363 and #364 are blocking prerequisites (external cross-repo dependency)
- **Existing locked decisions:** Phase 10 D-01..D-22 unchanged, Phase 13 D1-D13 unchanged, Phase 14 PD-1..PD-7 unchanged

### Requirements

- **New requirement candidates:** 10 (REQ-bridge-attestor-v2-storage through REQ-bridge-v2-test-matrix in `.planning/intel/requirements.md`)
- All candidates marked **pending roadmapper acceptance + Phase 10 CONTEXT amendment** — `.planning/REQUIREMENTS.md` is NOT modified by this synthesis
- Existing 22 remediation requirements + Phase 8-14 requirements unchanged
- 3 infrastructure PRDs (INFRA-PRD-01..03) still acknowledged as out-of-scope

### Constraints

- **New constraints:** 11 (C-BR-1 through C-BR-11 in `.planning/intel/constraints.md`)
  - C-BR-1: Append-only storage layout for GNUSBridgeValidatorStorage V2 (schema)
  - C-BR-2: BridgeMessage struct (api-contract)
  - C-BR-3: Replay message ID derivation with BRIDGE_MESSAGE_ID_V2 domain (api-contract)
  - C-BR-4: BRIDGE_CERTIFICATE_V2 digest with root transition binding (protocol)
  - C-BR-5: Epoch-derived signature thresholds GENESIS=1 / ACTIVE=2 / MAX=16 (protocol)
  - C-BR-6: Strict-ascending signer ordering + per-signer Merkle proof (protocol)
  - C-BR-7: Rolling root transition semantics (protocol)
  - C-BR-8: EVM-specific certificate signature format (api-contract)
  - C-BR-9: Legacy selector removal + setValidatorSet restriction (protocol)
  - C-BR-10: SuperGenius-side prerequisites #363 and #364 (protocol, external dependency)
  - C-BR-11: SuperGenius nextAttestorRoot construction policy (protocol, off-chain)

### Context

- **New topic cluster:** Secure BridgeIn with Rolling API-Attestor Roots (11 sub-topics in `.planning/intel/context.md`)
- Cross-references established to Phase 9 (treasury/reserve — orthogonal), Phase 10 (validator set + bridgeIn authorization — DIRECT engagement), Phase 13 (13-06 — explicitly excluded), Phase 14 (orthogonal — layered on top of existing bridge)
- Existing context sections (Smart Contract Ecosystem, Testing, Deployment, DevContainer, Private-Network AI Licensing) unchanged

## Conflicts

| Severity | Count | Details |
|----------|-------|---------|
| BLOCKERS | 0 | No locked contradictions, no cycles, no UNKNOWN docs |
| WARNINGS | 0 | No competing variants — SPEC amendments to locked Phase 10 decisions are recorded verbatim for CONTEXT-amendment routing, not as a pick-one user gate |
| INFO | 7 | Four auto-resolved SPEC-vs-Phase-10-CONTEXT divergences (D-06, D-08/D-10, D-12, D-15/D-16); one alignment note (D-11, D-13); one Phase 13 non-overlap note (13-06 excludes bridgeIn); one new-phase scope classification note |

See: `.planning/INGEST-CONFLICTS.md` for the full three-bucket report.

## Key Points for the Roadmapper

1. **Phase 10 CONTEXT stands.** The SPEC proposes amendments to D-06, D-08, D-10, D-12, D-15, D-16 but does NOT unlock them. The shipped validator merkle root + manual `setValidatorSet()` rotation path remains canonical until the roadmapper routes this SPEC through Phase 10 CONTEXT amendment (or a new phase CONTEXT explicitly superseding those decisions).

2. **Phase 13 is untouched.** 13-06-PLAN explicitly states "No changes to bridgeIn" — Phase 13 work is not blocked by this SPEC. However, the SPEC's requirement to REMOVE the legacy `bridgeIn` selector WILL collide with in-flight Phase 13 testing if the new bridge-security phase is scheduled before Phase 13 completes. Sequence accordingly.

3. **Phase 14 is untouched.** Phase 14 (Private-Network AI Licensing) layers on top of the existing bridge and does not modify validator management. PD-1 through PD-7 remain valid proposals for Phase 14.

4. **New phase candidate.** This SPEC proposes NEW scope for a future phase (tentatively "Phase 15: Secure BridgeIn V2" or a Phase 10 amendment). External dependencies on SuperGenius#363 and #364 must be tracked as cross-repo gating items in `.planning/SUBREPOS.md` when the new phase is scheduled.

5. **Alignment already present.** Two of the SPEC's eight proposals are already aligned with locked Phase 10 decisions: PD-BR-5 (strict-ascending signers, per-signer Merkle proofs — aligned with D-13) and PD-BR-7 (no native SG envelope on-chain — aligned with D-11). These do NOT require CONTEXT amendment; they are hardening within the existing locked frame.

6. **Six of eight proposals require CONTEXT amendment.** PD-BR-1, PD-BR-2, PD-BR-3, PD-BR-4, PD-BR-6, PD-BR-8 each engage a locked Phase 10 decision and must be routed through CONTEXT amendment before any implementation work begins.

7. **Format note.** The source doc is a ChatGPT-conversation export (`docs/Secure-BridgeIn.md` lines 1-9, 783-785). The technical content is intact and unambiguous; the surrounding chat metadata is not load-bearing. The SPEC is implementation-ready and suitable for direct LLM-assisted implementation once CONTEXT is amended.

## Per-Type Intel Files

| File | Contents |
|------|----------|
| `.planning/intel/decisions.md` | PD-1 through PD-7 (Phase 14) + PD-BR-1 through PD-BR-8 (new bridge-security phase) + existing locked decision pointers |
| `.planning/intel/requirements.md` | 7 Phase 14 requirement candidates + 10 new bridge-security requirement candidates + unchanged existing set + infra PRDs out-of-scope |
| `.planning/intel/constraints.md` | C-PN-1 through C-PN-7 (Phase 14) + C-BR-1 through C-BR-11 (new bridge-security phase) + unchanged existing constraints |
| `.planning/intel/context.md` | 10 sub-topics on Private-Network AI Licensing + 11 sub-topics on Secure BridgeIn + unchanged prior context |
| `.planning/INGEST-CONFLICTS.md` | 0 blockers, 0 warnings, 7 INFO entries |

## Status: READY

No blockers. No competing variants. The SPEC's amendments to locked Phase 10 decisions are recorded verbatim for CONTEXT-amendment routing — this is the standard path for any follow-on work that engages locked decisions, not a gate. Safe to route to `gsd-roadmapper` for new-phase CONTEXT-gathering (or Phase 10 amendment CONTEXT).

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended Private-Network AI Licensing synthesis from `private-network-ai.md` + 7 owner resolutions_
_Updated: 2026-08-23 — appended Secure BridgeIn synthesis from `docs/Secure-BridgeIn.md` SPEC_
