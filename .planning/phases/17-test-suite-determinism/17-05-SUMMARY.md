---
phase: 17-test-suite-determinism
plan: "05"
subsystem: testing
tags: [determinism, test-gate, baseline-ledger, hardhat, foundry, invariant-testing, d-06]

requires:
  - phase: 17-02
    provides: all 13 test/unit Tier-A scaffolds declaring the shared baseline before their snapshot
  - phase: 17-03
    provides: 9 Tier-B probe-guard folds + 4 non-unit Tier-A scaffolds wired (fully-swept tree this proof runs against)
  - phase: 17-04
    provides: TEST-05/TEST-06 root fixes (attacker re-target + Safe setUp vm.skip) and the 215/0/5 gate arithmetic this ledger canonizes

provides:
  - "D-06 determinism proof: N=5 consecutive `yarn test:all` runs + N=10 consecutive AccessControlInvariant-only wrapper runs, all green with identical counts"
  - "Canonical Test Baseline Ledger in .planning/STATE.md — the single source every test-gate figure is read from now on"
  - "PROJECT.md:11 and ROADMAP.md re-pointed at the ledger; STATE 07-01/07-04 665/2/1, PROJECT 666/2/0, ROADMAP '666/2/0 + 1 stale' fragmentation collapsed"

affects: [phase-18-scanner-triage-upgrades, phase-19-dependency-hygiene, all future phases consuming test-gate baselines, CI security-audit workflow pointer]

tech-stack:
  added: []
  patterns:
    - "STATE.md-as-ledger: .planning/STATE.md § Test Baseline Ledger is the canonical baseline record; PROJECT.md and workflows point at it (precedent: security-audit.yml:8)"
    - "Rule of record (Pitfall 1): ledger counts are derived from run-1 printed output only, never from remembered figures; any proof failure stops the protocol as a routing event"

key-files:
  created:
    - .planning/phases/17-test-suite-determinism/17-05-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/PROJECT.md
    - .planning/ROADMAP.md

key-decisions:
  - "Canonical baseline derived from run 1 of this proof: Hardhat 666 passing / 2 pending / 0 failing; Foundry 215 passed / 0 failed / 5 skipped; invariant-only 8/0/0 — identical across every run"
  - "The 3→5 forge skip change is recorded as the DECLARED D-04/D-05 fork-skip for SafeSingleShotUpgradeTest + SafeDiamondCutTest setUp, not drift"
  - "No CI guard created (D-07): CI cannot host the Foundry bridge-node suite and a Hardhat-only guard would re-run the half that never flaked"
  - "Verification-only Task 1 recorded via an empty commit (3ca9f99) carrying the observed figures and /tmp log paths, since the protocol mandates per-task commits and the task produces no tracked artifacts"

patterns-established:
  - "Per-run proof table with wall times recorded in the ledger (A1 closed: no recorded timings existed before)"
  - "Proof-protocol order: node up → 5 full runs → 10 invariant runs → node down; every run exit-0-gated"

requirements-completed: [TEST-04, TEST-05, TEST-06]

duration: 12min
completed: 2026-08-31
---

# Phase 17 Plan 05: Determinism Proof & Baseline Ledger Summary

**N=5 full-suite + N=10 invariant-only proof runs against the fully-swept tree are all green with byte-identical counts (666/2/0 Hardhat, 215/0/5 Foundry, 8/0/0 invariant), and the new canonical Test Baseline Ledger in STATE.md supersedes every fragmented historical figure (D-06 closed; zero known-stale/failing entries).**

## Performance

- **Duration:** 12 min (proof protocol 21:28:54Z → 21:34:28Z; records/summary after)
- **Started:** 2026-08-31T21:28:15Z
- **Completed:** 2026-08-31T21:40:00Z
- **Tasks:** 2/2
- **Files modified:** 3 (+ this summary)

## Derived Canonical Counts (from run 1 output — the derivation of record)

| Gate | Command | Observed | Notes |
|---|---|---|---|
| Hardhat | `yarn test` | **666 passing / 2 pending / 0 failing**, exit 0 | matches 17-01/17-02/17-03 records |
| Foundry | `yarn forge:test` (bridge node 127.0.0.1:8545) | **215 passed / 0 failed / 5 skipped** (220 total, 37 suites), exit 0 | matches 17-04; skips = 2 declared Safe setUp fork-skips + 3 pre-existing deployment.t.sol runtime skips |
| Invariant-only | wrapper `--match-contract AccessControlInvariant --force` | **8 passed / 0 failed / 0 skipped**, exit 0 | the former 07-04 flake, now deterministic |

Skip-entry rendering observed (forge 1.7.1 `skipped: ` infix, as 17-04 recorded):
- 2× `[SKIP: skipped: requires sepolia/anvil fork with canonical Safe deployments] setUp() (gas: 0)`
- 3× `[SKIP] test_*` deployment.t.sol runtime-conditional entries (unchanged)

## Per-Run Proof (all runs exit 0)

