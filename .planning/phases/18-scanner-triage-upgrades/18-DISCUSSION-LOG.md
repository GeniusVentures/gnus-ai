# Phase 18: Scanner Triage Upgrades - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 18-scanner-triage-upgrades
**Areas discussed:** Slither triage mechanism, New slither findings policy, Semgrep gate assertion, unsafe-external-call rule, Semgrep scan surface

**Mode:** advisor (research-backed comparison tables). Calibration tier: minimal_decisive (vendor philosophy *opinionated*). Technical-owner framing retained (profile: technical background, HIGH). Four gsd-advisor-researcher agents ran in parallel; tables below are the synthesized agent outputs.

---

## Slither triage mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Committed triage db (REC) | Pin 0.11.6, one --triage-mode run marks the 3 Phase-9 FPs, commit .slither.db.json, set triage_database in slither.config.json, drop --fail-none — green = zero untriaged findings; exit codes re-proven on 0.11.6 first (probe-then-flip) | ✓ |
| Keep status quo | Findings print, diff vs STATE 07-03 baseline, green via --fail-none on 0.11.5; SEC-09 stays open, gate can never red on a finding | |

**User's choice:** Committed triage db (REC)
**Notes:** Research corrected two premises: triage mode already exists in 0.11.5, and 07-03's `--fail-high`-exits-255 empiric conflicts with current source on both lines — hence the locked probe-then-flip duty (D-02) and the triage-id-drift-is-correct-red stance (D-03). Detector-wide config exclusion was researched and rejected without being tabled (silent suppression, blinds the gate).

---

## New slither findings policy

| Option | Description | Selected |
|--------|-------------|----------|
| Triage-first + routing (REC) | Every new finding triaged-as-FP (with evidence) or recorded as a routing event to an owning phase; no contract-source fixes in Phase 18 — deployed-facet fixes need diamond-cut discipline; verified delta is one new detector (msg-value-in-nonpayable) | ✓ |
| Fix-at-source in-phase | Real findings fixed at source inside Phase 18; phase may grow to include diamond-cut upgrade work if a real finding lands in a deployed facet | |

**User's choice:** Triage-first + routing (REC)
**Notes:** Research established the 0.11.5→0.11.6 detector delta is tiny (one new HIGH/HIGH detector; everything else is FP reduction), so the policy is a standing rule rather than a remediation campaign. The policy composes with the triage db: findings absent from the db fail the gate until triaged.

---

## Semgrep gate assertion

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-findings gate (REC) | Type the 13 `any` sites in GNUSLifecyclePolicyLinking.ts, keep blanket --error, pin CI semgrep==1.174.0; every rule/severity enforcing, nothing recorded; N-run stability proof (D-06 precedent) | ✓ |
| Severity-scoped gate | Keep the 13 INFO findings; CI gate fails only on WARNING/ERROR via --severity flags; INFO drift disappears from the CI artifact — baseline diff dies | |

**User's choice:** Zero-findings gate (REC)
**Notes:** Research proved locally on 1.174.0 that INFO findings DO fail today's script under blanket --error, and that severity filtering drops INFO from the artifact entirely (baseline diff destroyed). The weak-encryption exclusion precedent was judged non-transferring (ERROR-severity regex noise vs true-positive INFO signal). The pin is load-bearing: PyPI already serves 1.175.0; exit semantics are version-sensitive.

---

## unsafe-external-call rule

| Option | Description | Selected |
|--------|-------------|----------|
| Unchecked .call{} (REC) | Generic-mode sequence rule matching (bool $X, ...) = $Y.call{...}(...) without a following require/if check; fires on neither existing checked site — ships green; positive-control run (2 findings with suppressions dropped) is the mandatory executes-proof | ✓ |
| Flag all .call{} | Native pattern flagging every .call{} unconditionally; fires on both existing checked sites → permanent 2-finding triaged baseline under --error | |

**User's choice:** Unchecked .call{} (REC)
**Notes:** Research validated the candidate pattern parses AND executes on 1.174.0 (/tmp prototype; full 22-rule config copy validates clean), and surfaced the vacuous-green trap: a parse-failed rule still exits 0 reporting "Rules run: 1, Findings: 0" — the exact silent failure being fixed, hence the locked positive-control proof (D-09). Both existing .call{} sites verified checked (TransferHelper.sol:52, GNUSContractAssets.sol:48). Dropping the rule entirely was excluded: it fails success criterion 2 by definition. The identical broken pattern also lives at .devcontainer/config/.semgrep.yml:14.

---

## Semgrep scan surface (follow-up discovered by research)

| Option | Description | Selected |
|--------|-------------|----------|
| Expand to submodule (REC) | Add --no-git-ignore so semgrep scans contracts/gnus-ai; first full scan may surface new findings from the other ~22 rules on 80+ real .sol files — dispositioned per the new-findings policy, never in-phase contract fixes | ✓ |
| Keep current surface | Surface stays 8 outer mocks + TS scripts; rule proven via positive control but the promoted gate never sees the real contract code | |

**User's choice:** Expand to submodule (REC)
**Notes:** Discovered mid-discussion: `yarn semgrep:scan` runs gitignore-aware and skips the `contracts/gnus-ai` submodule entirely — today's scan surface is 8 outer-repo mock .sol files plus TS scripts, so the rule as scripted can never reach the real call sites. Presented as a follow-up decision after the four main picks.

---

## Claude's Discretion

- Concrete type annotations for the 13 sites (provided imports stay type-only; Hardhat config load + tsc stay green).
- Wording/placement of triage-database key, pin comments, and gate comments (provided the committed-artifact chain stays self-describing).
- Sequencing of probe runs inside the phase (provided every probe precedes its gate flip).
- How STATE records the new scanner baselines (extend the Test Baseline Ledger or a sibling section — single-source either way).

## Deferred Ideas

- Fix-at-source for any real contract finding — routing event to an owning phase instead (that phase owns the diamond-cut discipline).
- Any semgrep OSS baseline/triage mechanism beyond zero-findings — unnecessary while the zero baseline holds.
- CI hosting for the Foundry suite — already deferred out of Phase 17; untouched here.
