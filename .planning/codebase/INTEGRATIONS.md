# External Integrations

**Analysis Date:** 2026-05-26

## APIs & External Services

**Blockchain RPC Providers:**
- Ethereum Mainnet RPC — Configured via `MAINNET_RPC` env var. Used for mainnet deployment, forking, and verification.
- Polygon RPC — Configured via `POLYGON_RPC` env var. Used for Polygon mainnet deployment and forking.
- Base RPC — Configured via `BASE_RPC` env var. Used for Base mainnet deployment and forking.
- BSC RPC — Configured via `BSC_RPC` env var. Used for BSC mainnet deployment and forking.
- Sepolia RPC — Configured via `SEPOLIA_RPC` env var. Used for Ethereum Sepolia testnet.
- Polygon Amoy RPC — Configured via `POLYGON_AMOY_RPC` env var. Used for Polygon Amoy testnet.
- Base Sepolia RPC — Configured via `BASE_SEPOLIA_RPC` env var. Used for Base Sepolia testnet.
- BSC Testnet RPC — Configured via `BSC_TESTNET_RPC` env var. Used for BSC Testnet.
- All RPC URLs configured in `hardhat.config.ts` (lines 52–68), `foundry.toml` (lines 66–69), and `config/networks/*.json`

**OpenZeppelin Defender:**
- Managed smart contract deployment, transaction relay, and admin workflows
- SDK: `@openzeppelin/defender-sdk` 2.7.0, `@openzeppelin/defender-sdk-proposal-client` 2.7.0
- Auth: `DEFENDER_API_KEY` + `DEFENDER_API_SECRET` env vars
- Relayer: `DEFENDER_RELAYER_ADDRESS` env var (wallet address that pays gas)
- Safe multi-sig support via `DEFENDER_VIA_TYPE=Safe` and `DEFENDER_SAFE_ADDRESS`
- Configuration documented in `docs/DEFENDER_CONFIGURATION.md` and `docs/DEFENDER_DEPLOYMENT.md`
- Supported transaction types: EOA relay and Safe multi-sig proposals
- Auto-approve option: `DEFENDER_AUTO_APPROVE` env var (default false)

**Block Explorer APIs (Contract Verification):**
- Etherscan — `ETHERSCAN_API_KEY` env var. Configured at `hardhat.config.ts` line 332. URLs: `https://api.etherscan.io/api`
- Polygonscan — `POLYGONSCAN_API_KEY` env var. Configured at `hardhat.config.ts` line 335. URLs: `https://api.polygonscan.com/api`, `https://api-amoy.polygonscan.com/api`
- BSCscan — `BSCSCAN_API_KEY` env var. Configured at `hardhat.config.ts` line 348. URLs: `https://api.bscscan.com/api`, `https://api-testnet.bscscan.com/api`
- Basescan — `BASESCAN_API_KEY` env var. Configured at `hardhat.config.ts` line 351. URLs: `https://api.basescan.org/api`, `https://api-sepolia.basescan.org/api`
- Arbiscan — `ARBITRUM_API_KEY` env var. Configured at `hardhat.config.ts` line 350. URL: `https://api-sepolia.arbiscan.io/api`

**NFT Metadata URI:**
- Token metadata base URL: `https://nft.gnus.ai/{id}` — defined in `contracts/gnus-ai/GNUSConstants.sol` line 25
- Metadata is served externally; no on-chain or IPFS storage implemented in contracts

## Data Storage

**Databases:**
- No traditional database — all persistent state stored on-chain via Ethereum storage (Diamond proxy storage pattern)
- Storage libraries: `GNUSNFTFactoryStorage.sol`, `GNUSControlStorage.sol`, `GeniusAIStorage.sol`, `GNUSWithdrawLimiterStorage.sol` (all in `contracts/gnus-ai/`)
- Each storage library uses `keccak256` hash slot positioning for Diamond storage isolation

