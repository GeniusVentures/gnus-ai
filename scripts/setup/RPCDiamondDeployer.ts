import {
	DeploymentRepository,
	Diamond,
	DiamondConfig,
	DiamondDeployer,
	DiamondPathsConfig,
	FileDeploymentRepository,
	RPCDeploymentStrategy,
	SupportedProvider,
	cutKey,
} from '@diamondslab/diamonds';
import '@diamondslab/hardhat-diamonds';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { JsonRpcProvider } from 'ethers';
import { existsSync } from 'fs';
import hre, { ethers } from 'hardhat';
import 'hardhat-multichain';
import { join } from 'path';

import '@diamondslab/hardhat-diamonds';

dotenv.config();

/**
 * Network configuration interface matching hardhat.config.ts chainManager
 */
export interface HardhatNetworkConfig {
	name: string;
	chainId: number;
	rpcUrl: string;
	blockNumber?: number;
	nativeCurrency?: {
		name: string;
		symbol: string;
		decimals: number;
	};
	defaultGasLimit?: number;
	defaultMaxGasPrice?: string;
}

/**
 * Deployment status enumeration
 */
export enum DeploymentStatus {
	NOT_STARTED = 'NOT_STARTED',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	FAILED = 'FAILED',
	UPGRADE_AVAILABLE = 'UPGRADE_AVAILABLE',
}

/**
 * Configuration interface for RPCDiamondDeployer
 * Extends the base DiamondConfig with RPC-specific settings
 */
export interface RPCDiamondDeployerConfig extends DiamondConfig {
	/** RPC endpoint URL */
	rpcUrl: string;
	/** Private key for deployment (0x prefixed) */
	privateKey: string;
	/** Network name for deployment */
	networkName: string;
	/** Chain ID for the target network */
	chainId: number;
	/** Provider instance */
	provider?: SupportedProvider;
	/** Signer instance */
	signer?: SignerWithAddress;
	/** Gas limit multiplier (1.0-2.0) */
	gasLimitMultiplier?: number;
	/** Maximum number of retries (1-10) */
	maxRetries?: number;
	/** Retry delay in milliseconds (100-30000) */
	retryDelayMs?: number;
	/** Enable verbose logging */
	verbose?: boolean;
	/** Unique key for this deployer instance */
	rpcDiamondDeployerKey?: string;
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
 * Network information interface
 */
export interface NetworkInfo {
	networkName: string;
	chainId: number;
	signerAddress: string;
	balance: string;
	gasPrice: string;
	blockNumber: number;
}

/**
 * RPCDiamondDeployer - A singleton class for deploying Diamond contracts using direct RPC communication
 *
 * This class integrates with the existing Diamonds module's RPCDeploymentStrategy
 * to provide direct blockchain deployment capabilities without relying on Hardhat's
 * deployment abstractions. Ideal for production deployments and CI/CD pipelines.
 *
 * Key Features:
 * - Singleton pattern for consistent deployment state
 * - Integration with RPCDeploymentStrategy from Diamonds module
 * - Direct RPC communication with blockchain networks
 * - Retry logic with exponential backoff for network resilience
 * - Comprehensive error handling and recovery
 * - Real-time deployment monitoring
 * - Configuration validation and network verification
 *
 * @example
 * ```typescript
 * const config = RPCDiamondDeployer.createConfigFromEnv({
 *   diamondName: 'GeniusDiamond',
 *   networkName: 'sepolia',
 *   rpcUrl: 'https://sepolia.infura.io/v3/your-key',
 *   privateKey: '0x...'
 * });
 *
 * const deployer = await RPCDiamondDeployer.getInstance(config);
 * const diamond = await deployer.deployDiamond();
 * ```
 */
export class RPCDiamondDeployer {
	private static instances: Map<string, RPCDiamondDeployer> = new Map();
	private deployInProgress: boolean = false;
	private deployComplete: boolean = false;
	private diamond: Diamond | undefined;
	private verbose: boolean = false;
	private config: RPCDiamondDeployerConfig;
	private provider: SupportedProvider;
	private signer: SignerWithAddress;
	private diamondName: string;
	private networkName: string;
	private chainId: number;
	private repository: DeploymentRepository;
	private strategy: RPCDeploymentStrategy;

