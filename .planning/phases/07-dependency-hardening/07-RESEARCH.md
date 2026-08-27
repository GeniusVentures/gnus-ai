# Phase 7: Dependency Hardening - Research

**Researched:** 2026-08-27
**Domain:** Build reproducibility (Yarn 4 git-dependency pinning) + security-audit gate operation (npm-audit / Slither / Semgrep / Snyk / Socket / OSV / git-secrets) + planning-artifact reconciliation
**Confidence:** HIGH (all load-bearing facts verified against the repo, tool runs, or official docs this session)

## Summary

Phase 7 is the closing gate of the remediation arc, executing last by design (Phases 9–15 are all complete per STATE.md, so the D-01 deferral is satisfied). It has three workstreams: (1) the DEP-01 pin — a one-line `package.json` change (line 135) that adds `#commit=bf67b736ad5fa3366551f599e204784856fb3069` to the floating `contracts-starter` git URL, followed by a lockfile re-key whose diff is exactly two descriptor lines; (2) the full final audit — `yarn security-check` + `yarn test` + `yarn forge:test` per D-08; and (3) requirements/roadmap reconciliation — ~13 stale unchecked remediation-arc boxes in REQUIREMENTS.md, a stale "22 requirements" success criterion in ROADMAP.md, and a stale Active list in PROJECT.md.

The pin is de-risked to near-zero by three verified facts: the lockfile already resolves to exactly `bf67b736…` (resolution + checksum recorded since 2025-07-12), upstream `mudgen/diamond-2-hardhat` HEAD is *still* that same commit (`git ls-remote` verified), and the dependency is emphatically not dead weight — 19 production contract files plus 5 Foundry test files import it, and `foundry.toml` remaps `contracts-starter/=node_modules/contracts-starter/`. Pinning per D-03 is correct; removal is off the table.

The audit gate is the real work. **The full `yarn security-check` cannot run end-to-end in the current local environment**: 5 of its 7 sub-commands are blocked (semgrep, snyk, osv-scanner, git-secrets binaries not installed; `SNYK_TOKEN` and `SOCKET_CLI_API_TOKEN` absent from `.env`). Only `yarn audit` and `yarn slither:scan` run today. The audit baselines I captured: `yarn npm audit --severity moderate` **exits 1** on exactly 2 moderate *deprecation-class* advisories (eslint, hardhat-multichain→`@diamondslab/hardhat-multichain` rename) with zero CVEs at moderate+; full-tree slither (81 contracts, 58 detectors) surfaces exactly the same **3 findings / 2 detectors** Phase 9 already dispositioned as false positives, and slither **exits 255 by design** whenever findings print (slither 0.11.5 has `--fail-*` severity flags but no `--triage-mode`). STATE.md 09-05 explicitly assigns Phase 7 ownership of "wiring slither into the audit gate" — and no `.github/workflows/` exists anywhere, so CI wiring (if kept in scope) starts from zero files.

**Primary recommendation:** Pin first (one line + `yarn install` + `--immutable` verification + 2-line lockfile diff), then front-load tool installation and token acquisition as explicit prerequisites before the audit task, run the full gate with written dispositions for the 5 known non-actionable results (2 deprecations, 3 slither FPs), then close the reconciliation pass evidence-first — leaving BRIDGE-17 Pending by design and routing any genuinely new failure back to owning phases per D-09.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 7 executes **last**, after Phases 9, 10, 11, 12, 13, and 14 complete. The phase keeps its number (`7`) — no renumbering of 8–14. ROADMAP.md Phase 7 section is annotated with `**Blocked by:** Phases 9–14` (or equivalent `blocked-by` marker) so `/gsd:progress` and `--next` routing skip over it until unblocked. Execution order ≠ phase numbering.
- **D-02:** Pin target is the **currently-resolved commit `bf67b736ad5fa3366551f599e204784856fb3069`** (zero-drift). This is the commit `yarn.lock` already resolved `https://github.com/mudgen/diamond-2-hardhat.git` to, and the commit all existing tests ran against. Do **not** chase latest upstream `master` HEAD — upstream is Nick Mudge's static reference repo and pinning to a fresh, unvalidated commit would change the code under test while claiming to be a no-op hardening step.
- **D-03:** Pin syntax is **Yarn 4 native Git syntax**: `"contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git#commit=bf67b736ad5fa3366551f599e204784856fb3069"`. This matches the `#commit=<sha>` normalization Yarn 4 already wrote into `yarn.lock` (line 4884), so the lockfile diff should be minimal-to-empty after `yarn install`.
- **D-04:** Scope of pinning is the **npm/test-harness dependency only** — the on-chain Solidity source does not need "vendor pinning" in a separate sense. `contracts-starter` reaches the contracts via Hardhat compile-time imports (`import "contracts-starter/contracts/..."` in `GeniusDiamond.sol`, `DiamondInitFacet.sol`, `GeniusAccessControl.sol`, `GNUSNFTFactory.sol`, `GNUSControl.sol`, `GNUSControlStorage.sol`, `GNUSERC1155MaxSupply.sol`, `GeniusOwnershipFacet.sol`), and its reproducibility is exactly the npm-resolution problem DEP-01 describes. No additional vendoring, gitmodule conversion, or source copying into the repo.
- **D-05:** The `contracts/gnus-ai` git submodule (GeniusVentures/gnus-ai-contracts, currently `2e70a63` on `develop`) is **not** in scope for this phase. It is already commit-pinned by the submodule mechanism itself. Discussion mention of "latest upstream develop for the gnus-ai submodule" was clarified as orthogonal to DEP-01 — submodule bumps happen per-phase as they already do (see recent `chore: bump gnus-ai submodule` commits).
- **D-06:** The roadmap's "All 22 requirements are verified complete" figure is **stale** — REQUIREMENTS.md currently shows 25 unchecked boxes spanning remediation (DEBT/SEC/PERF/QUAL/DEP), Safe Wallet Proposer (SWP), and Licensing (LIC) items. The audit must:
  1. **Update the ROADMAP.md Phase 7 success criterion** to reference the actual remediation requirement set (DEBT-*, SEC-*, PERF-*, QUAL-*, DEP-01) rather than a hardcoded "22", and
  2. Verify completion of the **remediation-arc requirements only** (Phases 1–7 scope). LIC-01–LIC-07 belong to Phase 14; SWP-02/03/06/07/09 belong to Phase 08.1/08.2 — those are audited by their own phases, not re-audited here. The Phase 7 audit confirms the remediation arc is closed, not that the entire roadmap is done.
