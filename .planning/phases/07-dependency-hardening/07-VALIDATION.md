---
phase: 7
slug: dependency-hardening
status: draft
nyquist_compliant: true
wave_0_complete: true  # no new test infrastructure needed — validation is command-observable over existing suites/configs
created: 2026-08-27
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` §Validation Architecture (task rows keyed to plans at planning time).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Hardhat + Mocha/Chai (unit/integration) and Foundry (invariants/fuzz via diamonds-forge) — this phase writes NO new production code; all checks are command-observable |
| **Config file** | `hardhat.config.ts`, `foundry.toml` (existing, committed) |
| **Quick run command** | `yarn test` (full Hardhat suite — no cheaper subset carries the gate semantics) |
| **Full suite command** | `yarn test:all` (= `yarn test && yarn forge:test`) |
| **Estimated runtime** | ~10-15 min full suite; `yarn install --immutable` ~30 s |

**Known baselines (never "fix" these; STATE.md figures are authoritative):** Hardhat **661 passing / 2 pending / 1 failing** (only the GNUSControlStorage chainID cross-suite pollution — passes in isolation); Foundry **215 passed / 2 failed / 3 skipped** (only the Phase 08.1 Safe-proposer setUp reverts). Anything outside these two classes is a routing event, not a tolerated failure.

---

## Sampling Rate

- **After every task commit:** `yarn test` (fast gate, tolerance per known baselines) + `yarn install --immutable` when a manifest/lockfile was touched
- **After every plan wave:** `yarn test:all`
- **Phase gate:** full `yarn security-check` (all 7 sub-commands dispositioned) + `yarn test:all` green-within-tolerance before `/gsd:verify-work`
- **Max feedback latency:** ~15 min

---

## Per-Task Verification Map

Task rows are keyed to plan IDs once PLAN.md files land (Phase-15 pattern). Requirement-level contract:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-at-planning | — | — | DEP-01 | T-07-xx / — | Pinned descriptor present and canonical | smoke (greppable observable) | `grep -c '#commit=bf67b736ad5fa3366551f599e204784856fb3069' package.json` → `1` | ✅ the command itself | ⬜ pending |
| TBD-at-planning | — | — | DEP-01 | — | Lockfile deterministic post-pin | smoke | `yarn install --immutable` → exit 0 | ✅ (verified green pre-pin) | ⬜ pending |
| TBD-at-planning | — | — | DEP-01 | — | Zero drift (no code change under test) | regression | `git diff yarn.lock` → exactly 2 descriptor lines, resolution+checksum byte-identical; `yarn test` / `yarn forge:test` within tolerance | ✅ existing suites | ⬜ pending |
| TBD-at-planning | — | — | audit gate (STATE 09-05) | — | Each security sub-command executed with disposition | smoke/manual-hybrid | `yarn security-check` (after prerequisites) with disposition table; slither findings == 3 known Phase-9 false-positives; `yarn npm audit --severity moderate` exits 0 after in-phase advisory fixes (owner ruling 2026-08-27: fix, not waive) | ❌ prerequisites task | ⬜ pending |
| TBD-at-planning | — | — | final pass (SC2) | — | Remediation arc fully closed in docs | observable check | remediation-arc checkbox count → 21/21 `[x]`; BRIDGE-17 remains `[ ]`; ROADMAP criterion references remediation set | ✅ the command itself | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] None for test infrastructure — this phase writes no new production code and needs no new test files; its validation is command-observable checks over existing suites and configs.

*Prerequisite (not a test gap): security-tool installs + token acquisition must precede the audit task's checks (RESEARCH Pitfall 2).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SNYK_TOKEN + SOCKET_CLI_API_TOKEN acquisition | audit gate | Human-gated credential issuance; tokens absent from `.env` | Owner obtains tokens and places them in `.env` before the audit task runs; record disposition if intentionally narrowed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15 min
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved at planning (task rows keyed when PLAN.md files land)
