# Roadmap: Gnus.ai Tech Debt & Security Remediation

**Created:** 2026-05-26
**Updated:** 2026-08-21
**Granularity:** Standard (13 phases; Phase 12 retired 2026-08-21 — superseded by Phase 10)
**Core Value:** Production-ready smart contracts with reserve-backed token economics, lock/release cross-chain bridging, and standard-compliant ERC-20 proxy — all reviewed and safe for mainnet deployment.

## Phase Summary

### Phases 1-7: Tech Debt & Security Remediation

| #   | Phase                          | Goal                                                    | Requirements                       | Success Criteria |
| --- | ------------------------------ | ------------------------------------------------------- | ---------------------------------- | ---------------- |
| 1   | Preliminary Cleanup            | Remove development-only imports and standardize tooling | DEBT-02, DEBT-03, DEBT-06          | 3                |
| 2   | Dead Code Removal              | Remove GeniusAI facet, deduplicate code                 | DEBT-01, DEBT-04, DEBT-05, QUAL-01 | 4                |
| 3   | Input Validation               | Fix missing guards and validation                       | SEC-01, SEC-02, SEC-03, SEC-04     | 4                |
| 4   | Access Control & Observability | 1/1 | Complete   | 2026-07-21 |
| 5   | Circuit Breaker & Performance  | 1/1 | Complete   | 2026-07-21 |
| 6   | Test Coverage                  | 2/2 | Complete   | 2026-07-24 |
| 7   | Dependency Hardening           | Pin contracts-starter, final verification               | DEP-01                             | 2                |

### Phases 8-12: Architecture Transformation

| #   | Phase            | Goal                                                     | Requirements                          | Success Criteria |
| --- | ---------------- | -------------------------------------------------------- | ------------------------------------- | ---------------- |
| 8   | Bridge Recipient | Add 64-byte SG public key destination to bridgeOut()     | BRIDGE-01                             | 3                |
| 9   | Treasury/Reserve | 5/5 | Complete   | 2026-08-05 |
| 10  | Bridge Vault     | 4/4 | Complete    | 2026-08-19 |
| 11  | Proxy Hardening  | 2/2 | Complete   | 2026-08-19 |
| 12  | Supply Ledger    | ~~Per-token per-chain supply accounting~~ **SUPERSEDED by Phase 10** | LEDGER-01, LEDGER-02                  | —                |

### Phases 13-14: AI Entitlements & Licensing

| #   | Phase                    | Goal                                                              | Requirements         | Success Criteria |
| --- | ------------------------ | ----------------------------------------------------------------- | -------------------- | ---------------- |
| 13  | Time-Bound Entitlements  | 6/6 | Complete   | 2026-08-24 |
| 14  | Private-Network Licensing| 5/5 | Complete   | 2026-08-26 |

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

**Plans:** 1/1 plans complete

Plans:

- [x] 04-01-PLAN.md — Add onlySuperAdminRole to diamondInitialize250, SuperAdminBypass event, Slither on production contracts

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
2. `test/unit/NFTFactory.test.ts` completes the 2nd-gen child token assertions (lines 371, 375, 522-525): mint success assertion, split supply-delta test, and explicit assertion of current no-burn behavior for 2nd-gen mints (burn semantics deferred to Phase 9 reserve accounting — see `06-CONTEXT.md` D-02).
3. `GNUSControlStorage.sol` exposes a `getBannedTransferor(tokenId, address)` getter with corresponding unit tests.

**Requirements:** TEST-01, TEST-02, TEST-03

**Plans:** 2/2 plans complete

Plans:

- [x] 06-01-PLAN.md — Delete ExampleFuzz.t.sol stub (TEST-01) and complete NFTFactory 2nd-gen assertions (TEST-02)
- [x] 06-02-PLAN.md — Add getBannedTransferor view to GNUSControl facet + getter tests (TEST-03)

---

### Phase 7: Dependency Hardening

**Goal:** Pin the `contracts-starter` GitHub dependency to a specific commit hash for deterministic builds. Run final audit and verification pass.

**Success Criteria:**

1. `package.json` `contracts-starter` dependency includes a concrete commit hash (e.g., `#<sha>`). Yarn install produces a consistent lockfile entry.
2. Full test suite passes (`yarn test` and `yarn forge:test`). All 22 requirements are verified complete.

