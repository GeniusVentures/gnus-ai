---
phase: 17-test-suite-determinism
fixed_at: 2026-08-31T22:04:18Z
review_path: .planning/phases/17-test-suite-determinism/17-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-08-31T22:04:18Z
**Source review:** .planning/phases/17-test-suite-determinism/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (both Warnings; Critical count was 0)
- Fixed: 2
- Skipped: 0
- Info findings IN-01..IN-04 were out of scope per the fix directive (IN-03 placeholders are by-design template scaffolding)

## Fixed Issues

### WR-01: Baseline helper probes storage via ambient `ethers.provider` instead of the passed contract's provider

**Files modified:** `test/utils/diamond-baseline.ts`
**Commit:** 50aefd9
**Applied fix:** The `eth_getStorageAt` probe now routes through the passed contract's own provider (`geniusDiamond.runner?.provider`) instead of the module-global `ethers.provider`, so the probe and the `setChainID`/`updateBridgeFee` writes share one provider by construction. Because ethers v6 types `ContractRunner.provider` as the abstract `Provider` (which omits the raw `send` RPC method — caught by the post-edit `tsc --noEmit` check), the value is widened to a send-capable structural type (`Provider & { send(...) }`); an `instanceof JsonRpcApiProvider` narrow was rejected since Hardhat's `HardhatEthersProvider` implements `send` without extending `JsonRpcApiProvider`. A guard throws a clear error if the contract has no provider runner. Probe semantics are identical: same slot (base + 1), same `eth_getStorageAt` method. JSDoc updated to document the probe-provider contract. Verified: `tsc` clean for the file, `GNUSWithdrawLimiterStorage` suite green, three limiter suites green, full gate unchanged.

### WR-02: Baseline seeding makes GNUSTreasury's pre-seed assertion branches unreachable — silent coverage loss

**Files modified:** `test/unit/GNUSTreasury.test.ts`
**Commit:** a469669
**Applied fix:** Both affected provenance tests now zero the provenance slots in-test via `hardhat_setStorageAt` (globalSupply at `TREASURY_STORAGE_SLOT`, provenanceInitialized at base + 1 — the same zeroing pattern already used by the suite's "sub-case B" test), restoring the uninitialized state the tests exist to assert:
- `totalSupplyOfAll reverts pre-seed` asserts the `'Global supply not initialized'` revert unconditionally (the adaptive if/else and its runtime probe were removed).
- `Initialize260 seeds globalSupply and emits GlobalSupplyInitialized` asserts the `GlobalSupplyInitialized(0n, owner)` emit and `totalSupplyOfAll() == 0n` unconditionally.
- The stale `:454` comment ("provenanceInitialized == false after evm_revert") is replaced with the correct rationale: the suite baseline seeds in `before()` and no `evm_revert` can restore an uninitialized slot, so pre-seed state must be synthesized.
Zero slot values use the file's established `ethers.toBeHex(0n, 32)` idiom. No other `SetSeedSupply` probe/if branches were touched, and `ensureDiamondTestBaseline()` was not called mid-test. Verified: both tests execute their previously dead assertions and pass; suite 31 passing; full gate unchanged.

## Verification

| Command | Result |
|---------|--------|
| `npx tsc --noEmit -p tsconfig.json` (target files) | 0 errors in touched files (42 pre-existing errors elsewhere, identical before/after) |
| `npx hardhat test test/unit/GNUSTreasury.test.ts` | 31 passing, 0 failing |
| `npx hardhat test test/unit/GNUSWithdrawLimiter.test.ts test/unit/GNUSWithdrawLimiterStorage.test.ts test/unit/DiamondInitFacet-limiter.test.ts` | 24 passing, 0 failing |
| `yarn test` | 666 passing / 2 pending / 0 failing, exit 0 (exact gate preserved) |

## Deviations

- **Worktree protocol:** Fixes were applied directly in the gnus-ai main working tree (branch `develop`) instead of an isolated `/tmp` worktree. Per the user's persisted project memory, worktree isolation is unsafe for this nested-submodule repo, and the required full-suite verification depends on untracked `node_modules/`/artifacts that a fresh worktree would not have. Each commit was staged file-by-file so no unrelated dirty state was captured.
- **WR-01 fix adaptation:** The review's suggested `const provider = geniusDiamond.runner?.provider;` does not compile under this repo's `tsc` (ethers v6 abstract `Provider` type omits `send`); the applied fix uses the same expression widened to a send-capable structural type, preserving the review's intent exactly.

---

_Fixed: 2026-08-31T22:04:18Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
