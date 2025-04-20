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
  cutKey
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
  private networkName: string;
  private chainId: number;
  private repository: DeploymentRepository;

  constructor(config: LocalDiamondDeployerConfig, repository: DeploymentRepository) {
    this.config = config;
    this.diamondName = config.diamondName;
    this.networkName = config.networkName || 'hardhat';
    this.chainId = config.chainId || 31337;
    this.provider = config.provider || ethers.provider;
    this.signer = config.signer!;
    this.repository = repository!;

    // TODO make provider signer and repository optional
    this.diamond = new Diamond(this.config, repository);
    this.diamond.setProvider(this.provider);
    this.diamond.setSigner(this.signer);
  }

  public static async getInstance(
    diamondName: string,
    networkName?: string,
    provider?: JsonRpcProvider
  ): Promise<LocalDiamondDeployer> {
    if (!provider) {
      provider = ethers.provider;
    }
    if (!networkName) {
      networkName = (await provider.getNetwork()).name;
    }
    const chainId = (await provider.getNetwork()).chainId || 31337;
    const key = await (cutKey(diamondName, networkName, chainId.toString()));
    if (!this.instances.has(key)) {
      const hardhatDiamonds: DiamondConfig = hre.diamonds?.getDiamondConfig(diamondName);
      const config: DiamondConfig = {
        diamondName: diamondName,
        networkName: networkName,
        chainId: chainId,
        deploymentsPath: hardhatDiamonds?.deploymentsPath || 'diamonds',
        contractsPath: hardhatDiamonds?.contractsPath || 'contracts',
        callbacksPath: hardhatDiamonds?.callbacksPath || join('diamonds', diamondName, 'callbacks'),
      };


      const repository = new FileDeploymentRepository(config);
      // repository.setWriteDeployedDiamondData(hardhatDiamonds?.writeDeployedDiamondData ?? true);
      repository.setWriteDeployedDiamondData(hardhatDiamonds?.writeDeployedDiamondData ?? false);
      const deployedDiamondData = repository.loadDeployedDiamondData();

      const [signer] = await ethers.getSigners();
      let diamondSigner: SignerWithAddress;
      if (!deployedDiamondData.DeployerAddress) {
        diamondSigner = signer;
      } else {
        diamondSigner = await ethers.getSigner(deployedDiamondData.DeployerAddress);
        await impersonateSigner(deployedDiamondData.DeployerAddress);
        await setEtherBalance(deployedDiamondData.DeployerAddress, ethers.utils.parseEther('1'));
      }

      config.signer = diamondSigner;
      config.provider = provider;
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
    } else { }
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
