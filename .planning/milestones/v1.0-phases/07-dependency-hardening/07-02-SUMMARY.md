---
phase: 07-dependency-hardening
plan: "02"
subsystem: security
tags: [security-toolchain, supply-chain, snyk, socket, semgrep, osv-scanner, git-secrets, secrets-management, devcontainer-parity]

# Dependency graph
requires:
  - phase: 07-dependency-hardening
    plan: "01"
    provides: audit sub-gate exit-0 baseline + the exact-pinned snyk 1.1301.2 / @socketsecurity/cli 1.1.51 devDependencies this plan authenticates
provides:
  - All seven D-08 security-check sub-commands locally executable with no narrowing (semgrep/osv-scanner/git-secrets on PATH; snyk + socket token-authenticated)
  - git-secrets AWS + blockchain pattern registration in the gnus-ai repo config (scan-only, no hooks)
  - Dual-token auth for Snyk + Socket: git-ignored .env locally + GeniusVentures org-wide GitHub Actions secrets (visibility ALL) for 07-03 CI
affects: [07-03, 07-04, ci-security-audit, dependency-maintenance]

# Tech tracking
tech-stack:
  added:
    - "semgrep 1.174.0 (homebrew/core; installed only after the Task 1 blocking legitimacy dossier)"
    - "osv-scanner 2.5.1 (homebrew/core; same gate)"
    - "git-secrets 1.3.0 (homebrew/core; same gate)"
  patterns:
    - "Blocking dossier checkpoint before any brew install: `brew info` homepage cross-checked to the official upstream repo; zero installs pre-approval"
    - "Token verification by name-presence grep only (`grep -c '^SNYK_TOKEN=..' .env` → 1); values never enter chat, logs, plan files, or commits"
    - "Secret distribution via `gh secret set --org GeniusVentures --visibility all` with values piped from .env over stdin behind a non-empty guard (never echoed)"

key-files:
  created: []
  modified:
    - ".env (untracked, git-ignored) — SNYK_TOKEN + SOCKET_CLI_API_TOKEN appended by the owner"
    - ".git/config (repo-local, untracked) — git-secrets pattern registration"

key-decisions:
  - "Task 1 dossier discharged the three [ASSUMED] research legitimacy dispositions; returntocorp→semgrep org rename verified as a redirect; zero installs ran before approval"
  - "git-secrets registered repo-local with the canonical blockchain pattern set from .devcontainer/scripts/setup-security.sh (14 prohibited + 23 allowed) plus --register-aws → 17/25 final; `git secrets --install` skipped per T-07-07 so husky stays the only hook mechanism; parent TokenContracts config untouched"
  - "snyk:test was dropped (362f57e) on a wrong free-tier premise, then RESTORED (59dd883) on the owner's corrected information — Snyk Free/Team personal user tokens authenticate CLI and CI/CD (as SNYK_TOKEN); Free lacks REST API + service accounts. The supersession trail (2c14cae → c7df8e0 → STATE CORRECTION) is the record"
  - "Tokens carry NO forced expiry (owner correction: the ≤90-day figure applied to GitHub PATs only) — refresh on-demand; rotation provenance = gh secret list updated_at; 07-03 implements no expiry tracking"
  - "Owner chose org-wide GitHub Actions secrets over per-repo (GeniusVentures, visibility ALL) — 07-03 CI consumes SNYK_TOKEN/SOCKET_CLI_API_TOKEN with zero per-repo setup"
  - "Failure modes 07-03 must make recognizable, never silent: Snyk Free monthly test cap (~200–400 OSS tests/month) and 401 on token revocation"

patterns-established:
  - "Human-gated credential plans: prove `git check-ignore .env` BEFORE any token lands (T-07-06), then verify by key-name greps only"

requirements-completed: []

# Metrics
duration: 63min
completed: 2026-08-27
---

# Phase 7 Plan 2: D-08 Security-Gate Unblocking Summary

**Three owner-vetted CLIs on PATH, AWS + blockchain patterns registered scan-only, and dual Snyk/Socket auth landed in a git-ignored .env plus org-wide GitHub secrets — all seven `yarn security-check` sub-commands now execute with zero narrowing, closing 07-RESEARCH Pitfall 2**

## Performance

- **Duration:** ~63 min wall clock (spans three human gates: token acquisition, device-flow org-scope grant, no-expiry correction)
- **Started:** 2026-08-27T21:38:16Z (07-01 metadata commit `274805b`)
- **Completed:** 2026-08-27T22:41:00Z (this commit)
- **Tasks:** 3/3 (Task 1 = blocking dossier checkpoint, no repo changes; Task 2 = installs + repo-local config, no tracked-file changes; Task 3 = human token placement + org-secret distribution)
- **Files modified:** zero tracked files net — package.json's snyk:test was dropped in `362f57e` and restored verbatim in `59dd883` (byte-identical net state); all other changes live in untracked .env / .git/config

