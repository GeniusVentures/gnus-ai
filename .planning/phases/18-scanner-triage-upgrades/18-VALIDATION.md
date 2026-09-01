---
phase: 18
slug: scanner-triage-upgrades
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-31
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Hardhat/mocha (`yarn test`) + Foundry via bridge node (`yarn forge:test` / `yarn test:all`) — UNCHANGED by this phase (no test-suite changes per the phase boundary). The scanner gates themselves (slither 0.11.6, semgrep 1.174.0) are the systems under test. |
| **Config file** | `.mocharc.yml` / `foundry.toml` (existing — no Wave 0 needed) |
| **Quick run command** | `yarn semgrep:scan` (~60-100s on the 119-file surface) |
| **Full suite command** | `yarn test:all` — ledger baseline 666 passing / 2 pending / 0 failing (Hardhat) + 215 passed / 0 failed / 5 skipped (Foundry, 220 total / 37 suites), run with the `npx hardhat node` bridge up on 127.0.0.1:8545 |
| **Estimated runtime** | quick scan ~60-100s; a slither probe pair ~60-120s; `npx tsc --noEmit` ~10-20s; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** the task's own automated verify (Per-Task map below) — at minimum the scanner probe specific to that task plus its inline shape-greps; `npx tsc --noEmit` rides the 18-02-03 chain
- **After every plan wave:** both scanner gates at their post-wave state; `yarn test:all` after wave 1 (the D-06 typing touches a module loaded by hardhat.config.ts in every process)
- **Before `/gsd:verify-work`:** both promoted gates green locally (`yarn slither:scan` exit 0, `yarn semgrep:scan` exit 0) AND full suite at the 666/2/0 + 215/0/5 ledger baseline
- **Max feedback latency:** ~60-120s (one scanner run). This EXCEEDS the 30s comfort bar BY NATURE: the fastest meaningful feedback unit for this phase IS a scanner run — the gate under test. Every verify chain also carries sub-5s inline checks (config greps, JSON/YAML parses, tsc) so shape regressions surface immediately; the >30s latency is inherent and accepted, not a sampling gap.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | SEC-09 | T-18-04 | 0.11.6 exit mechanics re-proven (probe-then-flip) BEFORE any gate spelling change | probe (captured /tmp logs) | `slither --version \| grep -q "0.11.6" && grep -c "weak-prng" /tmp/18-01-slither06-bare.log && grep -ci "unrecognized arguments\|not allowed with" /tmp/18-01-slither06-mutual.log` | n/a (probe logs) | ⬜ pending |
| 18-01-02 | 01 | 1 | SEC-09 | T-18-01 / T-18-02 | Tool-generated triage db committed + honored via config; db carries finding metadata only — no Solidity source (V14) | probe + grep | `grep -q '"triage_database": ".slither.db.json"' slither.config.json && python3 -c "import json; db=json.load(open('.slither.db.json')); assert isinstance(db,list) and len(db)>=3 and all('id' in e for e in db)" && ! grep -q 'pragma solidity' .slither.db.json && yarn slither:scan > /tmp/18-01-stability-2.log 2>&1; echo "exit=$?" \| grep -q "exit=0" && grep -q "0 result" /tmp/18-01-stability-2.log` | n/a (probe logs) | ⬜ pending |
| 18-01-03 | 01 | 1 | SEC-09 | T-18-03 | CI pinned 0.11.6, bare gate (no `--fail-none` anywhere), baseline ledger recorded in STATE | grep + workflow parse + probe | `grep -q "slither-analyzer==0.11.6" .github/workflows/security-audit.yml && ! grep -q "fail-none" .github/workflows/security-audit.yml && /usr/local/bin/python3 -c "import yaml; yaml.safe_load(open('.github/workflows/security-audit.yml'))" && yarn slither:scan > /tmp/18-01-postflip.log 2>&1; echo "exit=$?" \| grep -q "exit=0" && grep -q "Scanner Baseline Ledger" .planning/STATE.md` | target files | ⬜ pending |
| 18-02-01 | 02 | 1 | SEC-10 | T-18-05 | Fixed rule present + valid in BOTH configs — a parse-broken rule must fail the check (verified: current broken rule exits 2) | grep + semgrep validate | `grep -A2 "id: unsafe-external-call" .semgrep.yml \| grep -q "languages: \[generic\]" && grep -c "pattern-not-inside" .semgrep.yml && semgrep scan --validate --config .semgrep.yml && semgrep scan --validate --config .devcontainer/config/.semgrep.yml && ! grep -q "require(success" .semgrep.yml && ! grep -q "require(success" .devcontainer/config/.semgrep.yml && git -C .devcontainer status --porcelain \| wc -l \| grep -q "^0$"` | target files | ⬜ pending |
| 18-02-02 | 02 | 1 | SEC-10 | T-18-06 / T-18-07 / T-18-08 | Surface reaches the submodule with zero vendored/generated/test paths; D-11/D-12 exclusions applied and intact; rule proven to execute (positive control 2 → shipped 0) | probe (captured /tmp logs) | `grep -q -- "--no-git-ignore" package.json && [ "$(grep -o -- '--exclude ' package.json \| wc -l)" -ge 15 ] && grep -q -- "--exclude-rule diamond-selector-clash" package.json && grep -q -- "--exclude-rule hard-coded-secret" package.json && ! grep -qi "Rule parse error" /tmp/18-02-shipped-rule.log && ! grep -qE "lib/forge-std\|typechain-types/\|node_modules/\|(^ \| )test/" /tmp/18-02-shipped-rule.log` | target + probe logs | ⬜ pending |
| 18-02-03 | 02 | 1 | SEC-10 | T-18-09 | Zero `: any`, zero top-level value imports (type-only-import constraint), tsc green, Hardhat suite at ledger baseline, semgrep reduced to the 4 D-13-pending findings | regression (tsc + suite + scan) | `npx tsc --noEmit && [ "$(grep -c ': any' scripts/utils/GNUSLifecyclePolicyLinking.ts)" -eq 0 ] && [ "$(grep -cP '^import (?!type)' scripts/utils/GNUSLifecyclePolicyLinking.ts)" -eq 0 ] && yarn test > /tmp/18-02-hardhat-regression.log 2>&1; echo "exit=$?" \| grep -q "exit=0" && grep -q "666 passing" /tmp/18-02-hardhat-regression.log && yarn semgrep:scan > /tmp/18-02-post-typing.log 2>&1; [ "$(grep -c 'typescript-any-usage' /tmp/18-02-post-typing.log)" -eq 0 ]` | existing suite | ⬜ pending |
| 18-03-01 | 03 | 2 | SEC-10 | T-18-10 | Pre-checkpoint evidence captured: exactly the 4 unsafe-math-operation findings, exit 1 (honest red) before the owner rules | probe (captured /tmp log) | `yarn semgrep:scan > /tmp/18-03-precheckpoint.log 2>&1; echo "exit=$?" \| grep -q "exit=1" && grep -c "unsafe-math-operation" /tmp/18-03-precheckpoint.log` | n/a (probe log) | ⬜ pending |
| 18-03-02 | 03 | 2 | SEC-10 | T-18-10 | D-13 exclusion applied per ruling; 3 consecutive zero-finding runs; all exclusions intact post-edit | probe (3× stability logs) | `grep -q -- "--exclude-rule unsafe-math-operation" package.json && for i in 1 2 3; do grep -qi "Rule parse error" /tmp/18-03-semgrep-$i.log && exit 1; done; for i in 1 2 3; do grep -qE "lib/forge-std\|typechain-types/\|node_modules/" /tmp/18-03-semgrep-$i.log && exit 1; done; echo "stability-logs-clean"` | target + probe logs | ⬜ pending |
| 18-03-03 | 03 | 2 | SEC-10 | T-18-11 / T-18-12 / T-18-13 / T-18-14 | CI semgrep step promoted to hard gate on pinned 1.174.0 (zero non-comment continue-on-error, pipefail/tee/upload retained); ledger + 50-row disposition recorded; phase-exit suite at baseline | grep + workflow parse + probes + suite | `grep -q "semgrep==1.174.0" .github/workflows/security-audit.yml && [ "$(grep -v '^\s*#' .github/workflows/security-audit.yml \| grep -c 'continue-on-error')" -eq 0 ] && grep -q "set -o pipefail" .github/workflows/security-audit.yml && /usr/local/bin/python3 -c "import yaml; yaml.safe_load(open('.github/workflows/security-audit.yml'))" && yarn semgrep:scan > /tmp/18-03-final-semgrep.log 2>&1; echo "exit=$?" \| grep -q "exit=0" && yarn slither:scan > /tmp/18-03-final-slither.log 2>&1; echo "exit=$?" \| grep -q "exit=0" && grep -q "666 passing" /tmp/18-03-testall.log` | target files + logs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Interpreter note (18-01-03 / 18-03-03): the workflow YAML-parse link uses `/usr/local/bin/python3` — the only local interpreter with PyYAML (default brew python3 3.14.7 and `/usr/bin/python3` both lack it; verified 2026-08-31). Rule-file proofs (18-02-01) use `semgrep scan --validate` instead of a YAML library for the same reason.

