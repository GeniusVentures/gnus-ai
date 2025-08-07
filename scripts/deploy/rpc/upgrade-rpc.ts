#!/usr/bin/env npx ts-node

/**
 * Upgrade script for RPC-based Diamond upgrades
 * Upgrades GNUS.AI Diamond contracts using RPCDiamondDeployer
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
  .name('upgrade-rpc')
  .description('Upgrade diamonds using direct RPC communication')
  .version('1.0.0');

/**
 * Upgrade options interface
 */
interface UpgradeOptions {
  diamondName: string;
  networkName?: string;
  rpcUrl?: string;
  privateKey?: string;
  verbose?: boolean;
  gasLimitMultiplier?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  configPath?: string;
  deploymentsPath?: string;
  targetVersion?: number;
  force?: boolean;
  dryRun?: boolean;
  useHardhatConfig?: boolean;
}

/**
 * Validates required options
 */
function validateOptions(options: UpgradeOptions): void {
  const errors: string[] = [];

  if (!options.diamondName) {
    errors.push('Diamond name is required (--diamond-name or DIAMOND_NAME)');
  }

  if (!options.networkName) {
    errors.push('Network name is required (--network-name or NETWORK_NAME)');
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
function createConfig(options: UpgradeOptions): RPCDiamondDeployerConfig {
  const privateKey = options.privateKey || process.env.PRIVATE_KEY || process.env.TEST_PRIVATE_KEY!;
  
  // Use hardhat configuration if requested (default) or if no legacy options provided
  if (options.useHardhatConfig !== false && !options.rpcUrl) {
    console.log(chalk.blue('📋 Using hardhat configuration for diamond and network settings'));
    
    try {
      return RPCDiamondDeployer.createConfigFromHardhat(
        options.diamondName,
        options.networkName || 'unknown',
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
 * Prints pre-upgrade information
 */
async function printPreUpgradeInfo(config: RPCDiamondDeployerConfig): Promise<void> {
  console.log(chalk.blueBright('\n🔄 RPC Diamond Upgrade'));
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
 * Analyzes what will be upgraded
 */
async function analyzeUpgrade(deployer: RPCDiamondDeployer): Promise<void> {
  const diamond = await deployer.getDiamond();
  const deployedData = diamond.getDeployedDiamondData();
  const currentConfig = diamond.getDeployConfig();

  console.log(chalk.blueBright('\n🔍 Upgrade Analysis'));
  console.log(chalk.blue('='.repeat(40)));

  // Protocol version comparison
  if (deployedData.protocolVersion && currentConfig.protocolVersion) {
    console.log(chalk.blue(`📋 Protocol Version: ${deployedData.protocolVersion} → ${currentConfig.protocolVersion}`));
  }

  // Facet analysis
  const currentFacets = deployedData.DeployedFacets || {};
  const configFacets = currentConfig.facets || {};

  console.log(chalk.blue('\n🔧 Facet Changes:'));

  // Check for new facets
  const newFacets = Object.keys(configFacets).filter(name => !currentFacets[name]);
  if (newFacets.length > 0) {
    console.log(chalk.green(`  ➕ New Facets: ${newFacets.join(', ')}`));
  }

  // Check for updated facets
  const updatedFacets: string[] = [];
  Object.keys(configFacets).forEach(name => {
    if (currentFacets[name]) {
      // In a real implementation, you would compare bytecode or version numbers
      // For now, we assume all existing facets might be updated
      updatedFacets.push(name);
    }
  });

  if (updatedFacets.length > 0) {
    console.log(chalk.yellow(`  🔄 Potentially Updated Facets: ${updatedFacets.join(', ')}`));
  }

  // Check for removed facets
  const removedFacets = Object.keys(currentFacets).filter(name => !configFacets[name]);
  if (removedFacets.length > 0) {
    console.log(chalk.red(`  ➖ Removed Facets: ${removedFacets.join(', ')}`));
  }

  if (newFacets.length === 0 && updatedFacets.length === 0 && removedFacets.length === 0) {
    console.log(chalk.gray('  ℹ️  No facet changes detected'));
  }

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Prints upgrade summary
 */
async function printUpgradeSummary(deployer: RPCDiamondDeployer): Promise<void> {
  const diamond = await deployer.getDiamond();
  const deployedData = diamond.getDeployedDiamondData();
  const config = deployer.getConfig();

  console.log(chalk.greenBright('\n🎉 Upgrade Summary'));
  console.log(chalk.green('='.repeat(50)));
  console.log(chalk.blue(`💎 Diamond Name: ${config.diamondName}`));
  console.log(chalk.blue(`🌐 Network: ${config.networkName} (Chain ID: ${config.chainId})`));
  console.log(chalk.blue(`📍 Diamond Address: ${deployedData.DiamondAddress}`));
  
  if (deployedData.protocolVersion) {
    console.log(chalk.blue(`📋 Protocol Version: ${deployedData.protocolVersion}`));
  }

  if (deployedData.DeployedFacets) {
    const facetCount = Object.keys(deployedData.DeployedFacets).length;
    console.log(chalk.blue(`🔧 Active Facets: ${facetCount}`));
    
    Object.entries(deployedData.DeployedFacets).forEach(([name, facet]: [string, any]) => {
      console.log(chalk.gray(`   ${name}: ${facet.address}`));
    });
  }

  console.log(chalk.green('='.repeat(50)));
}

/**
 * Main upgrade function
 */
async function upgradeDiamond(options: UpgradeOptions): Promise<void> {
  try {
    // Validate options
    validateOptions(options);

    // Create configuration
    const config = createConfig(options);

    // Print pre-upgrade information
    await printPreUpgradeInfo(config);
    
    if (options.dryRun) {
      console.log(chalk.yellow(`🧪 DRY RUN MODE - No changes will be made`));
    }

    // Initialize the RPCDiamondDeployer
    console.log(chalk.blue('🔧 Initializing RPCDiamondDeployer...'));
    const deployer = await RPCDiamondDeployer.getInstance(config);
    
    // Check if diamond is deployed
    if (!deployer.isDiamondDeployed()) {
      console.error(chalk.red('❌ Diamond is not deployed yet. Use deploy-rpc.ts first.'));
      process.exit(1);
    }

    // Validate configuration
    console.log(chalk.blue('🔍 Validating configuration...'));
    const validation = await deployer.validateConfiguration();
    if (!validation.valid) {
      console.error(chalk.red('❌ Configuration validation failed:'));
      validation.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
      process.exit(1);
    }
    console.log(chalk.green('✅ Configuration validation passed'));

    // Analyze what will be upgraded
    await analyzeUpgrade(deployer);

    // Check if upgrade is needed
    const diamond = await deployer.getDiamond();
    const deployedData = diamond.getDeployedDiamondData();
    const currentConfig = diamond.getDeployConfig();
    
    const needsUpgrade = options.force || 
      (deployedData.protocolVersion && currentConfig.protocolVersion && 
       deployedData.protocolVersion < currentConfig.protocolVersion);

    if (!needsUpgrade && !options.force) {
      console.log(chalk.yellow('ℹ️  No upgrade needed. Use --force to force upgrade.'));
      return;
    }

    if (options.dryRun) {
      console.log(chalk.yellow('\n🧪 DRY RUN completed - upgrade analysis shown above'));
      console.log(chalk.yellow('   Remove --dry-run flag to perform actual upgrade'));
      return;
    }

    // Execute the upgrade
    console.log(chalk.blue('\n🚀 Starting diamond upgrade...'));
    const startTime = Date.now();
    
    const upgradedDiamond = await deployer.deployDiamond(); // This will perform upgrade if needed
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print success message
    console.log(chalk.greenBright(`\n🎉 Diamond upgrade completed successfully in ${duration}s!`));
    
    await printUpgradeSummary(deployer);

  } catch (error) {
    console.error(chalk.red('\n❌ Upgrade failed:'));
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
  .command('upgrade [diamondName] [networkName]')
  .description('Upgrade a diamond using hardhat configuration')
  .option('-k, --private-key <key>', 'Private key for deployment', process.env.PRIVATE_KEY)
  .option('-r, --rpc-url <url>', 'RPC endpoint URL (required when hardhat config disabled)', process.env.RPC_URL)
  .option('-g, --gas-limit-multiplier <multiplier>', 'Gas limit multiplier (1.0-2.0)', 
    val => parseFloat(val), parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'))
  .option('-m, --max-retries <retries>', 'Maximum number of retries (1-10)', 
    val => parseInt(val), parseInt(process.env.MAX_RETRIES || '3'))
  .option('-t, --retry-delay-ms <delay>', 'Retry delay in milliseconds (100-30000)', 
    val => parseInt(val), parseInt(process.env.RETRY_DELAY_MS || '2000'))
  .option('--no-hardhat-config', 'Disable hardhat configuration integration')
  .option('--dry-run', 'Preview changes without executing them')
  .option('--force', 'Force upgrade even if no changes detected')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (diamondName: string, networkName: string, options: any) => {
    const upgradeOptions: UpgradeOptions = {
      diamondName: diamondName || process.env.DIAMOND_NAME || '',
      networkName: networkName || process.env.NETWORK_NAME || '',
      privateKey: options.privateKey,
      rpcUrl: options.rpcUrl,
      gasLimitMultiplier: options.gasLimitMultiplier,
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs,
      useHardhatConfig: options.hardhatConfig,
      verbose: options.verbose,
      dryRun: options.dryRun,
      force: options.force,
    };
    
    await upgradeDiamond(upgradeOptions);
  });

// Legacy upgrade command for backward compatibility
program
  .command('upgrade-legacy')
  .description('Upgrade a diamond using legacy configuration (manual RPC setup)')
  .option('-d, --diamond-name <name>', 'Name of the diamond to upgrade', process.env.DIAMOND_NAME)
  .option('-r, --rpc-url <url>', 'RPC endpoint URL', process.env.RPC_URL)
  .option('-k, --private-key <key>', 'Private key for deployment', process.env.PRIVATE_KEY)
  .option('-n, --network-name <name>', 'Network name', process.env.NETWORK_NAME)
  .option('-c, --config-path <path>', 'Path to diamond configuration file', process.env.DIAMOND_CONFIG_PATH)
  .option('-p, --deployments-path <path>', 'Path to deployments directory', process.env.DEPLOYMENTS_PATH)
  .option('-t, --target-version <version>', 'Target protocol version to upgrade to', 
    val => parseInt(val))
  .option('-g, --gas-limit-multiplier <multiplier>', 'Gas limit multiplier (1.0-2.0)', 
    val => parseFloat(val), parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'))
  .option('-m, --max-retries <retries>', 'Maximum number of retries (1-10)', 
    val => parseInt(val), parseInt(process.env.MAX_RETRIES || '3'))
  .option('--retry-delay-ms <delay>', 'Retry delay in milliseconds (100-30000)', 
    val => parseInt(val), parseInt(process.env.RETRY_DELAY_MS || '2000'))
  .option('--dry-run', 'Preview changes without executing them')
  .option('--force', 'Force upgrade even if no changes detected')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: UpgradeOptions) => {
    // Force legacy mode
    options.useHardhatConfig = false;
    await upgradeDiamond(options);
  });

// Quick upgrade command using environment variables with hardhat integration
program
  .command('quick')
  .description('Quick upgrade using environment variables and hardhat configuration')
  .option('--dry-run', 'Preview changes without executing them')
  .option('--force', 'Force upgrade even if no changes detected')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: { dryRun?: boolean; force?: boolean; verbose?: boolean }) => {
    const diamondName = process.env.DIAMOND_NAME;
    const networkName = process.env.NETWORK_NAME;
    
    if (!diamondName || !networkName) {
      console.error(chalk.red('❌ Required environment variables missing:'));
      if (!diamondName) console.error(chalk.red('   - DIAMOND_NAME'));
      if (!networkName) console.error(chalk.red('   - NETWORK_NAME'));
      console.error(chalk.yellow('\n💡 Example: DIAMOND_NAME=GeniusDiamond NETWORK_NAME=sepolia npx ts-node upgrade-rpc.ts quick'));
      process.exit(1);
    }
    
    await upgradeDiamond({
      diamondName,
      networkName,
      verbose: options.verbose,
      useHardhatConfig: true,
      dryRun: options.dryRun,
      force: options.force,
    });
  });

// Rollback information command
program
  .command('rollback-info')
  .description('Show information about rollback capabilities')
  .action(() => {
    console.log(chalk.yellowBright('🔄 Diamond Rollback Information'));
    console.log(chalk.blue('='.repeat(40)));
    console.log(chalk.blue('📋 Diamond Proxy Standard (ERC-2535) does not have'));
    console.log(chalk.blue('   built-in rollback functionality.'));
    console.log(chalk.blue(''));
    console.log(chalk.blue('🔧 Rollback Options:'));
    console.log(chalk.blue('   1. Re-deploy previous facet versions'));
    console.log(chalk.blue('   2. Use diamond cut to replace facets'));
    console.log(chalk.blue('   3. Remove problematic facets'));
    console.log(chalk.blue(''));
    console.log(chalk.yellow('⚠️  Manual intervention required for rollbacks'));
    console.log(chalk.blue('💡 Best practice: Test thoroughly before deployment'));
    console.log(chalk.blue('='.repeat(40)));
  });

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
