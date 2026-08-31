# Gnus.ai Smart Contracts — Technical Debt & Security Remediation

## What This Is

The Gnus.ai smart contract codebase — an EIP-2535 Diamond proxy system powering Genius Tokens (GNUS), NFTs, cross-chain bridging, and access control on EVM-compatible chains. Contracts are deployed on testnets (Sepolia, Polygon Amoy) with no mainnet deployment yet. Milestone v1.0 (2026-05-26 → 2026-08-28) closed the audited tech-debt/security backlog (Phases 1–7) and then extended the system well beyond remediation: conversion-native token economics (Phase 9), provenance-relocation bridging hardened to rolling API-attestor certificates (Phases 10 + 15), time-bound AI entitlements (Phase 13), and private-network AI licensing (Phase 14).

The GeniusAI escrow system was removed in Phase 2 — escrow moved to the SuperGenius chain and the facet was dead code.

## Current State

**v1.0 shipped 2026-08-28** — 16 phases, 45 plans; 53-requirement audit traceability: 50 satisfied, 2 deferred to the sibling `erc20-gnus-proxy` repo (PROXY-01/02), 1 external gate open (BRIDGE-17). Full record: `.planning/MILESTONES.md`, `.planning/milestones/v1.0-*`. Test gate: 666 passing / 2 pending / 0 failing (Hardhat) and 215 passed / 0 failed / 5 skipped (Foundry via local bridge node); canonical baselines live in .planning/STATE.md § Test Baseline Ledger; green in CI (tests + tokenless security-audit).

