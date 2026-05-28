# Roadmap: Gnus.ai Tech Debt & Security Remediation

**Created:** 2026-05-26
**Granularity:** Standard (7 phases)
**Core Value:** Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.

## Phase Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Preliminary Cleanup | Remove development-only imports and standardize tooling | DEBT-02, DEBT-03, DEBT-06 | 3 |
| 2 | Dead Code Removal | Remove GeniusAI facet, deduplicate code | DEBT-01, DEBT-04, DEBT-05, QUAL-01 | 4 |
| 3 | Input Validation | Fix missing guards and validation | SEC-01, SEC-02, SEC-03, SEC-04 | 4 |
| 4 | Access Control & Observability | Harden admin paths and enable Slither | SEC-05, SEC-06, SEC-07 | 3 |
| 5 | Circuit Breaker & Performance | Emergency pause, loop and gas optimization | SEC-08, PERF-01, PERF-02 | 3 |
| 6 | Test Coverage | Real fuzz tests, complete assertions, verification | TEST-01, TEST-02, TEST-03 | 3 |
| 7 | Dependency Hardening | Pin contracts-starter, final verification | DEP-01 | 2 |

## Phase Details

### Phase 1: Preliminary Cleanup
**Goal:** Remove development-only imports, standardize Solidity pragmas, and clean up stale configuration. No diamond upgrade required — safe surface-level changes.

**Success Criteria:**
1. `DiamondInitFacet.sol` no longer imports `hardhat/console.sol` or calls `console.log()`. Events are emitted for init observability instead.
2. All production contracts in `contracts/gnus-ai/` use `pragma solidity ^0.8.19;`. Compiler warnings for mismatched pragmas are resolved.
3. `hardhat.config.ts` contains no commented-out network configuration blocks. Only active networks remain.

**Requirements:** DEBT-02, DEBT-03, DEBT-06

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Remove console.log from DiamondInitFacet.sol, standardize all pragmas to ^0.8.19
- [x] 01-02-PLAN.md — Remove commented-out network blocks from hardhat.config.ts

---

### Phase 2: Dead Code Removal
**Goal:** Remove the GeniusAI facet (escrow moved to SuperGenius chain), eliminate duplicated access control code, and add missing ERC-165 support. Requires diamond upgrade on testnet.

**Success Criteria:**
1. `contracts/gnus-ai/GeniusAI.sol` and `contracts/gnus-ai/GeniusAIStorage.sol` are deleted. GeniusAI is removed from `diamonds/GeniusDiamond/geniusdiamond.config.json`. ABI and typechain types regenerated.
2. `DiamondInitFacet.sol` uses inherited `onlySuperAdminRole` from `GeniusAccessControl` — no duplicate modifier definition.
3. `diamondInitialize250()` calls either `_setupRole()` or `_grantRole()` but not both for the same roles.
4. `DiamondInitFacet.sol` overrides `supportsInterface()` matching the pattern in `GNUSBridge`, `GNUSNFTFactory`, and `GNUSWithdrawLimiter`.

**Requirements:** DEBT-01, DEBT-04, DEBT-05, QUAL-01

**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — Refactor DiamondInitFacet: GeniusAccessControl inheritance, deduplicate roles, add ERC-165
- [x] 02-02-PLAN.md — Remove GeniusAI facet: delete contracts, update configs, regenerate types

---

### Phase 3: Input Validation
**Goal:** Add missing input validation guards across bridge, batch transfer, and control operations. Fix the `payable` gap in `mintBatch()`.

**Success Criteria:**
1. `ERC20TransferBatch.mintBatch()` is no longer `payable` or includes `require(msg.value == 0, "ETH not accepted")`.
2. `GNUSBridge.withdraw()` validates `amount >= exchangeRate` and `exchangeRate > 0` — no value-destroying partial withdrawals.
3. `GNUSBridge.bridgeOut()` validates `destChainID != chainID` — cannot bridge to same chain.
4. `GNUSControl.banTransferorBatch()` and `allowTransferorBatch()` require `tokenIds.length == bannedAddresses.length`.