## Accomplishments

- semgrep 1.174.0, osv-scanner 2.5.1, git-secrets 1.3.0 installed from homebrew/core — only after the Task 1 blocking dossier mapped each formula to its official upstream
- git-secrets patterns registered repo-local in gnus-ai `.git/config`: 14 prohibited + 23 allowed blockchain patterns (canonical set from `.devcontainer/scripts/setup-security.sh`) plus `--register-aws` → **17 prohibited / 25 allowed** final; no hooks installed (husky remains the only hook mechanism, T-07-07)
- `SNYK_TOKEN` + `SOCKET_CLI_API_TOKEN` present in the git-ignored `.env` with non-empty values (36 / 55 chars; proven by name-presence greps, values never printed); `git check-ignore` proof captured BEFORE any token landed (T-07-06)
- Both tokens distributed as **GeniusVentures org-wide Actions secrets (visibility ALL)** — gh-reported `updated_at` 2026-08-27T22:34:35Z / 22:34:36Z — so 07-03's CI workflow needs no per-repo secret setup
- `yarn security-check` composition verified at the full 7 sub-commands (audit → snyk:test → socket:scan → osv:scan → semgrep:scan → slither:scan → git-secrets:scan); D-08's no-narrowing requirement is now physically satisfiable

## Task Commits

Each task was committed atomically where tracked files changed:

