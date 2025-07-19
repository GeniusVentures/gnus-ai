import {
  Diamond,
  DiamondDeployer,
  DeploymentManager,
  LocalDeploymentStrategy,
  FileDeploymentRepository,
  DeploymentRepository,
  impersonateSigner,
  setEtherBalance,
  DiamondConfig,
  DiamondPathsConfig,
  cutKey,
  impersonateAndFundSigner,
} from 'diamonds';
import type { JsonRpcProvider } from '@ethersproject/providers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import type { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { join } from 'path';
import 'hardhat-diamonds';

import { generateDiamondAbiWithTypechain } from '../generate-diamond-abi-with-typechain';
import { DiamondAbiGenerationOptions } from '../diamond-abi-generator';

export interface LocalDiamondDeployerConfig extends DiamondConfig {
  provider?: JsonRpcProvider | HardhatEthersProvider;
  signer?: SignerWithAddress;
  localDiamondDeployerKey?: string;
}

export class LocalDiamondDeployer {
  private static instances: Map<string, LocalDiamondDeployer> = new Map();
  private deployInProgress: boolean = false;
  private deployComplete: boolean = false;
  private diamond: Diamond | undefined;
  private verbose: boolean = true;
  private config: LocalDiamondDeployerConfig;
  private provider: JsonRpcProvider | HardhatEthersProvider;
  private signer: SignerWithAddress;
  private diamondName: string;
  private networkName: string = 'hardhat';
  private chainId: bigint | number = 31337n;
  private repository: DeploymentRepository;

  private constructor(config: LocalDiamondDeployerConfig, repository: DeploymentRepository) {
    this.config = config as DiamondConfig;
    this.diamondName = config.diamondName;
    this.provider = config.provider || ethers.provider;
    if (!config.networkName) {
      // TODO account for "unknown" as hardhat 
      if ('_network' in this.provider) {
        config.networkName = (this.provider as JsonRpcProvider)._network.name;
      } else {
        config.networkName = 'hardhat';
      }
    } else {
      this.networkName = config.networkName;
    }
    if (!config.chainId) {
      if ('_network' in this.provider) {
        config.chainId = (this.provider as JsonRpcProvider)._network.chainId;
      } else {
        config.chainId = 31337;
      }
    } else {
      this.chainId = config.chainId;
    }
    this.signer = config.signer!;
    // this.config.signer = this.signer;
    this.repository = repository!;

    // TODO make provider signer and repository optional (this may be handled in diamond constructor already)
    this.diamond = new Diamond(this.config, repository);
    this.diamond.setProvider(this.provider as any);
    this.diamond.setSigner(this.signer);
  }

  private static async create(config: LocalDiamondDeployerConfig, repository: DeploymentRepository): Promise<LocalDiamondDeployer> {
    const instance = new LocalDiamondDeployer(config, repository);

    return instance;
  }

