/**
 * Common infrastructure for RPC deployment scripts
 * Eliminates boilerplate code and provides shared functionality
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { RPCDiamondDeployer, RPCDiamondDeployerConfig } from '../../setup/rpc/RPCDiamondDeployer';

/**
 * Base options interface for all RPC deployment scripts
 */
export interface BaseRPCOptions {
  diamondName: string;
  networkName?: string;
  rpcUrl?: string;
  privateKey?: string;
  verbose?: boolean;
  configPath?: string;
  deploymentsPath?: string;
  gasLimitMultiplier?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  useHardhatConfig?: boolean;
}

/**
 * Extended options for deployment operations
 */
export interface DeploymentOptions extends BaseRPCOptions {
  force?: boolean;
  skipVerification?: boolean;
}

/**
 * Extended options for upgrade operations
 */
export interface UpgradeOptions extends BaseRPCOptions {
  dryRun?: boolean;
  force?: boolean;
  targetVersion?: string;
  skipAnalysis?: boolean;
}

/**
 * Extended options for verification operations
 */
export interface VerifyOptions extends BaseRPCOptions {
  etherscanApiKey?: string;
  validateAbi?: boolean;
  validateSelectors?: boolean;
  onChainValidation?: boolean;
  diamondAddress?: string;
}

/**
 * Extended options for status operations
 */
export interface StatusOptions extends BaseRPCOptions {
  onChainValidation?: boolean;
  showConfig?: boolean;
  showFacets?: boolean;
  showSelectors?: boolean;
  diamondAddress?: string;
}

/**
 * Sets up a new Commander program with common configuration
 */
export function setupProgram(name: string, description: string): Command {
  dotenv.config();
  
  const program = new Command();
  program
    .name(name)
    .description(description)
    .version('1.0.0');
    
  return program;
}

/**
 * Adds common CLI options to a Commander command
 */
