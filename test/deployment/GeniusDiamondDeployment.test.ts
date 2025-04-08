import { expect } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { pathExistsSync } from "fs-extra";
import {
  Diamond,
  DiamondDeployer,
  DeploymentManager,
  FacetCallbackManager,
  LocalRPCDeploymentStrategy,
  FileDeploymentRepository,
  deleteDeployInfo,
} from '@gnus.ai/diamonds';
import { DiamondConfig } from '@gnus.ai/diamonds/src/types';

describe("Local Diamond Deployment", function () {
  const diamondName = "GeniusDiamond";
  this.timeout(0); // Extend timeout to accommodate deployments

  let diamond: Diamond;
  let deployer: DiamondDeployer;
  let deploymentManager: DeploymentManager;

  before(async () => {
    const [signer] = await ethers.getSigners();
    const networkName = hre.network.name;
    const chainId = (await hre..getNetwork()).chainId;
    const diamondsConfig = hre.diamonds.getDiamondConfig(diamondName)!;
    let config: DiamondConfig = {
      diamondName,
      networkName,
      chainId: (await multichainProvider.getNetwork())?.chainId || 31337,
      deploymentsPath: diamondsConfig.deploymentsPath,
      contractsPath: diamondsConfig.contractsPath,
    };

    // Set the network on config
    config.diamondName = diamondName;
    config.networkName = hre.network.name;
    config.chainId = hre.network.config.chainId! || 31337; // Default to hardhat chainId
    // config.createNewDeploymentFile = false;
    const repository = new FileDeploymentRepository();
    diamond = new Diamond(config, repository);
    diamond.provider = ethers.provider;
    diamond.deployer = signer;

    const strategy = new LocalRPCDeploymentStrategy();
    deployer = new DiamondDeployer(diamond, strategy);

    deploymentManager = new DeploymentManager(diamond, deployer);
  });

  after(async () => {
    if (pathExistsSync(diamond.deployInfoFilePath)) {
      deleteDeployInfo(diamond.deployInfoFilePath)
    }
  });

  it("should upgrade Diamond and facets correctly on the current chain", async () => {
    // First check if the diamond is already deployed
    const deployInfoBeforeDeploy = diamond.getDeployInfo();
    if (deployInfoBeforeDeploy.DiamondAddress) {
      console.log(`Diamond already deployed at ${deployInfoBeforeDeploy.DiamondAddress}. Performing upgrade...`);
      await deploymentManager.upgradeAll();
    } else {
      console.log(`Diamond not deployed. Performing initial deployment...`);
      await deploymentManager.deployAll();
    }

    const deployInfo = diamond.getDeployInfo();
    expect(deployInfo.DiamondAddress).to.match(/^0x[a-fA-F0-9]{40}$/);

    expect(deployInfo.FacetDeployedInfo).to.be.an('object').and.not.empty;
    for (const facetName in deployInfo.FacetDeployedInfo) {
      const facet = deployInfo.FacetDeployedInfo[facetName];
      expect(facet.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(facet.tx_hash).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(facet.funcSelectors).to.be.an('array').and.not.empty;
      expect(facet.version).to.be.a('number').and.greaterThanOrEqual(0);
      console.log(`Facet ${facetName} deployed at ${facet.address}`);
    }
  });

  it("should have correctly initialized the callback manager", async () => {
    const callbackManager = FacetCallbackManager.getInstance(
      diamond.diamondName, diamond.deploymentsPath);

    expect(callbackManager).to.exist;
  });

  it("should correctly perform diamond cut", async () => {
    const deployInfo = diamond.getDeployInfo();
    const loupe = await ethers.getContractAt("IDiamondLoupe", deployInfo.DiamondAddress!, diamond.deployer);
    const facets = await loupe.facets();

    expect(facets).to.be.an('array').and.not.empty;
    for (const facet of facets) {
      expect(facet.facetAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(facet.functionSelectors).to.be.an('array').and.not.empty;
    }
  });
});
