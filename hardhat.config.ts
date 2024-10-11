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
    hardhat: {
      forking: process.env.FORK_URL
        ? {
            url: process.env.FORK_URL,
            blockNumber: process.env.FORK_BLOCK_NUMBER
              ? parseInt(process.env.FORK_BLOCK_NUMBER)
              : undefined,
          }
        : undefined,
    },
    polygon: {
      url: `https://lb.drpc.org/ogrpc?network=polygon&dkey=${process.env.DRPC_API_KEY}`,
      chainId: 137,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      url: `https://nd-964-217-560.p2pify.com/${process.env.CHAINSTACK_ETH_TEST_API_KEY}`,
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      timeout: 100000,
    },
    arbitrum_sepolia: {
      url: `https://lb.drpc.org/ogrpc?network=arbitrum-sepolia&dkey=${process.env.DRPC_API_KEY}`,
      chainId: 421614,
      accounts: [process.env.PRIVATE_KEY || ''],
    },
    arbitrum: {
      url: `https://lb.drpc.org/ogrpc?network=arbitrum&dkey=${process.env.DRPC_API_KEY}`,
      chainId: 42161,
      accounts: [process.env.PRIVATE_KEY || ''],
    },
    base_sepolia: {
      url: `https://base-sepolia.core.chainstack.com/${process.env.CHAINSTACK_BASE_TEST_API_KEY}`,
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    bsc_testnet: {
      url: `https://bsc-testnet.core.chainstack.com/${process.env.CHAINSTACK_BSC_TEST_API_KEY}`,
      chainId: 97,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    polygon_amoy: {
      url: `https://lb.drpc.org/ogrpc?network=polygon-amoy&dkey=${process.env.DRPC_API_KEY}`,
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    local: {
      url: `http://127.0.0.1:8545`,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mainnet: {
      url: `https://lb.drpc.org/ogrpc?network=ethereum=${process.env.DRPC_API_KEY}`,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    bsc: {
      url: `https://lb.drpc.org/ogrpc?network=bsc&dkey=${process.env.DRPC_API_KEY}`,
      chainId: 56,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    base: {
      url: `https://lb.drpc.org/ogrpc?network=base&dkey=${process.env.DRPC_API_KEY}`,
      chainId: 8453,
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
      polygon_amoy:
          process.env.POLYGONSCAN_API_KEY !== undefined
              ? process.env.POLYGONSCAN_API_KEY
              : '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      bsc: process.env.BSCSCAN_API_KEY || '',
      bsc_testnet: process.env.BSCSCAN_API_KEY || '',
      arbitrum_sepolia: process.env.ARBITRUM_API_KEY || '',
      base_sepolia: process.env.BASESCAN_API_KEY || '',
      base: process.env.BASESCAN_API_KEY || '',
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
      {
        network: 'bsc_testnet',
        chainId: 97,
        urls: {
          apiURL: 'https://api-testnet.bscscan.com/api',
          browserURL: 'https://testnet.bscscan.com',
        },
      },
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'polygon_amoy',
        chainId: 80002,
        urls: {
          apiURL: 'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com/',
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
    exclude: [
      'hardhat-diamond-abi/.*',
      'Zether',
      'BurnVerifier',
      'InnerVerifier',
      'ZetherVerifier',
      'Migrations',
      'libEncryption',
      'contracts/mocks/.*',
    ],
    filter: filterDuplicateFunctions,
  },
};

export default config;
