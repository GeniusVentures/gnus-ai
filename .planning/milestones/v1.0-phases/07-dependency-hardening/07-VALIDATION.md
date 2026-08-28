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

Task rows keyed to the 07-01..07-04 PLAN.md task IDs (2026-08-27). Requirement-level contract:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 07-01 | 1 | DEP-01 | T-07-01 | Pinned descriptor present and canonical | smoke (greppable observable) | `grep -c '#commit=bf67b736ad5fa3366551f599e204784856fb3069' package.json` → `1` (yarn.lock → `2`; .devcontainer/config/package.json → `1`) | ✅ the command itself | ⬜ pending |
| 07-01-T1 | 07-01 | 1 | DEP-01 | T-07-02 | Lockfile deterministic post-pin | smoke | `yarn install --immutable` → exit 0; `git diff yarn.lock` touches only contracts-starter descriptor lines; `checksum: 10c0/bb02edc4...` line absent from the diff | ✅ (verified green pre-pin) | ⬜ pending |
| 07-01-T1 + 07-01-T3 | 07-01 | 1 | DEP-01 | T-07-01 | Zero drift (no code change under test) | regression | Task 1 diff gates + Task 3: `yarn test` 661/2/1 and `yarn forge:test` 215/2/3 (known-stale sets only) | ✅ existing suites | ⬜ pending |
| 07-01-T2 | 07-01 | 1 | audit-0 gate (owner ruling 2026-08-27) | T-07-03/T-07-04/T-07-05 | Advisory fixes: `@diamondslab/hardhat-multichain` 1.1.0 rename + eslint supported-line bump + semgrep stub removal, all exact-pinned | smoke | `yarn npm audit --severity moderate` → exit 0 (never piped); rename/import grep gates per plan | ✅ the command itself | ⬜ pending |
| 07-02-T2 | 07-02 | 1 | gate prerequisite | T-07-SC | semgrep / osv-scanner / git-secrets installed ONLY after blocking-human legitimacy approval; AWS patterns registered repo-locally | smoke | `semgrep --version && osv-scanner --version && git secrets --list` | ❌ created by 07-02 Task 2 | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | gate prerequisite | T-07-06 | SNYK_TOKEN + SOCKET_CLI_API_TOKEN present in git-ignored `.env` (manual acquisition — see Manual-Only table) | manual + grep | `git check-ignore -q .env` then `grep -c '^SNYK_TOKEN=..' .env` → `1` (key names only, never values) | ❌ owner action | ⬜ pending |
| 07-03-T1 | 07-03 | 2 | audit gate (STATE 09-05) | T-07-11/T-07-13 | Each security sub-command executed with disposition | smoke/manual-hybrid | 7 sub-commands run individually (logs under /tmp); slither findings == exactly the 3 known Phase-9 FPs; `yarn slither:scan --fail-high` → exit 0; disposition table present in STATE.md `Phase 7 Decisions Logged (07-03)` | ❌ prerequisites (07-02) | ⬜ pending |
| 07-03-T2 | 07-03 | 2 | audit gate — CI wiring | T-07-09/T-07-10/T-07-12 | `.github/workflows/security-audit.yml` parses, enforces mined conventions, secret-conditional snyk/socket, exactly one documented advisory step | structural | ruby YAML parse (`YAML.load_file`) + convention greps + forbidden-pattern count 0 (`pull_request_target|id-token|NPM_TOKEN|registry-url|ignore-scripts`) | ❌ created by 07-03 Task 2 | ⬜ pending |
| 07-04-T2 | 07-04 | 3 | final pass (SC2 / D-06/D-07) | T-07-15/T-07-16 | Remediation arc fully closed in docs | observable check | remediation-arc unchecked count → `0` (`grep -cE '\- \[ \] \*\*(DEBT|SEC|PERF|TEST|QUAL)'` → 0); BRIDGE-17 remains `[ ]`; ROADMAP criterion references the remediation set (zero `All 22` matches) | ✅ the command itself | ⬜ pending |
| 07-04-T1 | 07-04 | 3 | phase-exit gate | T-07-17 | Deterministic hard gates green at close | smoke | `yarn install --immutable` → 0; `yarn npm audit --severity moderate` → 0; `yarn test` 661/2/1; `yarn forge:test` 215/2/3; `yarn slither:scan --fail-high` → 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] None for test infrastructure — this phase writes no new production code and needs no new test files; its validation is command-observable checks over existing suites and configs.

*Prerequisite (not a test gap): security-tool installs + token acquisition must precede the audit task's checks (RESEARCH Pitfall 2) — owned by plan 07-02.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SNYK_TOKEN + SOCKET_CLI_API_TOKEN acquisition | audit gate | Human-gated credential issuance; tokens absent from `.env` | Owner obtains tokens and places them in `.env` before the audit task runs; record disposition if intentionally narrowed |
| Brew tool legitimacy approval | audit gate | Research legitimacy audit marked semgrep/osv-scanner/git-secrets `[ASSUMED]` (slopcheck not runnable) | Owner reviews the brew-info dossier vs official upstreams at the 07-02 Task 1 blocking checkpoint before any install |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15 min
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** task rows keyed to 07-01..07-04 plan/task IDs at planning (2026-08-27) — plan-checker iteration pending
