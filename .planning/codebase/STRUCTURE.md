# Codebase Structure

**Analysis Date:** 2026-05-26

## Directory Layout

```
gnus-ai/
├── .buildrc                          # Build configuration
├── .commitlintrc.json                # Commit message linting rules
├── .devcontainer/                    # Dev container configuration (Docker)
├── .github/                          # GitHub Copilot instructions
├── .husky/                           # Git hooks (commit-msg, pre-commit, pre-push)
├── .idea/                            # JetBrains IDE project settings
├── .planning/                        # Planning artifacts for GSD workflow
│   └── codebase/                     # Codebase map documents (this output)
├── .vscode/                          # VS Code settings, launch configs, tasks
├── .yarn/                            # Yarn releases (plug'n'play)
├── assets/                           # Static assets (NFT metadata)
│   └── nft-metadata/
├── audits/                           # External security audit reports
│   └── SmartContract_Audit_Solidproof_GNUSai.pdf
├── config/                           # Network configuration files
│   └── networks/
├── contracts/                        # Main Solidity contracts
│   ├── gnus-ai/                      # Production facets and storage libraries
│   │   └── libraries/                # Solidity utility libraries
│   ├── mocks/                        # Mock contracts for testing
│   └── README.md
├── coverage/                         # Solidity coverage report output
├── coverage.json                     # Coverage summary JSON
├── diamonds/                         # Diamond deployment configurations
│   └── GeniusDiamond/
├── docs/                             # Contract documentation (per-contract .md files)
├── eslint-diamond-rules.js           # Custom ESLint rules for diamond contracts
├── eslint.config.mjs                 # ESLint configuration (flat config)
├── foundry.lock                      # Foundry dependency lock file
├── foundry.toml                      # Foundry configuration
├── hardhat.config.ts                  # Hardhat configuration (networks, plugins, tasks)
├── package.json                      # Node.js dependencies and scripts
├── project/                          # Project planning docs (PRDs, design, tasks)
├── README.md                         # Project root README
├── reports/                          # Gas coverage reports
│   └── gas-coverage/
├── scripts/                          # Deployment and DevOps TypeScript scripts
│   ├── common.ts                     # Shared script utilities
│   ├── deploy/                       # RPC deployment scripts
│   │   └── rpc/
│   ├── devops/                       # CI/CD, security, monitoring scripts
│   ├── setup/                        # Diamond deployer setup
│   └── utils/                        # Script utilities (logging, signing, events)
├── slither.config.json               # Slither static analysis config
├── test/                             # Test suites
│   ├── deployment/                   # Deployment integration tests
│   ├── foundry/                      # Foundry (Solidity) tests
│   │   ├── base/                     # Test base class
│   │   ├── fuzz/                     # Fuzzing tests
│   │   ├── handlers/                 # Invariant test handlers
│   │   ├── integration/              # Foundry integration tests
│   │   ├── invariant/                # Invariant tests
│   │   ├── poc/                      # Proof-of-concept/debug tests
│   │   ├── security/                 # Security-focused tests
│   │   └── unit/                     # Foundry unit tests
│   ├── gas/                          # Gas comparison tests
│   ├── integration/                  # Hardhat integration tests
│   ├── unit/                         # Hardhat unit tests
│   └── utils/                        # Test utilities (templates, networking)
├── test-assets/                      # Test fixtures (deployments, diamonds, typechain)
├── test-suites/                      # Test suite orchestrator
│   └── deployment/
├── tsconfig.json                     # TypeScript compiler configuration
└── yarn.lock                         # Dependency lock file
```

## Directory Purposes

**contracts/gnus-ai/:**
- Purpose: All production Solidity contracts — diamond proxy, facets, storage libraries, constants
- Contains: 15 `.sol` files: proxy (`GeniusDiamond.sol`), facets (11 contracts), storage libraries (4 files), constants (`GNUSConstants.sol`), access control base (`GeniusAccessControl.sol`), utilities (`libraries/TransferHelper.sol`)
- Key files: `GeniusDiamond.sol` (proxy entry), `GNUSBridge.sol` (core token logic), `GNUSNFTFactory.sol` (NFT system), `GNUSWithdrawLimiterStorage.sol` (rate limiter engine), `GNUSERC1155MaxSupply.sol` (transfer hook with supply/limiter/blacklist checks)

**contracts/mocks/:**
- Purpose: Mock/stub contracts for Hardhat TypeScript tests
- Contains: 4 files: `MockERC20.sol`, `MockBadERC20.sol`, `MockNonPayable.sol`, `TransferHelperWrapper.sol`
- Key files: `MockERC20.sol` — simple ERC-20 with mint/burn for test token operations

