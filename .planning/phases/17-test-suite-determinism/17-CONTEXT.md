# Phase 17: Test-Suite Determinism - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

## Phase Boundary

Eliminate every known non-deterministic or known-stale failure in the gnus-ai suites at the root cause: TEST-04 (cross-suite pollution breaking GNUSControlStorage in the full suite), TEST-05 (AccessControlInvariant flake), TEST-06 (Safe setUp reverts under `yarn forge:test`) — then record clean baselines with zero known-stale/failing entries. Test-harness-only scope: no production contract code changes, no new dependencies, no CI workflow changes.

## Implementation Decisions

### TEST-05 — AccessControlInvariant determinism
- **D-01:** Re-target the invariant assertion subject from `user3` to `attacker` at `test/foundry/invariant/AccessControlInvariant.t.sol:276`, and fix the stale comment at `:275`. Root cause (verified): `user3` = `actors[3]` sits inside the handler's fuzz grant surface (`roles[3]` = UPGRADER_ROLE per `test/foundry/handlers/GeniusDiamondHandler.sol:85-88, 540-547`), so the invariant can be legitimately violated by the fuzzer. The file's own never-granted convention is `attacker` (`:165, :193`). Sound by construction — satisfies success criterion 2's "invariant aligned to handler" leg.
- **D-02 (rejected alternative, recorded so it is not re-proposed):** Seeding the invariant config is **not implementable** — forge 1.7.1 has no `invariant.seed` config key (`forge config` warns "Found unknown `seed` config key in section `invariant`"), and `fuzz.seed = "0x1234"` (set since commit 007410a, 2025-12-29) provably does not govern invariant campaigns — it was already set six months before the 07-04 flake. Any agent recommending `invariant.seed` must be corrected against this verification.

### TEST-04 — cross-suite pollution sweep
- **D-03:** Full sweep with a shared baseline helper. Add `ensureDiamondTestBaseline()` to the shared test harness — probe-guarded `GNUSTreasury_SetSeedSupply(0n)` + `setChainID(0)` + `updateBridgeFee(0)` — called in every suite's `before()` BEFORE `initialSnapshotId` is taken. Delete the test-side guard at `test/unit/GNUSControlStorage.test.ts:73` (landed in commit f9c2c32; TEST-04 explicitly forbids test-side workarounds). Bridge suites that need chainID=31337 re-alias it AFTER the baseline call, inside their own snapshot window. ~10–12 scaffolds touched; all changes in test harness/scaffolds only.

### TEST-06 — Safe setUp reverts
- **D-04:** Declare the fork dependency with a conditional skip: `vm.skip(SAFE_PROXY_FACTORY.code.length == 0, "requires sepolia/anvil fork with canonical Safe deployments")` at the top of both `setUp()`s — `test/foundry/unit/SafeSingleShotUpgrade.t.sol` and `test/foundry/unit/SafeDiamondCut.t.sol`. Root cause (verified): both setUp()s call the canonical Sepolia Safe v1.3.0 factory (`0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC`), but the forge gate forks from the localhost hardhat bridge node that contains only the locally deployed diamond — no Safe code at those addresses, so the high-level call reverts. The defect is an undeclared fork dependency, now declared.
- **D-05:** Success criterion 3 is recorded as **setUp-green-with-declared-skip**: the gate goes 0-fail (no reverts, no failures) with the skip count rising 3→5, and the tests' real value is preserved in their documented manual fork/anvil flows (`ENCODED_CUT_PATH`). The phase gate record must reflect the new skip count explicitly — no silent baseline drift.

