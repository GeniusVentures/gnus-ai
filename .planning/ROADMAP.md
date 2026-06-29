# Roadmap: Gnus.ai Tech Debt & Security Remediation

**Created:** 2026-05-26
**Updated:** 2026-06-15
**Granularity:** Standard (12 phases)
**Core Value:** Production-ready smart contracts with reserve-backed token economics, lock/release cross-chain bridging, and standard-compliant ERC-20 proxy — all reviewed and safe for mainnet deployment.

## Phase Summary

### Phases 1-7: Tech Debt & Security Remediation

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Preliminary Cleanup | Remove development-only imports and standardize tooling | DEBT-02, DEBT-03, DEBT-06 | 3 |
| 2 | Dead Code Removal | Remove GeniusAI facet, deduplicate code | DEBT-01, DEBT-04, DEBT-05, QUAL-01 | 4 |
| 3 | Input Validation | Fix missing guards and validation | SEC-01, SEC-02, SEC-03, SEC-04 | 4 |
| 4 | Access Control & Observability | Harden admin paths and enable Slither | SEC-05, SEC-06, SEC-07 | 3 |
| 5 | Circuit Breaker & Performance | Emergency pause, loop and gas optimization | SEC-08, PERF-01, PERF-02 | 3 |
| 6 | Test Coverage | Real fuzz tests, complete assertions, verification | TEST-01, TEST-02, TEST-03 | 3 |
| 7 | Dependency Hardening | Pin contracts-starter, final verification | DEP-01 | 2 |

### Phases 8-12: Architecture Transformation

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 8 | Bridge Recipient | Add 64-byte SG public key destination to bridgeOut() | BRIDGE-01 | 3 |
| 9 | Treasury/Reserve | Per-child GNUS reserve backing model | TREASURY-01, TREASURY-02, TREASURY-03 | 6 |
| 10 | Bridge Vault | Lock/release vaults, state machine, replay protection | BRIDGE-02, BRIDGE-03, BRIDGE-04 | 6 |
| 11 | Proxy Hardening | Real ERC-20 allowances, immutable config, redeem adapter | PROXY-01, PROXY-02, PROXY-03 | 6 |
| 12 | Supply Ledger | Per-token per-chain supply accounting | LEDGER-01, LEDGER-02 | 5 |

## Phase Details

### Tech Debt & Security Remediation (Phases 1-7)

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

~~These items are acknowledged but not committed to a phase. They require further research before entering the Active requirements set.~~

~~- **NFT-01**: Child NFT treasury GNUS tokens~~
~~- **NFT-02**: ChildToken/grandchild NFT-to-GNUS swap mechanism~~
~~- **NFT-03**: GNUS token transfer to external swap contracts~~

