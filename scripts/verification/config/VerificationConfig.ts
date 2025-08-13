/**
 * Configuration management for the Diamond Verification System
 * 
 * Handles loading, validation, and management of verification configurations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  VerificationConfig,
  NetworkInfo,
  ConfigurationSource,
  MultiNetworkConfig,
  ModuleConfiguration,
  ReportFormat,
  SeverityLevel
} from '../core/types';

/**
 * Configuration loader and manager
 */
export class VerificationConfigManager {
  private static defaultConfig: Partial<VerificationConfig> = {
    reporting: {
      formats: [ReportFormat.CONSOLE],
      outputPaths: {
        [ReportFormat.CONSOLE]: '',
        [ReportFormat.JSON]: './verification-report.json',
        [ReportFormat.HTML]: './verification-report.html',
        [ReportFormat.MARKDOWN]: './verification-report.md'
      },
      severityFilter: SeverityLevel.INFO,
      includePassedChecks: true,
      includeMetadata: true
    },
    execution: {
      parallelExecution: false,
      maxConcurrency: 3,
      timeoutMs: 30000,
      retryCount: 2,
      retryDelayMs: 1000,
      failFast: false
    },
    thresholds: {
      errorThreshold: 0,
      warningThreshold: 5,
      criticalThreshold: 0
    }
  };

