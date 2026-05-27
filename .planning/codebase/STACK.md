# Technology Stack

**Analysis Date:** 2026-05-26

## Languages

**Primary:**
- Solidity 0.8.19 - All smart contract source code in `contracts/gnus-ai/`
- TypeScript 5.9.3 - Test suites, deployment scripts, DevOps tooling in `scripts/`, `test/`, `test-suites/`

**Secondary:**
- JavaScript - CI performance dashboard (`scripts/devops/ci-perf-monitor.js`, `scripts/devops/ci-performance-dashboard.js`), package-age checks (`scripts/devops/check-package-age.mjs`)
- Python 3.11 - Security tools in devcontainer (Slither, Semgrep, Bandit), Vault integration scripts
- Go 1.24.7 - OSV-Scanner in devcontainer, Foundry toolchain dependencies
- Bash - Shell scripts for DevOps (`scripts/devops/*.sh`), lifecycle hooks (`.husky/`), container automation

## Runtime

**Environment:**
- Node.js 18+ (production/test recommended in `package.json` engines) / Node.js 22 (devcontainer `Dockerfile`)
- Hardhat 2.26.5 — local EVM development network, test runner, compiler orchestrator
- Foundry toolchain (`forge`) — fuzz testing, invariant testing, gas reporting, deployment via `@diamondslab/diamonds-hardhat-foundry`

**Package Manager:**
- Yarn 4.10.3 (declared in `package.json` under `packageManager`)
- Lockfile: `yarn.lock` (present)
- Config: `.yarnrc.yml` — `nodeLinker: node-modules`, `checksumBehavior: throw`, `globalFolder: /tmp/yarn-global`
- Yarn binary: `.yarn/releases/yarn-4.10.3.cjs`

## Frameworks

**Core:**
- Hardhat 2.26.5 — Solidity compilation, local blockchain, test runner, deployment orchestration, task runner
- Foundry (forge) — Solidity-native fuzz/invariant testing, gas reports, linting (`forge fmt`), deployment (via Hardhat integration)
- OpenZeppelin Contracts Upgradeable Diamond (`@gnus.ai/contracts-upgradeable-diamond` 4.5.0) — Forked upgradeable OpenZeppelin contracts adapted for Diamond proxy pattern
- @diamondslab Suite — Complete ERC-2535 Diamond development toolkit:
  - `@diamondslab/diamonds` 1.3.2 — Core Diamond utilities
  - `@diamondslab/hardhat-diamonds` 1.1.15 — Hardhat plugin for Diamond deployment, ABI generation, TypeChain types
  - `@diamondslab/diamonds-hardhat-foundry` 2.4.0 — Foundry-Hardhat bridge (fuzz bases, deployment, helper generation)
  - `@diamondslab/diamonds-monitor` 1.0.4 — Runtime monitoring and analytics

**Testing:**
- Mocha (via Hardhat Toolbox) — TypeScript test runner
- Chai 4.5.0 — Assertion library with `chai-as-promised` and `@nomicfoundation/hardhat-chai-matchers`
- Sinon 21.0.1 — Stubs/mocks for Hardhat tests
- Foundry/Forge — Solidity-native fuzz tests (`test/foundry/fuzz/`) and invariant tests (`test/foundry/invariant/`)
- solidity-coverage 0.8.17 — Hardhat coverage with `lcov` reports
- hardhat-gas-reporter 1.0.10 — Gas consumption reporting (opt-in via `REPORT_GAS` env)
- hardhat-multichain 1.0.6 — Multi-chain fork testing harness

**Build/Dev:**
- TypeScript Compiler (via `tsc`) — Compiled output to `dist/`
- Hardhat compile — Produces artifacts in `artifacts/`, `cache/`, `typechain-types/`, `diamond-typechain-types/`, `diamond-abi/`
- Foundry compile (`forge build`) — Produces artifacts in `out/`, `cache_forge/`
- TypeChain 8.3.2 (`@typechain/hardhat`, `@typechain/ethers-v6`) — Generates typed Ethers.js v6 contract wrappers
- hardhat-abi-exporter 2.11.0 — Flat ABI export
- ESLint 9.39.2 — TypeScript/JavaScript linting (flat config: `eslint.config.mjs`)
- Prettier 3.7.4 — Code formatting for `.ts`, `.js`, `.json`, `.md`, `.sol` (via `prettier-plugin-solidity`)
- Solhint 5.2.0 — Solidity linting (`.solhint.json`)
- Forge Formatter — Solidity formatting (`forge fmt`), configured in `foundry.toml`

