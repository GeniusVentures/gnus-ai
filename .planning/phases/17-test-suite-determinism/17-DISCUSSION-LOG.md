# Phase 17: Test-Suite Determinism - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 17-Test-Suite Determinism
**Areas discussed:** TEST-05 approach, TEST-04 sweep depth, TEST-06 Safe setUp strategy, Determinism proof bar

---

## TEST-05 approach

| Option | Description | Selected |
|--------|-------------|----------|
| Re-target to attacker | Change the :276 assertion subject from `user3` to `attacker` (the file's own never-granted convention at :165/:193), fix the stale :275 comment. Sound by construction — `user3` = `actors[3]` is inside the handler's fuzz grant surface (`roles[3]` = UPGRADER_ROLE). Satisfies criterion 2's "aligned to handler" leg. | ✓ |
| Seed the invariant config | PROVEN NON-IMPLEMENTABLE on forge 1.7.1 — no `invariant.seed` key exists (unknown-config warning); `fuzz.seed` never governed invariants (set since 007410a, 2025-12-29, six months before the 07-04 flake). Only viable after a Foundry upgrade, out of phase scope. | |

**User's choice:** Re-target to attacker (recommended option)
**Notes:** Advisor research cross-checked the proof-bar agent's `invariant.seed` recommendation against the TEST-05 agent's empirical `forge config` verification — the seed recommendation was dropped as unimplementable rather than offered as an option.

---

## TEST-04 sweep depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full sweep with shared baseline | `ensureDiamondTestBaseline()` (probe-guarded `GNUSTreasury_SetSeedSupply(0n)` + `setChainID(0)` + `updateBridgeFee(0)`) in every suite's `before()` before `initialSnapshotId`; delete the `:73` test-side guard (commit f9c2c32); bridge suites re-alias 31337 after. ~10–12 scaffolds, harness-only. Kills all three pollution vectors. | ✓ |
| Narrow fix only | Just the idempotent shared initializer + `:73` guard removal. Smaller diff but leaves the `updateBridgeFee` pollution vector — later suites still inherit undeclared state. | |

**User's choice:** Full sweep with shared baseline (recommended option)
**Notes:** Root cause verified: `LocalDiamondDeployer.getInstance` caches the diamond in a process-wide static Map → all ~28 suites in one `npx hardhat test` process share ONE diamond; three bridge scaffolds call `setChainID(31337n)` in `before()` before the snapshot, so `after()` reverts to the post-mutation snapshot. Alphabetical glob order makes it deterministic-but-wrong, not flaky.

---

## TEST-06 Safe setUp strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fork-gate with vm.skip | `vm.skip(SAFE_PROXY_FACTORY.code.length == 0, ...)` atop both `setUp()`s — declares the fork dependency (canonical Sepolia Safe v1.3.0 factory `0xC228...` has no code on the localhost bridge fork), gate goes 0-fail. Tests SKIP (not pass) in the default gate (skips 3→5); real runs stay in the documented manual fork flows. Criterion recorded as setUp-green-with-declared-skip. | ✓ |
| Self-contained Safe setUp | Deploy a real Safe locally so SafeDiamondCut truly passes — requires a new solc-0.7.6/OZ-3.x dependency (`@safe-global/safe-deployments` ships ABI+addresses, no bytecode), unpinning `solc_version = "0.8.19"`, and still cannot green SafeSingleShotUpgrade (inherently live-fork assertions; Sepolia baseline permanently stale since 08.2 executed the v2.5 upgrade). | |

**User's choice:** Fork-gate with vm.skip (recommended option)
**Notes:** Explicit trade-off accepted: tests skip rather than pass in the default gate, with the skip count recorded in the phase gate record (3→5) so the baseline does not silently drift.

---

## Determinism proof bar

| Option | Description | Selected |
|--------|-------------|----------|
| Local N-run + STATE ledger | N=5 `yarn test:all` + N=10 invariant-only runs recorded in the phase record; STATE.md becomes the single canonical baseline ledger with PROJECT.md/ROADMAP re-pointed to it (collapses 665/2/1 vs 666/2/0 vs "666/2/0 + 1 stale" fragmentation). Precedent: security-audit.yml already points at STATE.md. | ✓ |
| CI determinism guard | Repeat-run the suite in CI — but CI cannot run Foundry at all (tests.yml: no hosted localhost node), so it only repeats Hardhat (never flaked) and doubles CI minutes. Rejected by research; listed for completeness. | |

**User's choice:** Local N-run + STATE ledger (recommended option)
**Notes:** The `invariant.seed` line this area's researcher recommended was dropped in synthesis — superseded by the TEST-05 agent's proof that the key doesn't exist on forge 1.7.1. Determinism rests on the D-01 soundness fix instead.

---

## Claude's Discretion

- Exact shape/location of `ensureDiamondTestBaseline()` within `test/utils/`, provided every suite calls it before `initialSnapshotId` and the probe guards stay idempotent.
- Wording of the corrected `:275` comment and the `vm.skip` reason strings.

## Deferred Ideas

- Fork CI job for the Foundry Safe tests — needs `SEPOLIA_RPC` secret + owner ruling; out of phase scope.
- Self-contained Safe setUp — revisit only if the team mandates the Safe flow proven in the default gate AND accepts the solc-0.7.6/OZ-3.x dependency.
- Foundry upgrade for `invariant.seed` — need removed by D-01.
- `.mocharc` explicit suite ordering — unnecessary once every suite declares its own baseline.
