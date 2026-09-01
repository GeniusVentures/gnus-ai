# Phase 18: Scanner Triage Upgrades - Research

**Researched:** 2026-08-31
**Domain:** Security-scanner tooling (slither triage mode, semgrep rule engineering, CI gate promotion)
**Confidence:** HIGH — every load-bearing claim verified live (empirical probe runs on this tree with the locally installed tools) or from official source at exact tags (crytic/slither@0.11.6 fetched from GitHub raw; semgrep 1.174.0 local binary + help text)

## Summary

Phase 18 replaces two version-specific scanner workarounds with real triage. On the slither side (SEC-09), the research **verified from the 0.11.6 source** that the CONTEXT's model is correct: the `--fail-*` flags form a mutually exclusive `fail_on` group defaulting to PEDANTIC; exit is binary (`sys.exit(-1)` → shell 255, or 0); PEDANTIC fails iff `bool(results_detectors)`; and triaged findings are filtered out of `results_detectors` by `valid_result()` *before* the exit computation — so a fully-triaged run genuinely exits 0 bare. The finding id is `sha3_256` over the description pieces **including source mappings**, which makes line/description drift near the 3 FP sites invalidate triage entries (D-03's "correct red" — verified against crytic/slither#1965, a closed bug about exactly this instability). The 0.11.5→0.11.6 delta is verified at the registry level: exactly one new detector import (`msg-value-in-nonpayable`, HIGH impact / HIGH confidence, per both the release notes and the detector source); the other detector changes are FP-reduction fixes that do not touch `weak-prng` or `erc721-interface`. The live 0.11.5 baseline re-run on today's tree reproduces exactly the 3 known FPs / exit 255 / "81 contracts with 58 detectors".

On the semgrep side (SEC-10), the research **empirically confirmed every D-08/D-09 claim on this tree with semgrep 1.174.0**: the committed `unsafe-external-call` rule fails to parse (`Invalid pattern for Solidity: Stdlib.Parsing.Parse_error` on `require(success`) while the scan still exits 0 — the silent-never-runs failure; the CONTEXT's generic-mode fixed rule shape (a) parses, (b) fires on **exactly 2** sites in the positive control (`GNUSContractAssets.sol:48`, `TransferHelper.sol:52`), and (c) ships with **0** findings once the suppression blocks are added. Two plan-shaping discoveries go beyond the CONTEXT: **(1)** the `$K: $V` metavariable pairs break YAML as plain scalars (`mapping values are not allowed here`) — all fixed-rule patterns MUST use block scalars (`pattern: |`); **(2)** `--no-git-ignore` (D-10) does reach the submodule but ALSO un-ignores every other gitignored directory: the raw flag takes the scan from 81 files/13 findings to 341 files/168 findings, flooding from `lib/forge-std` (31 vendored `.sol`) and generated `typechain-types/` (78 `typescript-any-usage` findings). The gate needs `--exclude` flags (or a project `.semgrepignore`) alongside `--no-git-ignore`, and the first real scan surfaces a concrete D-04 disposition set of **37 owner-ruled items** (31 `diamond-selector-clash` + 4 `unsafe-math-operation` in submodule contracts, 2 `hard-coded-secret` in commented-out `.devcontainer` code) — none fixable in-phase under the no-contract-changes boundary.

