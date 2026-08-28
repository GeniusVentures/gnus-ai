# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Tech Debt & Security Remediation

**Shipped:** 2026-08-28
**Phases:** 16 (+1 retired) | **Plans:** 45 | **Timeline:** 94 days (2026-05-26 → 2026-08-28)

### What Was Built
- Security remediation arc (Phases 1–7): GeniusAI dead code removed, all 21 DEBT/SEC/PERF/TEST/QUAL/DEP items closed, deterministic builds, first fully-green tokenless security-audit CI, WR-01 closed (23 snyk medium+ transitives → 0 via range-qualified resolutions)
- Conversion-native token economics (Phase 9): per-child GNUS treasury, 1:1 minion backing, symmetric `convert()`, ConservationInvariant-enforced
- Secure bridging (Phases 10 + 15): provenance-relocation bridge hardened to rolling API-attestor certificates (`BRIDGE_CERTIFICATE_V2`), CI-pinned C++↔Solidity conformance vectors, legacy selectors removed pre-deployment
- AI economy surface (Phases 13 + 14): time-bound ERC-1155 entitlements with lifecycle policies; private-network License NFTs, SKU registry, GNUS-burn payment router
- Operational hardening (08.1/08.2 + close): Safe-proposed diamondCut with mainnet guard, deploy-verify pipeline, 53-requirement milestone audit, CI test gate green (666/2/0)

### What Worked
- **Probe-then-flip** (07-04): captured evidence before every requirements checkbox flip — 13/13 probes, zero asserted-from-memory claims
- **Byte-identical behavior proofs** for toolchain bumps: eslint 10 promoted on a `--fix-dry-run` capture diff (pre/post byte-equal), not on "tests still pass"
- **Prove, never assume, cross-language identity**: BRIDGE-18 vector leg V1 proved flat `abi.encode` == on-chain split-encode byte-for-byte before relying on it
- **Decision logs in STATE.md** with commit refs — owner rulings (snyk drop → restore → expiry retraction) stayed traceable through two reversals
- **Root-cause fixes over placeholders**: CI `.env` crash fixed in the vendored package (`@geniusventures/diamonds` 1.3.4-gv, `existsSync` guard), not with a `touch .env` step

### What Was Inefficient
- **First clean-runner run happened at milestone close, not earlier** — the CI test gate needed three sequential root-causes (forge-at-config-load, `.env` ENOENT at module import, env-coupled test assertions) in the final 24 hours
- **Stale baselines propagated through plans**: the 661-passing figure was recorded in multiple plans after the true baseline had moved (665 → 666); corrected at 07-01 and again at close
- **Tool exit-code archaeology**: slither 0.11.5's `--fail-high`/`--fail-none` semantics had to be settled empirically (4 spelling variants tested) because the plan's premise was wrong for that version
- **Owner rulings from memory got corrected twice** (snyk token capability, then token expiry) — both corrections required supersession entries; asking for the doc first would have saved both rounds

### Patterns Established
- Hex selector literals in zero-legacy-reference grep gates (the gate can't match its own assertions)
- Topic0-identical local `Transfer` declaration when Solidity 0.8.19 can't emit through a non-inherited interface (qualified event access is 0.8.21+)
- Range-qualified `resolutions` for transitive-only dependency fixes — re-points matching descriptors, direct pins frozen
- Foundry tests must run through the wrapper (`bare forge test` invalid — typechain constants point at the wrapper-deployed localhost diamond)
- `HUSKY=0` where hooks interfere; never `--no-verify`

### Key Lessons
1. Run the full suite on a clean (CI-like) environment at least once mid-milestone — environment coupling surfaces late and stacks
2. Vendored-package bugs get fixed at the package source and republished; CI-side workarounds are debt the next runner pays
3. Exit-code semantics are per-tool-version facts — settle them empirically before encoding them in gates
4. Every baseline figure in a plan is a claim about a past tree; re-derive at the gate that consumes it
5. Record owner rulings verbatim with commit refs at ruling time — paraphrases drift and get superseded

### Cost Observations
- Model mix / session count: not tracked this milestone (no telemetry captured) — instrument before v1.1 if cost matters
- Notable: Phases 9–15 (feature arc) moved markedly faster per phase than Phases 1–7 (remediation arc) — remediation against a live diamond carries verification overhead that greenfield facets don't

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 94 days | 16 (+1 retired) | Baseline: GSD plan→execute→verify→ship loop, probe-then-flip, dual-framework gates |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 666 passing / 2 pending / 0 failing (Hardhat) + 215/2/3 (Foundry) | not measured | not tracked |

### Top Lessons (Verified Across Milestones)

1. *(first milestone — pending v1.1 verification)*
