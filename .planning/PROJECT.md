# Gnus.ai Smart Contracts — Technical Debt & Security Remediation

## What This Is

A brownfield remediation project for the Gnus.ai smart contract codebase — an EIP-2535 Diamond proxy system powering Genius Tokens (GNUS), NFTs, cross-chain bridging, and access control on EVM-compatible chains. The contracts are deployed on testnets (Sepolia, Polygon Amoy) with no mainnet deployment yet. This project addresses the technical debt, security gaps, and code quality issues identified in the codebase audit before mainnet launch.

The GenuisAI escrow system is being removed — it has moved to the SuperGenius chain and the facet is now dead code.

## Core Value

**Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.**

## Requirements

### Validated

- ✓ EIP-2535 Diamond proxy with 11 facets deployed on Sepolia testnet (v2.41) — `contracts/gnus-ai/GeniusDiamond.sol`
- ✓ ERC-1155 token with max supply constraints — `contracts/gnus-ai/GNUSERC1155MaxSupply.sol`
- ✓ ERC-20 batch transfer and mint operations — `contracts/gnus-ai/ERC20TransferBatch.sol`
- ✓ NFT factory with parent-child hierarchy and batch minting — `contracts/gnus-ai/GNUSNFTFactory.sol`
- ✓ Cross-chain token bridging with burn/mint pattern — `contracts/gnus-ai/GNUSBridge.sol`
- ✓ Role-based access control (DEFAULT_ADMIN_ROLE, MINTER_ROLE, UPGRADER_ROLE) — `contracts/gnus-ai/GeniusAccessControl.sol`
- ✓ Withdrawal rate limiter with time-segmented bins — `contracts/gnus-ai/GNUSWithdrawLimiter.sol`
- ✓ Diamond ownership and transfer — `contracts/gnus-ai/GeniusOwnershipFacet.sol`
- ✓ Non-GNUS token asset recovery — `contracts/gnus-ai/GNUSContractAssets.sol`
- ✓ Security controls, transferor blacklisting, protocol config — `contracts/gnus-ai/GNUSControl.sol`
- ✓ RPC-based deployment pipeline with retry logic — `scripts/setup/RPCDiamondDeployer.ts`
- ✓ Dual test framework: Hardhat/Mocha + Foundry with fuzz/invariant testing
- ✓ DevOps security tooling: Slither, Snyk, Semgrep, OSV-Scanner, Socket Security

### Active

- [ ] **DEBT-01**: Remove GeniusAI facet — OpenEscrow code is dead; escrow moved to SuperGenius chain. Remove `contracts/gnus-ai/GeniusAI.sol`, `contracts/gnus-ai/GeniusAIStorage.sol`, and facet from `diamonds/GeniusDiamond/geniusdiamond.config.json`
- [ ] **DEBT-02**: Remove `hardhat/console.sol` import and `console.log()` call from `contracts/gnus-ai/DiamondInitFacet.sol` (line 4, line 46). Replace with event emission.
- [ ] **DEBT-03**: Standardize all contract pragmas to `^0.8.19` (currently mixed: `^0.8.0`, `^0.8.2`, `^0.8.19`)
- [ ] **DEBT-04**: Remove duplicate `_setupRole`/`_grantRole` calls for same roles in `DiamondInitFacet.diamondInitialize250()` (lines 51-57)
- [ ] **DEBT-05**: Consolidate duplicated `onlySuperAdminRole` modifier — `DiamondInitFacet.sol` (line 34) duplicates `GeniusAccessControl.sol` (line 73)
- [ ] **DEBT-06**: Remove commented-out network configs from `hardhat.config.ts` (lines 237-241, 282-324)
- [ ] **SEC-01**: Fix `ERC20TransferBatch.mintBatch()` payable without ETH use (`contracts/gnus-ai/ERC20TransferBatch.sol:42`). Add `require(msg.value == 0)` guard.
- [ ] **SEC-02**: Add input validation to `GNUSBridge.withdraw()` — validate `amount >= exchangeRate` and `exchangeRate > 0` to prevent division truncation losses (`contracts/gnus-ai/GNUSBridge.sol:156`)
- [ ] **SEC-03**: Add input validation to `GNUSBridge.bridgeOut()` — validate `destChainID != chainID` to prevent self-bridging
- [ ] **SEC-04**: Add array length validation to `GNUSControl.banTransferorBatch()` and `allowTransferorBatch()` — require `tokenIds.length == bannedAddresses.length` (`contracts/gnus-ai/GNUSControl.sol:81-109`)
- [ ] **SEC-05**: Add `onlySuperAdminRole` modifier to `DiamondInitFacet.diamondInitialize250()`
- [ ] **SEC-06**: Emit events when super admin bypasses withdrawal limiter (`GNUSBridge.sol:159`, `GNUSERC1155MaxSupply.sol:57`, `ERC20TransferBatch.sol:155`)
- [ ] **SEC-07**: Enable Slither static analysis on all production contracts — remove `contracts/gnus-ai/` from `slither.config.json` filter_paths
- [ ] **SEC-08**: Add diamond-level emergency pause mechanism — circuit breaker for all state-changing operations
- [ ] **PERF-01**: Merge double loop in `GNUSERC1155MaxSupply._beforeTokenTransfer()` into single loop (`contracts/gnus-ai/GNUSERC1155MaxSupply.sol:33-73`)
- [ ] **PERF-02**: Cap `binCount` maximum in `GNUSWithdrawLimiterStorage.setDefaultBinCount()` to bound worst-case gas
- [ ] **TEST-01**: Replace stub fuzz tests in `test/foundry/fuzz/ExampleFuzz.t.sol` with real fuzz tests or remove file
- [ ] **TEST-02**: Complete NFTFactory 2nd-gen child token burn assertions (`test/unit/NFTFactory.test.ts:371,375,522`)
- [ ] **TEST-03**: Add banned transferor getter to `GNUSControlStorage.sol` and corresponding test coverage
- [ ] **QUAL-01**: Add `supportsInterface` override to `DiamondInitFacet.sol` (matching pattern in other facets)
- [ ] **DEP-01**: Pin `contracts-starter` to a specific commit hash in `package.json`

