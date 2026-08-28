---
phase: 09-per-child-gnus-treasury-reserve
reviewed: 2026-08-16T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - hardhat.config.ts
  - foundry.toml
  - package.json
  - scripts/setup/RPCDiamondDeployer.ts
  - scripts/setup/strategies/SafeProposerRPCDeploymentStrategy.ts
  - scripts/setup/strategies/EncodeOnlyRPCDeploymentStrategy.ts
  - scripts/setup/strategies/diamondCutEncoding.ts
  - scripts/deploy/rpc/deploy-rpc.ts
  - scripts/deploy/rpc/status-rpc.ts
  - scripts/deploy/rpc/upgrade-rpc.ts
  - scripts/deploy/rpc/verify-rpc.ts
  - scripts/schemas/deployedDiamondDataSchema.ts
  - scripts/devops/provenance-validator.ts
  - scripts/devops/security-health-checks.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 09: Code Review Report — @diamondslab → @geniusventures supply-chain cutover

**Reviewed:** 2026-08-16
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This review covers the npm-scope cutover from `@diamondslab/` to `@geniusventures/` across 14 files: Hardhat config, Foundry remappings, package.json dependency declarations, and all RPC deployment / Safe proposer / encode-only / devops scripts that import from the four vendored packages.

**The cutover itself is clean.** Every import specifier, every foundry remapping, and every package.json dependency declaration has been correctly rewritten to the `@geniusventures/` scope. A repo-wide grep finds zero remaining `@diamondslab/` references in any source `.ts`, `.sol`, `.toml`, `.json`, `.js`, `.yml` file outside `node_modules/`, `out/`, `artifacts/`, `cache/`, and historical `.planning/` documents. All four packages (`diamonds`, `hardhat-diamonds`, `diamonds-hardhat-foundry`, `diamonds-monitor`) are installed under `node_modules/@geniusventures/` at the versions package.json declares, and every named import (`Diamond`, `DiamondDeployer`, `RPCDeploymentStrategy`, `FileDeploymentRepository`, `DeploymentRepository`, `RegistryFacetCutAction`, `cutKey`, `getContractArtifact`, `FacetCuts`, `SupportedProvider`, `DiamondConfig`, `DiamondPathsConfig`) resolves to an export in the installed `@geniusventures/diamonds@1.3.2-gv.2` package. The `@geniusventures/hardhat-diamonds/dist/utils` subpath imported by twenty-plus test files is a declared export in that package's `exports` map and resolves to a real `dist/utils.js` / `dist/utils.d.ts` pair on disk. The Solidity imports `@geniusventures/diamonds-hardhat-foundry/contracts/{DiamondABILoader,DiamondForgeHelpers,DiamondFuzzBase}.sol` all resolve through the `@geniusventures/=node_modules/@geniusventures/` remapping and exist on disk.

No accidental functional changes beyond the scope string were detected in any of the 14 files.

The findings below are all pre-existing issues that the rewrite carried forward; none are introduced by the cutover, but they live in files that were just touched and are surfaced here per the adversarial-review stance.

## Warnings

### WR-01: Peer-dependency version mismatch on `@geniusventures/diamonds`

**File:** `package.json:98-101`
**Issue:** The four vendored packages have inconsistent version pins. The root declares `@geniusventures/diamonds: "1.3.2-gv.2"` (line 98), but the three sibling packages installed under `node_modules/@geniusventures/` declare a peer dependency on `1.3.2-gv.1`:

- `@geniusventures/diamonds-hardhat-foundry@2.4.0-gv.1` → `peerDependencies: { "@geniusventures/diamonds": "1.3.2-gv.1", "@geniusventures/hardhat-diamonds": "1.1.15-gv.1" }`
- `@geniusventures/diamonds-monitor@1.0.4-gv.1` → `peerDependencies: { "@geniusventures/diamonds": "1.3.2-gv.1" }`
- `@geniusventures/hardhat-diamonds@1.1.15-gv.1` → `peerDependencies: { "@geniusventures/diamonds": "1.3.2-gv.1" }`

Yarn 4 happens to resolve this (only `diamonds@1.3.2-gv.2` appears in `yarn.lock`, only one instance is installed under `node_modules/@geniusventures/diamonds/`), because the `-gv.N` prerelease tag does not form a standard semver range and Yarn's resolver falls back to a permissive match. This works today but is fragile:

1. `yarn install` will emit `YN0060`-style peer warnings on every fresh install.
2. Any tightening of the resolver (or a publish that re-emits the peers as `=` pins) breaks the install.
3. If a future `@geniusventures/diamonds@1.3.2-gv.3` is published, the gv.1 peer constraint will not match it cleanly.

