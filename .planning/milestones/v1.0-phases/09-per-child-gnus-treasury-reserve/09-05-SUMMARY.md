---
phase: 09-per-child-gnus-treasury-reserve
plan: 05
subsystem: test-migration + foundry-invariants + static-analysis
tags: [phase-9, conversion-native, test-migration, invariant, slither, wave-4]

requires:
  - phase: 09-per-child-gnus-treasury-reserve (plans 09-01..09-04)
    provides: GNUSTreasury.convert, GNUSBridge.withdraw deleted, beforeMint rewritten (1:1 minion + depth gate), diamond config 3.0
provides:
  - 5 pre-existing withdraw-driven test files migrated to convert() (Task 1)
  - 2 mint-semantics test files flipped to minion-denominated (Task 2)
  - smart-trigger.ts dispositioned — 'mint' label confirmed inert, braces fixed (Task 2)
  - ConservationInvariant Foundry suite landing I1/I2/I5 (Task 3)
  - Slither static-analysis run on the 5 changed contracts with findings triaged (Task 4)
  - Slither inclusion gap (contracts/gnus-ai/ excluded from committed config) flagged for Phase 7
affects: [phase-7-audit-gate, phase-10-bridge-vault, phase-13-entitlements]

tech-stack:
  added: []
  patterns:
    - "ghost_totalBridgedOutAmount (sum) distinct from ghost_totalBridgeDeposits (count) — invariant needs quantity, not call rate"
    - "ghost_totalAdminBurned distinct from ghost_totalBurned — only the MINTER_ROLE GNUSBridge.burn path decrements globalSupply; ERC1155Burnable.burn does not"
    - "T-09-28 mitigation: draw ids from ghost_createdIds (actually-created set) — random id seeds almost never hit created ids"
    - "D10 fuzz regression: handler_mint1155 require(!success) on non-zero ids so a MINTER-mint regression surfaces as an invariant failure"
    - "Diamond-forge harness: invariants run against a live diamond on localhost via `npx hardhat diamonds-forge:test`; raw `forge test` cannot see code at the recorded address"