  public static async getInstance(config: LocalDiamondDeployerConfig): Promise<LocalDiamondDeployer> {
    if (!config.provider) {
      config.provider = ethers.provider;  // Default to ethers provider
    }
    if (!config.networkName) {
      const network = await config.provider.getNetwork();
      const networkName = network.name || 'hardhat';
      config.networkName = networkName === 'unknown' ? 'hardhat' : networkName;
    }
    if (!config.chainId) {
      const network = await config.provider.getNetwork();
      config.chainId = Number(network.chainId) || 31337;
    }
    
    hre.ethers.provider = config.provider as any as HardhatEthersProvider;

    const key = config.localDiamondDeployerKey || await (cutKey(config.diamondName, config.networkName!, config.chainId!.toString()));

    if (!this.instances.has(key)) {
      const hardhatDiamonds: DiamondPathsConfig = hre.diamonds?.getDiamondConfig(config.diamondName);
      const deployedDiamondDataFileName = `${config.diamondName.toLowerCase()}-${config.networkName!.toLowerCase()}-${config.chainId!.toString()}.json`;
      const defaultDeployedDiamondDataFilePath = join(
        'diamonds',
        config.diamondName,
        'deployments',
        deployedDiamondDataFileName
      );
      const defaultConfigFilePath = join(
        'diamonds',
        config.diamondName,
        `${config.diamondName.toLowerCase()}.config.json`
      );

      config.deploymentsPath = config.deploymentsPath || hardhatDiamonds?.deploymentsPath
        || 'diamonds';
      config.contractsPath = hardhatDiamonds?.contractsPath || 'contracts';
      config.callbacksPath = hardhatDiamonds?.callbacksPath
        || join('diamonds', config.diamondName, 'callbacks');
      config.deployedDiamondDataFilePath = config.deployedDiamondDataFilePath
        || hardhatDiamonds?.deployedDiamondDataFilePath
        || defaultDeployedDiamondDataFilePath;
      config.configFilePath = config.configFilePath
        || hardhatDiamonds?.configFilePath
        || defaultConfigFilePath;
      
      // Configure Diamond ABI path and filename to avoid hardhat conflicts
      config.diamondAbiPath = config.diamondAbiPath || (hardhatDiamonds as any)?.diamondAbiPath || 'diamond-abi';
      config.diamondAbiFileName = config.diamondAbiFileName || (hardhatDiamonds as any)?.diamondAbiFileName || config.diamondName;

      const repository = new FileDeploymentRepository(config);
      repository.setWriteDeployedDiamondData(config.writeDeployedDiamondData || hardhatDiamonds?.writeDeployedDiamondData || false);
      const deployedDiamondData = repository.loadDeployedDiamondData();

      const [signer0] = await hre.ethers.getSigners();
      if (!deployedDiamondData.DeployerAddress) {
        config.signer = signer0;
      } else {
        config.signer = await hre.ethers.getSigner(deployedDiamondData.DeployerAddress);
        await impersonateAndFundSigner(deployedDiamondData.DeployerAddress, config.provider as any);
      }

      const instance = new LocalDiamondDeployer(config, repository);
      this.instances.set(key, instance);
      
      const options: DiamondAbiGenerationOptions = {
        diamondName: config.diamondName,
        /** Network to use */
        networkName: config.networkName,
        /** Chain ID */
        chainId: typeof config.chainId === 'bigint' ? Number(config.chainId) : (config.chainId || 31337),
        /** Output directory for generated ABI files */
        outputDir: config.diamondAbiPath,
        /** Whether to include source information in ABI */
        // includeSourceInfo?: boolean;
        /** Whether to validate function selector uniqueness */
        // validateSelectors?: boolean;
        /** Whether to log verbose output */
        // verbose?: boolean;
        /** Path to diamond configurations */
        // diamondsPath?: string;
      }
      
      await generateDiamondAbiWithTypechain(options);
    }
    return this.instances.get(key)!;
  }

  public async deployDiamond(): Promise<Diamond> {
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId) || 31337;
    const key = cutKey(this.diamondName, this.networkName, chainId.toString());
    if (this.deployComplete) {
      console.log(`Deployment already completed for ${this.diamondName} on ${this.networkName}-${chainId.toString()}`);
      return Promise.resolve(this.diamond!);
    }
    else if (this.deployInProgress) {
      console.log(`Deployment already in progress for ${this.networkName}`);
      console.log('chainId', chainId);
      console.log('key', key);
      // Wait for the deployment to complete
      while (this.deployInProgress) {
        console.log(`Waiting for deployment to complete for ${this.networkName}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return Promise.resolve(this.diamond!);
    }

    this.deployInProgress = true;

    // Make Deployment Strategy configurable.
    const strategy = new LocalDeploymentStrategy(this.verbose);
    const deployer = new DiamondDeployer(this.diamond!, strategy);

    await deployer.deployDiamond();

    this.deployComplete = true;
    this.deployInProgress = false;

    return deployer.getDiamond();
  }

  public async getDiamondDeployed(): Promise<Diamond> {
    if (this.deployComplete && this.diamond) {
      return this.diamond;
    }
    const diamond = await this.deployDiamond();
    return diamond;
  }

  public async getDiamond(): Promise<Diamond> {
    return this.diamond!;
  }

  public async setVerbose(useVerboseLogging: boolean): Promise<void> {
    this.verbose = useVerboseLogging;
  }
}