- **D-07:** REQUIREMENTS.md checkbox reconciliation is part of this phase's work. Several remediation requirements are code-complete but still unchecked (e.g., DEBT-01 GeniusAI removal, SEC-03 bridgeOut validation — both landed in earlier phases). Reconciling checkboxes to reality is audit output, not scope creep.
- **D-08:** Full `yarn security-check` (Slither + Semgrep + Snyk + Socket + OSV + git-secrets) plus `yarn test` and `yarn forge:test`. This is the documented project security gate (`package.json` scripts, INTEGRATIONS.md §Security Scanning) — no narrowing. The audit's value is that it is the *complete* gate; a subset would just re-open the question of what was skipped.
- **D-09:** Audit failures are **fixed at their root cause**, not worked around — per project rule "Fix root cause, never hack around bugs". If the full suite surfaces issues in code owned by Phases 9–14, those fixes are new work items fed back to the relevant phase (or a gap-fix plan), not silently patched inside Phase 7.

### Claude's Discretion

- Exact wording of the `blocked-by` marker in ROADMAP.md (match whatever `/gsd:progress` parsing expects — check `gsd-sdk query roadmap.get-phase` behavior for dependency fields)
- Whether the ROADMAP success-criterion rewrite replaces "22" with an explicit requirement list or a reference to REQUIREMENTS.md sections
- Lockfile regeneration verification approach (clean `yarn install` in a fresh clone vs. `--check-cache` vs. both)
- Order of operations within the phase (pin-first-then-audit is the natural order, but audit-first to establish a baseline is defensible)

### Deferred Ideas (OUT OF SCOPE)

- **Execution of Phase 7 itself** — deferred until Phases 9–14 complete (D-01). This CONTEXT.md captures decisions now so planning can happen any time; implementation waits.
- **Re-audit of SWP/LIC requirements** — belongs to Phases 08.1/08.2/14, not re-audited here (D-06).
- **`contracts/gnus-ai` submodule pinning policy** — explicitly out of scope (D-05); submodule bumps remain per-phase chores.
- **Gap fixes surfaced by the final audit** — if the full suite fails on code owned by Phases 9–14, fixes route back to those phases or a gap-fix plan rather than being absorbed into Phase 7 (D-09).

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-01 | Pin `contracts-starter` to a specific commit hash in `package.json` — currently pointed at `https://github.com/mudgen/diamond-2-hardhat.git` without a commit reference. | Fully de-risked: exact target commit verified in yarn.lock resolution AND equal to upstream HEAD (zero drift, stable since 2025-07-12); exact syntax verified against Yarn 4 official git-protocol docs (`#commit=<sha>`); predicted 2-line lockfile diff; `yarn install --immutable` verified green pre-pin. Consumers enumerated (19 production files + 5 Foundry tests + remapping) — dependency confirmed live, pin confirmed correct. |
| (audit scope per D-06) | Verify completion of remediation-arc requirements: DEBT-01–06, SEC-01–08, PERF-01–02, TEST-01–03, QUAL-01, DEP-01 (21 total). | Current checkbox state enumerated: 8 of 21 already checked; 13 unchecked (incl. DEP-01, closed by this phase). Evidence base: STATE.md phase table (Phases 1–6 all 100%), phase decisions logs, TRACEABILITY table (stale across the board — needs same reconciliation). |
| (gate per D-08) | Full `yarn security-check` + `yarn test` + `yarn forge:test`. | Per-sub-command runnability audited: 2 of 7 runnable today. Baselines captured for both runnable commands (audit exit 1 with 2 deprecations; slither 3 known FPs, exit 255). Test baselines: Hardhat 661/2/1, Foundry 215/2/3 (STATE.md, verified 2026-08-27 — re-establish at phase start). |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dependency pinning (DEP-01) | Build/dependency layer (`package.json` + `yarn.lock`, Yarn 4.10.3) | — | Pure npm-resolution problem per D-04; Solidity source consumes it only via compile-time imports. No on-chain change whatsoever. |
| Determinism verification | Build/dependency layer (`yarn install --immutable`, `checksumBehavior: throw`) | VCS (git diff on yarn.lock) | Yarn owns lockfile normalization; git owns the observable 2-line diff proof. |
| Static analysis (slither, semgrep) | Tooling layer (slither.config.json, .semgrep.yml, pipx/brew CLIs) | CI layer (future workflow) | Config is committed and working; execution environment is the gap (semgrep missing locally). |
| Vulnerability correlation (audit, osv, snyk, socket) | Tooling layer (yarn npm audit + external CLIs/tokens) | CI layer (GitHub secrets) | Registry-side intelligence; requires network + credentials — GitHub secrets are the durable home. |
| Secret hygiene (git-secrets) | Repo hooks layer (.husky/pre-push) | CI layer | Local hook exists but binary missing; CI-side equivalent removes per-developer variance. |
| Test-gate execution (`yarn test`, `yarn forge:test`) | Test harness (Hardhat/Mocha + Foundry via diamonds-forge) | Local only (forge:test needs `--network localhost`) | forge:test spins against a local node; CI-ifying tests is heavier than CI-ifying scanners — keep scoped to local for this phase. |
| Requirements/roadmap reconciliation | Planning artifacts layer (REQUIREMENTS.md, ROADMAP.md, PROJECT.md, STATE.md) | — | Pure documentation truth-sync; evidence lives in phase records. |

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Yarn (Berry) | 4.10.3 (via `yarnPath: .yarn/releases/yarn-4.10.3.cjs`) | Dependency resolution, lockfile, pin verification | Already the project's package manager; `defaultSemverRangePrefix: ""` enforces the exact-pin policy; `checksumBehavior: throw` makes checksum drift a hard failure. `[VERIFIED: repo .yarnrc.yml]` |
| slither | 0.11.5 (installed at /opt/homebrew/bin/slither) | Solidity static analysis — the committed gate (`slither.config.json`) | Project-standard per package.json `slither:scan`; full-tree run verified this session: 81 contracts, 58 detectors, 3 findings. `[VERIFIED: local run]` |
| Hardhat test suite | existing (`npx hardhat test`) | Functional gate | Mocha/Chai via hardhat; 661 passing baseline. `[VERIFIED: repo + STATE.md]` |
| Foundry suite | forge 1.7.1 (via `yarn forge:test` → diamonds-forge) | Invariant/fuzz gate | 215 passing baseline; requires local network. `[VERIFIED: repo + local version probe]` |