**Requirements:** DEP-01

**Plans:** 4 plans

Plans:

**Wave 1**

- [ ] 07-01-PLAN.md — DEP-01 commit pin (root + devcontainer) + in-phase advisory fixes (multichain rename to @diamondslab 1.1.0, eslint support bump, semgrep stub removal) + full-matrix no-op proof
- [ ] 07-02-PLAN.md — Security toolchain prerequisites: brew installs behind a blocking legitimacy checkpoint + SNYK/Socket token acquisition (autonomous: false)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 07-03-PLAN.md — Full D-08 audit gate with written dispositions + CI security-audit workflow (tokenless-hard gates, secret-conditional snyk/socket)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 07-04-PLAN.md — Evidence-based docs reconciliation (REQUIREMENTS/ROADMAP/PROJECT/STATE, probe-then-flip) + phase-exit gate

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
**Plans:** 3/3 plans complete

Plans:

- [x] 08.1-01 — Safe helper scripts (proposeSafeTransaction, writeSafeProposalArtifact)
- [x] 08.1-02 — Safe proposal wiring (CLI flags, strategy, config, validation)
- [x] 08.1-03 — TBD

---

### Phase 08.2: Deploy-Verify Pipeline Fixes (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 08.1
**Plans:** 3/3 plans complete (verified 2026-07-03 — see 08.2-VERIFICATION.md; plans 02/03 executed without separate PLAN artifacts)

Plans:

- [x] 08.2-01 — Fix proposeSafeTransaction for delegate proposers (non-owner signing)
- [x] 08.2-02 — New confirmDeployment script (Safe exec → update deployed-data) — delivered as checkSafeExecuted.ts
- [x] 08.2-03 — New verifyFacets script (forge verify-contract + V2 API)

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

**Plans:** 5/5 plans complete

> NOTE: The Success Criteria above reference the SUPERSEDED reserve-ledger model. CONTEXT.md (09-CONTEXT.md, D1–D11) locks the conversion-native model: no reserve apparatus, all supplies in minions, conversion as supply-neutral reallocation. Treat the goal/concerns as intent; CONTEXT as the controlling design.

Plans:

**Wave 1**

- [x] 09-01 — Storage foundation + Wave-0 test scaffolds (GNUSTreasuryStorage lib, NFT struct appends, createNFTs collision guard, GNUSTreasury.test.ts stub, handler_convert stub)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02 — GNUSTreasury facet (convert, display views, totalSupplyOfAll, syncGlobalSupply, Initialize300)
- [x] 09-03 — GNUSBridge rewiring (delete withdraw, restrict MINTER to id 0, provenance hooks + global cap in _mintWithBridgeFee/burn, bridgeOut rate-math cleanup)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-04 — beforeMint rewrite (1:1 minion + depth gate) + diamond config 3.0 + GNUSTreasury unit suite (13 suites)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 09-05 — Test migration (5 .withdraw files + 2 mint-semantics files + smart-trigger) + Foundry ConservationInvariant (I1/I2/I5)

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

> NOTE: The Success Criteria above reference the SUPERSEDED vault/escrow model. CONTEXT.md (10-CONTEXT.md, D-01..D-22) locks the provenance-relocation model: no vault custody, bridgeOut burns from source chainSupply, bridgeIn mints into destination chainSupply via _mintWithBridgeFee, totalSupplyOfAll() invariant under bridging. LOCK_CONFIRMED state dropped; state machine is NONE → INITIATED → RELEASED via (BridgeOutInitiated event, processedMessages flag). Treat the goal/concerns as intent; CONTEXT as the controlling design.

