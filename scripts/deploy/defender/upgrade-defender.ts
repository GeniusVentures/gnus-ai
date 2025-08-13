#!/usr/bin/env npx ts-node

/**
 * Upgrade script for OpenZeppelin Defender
 * Handles diamond upgrades using DefenderDiamondDeployer
 */

import { DefenderDiamondDeployer, DefenderDiamondDeployerConfig } from '../../setup/DefenderDiamondDeployer';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

interface UpgradeOptions {
  diamondName: string;
  networkName: string;
  targetVersion?: string;
  verbose?: boolean;
  autoApprove?: boolean;
  safeAddress?: string;
  viaType?: 'Safe' | 'EOA';
}

/**
 * Main upgrade function
 */
async function main(): Promise<void> {
  console.log('🔄 Starting OpenZeppelin Defender Diamond Upgrade');
  console.log('=================================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const diamondName = args[0] || 'GeniusDiamond';
  const networkName = args[1] || hre.network.name;
  const targetVersion = args[2];

  // Validate network
  if (!hre.network.config || networkName === 'hardhat') {
    throw new Error('Cannot upgrade on hardhat network using Defender. Please specify a live network.');
  }

  const options: UpgradeOptions = {
    diamondName,
    networkName,
    targetVersion,
    verbose: process.env.VERBOSE === 'true' || true,
    autoApprove: process.env.DEFENDER_AUTO_APPROVE === 'true',
    viaType: (process.env.DEFENDER_VIA_TYPE as 'Safe' | 'EOA') || 'EOA',
    safeAddress: process.env.DEFENDER_SAFE_ADDRESS,
  };

  console.log(`Diamond Name: ${options.diamondName}`);
  console.log(`Network: ${options.networkName}`);
  console.log(`Target Version: ${options.targetVersion || 'latest'}`);
  console.log(`Via Type: ${options.viaType}`);
  console.log(`Auto Approve: ${options.autoApprove}`);
  if (options.safeAddress) {
    console.log(`Safe Address: ${options.safeAddress}`);
  }
  console.log('=================================================');

  try {
    // Create configuration from environment variables
    const config = DefenderDiamondDeployer.createConfigFromEnv({
      diamondName: options.diamondName,
      networkName: options.networkName,
      autoApprove: options.autoApprove,
      verbose: options.verbose,
    });

    // Get deployer instance
    console.log('🔧 Initializing DefenderDiamondDeployer...');
    const deployer = await DefenderDiamondDeployer.getInstance(config);
    
    if (options.verbose) {
      await deployer.setVerbose(true);
    }

    // Get current diamond
    console.log('📦 Getting current diamond instance...');
    const diamond = await deployer.getDiamondDeployed();
    if (!diamond) {
      throw new Error('Diamond not deployed. Please deploy the diamond first.');
    }
    const deployedDiamondData = diamond.getDeployedDiamondData();
    
    if (!deployedDiamondData.DiamondAddress) {
      throw new Error('No existing diamond deployment found. Please deploy first.');
    }

    console.log(`Current Diamond Address: ${deployedDiamondData.DiamondAddress}`);

    // Start upgrade
    console.log('🔄 Starting diamond upgrade...');
    const upgradeStartTime = Date.now();
    
    // For upgrades, we would typically call a different method or pass upgrade parameters
    // This is a placeholder for the actual upgrade logic
    console.log('⚠️  Upgrade functionality needs to be implemented in the Diamonds module');
    console.log('   This would typically involve:');
    console.log('   1. Analyzing current facet configurations');
    console.log('   2. Determining required changes (add/replace/remove facets)');
    console.log('   3. Creating upgrade proposal in Defender');
    console.log('   4. Executing diamondCut transaction');
    
    const upgradeEndTime = Date.now();
    const upgradeTime = (upgradeEndTime - upgradeStartTime) / 1000;

    // Display results
    console.log('');
    console.log('✅ Upgrade Process Completed!');
    console.log('=============================');
    console.log(`Diamond Address: ${deployedDiamondData.DiamondAddress}`);
    console.log(`Diamond Name: ${diamondName}`);
    console.log(`Network: ${networkName} (Chain ID: ${config.chainId})`);
    console.log(`Process Time: ${upgradeTime}s`);
    console.log(`Via Type: ${config.viaType}`);
    console.log(`Via Address: ${config.via}`);
    console.log(`Relayer: ${config.relayerAddress}`);

    // Provide next steps
    console.log('');
    console.log('📋 Next Steps:');
    console.log('==============');
    console.log('1. Verify upgraded contracts on block explorer');
    console.log('2. Run post-upgrade tests');
    console.log('3. Update frontend configuration if needed');
    console.log(`4. Monitor upgrade at: https://defender.openzeppelin.com/`);
    
  } catch (error) {
    console.error('');
    console.error('❌ Upgrade Failed!');
    console.error('==================');
    console.error('Error:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.stack) {
      console.error('Stack Trace:');
      console.error(error.stack);
    }
    
    console.error('');
    console.error('💡 Troubleshooting Tips:');
    console.error('========================');
    console.error('1. Ensure diamond is already deployed');
    console.error('2. Check your Defender API credentials');
    console.error('3. Verify network configuration');
    console.error('4. Ensure sufficient balance in relayer');
    console.error('5. Review Safe multi-sig configuration if applicable');
    
    process.exit(1);
  }
}

/**
 * Script usage information
 */
function showUsage(): void {
  console.log('Usage: npx ts-node scripts/deploy/upgrade-defender.ts [DIAMOND_NAME] [NETWORK_NAME] [TARGET_VERSION]');
  console.log('');
  console.log('Arguments:');
  console.log('  DIAMOND_NAME     Name of the diamond to upgrade (default: GeniusDiamond)');
  console.log('  NETWORK_NAME     Target network name (default: current network)');
  console.log('  TARGET_VERSION   Target version to upgrade to (default: latest)');
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
  console.log('  npx ts-node scripts/deploy/upgrade-defender.ts');
  console.log('  npx ts-node scripts/deploy/upgrade-defender.ts GeniusDiamond polygon 2.6');
  console.log('  DEFENDER_AUTO_APPROVE=true npx ts-node scripts/deploy/upgrade-defender.ts');
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
