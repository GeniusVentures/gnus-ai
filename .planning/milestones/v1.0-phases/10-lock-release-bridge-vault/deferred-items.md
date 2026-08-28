# Phase 10 — Deferred Items (Out-of-Scope Discoveries)

Discovered during execution but NOT fixed per scope-boundary rules. Each entry
should be picked up by the phase that owns the affected code.

## Plan 10-04

### Pre-existing Safe Wallet Proposer Foundry test failures

- **Discovered during:** Plan 10-04 full-suite verification (`npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --network localhost`).
- **Failing tests:**
  - `test/foundry/unit/SafeDiamondCut.t.sol:SafeDiamondCutTest` — `setUp() (gas: 0)` reverts with `EvmError: Revert`
  - `test/foundry/unit/SafeSingleShotUpgrade.t.sol:SafeSingleShotUpgradeTest` — same `setUp()` revert
- **Verified pre-existing:** Reproduced on HEAD with Plan 10-04 changes stashed — both tests fail identically without any of this plan's modifications.
- **Root-cause ownership:** Phase 08.1 (Safe Wallet Proposer Retrofit). STATE.md "Next Actions" already lists "6 Safe proposer (Phase 08.1 pre-existing)" residual Hardhat-side failures; these two Foundry-side setUp reverts are part of the same cluster.
- **Why not fixed here:** Phase 10-04 only touches `test/foundry/invariant/` and `test/foundry/handlers/GeniusDiamondHandler.sol`. The Safe tests live under `test/foundry/unit/` and do not import any file this plan modifies.
- **Action:** Defer to a Phase 08.1 follow-up sweep. Not blocking for Phase 10 sign-off.
