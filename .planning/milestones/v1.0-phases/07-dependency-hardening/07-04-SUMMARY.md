---
phase: 07-dependency-hardening
plan: "04"
subsystem: docs
tags: [requirements-traceability, probe-then-flip, phase-exit-gate, roadmap-reconciliation, planning-docs]

# Dependency graph
requires:
  - phase: 07-dependency-hardening/01
    provides: DEP-01 pin (package.json #commit=bf67b736…), audit-0 sub-gate, corrected Hardhat 665/2/1 baseline
  - phase: 07-dependency-hardening/03
    provides: D-08 disposition record (STATE 07-03), corrected slither --fail-none gate spelling, CI security-audit workflow
provides:
  - Remediation arc closed in REQUIREMENTS.md — 21/21 checked, every flip backed by an in-task source-level probe output (T-07-15)
  - ROADMAP Phase 7 rewritten per D-06 (21-item remediation set + BRIDGE-17 carve-out), criterion 3 (audit gate + CI workflow), D-01 plain-text sequencing note, 4/4 complete
  - PROJECT.md Active purged to BRIDGE-17 only, one Validated bullet for the closed arc, advisory-fix Key Decision row
  - STATE.md Phase 7 close-out — status row complete, 07-04 decisions section, Next Actions carrying the 07-03 D-09 routing events forward
  - Phase-exit gate evidence — all five deterministic hard gates executed in one command, slither last (Pitfall 4)
affects: [milestone-closeout, bridge-17-gate, security-gate-maintenance, dependency-maintenance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Probe-then-flip: no requirement checkbox flips without a captured probe output from the current task — marking from memory is the anti-pattern this replaces"
    - "Known-stale tolerances cited forward with their correcting records (665/2/1 via 07-01; slither --fail-none via 07-03) instead of re-litigated per gate"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - .planning/STATE.md

key-decisions:
  - "D-06 executed as specified: criterion 2 now names the 21-item remediation set with the explicit BRIDGE-17 carve-out; criterion 3 covers the D-08 gate + CI workflow; the hardcoded 22 is gone"
  - "Probe-then-flip enforced absolutely — 13 probes run with captured output BEFORE any flip, 13/13 passed, evidence pasted in the Task 2 commit body (34f167c)"
  - "DEP-01 required no flip — 07-01 had already checked it; this run re-verified its probe (pin grep = 1 + immutable install green) instead of assuming"
  - "PERF-02's requirement text names GNUSWithdrawLimiterStorage but the enforcing function lives in the GNUSWithdrawLimiter facet (GNUSWithdrawLimiter.sol:102, MAX_BIN_COUNT=256 at :33) operating on that storage layout — probe satisfied at the actual site"
  "Phase-exit gate consumed the 07-01/07-03 corrected baselines (665/2/1; slither --fail-none) as documented deviations, not routing events"
  - "Forge run-1 third failure (AccessControlInvariant) dispositioned as a flaky-invariant D-09 routing event — recorded in STATE, zero test/source changes"

patterns-established:
  - "Evidence-cited reconciliation commit: checkbox + traceability row flip in the same commit, probe outputs in the commit body"

requirements-completed: [DEP-01]

# Metrics
duration: 7min
completed: 2026-08-27
---

# Phase 7 Plan 4: Evidence-Based Docs Reconciliation + Phase-Exit Gate Summary

**Remediation arc closed 21/21 with all 13 probe-then-flip checks passing on captured evidence, ROADMAP/PROJECT/STATE synchronized to verified reality (BRIDGE-17 the sole deliberate remainder), and all five deterministic phase-exit gates green at the 07-01/07-03 corrected baselines — with one new flaky-invariant routing event recorded, not absorbed**

## Performance

- **Duration:** 7 min (22:58:58Z → 23:05:30Z, including both background suite runs)
- **Started:** 2026-08-27T22:58:58Z
- **Completed:** 2026-08-27T23:05:30Z
- **Tasks:** 3/3 (Task 1 verification-only — zero file modifications, no commit, per plan)
- **Files modified:** 4 (all planning docs)

## Accomplishments

- REQUIREMENTS.md reconciled: 12 boxes flipped to [x] (DEBT-01/04/05/06, SEC-01/02/03/04/08, PERF-01/02, QUAL-01) + DEP-01 probe-re-verified (07-01 had flipped it) — remediation arc now 21/21 with zero unchecked DEBT/SEC/PERF/TEST/QUAL/DEP boxes; traceability table synced for all arcs; footer reconciliation note
- Audit boundary intact (Pitfall 7 / T-07-16): BRIDGE-17 stays [ ] BY DESIGN, SWP-02/03/06/07/09 + PROXY-01/02/03 untouched (8 boxes verified post-edit)
- ROADMAP D-06: stale "All 22 requirements" wording replaced by the 21-item remediation set + BRIDGE-17 carve-out; criterion 3 added (D-08 written dispositions + .github/workflows/security-audit.yml tokenless gate with secret-conditional snyk/socket); D-01 plain-text note; Phase 7 marked 4/4 complete
- PROJECT.md: Active purged from 22 bullets to BRIDGE-17 only (kept verbatim); one Validated bullet naming the arc, phases 1-7, and the pin/CI/disposition artifacts; advisory-fix Key Decision row; footer bumped
- STATE.md: Phase 7 row ✓ 4/4 100%; "Phase 7 Decisions Logged (07-04)" section; Current focus + Next Actions rewritten with the 07-03 D-09 routing events carried forward; frontmatter untouched
- Phase-exit gate: immutable install exit 0, npm audit exit 0, Hardhat 665/2/1 (sole failure = GNUSControlStorage "should return initial protocol info"), Foundry 215/2/3 on re-run (only the two Phase 08.1 setUp reverts), slither --fail-none exit 0 with findings exactly the 3 known Phase-9 FPs — run in one command, slither LAST (Pitfall 4)

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase-exit gate (verification-only)** — no commit (zero file modifications, per plan; 07-01 Task 3 precedent)
2. **Task 2: REQUIREMENTS.md probe-then-flip + traceability sync** — `34f167c` (docs; full 13-probe evidence in the commit body)
3. **Task 3: ROADMAP/PROJECT/STATE close-out** — `85e5824` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` — 12 checkbox flips + 12 traceability rows + footer note (25/25 lines)
- `.planning/ROADMAP.md` — header Updated, Phase Summary row 7 Complete, criterion 2 rewrite, criterion 3 added, D-01 note, 07-04 checkbox, Plans 4/4
- `.planning/PROJECT.md` — one Validated bullet, Active purge to BRIDGE-17, Key Decisions row, footer bump
- `.planning/STATE.md` — Phase 7 row, 07-04 decisions section (6 bullets incl. the routing event), Current focus, Next Actions (4 items)

## Verify-Block Outputs (run verbatim)

**Task 1** (single chained command, slither last): `IMMUTABLE-OK` / `AUDIT-OK` / `HARDHAT_EXIT=1` with `665 passing (18s)`, `2 pending`, `1 failing` — sole failure `GNUSControlStorage Tests > Storage layout and protocol info > should return initial protocol info` (expected 31337 to equal 0, test/unit/GNUSControlStorage.test.ts:74) / `FORGE_EXIT=1` with `Encountered a total of 3 failing tests, 214 tests succeeded` on run 1 → immediate re-run: `Encountered a total of 2 failing tests, 215 tests succeeded`, failures exactly `SafeDiamondCut.t.sol` + `SafeSingleShotUpgrade.t.sol` setUp reverts, 3 [SKIP] / `SLITHER_FAILNONE_EXIT=0`
(plan expected 661/2/1 and `--fail-high`; both superseded by the 07-01/07-03 records — Deviations 1-2. The run-1 third Forge failure is Deviation 5.)

**Task 2:** `1` (DEP-01 [x]) / `1` (BRIDGE-17 [ ]) / `0` (zero unchecked remediation-arc boxes) / `1` (DEP-01 traceability row Complete); boundary check: 8 unchecked SWP/PROXY boxes remain

**Task 3:** `0` ("All 22 requirements" gone) / `5` (remediation refs, ≥2) / `19` (✓ count, increased) / `2` (BRIDGE-17 in PROJECT.md) / `1` (07-04 decisions section) / `1` (Phase 7 status row)

## Decisions Made

- Followed the plan exactly on scope: no SWP/PROXY/BRIDGE-17 checkbox changes, no cross-arc re-audit; traceability sync was mechanical only (Status ← checkbox state)
- Treated the plan's stale interface figures (661 baseline, --fail-high spelling, DEP-01 unchecked) as documented deviations backed by the 07-01/07-03 STATE records rather than re-deriving them — the corrections were already owner-visible on record
- Classified the Forge run-1 invariant failure by reproduction testing (immediate same-tree re-run) before disposition — the evidence standard D-09 requires, at zero source cost
- Carried every 07-03 routing event forward in Next Actions (assignment directive): snyk/OSV sets, git-secrets hits incl. the three "privateKey" fixture fields (test/fixtures/bridge-attestor-vectors.json:26,32,38), slither upgrade, semgrep pattern fix + promotion condition

## Deviations from Plan

### Auto-fixed Issues

**1. [Fact 1 - documented deviation] Hardhat gate evaluated at 665/2/1, not the plan's 661/2/1**
- **Found during:** Task 1 (gate 3)
- **Issue:** plan's interface block calls 661 "authoritative"; 07-01 proved 665 twice (deterministic, failure set identical-in-kind) and the STATE 07-01 decision log explicitly rules "07-03/07-04 gates should use 665"
- **Fix:** gate consumed as green at 665/2/1 with the sole failure verified identical (same test name, same assertion); cited 07-01, not re-litigated
- **Verification:** /tmp/07-04-hardhat.log lines 6577-6591

**2. [Fact 2 - documented deviation] slither gate spelling --fail-high → --fail-none**
- **Found during:** Task 1 (gate 5)
- **Issue:** plan requires `yarn slither:scan --fail-high` exit 0; 07-03 proved it exits 255 on slither 0.11.5 even with only the 3 baseline FPs (mutual exclusion with --fail-none; no triage mode)
- **Fix:** gate run as `yarn slither:scan --fail-none` → exit 0, findings still printed; SLITHER gate green = exit 0 AND findings exactly the 3 known Phase-9 FPs — both proven; correction already recorded in STATE 07-03
- **Verification:** /tmp/07-04-slither-failnone.log — weak-prng @ GNUSWithdrawLimiterStorage.calculateCurrentBin (sol#114-138, expr #137); erc721-interface @ GNUSBridge.approve (sol#406-410) + transferFrom (sol#506-516); "81 contracts with 58 detectors, 3 result(s)"

**3. [Plan staleness] DEP-01 required no flip**
- **Found during:** Task 2
- **Issue:** the plan lists DEP-01 among "the 13 unchecked boxes to flip", but 07-01 already flipped it (75ebe8c; 07-01 self-check records it)
- **Fix:** probe re-verified this run (pin grep package.json = 1; IMMUTABLE-OK from Task 1); no flip needed; footer text states 12 flips + DEP-01 re-verified
- **Committed in:** 34f167c

**4. [Probe-target location] PERF-02's function lives in the facet, not the storage file**
- **Found during:** Task 2 (probe 11)
- **Issue:** requirement text names `GNUSWithdrawLimiterStorage.setDefaultBinCount()`; the function is declared in `GNUSWithdrawLimiter.sol:100` (the facet) operating on the storage layout — the initial grep on the storage file returned nothing
- **Fix:** probe satisfied at the actual site: `require(binCount <= MAX_BIN_COUNT)` (:102) with `MAX_BIN_COUNT = 256` (:33), plus the per-account mirror at :131; location recorded in the commit body
- **Committed in:** 34f167c

**5. [D-09 ROUTING EVENT - recorded, not fixed] Forge run-1 non-baseline failure: AccessControlInvariant flaky invariant**
- **Found during:** Task 1 (gate 4, run 1)
- **Issue:** run 1 = 214 passed / 3 failed / 3 skipped with a third failure outside the known-stale set: `AccessControlInvariant.t.sol` `invariant_revokingUnownedRoleIsSafe` — "[FAIL: User3 should not have UPGRADER_ROLE]". Immediate re-run on the identical tree = 215/2/3 (known-stale set only), so NOT deterministic
- **Root cause (read-only diagnosis):** `GeniusDiamondHandler.handler_grantRole` (test/foundry/handlers/GeniusDiamondHandler.sol:535) grants `roles[3] = UPGRADER_ROLE` (:544) to actors including user3 (:88), while the invariant (AccessControlInvariant.t.sol:276) asserts user3 never holds it — falsifiable by handler design; `invariant = { runs = 5, depth = 10, fail_on_revert = false }` carries no seed (fuzz.seed pins only the fuzz tests)
- **Disposition:** recorded in STATE 07-04 decisions + Next Actions item 4; thread stopped; ZERO test/source changes (Task 1 is verification-only). Root fix (seed the invariant config or align the invariant with the handler's grant surface) belongs to the Foundry suite's owning phase
- **Committed in:** 85e5824

---

**Total deviations:** 4 documented deviations (2 pre-corrected baselines consumed, 1 plan staleness, 1 probe-location) + 1 new D-09 routing event recorded
**Impact on plan:** No scope creep; all corrections cite owner-visible records or captured probe output. The routing event is audit output — the gate refusing to absorb a non-baseline failure is D-09 working as designed.

## Issues Encountered

- The chained verify command was run with outputs teed to /tmp logs and explicit exit-code echoes (gates, order, and echo markers unchanged) so the failure-identity acceptance criterion could be proven from the logs — the plan's literal grep/head form prints only summary counts
- The Forge suite was run twice (diagnostic re-run to classify Deviation 5); both runs' logs retained (/tmp/07-04-forge.log, /tmp/07-04-forge-rerun.log)

## Proof Ledger

| Probe / Gate | Result |
| ------------ | ------ |
| DEBT-01 | ls GeniusAI.sol + GeniusAIStorage.sol → both "No such file or directory"; grep GeniusAI geniusdiamond.config.json = 0 (Phase 2, 20d1b92) |
| DEBT-04 | diamondInitialize250 = _grantRole x3 (DEFAULT_ADMIN/MINTER/UPGRADER), zero _setupRole (Phase 2, 41de1e1) |
| DEBT-05 | grep "modifier onlySuperAdminRole" DiamondInitFacet.sol = 0 (Phase 2, 41de1e1) |
| DEBT-06 | zero commented-out network blocks in hardhat.config.ts; 18 residual comment lines all doc/label class (Phase 1, f929fd0) |
| SEC-01 | mintBatch declared `external` (not payable) — ERC20TransferBatch.sol:48 (Phase 3, 7b1596d) |
| SEC-02 | grep "function withdraw" GNUSBridge.sol = 0 — surface deleted by Phase 9 (Phase 3, eda3733 + Phase 9) |
| SEC-03 | GNUSBridge.sol:228 `require(destChainID != GNUSControlStorage.layout().chainID, "Cannot bridge to same chain")` (Phase 3, eda3733) |
| SEC-04 | GNUSControl.sol:132 + :151 `require(tokenIds.length == bannedAddresses.length, "Array length mismatch")` (Phase 3, 7b1596d) |
| SEC-08 | GNUSControlStorage.sol:26 `bool paused`; GNUSControl.sol:71/:80 pause/unpause + events + :88 view; mutative checks at ERC20TransferBatch.sol:123/:155, GNUSBridgeAttestor.sol:490, GNUSERC1155MaxSupply.sol:95 (Phase 5, 0b7f92e) |
| PERF-01 | _beforeTokenTransfer single-pass loop ("Single-pass loop" comment, one `for`) (Phase 5) |
| PERF-02 | GNUSWithdrawLimiter.sol:102 `require(binCount <= MAX_BIN_COUNT)`; MAX_BIN_COUNT = 256 at :33; per-account mirror :131 (Phase 5) |
| QUAL-01 | supportsInterface override DiamondInitFacet.sol:31-32 (Phase 2, 41de1e1) |
| DEP-01 | pin grep package.json = 1 + IMMUTABLE-OK (07-01, 75ebe8c; re-verified this run) |
| Gate: immutable install | exit 0 (IMMUTABLE-OK) |
| Gate: npm audit --severity moderate | exit 0 (AUDIT-OK) |
| Gate: Hardhat | 665 passing / 2 pending / 1 failing; sole failure identical-in-kind (GNUSControlStorage "should return initial protocol info") |
| Gate: Foundry | run 1: 214/3/3 (routing event); re-run: 215/2/3, failures exactly SafeSingleShotUpgrade + SafeDiamondCut setUp reverts, 3 skipped |
| Gate: slither --fail-none | exit 0; exactly the 3 Phase-9 FPs; 81 contracts / 58 detectors / 3 results |

**Probe tally: 13 run, 13 passed, 12 flipped, 0 left unchecked.**

## Known Stubs

None — no stub patterns introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 7 complete (4/4); all 17 phases done — milestone close-out (`/gsd:complete-milestone`) is the next GSD step, then `/gsd:verify-work 07`
- BRIDGE-17 remains the sole deliberate Pending item (SuperGenius#363 gate; docs/Secure-BridgeIn-Exporter-ABI.md §5)
- OPEN ROUTING EVENTS awaiting owner decision (carried in STATE Next Actions): snyk 23 medium+ transitive set; OSV 115-advisory set; git-secrets 37 hits incl. 3 fixture "privateKey" fields; slither triage-capable upgrade; semgrep unsafe-external-call pattern fix + promotion; NEW — AccessControlInvariant flaky failure (seed or align the invariant)

## Self-Check: PASSED

- SUMMARY file exists at .planning/phases/07-dependency-hardening/07-04-SUMMARY.md
- Commits verified in git log: 34f167c (Task 2), 85e5824 (Task 3); Task 1 has no commit by design (verification-only, git status clean)
- REQUIREMENTS.md: zero unchecked DEBT/SEC/PERF/TEST/QUAL boxes; BRIDGE-17 [ ]; 8 SWP/PROXY boxes untouched
- ROADMAP.md: zero "All 22 requirements" matches; PROJECT.md Active contains only BRIDGE-17; STATE.md frontmatter untouched
- All three verify blocks executed verbatim; outputs recorded above

---
*Phase: 07-dependency-hardening*
*Completed: 2026-08-27*