### Determinism proof bar (success criterion 4)
- **D-06:** Local N-run proof + single baseline ledger: N=5 consecutive `yarn test:all` runs + N=10 invariant-only runs, results recorded in the phase record. `STATE.md` becomes the single canonical baseline ledger; `PROJECT.md` and the ROADMAPs are re-pointed at it (collapsing today's 3-way fragmentation: STATE 07-04 = 665/2/1 vs PROJECT.md = 666/2/0 vs ROADMAP = "666/2/0 with 1 known-stale"). Precedent: `security-audit.yml` already points at `.planning/STATE.md` as the committed baseline home.
- **D-07:** No CI determinism guard. CI cannot run the Foundry suite at all (`.github/workflows/tests.yml` deploys against a live localhost node CI does not host), so a CI guard would only repeat-run Hardhat — the suite that never flaked — while doubling CI minutes.

### Claude's Discretion
- Exact shape/location of `ensureDiamondTestBaseline()` within the shared harness (`test/utils/`), provided every suite calls it before `initialSnapshotId` and the probe guards stay idempotent.
- Wording of the corrected `:275` comment and the skip reason strings.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Test infrastructure map
- `.planning/codebase/TESTING.md` — dual-framework map: Hardhat suite organization + `test-template.ts` pattern, Foundry organization (base/handlers/helpers/unit/fuzz/invariant), `foundry.toml` settings, run commands (`yarn test`, `yarn forge:test`, `yarn test:all`, `FOUNDRY_PROFILE=ci`).
- `test/utils/test-template.ts` — the Hardhat suite pattern anchor: `LocalDiamondDeployer.getInstance`, `evm_snapshot`/`evm_revert` isolation, where the baseline hook must slot in.
- `node_modules/@geniusventures/hardhat-diamonds/dist/lib/LocalDiamondDeployer.js` — process-wide static Map caching the diamond keyed by `cutKey(diamondName, networkName, chainId)`; the mechanism that makes all ~28 suites in one `npx hardhat test` process share ONE diamond. Read-only dependency — the fix declares a baseline, it does not change the plugin.

### Recorded root causes (v1.0 STATE decision log)
- `.planning/STATE.md` — 07-04 entries recording the TEST-04/05/06 root causes this phase executes against.
- `.planning/RETROSPECTIVE.md` — the stale-baseline failure mode D-06 exists to prevent recurring.
- `.planning/milestones/v1.0-phases/08.1-safe-wallet-proposer-retrofit-for-diamondcut-proposals/08.1-CONTEXT.md` — D-01/D-02: Foundry fork tests target the live Sepolia diamond (Safe singleton assumed present in forked state); Hardhat unit tests mock the Safe API. The environment assumption behind TEST-06's setUp reverts.

### Test files in scope (targets)
- `test/unit/GNUSControlStorage.test.ts` — `:73` test-side `setChainID(0)` guard to DELETE (commit f9c2c32); the "should return initial protocol info" test that must pass in the FULL suite.
- `test/unit/GNUSBridgeIn.test.ts` — `:272` scaffold calling `setChainID(31337n)` in `before()` before the snapshot (pollution source); `:264` probe-guarded seed guard (pattern to generalize).
- `test/unit/GNUSBridgeAttestorIn.test.ts` `:409`, `test/unit/GNUSBridgeAttestorUpgrade.test.ts` `:244` — the other two bridge scaffolds with the same ordering defect.
- `test/foundry/invariant/AccessControlInvariant.t.sol` — `:275-276` assertion + stale comment (D-01 target); `:165, :193` the `attacker` never-granted convention.
- `test/foundry/handlers/GeniusDiamondHandler.sol` — `:85-88` actors array, `:540-547` `handler_grantRole` — the grant surface the invariant subject must stay outside.
- `test/foundry/unit/SafeSingleShotUpgrade.t.sol`, `test/foundry/unit/SafeDiamondCut.t.sol` — D-04 targets; canonical Sepolia Safe factory `0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC` in setUp.
- `test/foundry/helpers/DiamondDeployment.sol` — auto-generated localhost diamond address the forge gate forks around.
- `foundry.toml` — `invariant = { runs = 5, depth = 10, fail_on_revert = false }`, unseeded by design (D-02); `fuzz.seed = "0x1234"`.

### Existing seed-guard duplicates (pattern precedent for D-03)
- `test/unit/GNUSBridgeEnhanced.test.ts:52-58`, `test/unit/GNUSLicensing.test.ts:179`, `test/unit/GNUSLifecycleAICredits.test.ts:154-162`, `test/unit/GNUSLifecycleUpgrade.test.ts:161-171`, `test/unit/GNUSRedeemAdapter.test.ts:154`, `test/unit/GNUSBridgeIn.test.ts:264` — the probe-then-`GNUSTreasury_SetSeedSupply(0n)` idempotent-seed guards already duplicated in 6 suites; D-03 generalizes this into the shared helper instead of leaving copies.

### CI / gate scope
- `.github/workflows/tests.yml` — header documents the Hardhat-only scope (wrapper needs a live localhost node CI does not host) — basis of D-07.
- `.github/workflows/security-audit.yml` — Phase-7 precedent pointing at `.planning/STATE.md` as the committed baseline ledger — basis of D-06.

## Existing Code Insights

### Reusable Assets
- `evm_snapshot`/`evm_revert` isolation in `test-template.ts`: the baseline call must land before the first snapshot so every revert restores the declared baseline, not inherited mutations.
- The 6 existing probe-guarded seed guards: ready-made bodies to fold into `ensureDiamondTestBaseline()`.
- forge-std `vm.skip(bool, string)` (Foundry 1.7.1): skip inside `setUp()` skips the whole contract — exactly the D-04 mechanism; skips are already an accepted part of the 215/2/3 Foundry baseline.

### Established Patterns
- `LocalDiamondDeployer.getInstance` process-wide singleton: by design across ~28 suites — the constraint that makes baseline declaration (not plugin change) the only sane fix.
- Alphabetical suite glob order (no `.mocharc`): GNUSBridge* always precedes GNUSControlStorage, making the pollution deterministic-but-wrong — a stable property tests can rely on post-fix.
- Foundry gate = `yarn forge:test` via the hardhat bridge node; bare `forge test` is invalid ("Diamond has no code" + 26+ setUp artifacts) — never verify with it.

### Integration Points
- `yarn test` (Hardhat), `yarn forge:test` (Foundry via bridge node), `yarn test:all` (both) — the commands the N-run proof (D-06) uses.
- Phase record / STATE.md baseline ledger — where the new clean baselines land (criterion 4).

## Specific Ideas

- The full-suite order dependency is the spec: TEST-04's test must pass under plain `npx hardhat test` (all suites, one process, alphabetical order), not just in isolation.
- Bridge suites keep their 31337 aliasing behavior — they must re-establish it after the baseline call so their own tests are unaffected; only the inherited-state leak dies.
- Skip counts are part of the recorded baseline, not noise: 3→5 in the Foundry gate is expected and must be written down (D-05).

## Deferred Ideas

- **Fork CI job for the Foundry Safe tests** — would make SafeSingleShotUpgrade/SafeDiamondCut actually run in CI; requires a `SEPOLIA_RPC` secret and an owner ruling. Out of phase scope; revisit if the team wants the Safe flows continuously proven.
- **Self-contained Safe setUp** (deploy a real Safe singleton+factory locally) — only if the team later mandates the Safe flow proven in the default gate AND accepts a new solc-0.7.6/OZ-3.x dependency plus unpinning `solc_version = "0.8.19"`. Blocked today: `@safe-global/safe-deployments` ships ABI+addresses, no bytecode; and it still could not green `SafeSingleShotUpgrade` (inherently live-fork assertions; Sepolia baseline permanently stale since 08.2 executed the v2.5 upgrade).
- **Foundry upgrade for `invariant.seed`** — only worth revisiting if config-level invariant seeding is ever genuinely needed; D-01 removes the need.
- **`.mocharc` explicit suite ordering** — unnecessary once every suite declares its own baseline; not pursued.

---

*Phase: 17-Test-Suite Determinism*
*Context gathered: 2026-08-31*