**File Storage:**
- No external file storage integration (no IPFS, Arweave, S3)
- Deployment artifacts stored locally: `diamonds/GeniusDiamond/deployments/` (JSON deployment records)
- Generated artifacts: `artifacts/`, `diamond-abi/`, `typechain-types/`, `diamond-typechain-types/`

**Caching:**
- `hardhat-cache` volume in devcontainer — compilation cache for Hardhat
- `yarn-cache` volume in devcontainer — Yarn package cache
- `cache_forge/` directory — Foundry compilation cache

## Authentication & Identity

**Auth Provider:**
- No external auth provider — fully on-chain role-based access control
- Access control implemented in `contracts/gnus-ai/GeniusAccessControl.sol` and `contracts/gnus-ai/DiamondInitFacet.sol`
- Roles: `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `CREATOR_ROLE`, `NFT_PROXY_OPERATOR_ROLE`, `UPGRADER_ROLE`
- Super admin pattern: Owner set in Diamond constructor, cannot be revoked
- All authorization enforced by Solidity `require` statements and OpenZeppelin AccessControl modifiers in facets

## Monitoring & Observability

**Error Tracking:**
- No external error tracking service (no Sentry, Datadog, etc.)
- Winston logger available as dependency (`winston` 3.19.0 in `package.json`) for DevOps scripts
- `scripts/devops/security-monitoring-webhook.ts` and `scripts/devops/security-alerting.ts` — custom monitoring scripts for security events
- `scripts/devops/perf-monitor.ts` — performance monitoring
- `scripts/devops/health-check.ts` — health checking script

**Logs:**
- Hardhat console output (via `hardhat/console.sol` imported in `DiamondInitFacet.sol`)
- Multi-chain test logs: `--logs logs` flag for `test-multichain`
- Winston logger in `scripts/utils/logger.ts` for DevOps scripts

**Security Scanning:**
- Slither — Static analysis for Solidity (config: `slither.config.json`, run via `yarn slither:scan`)
- Semgrep — Custom Solidity/TypeScript rules (config: `.semgrep.yml`, run via `yarn semgrep:scan`)
- Snyk — Dependency vulnerability scanning (run via `yarn snyk:test`)
- Socket Security — Supply chain risk assessment (run via `yarn socket:scan`)
- OSV Scanner — Open source vulnerability database (run via `yarn osv:scan`)
- git-secrets — Prevents committing private keys/API tokens (run via `yarn git-secrets:scan`)
- Comprehensive security check: `yarn security-check` runs all of the above

**Alerting & Notification:**
- Slack webhook: `NOTIFICATION_SLACK_WEBHOOK` env var (referenced in `.buildrc` line 71)
- Discord webhook: `NOTIFICATION_DISCORD_WEBHOOK` env var (referenced in `.buildrc` line 72)
- GitHub Issues notification: `NOTIFICATION_GITHUB_ISSUES` env var (referenced in `.buildrc` line 73)
- `scripts/devops/security-monitoring-webhook.ts` and `scripts/devops/security-alerting.ts` — custom webhook/alert handling

## CI/CD & Deployment

**Hosting:**
- Fully on-chain (EVM blockchains) — no traditional web hosting
- Smart contracts deployed to: Ethereum Mainnet, Polygon, Base, BSC (and respective testnets)

**CI Pipeline:**
- GitHub Actions (referenced in `docs/DEFENDER_DEPLOYMENT.md` lines 304–338, `.devcontainer/scripts/github-actions-setup.sh`)
- Local Husky hooks for pre-commit/pre-push validation (`.husky/` directory)
- commitlint for commit message formatting (`.commitlintrc.json`)
- lint-staged for staged file linting (`.lintstagedrc.json`)
- Container registry manager: `scripts/devops/container-registry-manager.sh` (build, push, pull Docker images)

**Deployment Options:**
- Hardhat deployment: Via `@diamondslab/hardhat-diamonds` and `hardhat-multichain`
- OpenZeppelin Defender: Via `DefenderDiamondDeployer` with API-based relay
- Foundry deployment: `npx hardhat diamonds-forge:deploy` (for testing)
- RPC deployment: `scripts/deploy/rpc/` and `scripts/setup/RPCDiamondDeployer.ts`

## Environment Configuration

**Required env vars (for full functionality):**
- `PRIVATE_KEY` — Deployer/signer private key
- RPC URLs: `MAINNET_RPC`, `POLYGON_RPC`, `BASE_RPC`, `BSC_RPC` (at minimum the target deployment network)
- Block explorer keys for verification (e.g., `ETHERSCAN_API_KEY`, `POLYGONSCAN_API_KEY`)
- `DEFENDER_API_KEY` + `DEFENDER_API_SECRET` + `DEFENDER_RELAYER_ADDRESS` (for OZ Defender deployments)
- `DRPC_API_KEY` — DRPC RPC provider key (referenced in `.env.example`)

**Secrets location:**
- `.env` file (git-ignored) — local development secrets
- OpenZeppelin Defender — API credentials managed via Defender dashboard
- `.devcontainer/vault-mode.conf` — HashiCorp Vault for containerized secret management
- GitHub Actions secrets — CI/CD credentials (`secrets.DEFENDER_API_KEY`, etc.)
- git-secrets patterns configured in `Dockerfile` to detect: private keys (`0x` prefixed 64-char hex), mnemonics, API key patterns

## Webhooks & Callbacks

**Incoming:**
- Security monitoring webhook — `scripts/devops/security-monitoring-webhook.ts` (receives security scan results/webhooks)
- Slack/Discord notification webhooks — Referenced in `.buildrc` (lines 71–72) for build/deploy alerts

**Outgoing:**
- Contract verification: Outbound API calls to Etherscan/Polygonscan/BSCscan/Basescan/Arbiscan APIs during deployment verification
- OpenZeppelin Defender API: Outbound calls for deployment proposals, transaction relay, and status monitoring
- Security scanning tools: Outbound API calls to Snyk, Socket, and OSV databases for vulnerability checks
- Container registry: Outbound pushes to Docker registries via `container-registry-manager.sh`

## DevContainer Infrastructure

**Containerized Development Environment:**
- Managed via `.devcontainer/` submodule (source: `https://github.com/diamondslab/diamonds-devcontainer.git`)
- Docker Compose multi-service setup (`.devcontainer/docker-compose.dev.yml`, `.devcontainer/docker-compose.yml`)
- Optional service profiles: database (PostgreSQL), IPFS, search (Elasticsearch)
- HashiCorp Vault for secret management in container
- Container-based tools: Hardhat, Foundry, Slither, Semgrep, Snyk, git-secrets, OSV-Scanner
- Exposed ports: 8545/8546/8555/8556 (blockchain nodes), 3000 (frontend), 5000 (API), 8080 (docs)

