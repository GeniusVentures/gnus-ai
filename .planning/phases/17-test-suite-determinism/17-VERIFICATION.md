---
phase: 17-test-suite-determinism
verified: 2026-08-31T22:10:07Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
---

# Phase 17: Test-Suite Determinism Verification Report

**Phase Goal:** Eliminate every known non-deterministic or known-stale failure in the gnus-ai suites at the root cause.
**Verified:** 2026-08-31T22:10:07Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Merged from ROADMAP success criteria (non-negotiable) + the five PLAN frontmatters (deduplicated against the SCs).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: GNUSControlStorage "should return initial protocol info" passes in the FULL suite (root fix, no test-side guard) | ✓ VERIFIED | Live verifier-run `yarn test` (full suite, post-review-fix tree): **666 passing / 2 pending / 0 failing**. Test body starts at `const info = await geniusDiamond.protocolInfo();` (test/unit/GNUSControlStorage.test.ts:74) — guard text "normalize it before asserting" gone repo-grep; `ensureDiamondTestBaseline(geniusDiamond, diamondAddress)` at :53 precedes `initialSnapshotId` snapshot at :56; /tmp/17-05-testall-{1..5}.log each show `✔ should return initial protocol info` inside the full alphabetical run with zero "failing" lines |
| 2 | SC2: AccessControlInvariant deterministic across N runs without seed-luck (invariant aligned to handler — D-01; config seeding locked out as unimplementable — D-02) | ✓ VERIFIED | `grep -c "user3" AccessControlInvariant.t.sol` = 0; assertion `_hasRole(UPGRADER_ROLE, attacker)` at :278 with soundness comment; `attacker` never appears in GeniusDiamondHandler.sol (outside `actors`) and no `grantRole.*attacker` in the invariant file; 10 logged consecutive wrapper runs (/tmp/17-05-invariant-{1..10}.log) each 8 passed / 0 failed / 0 skipped; foundry.toml has no `invariant.seed` (D-02 honored) and `fuzz.seed` remains as before — determinism is by construction, not seed-luck |
| 3 | SC3: SafeSingleShotUpgrade + SafeDiamondCut setUp green (recorded per D-04/D-05 as setUp-green-with-declared-skip) | ✓ VERIFIED | `vm.skip(SAFE_PROXY_FACTORY.code.length == 0, "requires sepolia/anvil fork with canonical Safe deployments")` is the first setUp statement in both files (SafeSingleShotUpgrade.t.sol:67, setUp:62; SafeDiamondCut.t.sol:54, setUp:49) behind the 4-line fork-dependency comment; logged full gates (/tmp/17-05-testall-{1..5}.log, /tmp/17-04-forge-full.log) each show `215 tests passed, 0 failed, 5 skipped` with exactly 2 reason-bearing `[SKIP: skipped: requires sepolia/anvil fork...] setUp()` entries — no setUp reverts, no failures |
| 4 | SC4: New baselines recorded with zero known-stale/failing entries | ✓ VERIFIED | `.planning/STATE.md:42` `## Test Baseline Ledger (canonical)` with both gate lines (666/2/0 Hardhat; 215/0/5 Foundry), the 3→5 skip change recorded as DECLARED D-04/D-05 fork-skip (not drift), the 8/0/0 invariant determinism line, and the single-source statement superseding the 665/2/1 vs 666/2/0 vs "666+1 stale" fragmentation; PROJECT.md:11 re-pointed at the ledger (CI clause retained); ROADMAP.md:64 forward pointer only; STATE.md Next Actions item 4 records TEST-04/05/06 RESOLVED |
| 5 | Victim scaffold declares baseline BEFORE initialSnapshotId (17-01) | ✓ VERIFIED | GNUSControlStorage.test.ts baseline call :53 < snapshot :56 |
| 6 | New suites copied from test-template.ts inherit the baseline call (17-01) | ✓ VERIFIED | test-template.ts: `ensureDiamondTestBaseline(` x1 at :128 via `ownerDiamond`, immediately before the `evm_snapshot` at :134 |
| 7 | Every test/unit Tier-A scaffold calls the helper before its first snapshot (17-02) | ✓ VERIFIED | All 13 unit Tier-A files: exactly 1 call each, call line < first snapshot line (verified per-file; e.g. GNUSWithdrawLimiterStorage :89 < :91) |
| 8 | Bridge suites keep 31337 re-alias AFTER the baseline, inside their own snapshot window (17-02) | ✓ VERIFIED | GNUSBridgeIn: baseline :256 < `setChainID(localChainId)` :263 < snapshot :272; GNUSBridgeAttestorIn: :393 < :400 < :410 |
| 9 | Duplicated probe-guard bodies / TREASURY_STORAGE_SLOT constants gone — helper is the single copy (17-02+17-03) | ✓ VERIFIED | `grep -rn "gnus.ai.treasury.storage" test/ --include='*.ts'` minus helper → empty; `GNUSTreasury_SetSeedSupply(0n)` outside foundry → exactly test/unit/GNUSTreasury.test.ts (one-shot spec bodies) + test/utils/diamond-baseline.ts; `seedProvenanceIfNeeded` = 0 in all 4 files that had local fns |
| 10 | The 4 non-unit Tier-A scaffolds (gas, 2x integration, deployment) call the helper before their first snapshot (17-03) | ✓ VERIFIED | gas/withdraw-limiter-gas-comparison :90 < :92; erc1155-transfer-hook-limiter :109 < :111; erc20-transfer-batch-limiter :98 < :100; deployment/GeniusDiamondDeployment `ensureDiamondTestBaseline(ownerDiamond, ...)` :110 < :114. withdraw-limiter-integration baseline :101 < snapshot take :104 (the :54 hit is the `let snapshotId_1` declaration, not a snapshot) |
| 11 | GNUSTreasury.test.ts one-shot test bodies preserved as the specification (17-03) | ✓ VERIFIED | Held at 17-03 time (diff hunks confined to the scaffold region). Post-proof, review fix WR-02 (a469669) deliberately rewrote two pre-seed assertion branches to restore deterministic assertions via `hardhat_setStorageAt` — a documented, reviewed strengthening (17-REVIEW-FIX.md), re-gated 666/2/0 and independently re-verified live by this verifier. Not a weakening; see Anti-Patterns (Info) |
| 12 | 5 consecutive `yarn test:all` runs each 0 failing, identical counts (17-05 / D-06) | ✓ VERIFIED | All 5 logs on disk; each shows mocha 666 passing / 2 pending (zero "failing" lines) + forge 215/0/5; skip-reason count 2 per log. Foundry inputs byte-identical between proof commit 3ca9f99 and HEAD (`git diff 3ca9f99..HEAD -- test/foundry/ foundry.toml lib/ remappings.txt` = empty), so the Foundry half of the proof is valid for the live tree; the Hardhat half was re-run live by this verifier post-WR-01/WR-02 at the same 666/2/0 |
| 13 | 10 consecutive invariant-only wrapper runs green (17-05 / D-06) | ✓ VERIFIED | All 10 logs on disk, each `8 tests passed, 0 failed, 0 skipped (8 total tests)`; log-to-log byte differences are timing lines only |

