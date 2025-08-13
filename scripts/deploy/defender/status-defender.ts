#!/usr/bin/env npx ts-node

/**
 * Status checking script for OpenZeppelin Defender deployments
 * Monitors deployment and proposal status
 */

import { DefenderDiamondDeployer, DefenderDiamondDeployerConfig, DeploymentStatus } from '../../setup/DefenderDiamondDeployer';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

interface StatusOptions {
  diamondName: string;
  networkName: string;
  proposalId?: string;
  verbose?: boolean;
  watch?: boolean;
  watchInterval?: number;
}

/**
 * Main status checking function
 */
async function main(): Promise<void> {
  console.log('📊 OpenZeppelin Defender Status Monitor');
  console.log('=======================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const diamondName = args[0] || 'GeniusDiamond';
  const networkName = args[1] || hre.network.name;
  const proposalId = args[2];

  // Parse flags
  const watchFlag = process.argv.includes('--watch') || process.argv.includes('-w');
  const watchIntervalArg = process.argv.find(arg => arg.startsWith('--interval='));
  const watchInterval = watchIntervalArg ? parseInt(watchIntervalArg.split('=')[1]) : 10;

  const options: StatusOptions = {
    diamondName,
    networkName,
    proposalId,
    verbose: process.env.VERBOSE === 'true' || true,
    watch: watchFlag,
    watchInterval: watchInterval * 1000, // Convert to milliseconds
  };

  console.log(`Diamond Name: ${options.diamondName}`);
  console.log(`Network: ${options.networkName}`);
  if (options.proposalId) {
    console.log(`Proposal ID: ${options.proposalId}`);
  }
  if (options.watch) {
    console.log(`Watch Mode: ${options.watch} (${watchInterval}s interval)`);
  }
  console.log('=======================================');

  try {
    // Create configuration from environment variables
    const config = DefenderDiamondDeployer.createConfigFromEnv({
      diamondName: diamondName,
      networkName: networkName,
    });

    // Get deployer instance
    if (options.verbose) {
      console.log('🔧 Initializing DefenderDiamondDeployer...');
    }
    
    const deployer = await DefenderDiamondDeployer.getInstance(config);
    
    if (options.verbose) {
      await deployer.setVerbose(true);
    }

    // Status checking function
    const checkStatus = async (): Promise<void> => {
      const timestamp = new Date().toISOString();
      console.log(`\n[${timestamp}] 📊 Status Check`);
      console.log('=====================================');

      try {
        // Get deployment status
        const deploymentStatus = deployer.getDeploymentStatus();
        console.log(`Deployment Status: ${getStatusEmoji(deploymentStatus)} ${deploymentStatus}`);

        // Get diamond instance and data
        const diamond = await deployer.getDiamondDeployed();
        if (!diamond) {
          console.log('❌ Diamond is not deployed');
          return;
        }
        const deployedDiamondData = diamond.getDeployedDiamondData();

        if (deployedDiamondData.DiamondAddress) {
          console.log(`Diamond Address: ${deployedDiamondData.DiamondAddress}`);
          console.log(`Deployer Address: ${deployedDiamondData.DeployerAddress}`);
          
          // Check if diamond is accessible on chain
          try {
            const provider = ethers.provider;
            const code = await provider.getCode(deployedDiamondData.DiamondAddress);
            const isDeployed = code !== '0x';
            console.log(`On-Chain Status: ${isDeployed ? '✅ Deployed' : '❌ Not Found'}`);
            
            if (isDeployed) {
              const balance = await provider.getBalance(deployedDiamondData.DiamondAddress);
              console.log(`Contract Balance: ${ethers.formatEther(balance)} ETH`);
            }
          } catch (error) {
            console.warn(`❌ Failed to check on-chain status: ${error instanceof Error ? error.message : error}`);
          }
        } else {
          console.log('Diamond Address: Not deployed');
        }

        // Show facet information if available
        if (deployedDiamondData.DeployedFacets) {
          console.log('\n📦 Deployed Facets:');
          for (const [facetName, facetInfo] of Object.entries(deployedDiamondData.DeployedFacets)) {
            console.log(`  ${facetName}: ${facetInfo.address} (v${facetInfo.version || '0.0'})`);
          }
        }

        // Show network information
        console.log(`\n🌐 Network Information:`);
        console.log(`  Network: ${networkName}`);
        console.log(`  Chain ID: ${config.chainId}`);
        console.log(`  Relayer: ${config.relayerAddress}`);
        console.log(`  Via Address: ${config.via}`);

        // TODO: Add Defender-specific status checks when SDK is properly integrated
        console.log(`\n🛡️  Defender Information:`);
        console.log(`  Via Type: ${config.viaType}`);
        console.log(`  Auto Approve: ${config.autoApprove}`);
        // console.log(`  Active Proposals: ${activeProposals.length}`);
        // console.log(`  Pending Approvals: ${pendingApprovals.length}`);

      } catch (error) {
        console.error(`❌ Status check failed: ${error instanceof Error ? error.message : error}`);
      }
    };

    // Initial status check
    await checkStatus();

    // Watch mode
    if (options.watch) {
      console.log(`\n👀 Starting watch mode (${watchInterval}s intervals)...`);
      console.log('Press Ctrl+C to stop monitoring');
      
      const interval = setInterval(async () => {
        await checkStatus();
      }, options.watchInterval);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping status monitor...');
        clearInterval(interval);
        process.exit(0);
      });

      // Keep the process alive
      await new Promise(() => {}); // Never resolves
    }

  } catch (error) {
    console.error('');
    console.error('❌ Status Check Failed!');
    console.error('=======================');
    console.error('Error:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.stack && options.verbose) {
      console.error('Stack Trace:');
      console.error(error.stack);
    }
    
    console.error('');
    console.error('💡 Troubleshooting Tips:');
    console.error('========================');
    console.error('1. Check your Defender API credentials');
    console.error('2. Verify network configuration');
    console.error('3. Ensure diamond is deployed');
    console.error('4. Check network connectivity');
    
    process.exit(1);
  }
}

