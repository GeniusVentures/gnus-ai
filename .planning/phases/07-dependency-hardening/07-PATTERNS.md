# Phase 7: Dependency Hardening - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 8 (4 modified manifests/configs, 1 new CI workflow, 4 planning docs — one of which, yarn.lock, is tool-generated)
**Analogs found:** 8 / 8 (7 in-repo or in-git-history; the CI workflow's analogs live in the vendored `_vendor-diamondslab/*` repos — no workflow exists in gnus-ai or the outer TokenContracts repo)

> All paths are relative to the **gnus-ai submodule** (`/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai`) unless prefixed `_vendor-diamondslab/` (sibling checkouts at `/Users/Shared/SSDevelopment/Development/GeniusVentures/_vendor-diamondslab/`). Planning artifacts stay in `gnus-ai/.planning/` — never the outer repo's `.planning/` (SUBREPOS.md).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config (manifest) | file-I/O (descriptor → build resolution) | itself: lines 98–101 `@geniusventures/*` exact pins + `.yarnrc.yml` `defaultSemverRangePrefix: ""` | exact |
| `yarn.lock` | config (generated lockfile) | batch (tool-generated; never hand-edited) | itself: lines 1458, 4883–4887 (the exact entry being re-keyed) | exact |
| `.devcontainer/config/package.json` | config (manifest, stale parallel copy) | file-I/O | itself: line 111 + lines 112/125/127 (in-repo git-URL pin forms `#develop` / `#main`) | exact |
| `.github/workflows/security-audit.yml` (NEW) | config (CI workflow) | event-driven (push/PR trigger → batch steps) | `_vendor-diamondslab/hardhat-diamonds/.github/workflows/ci.yml` (role+flow match); `_vendor-diamondslab/diamonds/.github/workflows/publish.yml` (convention source) | role-match (no in-repo analog exists) |
| `.planning/REQUIREMENTS.md` | docs (planning) | transform (evidence → checkbox state) | git commit `3f7261e` — Phase 14 tick pattern | exact |
| `.planning/ROADMAP.md` | docs (planning) | transform | Phase Summary rows (lines 17–19, 27–29, 36–37) + Phase 6 detail (lines 152–159) | exact |
| `.planning/PROJECT.md` | docs (planning) | transform (Active → Validated migration) | git commit `263944a` — Phase 15 evolve pattern | exact |
| `.planning/STATE.md` | docs (planning state log) | event-driven (append per completed plan) | "Phase 15 Decisions Logged" sections (lines 48–74) + Phase Status table row 38 | exact |

## Pattern Assignments

### `package.json` (config/manifest, file-I/O)

**Analog:** the file itself + `.yarnrc.yml`

**The exact-pin policy this file already follows** — `.yarnrc.yml` (all 5 lines):

```yaml
defaultSemverRangePrefix: ""

checksumBehavior: throw

globalFolder: /tmp/yarn-global

nodeLinker: node-modules

yarnPath: .yarn/releases/yarn-4.10.3.cjs
```

`defaultSemverRangePrefix: ""` means every registry dep is an exact pin (no `^`); `checksumBehavior: throw` makes any content drift a hard install failure. The pin edit must land inside this policy — do not introduce a range.

**Existing pinned-git/exact-version formatting** — `package.json` lines 98–101 (devDependencies, alphabetized):

```json
    "@geniusventures/diamonds": "1.3.3-gv",
    "@geniusventures/diamonds-hardhat-foundry": "2.4.0-gv.2",
    "@geniusventures/diamonds-monitor": "1.0.4-gv.2",
    "@geniusventures/hardhat-diamonds": "1.1.15-gv.2",
```

**The DEP-01 edit** — `package.json` line 135:

```json
    "contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git",
```

becomes (D-03, Yarn 4 native git syntax — `#commit=<sha>`, keyword explicit, not bare `#<sha>`):

```json
    "contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git#commit=bf67b736ad5fa3366551f599e204784856fb3069",
```

**Advisory-fix surface (same file, same edit conventions):**
- Line 137: `"eslint": "9.39.2"` — the eslint deprecation advisory named by `yarn npm audit --severity moderate` (exit 1).
- Line 149: `"hardhat-multichain": "1.0.6"` — rename target `@diamondslab/hardhat-multichain`. A rename re-keys the alphabetized devDependencies block (new key sorts under `@d`, old line 149 is removed); resolution follows the exact-pin form above. If renamed, check scripts referencing the plugin (`test-multichain` → `npx hardhat test-multichain`, package.json line 8 — plugin is loaded by hardhat, not by package name in scripts, so likely no script edit needed; verify at execution).

> **Scope tension to surface in the plan:** 07-RESEARCH.md (Open Question 3, Assumption A6, Anti-Patterns) recommends **waiver-with-note** for both deprecation advisories this phase and lists "chasing the deprecation advisories in-phase" as an anti-pattern; the phase-owner ruling includes the advisory fixes in the expected surface. The plan should present the fix-vs-waive decision explicitly (or sequence fixes as a discrete task the user can drop) rather than burying it.

---

### `yarn.lock` (config/lockfile, batch — tool-generated)

**Analog:** the file's own contracts-starter entry — the pin's zero-drift proof target

**NEVER hand-edit.** The only correct mutation path is: edit `package.json` descriptor → `yarn install` → Yarn re-keys the descriptor lines. `checksumBehavior: throw` will catch any manual surgery loudly later.

**Current entry** — `yarn.lock` lines 4883–4887:

```yaml
"contracts-starter@https://github.com/mudgen/diamond-2-hardhat.git":
  version: 1.0.0
  resolution: "contracts-starter@https://github.com/mudgen/diamond-2-hardhat.git#commit=bf67b736ad5fa3366551f599e204784856fb3069"
  checksum: 10c0/bb02edc42733588af6ad2344d2f9d4da62892d2b95edd9674c2bf6718854ab97fc39553ab84181897b8b5474130414f4db72da6ee01b1366c0d3b4685ecc4f9e
  languageName: node
  linkType: hard
```

**Workspace deps listing** — `yarn.lock` line 1458:

```yaml
    contracts-starter: "https://github.com/mudgen/diamond-2-hardhat.git"
```

**Expected diff (exactly 2 lines, per RESEARCH Pattern 1 / Pitfall 1):** lines 1458 and 4883 each gain `#commit=bf67b736…`. The `resolution:` and `checksum:` lines must remain **byte-identical** — if the checksum changes, STOP (resolved content drifted; contradicts D-02). Diff lines touching `version:`, `languageName:`, or `linkType:` are drift warning signs.

**Verification pattern (from RESEARCH, verified green pre-pin):**

```bash
yarn install                          # re-keys the lockfile
yarn install --immutable && echo OK   # determinism gate — must exit 0
git diff yarn.lock                    # assert: exactly 2 descriptor lines
grep -c '#commit=bf67b736' package.json yarn.lock   # expect: 1 and 2
```

If the advisory fixes (eslint / hardhat-multichain rename) land, their lockfile diffs are larger (new/removed descriptors + entries) — verify them as their own diff hunks, separate from the pin's 2-line hunk.

---

### `.devcontainer/config/package.json` (config/manifest, file-I/O — stale parallel copy)

**Analog:** the file itself — it already carries three git-URL pin forms

**The second floating copy** — line 111:

```json
    "contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git",
```

**In-file git-URL reference forms already used** (lines 112, 125, 127):

```json
    "diamonds": "https://github.com/GeniusVentures/diamonds.git#develop",
    ...
    "hardhat-diamonds": "https://github.com/GeniusVentures/hardhat-diamonds.git#develop",
    "hardhat-multichain": "https://github.com/GeniusVentures/hardhat-multichain#main",
```

Note the contrast: this manifest uses `#<branch>` refs (non-deterministic) and `^` ranges (lines 85–142), unlike the root manifest's exact pins. The minimal consistency move (RESEARCH A7 / Pitfall 8) is the same one-line `#commit=` pin at line 111. If the `hardhat-multichain` → `@diamondslab/hardhat-multichain` rename lands, this file's line 127 holds a *different form* of the same dep (a GeniusVentures git fork URL, not the npm package) — flag it in the plan so the rename's blast radius is decided deliberately. This file is NOT the CI/local-test build path; there is no lockfile alongside it.

---

### `.github/workflows/security-audit.yml` (NEW — config/CI workflow, event-driven)

**No analog exists in gnus-ai (`.github/` contains only `copilot-instructions.md`) or in the outer TokenContracts repo (no `.github/` at all).** The analogs are the workflows authored for the vendored `@geniusventures/*` packages during the vendoring effort, found on disk at `/Users/Shared/SSDevelopment/Development/GeniusVentures/_vendor-diamondslab/`:

- **Primary (role+flow match — CI on push/PR running node/yarn steps):** `_vendor-diamondslab/hardhat-diamonds/.github/workflows/ci.yml` (48 lines)
- **Conventions source (newest generation, Node 24 + OIDC):** `_vendor-diamondslab/diamonds/.github/workflows/publish.yml` (103 lines)
- Legacy contrast (what the newest generation moved away from): `_vendor-diamondslab/hardhat-diamonds/.github/workflows/publish.yml` (86 lines — NPM_TOKEN + `registry-url` + `--ignore-scripts`)

**Primary analog** — `_vendor-diamondslab/hardhat-diamonds/.github/workflows/ci.yml` (lines 1–48, the whole file):

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, 'release/**']

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  test:
    name: test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [18, 20, 22]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Enable Corepack (Yarn 4)
        run: corepack enable

      # NOTE: this package is developed inside the monorepo workspace and does not commit
      # its own yarn.lock, so a plain install is used here. For fully reproducible CI,
      # commit a standalone yarn.lock and switch to `yarn install --immutable` + `cache: yarn`.
      - name: Install dependencies
        run: yarn install

      - name: Build
        run: yarn build

      - name: Lint
        run: yarn lint

      - name: Test
        run: yarn test