**Score:** 13/13 truths verified

### Locked Decisions (D-01..D-07) Honored

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 attacker re-target | ✓ | Truth 2 |
| D-02 no `invariant.seed` (locked out) | ✓ | foundry.toml unchanged since phase start; `git diff 0230bfe..HEAD -- foundry.toml` empty |
| D-03 shared baseline helper + full sweep | ✓ | Truths 5-10; helper 67 lines, probe-guarded body in the required order (probe → conditional seed → setChainID(0) → updateBridgeFee(0)), JSDoc pins the ordering contract |
| D-04 vm.skip fork declaration | ✓ | Truth 3 |
| D-05 setUp-green-with-declared-skip recorded, no silent drift | ✓ | 3→5 skip change explicitly encoded in STATE.md ledger + PROJECT.md:11 |
| D-06 N-run proof + single canonical ledger | ✓ | Truths 4, 12, 13 |
| D-07 no CI guard | ✓ | `git diff 0230bfe..HEAD -- .github/` empty |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `test/utils/diamond-baseline.ts` | ensureDiamondTestBaseline + TREASURY_STORAGE_SLOT, min 35 lines | ✓ VERIFIED | 67 lines; both exports; probe lexically guards the only `GNUSTreasury_SetSeedSupply(0n)`; WR-01 hardening (probe via contract runner provider) in place |
| `test/utils/test-template.ts` | baseline call wired before evm_snapshot | ✓ VERIFIED | :128, before snapshot :134 |
| `test/unit/GNUSControlStorage.test.ts` | root fix + guard deleted | ✓ VERIFIED | Baseline :53 pre-snapshot; guard gone; zero-chain-ID edge-case test (:408) intentionally intact |
| 12 unit Tier-A files (17-02) | baseline call each | ✓ VERIFIED | 12/12, exactly 1 call each, correct ordering |
| 13 files (17-03) | folds + non-unit wiring | ✓ VERIFIED | Single-copy grep gates empty; GNUSTreasury imports TREASURY_STORAGE_SLOT from the helper |
| `AccessControlInvariant.t.sol` | `_hasRole(UPGRADER_ROLE, attacker)` | ✓ VERIFIED | :278; zero `user3` |
| `SafeSingleShotUpgrade.t.sol` / `SafeDiamondCut.t.sol` | vm.skip first setUp statement | ✓ VERIFIED | :67 / :54, first statement after comment, no import changes |
| `.planning/STATE.md` | "Test Baseline Ledger" section | ✓ VERIFIED | :42, complete with per-run proof and single-source statement |
| `.planning/PROJECT.md` | re-pointed Test gate line | ✓ VERIFIED | :11 carries both figures + ledger pointer + CI clause |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| GNUSControlStorage.test.ts | diamond-baseline.ts | import + call in before() | ✓ WIRED | Import present; 1 call at :53 |
| diamond-baseline.ts | GNUSTreasury facet (one-shot seed) | eth_getStorageAt(slot+1) probe | ✓ WIRED | Probe via runner provider (WR-01), conditional seed guarded |
| 27 scaffold/template files | diamond-baseline.ts | import + single before()-level call | ✓ WIRED | 27/27 files: 1 call each, none inside any `it(`/`beforeEach(` body (call-position audit per file) |
| GNUSBridgeIn.test.ts | chainID 31337 | setChainID(localChainId) after baseline, before snapshot | ✓ WIRED | :256 < :263 < :272 (and AttestorIn :393 < :400 < :410) |
| AccessControlInvariant.t.sol | GeniusDiamondTestBase.sol | attacker as never-granted subject | ✓ WIRED | `attacker` declared :97, never in handler actors |
| Safe setUps | canonical Sepolia factory | code.length probe gating createProxyWithNonce | ✓ WIRED | vm.skip gates before the factory call in both setUps |
| PROJECT.md | STATE.md | ledger reference | ✓ WIRED | PROJECT.md:11 references "STATE.md § Test Baseline Ledger" |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies test harness/scaffolds and documentation only; no components render dynamic data. The equivalent fourth-level check is the behavioral execution of the suites themselves (see below), which exercises the helper end-to-end in 27 suites.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Hardhat suite green on LIVE tree (post-WR-01/WR-02) | `yarn test` (verifier-executed) | 666 passing / 2 pending, zero failing line | ✓ PASS |
| 5× test:all logs match claimed counts | grep summaries in /tmp/17-05-testall-{1..5}.log | each: 666/2/0 + 215/0/5; 2 reason-bearing skips per log; 0 "failing" lines | ✓ PASS |
| 10× invariant logs match claimed counts | grep summaries in /tmp/17-05-invariant-{1..10}.log | each: 8 passed / 0 failed / 0 skipped | ✓ PASS |
| Victim passes inside full-suite run | grep testall logs | `✔ should return initial protocol info` in full-run output | ✓ PASS |
| Repo-wide fold gate | slot-string + SetSeedSupply greps | empty / exactly 2 files | ✓ PASS |
| Foundry gate validity for live tree | `git diff 3ca9f99..HEAD -- test/foundry/ foundry.toml lib/` | empty — Foundry inputs identical to proof tree; logged 215/0/5 runs apply to HEAD | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventions exist in this repo; the phase's proof protocol is the log-based D-06 evidence above (verifier re-executed the log inspection and the Hardhat half live). N/A — no probe scripts declared by PLAN/SUMMARY.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TEST-04 | 17-01, 17-02, 17-03, 17-05 | GNUSControlStorage victim passes in FULL suite — root fix, no test-side workaround | ✓ SATISFIED | Truths 1, 5-10, 12; REQUIREMENTS.md rows :10, :47 marked Complete/Phase 17 |
| TEST-05 | 17-04, 17-05 | AccessControlInvariant deterministic — invariant aligned to handler | ✓ SATISFIED | Truths 2, 13; rows :11, :48 |
| TEST-06 | 17-04, 17-05 | Safe setUp reverts resolved | ✓ SATISFIED | Truth 3 (declared-skip per D-04/D-05); rows :12, :49 |