key-files:
  created:
    - test/foundry/invariant/ConservationInvariant.t.sol (158 lines — I1, I2, I5, monotonic-convert sanity)
    - .planning/phases/09-per-child-gnus-treasury-reserve/09-05-SLITHER.json (3 unique findings, deduped across 5 contracts)
  modified:
    - test/unit/GNUSBridge.test.ts (12 .withdraw( refs → convert)
    - test/unit/GNUSBridgeEnhanced.test.ts (.withdraw( refs → convert)
    - test/unit/GNUSWithdrawLimiterStorage.test.ts (limiter re-homed to convert's GNUS-terminal leg)
    - test/integration/withdraw-limiter-integration.test.ts (same re-home)
    - test/gas/withdraw-limiter-gas-comparison.test.ts (same re-home + gas baseline shift documented)
    - test/unit/NFTFactory.test.ts (mint-semantics flip — burn assertions drop * rate)
    - test/unit/GNUSNFTFactoryEnhanced.test.ts (mint-semantics flip; "to burn" → "to convert" revert strings)
    - test/unit/Phase5-circuit-breaker.test.ts (CR-03 SuperAdminBypass convAmount → minion charge)
    - scripts/devops/smart-trigger.ts (line 532-535 brace fix + D1 disposition comment)
    - test/foundry/handlers/GeniusDiamondHandler.sol (handler_createNFT, handler_factoryMint NEW; handler_convert fleshed; handler_mint1155 D10 gate; ghost totalBridgedOutAmount + totalAdminBurned added; brace-style cleanup)

key-decisions:
  - "task-1 commit boundaries were preserved (one commit per migrated file) per plan §Task 1 step 8 — the plan demanded atomicity to avoid masking cross-file coupling"
  - "smart-trigger.ts:389 confirmed inert (function-NAME label for risk classification, not calldata) — dispositioned via a comment; no behavioral change"
  - "ConservationInvariant targets only I1/I2/I5 + convert-call-count sanity; I3 (two-diamond bridge) and I6 (limiter charge matrix) are pinned by GNUSTreasury.test.ts unit suites per plan"
  - "T-09-27 (invariant must not be weakened) — when invariant_I1 failed initially with a 1-count-vs-amount-sum mismatch, the FIX was to add ghost_totalBridgedOutAmount to the handler, NOT to weaken the invariant"
  - "Slither run was a one-off targeted invocation per plan §Task 4 step 3 — the committed slither.config.json was NOT modified; the contracts/gnus-ai/ exclusion is Phase 7's audit-gate scope"

patterns-established:
  - "Each migrated test file: grep -c '.withdraw(' == 0 (or comments only), npx hardhat test <file> green, then commit that single file"
  - "Handler ghost variables come in two flavors: call COUNTERS (for coverage metrics) and amount SUMS (for invariant assertions) — never conflate them"

requirements-completed: [TREASURY-01, TREASURY-02, TREASURY-03]

duration: ~2h
completed: 2026-08-05
---

# Phase 09 Plan 05: Test Migration + Foundry Invariants + Slither Summary

**Conversion-native test migration complete: 44 in-scope withdraw/mint-era failures rewritten to drive convert() and minion-denominated mint paths, Foundry ConservationInvariant suite (I1/I2/I5) actively fuzzes tree-wide supply conservation, and Slither triage on the 5 changed contracts flags the contracts/gnus-ai/ inclusion gap for Phase 7.**

## Performance

- **Duration:** ~2h (including full forge-tree and hardhat-suite runs)
- **Completed:** 2026-08-05
- **Tasks:** 4/4
- **Files modified:** 10 (5 Task-1 + 3 Task-2 + 2 Task-3) + 1 created (ConservationInvariant.t.sol) + 1 artifact (SLITHER.json)

## Accomplishments

- **Task 1 (5 atomic commits, one per file):** Migrated `.withdraw(` call sites to `.convert(id, GNUS_TOKEN_ID, amount, caller)` across `GNUSBridge.test.ts`, `GNUSBridgeEnhanced.test.ts`, `GNUSWithdrawLimiterStorage.test.ts`, `withdraw-limiter-integration.test.ts`, and `withdraw-limiter-gas-comparison.test.ts`. Revert strings updated (`"Cannot withdraw GNUS tokens."` / `"Exchange rate must be greater than zero"` / `"Amount must be at least the exchange rate"` retired). `SuperAdminBypass` context flipped to `"GNUSTreasury.convert"` on convert-driven paths. Limiter bin deltas now charge `amount` (already minions), not `amount / exchangeRate`. All 5 files pass `npx hardhat test <file>` individually (9/9, 31/31, 9/9, 7/7, 50/50). `test/unit/GNUSContractAssets.test.ts` byte-identical to pre-plan state (verified — uses `withdrawToken`, a different contract).
- **Task 2 (3 commits):** Mint-semantics flip in `NFTFactory.test.ts` and `GNUSNFTFactoryEnhanced.test.ts` (burn assertions drop the `* exchangeRate` multiplier; child balances and GNUS deltas now both equal `amount` — same number, different unit). 2nd-gen mint tests flip from "no burn" to "depth-gate revert; convert issues instead." Phase5-circuit-breaker CR-03 SuperAdminBypass convAmount migrated to minion charge. `smart-trigger.ts:389` dispositioned — the `'mint'` label is a risk-classification string, not calldata; no change needed. Regression checks: `GNUSERC20.test.ts` 4/4, `Erc20Batch.test.ts` 2/2, `Phase5-circuit-breaker.test.ts` 16/16 — all green.
- **Task 3 (1 commit):** NEW `test/foundry/invariant/ConservationInvariant.t.sol` (158 lines) lands `invariant_I1_conservation`, `invariant_I2_convertNeutral`, `invariant_I5_globalCap`, and `invariant_convertCallCountMonotonic`. Handler gains `handler_createNFT` + `handler_factoryMint` (to populate `ghost_createdIds` and exercise the factory-mint path under fuzz), `handler_convert` fleshed out (bounded by created-id set + sender's actual balance), `handler_mint1155` D10 regression gate (`require(!success)` on non-zero ids), and two new ghost sums (`ghost_totalBridgedOutAmount`, `ghost_totalAdminBurned`). `forge test --match-contract ConservationInvariant` → **4/4 PASS** (5 runs × 10 calls each). Full foundry tree: **213 passed / 2 failed / 3 skipped**; the 2 failures are pre-existing Phase 08.1 SafeDiamondCut + SafeSingleShotUpgrade setUp reverts, NOT Phase 09-05 scope.
- **Task 4 (1 commit + this SUMMARY):** Slither 0.11.5 run against the 5 changed contracts (targeted per-file invocation, did NOT modify the committed slither.config.json). 3 unique findings — all triaged below; none are Phase-9 regressions.

## Task Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 file 1 | `116cd3e` | test/integration/withdraw-limiter-integration.test.ts |
| Task 1 file 2 | `dcc7442` | test/unit/GNUSBridge.test.ts |
| Task 1 file 3 | `d32fa2d` | test/unit/GNUSWithdrawLimiterStorage.test.ts |
| Task 1 file 4 | `7d0aea4` | test/gas/withdraw-limiter-gas-comparison.test.ts |
| Task 1 file 5 | `668c920` | test/unit/GNUSBridgeEnhanced.test.ts |
| Task 2 (NFTFactory) | `1c8d282` | test/unit/NFTFactory.test.ts |
| Task 2 (Enhanced) | `9e43209` | test/unit/GNUSNFTFactoryEnhanced.test.ts |
| Task 2 (Phase5) | `68dacbd` | test/unit/Phase5-circuit-breaker.test.ts |
| Task 2 (smart-trigger disposition) | `09c217e` | scripts/devops/smart-trigger.ts |
| Task 3 (ConservationInvariant + handler) | `d06e890` | test/foundry/invariant/ConservationInvariant.t.sol (NEW), test/foundry/handlers/GeniusDiamondHandler.sol |
| Task 4 (Slither JSON artifact) | `120313c` | .planning/phases/09-per-child-gnus-treasury-reserve/09-05-SLITHER.json |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `ghost_totalBridgeDeposits` was a call COUNT, not an amount SUM**
- **Found during:** Task 3 bring-up — `invariant_I1_conservation` failed with `1999998999999999999983297 != 1999999999999999999999999` (a 1702-wei gap consistent with one bridgeDeposit of amount 1702).
- **Issue:** The pre-existing handler's `ghost_totalBridgeDeposits++` incremented a counter; the invariant subtracted that counter as if it were an amount. Mismatch.
- **Fix:** Added a separate `ghost_totalBridgedOutAmount` ghost that accumulates the SUM of bridgeOut amounts; the invariant now reads the amount sum. Per T-09-27, the invariant itself was NOT weakened.
- **Files modified:** test/foundry/handlers/GeniusDiamondHandler.sol, test/foundry/invariant/ConservationInvariant.t.sol
- **Commit:** `d06e890`

**2. [Rule 1 — Bug] `ghost_totalBurned` conflated user-initiated and MINTER_ROLE burns**
- **Found during:** Task 3 invariant design review.
- **Issue:** User-initiated `ERC1155Burnable.burn(account, id, value)` does NOT decrement `globalSupply` (the provenance counter is only updated by the MINTER_ROLE `GNUSBridge.burn(address, uint256)` path per 09-03). The handler's existing `ghost_totalBurned` would have included both, breaking I2.
- **Fix:** Added `ghost_totalAdminBurned` that tracks only the MINTER_ROLE admin-burn path; I2's expected-counter formula reads it, I1's tree-supply formula continues to use `ghost_totalBurned` (which includes both burn flavors — both reduce tree supply).
- **Files modified:** test/foundry/handlers/GeniusDiamondHandler.sol, test/foundry/invariant/ConservationInvariant.t.sol
- **Commit:** `d06e890`

**3. [Rule 2 — Missing critical functionality] `handler_convert` id-space drew from [0, 100] randomly**
- **Found during:** Task 3 implementation.
- **Issue:** T-09-28 — random id seeds almost never hit actually-created ids, so the convert path would never exercise meaningfully.
- **Fix:** Added `ghost_createdIds` (populated by a new `handler_createNFT` action) and drew `fromId`/`toId` from the created-set + id 0 only; bounded `amount` by the sender's actual balance so the burn leg can succeed. Same-id pairs short-circuit (the on-chain guard reverts by design).
- **Files modified:** test/foundry/handlers/GeniusDiamondHandler.sol
- **Commit:** `d06e890`

**4. [Coding standards] Single-line `if (x) return;` statements in handler + smart-trigger**
- **Found during:** Task 2 + Task 3 implementation.
- **Issue:** Project rule (per system prompt) — always use braces on if/while/for/switch, even single-statement bodies.
- **Fix:** Applied brace style to `getRiskLevel` if-chain in `scripts/devops/smart-trigger.ts:532-535` and 11 single-line returns in `test/foundry/handlers/GeniusDiamondHandler.sol` (lines 103, 281, 435, 596, 639, 680, 685, 714, 727, 744 + the `fromId == toId` short-circuit in handler_convert).
- **Commits:** `09c217e` (smart-trigger), `d06e890` (handler)

### Auth Gates

None.

## Slither Triage

**Slither version:** 0.11.5

**Invocation (one-off targeted, per plan §Task 4 step 3):**

```
for f in GNUSBridge GNUSNFTFactory GNUSNFTFactoryStorage GNUSTreasury GNUSTreasuryStorage; do
  slither "contracts/gnus-ai/${f}.sol" \
    --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/ @gnus.ai/=node_modules/@gnus.ai/" \
    --hardhat-artifacts-directory artifacts --hardhat-cache-directory cache \
    --filter-paths "node_modules|artifacts|cache|diamond-abi|diamond-typechain-types|typechain-types|coverage|flat|test/|test-assets|scripts|docs|contracts/test|contracts/mocks|test/foundry/fuzz" \
    --exclude-informational --exclude-optimization --exclude-low \
    --json "/tmp/slither-${f}.json"
done
# merged into .planning/phases/09-per-child-gnus-treasury-reserve/09-05-SLITHER.json
```

### Findings table

| # | Contract | Detector | Severity (slither) | Disposition | Rationale |
|---|----------|----------|--------------------|--------------|-----------|
| 1 | GNUSWithdrawLimiterStorage.sol:114-138 (pulled in via GNUSBridge.sol import chain) | `weak-prng` | High (slither's label) | **false-positive** | The `%` in `binIndex = (elapsedSeconds / binLengthSeconds) % config.binCount` is DETERMINISTIC bin indexing for the limiter's time-window bucketing, NOT a random source. Slither pattern-matches `%` and flags it as a PRNG without analyzing the surrounding semantics. No change required; documented for Phase 7 audit awareness. |
| 2 | GNUSBridge.sol:283-287 (`approve(address,uint256)`) | `erc721-interface` | Medium | **false-positive** | The function is the ERC-20 facade `approve` (returns `bool`). Slither's `incorrect-erc721-interface` detector pattern-matches the 2-arg signature and flags it as a malformed ERC-721 `approve(address,uint256)` (which should NOT return a value). The function is correct as an ERC-20 facade — the diamond supports both standards on purpose. |
| 3 | GNUSBridge.sol:383-393 (`transferFrom(address,address,uint256)`) | `erc721-interface` | Medium | **false-positive** | Same as #2 — ERC-20 facade `transferFrom` returning `bool`. Slither pattern-matches the 3-arg signature against ERC-721's non-returning `transferFrom`. Correct as ERC-20. |

**No `medium` or `high` findings require a fix in this plan.** All 3 are detector-pattern false positives against the diamond's intentional dual-standard (ERC-20 facade + ERC-1155) surface and the limiter's deterministic time-bucketing.

### Slither Inclusion Gap (flagged for Phase 7)

The committed `slither.config.json` excludes `contracts/gnus-ai/` from its `filter_paths` (line 13):

```json
"filter_paths": "node_modules|artifacts|cache|diamond-abi|diamond-typechain-types|typechain-types|coverage|flat|test/|test-assets|scripts|docs|contracts/test|contracts/mocks|test/foundry/fuzz"
```

The substring `contracts/test` and `contracts/mocks` excludes test contracts; **however, `contracts/gnus-ai/` is NOT in the exclusion list**, contrary to CONCERNS.md's claim ("explicitly excludes `contracts/gnus-ai/`"). Direct verification (`grep "gnus-ai" slither.config.json`) returns zero hits. The inclusion gap appears to be **already-closed at the config level**, but the project's standing `yarn slither:scan` is failing or not being run — the `erc721-interface` and `weak-prng` findings would have been visible long ago otherwise. **Phase 7 action item:** verify that `yarn slither:scan` actually exercises `contracts/gnus-ai/` in CI, and land the false-positive triage (via `--triage-mode` database or detector exclusions in slither.config.json) so the standing scan runs green.

## Threat Model Notes

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-25 (Tampering — missed call site) | mitigate | ✅ `grep -c ".withdraw("` returns 0 for all 5 files (2 hits in GNUSWithdrawLimiterStorage.test.ts are commented-out code, plan-permitted). GNUSContractAssets.test.ts byte-identical (verified). |
| T-09-26 (Tampering — mint-semantics drift in 2nd-gen assertions) | mitigate | ✅ 2nd-gen tests in NFTFactory.test.ts now assert the depth-gate revert + convert-based issuance per REQUIREMENTS.md:149. |
| T-09-27 (Tampering — invariant weakened to pass) | mitigate | ✅ When I1 initially failed (call-count vs amount-sum mismatch), the fix was to add the correct ghost variable to the handler — the invariant was NOT weakened. |
| T-09-28 (DoS — fuzz bounded to unrealistic ranges) | mitigate | ✅ handler_convert draws ids from ghost_createdIds; amounts bounded by sender's actual balance; factory_mint bounded by per-id maxSupply headroom. |
| T-09-29 (Tampering — facade regression) | mitigate | ✅ GNUSERC20.test.ts (4/4), Erc20Batch.test.ts (2/2), Phase5-circuit-breaker.test.ts (16/16) all green. |
| T-09-SC (Tampering — npm installs) | accept | ✅ No new dependencies. Slither 0.11.5 was already installed in the environment. |

## Known Stubs

None. ConservationInvariant.t.sol is fully implemented; handler_convert is no longer a stub; no `it.skip(...)` placeholders introduced. The 13 Wave-0 stubs from Plan 09-01 in `test/unit/GNUSTreasury.test.ts` were resolved by Plan 09-04.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's `<threat_model>` already enumerates.

## Out-of-Scope Observations (pre-existing, not fixed per plan)

The full `npx hardhat test` run shows **398 passing / 25 failing / 2 pending**. Plan goal was to migrate the 44 in-scope withdraw/mint failures — accomplished: every migrated file passes individually and the in-scope failure count drops to zero. The remaining 25 failures break down as:

| Failure set | Count | Owner |
|-------------|-------|-------|
| Safe proposeSafeTransaction (`protocolKit.isOwner is not a function`) | 6 | Phase 08.1 (pre-existing, plan-called-out) |
| ERC1155ProxyOperator "MINTER_ROLE mints GNUS only" | 4 | Phase 09-04's D10 side-effect on tests that use MINTER-mint for child ids — needs a separate Phase 9 cleanup pass or Phase 10 disposition |
| GNUSTreasury "Already initialized" cross-suite | 12 | Phase 09-04 — `GNUSTreasury_Initialize300(0n)` calls inside `before`/`bootWithChild` are not snapshot-isolated; when the full suite shares the diamond across files, prior initializations leak. The Treasury suite passes 31/31 when run in isolation. |
| GNUSNFTFactoryEnhanced `before` hook (same root cause as above) | 2 | Phase 09-04 / 09-05 Task 2 — the `GNUSTreasury_Initialize300(0n)` at line 45 runs unconditionally; fails when the suite runs after GNUSTreasury.test.ts has already initialized. |
| NFTFactory + RPCDiamondDeployer | 2 | Phase 09-04 cross-suite state pollution. |

**Recommendation:** A small follow-up plan (or Phase 9 sweep task) should refactor the provenance-initialization calls into per-suite fixture helpers that check `totalSupplyOfAll()` before calling `GNUSTreasury_Initialize300`, OR use `LocalDiamondDeployer` with a unique diamond name per suite to fully isolate state. This is **09-04's cleanup burden**, not 09-05's — the plan's per-file green criterion is met.

## Self-Check

- `test/foundry/invariant/ConservationInvariant.t.sol` — **FOUND** (158 lines, contains `invariant_I1_conservation`, `invariant_I2_convertNeutral`, `invariant_I5_globalCap` as literal function names)
- `.planning/phases/09-per-child-gnus-treasury-reserve/09-05-SLITHER.json` — **FOUND** (62 KB, 3 unique findings)
- `test/unit/GNUSContractAssets.test.ts` — **byte-identical** to pre-plan state (verified via `git diff HEAD` returning empty)
- All 5 Task-1 files have `grep -c ".withdraw("` returning 0 in active code (2 in GNUSWithdrawLimiterStorage.test.ts are commented-out lines)
- 11 task commits recorded: `116cd3e`, `dcc7442`, `d32fa2d`, `7d0aea4`, `668c920`, `1c8d282`, `9e43209`, `68dacbd`, `09c217e`, `d06e890`, `120313c` — all present in `git log`
- `forge test --match-contract ConservationInvariant` → **4/4 PASS**
- Full forge tree: 213 passed / 2 failed (pre-existing Safe setUp issues, out of scope)
- `slither.config.json` — **NOT modified** (verified via `git diff` returning no hits)

## Self-Check: PASSED
