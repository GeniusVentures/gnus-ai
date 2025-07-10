import { ethers } from 'hardhat';
// import { ethers as ethersType } from 'ethers';
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types';
import { Signer } from 'ethers';
import * as util from 'util';
import { JsonRpcProvider } from '@ethersproject/providers';
import { GeniusDiamond } from '../../typechain-types/GeniusDiamond';
import {
  deployGNUSDiamond,
  deployDiamondFacets,
  deployFuncSelectors,
  afterDeployCallbacks,
  deployAndInitDiamondFacets,
  deployExternalLibraries
} from '../../scripts/deploy';
import {
  dc,
  INetworkDeployInfo,
  FacetToDeployInfo,
  FacetDeployedInfo,
  PreviousVersionRecord
} from '../../notes/archive/common';
import { deployments } from ../../ notes / archive / deploymentss';
import { assert } from 'chai';
import { Facets, LoadFacetDeployments } from '../../scripts/facets';
import { getInterfaceID } from '../../notes/archive/FacetSelectors';
import { IERC165Upgradeable__factory, IERC1155Upgradeable__factory } from '../../typechain-types';
import { createForkLogger } from '../utils/logger';
import { waitForNetwork } from '../utils/network-utils';
import { GetUpdatedFacets, attachGNUSDiamond } from '../../notes/archive/upgrade';

interface ChainInfo {
  chainName: string;
  provider: JsonRpcProvider;
};

class MultiChainTestDeployer {
  private static instances: Map<string, MultiChainTestDeployer> = new Map();
  private chainName: string;
  private provider: JsonRpcProvider;
  private gnusDiamond: GeniusDiamond;;
  private deployInfo: INetworkDeployInfo | null = null;
  private deployInProgress = false;
  private upgradeInProgress = false;
  private ethersMultichain: typeof ethers & HardhatEthersHelpers;
  private upgradeCompleted: boolean;
  private deployCompleted: boolean;
  private deployer: Signer;

  private constructor(config: ChainInfo) {
    this.chainName = config.chainName;
    this.provider = config.provider;
    this.ethersMultichain = ethers;
    this.ethersMultichain.provider = this.provider;
    this.upgradeCompleted = false;
    this.deployCompleted = false;
    this.gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    this.deployer = this.provider.getSigner(deployments[this.chainName]?.DeployerAddress) || this.provider.getSigner(0);
  }

  // getter for the deployInfo
  getDeployInfo(): INetworkDeployInfo | null {
    return this.deployInfo;
  }

  setDeployInfo(deployInfo: INetworkDeployInfo): void {
    this.deployInfo = deployInfo;
  }

  // Factory method to get or create an instance for a network
  static getInstance(chainInfo: ChainInfo): MultiChainTestDeployer {
    if (!this.instances.has(chainInfo.chainName)) {
      this.instances.set(chainInfo.chainName, new MultiChainTestDeployer(chainInfo));
    }
    return this.instances.get(chainInfo.chainName)!;
  }