**Next milestone goals:** to be defined via `/gsd-new-milestone` — known inputs: BRIDGE-17 external gate (SuperGenius #363), erc20-gnus-proxy Phase 1 (PROXY-01/02 + nested gnus-ai-contracts pin bump), v1.0 audit tech-debt register (`.planning/milestones/v1.0-MILESTONE-AUDIT.md`).

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
- ✓ Lock/release bridging via provenance relocation — threshold-ECDSA `bridgeIn` certificate verification, replay-protected via `processedMessages`, global-supply conserving (BRIDGE-02/03/04) — Validated in Phase 10: Lock/Release Bridge Vault — `contracts/gnus-ai/GNUSBridge.sol`, `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol`
- ✓ Secure BridgeIn V2 — rolling API-attestor root rotated as a side-effect of `bridgeIn`, canonical `BridgeMessage` identity, domain-separated `BRIDGE_CERTIFICATE_V2` split-encode digest, epoch-derived thresholds (2..16 override), strict-ascending per-signer Merkle proofs, CEI atomic root transition, emergency recovery, legacy-selector removal (BRIDGE-10..16, 18, 19) — Validated in Phase 15: Secure BridgeIn (Phase 10 Amendment) — `contracts/gnus-ai/GNUSBridgeAttestor.sol`, `test/fixtures/bridge-attestor-vectors.json`, `docs/Secure-BridgeIn-Exporter-ABI.md`
- ✓ Tech-debt & security remediation arc closed (DEBT-01..06, SEC-01..08, PERF-01..02, TEST-01..03, QUAL-01, DEP-01 — 21 items) — Validated across Phases 1-7; every checkbox reconciled on source-level probe evidence in 07-04 (probe-then-flip, REQUIREMENTS.md synced) — key artifacts: `package.json` contracts-starter commit pin (`#commit=bf67b736…`, immutable-install green), `.github/workflows/security-audit.yml` CI audit gate (tokenless-hard + secret-conditional scanners), `.planning/STATE.md` "Phase 7 Decisions Logged (07-03)" disposition record
- ✓ Safe-proposed diamondCut upgrades (Phase 08.1) — SafeProposerRPCDeploymentStrategy intercepts privileged cuts for Safe proposal, mainnet guard blocks direct upgrade unless `SAFE_PROPOSE=true`, CLI/env/config validation, JSON fallback artifacts (SWP-01..11) — `scripts/setup/RPCDiamondDeployer.ts`, `scripts/setup/strategies/SafeProposerRPCDeploymentStrategy.ts`
- ✓ Deploy-verify pipeline fixes (Phase 08.2) — RPC deploy path hardened and verified against Sepolia diamond state
- ✓ Conversion-native token economics (Phase 9) — per-child GNUS treasury accounting replacing implicit burn/mint backing; 1:1 minion backing, symmetric `convert()`, ConservationInvariant-enforced — `contracts/gnus-ai/GNUSTreasury.sol`
- ✓ ERC-20 proxy hardening (Phase 11) — generic redeem adapter: single-transaction proxied-child → GNUS via `GNUSTreasury.convert()`, caller-bound direct-burn redeem (ff28e18, PR #75); PROXY-01/02 (allowances, immutable init) deferred to the sibling `erc20-gnus-proxy` repo (PROXY-03) — `contracts/gnus-ai/GNUSRedeemAdapter.sol`
- ✓ Time-bound AI entitlements (Phase 13) — lifecycle/expiry modes, six transfer policies, five expiration dispositions, anti-scaling controls; soulbound AI Credits with burn-on-spend/expiry — `contracts/gnus-ai/GNUSLifecycle.sol`, `GNUSLifecycleMint.sol`, `GNUSLifecyclePolicy.sol` (+Storage/Types), `ERC1155ProxyOperator.sol`
- ✓ Private-network AI licensing (Phase 14) — License NFTs as tenant/network identity, on-chain SKU registry (`priceInMinions`), GNUS-burn payment router, `LicenseActivated` event contract for SuperGenius consumers (LIC-01..07) — `contracts/gnus-ai/GNUSLicensing.sol`

### Active

- [ ] **BRIDGE-17**: SuperGenius production-activation gate — #363 (slot quorum uses only signature-verified votes) and #364 (slot 0 identifies the API RPC that succeeded) must close before bridgeIn activation; #364 closed, #363 OPEN. Gate record: `docs/Secure-BridgeIn-Exporter-ABI.md` §5
- [ ] **erc20-gnus-proxy Phase 1** (sibling repo, not started): PROXY-01 (real amount-specific allowances) + PROXY-02 (immutable proxy init), plus the nested gnus-ai-contracts pin bump (≥ d731384, issue #9, owner Am0rfu5)

### Out of Scope

- Escrow release/closing/dispute mechanism — moved to SuperGenius chain, handled by different contracts
- New feature development — v1.0 was scoped as remediation but Phases 9–15 added features by explicit REQUIREMENTS amendment (v3/v4 ingests); future features go through the next milestone's requirements
- Mainnet deployment — gated on audit completion and remediation verification
- Real-time chat or video NFT features — not part of the GNUS token ecosystem
- GNUSNFTCollectionName facet consolidation — low-priority refactor, defer to future cleanup pass
- Multisig/timelock for super admin — defer to governance phase, out of scope for this remediation
- Child NFT treasury GNUS tokens — investigation for v2: whether child NFTs can hold GNUS treasuries, swap childToken/grandchild NFTs for GNUS, and transfer GNUS to swap contracts. Needs research on ERC-1155 token economics and swap integration patterns before committing to requirements.

## Context

**Deployment Status (from `diamonds/GeniusDiamond/deployments/`):**

| Network      | Chain ID | Diamond Address                              | Protocol | Facets |
| ------------ | -------- | -------------------------------------------- | -------- | ------ |
| Sepolia      | 11155112 | `0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70` | v2.41    | 11     |
| Sepolia      | 11155111 | `0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70` | v2.4     | —      |
| Polygon Amoy | 80002    | `0xeC20bDf2f9f77dc37Ee8313f719A3cbCFA0CD1eB` | v2.4     | —      |

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

| Decision                          | Rationale                                                                           | Outcome       |
| --------------------------------- | ----------------------------------------------------------------------------------- | ------------- |
| Remove GeniusAI facet entirely    | Escrow moved to SuperGenius chain; facet is dead code with incomplete functionality | ✓ Implemented (Phase 2) |
| Use events for init logging       | `console.log` not available on live networks; events provide on-chain observability | ✓ Implemented (Phase 2) |
| Standardize on Solidity 0.8.19    | Compiler config already uses 0.8.19; pragmas should match                           | ✓ Implemented (Phase 1) |
| Exact version pinning (no ranges) | Supply chain security; prevents unintended dependency updates                       | ✓ Implemented |
| 7-day minimum package age check   | Supply chain security; blocks brand-new unvetted packages                           | ✓ Implemented |
| In-phase deprecation-advisory fixes (hardhat-multichain → @diamondslab/hardhat-multichain 1.1.0; eslint supported-line bump; semgrep stub removal) | Owner ruling 2026-08-27 — the audit gate must exit 0 without waivers | ✓ Implemented |
| Conversion-native backing (Phase 9, 9-D1) | Real per-child GNUS treasury + symmetric `convert()` beats implicit burn/mint backing — explicit, invariant-checkable conservation | ✓ Implemented |
| Provenance-relocation bridging (Phase 10, 10-D-01) | Lock-on-out/release-on-in via threshold certificates preserves global supply; no escrow on this chain | ✓ Implemented |
| Caller-bound direct-burn redeem (Phase 11) | Redeem burns the caller's own child balance directly — no allowance path to abuse | ✓ Implemented |
| Rolling attestor certificates (Phase 15) | `BRIDGE_CERTIFICATE_V2` rotates attestor root as a side-effect of `bridgeIn`; legacy threshold path removed pre-deployment | ✓ Implemented |

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

_Last updated: 2026-08-28 after v1.0 milestone (remediation arc + Phases 08.1–15 shipped; BRIDGE-17 and erc20-gnus-proxy Phase 1 the deliberate remainders)_
