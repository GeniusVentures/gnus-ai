# Phase 18: Scanner Triage Upgrades - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the two version-specific scanner workarounds with real triage: slither upgraded to a triage-capable line with the severity gate expressed as a **committed triage database** (SEC-09), and semgrep's broken `unsafe-external-call` rule fixed with the CI step promoted from `continue-on-error` advisory to a **zero-findings hard gate** on a surface that now includes the `contracts/gnus-ai` submodule (SEC-10). Tool versions, configs, CI workflow, and TypeScript scripts only — **no production contract changes, no test-suite changes, no new dependencies beyond pinned tool versions**.

</domain>

<decisions>
## Implementation Decisions

### SEC-09 — slither triage mechanism
- **D-01:** Committed triage database. Pin slither 0.11.6 (latest, 2026-07-28) in CI (`pip install slither-analyzer==0.11.6`) and locally (brew bump from 0.11.5_6). One local `--triage-mode` run marks the 3 Phase-9 FPs (weak-prng @ `GNUSWithdrawLimiterStorage.calculateCurrentBin`; erc721-interface @ `GNUSBridge.approve` + `GNUSBridge.transferFrom`); commit `.slither.db.json`; add `"triage_database": ".slither.db.json"` to `slither.config.json`; drop `--fail-none` from `yarn slither:scan` so the gate runs bare — **green = zero untriaged findings**, the only reading that satisfies the owner's "gate exits 0 without waivers" ruling (07-03's `--fail-none` spelling is a flag saying don't-count, not a finding state).
- **D-02:** Probe-then-flip on exit codes. 07-03's empirical 0.11.5 findings ("`--fail-high` still exits 255", "`--fail-high --fail-none` is a mutual-exclusion error") **conflict with current slither source on both lines** (exclusive `fail_on` group, pedantic default, all-findings-triaged exits 0 bare). The executor MUST re-prove exit-code mechanics and triage stability (two identical consecutive runs) on 0.11.6 BEFORE changing any gate spelling — the 0.11.5 empirics do not transfer. Note: `--triage-mode`/`--triage-database`/`--show-ignored-findings` already exist in 0.11.5; the 0.11.6 bump is about the maintained line, not new triage capability.
- **D-03:** Triage-id drift is the known failure mode and a CORRECT red. Matching is by finding-id hash (legacy description fallback), with historical instability (crytic/slither#1965). Line/description drift near the 3 FP sites invalidates entries and reds the gate until re-triaged — that is the mechanism working, not flakiness; do not "fix" it by widening suppression.

### New-findings policy (standing rule for whatever the upgraded line surfaces)
- **D-04:** Triage-first + owner review; real findings become routing events. Every finding beyond the committed 3-FP set gets dispositioned: triaged-as-FP (with evidence, committed to the db) or recorded as a routing event to an owning phase (STATE 07-03 D-09 precedent). **No contract-source fixes in Phase 18** — deployed-facet fixes require diamond-cut upgrade discipline (Safe proposer flow, EIP-170 headroom, test re-baseline) and belong to an owning phase. Phase 18 ends when the upgraded gate exits 0 with every finding dispositioned. Scripts/TS-side findings ARE fixed in-phase (they carry no deployment discipline).
- **D-05:** Detector exclusion rejected outright. `slither.config.json` keeps zero detector excludes (severity-level only, as today). Blanket detector exclusion permanently blinds the gate to future code and is silent suppression. De-risked by the verified delta: 0.11.5→0.11.6 adds exactly **one** new detector (`msg-value-in-nonpayable`, HIGH impact/confidence — the one realistic new-finding source); every other detector change is false-positive *reduction*.

### SEC-10 — semgrep gate
- **D-06:** Zero-findings hard gate. Type the 13 `typescript-any-usage` sites in `scripts/utils/GNUSLifecyclePolicyLinking.ts` (lines 77×2, 94, 104, 129, 152, 158, 160×2, 162, 170, 220, 235); keep blanket `--error` so every rule at every severity enforces with **nothing recorded** — matching the zero-finding posture of the npm-audit/snyk steps and the WR-01 fix-at-source precedent. Harness constraint: the file monkey-patches Hardhat config loading — **top-level imports must stay type-only** (a plain value import of `hardhat` breaks config loading); the awkward site at lines 160-162 intercepts an overloaded `getContractFactory` (use `unknown` + narrowing or `Parameters<>` extraction). The rejected alternative: severity-scoping the gate (`--severity WARNING --severity ERROR`) — it would make the lint rule advisory forever AND drop INFO findings from the CI artifact entirely, killing the baseline diff (replicating the `--fail-none` compromise this repo flags as awaiting root-cause fix).
- **D-07:** Pin CI semgrep to `semgrep==1.174.0`. The pin is load-bearing, not hygiene: PyPI already serves 1.175.0, exit semantics were proven version-sensitive on 1.174.0, and parity with the local brew 1.174.0 mirrors the slither `==0.11.5` "exact parity with the local gate version" convention two steps above it in the same workflow.
- **D-08:** The fixed rule detects **unchecked `.call{}` results**, in generic mode (native-Solidity `.call{...}(...)` and tuple-destructure spellings do NOT parse on 1.174.0). Validated shape: `patterns:` with `pattern-either` of `(bool $SUCCESS, ) = $R.call{$K: $V}(...);` and `(bool $SUCCESS, $DATA) = $R.call{$K: $V}(...);`, suppressed by `pattern-not-inside` blocks pairing each assignment shape with a following `require($SUCCESS, ...);` or `if (!$SUCCESS) { ... }`; `paths: include: ["**/*.sol"]`. Fires on **neither** existing site — both verified checked: `contracts/gnus-ai/libraries/TransferHelper.sol:52` (`require(success, 'STE')`), `contracts/gnus-ai/GNUSContractAssets.sol:48` (`if (!success) { revert ErrorWithdrawingEther(); }`) — so it ships green with zero triaged baseline. The identical broken pattern also lives at `.devcontainer/config/.semgrep.yml:14` — mirror the fix there.
- **D-09:** The executes-proof is mandatory. A rule whose pattern fails parse mid-scan **still exits 0 reporting "Rules run: 1, Findings: 0"** — the exact silent-never-runs failure being fixed. Verification MUST include a positive control: run the positive pattern without the suppression blocks → expect **exactly 2 findings** (`GNUSContractAssets.sol:48`, `TransferHelper.sol:52`), then the shipped rule → 0 findings. "Validates" is not "executes".
- **D-10:** Expand the scan surface to the submodule. Add `--no-git-ignore` to `yarn semgrep:scan` — semgrep's default gitignore-aware discovery **skips `contracts/gnus-ai` entirely**; today's surface is 8 outer-repo mock `.sol` files plus the TS scripts, so the rule as scripted today can never reach the real call sites. The first full scan of the real `.sol` surface may surface new findings from the other ~22 rules; each is dispositioned per D-04: fixed if scripts/TS-side, owner-ruled rule exclusion or routing event if contract-side. **No `nosemgrep` annotations in contract source** — that is both a source change and silent suppression.

### Owner rulings — post-research disposition set (2026-08-31, from 18-RESEARCH.md Pitfall 2)
- **D-11:** `diamond-selector-clash` (31 findings) — permanent script-level `--exclude-rule` with STATE-recorded rationale. Structural FP generator for diamond facets: the rule's `bytes4 public constant $SELECTOR = $VALUE;` escape hatch matches no facet idiom; real selector-clash coverage lives in diamond-cut tooling. 07-02 weak-encryption precedent.
- **D-12:** `hard-coded-secret` (2 findings) — temporary script-level `--exclude-rule` with a routing event to diamondslab/diamonds-devcontainer upstream: the findings sit in commented-out code at `.devcontainer/scripts/setup/VaultSecretManager.ts:34,91` in the nested devcontainer submodule (not editable in this repo). Exclusion lifts when upstream cleans the file; rationale + lift condition recorded in STATE.
- **D-13:** `unsafe-math-operation` (4 sites: `GNUSBridge.sol:110`, `GNUSBridgeAttestor.sol:393`, `GNUSTreasury.sol:126`, `GNUSTreasury.sol:137`) — **execution checkpoint**: the plan pauses with the 4-site table for an owner ruling (permanent exclusion vs temp-exclusion + mul-div precision routing event) BEFORE the semgrep gate-promotion step; promotion cannot go green past this checkpoint without the ruling.
- **D-14:** `test/` (43 tracked `.sol` files) stays OUT of the semgrep surface — excluded by semgrep's bundled default ignore, unchanged by this phase (D-10's surface goal is the `contracts/gnus-ai` submodule only).