| # | Kind | Result | Wall | Log |
|---|------|--------|------|-----|
| 1 | `yarn test:all` | 666/2/0 + 215/0/5 — ok | 56s | /tmp/17-05-testall-1.log |
| 2 | `yarn test:all` | 666/2/0 + 215/0/5 — ok | 50s | /tmp/17-05-testall-2.log |
| 3 | `yarn test:all` | 666/2/0 + 215/0/5 — ok | 48s | /tmp/17-05-testall-3.log |
| 4 | `yarn test:all` | 666/2/0 + 215/0/5 — ok | 54s | /tmp/17-05-testall-4.log |
| 5 | `yarn test:all` | 666/2/0 + 215/0/5 — ok | 51s | /tmp/17-05-testall-5.log |
| 1 | AccessControlInvariant only | 8/0/0 — ok | 22s | /tmp/17-05-invariant-1.log |
| 2 | AccessControlInvariant only | 8/0/0 — ok | 21s | /tmp/17-05-invariant-2.log |
| 3 | AccessControlInvariant only | 8/0/0 — ok | 22s | /tmp/17-05-invariant-3.log |
| 4 | AccessControlInvariant only | 8/0/0 — ok | 22s | /tmp/17-05-invariant-4.log |
| 5 | AccessControlInvariant only | 8/0/0 — ok | 21s | /tmp/17-05-invariant-5.log |
| 6 | AccessControlInvariant only | 8/0/0 — ok | 21s | /tmp/17-05-invariant-6.log |
| 7 | AccessControlInvariant only | 8/0/0 — ok | 21s | /tmp/17-05-invariant-7.log |
| 8 | AccessControlInvariant only | 8/0/0 — ok | 20s | /tmp/17-05-invariant-8.log |
| 9 | AccessControlInvariant only | 8/0/0 — ok | 21s | /tmp/17-05-invariant-9.log |
| 10 | AccessControlInvariant only | 8/0/0 — ok | 22s | /tmp/17-05-invariant-10.log |

All runs executed 2026-08-31 (21:28:54Z → 21:34:28Z) against the post-17-03 tree with one bridge node kept up for the whole protocol (node log: /tmp/17-05-hardhat-node.log; per-run timestamps: /tmp/17-05-*.times).

## Task Commits

1. **Task 1: D-06 proof — N=5 full-suite + N=10 invariant-only runs** - `3ca9f99` (test; empty commit — verification-only task, no tracked artifacts; observed figures + log paths carried in the message)
2. **Task 2: D-06 ledger — STATE.md canonical section + PROJECT.md re-point + ROADMAP forward pointer** - `48db318` (docs)

## Record Edits (Task 2, D-06)

1. **STATE.md `## Test Baseline Ledger (canonical)`** — inserted after the Phase Status table; both gate lines with "0 failing"/"0 failed", the 3→5 skip declaration with its D-04/D-05 rationale, the invariant determinism line, the 15-row per-run proof table, and the single-source statement superseding STATE 07-01/07-04 665/2/1 + PROJECT 666/2/0 + ROADMAP "666/2/0 + 1 stale".
2. **STATE.md Next Actions item 4** — the test-suite cleanup entry rewritten: all three issues (GNUSControlStorage chainID pollution, Foundry Safe setUp reverts, AccessControlInvariant flake) recorded RESOLVED by Phase 17 (TEST-04/05/06) with a ledger pointer; items 1-3 untouched.
3. **PROJECT.md:11** — now carries both observed figures plus `canonical baselines live in .planning/STATE.md § Test Baseline Ledger`; CI clause retained (CI unchanged per D-07).
4. **ROADMAP.md:64** — one forward-pointer line after the Phase 17 `**Source:**` line; all phase-entry baselines left untouched as the historical phase-start record.

## Verification

- 15 proof logs exist; every test:all log shows mocha 666/2/0 (zero "failing" lines printed, "✓ All tests passed!") and forge `215 tests passed, 0 failed, 5 skipped (220 total tests)`; every invariant log shows `8 tests passed, 0 failed, 0 skipped (8 total tests)`
- Counts identical across all 5 full runs and match the 17-01..17-04 summary records
- `git status --porcelain .github/` empty — zero CI changes (D-07)
- ROADMAP diff is exactly one added line (no baseline-figure edits)
- Bridge node killed and port 8545 clear after the protocol

## Deviations from Plan

### Process Notes

**1. [Process] Task 1 committed as an empty commit**
- **Found during:** Task 1 commit step
- **Issue:** Task 1 is verification-only by design — no source modifications, logs live under /tmp — so there is nothing to stage for the mandated per-task atomic commit
- **Fix:** `git commit --allow-empty` (3ca9f99) records the 15-run protocol, observed counts, skip set, wall times, and log paths durably in history (the /tmp logs are ephemeral)
- **Files modified:** none

No other deviations — plan executed exactly as written; no proof run failed (zero routing events), no count reconciliation needed, no test edits.

## Known Stubs

None — documentation-only plan; every figure in the ledger traces to a /tmp log line from Task 1 (T-17-12 mitigated).

## Phase 17 Exit Evidence (complete)

1. GNUSControlStorage victim green in the FULL suite — 17-01/02/03 + this plan's 5× full-suite proof
2. AccessControlInvariant deterministic — 17-04 + this plan's 10× invariant proof
3. Safe setUp skip arithmetic recorded — 17-04 (D-04/D-05) + ledger
4. New baselines with zero known-stale/failing entries — this plan (ROADMAP criterion 4, D-06/D-07)
