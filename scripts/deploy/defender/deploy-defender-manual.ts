#!/usr/bin/env npx ts-node

/**
 * Alternative deployment script for OpenZeppelin Defender that bypasses Hardhat account provider.  Connection information is hard coded.
 * Deploys GNUS.AI Diamond contracts using DefenderDiamondDeployer with manual provider setup
 */

import { DefenderDiamondDeployer, DefenderDiamondDeployerConfig } from '../../setup/DefenderDiamondDeployer';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeploymentOptions {
  diamondName: string;
  networkName: string;
  verbose?: boolean;
  autoApprove?: boolean;
  viaType?: 'Safe' | 'EOA';
}

/**
 * Setup provider and signer manually without Hardhat account provider
 */
async function setupManualProviderAndSigner(networkName: string) {
  console.log('🔧 Setting up manual provider and signer...');
  
  // Get RPC URL for the network
  let rpcUrl: string;
  let chainId: number;
  
  switch (networkName) {
    case 'sepolia':
      rpcUrl = process.env.SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/<YOUR_ALCHEMY_API_KEY>';
      chainId = 11155111;
      break;
    case 'mainnet':
      rpcUrl = process.env.MAINNET_RPC || 'https://eth-mainnet.g.alchemy.com/v2/<YOUR_ALCHEMY_API_KEY>';
      chainId = 1;
      break;
    case 'polygon':
      rpcUrl = process.env.POLYGON_RPC || 'https://polygon-mainnet.g.alchemy.com/v2/<YOUR_ALCHEMY_API_KEY>';
      chainId = 137;
      break;
    case 'polygon_amoy':
      rpcUrl = process.env.POLYGON_AMOY_RPC || 'https://polygon-mumbai.g.alchemy.com/v2/<YOUR_ALCHEMY_API_KEY>';
      chainId = 80002;
      break;
    default:
      throw new Error(`Unsupported network: ${networkName}`);
  }

  if (!rpcUrl) {
    throw new Error(`RPC URL not configured for network: ${networkName}`);
  }

  // Create provider manually
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Create signer from private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }
  
  const signer = new ethers.Wallet(privateKey, provider);
  
  // Verify connection
  try {
    const network = await provider.getNetwork();
    const signerAddress = await signer.getAddress();
    const balance = await provider.getBalance(signerAddress);
    
    console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`👤 Signer address: ${signerAddress}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (Number(network.chainId) !== chainId) {
      console.warn(`⚠️ Warning: Expected chain ID ${chainId}, got ${network.chainId}`);
    }
    
    return { provider, signer, chainId: Number(network.chainId) };
  } catch (error) {
    throw new Error(`Failed to connect to network: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main deployment function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting OpenZeppelin Defender Diamond Deployment (Manual Mode)');
  console.log('================================================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const diamondName = args[0] || 'GeniusDiamond';
  const networkName = args[1] || 'sepolia';

  // Validate network
  if (networkName === 'hardhat' || networkName === 'localhost') {
    throw new Error('Cannot deploy to hardhat/localhost network using Defender. Please specify a live network.');
  }

  const options: DeploymentOptions = {
    diamondName,
    networkName,
    verbose: process.env.VERBOSE_DEPLOYMENT === 'true',
    autoApprove: process.env.AUTO_APPROVE_DEFENDER_PROPOSALS === 'true',
    viaType: (process.env.DEFENDER_VIA_TYPE as 'Safe' | 'EOA') || 'EOA'
  };

  console.log(`Diamond Name: ${options.diamondName}`);
  console.log(`Network: ${options.networkName}`);
  console.log(`Via Type: ${options.viaType}`);
  console.log(`Auto Approve: ${options.autoApprove}`);
  console.log('================================================');

  try {
    // Setup manual provider and signer
    const { provider, signer, chainId } = await setupManualProviderAndSigner(networkName);

    // Create configuration using environment variables
    const baseConfig = DefenderDiamondDeployer.createConfigFromEnv({
      diamondName: options.diamondName,
      networkName: options.networkName,
      chainId: chainId,
      verbose: options.verbose,
      autoApprove: options.autoApprove,
      viaType: options.viaType
    });

    // Add manual provider and signer to bypass Hardhat account provider
    const config: DefenderDiamondDeployerConfig = {
      ...baseConfig,
      provider: provider as any,
      signer: signer as any
    };

    console.log(`Network: ${config.networkName} (Chain ID: ${config.chainId})`);
    console.log(`Auto-approve: ${config.autoApprove ? 'Yes' : 'No'}`);
    console.log(`Via Type: ${config.viaType}`);
    console.log(`Via Address: ${config.via}`);
    console.log(`Verbose: ${config.verbose ? 'Yes' : 'No'}`);
    console.log('');

    // Initialize the DefenderDiamondDeployer
    console.log('🔧 Initializing DefenderDiamondDeployer...');
    const deployer = await DefenderDiamondDeployer.getInstance(config);
    
    // Execute the deployment
    console.log('💎 Starting diamond deployment...');
    const diamond = await deployer.deployDiamond();
    
    // Get deployment information
    const deployedData = diamond.getDeployedDiamondData();
    console.log('');
    console.log('✅ Deployment completed successfully!');
    console.log('=====================================');
    console.log(`💎 Diamond Address: ${deployedData.DiamondAddress}`);
    console.log(`👤 Deployer: ${deployedData.DeployerAddress}`);
    console.log(`🎯 Facets Deployed: ${Object.keys(deployedData.DeployedFacets || {}).length}`);
    console.log(`⛓️ Network: ${networkName} (${chainId})`);
    console.log('');

    // Display next steps
    console.log('🎉 Next Steps:');
    console.log('==============');
    console.log('1. Verify the deployment on the block explorer');
    console.log('2. Test the diamond functionality');
    console.log('3. Configure any additional settings');
    if (!config.autoApprove && config.viaType === 'Safe') {
      console.log('4. Approve pending transactions in your Gnosis Safe');
    }
    console.log('');
    
  } catch (error) {
    console.log('');
    console.log('❌ Deployment Failed!');
    console.log('=====================');
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.log('Stack Trace:');
      console.log(error.stack);
    }
    console.log('');
    console.log('💡 Troubleshooting Tips:');
    console.log('========================');
    console.log('1. Check your Defender API credentials');
    console.log('2. Verify network configuration');
    console.log('3. Ensure sufficient balance in relayer');
    console.log('4. Check gas price settings');
    console.log('5. Review Safe multi-sig configuration if applicable');
    
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the deployment
main().catch(console.error);