## External Contracts & Dependencies (On-Chain)

**@gnus.ai/contracts-upgradeable-diamond (v4.5.0):**
- Forked upgradeable OpenZeppelin contracts adapted for Diamond proxy
- Used by all core facets (`GNUSERC1155MaxSupply.sol`, `DiamondInitFacet.sol`, `GeniusDiamond.sol`, etc.)
- Imports include: `ERC1155SupplyUpgradeable`, `PausableUpgradeable`, `ERC1155BurnableUpgradeable`, `AccessControlEnumerableUpgradeable`, `Initializable`, `ContextUpgradeable`, `IERC20Upgradeable`, `ERC165StorageUpgradeable`, `IERC1155Upgradeable`

**contracts-starter (diamond-2-hardhat):**
- Reference Diamond implementation from `https://github.com/mudgen/diamond-2-hardhat.git`
- Used by `GeniusDiamond.sol` and facets: `Diamond.sol`, `DiamondCutFacet.sol`, `DiamondLoupeFacet.sol`, `LibDiamond.sol`
- Provides base Diamond proxy infrastructure

**forge-std (Foundry Standard Library):**
- Git submodule at `lib/forge-std/`
- Source: `https://github.com/foundry-rs/forge-std`
- Used by all Foundry test files in `test/foundry/`

---

*Integration audit: 2026-05-26*
