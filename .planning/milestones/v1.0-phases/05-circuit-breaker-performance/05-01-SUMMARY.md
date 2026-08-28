---
phase: 05
plan: 01
status: complete
completed: 2026-07-16
one_liner: Added a diamond-wide emergency pause circuit breaker, merged the dual transfer-hook loops into a single pass, capped binCount with input validation, and closed all 05-REVIEW findings (CR-01..03, CR-04, WR-01..07, IN-01/03) with regression tests
requirements: [SEC-08, PERF-01, PERF-02]
verification: 05-VERIFICATION.md (status: pass — 257/257 unit tests, 16/16 Phase-5-scoped)
key_files:
  created:
    - test/unit/Phase5-circuit-breaker.test.ts (circuit-breaker + review-regression unit tests; 16 Phase-5-scoped cases)
  modified:
    - contracts/gnus-ai/GNUSControlStorage.sol (added diamond-wide `bool paused` flag; removed dead `whenNotPaused` modifier — WR-02)
    - contracts/gnus-ai/GNUSControl.sol (added `emergencyPause`/`emergencyUnpause` gated by `onlySuperAdminRole`; documented `MAX_FEE` fee basis — IN-03)
    - contracts/gnus-ai/GNUSERC1155MaxSupply.sol (merged dual loops into single-pass `_beforeTokenTransfer`; pause gate + limiter one-charge comment — WR-07; removed vestigial `PausableUpgradeable` inheritance — WR-01)
    - contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol (added `MAX_BIN_COUNT` cap; reset bins on binCount change to prevent fund lockout — CR-02)
    - contracts/gnus-ai/GNUSWithdrawLimiter.sol (input validation on `setAccountConfig`: zero-address + binCount bound — CR-02/WR-06)
    - contracts/gnus-ai/GNUSBridge.sol (`bridgeOut` applies limiter for child tokens + emits `SuperAdminBypass` — CR-03; zero-dest validation — IN-01; withdraw limiter one-charge comment — WR-07; fee-basis comment — IN-03)
    - contracts/gnus-ai/ERC20TransferBatch.sol (explicit diamond-pause + banned-transferor gate on batch mint/transfer paths — CR-01; burn branch no longer credits `address(0)` — WR-03)
    - contracts/gnus-ai/GNUSNFTFactory.sol (removed vestigial OZ `pause()`/`unpause()`/`__Pausable_init()` — WR-01)
    - test/unit/GNUSNFTFactoryEnhanced.test.ts (rewrote pause test block to `emergencyPause`/`emergencyUnpause`/`isEmergencyPaused` — WR-01)
---

# Phase 5 Plan 01: Circuit Breaker & Performance — Summary

## What was built

**SEC-08 — Diamond-wide emergency circuit breaker.** Added a `bool paused` flag to `GNUSControlStorage` (diamond storage, appended after `chainID` — no storage displacement). `emergencyPause`/`emergencyUnpause` (both `onlySuperAdminRole`) toggle it. The flag is checked at the single choke point `GNUSERC1155MaxSupply._beforeTokenTransfer`, and — critically — also enforced explicitly in `ERC20TransferBatch._mintBatch`/`_transferBatch`, because those batch entry points declare a same-named but differently-signed `_beforeTokenTransfer` that *shadows* the parent hook rather than overriding it (CR-01). Without the explicit gate, `mintBatch`/`transferBatch`/`transferOrBurnBatch` could move/burn GNUS while paused. The vestigial OpenZeppelin `PausableUpgradeable` system was deleted entirely (WR-01) so there is exactly one pause system.

**PERF-01 — Single-pass transfer hook.** Merged the two sequential `ids[]` loops in `_beforeTokenTransfer` into one pass that aggregates the GNUS amount, checks the banned-transferor set, and enforces max-supply. The limiter is then applied exactly once after the loop.

**PERF-02 — Bin-count cap + validation.** Added `MAX_BIN_COUNT` (256), enforced in both `setDefaultBinCount` and `setAccountConfig`. `setAccountConfig` also gained a zero-address check and the binCount bound (WR-06).

## Review fixes (05-REVIEW)

Beyond the planned scope, the code review surfaced four Critical regressions in the headline security claim, all closed test-first:

- **CR-01** — batch paths shadowed the pause hook → explicit gate added + 3 regression tests.
- **CR-02** — per-account `binCount` change after first withdrawal indexed out of bounds and permanently locked user funds → reset-on-change in `checkAndRecordWithdraw` + validation + 1 regression test.
- **CR-03** — `bridgeOut` of child tokens imposed no rate limit and never emitted the super-admin bypass event → limiter now applied in GNUS-equivalent terms (`amount / exchangeRate`) for `id != GNUS_TOKEN_ID`, with `SuperAdminBypass` emitted for super admin + 2 regression tests.
- **CR-04** — pause test exercised the wrong function → fixed to `emergencyUnpause`.

Warnings WR-01..07 and Info IN-01/IN-03 were also resolved (see 05-REVIEW disposition table). **IN-02 is intentionally deferred** — dropping `indexed` on the `destinations` event argument is an ABI break on the deployed diamond.

## Verification

See `05-VERIFICATION.md` (status: pass). Clean compile (58 files); full unit suite **257 passing**, of which 16 are Phase-5-scoped (7 Emergency Pause + 3 CR-01 batch + 3 Bin Count Cap + 1 CR-02 + 2 CR-03).
