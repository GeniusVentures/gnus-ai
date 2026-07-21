# Phase 6: Test Coverage - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the 5 placeholder stub fuzz assertions in `ExampleFuzz.t.sol`, complete the unfinished 2nd-gen child token assertions in `NFTFactory.test.ts`, and add the missing banned-transferor getter with unit test coverage. Test-only phase except for the single new getter view function — **no production logic changes**.

</domain>

<decisions>
## Implementation Decisions

### TEST-01: Stub Fuzz File
- **D-01:** **Delete `test/foundry/fuzz/ExampleFuzz.t.sol` entirely.** All 5 test functions are pure stubs (`assertTrue(true, "Replace with actual fuzz test")`). Real fuzz coverage already exists in 12 sibling files (`BridgeFuzz`, `GNUSWithdrawLimiterFuzz`, `ERC1155Fuzz`, `ERC20Fuzz`, `SecurityFuzz`, `NFTFactoryFuzz`, `DiamondInvariants`, etc.). No replacement tests needed — the file is scaffolding, not coverage.

### TEST-02: NFT Factory 2nd-Gen Assertions
- **D-02:** **Assert current behavior — do NOT change `GNUSNFTFactory` burn semantics.** Line 522's comment ("GNUSNFTFactory contract does not burn for 2nd gen child tokens") documents actual behavior. Uncommenting the original burn assertion would require changing production code, which Phase 9 (Treasury/Reserve) will replace anyway with explicit reserve accounting. Instead:
  - Line 371: add success assertion for the 2nd-gen child mint transaction (receipt status / no revert).
  - Line 375: split the supply-delta block into its own `it()` test as the TODO directs.
  - Lines 522-525: replace the commented-out burn assertion with an assertion of **actual current behavior** (e.g., `burntSupply == 0` for 2nd-gen mints), with a comment noting Phase 9 will change this invariant.
- **D-03:** Out of scope for this phase: any change to `GNUSNFTFactory._beforeTokenTransfer` / mint burn logic.

### TEST-03: Banned Transferor Getter
- **D-04:** Add external view `getBannedTransferor(uint256 tokenId, address transferor) returns (bool)` to the **`GNUSControl` facet** (not the storage library). It delegates to the existing internal `GNUSControlStorage.isBannedTransferor(tokenId, sender)` (line 51), which checks both the global ban map (`gBannedTransferors`) and the per-token map (`bannedTransferors[tokenId]`). Single getter — no split per-token/global getters.
- **D-05:** Caller-side convention (user-confirmed): since `GNUS_TOKEN_ID = 0` (`GNUSConstants.sol:29`), querying `getBannedTransferor(0, addr)` serves as the global-ban check for callers.
- **D-06:** Tests **extend the existing GNUSControl unit test file** (ban/allow transferor tests) — no new test file. Cover: banned via `banTransferor`, allowed via `allowTransferor`, global ban visible via tokenId 0 query, batch ban/allow round-trips.

### Claude's Discretion
- Exact assertion style for the line 371 success check (receipt status vs. event-based).
- Test names and `describe` block organization in the extended control test file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/ROADMAP.md` — Phase 6 section (success criteria 1-3, TEST-01/02/03)
- `.planning/REQUIREMENTS.md` — TEST-01, TEST-02, TEST-03 entries

### Phase 9 Context (why TEST-02 asserts current behavior)
- `.planning/ROADMAP.md` — Phase 9 (Per-Child GNUS Treasury/Reserve) will replace burn/mint backing with reserve accounting; do not implement burn-for-2nd-gen now

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GNUSControlStorage.isBannedTransferor(uint256, address)` (`contracts/gnus-ai/GNUSControlStorage.sol:51`) — internal library function the new getter delegates to; already combines global + per-token ban maps.
- `test/foundry/fuzz/` — 12 real fuzz test files already cover diamond functions; ExampleFuzz.t.sol is redundant scaffolding.
- Existing ban/allow setters in `GNUSControl.sol` (`banTransferor`, `allowTransferor`, batch variants, lines ~96-145) — the getter mirrors these and their tests provide the pattern to extend.

### Established Patterns
- Facet view functions delegate to `*Storage` library internals (same pattern as `GNUSControl`'s other reads).
- `GNUS_TOKEN_ID = 0` constant in `contracts/gnus-ai/GNUSConstants.sol:29`.
- Diamond upgrade discipline: adding a function to `GNUSControl` facet requires facet redeploy + `diamondCut` — tests must run against the regenerated diamond ABI/typechain.

### Integration Points
- `test/unit/NFTFactory.test.ts` lines 371, 375, 522-525 — the three TODO/commented sites.
- `contracts/gnus-ai/GNUSControl.sol` — getter added here; diamond ABI regenerated so `getBannedTransferor` is callable through the diamond proxy in tests.

</code_context>

<specifics>
## Specific Ideas

- User explicitly framed tokenId 0 as the global-ban query convention: "since GNUS is token id 0 that is the global-ban check, so getBannedTransferor can be used" — the getter name (not `isBannedTransferor`) was confirmed acceptable.

</specifics>

<deferred>
## Deferred Ideas

- **2nd-gen child token GNUS burn semantics** — Phase 9 (Treasury/Reserve) replaces implicit burn/mint backing with explicit per-child reserve accounting. TEST-02 asserts current no-burn behavior; the burn invariant becomes a Phase 9 concern.

</deferred>

---

*Phase: 6-Test Coverage*
*Context gathered: 2026-07-21*