```

The install-step NOTE is the exact guidance Phase 7 operationalizes: gnus-ai *does* commit `yarn.lock`, so the audit workflow should use `yarn install --immutable` + `cache: 'yarn'` on the setup-node step — that IS the DEP-01 determinism gate in CI.

**Conventions source** — `_vendor-diamondslab/diamonds/.github/workflows/publish.yml` (lines 1–39 excerpt — newest runner/node/corepack conventions):

```yaml
permissions:
  contents: read
  id-token: write # required for npm provenance attestation

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: ... # Trusted publishing: no registry-url ...
      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Update npm for OIDC trusted publishing
        run: npm install -g npm@^11.5.1

      # package.json pins yarn@4.10.3 via packageManager; ... need corepack to resolve it.
      - name: Enable corepack
        run: corepack enable
```

For gnus-ai the workflow: `runs-on: ubuntu-latest`, `permissions: contents: read` (no `id-token: write` — nothing publishes), `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: '24'` (matches local toolchain v24.13.0) + `cache: 'yarn'`, `corepack enable` (packageManager pins yarn@4.10.3, line 169 of package.json), then `yarn install --immutable`. Steps invoke the repo's own scripts (`yarn audit`, `yarn semgrep:scan`, `yarn slither:scan`, `yarn osv:scan`) rather than restating tool invocations — with the exit-code handling decisions from RESEARCH Pitfalls 3/5 made explicitly (`--fail-high` flags / baseline disposition — never silent `|| true` without a committed baseline). env4/semgrep/snyk/socket need secrets (`SNYK_TOKEN`, `SOCKET_CLI_API_TOKEN`) — gate those steps on secret presence or omit per user decision.

**Workflow skeleton** — use RESEARCH.md §Code Examples "CI workflow skeleton" as the starting draft; splice in the conventions above (corepack, node 24, `cache: 'yarn'`, concurrency group, `permissions: contents: read`).

---

### `.planning/REQUIREMENTS.md` (docs/planning, transform)

**Analog:** git commit `3f7261e` "docs(14): tick LIC-02/LIC-07 complete (verifier follow-up)" — the exact checkbox + traceability flip shape, most recent example (2026-08-25)

**Checkbox flip** (`- [ ]` → `- [x]`, description text unchanged):

```diff
-- [ ] **LIC-02**: NFT struct network-scope fields — append `networkScope` ...
+- [x] **LIC-02**: NFT struct network-scope fields — append `networkScope` ...
```

**Traceability row flip** (Status column only):

```diff
-| LIC-02      | Phase 14   | Pending  |
+| LIC-02      | Phase 14   | Complete |
```

Both edits land in the SAME commit for the same requirement (the commit above flipped 2 requirements = 4 changed lines: 2 checkboxes + 2 table rows). Phase 7's version flips the 13 remediation-arc boxes (DEBT-01/04/05/06, SEC-01/02/03/04/08, PERF-01/02, QUAL-01, DEP-01) at lines 10–45 plus their Traceability rows at lines 121–141 — each flip citing the phase/plan/commit evidence per RESEARCH Pattern 3. **Boundary (D-06/Pitfall 7):** SWP-02/03/06/07/09 (lines 50–57), PROXY-01/02/03 (lines 63–65), and BRIDGE-17 (line 102, stays `[ ]` by design) are NOT flipped. Also update the `_Last updated: ..._` footer (line 186) with the reconciliation note, matching the existing footer convention.

---

### `.planning/ROADMAP.md` (docs/planning, transform)

**Analog 1 — Phase Summary row format for a completed phase** (lines 17–19, 27–29, 36–37):

```markdown
| 4     | Access Control & Observability | 1/1 | Complete   | 2026-07-21 |
| 5     | Circuit Breaker & Performance  | 1/1 | Complete   | 2026-07-21 |
| 6     | Test Coverage                  | 2/2 | Complete   | 2026-07-24 |
```

Phase 7's row is line 20 (`| 7 | Dependency Hardening | Pin contracts-starter, final verification | DEP-01 | 2 |`) — when the phase completes it takes the `X/X | Complete | <date>` shape.

**Analog 2 — Phase detail section with plans list** (Phase 6, lines 152–159):

```markdown
**Requirements:** TEST-01, TEST-02, TEST-03