> **AMENDMENT QUEUED (2026-08-23, post-Phase-13):** `docs/Secure-BridgeIn.md` (SPEC, ingested 2026-08-23) revises the **unreleased** bridgeIn design. The Phase 10 bridge code is merged and tested but **never deployed** (no facet records in `config/networks/sepolia.json` — no GNUSBridge/bridgeIn/setValidatorSet), so this is a pre-deployment design update, NOT a "V2" of a live system. The SPEC amends six locked decisions (D-06 transferId derivation, D-08/D-10 certificate digest shape, D-12 threshold derivation, D-15/D-16 validator-set rotation) toward a rolling API-attestor root + canonical `BridgeMessage` struct + `BRIDGE_CERTIFICATE_V2` digest; two points (D-11, D-13) are already aligned. **Scheduling:** the Phase 10 CONTEXT re-lock (re-locking the six decisions with the SPEC's revisions) and implementation run **after Phase 13 ships** — Phase 13's plan 13-06 also edits `GNUSBridge.sol` (bridgeOut policy wiring), so the two must not run concurrently. Ten requirement candidates staged at `.planning/intel/requirements.md` (REQ-bridge-attestor-v2-storage … REQ-bridge-v2-test-matrix). Cross-repo gate: SuperGenius#363 + #364 must close before production activation (track in `.planning/SUBREPOS.md` when scheduled).

**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 10-01-PLAN.md — GNUSBridgeValidatorStorage diamond storage library (processedMessages + validatorMerkleRoot + validatorThreshold)

**Wave 2** *(blocked on Wave 1)*

- [x] 10-02-PLAN.md — GNUSBridge.bridgeIn + setValidatorSet + BridgeReleased/ValidatorSetUpdated events + diamond config 3.0 entry

**Wave 3** *(blocked on Wave 2; 03 and 04 parallel — disjoint files)*

- [x] 10-03-PLAN.md — Unit test suite (test/utils/bridge-certificate.ts helpers + test/unit/GNUSBridgeIn.test.ts, 15 behaviors + canonical SG test vector)
- [x] 10-04-PLAN.md — Foundry invariants (BridgeInvariant real invariants + ConservationInvariant bridge-pair + handler_bridgeIn ghost state)

---

## Phase 11: ERC-20 Proxy Hardening

**Goal:** Fix ERC-20 proxy approval/allowance semantics, make proxy configuration immutable, add a generic redeem adapter.

> NOTE: This phase spans TWO repos per 11-CONTEXT.md (D-01..D-05, locked 2026-08-19). The proxy-contract work (criteria 1–4, 6 — PROXY-01/02) lives in the **erc20-gnus-proxy** repo under its own workstream (`erc20-gnus-proxy/.planning/`), planned from `gnus-ai/.planning/phases/11-erc-20-proxy-hardening/11-CONTEXT.md`. ONLY criterion 5 (PROXY-03, the redeem adapter) is implemented in THIS repo, as a generic diamond-side adapter any external ERC-20 proxy can call. Criterion 5's original "via reserve" wording is SUPERSEDED — Phase 9 D1 locked the conversion-native model: no reserve apparatus exists; the adapter targets `GNUSTreasury.convert()`.

**Success Criteria:**

1. Real `_allowances` mapping replaces `setApprovalForAll()` — amount-specific ERC-20 approvals. → **erc20-gnus-proxy repo**
2. `approve(spender, amount)` sets a real allowance, not an ERC-1155 operator approval. → **erc20-gnus-proxy repo**
3. `transferFrom()` uses real allowance with `_spendAllowance()`. → **erc20-gnus-proxy repo**
4. Child token ID (and all init config) immutable after one-shot initialization. → **erc20-gnus-proxy repo**
5. Generic `redeem()` adapter on the gnus-ai diamond for single-transaction proxied-child → GNUS via `GNUSTreasury.convert()` — callable by any conforming external ERC-20 proxy. → **THIS repo**
6. DEX-style approve then transferFrom flow tested. → **erc20-gnus-proxy repo** (against a GeniusDiamond deployed from a bumped nested `contracts/gnus-ai` pin that includes this repo's Phase 11 redeem adapter)

**Requirements:** PROXY-03

(PROXY-01 and PROXY-02 are owned by the erc20-gnus-proxy workstream — see 11-CONTEXT.md D-02/D-04.)
**Priority:** P0 (security-critical)
**Reviewer:** @Super-Genius
**Assignee:** @Am0rfu5

**GitHub:** [erc20-gnus-proxy#9](https://github.com/GeniusVentures/erc20-gnus-proxy/issues/9) (PROXY-01/02), [erc20-gnus-proxy#10](https://github.com/GeniusVentures/erc20-gnus-proxy/issues/10) (PROXY-03 — reserve wording superseded per 11-CONTEXT D-06/D-07)
**Concerns addressed:** #5 All-or-nothing approval, #23 Proxy tests

**Plans:** 2/2 plans complete

Plans:

**Wave 1**

- [x] 11-01-PLAN.md — GNUSRedeemAdapter facet (redeem + onERC1155Received + batch rejection) + diamond config 3.0 entry at priority 118

**Wave 2** *(blocked on Wave 1)*

- [x] 11-02-PLAN.md — Unit test suite (14 cases: happy path direct + proxy-mediated, full revert matrix, WR-07 limiter attribution, super-admin bypass, receiver hook, no-custody invariant) + MockERC20Proxy test helper

---

## Phase 12: Cross-Chain Supply Ledger — **SUPERSEDED / RETIRED**

> **Status (2026-08-21): RETIRED — no longer a phase.** This phase was scoped against the
> vault/escrow bridging model. Phase 10 shipped the **provenance-relocation** model instead
> (10-CONTEXT.md D-01: *"No vault, no escrow, no lock-then-release custody"*), which removes
> the premise this phase was built on. Retired by owner decision; see supersession analysis
> below. Do not plan or execute.

**Why retired:**

- **`escrowed` is dead** — nothing is ever escrowed under provenance relocation; there is no
  vault balance to count.

- **`pendingInbound` is un-knowable on-chain** — the destination chain first learns of a bridge
  when `bridgeIn` executes (via the validator certificate); there is no pending window to record.

- **"lock and release operations" don't exist** — Phase 10 replaced them with
  `bridgeOut`/`bridgeIn`, which already update `chainSupply[block.chainid]` atomically.

- **The surviving bookkeeping is already shipped** (Phase 9): `GNUSTreasuryStorage.Layout`
  holds `globalSupply` + `chainSupply[chainid]` + `ownChainId`; `GNUSTreasury.totalSupplyOfAll()`
  and `setSisterChainSupply()` provide the global counter and the reconciliation valve.

- **Per-token-per-chain accounting is redundant** — every child minion is backed 1:1 by GNUS
  (Phase 9 conversion-native model), so child supply is derived from GNUS supply, not tracked
  independently.

- **Criterion 5 (don't override `totalSupply()`)** is already satisfied — nothing overrides it.

**Carried forward (deferred, not lost):**

- Source-side in-flight visibility (`pendingOutbound`) — Phase 10 left the hooks
  (`BridgeOutInitiated` event, `INITIATED` state, `processedMessages`) should a future phase
  want an on-chain in-flight ledger. Not currently required by any consumer.

- Phase 13 v2 "active supply" metric keyed off `isTokenActive` — tracked in 13-CONTEXT.md
  `<deferred>`; does not need this phase.

**Original (superseded) spec — kept for archaeology:**

**Goal:** Implement per-token, per-chain supply tracking with bridge-aware view functions.

**Success Criteria:** *(all superseded — see above)*

1. ~~`ChainSupply` struct: `circulating, escrowed, pendingOutbound, pendingInbound`.~~
2. ~~Per-token per-chain mapping with enumeration support.~~
3. ~~View functions: `globalAccountedSupply()`, `chainCirculatingSupply()`, `chainEscrowedSupply()`.~~
4. ~~Updated atomically on lock and release operations.~~
5. ~~Does NOT override ERC-20/1155 `totalSupply()` — wallets expect local supply.~~

**Requirements:** LEDGER-01, LEDGER-02 *(retired with the phase)*
**Priority:** ~~P1~~ n/a
**Reviewer:** @Super-Genius
**Assignee:** @Am0rfu5

**GitHub:** [gnus-ai#57](https://github.com/GeniusVentures/gnus-ai/issues/57) *(close as superseded-by-Phase-10)*
**Concerns addressed:** #24 Diamond selector overlap, #26 Dependency tracking

---

## Phase 13: Time-Bound ERC-1155 Entitlements

**Goal:** Add lifecycle (validFrom/validUntil, per-token-ID and per-holder expiry), six transfer policies, issuance anti-scalping controls, and expiration dispositions with settlement to the ERC-1155 child-token system. Primary product: AI Credits — soulbound, burn-on-spend, burn-on-expiry, never redeemable.

**Context:** `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` (decisions D1-D13 locked 2026-08-03)

**Success Criteria:**

1. Lifecycle config appended to `NFT` struct (validFrom, validUntil, defaultDuration, expirationMode, transferPolicy, expirationDisposition, expirationRecipient, credentialVerifier); zero-value defaults keep existing tokens active/unrestricted/non-expiring; upgrade test proves decode compatibility.
2. `ExpirationMode { None, PerTokenId, PerHolder }` with per-holder clocks in `expiresAt[tokenId][holder]` mapping; stacked settle-first renewal (expired balances settled, never resurrected).
3. All six transfer policies enforced by a single predicate in `_beforeTokenTransfer`; no operator exemptions (NFT_PROXY_OPERATOR_ROLE cannot bypass); ERC-20 proxy covered without changes.
4. Policy-bound tokens non-bridgeable in v1 (bridging IS a transfer; no vault exemption). (amended 2026-08-25, Phase 14 D-24 — SOULBOUND tokens may bridgeOut when caller holds CREATOR_ROLE/ADMIN_ROLE and the token is unexpired; all other policy-bound tokens remain non-bridgeable)
5. All five dispositions implemented (NONE, KEEP_INERT, BURN, RETURN_TO_ADDRESS, REDEEM_TO_PARENT); permissionless fixed-outcome `settleExpired()`; REDEEM_TO_PARENT settles to direct parent via Phase 9 reserves, collateralized tokens only.
6. Anti-scalping: per-wallet mint cap + sale window + generic credential-verifier hook (CEI-ordered) in `beforeMint`.
7. AI Credits: direct GNUS child, exchangeRate 1.0, SOULBOUND, BURN, PerHolder expiry; spend/expiry creates zero GNUS/parent/reserve/treasury credit.
8. Timestamps creator-only mutable post-mint (renewal); policy/disposition/mode/recipient immutable after first mint; all mutations emit events.

**Requirements:** SC1, SC2, SC3, SC4, SC5, SC6, SC7, SC8 (success criteria above serve as requirement IDs), D4, D9
**Priority:** P1
**Depends on:** **Phase 9 (hard)** — implemented on completed Phase 9 treasury/reserve code
**Constraints:** Phase 10 (policy check in lockTokens), Phase 11 (no proxy operator exemptions). ~~Phase 12 (expired-unsettled = circulating)~~ — Phase 12 retired; the "expired-unsettled = circulating" convention is now owned by Phase 13 itself (settlement burns flow through standard `_burn` hooks).

**Plans:** 6/6 plans complete

Plans:

**Wave 1**

- [x] 13-01-PLAN.md — Storage foundation: NFT struct append (D1), GNUSLifecycleStorage lib, plug-in interfaces, mocks, legacy-decode upgrade test (SC1)

**Wave 2** *(blocked on Wave 1; 02/03/04 parallel — disjoint files)*

- [x] 13-02-PLAN.md — GNUSLifecycle facet: enums, views, configureLifecycle guards (Q1/Q2/Q6), setters, settleExpired + five-disposition dispatch, renewal + no-custody redeem internals; diamond config priority 119 / protocol 2.7 (SC2, SC5, SC8, D4, D9)
- [x] 13-03-PLAN.md — GNUSNFTFactory beforeMint anti-scalping (cap CEI + credential hook), renewal trigger, mintWithCredential + createNFTWithLifecycle overloads, anti-scalping test suite (SC6)
- [x] 13-04-PLAN.md — _enforceTransferPolicy predicate in GNUSERC1155MaxSupply._beforeTokenTransfer + full six-policy test matrix incl. NFT_PROXY_OPERATOR_ROLE bypass attempt (SC3)

**Wave 3** *(blocked on 13-02 + 13-03)*

- [x] 13-05-PLAN.md — Settlement/renewal/mutability behavior matrix + LifecycleInvariant Foundry suite (settle-first + conservation) (SC2, SC5, SC8, D4, D9)

**Wave 4** *(blocked on 13-04 + 13-05)*

- [x] 13-06-PLAN.md — bridgeOut policy wiring (pre-limiter) + bridge matrix + AI Credits end-to-end + selector-collision assertion (SC4, SC7)

---

## Phase 14: Private-Network AI Licensing

**Goal:** Per-company tenant licensing on the public EVM canonical layer with SuperGenius private-network execution — License NFTs as tenant/network identity, AI Credits as spendable children, GNUS-burn payment router + operator fiat path (D-26), and hybrid public/private settlement.

**Source:** `.planning/private-network-ai.md` + owner resolutions (ingested 2026-08-03; intel at `.planning/intel/`)

**Success Criteria:**

1. GNUS AI Product Root token instantiated as the public AI network; per-company License NFTs created as its children; company AI Credits as children of the License NFT; individual AI Credits remain direct product-root children (no Individual License NFT branch).
2. `NFT` struct gains `networkScope {PublicOnly=0, PrivateOnly, Hybrid}`, `privateNetworkId`, `publicSettlementEnabled` — appended after Phase 13 fields; zero defaults backwards-compatible; upgrade test proves decode.
3. On-chain Product/SKU registry: minion-denominated `priceInMinions`, `creditAmount`, `duration`, `createsLicense`, `renewsLicense`, `active`. No USD oracle.
4. Payment router facet: GNUS-minions rail (paid GNUS burned) produces license created/renewed + credits minted/extended + activation event; fiat path is off-chain operator minting (D-26).
5. `LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)` emitted on creation and every renewal; SuperGenius consumers derive license state from events alone.
6. Hybrid-scope tokens redeemable to GNUS via Phase 13's REDEEM_TO_PARENT path (exchangeRate > 0, Phase 9 collateralized); burn-only AI Credits remain non-redeemable.
7. RESOLVED (D-07/D-29 2026-08-25): SG spend → GV wallet → existing Phase 10 bridgeIn → ops burn; no new on-chain settlement mechanism. Private-network spend pattern (bridged burn events vs mirror + periodic settlement) resolved during phase planning; informed by Phase 10 vault design.

**Requirements:** LIC-01, LIC-02, LIC-03, LIC-04, LIC-05, LIC-06, LIC-07
**Priority:** P1
**Depends on:** Phase 13 (lifecycle/transfer/disposition mechanisms); transitively Phase 9 (reserves) and Phase 10 (bridge)
**Open design question:** PD-7 private-spend settlement pattern (`.planning/intel/decisions.md`) — RESOLVED by D-07/D-29 (see 14-CONTEXT.md)

**Plans:** 5/5 plans complete

Plans:

**Wave 1**

- [x] 14-01-PLAN.md — Docs amendments (LIC-04/SC4 rewording D-26, SC7 closure D-29) + D-03/D-25 NFT struct append + slot-probe upgrade test (LIC-02, LIC-07)
- [x] 14-02-PLAN.md — GNUSLicensingTypes/Storage + SKU registry facet + diamond config at 2.6 (LIC-03)
- [x] 14-04-PLAN.md — GNUSBridge D-24/D-23 gate (SOULBOUND privileged bridgeOut + expired-holder revert) + policy test matrix

**Wave 2** *(blocked on 14-01 + 14-02)*

- [x] 14-03-PLAN.md — GNUSLicensingPurchase facet (GNUS-burn rail, license create/renew, LicenseActivated) + unit suite (LIC-01, LIC-03, LIC-04, LIC-05, LIC-06)

---

## Phase 15: Secure BridgeIn (Phase 10 Amendment)

**Goal:** Replace the manual validator-set bridgeIn surface with the rolling API-attestor certificate design from `docs/Secure-BridgeIn.md` (PD-BR-1..8) — rolling attestor root rotated as a side-effect of `bridgeIn`, canonical `BridgeMessage` identity, domain-separated `BRIDGE_CERTIFICATE_V2` digest, epoch-derived thresholds, and legacy-selector removal. Pre-deployment amendment: the legacy path has not shipped to a production network, so selector removal is a config/upgrade action, not a migration.

**Source:** `docs/Secure-BridgeIn.md` (SPEC, 784 lines) → PD-BR-1..8 in `.planning/intel/decisions.md`; requirements BRIDGE-10..19 (queued 2026-08-23, scheduled post-Phase-13 — Phases 13/14 complete)

**Amendment scope (verified 2026-08-26, owner-directed):** PD-BR-1..8 amend locked Phase 10 decisions D-06/D-08/D-10/D-12/D-15/D-16. These were checked and are **NOT deprecated** — the shipped `GNUSBridge.sol` implements them verbatim (digest = seven D-08/D-10 fields at `:384-393`; `validatorThreshold` gate at `:423`; `setValidatorSet(newRoot, newThreshold) onlySuperAdminRole` at `:499`). Phase 15 CONTEXT must therefore explicitly supersede/amend them per decision; no silent drift. D-01..D-05, D-07, D-09, D-11, D-13, D-14, D-17, D-20..D-22 carry forward unchanged (PD-BR-5/PD-BR-7 are aligned extensions, not conflicts).

**Success Criteria:**

1. BRIDGE-10/11: rolling-attestor storage appended (legacy validator storage preserved byte-for-byte, becomes dead once active); one-time `initializeBridgeAttestorV2` Genesis bootstrap; first certificate advances off Genesis — no permanent single-signature mode.
2. BRIDGE-12: canonical `BridgeMessage` + `BRIDGE_MESSAGE_ID_V2` composite replay key (amends D-06); replay protection reuses `processedMessages` (D-07 unchanged).
3. BRIDGE-13: `BRIDGE_CERTIFICATE_V2` digest binding `currentAttestorRoot/Epoch`, `nextAttestorRoot` (extends D-08/D-10); dest-chain + diamond-address binding preserved.
4. BRIDGE-14: strict-ascending per-signer-Merkle-proof verification, epoch-derived thresholds, 16-signature cap (amends D-12/D-15).
5. BRIDGE-15: atomic new `bridgeIn` — replay-mark + root transition before mint (CEI); failed mint reverts root update.
6. BRIDGE-16: legacy `bridgeIn` selector removed/stubbed; `setValidatorSet` removed or converted to named emergency-recovery (paused + superAdmin + never restores Genesis).
7. BRIDGE-18: cross-language test vectors (C++ SuperGenius exporter ↔ Solidity verifier) checked in and run in CI; BRIDGE-19 amendment test matrix extends (not replaces) the Phase 10 legacy suite.
8. BRIDGE-17: SuperGenius#363/#364 tracked in parallel in the SuperGenius repo (owner ruling 2026-08-26: NOT local blockers — EVM work proceeds concurrently); both must be closed before production activation.

**Requirements:** BRIDGE-10, BRIDGE-11, BRIDGE-12, BRIDGE-13, BRIDGE-14, BRIDGE-15, BRIDGE-16, BRIDGE-17, BRIDGE-18, BRIDGE-19
**Priority:** P1 (pre-deployment security revision)
**Depends on:** Phase 10 (bridgeIn surface), Phase 13 (bridge policy gate — D-24 privileged bridgeOut must survive the selector change)

**Plans:** 4/4 plans complete (BRIDGE-17 remains Pending by design — production activation gated on SuperGenius#363 closing; see docs/Secure-BridgeIn-Exporter-ABI.md §5)

Plans:

- [x] 15-01-PLAN.md — V2 storage append (slots +3..+6) + GNUSBridgeAttestor admin facet skeleton (init/threshold/emergency) + config registration at priority 116/2.6 + slot-probe upgrade test
- [x] 15-02-PLAN.md — V2 certificate path (BridgeMessage, split-encode BRIDGE_CERTIFICATE_V2 digest, verifier, CEI bridgeIn with inline fee-mint) + legacy bridgeIn/setValidatorSet removal from GNUSBridge
- [x] 15-03-PLAN.md — V2 test utils, BRIDGE-18 checked-in vectors + flat/split equivalence proof, BRIDGE-19 SPEC 657-727 matrix suite
- [x] 15-04-PLAN.md — legacy suite rewrite + Foundry handler/invariant retarget + exporter ABI/digest spec + BRIDGE-17 gate + full-suite baseline gate

---

_Roadmap created: 2026-05-26_
_Phases 8-12 added: 2026-06-15_
_Phase 13 added: 2026-08-03 (context locked)_
_Phase 14 added: 2026-08-03 (ingested from private-network-ai.md)_
_Phase 10 amendment queued: 2026-08-23 (ingested from Secure-BridgeIn.md — pre-deployment bridgeIn revision, scheduled post-Phase-13)_
_Phase 15 added: 2026-08-26 (schedules the queued Phase 10 amendment; D-06/D-08/D-10/D-12/D-15/D-16 verified NOT deprecated; #363/#364 ruled parallel non-blockers by owner)_
