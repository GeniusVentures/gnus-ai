import {
  Diamond,
  DiamondDeployer,
  FileDeploymentRepository,
  DeploymentRepository,
  DiamondConfig,
  OZDefenderDeploymentStrategy,
} from 'diamonds';
import type { JsonRpcProvider } from '@ethersproject/providers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import type { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import 'hardhat-diamonds';
import * as dotenv from 'dotenv';

import { generateDiamondAbiWithTypechain } from '../generate-diamond-abi-with-typechain';
import { DiamondAbiGenerationOptions } from '../diamond-abi-generator';
import { deployments } from '../../notes/archive/deployments';

dotenv.config();

/**
 * Deployment status enumeration
 */
export enum DeploymentStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED'
}

/**
 * Configuration interface for DefenderDiamondDeployer
 * Extends the base DiamondConfig with Defender-specific settings
 */
export interface DefenderDiamondDeployerConfig extends DiamondConfig {
  /** OpenZeppelin Defender API Key */
  apiKey: string;
  /** OpenZeppelin Defender API Secret */
  apiSecret: string;
  /** Relayer address for transactions */
  relayerAddress: string;
  /** Whether to auto-approve transactions */
  autoApprove?: boolean;
  /** Safe multi-signature wallet address or relayer address */
  via: string;
  /** Transaction method: Safe multi-sig or EOA */
  viaType: 'Safe' | 'EOA';
  /** Network name for deployment */
  networkName: string;
  /** Chain ID for the target network */
  chainId: number;
  /** Provider instance */
  provider?: JsonRpcProvider | HardhatEthersProvider;
  /** Signer instance */
  signer?: SignerWithAddress;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Unique key for this deployer instance */
  defenderDiamondDeployerKey?: string;
}

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  defaultGasLimit: number;
  defaultMaxGasPrice: string;
}

/**
 * DefenderDiamondDeployer - A singleton class for deploying Diamond contracts using OpenZeppelin Defender
 * 
 * This class integrates with the existing Diamonds module's OZDefenderDeploymentStrategy
 * to provide enterprise-grade deployment capabilities with multi-signature support,
 * automated execution, and comprehensive monitoring.
 * 
 * Key Features:
 * - Singleton pattern for consistent deployment state
 * - Integration with OpenZeppelin Defender SDK via OZDefenderDeploymentStrategy
 * - Support for multi-signature wallets (Gnosis Safe)
 * - Automated and manual approval workflows
 * - Comprehensive error handling and recovery
 * - Real-time deployment monitoring
 * 
 * @example
 * ```typescript
 * const config: DefenderDiamondDeployerConfig = {
 *   diamondName: 'GeniusDiamond',
 *   networkName: 'sepolia',
 *   chainId: 11155111,
 *   apiKey: process.env.DEFENDER_API_KEY!,
 *   apiSecret: process.env.DEFENDER_API_SECRET!,
 *   relayerAddress: process.env.DEFENDER_RELAYER_ADDRESS!,
 *   via: process.env.DEFENDER_SAFE_ADDRESS!,
 *   viaType: 'Safe',
 *   autoApprove: false,
 *   configFilePath: 'diamonds/GeniusDiamond/geniusdiamond.config.json'
 * };
 * 
 * const deployer = await DefenderDiamondDeployer.getInstance(config);
 * const diamond = await deployer.deployDiamond();
 * ```
 */
export class DefenderDiamondDeployer {
  private static instances: Map<string, DefenderDiamondDeployer> = new Map();
  