  /**
   * Load configuration from file
   */
  public static async loadFromFile(configPath: string): Promise<VerificationConfig> {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return this.mergeWithDefaults(configData);
    } catch (error) {
      throw new Error(`Failed to parse configuration file: ${(error as Error).message}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  public static async loadFromEnvironment(): Promise<Partial<VerificationConfig>> {
    const config: Partial<VerificationConfig> = {};

    // Diamond configuration
    if (process.env.DIAMOND_NAME) {
      config.diamond = {
        name: process.env.DIAMOND_NAME,
        address: process.env.DIAMOND_ADDRESS,
        configPath: process.env.DIAMOND_CONFIG_PATH || this.getDefaultDiamondConfigPath(process.env.DIAMOND_NAME)
      };
    }

    // Execution configuration
    if (process.env.VERIFICATION_PARALLEL) {
      config.execution = {
        parallelExecution: process.env.VERIFICATION_PARALLEL === 'true',
        maxConcurrency: parseInt(process.env.VERIFICATION_MAX_CONCURRENCY || '3'),
        timeoutMs: parseInt(process.env.VERIFICATION_TIMEOUT_MS || '30000'),
        retryCount: parseInt(process.env.VERIFICATION_RETRY_COUNT || '2'),
        retryDelayMs: parseInt(process.env.VERIFICATION_RETRY_DELAY_MS || '1000'),
        failFast: process.env.VERIFICATION_FAIL_FAST === 'true'
      };
    }

    // Reporting configuration
    const reportFormats = process.env.VERIFICATION_REPORT_FORMATS?.split(',') as ReportFormat[];
    if (reportFormats) {
      config.reporting = {
        formats: reportFormats,
        outputPaths: this.parseOutputPaths(process.env.VERIFICATION_OUTPUT_PATHS),
        severityFilter: (process.env.VERIFICATION_SEVERITY_FILTER as SeverityLevel) || SeverityLevel.INFO,
        includePassedChecks: process.env.VERIFICATION_INCLUDE_PASSED !== 'false',
        includeMetadata: process.env.VERIFICATION_INCLUDE_METADATA !== 'false'
      };
    }

    return config;
  }

  /**
   * Load configuration from Hardhat config
   */
  public static async loadFromHardhat(): Promise<Partial<VerificationConfig>> {
    const hardhatConfigPath = path.join(process.cwd(), 'hardhat.config.ts');
    
    if (!fs.existsSync(hardhatConfigPath)) {
      return {};
    }

    try {
      // This is a simplified approach - in practice, you might need to
      // dynamically import and evaluate the Hardhat config
      const networks = await this.extractNetworksFromHardhat();
      
      return {
        networks
      };
    } catch (error) {
      console.warn(`Warning: Could not load Hardhat configuration: ${(error as Error).message}`);
      return {};
    }
  }

  /**
   * Create configuration from CLI options and environment
   */
  public static async createFromOptions(options: {
    diamondName: string;
    networkName?: string;
    rpcUrl?: string;
    configFile?: string;
    modules?: string[];
    outputFormat?: ReportFormat;
    outputFile?: string;
    verbose?: boolean;
    dryRun?: boolean;
    failOnError?: boolean;
    parallelExecution?: boolean;
    timeout?: number;
  }): Promise<VerificationConfig> {
    let config: Partial<VerificationConfig> = {};

    // Load from file if specified
    if (options.configFile) {
      config = await this.loadFromFile(options.configFile);
    }

    // Load from environment
    const envConfig = await this.loadFromEnvironment();
    config = this.mergeConfigs(config, envConfig);

    // Apply CLI options
    config.diamond = {
      name: options.diamondName,
      address: config.diamond?.address,
      configPath: config.diamond?.configPath || this.getDefaultDiamondConfigPath(options.diamondName)
    };

    // Network configuration
    if (options.networkName) {
      const networkInfo = await this.loadNetworkInfo(options.networkName, options.rpcUrl);
      config.networks = {
        ...config.networks,
        [options.networkName]: networkInfo
      };
    }

    // Module configuration
    if (options.modules && options.modules.length > 0) {
      config.modules = {};
      for (const moduleId of options.modules) {
        config.modules[moduleId] = {
          enabled: true,
          priority: 0,
          config: {},
          skipOnError: false,
          timeout: options.timeout || 30000
        };
      }
    }

    // Reporting configuration
    if (options.outputFormat || options.outputFile) {
      const defaultPaths = this.defaultConfig.reporting!.outputPaths!;
      config.reporting = {
        ...this.defaultConfig.reporting,
        ...config.reporting,
        formats: options.outputFormat ? [options.outputFormat] : config.reporting?.formats || [ReportFormat.CONSOLE],
        outputPaths: {
          ...defaultPaths,
          ...config.reporting?.outputPaths,
          ...(options.outputFile && options.outputFormat ? { [options.outputFormat]: options.outputFile } : {})
        },
        severityFilter: config.reporting?.severityFilter || this.defaultConfig.reporting!.severityFilter!,
        includePassedChecks: config.reporting?.includePassedChecks ?? this.defaultConfig.reporting!.includePassedChecks!,
        includeMetadata: config.reporting?.includeMetadata ?? this.defaultConfig.reporting!.includeMetadata!
      };
    }

    // Execution configuration
    config.execution = {
      ...this.defaultConfig.execution,
      ...config.execution,
      parallelExecution: options.parallelExecution ?? config.execution?.parallelExecution ?? this.defaultConfig.execution!.parallelExecution!,
      maxConcurrency: config.execution?.maxConcurrency || this.defaultConfig.execution!.maxConcurrency!,
      timeoutMs: options.timeout ?? config.execution?.timeoutMs ?? this.defaultConfig.execution!.timeoutMs!,
      retryCount: config.execution?.retryCount || this.defaultConfig.execution!.retryCount!,
      retryDelayMs: config.execution?.retryDelayMs || this.defaultConfig.execution!.retryDelayMs!,
      failFast: options.failOnError ?? config.execution?.failFast ?? this.defaultConfig.execution!.failFast!
    };

    return this.mergeWithDefaults(config);
  }

  /**
   * Save configuration to file
   */
  public static async saveToFile(config: VerificationConfig, filePath: string): Promise<void> {
    try {
      const configJson = JSON.stringify(config, null, 2);
      fs.writeFileSync(filePath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Create default configuration for a diamond
   */
  public static createDefaultConfig(diamondName: string, networkName: string): VerificationConfig {
    const config = {
      diamond: {
        name: diamondName,
        configPath: this.getDefaultDiamondConfigPath(diamondName)
      },
      networks: {},
      modules: {
        'function-selectors': {
          enabled: true,
          priority: 1,
          config: {},
          skipOnError: false,
          timeout: 30000
        },
        'diamond-structure': {
          enabled: true,
          priority: 2,
          config: {},
          skipOnError: false,
          timeout: 30000
        },
        'token-supply': {
          enabled: true,
          priority: 3,
          config: {},
          skipOnError: false,
          timeout: 30000
        },
        'erc165-compliance': {
          enabled: true,
          priority: 4,
          config: {},
          skipOnError: false,
          timeout: 30000
        },
        'access-control': {
          enabled: true,
          priority: 5,
          config: {},
          skipOnError: false,
          timeout: 30000
        }
      } as Record<string, ModuleConfiguration>
    };

    return this.mergeWithDefaults(config);
  }

  /**
   * Validate configuration
   */
  public static validateConfig(config: VerificationConfig): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate diamond configuration
    if (!config.diamond?.name) {
      errors.push('Diamond name is required');
    }
    if (!config.diamond?.configPath) {
      errors.push('Diamond config path is required');
    } else if (!fs.existsSync(config.diamond.configPath)) {
      warnings.push(`Diamond config file not found: ${config.diamond.configPath}`);
    }

    // Validate networks
    if (!config.networks || Object.keys(config.networks).length === 0) {
      errors.push('At least one network must be configured');
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
    if (!config.modules || Object.keys(config.modules).length === 0) {
      warnings.push('No verification modules are configured');
    } else {
      const enabledModules = Object.values(config.modules).filter(m => m.enabled);
      if (enabledModules.length === 0) {
        warnings.push('No verification modules are enabled');
      }
    }

    // Validate thresholds
    if (config.thresholds) {
      if (config.thresholds.errorThreshold < 0) {
        errors.push('Error threshold cannot be negative');
      }
      if (config.thresholds.warningThreshold < 0) {
        errors.push('Warning threshold cannot be negative');
      }
      if (config.thresholds.criticalThreshold < 0) {
        errors.push('Critical threshold cannot be negative');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Merge configuration with defaults
   */
  private static mergeWithDefaults(config: Partial<VerificationConfig>): VerificationConfig {
    const defaultReporting = this.defaultConfig.reporting!;
    const defaultExecution = this.defaultConfig.execution!;
    const defaultThresholds = this.defaultConfig.thresholds!;

    return {
      diamond: config.diamond || { name: '', configPath: '' },
      networks: config.networks || {},
      modules: config.modules || {},
      reporting: {
        formats: config.reporting?.formats || defaultReporting.formats!,
        outputPaths: config.reporting?.outputPaths || defaultReporting.outputPaths!,
        severityFilter: config.reporting?.severityFilter || defaultReporting.severityFilter!,
        includePassedChecks: config.reporting?.includePassedChecks ?? defaultReporting.includePassedChecks!,
        includeMetadata: config.reporting?.includeMetadata ?? defaultReporting.includeMetadata!
      },
      execution: {
        parallelExecution: config.execution?.parallelExecution ?? defaultExecution.parallelExecution!,
        maxConcurrency: config.execution?.maxConcurrency || defaultExecution.maxConcurrency!,
        timeoutMs: config.execution?.timeoutMs || defaultExecution.timeoutMs!,
        retryCount: config.execution?.retryCount || defaultExecution.retryCount!,
        retryDelayMs: config.execution?.retryDelayMs || defaultExecution.retryDelayMs!,
        failFast: config.execution?.failFast ?? defaultExecution.failFast!
      },
      thresholds: {
        errorThreshold: config.thresholds?.errorThreshold ?? defaultThresholds.errorThreshold!,
        warningThreshold: config.thresholds?.warningThreshold ?? defaultThresholds.warningThreshold!,
        criticalThreshold: config.thresholds?.criticalThreshold ?? defaultThresholds.criticalThreshold!
      }
    };
  }

  /**
   * Merge two configurations
   */
  private static mergeConfigs(
    base: Partial<VerificationConfig>,
    override: Partial<VerificationConfig>
  ): Partial<VerificationConfig> {
    return {
      ...base,
      ...override,
      diamond: override.diamond || base.diamond,
      networks: { ...base.networks, ...override.networks },
      modules: { ...base.modules, ...override.modules },
      reporting: override.reporting || base.reporting,
      execution: override.execution || base.execution,
      thresholds: override.thresholds || base.thresholds
    };
  }

  /**
   * Load network information from various sources
   */
  private static async loadNetworkInfo(networkName: string, rpcUrl?: string): Promise<NetworkInfo> {
    const finalRpcUrl = rpcUrl || 
                       process.env[`${networkName.toUpperCase()}_RPC`] || 
                       process.env.RPC_URL;

    if (!finalRpcUrl) {
      throw new Error(`RPC URL not found for network '${networkName}'`);
    }

    // Chain ID mapping
    const chainIdMap: Record<string, number> = {
      mainnet: 1,
      sepolia: 11155111,
      polygon: 137,
      polygon_amoy: 80002,
      base: 8453,
      base_sepolia: 84532,
      bsc: 56,
      bsc_testnet: 97,
      hardhat: 31337
    };

    return {
      name: networkName,
      chainId: chainIdMap[networkName] || 1,
      rpcUrl: finalRpcUrl,
      blockExplorerUrl: this.getBlockExplorerUrl(networkName),
      blockExplorerApiKey: this.getBlockExplorerApiKey(networkName)
    };
  }

  /**
   * Get default diamond config path
   */
  private static getDefaultDiamondConfigPath(diamondName: string): string {
    return path.join(process.cwd(), 'diamonds', diamondName, `${diamondName.toLowerCase()}.config.json`);
  }

  /**
   * Parse output paths from environment variable
   */
  private static parseOutputPaths(pathsString?: string): Record<ReportFormat, string> {
    const defaultPaths = this.defaultConfig.reporting!.outputPaths!;
    
    if (!pathsString) {
      return defaultPaths;
    }

    try {
      return JSON.parse(pathsString);
    } catch {
      return defaultPaths;
    }
  }

  /**
   * Extract networks from Hardhat config (simplified)
   */
  private static async extractNetworksFromHardhat(): Promise<Record<string, NetworkInfo>> {
    // This is a placeholder implementation
    // In practice, you would dynamically import and evaluate the Hardhat config
    return {};
  }

  /**
   * Get block explorer URL for network
   */
  private static getBlockExplorerUrl(networkName: string): string | undefined {
    const urls: Record<string, string> = {
      mainnet: 'https://etherscan.io',
      sepolia: 'https://sepolia.etherscan.io',
      polygon: 'https://polygonscan.com',
      polygon_amoy: 'https://amoy.polygonscan.com',
      base: 'https://basescan.org',
      base_sepolia: 'https://sepolia.basescan.org',
      bsc: 'https://bscscan.com',
      bsc_testnet: 'https://testnet.bscscan.com'
    };
    return urls[networkName];
  }

  /**
   * Get block explorer API key from environment
   */
  private static getBlockExplorerApiKey(networkName: string): string | undefined {
    const keyMap: Record<string, string> = {
      mainnet: 'ETHERSCAN_API_KEY',
      sepolia: 'ETHERSCAN_API_KEY',
      polygon: 'POLYGONSCAN_API_KEY',
      polygon_amoy: 'POLYGONSCAN_API_KEY',
      base: 'BASESCAN_API_KEY',
      base_sepolia: 'BASESCAN_API_KEY',
      bsc: 'BSCSCAN_API_KEY',
      bsc_testnet: 'BSCSCAN_API_KEY'
    };

    const envVar = keyMap[networkName];
    return envVar ? process.env[envVar] : undefined;
  }
}

/**
 * Network configuration loader
 */
export class NetworkConfigLoader {
  /**
   * Load multi-network configuration from file
   */
  public static async loadFromFile(filePath: string): Promise<MultiNetworkConfig> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Network configuration file not found: ${filePath}`);
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return this.validateMultiNetworkConfig(data);
    } catch (error) {
      throw new Error(`Failed to parse network configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Load from environment variables
   */
  public static async loadFromEnvironment(): Promise<MultiNetworkConfig> {
    const networks: Record<string, NetworkInfo> = {};
    
    // Common network names to check
    const networkNames = ['mainnet', 'sepolia', 'polygon', 'polygon_amoy', 'base', 'base_sepolia', 'bsc', 'bsc_testnet'];
    
    for (const networkName of networkNames) {
      const rpcUrl = process.env[`${networkName.toUpperCase()}_RPC`];
      if (rpcUrl) {
        networks[networkName] = await VerificationConfigManager['loadNetworkInfo'](networkName, rpcUrl);
      }
    }

    return {
      networks,
      defaultNetwork: process.env.DEFAULT_NETWORK || Object.keys(networks)[0] || 'sepolia',
      verificationRules: {
        protocolVersionMatch: true,
        facetAddressConsistency: true,
        functionSelectorConsistency: true,
        configurationAlignment: true,
        customRules: []
      },
      crossChainValidation: {
        enabled: process.env.CROSS_CHAIN_VALIDATION === 'true',
        baselineNetwork: process.env.BASELINE_NETWORK || 'mainnet',
        tolerances: {}
      }
    };
  }

  /**
   * Validate multi-network configuration
   */
  private static validateMultiNetworkConfig(config: any): MultiNetworkConfig {
    if (!config.networks || typeof config.networks !== 'object') {
      throw new Error('Networks configuration is required');
    }

    if (!config.defaultNetwork) {
      throw new Error('Default network is required');
    }

    if (!config.networks[config.defaultNetwork]) {
      throw new Error(`Default network '${config.defaultNetwork}' not found in networks configuration`);
    }

    return config as MultiNetworkConfig;
  }
}
