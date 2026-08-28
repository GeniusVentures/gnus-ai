# Phase 7: Dependency Hardening - Context

**Gathered:** 2026-08-04
**Status:** Context captured — **execution deferred until Phases 9–14 complete** (D-01)

<domain>
## Phase Boundary

Close out the Tech Debt & Security Remediation arc: pin the floating `contracts-starter` npm dependency to a specific commit hash for deterministic builds, then run the final audit and verification pass — full test suite (`yarn test` + `yarn forge:test`) and requirements-completion audit across the remediation requirement set.

This is a **build-reproducibility + sign-off gate** phase, not a feature phase. It is deliberately sequenced to execute **last** (after Phases 9–14 land) so the "final audit" actually audits the finished system, not a mid-flight one. The phase number stays 7; execution order differs from numbering (D-01).

**Why deferred:** Phases 13 (Time-Bound ERC-1155 Entitlements) and 14 (Private-Network AI Licensing) will materially change the codebase — new facets, storage appends, new test suites, new LIC requirements. Running a "final audit and verification pass" before those land would either (a) certify an incomplete system or (b) force a re-run of the entire gate after Phase 14. Deferring execution until Phase 14 completes makes the audit meaningful exactly once.
</domain>

<decisions>
## Implementation Decisions

### Execution Sequencing

- **D-01:** Phase 7 executes **last**, after Phases 9, 10, 11, 12, 13, and 14 complete. The phase keeps its number (`7`) — no renumbering of 8–14. ROADMAP.md Phase 7 section is annotated with `**Blocked by:** Phases 9–14` (or equivalent `blocked-by` marker) so `/gsd:progress` and `--next` routing skip over it until unblocked. Execution order ≠ phase numbering.

### DEP-01 — `contracts-starter` Pin

- **D-02:** Pin target is the **currently-resolved commit `bf67b736ad5fa3366551f599e204784856fb3069`** (zero-drift). This is the commit `yarn.lock` already resolved `https://github.com/mudgen/diamond-2-hardhat.git` to, and the commit all existing tests ran against. Do **not** chase latest upstream `master` HEAD — upstream is Nick Mudge's static reference repo and pinning to a fresh, unvalidated commit would change the code under test while claiming to be a no-op hardening step.
- **D-03:** Pin syntax is **Yarn 4 native Git syntax**: `"contracts-starter": "https://github.com/mudgen/diamond-2-hardhat.git#commit=bf67b736ad5fa3366551f599e204784856fb3069"`. This matches the `#commit=<sha>` normalization Yarn 4 already wrote into `yarn.lock` (line 4884), so the lockfile diff should be minimal-to-empty after `yarn install`.
- **D-04:** Scope of pinning is the **npm/test-harness dependency only** — the on-chain Solidity source does not need "vendor pinning" in a separate sense. `contracts-starter` reaches the contracts via Hardhat compile-time imports (`import "contracts-starter/contracts/..."` in `GeniusDiamond.sol`, `DiamondInitFacet.sol`, `GeniusAccessControl.sol`, `GNUSNFTFactory.sol`, `GNUSControl.sol`, `GNUSControlStorage.sol`, `GNUSERC1155MaxSupply.sol`, `GeniusOwnershipFacet.sol`), and its reproducibility is exactly the npm-resolution problem DEP-01 describes. No additional vendoring, gitmodule conversion, or source copying into the repo.
- **D-05:** The `contracts/gnus-ai` git submodule (GeniusVentures/gnus-ai-contracts, currently `2e70a63` on `develop`) is **not** in scope for this phase. It is already commit-pinned by the submodule mechanism itself. Discussion mention of "latest upstream develop for the gnus-ai submodule" was clarified as orthogonal to DEP-01 — submodule bumps happen per-phase as they already do (see recent `chore: bump gnus-ai submodule` commits).

### Requirements Audit Scope

- **D-06:** The roadmap's "All 22 requirements are verified complete" figure is **stale** — REQUIREMENTS.md currently shows 25 unchecked boxes spanning remediation (DEBT/SEC/PERF/QUAL/DEP), Safe Wallet Proposer (SWP), and Licensing (LIC) items. The audit must:
  1. **Update the ROADMAP.md Phase 7 success criterion** to reference the actual remediation requirement set (DEBT-*, SEC-*, PERF-*, QUAL-*, DEP-01) rather than a hardcoded "22", and
  2. Verify completion of the **remediation-arc requirements only** (Phases 1–7 scope). LIC-01–LIC-07 belong to Phase 14; SWP-02/03/06/07/09 belong to Phase 08.1/08.2 — those are audited by their own phases, not re-audited here. The Phase 7 audit confirms the remediation arc is closed, not that the entire roadmap is done.
- **D-07:** REQUIREMENTS.md checkbox reconciliation is part of this phase's work. Several remediation requirements are code-complete but still unchecked (e.g., DEBT-01 GeniusAI removal, SEC-03 bridgeOut validation — both landed in earlier phases). Reconciling checkboxes to reality is audit output, not scope creep.

### Final Audit Toolset

- **D-08:** Full `yarn security-check` (Slither + Semgrep + Snyk + Socket + OSV + git-secrets) plus `yarn test` and `yarn forge:test`. This is the documented project security gate (`package.json` scripts, INTEGRATIONS.md §Security Scanning) — no narrowing. The audit's value is that it is the *complete* gate; a subset would just re-open the question of what was skipped.
- **D-09:** Audit failures are **fixed at their root cause**, not worked around — per project rule "Fix root cause, never hack around bugs". If the full suite surfaces issues in code owned by Phases 9–14, those fixes are new work items fed back to the relevant phase (or a gap-fix plan), not silently patched inside Phase 7.