	/**
	 * Private constructor - use getInstance() instead
	 */
	private constructor(config: RPCDiamondDeployerConfig, repository: DeploymentRepository) {
		this.config = config;
		this.diamondName = config.diamondName;
		this.networkName = config.networkName;
		this.chainId = config.chainId;
		this.verbose = config.verbose || false;
		this.repository = repository;

		// Initialize provider and signer
		this.provider = new JsonRpcProvider(config.rpcUrl);
		this.signer = new ethers.Wallet(config.privateKey, this.provider) as any;

		// Create RPC deployment strategy
		this.strategy = new RPCDeploymentStrategy(
			config.rpcUrl,
			config.privateKey,
			config.gasLimitMultiplier || 1.2,
			config.maxRetries || 3,
			config.retryDelayMs || 2000,
			this.verbose,
		);

		// Initialize diamond with strategy
		this.diamond = new Diamond(this.config, repository);
		this.diamond.setProvider(this.provider as any);
		this.diamond.setSigner(this.signer);

		if (this.verbose) {
			console.log(
				chalk.blue(
					`🔗 RPC Deployer initialized for ${this.diamondName} on ${this.networkName}`,
				),
			);
			console.log(chalk.blue(`👤 Deployer address: ${this.signer.address}`));
		}
	}

	/**
	 * Creates an RPCDiamondDeployer instance
	 */
	private static async create(
		config: RPCDiamondDeployerConfig,
		repository: DeploymentRepository,
	): Promise<RPCDiamondDeployer> {
		return new RPCDiamondDeployer(config, repository);
	}