> **Resolved 2026-06-15:** Research completed in [Update-Smart-Contracts-Architecture.md](https://github.com/GeniusVentures/TokenContracts/blob/develop/.planning/Update-Smart-Contracts-Architecture.md). Items promoted to phases 8-12 below.

---

### Architecture Transformation (Phases 8-12)

## Phase 8: Bridge Recipient Parameter

**Goal:** Add SuperGenius destination public key parameter (`bytes calldata sgnsDestination`) to `bridgeOut()` to unblock cross-chain testing.

**Success Criteria:**
1. `bridgeOut()` accepts `bytes calldata sgnsDestination` — a 64-byte SuperGenius public key.
2. `require(sgnsDestination.length == 64, "Invalid destination key length")` validation in place.
3. `BridgeSourceBurned` event includes `bytes sgnsDestination` field.
4. Existing tests updated for new signature. Bridge-out with valid 64-byte key tested. Wrong-length key revert tested.

**Requirements:** BRIDGE-01
**Priority:** P0 (unblocks testing)
**Reviewer:** @Super-Genius
**Assignee:** @Am0rfu5

**GitHub:** [gnus-ai#60](https://github.com/GeniusVentures/gnus-ai/issues/60)

---

### Phase 08.1: Safe Wallet Proposer retrofit for diamondCut proposals (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 1/3 plans executed

Plans:
- [ ] TBD (run /gsd-plan-phase 08.1 to break down)

## Phase 9: Per-Child GNUS Treasury/Reserve

**Goal:** Replace implicit burn/mint backing with explicit per-child GNUS treasury accounting. Fix the asymmetric backing invariant (CONCERNS #1) — descendants can no longer be minted without GNUS and later redeemed for GNUS.

**Success Criteria:**
1. `gnusReserve[id]`, `redeemableSupply[id]`, `redeemable[id]` added to storage.
2. `mintBackedChild()` requires GNUS deposit into reserve before mint.
3. `redeem()` burns child tokens and transfers GNUS from reserve — no mint.
4. Descendant tokens are non-redeemable unless separately configured and collateralized.
5. Exchange rate math is consistent (CONCERNS #2): same formula both directions, fixed-point convention.
6. Invariant tests: `reserve[id] >= quoteRedeem(id, totalRedeemableSupply[id])`.

**Requirements:** TREASURY-01, TREASURY-02, TREASURY-03
**Priority:** P0 (security-critical)
**Reviewer:** @Super-Genius
**Assignee:** @Am0rfu5

**GitHub:** [gnus-ai#58](https://github.com/GeniusVentures/gnus-ai/issues/58)
**Concerns addressed:** #1 Asymmetric burn/mint, #2 Exchange rate math, #3 No treasury tracking, #4 ID collision, #7 Rate enforcement, #10 mint semantics, #21 Descendant tests, #30 No solvency views

---

## Phase 10: Lock/Release Bridge Vault

**Goal:** Replace burn-on-bridge-out with lock-in-vault. Add bridge state machine with replay protection.

**Success Criteria:**
1. EVM source vault: `lockTokens()` emits canonical `BridgeLocked` event with full transfer identity.
2. EVM destination vault: `releaseTokens()` verifies signatures, checks `!processed[transferId]`.
3. `mapping(bytes32 => bool) public processedMessages` for replay protection.
4. `TransferStatus` state machine: NONE to LOCK_CONFIRMED to RELEASED.
5. Per-chain vault liquidity checks. No mint on any chain.
6. Separate from redemption reserve — bridging and redemption are distinct actions.

**Requirements:** BRIDGE-02, BRIDGE-03, BRIDGE-04
**Priority:** P0 (security-critical)
**Reviewer:** @Super-Genius
**Assignee:** @Am0rfu5

**GitHub:** [gnus-ai#59](https://github.com/GeniusVentures/gnus-ai/issues/59)
**Concerns addressed:** #6 Burn/mint bridge, #28 No state machine, #29 No emergency pause, #22 Bridge tests, #13 No withdraw events

---

## Phase 11: ERC-20 Proxy Hardening

**Goal:** Fix ERC-20 proxy approval/allowance semantics, make child token ID immutable, add redeem adapter.

**Success Criteria:**
1. Real `_allowances` mapping replaces `setApprovalForAll()` — amount-specific ERC-20 approvals.
2. `approve(spender, amount)` sets a real allowance, not an ERC-1155 operator approval.
3. `transferFrom()` uses real allowance with `_spendAllowance()`.
4. Child token ID is immutable after initialization.
5. `redeem()` added for single-transaction proxied-child to GNUS via reserve.
6. DEX-style approve then transferFrom flow tested.

**Requirements:** PROXY-01, PROXY-02, PROXY-03
**Priority:** P0 (security-critical)
**Reviewer:** @Super-Genius
**Assignee:** @Am0rfu5

**GitHub:** [erc20-gnus-proxy#9](https://github.com/GeniusVentures/erc20-gnus-proxy/issues/9), [erc20-gnus-proxy#10](https://github.com/GeniusVentures/erc20-gnus-proxy/issues/10)
**Concerns addressed:** #5 All-or-nothing approval, #23 Proxy tests

---

## Phase 12: Cross-Chain Supply Ledger

**Goal:** Implement per-token, per-chain supply tracking with bridge-aware view functions.

**Success Criteria:**
1. `ChainSupply` struct: `circulating, escrowed, pendingOutbound, pendingInbound`.
2. Per-token per-chain mapping with enumeration support.
3. View functions: `globalAccountedSupply()`, `chainCirculatingSupply()`, `chainEscrowedSupply()`.
4. Updated atomically on lock and release operations.
5. Does NOT override ERC-20/1155 `totalSupply()` — wallets expect local supply.

**Requirements:** LEDGER-01, LEDGER-02
**Priority:** P1
**Reviewer:** @Super-Genius
**Assignee:** @Am0rfu5

**GitHub:** [gnus-ai#57](https://github.com/GeniusVentures/gnus-ai/issues/57)
**Concerns addressed:** #24 Diamond selector overlap, #26 Dependency tracking

---

*Roadmap created: 2026-05-26*
*Phases 8-12 added: 2026-06-15*
