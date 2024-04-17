import * as dotenv from 'dotenv';

import { HardhatUserConfig, task } from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-diamond-abi';
import 'hardhat-abi-exporter';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-web3';

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const elementSeenSet = new Set<string>();
// filter out duplicate function signatures
function genSignature(name: string, inputs: Array<any>, type: string): string {
  return `${type} ${name}(${inputs.reduce((previous, key) => {
    const comma = previous.length ? ',' : '';
    return previous + comma + key.internalType;
  }, '')})`;
}

function filterDuplicateFunctions(
  abiElement: any,
  index: number,
  fullAbiL: any[],
  fullyQualifiedName: string,
) {
  if (['function', 'event'].includes(abiElement.type)) {
    const funcSignature = genSignature(abiElement.name, abiElement.inputs, abiElement.type);
    if (elementSeenSet.has(funcSignature)) {
      return false;
    }
    elementSeenSet.add(funcSignature);
  } else if (abiElement.type === 'fallback') {
    if (!fullyQualifiedName.match('GeniusDiamond.sol')) {
      return false;
    }
  }
  return true;
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    mumbai: {
      url: 'https://matic-mumbai.chainstacklabs.com',
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      chainId: 137,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      timeout: 100000,
    },
    arbitrum_sepolia: {
      url: `https://arbitrum-sepolia.blockpi.network/v1/rpc/public`,
      chainId: 421614,
      accounts: [process.env.PRIVATE_KEY || ''],
    },
    base_sepolia: {
      url: `https://sepolia.base.org`,
      chainId: 84532,
      accounts: [process.env.PRIVATE_KEY || ''],
    },
    local: {
      url: `http://127.0.0.1:8545`,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    bsc_mainnet: {
      url: `https://bsc-dataseed.bnbchain.org/`,
      chainId: 56,
      gasPrice: 3600000000,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: {
      goerli:
        process.env.ETHERSCAN_API_KEY !== undefined ? process.env.ETHERSCAN_API_KEY : '',
      polygonMumbai:
        process.env.POLYGONSCAN_API_KEY !== undefined
          ? process.env.POLYGONSCAN_API_KEY
          : '',
      polygon:
        process.env.POLYGONSCAN_API_KEY !== undefined
          ? process.env.POLYGONSCAN_API_KEY
          : '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      bsc: process.env.BSCSCAN_API_KEY || '',
      arbitrum_sepolia: process.env.ARBITRUM_API_KEY || '',
      base_sepolia: process.env.BASESCAN_API_KEY || '',
    },
    customChains: [
      // additional etherscan config
      {
        network: 'arbitrum_sepolia',
        chainId: 421614,
        urls: {
          apiURL: 'https://api-sepolia.arbiscan.io/api',
          browserURL: 'https://sepolia.arbiscan.io/',
        },
      },
      {
        network: 'base_sepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org/',
        },
      },
    ],
  },
  abiExporter: {
    flat: true,
    spacing: 2,
    pretty: true,
  },
  diamondAbi: {
    name: 'GeniusDiamond',
    strict: false,
    exclude: ['hardhat-diamond-abi/.*'],
    filter: filterDuplicateFunctions,
  },
};

export default config;