**Plans:** 2/2 plans complete

Plans:

- [x] 06-01-PLAN.md — Delete ExampleFuzz.t.sol stub (TEST-01) and complete NFTFactory 2nd-gen assertions (TEST-02)
- [x] 06-02-PLAN.md — Add getBannedTransferor view to GNUSControl facet + getter tests (TEST-03)
```

**The D-06 rewrite target** — Phase 7 section, lines 163–173:

```markdown
### Phase 7: Dependency Hardening

**Goal:** Pin the `contracts-starter` GitHub dependency to a specific commit hash for deterministic builds. Run final audit and verification pass.

**Success Criteria:**

1. `package.json` `contracts-starter` dependency includes a concrete commit hash (e.g., `#<sha>`). Yarn install produces a consistent lockfile entry.
2. Full test suite passes (`yarn test` and `yarn forge:test`). All 22 requirements are verified complete.

**Requirements:** DEP-01
```

Criterion 2's "All 22 requirements" is the stale figure — rewrite to reference the remediation-arc set (DEBT-*/SEC-*/PERF-*/TEST-*/QUAL-*/DEP-01, 21 items). Per RESEARCH OQ4: `gsd-sdk query roadmap.get-phase "7"` parses no dependency fields, so D-01's blocked-by marker is a plain-text sequencing note ("executed last per D-01; Phases 9–15 complete 2026-08-27"), not a functional marker. If success criteria grow to cover the audit gate/CI workflow, number them in place; also bump the header `**Updated:**` field (line 4).

---

### `.planning/PROJECT.md` (docs/planning, transform — Active → Validated)

**Analog:** git commit `263944a` "docs(phase-15): evolve PROJECT.md after phase completion" (2026-08-27) — the entire diff was 3 insertions / 1 deletion:

```diff
+- ✓ Secure BridgeIn V2 — rolling API-attestor root rotated as a side-effect of `bridgeIn`, canonical
+  `BridgeMessage` identity, ... (BRIDGE-10..16, 18, 19) — Validated in Phase 15: Secure BridgeIn
+  (Phase 10 Amendment) — `contracts/gnus-ai/GNUSBridgeAttestor.sol`, `test/fixtures/bridge-attestor-vectors.json`, `docs/Secure-BridgeIn-Exporter-ABI.md`
+- [ ] **BRIDGE-17**: SuperGenius production-activation gate — #363 ... OPEN. Gate record: `docs/Secure-BridgeIn-Exporter-ABI.md` §5
-_Last updated: 2026-08-19 after Phase 10 completion_
+_Last updated: 2026-08-27 after Phase 15 completion_
```

The migration shape: (1) one `✓` summary bullet appended to **Validated** (lines 15–31) naming the requirement IDs, the validating phase, and the artifact paths; (2) items that stay open remain as `[ ]` bullets in **Active** (lines 33–56); (3) footer `_Last updated: ..._` (line 126) bumped. Phase 7's version: add one `✓` bullet for the closed remediation arc (DEP-01 + the audit gate), purge the completed Active bullets (lines 35–55 — everything except DEP-01 while in flight, and BRIDGE-17 at line 56 which **stays Pending by design**), bump the footer. Also consider updating the Key Decisions table row "Exact version pinning (no ranges)" (line 102, already `✓ Implemented`) only if the advisory fixes add a decision row.

---

### `.planning/STATE.md` (docs/planning state log, event-driven append)

**Analog:** the Phase 15 record shape — Phase Status table row + per-plan decisions sections

**Phase Status row format** (line 38 is Phase 7's current row):

```markdown
| 7     | Dependency Hardening              | ○      | 0/0   | 0%       |
```

becomes `✓ | N/N | 100%` when the phase closes (cf. lines 32–46). The front-matter `progress:` block (lines 8–13) and `stopped_at`/`last_updated` are GSD-managed — they update via the tooling, not by hand.

**Per-plan decisions log format** (lines 48–74):

```markdown
### Phase 15 Decisions Logged (15-04)

