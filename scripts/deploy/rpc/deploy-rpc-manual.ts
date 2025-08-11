#!/usr/bin/env npx ts-node

/**
 * Manual step-by-step deployment script for RPC-based Diamond deployment
 * Provides interactive deployment with user confirmations at each step
 */

import { RPCDiamondDeployer, RPCDiamondDeployerConfig } from '../../setup/rpc/RPCDiamondDeployer';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { Command } from 'commander';
import * as readline from 'readline';
import "./common";

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('deploy-rpc-manual')
  .description('Manual step-by-step diamond deployment with confirmations')
  .version('1.0.0');

/**
 * Manual deployment options interface
 */
interface ManualDeploymentOptions {
  diamondName: string;
  networkName?: string;
  rpcUrl?: string;
  privateKey?: string;
  gasLimitMultiplier?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  configPath?: string;
  deploymentsPath?: string;
  skipConfirmations?: boolean;
  debugMode?: boolean;
  verbose?: boolean;
}

/**
 * Creates readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompts user for confirmation
 */
async function confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
  const rl = createReadlineInterface();
  const defaultText = defaultValue ? '[Y/n]' : '[y/N]';
  
  return new Promise((resolve) => {
    rl.question(`${message} ${defaultText}: `, (answer) => {
      rl.close();
      if (!answer.trim()) {
        resolve(defaultValue);
      } else {
        resolve(answer.toLowerCase().startsWith('y'));
      }
    });
  });
}

/**
 * Prompts user for input
 */
