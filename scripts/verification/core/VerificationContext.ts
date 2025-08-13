/**
 * Verification context utilities and helpers
 * 
 * Provides utilities for creating and managing verification contexts.
 */

import { Provider, JsonRpcProvider } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import {
  VerificationContext,
  VerificationConfig,
  DiamondInfo,
  NetworkInfo,
  ConfigurationSource
} from './types';

/**
 * Context builder for creating verification contexts
 */
export class VerificationContextBuilder {
  private diamond?: DiamondInfo;
  private provider?: Provider;
  private config?: VerificationConfig;
  private verbose: boolean = false;
  private dryRun: boolean = false;

  /**
   * Set diamond information
   */
  public setDiamond(diamond: DiamondInfo): this {
    this.diamond = diamond;
    return this;
  }

  /**
   * Set provider
   */
  public setProvider(provider: Provider): this {
    this.provider = provider;
    return this;
  }

  /**
   * Set verification configuration
   */
  public setConfig(config: VerificationConfig): this {
    this.config = config;
    return this;
  }

  /**
   * Enable verbose logging
   */
  public setVerbose(verbose: boolean = true): this {
    this.verbose = verbose;
    return this;
  }

  /**
   * Enable dry run mode
   */
  public setDryRun(dryRun: boolean = true): this {
    this.dryRun = dryRun;
    return this;
  }

  /**
   * Build the verification context
   */
  public build(): VerificationContext {
    if (!this.diamond) {
      throw new Error('Diamond information is required');
    }
    if (!this.provider) {
      throw new Error('Provider is required');
    }
    if (!this.config) {
      throw new Error('Verification configuration is required');
    }

    return {
      diamond: this.diamond,
      provider: this.provider,
      config: this.config,
      moduleConfig: this.extractModuleConfig(this.config),
      startTime: new Date(),
      verbose: this.verbose,
      dryRun: this.dryRun
    };
  }

  /**
   * Extract module-specific configuration from main config
   */
  private extractModuleConfig(config: VerificationConfig): Record<string, any> {
    const moduleConfig: Record<string, any> = {};
    
    for (const [moduleId, moduleConf] of Object.entries(config.modules)) {
      if (moduleConf.enabled) {
        moduleConfig[moduleId] = moduleConf.config || {};
      }
    }

    return moduleConfig;
  }
}

/**
 * Utilities for working with diamond configurations
 */
export class DiamondConfigLoader {
  /**
   * Load diamond information from various sources
   */
  public static async loadDiamondInfo(
    diamondName: string,
    networkName: string,
    address?: string,
    configPath?: string
  ): Promise<DiamondInfo> {
    // Default config path if not provided
    if (!configPath) {
      configPath = path.join(process.cwd(), 'diamonds', diamondName, `${diamondName.toLowerCase()}.config.json`);
    }

    // Verify config file exists
    if (!fs.existsSync(configPath)) {
      throw new Error(`Diamond configuration file not found: ${configPath}`);
    }

    // Load network information
    const networkInfo = await this.loadNetworkInfo(networkName);

    // If address not provided, try to load from deployments
    let diamondAddress = address;
    if (!diamondAddress) {
      diamondAddress = await this.loadDiamondAddress(diamondName, networkName);
    }

    if (!diamondAddress) {
      throw new Error(`Diamond address not found for ${diamondName} on ${networkName}`);
    }

    return {
      name: diamondName,
      address: diamondAddress,
      configPath,
      network: networkInfo
    };
  }

  /**
   * Load network information
   */
  public static async loadNetworkInfo(networkName: string): Promise<NetworkInfo> {
    // Try to load from environment variables
    const rpcUrl = process.env[`${networkName.toUpperCase()}_RPC`] || process.env.RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`RPC URL not found for network '${networkName}'. Please set ${networkName.toUpperCase()}_RPC environment variable.`);
    }

    // Get chain ID from provider
    const provider = new JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();

    return {
      name: networkName,
      chainId: Number(network.chainId),
      rpcUrl,
      blockExplorerUrl: this.getBlockExplorerUrl(networkName),
      blockExplorerApiKey: this.getBlockExplorerApiKey(networkName)
    };
  }

  /**
   * Load diamond address from deployment data
   */
  public static async loadDiamondAddress(diamondName: string, networkName: string): Promise<string | undefined> {
    // Try multiple sources for diamond address
    const possiblePaths = [
      // Standard deployment paths
      path.join(process.cwd(), 'deployments', diamondName, `${networkName}.json`),
      path.join(process.cwd(), 'deployments', networkName, `${diamondName}.json`),
      path.join(process.cwd(), 'diamond-abi', `${diamondName}.json`),
      // Diamonds deployment paths
      path.join(process.cwd(), 'diamonds', diamondName, 'deployments', `${networkName}.json`),
      path.join(process.cwd(), 'diamonds', diamondName, 'deployments', `${diamondName.toLowerCase()}-${networkName}.json`),
      path.join(process.cwd(), 'diamonds', diamondName, 'deployments', `${diamondName.toLowerCase()}-${networkName}-11155111.json`),
      // Legacy and additional paths
      path.join(process.cwd(), 'deployments-test', diamondName, 'deployments', `${diamondName.toLowerCase()}-${networkName}-11155111.json`),
      path.join(process.cwd(), 'test-diamonds', diamondName, 'deployments', `${diamondName.toLowerCase()}-${networkName}-11155111.json`)
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Try different possible field names
          const addressFields = ['address', 'diamondAddress', 'DiamondAddress', 'contractAddress'];
          for (const field of addressFields) {
            if (data[field]) {
              return data[field];
            }
          }

          // Check if it's a deployment artifact with networks
          if (data.networks && data.networks[networkName]) {
            return data.networks[networkName].address;
          }
        } catch (error) {
          console.warn(`Warning: Could not parse deployment file ${filePath}: ${(error as Error).message}`);
        }
      }
    }

    return undefined;
  }

  /**
   * Get block explorer URL for network
   */
  private static getBlockExplorerUrl(networkName: string): string | undefined {
    const explorerUrls: Record<string, string> = {
      mainnet: 'https://etherscan.io',
      sepolia: 'https://sepolia.etherscan.io',
      polygon: 'https://polygonscan.com',
      polygon_amoy: 'https://amoy.polygonscan.com',
      base: 'https://basescan.org',
      base_sepolia: 'https://sepolia.basescan.org',
      bsc: 'https://bscscan.com',
      bsc_testnet: 'https://testnet.bscscan.com'
    };

    return explorerUrls[networkName];
  }

  /**
   * Get block explorer API key for network
   */
  private static getBlockExplorerApiKey(networkName: string): string | undefined {
    const apiKeyMap: Record<string, string> = {
      mainnet: 'ETHERSCAN_API_KEY',
      sepolia: 'ETHERSCAN_API_KEY',
      polygon: 'POLYGONSCAN_API_KEY',
      polygon_amoy: 'POLYGONSCAN_API_KEY',
      base: 'BASESCAN_API_KEY',
      base_sepolia: 'BASESCAN_API_KEY',
      bsc: 'BSCSCAN_API_KEY',
      bsc_testnet: 'BSCSCAN_API_KEY'
    };

    const envVar = apiKeyMap[networkName];
    return envVar ? process.env[envVar] : undefined;
  }
}