- 15-04: Legacy-selector removal is proven through the diamond LOUPE, not the typechain — ...
- 15-04: [Rule 3] Both Foundry invariant setUps add setChainID(block.chainid) — ...
```

One `### Phase 7 Decisions Logged (07-0X)` section appended per completed plan, bullets prefixed `07-0X:`. This is where the audit-gate **disposition record** lands (RESEARCH Pattern 2): the per-sub-command results table (2 deprecation advisories waived/noted-or-fixed, 3 slither FPs, test-suite tolerances with exact counts) belongs in the final plan's decisions section. Next Actions (lines 86–89) and Current focus (line 26) are updated at phase close.

## Shared Patterns

### Exact-pin dependency discipline
**Source:** `.yarnrc.yml` (5 lines, quoted in full above) + `package.json` lines 98–101
**Apply to:** all three manifest edits (root `package.json`, `.devcontainer/config/package.json`)
Every version is exact (`defaultSemverRangePrefix: ""`); git deps use explicit `#commit=<sha>` (canonical Yarn 4 form; `#develop`/`#main` branch refs exist only in the stale devcontainer copy); `checksumBehavior: throw` backstops content drift. Never introduce a range or bare `#<sha>`.

### Lockfiles are generated, not authored
**Source:** `yarn.lock` entry mechanics (lines 1458, 4883–4887, quoted above)
**Apply to:** the pin task and any advisory-fix task
Descriptor edit → `yarn install` → verify with `--immutable` + `git diff`. Hand-editing is the documented anti-pattern; a changing `checksum:` line is a stop-the-line drift signal.