### Claude's Discretion
- The concrete type annotations for the 13 sites (`unknown` + narrows, explicit interfaces, `Parameters<>` extraction), provided imports stay type-only and the Hardhat config load + `npx tsc` surface stays green.
- Exact wording/placement of the `triage_database` key, pin comments, and gate comments in `slither.config.json` / `security-audit.yml` / `package.json`, provided the committed-artifact chain (db + config + workflow) stays self-describing per the file's existing comment conventions.
- Sequencing of the probe runs (0.11.6 exit-code probes, double-run triage stability, semgrep N-run) inside the phase, provided every probe precedes its gate flip.
- How STATE records the new scanner baselines — extending the Phase-17 "Test Baseline Ledger (canonical)" section or a sibling Scanner Baseline section, single-source either way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + committed baselines
- `.planning/REQUIREMENTS.md` — SEC-09/SEC-10 definitions and traceability rows (lines 16-17).
- `.planning/STATE.md` — "Phase 7 Decisions Logged (07-03)": the committed 3-FP slither baseline + 13-finding semgrep baseline these upgrades replace, the 0.11.5 exit-code empirics D-02 re-proves, and the D-09 routing-event precedent D-04 reuses; "Test Baseline Ledger (canonical)": the D-06 N-run + single-ledger precedent the new scanner baselines follow.