  // Main deployment logic
  async deploy(): Promise<boolean | void> {
    if (this.deployCompleted) {
      console.log(`Deployment already completed for ${this.chainName}`);
      return Promise.resolve(true);
    }
    else if (this.deployInProgress) {
      console.log(`Deployment already in progress for ${this.chainName}`);
      // Wait for the deployment to complete
      while (this.deployInProgress) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return;
    } else if (this.upgradeInProgress) {
      console.log(`Upgrade in progress for ${this.chainName}`);
      while (this.upgradeInProgress) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return;
    }

    this.deployInProgress = true;

    try {
      // Load existing deployments into the global 
      await LoadFacetDeployments();

      // Initialize deployment info, default to signer[0] as deployer
      this.deployInfo = deployments[this.chainName] || {
        provider: this.provider,
        DiamondAddress: '',
        DeployerAddress: this.deployer.getAddress(),
        FacetDeployedInfo: {},
      };


      if (this.deployInfo!.DiamondAddress) {
        console.log('Diamond Deployment Found. No need for new deployment.');
        this.deployInfo!.provider = this.provider;
        // Impersonate the deployer and fund their account
        await this.impersonateAndFundAccount(this.deployInfo.DeployerAddress);

        // Deploy GNUS Diamond
        await deployGNUSDiamond(this.deployInfo);
        return;
      } else {
        // Retrieve the signers for the chain, set hardhat default signer[0] as Deployer
        this.deployInfo.DeployerAddress = await this.deployer.getAddress();
      }


      let diamondAddress;
      let diamondCutAddress;
      // Deploy and Load GNUS Diamond instance
      [diamondAddress, diamondCutAddress] = await deployGNUSDiamond(this.deployInfo);

      // Attach GNUS Diamond instance
      this.gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

      // Interface Compatibility Test (ERC165 and ERC1155)
      await this.testInterfaceCompatibility();

      // Backup pre-upgrade deployment info
      const deployInfoBeforeUpgraded = JSON.parse(JSON.stringify(this.deployInfo));

      // Define facets to be deployed, sourced from the `Facets` object.
      let facetsToDeploy: FacetToDeployInfo = Facets;
      await deployDiamondFacets(this.deployInfo, facetsToDeploy);

      // // Deploy and Initialize Diamond Facets
      await deployAndInitDiamondFacets(this.deployInfo, facetsToDeploy);

    } catch (error) {
      if (error instanceof Error) {
        console.error(`Deployment failed for ${this.chainName}: ${error.message}`);
      } else {
        console.error(`Deployment failed for ${this.chainName}: ${String(error)}`);
      }
      throw error;
    } finally {
      this.deployInProgress = false;
      this.deployCompleted = true;

      return Promise.resolve(true);
    }
  }

