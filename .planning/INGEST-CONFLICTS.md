## Conflict Detection Report

**Generated:** 2026-08-23
**Mode:** merge
**Ingest set (this run):** 1 classified document (0 DOC, 0 PRD, 0 ADR, 1 SPEC)
**Source doc:** `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/docs/Secure-BridgeIn.md`
**Classification:** SPEC, confidence high, `locked: false`, no manifest override
**Existing context checked:** `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` (D-01..D-22 locked 2026-08-17), `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` (D1-D13 locked 2026-08-03), `.planning/phases/13-time-bound-erc1155-entitlements/13-06-PLAN.md` (in-flight, plan not yet executed)

### BLOCKERS (0)

No unresolved blockers detected.

- No LOCKED-vs-LOCKED ADR contradictions (no ADRs in ingest set; the SPEC is `locked: false`).
- No LOCKED-in-ingest vs existing-locked-CONTEXT contradictions that auto-block. The SPEC proposes content that would AMEND six locked Phase 10 decisions if accepted, but because the SPEC itself is not locked, the locked Phase 10 CONTEXT wins by precedence. These are recorded as INFO (auto-resolved in favor of Phase 10 CONTEXT) below, with the explicit understanding that the roadmapper must route this SPEC through CONTEXT amendment before any implementation work begins.
- No UNKNOWN-confidence-low classifications. The single doc is typed SPEC with high confidence.
- No cross-reference cycles. The SPEC's `cross_refs` are `GNUSBridge.sol`, `GNUSBridgeValidatorStorage.sol`, `GeniusVentures/SuperGenius#363`, `GeniusVentures/SuperGenius#364`, `GeniusVentures/gnus-ai-contracts` — all source files or external GitHub issues, none of which are themselves classified docs in the ingest set. The reference graph is a star with the SPEC at the center and no outgoing edges to other classified docs.

### WARNINGS (0)

No competing variants requiring user pick.

- No PRD-vs-PRD acceptance divergence (no PRDs in this ingest).
- No SPEC-vs-SPEC divergence (this is the only SPEC).
- The SPEC's six points of engagement with locked Phase 10 decisions are NOT competing variants — they are amendments to be resolved through CONTEXT, not through a "pick one of two valid alternatives" user gate. The Phase 10 locked text and the SPEC's proposed text are both preserved verbatim in `.planning/intel/decisions.md` (PD-BR-1..PD-BR-8) for the roadmapper to route through the CONTEXT-amendment workflow.

### INFO (7)

[INFO] Auto-resolved: SPEC-precedence defers to Phase 10 CONTEXT on transferId derivation
  Found: docs/Secure-BridgeIn.md (lines 240-291) proposes a canonical BridgeMessage struct with composite replay key derived from `BRIDGE_MESSAGE_ID_V2 + srcChainID + sourceBridgeID + sourceTxHash + sourceEventIndex`
  Expected: .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md D-06 (locked 2026-08-17) — "Canonical transferId = the source-chain burn transaction hash (keccak of the source EVM tx). This matches the SG-side identity scheme (/bridge/executed/{chainid}:{tx_hash})"
  Note: SPEC (precedence 2) defers to locked Phase 10 CONTEXT (precedence 1-equivalent for planning purposes). D-06 stands. The SPEC's composite-key scheme is recorded in intel/decisions.md as PD-BR-3 with explicit conflict annotation. Roadmapper must route through Phase 10 CONTEXT amendment (or new phase CONTEXT explicitly superseding D-06) before any implementation work begins. Until then, the existing transferId derivation is canonical.
  Sources: docs/Secure-BridgeIn.md (lines 240-291), .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md (D-06)

[INFO] Auto-resolved: SPEC-precedence defers to Phase 10 CONTEXT on certificate digest shape
  Found: docs/Secure-BridgeIn.md (lines 351-408) proposes a BRIDGE_CERTIFICATE_V2 domain constant and a digest binding currentAttestorRoot + currentAttestorEpoch + nextAttestorRoot in addition to the existing fields
  Expected: .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md D-08 + D-10 (locked 2026-08-17) — digest commits to `transferId, srcChainID, destChainID, address(diamond), recipient, tokenId, amount` via EIP-191
  Note: SPEC defers to locked Phase 10 CONTEXT. D-08 and D-10 stand. The SPEC's extension is recorded as PD-BR-4. Cross-chain / cross-diamond replay protection (D-08) is preserved in the SPEC's design — the extension is additive, not contradictory in spirit, but the exact byte-level digest shape diverges and requires CONTEXT amendment.
  Sources: docs/Secure-BridgeIn.md (lines 351-408), .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md (D-08, D-10)

[INFO] Auto-resolved: SPEC-precedence defers to Phase 10 CONTEXT on validator set management
  Found: docs/Secure-BridgeIn.md (lines 80-122, 583-618) proposes replacing the permanent validator merkle root + setValidatorSet routine rotation with a rolling API-attestor root that self-rotates as a side-effect of bridgeIn calls
  Expected: .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md D-15 + D-16 (locked 2026-08-17) — "the diamond stores a threshold plus a merkle root … Rotation is less frequent than per-validator admin calls." D-16: "a manually-updated merkle root is acceptable" (deferred mechanism)
  Note: SPEC defers to locked Phase 10 CONTEXT. D-15 and D-16 stand. The SPEC's rolling-root design is recorded as PD-BR-1 and PD-BR-6. This is the LARGEST divergence between the SPEC and the shipped Phase 10 surface — the SPEC explicitly retires the routine setValidatorSet path that Phase 10 shipped. Roadmapper must route through CONTEXT amendment. Production deployments currently rely on the D-15 manual-rotation path; do not implement the SPEC without explicit Phase 10 amendment or new-phase CONTEXT supersession.
  Sources: docs/Secure-BridgeIn.md (lines 80-122, 583-618), .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md (D-15, D-16)

