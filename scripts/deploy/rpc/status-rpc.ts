#!/usr/bin/env npx ts-node

/**
 * Status checking script for RPC-based Diamond deployments
 * Checks deployment status and validates configuration
 */

import { RPCDiamondDeployer, RPCDiamondDeployerConfig, DeploymentStatus } from '../../setup/rpc/RPCDiamondDeployer';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { Command } from 'commander';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('status-rpc')
  .description('Check diamond deployment status and validate configuration')
  .version('1.0.0');

/**
 * Status options interface
 */
interface StatusOptions {
  diamondName: string;
  networkName?: string;
  rpcUrl?: string;
  privateKey?: string;
  verbose?: boolean;
  configPath?: string;
  deploymentsPath?: string;
  onChainValidation?: boolean;
  showConfig?: boolean;
  showFacets?: boolean;
  showSelectors?: boolean;
}

/**
 * Validates required options
 */
function validateOptions(options: StatusOptions): void {
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
function createConfig(options: StatusOptions): RPCDiamondDeployerConfig {
  const config: RPCDiamondDeployerConfig = {
    diamondName: options.diamondName,
    rpcUrl: options.rpcUrl!,
    privateKey: options.privateKey!,
    networkName: options.networkName || 'unknown',
    chainId: 0, // Will be auto-detected
    verbose: options.verbose || false,
    configFilePath: options.configPath,
    deploymentsPath: options.deploymentsPath,
    writeDeployedDiamondData: true,
  };

  return config;
}

/**
 * Performs on-chain validation of diamond
 */
async function validateOnChain(deployer: RPCDiamondDeployer, rpcUrl: string): Promise<void> {
  console.log(chalk.blueBright('\n🌐 On-Chain Validation'));
  console.log(chalk.blue('='.repeat(40)));

  const diamond = await deployer.getDiamond();
  const deployedData = diamond.getDeployedDiamondData();
  
  if (!deployedData.DiamondAddress) {
    console.log(chalk.red('❌ No diamond address found - cannot validate on-chain'));
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const diamondAddress = deployedData.DiamondAddress;

    // Check if contract exists
    const code = await provider.getCode(diamondAddress);
    if (code === '0x') {
      console.log(chalk.red(`❌ No contract found at address: ${diamondAddress}`));
      return;
    }

    console.log(chalk.green(`✅ Contract exists at ${diamondAddress}`));
    console.log(chalk.gray(`   Code size: ${(code.length - 2) / 2} bytes`));

    // Try to load IDiamondLoupe interface and query facets
    try {
      const diamondLoupeABI = [
        'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
        'function facetFunctionSelectors(address facet) external view returns (bytes4[])',
        'function facetAddresses() external view returns (address[])',
        'function facetAddress(bytes4 functionSelector) external view returns (address)'
      ];

      const contract = new ethers.Contract(diamondAddress, diamondLoupeABI, provider);
      
      // Query facets
      const facets = await contract.facets();
      console.log(chalk.green(`✅ Diamond Loupe working - ${facets.length} facets active`));
      
      facets.forEach((facet: any, index: number) => {
        console.log(chalk.gray(`   Facet ${index + 1}: ${facet.facetAddress} (${facet.functionSelectors.length} selectors)`));
      });

    } catch (loupeError) {
      console.log(chalk.yellow(`⚠️  Could not query Diamond Loupe: ${(loupeError as Error).message}`));
    }

  } catch (error) {
    console.error(chalk.red(`❌ On-chain validation failed: ${(error as Error).message}`));
  }

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Shows configuration details
 */
async function showConfiguration(deployer: RPCDiamondDeployer): Promise<void> {
  console.log(chalk.blueBright('\n⚙️ Configuration Details'));
  console.log(chalk.blue('='.repeat(40)));

  const config = deployer.getConfig();
  const networkInfo = await deployer.getNetworkInfo();

  console.log(chalk.blue(`📦 Diamond Name: ${config.diamondName}`));
  console.log(chalk.blue(`🌐 Network: ${config.networkName} (Chain ID: ${config.chainId})`));
  console.log(chalk.blue(`🔗 RPC URL: ${config.rpcUrl}`));
  console.log(chalk.blue(`👤 Deployer: ${networkInfo.signerAddress}`));
  console.log(chalk.blue(`📁 Deployments Path: ${config.deploymentsPath || 'default'}`));
  console.log(chalk.blue(`📄 Config File: ${config.configFilePath || 'default'}`));

  const diamond = await deployer.getDiamond();
  const deployConfig = diamond.getDeployConfig();
  
  if (deployConfig.protocolVersion) {
    console.log(chalk.blue(`📋 Protocol Version: ${deployConfig.protocolVersion}`));
  }

  console.log(chalk.blue(`⛽ Gas Limit Multiplier: ${config.gasLimitMultiplier || 1.2}`));
  console.log(chalk.blue(`🔄 Max Retries: ${config.maxRetries || 3}`));
  console.log(chalk.blue(`⏱️ Retry Delay: ${config.retryDelayMs || 2000}ms`));

  // Show facet configuration
  const facetsConfig = deployConfig.facets || {};
  const facetNames = Object.keys(facetsConfig);
  
  if (facetNames.length > 0) {
    console.log(chalk.blue(`🔧 Configured Facets: ${facetNames.length}`));
    facetNames.forEach(name => {
      console.log(chalk.gray(`   ${name}`));
    });
  }

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Shows deployed facets details
 */
async function showFacetsDetails(deployer: RPCDiamondDeployer, verbose: boolean = false): Promise<void> {
  console.log(chalk.blueBright('\n🔧 Deployed Facets'));
  console.log(chalk.blue('='.repeat(40)));

  const diamond = await deployer.getDiamond();
  const deployedData = diamond.getDeployedDiamondData();
  const deployedFacets = deployedData.DeployedFacets || {};

  if (Object.keys(deployedFacets).length === 0) {
    console.log(chalk.yellow('⚠️  No facets deployed yet'));
    console.log(chalk.blue('='.repeat(40)));
    return;
  }

  Object.entries(deployedFacets).forEach(([name, facet]) => {
    console.log(chalk.blue(`📄 ${name}`));
    console.log(chalk.gray(`   Address: ${facet.address}`));
    
    if (verbose && facet.funcSelectors) {
      console.log(chalk.gray(`   Selectors: ${facet.funcSelectors.length}`));
      facet.funcSelectors.forEach((selector: string) => {
        console.log(chalk.gray(`     ${selector}`));
      });
    }
  });

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Shows function selectors registry
 */
async function showSelectorsRegistry(deployer: RPCDiamondDeployer): Promise<void> {
  console.log(chalk.blueBright('\n🔍 Function Selectors Registry'));
  console.log(chalk.blue('='.repeat(40)));

  const diamond = await deployer.getDiamond();
  const registry = diamond.functionSelectorRegistry;
  
  if (registry.size === 0) {
    console.log(chalk.yellow('⚠️  No function selectors registered'));
    console.log(chalk.blue('='.repeat(40)));
    return;
  }

  // Group selectors by facet
  const facetGroups: Record<string, Array<{ selector: string; priority: number; action: string; address: string }>> = {};

  for (const [selector, entry] of registry.entries()) {
    const facetName = entry.facetName || 'Unknown';
    if (!facetGroups[facetName]) {
      facetGroups[facetName] = [];
    }
    facetGroups[facetName].push({
      selector,
      priority: entry.priority,
      action: entry.action.toString(),
      address: 'unknown' // entry.address will be available in the actual implementation
    });
  }

  Object.entries(facetGroups).forEach(([facetName, selectors]) => {
    console.log(chalk.blue(`📄 ${facetName} (${selectors.length} selectors)`));
    selectors.forEach(sel => {
      console.log(chalk.gray(`   ${sel.selector} [${sel.action}] - ${sel.address}`));
    });
  });

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Main status checking function
 */
async function checkStatus(options: StatusOptions): Promise<void> {
  try {
    // Validate options
    validateOptions(options);

    // Create configuration
    const config = createConfig(options);

    console.log(chalk.blueBright('\n📊 RPC Diamond Status Check'));
    console.log(chalk.blue('='.repeat(50)));
    console.log(chalk.blue(`💎 Diamond Name: ${config.diamondName}`));
    console.log(chalk.blue(`🔗 RPC URL: ${config.rpcUrl}`));
    console.log(chalk.blue('='.repeat(50)));

    // Initialize the RPCDiamondDeployer
    console.log(chalk.blue('🔧 Initializing RPCDiamondDeployer...'));
    const deployer = await RPCDiamondDeployer.getInstance(config);
    
    // Get deployment status
    const status = deployer.getDeploymentStatus();
    const isDiamondDeployed = deployer.isDiamondDeployed();

    console.log(chalk.blueBright('\n📈 Deployment Status'));
    console.log(chalk.blue('='.repeat(40)));
    
    const statusColor = status === DeploymentStatus.COMPLETED ? 'green' : 
                       status === DeploymentStatus.IN_PROGRESS ? 'yellow' : 
                       status === DeploymentStatus.UPGRADE_AVAILABLE ? 'cyan' : 'red';
    
    console.log(chalk[statusColor](`📊 Status: ${status}`));
    console.log(chalk.blue(`💎 Diamond Deployed: ${isDiamondDeployed ? 'Yes' : 'No'}`));

    if (isDiamondDeployed) {
      const diamond = await deployer.getDiamond();
      const deployedData = diamond.getDeployedDiamondData();
      
      console.log(chalk.blue(`📍 Diamond Address: ${deployedData.DiamondAddress}`));
      
      if (deployedData.protocolVersion) {
        console.log(chalk.blue(`📋 Protocol Version: ${deployedData.protocolVersion}`));
      }

      if (deployedData.DeployedFacets) {
        const facetCount = Object.keys(deployedData.DeployedFacets).length;
        console.log(chalk.blue(`🔧 Deployed Facets: ${facetCount}`));
      }
    }

    // Show network information
    if (isDiamondDeployed) {
      const networkInfo = await deployer.getNetworkInfo();
      console.log(chalk.blue(`💰 Deployer Balance: ${Number(networkInfo.balance) / 1e18} ETH`));
      console.log(chalk.blue(`⛽ Current Gas Price: ${Number(networkInfo.gasPrice) / 1e9} gwei`));
      console.log(chalk.blue(`📦 Block Number: ${networkInfo.blockNumber}`));
    }

    console.log(chalk.blue('='.repeat(40)));

    // Configuration validation
    console.log(chalk.blue('\n🔍 Configuration Validation'));
    console.log(chalk.blue('-'.repeat(30)));
    
    const validation = await deployer.validateConfiguration();
    if (validation.valid) {
      console.log(chalk.green('✅ Configuration is valid'));
    } else {
      console.log(chalk.red('❌ Configuration validation failed:'));
      validation.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
    }

    // Optional detailed information
    if (options.showConfig) {
      await showConfiguration(deployer);
    }

    if (options.showFacets && isDiamondDeployed) {
      await showFacetsDetails(deployer, options.verbose);
    }

    if (options.showSelectors && isDiamondDeployed) {
      await showSelectorsRegistry(deployer);
    }

    if (options.onChainValidation && isDiamondDeployed) {
      await validateOnChain(deployer, config.rpcUrl);
    }

    console.log(chalk.green('\n✅ Status check completed'));

  } catch (error) {
    console.error(chalk.red('\n❌ Status check failed:'));
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
  .command('check')
  .description('Check diamond deployment status')
  .option('-d, --diamond-name <name>', 'Name of the diamond', process.env.DIAMOND_NAME)
  .option('-r, --rpc-url <url>', 'RPC endpoint URL', process.env.RPC_URL)
  .option('-k, --private-key <key>', 'Private key', process.env.PRIVATE_KEY)
  .option('-n, --network-name <name>', 'Network name', process.env.NETWORK_NAME)
  .option('-c, --config-path <path>', 'Path to diamond configuration file', process.env.DIAMOND_CONFIG_PATH)
  .option('-p, --deployments-path <path>', 'Path to deployments directory', process.env.DEPLOYMENTS_PATH)
  .option('--on-chain-validation', 'Perform on-chain validation')
  .option('--show-config', 'Show configuration details')
  .option('--show-facets', 'Show deployed facets details')
  .option('--show-selectors', 'Show function selectors registry')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: StatusOptions) => {
    await checkStatus(options);
  });

// Quick status command using environment variables
program
  .command('quick')
  .description('Quick status check using environment variables')
  .option('--on-chain-validation', 'Perform on-chain validation')
  .option('--show-config', 'Show configuration details')
  .option('--show-facets', 'Show deployed facets details')
  .option('--show-selectors', 'Show function selectors registry')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: Partial<StatusOptions>) => {
    try {
      const config = RPCDiamondDeployer.createConfigFromEnv({ verbose: options.verbose });
      
      await checkStatus({
        diamondName: config.diamondName,
        rpcUrl: config.rpcUrl,
        privateKey: config.privateKey,
        networkName: config.networkName,
        configPath: config.configFilePath,
        deploymentsPath: config.deploymentsPath,
        verbose: config.verbose,
        onChainValidation: options.onChainValidation,
        showConfig: options.showConfig,
        showFacets: options.showFacets,
        showSelectors: options.showSelectors,
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
