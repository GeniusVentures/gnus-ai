---
phase: 06-test-coverage
plan: 01
subsystem: testing
tags: [hardhat, mocha, chai, foundry, fuzz, nft-factory, test-coverage]
dependency_graph:
  requires: []
  provides:
    - "test/foundry/fuzz/ contains exactly 12 real fuzz test files (stub scaffolding removed)"
    - "test/unit/NFTFactory.test.ts fully asserts current 2nd-gen mint behavior"
  affects:
    - "Phase 9 (Treasury/Reserve) will replace the burntSupply === 0n invariant with explicit reserve accounting"
tech_stack:
  added: []
  patterns:
    - "ethers v6 receipt status assertion (receipt.status === 1)"
    - "self-contained mocha it() tests (no shared mutable locals across tests)"
    - "native BigInt literal comparison (burntSupply === 0n) replacing commented ethers v5 BN style"
key_files:
  created: []
  modified:
    - test/unit/NFTFactory.test.ts
  deleted:
    - test/foundry/fuzz/ExampleFuzz.t.sol
decisions:
  - "D-01: delete stub fuzz file rather than replace (12 real fuzz siblings already provide coverage)"
  - "D-02: assert current no-burn behavior for 2nd-gen child mints; do NOT change GNUSNFTFactory semantics"
  - "D-03: zero production contract changes — test-only plan"
metrics:
  duration: "~6 minutes"
  completed: "2026-07-24"
  tasks_completed: 2
  tasks_total: 2
  commits: 2
---

# Phase 6 Plan 01: Test Coverage — Stub Fuzz Removal + NFTFactory 2nd-Gen Assertions Summary

Deleted the placeholder fuzz scaffolding file (`ExampleFuzz.t.sol` — 5 `assertTrue(true, "Replace with actual fuzz test")` stubs) and converted three TODO/commented sites in `NFTFactory.test.ts` into real, passing assertions that lock in current 2nd-gen child mint behavior ahead of Phase 9 reserve accounting.

## Tasks Completed

### Task 1 — Delete stub fuzz file (TEST-01, D-01)

- `git rm test/foundry/fuzz/ExampleFuzz.t.sol`
- Verified: 12 real fuzz sibling files remain (`AccessControlFuzz`, `BridgeFuzz`, `DiamondAccessControl`, `DiamondCoreFuzz`, `DiamondInvariants`, `DiamondOwnership`, `DiamondRouting`, `ERC1155Fuzz`, `ERC20Fuzz`, `GNUSWithdrawLimiterFuzz`, `NFTFactoryFuzz`, `SecurityFuzz`)
- Verified: zero `ExampleFuzz` references in production code, `foundry.toml`, or `package.json` (one non-blocking comment in `test/foundry/integration/diamonds-hardhat-foundry/end-to-end.t.sol:98` — documentation only, not an import)
- Commit: `bc26cce`

### Task 2 — Complete 2nd-gen child mint assertions (TEST-02, D-02)

Three surgical edits to `test/unit/NFTFactory.test.ts`:

**Edit A (was line 371 TODO):** Added explicit receipt success assertion on the 2nd-gen child mint tx:
```typescript
const receipt = await tx.wait();
assert(receipt !== null && receipt.status === 1, 'Child NFT mint transaction should succeed');
```

**Edit B (was line 375 TODO):** Split the supply-delta block out of the parent `it()` into its own self-contained `it('Should burn correct GNUS supply for 2nd gen child NFT mint', ...)` test. The new test re-performs setup (mint GNUS to signer1, grant CREATOR_ROLE + MINTER_ROLE, createNFT with same 2.0 exchange rate) and re-performs an identical fresh mint before asserting the supply delta, because mocha `it()` blocks must not share mutable locals. Original assertion text preserved.

**Edit C (was lines 522-525 TODO + commented BN-style assertion):** Deleted the 4 commented-out lines and replaced with an explicit current-behavior no-burn assertion:
```typescript
// NOTE: GNUSNFTFactory does not currently burn GNUS for 2nd gen child tokens.
// Phase 9 (Treasury/Reserve) will replace this with explicit reserve accounting
// and restore the burn invariant.
assert(
    burntSupply === 0n,
    `2nd gen child mint should not burn GNUS (Phase 9 will change this), but burnt ${utils.formatEther(burntSupply)}`,
);
```

The commented-out `.eq(expectedBurn)` BN-style assertion was NOT restored — it documents behavior Phase 9 will introduce, not current behavior (D-02, D-03).

- Commit: `2c50c72`

## Test Results

```
npx hardhat test test/unit/NFTFactory.test.ts
...
9 passing (1s)
```

Test count went from 8 → 9 (+1 from the Edit B split). All tests pass. Pre-existing Safe SDK mock failures live outside this file and are not affected.

## Plan-Level Verification

| Criterion | Result |
|-----------|--------|
| `ls test/foundry/fuzz/*.t.sol \| wc -l` → 12 | PASS |
| `grep -r "Replace with actual fuzz test" test/` → no matches | PASS |
| `grep -c "receipt.status === 1" test/unit/NFTFactory.test.ts` ≥ 1 | PASS (2 — comment + assertion) |
| `grep -n "Should burn correct GNUS supply for 2nd gen child NFT mint"` matches exactly one `it()` title | PASS (line 383) |
| `grep -n "burntSupply === 0n"` returns exactly 1 match | PASS (line 564) |
| `grep -n "burntSupply.eq"` returns zero matches | PASS |
| `grep -n "Phase 9"` matches the new comment | PASS (lines 561, 565) |
| `npx hardhat test test/unit/NFTFactory.test.ts` exits 0 | PASS (9 passing) |
| `git diff --stat contracts/ gnus-ai/contracts/` empty | PASS — zero production changes (D-03) |

## Deviations from Plan

None — plan executed exactly as written. The plan's `read_first` note about `newParentNFTID` ("if it is block-scoped to the original it(), hoist nothing and instead re-derive it") was exercised: `newParentNFTID` was block-scoped to the original `it()`, so the new split test re-derives it from `signer1Diamond.getNFTInfo(GNUS_TOKEN_ID).childCurIndex` after its own setup, exactly as the plan directed.

## Known Stubs

None. The Edit C assertion is an explicit current-behavior assertion (not a stub) — it locks in the existing no-burn behavior with a Phase 9 transition note.

## Threat Flags

None — test-only changes; no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- `test/foundry/fuzz/ExampleFuzz.t.sol` — confirmed deleted via `git rm` (no longer on disk)
- `test/unit/NFTFactory.test.ts` — confirmed modified with all three edits
- Commit `bc26cce` — found in `git log` (Task 1)
- Commit `2c50c72` — found in `git log` (Task 2)
- `npx hardhat test test/unit/NFTFactory.test.ts` — 9 passing
- `ls test/foundry/fuzz/*.t.sol | wc -l` — 12