---

## Wave 0 Requirements

None — existing infrastructure covers all phase validation (Hardhat/Foundry suites, both scanner CLIs, tsc). Probes need no new fixtures; the positive-control config is 12 lines, rebuilt per plan 18-02 Task 2.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-13 owner ruling on the 4 unsafe-math-operation sites (permanent vs temporary exclusion + routing) | SEC-10 | Owner authority is the decision mechanism itself — a blocking `checkpoint:decision` (18-03 Task 1); the ruling cannot be derived or automated | Present the 4-site table with options a/b (18-03 Task 1); record the ruling verbatim in the task summary; apply only in Task 2 |
| One-time slither triage marking (interactive per-detector stdin prompts) | SEC-09 | `--triage-mode` is an interactive tool-owned prompt flow; it cannot be an assertion | Run the piped triage command (18-01 Task 2: five `All` lines piped to stdin); confirm both detector prompts received `All`; the stability (2× exit 0) and re-surface (3 visible, exit 255) probes are the automated closure |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (all 9 tasks carry one)
- [x] Wave 0 covers all MISSING references (none — no MISSING references exist)
- [x] No watch-mode flags
- [x] Feedback latency < 30s where achievable — inline greps/parses are sub-5s; scanner runs (60-120s) are the gate under test and their latency is inherent (recorded above)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready — 2026-08-31 (revised per checker findings; per-task map filled from the plans' automated verifies)