/**
 * Provider factory for creating blockchain providers
 */
export class ProviderFactory {
  /**
   * Create provider from network information
   */
  public static createProvider(networkInfo: NetworkInfo): Provider {
    return new JsonRpcProvider(networkInfo.rpcUrl);
  }

  /**
   * Create provider from RPC URL
   */
  public static createProviderFromUrl(rpcUrl: string): Provider {
    return new JsonRpcProvider(rpcUrl);
  }

  /**
   * Create provider from environment variables
   */
  public static createProviderFromEnv(networkName: string): Provider {
    const rpcUrl = process.env[`${networkName.toUpperCase()}_RPC`] || process.env.RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`RPC URL not found for network '${networkName}'. Please set ${networkName.toUpperCase()}_RPC environment variable.`);
    }

    return new JsonRpcProvider(rpcUrl);
  }

  /**
   * Test provider connectivity
   */
  public static async testProvider(provider: Provider): Promise<boolean> {
    try {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      return typeof blockNumber === 'number' && blockNumber > 0;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
  /**
   * Validate verification configuration
   */
  public static validateVerificationConfig(config: VerificationConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate diamond configuration
    if (!config.diamond) {
      errors.push('Diamond configuration is required');
    } else {
      if (!config.diamond.name) {
        errors.push('Diamond name is required');
      }
      if (!config.diamond.configPath) {
        errors.push('Diamond config path is required');
      }
    }

    // Validate networks
    if (!config.networks || Object.keys(config.networks).length === 0) {
      errors.push('At least one network configuration is required');
    } else {
      for (const [networkName, networkConfig] of Object.entries(config.networks)) {
        if (!networkConfig.rpcUrl) {
          errors.push(`RPC URL is required for network '${networkName}'`);
        }
        if (!networkConfig.chainId) {
          errors.push(`Chain ID is required for network '${networkName}'`);
        }
      }
    }

    // Validate modules
    if (!config.modules) {
      errors.push('Module configuration is required');
    }

    // Validate execution configuration
    if (config.execution) {
      if (config.execution.maxConcurrency && config.execution.maxConcurrency < 1) {
        errors.push('Max concurrency must be at least 1');
      }
      if (config.execution.timeoutMs && config.execution.timeoutMs < 1000) {
        errors.push('Timeout must be at least 1000ms');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate network configuration
   */
  public static validateNetworkConfig(config: NetworkInfo): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Network name is required');
    }
    if (!config.rpcUrl) {
      errors.push('RPC URL is required');
    }
    if (!config.chainId) {
      errors.push('Chain ID is required');
    }

    // Validate RPC URL format
    if (config.rpcUrl && !config.rpcUrl.startsWith('http')) {
      errors.push('RPC URL must start with http:// or https://');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Environment utilities for verification context
 */
export class EnvironmentUtils {
  /**
   * Load environment variables with fallbacks
   */
  public static getEnvVar(name: string, fallback?: string): string | undefined {
    return process.env[name] || fallback;
  }

  /**
   * Load required environment variable
   */
  public static getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Required environment variable '${name}' is not set`);
    }
    return value;
  }

  /**
   * Check if running in verbose mode
   */
  public static isVerbose(): boolean {
    return process.env.VERBOSE === 'true' || process.argv.includes('--verbose') || process.argv.includes('-v');
  }

  /**
   * Check if running in dry run mode
   */
  public static isDryRun(): boolean {
    return process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
  }

  /**
   * Get log level from environment
   */
  public static getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
    const level = process.env.LOG_LEVEL?.toLowerCase();
    if (['debug', 'info', 'warn', 'error'].includes(level || '')) {
      return level as 'debug' | 'info' | 'warn' | 'error';
    }
    return 'info';
  }
}
