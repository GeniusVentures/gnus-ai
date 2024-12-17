# GNUS.AI NFT contracts with payment channels

- [GNUS.AI NFT contracts with payment channels](#gnusai-nft-contracts-with-payment-channels)
    - [Overview](#overview)
    - [Solidity Version](#solidity-version)
    - [Test And Deploy Locally using hardhat and typescript](#test-and-deploy-locally-using-hardhat-and-typescript)

## Overview
GNUS.AI Smart contract includes NFT creation and minting with a Payment channel that is a generalized payment network that supports efficient off-chain token transfer with the Genius Token on on-chain ethereum. 
These contracts use Diamond Storage/Facets to split the contracts into deployable pieces and for upgradeability.

## Solidity Version
Solidity `^0.8.4` or above is required to compile these smart contracts

## Test And Deploy Locally using hardhat and typescript
1. Install node >= v16: [https://nodejs.org](https://nodejs.org). Use nvm to better manage node versions. 
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
nvm install 18
nvm use 18
```

2. Clone this repository and move into the gnus-ai root directory. 
```bash
git clone https://github.com
cd gnus-ai
```

3. Copy the .env.example to a .env file and add keys
```bash
cp .env.example .env'
vim .env
```

4. Install the node dependencies in the local node_modules folder. 
```bash
npm install
``` 

5. Compiling the contracts
```bash
npm run compile 
```

6. Compiling and testing the contracts
```bash
npm run test
```