Orphaned requirements: none — the traceability table maps exactly TEST-04/05/06 to Phase 17, all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| test/utils/test-template.ts | 172 | `// TODO: Replace 'someFunction' ...` | ℹ️ Info | Pre-existing instructional content of the suite template's example test body — NOT added by this phase (verified: `git diff 0230bfe..HEAD -- test/utils/test-template.ts` contains no TODO additions). No action |
| test/unit/GNUSTreasury.test.ts | :451-:495 region | WR-02 rewrote two pre-seed assertion branches post-proof | ℹ️ Info | Documented review fix (17-REVIEW-FIX.md, commit a469669) restoring deterministic pre-seed assertions via `hardhat_setStorageAt`; re-gated 666/2/0 and re-verified live by this verifier. Deliberate, reviewed, current — not debt |

No TBD/FIXME/XXX markers in any phase-modified file. No empty-return stubs. All 23 task commits (690f7e9..bf3ce38) present on the branch.

### Human Verification Required

None. All criteria were verified programmatically: the verifier independently executed the full Hardhat suite against the live tree (666/2/0), inspected all 15 proof logs, and confirmed the Foundry input tree is byte-identical between the proof commit and HEAD, making the six logged 215/0/5 Foundry gate runs valid for the current tree. A fresh Foundry re-run would require starting a local bridge node and would add no information given input identity.

### Gaps Summary

No gaps. All four ROADMAP success criteria are satisfied with root-cause fixes in the tree, not test-side masks: the TEST-04 guard is deleted and replaced by a 27-scaffold baseline declaration; the TEST-05 invariant subject is provably outside the fuzz grant surface (no seed reliance); the TEST-06 fork dependencies are declared skips with the 3→5 skip arithmetic recorded per D-05; and the canonical ledger in STATE.md carries the observed 666/2/0 + 215/0/5 + 8/0/0 figures with zero known-stale/failing entries. All seven locked decisions (D-01..D-07) were honored, including the locked-out `invariant.seed` (D-02) and the no-CI-guard ruling (D-07).

---

_Verified: 2026-08-31T22:10:07Z_
_Verifier: Claude (gsd-verifier)_
