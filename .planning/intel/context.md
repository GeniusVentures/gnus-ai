# Synthesized Context

**Synthesized:** 2026-05-26
**Mode:** merge

## Smart Contract Ecosystem (from ingested docs)

### Diamond Architecture Confirmed

The GeniusDiamond (`docs/GeniusDiamond.md`) implements EIP-2535 with ERC165 and ERC1155 compatibility. 11 facets are deployed on testnet. The diamond proxy delegates all calls to facet contracts with DiamondCutFacet managing upgrades. Storage is namespaced per facet using the diamond storage pattern.

### Facet-by-Facet Documentation Available

Full API reference documentation exists for every facet in the diamond:

| Facet                       | Source Doc                      | Key Scope                                                        |
| --------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| GeniusDiamond               | `docs/GeniusDiamond.md`         | EIP-2535 Diamond, ERC165, ERC1155, DiamondCutFacet               |
| GeniusAccessControl         | `docs/GeniusAccessControl.md`   | RBAC: DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, AccessControlEnumerable |
| GeniusOwnershipFacet        | `docs/GeniusOwnershipFacet.md`  | EIP-173 ownership, role-based permissions                        |
| GNUSBridge                  | `docs/GNUSBridge.md`            | Cross-chain bridging, mint/burn, ERC20/ERC1155 transfers         |
| GNUSERC1155MaxSupply        | `docs/GNUSERC1155MaxSupply.md`  | Supply management, pausing, burning                              |
| GNUSNFTFactory              | `docs/GNUSNFTFactory.md`        | NFT creation, hierarchical parent-child minting                  |
| GNUSControl                 | `docs/GNUSControl.md`           | Protocol security: blacklists, bridge fees, chain config         |
| GNUSWithdrawLimiter         | `docs/GNUSWithdrawLimiter.md`   | Rate-limiting, bin-based aggregation, Sybil prevention           |
| ERC20TransferBatch          | `docs/ERC20TransferBatch.md`    | Batch transfers, minting, burning with supply limits             |
| ERC1155ProxyOperator        | `docs/ERC1155ProxyOperator.md`  | ERC1155 proxy operator approvals, supply tracking                |
| GNUSContractAssets          | `docs/GNUSContractAssets.md`    | Non-GNUS token asset recovery                                    |
| GNUSNFTCollectionName       | `docs/GNUSNFTCollectionName.md` | Genius NFT Collection name constant                              |
| GeniusAI (DEAD CODE)        | `docs/GeniusAI.md`              | Escrow for AI processing jobs — marked for removal               |
| GeniusAIStorage (DEAD CODE) | `docs/GeniusAIStorage.md`       | Storage layout for escrow — marked for removal                   |

### Storage Libraries

Two diamond storage libraries are documented:

- `GNUSControlStorage` (`docs/GNUSControlStorage.md`): Banned transferor mappings, bridge fee, protocol version, chain ID
- `GNUSNFTFactoryStorage` (`docs/GNUSNFTFactoryStorage.md`): NFT Factory diamond storage layout

### Smart Contracts Overview

`docs/Smart-Contracts-Overview.md` provides a non-technical explanation of the GNUS.ai ecosystem:

- GNUS token is the base currency with 50M total supply cap
- NFTs have exchange rates and can be burned for GNUS
- Hierarchical NFT system: parent-child-grandchild relationships
- Cross-chain bridging via burn/mint pattern
- The doc mentions AI escrow integration (line 61-63) — this is now dead code per DEBT-01

### Total Supply Cap

The Smart-Contracts-Overview doc states: "Total supply is capped at 50 million tokens to maintain value" (line 28). This constraint was not explicitly mentioned in the existing PROJECT.md or REQUIREMENTS.md. Source: `docs/Smart-Contracts-Overview.md`

---

## Testing Infrastructure (from ingested docs)

### Foundry Fuzz Test Suite

`docs/FOUNDRY_FUZZ_TESTS.md` documents a comprehensive Foundry test suite with:

- **85% code coverage** achieved across 15 test files (per the doc's summary)
- 12 fuzz test files in `test/foundry/fuzz/` (per codebase map)
- 8 invariant test files in `test/foundry/invariant/`
- 1 security test file (`GNUSWithdrawLimiterSybilAttack.t.sol`)
- 3 PoC test files
- 256 fuzz runs (default), 10,000 (CI profile), 50,000 (intense profile)
- Uses `GeniusDiamondTestBase` as base contract and `GeniusDiamondHandler` for stateful fuzzing

**Clarification for TEST-01:** The planning requirement says "Replace stub fuzz tests in `test/foundry/fuzz/ExampleFuzz.t.sol` with real fuzz tests or remove file." The codebase confirms that `ExampleFuzz.t.sol` is ONE stub file among 12 real fuzz test files (DiamondCoreFuzz, BridgeFuzz, ERC20Fuzz, ERC1155Fuzz, etc.). The broader fuzz suite already exists with real tests. TEST-01 is specifically about the single ExampleFuzz.t.sol stub, not about building the entire fuzz suite from scratch.

### Dual Test Framework

Both Hardhat/Mocha (TypeScript) and Foundry (Solidity) test frameworks are confirmed by the codebase map and the Foundry Fuzz Tests doc. Tests can be run together via `yarn test:all`.

---

## Deployment Infrastructure (from ingested docs)

### RPC-Based Deployment

`docs/RPC-Deployment-Strategy.md` documents the `RPCDiamondDeployer.ts` TypeScript deployer with:

- Direct RPC communication to EVM-compatible nodes
- Retry logic for transaction failures
- Configuration validation
- CI/CD integration support
- Deploy, upgrade, status, and verify scripts

This is the deployment pipeline already validated in PROJECT.md.

### OpenZeppelin Defender Deployment

`docs/DEFENDER_DEPLOYMENT.md` documents an ALTERNATIVE deployment path using `DefenderDiamondDeployer`:

- Production-ready deployment via OpenZeppelin Defender
- Supports EOA Relayer or Safe multi-signature wallet
- Managed deployments with monitoring and status tracking
- Separate environment variable configuration from RPC deployer
- Troubleshooting guide available in `docs/DEFENDER_TROUBLESHOOTING.md`
- Configuration reference in `docs/DEFENDER_CONFIGURATION.md`

This represents a second deployment pathway not documented in the existing planning. The existing planning only validates the RPC-based pipeline. The Defender path is infrastructure context, not a remediation requirement.

---

## DevContainer Infrastructure (from ingested docs)

### Architecture

`docs/ARCHITECTURE.md` (`ARCHITECTURE.md`): Explains build-time vs runtime variable distinction in Docker. `.env` files cannot source Docker build args. `WORKSPACE_NAME` and `DIAMOND_NAME` must be set before Docker build.

### Portability

`docs/PORTABILITY.md` (`PORTABILITY-f61b7b88.md`): The DevContainer is portable across projects via `WORKSPACE_NAME` environment variable. Can be used as a git submodule or direct copy.

### Environment Variable Propagation

`docs/ENV_VARIABLE_PROPAGATION.md` (`ENV_VARIABLE_PROPAGATION-c2686119.md`): Documents how Vault modes are configured via env vars. Variables flow through Docker Compose into the DevContainer. Key variables: `VAULT_COMMAND`, `VAULT_ADDR`.

### Quick Start / Quick Reference

- `QUICK_START.md`: Instructions for using the portable DevContainer in another project
- `QUICK_REFERENCE.md`: Environment variable reference, build-time vs runtime distinction

### Vault

- `VAULT_SETUP.md`: Ephemeral and persistent storage modes, seal/unseal management, auto-unseal, backup/restore, team templates
- `VAULT_CLI.md`: Vault CLI installation, secret CRUD operations, authentication, jq integration
- `VAULT_TROUBLESHOOTING.md`: Common integration issues, GitHub auth, Docker Compose connectivity

### Git Authentication

`docs/Git-Authentication-Setup.md`: GitHub CLI as credential helper for HTTPS remotes in DevContainers and CI/CD.

### Snyk Authentication

`docs/SNYK_AUTHENTICATION.md` (`SNYK_AUTHENTICATION-21d98c05.md`): Snyk CLI authentication in DevContainers using `SNYK_TOKEN` env var (token-based) instead of browser OAuth.

### Infrastructure PRDs

Three PRDs define DevContainer infrastructure requirements (see `.planning/intel/requirements.md` INFRA-PRD entries). These are NOT smart-contract requirements and should not be added to the remediation roadmap.

---

## Summary Statistics

- **35 documents ingested** across 35 classification files
- **18** smart contract API reference docs
- **4** deployment infrastructure docs (RPC + 3 Defender)
- **10** DevContainer infrastructure docs + 3 infrastructure PRDs
- **1** Foundry testing doc
- **1** smart contracts overview doc
- **No new contract requirements** surfaced
- **No new constraints** surfaced
- **No new decisions** surfaced
- **1 clarification** about Foundry fuzz test scope (see INGEST-CONFLICTS.md)

---

_Source: synthesis of 35 classification files in `.planning/intel/classifications/`_
