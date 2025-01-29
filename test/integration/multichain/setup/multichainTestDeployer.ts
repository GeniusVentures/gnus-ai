import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import * as util from 'util';
import { JsonRpcProvider } from '@ethersproject/providers';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import { 
  deployGNUSDiamond, 
  deployDiamondFacets, 
  deployFuncSelectors, 
  afterDeployCallbacks, 
  deployAndInitDiamondFacets,
  deployExternalLibraries
} from '../../../../scripts/deploy';
import { 
  dc, 
  INetworkDeployInfo, 
  FacetToDeployInfo,
  FacetDeployedInfo, 
  PreviousVersionRecord 
} from '../../../../scripts/common';
import { deployments} from '../../../../scripts/deployments';
import { assert } from 'chai';
import { Facets, LoadFacetDeployments } from '../../../../scripts/facets';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';
import { IERC165Upgradeable__factory, IERC1155Upgradeable__factory } from '../../../../typechain-types';
import { createForkLogger } from '../utils/logger';
import { waitForNetwork } from '../utils/network-utils';
import { GetUpdatedFacets, attachGNUSDiamond  } from '../../../../scripts/upgrade';

type DeployConfig = {
  networkName: string;
  chainID: number;
  rpcURL: string;
};

class MultiChainTestDeployer {
  private static instances: Map<string, MultiChainTestDeployer> = new Map();
  private networkName: string;
  private chainID: number;
  private rpcURL: string;
  private provider: JsonRpcProvider | null = null;
  private gnusDiamond: GeniusDiamond | null = null;
  private deployInfo: INetworkDeployInfo | null = null;
  private previousDeployedVersions: PreviousVersionRecord = {};
  private deployInProgress = false;
  private upgradeInProgress = false;

  private constructor(config: DeployConfig) {
    this.networkName = config.networkName;
    this.chainID = config.chainID;
    this.rpcURL = config.rpcURL;
  }
  
  // getter for the deployInfo
  getDeployInfo(): INetworkDeployInfo | null {
    return this.deployInfo;
  }

  // Factory method to get or create an instance for a network
  static getInstance(config: DeployConfig): MultiChainTestDeployer {
    if (!this.instances.has(config.networkName)) {
      this.instances.set(config.networkName, new MultiChainTestDeployer(config));
    }
    return this.instances.get(config.networkName)!;
  }

