import {
  Diamond,
  DiamondDeployer,
  DeploymentManager,
  FacetCallbackManager,
  LocalRPCDeploymentStrategy,
  FileDeploymentRepository
} from '@gnus.ai/diamonds';
import { DiamondConfig } from '@gnus.ai/diamonds';
import { JsonRpcProvider } from '@ethersproject/providers';
import hre, { ethers } from 'hardhat';

const diamondMap = new Map<string, DeploymentManager>();

export async function getOrDeployDiamond(networkName: string, diamondName: string, multichainProvider: JsonRpcProvider): Promise<DeploymentManager> {

  const key = `${networkName}:${diamondName}`;
  if (diamondMap.has(key)) return diamondMap.get(key)!;

  const [signer] = await ethers.getSigners();
  const diamondsConfig = hre.diamonds.getDiamondConfig(diamondName)!;
  let config: DiamondConfig = {
    diamondName,
    networkName,
    chainId: (await multichainProvider.getNetwork())?.chainId || 31337,
    deploymentsPath: diamondsConfig.deploymentsPath,
    contractsPath: diamondsConfig.contractsPath,
  };

  const repository = new FileDeploymentRepository();
  const diamond = new Diamond(config, repository);
  if (!diamond.getDeployInfo().DeployerAddress) {
    diamond.deployer = signer;
  } else {
    diamond.deployer = await ethers.getSigner(diamond.getDeployInfo().DeployerAddress);
  }
  diamond.provider = multichainProvider;

  const strategy = new LocalRPCDeploymentStrategy();
  const deployer = new DiamondDeployer(diamond, strategy);

  const manager = new DeploymentManager(diamond, deployer);
  const deployInfo = diamond.getDeployInfo();
  if (deployInfo.DiamondAddress) {
    console.log(`Diamond already deployed at ${deployInfo.DiamondAddress}. Performing upgrade...`);
    await manager.upgradeAll();
  } else {
    console.log(`Diamond not deployed. Performing initial deployment...`);
    await manager.deployAll();
  }

  diamondMap.set(key, manager);
  return manager;
}