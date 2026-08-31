# Requirements: v1.1 Proxy Completion & Production Readiness (gnus-ai slice)

**Created:** 2026-08-31
**Status:** Active — execution slice of the parent milestone. **Source of truth:** `TokenContracts/.planning/REQUIREMENTS.md` (parent-level, full v1.1 set incl. PROXY-01/02/04 — satisfied 2026-08-30 — and NFT-01/02/03 research items). This file carries only the requirements executed in `gnus-ai/`; checkbox state here must be reconciled with the parent traceability table at each phase close.

## v1.1 Requirements (gnus-ai slice)

### Test-Suite Cleanup (Phase 17)

- [x] **TEST-04**: GNUSControlStorage "should return initial protocol info" passes in the FULL suite — root fix (idempotent shared provenance initializer; cross-suite pollution), no test-side workaround.
- [ ] **TEST-05**: AccessControlInvariant deterministic across runs — seed the invariant config or align the invariant with the handler's grant surface (gnus-ai 07-04 recorded root cause).
- [ ] **TEST-06**: Phase 08.1 Safe setUp reverts resolved — SafeSingleShotUpgrade + SafeDiamondCut tests green.

### Scanner Upgrades (Phase 18)

- [ ] **SEC-09**: slither upgraded to a triage-capable line; the severity gate expressed via triage config (replaces the `--fail-none`-only workaround settled on slither 0.11.5).
- [ ] **SEC-10**: semgrep `unsafe-external-call` pattern parses and runs (fixed pattern); CI semgrep step promoted from continue-on-error advisory to hard gate on a stable baseline.

### Dependency & Secrets Hygiene (Phase 19)

- [ ] **DEP-02**: OSV 115-advisory remainder, round 2 — range-qualified resolutions for the axios/undici/handlebars/fast-xml-parser paths; `yarn osv:scan` exits 0 or every residual is dispositioned by owner ruling.
- [ ] **SEC-11**: git-secrets 37 prohibited-pattern hits dispositioned — each proven legitimate (test fixtures, documented keys) or remediated; `.gitallowed` additions only by owner ruling, never silent suppression.

### Bridge Activation (Phase 20)

- [ ] **BRIDGE-17**: Gate-checked bridgeIn activation — verify SuperGenius #363 state; if closed, activate bridgeIn (Sepolia); if open, ship EVM-side readiness (activation runbook + config) and block only on activation. Carried from v1.0 (external gate). Gate record: `docs/Secure-BridgeIn-Exporter-ABI.md` §5.

### Child-NFT Economics Build (Phase 22 — scope confirmed at Phase 21 exit)

- [ ] **NFT-04**: Implement child-NFT GNUS treasuries per NFT-01 findings. Scope confirmed at the research phase's exit; infeasible/insecure findings move this to Out of Scope with reason.
- [ ] **NFT-05**: Implement NFT→GNUS swap per NFT-02 findings. Same research-exit condition.
- [ ] **NFT-06**: Implement external swap routing per NFT-03 findings (only if findings validate the pattern). Same research-exit condition.

## Out of Scope (gnus-ai slice)

| Feature | Reason |
| --- | --- |
| Mainnet deployment | Gated on external audit completion — unchanged from v1.0 |
| NFT-01/02/03 (research) | Phase 21 is cross-repo — parent-planned |
| Multisig/timelock for super admin | Future governance phase |
| GNUSNFTCollectionName facet consolidation | Low-priority cleanup pass (carried) |

## Traceability

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| TEST-04     | 17    | Complete |
| TEST-05     | 17    | Pending |
| TEST-06     | 17    | Pending |
| SEC-09      | 18    | Pending |
| SEC-10      | 18    | Pending |
| DEP-02      | 19    | Pending |
| SEC-11      | 19    | Pending |
| BRIDGE-17   | 20    | Pending |
| NFT-04      | 22    | Pending |
| NFT-05      | 22    | Pending |
| NFT-06      | 22    | Pending |

---

*Mirrored from `TokenContracts/.planning/REQUIREMENTS.md` 2026-08-31 when the v1.1 gnus-ai slice was seeded into this roadmap (phases 17–20, 22). Definitions are verbatim from the parent; defer to the parent copy on any divergence.*