### Supporting (required by D-08's full gate — currently NOT installed)

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| semgrep | latest stable (pipx/brew) | Custom-rule static scan (`.semgrep.yml`: diamond-selector-collision, unsafe-external-call, insecure-private-key) | Mandatory sub-command of `security-check`; pre-push treats it as hard. `[VERIFIED: tool named in repo scripts; install method ASSUMED]` |
| snyk CLI | latest stable (brew/npm) | Dependency vulnerability test (`--all-projects --severity-threshold=medium`) | Requires `SNYK_TOKEN` — acquisition is a user action. `[VERIFIED: script exists; token ABSENT from .env]` |
| socket CLI | via `npx socket ci` | Supply-chain scan | Requires `SOCKET_CLI_API_TOKEN` — currently absent; the script's `grep SOCKET_CLI_API_TOKEN .env` yields empty → guaranteed auth failure. `[VERIFIED: script + .env key audit]` |
| osv-scanner | latest stable (brew) | OSV.dev lockfile scan | Script targets `--lockfile=yarn.lock`; note `.husky/pre-push` references `./bin/osv-scanner` which does not exist (no `bin/` directory). `[VERIFIED: script + missing binary]` |
| git-secrets | latest (brew) | Credential-pattern scan | `git secrets --scan`; not installed (`git: 'secrets' is not a git command`). `[VERIFIED: probe]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Installing 5 local CLIs + 2 tokens | GitHub Actions CI running the gate (slither-action / osv-scanner-action / native semgrep) | CI removes per-developer setup and is STATE 09-05's stated expectation, but needs workflow authoring and secrets configuration; local install is the minimal-change path to satisfying D-08 verbatim. Both is ideal; planner decides sequencing. |
| git-secrets | gitleaks | gitleaks is actively maintained, single binary, SARIF output; git-secrets is what the repo scripts already name. Minimal-change philosophy favors git-secrets; flag gitleaks as modern alternative only if git-secrets proves awkward on macOS/arm64. `[ASSUMED]` |
| slither exit-code management via `--fail-medium`/`--fail-high` | Inline `// slither-disable` annotations on the 3 FP sites | Flags are verified to exist in 0.11.5 (weaker gate); inline suppression is the root-cause disposition but 0.11.5 support for the pragma is unverified. See Pitfall 3. |

**Installation (execution-time only — research installed nothing):**

```bash
# brew/pipx route for the four missing local CLIs (planner gates behind verification)
brew install semgrep snyk osv-scanner git-secrets   # [ASSUMED — verify formula names at execution]
# tokens are human-acquired, machine-stored:
#   SNYK_TOKEN, SOCKET_CLI_API_TOKEN → .env (local) and/or GitHub secrets (CI)
```

**Version verification:** slither 0.11.5, yarn 4.10.3, node v24.13.0, forge 1.7.1, python 3.14.6, git 2.50.1 — all probed this session on this machine. `[VERIFIED: local probes]`

## Package Legitimacy Audit

> This phase installs **no npm-registry packages**. The only package-graph change is re-pinning an *existing* git dependency already recorded in `yarn.lock`. slopcheck was not installed (research-time rule: install nothing), so per the graceful-degradation protocol every execution-time install below carries `[ASSUMED]` and the planner must gate each behind a `checkpoint:human-verify`.

