# Synthesis Summary

**Synthesized:** 2026-05-26 (initial 35-doc ingest); **Updated:** 2026-08-03 (private-network-ai.md ingest)
**Mode:** merge
**Classifier output consumed from:** `.planning/intel/classifications/`

## This Run (2026-08-03)

| Metric | Count |
|--------|-------|
| Documents ingested this run | 1 |
| DOC | 1 (`private-network-ai.md`) |
| PRD | 0 |
| ADR | 0 |
| SPEC | 0 |
| UNKNOWN | 0 |

## Cumulative Ingestion Statistics

| Metric | Count |
|--------|-------|
| Total documents classified | 36 |
| DOC | 33 |
| PRD | 3 |
| ADR | 0 |
| SPEC | 0 |
| UNKNOWN | 0 |

## What This Ingest Adds

The single DOC (`private-network-ai.md`) proposes a **Private-Network AI Licensing** model that layers on top of Phase 13 (locked 2026-08-03) and is expected to derive a new Phase 14. Seven authoritative owner resolutions accompanied the ingest and were treated as locked input, superseding the doc where they differ.

### Decisions

- **New locked decisions:** 0 (the doc is DOC-precedence, `locked: false`)
- **Proposed decisions recorded:** 7 (PD-1 through PD-7 in `.planning/intel/decisions.md`)
  - PD-1: Public-canonical = existing EVM diamond; private = SuperGenius chain (owner-resolved)
  - PD-2: Company tenants only; no Individual User License NFTs (owner-resolved)
  - PD-3: New NFT struct fields `networkScope`, `privateNetworkId`, `publicSettlementEnabled` (owner-resolved)
  - PD-4: Fixed minion-denominated SKU pricing, no USD oracle (owner-resolved)
  - PD-5: Hybrid-scope tokens must be REDEEM_TO_PARENT-capable (owner-resolved)
  - PD-6: Phase 13 mechanisms referenced, not redefined (owner-resolved)
  - PD-7: **OPEN** — private-spend against public-canonical balance settlement pattern
- **Existing locked decisions:** Phase 13 D1-D13 unchanged (byte-identical CONTEXT)

### Requirements

- **New requirement candidates:** 7 (REQ-private-network-licensing, REQ-network-scope-struct, REQ-product-sku-registry, REQ-payment-router, REQ-license-activation-event, REQ-hybrid-redeemability, REQ-private-network-spend-design)
- All candidates are marked **pending roadmapper acceptance** — `.planning/REQUIREMENTS.md` is NOT modified by this synthesis
- Existing 22 requirements (DEBT-01 through DEP-01) unchanged
- 3 infrastructure PRDs (INFRA-PRD-01..03) still acknowledged as out-of-scope

### Constraints

- **New constraints:** 7 (C-PN-1 through C-PN-7 in `.planning/intel/constraints.md`)
  - C-PN-1: NetworkScope enum schema (schema)
  - C-PN-2: NFT struct field ordering — append-only (schema)
  - C-PN-3: Product/SKU registry minion-denominated (schema)
  - C-PN-4: Hybrid-scope redeemability invariant (nfr)
  - C-PN-5: Public chain canonical for billing/settlement/audit (protocol)
  - C-PN-6: LicenseActivated event api-contract (api-contract)
  - C-PN-7: Phase 13 mechanisms referenced, not redefined (protocol)

### Context

- **New topic cluster:** Private-Network AI Licensing (10 sub-topics in `.planning/intel/context.md`)
- Cross-references established to Phase 9 (mintBackedChild), Phase 10 (bridge vault), Phase 12 (supply ledger), Phase 13 (D1-D13)
- Existing context sections (Smart Contract Ecosystem, Testing, Deployment, DevContainer) unchanged

## Conflicts

| Severity | Count | Details |
|----------|-------|---------|
| BLOCKERS | 0 | No locked contradictions, no cycles, no UNKNOWN docs |
| WARNINGS | 0 | No competing variants — owner resolutions authoritatively supersede the doc where they differ |
| INFO | 4 | D11 coherence with "much better model" claim; bridge/mirror mapped to existing bridge; USD-oracle sketch superseded; PD-7 open design question recorded |

See: `.planning/INGEST-CONFLICTS.md` for the full three-bucket report.

## Key Points for the Roadmapper

1. **Phase 13 is untouched.** The doc layers new scope ON TOP. D1-D13 stand byte-identical. The doc's "much better model" line is coherent with D11 once you apply owner resolution #2 (D11 scoped to individuals; Phase 14 adds company tenants).

2. **Phase 14 candidate scope is fully owner-resolved.** No WARNINGs, no competing variants. The roadmapper can route directly to Phase 14 CONTEXT-gathering without a user pick.

3. **One explicit OPEN question (PD-7).** Private-spend settlement pattern (bridged burn events vs mirror + periodic settlement) is recorded as an open design question for Phase 14 CONTEXT, informed by Phase 10 vault work. NOT a blocker.

4. **Storage ordering invariant.** Phase 14 fields (`networkScope`, `privateNetworkId`, `publicSettlementEnabled`) append AFTER Phase 13 D1 fields in the `NFT` struct. Whichever phase lands second appends after the other. Single PR owns each struct diff.

5. **Dependencies:** Phase 14 depends on Phase 13 (lifecycle) and transitively on Phase 9 (reserve/mintBackedChild for Hybrid redemption) and Phase 10 (bridge for public-canonical ↔ private-execution).

6. **Classifier ambiguity note.** The classifier flagged the doc as borderline DOC/unnumbered-ADR (medium confidence). Recommendation: when Phase 14 CONTEXT is locked, promote PD-1 through PD-6 into a proper numbered ADR. Not a synthesis blocker.

## Per-Type Intel Files

| File | Contents |
|------|----------|
| `.planning/intel/decisions.md` | PD-1 through PD-7 (7 proposed, 1 explicitly OPEN) + existing locked decision pointers |
| `.planning/intel/requirements.md` | 7 new requirement candidates for Phase 14 + unchanged existing set + infra PRDs out-of-scope |
| `.planning/intel/constraints.md` | C-PN-1 through C-PN-7 (schema/api-contract/nfr/protocol) + unchanged existing constraints |
| `.planning/intel/context.md` | 10 sub-topics on Private-Network AI Licensing + unchanged prior context |
| `.planning/INGEST-CONFLICTS.md` | 0 blockers, 0 warnings, 4 INFO entries |

## Status: READY

No blockers. No competing variants. One open design question (PD-7) explicitly recorded as non-blocking per owner resolution #7. Safe to route to `gsd-roadmapper` for Phase 14 CONTEXT-gathering.

---

_Initial synthesis: 2026-05-26 from 35 classification files_
_Updated: 2026-08-03 — appended Private-Network AI Licensing synthesis from `private-network-ai.md` + 7 owner resolutions_
