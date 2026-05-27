# Requirements: Gnus.ai Tech Debt & Security Remediation

**Defined:** 2026-05-26
**Core Value:** Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.

## v1 Requirements

### Technical Debt

- [ ] **DEBT-01**: Remove GeniusAI facet — delete `GeniusAI.sol`, `GeniusAIStorage.sol`, and remove from diamond config. Escrow moved to SuperGenius chain.
- [ ] **DEBT-02**: Remove `hardhat/console.sol` import and `console.log()` from `DiamondInitFacet.sol`. Replace with event emission.
- [ ] **DEBT-03**: Standardize all contract pragmas to `^0.8.19` (currently mixed: `^0.8.0`, `^0.8.2`, `^0.8.19`).
- [ ] **DEBT-04**: Remove duplicate `_setupRole`/`_grantRole` calls in `DiamondInitFacet.diamondInitialize250()` (lines 51-57).
- [ ] **DEBT-05**: Remove duplicated `onlySuperAdminRole` modifier from `DiamondInitFacet.sol` — use inherited modifier from `GeniusAccessControl.sol`.
- [ ] **DEBT-06**: Remove commented-out network configuration blocks from `hardhat.config.ts` (lines 237-241, 282-324).

### Security

- [ ] **SEC-01**: Fix `ERC20TransferBatch.mintBatch()` — marked `payable` but does not use ETH. Add `require(msg.value == 0, "ETH not accepted")`.
- [ ] **SEC-02**: Add input validation to `GNUSBridge.withdraw()` — validate `amount >= exchangeRate` and `exchangeRate > 0` to prevent division truncation losses.
- [ ] **SEC-03**: Add input validation to `GNUSBridge.bridgeOut()` — validate `destChainID != chainID` to prevent self-bridging.
- [ ] **SEC-04**: Add array length validation to `GNUSControl.banTransferorBatch()` and `allowTransferorBatch()` — `tokenIds.length == bannedAddresses.length`.
- [ ] **SEC-05**: Add `onlySuperAdminRole` modifier to `DiamondInitFacet.diamondInitialize250()`.
- [ ] **SEC-06**: Emit events when super admin bypasses withdrawal limiter in three code paths (`GNUSBridge.sol:159`, `GNUSERC1155MaxSupply.sol:57`, `ERC20TransferBatch.sol:155`).
- [ ] **SEC-07**: Enable Slither static analysis on all production contracts — remove `contracts/gnus-ai/` from `slither.config.json` filter_paths. Run scan and fix findings.
- [ ] **SEC-08**: Add diamond-level emergency pause mechanism — circuit breaker halting all state-changing operations.

### Performance

- [ ] **PERF-01**: Merge double loop in `GNUSERC1155MaxSupply._beforeTokenTransfer()` into single loop — aggregate GNUS amounts and validate transferors in one pass.
- [ ] **PERF-02**: Cap `binCount` maximum in `GNUSWithdrawLimiterStorage.setDefaultBinCount()` and fix type inconsistency (default `uint256` vs per-account `uint32`).

### Testing

- [ ] **TEST-01**: Replace stub fuzz tests in `test/foundry/fuzz/ExampleFuzz.t.sol` with real fuzz tests for diamond functions, or remove file entirely.
- [ ] **TEST-02**: Complete 2nd-gen child token minting assertions in `test/unit/NFTFactory.test.ts` (lines 371, 375, 522-525) — validate GNUS burn logic.
- [ ] **TEST-03**: Add banned transferor getter to `GNUSControlStorage.sol` and corresponding test coverage.

### Quality

- [ ] **QUAL-01**: Add `supportsInterface()` override to `DiamondInitFacet.sol` — check both parent contracts and `LibDiamond.diamondStorage().supportedInterfaces`, matching pattern in other facets.

### Dependencies

- [ ] **DEP-01**: Pin `contracts-starter` to a specific commit hash in `package.json` — currently pointed at `https://github.com/mudgen/diamond-2-hardhat.git` without a commit reference.

## v2 Requirements

### NFT Token Economics

- **NFT-01**: Investigate child NFT treasury GNUS tokens — can child NFTs (2nd+ generation) hold GNUS token treasuries for token swap operations?
- **NFT-02**: Investigate childToken/grandchild NFT-to-GNUS swap mechanism — allow child NFT holders to swap their tokens for GNUS from the treasury.
- **NFT-03**: Investigate GNUS token transfer to external swap contracts — pipe treasury GNUS to a designated swap/liquidity contract.

_These are investigation items only — no implementation committed until research validates feasibility and security of the approach._

## Out of Scope

| Feature | Reason |
|---------|--------|
| Escrow release/closing/dispute | Moved to SuperGenius chain, different contracts handle this |
| New feature development | This is a remediation pass — no greenfield features |
| Mainnet deployment | Gated on audit completion and remediation verification |
| Real-time chat / video NFTs | Not part of the GNUS token ecosystem |
| GNUSNFTCollectionName facet consolidation | Low-priority refactor, defer to future cleanup |
| Multisig/timelock for super admin | Defer to governance phase |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEBT-01 | Phase 2 | Pending |
| DEBT-02 | Phase 1 | Pending |
| DEBT-03 | Phase 1 | Pending |
| DEBT-04 | Phase 2 | Pending |
| DEBT-05 | Phase 2 | Pending |
| DEBT-06 | Phase 1 | Pending |
| SEC-01 | Phase 3 | Pending |
| SEC-02 | Phase 3 | Pending |
| SEC-03 | Phase 3 | Pending |
| SEC-04 | Phase 3 | Pending |
| SEC-05 | Phase 4 | Pending |
| SEC-06 | Phase 4 | Pending |
| SEC-07 | Phase 4 | Pending |
| SEC-08 | Phase 5 | Pending |
| PERF-01 | Phase 5 | Pending |
| PERF-02 | Phase 5 | Pending |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |
| QUAL-01 | Phase 2 | Pending |
| DEP-01 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-05-26 after initial definition*
