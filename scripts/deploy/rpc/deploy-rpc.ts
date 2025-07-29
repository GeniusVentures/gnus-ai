#!/usr/bin/env npx ts-node

/**
 * Main deployment script for RPC-based Diamond deployment
 * Deploys GNUS.AI Diamond contracts using RPCDiamondDeployer
 */

import { RPCDiamondDeployer, RPCDiamondDeployerConfig } from '../setup/rpc/RPCDiamondDeployer';
import { ethers } from 'ethers';
import hre from 'hardhat';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { Command } from 'commander';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('deploy-rpc')
  .description('Deploy diamonds using direct RPC communication')
  .version('1.0.0');

/**
 * Deployment options interface
 */
interface DeploymentOptions {
  diamondName: string;
  networkName?: string;
  rpcUrl?: string;
  privateKey?: string;
  gasLimitMultiplier?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  configPath?: string;
  deploymentsPath?: string;
  verbose?: boolean;
}

/**
 * Validates required options
 */
function validateOptions(options: DeploymentOptions): void {
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
 * Creates configuration from options
 */
function createConfig(options: DeploymentOptions): RPCDiamondDeployerConfig {
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
 * Prints pre-deployment information
 */
async function printPreDeploymentInfo(config: RPCDiamondDeployerConfig): Promise<void> {
  console.log(chalk.blueBright('\n🚀 RPC Diamond Deployment'));
  console.log(chalk.blue('='.repeat(50)));
  
  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(config.privateKey, provider);
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(signer.address);
    const gasPrice = (await provider.getFeeData()).gasPrice || 0n;

    console.log(chalk.blue(`💎 Diamond Name: ${config.diamondName}`));
    console.log(chalk.blue(`🌐 Network: ${network.name || 'unknown'} (Chain ID: ${Number(network.chainId)})`));
    console.log(chalk.blue(`🔗 RPC URL: ${config.rpcUrl}`));
    console.log(chalk.blue(`👤 Deployer: ${signer.address}`));
    console.log(chalk.blue(`💰 Balance: ${Number(balance) / 1e18} ETH`));
    console.log(chalk.blue(`⛽ Gas Price: ${Number(gasPrice) / 1e9} gwei`));
    
    if (config.gasLimitMultiplier) {
      console.log(chalk.blue(`🔧 Gas Limit Multiplier: ${config.gasLimitMultiplier}`));
    }
    
    if (config.maxRetries) {
      console.log(chalk.blue(`🔄 Max Retries: ${config.maxRetries}`));
    }
    
    console.log(chalk.blue('='.repeat(50)));

    // Check balance is sufficient
    const minBalance = ethers.parseEther('0.01'); // Minimum 0.01 ETH
    if (balance < minBalance) {
      console.log(chalk.yellow(`⚠️  Warning: Low balance detected. Minimum recommended: 0.01 ETH`));
    }

  } catch (error) {
    console.error(chalk.red(`❌ Failed to get network information: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Main deployment function
 */
async function deployDiamond(options: DeploymentOptions): Promise<void> {
  try {
    // Validate options
    validateOptions(options);

    // Create configuration
    const config = createConfig(options);

    // Print pre-deployment information
    await printPreDeploymentInfo(config);

    // Initialize the RPCDiamondDeployer
    console.log(chalk.blue('🔧 Initializing RPCDiamondDeployer...'));
    const deployer = await RPCDiamondDeployer.getInstance(config);
    
    // Validate configuration
    console.log(chalk.blue('🔍 Validating configuration...'));
    const validation = await deployer.validateConfiguration();
    if (!validation.valid) {
      console.error(chalk.red('❌ Configuration validation failed:'));
      validation.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
      process.exit(1);
    }
    console.log(chalk.green('✅ Configuration validation passed'));

    // Check if already deployed
    if (deployer.isDiamondDeployed()) {
      console.log(chalk.yellow('⚠️  Diamond is already deployed. Use upgrade-rpc.ts for upgrades.'));
      
      const deployedDiamond = await deployer.getDiamond();
      const deployedData = deployedDiamond.getDeployedDiamondData();
      
      console.log(chalk.blue(`📍 Current Diamond Address: ${deployedData.DiamondAddress}`));
      
      if (deployedData.protocolVersion) {
        console.log(chalk.blue(`📋 Current Protocol Version: ${deployedData.protocolVersion}`));
      }
      
      return;
    }

    // Execute the deployment
    console.log(chalk.blue('💎 Starting diamond deployment...'));
    const startTime = Date.now();
    
    const diamond = await deployer.deployDiamond();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print success message
    console.log(chalk.greenBright(`\n🎉 Diamond deployment completed successfully in ${duration}s!`));
    
    const deployedData = diamond.getDeployedDiamondData();
    console.log(chalk.green(`📍 Diamond Address: ${deployedData.DiamondAddress}`));
    
    if (deployedData.protocolVersion) {
      console.log(chalk.green(`📋 Protocol Version: ${deployedData.protocolVersion}`));
    }

    if (deployedData.DeployedFacets) {
      const facetCount = Object.keys(deployedData.DeployedFacets).length;
      console.log(chalk.green(`🔧 Deployed Facets: ${facetCount}`));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Deployment failed:'));
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
  .description('Deploy a diamond using RPC')
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
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: DeploymentOptions) => {
    await deployDiamond(options);
  });

// Quick deploy command that uses environment variables
program
  .command('quick')
  .description('Quick deployment using environment variables')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: { verbose?: boolean }) => {
    try {
      const config = RPCDiamondDeployer.createConfigFromEnv({ verbose: options.verbose });
      
      await deployDiamond({
        diamondName: config.diamondName,
        rpcUrl: config.rpcUrl,
        privateKey: config.privateKey,
        networkName: config.networkName,
        gasLimitMultiplier: config.gasLimitMultiplier,
        maxRetries: config.maxRetries,
        retryDelayMs: config.retryDelayMs,
        configPath: config.configFilePath,
        deploymentsPath: config.deploymentsPath,
        verbose: config.verbose,
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to create configuration from environment:'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      console.error(chalk.yellow('\n💡 Make sure you have set the required environment variables:'));
      console.error(chalk.yellow('   - DIAMOND_NAME'));
      console.error(chalk.yellow('   - RPC_URL'));
      console.error(chalk.yellow('   - PRIVATE_KEY'));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
