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

4. Install the node dependencies in the local node_modules folder. 
```bash
yarn install
``` 

```bash
yarn compile 
```

### 4. Run Tests

```bash
yarn test
```

7. Testing Multichain Forks for Sepolia and Polygon Amoy
```bash
yarn hardhat test-multichain ./test/integration/multichain/tests/* --chains sepolia,polygon_amoy --logs logs
```