## Key Dependencies

**Critical (Production):**
- ethers 6.16.0 — Ethereum interactions in TypeScript (tests, deployment scripts)
- web3 4.16.0 — Alternative Ethereum client library
- ts-node 10.9.2 — TypeScript execution for scripts
- dotenv 16.6.1 — Environment variable loading from `.env`
- `@openzeppelin/defender-sdk` 2.7.0 — OpenZeppelin Defender API client for managed deployment
- `@openzeppelin/defender-sdk-proposal-client` 2.7.0 — Defender proposal management

**Infrastructure:**
- Husky 9.1.7 — Git hooks (`commit-msg`, `pre-commit`, `pre-push`)
- lint-staged 15.5.2 — Pre-commit file linting
- @commitlint/cli 19.8.1 / @commitlint/config-conventional 19.8.1 — Commit message validation
- winston 3.19.0 — Logging framework (used in DevOps scripts)
- chalk 5.6.2 — Terminal coloring

**Security Scanning Tools:**
- Snyk 1.1301.2 — Dependency vulnerability scanning
- Semgrep 1.0.0 — Static analysis (custom rules in `.semgrep.yml`)
- Slither (via Python/pipx in devcontainer) — Solidity static analysis (configured in `slither.config.json`)
- @socketsecurity/cli 1.1.51 — Supply chain security scanning
- git-secrets (via Dockerfile) — Prevents committing secrets
- osv-scanner (via Go in devcontainer) — Open source vulnerability scanning
- abi2oas 0.1.4 — ABI-to-OpenAPI spec converter

## Configuration

**Environment:**
- `.env.example` provided — Template with all required variables documented
- Environment loaded via `dotenv.config()` in `hardhat.config.ts`
- Key env vars: `PRIVATE_KEY`, RPC URLs (`MAINNET_RPC`, `POLYGON_RPC`, `BASE_RPC`, `BSC_RPC`, `SEPOLIA_RPC`, etc.), block explorer API keys (`ETHERSCAN_API_KEY`, `POLYGONSCAN_API_KEY`, `BSCSCAN_API_KEY`, `BASESCAN_API_KEY`), OpenZeppelin Defender credentials (`DEFENDER_API_KEY`, `DEFENDER_API_SECRET`, `DEFENDER_RELAYER_ADDRESS`)

**Build:**
- `tsconfig.json` — ES2020 target, CommonJS modules, strict mode
- `hardhat.config.ts` — Solidity 0.8.19 with optimizer (enabled, 1000 runs), multi-chain config, etherscan verification
- `foundry.toml` — Solidity 0.8.19, optimizer (enabled, 200 runs), EVM Paris, fuzz config (256 runs dev, 10000 CI), invariant config
- `.buildrc` — Node memory (4096MB), Hardhat parallel (4 jobs), Mocha timeouts, coverage thresholds (80% min)
- `.npmrc` — `min-release-age=7d` (package stability check)
- `.solhint.json` — Extends `solhint:recommended`, compiler >=0.8.0

## Platform Requirements

**Development:**
- Node.js 18+ (recommended) or Node.js 22 (devcontainer)
- Yarn 4.x (via Corepack)
- Python 3.11+ (for Slither, Semgrep, Bandit)
- Go 1.24+ (for OSV-Scanner, optional)
- Docker (for devcontainer mode via `.devcontainer/`)
- Git (with submodules: `contracts/gnus-ai`, `diamonds/GeniusDiamond`, `.devcontainer`, `lib/forge-std`)
- Foundry (`forge`) — Install via `foundryup`

**Production:**
- No persistent backend server — contract-only project deployed to EVM blockchains
- Deployment targets: Ethereum Mainnet (chain 1), Polygon (chain 137), Base (chain 8453), BSC (chain 56)
- Testnet targets: Sepolia (chain 11155111), Polygon Amoy (chain 80002), Base Sepolia (chain 84532), BSC Testnet (chain 97)
- OpenZeppelin Defender for managed deployment and transaction relay

---

*Stack analysis: 2026-05-26*