[INFO] Auto-resolved: SPEC-precedence defers to Phase 10 CONTEXT on threshold derivation
  Found: docs/Secure-BridgeIn.md (lines 181-197) proposes hard-coded epoch-derived thresholds (GENESIS=1, ACTIVE=2, MAX=16) that the certificate cannot choose
  Expected: .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md D-12 (locked 2026-08-17) — "On-chain threshold: m-of-n over a diamond-registered validator set (e.g., 2/3 + 1 of registered validators). SG's >3/4 slot-weighted quorum remains off-chain; the on-chain threshold is the attestation floor."
  Note: SPEC defers to locked Phase 10 CONTEXT. D-12 stands. The SPEC's epoch-derived threshold policy is recorded as PD-BR-2. The two are not strictly incompatible — the SPEC could be implemented as a specific instance of D-12's "m-of-n" — but the SPEC removes the operator's ability to set the threshold via setValidatorSet, which D-12 presumes. CONTEXT amendment required.
  Sources: docs/Secure-BridgeIn.md (lines 181-197), .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md (D-12)

[INFO] Auto-resolved: SPEC is aligned with Phase 10 D-11 and D-13 (no conflict, recorded for completeness)
  Found: docs/Secure-BridgeIn.md (lines 60, 132-151, 411-458) — native ConsensusVote.signature is NOT EVM-verifiable (64-byte non-recoverable, double-SHA-256, little-endian scalars); SG exporter must produce a separate 65-byte r‖s‖v signature; signers must be strictly ascending with per-signer Merkle proofs
  Note: Fully aligned with .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md D-11 (locked 2026-08-17: SG consensus envelope not used on-chain) and D-13 (locked 2026-08-17: strictly ascending signers, duplicate-proof). No CONTEXT amendment needed for these points. The SPEC adds hardening (16-signature cap, per-signer Merkle proof requirement, low-s canonical form) but does not contradict the locked decisions.
  Sources: docs/Secure-BridgeIn.md (lines 60, 132-151, 411-458), .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md (D-11, D-13)

[INFO] New scope, NOT Phase 13 overlap — 13-06-PLAN explicitly excludes bridgeIn changes
  Found: .planning/phases/13-time-bound-erc1155-entitlements/13-06-PLAN.md (line 88): "No changes to bridgeIn, withdraw paths, or any other function in the file" — the in-flight Phase 13 plan touches GNUSBridge.sol ONLY for bridgeOut policy wiring (insertion at line 249, before limiter charge)
  Note: The SPEC's bridgeIn replacement does NOT overlap Phase 13 scope. However, the SPEC's requirement to REMOVE the legacy bridgeIn selector WILL collide with any in-flight Phase 13 testing that exercises the existing bridgeIn shape. The proposed new bridge-security phase must sequence AFTER Phase 13 completes, OR explicitly amend 13-06 to acknowledge the selector removal. Recorded as informational — the roadmapper will sequence this when scoping the new phase. No CONTEXT amendment to Phase 13 is required because Phase 13 does not touch bridgeIn.
  Sources: .planning/phases/13-time-bound-erc1155-entitlements/13-06-PLAN.md (line 88), docs/Secure-BridgeIn.md (lines 583-618)

[INFO] New phase candidate — does not fit within existing Phase 14 scope
  Found: docs/Secure-BridgeIn.md scope is bridge-validator management and bridgeIn authorization — orthogonal to Phase 14 (Private-Network AI Licensing) which layers License NFTs, Product/SKU registry, and payment routing on top of the existing bridge
  Note: This SPEC proposes NEW scope for a future phase (tentatively "Phase 15: Secure BridgeIn V2" or a Phase 10 amendment). It is not Phase 13 work (13-06 excludes bridgeIn). It is not Phase 14 work (which depends on the bridge but does not modify its validator set). The roadmapper should route this to a new CONTEXT-gathering pass for a Phase 10 amendment or a new phase. External dependencies on SuperGenius#363 and #364 must be tracked as cross-repo gating items in .planning/SUBREPOS.md when the new phase is scheduled.
  Sources: docs/Secure-BridgeIn.md (lines 123-131, full doc), .planning/ROADMAP.md (Phases 10, 13, 14)

---

_Prior ingest history: 2026-05-26 run reported 0 blockers, 0 warnings, 3 INFO entries (GeniusAI dead code, Foundry TEST-01 scope, Defender deployment path). 2026-08-03 run reported 0 blockers, 0 warnings, 4 INFO entries (D11 coherence, bridge/mirror mapped to existing bridge, USD-oracle sketch superseded, PD-7 open design question). Those entries remain valid and are preserved in the 2026-05-26 and 2026-08-03 archived reports if needed; they are not repeated here because this report covers the 2026-08-23 ingest only._
