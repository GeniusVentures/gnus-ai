import { ethers, Contract, Provider, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { deployments } from '../../notes/archive/deployments'; // Adjust the path to your `deployments.ts`
import * as dotenv from 'dotenv';

dotenv.config();

const ABI = [
  'function supportsInterface(bytes4 interfaceId) external view returns (bool)',
  'function getRoleAdmin(bytes32 role) external view returns (bytes32)',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function getRoleMember(bytes32 role, uint256 index) external view returns (address)',
  'function getRoleMemberCount(bytes32 role) external view returns (uint256)',
];

// Predefined role constants
const ROLE_NAMES = {
  DEFAULT_ADMIN_ROLE: 'DEFAULT_ADMIN_ROLE',
  UPGRADER_ROLE: 'UPGRADER_ROLE',
  NFT_PROXY_OPERATOR_ROLE: 'NFT_PROXY_OPERATOR_ROLE',
  MINTER_ROLE: 'MINTER_ROLE',
  CREATOR_ROLE: 'CREATOR_ROLE',
};

// Generate keccak256 hashes for all roles
const ROLES = Object.entries(ROLE_NAMES).reduce(
  (acc: { [key: string]: string }, [key, value]) => {
    acc[key] = keccak256(toUtf8Bytes(value));
    return acc;
  },
  {},
);

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

const INFURA_API_KEY = process.env.INFURA_API_KEY;

async function fetchRoles(
  network: string,
  contractAddress: string,
  provider: Provider,
) {
  const contract = new ethers.Contract(contractAddress, ABI, provider);
  const roles: { [key: string]: string[] } = {};

  console.log(`\nFetching roles for contract: ${contractAddress} on ${network}`);

  for (const [roleName, roleHash] of Object.entries(ROLES)) {
    try {
      const memberCount = await contract.getRoleMemberCount(roleHash);
      roles[roleName] = [];

      for (let i = 0; i < memberCount; i++) {
        const member = await contract.getRoleMember(roleHash, i);
        roles[roleName].push(member);
      }

      console.log(`Role: ${roleName}`);
      console.log(`  Members: ${roles[roleName].join(', ')}`);
    } catch (error) {
      console.error(
        `Error fetching role ${roleName} for ${contractAddress}: ${(error as any).message}`,
      );
      roles[roleName] = [];
    }
  }

  return roles;
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

    const roles = await fetchRoles(network, DiamondAddress, provider);
    console.log(`Roles on ${network}:`, roles);
  }
}

main()
  .then(() => console.log('Done'))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