**diamonds/GeniusDiamond/:**
- Purpose: EIP-2535 diamond configuration files defining facet versions, priorities, upgrade paths, and initialization functions
- Contains: 3 JSON configs: `geniusdiamond.config.json` (primary — 11 facets, version 2.5), `geniusdiamond-sepolia-v2.5-step1.config.json`, `geniusdiamond-erc1155override.config.json`. Also `deployments/` (deployment artifacts) and `archive/` (historical configs)
- Key files: `geniusdiamond.config.json` — authoritative facet registry with versioned init/upgrade functions

**scripts/:**
- Purpose: All off-chain automation: deployment, upgrades, verification, DevOps, security scanning, performance monitoring
- Contains: TypeScript scripts organized into `deploy/rpc/` (6 files for RPC-based deploy/upgrade/verify/status), `devops/` (30 files for CI/CD, security tooling, monitoring), `setup/` (`RPCDiamondDeployer.ts` — core deployer class), `utils/` (helpers, signing, logging)
- Key files: `scripts/setup/RPCDiamondDeployer.ts`, `scripts/deploy/rpc/deploy-rpc.ts`, `scripts/deploy/rpc/upgrade-rpc.ts`, `scripts/deploy/rpc/common.ts`

**test/:**
- Purpose: All test suites — Hardhat (TypeScript) and Foundry (Solidity)
- Contains: `unit/` (15 Hardhat TS test files, one per contract), `integration/` (4 Hardhat TS integration tests), `foundry/` (Solidity forge tests: 12 fuzz, 8 invariant, 5 integration, 3 POC, 1 security, 2 unit), `gas/` (gas comparison), `deployment/` (deployment test), `utils/` (test helpers)
- Key files: `test/foundry/base/GeniusDiamondTestBase.sol` (foundry test base class), `test/foundry/handlers/GeniusDiamondHandler.sol` (invariant handler), `test/utils/test-template.ts` (test scaffolding)

**docs/:**
- Purpose: Per-contract documentation (Markdown) explaining purpose, interface, and usage
- Contains: 15 `.md` files — one per major contract, plus `RPC-Deployment-Strategy.md`, `DEFENDER_*.md`, `Smart-Contracts-Overview.md`
- Key files: `docs/Smart-Contracts-Overview.md` (comprehensive architecture overview)

**config/networks/:**
- Purpose: Network-specific configuration (RPC endpoints, chain IDs, block numbers)
- Contains: Network config files
- Key files: Referenced by `hardhat.config.ts` chain manager

**test-assets/:**
- Purpose: Test fixtures — pre-generated deployment artifacts, diamond ABIs, typechain types
- Contains: `deployments/`, `deployments-test/`, `test-diamonds/`, `test-typechain/`
- Key files: Deployment JSON files for test fixture seeding