1. **Task 1: Owner dossier approval** — no commit (checkpoint only; `/tmp/07-02-brew-dossier.txt` retained)
2. **Task 2: Installs + pattern registration** — no tracked-file commit (binaries + repo-local `.git/config` only; the ruling record landed in `2c14cae`)
3. **Task 3: Token placement + gate-scope rulings** — `362f57e` (snyk:test drop) + `2c14cae` (rulings in STATE) + `59dd883` (snyk:test restore) + `c7df8e0` (supersession record)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.env` (untracked, git-ignored) — two token keys appended by the owner
- `.git/config` (repo-local, untracked) — git-secrets pattern registration
- `.planning/STATE.md` — Phase 7 decision-log entries, supersession + CORRECTION records
- `package.json` — net-zero across `362f57e`/`59dd883` (snyk:test dropped then restored verbatim)

## Decisions Made

- Dossier-first install gate: every legitimacy [ASSUMED] from research was discharged by a human eyeballing `brew info` homepages against the official upstream repos before any executable landed on the machine (T-07-SC)
- Scan-only git-secrets: patterns registered, `--install` deliberately unused; parent TokenContracts repo config untouched
- snyk drop→restore cycle preserved as an explicit supersession trail rather than a rebase-away — the wrong premise, the correction, and the restoration are all in history (D-08 auditability)
- Org-wide secret visibility (ALL) chosen by the owner over per-repo secrets, matching the org's existing posture (SENTRY_AUTH_TOKEN et al. are ALL)
- No-expiry correction logged as a dated STATE CORRECTION entry superseding the two ≤90-day runbook lines — 07-03 consumes "no expiry tracking, on-demand rotation, updated_at provenance"

## Deviations from Plan

**1. [Owner-directed scope addition] Org-wide GitHub Actions secrets**
- **Found during:** Task 3
- **Issue:** plan's deliverable was tokens in `.env` only; CI wiring (07-03) would then have needed per-repo secret setup
- **Fix:** owner ruled org-wide; both secrets set on GeniusVentures (visibility ALL) with values piped from `.env` over stdin
- **Impact:** 07-03 consumes org secrets directly; no per-repo setup step

**2. [Wrong premise, corrected in-phase] snyk:test drop and restoration**
- **Found during:** Task 3
- **Issue:** research concluded Snyk free tier had no workable token issuance; owner ruling dropped snyk:test (`362f57e`); owner later supplied Snyk's documented position (Free/Team personal tokens authenticate CLI/CI-CD)
- **Fix:** `yarn snyk:test` restored (`59dd883`); supersession recorded (`c7df8e0`); net package.json byte-identical to pre-plan

**3. [Owner correction] ≤90-day expiry runbook retracted**
- **Found during:** closeout
- **Issue:** decision log recorded a quarterly dual-token refresh runbook + expiry tracking; owner corrected: "there is no <= 90 day expiry, that was for PAT only"
- **Fix:** STATE CORRECTION entry appended; both runbook lines annotated as superseded; 07-03 inherits no expiry-tracking requirement

**4. [Process] Executor stopped; orchestrator finished inline**
- The second executor agent was stopped by the owner after `c7df8e0` (all tracked work committed; SUMMARY/roadmap/closeout remained); the orchestrator completed the closeout inline per the owner's explicit choice — no execution work was lost or redone

**5. [Typo, owner-caught] `SYNK_TOKEN` misspelling**
- `.env` initially carried `SYNK_TOKEN`; the owner spotted and fixed it; the guarded retry then verified the correct key. Recorded because the first org-secret write had silently consumed the failed grep's empty output (see Issues)

---

**Total deviations:** 3 owner-directed/corrected rulings + 1 process deviation + 1 typo, all recorded; no scope creep beyond the owner's explicit instructions
**Impact on plan:** every D-08 sub-command is executable — the plan's success criteria hold with the org-secret and no-expiry amendments

## Issues Encountered

- **Empty org-secret first write (caught and fixed):** the first `gh secret set` ran from the workspace root where `.env` doesn't exist; the grep produced nothing and empty stdin set BOTH secrets to empty values. Fixed by re-running with a non-empty value guard (`[ -n "$VAL" ] || exit 1`) and absolute paths; final values verified by char counts (36/55) and fresh `updated_at` timestamps overwriting the empty set
- **Repeated missing `cd` prefix:** several Bash calls intended to start in gnus-ai ran at the TokenContracts root (fresh shell per call); resolved by switching to absolute paths — the guard above now encodes the lesson
- **Missing `admin:org` scope:** `gh secret set --org` requires it; granted via device flow (code 70B5-E4FD) with the owner's browser authorization
- Token values never printed anywhere: verification used key-name greps and character counts only

## Proof Ledger

| Gate | Result |
| ---- | ------ |
| `git check-ignore -q .env` | IGNORED (captured BEFORE any token was written) |
| `semgrep --version` / `osv-scanner --version` / `git secrets --help` | 1.174.0 / 2.5.1 / exit 0 |
| `git secrets --list` (repo-local) | 17 prohibited / 25 allowed patterns |
| `grep -c '^SNYK_TOKEN=..' .env` | 1 |
| `grep -c '^SOCKET_CLI_API_TOKEN=..' .env` | 1 |
| `git status --porcelain .env` | empty (untracked, never staged) |
| `gh secret list --org GeniusVentures` | SNYK_TOKEN + SOCKET_CLI_API_TOKEN, visibility ALL, updated 2026-08-27T22:34:35/36Z |
| security-check composition | 7 sub-commands: audit, snyk:test, socket:scan, osv:scan, semgrep:scan, slither:scan, git-secrets:scan |
| `/tmp/07-02-brew-dossier.txt` | exists; covers all three formulas with upstream mapping |

## Known Stubs

None — no stub patterns introduced.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: secrets-distribution | org:GeniusVentures | Org-wide visibility ALL means every org repo can read SNYK_TOKEN/SOCKET_CLI_API_TOKEN in Actions — owner-accepted (matches existing org posture: SENTRY_AUTH_TOKEN, GNUS_TOKEN_1, etc. are ALL); recorded for the verifier |

Plan threat dispositions: T-07-SC mitigated (dossier gate, zero pre-approval installs) · T-07-06 mitigated (check-ignore proof precedes placement; name-only verification) · T-07-07 mitigated (no git-secrets hooks) · T-07-08 closed (both tokens obtained — no gate narrowing needed)

## User Setup Required

None remaining for this plan — `.env` and org secrets are in place. Other machines/devcontainer users need their own `.env` tokens for local full-gate runs (CI is covered by org secrets); that is standard environment setup, not a plan deliverable.

## Next Phase Readiness

- 07-03 can execute the complete D-08 gate locally AND wire CI with no per-repo secret setup (org secrets exist); tokenless-hard + secret-conditional-snyk/socket design proceeds as planned
- 07-03/07-04 gates should use **Hardhat 665/2/1** and **Foundry 215/2/3** (07-01-SUMMARY is the evidence record)
- No expiry tracking to implement in 07-03; quota-cap and 401 failure modes must be recognizable in the workflow (never silent skips)
- Baselines for the security tools themselves: semgrep 1.174.0, osv-scanner 2.5.1, git-secrets 1.3.0, slither 0.11.5, snyk 1.1301.2, socket 1.1.51

## Self-Check: PASSED

- SUMMARY file exists at `.planning/phases/07-dependency-hardening/07-02-SUMMARY.md`
- Commits verified in git log: `362f57e`, `2c14cae`, `59dd883`, `c7df8e0` (+ this metadata commit)
- ROADMAP.md Phase 7 row reads `2/4 plans executed`; 07-02 checkbox `[x]`
- Task 3 gate evidence: both `.env` key-presence greps = 1, `.env` untracked, org secrets listed with visibility ALL
- STATE.md carries the supersession trail + CORRECTION entry retracting the ≤90-day expiry claims

---
*Phase: 07-dependency-hardening*
*Completed: 2026-08-27*