export function addCommonOptions(command: Command): Command {
  return command
    .option('-d, --diamond-name <name>', 'Name of the diamond', process.env.DIAMOND_NAME)
    .option('-n, --network-name <name>', 'Network name', process.env.NETWORK_NAME)
    .option('-r, --rpc-url <url>', 'RPC endpoint URL', process.env.RPC_URL)
    .option('-k, --private-key <key>', 'Private key', process.env.PRIVATE_KEY)
    .option('-c, --config-path <path>', 'Path to diamond configuration file', process.env.DIAMOND_CONFIG_PATH)
    .option('-p, --deployments-path <path>', 'Path to deployments directory', process.env.DEPLOYMENTS_PATH)
    .option('-g, --gas-limit-multiplier <multiplier>', 'Gas limit multiplier (1.0-2.0)', 
      val => parseFloat(val), parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'))
    .option('-m, --max-retries <retries>', 'Maximum number of retries (1-10)', 
      val => parseInt(val), parseInt(process.env.MAX_RETRIES || '3'))
    .option('-t, --retry-delay-ms <delay>', 'Retry delay in milliseconds (100-30000)', 
      val => parseInt(val), parseInt(process.env.RETRY_DELAY_MS || '2000'))
    .option('--use-hardhat-config', 'Use hardhat configuration (default: true)', 
      process.env.USE_HARDHAT_CONFIG !== 'false')
    .option('--no-use-hardhat-config', 'Disable hardhat configuration')
    .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true');
}

/**
 * Adds deployment-specific options to a command
 */
export function addDeploymentOptions(command: Command): Command {
  return command
    .option('-f, --force', 'Force deployment even if already deployed', process.env.FORCE_DEPLOY === 'true')
    .option('--skip-verification', 'Skip contract verification', process.env.SKIP_VERIFICATION === 'true');
}

/**
 * Adds upgrade-specific options to a command
 */
export function addUpgradeOptions(command: Command): Command {
  return command
    .option('--dry-run', 'Perform a dry run without actual deployment', process.env.DRY_RUN === 'true')
    .option('-f, --force', 'Force upgrade even if no changes detected', process.env.FORCE_UPGRADE === 'true')
    .option('--target-version <version>', 'Target protocol version', process.env.TARGET_VERSION)
    .option('--skip-analysis', 'Skip upgrade analysis', process.env.SKIP_ANALYSIS === 'true');
}

/**
 * Adds verification-specific options to a command
 */
export function addVerifyOptions(command: Command): Command {
  return command
    .option('--etherscan-api-key <key>', 'Etherscan API key for verification', process.env.ETHERSCAN_API_KEY)
    .option('--validate-abi', 'Validate contract ABIs', process.env.VALIDATE_ABI === 'true')
    .option('--validate-selectors', 'Validate function selectors', process.env.VALIDATE_SELECTORS === 'true')
    .option('--on-chain-validation', 'Perform on-chain validation', process.env.ON_CHAIN_VALIDATION === 'true')
    .option('--diamond-address <address>', 'Diamond contract address', process.env.DIAMOND_ADDRESS);
}

/**
 * Adds status-specific options to a command
 */
export function addStatusOptions(command: Command): Command {
  return command
    .option('--on-chain-validation', 'Perform on-chain validation', process.env.ON_CHAIN_VALIDATION === 'true')
    .option('--show-config', 'Show configuration details', process.env.SHOW_CONFIG === 'true')
    .option('--show-facets', 'Show facet details', process.env.SHOW_FACETS === 'true')
    .option('--show-selectors', 'Show function selectors', process.env.SHOW_SELECTORS === 'true')
    .option('--diamond-address <address>', 'Diamond contract address', process.env.DIAMOND_ADDRESS);
}

/**
 * Validates common RPC options
 */
export function validateRPCOptions(options: BaseRPCOptions): void {
  const errors: string[] = [];

  if (!options.diamondName) {
    errors.push('Diamond name is required (--diamond-name or DIAMOND_NAME environment variable)');
  }

  if (!options.networkName) {
    errors.push('Network name is required (--network-name or NETWORK_NAME environment variable)');
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

  // Validate numeric options
  if (options.gasLimitMultiplier && (options.gasLimitMultiplier < 1.0 || options.gasLimitMultiplier > 2.0)) {
    errors.push('Gas limit multiplier must be between 1.0 and 2.0');
  }

  if (options.maxRetries && (options.maxRetries < 1 || options.maxRetries > 10)) {
    errors.push('Max retries must be between 1 and 10');
  }

  if (options.retryDelayMs && (options.retryDelayMs < 100 || options.retryDelayMs > 30000)) {
    errors.push('Retry delay must be between 100 and 30000 milliseconds');
  }

  if (errors.length > 0) {
    console.error(chalk.red('❌ Validation errors:'));
    errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
    process.exit(1);
  }
}

/**
 * Creates RPC configuration from options using hardhat configurations
 */
export function createRPCConfig(options: BaseRPCOptions): RPCDiamondDeployerConfig {
  const privateKey = options.privateKey || process.env.PRIVATE_KEY || process.env.TEST_PRIVATE_KEY!;
  
  // Use hardhat configuration if requested (default) or if no legacy options provided
  if (options.useHardhatConfig !== false && !options.rpcUrl) {
    if (options.verbose) {
      console.log(chalk.blue('📋 Using hardhat configuration for diamond and network settings'));
    }
    
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
          configFilePath: options.configPath,
          deploymentsPath: options.deploymentsPath,
        }
      );
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create config from hardhat: ${(error as Error).message}`));
      console.error(chalk.yellow('💡 Try using legacy mode with --no-use-hardhat-config and explicit --rpc-url'));
      process.exit(1);
    }
  }

  // Legacy mode: create config manually
  if (options.verbose) {
    console.log(chalk.blue('📋 Using legacy configuration mode'));
  }

  return {
    diamondName: options.diamondName,
    networkName: options.networkName || 'hardhat',
    rpcUrl: options.rpcUrl || process.env.RPC_URL || 'http://localhost:8545',
    privateKey: privateKey,
    chainId: 0, // Will be auto-detected
    verbose: options.verbose || false,
    gasLimitMultiplier: options.gasLimitMultiplier,
    maxRetries: options.maxRetries,
    retryDelayMs: options.retryDelayMs,
    configFilePath: options.configPath,
    deploymentsPath: options.deploymentsPath,
    writeDeployedDiamondData: true,
  };
}

/**
 * Handles script errors with consistent formatting and logging
 */
export function handleScriptError(error: Error, verbose?: boolean, operationName: string = 'Operation'): never {
  console.error(chalk.red(`❌ ${operationName} failed: ${error.message}`));
  
  if (verbose && error.stack) {
    console.error(chalk.gray('\nStack trace:'));
    console.error(chalk.gray(error.stack));
  }
  
  process.exit(1);
}

/**
 * Creates a quick command that uses environment variables
 */
export function createQuickCommand<T extends BaseRPCOptions>(
  program: Command, 
  name: string, 
  description: string, 
  action: (config: RPCDiamondDeployerConfig, options: T) => Promise<void>,
  additionalOptions?: (command: Command) => Command
): void {
  let command = program
    .command(name)
    .description(description)
    .option('-v, --verbose', 'Enable verbose logging', process.env.VERBOSE === 'true');

  if (additionalOptions) {
    command = additionalOptions(command);
  }

  command.action(async (options: Partial<T>) => {
    try {
      const config = RPCDiamondDeployer.createConfigFromEnv({ verbose: options.verbose });
      await action(config, options as T);
    } catch (error) {
      handleScriptError(error as Error, options.verbose, `Quick ${name}`);
    }
  });
}

/**
 * Shows pre-operation information in a consistent format
 */
export async function showPreOperationInfo(
  config: RPCDiamondDeployerConfig,
  operationName: string,
  additionalInfo?: Record<string, any>
): Promise<void> {
  console.log(chalk.blue(`\n🚀 ${operationName} Configuration`));
  console.log(chalk.blue('====================================='));
  console.log(`📋 Diamond Name: ${chalk.white(config.diamondName)}`);
  console.log(`🌐 Network: ${chalk.white(config.networkName)}`);
  console.log(`🔗 RPC URL: ${chalk.white(config.rpcUrl)}`);
  console.log(`⛽ Gas Limit Multiplier: ${chalk.white(config.gasLimitMultiplier || '1.2')}`);
  console.log(`🔄 Max Retries: ${chalk.white(config.maxRetries || '3')}`);
  console.log(`⏱️  Retry Delay: ${chalk.white(config.retryDelayMs || '2000')}ms`);
  
  if (config.configFilePath) {
    console.log(`📄 Config File: ${chalk.white(config.configFilePath)}`);
  }
  
  if (config.deploymentsPath) {
    console.log(`📁 Deployments Path: ${chalk.white(config.deploymentsPath)}`);
  }

  if (additionalInfo) {
    console.log(chalk.blue('\n📊 Additional Information'));
    console.log(chalk.blue('=========================='));
    Object.entries(additionalInfo).forEach(([key, value]) => {
      console.log(`${key}: ${chalk.white(String(value))}`);
    });
  }

  console.log(''); // Empty line for spacing
}

/**
 * Shows operation completion summary
 */
export function showOperationSummary(
  operationName: string,
  duration: number,
  results?: Record<string, any>
): void {
  console.log(chalk.green(`\n✅ ${operationName} completed successfully!`));
  console.log(chalk.green('=========================================='));
  console.log(`⏱️  Duration: ${chalk.white(duration.toFixed(2))} seconds`);

  if (results) {
    Object.entries(results).forEach(([key, value]) => {
      console.log(`${key}: ${chalk.white(String(value))}`);
    });
  }

  console.log(''); // Empty line for spacing
}

/**
 * Creates a main command with positional arguments
 */
export function createMainCommand<T extends BaseRPCOptions>(
  program: Command,
  commandName: string,
  description: string,
  args: string,
  action: (options: T) => Promise<void>,
  optionBuilder: (command: Command) => Command
): Command {
  return optionBuilder(addCommonOptions(program
    .command(`${commandName} ${args}`)
    .description(description)))
    .action(async (diamondName: string, networkName: string, options: Partial<T>) => {
      try {
        const fullOptions = { ...options, diamondName, networkName } as T;
        validateRPCOptions(fullOptions);
        await action(fullOptions);
      } catch (error) {
        handleScriptError(error as Error, options.verbose, commandName);
      }
    });
}

/**
 * Creates a legacy command for backward compatibility
 */
export function createLegacyCommand<T extends BaseRPCOptions>(
  program: Command,
  commandName: string,
  description: string,
  action: (options: T) => Promise<void>,
  optionBuilder: (command: Command) => Command
): Command {
  return optionBuilder(addCommonOptions(program
    .command(`${commandName}-legacy`)
    .description(`${description} (legacy mode with explicit options)`)))
    .action(async (options: T) => {
      try {
        validateRPCOptions(options);
        await action(options);
      } catch (error) {
        handleScriptError(error as Error, options.verbose, `${commandName}-legacy`);
      }
    });
}
