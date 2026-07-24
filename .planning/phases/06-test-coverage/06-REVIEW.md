---
phase: 06-test-coverage
reviewed: 2026-07-24T20:27:52Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - test/unit/NFTFactory.test.ts
  - contracts/gnus-ai/GNUSControl.sol
  - test/unit/GNUSControlStorage.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-24T20:27:52Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three Phase 6 changes: the NFTFactory assertion edits (receipt-status check, split supply-delta test, no-burn assertion), the new `getBannedTransferor` external view on `GNUSControl`, and the new `getBannedTransferor view` describe block in the storage tests.

The Solidity view is correct and minimal: it delegates to `GNUSControlStorage.isBannedTransferor`, which is the exact predicate enforced by the transfer hooks (`GNUSERC1155MaxSupply.sol:55`, `ERC20TransferBatch.sol:124,156`), so the getter cannot drift from enforcement semantics. The facet config (`geniusdiamond.config.json`) has no include/exclude filter for `GNUSControl`, so the new selector will be cut into the diamond on the next local deploy, and the regenerated typechain types (`diamond-typechain-types/GeniusDiamond.ts:1463`) already expose it. The 4 new tests exercise per-token ban, unban, global ban, and batch round-trip with proper snapshot isolation.

All burn-math assertions in the NFTFactory tests were traced against `GNUSNFTFactory.beforeMint` (only 1st-gen children of GNUS burn: `(id >> 128) == GNUS_TOKEN_ID`). The arithmetic checks out in both the new split test and the batch no-burn assertion. No Critical findings. Warnings center on misleading test naming, a stale TODO/assertion-free tests in the same file the new describe block was added to, and dead `expectedBurn` computation left in the batch test.

## Warnings

### WR-01: New test name says "2nd gen" but mints a 1st-gen child NFT

**File:** `test/unit/NFTFactory.test.ts:383-428`
**Issue:** The test `it('Should burn correct GNUS supply for 2nd gen child NFT mint', ...)` mints `newParentNFTID` directly. Per `GNUSNFTFactory.beforeMint` (`(id >> 128) == GNUS_TOKEN_ID` gates the burn), `newParentNFTID` is a *1st-gen* child of GNUS — the only generation that burns. Meanwhile the batch test at line 468 mints true 2nd-gen children (`newParentNFTID << 128n | i`) and asserts no burn. So the two tests' naming is inverted relative to the contract's burn semantics: the test labeled "2nd gen ... burn" is actually the 1st-gen burn case. The assertions are correct, but the name actively teaches the wrong invariant to the next reader, and a future editor "fixing" the test to match its name would break it.
**Fix:** Rename to reflect the generation actually minted, e.g. `it('Should burn correct GNUS supply for 1st gen (direct child of GNUS) NFT mint', ...)`, and adjust the comment at line 406 ("Perform an identical 2nd-gen child mint") accordingly.

### WR-02: Stale TODO and assertion-free ban tests now that the getter exists

**File:** `test/unit/GNUSControlStorage.test.ts:128-163, 180-240`
**Issue:** Line 132 still carries `// TODO: Add check when there's a getter function for banned status` — the getter (`getBannedTransferor`) is added in this very phase, and the new describe block at line 261 proves it works. Beyond the stale comment, several pre-existing tests in this file remain assertion-free and can never fail: `should ban address globally` (line 129), `should allow address globally after ban` (line 142), `should ban multiple addresses globally` (line 157), `should ban address for specific token` (line 181), `should allow address for specific token after ban` (line 199), `should ban multiple addresses for multiple tokens` (line 220), `should handle same address for multiple tokens` (line 233), `should handle zero address in global ban` (line 354), and `should handle large batch operations` (line 382). Each now has a one-line assertion available via `getBannedTransferor`. Leaving them un-asserted while adding a parallel describe block that does assert creates two tiers of test rigor in one file.
**Fix:** Delete the TODO at line 132 and add `expect(await geniusDiamond.getBannedTransferor(...))` assertions to the ban/unban tests listed above (the new describe block at line 261 is the template).

### WR-03: Dead `expectedBurn` computation and misleading debug logs in batch test

**File:** `test/unit/NFTFactory.test.ts:551-558`
**Issue:** The Phase 6 edit replaced the burn assertion with `burntSupply === 0n` but left `const expectedBurn = toWei((50 + 1 + 1) * 2.0)` (line 551) computed and logged (line 558: `console.log('Expected burn:', ...)`). `expectedBurn` is now never asserted — it is dead code whose only effect is to print an "expected" value that the test explicitly asserts will NOT happen, which is confusing when reading failure output. Additionally, this test passes `toBN(2.0)` (= 2e18) as the exchange rate at line 485 while the new split test passes raw `2.0` (= 2) at line 398 for the same commented semantics ("Exchange rate: 2.0 tokens for 1 GNUS token"); since `expectedBurn` is dead the inconsistency is harmless here, but the leftover half of the old assertion keeps it visible.
**Fix:** Remove the `expectedBurn` variable and its `console.log` (lines 551 and 558), keeping the `console.log` lines for starting/ending supply if desired.

## Info

### IN-01: NatSpec on `getBannedTransferor` overstates the tokenId-0 convention

**File:** `contracts/gnus-ai/GNUSControl.sol:92-103`
**Issue:** The doc says "Passing GNUS_TOKEN_ID (0) is the caller-side convention for querying global-ban status." In fact `isBannedTransferor(0, x)` returns `gBannedTransferors[x] || bannedTransferors[0][x]` — i.e. it also includes a per-token ban on the GNUS token itself. So tokenId 0 is not a pure global-ban query; an address banned only for GNUS (via `banTransferorBatch([0], [x])`) reads as "true" at tokenId 0 without any global ban. This mirrors enforcement (`ERC20TransferBatch.sol:124` uses the same call for GNUS transfers), so behavior is right — only the documentation is imprecise, and the test at `GNUSControlStorage.test.ts:281-293` ("should report global ban via tokenId 0") encodes the same slight conflation.
**Fix:** Reword the NatSpec `@dev` to: "Returns the same predicate the transfer hooks enforce: global ban OR per-token ban for `tokenId`. tokenId 0 (GNUS) therefore reports global bans plus GNUS-specific bans."

### IN-02: `console.log`/`console.error` debug output left in test bodies

**File:** `test/unit/NFTFactory.test.ts:305, 352-361, 555-558`
**Issue:** Several `console.log`/`console.error` calls remain in the touched tests (the file otherwise uses `debuglog`/`debug` for diagnostics). These print unconditionally during test runs, unlike the gated `debug` logger used elsewhere.
**Fix:** Replace with `debuglog(...)` (already imported and used at lines 233, 266, 345, etc.) or remove; line 305's `console.error` inside the catch can go entirely since the `assert.match` on the next line reports the failure.

### IN-03: Unused variables in NFTFactory tests (`createdParentNFTID`, `nft`, `startingSupply`)

**File:** `test/unit/NFTFactory.test.ts:66, 326, 450`
**Issue:** `createdParentNFTID` (line 66) is declared but never assigned or read anywhere in the file. In the receipt-status test, `const nft = await signer1Diamond.createNFT(...)` (line 326) is never used. In the access-deficient test, `startingSupply` (line 450) is captured and only fed to a `debuglog` — leftover from when the test presumably checked supply. None affect correctness, but they are dead weight in tests this phase edited.
**Fix:** Delete the unused declarations (drop the `const nft =` / `const startingSupply =` bindings, keeping the awaited calls).

---

_Reviewed: 2026-07-24T20:27:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