| Package/Tool | Registry/Source | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| contracts-starter (re-pin only) | git: github.com/mudgen/diamond-2-hardhat | repo years old; resolution stable since 2025-07-12 | n/a (git dep) | github.com/mudgen/diamond-2-hardhat | not run | Approved — already in lockfile with checksum; commit verified via `git ls-remote` (upstream HEAD == pinned SHA). No new code enters the tree. `[VERIFIED: yarn.lock + ls-remote]` |
| semgrep | PyPI/brew | established | very high | github.com/returntocorp/semgrep | not run | `[ASSUMED]` — named by the repo's own committed scripts; planner checkpoint before install |
| snyk | npm/brew | established | very high | github.com/snyk/cli | not run | `[ASSUMED]` — same basis |
| osv-scanner | brew/PyPI | established | high | github.com/google/osv-scanner | not run | `[ASSUMED]` — same basis; official action verified to exist (google/osv-scanner-action) |
| git-secrets | brew | established | moderate | github.com/awslabs/git-secrets | not run | `[ASSUMED]` — same basis |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not runnable — no installs performed).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                         PHASE 7 GATE — DATA FLOW

 [pin workstream]
   package.json:135 descriptor  ──(add #commit=bf67b736…)──▶  yarn install
        │                                                        │
        │                                          ┌─────────────┴───────────────┐
        │                                          ▼                             ▼
        │                              yarn.lock re-keys entry          node_modules/contracts-starter
        │                              (2 descriptor lines;             stays at bf67b736
        │                               resolution+checksum             (byte-identical content)
        │                               unchanged)                                │
        └──────────────────────────────────────────────────────────────────────────┘
                                                                     │
 [verification gate]                                                 ▼
   yarn install --immutable ──exit 0──▶ git diff yarn.lock ──exactly 2 lines──▶ yarn test ──┐
                                                                                             │
   yarn forge:test ─────────────────tolerance: 1 known-stale HH fail, 2 known-stale F fails◀┘
                                                                                             │
 [audit gate (D-08)]                                                                        ▼
   yarn security-check
     ├─ yarn npm audit ──────▶ exit 1 expected: 2 deprecation advisories ─▶ DISPOSITION (waive w/ note
     │                                                                  or route rename to maintenance)
     ├─ snyk:test ──────────▶ BLOCKED until SNYK_TOKEN ────────────────┐  │
     ├─ socket:scan ────────▶ BLOCKED until SOCKET_CLI_API_TOKEN ──────┤  │ prerequisites: install tools
     ├─ osv:scan ───────────▶ BLOCKED until osv-scanner binary ────────┤  │ + acquire tokens BEFORE audit task
     ├─ semgrep:scan ───────▶ BLOCKED until semgrep binary ────────────┤  │
     ├─ slither:scan ───────▶ 3 findings (known FPs), exit 255 ────────┤  │ (also rebuilds forge artifacts first)
     └─ git-secrets:scan ───▶ BLOCKED until git-secrets ───────────────┘
                                     │
                      any NEW finding ──▶ D-09 route to owning phase (NOT patched in Phase 7)
                                     │
 [reconciliation workstream]          ▼
   STATE.md phase records ──evidence──▶ REQUIREMENTS.md checkboxes (remediation arc → 21/21 [x])
   ROADMAP.md Phase 7 success criterion rewrite ("22" → remediation set)
   PROJECT.md Active list purge (BRIDGE-17 remains Pending BY DESIGN)
```

### Recommended Project Structure (files this phase may touch)

```
gnus-ai/                          # ALL work stays in the gnus-ai repo — never outer .planning/
├── package.json                  # line 135: the pin (the only production-file change)
├── yarn.lock                     # regenerated by yarn (2 descriptor lines)
├── .devcontainer/config/package.json  # line ~111: second floating copy (planner decision)
├── .planning/REQUIREMENTS.md     # checkbox + traceability reconciliation
├── .planning/ROADMAP.md          # Phase 7 success-criterion rewrite (+ sequencing note)
├── .planning/PROJECT.md          # Active → Validated migration
├── .planning/STATE.md            # phase decisions log (as each plan completes)
└── .github/workflows/            # OPTIONAL (scope question): security-audit.yml — does not exist yet
```

### Pattern 1: Pin-then-verify (the DEP-01 mechanics)

**What:** One-line descriptor change; Yarn normalizes; observable proof via diff + immutable install.
**When to use:** Exactly this phase.
**Example:**

```jsonc
// package.json line 135 (devDependencies) — BEFORE [VERIFIED: repo]
"contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git"
// AFTER (D-03)
"contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git#commit=bf67b736ad5fa3366551f599e204784856fb3069"
```

```yaml
# yarn.lock — the two lines that change (predicted; verify at execution) [VERIFIED: current state read]
# workspace root deps listing (~line 1458):
    contracts-starter: "https://github.com/mudgen/diamond-2-hardhat.git"          # → gains #commit=bf67…
# entry key (~line 4883):
"contracts-starter@https://github.com/mudgen/diamond-2-hardhat.git":              # → gains #commit=bf67…
# UNCHANGED (must remain byte-identical — this is the zero-drift proof):
  resolution: "contracts-starter@https://github.com/mudgen/diamond-2-hardhat.git#commit=bf67b736ad5fa3366551f599e204784856fb3069"
  checksum: 10c0/bb02edc42733588af6ad2344d2f9d4da62892d2b95edd9674c2bf6718854ab97fc39553ab84181897b8b5474130414f4db72da6ee01b1366c0d3b4685ecc4f9e
```

```bash
# Source: Yarn 4 official git-protocol docs — commit-pinning form [CITED: yarnpkg.com/protocol/git]
# "You can explicitly request a tag, commit, branch, or semver tag, by using one of those keywords
#  (if you're missing the keyword, Yarn will look for the first thing that seems to match…)"
# → bare "#bf67b736…" would be auto-guessed as a commit; "#commit=" is the explicit canonical form (D-03 is correct).
yarn install                      # re-keys the lockfile
yarn install --immutable && echo OK   # must exit 0 (verified green pre-pin this session)
git diff yarn.lock                # assert: exactly the 2 descriptor lines; resolution/checksum untouched
```

### Pattern 2: Audit-gate disposition record

**What:** Every non-green sub-command gets a written disposition, not a silent pass/fail.
**When to use:** the D-08 audit task.
**Example (the 5 pre-known dispositions):**

| Sub-command | Expected result today | Disposition class |
|---|---|---|
| `yarn audit` | exit 1 — eslint (deprecation, moderate); hardhat-multichain (deprecation, moderate — renamed to `@diamondslab/hardhat-multichain`, direct dep 1.0.6) | Waive-with-note OR route package rename to future maintenance (renaming deps is a behavior-risk change — out of a "no behavioral change" phase; planner should surface to user) |
| `slither:scan` | exit 255 — 3 findings: `weak-prng` on `GNUSWithdrawLimiterStorage.calculateCurrentBin` (deterministic bin indexing); `erc721-interface` on `GNUSBridge.approve`/`transferFrom` (intentional ERC-20 facade) | False positives — same 3 Phase 9 dispositioned (09-05). Full tree adds nothing new. Gate handling: see Pitfall 3 |
| `semgrep`/`osv`/`snyk`/`socket`/`git-secrets` | blocked (tools/tokens) | Unblocked by prerequisite task; results recorded fresh |
| `yarn test` | 661 passing / 2 pending / 1 failing | Tolerated: GNUSControlStorage chainID cross-suite pollution (passes in isolation) — root fix belongs to a Phase-9-style sweep per STATE Next Actions, NOT Phase 7 |
| `yarn forge:test` | 215 passed / 2 failed / 3 skipped | Tolerated: Phase 08.1 Safe-proposer setUp reverts, unchanged since Phase 9's record |

### Pattern 3: Evidence-based reconciliation

**What:** Each checkbox flip cites the phase/plan/commit that landed the work.
**When to use:** the D-07 reconciliation task.
**Example:** DEBT-01 (GeniusAI facet removal) → STATE.md Phase 2 complete (2/2 plans); the facet is absent from `contracts/gnus-ai/` (verifiable by absence + diamond config). Flip `[ ]`→`[x]` citing Phase 2. Apply the same shape across the 13 unchecked remediation items; update the TRACEABILITY table rows (currently stale for even completed SWP/LIC/BRIDGE items); purge PROJECT.md Active down to DEP-01 (closing this phase) and BRIDGE-17 (Pending by design — SuperGenius#363 gate, see docs/Secure-BridgeIn-Exporter-ABI.md §5).

### Anti-Patterns to Avoid

- **Hand-editing yarn.lock** to force the pin — Yarn owns normalization; descriptor change + `yarn install` is the only correct path.
- **Chasing the deprecation advisories in-phase** (upgrading/replacing eslint, hardhat-multichain) — dependency *upgrades* change behavior and belong to a deliberate maintenance pass, not a zero-drift gate phase (D-02 philosophy generalized; route per D-09 thinking).
- **"Fixing" the known-stale test failures inside Phase 7** — STATE.md Next Actions #2 already assigns the GNUSControlStorage chainID pollution root fix to a Phase-9-style sweep; absorbing it here is scope creep and risks destabilizing the exit baseline.
- **Marking checkboxes from memory** — flips without cited evidence re-create exactly the staleness this phase exists to eliminate.
- **Narrowing the gate silently** — D-08 forbids it; if tokens cannot be obtained, the blocker must surface to the user, not result in quietly skipping sub-commands.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lockfile normalization | Manual yarn.lock surgery | Yarn 4 itself (`yarn install`) | Yarn's descriptor→resolution matching has its own canonicalization (`#commit=` form); hand-edits break checksums (`checksumBehavior: throw` will catch it — loudly, later). |
| Vulnerability correlation | Custom CVE scraping of node_modules | `yarn npm audit` + osv-scanner (+ snyk/socket where tokened) | Registry-side intelligence with advisory IDs; verified working this session (audit ran, exit semantics observed). |
| Static-analysis exit gating | grep-parsing slither/semgrep stdout | `--fail-*` flags (slither, verified present in 0.11.5) / `--error` (semgrep script already uses it) / SARIF artifacts (`--sarif` verified) | Output format drift; flags are the tools' own contract. |
| Secret scanning | Regex over git history | git-secrets (scripted already) or gitleaks | Pattern DBs evolve; AWS/multi-provider rules maintained upstream. |
| CI scanner setup | Bespoke Docker matrix | crytic/slither-action, google/osv-scanner-action, native semgrep install | Official, maintained actions — verified to exist; note `semgrep/semgrep-action` wrapper is **deprecated** upstream (use the CLI natively in a step). |

**Key insight:** every piece of this gate already exists as a committed script or an official action; the phase's job is wiring and dispositions, not building scanners.

## Runtime State Inventory

> Omitted — this is not a rename/refactor/migration phase. The one state-adjacent fact worth recording: `node_modules/` is regenerated state (verified: `yarn install --immutable` restored 1109 packages / 527 MiB from cache this session without touching tracked files), and the slither scan wrapper mutates build outputs (`forge clean` + `forge build --force` run inside it — expect a recompile on the next test run).

## Common Pitfalls

### Pitfall 1: Expecting an EMPTY lockfile diff
**What goes wrong:** D-03 says "minimal-to-empty"; the actual diff is exactly **2 changed lines** (workspace deps listing ~line 1458 + entry key ~line 4883 — both gain `#commit=bf67…`).
**Why it happens:** the *resolution* and *checksum* lines already carry the commit, but the *descriptor key* lines mirror package.json and must re-key.
**How to avoid:** treat "resolution + checksum byte-identical, exactly 2 descriptor lines changed" as the pass condition. If the **checksum** changes, STOP — that means the resolved content changed (drift), contradicting D-02.
**Warning signs:** diff touching `version:`, `languageName:`, or `linkType:` of the contracts-starter entry.

### Pitfall 2: The full security gate physically cannot run today
**What goes wrong:** running `yarn security-check` now fails at sub-command 2 (snyk) — 5 of 7 sub-commands blocked (semgrep, snyk, osv-scanner, git-secrets binaries absent; `SNYK_TOKEN`/`SOCKET_CLI_API_TOKEN` not in `.env`). The `socket:scan` script greps `.env` for the token and would inject an empty string.
**Why it happens:** tools were scripted (INTEGRATIONS.md era) but never installed on this machine; `.husky/pre-push` is degraded the same way (references `./bin/osv-scanner`; `bin/` does not exist).
**How to avoid:** plan an explicit prerequisite task (tool install + token acquisition) BEFORE the audit task; token acquisition is human-gated — surface early.
**Warning signs:** audit task marked complete without per-sub-command disposition rows.

### Pitfall 3: slither exits 255 by design when findings print
**What goes wrong:** even with all 3 findings being long-dispositioned false positives, `yarn slither:scan` returns non-zero (observed EXIT=255), so any naive hard gate (pre-push hook, CI step) fails forever.
**Why it happens:** slither's default exit code reflects finding count; the committed config filters severities from *output* but the remaining findings still count.
**How to avoid:** pick one and record it: (a) `--fail-medium`/`--fail-high` gate flags — **verified present in 0.11.5** (`--fail-pedantic`, `--fail-low`, `--fail-medium`, `--fail-high`, `--fail-none`); note this weakens the gate below the config's current display threshold, or (b) inline `// slither-disable` suppression at the 3 FP sites — root-cause disposition, but 0.11.5 support for the pragma is `[ASSUMED]` and needs a 5-minute runtime check at plan time; `--triage-mode` does NOT exist in 0.11.5 (verified via `--help`). Upload `--sarif` output as a CI artifact either way (flag verified).
**Warning signs:** CI/pre-push "green" only because someone added `|| true`.

### Pitfall 4: slither scan has build side effects and a runtime cost
**What goes wrong:** the scan wrapper runs `forge clean` + `forge build --build-info --skip ./test/foundry/** ./scripts/foundry/** --force` first (observed in the run log) — it wipes and rebuilds forge artifacts and takes minutes; it also prints 2 pre-existing warnings about unknown `exclude_paths`/`remappings` keys under foundry.toml's `[lint]` section (noise, not this phase's problem).
**Why it happens:** the diamonds-forge integration regenerates the build-info slither consumes.
**How to avoid:** sequence slither AFTER test runs or budget the rebuild; don't run slither concurrently with `forge:test`.
**Warning signs:** "forge clean running" appearing mid-audit; subsequent test runs recompiling from scratch.