  // Main deployment logic
  async deploy(): Promise<void> {
    if (this.deployInProgress) {
      throw new Error(`Deployment already in progress for ${this.networkName}`);
    }
    else if (this.upgradeInProgress) {
      throw new Error(`Upgrade in progress for ${this.networkName}`);
    }
    if (this.gnusDiamond) {
      console.log(`Deployment already completed for ${this.networkName}`);
      return;
    }

    this.deployInProgress = true;

    try {
      const logger = createForkLogger(this.networkName);
      logger.info(`Starting deployment for ${this.networkName}`);

      // Set up provider and validate network
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcURL);
      if (this.provider) {
        ethers.provider = this.provider;
      } else {
        throw new Error('Provider is not initialized.');
      }
      await waitForNetwork(this.rpcURL, 100000);

      // Load existing deployments
      await LoadFacetDeployments();

      // Initialize deployment info
      this.deployInfo = deployments[this.networkName] || {
        networkName: this.networkName,
        chainID: this.chainID,
        rpcURL: this.rpcURL,
        DiamondAddress: '',
        DeployerAddress: '',
        FacetDeployedInfo: {},
      };

      // add the chainId to the deployInfo
      this.deployInfo.chainID = this.chainID;
      // add the rpcURL to the deployInfo
      this.deployInfo.rpcURL = this.rpcURL; 
      // add the provider to the deployInfo
      this.deployInfo.networkName = this.networkName;
      
      // Impersonate the deployer and fund their account
      const deployerAddress = this.deployInfo.DeployerAddress;
      await this.provider.send('hardhat_impersonateAccount', [deployerAddress]);
      const deployer = this.provider.getSigner(deployerAddress);
      await this.provider.send('hardhat_setBalance', [deployerAddress, '0x56BC75E2D63100000']);
      
      
      // Deploy GNUS Diamond
      await deployGNUSDiamond(this.deployInfo);
      this.gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

      // Interface Compatibility Test (ERC165 and ERC1155)
      await this.testInterfaceCompatibility();

      // Backup pre-upgrade deployment info
      const deployInfoBeforeUpgraded = JSON.parse(JSON.stringify(this.deployInfo));

      // Deploy Diamond Facets
      const facetsToDeploy: FacetToDeployInfo = {};
      await deployDiamondFacets(this.deployInfo, facetsToDeploy);
      
      // Deploy and Initialize Diamond Facets
      await deployAndInitDiamondFacets(this.deployInfo, facetsToDeploy); 

      // Deploy Function Selectors
      // await deployFuncSelectors(this.deployInfo, deployInfoBeforeUpgraded, facetsToDeploy);

      // Execute Post-Deployment Callbacks
      // await afterDeployCallbacks(this.deployInfo, undefined, this.previousDeployedVersions);

      logger.info(`Deployment completed for ${this.networkName}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Deployment failed for ${this.networkName}: ${error.message}`);
      } else {
        console.error(`Deployment failed for ${this.networkName}: ${String(error)}`);
      }
      throw error;
    } finally {
      this.deployInProgress = false;
    }
  }
  
  // Main upgrade logic
  async upgrade(): Promise<void> {
    if (this.upgradeInProgress) {
      throw new Error(`Upgrade already in progress for ${this.networkName}`);
    }
    else if (this.deployInProgress) {
      throw new Error(`Deployment in progress for ${this.networkName}`);
    }
    // TODO this is not a valid check for Upgrade, however we need an upgrade checker.
    // if (this.gnusDiamond) {
    //   console.log(`Upgrade already completed for ${this.networkName}`);
    //   return;
    // }

    this.upgradeInProgress = true;

    try {
      const logger = createForkLogger(this.networkName);
      logger.info(`Starting Upgrade for ${this.networkName}`);

      // Set up provider and validate network
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcURL);
      ethers.provider = this.provider;
      await waitForNetwork(this.rpcURL, 100000);;

      // Initialize Upgrade info (existing deployments or new)
      this.deployInfo = deployments[this.networkName] || {
        networkName: this.networkName,
        chainID: this.chainID,
        rpcURL: this.rpcURL,
        DiamondAddress: '',
        DeployerAddress: '',
        FacetDeployedInfo: {},
      };

      // add the chainId to the deployInfo
      this.deployInfo.chainID = this.chainID;
      // add the rpcURL to the deployInfo
      this.deployInfo.rpcURL = this.rpcURL; 
      // add the provider to the deployInfo
      this.deployInfo.networkName = this.networkName;

      // Impersonate the deployer and fund their account
      const deployerAddress = this.deployInfo.DeployerAddress;
      const deployer = await this.impersonateAndFundDeployer(this.provider, deployerAddress);
      
      // Deploy and Load GNUS Diamond instance
      await deployGNUSDiamond(this.deployInfo);
      this.gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
      // deploy Diamond
      const diamondAddress = this.deployInfo.DiamondAddress;
      dc._gnusDiamond = (
        await ethers.getContractFactory('contracts/GeniusDiamond.sol:GeniusDiamond')
      ).attach(diamondAddress);
      dc.gnusDiamond = (
        await ethers.getContractFactory('hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond')
      ).attach(diamondAddress);
      
      const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
      dc.DiamondCutFacet = DiamondCutFacet.attach(
        this.deployInfo.FacetDeployedInfo.DiamondCutFacet.address!,
      );
      
      // Interface Compatibility Test (ERC165 and ERC1155)
      await this.testInterfaceCompatibility();
      
      // check if the owner is the deployer and transfer ownership to the deployer
      const deployerGnusDiamond = this.gnusDiamond.connect(deployer);
      const currentContractOwner = await deployerGnusDiamond.owner();
      if (currentContractOwner.toLowerCase() === deployerAddress.toLowerCase()) {
        logger.info(`Ownership is correct, current contractOwner:  ${currentContractOwner}`);
      } else {
        logger.info(`Transferring ownership to ${deployerAddress}`);
        // Impersonate and fund the currentContractOwner
        await this.provider.send('hardhat_impersonateAccount', [currentContractOwner]);
        await this.provider.send('hardhat_setBalance', [currentContractOwner, '0x56BC75E2D63100000']);
        
        //connect the currentContractOwner to the contract and transfer ownership to the deployer
        const currentOwner = this.provider.getSigner(currentContractOwner);
        const currentOwnerGnusDiamond = this.gnusDiamond.connect(currentOwner);
        const tx = await currentOwnerGnusDiamond.transferOwnership(deployerAddress);
        await tx.wait();
        
        // Verify the ownership transfer
        const newContractOwner = await currentOwnerGnusDiamond.owner();
        if (newContractOwner.toLowerCase() === deployerAddress.toLowerCase()) {
          logger.info(`Ownership transferred to ${newContractOwner}`);
        } else {
          throw new Error(`Ownership transfer failed. Current owner: ${newContractOwner}`);
        }
      }
      
      // Backup pre-upgrade Upgrade info
      const deployInfoBeforeUpgraded = JSON.parse(JSON.stringify(this.deployInfo));

      // Deploy Diamond Facets
      const facetsToDeploy: FacetToDeployInfo = {};
      
      const updatedFacetsToDeploy = await GetUpdatedFacets(this.deployInfo!.FacetDeployedInfo);
      console.log(util.inspect(updatedFacetsToDeploy));
      
      // await deployDiamondFacets(this.deployInfo!, updatedFacetsToDeploy);
      // if (!this.deployInfo!.ExternalLibraries) await deployExternalLibraries(this.deployInfo!);
      await deployAndInitDiamondFacets(this.deployInfo!, updatedFacetsToDeploy);

      logger.info(`Upgrade completed for ${this.networkName}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Upgrade failed for ${this.networkName}: ${error.message}`);
      } else {
        console.error(`Upgrade failed for ${this.networkName}: ${String(error)}`);
      }
      throw error;
    } finally {
      this.deployInProgress = false;
    }
  }
  
  /**
   * Impersonates the deployer account and funds it to a balance that is rounded to the next highest 100 ETH.
   * 
   * @param provider - The ethers provider instance.
   * @param deployerAddress - The address of the deployer account.
   * @param balance - The balance to set for the deployer account (in hex format).
   */
  async impersonateAndFundDeployer(provider: JsonRpcProvider, deployerAddress: string): Promise<Signer> {
    try {
      await provider.send('hardhat_impersonateAccount', [deployerAddress]);
      const deployer = provider.getSigner(deployerAddress);
      
      // Check current balance
      const balance = await provider.getBalance(deployerAddress);
      const balanceInEth = parseFloat(ethers.utils.formatEther(balance));
      
      // Calculate the target balance (next highest amount in ETH rounded to 1 followed by all zeros, minimum 100 ETH)
      let targetBalanceInEth = Math.ceil(balanceInEth / 100) * 100;
      if (targetBalanceInEth < 100) {
        targetBalanceInEth = 100;
      }
      
      // Calculate the amount to fund
      const targetBalance = ethers.utils.parseEther(targetBalanceInEth.toString());
      const amountToFund = targetBalance.sub(balance);
      
      // Fund the account
      await provider.send('hardhat_setBalance', [deployerAddress, amountToFund.toHexString()]);
      return deployer;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Impersonation and funding failed for ${deployerAddress}: ${error.message}`);
      } else {
        console.error(`Impersonation and funding failed for ${deployerAddress}: ${String(error)}`);
      }
      throw error;
    }
  }

  private async GetUpdatedFacets(facetsDeployed: FacetDeployedInfo): Promise<FacetToDeployInfo> {
    const updatedFacetsToDeploy: FacetToDeployInfo = {};
  
    for (const name in Facets) {
      updatedFacetsToDeploy[name] = Facets[name];
    }
    return Promise.resolve(updatedFacetsToDeploy);
  }

  // TODO: this test might be better suited in the MultiChainForkDeployTests.ts file or
  // it may be that the testInterfaceCompatibility should test the ERC20 interface as well
  private async testInterfaceCompatibility(): Promise<void> {
    if (!this.gnusDiamond) throw new Error('GeniusDiamond is not deployed yet.');

    const logger = createForkLogger(this.networkName);
    const IERC165Interface = IERC165Upgradeable__factory.createInterface();
    const IERC165ID = getInterfaceID(IERC165Interface);
    const IERC1155Interface = IERC1155Upgradeable__factory.createInterface();

    const IERC1155ID = getInterfaceID(IERC1155Interface).xor(IERC165ID);

    const supportsInterface = await this.gnusDiamond.supportsInterface(IERC1155ID._hex);
    assert(supportsInterface, "Diamond does not support IERC1155Upgradeable");

    logger.info('Diamond interface compatibility test passed.');
  }

  // Retrieve deployed GNUS Diamond instance
  getDiamond(): GeniusDiamond | null {
    return this.gnusDiamond;
  }

  // Cleanup resources
  static cleanup(): void {
    this.instances.clear();
  }
}

export default MultiChainTestDeployer;