	/**
	 * Load diamond configuration from @diamondslab/hardhat-diamonds
	 *
	 * @param diamondName - Name of the diamond
	 * @returns DiamondPathsConfig from hardhat configuration
	 */
	public static getDiamondConfigFromHardhat(diamondName: string): DiamondPathsConfig {
		try {
			return hre.diamonds.getDiamondConfig(diamondName);
		} catch (error) {
			throw new Error(
				`Failed to load diamond configuration for "${diamondName}": ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Load network configuration from hardhat chainManager
	 *
	 * @param networkName - Name of the network
	 * @returns Network configuration from hardhat
	 */
	public static getNetworkConfigFromHardhat(networkName: string): HardhatNetworkConfig {
		try {
			const chainManager = (hre.config as any).chainManager;
			if (!chainManager || !chainManager.chains || !chainManager.chains[networkName]) {
				throw new Error(
					`Network "${networkName}" not found in hardhat chainManager configuration`,
				);
			}

			const networkConfig = chainManager.chains[networkName];
			return {
				name: networkName,
				chainId: networkConfig.chainId || 0,
				rpcUrl: networkConfig.rpcUrl || '',
				blockNumber: networkConfig.blockNumber,
				nativeCurrency: networkConfig.nativeCurrency,
				defaultGasLimit: networkConfig.defaultGasLimit,
				defaultMaxGasPrice: networkConfig.defaultMaxGasPrice,
			};
		} catch (error) {
			throw new Error(
				`Failed to load network configuration for "${networkName}": ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Create configuration using hardhat configurations
	 *
	 * @param diamondName - Name of the diamond
	 * @param networkName - Name of the network
	 * @param privateKey - Private key for deployment
	 * @param overrides - Additional configuration overrides
	 * @returns Complete RPCDiamondDeployerConfig
	 */
	public static createConfigFromHardhat(
		diamondName: string,
		networkName: string,
		privateKey: string,
		overrides: Partial<RPCDiamondDeployerConfig> = {},
	): RPCDiamondDeployerConfig {
		// Get diamond configuration from @diamondslab/hardhat-diamonds
		const diamondConfig = this.getDiamondConfigFromHardhat(diamondName);

		// Get network configuration from hardhat chainManager
		const networkConfig = this.getNetworkConfigFromHardhat(networkName);

		// Create base configuration
		const config: RPCDiamondDeployerConfig = {
			diamondName,
			networkName,
			chainId: networkConfig.chainId,
			rpcUrl: networkConfig.rpcUrl,
			privateKey,
			verbose: false,
			gasLimitMultiplier: 1.2,
			maxRetries: 3,
			retryDelayMs: 2000,
			writeDeployedDiamondData: true,
			// Use paths from hardhat diamond configuration
			deploymentsPath: diamondConfig.deploymentsPath,
			contractsPath: diamondConfig.contractsPath,
			configFilePath: join(
				diamondConfig.deploymentsPath || 'diamonds',
				diamondName,
				`${diamondName.toLowerCase()}.config.json`,
			),
			// Apply overrides
			...overrides,
		};

		return config;
	}

	/**
	 * Gets or creates an RPCDiamondDeployer instance
	 *
	 * @param config - Configuration object
	 * @returns Promise resolving to RPCDiamondDeployer instance
	 */
	public static async getInstance(
		config: RPCDiamondDeployerConfig,
	): Promise<RPCDiamondDeployer> {
		// Validate required configuration
		this.validateConfig(config);

		// Initialize provider and get network info if needed
		if (!config.provider) {
			config.provider = new JsonRpcProvider(config.rpcUrl);
		}

		if (!config.chainId) {
			const network = await config.provider.getNetwork();
			config.chainId = Number(network.chainId);
		}

		if (!config.networkName) {
			const network = await config.provider.getNetwork();
			config.networkName = network.name || 'unknown';
		}

		// Create unique key for this deployer instance
		const key =
			config.rpcDiamondDeployerKey ||
			(await cutKey(config.diamondName, config.networkName, config.chainId.toString()));

		// Return existing instance or create new one
		if (!this.instances.has(key)) {
			// Get Hardhat diamonds configuration if available
			const hardhatDiamonds: DiamondPathsConfig = hre.diamonds?.getDiamondConfig(
				config.diamondName,
			);

			// Set up file paths with defaults
			const deployedDiamondDataFileName = `${config.diamondName.toLowerCase()}-${config.networkName.toLowerCase()}-${config.chainId.toString()}.json`;
			const defaultDeployedDiamondDataFilePath = join(
				'diamonds',
				config.diamondName,
				'deployments',
				deployedDiamondDataFileName,
			);
			const defaultConfigFilePath = join(
				'diamonds',
				config.diamondName,
				`${config.diamondName.toLowerCase()}.config.json`,
			);

			// Configure paths with fallbacks
			config.deploymentsPath =
				config.deploymentsPath || hardhatDiamonds?.deploymentsPath || 'diamonds';
			config.contractsPath = hardhatDiamonds?.contractsPath || 'contracts';
			config.callbacksPath =
				hardhatDiamonds?.callbacksPath || join('diamonds', config.diamondName, 'callbacks');
			config.deployedDiamondDataFilePath =
				config.deployedDiamondDataFilePath ||
				hardhatDiamonds?.deployedDiamondDataFilePath ||
				defaultDeployedDiamondDataFilePath;
			config.configFilePath =
				config.configFilePath || hardhatDiamonds?.configFilePath || defaultConfigFilePath;

			// Configure Diamond ABI path and filename
			config.diamondAbiPath =
				config.diamondAbiPath || (hardhatDiamonds as any)?.diamondAbiPath || 'diamond-abi';
			config.diamondAbiFileName =
				config.diamondAbiFileName ||
				(hardhatDiamonds as any)?.diamondAbiFileName ||
				config.diamondName;

			// Create repository
			const repository = new FileDeploymentRepository(config);
			repository.setWriteDeployedDiamondData(
				config.writeDeployedDiamondData ||
					hardhatDiamonds?.writeDeployedDiamondData ||
					false,
			);

			// Create instance
			const instance = new RPCDiamondDeployer(config, repository);
			this.instances.set(key, instance);

			// ToDo there should be a verification step here with configurable version checking
			// for whatever abi contract release is expected. This is where we are getting
			// repeated diamond ABI creation in the tests.
			// Generate Diamond ABI with Typechain using hardhat task
			await hre.run('diamond:generate-abi-typechain', {
				diamondName: config.diamondName,
				outputDir: config.diamondAbiPath || 'diamond-abi',
				typechainOutDir: 'diamond-typechain-types',
				enableVerbose: config.verbose,
				targetNetwork: config.networkName,
			});

			if (config.verbose) {
				console.log(
					chalk.green(`✅ Created new RPCDiamondDeployer instance with key: ${key}`),
				);
			}
		} else if (config.verbose) {
			console.log(
				chalk.blue(`♻️  Using existing RPCDiamondDeployer instance with key: ${key}`),
			);
		}

		return this.instances.get(key)!;
	}

	/**
	 * Creates configuration from environment variables
	 *
	 * @param overrides - Optional configuration overrides
	 * @returns RPCDiamondDeployerConfig
	 */
	public static createConfigFromEnv(
		overrides?: Partial<RPCDiamondDeployerConfig>,
	): RPCDiamondDeployerConfig {
		const requiredEnvVars = ['RPC_URL', 'PRIVATE_KEY', 'DIAMOND_NAME'];

		// Check required environment variables
		for (const envVar of requiredEnvVars) {
			if (
				!process.env[envVar] &&
				!overrides?.[
					envVar.toLowerCase().replace('_', '') as keyof RPCDiamondDeployerConfig
				]
			) {
				throw new Error(`Missing required environment variable: ${envVar}`);
			}
		}

		const config: RPCDiamondDeployerConfig = {
			diamondName: process.env.DIAMOND_NAME || 'GeniusDiamond',
			rpcUrl: process.env.RPC_URL!,
			privateKey: process.env.PRIVATE_KEY!,
			networkName: process.env.NETWORK_NAME || 'unknown',
			chainId: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 0, // Will be auto-detected
			gasLimitMultiplier: process.env.GAS_LIMIT_MULTIPLIER
				? parseFloat(process.env.GAS_LIMIT_MULTIPLIER)
				: 1.2,
			maxRetries: process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : 3,
			retryDelayMs: process.env.RETRY_DELAY_MS
				? parseInt(process.env.RETRY_DELAY_MS)
				: 2000,
			verbose: process.env.VERBOSE === 'true',
			deploymentsPath: process.env.DEPLOYMENTS_PATH,
			contractsPath: process.env.CONTRACTS_PATH,
			configFilePath: process.env.DIAMOND_CONFIG_PATH,
			writeDeployedDiamondData: process.env.WRITE_DEPLOYED_DIAMOND_DATA !== 'false', // Default to true
			...overrides,
		};

		return config;
	}

	/**
	 * Validates configuration parameters
	 */
	private static validateConfig(config: RPCDiamondDeployerConfig): void {
		const errors: string[] = [];

		if (!config.diamondName) {
			errors.push('Diamond name is required');
		}

		if (!config.rpcUrl) {
			errors.push('RPC URL is required');
		}

		if (!config.privateKey) {
			errors.push('Private key is required');
		} else if (!config.privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
			errors.push('Private key must be 64 hex characters with 0x prefix');
		}

		if (
			config.gasLimitMultiplier &&
			(config.gasLimitMultiplier < 1.0 || config.gasLimitMultiplier > 2.0)
		) {
			errors.push('Gas limit multiplier must be between 1.0 and 2.0');
		}

		if (config.maxRetries && (config.maxRetries < 1 || config.maxRetries > 10)) {
			errors.push('Max retries must be between 1 and 10');
		}

		if (config.retryDelayMs && (config.retryDelayMs < 100 || config.retryDelayMs > 30000)) {
			errors.push('Retry delay must be between 100ms and 30000ms');
		}

		if (errors.length > 0) {
			throw new Error(
				`Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
			);
		}
	}

	/**
	 * Deploys or upgrades the diamond
	 *
	 * @returns Promise resolving to Diamond instance
	 */
	public async deployDiamond(): Promise<Diamond> {
		const key = await cutKey(this.diamondName, this.networkName, this.chainId.toString());

		if (this.deployComplete) {
			if (this.verbose) {
				console.log(
					chalk.yellow(
						`⚠️  Deployment already completed for ${this.diamondName} on ${this.networkName}-${this.chainId}`,
					),
				);
			}
			return Promise.resolve(this.diamond!);
		}

		if (this.deployInProgress) {
			if (this.verbose) {
				console.log(
					chalk.blue(`⏳ Deployment already in progress for ${this.networkName}`),
				);
				console.log(chalk.gray(`   Chain ID: ${this.chainId}`));
				console.log(chalk.gray(`   Key: ${key}`));
			}

			// Wait for the deployment to complete
			while (this.deployInProgress) {
				if (this.verbose) {
					console.log(
						chalk.blue(`⏳ Waiting for deployment to complete for ${this.networkName}...`),
					);
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
			return Promise.resolve(this.diamond!);
		}

		this.deployInProgress = true;

		try {
			if (this.verbose) {
				console.log(chalk.blueBright('\n🚀 Starting RPC Diamond Deployment'));
				console.log(chalk.blue('='.repeat(50)));
				console.log(chalk.blue(`💎 Diamond Name: ${this.diamondName}`));
				console.log(
					chalk.blue(`🌐 Network: ${this.networkName} (Chain ID: ${this.chainId})`),
				);
				console.log(chalk.blue(`🔗 RPC URL: ${this.config.rpcUrl}`));
				console.log(chalk.blue('='.repeat(50)));
			}

			// Validate network connection
			await this.validateConnection();

			// Create deployer with RPC strategy
			const deployer = new DiamondDeployer(this.diamond!, this.strategy);

			// Execute deployment
			await deployer.deployDiamond();

			this.deployComplete = true;

			if (this.verbose) {
				console.log(chalk.greenBright('\n🎉 Deployment completed successfully!'));
				await this.printDeploymentSummary();
			}

			return deployer.getDiamond();
		} catch (error) {
			this.deployComplete = false;

			if (this.verbose) {
				console.error(chalk.red('\n❌ Deployment failed:'));
				console.error(chalk.red(`   ${(error as Error).message}`));
			}

			throw error;
		} finally {
			this.deployInProgress = false;
		}
	}

	/**
	 * Gets the deployed diamond instance
	 *
	 * @returns Promise resolving to Diamond instance
	 */
	public async getDiamondDeployed(): Promise<Diamond> {
		if (!this.deployComplete) {
			return await this.deployDiamond();
		}
		return this.diamond!;
	}

	/**
	 * Gets the diamond instance
	 *
	 * @returns Diamond instance
	 */
	public async getDiamond(): Promise<Diamond> {
		return this.diamond!;
	}

	/**
	 * Sets verbose logging
	 *
	 * @param verbose - Enable verbose logging
	 */
	public async setVerbose(verbose: boolean): Promise<void> {
		this.verbose = verbose;
		this.config.verbose = verbose;
	}

	/**
	 * Gets deployment status
	 *
	 * @returns Current deployment status
	 */
	public getDeploymentStatus(): DeploymentStatus {
		if (this.deployComplete) {
			// Check if upgrade is available
			const deployedData = this.diamond?.getDeployedDiamondData();
			const currentConfig = this.diamond?.getDeployConfig();

			if (
				deployedData?.protocolVersion &&
				currentConfig?.protocolVersion &&
				deployedData.protocolVersion < currentConfig.protocolVersion
			) {
				return DeploymentStatus.UPGRADE_AVAILABLE;
			}

			return DeploymentStatus.COMPLETED;
		}

		if (this.deployInProgress) {
			return DeploymentStatus.IN_PROGRESS;
		}

		return DeploymentStatus.NOT_STARTED;
	}

	/**
	 * Checks if diamond is deployed
	 *
	 * @returns True if diamond is deployed
	 */
	public isDiamondDeployed(): boolean {
		const deployedData = this.diamond?.getDeployedDiamondData();
		return !!(deployedData && deployedData.DiamondAddress);
	}

	/**
	 * Gets the configuration
	 *
	 * @returns Configuration object
	 */
	public getConfig(): RPCDiamondDeployerConfig {
		return { ...this.config };
	}

	/**
	 * Gets the deployment strategy
	 *
	 * @returns RPCDeploymentStrategy instance
	 */
	public getStrategy(): RPCDeploymentStrategy {
		return this.strategy;
	}

	/**
	 * Gets the deployment repository
	 *
	 * @returns DeploymentRepository instance
	 */
	public getRepository(): DeploymentRepository {
		return this.repository;
	}

	/**
	 * Validates the current configuration and network connection
	 *
	 * @returns Promise resolving to validation result
	 */
	public async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		try {
			// Validate network connection by checking we can get network info
			try {
				// Add a timeout to avoid hanging on network calls
				const networkPromise = this.provider.getNetwork();
				const timeoutPromise = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Network connection timeout')), 5000),
				);

				const network = await Promise.race([networkPromise, timeoutPromise]);
				if (!network) {
					errors.push('Unable to connect to network');
				}
			} catch (error) {
				errors.push(`Network validation failed: ${(error as Error).message}`);
			}

			// Validate diamond configuration
			if (!this.diamond) {
				errors.push('Diamond instance not initialized');
			} else {
				const deployConfig = this.diamond.getDeployConfig();
				if (!deployConfig) {
					errors.push('Diamond configuration not found');
				} else {
					// Validate facets configuration
					const facets = deployConfig.facets || {};
					if (Object.keys(facets).length === 0) {
						errors.push('No facets configured for deployment');
					}
				}
			}

			// Validate file paths
			if (this.config.configFilePath && !existsSync(this.config.configFilePath)) {
				errors.push(`Configuration file not found: ${this.config.configFilePath}`);
			}
		} catch (error) {
			errors.push(`Validation failed: ${(error as Error).message}`);
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Gets network information
	 *
	 * @returns Promise resolving to network information
	 */
	public async getNetworkInfo(): Promise<NetworkInfo> {
		const network = await this.provider.getNetwork();
		const signerAddress = await this.signer.getAddress();
		const balance = await this.provider.getBalance(signerAddress);
		const gasPrice = (await this.provider.getFeeData()).gasPrice || 0n;
		const blockNumber = await this.provider.getBlockNumber();

		return {
			networkName: this.networkName,
			chainId: Number(network.chainId),
			signerAddress,
			balance: balance.toString(),
			gasPrice: gasPrice.toString(),
			blockNumber,
		};
	}

	/**
	 * Validates network connection
	 */
	private async validateConnection(): Promise<void> {
		try {
			await this.strategy.validateConnection();
			// // Validate network connection by getting network info
			// const network = await this.provider.getNetwork();
			// if (!network) {
			//   throw new Error('Unable to connect to network');
			// }

			if (this.verbose) {
				const networkInfo = await this.getNetworkInfo();
				console.log(chalk.blue(`✅ Network connection validated`));
				console.log(chalk.gray(`   Deployer: ${networkInfo.signerAddress}`));
				console.log(chalk.gray(`   Balance: ${Number(networkInfo.balance) / 1e18} ETH`));
				console.log(chalk.gray(`   Gas Price: ${Number(networkInfo.gasPrice) / 1e9} gwei`));
				console.log(chalk.gray(`   Block Number: ${networkInfo.blockNumber}`));
			}
		} catch (error) {
			throw new Error(`Network connection validation failed: ${(error as Error).message}`);
		}
	}

	/**
	 * Prints deployment summary
	 */
	private async printDeploymentSummary(): Promise<void> {
		const deployedData = this.diamond?.getDeployedDiamondData();
		const networkInfo = await this.getNetworkInfo();

		console.log(chalk.greenBright('\n📋 Deployment Summary'));
		console.log(chalk.green('='.repeat(50)));
		console.log(chalk.blue(`💎 Diamond Name: ${this.diamondName}`));
		console.log(chalk.blue(`🌐 Network: ${this.networkName} (Chain ID: ${this.chainId})`));
		console.log(chalk.blue(`📍 Diamond Address: ${deployedData?.DiamondAddress || 'N/A'}`));
		console.log(chalk.blue(`👤 Deployer: ${networkInfo.signerAddress}`));

		if (deployedData?.protocolVersion) {
			console.log(chalk.blue(`📋 Protocol Version: ${deployedData.protocolVersion}`));
		}

		if (deployedData?.DeployedFacets) {
			const facetCount = Object.keys(deployedData.DeployedFacets).length;
			console.log(chalk.blue(`🔧 Deployed Facets: ${facetCount}`));

			Object.entries(deployedData.DeployedFacets).forEach(([name, facet]) => {
				console.log(chalk.gray(`   ${name}: ${facet.address}`));
			});
		}

		console.log(chalk.green('='.repeat(50)));
	}
}
