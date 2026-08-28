# Phase 6: Test Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 6-test-coverage
**Areas discussed:** ExampleFuzz.t.sol fate, TEST-02 burn assertion, TEST-03 getter shape, getter test location

---

## ExampleFuzz.t.sol Fate (TEST-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Delete the file | Stubs only; 12 real fuzz suites already cover the diamond | ✓ |
| Replace stubs with real fuzz tests | Write new fuzz tests for diamond functions in this file | |

**User's choice:** delete
**Notes:** File contains 5 `assertTrue(true, "Replace with actual fuzz test")` stubs. Real coverage exists in BridgeFuzz, GNUSWithdrawLimiterFuzz, ERC1155Fuzz, ERC20Fuzz, SecurityFuzz, NFTFactoryFuzz, DiamondInvariants, and others.

---

## TEST-02 Line 522-525 Burn Assertion

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Implement burn + uncomment | Change GNUSNFTFactory to burn GNUS for 2nd-gen mints, then assert burn | |
| (b) Assert current behavior | Assert no-burn for 2nd-gen mints; defer semantic change to Phase 9 | ✓ |
| (c) Remove commented block | Treat assertion as superseded by Phase 9 | |

**User's choice:** b
**Notes:** Comment at line 522 documents that GNUSNFTFactory does not burn for 2nd-gen child tokens. Phase 9 (Treasury/Reserve) replaces burn/mint backing with reserve accounting, so implementing the burn now would create double migration and diamond upgrade churn. Line 371 gets a success assertion; line 375 block split into its own test.

---

## TEST-03 Getter Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single `getBannedTransferor(tokenId, address)` on GNUSControl | Delegates to internal `isBannedTransferor`; includes global-ban check | ✓ |
| Split per-token vs global getters | Two separate getters | |

**User's choice:** "since GNUS is token id 0 that is the global-ban check, so getBannedTransferor can be used"
**Notes:** `GNUS_TOKEN_ID = 0` (`GNUSConstants.sol:29`). The single getter delegates to `GNUSControlStorage.isBannedTransferor` (line 51) which already ORs the global map (`gBannedTransferors`) with the per-token map. Callers query global bans via tokenId 0.

---

## Getter Test Location

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing GNUSControl/ban test file | Add cases to the existing control tests | ✓ |
| New dedicated unit test file | Separate file for the getter | |

**User's choice:** extend
**Notes:** Cover ban → getter true, allow → getter false, global ban via tokenId 0, batch round-trips.

---

## Claude's Discretion

- Exact assertion style for the line-371 success check (receipt status vs event-based).
- Test names and describe-block organization in the extended control test file.

## Deferred Ideas

- **2nd-gen child token GNUS burn semantics** — Phase 9 (Treasury/Reserve) will replace implicit burn/mint backing with explicit reserve accounting. TEST-02 asserts current no-burn behavior.
