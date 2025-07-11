import { ethers, Contract, Provider, JsonRpcProvider } from 'ethers';
import { deployments } from '../../notes/archive/deployments'; // Adjust the path to your `deployments.ts`
import * as dotenv from 'dotenv';

dotenv.config();

// Interface IDs for ERC20 and ERC1155
const ERC20_INTERFACE_ID = '0x36372b07';
const ERC1155_INTERFACE_ID = '0xd9b67a26';

// Function ABI for supportsInterface
const ABI = ['function supportsInterface(bytes4 interfaceId) external view returns (bool)'];

// Load RPC URLs from environment or define them here
const RPC_URLS: { [key: string]: string } = {
  mainnet: process.env.MAINNET_RPC || '',
  polygon: process.env.POLYGON_RPC || '',
  polygon_amoy: process.env.POLYGON_AMOY_RPC || '',
  sepolia: process.env.SEPOLIA_RPC || '',
  base: process.env.BASE_RPC || '',
  base_sepolia: process.env.BASE_SEPOLIA_RPC || '',
  bsc: process.env.BSC_RPC || '',
  bsc_testnet: process.env.BSC_TESTNET_RPC || '',
};

// Load Infura API Key from environment
const INFURA_API_KEY = process.env.INFURA_API_KEY;

async function checkERC165Support(
  network: string,
  diamondAddress: string,
  provider: Provider,
) {
  const contract = new Contract(diamondAddress, ABI, provider);

  const results: { [key: string]: boolean } = {};
  try {
    results.ERC20 = await contract.supportsInterface(ERC20_INTERFACE_ID);
    results.ERC1155 = await contract.supportsInterface(ERC1155_INTERFACE_ID);
  } catch (error) {
    console.error(
      `Error querying ${network} (${diamondAddress}): ${(error as any).message}`,
    );
    results.ERC20 = false;
    results.ERC1155 = false;
  }
  return results;
}

async function main() {
  for (const [network, data] of Object.entries(deployments)) {
    if (!data.DiamondAddress || !RPC_URLS[network]) {
      console.warn(`Skipping ${network}: Missing DiamondAddress or RPC URL.`);
      continue;
    }

    console.log(`\nChecking ${network}...`);
    const RPC_ENDPOINT = RPC_URLS[network] + INFURA_API_KEY;
    const provider = new JsonRpcProvider(RPC_ENDPOINT);

    const { DiamondAddress } = data;
    const results = await checkERC165Support(network, DiamondAddress, provider);

    console.log(`Network: ${network}`);
    console.log(`  DiamondAddress: ${DiamondAddress}`);
    console.log(`  Supports ERC20: ${results.ERC20}`);
    console.log(`  Supports ERC1155: ${results.ERC1155}`);
  }
}

main()
  .then(() => console.log('Done'))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