### Claude's Discretion

- Exact wording of the `blocked-by` marker in ROADMAP.md (match whatever `/gsd:progress` parsing expects — check `gsd-sdk query roadmap.get-phase` behavior for dependency fields)
- Whether the ROADMAP success-criterion rewrite replaces "22" with an explicit requirement list or a reference to REQUIREMENTS.md sections
- Lockfile regeneration verification approach (clean `yarn install` in a fresh clone vs. `--check-cache` vs. both)
- Order of operations within the phase (pin-first-then-audit is the natural order, but audit-first to establish a baseline is defensible)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Requirement

- `.planning/ROADMAP.md` §Phase 7 (lines 163–173) — current goal/success criteria text being amended by D-06
- `.planning/REQUIREMENTS.md` §Dependencies (line 45) — DEP-01 statement; §Requirements Phase Mapping table — which requirements map to which phases (audit scope boundary per D-06)

### Dependency Target

- `package.json` (line 135) — current floating `contracts-starter` declaration
- `yarn.lock` (lines 1458, 4882–4884) — current resolved commit `bf67b736ad5fa3366551f599e204784856fb3069` and the `#commit=` normalization D-03 mirrors
- `node_modules/contracts-starter/contracts/` — what the package actually provides (`Diamond.sol`, `facets/`, `interfaces/`, `libraries/`, `upgradeInitializers/`)

### Consumers of the Pinned Dependency

- `contracts/gnus-ai/GeniusDiamond.sol` — imports `contracts-starter/contracts/Diamond.sol`
- `contracts/gnus-ai/DiamondInitFacet.sol`, `contracts/gnus-ai/GeniusAccessControl.sol`, `contracts/gnus-ai/GNUSNFTFactory.sol`, `contracts/gnus-ai/GNUSControl.sol`, `contracts/gnus-ai/GNUSControlStorage.sol`, `contracts/gnus-ai/GNUSERC1155MaxSupply.sol`, `contracts/gnus-ai/GeniusOwnershipFacet.sol` — import `LibDiamond.sol`, `DiamondCutFacet.sol`, `DiamondLoupeFacet.sol`

### Audit Tooling

- `package.json` scripts — `security-check`, `slither:scan`, `semgrep:scan`, `snyk:test`, `socket:scan`, `osv:scan`, `git-secrets:scan`, `test`, `forge:test`
- `.planning/codebase/INTEGRATIONS.md` §Security Scanning — tool versions and configuration locations (`slither.config.json`, `.semgrep.yml`)
- `.planning/codebase/STACK.md` §Testing — Mocha/Chai/Foundry/coverage tooling the final suite runs under

### Sequencing Context

- `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` — precedent for "context captured, implementation blocked on later phase" pattern (13 blocked on 9; 7 blocked on 9–14)
- `.planning/STATE.md` — roadmap evolution notes (Phase 08.1/08.2 insertion precedent for roadmap-level ordering changes)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `yarn.lock` already records the target commit — D-02/D-03 make the pin a `package.json`-only change with a near-empty lockfile diff
- `yarn security-check` script — the full audit gate already exists as a single command; no new tooling to wire
- Phase 13's blocked-phase precedent (`13-CONTEXT.md` header + ROADMAP annotation) — the exact pattern for D-01's roadmap marker

### Established Patterns

- Yarn 4 Git-dependency syntax: `<git-url>#commit=<sha>` — already used by Yarn's own lockfile normalization for this exact package
- Submodule pinning: `contracts/gnus-ai` is pinned by git submodule SHA (`2e70a63`), bumped deliberately per-phase — the contrast that makes D-05 explicit
- Requirement-to-phase mapping table in REQUIREMENTS.md — the audit-scope boundary mechanism (D-06)

### Integration Points

- `package.json` dependencies block (line 135) — the single-line pin change
- `.planning/ROADMAP.md` Phase 7 section — success-criterion rewrite (D-06) + `blocked-by` marker (D-01)
- `.planning/REQUIREMENTS.md` — checkbox reconciliation (D-07)
- CI/Husky hooks — full suite must pass in the same pipeline shape developers run locally (`.buildrc` coverage thresholds, `.husky/` pre-push)

</code_context>

<specifics>
## Specific Ideas

- "I don't think we need to pin vendor choices for these smart contracts — only the test harness using npm needs to be hardened" — user framing that became D-04: the pin is about build reproducibility of the compile/test harness, not about treating Solidity imports as runtime vendor risk.
- "Make this the last phase" — user directive that became D-01, with numbering preserved and execution order deferred.
- Zero-drift philosophy: pin to what's already resolved and tested (`bf67b736…`), never to a fresh upstream commit, in a phase whose entire purpose is *not changing anything behavioral*.

</specifics>

<deferred>
## Deferred Ideas

- **Execution of Phase 7 itself** — deferred until Phases 9–14 complete (D-01). This CONTEXT.md captures decisions now so planning can happen any time; implementation waits.
- **Re-audit of SWP/LIC requirements** — belongs to Phases 08.1/08.2/14, not re-audited here (D-06).
- **`contracts/gnus-ai` submodule pinning policy** — explicitly out of scope (D-05); submodule bumps remain per-phase chores.
- **Gap fixes surfaced by the final audit** — if the full suite fails on code owned by Phases 9–14, fixes route back to those phases or a gap-fix plan rather than being absorbed into Phase 7 (D-09).

</deferred>

---

*Phase: 7-Dependency Hardening*
*Context gathered: 2026-08-04*
