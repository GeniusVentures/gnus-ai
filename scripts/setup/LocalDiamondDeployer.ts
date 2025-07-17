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
  impersonateAndFundSigner
} from '@gnus.ai/diamonds';
import { JsonRpcProvider } from '@ethersproject/providers';
import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { join } from 'path';
import '@gnus.ai/hardhat-diamonds';

export interface LocalDiamondDeployerConfig extends DiamondConfig {
  provider?: JsonRpcProvider;
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
  private provider: JsonRpcProvider;
  private signer: SignerWithAddress;
  private diamondName: string;
  private networkName: string = 'hardhat';
  private chainId: number = 31337;
  private repository: DeploymentRepository;

  constructor(config: LocalDiamondDeployerConfig, repository: DeploymentRepository) {
    this.config = config as DiamondConfig;
    this.diamondName = config.diamondName;
    this.provider = config.provider || ethers.provider;
    if (!config.networkName) {
      // TODO account for "unknown" as hardhat 
      config.networkName = (this.provider as JsonRpcProvider)._network.name;
    } else {
      this.networkName = config.networkName;
    }
    if (!config.chainId) {
      config.chainId = (this.provider as JsonRpcProvider)._network.chainId;
    } else {
      this.chainId = config.chainId;
    }
    this.signer = config.signer!;
    // this.config.signer = this.signer;
    this.repository = repository!;

    // TODO make provider signer and repository optional (this may be handled in diamond constructor already)
    this.diamond = new Diamond(this.config, repository);
    this.diamond.setProvider(this.provider);
    this.diamond.setSigner(this.signer);
  }

  public static async getInstance(config: LocalDiamondDeployerConfig): Promise<LocalDiamondDeployer> {
    if (!config.provider) {
      config.provider = ethers.provider;
    } else {
      ethers.provider = config.provider;
    }
    if (!config.networkName) {
      const networkName = (await config.provider?.getNetwork()).name || 'hardhat';
      config.networkName = networkName === 'unknown' ? 'hardhat' : networkName;
    }
    if (!config.chainId) {
      config.chainId = (await config.provider.getNetwork()).chainId || 31337;
    }

    const key = config.localDiamondDeployerKey || await (cutKey(config.diamondName, config.networkName, config.chainId.toString()));

    if (!this.instances.has(key)) {
      const hardhatDiamonds: DiamondPathsConfig = hre.diamonds?.getDiamondConfig(config.diamondName);
      const deployedDiamondDataFileName = `${config.diamondName.toLowerCase()}-${config.networkName.toLowerCase()}-${config.chainId.toString()}.json`;
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

      const repository = new FileDeploymentRepository(config);
      repository.setWriteDeployedDiamondData(config.writeDeployedDiamondData || hardhatDiamonds?.writeDeployedDiamondData || false);
      const deployedDiamondData = repository.loadDeployedDiamondData();

      const [signer0] = await ethers.getSigners();
      // ethers.provider = config.provider;
      if (!deployedDiamondData.DeployerAddress) {
        config.signer = signer0;
      } else {
        config.signer = await ethers.getSigner(deployedDiamondData.DeployerAddress);
        await impersonateAndFundSigner(deployedDiamondData.DeployerAddress, config.provider);
      }

      const instance = new LocalDiamondDeployer(config, repository);
      this.instances.set(key, instance);
    }
    return this.instances.get(key)!;
  }

  public async deployDiamond(): Promise<Diamond> {
    const chainId = (await this.provider.getNetwork()).chainId || 31337;
    const key = cutKey(this.diamondName, this.networkName, chainId.toString());
    if (this.deployComplete) {
      console.log(`Deployment already completed for ${this.diamondName} on ${this.networkName}-${chainId.toString()}`);
      return Promise.resolve(this.diamond!);
    }
    else if (this.deployInProgress) {
      console.log(`Deployment already in progress for ${this.networkName}`);
      // Wait for the deployment to complete
      while (this.deployInProgress) {
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