**Fix:** Re-publish the three sibling packages with `peerDependencies: { "@geniusventures/diamonds": "1.3.2-gv.2" }` (or a real semver range such as `>=1.3.2-gv.1 <1.4.0`), bumping each to a `-gv.2` suffix, and update package.json to match. Alternative short-term mitigation: add a `resolutions` (or Yarn 4 `packageExtensions`) entry in package.json declaring the peer override so the constraint is explicit and auditable:

```json
"packageExtensions": {
  "@geniusventures/diamonds-hardhat-foundry@2.4.0-gv.1": {
    "peerDependencies": { "@geniusventures/diamonds": "1.3.2-gv.2" }
  },
  "@geniusventures/diamonds-monitor@1.0.4-gv.1": {
    "peerDependencies": { "@geniusventures/diamonds": "1.3.2-gv.2" }
  },
  "@geniusventures/hardhat-diamonds@1.1.15-gv.1": {
    "peerDependencies": { "@geniusventures/diamonds": "1.3.2-gv.2" }
  }
}
```

---

### WR-02: `checkDiamondIntegrity` builds a path that cannot exist

**File:** `scripts/devops/security-health-checks.ts:469-474`
**Issue:** The diamond-config probe constructs this path:

```ts
const diamondConfigPath = path.join(
    process.cwd(),
    '@geniusventures/diamonds',
    'GNUSDAODiamond',
    'gnusdaodiamond.config.json',
);
```

That path does not exist anywhere in this repo, and never has:

- `node_modules/@geniusventures/diamonds/` contains the compiled `dist/` tree for the library, not a `GNUSDAODiamond/` subdirectory. Even before the cutover, `node_modules/@diamondslab/diamonds/GNUSDAODiamond/` did not exist.
- The actual diamond configs in this repo live at `diamonds/GeniusDiamond/geniusdiamond.config.json` (and the variant files alongside it), not under any `@geniusventures/`-prefixed directory.
- The diamond in this repo is `GeniusDiamond`, not `GNUSDAODiamond` (see `hardhat.config.ts:337-348`).

Consequence: `checkDiamondIntegrity` always takes the `!fs.existsSync(diamondConfigPath)` branch and reports the check as `failed` with a `critical` recommendation, even on a perfectly healthy install. Any CI hook that consumes this check's exit/failure signal is permanently red.

The cutover rewrote `@diamondslab/diamonds` → `@geniusventures/diamonds` inside this already-broken literal, propagating the bug. This file also still self-identifies as "GNUS-DAO Periodic Security Health Checks" (line 4), confirming it was copied from a different project and never adapted to gnus-ai.

**Fix:** Replace the probe with a path derived from the real deployment layout, e.g.:

```ts
const diamondName = process.env.DIAMOND_NAME || 'GeniusDiamond';
const diamondConfigPath = path.join(
    process.cwd(),
    'diamonds',
    diamondName,
    `${diamondName.toLowerCase()}.config.json`,
);
```

And update the file's docstring on line 4 from "GNUS-DAO" to "gnus-ai".

---

### WR-03: `provenance-validator.ts` hardcodes the wrong project name and a stale critical-package list

**File:** `scripts/devops/provenance-validator.ts:4,103,478,80-84`
**Issue:** Three related defects in the same file:

1. Line 478 hardcodes `project: 'GNUS-DAO'` in the generated report. This repo is `gnus-ai` (`package.json` name: `@gnus-ai/gnus-ai`). Every report this script writes is mislabeled.
2. Lines 4 and 103 carry the same "GNUS-DAO" project identification in the docstring and the startup log line.
3. Lines 73-84 declare the `criticalPackages` array. It correctly includes the two rewritten packages `@geniusventures/diamonds` and `@geniusventures/hardhat-diamonds`, but **omits the other two packages the cutover introduced**: `@geniusventures/diamonds-hardhat-foundry` and `@geniusventures/diamonds-monitor`. Both are declared in `package.json:99-100`, both are installed, and `diamonds-hardhat-foundry` is the source of every Foundry fuzz base contract used in `test/foundry/` — exactly the kind of supply-chain asset a provenance validator exists to guard. Because `validateCriticalDependencies` only emits a `medium` warning for missing packages, this gap is silent: the script happily reports success while never checking the two new packages.

**Fix:** Update the project string and complete the package list:

```ts
this.criticalPackages = [
    'hardhat',
    '@nomicfoundation/hardhat-toolbox',
    '@nomicfoundation/hardhat-ethers',
    'ethers',
    'typescript',
    '@types/node',
    '@geniusventures/diamonds',
    '@geniusventures/hardhat-diamonds',
    '@geniusventures/diamonds-hardhat-foundry',
    '@geniusventures/diamonds-monitor',
    '@openzeppelin/contracts',
    '@openzeppelin/contracts-upgradeable',
];
```

And replace `'GNUS-DAO'` with `'gnus-ai'` on lines 4, 103, and 478.

## Info

### IN-01: Hardcoded `kFacetCutActionRemove = 2` instead of importing `FacetCutAction.Remove`