### CI workflow conventions (from the vendored @geniusventures workflows)
**Source:** `_vendor-diamondslab/hardhat-diamonds/.github/workflows/ci.yml` + `_vendor-diamondslab/diamonds/.github/workflows/publish.yml`
**Apply to:** the new `security-audit.yml`
`runs-on: ubuntu-latest`; `permissions: contents: read` (least privilege, no id-token needed — nothing publishes); `actions/checkout@v4`; `actions/setup-node@v4` with `node-version: '24'` and `cache: 'yarn'`; `corepack enable` before install (packageManager field resolves Yarn 4); a `concurrency` group with `cancel-in-progress: true`; named steps invoking repo scripts (`yarn <script>`) instead of restating tool commands; exit-code handling decided explicitly (never bare `|| true` without a committed baseline). Avoid the legacy publish pattern (`registry-url` + token env + `--ignore-scripts`) — the newest workflow documents why.

### Evidence-cited documentation reconciliation
**Source:** commits `3f7261e` (REQUIREMENTS tick) and `263944a` (PROJECT evolve)
**Apply to:** all four planning-doc edits
Checkbox flip + traceability-row flip in the same commit; PROJECT migration is one `✓` Validated bullet + footer bump; BRIDGE-17 never flips; each flip cites its phase/plan/commit evidence (RESEARCH Pattern 3 — "marking checkboxes from memory" is the anti-pattern this replaces). Commit messages follow the repo's `docs(...)` conventional-commit prefix.

### Audit disposition record
**Source:** 07-RESEARCH.md Pattern 2 (the 5 pre-known dispositions) + STATE.md decisions-log format
**Apply to:** the audit task's STATE.md entry and any CI gate baseline
Every non-green sub-command gets a written disposition row (result, class, evidence) — never a silent pass. This is also the committed baseline a CI `|| true`-style tolerance would diff against.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every file has an analog: manifests have in-file pin forms and `.yarnrc.yml` policy; the CI workflow has the vendored `_vendor-diamondslab` workflows (no in-repo workflow exists — gnus-ai `.github/` holds only `copilot-instructions.md`, and the outer repo has no `.github/`); planning docs have commits `3f7261e` / `263944a` and current-file formats. The workflow is the only "closest analog off-repo" case — the planner should treat RESEARCH.md's CI skeleton as the draft and the vendored workflows as the convention source. |

## Metadata

**Analog search scope:** gnus-ai repo root (package.json, .devcontainer/config/package.json, .yarnrc.yml, yarn.lock entries, .planning/{REQUIREMENTS,ROADMAP,PROJECT,STATE}.md, .github/); outer TokenContracts (.planning/SUBREPOS.md, .github absence verified); `_vendor-diamondslab/{diamonds,hardhat-diamonds,diamonds-hardhat-foundry,diamonds-monitor}/.github/workflows/` (4 workflow files read: publish.yml x3 + ci.yml x1); git history (`git log`/`git show` on the three planning docs; reconciliation commits `3f7261e`, `263944a` extracted in full).
**Files scanned:** ~22
**Pattern extraction date:** 2026-08-27
