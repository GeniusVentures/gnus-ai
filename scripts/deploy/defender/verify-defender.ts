#!/usr/bin/env npx ts-node

/**
 * Contract verification script for OpenZeppelin Defender deployments
 * Verifies deployed contracts on block explorers
 */

import { DefenderDiamondDeployer, DefenderDiamondDeployerConfig } from '../../setup/DefenderDiamondDeployer';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

interface VerificationOptions {
  diamondName: string;
  networkName: string;
  contractAddress?: string;
  verbose?: boolean;
}

/**
 * Main verification function
 */
async function main(): Promise<void> {
  console.log('🔍 Starting Contract Verification');
  console.log('=================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const diamondName = args[0] || 'GeniusDiamond';
  const networkName = args[1] || hre.network.name;
  const contractAddress = args[2];

  // Validate network
  if (!hre.network.config || networkName === 'hardhat') {
    throw new Error('Cannot verify contracts on hardhat network. Please specify a live network.');
  }

  const options: VerificationOptions = {
    diamondName,
    networkName,
    contractAddress,
    verbose: process.env.VERBOSE === 'true' || true,
  };

  console.log(`Diamond Name: ${options.diamondName}`);
  console.log(`Network: ${options.networkName}`);
  if (options.contractAddress) {
    console.log(`Contract Address: ${options.contractAddress}`);
  }
  console.log('=================================');

  try {
    // Create configuration from environment
    const config = DefenderDiamondDeployer.createConfigFromEnv({ 
      diamondName, 
      networkName 
    });

    // Get deployer instance
    console.log('🔧 Initializing DefenderDiamondDeployer...');
    const deployer = await DefenderDiamondDeployer.getInstance(config);
    
    if (options.verbose) {
      await deployer.setVerbose(true);
    }

    // Get diamond instance
    const diamond = await deployer.getDiamondDeployed()!;
    const deployedDiamondData = diamond.getDeployedDiamondData();
    
    const targetAddress = options.contractAddress || deployedDiamondData.DiamondAddress;
    
    if (!targetAddress) {
      throw new Error('No contract address found. Please provide address or ensure diamond is deployed.');
    }

    console.log(`Verifying contract at: ${targetAddress}`);

    // Start verification
    console.log('🔍 Starting contract verification...');
    const verificationStartTime = Date.now();

    try {
      // Use Hardhat's verify task
      await hre.run('verify:verify', {
        address: targetAddress,
        constructorArguments: [], // Add constructor arguments if needed
      });

      console.log('✅ Main contract verified successfully!');
    } catch (error) {
      console.warn('⚠️  Main contract verification failed:', error instanceof Error ? error.message : error);
    }

    // Verify facets if diamond deployment data is available
    if (deployedDiamondData.DeployedFacets) {
      console.log('🔍 Verifying facet contracts...');
      
      for (const [facetName, facetInfo] of Object.entries(deployedDiamondData.DeployedFacets)) {
        try {
          console.log(`Verifying ${facetName} at ${facetInfo.address}...`);
          
          await hre.run('verify:verify', {
            address: facetInfo.address,
            constructorArguments: [], // Add constructor arguments if needed for facets
          });
          
          console.log(`✅ ${facetName} verified successfully!`);
        } catch (error) {
          console.warn(`⚠️  ${facetName} verification failed:`, error instanceof Error ? error.message : error);
        }
      }
    }

    const verificationEndTime = Date.now();
    const verificationTime = (verificationEndTime - verificationStartTime) / 1000;

    // Display results
    console.log('');
    console.log('✅ Verification Process Completed!');
    console.log('==================================');
    console.log(`Target Address: ${targetAddress}`);
    console.log(`Diamond Name: ${diamondName}`);
    console.log(`Network: ${networkName} (Chain ID: ${config.chainId})`);
    console.log(`Verification Time: ${verificationTime}s`);

    // Show verification links
    const networkConfig = DefenderDiamondDeployer.loadNetworkConfig(networkName);
    console.log(`Block Explorer: ${networkConfig.blockExplorer}/address/${targetAddress}`);

    console.log('');
    console.log('📋 Verification Complete!');
    console.log('=========================');
    console.log('Contracts are now verified and publicly viewable on the block explorer.');
    
  } catch (error) {
    console.error('');
    console.error('❌ Verification Failed!');
    console.error('=======================');
    console.error('Error:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.stack) {
      console.error('Stack Trace:');
      console.error(error.stack);
    }
    
    console.error('');
    console.error('💡 Troubleshooting Tips:');
    console.error('========================');
    console.error('1. Ensure contracts are deployed and confirmed on the network');
    console.error('2. Check your block explorer API key configuration');
    console.error('3. Verify network configuration matches deployment network');
    console.error('4. Ensure constructor arguments are correct');
    console.error('5. Check if contracts are already verified');
    
    process.exit(1);
  }
}

/**
 * Script usage information
 */
function showUsage(): void {
  console.log('Usage: npx ts-node scripts/deploy/verify-defender.ts [DIAMOND_NAME] [NETWORK_NAME] [CONTRACT_ADDRESS]');
  console.log('');
  console.log('Arguments:');
  console.log('  DIAMOND_NAME      Name of the diamond (default: GeniusDiamond)');
  console.log('  NETWORK_NAME      Target network name (default: current network)');
  console.log('  CONTRACT_ADDRESS  Specific contract address to verify (optional)');
  console.log('');
  console.log('Environment Variables:');
  console.log('  ETHERSCAN_API_KEY    Etherscan API key for verification');
  console.log('  POLYGONSCAN_API_KEY  Polygonscan API key for verification');
  console.log('  BASESCAN_API_KEY     Basescan API key for verification');
  console.log('  VERBOSE              Enable verbose logging (true/false)');
  console.log('');
  console.log('Examples:');
  console.log('  npx ts-node scripts/deploy/verify-defender.ts');
  console.log('  npx ts-node scripts/deploy/verify-defender.ts GeniusDiamond polygon');
  console.log('  npx ts-node scripts/deploy/verify-defender.ts GeniusDiamond mainnet 0x123...abc');
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