**.devcontainer/:**
- Purpose: Docker-based development environment with all tooling pre-installed
- Contains: `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, `devcontainer.template.json`, `scripts/`, `docs/`
- Key files: `devcontainer.template.json` — VS Code devcontainer config

## Key File Locations

**Entry Points:**
- `contracts/gnus-ai/GeniusDiamond.sol`: On-chain entry — EIP-2535 proxy, delegates all calls to facets
- `hardhat.config.ts`: Off-chain entry — Hardhat build/test/deploy configuration (Solidity compiler, networks, plugins)
- `foundry.toml`: Foundry configuration (forge tests, compiler, remappings, fuzz settings)
- `package.json`: Node.js scripts entry — `yarn test`, `yarn compile`, `yarn deploy:*`, `yarn forge:*`

**Configuration:**
- `hardhat.config.ts`: Solidity compiler (0.8.19), network configs (8 chains), etherscan API keys, gas reporter, ABI exporter, diamond plugin paths
- `foundry.toml`: Solidity version (0.8.19), optimizer (200 runs), fuzz runs (256 dev), invariant config, remappings, formatter rules
- `tsconfig.json`: TypeScript target (es2020), rootDirs (scripts/test/test-suites/typechain-types), strict mode
- `diamonds/GeniusDiamond/geniusdiamond.config.json`: Diamond facet registry — 11 facets with versioned deploy/upgrade init functions
- `.prettierrc`: Code formatting rules
- `eslint.config.mjs`: Flat ESLint config with TypeScript and security plugins
- `.solhint.json`: Solidity linting rules
- `.commitlintrc.json`: Conventional commit enforcement
- `slither.config.json`: Slither static analysis configuration
- `.semgrep.yml`: Semgrep security scanning rules

**Core Logic (Smart Contracts):**
- `contracts/gnus-ai/GeniusDiamond.sol`: EIP-2535 diamond proxy, ERC-165 registration
- `contracts/gnus-ai/GNUSBridge.sol`: Core token operations — mint, burn, transfer, bridge, withdraw (367 lines — largest facet)
- `contracts/gnus-ai/GNUSNFTFactory.sol`: NFT creation with hierarchical token IDs, minting, URI management (204 lines)
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol`: Transfer hook — supply cap, blacklist, withdrawal limiter enforcement (96 lines)
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol`: Bin-based rate limiter engine — config, expiry, aggregation, validation (223 lines)
- `contracts/gnus-ai/GeniusAccessControl.sol`: Abstract RBAC base with super admin guard (77 lines)
- `contracts/gnus-ai/GNUSControl.sol`: Protocol controls — blacklists, fees, chain ID (150 lines)
- `contracts/gnus-ai/GNUSConstants.sol`: Shared constants — token names, IDs, masks, max supply (45 lines)

**Deployment & DevOps:**
- `scripts/setup/RPCDiamondDeployer.ts`: Core diamond deployer class with Hardhat config integration
- `scripts/deploy/rpc/deploy-rpc.ts`: RPC-based diamond deployment script
- `scripts/deploy/rpc/deploy-rpc-manual.ts`: Manual deployment with explicit parameters
- `scripts/deploy/rpc/common.ts`: Shared CLI infrastructure (Commander setup, option builders, validation)
- `scripts/utils/signer.ts`: Wallet/signer creation utilities
- `scripts/utils/logger.ts`: Winston-based structured logging

**Testing:**
- `test/unit/GNUSBridge.test.ts`, `test/unit/GNUSBridgeEnhanced.test.ts`: Core bridge unit tests
- `test/unit/GNUSNFTFactoryEnhanced.test.ts`, `test/unit/NFTFactory.test.ts`: NFT factory unit tests
- `test/unit/GNUSWithdrawLimiter.test.ts`: Withdraw limiter unit tests
- `test/foundry/fuzz/`: 12 fuzzing tests covering access control, bridge, ERC-1155, ERC-20, NFT factory, security, withdraw limiter
- `test/foundry/invariant/`: 8 invariant tests for proxy integrity, economic constraints, core diamond behavior
- `test/foundry/security/GNUSWithdrawLimiterSybilAttack.t.sol`: Sybil attack resistance test
- `test/utils/test-template.ts`: Reusable test scaffolding
- `test/foundry/base/GeniusDiamondTestBase.sol`: Foundry test base class with diamond setup

## Naming Conventions

**Files:**
- Solidity contracts: PascalCase matching contract name (e.g., `GNUSBridge.sol`, `GeniusAI.sol`, `GNUSWithdrawLimiterStorage.sol`)
- Storage libraries: `*Storage.sol` suffix (e.g., `GNUSNFTFactoryStorage.sol`, `GNUSControlStorage.sol`, `GNUSWithdrawLimiterStorage.sol`)
- Test files: `<ContractName>.test.ts` for Hardhat; `<TestName>.t.sol` for Foundry (e.g., `GNUSBridge.test.ts`, `DiamondInvariants.t.sol`)
- Deployment scripts: kebab-case with `-rpc` suffix (e.g., `deploy-rpc.ts`, `upgrade-rpc.ts`)
- DevOps scripts: kebab-case descriptive names (e.g., `perf-monitor.ts`, `security-commit-check.ts`)
- Diamond configs: `geniusdiamond.json`, `geniusdiamond-<network>-<version>.config.json`

**Directories:**
- All lowercase: `contracts/`, `scripts/`, `test/`, `docs/`, `audits/`
- Subdirectories describe purpose: `contracts/gnus-ai/`, `scripts/deploy/rpc/`, `test/foundry/fuzz/`

**Solidity Internal:**
- Contracts: PascalCase (`GeniusDiamond`, `GNUSBridge`, `GNUSWithdrawLimiterStorage`)
- Libraries: PascalCase (`TransferHelper`, `GNUSNFTFactoryStorage`, `LibDiamond`)
- Functions: camelCase (`bridgeOut`, `setDefaultLimitAmount`, `_beforeTokenTransfer`)
- Private/internal functions: underscore-prefixed camelCase (`_mint`, `_mintWithBridgeFee`, `__GeniusAccessControl_init`)
- Constants: UPPER_SNAKE_CASE (`GNUS_TOKEN_ID`, `GNUS_MAX_SUPPLY`, `FEE_DOMINATOR`)
- Storage position constants: UPPER_SNAKE_CASE with descriptive keccak256 input (`GENIUS_AI_STORAGE_POSITION = keccak256("gnus.ai.storage")`)
- State variables: camelCase (`bridgeFee`, `protocolVersion`, `nftCreated`)
- Modifiers: camelCase (`onlySuperAdminRole`, `whenNotPaused`)
- Events: PascalCase with past-tense naming (`BridgeSourceBurned`, `WithdrawLimiterTriggered`, `AccountConfigUpdated`)
- Structs: PascalCase (`NFT`, `AIProcessingJob`, `AccountConfig`, `WithdrawBin`)
- Errors: PascalCase prefixed with `Error` (`ErrorWithdrawingEther`, `CannotWithdrawGNUS`)

**TypeScript:**
- Files and directories: camelCase for scripts, kebab-case for devops (`RPCDiamondDeployer.ts`, `perf-monitor.ts`)
- Interfaces/types: PascalCase (`BaseRPCOptions`, `DeploymentOptions`, `RPCDiamondDeployerConfig`)
- Functions: camelCase (`createRPCConfig`, `validateRPCOptions`, `setupProgram`)
- Constants/environment: SCREAMING_SNAKE_CASE (`MAINNET_RPC`, `HH_CHAIN_ID`)

## Where to Add New Code

**New Solidity Facet:**
- Primary code: `contracts/gnus-ai/<NewFacetName>.sol` — Inherit from `Initializable, GeniusAccessControl` + any token extensions
- Storage (if needed): `contracts/gnus-ai/<NewFacetName>Storage.sol` — Define `Layout` struct with `keccak256("gnus.ai.<domain>.storage")` slot
- Diamond config: Add entry to `diamonds/GeniusDiamond/geniusdiamond.config.json` under `facets` with `priority` and `versions`
- Tests (Hardhat): `test/unit/<NewFacetName>.test.ts`
- Tests (Foundry unit): `test/foundry/unit/<NewFacetName>.t.sol`
- Tests (Foundry fuzz): `test/foundry/fuzz/<NewFacetName>Fuzz.t.sol`
- Documentation: `docs/<NewFacetName>.md`

**New Deployment/Migration Script:**
- Primary script: `scripts/deploy/rpc/<script-name>.ts` — Use shared CLI infrastructure from `scripts/deploy/rpc/common.ts`
- Registration: Add npm script to `package.json` `scripts` section

**New DevOps Script:**
- Implementation: `scripts/devops/<script-name>.ts` or `.js` or `.sh`
- Registration: Add npm script to `package.json` `scripts` section

**New Test (Hardhat TypeScript):**
- Unit test: `test/unit/<ContractName>.test.ts` — Use mocha/chai with ethers v6
- Integration test: `test/integration/<test-name>.test.ts`
- Test utilities: `test/utils/<helper-name>.ts`

**New Test (Foundry Solidity):**
- Fuzz test: `test/foundry/fuzz/<TestName>.t.sol` — Extend `GeniusDiamondTestBase`
- Invariant test: `test/foundry/invariant/<TestName>.t.sol` — Use handler from `test/foundry/handlers/`
- Unit test: `test/foundry/unit/<TestName>.t.sol`

**New Constant or Shared Definition:**
- Global constants: `contracts/gnus-ai/GNUSConstants.sol`
- Access control roles: `contracts/gnus-ai/GeniusAccessControl.sol` (add `bytes32 public constant NEW_ROLE`)

**New Mock Contract:**
- Implementation: `contracts/mocks/<MockName>.sol`
- Usage: Import in test files via `contracts/mocks/<MockName>.sol`

## Special Directories

**diamonds/GeniusDiamond/deployments/:**
- Purpose: Deployment artifacts (diamond addresses, facet addresses, ABI data) per network
- Generated: Yes (by `@diamondslab/diamonds-hardhat-foundry` plugin)
- Committed: Yes (for reference but may be regenerated)

**coverage/:**
- Purpose: Solidity test coverage HTML report
- Generated: Yes (by `solidity-coverage` / `yarn coverage`)
- Committed: No (in `.gitignore`)

**test-assets/:**
- Purpose: Test fixture files — pre-generated diamond deployments and TypeChain types for testing
- Generated: Yes (generated by build/test setup)
- Committed: Yes (test fixtures are committed)

**typechain-types/:**
- Purpose: TypeScript type definitions for all Solidity contracts (ethers v6)
- Generated: Yes (by `@typechain/hardhat` — `yarn compile`)
- Committed: No (in `.gitignore`; regenerated during build)

**artifacts/ and cache/:**
- Purpose: Hardhat compilation artifacts and cache
- Generated: Yes
- Committed: No

**diamond-abi/:**
- Purpose: Generated diamond ABI files
- Generated: Yes (by `@diamondslab/hardhat-diamonds`)
- Committed: No

**out/:**
- Purpose: Foundry compilation output
- Generated: Yes (by `forge build`)
- Committed: No

**coverage.json:**
- Purpose: Raw coverage data for CI integration
- Generated: Yes (by `solidity-coverage`)
- Committed: Optional

**project/:**
- Purpose: Planning documents — PRDs, design docs, task breakdowns, init prompts
- Generated: No (manually written)
- Committed: Yes

---

*Structure analysis: 2026-05-26*
