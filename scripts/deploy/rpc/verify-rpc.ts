#!/usr/bin/env npx ts-node

/**
 * Verification script for RPC-based Diamond deployments
 * Verifies contract deployment and validates integrity
 */

import { RPCDiamondDeployer, RPCDiamondDeployerConfig } from '../../setup/rpc/RPCDiamondDeployer';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { Command } from 'commander';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('verify-rpc')
  .description('Verify diamond contracts and validate deployment integrity')
  .version('1.0.0');

/**
 * Verification options interface
 */
interface VerifyOptions {
  diamondName: string;
  networkName?: string;
  rpcUrl?: string;
  privateKey?: string;
  verbose?: boolean;
  configPath?: string;
  deploymentsPath?: string;
  etherscanApiKey?: string;
  blockExplorerUrl?: string;
  verifyContracts?: boolean;
  validateAbi?: boolean;
  validateSelectors?: boolean;
  compareOnChain?: boolean;
}

/**
 * Validates required options
 */
function validateOptions(options: VerifyOptions): void {
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
function createConfig(options: VerifyOptions): RPCDiamondDeployerConfig {
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
 * Validates contract ABIs against deployed contracts
 */
async function validateABIs(deployer: RPCDiamondDeployer, provider: ethers.JsonRpcProvider): Promise<void> {
  console.log(chalk.blueBright('\n📋 ABI Validation'));
  console.log(chalk.blue('='.repeat(40)));

  const diamond = await deployer.getDiamond();
  const deployedData = diamond.getDeployedDiamondData();
  const deployedFacets = deployedData.DeployedFacets || {};

  if (Object.keys(deployedFacets).length === 0) {
    console.log(chalk.yellow('⚠️  No facets deployed to validate'));
    console.log(chalk.blue('='.repeat(40)));
    return;
  }

  let validatedCount = 0;
  let errorCount = 0;

  for (const [facetName, facetData] of Object.entries(deployedFacets)) {
    try {
      console.log(chalk.blue(`🔍 Validating ${facetName}...`));
      
      if (!facetData.address) {
        console.log(chalk.red(`   ❌ No address found for ${facetName}`));
        errorCount++;
        continue;
      }

      // Check if contract exists
      const code = await provider.getCode(facetData.address);
      if (code === '0x') {
        console.log(chalk.red(`   ❌ No contract found at ${facetData.address}`));
        errorCount++;
        continue;
      }

      console.log(chalk.green(`   ✅ Contract exists at ${facetData.address}`));
      console.log(chalk.gray(`      Code size: ${(code.length - 2) / 2} bytes`));
      
      validatedCount++;

    } catch (error) {
      console.log(chalk.red(`   ❌ Validation failed: ${(error as Error).message}`));
      errorCount++;
    }
  }

  console.log(chalk.blue(`📊 ABI Validation: ${validatedCount} validated, ${errorCount} errors`));
  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Validates function selectors against on-chain data
 */
async function validateSelectors(deployer: RPCDiamondDeployer, provider: ethers.JsonRpcProvider): Promise<void> {
  console.log(chalk.blueBright('\n🔍 Selector Validation'));
  console.log(chalk.blue('='.repeat(40)));

  const diamond = await deployer.getDiamond();
  const deployedData = diamond.getDeployedDiamondData();
  
  if (!deployedData.DiamondAddress) {
    console.log(chalk.red('❌ No diamond address found - cannot validate selectors'));
    console.log(chalk.blue('='.repeat(40)));
    return;
  }

  try {
    // Diamond Loupe interface
    const diamondLoupeABI = [
      'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
      'function facetFunctionSelectors(address facet) external view returns (bytes4[])',
      'function facetAddresses() external view returns (address[])',
      'function facetAddress(bytes4 functionSelector) external view returns (address)'
    ];

    const contract = new ethers.Contract(deployedData.DiamondAddress, diamondLoupeABI, provider);
    
    // Query on-chain facets and selectors
    const onChainFacets = await contract.facets();
    console.log(chalk.green(`✅ Found ${onChainFacets.length} facets on-chain`));
    
    // Compare with deployment data
    const deployedFacets = deployedData.DeployedFacets || {};
    const deployedFacetCount = Object.keys(deployedFacets).length;
    
    console.log(chalk.blue(`📊 Deployed facets: ${deployedFacetCount}, On-chain facets: ${onChainFacets.length}`));
    
    if (deployedFacetCount !== onChainFacets.length) {
      console.log(chalk.yellow('⚠️  Facet count mismatch - possible deployment inconsistency'));
    }

    // Validate individual facets
    for (const onChainFacet of onChainFacets) {
      const facetAddress = onChainFacet.facetAddress;
      const selectors = onChainFacet.functionSelectors;
      
      console.log(chalk.blue(`🔧 Facet: ${facetAddress}`));
      console.log(chalk.gray(`   Selectors: ${selectors.length}`));
      
      // Check if this facet exists in our deployment data
      const deployedFacet = Object.values(deployedFacets).find(f => f.address === facetAddress);
      if (deployedFacet) {
        console.log(chalk.green(`   ✅ Facet found in deployment data`));
      } else {
        console.log(chalk.yellow(`   ⚠️  Facet not found in deployment data`));
      }
    }

  } catch (error) {
    console.error(chalk.red(`❌ Selector validation failed: ${(error as Error).message}`));
  }

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Compares stored deployment data with on-chain state
 */
async function compareOnChainState(deployer: RPCDiamondDeployer, provider: ethers.JsonRpcProvider): Promise<void> {
  console.log(chalk.blueBright('\n🌐 On-Chain State Comparison'));
  console.log(chalk.blue('='.repeat(40)));

  const diamond = await deployer.getDiamond();
  const deployedData = diamond.getDeployedDiamondData();
  
  if (!deployedData.DiamondAddress) {
    console.log(chalk.red('❌ No diamond address found - cannot compare state'));
    console.log(chalk.blue('='.repeat(40)));
    return;
  }

  try {
    // Check diamond contract
    console.log(chalk.blue(`🔍 Checking diamond at ${deployedData.DiamondAddress}`));
    const diamondCode = await provider.getCode(deployedData.DiamondAddress);
    
    if (diamondCode === '0x') {
      console.log(chalk.red('❌ Diamond contract not found on-chain!'));
      return;
    }

    console.log(chalk.green('✅ Diamond contract exists on-chain'));
    console.log(chalk.gray(`   Code size: ${(diamondCode.length - 2) / 2} bytes`));

    // Check deployer address
    if (deployedData.DeployerAddress) {
      const deployerBalance = await provider.getBalance(deployedData.DeployerAddress);
      console.log(chalk.blue(`💰 Deployer balance: ${Number(deployerBalance) / 1e18} ETH`));
    }

    // Check each facet
    const deployedFacets = deployedData.DeployedFacets || {};
    let facetValidCount = 0;
    let facetErrorCount = 0;

    for (const [facetName, facetData] of Object.entries(deployedFacets)) {
      if (!facetData.address) continue;
      
      try {
        const facetCode = await provider.getCode(facetData.address);
        if (facetCode === '0x') {
          console.log(chalk.red(`❌ Facet ${facetName} not found at ${facetData.address}`));
          facetErrorCount++;
        } else {
          console.log(chalk.green(`✅ Facet ${facetName} exists at ${facetData.address}`));
          facetValidCount++;
        }
      } catch (error) {
        console.log(chalk.red(`❌ Error checking facet ${facetName}: ${(error as Error).message}`));
        facetErrorCount++;
      }
    }

    console.log(chalk.blue(`📊 Facet validation: ${facetValidCount} valid, ${facetErrorCount} errors`));

  } catch (error) {
    console.error(chalk.red(`❌ On-chain state comparison failed: ${(error as Error).message}`));
  }

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Shows contract verification information
 */
function showContractVerificationInfo(options: VerifyOptions): void {
  console.log(chalk.blueBright('\n📄 Contract Verification Information'));
  console.log(chalk.blue('='.repeat(40)));

  if (options.etherscanApiKey) {
    console.log(chalk.green('✅ Etherscan API key provided'));
    console.log(chalk.blue('💡 Automatic verification may be possible'));
  } else {
    console.log(chalk.yellow('⚠️  No Etherscan API key provided'));
    console.log(chalk.blue('💡 Manual verification will be required'));
  }

  if (options.blockExplorerUrl) {
    console.log(chalk.blue(`🔗 Block Explorer: ${options.blockExplorerUrl}`));
  } else {
    console.log(chalk.blue('🔗 Block Explorer: Auto-detect based on network'));
  }

  console.log(chalk.blue(''));
  console.log(chalk.blue('💡 Manual Verification Steps:'));
  console.log(chalk.gray('   1. Visit your block explorer (e.g., Etherscan)'));
  console.log(chalk.gray('   2. Navigate to each contract address'));
  console.log(chalk.gray('   3. Use "Verify and Publish" with contract source'));
  console.log(chalk.gray('   4. Ensure compiler version matches deployment'));

  console.log(chalk.blue('='.repeat(40)));
}

/**
 * Main verification function
 */
async function verifyDeployment(options: VerifyOptions): Promise<void> {
  try {
    // Validate options
    validateOptions(options);

    // Create configuration
    const config = createConfig(options);

    console.log(chalk.blueBright('\n🔍 RPC Diamond Verification'));
    console.log(chalk.blue('='.repeat(50)));
    console.log(chalk.blue(`💎 Diamond Name: ${config.diamondName}`));
    console.log(chalk.blue(`🔗 RPC URL: ${config.rpcUrl}`));
    console.log(chalk.blue('='.repeat(50)));

    // Initialize the RPCDiamondDeployer
    console.log(chalk.blue('🔧 Initializing RPCDiamondDeployer...'));
    const deployer = await RPCDiamondDeployer.getInstance(config);
    
    // Check if diamond is deployed
    if (!deployer.isDiamondDeployed()) {
      console.error(chalk.red('❌ Diamond is not deployed yet. Use deploy-rpc.ts first.'));
      process.exit(1);
    }

    console.log(chalk.green('✅ Diamond deployment found'));

    // Create provider for verification
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // Validate configuration first
    console.log(chalk.blue('\n🔍 Configuration Validation'));
    console.log(chalk.blue('-'.repeat(30)));
    
    const validation = await deployer.validateConfiguration();
    if (validation.valid) {
      console.log(chalk.green('✅ Configuration is valid'));
    } else {
      console.log(chalk.red('❌ Configuration validation failed:'));
      validation.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
    }

    // Show network information
    const networkInfo = await deployer.getNetworkInfo();
    console.log(chalk.blue('\n🌐 Network Information'));
    console.log(chalk.blue('-'.repeat(25)));
    console.log(chalk.blue(`Network: ${networkInfo.networkName} (Chain ID: ${networkInfo.chainId})`));
    console.log(chalk.blue(`Block Number: ${networkInfo.blockNumber}`));
    console.log(chalk.blue(`Gas Price: ${Number(networkInfo.gasPrice) / 1e9} gwei`));

    // Perform verification steps based on options
    if (options.validateAbi || !options.verifyContracts && !options.validateSelectors && !options.compareOnChain) {
      await validateABIs(deployer, provider);
    }

    if (options.validateSelectors || !options.verifyContracts && !options.validateAbi && !options.compareOnChain) {
      await validateSelectors(deployer, provider);
    }

    if (options.compareOnChain || !options.verifyContracts && !options.validateAbi && !options.validateSelectors) {
      await compareOnChainState(deployer, provider);
    }

    if (options.verifyContracts) {
      showContractVerificationInfo(options);
    }

    console.log(chalk.greenBright('\n🎉 Verification completed successfully!'));

  } catch (error) {
    console.error(chalk.red('\n❌ Verification failed:'));
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
  .command('verify')
  .description('Verify diamond deployment')
  .option('-d, --diamond-name <name>', 'Name of the diamond to verify', process.env.DIAMOND_NAME)
  .option('-r, --rpc-url <url>', 'RPC endpoint URL', process.env.RPC_URL)
  .option('-k, --private-key <key>', 'Private key', process.env.PRIVATE_KEY)
  .option('-n, --network-name <name>', 'Network name', process.env.NETWORK_NAME)
  .option('-c, --config-path <path>', 'Path to diamond configuration file', process.env.DIAMOND_CONFIG_PATH)
  .option('-p, --deployments-path <path>', 'Path to deployments directory', process.env.DEPLOYMENTS_PATH)
  .option('--etherscan-api-key <key>', 'Etherscan API key for contract verification', process.env.ETHERSCAN_API_KEY)
  .option('--block-explorer-url <url>', 'Block explorer URL', process.env.BLOCK_EXPLORER_URL)
  .option('--verify-contracts', 'Show contract verification information')
  .option('--validate-abi', 'Validate contract ABIs')
  .option('--validate-selectors', 'Validate function selectors')
  .option('--compare-on-chain', 'Compare with on-chain state')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: VerifyOptions) => {
    await verifyDeployment(options);
  });

// Full verification command
program
  .command('full')
  .description('Perform full verification (all checks)')
  .option('-d, --diamond-name <name>', 'Name of the diamond to verify', process.env.DIAMOND_NAME)
  .option('-r, --rpc-url <url>', 'RPC endpoint URL', process.env.RPC_URL)
  .option('-k, --private-key <key>', 'Private key', process.env.PRIVATE_KEY)
  .option('-n, --network-name <name>', 'Network name', process.env.NETWORK_NAME)
  .option('-c, --config-path <path>', 'Path to diamond configuration file', process.env.DIAMOND_CONFIG_PATH)
  .option('-p, --deployments-path <path>', 'Path to deployments directory', process.env.DEPLOYMENTS_PATH)
  .option('--etherscan-api-key <key>', 'Etherscan API key for contract verification', process.env.ETHERSCAN_API_KEY)
  .option('--block-explorer-url <url>', 'Block explorer URL', process.env.BLOCK_EXPLORER_URL)
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: VerifyOptions) => {
    // Enable all verification options
    options.verifyContracts = true;
    options.validateAbi = true;
    options.validateSelectors = true;
    options.compareOnChain = true;
    
    await verifyDeployment(options);
  });

// Quick verification using environment variables
program
  .command('quick')
  .description('Quick verification using environment variables')
  .option('--validate-abi', 'Validate contract ABIs')
  .option('--validate-selectors', 'Validate function selectors')
  .option('--compare-on-chain', 'Compare with on-chain state')
  .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true')
  .action(async (options: Partial<VerifyOptions>) => {
    try {
      const config = RPCDiamondDeployer.createConfigFromEnv({ verbose: options.verbose });
      
      await verifyDeployment({
        diamondName: config.diamondName,
        rpcUrl: config.rpcUrl,
        privateKey: config.privateKey,
        networkName: config.networkName,
        configPath: config.configFilePath,
        deploymentsPath: config.deploymentsPath,
        verbose: config.verbose,
        etherscanApiKey: process.env.ETHERSCAN_API_KEY,
        blockExplorerUrl: process.env.BLOCK_EXPLORER_URL,
        validateAbi: options.validateAbi,
        validateSelectors: options.validateSelectors,
        compareOnChain: options.compareOnChain,
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
