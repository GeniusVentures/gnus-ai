#!/usr/bin/env npx ts-node

/**
 * Main deployment script for RPC-based Diamond deployment
 * Deploys GNUS.AI Diamond contracts using RPCDiamondDeployer
 */

import { RPCDiamondDeployer, RPCDiamondDeployerConfig } from '../../setup/rpc/RPCDiamondDeployer';
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
  networkName: string;
  privateKey?: string;
  gasLimitMultiplier?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  verbose?: boolean;
  useHardhatConfig?: boolean;
  // Legacy options for backward compatibility
  rpcUrl?: string;
  configPath?: string;
  deploymentsPath?: string;
}

/**
 * Validates required options
 */
function validateOptions(options: DeploymentOptions): void {
  const errors: string[] = [];

  if (!options.diamondName) {
    errors.push('Diamond name is required (--diamond-name or first argument)');
  }

  if (!options.networkName) {
    errors.push('Network name is required (--network-name or second argument)');
  }

  if (!options.privateKey && !process.env.PRIVATE_KEY && !process.env.TEST_PRIVATE_KEY) {
    errors.push('Private key is required (--private-key, PRIVATE_KEY, or TEST_PRIVATE_KEY environment variable)');
  }

  // Additional validation for legacy mode
  if (options.useHardhatConfig === false) {
    if (!options.rpcUrl && !process.env.RPC_URL) {
      errors.push('RPC URL is required when hardhat config is disabled (--rpc-url or RPC_URL environment variable)');
    }
  }

  if (errors.length > 0) {
    console.error(chalk.red('❌ Validation errors:'));
    errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
    process.exit(1);
  }
}

/**
 * Creates configuration from options using hardhat configurations
 */
function createConfig(options: DeploymentOptions): RPCDiamondDeployerConfig {
  const privateKey = options.privateKey || process.env.PRIVATE_KEY || process.env.TEST_PRIVATE_KEY!;
  
  // Use hardhat configuration if requested (default) or if no legacy options provided
  if (options.useHardhatConfig !== false && !options.rpcUrl) {
    console.log(chalk.blue('📋 Using hardhat configuration for diamond and network settings'));
    
    try {
      return RPCDiamondDeployer.createConfigFromHardhat(
        options.diamondName,
        options.networkName,
        privateKey,
        {
          verbose: options.verbose,
          gasLimitMultiplier: options.gasLimitMultiplier,
          maxRetries: options.maxRetries,
          retryDelayMs: options.retryDelayMs,
        }
      );
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load hardhat configuration: ${(error as Error).message}`));
      console.log(chalk.yellow('ℹ️  Falling back to manual configuration...'));
    }
  }
  
  // Legacy configuration method
  const config: RPCDiamondDeployerConfig = {
    diamondName: options.diamondName,
    rpcUrl: options.rpcUrl || process.env.RPC_URL!,
    privateKey,
    networkName: options.networkName,
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
  .command('deploy [diamondName] [networkName]')
  .description('Deploy a diamond using hardhat configuration')
  .option('-k, --private-key <key>', 'Private key for deployment', process.env.PRIVATE_KEY)
  .option('-r, --rpc-url <url>', 'RPC endpoint URL (required when hardhat config disabled)', process.env.RPC_URL)
  .option('-g, --gas-limit-multiplier <multiplier>', 'Gas limit multiplier (1.0-2.0)', 
    val => parseFloat(val), parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'))
  .option('-m, --max-retries <retries>', 'Maximum number of retries (1-10)', 
    val => parseInt(val), parseInt(process.env.MAX_RETRIES || '3'))
  .option('-t, --retry-delay-ms <delay>', 'Retry delay in milliseconds (100-30000)', 
    val => parseInt(val), parseInt(process.env.RETRY_DELAY_MS || '2000'))
  .option('--no-hardhat-config', 'Disable hardhat configuration integration')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (diamondName: string, networkName: string, options: any) => {
    const deployOptions: DeploymentOptions = {
      diamondName: diamondName || process.env.DIAMOND_NAME || '',
      networkName: networkName || process.env.NETWORK_NAME || '',
      privateKey: options.privateKey,
      rpcUrl: options.rpcUrl,
      gasLimitMultiplier: options.gasLimitMultiplier,
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs,
      useHardhatConfig: options.hardhatConfig,
      verbose: options.verbose,
    };
    
    await deployDiamond(deployOptions);
  });

// Legacy deploy command for backward compatibility
program
  .command('deploy-legacy')
  .description('Deploy a diamond using legacy configuration (manual RPC setup)')
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
    // Force legacy mode
    options.useHardhatConfig = false;
    await deployDiamond(options);
  });

// Quick deploy command using environment variables with hardhat integration
program
  .command('quick')
  .description('Quick deployment using environment variables and hardhat configuration')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: { verbose?: boolean }) => {
    const diamondName = process.env.DIAMOND_NAME;
    const networkName = process.env.NETWORK_NAME;
    
    if (!diamondName || !networkName) {
      console.error(chalk.red('❌ Required environment variables missing:'));
      if (!diamondName) console.error(chalk.red('   - DIAMOND_NAME'));
      if (!networkName) console.error(chalk.red('   - NETWORK_NAME'));
      console.error(chalk.yellow('\n💡 Example: DIAMOND_NAME=GeniusDiamond NETWORK_NAME=sepolia npx ts-node deploy-rpc.ts quick'));
      process.exit(1);
    }
    
    await deployDiamond({
      diamondName,
      networkName,
      verbose: options.verbose,
      useHardhatConfig: true,
    });
  });

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
