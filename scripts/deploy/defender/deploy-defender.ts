#!/usr/bin/env npx ts-node

/**
 * Main deployment script for OpenZeppelin Defender
 * Deploys GNUS.AI Diamond contracts using DefenderDiamondDeployer
 */

import { DefenderDiamondDeployer, DefenderDiamondDeployerConfig } from '../../setup/DefenderDiamondDeployer';
import { ethers } from 'hardhat';
import hre from 'hardhat';
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
 * Main deployment function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting OpenZeppelin Defender Diamond Deployment');
  console.log('================================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const diamondName = args[0] || 'GeniusDiamond';
  const networkName = args[1] || hre.network.name;

  // Validate network
  if (!hre.network.config || networkName === 'hardhat') {
    throw new Error('Cannot deploy to hardhat network using Defender. Please specify a live network.');
  }

  const options: DeploymentOptions = {
    diamondName,
    networkName,
    verbose: process.env.VERBOSE === 'true' || true,
    autoApprove: process.env.AUTO_APPROVE_DEFENDER_PROPOSALS === 'true',
    viaType: (process.env.DEFENDER_VIA_TYPE as 'Safe' | 'EOA') || 'Safe',
  };

  console.log(`Diamond Name: ${options.diamondName}`);
  console.log(`Network: ${options.networkName}`);
  console.log(`Via Type: ${options.viaType}`);
  console.log(`Auto Approve: ${options.autoApprove}`);
  console.log('================================================');

  try {
    // Create configuration
    const config = DefenderDiamondDeployer.createConfigFromEnv({
      diamondName: options.diamondName,
      networkName: options.networkName,
      autoApprove: options.autoApprove,
      verbose: options.verbose,
      viaType: options.viaType,
      signer: await ethers.provider.getSigner(process.env.DEFENDER_EOA_ADDRESS),
    });

    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log(`Network: ${networkName} (Chain ID: ${Number(network.chainId)})`);
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
    console.log(`⛓️ Network: ${networkName} (${Number(network.chainId)})`);
    console.log('');

    // Provide next steps
    console.log('📋 Next Steps:');
    console.log('==============');
    console.log('1. Verify contracts on block explorer');
    console.log('2. Update frontend configuration with new address');
    console.log('3. Run integration tests');
    console.log(`4. Monitor deployment at: https://defender.openzeppelin.com/`);
    
  } catch (error) {
    console.error('');
    console.error('❌ Deployment Failed!');
    console.error('=====================');
    console.error('Error:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.stack) {
      console.error('Stack Trace:');
      console.error(error.stack);
    }
    
    console.error('');
    console.error('💡 Troubleshooting Tips:');
    console.error('========================');
    console.error('1. Check your Defender API credentials');
    console.error('2. Verify network configuration');
    console.error('3. Ensure sufficient balance in relayer');
    console.error('4. Check gas price settings');
    console.error('5. Review Safe multi-sig configuration if applicable');
    
    process.exit(1);
  }
}

/**
 * Script usage information
 */
function showUsage(): void {
  console.log('Usage: npx ts-node scripts/deploy/deploy-defender.ts [DIAMOND_NAME] [NETWORK_NAME]');
  console.log('');
  console.log('Arguments:');
  console.log('  DIAMOND_NAME    Name of the diamond to deploy (default: GeniusDiamond)');
  console.log('  NETWORK_NAME    Target network name (default: current network)');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DEFENDER_API_KEY         OpenZeppelin Defender API Key');
  console.log('  DEFENDER_API_SECRET      OpenZeppelin Defender API Secret');
  console.log('  DEFENDER_RELAYER_ADDRESS Relayer address for transactions');
  console.log('  DEFENDER_AUTO_APPROVE    Auto-approve transactions (true/false)');
  console.log('  DEFENDER_VIA_TYPE        Transaction method (Safe/EOA)');
  console.log('  DEFENDER_SAFE_ADDRESS    Safe multi-sig address (if via type is Safe)');
  console.log('  DEFENDER_GAS_LIMIT       Gas limit for transactions');
  console.log('  DEFENDER_MAX_GAS_PRICE   Maximum gas price in wei');
  console.log('  VERBOSE                  Enable verbose logging (true/false)');
  console.log('');
  console.log('Examples:');
  console.log('  npx ts-node scripts/deploy/deploy-defender.ts');
  console.log('  npx ts-node scripts/deploy/deploy-defender.ts GeniusDiamond polygon');
  console.log('  DEFENDER_AUTO_APPROVE=true npx ts-node scripts/deploy/deploy-defender.ts');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run main function
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
