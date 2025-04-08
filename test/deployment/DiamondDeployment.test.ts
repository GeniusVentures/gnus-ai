import { expect } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';

import {
  Diamond,
  DiamondDeployer,
  DeploymentManager,
  FacetCallbackManager,
  LocalDeploymentStrategy,
  FileDeploymentRepository
} from '@gnus.ai/diamonds';
import { DiamondConfig } from '@gnus.ai/diamonds/src/types';
import path from 'path';


describe("Local Diamond Deployment", function () {
  this.timeout(0); // Extend timeout to accommodate deployments
  let diamond: Diamond;
  let deployer: DiamondDeployer;
  let deploymentManager: DeploymentManager;

  before(async () => {
    const [signer] = await ethers.getSigners();
    const diamondsConfig = hre.config.diamonds! || undefined;
    let config: DiamondConfig = diamondsConfig["GeniusDiamond"]
      ? { ...diamondsConfig["GeniusDiamond"] }
      : {
        deploymentsPath: "diamonds",  // These are the default values
        contractsPath: "contracts",  // default contractsPath 
      };

    // Set the network on config
    config.diamondName = "GeniusDiamond";
    config.networkName = hre.network.name;
    config.chainId = hre.network.config.chainId! || 31337;
    const repository = new FileDeploymentRepository();
    diamond = new Diamond(config, repository);
    diamond.provider = ethers.provider;
    diamond.deployer = signer;

    const strategy = new LocalDeploymentStrategy();
    deployer = new DiamondDeployer(diamond, strategy);

    const callbackManager = FacetCallbackManager.getInstance(
      diamond.diamondName,
      path.join(diamond.deploymentsPath, diamond.diamondName, "facetCallbacks")
    );

    deploymentManager = new DeploymentManager(diamond, deployer, callbackManager);
  });

  it("should deploy Diamond and facets correctly on the current chain", async () => {
    await deploymentManager.deployAll();

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
      diamond.diamondName,
      path.join(diamond.deploymentsPath, diamond.diamondName, "facetCallbacks")
    );

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