  // Main upgrade logic
  async upgrade(): Promise<boolean | void> {
    if (this.deployInProgress) {
      console.log(`The deploy stage is in progress for ${this.chainName}`);
      // Wait for the deployment to complete
      while (this.deployInProgress) {
        console.log('⏱️ Waiting for deployment to complete');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } else if (this.upgradeInProgress) {
      console.log(`Upgrade in progress for ${this.chainName}`);
      while (this.upgradeInProgress) {
        // Wait for the upgrade to complete
        console.log('⏱️ Waiting for upgrade to complete');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (this.upgradeCompleted) {
      console.log(`⏏️ Upgrade already completed for ${this.chainName}`);
      return Promise.resolve(true);
    }

    const protocolInfo = await this.provider.getNetwork();

    this.upgradeInProgress = true;

    try {

      console.info(`Starting Upgrade for ${this.chainName}`);

      if (!this.deployInfo) {
        // Initialize Upgrade info (existing deployments or new)
        this.deployInfo = deployments[this.chainName] || {
          provider: this.provider,
          DiamondAddress: '',
          DeployerAddress: '',
          FacetDeployedInfo: {},
        };

        this.deployInfo!.provider = this.provider;
      }

      this.gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

      let deployerAddress: string;
      if (this.deployInfo!.DeployerAddress && this.deployInfo!.DiamondAddress) {
        console.log('Diamond Deployment Found. No need for new deployment.');
        // Impersonate the deployer and make sure we have enough funds
        await this.impersonateAndFundAccount(this.deployInfo.DeployerAddress);
        await deployGNUSDiamond(this.deployInfo);
      } else {
        // This is all done for Hardhat Network or other chains where this a first time deployment
        // Retrieve the signers for the chain, set hardhat default signer[0] as Deployer
        this.deployInfo.DeployerAddress = await this.deployer.getAddress();

        let diamondAddress;
        let diamondCutAddress;
        // Deploy and Load GNUS Diamond instance and setup deployInfo
        [this.deployInfo.DiamondAddress, this.deployInfo.FacetDeployedInfo.DiamondCutFacet.address] = await deployGNUSDiamond(this.deployInfo);
      }

      // Attach GNUS Diamond instance, this done already if this was deployed

      // TODO the use of dc._gnusDiamond and dc.gnusDiamond is confusing, should be refactored
      // deploy Diamond
      const diamondAddress = this.deployInfo.DiamondAddress;
      dc._gnusDiamond = (
        await this.ethersMultichain.getContractFactory('contracts/GeniusDiamond.sol:GeniusDiamond')
      ).attach(diamondAddress);
      dc.gnusDiamond = (
        await this.ethersMultichain.getContractFactory('hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond')
      ).attach(diamondAddress);

      const DiamondCutFacet = await this.ethersMultichain.getContractFactory('DiamondCutFacet');
      dc.DiamondCutFacet = DiamondCutFacet.attach(
        this.deployInfo.FacetDeployedInfo.DiamondCutFacet.address!,
      );

      // TODO Should this be tested here because it causes issues if the diamond is not deployed with ERC1155 already.
      // Interface Compatibility Test (ERC165 and ERC1155)
      await this.testInterfaceCompatibility();

      // TODO This should be a test in a separate function ERC173
      if (this.chainName !== 'hardhat') {
        // check if the owner is the deployer and transfer ownership to the deployer
        const deployerGnusDiamond = this.gnusDiamond.connect(this.deployer);
        const currentContractOwner = await deployerGnusDiamond.owner();
        if (currentContractOwner.toLowerCase() === (await this.deployer.getAddress()).toLowerCase()) {
          console.log(`Ownership is correct, current contractOwner:  ${currentContractOwner}`);
        } else {
          console.log(`Transferring ownership to ${this.deployer.getAddress()}`);
          // Impersonate and fund the currentContractOwner
          await this.impersonateAndFundAccount(currentContractOwner);

          //connect the currentContractOwner to the contract and transfer ownership to the deployer
          const currentOwner = this.provider?.getSigner(currentContractOwner);
          const currentOwnerGnusDiamond = this.gnusDiamond.connect(currentOwner);
          const tx = await currentOwnerGnusDiamond.transferOwnership(await this.deployer.getAddress());
          await tx.wait();

          // Verify the ownership transfer
          const newContractOwner = await currentOwnerGnusDiamond.owner();
          if (newContractOwner.toLowerCase() === (await this.deployer.getAddress()).toLowerCase()) {
            console.log(`Ownership transferred to ${newContractOwner}`);
          } else {
            throw new Error(`Ownership transfer failed. Current owner: ${newContractOwner}`);
          }
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

      console.log(`Upgrade completed for ${this.chainName}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Upgrade failed for ${this.chainName}: ${error.message}`);
      } else {
        console.error(`Upgrade failed for ${this.chainName}: ${String(error)}`);
      }
      throw error;
    } finally {
      this.upgradeInProgress = false;
      this.upgradeCompleted = true;

      return Promise.resolve(true);
    }
  }

  /**
   * Impersonates the deployer account and funds it to a balance that is rounded to the next highest 100 ETH.
   * 
   * @param provider - The ethers provider instance.
   * @param deployerAddress - The address of the deployer account.
   * @param balance - The balance to set for the deployer account (in hex format).
   */
  async impersonateAndFundAccount(deployerAddress: string): Promise<Signer> {
    try {
      await this.provider.send('hardhat_impersonateAccount', [deployerAddress]);
      const deployer = this.provider.getSigner(deployerAddress);

      // Fund the account
      await this.provider.send('hardhat_setBalance', [deployerAddress, '0x56BC75E2D63100000']);
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

  // TODO: this test might be better suited in the MultiChainForkDeployTests.ts file or in a separate file
  // it may be that the testInterfaceCompatibility should test the ERC20 interface as well
  private async testInterfaceCompatibility(): Promise<void> {
    if (!this.gnusDiamond) throw new Error('GeniusDiamond is not deployed yet.');

    const logger = createForkLogger(this.chainName);
    const IERC165Interface = IERC165Upgradeable__factory.createInterface();
    const IERC165ID = getInterfaceID(IERC165Interface);
    const IERC1155Interface = IERC1155Upgradeable__factory.createInterface();

    const IERC1155ID = getInterfaceID(IERC1155Interface).xor(IERC165ID);

    const supportsInterface = await this.gnusDiamond.supportsInterface(IERC1155ID._hex);
    assert(supportsInterface, "Diamond does not support IERC1155Upgradeable");

    logger.info('Diamond interface compatibility test passed.');
  }

  // Retrieve deployed GNUS Diamond instance
  getDiamond(): GeniusDiamond {
    return this.gnusDiamond;
  }

  // Cleanup resources
  static cleanup(): void {
    this.instances.clear();
  }
}

export default MultiChainTestDeployer;
