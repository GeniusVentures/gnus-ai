# Phase 18: Scanner Triage Upgrades - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 9 (7 modified, 1 new committed artifact, 1 transient probe artifact)
**Analogs found:** 8 / 9 (this is a tooling/config phase — nearly every edit target's analog is the file itself plus an in-repo precedent step)

> **Repo layout note (affects plan sequencing):** `gnus-ai` is itself a submodule of TokenContracts, and contains
> three nested submodules: `.devcontainer`, `contracts/gnus-ai`, `diamonds/GeniusDiamond` (`git submodule status`).
> The D-08 mirror-fix target `.devcontainer/config/.semgrep.yml` lives **inside the `.devcontainer` nested submodule** —
> that edit requires a commit inside `.devcontainer` AND a submodule-pointer bump in gnus-ai. CI checks out
> `submodules: recursive` (security-audit.yml:48-51), so the bumped pointer reaches CI.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/security-audit.yml` | config (CI workflow gate) | batch | itself — WR-01 snyk promotion (lines 11-15, 132-136), slither pin step (77-80), `--fail-none` gate (93-103), semgrep advisory + promotion condition (105-128) | exact |
| `package.json` (scripts only) | config (npm scripts) | batch | itself — `semgrep:scan` line 44 (`--exclude-rule weak-encryption` = owner-ruled exclusion precedent); `slither:scan`/`slither:check` lines 45-46; `security-check` chain line 54 | exact |
| `.semgrep.yml` (lines 10-16) | config (scanner rules) | transform (pattern matching) | itself — `paths:` blocks on 3 rules (96-99, 121-124, 133-136) + block-scalar `pattern: |` precedent (`expensive-operation-in-loop`, 197-209); replacement text is RESEARCH-verified | exact |
| `.devcontainer/config/.semgrep.yml` (lines 11-17) | config (scanner rules mirror; **nested submodule**) | transform | root `.semgrep.yml` fixed rule — mirror of; scope = `unsafe-external-call` ONLY | exact (mirror; files diverge elsewhere — see warning) |
| `slither.config.json` | config (scanner config) | batch | itself — existing key conventions (severity excludes lines 2-5, `filter_paths` line 13) | exact |
| `.slither.db.json` (NEW — tool-generated, committed) | config (generated committed artifact) | batch | `yarn.lock` — tool-generated, committed, diffs reviewed; companion `slither.config.json` | class-match only — **content is tool-generated, never hand-authored** |
| `scripts/utils/GNUSLifecyclePolicyLinking.ts` (13 `any` sites) | utility (config-load monkey-patch harness / hook) | event-driven (intercepts `getContractFactory` calls) | itself — CONFIG-LOAD SAFETY header (42-45), `runtimeHre()` lazy-require + eslint-disable (93-97), interception body (160-210); consumers hardhat.config.ts:14,28-29 + ~15 test suites | exact (file); **typing idiom has no in-repo analog** |
| `.planning/STATE.md` (scanner baselines) | documentation (ledger) | batch | itself — "Test Baseline Ledger (canonical)" (42-68, per-run table 52-68) + 07-03 disposition table (123-140) | exact |
| positive-control semgrep config (D-09 proof) | test/evidence (transient, /tmp) | batch | Phase-17 probe-evidence pattern — /tmp logs + per-run table + STATE entry (STATE.md:50, 97-98); template at `/tmp/18-research/probe-rule-positive.yml` | class-match |

## Pattern Assignments

### `.github/workflows/security-audit.yml` (config, batch)

**Analog:** itself — three precedent step-blocks to copy comment/shape conventions from.

**1. Version-pin comment convention** (lines 77-80) — the exact pattern D-01/D-07 extend for `slither-analyzer==0.11.6` and the new `semgrep==1.174.0` pin:

```yaml
      # Exact parity with the local gate version that produced the committed
      # 3-FP disposition baseline (07-03 Task 1).
      - name: Install slither 0.11.5
        run: pip install slither-analyzer==0.11.5
```

**2. The `--fail-none` gate step being retired** (lines 93-103) — the comment block documents the 0.11.5 empirics D-02 re-proves; the flip replaces the run line with bare `yarn slither:scan` and REWRITES this comment (pedantic-default + triage-db semantics, probe-then-flip evidence):

```yaml
      # Hard gate. NOTE: the plan specified `--fail-high`, but slither 0.11.5
      # keeps its pedantic exit code whenever findings print, so a bare
      # `--fail-high` invocation still exits 255 ... (07-03 Task 1) ...
      # The root-cause fix — a slither upgrade to a triage-capable line — is an
      # owner-gated follow-up recorded in STATE.
      - name: Slither static analysis
        run: yarn slither:scan --fail-none
```

**3. The semgrep advisory step being promoted** (lines 105-128) — drop `continue-on-error: true` (line 114), replace unpinned `pip install semgrep` (line 120) with `pip install semgrep==1.174.0`, keep the CR-01 pipefail comment (116-119) and the artifact upload (123-128). The promotion condition lives in the comment AND in STATE (line 138) — update both:

```yaml
      # ADVISORY BOOTSTRAP — the ONLY non-hard step. Promotion condition
      # (also tracked in STATE under "Phase 7 Decisions Logged (07-03)" so it
      # survives beyond this comment): promote to a hard gate by dropping the
      # continue-on-error below once the 07-03 local first-run baseline
      # (13 INFO-lint findings, one file) is confirmed stable across runs —
      # and after fixing the `unsafe-external-call` pattern parse error ...
      - name: Semgrep static analysis (advisory baseline)
        continue-on-error: true
        run: |
          # CR-01 (07-REVIEW): without pipefail, bash -e takes tee's exit 0 and
          # this step can never fail ...
          set -o pipefail
          pip install semgrep
          yarn semgrep:scan | tee semgrep-scan.log
```

**4. Zero-finding hard-gate comment precedent** (header, lines 11-15; step 130-136) — the WR-01 snyk closure is the model wording for the promoted steps' new comments ("red now means a NEWLY published advisory, nothing recorded" → Phase 18's green = zero untriaged findings):

```yaml
# WR-01 closure (2026-08-28): the 23 medium+ snyk transitives were fixed at
# the source via range-qualified resolutions in package.json (semver-
# compatible bumps only — no direct dependency changed), so the snyk step
# below is a zero-finding hard gate: red now means a NEWLY published
# advisory, nothing recorded.
```

**Also update:** the header baseline sentence (lines 8-10, "exactly 3 slither false positives, 13 semgrep INFO-lint findings") — it names the committed STATE baseline both gates now supersede.

---

### `package.json` (config, batch — scripts block only)

**Analog:** itself — line 44 is the owner-ruled exclusion precedent (07-02 `weak-encryption`); D-10's `--no-git-ignore` + `--exclude` set extends the same flag string:

```json
    "semgrep:scan": "semgrep scan --config .semgrep.yml --exclude-rule weak-encryption --error",
    "slither:scan": "slither . --config-file slither.config.json",
    "slither:check": "slither . --config-file slither.config.json --checklist",
```
(lines 44-46)

- `slither:scan` (45): D-01 confirms it is ALREADY bare (`--fail-none` lives only in the workflow step, line 103) — the drop happens in security-audit.yml, not here. Keep the `--config .semgrep.yml` relative reference EXACTLY as-is (RESEARCH Pitfall 6: rule-ID prefixing breaks `--exclude-rule` if the config path changes).
- `semgrep:scan` (44): gains `--no-git-ignore` + the RESEARCH Pattern-3 `--exclude` list (lib/typechain/out/cache/broadcast/diamond-abi/dist/logs/tmp/notes/.yarn) in the SAME change.
- `security-check` (line 54): the chain's honesty note lives in STATE 07-03 (line 139) — update it post-promotion.

---

### `.semgrep.yml` (config, transform — lines 10-16 replacement)

**Analog:** itself — structural shape of a rule + the `paths:` blocks on 3 existing rules.

**The broken rule being replaced** (lines 10-16; `pattern: require(success` is the documented parse failure):

```yaml
  - id: unsafe-external-call
    patterns:
      - pattern: ".call{"
      - pattern: require(success
    message: "Unsafe external call without proper error handling. Consider using a safe wrapper or checking return data."
    severity: WARNING
    languages: [solidity]
```

**Structural conventions to preserve** — `paths:` key on rules that scope the surface (three precedents: `diamond-selector-clash` 96-99, `diamond-storage-violation` 121-124, `diamond-storage-violation-2` 133-136):

```yaml
    paths:
      exclude:
        - test/**
        - contracts/mocks/**
```

**Block-scalar precedent** — `expensive-operation-in-loop` (lines 197-209) is the existing in-repo use of `pattern: |` with a multi-line pattern; the fixed rule uses block scalars because `$K: $V` breaks plain-scalar YAML (RESEARCH anti-pattern):

```yaml
      - pattern: |
          .call{
          .delegatecall{
          .staticcall{
```

**Replacement content:** use the RESEARCH-verified copy-ready rule verbatim (18-RESEARCH.md "Code Examples" → "The verified fixed rule") — generic mode, `pattern-either` of the two `(bool $SUCCESS, ...)` destructure shapes, four `pattern-not-inside` suppression blocks, `paths: include: ["**/*.sol"]`. Do NOT re-derive it; it was proven end-to-end on this tree (positive control exactly 2 findings, shipped 0).

---

### `.devcontainer/config/.semgrep.yml` (config, transform — lines 11-17 mirror)

**Analog:** root `.semgrep.yml` fixed rule (the fix lands in root first, then mirrors).

**The broken mirror** (lines 11-17 — identical rule body to root lines 10-16):

```yaml
  - id: unsafe-external-call
    patterns:
      - pattern: ".call{"
      - pattern: require(success
    ...
    languages: [solidity]
```

**Scope warning (RESEARCH anti-pattern, verified by diff):** the two files DIVERGE beyond this rule — the devcontainer copy lacks the `paths: exclude` blocks on 3 rules, carries an extra `pattern-not-inside: event $EVENT(...);` on `diamond-selector-clash` (lines 93-94), has trailing whitespace, and no final newline. **Mirror-fix scope = the `unsafe-external-call` rule ONLY.** Do not full-sync the file.

**Sequencing:** this file is inside the `.devcontainer` nested submodule → commit there first, then bump the gnus-ai submodule pointer. (Per project memory: run this on the main tree, not an isolated worktree — worktrees lose nested-submodule commits.)

---

### `slither.config.json` (config, batch)

**Analog:** itself — flat key set; the new key follows the existing placement (top-level, alphabetical-ish grouping of toggles before path data):

```json
{
  "exclude_informational": true,
  "exclude_optimization": true,
  "exclude_low": true,
  "exclude_medium": false,
  "exclude_high": false,
  ...
  "filter_paths": "node_modules|artifacts|cache|...",
  "disable_color": false
}
```
(lines 2-5, 13-14)

Add `"triage_database": ".slither.db.json"` (D-01). Key spelling is load-bearing — RESEARCH verified it is in slither's `defaults_flag_in_config`; unknown keys are silently logged-and-skipped. The file has NO comments (JSON) — per CONTEXT discretion, prose lives in the workflow header + STATE, not here. D-05: zero detector excludes are added; severity-level keys stay exactly as-is.

---

### `.slither.db.json` (NEW — config, batch; tool-generated)

**Analog (class only):** `yarn.lock` — the repo's existing tool-generated, committed, diff-reviewed artifact. The triage db is written by `slither --triage-mode` (a JSON array of full result dicts each carrying the sha3-256 finding id); **never hand-authored or hand-edited** (Security Domain: db tampering is a listed threat — db entries must match live `--show-ignored-findings` output).

Generation command (RESEARCH, verified): `slither . --config-file slither.config.json --triage-mode --triage-database .slither.db.json` — answer `All` at both detector prompts; MUST be generated on 0.11.6, never 0.11.5 (Pitfall 3). Verified: `.gitignore` has NO rule matching a root `.slither.db.json` (only `.vscode/settings.json` and `diamond-abi/**/*.json`) — no .gitignore change needed to commit it.

---

### `scripts/utils/GNUSLifecyclePolicyLinking.ts` (utility, event-driven — 13 `any` sites)

**Analog:** itself — the harness's own constraint documentation and conventions.

**The binding constraint** (header, lines 42-45) — governs every typing choice at all 13 sites:

```
 * CONFIG-LOAD SAFETY: this module must NOT `import ... from 'hardhat'` at the top level —
 * hardhat.config.ts imports it during config loading, and the main 'hardhat' entry throws
 * LIB_IMPORTED_FROM_THE_CONFIG when the HRE is not yet constructed. All runtime access goes
 * through a lazily required HRE (or an explicit hre parameter).
```

**The lazy-require + eslint-disable convention** (lines 93-97) — the pattern type annotations must not disturb:

```typescript
// eslint-disable-next-line @typescript-eslint/no-var-requires
function runtimeHre(): any {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('hardhat');
}
```

**The 13 sites** (verified at exact line numbers this session): 77 (`signer?: any` + `hre?: any`), 94 (`runtimeHre()` return), 104 (`deployAndLinkLifecyclePolicy(hre?: any)`), 129 (`deployAndLinkLifecyclePolicyWithSigner(signer: any)`), 152 (`patchGetContractFactory(hre: any, ...)`), 158 (`const ethersRef: any`), 160 (`nameOrAbi: any` + `opts?: any`), 162 (`let artifact: any`), 170 (`byFile: any` in the `Object.values` callback), 220 (`installLifecyclePolicyLinker(..., hre?: any)`), 235 (`installLazyLifecyclePolicyLinker(hre: any)`).

**The awkward site** (lines 160-162) intercepts the overloaded `getContractFactory(nameOrAbi, opts)` — D-06 prescribes `unknown` + narrowing or `Parameters<>` extraction; keep `original(nameOrAbi, opts)` passthrough untouched.

**Proof obligations attached to this file:** `npx tsc --noEmit` green under `strict: true` with `./scripts` included (tsconfig.json:7,16) AND the config load still works — the module is imported by `hardhat.config.ts:14` and wired via `extendEnvironment` (hardhat.config.ts:28-29), and ~15 test suites call `setupLifecyclePolicyLinking()` in `before` hooks; `yarn test:all` at the STATE ledger baseline (666/2/0 + 215/0/5) is the regression gate.

**No in-repo typing-idiom analog:** zero occurrences of `import type` / `typeof import` / `Parameters<` in `scripts/` — the concrete annotations are Claude's-discretion territory per CONTEXT D-06; RESEARCH Pitfall 5 is the governing guidance.

---

### `.planning/STATE.md` (documentation, batch — scanner baseline record)

**Analog:** itself — two sections supply the format.

**1. The per-run proof table + /tmp-log convention** ("Test Baseline Ledger (canonical)", lines 50-68) — the shape for the new scanner baseline entries (slither double-run stability; semgrep N-run; D-09 positive control):

```markdown
Per-run proof (all runs exit 0; logs /tmp/17-05-testall-{1..5}.log + /tmp/17-05-invariant-{1..10}.log, captured 2026-08-31):

| # | Gate | Date | Result | Wall |
|---|------|------|--------|------|
| 1 | `yarn test:all` (Hardhat + Foundry) | 2026-08-31 | 666/2/0 + 215/0/5 — ok | 56s |
```

**2. The 07-03 disposition table** (lines 123-140) — the format for the 37-item D-04 disposition set (per-command exit code / finding identity / disposition / log path columns), and the home of the records this phase updates: semgrep 13-finding baseline (line 131), slither 3-FP baseline (line 132), exit-code mechanics (line 136), promotion follow-up (line 138), security-check honesty note (line 139).

**Placement (discretion):** extend the existing ledger section or add a sibling "Scanner Baseline" section — single-source either way; the workflow header (security-audit.yml:8-10) already points here.

---

### Positive-control semgrep config (D-09 proof — transient, /tmp)

**Analog:** Phase-17 probe-evidence pattern — transient /tmp artifacts + per-run table + STATE ledger entry (STATE.md:50, 97-98); 17-05 logs convention `/tmp/17-05-*.log`. Template already exists from research: `/tmp/18-research/probe-rule-positive.yml` (the fixed rule minus the four suppression blocks, ~12 lines). Not committed. Expectation is exact: **2 findings** with suppressions dropped (`GNUSContractAssets.sol:48`, `TransferHelper.sol:52` — both sites re-verified by grep this session; they are the ONLY `.call{` sites in `contracts/`), **0** with the shipped rule. No other count passes.

---

## Shared Patterns

### Exact version pinning with provenance comment
**Source:** `.github/workflows/security-audit.yml:77-80`
**Apply to:** the 0.11.6 slither pin and the NEW `semgrep==1.174.0` pin (replacing unpinned line 120)
```yaml
      # Exact parity with the local gate version that produced the committed
      # 3-FP disposition baseline (07-03 Task 1).
```
D-07 makes the pin load-bearing: unpinned `pip install semgrep` floats to 1.175.0 today.

### Probe-then-flip
**Source:** `.github/workflows/security-audit.yml:93-103` (the 07-03 comment block is the recorded instance) + STATE.md:136
**Apply to:** every gate-spelling change — 0.11.6 exit-code probes and the two-consecutive-run triage stability proof MUST precede the workflow flip (D-02); the D-09 positive control MUST precede the semgrep promotion.

### Zero-finding hard-gate promotion wording
**Source:** `.github/workflows/security-audit.yml:11-15` (WR-01 snyk closure) and 105-112 (semgrep promotion condition, duplicated in STATE:138)
**Apply to:** both promoted steps' replacement comments — state what red means post-promotion ("a NEW untriaged finding, nothing recorded"), and keep the promotion rationale in STATE so it survives beyond the comment.

### Owner-ruled exclusion with recorded rationale
**Source:** `package.json:44` (`--exclude-rule weak-encryption`) + STATE 07-02/07-post-review records
**Apply to:** any exclusion arising from the 37-item disposition set — contract-side findings get owner-ruled rule exclusion (script flag + STATE rationale) or a routing event (07-03 D-09 precedent, STATE:128-130); never `nosemgrep` in contract source (D-10) and never slither detector excludes (D-05).

### Evidence artifacts: /tmp logs + per-run table + STATE entry
**Source:** STATE.md:50-68 (Phase-17 N-run proof)
**Apply to:** the slither probe sequence (8 ordered probes in 18-RESEARCH Pattern 1), the semgrep N-run, and the D-09 positive control.

### Committed-baseline home
**Source:** `.github/workflows/security-audit.yml:8-10` → `.planning/STATE.md`
**Apply to:** the new scanner baselines + the `.slither.db.json` linkage — STATE names the db and the 3 triaged FP identities; the workflow header points at STATE.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.slither.db.json` content | config (generated) | batch | No triage db exists anywhere in the repo — generated by `slither --triage-mode`, never hand-authored; `yarn.lock` is the class analog (tool-generated, committed, diffs reviewed) |
| TS typing idiom (`import type` / `typeof import` / `Parameters<>`) for the 13 sites | utility | event-driven | Zero occurrences in `scripts/` — planner should direct executors to RESEARCH Pitfall 5 + CONTEXT D-06 discretion (type-only imports, `unknown` + narrowing) rather than an in-repo exemplar |

## Metadata

**Analog search scope:** repo root configs (`.github/workflows/`, `.semgrep.yml`, `.devcontainer/config/`, `slither.config.json`, `package.json`, `tsconfig.json`, `.gitignore`), `scripts/` + `scripts/utils/`, `hardhat.config.ts`, `contracts/gnus-ai` (`.call{` sites), `.planning/STATE.md`
**Verification runs this session:** `git submodule status` (3 nested submodules confirmed), repo-wide `.call{` grep (exactly 2 sites), `.gitignore` scan (nothing blocks `.slither.db.json`), `import type|typeof import|Parameters<` grep over `scripts/` (zero hits), consumer grep for the linking module (hardhat.config.ts:14 + test suites)
**Pattern extraction date:** 2026-08-31
