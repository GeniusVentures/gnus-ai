import { ethers, Contract, Provider, JsonRpcProvider, formatUnits } from 'ethers';
import { deployments } from '../../notes/archive/deployments'; // Adjust the path to your `deployments.ts`
import * as dotenv from 'dotenv';

dotenv.config();

// Function ABI for supportsInterface and totalSupply
const ABI = [
  'function supportsInterface(bytes4 interfaceId) external view returns (bool)',
  'function totalSupply() external view returns (uint256)',
];

// Interface ID for ERC20
const ERC20_INTERFACE_ID = '0x36372b07';

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

async function checkTotalSupply(
  network: string,
  diamondAddress: string,
  provider: Provider,
) {
  const contract = new ethers.Contract(diamondAddress, ABI, provider);
  let totalSupply: string | null = null;

  try {
    // Check if the contract supports the ERC20 interface
    const supportsERC20 = await contract.supportsInterface(ERC20_INTERFACE_ID);
    if (!supportsERC20) {
      console.warn(`Contract at ${diamondAddress} on ${network} does not support ERC20.`);
      return null;
    }

    // Query totalSupply
    const supply = await contract.totalSupply();
    totalSupply = formatUnits(supply, 18); // Format based on 18 decimals
  } catch (error) {
    console.error(
      `Error querying totalSupply for ${diamondAddress} on ${network}: ${(error as any).message}`,
    );
  }

  return totalSupply;
}

async function main() {
  for (const [network, data] of Object.entries(deployments)) {
    if (!data.DiamondAddress || !RPC_URLS[network]) {
      console.warn(`Skipping ${network}: Missing DiamondAddress or RPC URL.`);
      continue;
    }

    console.log(`\nChecking ${network}...`);
    const RPC_ENDPOINT = `${RPC_URLS[network]}${INFURA_API_KEY}`;
    const provider = new JsonRpcProvider(RPC_ENDPOINT);

    const { DiamondAddress } = data;
    const totalSupply = await checkTotalSupply(network, DiamondAddress, provider);

    console.log(`Network: ${network}`);
    console.log(`  DiamondAddress: ${DiamondAddress}`);
    console.log(`  Total Supply: ${totalSupply ? totalSupply : 'N/A'}`);
  }
}

main()
  .then(() => console.log('Done'))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