**File:** `scripts/setup/strategies/SafeProposerRPCDeploymentStrategy.ts:106`, `scripts/setup/strategies/EncodeOnlyRPCDeploymentStrategy.ts:88`
**Issue:** Both strategies override `validateNoOrphanedSelectors` and filter out Remove cuts with a hand-rolled literal:

```ts
const kFacetCutActionRemove = 2; // IDiamondCut.FacetCutAction.Remove
const nonRemoveCuts = facetCuts.filter((fc) => fc.action !== kFacetCutActionRemove);
```

`@geniusventures/diamonds` exports the enum (`exports.RegistryFacetCutAction = exports.FacetCutAction = void 0;` in the installed package's compiled output, declared in `dist/types/deployments.d.ts`). The literal is brittle to any upstream reordering of `IDiamondCut.FacetCutAction` — the comment even acknowledges the magic number by naming the Solidity enum. Two independent copies of the same magic number in two sibling files doubles the maintenance surface.

**Fix:** Replace the literal in both files with the imported enum:

```ts
import { FacetCutAction } from '@geniusventures/diamonds';
// ...
const nonRemoveCuts = facetCuts.filter((fc) => fc.action !== FacetCutAction.Remove);
```

---

### IN-02: `@geniusventures/diamonds-monitor` is declared but never imported

**File:** `package.json:100`
**Issue:** `@geniusventures/diamonds-monitor: "1.0.4-gv.1"` is listed as a devDependency, but a repo-wide grep finds zero import statements (TypeScript, JavaScript, or Solidity) that reference it. The only references are in `yarn.lock`, `.github/copilot-instructions.md`, and `.planning/` documents. It is dead weight in the dependency tree and adds surface area to every `yarn audit` / `snyk` / `socket` scan for no current benefit.

**Fix:** Either remove the dependency, or document in `package.json` (or a code comment near the dependency block) what upcoming feature requires it so the next supply-chain audit does not flag it as an orphan.

---

_Reviewed: 2026-08-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution (2026-08-17)

**Cutover verdict: clean.** All 14 files correctly scoped to `@geniusventures/`; no missed or over-broad rewrites; all imports resolve.

- **WR-01 — FIXED.** The three sibling packages were re-published with `peerDependencies["@geniusventures/diamonds"]` loosened from the exact prerelease `1.3.2-gv.1` to the range `>=1.3.2-gv.1 <2.0.0`, each bumped to a `-gv.2` suffix (`diamonds-hardhat-foundry@2.4.0-gv.2`, `diamonds-monitor@1.0.4-gv.2`, `hardhat-diamonds@1.1.15-gv.2`). `diamonds` itself was independently bumped to `1.3.2-gv.2` for the proactive HH701 FQN-resolution hardening (see below). gnus-ai `package.json` updated to the gv.2 set; `yarn explain peer-requirements` now reports all `@geniusventures/*` peer requirements satisfied (✓). No `packageExtensions` override needed.
- **WR-02, WR-03, IN-01, IN-02 — PRE-EXISTING / OUT OF SCOPE.** These four are carried-forward defects the review surfaced in touched files, not regressions introduced by the cutover:
  - WR-02 (`security-health-checks.ts` nonexistent `GNUSDAODiamond` config path) and WR-03 (`provenance-validator.ts` hardcoded `GNUS-DAO` + incomplete `criticalPackages`) both stem from these devops scripts having been copied from a different project (GNUS-DAO) and never adapted to gnus-ai.
  - IN-01 (magic `kFacetCutActionRemove = 2`) and IN-02 (unused `diamonds-monitor` dep) are minor tech debt.
  - Per the minimal-change rule these were **not** folded into the supply-chain commit. Recommend a dedicated devops-hygiene phase to correct the GNUS-DAO→gnus-ai mislabeling, fix the dead diamond-integrity check, complete the provenance critical-package list, and either wire or drop `diamonds-monitor`.

### HH701 hardening (post-review)

The originally-published `1.3.2-gv.1` fix in `getDiamondContractName` was **reactive** (it only engaged when `artifacts.readArtifact` threw HH701). Full-suite forge runs exposed a timing-dependent path where the bare `GeniusDiamond` name was returned and `ethers.getContractFactory(bare)` later threw HH701 only when the synthetic `diamond-abi/GeniusDiamond.sol` stub happened to be registered at that instant. The resolver was rewritten to **proactively** resolve to the single compilation-backed fully qualified name (`contracts/gnus-ai/GeniusDiamond.sol:GeniusDiamond`) whenever it is unambiguous, making the returned name immune to the stub appearing later. Published as `@geniusventures/diamonds@1.3.2-gv.2`. Verified: two consecutive full `diamonds-forge:test` runs with zero HH701, plus `npx hardhat test` 458 passing / 0 failing.