### Pitfall 5: audit exit-code surprise (exit 1 with only deprecations)
**What goes wrong:** `yarn npm audit --severity moderate` exits **1** even though the only advisories are 2 moderate *deprecation-class* notices (eslint; hardhat-multichain renamed to `@diamondslab/hardhat-multichain`) — zero CVE-class findings at moderate+. Piping the command (e.g. `| tail`) masks the exit code entirely (it did in my first probe — `tail`'s 0 won).
**Why it happens:** yarn counts deprecation advisories against the threshold; shell pipelines return the last command's status.
**How to avoid:** capture the advisory list explicitly (IDs + severities) as the baseline; decide disposition (waive-with-note vs route the renames to maintenance) BEFORE wiring the gate; in scripts, check `${PIPESTATUS[0]}` or avoid pipes.
**Warning signs:** audit "passing" in someone's terminal because of a pipe.

### Pitfall 6: test baselines drift — re-establish at phase start
**What goes wrong:** tolerance is defined as EXACTLY (Hardhat) 1 failing — `GNUSControlStorage.test.ts` "should return initial protocol info" (chainID 31337 vs 0, cross-suite pollution; passes in isolation) + 2 pending; (Foundry) 2 failing — Phase 08.1 SafeDiamondCut + SafeSingleShotUpgrade setUp reverts — + 3 skipped. STATE.md's own history shows the passing count moved 564 → 616 → 661 across phases.
**Why it happens:** suites grow every phase; the orchestrator brief even quoted a different passing figure (665) than STATE.md (661).
**How to avoid:** first execution step = run both suites, pin the fresh numbers, require the known-stale set to be *identical in kind* (same test names) and *nothing else new*. Any other failure is a D-09 routing event.
**Warning signs:** unfamiliar test names in the failure list; pending-count changes.

### Pitfall 7: reconciliation scope creep
**What goes wrong:** the audit over-closes items — e.g., flipping BRIDGE-17 (stays Pending by design — SuperGenius#363 gate), re-auditing SWP/LIC (D-06 forbids), or flipping the 5 SWP unchecked boxes (SWP-02/03/06/07/09 belong to 08.1/08.2's own audit).
**Why it happens:** REQUIREMENTS.md's traceability table is stale across ALL arcs, which invites fixing everything.
**How to avoid:** remediation-arc only for verification (21 items); the traceability-table *row updates* for other arcs may be corrected as pure bookkeeping if evidence exists, but no cross-arc re-audit.
**Warning signs:** edits beyond the DEBT/SEC/PERF/TEST/QUAL/DEP rows (and mechanical table corrections).

### Pitfall 8: the second floating copy in .devcontainer
**What goes wrong:** `.devcontainer/config/package.json` line ~111 has its own `"contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git"` (floating, alongside range deps like `^8.2.2` and a branch-pinned `diamonds…#develop`) — a stale parallel manifest. Leaving it floating partially undercuts the "deterministic builds" claim DEP-01 makes.
**Why it happens:** devcontainer config drifted from the root manifest.
**How to avoid:** minimal, defensible move is the same 1-line pin there for consistency; strictly-scoped move is to leave it (it's not the build path for CI/local tests). Planner decides — flag it in the plan explicitly either way.
**Warning signs:** claiming "the dependency is pinned" while a second unpinned copy ships in-repo.

### Pitfall 9: yarn's git-dependency allowlist on future upgrades
**What goes wrong:** current Yarn master docs state git deps are restricted via the `approvedGitRepositories` setting (glob patterns; Yarn "will refuse to fetch" non-matching GitHub repos). This repo's `.yarnrc.yml` does NOT set it and installs fine on 4.10.3.
**Why it happens:** the documented behavior may be newer than 4.10.3 or default-off when unset — either way, a future Yarn upgrade could start refusing the mudgen dep.
**How to avoid:** if a future yarn bump rejects the fetch, add `approvedGitRepositories: ["https://github.com/mudgen/*"]` (or the GeniusVentures globs too). No action needed this phase. `[CITED: yarnpkg.com/protocol/git — version applicability caveat]`
**Warning signs:** post-upgrade "Repository … not approved" style install errors.

## Code Examples

### DEP-01 pin + verification sequence (bash, execution-time)

```bash
# 1. Pin (single line edit, package.json:135) — see Pattern 1 for the exact JSON.
# 2. Regenerate lockfile:
yarn install
# 3. Prove determinism (verified green pre-pin this session — exit 0, 1109 pkgs restored from cache):
yarn install --immutable
# 4. Prove zero drift:
git diff yarn.lock        # exactly 2 descriptor lines; resolution/checksum byte-identical
grep -c '#commit=bf67b736' package.json yarn.lock   # expect: 1 and 2
# 5. Behavior no-op proof:
yarn test        # within tolerance (Pitfall 6 baseline)
yarn forge:test  # within tolerance
```

### Slither gate handling (0.11.5 — flags verified via --help)

```bash
# Current committed invocation (always exits 255 while the 3 FPs print):
yarn slither:scan
# Option A — severity-flagged gate (flags VERIFIED in 0.11.5):
slither . --config-file slither.config.json --sarif slither.sarif --fail-high
# Option B — root-cause suppression at the 3 FP sites [ASSUMED — verify pragma support at plan time]:
#   GNUSWithdrawLimiterStorage.sol#137  // slither-disable-next-line weak-prng
#   GNUSBridge.sol#406                  // slither-disable-next-line erc721-interface
#   GNUSBridge.sol#506                  // slither-disable-next-line erc721-interface
# (each with a one-line justification comment per project comment standards)
```

### CI workflow skeleton (IF kept in scope — file does not exist today)

```yaml
# gnus-ai/.github/workflows/security-audit.yml  (gnus-ai is its own GitHub repo — workflows live HERE,
# per SUBREPOS.md planning ownership; outer TokenContracts repo also has no workflows)
name: security-audit
on: [push, pull_request, workflow_dispatch]   # + schedule for OSV drift, optionally
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4            # [ASSUMED tag]
      - uses: actions/setup-node@v4          # [ASSUMED tag] node 24 + corepack-enable for yarn 4
      - run: yarn install --immutable        # determinism gate in CI
      - run: yarn npm audit --severity moderate || true   # + disposition check vs committed baseline
      # slither: prefer faithful local-equivalent (pip install slither==0.11.5; forge build; slither . --config-file …)
      #   over crytic/slither-action IF the action can't consume slither.config.json's
      #   hardhat_artifacts_directory mode — verify at plan time. [CITED: github.com/crytic/slither-action exists]
      # osv: google/osv-scanner-action [CITED: github.com/google/osv-scanner-action]
      # semgrep: install CLI + `semgrep scan --config .semgrep.yml --error` —
      #   do NOT use semgrep/semgrep-action (DEPRECATED upstream; native CI is the documented path)
      # snyk/socket: only with GitHub secrets SNYK_TOKEN / SOCKET_CLI_API_TOKEN (user decision)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `semgrep/semgrep-action` wrapper in CI | Native semgrep install + `semgrep ci`/CLI step | Wrapper deprecated upstream (migration notice live on the marketplace page) | Don't adopt the wrapper for new CI work. |
| slither findings triage via `slither.db.json` (`--triage-mode`) | Not available in 0.11.5 (flag absent from `--help`; verified) | Feature exists only in newer slither lines | Gate handling must use `--fail-*` flags or inline suppression on this version. |
| `yarn npm audit` as advisory-only | Counts deprecation-class advisories against severity threshold (exit 1 observed) | Observed on yarn 4.10.3 this session | Gate needs an explicit disposition baseline, not "exit 0 expected". |
| Git deps unrestricted | `approvedGitRepositories` allowlist documented for git protocol | Current master docs (repo on 4.10.3 unaffected today) | Future yarn upgrades may need the glob (Pitfall 9). |

**Deprecated/outdated (repo-internal):**
- `.husky/pre-push` `./bin/osv-scanner` reference — binary/path does not exist; the hook's tolerant steps silently skip.
- ROADMAP "All 22 requirements" figure — stale (actual remediation arc = 21; v1 total = 25 incl. PROXY-01/02/03).
- PROJECT.md Active list — stale (remediation items still Active though Phases 1–6 complete).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | slither 0.11.5 honors inline `// slither-disable-next-line` suppression pragmas | Pitfall 3 / Code Examples | Low — fallback (`--fail-high`/`--fail-medium` flags) is verified present; decide at plan time with a 5-minute test |
| A2 | brew formula names `semgrep snyk osv-scanner git-secrets` install the intended tools | Standard Stack / Installation | Low-medium — verify formula names before install (planner checkpoint); tool *names* themselves are repo-verified via committed scripts |
| A3 | `snyk` and `socket` have current GitHub-Action/CI integrations usable with token secrets | Code Examples / Open Questions | Low — local CLI route (repo scripts) is the primary path; actions are optional |
| A4 | `crytic/slither-action` cannot (or can) consume the repo's `hardhat_artifacts_directory`-based slither.config.json as-is | Code Examples | Medium — determines whether CI slither uses the action or a faithful local-equivalent step; unresolved without a test workflow run |
| A5 | Hardhat 661/2/1 and Foundry 215/2/3 baselines still hold at execution time | Validation Architecture | Low — re-establish at phase start regardless (procedure documented in Pitfall 6) |
| A6 | The 2 audit deprecation advisories are waivable without in-phase dependency upgrades | Pattern 2 | Medium — user may instead demand the renames land first (scope change; route per D-09) |
| A7 | `.devcontainer/config/package.json` should receive the same 1-line pin for consistency | Pitfall 8 | Low — either disposition is defensible; planner/user call |
| A8 | CI workflow creation belongs inside Phase 7 rather than a follow-up | Open Questions | Medium — STATE 09-05 says Phase 7 "owns wiring it into the audit gate", but CONTEXT D-08 describes only the local command gate; needs user confirmation |
| A9 | gitleaks is a viable git-secrets alternative if git-secrets is awkward on macOS/arm64 | Alternatives Considered | Low — only relevant if the primary route stalls |

## Open Questions

1. **Token acquisition for snyk + socket (D-08 blocker)**
   - What we know: `SNYK_TOKEN` and `SOCKET_CLI_API_TOKEN` are absent from `.env`; 2 of 5 blocked sub-commands need them; the pre-push hook already tolerates snyk absence.
   - What's unclear: who owns obtaining them and by when; whether CI GitHub-secrets is the target home instead of local `.env`.
   - Recommendation: planner surfaces as a `checkpoint:human-verify` prerequisite task; without tokens the "no narrowing" mandate is unachievable and must escalate, not silently skip.
2. **Is CI wiring in-phase or follow-up?**
   - What we know: STATE 09-05 assigns Phase 7 ownership of wiring slither into the audit gate; no workflows exist; official actions verified available.
   - What's unclear: whether the user wants workflow authoring inside this phase or the local gate only (D-08's literal text is command-level).
   - Recommendation: include a minimal workflow (install/immutable + audit-with-baseline + slither-with-flags + osv + semgrep) as a discrete plan, sequenced after the local gate is green — user confirms scope at plan review.
3. **Disposition of the 2 deprecation advisories**
   - What we know: audit exits 1 on them; both are rename/deprecation class, not CVEs; one (hardhat-multichain → `@diamondslab/hardhat-multichain`) is a direct dependency upgrade with behavioral risk.
   - What's unclear: user appetite for in-phase dependency renames vs documented waiver.
   - Recommendation: waiver-with-note this phase; queue renames as future maintenance (consistent with zero-drift philosophy).
4. **ROADMAP blocked-by annotation (discretion item) — now moot?**
   - What we know: Phases 9–15 are all complete, so no routing needs to skip Phase 7 anymore; `gsd-sdk query roadmap.get-phase "7"` parses no dependency fields (success_criteria also unparsed — plain text).
   - Recommendation: honor D-01's letter with a plain-text sequencing note ("executed last per D-01; Phases 9–15 complete 2026-08-27") during the D-06 rewrite — no functional marker exists to match.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| yarn 4 (Berry) | pin + all gates | ✓ | 4.10.3 (yarnPath-pinned) | — |
| node | toolchain | ✓ | v24.13.0 | — |
| slither | `slither:scan` | ✓ | 0.11.5 (/opt/homebrew/bin) | — |
| forge | forge build inside slither scan; `forge:test` | ✓ | 1.7.1 (Homebrew) | — |
| python3 | slither runtime | ✓ | 3.14.6 | — |
| git | everything | ✓ | 2.50.1 (Apple) | — |
| semgrep | `semgrep:scan` | ✗ | — | brew install (planner checkpoint); no in-repo fallback |
| snyk CLI | `snyk:test` | ✗ | — | brew/npm install + SNYK_TOKEN (human-gated) |
| osv-scanner | `osv:scan` | ✗ | — | brew install; `.husky` `./bin/osv-scanner` path also missing |
| git-secrets | `git-secrets:scan` | ✗ | — | brew install (+ `git secrets --register-aws` style setup) |
| SNYK_TOKEN | snyk auth | ✗ (absent from .env) | — | user acquisition / GitHub secrets |
| SOCKET_CLI_API_TOKEN | socket auth | ✗ (absent from .env) | — | user acquisition / GitHub secrets |
| network access to github.com/mudgen | git dep fetch on fresh installs | ✓ (ls-remote verified) | — | — |

**Missing dependencies with no fallback:** none that block planning; 5 tool/token gaps block the full D-08 audit at execution time and are themselves plannable prerequisite tasks (two are human-gated token acquisitions).
**Missing dependencies with fallback:** none — each blocked scanner's only honest fallback is the prerequisite install; silent skipping violates D-08.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Hardhat + Mocha/Chai (unit/integration) and Foundry (invariants/fuzz via diamonds-forge) |
| Config file | `hardhat.config.ts`, `foundry.toml` (existing, committed) |
| Quick run command | `yarn test` (full Hardhat suite — no cheap subset exists for this phase's gate semantics) |
| Full suite command | `yarn test:all` (= `yarn test && yarn forge:test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-01 | Pinned descriptor present and canonical | smoke (greppable observable) | `grep -c '#commit=bf67b736ad5fa3366551f599e204784856fb3069' package.json` → `1` | ✅ Wave 0 = the command itself |
| DEP-01 | Lockfile deterministic post-pin | smoke | `yarn install --immutable` → exit 0 | ✅ (verified green pre-pin) |
| DEP-01 | Zero drift (no code change under test) | regression | `git diff yarn.lock` → exactly 2 descriptor lines, resolution+checksum identical; `yarn test` and `yarn forge:test` within tolerance | ✅ existing suites |
| D-08 gate | Each security sub-command executed with disposition | smoke/manual-hybrid | `yarn security-check` (after prerequisites) with disposition table; slither findings == 3 known FPs | ❌ Wave 0 = prerequisites task |
| D-06/D-07 | Remediation arc fully closed in docs | observable check | `grep -c '\- \[x\]'` over remediation-arc section → 21/21; BRIDGE-17 remains `[ ]`; ROADMAP criterion references remediation set | ✅ Wave 0 = the command itself |

### Sampling Rate
- **Per task commit:** `yarn test` (fast gate; tolerance per Pitfall 6)
- **Per wave merge:** `yarn test:all` + `yarn install --immutable`
- **Phase gate:** full `yarn security-check` (all 7 sub-commands dispositioned) + `yarn test:all` green-within-tolerance before `/gsd:verify-work`

### Wave 0 Gaps
- None for test infrastructure — this phase writes no new production code and needs no new test files; its validation is command-observable checks over existing suites and configs.
- Prerequisite (not a test gap): tool installs + token acquisition must precede the audit-task's checks (Pitfall 2).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surfaces touched |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | No input surfaces touched |
| V6 Cryptography | no | — |
| V14 Config/Build (supply chain) | **yes** | Dependency pinning (DEP-01), `checksumBehavior: throw`, `yarn install --immutable`, lockfile-in-VCS |
| V12/ops-adjacent (code quality gates) | **yes** | Slither/semsgrep static gates; secret hygiene via git-secrets |

### Known Threat Patterns for this phase (supply-chain focus)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Upstream repo hijack/repoint of a floating git dep | Tampering/Elevation | Pin to immutable commit SHA (this phase); checksum in lockfile; `approvedGitRepositories` glob on future yarn upgrades |
| Known-vulnerable transitive deps | Tampering | npm audit + OSV (+ snyk/socket where tokened) with dispositioned baseline |
| Committed credentials | Information Disclosure | git-secrets scan (pre-push + audit gate) |
| Static-analysis regressions in shipped contracts | Tampering | slither gate with documented FP dispositions — full-tree baseline proven identical to Phase 9's scoped run |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `package.json`, `yarn.lock` (lines ~1458, ~4883–4888), `.yarnrc.yml`, `slither.config.json`, `.husky/pre-push`, `foundry.toml` (line 45), `.devcontainer/config/package.json` (~111), `.env` (key names only), `.planning/{STATE,REQUIREMENTS,ROADMAP,PROJECT,config}.md`, `.planning/phases/07-dependency-hardening/07-CONTEXT.md`, `.planning/SUBREPOS.md` (outer)
- Tool runs this session: `yarn install --immutable` (exit 0), `yarn npm audit --severity moderate` (exit 1; 2 moderate deprecations), `yarn slither:scan` full-tree (3 findings / exit 255, log retained), `slither --version` / `--help` (0.11.5 flag set), `git ls-remote` upstream HEAD == pinned SHA, `git log` yarn.lock history, availability probes for all gate tools
- Yarn official docs: https://yarnpkg.com/protocol/git (commit-pinning syntax, `approvedGitRepositories`) [CITED]

### Secondary (MEDIUM confidence)
- [crytic/slither-action](https://github.com/crytic/slither-action) — official Trail of Bits action exists and is active (search-verified)
- [google/osv-scanner-action](https://github.com/google/osv-scanner-action) — official action exists; fails builds on found vulnerabilities (search-verified)
- [semgrep-action deprecation notice](https://github.com/marketplace/actions/semgrep-action) — wrapper deprecated; native CI is the documented path (search-verified)

### Tertiary (LOW confidence)
- Action version tags (`@v4` etc.), snyk/socket CI integration specifics, gitleaks-as-alternative suitability — `[ASSUMED]`, gated to planner checkpoints

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every load-bearing tool/command verified by running it or reading the committed config this session
- Architecture (pin mechanics): HIGH — lockfile entry, resolution, checksum, and upstream HEAD all cross-verified; the only prediction is the 2-line diff shape, grounded in Yarn's documented descriptor normalization
- Audit-gate feasibility: HIGH on current-state facts (what runs, what's missing, what each returns); MEDIUM on CI wiring specifics (action capabilities untested)
- Pitfalls: HIGH — 6 of 9 pitfalls derived from observed behavior this session; A1/A4 assumptions flagged

**Research date:** 2026-08-27
**Valid until:** 2026-09-03 (7 days — audit baselines and upstream HEAD are externally mutable; test-count baselines drift per phase by design)