### Gate + configs (files in scope)
- `.github/workflows/security-audit.yml` — tokenless hard-gate shape; slither pin step (`slither-analyzer==0.11.5`, line ~80); the advisory semgrep step with its documented promotion condition (~lines 105-124); `--fail-none` gate step (~line 103).
- `package.json` — scanner scripts: `semgrep:scan`, `slither:scan`, `slither:check` (D-01/D-10 edit targets).
- `.semgrep.yml` — the 23-rule inventory; the broken rule at lines 10-16 (D-08 target).
- `.devcontainer/config/.semgrep.yml` — line 14 carries the identical broken pattern (mirror-fix target).
- `slither.config.json` — current severity excludes + `filter_paths`; gains `triage_database` (D-01).

### Code surfaces
- `scripts/utils/GNUSLifecyclePolicyLinking.ts` — the 13 `any` sites (248-line file); monkey-patch harness with the type-only-import constraint (D-06).
- `contracts/gnus-ai/libraries/TransferHelper.sol:52` and `contracts/gnus-ai/GNUSContractAssets.sol:48` — the only two `.call{` sites in the repo (both checked; the D-09 positive-control targets).

### Precedents
- `.planning/phases/17-test-suite-determinism/17-CONTEXT.md` — D-06 N-run proof + STATE-as-single-ledger precedent this phase reuses.
- `../.planning/ROADMAP.md` (TokenContracts parent) Phase 18 — the source entry this roadmap row mirrors.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The committed STATE 07-03 baseline table — the finding-identity record the triage entries must match exactly (detector + site).
- `yarn slither:check` (checklist mode) and `--show-ignored-findings` — the re-surface mechanisms keeping triaged FPs visible on demand.
- `security-audit.yml` semgrep artifact upload (`semgrep-scan.log`) — the diffable record a zero baseline makes trivial.
- The Phase-17 N-run proof harness pattern (/tmp logs + per-run table + ledger entry) — directly reusable for the semgrep stability proof.

### Established Patterns
- Probe-then-flip (07-04): no gate spelling changes on remembered empirics — D-02 applies it to 0.11.6.
- Exact version pinning everywhere; CI pins mirror the local gate versions that produced committed baselines (D-07).
- Fix-at-source for zero-finding gates (WR-01 snyk precedent); owner-ruled exclusions only with recorded rationale (`weak-encryption`).
- CI workflows point at `.planning/STATE.md` as the committed-baseline home.

### Integration Points
- `yarn security-check` chain — both the semgrep and slither legs change exit behavior this phase; the chain's honesty note (STATE 07-03) needs its post-promotion update.
- `scripts/devops/security-tool-updater.ts` — may enumerate tool versions; verify whether it references 0.11.5/1.174.0 during research.

</code_context>

<specifics>
## Specific Ideas

- The positive-control expectation is exact: 2 findings with suppressions dropped (`GNUSContractAssets.sol:48` + `TransferHelper.sol:52`), 0 with the shipped rule — no other count passes D-09.
- A triage-id-drift red is correct behavior; the response is re-triage, never widened suppression (D-03).
- The new CI pin comments keep the "exact parity with the local gate version that produced the committed baseline" convention already in the file.

</specifics>

<deferred>
## Deferred Ideas

- Fix-at-source for any real contract finding the upgraded scanners surface — routing event to an owning phase instead (D-04); that phase owns the diamond-cut discipline.
- Any semgrep OSS baseline/triage mechanism beyond zero-findings — unnecessary while the zero baseline holds.
- CI hosting for the Foundry suite — already deferred out of Phase 17 (D-07 there); untouched here.

</deferred>

---

*Phase: 18-Scanner Triage Upgrades*
*Context gathered: 2026-08-31*
