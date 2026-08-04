# Phase 7: Dependency Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 7-dependency-hardening
**Areas discussed:** Pin SHA choice, Pin syntax, Requirements audit scope, Execution sequencing

---

## Pin SHA Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Latest upstream `master` HEAD | Pin to the freshest `mudgen/diamond-2-hardhat` commit — pulls any upstream changes we haven't validated | |
| Lockfile-resolved `bf67b736…` | Pin to the commit `yarn.lock` already resolved and all existing tests ran against — zero-drift | ✓ |

**User's choice:** (b) currently-resolved commit `bf67b736ad5fa3366551f599e204784856fb3069`
**Notes:** User initially said "latest upstream develop for the gnus-ai submodule" — clarification revealed two distinct dependencies were being conflated: `contracts-starter` (npm, `mudgen/diamond-2-hardhat`, the actual DEP-01 target) vs. `contracts/gnus-ai` (git submodule, GeniusVentures/gnus-ai-contracts, already SHA-pinned at `2e70a63` by the submodule mechanism). The submodule is explicitly out of scope (D-05). Upstream `mudgen/diamond-2-hardhat` is a static reference repo; zero-drift pinning hardens the build without changing code under test.

---

## Pin Syntax

| Option | Description | Selected |
|--------|-------------|----------|
| Bare `#<sha>` | Standard Git URL fragment pin | |
| `#commit=<sha>` | Yarn 4 native Git syntax — matches the normalization Yarn already wrote into `yarn.lock` line 4884 | ✓ |

**User's choice:** Yarn 4 native `#commit=<sha>` — implied by "only the test harness using npm needs to be hardened" framing; confirmed when selecting zero-drift pin.
**Notes:** User's key framing: "I don't think we need to pin vendor choices for these smart contracts — only the test harness using npm needs to be hardened." This became D-04: the pin addresses npm build reproducibility (Hardhat compile-time resolution), not on-chain runtime vendor risk. No vendoring, no gitmodule conversion, no source copying.

---

## Requirements Audit Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Verify all 25 unchecked items | Audit every unchecked box in REQUIREMENTS.md including in-flight 08.1/08.2 and future Phase 14 LIC work | |
| Remediation set only, update "22" figure | Rewrite ROADMAP success criterion to reference the actual remediation requirement set (DEBT/SEC/PERF/QUAL/DEP); LIC/SWP audited by their own phases | ✓ |

**User's choice:** "Update the 22 figure, but since we still have 13 and 14 phases to work on, all this probably needs to be postponed?"
**Notes:** The "22" in ROADMAP.md is stale — REQUIREMENTS.md shows 25 unchecked boxes spanning three different phase scopes. User's instinct to postpone became the sequencing decision (below). Also captured: several remediation requirements are code-complete but still unchecked (DEBT-01, SEC-03) — checkbox reconciliation is audit output (D-07).

---

## Execution Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Append as Phase 15 | Cleanest — no renumbering of 8–14, but loses "Phase 7 = remediation arc" semantic grouping | |
| (b) Renumber 8–14 → 7–13, hardening becomes Phase 14 | Preserves "Phase N is Nth to execute" invariant — but renumbers five phases and breaks existing references (13-CONTEXT.md, ROADMAP cross-refs, REQUIREMENTS mapping table) | |
| (c) Keep number 7, mark `blocked-by: [9–14]` | Execution order differs from numbering — matches Phase 13 precedent (context captured, implementation blocked on Phase 9) | ✓ |

**User's choice:** (c)
**Notes:** "Need to make this the last phase it seems like." Phase 13's CONTEXT.md established the exact precedent: "Approved for planning. Implementation begins only after Phase 9 completes." ROADMAP.md gets a `blocked-by` marker; `/gsd:progress` and `--next` routing skip Phase 7 until unblocked.

---

## Claude's Discretion

- Exact wording of the `blocked-by` marker in ROADMAP.md (match whatever `/gsd:progress` parsing expects)
- Whether the ROADMAP success-criterion rewrite replaces "22" with an explicit requirement list or a REQUIREMENTS.md section reference
- Lockfile regeneration verification approach (fresh-clone `yarn install` vs. `--check-cache` vs. both)
- Order of operations within the phase (pin-first vs. audit-first baseline)

## Deferred Ideas

- **Execution of Phase 7 itself** — deferred until Phases 9–14 complete. Context captured now so planning can happen any time; implementation waits.
- **Re-audit of SWP/LIC requirements** — belongs to Phases 08.1/08.2/14 (D-06 scope boundary)
- **`contracts/gnus-ai` submodule pinning policy** — out of scope (D-05); per-phase submodule bumps continue as-is
- **Audit-surfaced gap fixes** — route back to owning phase or gap-fix plan, never silently absorbed into Phase 7 (D-09)