**Primary recommendation:** Plan three sequenced waves — (1) upgrade + probe on 0.11.6 (exit-code probes, triage marking, double-run stability), (2) semgrep rule fix + `--no-git-ignore` **with explicit generated/vendored exclusions** + D-06 typing + D-09 positive control, (3) flip both CI gates and record the new baselines in STATE — with the 37-item disposition table routed to the owner before the semgrep gate can go green.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### SEC-09 — slither triage mechanism
- **D-01:** Committed triage database. Pin slither 0.11.6 (latest, 2026-07-28) in CI (`pip install slither-analyzer==0.11.6`) and locally (brew bump from 0.11.5_6). One local `--triage-mode` run marks the 3 Phase-9 FPs (weak-prng @ `GNUSWithdrawLimiterStorage.calculateCurrentBin`; erc721-interface @ `GNUSBridge.approve` + `GNUSBridge.transferFrom`); commit `.slither.db.json`; add `"triage_database": ".slither.db.json"` to `slither.config.json`; drop `--fail-none` from `yarn slither:scan` so the gate runs bare — **green = zero untriaged findings**, the only reading that satisfies the owner's "gate exits 0 without waivers" ruling (07-03's `--fail-none` spelling is a flag saying don't-count, not a finding state).
- **D-02:** Probe-then-flip on exit codes. 07-03's empirical 0.11.5 findings ("`--fail-high` still exits 255", "`--fail-high --fail-none` is a mutual-exclusion error") **conflict with current slither source on both lines** (exclusive `fail_on` group, pedantic default, all-findings-triaged exits 0 bare). The executor MUST re-prove exit-code mechanics and triage stability (two identical consecutive runs) on 0.11.6 BEFORE changing any gate spelling — the 0.11.5 empirics do not transfer. Note: `--triage-mode`/`--triage-database`/`--show-ignored-findings` already exist in 0.11.5; the 0.11.6 bump is about the maintained line, not new triage capability.
- **D-03:** Triage-id drift is the known failure mode and a CORRECT red. Matching is by finding-id hash (legacy description fallback), with historical instability (crytic/slither#1965). Line/description drift near the 3 FP sites invalidates entries and reds the gate until re-triaged — that is the mechanism working, not flakiness; do not "fix" it by widening suppression.

#### New-findings policy (standing rule for whatever the upgraded line surfaces)
- **D-04:** Triage-first + owner review; real findings become routing events. Every finding beyond the committed 3-FP set gets dispositioned: triaged-as-FP (with evidence, committed to the db) or recorded as a routing event to an owning phase (STATE 07-03 D-09 precedent). **No contract-source fixes in Phase 18** — deployed-facet fixes require diamond-cut upgrade discipline (Safe proposer flow, EIP-170 headroom, test re-baseline) and belong to an owning phase. Phase 18 ends when the upgraded gate exits 0 with every finding dispositioned. Scripts/TS-side findings ARE fixed in-phase (they carry no deployment discipline).
- **D-05:** Detector exclusion rejected outright. `slither.config.json` keeps zero detector excludes (severity-level only, as today). Blanket detector exclusion permanently blinds the gate to future code and is silent suppression. De-risked by the verified delta: 0.11.5→0.11.6 adds exactly **one** new detector (`msg-value-in-nonpayable`, HIGH impact/confidence — the one realistic new-finding source); every other detector change is false-positive *reduction*.

#### SEC-10 — semgrep gate
- **D-06:** Zero-findings hard gate. Type the 13 `typescript-any-usage` sites in `scripts/utils/GNUSLifecyclePolicyLinking.ts` (lines 77×2, 94, 104, 129, 152, 158, 160×2, 162, 170, 220, 235); keep blanket `--error` so every rule at every severity enforces with **nothing recorded** — matching the zero-finding posture of the npm-audit/snyk steps and the WR-01 fix-at-source precedent. Harness constraint: the file monkey-patches Hardhat config loading — **top-level imports must stay type-only** (a plain value import of `hardhat` breaks config loading); the awkward site at lines 160-162 intercepts an overloaded `getContractFactory` (use `unknown` + narrowing or `Parameters<>` extraction). The rejected alternative: severity-scoping the gate (`--severity WARNING --severity ERROR`) — it would make the lint rule advisory forever AND drop INFO findings from the CI artifact entirely, killing the baseline diff (replicating the `--fail-none` compromise this repo flags as awaiting root-cause fix).
- **D-07:** Pin CI semgrep to `semgrep==1.174.0`. The pin is load-bearing, not hygiene: PyPI already serves 1.175.0, exit semantics were proven version-sensitive on 1.174.0, and parity with the local brew 1.174.0 mirrors the slither `==0.11.5` "exact parity with the local gate version" convention two steps above it in the same workflow.
- **D-08:** The fixed rule detects **unchecked `.call{}` results**, in generic mode (native-Solidity `.call{...}(...)` and tuple-destructure spellings do NOT parse on 1.174.0). Validated shape: `patterns:` with `pattern-either` of `(bool $SUCCESS, ) = $R.call{$K: $V}(...);` and `(bool $SUCCESS, $DATA) = $R.call{$K: $V}(...);`, suppressed by `pattern-not-inside` blocks pairing each assignment shape with a following `require($SUCCESS, ...);` or `if (!$SUCCESS) { ... }`; `paths: include: ["**/*.sol"]`. Fires on **neither** existing site — both verified checked: `contracts/gnus-ai/libraries/TransferHelper.sol:52` (`require(success, 'STE')`), `contracts/gnus-ai/GNUSContractAssets.sol:48` (`if (!success) { revert ErrorWithdrawingEther(); }`) — so it ships green with zero triaged baseline. The identical broken pattern also lives at `.devcontainer/config/.semgrep.yml:14` — mirror the fix there.
- **D-09:** The executes-proof is mandatory. A rule whose pattern fails parse mid-scan **still exits 0 reporting "Rules run: 1, Findings: 0"** — the exact silent-never-runs failure being fixed. Verification MUST include a positive control: run the positive pattern without the suppression blocks → expect **exactly 2 findings** (`GNUSContractAssets.sol:48`, `TransferHelper.sol:52`), then the shipped rule → 0 findings. "Validates" is not "executes".
- **D-10:** Expand the scan surface to the submodule. Add `--no-git-ignore` to `yarn semgrep:scan` — semgrep's default gitignore-aware discovery **skips `contracts/gnus-ai` entirely**; today's surface is 8 outer-repo mock `.sol` files plus the TS scripts, so the rule as scripted today can never reach the real call sites. The first full scan of the real `.sol` surface may surface new findings from the other ~22 rules; each is dispositioned per D-04: fixed if scripts/TS-side, owner-ruled rule exclusion or routing event if contract-side. **No `nosemgrep` annotations in contract source** — that is both a source change and silent suppression.

### Claude's Discretion
- The concrete type annotations for the 13 sites (`unknown` + narrows, explicit interfaces, `Parameters<>` extraction), provided imports stay type-only and the Hardhat config load + `npx tsc` surface stays green.
- Exact wording/placement of the `triage_database` key, pin comments, and gate comments in `slither.config.json` / `security-audit.yml` / `package.json`, provided the committed-artifact chain (db + config + workflow) stays self-describing per the file's existing comment conventions.
- Sequencing of the probe runs (0.11.6 exit-code probes, double-run triage stability, semgrep N-run) inside the phase, provided every probe precedes its gate flip.
- How STATE records the new scanner baselines — extending the Phase-17 "Test Baseline Ledger (canonical)" section or a sibling Scanner Baseline section, single-source either way.

### Deferred Ideas (OUT OF SCOPE)
- Fix-at-source for any real contract finding the upgraded scanners surface — routing event to an owning phase instead (D-04); that phase owns the diamond-cut discipline.
- Any semgrep OSS baseline/triage mechanism beyond zero-findings — unnecessary while the zero baseline holds.
- CI hosting for the Foundry suite — already deferred out of Phase 17 (D-07 there); untouched here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-09 | slither upgraded to a triage-capable line; the severity gate expressed via triage config (replaces the `--fail-none`-only workaround settled on slither 0.11.5) | 0.11.6 exit semantics source-verified (exclusive `fail_on` group, PEDANTIC default, triage-filtered results → bare exit 0); `triage_database` verified as a config-file key on 0.11.6; interactive triage flow verified from source + official wiki; id-hash mechanics (sha3_256 incl. source mappings) verified; live 0.11.5 baseline re-run confirms the 3 FP identities; exactly-one-new-detector delta verified |
| SEC-10 | semgrep `unsafe-external-call` pattern parses and runs (fixed pattern); CI semgrep step promoted from continue-on-error advisory to hard gate on a stable baseline | Fixed rule verified end-to-end on this tree (positive control exactly 2 findings; shipped rule 0 findings; 0 parse errors); broken-rule silent failure reproduced (exit 0 without `--error`); `--no-git-ignore` flag spelling + submodule-skip + gitignore-flood verified empirically on 1.174.0; exact 37-item disposition set enumerated; 13 `any` sites confirmed at exact CONTEXT line numbers |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| slither severity gate | CI workflow (security-audit.yml) | Local CLI (brew 0.11.6) | Gate enforcement lives in CI; the committed triage db + config make local and CI runs read the same suppression state |
| Triage marking (one-time) | Local CLI (`--triage-mode`) | — | Interactive stdin prompt; cannot run in CI. The db it writes is the committed artifact CI consumes |
| Finding-id stability | slither core (sha3_256 over description + source mappings) | — | Owned entirely by the tool; the repo's only lever is re-triage on drift (D-03) |
| semgrep rule correctness | `.semgrep.yml` (+ `.devcontainer/config/.semgrep.yml` mirror) | `package.json` script flags | Pattern parse/match behavior is rule-YAML + CLI-version owned; the `--error`/discovery flags are script-owned |
| Scan-surface definition | `package.json` `semgrep:scan` flags | Default `.semgrepignore` (tool-bundled) | `--no-git-ignore` + `--exclude` list defines the surface; the tool's built-in default ignore keeps covering `node_modules/` and `test/` |
| TS type safety (13 sites) | `scripts/utils/GNUSLifecyclePolicyLinking.ts` | tsconfig (`strict: true`, includes `./scripts`) | Repo source, fix-at-source per D-06; constraint: type-only imports (module loads during hardhat config load) |
| Baseline record | `.planning/STATE.md` | Workflow header comment | Established repo pattern (security-audit.yml:8 already points at STATE) |
| Disposition rulings (37 items) | Owner (human) | STATE routing-event records | D-04: contract-side findings cannot be fixed in-phase; owner rules on rule exclusion vs routing |

## Standard Stack

No new project dependencies. This phase pins two external security tools (already in use) and touches config/CI/TS only.

### Core (tool pins)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `slither-analyzer` | 0.11.6 (PyPI latest; released 2026-07-28) [VERIFIED: PyPI `pip index versions` + GitHub release notes] | Solidity static analysis with triage-capable gate | Maintained line; triage flags present since ≤0.11.5 but the maintained line carries the FP-reduction + one-new-detector delta; `requires-python >=3.10` (CI 3.12 ✓, brew python 3.14 ✓) |
| `semgrep` | 1.174.0 (pinned; PyPI latest is 1.175.0) [VERIFIED: PyPI `pip index versions` + local brew 1.174.0] | Multi-language pattern scanner | Version whose exit semantics and generic-mode behavior were proven on this tree; exact parity with local brew install per the repo's pin convention |

### Supporting (already installed, unchanged)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Foundry (`forge`) | 1.7.1 (local; CI installs via foundryup) | slither's compilation driver (`forge build --build-info --skip ./test/foundry/** ./scripts/foundry --force` observed in the live run) | Every slither run — slither auto-detects `foundry.toml` |
| brew `slither-analyzer` | 0.11.5_6 → 0.11.6 (bottled, available) [VERIFIED: `brew info slither-analyzer`] | Local gate parity with the CI pin | D-01's local leg |
| TypeScript | 5.9.3 (devDependency) | `npx tsc` typecheck surface for the D-06 typing | `tsconfig.json` is `strict: true` and includes `./scripts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| slither triage db (committed `.slither.db.json`) | `//slither-disable` inline comments (officially supported, wiki-documented) | REJECTED by phase boundary: contract-source change + silent suppression (D-04/D-10 posture) |
| semgrep zero-findings gate + `--exclude` for vendored dirs | Project `.semgrepignore` file | Either works; `.semgrepignore` REPLACES the tool's bundled default ignore entirely (would need to re-list `node_modules/`, `test/`, etc. by hand) — `--exclude` flags are purely additive and preserve today's semantics. Both are Claude's-discretion-adjacent (D-10 implementation detail); `--exclude` is the lower-risk default |
| `--no-git-ignore` + excludes | Scanning the submodule by explicit path target (`semgrep scan ... contracts/gnus-ai .`) | Explicit targets also bypass the submodule skip without un-ignoring gitignored dirs; but it changes the invocation shape more and still needs the generated-dir exclusions for the outer repo. `--no-git-ignore` + excludes is the D-10-locked direction |

**Installation (CI, in `security-audit.yml`):**
```bash
pip install slither-analyzer==0.11.6   # was ==0.11.5 (step name + line 80)
pip install semgrep==1.174.0           # was unpinned `pip install semgrep` — floats to 1.175.0 today
```

**Local (brew):**
```bash
brew upgrade slither-analyzer   # 0.11.5_6 → 0.11.6 (bottled, available now)
# semgrep stays 1.174.0 (brew stable == local == CI pin)
```

**Version verification (run this session, 2026-08-31):**
- `pip3 index versions slither-analyzer` → latest 0.11.6 (full 0.x history listed) [VERIFIED: PyPI]
- `pip3 index versions semgrep` → latest 1.175.0, 1.174.0 present [VERIFIED: PyPI]
- `brew info slither-analyzer` → "0.11.5_6 → stable 0.11.6 (bottled)"; `brew info semgrep` → stable 1.174.0 [VERIFIED: Homebrew]

## Package Legitimacy Audit

> slopcheck was installed in an isolated throwaway venv (`/tmp/18-research/slopcheck-venv`) and run per protocol. **Finding: slopcheck is npm-ecosystem-only** — it queried the npm registry for both packages, producing a false `[SLOP]` on `slither-analyzer` ("does not exist on npm" — it is a PyPI package; exactly the cross-ecosystem confusion the protocol warns about, in reverse). It also attempted `npm install semgrep` against the project cwd, which aborted harmlessly on ERESOLVE (verified: `git status --porcelain` clean afterward). The npm-registry verdicts are therefore recorded as N/A and both packages were verified through ecosystem-correct, multi-channel checks instead.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| slither-analyzer | PyPI | 0.11.6 released 2026-07-28 (project since 2018) | n/a (not checked; tool is the industry standard) | github.com/crytic/slither [VERIFIED: source files fetched at tag 0.11.6] | N/A (npm-only false SLOP) | Approved — PyPI listing + official GitHub tag-source + release notes + Homebrew core cross-verified |
| semgrep | PyPI | 1.174.0 (project since 2019, returntocorp→semgrep org) | n/a | github.com/semgrep/semgrep [VERIFIED: local 1.174.0 binary + help text] | [OK] (against npm registry — not the correct registry) | Approved — PyPI listing + local official binary + Homebrew core cross-verified |

**Packages removed due to slopcheck [SLOP] verdict:** none (the single [SLOP] was a cross-ecosystem false positive, documented above)
**Packages flagged as suspicious [SUS]:** none

No other external packages are introduced by this phase. CI installs exactly the two pinned tools above.

## Architecture Patterns

### System Architecture Diagram (gate data flow, post-Phase-18)

```
                 ┌──────────────────────────── slither leg (SEC-09) ───────────────────────────┐
 commit ──► CI   │ pip install slither-analyzer==0.11.6                                        │
           push  │ forge build (foundry.toml) ──► 58+ detectors run ──► raw findings           │
                 │                                                        │                     │
                 │                       .slither.db.json (committed triage db)              │
                 │                                                        ▼                     │
                 │              valid_result(): drop findings whose sha3_256 id             │
                 │              matches a db entry (unless --show-ignored-findings)          │
                 │                                                        ▼                     │
                 │        PEDANTIC default: fail_on_detection = bool(results_detectors)      │
                 │                            │                        │                     │
                 │                    untriaged remain          all triaged/none             │
                 │                            ▼                        ▼                     │
                 │                      exit 255 (RED)            exit 0 (GREEN)            │
                 └───────────────────────────────────────────────────────────────────────────┘
                 ┌──────────────────────────── semgrep leg (SEC-10) ──────────────────────────┐
                 │ pip install semgrep==1.174.0                                               │
                 │ yarn semgrep:scan = .semgrep.yml (fixed rule) + --no-git-ignore            │
                 │                    + --exclude <generated/vendored dirs> + --error        │
                 │                       │                                            │      │
                 │        discovery: submodules IN (contracts/gnus-ai, .devcontainer);      │
                 │        node_modules/ + test/ still excluded (bundled default ignore)      │
                 │                       ▼                                            ▼      │
                 │             any finding (exit 1)                          0 findings      │
                 │             incl. rule parse errors (exit 2)                exit 0 (GREEN) │
                 └────────────────────────────────────────────────────────────────────────────┘
```

### Pattern 1: Probe-then-flip (repo rule, 07-04; D-02 applies it to 0.11.6)
**What:** No gate spelling changes on remembered empirics — every exit-code claim re-proven on the exact pinned version before the workflow flips.
**When to use:** Before touching `security-audit.yml` lines 79-80 (`Install slither 0.11.5`), 102-103 (`Slither static analysis … --fail-none`), 113-121 (semgrep advisory step).

**Verified 0.11.6 probe sequence the plan should encode (order matters):**
1. `brew upgrade slither-analyzer` → `slither --version` == 0.11.6
2. Bare run `yarn slither:scan` → expect **3 findings** (the same detector+site identities as the 07-03 baseline; the live 0.11.5 run re-confirmed them at `GNUSWithdrawLimiterStorage.sol#114-138/#137`, `GNUSBridge.sol#406-410`, `GNUSBridge.sol#506-516`) and **exit 255** — proves PEDANTIC default still fails on findings
3. Mutual-exclusion probe `yarn slither:scan --fail-high --fail-none` → expect argparse error (source-verified: one mutually exclusive `fail_on` group)
4. Triage marking: `slither . --config-file slither.config.json --triage-mode --triage-database .slither.db.json` → interactive prompt appears **per detector** (`Results to hide during next runs: "0,1,..." or "All" (enter to not hide results):` — source-verified prompt text); answer `All` at both detector prompts (all 3 are FPs); `.slither.db.json` written as a JSON **array** of full result dicts each carrying the sha3-256 `id`
5. First stability run `yarn slither:scan` (bare, db committed path via config) → expect **0 findings printed, exit 0**
6. Second identical run → expect byte-identical "0 result(s)" + exit 0 (D-02's two-consecutive-runs stability bar)
7. Re-surface probe `yarn slither:scan --show-ignored-findings` → expect the 3 FPs visible again AND **exit 255** (source-verified: show-ignored short-circuits `valid_result()` to True before the db check, so triaged findings re-enter `results_detectors` under PEDANTIC) — document that re-surface runs are advisory-only and never the gate
8. THEN flip the workflow: pin 0.11.6, gate step `yarn slither:scan` bare (drop `--fail-none`), update comments

### Pattern 2: semgrep executes-proof (D-09) — verified exact procedure
1. Positive control: run the rule with the four `pattern-not-inside` blocks deleted → **exactly 2 findings** (`contracts/gnus-ai/GNUSContractAssets.sol:48`, `contracts/gnus-ai/libraries/TransferHelper.sol:52`). No other count passes. (Verified this session: 2/2 exact.)
2. Shipped rule → **0 findings, 0 parse errors**. (Verified this session.)
3. Reproduce the failure mode once for the record: the committed broken rule + plain scan exits **0** with `Rule parse error … Invalid pattern for Solidity: Stdlib.Parsing.Parse_error` buried in output (verified this session). Nuance: under `--error` a parse-broken rule exits **2** even with 0 findings (verified), so the promoted gate does catch config-level breakage — but only the positive control proves the rule actually *matches* (a parsing-but-never-matching rule still exits 0).

### Pattern 3: surface expansion with compensating exclusions (D-10, empirically calibrated)
`--no-git-ignore` alone: 81 → 341 files, 13 → 168 findings. The added `--exclude` set (verified to produce the intended 119-file / 42-`.sol` surface):

```
--exclude lib/** --exclude typechain-types/** --exclude typechain/** --exclude out/**
--exclude cache/** --exclude cache_forge/** --exclude artifacts/** --exclude broadcast/**
--exclude diamond-abi/** --exclude diamond-typechain-types/** --exclude dist/**
--exclude logs/** --exclude tmp/** --exclude notes/** --exclude .yarn/**
```

(These mirror the repo `.gitignore` entries that semgrep's bundled default ignore does NOT already cover; `node_modules/` and `test/` remain excluded by the bundled default ignore — verified empirically: 0 files from either under `--no-git-ignore`. A project `.semgrepignore` would REPLACE that bundled default — riskier.)

### Anti-Patterns to Avoid
- **Plain-scalar YAML patterns containing `$K: $V`:** `pattern: (bool $SUCCESS, ) = $R.call{$K: $V}(...);` as a plain scalar is invalid YAML (`mapping values are not allowed here`, line-5-col-52 error — hit this session). Always block-scalar (`pattern: |`) these patterns.
- **`--show-ignored-findings` in any gate script:** it re-adds triaged findings to the pedantic count (exit 255). Re-surface is a manual/on-demand action only.
- **Detector excludes / `nosemgrep` in contract source / widened suppression on drift:** all locked out by D-03/D-04/D-05/D-10.
- **Full-syncing `.devcontainer/config/.semgrep.yml` to root:** the files differ beyond the broken rule (devcontainer copy lacks the `paths: exclude: test/**, contracts/mocks/**` blocks on 3 rules, has an extra `pattern-not-inside: event $EVENT(...)` on `diamond-selector-clash`, trailing whitespace, no final newline). D-08's mirror-fix scope is the `unsafe-external-call` rule ONLY.
- **Bare `--no-git-ignore` without excludes:** floods the gate with vendored/generated findings (168, of which 118 are forge-std/typechain noise) — can never reach zero.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding suppression state | Custom baseline diff scripts / finding-count grep parsers | slither `--triage-mode` + committed `.slither.db.json` | The tool owns id computation (sha3_256 incl. source mappings), matching, and re-surface (`--show-ignored-findings`); hand-rolled matching rediscovers #1965's instability |
| Severity gate semantics | Exit-code arithmetic on slither output (the 0.11.5-era `--fail-none` workaround class) | The `fail_on` group's PEDANTIC default + triage (bare run) | Source-verified binary exit; counting findings from stdout re-implements what `bool(results_detectors)` already does |
| Unchecked-`.call{}` detection | Solidity-language semgrep patterns | Generic-mode patterns (D-08 shape, verified) | Native-Solidity `.call{...}(...)` / tuple-destructure patterns do not parse on 1.174.0 (re-confirmed this session) |
| Scan-surface definition | Manual file lists / `find | xargs` pipelines | `--no-git-ignore` + `--exclude` (or `.semgrepignore`) | Discovery semantics (submodule skip, gitignore interplay, bundled default ignore) are tool-owned and version-behavior-verified via local help text |

**Key insight:** every mechanism this phase needs already exists in the pinned tools; Phase 18 is wiring and disposition, not construction.

## Common Pitfalls

### Pitfall 1: `--no-git-ignore` floods the gate with generated/vendored content
**What goes wrong:** Adding only `--no-git-ignore` (as D-10 literally spells it) takes the scan from 81 files / 13 findings to 341 files / 168 findings — `lib/forge-std` (31 vendored `.sol`, 40 findings), `typechain-types/` (generated TS, 78 `typescript-any-usage`), plus `out/`, `broadcast/`, etc. The gate can never reach zero; worse, "fixing" generated typechain `any`s is meaningless (regenerates on every compile).
**Why it happens:** semgrep's help text (verified on 1.174.0): "`--no-git-ignore` causes semgrep to not call 'git' and not consult '.gitignore' … gitignored files and Git submodules will be scanned unless excluded by other means ('.semgrepignore', '--exclude', etc.)." The flag that reaches the submodule also reaches everything gitignored.
**How to avoid:** Ship the Pattern-3 exclusion list in `yarn semgrep:scan` in the same change as `--no-git-ignore`. Verified end-state: 119 files / 42 `.sol` (34 submodule + 8 mocks), with the fixed rule contributing 0.
**Warning signs:** semgrep output mentioning `lib/forge-std` or `typechain-types`; findings count in the hundreds.

### Pitfall 2: The 37-item disposition set blocks the semgrep gate (plan for it now)
**What goes wrong:** With the corrected surface, the first real scan finds — beyond the 13 typed away by D-06 — **31 `diamond-selector-clash`** (every listed function across 15 submodule facet contracts; the rule's `pattern-not: bytes4 public constant $SELECTOR = $VALUE;` matches no diamond-facet idiom, making it a structural FP generator that only "worked" because no real contracts were ever scanned), **4 `unsafe-math-operation`** (`GNUSBridge.sol:110`, `GNUSBridgeAttestor.sol:393`, `GNUSTreasury.sol:126`, `GNUSTreasury.sol:137` — `$A * $B / $C` in Solidity ≥0.8 checked arithmetic, likely FP class but contract-side), and **2 `hard-coded-secret`** (`.devcontainer/scripts/setup/VaultSecretManager.ts:34,91` — both inside commented-out code). None are fixable in-phase (submodule contract source / nested-submodule TS).
**Why it happens:** D-10's surface expansion is exactly what exposes them; D-04 anticipated the mechanism but not the count.
**How to avoid:** Plan the disposition checkpoint EARLY (the gate cannot go green without it): per D-04/D-10 the contract-side outcomes are owner-ruled rule exclusion (the `weak-encryption` 07-02 precedent — `--exclude-rule` in the script with recorded rationale) or routing event to an owning phase. The full finding-by-finding list is in this session's `/tmp/18-research/probeE-final-sim.json` (paths+lines above) — copy it into the plan/STATE as the disposition table.
**Warning signs:** executor discovers the gate red with ~35-37 findings and starts "fixing" contracts — forbidden.

### Pitfall 3: Triage-id drift after ANY edit near the 3 FP sites (or any slither bump)
**What goes wrong:** A green gate reds with 255 after an unrelated-looking change; the triaged findings re-surface.
**Why it happens:** the id is `sha3_256` over concatenated description pieces **including source mappings** (`output.py:424` + `_convert_to_id` — "Id keeps the source mapping of the node"); any line/column shift at the site, or detector-text changes between slither versions, changes the id, and the db entry stops matching (crytic/slither#1965 documented exactly this; closed, with the deterministic hash as the fix — but drift-by-edit remains by design).
**How to avoid:** This is D-03's "correct red": re-run `--triage-mode` and re-commit the db. Never widen suppression. Note for the plan: the db MUST be generated on 0.11.6 (a 0.11.5-era db would not necessarily transfer — descriptions/ids may differ across the version bump).
**Warning signs:** gate red after a PR that touched contracts near `GNUSWithdrawLimiterStorage.sol#114-138` or `GNUSBridge.sol#406-410/#506-516`.

### Pitfall 4: slither dependency float inside the CI pin
**What goes wrong:** `pip install slither-analyzer==0.11.6` does NOT pin `crytic-compile` (constraint `>=0.4.2,<0.5.0` — verified in 0.11.6 `pyproject.toml`); a future crytic-compile release inside that range can change parsing/behavior between CI runs (0.11.6's own release notes include "Update crytic-compile version").
**Why it happens:** range dependencies in slither's packaging; same exposure exists on the current 0.11.5 pin (not a new risk class).
**How to avoid:** If the probes show any instability, tighten to `pip install slither-analyzer==0.11.6 crytic-compile==<probed version>` — otherwise record the range as a known accepted float (consistent with today's gate). Owner's call; flag it in the plan as an optional hardening, not a new decision.
**Warning signs:** CI slither result flips with no repo change.

### Pitfall 5: The type-only import constraint in the linking harness
**What goes wrong:** A "clean" typing refactor adds `import { ... } from 'hardhat'` at the top of `GNUSLifecyclePolicyLinking.ts`; every hardhat process that loads the config crashes with `LIB_IMPORTED_FROM_THE_CONFIG` (the module's own header documents this; it is imported BY hardhat.config.ts during config load).
**How to avoid:** Only `import type` (erased at transpile-time) or `typeof import(...)` type positions; keep the `require('hardhat')` runtime path and its eslint-disable comments exactly as-is; the `npx tsc` surface (strict mode, `./scripts` included) plus a `yarn test`-config-load run is the proof. NOTE: the file currently has ZERO top-level imports — that must remain effectively true at runtime.
**Warning signs:** any new top-level value import in the file.

### Pitfall 6: `--exclude-rule` interacts with rule-ID rewriting
**What goes wrong:** When semgrep loads a config from a path, rule IDs get prefixed by the config's parent directory (observed: a `/tmp` copy produced `tmp.18-research.weak-encryption`, defeating `--exclude-rule weak-encryption`). From the repo root with `--config .semgrep.yml`, IDs stay bare (verified — the exclude works today).
**How to avoid:** Keep the config reference exactly `--config .semgrep.yml` (relative, from repo root) in the script; verify the exclude still holds after any script change by checking `weak-encryption` absence in output.
**Warning signs:** weak-encryption findings (99 on this tree — `md5|sha1|des|rc4` regex hits in keccak/sha256 usage) suddenly appearing.

## Code Examples

### The verified fixed rule (copy-ready for `.semgrep.yml` lines 10-16 replacement and the `.devcontainer/config/.semgrep.yml:11-17` mirror)
```yaml
# Source: verified end-to-end on this tree, semgrep 1.174.0, 2026-08-31
# (positive control: exactly 2 findings; shipped: 0 findings; 0 parse errors)
  - id: unsafe-external-call
    patterns:
      - pattern-either:
          - pattern: |
              (bool $SUCCESS, ) = $R.call{$K: $V}(...);
          - pattern: |
              (bool $SUCCESS, $DATA) = $R.call{$K: $V}(...);
      - pattern-not-inside: |
          (bool $SUCCESS, ) = $R.call{$K: $V}(...);
          require($SUCCESS, ...);
      - pattern-not-inside: |
          (bool $SUCCESS, $DATA) = $R.call{$K: $V}(...);
          require($SUCCESS, ...);
      - pattern-not-inside: |
          (bool $SUCCESS, ) = $R.call{$K: $V}(...);
          if (!$SUCCESS) {
              ...
          }
      - pattern-not-inside: |
          (bool $SUCCESS, $DATA) = $R.call{$K: $V}(...);
          if (!$SUCCESS) {
              ...
          }
    message: "Unsafe external call without proper error handling. Consider using a safe wrapper or checking return data."
    severity: WARNING
    languages: [generic]
    paths:
      include: ["**/*.sol"]
```
Block scalars (`pattern: |`) are load-bearing — plain scalars containing `$K: $V` fail YAML parsing.

### slither triage commands (config + marking)
```bash
# slither.config.json addition (verified: "triage_database" IS a recognized config key on 0.11.6 —
# it is in defaults_flag_in_config; unknown keys are logged + skipped, so spelling matters):
"triage_database": ".slither.db.json"

# One-time interactive marking (prompt appears per detector; answer "All" at both):
slither . --config-file slither.config.json --triage-mode --triage-database .slither.db.json

# Gate (bare — PEDANTIC default; green iff zero untriaged findings):
yarn slither:scan

# On-demand re-surface (advisory only — exits 255 under PEDANTIC):
yarn slither:scan --show-ignored-findings
```

### slither 0.11.6 exit-code core (source: github.com/crytic/slither tag 0.11.6, `slither/__main__.py`)
```python
# fail_on_group = group_detector.add_mutually_exclusive_group()   # --fail-pedantic/low/medium/high/none
# fail_on_group.set_defaults(fail_on=FailOnLevel.PEDANTIC)
fail_on = FailOnLevel(args.fail_on)
...
elif fail_on == FailOnLevel.PEDANTIC:
    fail_on_detection = bool(results_detectors)      # triaged findings already filtered out upstream
...
if output_error or fail_on_detection:
    sys.exit(-1)      # renders as 255
else:
    sys.exit(0)
```
```python
# slither/core/slither_core.py — valid_result(): the triage filter (order matters)
if self._show_ignored_findings:
    return True                       # re-surface short-circuit (advisory only)
if self.has_ignore_comment(r):
    return False
if r["id"] in self._previous_results_ids:
    return False                      # TRIAGE MATCH → hidden from results AND exit count
...
if r["description"] in [pr["description"] for pr in self._previous_results]:
    return False                      # legacy description fallback ("meant to be removed" upstream)
```

### The two positive-control sites (unchanged, both checked — the reason the rule ships green)
```solidity
// contracts/gnus-ai/libraries/TransferHelper.sol:52-53
(bool success,) = to.call{value:value}(new bytes(0));
require(success, 'STE');

// contracts/gnus-ai/GNUSContractAssets.sol:48-50
(bool success, ) = to.call{value: amount}(new bytes(0));
if (!success) {
    revert ErrorWithdrawingEther();
}
```
(Repo-wide `.call{` grep: these are the ONLY two sites in `contracts/`, `test/`, `scripts/` — verified this session.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| slither `--fail-none` workaround (findings print, exit 0, baseline diffed by eye) | Committed triage db + PEDANTIC default (bare run) | this phase (mechanism present in tool since ≤0.11.5) | Green becomes a property of the tool's own accounting, not a flag reading |
| semgrep advisory step with `continue-on-error` + unpinned `pip install semgrep` | Hard gate, `semgrep==1.174.0`, fixed rule, expanded surface | this phase | Unpinned CI install floats to 1.175.0 TODAY — the pin is load-bearing immediately |
| semgrep discovery skipping submodules | `--no-git-ignore` + compensating excludes | (semgrep behavior current as of 1.174.0 help text) | The real `.sol` surface (34 submodule contracts) enters scanner coverage for the first time |

**Deprecated/outdated:**
- slither's legacy description-based triage fallback: still present in `valid_result()` but explicitly commented "conserved for compatibility, but is meant to be removed" upstream — another reason db regeneration on drift is the only durable posture (D-03).
- `security-tool-updater.ts` (`scripts/devops/security-tool-updater.ts`): CONTEXT flagged "verify whether it references 0.11.5/1.174.0" — **verified: it does not** (no version literals for either tool). It does carry stale hardcoded `current` versions (`slither: '0.10.0'`, `semgrep: '1.57.0'`) and writes a `.tool-versions` file that does not exist in the repo. No Phase 18 edit required; leave untouched (minimal-change boundary) — flagged in Open Questions for the owner.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 3 FP findings keep identical detector+site identity on 0.11.6 (no FP-reduction fix touched `weak-prng`/`erc721-interface` — verified from release notes, but the run itself is D-02's probe) | Patterns/Probe sequence | Low — probe 2 catches it; worst case the triage marking simply marks what 0.11.6 actually reports |
| A2 | `msg-value-in-nonpayable` produces no findings on this codebase (not yet run — it fires on `msg.value` uses unreachable from payable entry points; this repo's payable flows are conventional) | Pitfalls/D-05 | Low — if it fires, the finding is dispositioned per D-04 (triage-with-evidence or routing event); probe 2 reveals it |
| A3 | `--exclude` flag list (Pattern 3) is the intended final surface definition — i.e., generated dirs stay out and `test/` staying unscanned (bundled default ignore) is acceptable | Pattern 3 | Medium — if the owner wants `test/` scanned, add `test/**` consciously (43 tracked `.sol` there today, 0 current findings from the 22 rules per probe evidence — the rules' `paths.exclude` already carve `test/**` for the diamond rules); surface definition is owner-visible in the script either way |
| A4 | CI Checkout (`submodules: recursive`) places `contracts/gnus-ai` and `.devcontainer` such that `--no-git-ignore` reaches them in CI the same as locally | Pattern 3 | Low — verified checkout step has `submodules: recursive`; the devcontainer secrets findings WILL appear in CI too (part of the 37-item set) |

**All other claims were verified** (live probes on this tree, official-source reads at exact tags, registry queries, local tool help text) — see Sources.

## Open Questions

1. **Disposition of the 37-item set (owner ruling required before the semgrep gate can go green)**
   - What we know: exact findings, paths, and lines (Pitfall 2 + `/tmp/18-research/probeE-final-sim.json`); the D-04/D-10 menu is owner-ruled rule exclusion vs routing event per finding class.
   - What's unclear: which classes the owner rules out vs routes — `diamond-selector-clash` (structural FP generator as-written) and `unsafe-math-operation` (checked-arithmetic 0.8 idiom) look like exclusion candidates; `hard-coded-secret` in commented devcontainer code is trivially FP but lives in a nested submodule.
   - Recommendation: put the disposition table in front of the owner as an early phase checkpoint (it gates the promotion step), with the per-class recommendation pre-drafted.

2. **Does the owner want `test/` in the semgrep surface?** (A3) — today it is excluded by semgrep's bundled default ignore (not by repo choice); 43 tracked `.sol` files there. Default plan: leave as-is (surface change is D-10's submodule goal only).

3. **Optional CI hardening: pin `crytic-compile` alongside slither** (Pitfall 4) — accepted float vs tightened pin is an owner call; not required by any locked decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| semgrep (brew) | SEC-10 probes + local gate parity | ✓ | 1.174.0 | — |
| slither (brew `slither-analyzer`) | SEC-09 probes + local gate | ✓ (0.11.6 bottled, upgrade available) | 0.11.5_6 installed | — |
| Python 3 | tool runtime | ✓ | 3.14.7 (brew); CI uses 3.12; slither 0.11.6 needs ≥3.10 ✓ | — |
| pip | version verification | ✓ | 26.2.1 | — |
| Foundry (`forge`) | slither compilation driver | ✓ | 1.7.1 | — |
| `solc` binary | — (not needed; forge manages solc) | ✗ (not on PATH) | — | forge-resolved solc (observed working in the live slither run) |
| Node/yarn | `yarn *:scan` scripts, tsc | ✓ | Node 24 / yarn 4.10.3 (per workflow + packageManager) | — |
| GitHub Actions runners | CI gate | ✓ | ubuntu-latest, checkout `submodules: recursive` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `solc` not on PATH — unused; forge supplies the compiler (verified by the live slither run).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Hardhat/mocha (`yarn test`) + Foundry via bridge node (`yarn forge:test`) — UNCHANGED by this phase (no test-suite changes per the phase boundary) |
| Config file | `.mocharc.yml` / `foundry.toml` (existing) |
| Quick run command | `yarn semgrep:scan` (~60-100s, 81→119 files) |
| Full suite command | `yarn test:all` (666/2/0 + 215/0/5 per STATE ledger — regression guard for the D-06 typing, since the module loads from hardhat.config.ts in every process) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-09 | 0.11.6 bare scan reports exactly the 3 known FPs and exits 255 pre-triage | probe (manual-ordered, output-captured) | `yarn slither:scan; echo $?` → 255, log shows 3 results | n/a (probe, /tmp log per 17-05 pattern) |
| SEC-09 | Fully-triaged bare scan exits 0, twice consecutively (stability) | probe | `yarn slither:scan; echo $?` → `0` × 2 runs, "0 result(s)" | n/a |
| SEC-09 | Triage db + config wiring (db honored via `slither.config.json` key) | probe | `grep triage_database slither.config.json` + run 2 above | n/a |
| SEC-09 | Re-surface shows the 3 FPs again | probe | `yarn slither:scan --show-ignored-findings` → 3 visible, exit 255 (advisory) | n/a |
| SEC-10 | Positive control: suppression-less rule → exactly 2 findings | probe | semgrep with positive-only config (this session's `/tmp/18-research/probe-rule-positive.yml` is the template) → count == 2 | n/a |
| SEC-10 | Shipped rule → 0 findings, 0 parse errors, full config | probe | `yarn semgrep:scan` → 0 findings (post-D-06 + dispositions) | n/a |
| SEC-10 | D-06 typing keeps tsc + config load green | regression | `npx tsc --noEmit` (strict; `./scripts` included) + `yarn test` full suite at ledger baseline | existing suite |
| SEC-10 | CI gate steps flip and pass | CI | `security-audit.yml` run green with `continue-on-error` dropped | workflow (edited in-phase) |

No new test files (phase boundary: no test-suite changes). Probes follow the Phase-17 evidence pattern: /tmp logs + per-run table + STATE ledger entry.

### Sampling Rate
- **Per task commit:** the probe specific to that task (`yarn semgrep:scan` or the slither probe pair) + `npx tsc --noEmit` for the TS task
- **Per wave merge:** `yarn test:all` (module-load regression) + both scanner gates at their current post-wave state
- **Phase gate:** both promoted gates green locally AND the full suite at the 666/2/0 + 215/0/5 ledger baseline, before `/gsd:verify-work`

### Wave 0 Gaps
None — existing infrastructure covers all phase validation; probes need no new fixtures (positive-control config is 12 lines, built once this session).

## Security Domain

`security_enforcement` is not set in `.planning/config.json` — treated as enabled. This phase IS itself the security-tooling phase; no application input surface is created or changed.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|----------------|---------|------------------|
| V2 Authentication | no | unchanged (no auth surface touched) |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | unchanged |
| V5 Input Validation | no new input surface | tool configs are committed JSON/YAML; scanner patterns are data, not code |
| V6 Cryptography | no | no crypto touched; note `weak-encryption` rule remains script-excluded by owner ruling (07-02) — not re-litigated here |
| V14 Config | yes (tangentially) | gate pins exact tool versions; triage db + baseline ledger committed; no secrets in any new artifact (the triage db contains only finding metadata — verify at commit time it carries no source beyond snippet references) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply-chain drift via unpinned CI tools | Tampering | Exact pins (slither 0.11.6, semgrep 1.174.0) — the unpinned `pip install semgrep` floats to 1.175.0 today; D-07 closes it |
| Silent gate disablement (rule that never runs) | Repudiation | D-09 positive control (exactly-2 expectation) + `--error` (parse errors exit 2); promoted gate reds on findings |
| Suppression creep (triage/excludes as placebos) | Tampering | D-03/D-05 posture: no detector excludes, no `nosemgrep`, re-triage on drift; every exclusion carries a recorded owner rationale (weak-encryption precedent) |
| Committed-artifact tampering (`.slither.db.json` edited to hide findings) | Tampering | Reviewer check: db entries must match live `--show-ignored-findings` output; db diffs in PRs get scrutiny the same way baseline tables do |

## Sources

### Primary (HIGH confidence)
- github.com/crytic/slither @ tag `0.11.6` — `slither/__main__.py` (fail_on group, PEDANTIC default, binary exit), `slither/core/slither_core.py` (`valid_result` triage filter, `load_previous_results`, `write_results_to_hide`), `slither/utils/output.py` (`sha3_256` id over description+source mappings), `slither/detectors/abstract_detector.py` (triage-mode interactive prompt), `slither/utils/command_line.py` (`defaults_flag_in_config` incl. `triage_database`; unknown-key skip), `slither/detectors/all_detectors.py` 0.11.5 vs 0.11.6 diff (exactly one added import), `slither/detectors/statements/msg_value_in_nonpayable.py` (HIGH/HIGH), `pyproject.toml` (requires-python ≥3.10; crytic-compile `>=0.4.2,<0.5.0`)
- GitHub release `crytic/slither 0.11.6` (published 2026-07-28) — full notes read; one new detector; FP-fix list; no weak-prng/erc721-interface changes
- crytic/slither wiki Usage#triage-mode (official docs) — interactive flow, `slither.db.json`, `triage_database` config key, `//slither-disable` alternatives
- crytic/slither issue #1965 (closed) — "[Bug]: Slither detects already triaged results … ID of the findings … varies between runs" (D-03 citation verified)
- Local semgrep 1.174.0 binary — `semgrep scan --help` (`--no-git-ignore` / `--use-git-ignore` semantics incl. the submodule sentence; `--error` = "Exit 1 if there are findings"); empirical probe runs A-E on this tree (all outputs retained in `/tmp/18-research/`)
- Local slither 0.11.5 — `--help` (triage flags), live baseline run (3 FPs, exit 255, 81 contracts/58 detectors)
- PyPI via `pip3 index versions` — slither-analyzer 0.11.6 latest; semgrep 1.175.0 latest / 1.174.0 present
- Homebrew — `slither-analyzer 0.11.5_6 → 0.11.6 (bottled)`; `semgrep stable 1.174.0`

### Secondary (MEDIUM confidence)
- Repo files read in full this session: `.github/workflows/security-audit.yml` (all line refs confirmed), `.semgrep.yml` (22 rules counted), `.devcontainer/config/.semgrep.yml` (diffed), `slither.config.json`, `scripts/utils/GNUSLifecyclePolicyLinking.ts` (all 13 `any` sites at exact CONTEXT line numbers), `scripts/devops/security-tool-updater.ts` (no 0.11.5/1.174.0 refs; stale `current` versions), `contracts/gnus-ai/libraries/TransferHelper.sol`, `contracts/gnus-ai/GNUSContractAssets.sol`, `.gitignore`, `package.json`, `tsconfig.json`
- STATE.md 07-03 disposition table + Phase-17 ledger (committed record — the baseline identities this phase replaces)

### Tertiary (LOW confidence)
- None — no claim in this research rests on an unverified single source.

## Metadata

**Confidence breakdown:**
- Standard stack (tool pins): HIGH — registry, official source at exact tag, release notes, and local binaries all cross-checked
- Architecture (gate mechanics): HIGH — exit-code chain read from 0.11.6 source line-by-line; triage filter verified upstream of the exit computation
- Pitfalls: HIGH — Pitfalls 1, 2, 5, 6 and the YAML gotcha were all hit/discovered empirically this session, not theorized; Pitfall 3 verified from source + the cited issue; Pitfall 4 verified from pyproject

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 (stable tooling; re-check `pip index versions` if planning slips — a 0.11.7 or 1.176.0 release would not invalidate the findings but would refresh the "latest" facts)