async function prompt(message: string, defaultValue?: string): Promise<string> {
  const rl = createReadlineInterface();
  const defaultText = defaultValue ? ` [${defaultValue}]` : '';
  
  return new Promise((resolve) => {
    rl.question(`${message}${defaultText}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Validates required options
 */
function validateOptions(options: ManualDeploymentOptions): void {
  const errors: string[] = [];

  if (!options.diamondName) {
    errors.push('Diamond name is required (--diamond-name or DIAMOND_NAME)');
  }

  if (!options.rpcUrl) {
    errors.push('RPC URL is required (--rpc-url or RPC_URL)');
  }

  if (!options.privateKey) {
    errors.push('Private key is required (--private-key or PRIVATE_KEY)');
  }

  if (errors.length > 0) {
    console.error(chalk.red('❌ Validation errors:'));
    errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
    process.exit(1);
  }
}

/**
 * Interactively collects configuration if missing
 */
async function collectMissingConfig(options: ManualDeploymentOptions): Promise<ManualDeploymentOptions> {
  console.log(chalk.blueBright('\n🔧 Configuration Setup'));
  console.log(chalk.blue('='.repeat(40)));

  if (!options.diamondName) {
    options.diamondName = await prompt('Diamond name', 'GeniusDiamond');
  }

  if (!options.rpcUrl) {
    options.rpcUrl = await prompt('RPC URL');
    if (!options.rpcUrl) {
      console.error(chalk.red('❌ RPC URL is required'));
      process.exit(1);
    }
  }

  if (!options.privateKey) {
    options.privateKey = await prompt('Private key (0x...)');
    if (!options.privateKey) {
      console.error(chalk.red('❌ Private key is required'));
      process.exit(1);
    }
  }

  if (!options.networkName) {
    options.networkName = await prompt('Network name', 'unknown');
  }

  if (!options.gasLimitMultiplier) {
    const gasInput = await prompt('Gas limit multiplier', '1.2');
    options.gasLimitMultiplier = parseFloat(gasInput) || 1.2;
  }

  console.log(chalk.blue('='.repeat(40)));
  return options;
}

/**
 * Creates configuration from options
 */
function createConfig(options: ManualDeploymentOptions): RPCDiamondDeployerConfig {
  const config: RPCDiamondDeployerConfig = {
    diamondName: options.diamondName,
    rpcUrl: options.rpcUrl!,
    privateKey: options.privateKey!,
    networkName: options.networkName || 'unknown',
    chainId: 0, // Will be auto-detected
    verbose: options.verbose || false,
    gasLimitMultiplier: options.gasLimitMultiplier,
    maxRetries: options.maxRetries,
    retryDelayMs: options.retryDelayMs,
    configFilePath: options.configPath,
    deploymentsPath: options.deploymentsPath,
    writeDeployedDiamondData: true,
  };

  return config;
}

/**
 * Shows pre-deployment summary and asks for confirmation
 */
async function preDeploymentConfirmation(
  deployer: RPCDiamondDeployer, 
  options: ManualDeploymentOptions
): Promise<boolean> {
  console.log(chalk.yellowBright('\n📋 Pre-Deployment Summary'));
  console.log(chalk.blue('='.repeat(50)));

  const config = deployer.getConfig();
  const diamond = await deployer.getDiamond();
  const deployConfig = diamond.getDeployConfig();
  const networkInfo = await deployer.getNetworkInfo();

  console.log(chalk.blue(`💎 Diamond Name: ${config.diamondName}`));
  console.log(chalk.blue(`🌐 Network: ${networkInfo.networkName} (Chain ID: ${networkInfo.chainId})`));
  console.log(chalk.blue(`🔗 RPC URL: ${config.rpcUrl}`));
  console.log(chalk.blue(`👤 Deployer: ${networkInfo.signerAddress}`));
  console.log(chalk.blue(`💰 Balance: ${Number(networkInfo.balance) / 1e18} ETH`));
  console.log(chalk.blue(`⛽ Gas Price: ${Number(networkInfo.gasPrice) / 1e9} gwei`));

  if (deployConfig.protocolVersion) {
    console.log(chalk.blue(`📋 Protocol Version: ${deployConfig.protocolVersion}`));
  }

  // Show facets to be deployed
  const facetsConfig = deployConfig.facets || {};
  const facetNames = Object.keys(facetsConfig);
  
  if (facetNames.length > 0) {
    console.log(chalk.blue(`🔧 Facets to Deploy: ${facetNames.length}`));
    facetNames.forEach(name => {
      console.log(chalk.gray(`   ${name}`));
    });
  }

  // Estimate costs
  const estimatedGasPrice = Number(networkInfo.gasPrice) / 1e18;
  const estimatedDeploymentCost = estimatedGasPrice * 5000000; // Rough estimate
  console.log(chalk.blue(`\n💸 Estimated Cost: ~${estimatedDeploymentCost.toFixed(6)} ETH`));

  console.log(chalk.blue('='.repeat(50)));

  if (options.skipConfirmations) {
    return true;
  }

  return await confirm('\n🚀 Proceed with deployment?', false);
}

/**
 * Step-by-step deployment process
 */
async function stepByStepDeployment(
  deployer: RPCDiamondDeployer,
  options: ManualDeploymentOptions
): Promise<void> {
  const diamond = await deployer.getDiamond();

  // Step 1: Pre-deployment validation
  console.log(chalk.yellowBright('\n📋 Step 1: Pre-deployment Validation'));
  console.log(chalk.blue('-'.repeat(40)));

  const validation = await deployer.validateConfiguration();
  if (!validation.valid) {
    console.error(chalk.red('❌ Configuration validation failed:'));
    validation.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
    throw new Error('Configuration validation failed');
  } else {
    console.log(chalk.green('✅ Configuration validation passed'));
  }

  if (!options.skipConfirmations) {
    const proceed = await confirm('Continue to diamond core deployment?', true);
    if (!proceed) return;
  }

  // Step 2: Diamond Core Deployment
  console.log(chalk.yellowBright('\n💎 Step 2: Diamond Core Deployment'));
  console.log(chalk.blue('-'.repeat(40)));
  
  console.log(chalk.blue('This step will deploy:'));
  console.log(chalk.gray('  - DiamondCutFacet'));
  console.log(chalk.gray('  - Diamond proxy contract'));

  if (!options.skipConfirmations) {
    const proceed = await confirm('Deploy diamond core?', true);
    if (!proceed) return;
  }

  try {
    console.log(chalk.blue('🔄 Deploying diamond core...'));
    const startTime = Date.now();
    
    // This will deploy the diamond through the strategy
    await deployer.deployDiamond();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(chalk.green(`✅ Diamond deployment completed in ${duration}s`));
    
    const deployedData = diamond.getDeployedDiamondData();
    if (deployedData.DiamondAddress) {
      console.log(chalk.blue(`📍 Diamond Address: ${deployedData.DiamondAddress}`));
    }

  } catch (error) {
    console.error(chalk.red(`❌ Diamond deployment failed: ${(error as Error).message}`));
    throw error;
  }

  // Step 3: Facet Deployment
  console.log(chalk.yellowBright('\n🔧 Step 3: Facet Deployment'));
  console.log(chalk.blue('-'.repeat(40)));
  
  const deployedData = diamond.getDeployedDiamondData();
  if (deployedData.DeployedFacets) {
    const facetCount = Object.keys(deployedData.DeployedFacets).length;
    console.log(chalk.green(`✅ ${facetCount} facets deployed successfully`));
    
    Object.entries(deployedData.DeployedFacets).forEach(([name, facet]) => {
      console.log(chalk.blue(`  ${name}: ${facet.address}`));
    });
  }

  console.log(chalk.yellowBright('\n🎉 Deployment Process Completed!'));
}

/**
 * Debug mode deployment with detailed logging
 */
async function debugModeDeployment(
  deployer: RPCDiamondDeployer,
  options: ManualDeploymentOptions
): Promise<void> {
  console.log(chalk.magentaBright('\n🐛 Debug Mode Deployment'));
  console.log(chalk.blue('='.repeat(40)));

  // Enable verbose logging
  await deployer.setVerbose(true);

  // Show detailed configuration
  const config = deployer.getConfig();
  console.log(chalk.blue('Configuration:'));
  console.log(chalk.gray(JSON.stringify(config, null, 2)));

  // Show network information
  const networkInfo = await deployer.getNetworkInfo();
  console.log(chalk.blue('\nNetwork Information:'));
  console.log(chalk.gray(JSON.stringify(networkInfo, null, 2)));

  // Show diamond configuration
  const diamond = await deployer.getDiamond();
  const deployConfig = diamond.getDeployConfig();
  console.log(chalk.blue('\nDiamond Configuration:'));
  console.log(chalk.gray(JSON.stringify(deployConfig, null, 2)));

  console.log(chalk.blue('='.repeat(40)));

  // Proceed with normal deployment
  await stepByStepDeployment(deployer, options);
}

/**
 * Main manual deployment function
 */
async function manualDeploy(options: ManualDeploymentOptions): Promise<void> {
  try {
    console.log(chalk.blueBright('\n🎯 Manual RPC Diamond Deployment'));
    console.log(chalk.blue('='.repeat(50)));

    // Validate and collect missing configuration
    validateOptions(options);
    options = await collectMissingConfig(options);

    // Create configuration
    const config = createConfig(options);

    // Initialize the RPCDiamondDeployer
    console.log(chalk.blue('🔧 Initializing RPCDiamondDeployer...'));
    const deployer = await RPCDiamondDeployer.getInstance(config);
    
    // Check if already deployed
    if (deployer.isDiamondDeployed()) {
      console.log(chalk.yellow('⚠️  Diamond is already deployed.'));
      
      const redeploy = await confirm('Do you want to upgrade/redeploy?', false);
      if (!redeploy) {
        console.log(chalk.blue('Deployment cancelled by user.'));
        return;
      }
    }

    // Pre-deployment confirmation
    const proceed = await preDeploymentConfirmation(deployer, options);
    if (!proceed) {
      console.log(chalk.blue('Deployment cancelled by user.'));
      return;
    }

    // Execute deployment based on mode
    if (options.debugMode) {
      await debugModeDeployment(deployer, options);
    } else {
      await stepByStepDeployment(deployer, options);
    }

    // Final summary
    console.log(chalk.greenBright('\n🎉 Manual deployment completed successfully!'));
    
    const deployedData = (await deployer.getDiamond()).getDeployedDiamondData();
    console.log(chalk.green(`📍 Diamond Address: ${deployedData.DiamondAddress}`));
    
    if (deployedData.protocolVersion) {
      console.log(chalk.green(`📋 Protocol Version: ${deployedData.protocolVersion}`));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Manual deployment failed:'));
    console.error(chalk.red(`   ${(error as Error).message}`));
    
    if (options.verbose) {
      console.error(chalk.gray('\nFull error:'));
      console.error(chalk.gray((error as Error).stack));
    }
    
    process.exit(1);
  }
}

// CLI command setup
program
  .command('deploy')
  .description('Manual step-by-step deployment')
  .option('-d, --diamond-name <name>', 'Name of the diamond to deploy', process.env.DIAMOND_NAME)
  .option('-r, --rpc-url <url>', 'RPC endpoint URL', process.env.RPC_URL)
  .option('-k, --private-key <key>', 'Private key for deployment', process.env.PRIVATE_KEY)
  .option('-n, --network-name <name>', 'Network name', process.env.NETWORK_NAME)
  .option('-c, --config-path <path>', 'Path to diamond configuration file', process.env.DIAMOND_CONFIG_PATH)
  .option('-p, --deployments-path <path>', 'Path to deployments directory', process.env.DEPLOYMENTS_PATH)
  .option('-g, --gas-limit-multiplier <multiplier>', 'Gas limit multiplier (1.0-2.0)', 
    val => parseFloat(val), parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'))
  .option('-m, --max-retries <retries>', 'Maximum number of retries (1-10)', 
    val => parseInt(val), parseInt(process.env.MAX_RETRIES || '3'))
  .option('-t, --retry-delay-ms <delay>', 'Retry delay in milliseconds (100-30000)', 
    val => parseInt(val), parseInt(process.env.RETRY_DELAY_MS || '2000'))
  .option('--skip-confirmations', 'Skip all confirmation prompts')
  .option('--debug-mode', 'Enable debug mode with detailed logging')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: ManualDeploymentOptions) => {
    await manualDeploy(options);
  });

// Interactive mode - no command line arguments needed
program
  .command('interactive')
  .description('Fully interactive deployment mode')
  .option('--debug-mode', 'Enable debug mode with detailed logging')
  .action(async (options: { debugMode?: boolean }) => {
    const interactiveOptions: ManualDeploymentOptions = {
      diamondName: '',
      debugMode: options.debugMode,
      verbose: true,
    };
    
    await manualDeploy(interactiveOptions);
  });

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