/**
 * Get emoji for deployment status
 */
function getStatusEmoji(status: DeploymentStatus): string {
  switch (status) {
    case DeploymentStatus.NOT_STARTED:
      return '⚪';
    case DeploymentStatus.IN_PROGRESS:
      return '🟡';
    case DeploymentStatus.COMPLETED:
      return '🟢';
    case DeploymentStatus.FAILED:
      return '🔴';
    case DeploymentStatus.PAUSED:
      return '🟠';
    default:
      return '❓';
  }
}

/**
 * Script usage information
 */
function showUsage(): void {
  console.log('Usage: npx ts-node scripts/deploy/status-defender.ts [DIAMOND_NAME] [NETWORK_NAME] [PROPOSAL_ID]');
  console.log('');
  console.log('Arguments:');
  console.log('  DIAMOND_NAME  Name of the diamond (default: GeniusDiamond)');
  console.log('  NETWORK_NAME  Target network name (default: current network)');
  console.log('  PROPOSAL_ID   Specific proposal ID to monitor (optional)');
  console.log('');
  console.log('Flags:');
  console.log('  --watch, -w           Enable watch mode for continuous monitoring');
  console.log('  --interval=SECONDS    Set watch interval in seconds (default: 10)');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DEFENDER_API_KEY      OpenZeppelin Defender API Key');
  console.log('  DEFENDER_API_SECRET   OpenZeppelin Defender API Secret');
  console.log('  VERBOSE               Enable verbose logging (true/false)');
  console.log('');
  console.log('Examples:');
  console.log('  npx ts-node scripts/deploy/status-defender.ts');
  console.log('  npx ts-node scripts/deploy/status-defender.ts GeniusDiamond polygon');
  console.log('  npx ts-node scripts/deploy/status-defender.ts GeniusDiamond polygon --watch');
  console.log('  npx ts-node scripts/deploy/status-defender.ts GeniusDiamond polygon abc123 --watch --interval=30');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run main function
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
