# GNUS.ai Smart Contracts

## Overview

GNUS.ai provides a modular and upgradeable smart contract system based on the [ERC-2535 Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535). It powers a hybrid token framework featuring a parent ERC-20-like fungible GNUS token and a hierarchical ERC-1155 NFT structure for creating and managing child tokens. This design supports nested token issuance, burn-for-mint conversion mechanisms, and cross-chain extensibility via multichain testing and deployment support.

The architecture uses facet-based modularization to separate contract logic, facilitating secure upgrades and well-scoped responsibilities.

## Features

* **ERC-20 Compatible GNUS Token**: Supports standard transfer, approval, minting, and burning.
* **ERC-1155 Hierarchical NFTs**: Nested NFT creation and minting, including factory-controlled child NFTs.
* **Access-Controlled Mint/Burn**: Uses `MINTER_ROLE`, `CREATOR_ROLE`, and `NFT_PROXY_OPERATOR_ROLE` for secure permissions.
* **Burn-on-Mint Conversion**: GNUS tokens are burned to mint NFTs based on defined exchange rates.
* **Diamond Deployment System**: Fully upgradeable contracts using Diamond pattern and facet registration.
* **Multichain Test Framework**: Automated test suites span across multiple EVM-compatible networks.

## Requirements

* **Solidity Version**: ^0.8.4 or later
* **Node Version**: v18 (use `nvm` to manage)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
nvm install 18
nvm use 18
```

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/GeniusVentures/gnus-ai.git
cd gnus-ai
yarn install
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit your environment variables
vim .env
```

### 3. Compile Contracts

```bash
yarn compile
```

### 4. Run Tests

```bash
yarn test
```

### 5. Multichain Testing (e.g., Sepolia and Polygon Amoy)

```bash
yarn hardhat test-multichain ./test/integration/multichain/tests/* --chains sepolia,polygon_amoy --logs logs
```

## Test Architecture

The test suite is organized by purpose:

* `unit/` — Component-level tests
* `integration/` — End-to-end cross-contract and multichain validations
* `deployment/` — Facet and selector integrity checks

Key utilities:

* **Mocha & Chai**: Test framework and assertions
* **Hardhat Multichain Plugin**: Network abstraction for multichain test coverage
* **Snapshot & Revert**: Ensures deterministic test isolation

## Directory Structure

```bash
├── contracts/                # Solidity source code
├── test/                    # Unit and integration test cases
│   ├── unit/                # Core feature testing
│   ├── integration/         # Cross-module and multichain validation
│   └── deployment/          # Facet selector verification
├── diamonds/                # Diamond deployment configurations
├── scripts/                 # Utilities and deployment helpers
├── typechain-types/        # Auto-generated contract types
├── hardhat.config.ts       # Hardhat + multichain configuration
```

## Deployment & Upgrade

Contracts are deployed and upgraded via the Diamond deployment orchestrator:

* Uses `@gnus.ai/diamonds` module
* Supports multiple deployment strategies (local, OpenZeppelin Defender, remote RPC)
* Manages protocol versions, facet selectors, and initializer tracking

Deployment configs reside in `diamonds/GeniusDiamond/geniusdiamond.config.json`.

## License

MIT License. See `LICENSE` file for more details.

## Contact

For inquiries or support, contact: [super@gnus.ai](mailto:support@gnus.ai)

---

This project represents the foundational on-chain system for GNUS.ai's decentralized asset framework.