### Out of Scope

- Escrow release/closing/dispute mechanism — moved to SuperGenius chain, handled by different contracts
- New feature development — this is a remediation pass only
- Mainnet deployment — gated on audit completion and remediation verification
- Real-time chat or video NFT features — not part of the GNUS token ecosystem
- GNUSNFTCollectionName facet consolidation — low-priority refactor, defer to future cleanup pass
- Multisig/timelock for super admin — defer to governance phase, out of scope for this remediation

## Context

**Deployment Status (from `diamonds/GeniusDiamond/deployments/`):**

| Network | Chain ID | Diamond Address | Protocol | Facets |
|---|---|---|---|---|
| Sepolia | 11155112 | `0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70` | v2.41 | 11 |
| Sepolia | 11155111 | `0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70` | v2.4 | — |
| Polygon Amoy | 80002 | `0xeC20bDf2f9f77dc37Ee8313f719A3cbCFA0CD1eB` | v2.4 | — |

No mainnet deployments exist. The `mainnet.json`, `base.json`, `bsc.json`, and `polygon.json` files are config templates with no deployed addresses.

**Codebase Map:** `.planning/codebase/` contains 7 structured documents covering stack, architecture, structure, conventions, testing, integrations, and concerns.

**Key Architecture:** EIP-2535 Diamond (proxy pattern) where the diamond proxy delegates all calls to facet contracts. The diamond stores facet addresses and function selectors via `LibDiamond`. Facets are upgradeable independently via `DiamondCutFacet`. Storage is namespaced per facet using diamond storage pattern (`LibDiamond.diamondStorage()` or struct-based library storage).

**Dual Test Framework:** Hardhat/Mocha for TypeScript integration tests + Foundry for Solidity fuzz/invariant tests. Both frameworks compile with Solidity 0.8.19.

## Constraints

- **Tech Stack**: Must maintain Solidity 0.8.19 compiler target (matches `hardhat.config.ts` and `foundry.toml`)
- **Diamond Pattern**: All state changes must go through diamond storage — no breaking the EIP-2535 storage contract
- **Upgrade Safety**: Facet removals require diamond upgrade via `DiamondCutFacet` — deployment files must be updated
- **Test Continuity**: Existing test suites must pass after remediation. No regressions on deployed facets.
- **No Mainnet Impact**: Changes are safe since nothing is live on mainnet. Testnet deployments are disposable.
- **Package Manager**: Yarn 4.10.3 with exact pinned versions (no ranges)

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Remove GeniusAI facet entirely | Escrow moved to SuperGenius chain; facet is dead code with incomplete functionality | — Pending |
| Use events for init logging | `console.log` not available on live networks; events provide on-chain observability | — Pending |
| Standardize on Solidity 0.8.19 | Compiler config already uses 0.8.19; pragmas should match | — Pending |
| Exact version pinning (no ranges) | Supply chain security; prevents unintended dependency updates | ✓ Implemented |
| 7-day minimum package age check | Supply chain security; blocks brand-new unvetted packages | ✓ Implemented |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-26 after initialization*