**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Fix mintBatch() payable gap (SEC-01) and add array length validation to banTransferorBatch/allowTransferorBatch (SEC-04)
- [x] 03-02-PLAN.md — Add exchangeRate/amount validation to withdraw() (SEC-02) and same-chain guard to bridgeOut() (SEC-03)

---

### Phase 4: Access Control & Observability
**Goal:** Harden admin-only code paths with proper modifiers, add event emissions for super-admin bypass paths, and enable Slither static analysis on all production contracts.

**Success Criteria:**
1. `DiamondInitFacet.diamondInitialize250()` is protected by `onlySuperAdminRole` modifier.
2. All three super-admin withdrawal limiter bypass paths (`GNUSBridge.sol:159`, `GNUSERC1155MaxSupply.sol:57`, `ERC20TransferBatch.sol:155`) emit events when bypassed.
3. `slither.config.json` no longer excludes `contracts/gnus-ai/`. `yarn slither:scan` runs successfully and any findings are triaged.

**Requirements:** SEC-05, SEC-06, SEC-07

---

### Phase 5: Circuit Breaker & Performance
**Goal:** Implement a diamond-level emergency pause mechanism and optimize gas-heavy loops in the withdrawal limiter and token transfer paths.

**Success Criteria:**
1. A diamond-level emergency pause halts all state-changing operations. Admin can pause/unpause via a dedicated function. All mutative facet functions check the pause flag.
2. `GNUSERC1155MaxSupply._beforeTokenTransfer()` uses a single loop instead of two — GNUS aggregation and transferor validation happen in one pass.
3. `GNUSWithdrawLimiterStorage.setDefaultBinCount()` has a maximum cap (e.g., 256). Type consistency between default (`uint256`) and per-account (`uint32`) `binCount` is fixed.

**Requirements:** SEC-08, PERF-01, PERF-02

---

### Phase 6: Test Coverage
**Goal:** Replace stub fuzz tests with real coverage, complete NFT factory 2nd-gen child token assertions, and add the missing banned transferor getter.

**Success Criteria:**
1. `test/foundry/fuzz/ExampleFuzz.t.sol` is either replaced with real fuzz tests covering diamond functions or removed entirely. Zero placeholder assertions remain.
2. `test/unit/NFTFactory.test.ts` has uncommented assertions for 2nd-gen child token minting and GNUS burn logic (lines 371, 375, 522-525).
3. `GNUSControlStorage.sol` exposes a `getBannedTransferor(tokenId, address)` getter with corresponding unit tests.

**Requirements:** TEST-01, TEST-02, TEST-03

---

### Phase 7: Dependency Hardening
**Goal:** Pin the `contracts-starter` GitHub dependency to a specific commit hash for deterministic builds. Run final audit and verification pass.

**Success Criteria:**
1. `package.json` `contracts-starter` dependency includes a concrete commit hash (e.g., `#<sha>`). Yarn install produces a consistent lockfile entry.
2. Full test suite passes (`yarn test` and `yarn forge:test`). All 22 requirements are verified complete.

**Requirements:** DEP-01

---

## Investigation Items (Post-Remediation)

These items are acknowledged but not committed to a phase. They require further research before entering the Active requirements set.

- **NFT-01**: Child NFT treasury GNUS tokens — can child NFTs (2nd+ generation) hold GNUS token treasuries for token swap operations? Requires research on ERC-1155 token economics and swap integration patterns.
- **NFT-02**: ChildToken/grandchild NFT-to-GNUS swap mechanism — allow child NFT holders to swap their tokens for GNUS from treasury.
- **NFT-03**: GNUS token transfer to external swap contracts — pipe treasury GNUS to designated swap/liquidity contract.

_These appear in `.planning/REQUIREMENTS.md` v2 section. Sponsor should validate feasibility before adding to roadmap._

---
*Roadmap created: 2026-05-26*