  private config: DefenderDiamondDeployerConfig;
  private diamond!: Diamond;
  private strategy!: OZDefenderDeploymentStrategy;
  private deployer!: DiamondDeployer;
  private repository!: DeploymentRepository;
  private provider?: JsonRpcProvider | HardhatEthersProvider;
  private signer?: SignerWithAddress;
  private verbose: boolean = false;
  private deploymentStatus: DeploymentStatus = DeploymentStatus.NOT_STARTED;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: DefenderDiamondDeployerConfig) {
    this.config = this.validateAndNormalizeConfig(config);
  }

  /**
   * Get or create a DefenderDiamondDeployer instance
   * 
   * @param config - Configuration for the deployer
   * @returns Promise resolving to DefenderDiamondDeployer instance
   */
  public static async getInstance(config: DefenderDiamondDeployerConfig): Promise<DefenderDiamondDeployer> {
    const key = config.defenderDiamondDeployerKey || 
                `${config.diamondName}-${config.networkName}-${config.chainId}`;
    
    if (DefenderDiamondDeployer.instances.has(key)) {
      const existingInstance = DefenderDiamondDeployer.instances.get(key)!;
      // Update configuration if provided
      existingInstance.updateConfig(config);
      return existingInstance;
    }

    const instance = new DefenderDiamondDeployer(config);
    await instance.initialize();
    
    DefenderDiamondDeployer.instances.set(key, instance);
    return instance;
  }

  /**
   * Initialize the deployer with all required components
   */
  private async initialize(): Promise<void> {
    try {
      // Setup provider and signer
      await this.setupProviderAndSigner();
      
      // Create repository
      this.repository = new FileDeploymentRepository(this.config);
      
      // Create Diamond instance
      this.diamond = new Diamond(this.config, this.repository);
      
      // Set provider and signer on diamond
      if (this.provider) {
        this.diamond.setProvider(this.provider as any);
      }
      if (this.signer) {
        this.diamond.setSigner(this.signer);
      }
      
      // Create OZDefenderDeploymentStrategy
      this.strategy = new OZDefenderDeploymentStrategy(
        this.config.apiKey,
        this.config.apiSecret,
        this.config.relayerAddress,
        this.config.autoApprove || false,
        this.config.via,
        this.config.viaType,
        this.config.verbose || false
      );
      
      // Create DiamondDeployer with strategy
      this.deployer = new DiamondDeployer(this.diamond, this.strategy);
      
      if (this.verbose) {
        console.log(`✅ DefenderDiamondDeployer initialized for ${this.config.diamondName} on ${this.config.networkName}`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize DefenderDiamondDeployer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup provider and signer based on configuration
   */
  private async setupProviderAndSigner(): Promise<void> {
    // Use provided provider or default to ethers provider
    this.provider = this.config.provider || ethers.provider as any;
    
    // Use provided signer or get from ethers
    if (this.config.signer) {
      this.signer = this.config.signer;
    } else {
      const signers = await ethers.getSigners();
      this.signer = signers[0];
    }
    
    if (this.verbose) {
      console.log(`🔗 Connected to ${this.config.networkName} (Chain ID: ${this.config.chainId})`);
      console.log(`👤 Using signer: ${await this.signer.getAddress()}`);
    }
  }

  /**
   * Deploy the diamond using OpenZeppelin Defender
   * 
   * @returns Promise resolving to the deployed Diamond instance
   */
  public async deployDiamond(): Promise<Diamond> {
    try {
      this.deploymentStatus = DeploymentStatus.IN_PROGRESS;
      
      if (this.verbose) {
        console.log(`🚀 Starting Diamond deployment via OpenZeppelin Defender...`);
        console.log(`📋 Diamond: ${this.config.diamondName}`);
        console.log(`🌐 Network: ${this.config.networkName} (${this.config.chainId})`);
        console.log(`🛡️ Via: ${this.config.viaType} (${this.config.via})`);
        console.log(`⚡ Auto-approve: ${this.config.autoApprove ? 'Yes' : 'No'}`);
      }

      // Deploy using the DiamondDeployer with OZDefenderDeploymentStrategy
      await this.deployer.deployDiamond();
      
      // Generate diamond ABI after successful deployment
      await this.generateDiamondAbi();
      
      this.deploymentStatus = DeploymentStatus.COMPLETED;
      
      if (this.verbose) {
        const deployedData = this.diamond.getDeployedDiamondData();
        console.log(`✅ Diamond deployment completed!`);
        console.log(`💎 Diamond Address: ${deployedData.DiamondAddress}`);
        console.log(`👤 Deployer: ${deployedData.DeployerAddress}`);
        console.log(`🎯 Facets: ${Object.keys(deployedData.DeployedFacets || {}).length}`);
      }
      
      return this.diamond;
    } catch (error) {
      this.deploymentStatus = DeploymentStatus.FAILED;
      throw new Error(`Diamond deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the deployed diamond instance
   * 
   * @returns The Diamond instance if deployed, otherwise undefined
   */
  public getDiamondDeployed(): Diamond | undefined {
    if (this.deploymentStatus === DeploymentStatus.COMPLETED) {
      return this.diamond;
    }
    return undefined;
  }

  /**
   * Get deployment status
   */
  public getDeploymentStatus(): DeploymentStatus {
    return this.deploymentStatus;
  }

  /**
   * Check if diamond is deployed
   */
  public isDiamondDeployed(): boolean {
    return this.deploymentStatus === DeploymentStatus.COMPLETED;
  }

  /**
   * Set verbose logging
   */
  public setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Get current configuration
   */
  public getConfig(): DefenderDiamondDeployerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  private updateConfig(newConfig: DefenderDiamondDeployerConfig): void {
    this.config = this.validateAndNormalizeConfig(newConfig);
  }

  /**
   * Generate Diamond ABI using typechain after deployment
   */
  private async generateDiamondAbi(): Promise<void> {
    try {
      if (this.verbose) {
        console.log('📝 Generating Diamond ABI with TypeChain...');
      }

      const options: DiamondAbiGenerationOptions = {
        diamondName: this.config.diamondName,
        networkName: this.config.networkName,
        chainId: this.config.chainId,
        outputDir: join(process.cwd(), 'diamond-abi'),
        verbose: this.verbose
      };

      await generateDiamondAbiWithTypechain(options);

      if (this.verbose) {
        console.log('✅ Diamond ABI generation completed');
      }
    } catch (error) {
      console.warn(`⚠️ Failed to generate Diamond ABI: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't throw here as this is not critical for deployment
    }
  }

  /**
   * Validate and normalize the configuration
   */
  private validateAndNormalizeConfig(config: DefenderDiamondDeployerConfig): DefenderDiamondDeployerConfig {
    // Validate required fields
    if (!config.diamondName || config.diamondName.trim() === '') {
      throw new Error('diamondName is required and cannot be empty');
    }

    if (!config.networkName || config.networkName.trim() === '') {
      throw new Error('networkName is required and cannot be empty');
    }

    if (!config.chainId || config.chainId <= 0) {
      throw new Error('chainId must be a positive number');
    }

    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('Defender API key is required');
    }

    if (!config.apiSecret || config.apiSecret.trim() === '') {
      throw new Error('Defender API secret is required');
    }

    if (!config.relayerAddress || config.relayerAddress.trim() === '') {
      throw new Error('Relayer address is required');
    }

    if (!config.via || config.via.trim() === '') {
      throw new Error('Via address (Safe or relayer) is required');
    }

    if (!['Safe', 'EOA'].includes(config.viaType)) {
      throw new Error('viaType must be either "Safe" or "EOA"');
    }

    // Set defaults
    const normalizedConfig: DefenderDiamondDeployerConfig = {
      ...config,
      autoApprove: config.autoApprove ?? false,
      verbose: config.verbose ?? false,
      deploymentsPath: config.deploymentsPath || join(process.cwd(), 'deployments'),
      configFilePath: config.configFilePath || `diamonds/${config.diamondName}`
    };

    return normalizedConfig;
  }

  /**
   * Load network configuration from file
   */
  public static loadNetworkConfig(networkName: string): NetworkConfig {
    const configPath = join(process.cwd(), 'config', 'networks', `${networkName}.json`);
    
    if (!existsSync(configPath)) {
      throw new Error(`Network configuration file not found: ${configPath}`);
    }
    
    try {
      const configData = readFileSync(configPath, 'utf8');
      return JSON.parse(configData) as NetworkConfig;
    } catch (error) {
      throw new Error(`Failed to load network configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a configuration object from environment variables
   */
  public static createConfigFromEnv(overrides: Partial<DefenderDiamondDeployerConfig> = {}): DefenderDiamondDeployerConfig {
    const networkName = overrides.networkName || process.env.NETWORK || 'sepolia';
    const diamondName = overrides.diamondName || process.env.DIAMOND_NAME || 'GeniusDiamond';
    
    // Load network configuration
    let networkConfig: NetworkConfig;
    try {
      networkConfig = DefenderDiamondDeployer.loadNetworkConfig(networkName);
    } catch (error) {
      // Fallback configuration
      networkConfig = {
        name: networkName,
        chainId: 11155111, // Sepolia default
        rpcUrl: process.env[`${networkName.toUpperCase()}_RPC_URL`] || '',
        blockExplorer: 'https://sepolia.etherscan.io',
        nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        defaultGasLimit: 500000,
        defaultMaxGasPrice: '20000000000'
      };
    }

    const viaType = (process.env.DEFENDER_VIA_TYPE as 'Safe' | 'EOA') || 'Safe';
    
    // Determine the 'via' address based on viaType
    let viaAddress: string;
    if (viaType === 'EOA') {
      viaAddress = process.env.DEFENDER_EOA_ADDRESS || process.env.DEFENDER_RELAYER_ADDRESS || '';
    } else {
      viaAddress = process.env.DEFENDER_SAFE_ADDRESS || '';
    }
    
    let hardhatDiamondConfig: any;
    try {
      hardhatDiamondConfig = hre.diamonds.getDiamondConfig(diamondName);
    } catch (error) {
      // Fallback when diamond config doesn't exist
      hardhatDiamondConfig = {
        deploymentsPath: 'diamonds',
        contractsPath: 'contracts'
      };
    }
    const deploymentsPath: string = hardhatDiamondConfig.deploymentsPath || 'diamonds';
    const configFilePath: string = `${deploymentsPath}/${diamondName}/${diamondName.toLowerCase()}.config.json`;

    const config: DefenderDiamondDeployerConfig = {
      diamondName,
      networkName,
      chainId: networkConfig.chainId,
      apiKey: process.env.DEFENDER_API_KEY || '',
      apiSecret: process.env.DEFENDER_API_SECRET || '',
      relayerAddress: process.env.DEFENDER_RELAYER_ADDRESS || '',
      via: viaAddress,
      viaType: viaType,
      autoApprove: process.env.AUTO_APPROVE_DEFENDER_PROPOSALS === 'true',
      verbose: process.env.VERBOSE_DEPLOYMENT === 'true',
      deploymentsPath: deploymentsPath,
      configFilePath: configFilePath,
      contractsPath: hardhatDiamondConfig.contractsPath || 'contracts',
      ...overrides
    };

    return config;
  }

  /**
   * Clear all singleton instances (useful for testing)
   */
  public static clearInstances(): void {
    DefenderDiamondDeployer.instances.clear();
  }

  /**
   * Get all active instances
   */
  public static getInstances(): Map<string, DefenderDiamondDeployer> {
    return new Map(DefenderDiamondDeployer.instances);
  }
}