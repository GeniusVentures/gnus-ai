import { expect, assert } from 'chai';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import { multichain } from 'hardhat-multichain';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { debug } from 'debug';

// IERC20Upgradeable__factory
import { IERC20Upgradeable__factory } from '../../../../typechain-types';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';

describe('Multichain Integration Tests with Diamond Deployment', function () {
  const log: debug.Debugger = debug('GNUSDeploy:log');
  this.timeout(0); // Extend timeout to accommodate deployments and debugging

  const chains = multichain.getProviders();

  before(async function () {

    // TODO: This should be moved to a separate script with a multiton pattern so it is not repeated for a single chain over various tests
    // Deploy the diamond contracts on each chain
    for (const [chainName, provider] of chains.entries()) {
      // TODO Replace with Hardhat-Multichain types
      // ethers.provider = provider;
      const chainInfo = {
        chainName: chainName,
        provider: provider,
      };
      const deployer = MultiChainTestDeployer.getInstance(chainInfo);
      // TODO The deployment status on a particular chain should be switch with the deployer
      // await deployer.deploy();
      await deployer.upgrade();
    }
  });

  it('should verify that chain providers are defined and have valid block numbers', async function () {
    for (const [chainName, provider] of chains.entries()) {
      log(`Checking chain provider for: ${chainName}`);
      const blockNumber = await provider?.getBlockNumber();
      const configBlockNumber = hre.config.chainManager?.chains?.[chainName]?.blockNumber;
      expect(blockNumber).to.be.gte(configBlockNumber);
    }
  });

  it('should verify the deployment of GNUS Diamond and validate interface compatibility', async function () {
    for (const [chainName, provider] of chains.entries()) {
      log(`Validating diamond deployment on chain: ${chainName}`);
      const chainInfo = {
        chainName: chainName,
        provider: provider,
      };
      const deployer = MultiChainTestDeployer.getInstance(chainInfo);

      // Retrieve the deployed GNUS Diamond contract
      const diamond = deployer.getDiamond();
      expect(diamond).to.not.be.null;

      // Test ERC165 interface compatibility
      const supportsERC165 = await diamond?.supportsInterface('0x01ffc9a7');
      expect(supportsERC165).to.be.true;

      log(`Diamond deployed and validated on ${chainName}`);
    }
  });
  
  it('should verify ERC165 supported interface for ERC1155', async function () {
    for (const [chainName, provider] of chains.entries()) {
      log(`Validating ERC1155 interface on chain: ${chainName}`);
      const chainInfo = {
        chainName: chainName,
        provider: provider,
      };
      const deployer = MultiChainTestDeployer.getInstance(chainInfo);

      // Retrieve the deployed GNUS Diamond contract
      const diamond = deployer.getDiamond();
      expect(diamond).to.not.be.null;

      // Test ERC165 interface compatibility for ERC1155
      const supportsERC1155 = await diamond?.supportsInterface('0xd9b67a26');
      expect(supportsERC1155).to.be.true;

      log(`ERC1155 interface validated on ${chainName}`);
    }
  });
  
  it('should verify ERC165 supported interface for ERC20', async function () {
    for (const [chainName, provider] of chains.entries()) {
      log(`Validating ERC20 interface on chain: ${chainName}`);
      const chainInfo = {
        chainName: chainName,
        provider: provider,
      };
      const deployer = MultiChainTestDeployer.getInstance(chainInfo);

      // Retrieve the deployed GNUS Diamond contract
      const diamond = deployer.getDiamond();
      expect(diamond).to.not.be.null;
      
      const IERC20UpgradeableInterface = IERC20Upgradeable__factory.createInterface();

      // Generate the ERC20 interface ID by XORing with the base interface ID.
      const IERC20InterfaceID = getInterfaceID(IERC20UpgradeableInterface);
      
      // Assert that the `gnusDiamond` contract supports the ERC20 interface.
      assert(
        await diamond?.supportsInterface(IERC20InterfaceID._hex),
        "Doesn't support IERC20Upgradeable",
      );
      
      // Test ERC165 interface compatibility for ERC20 '0x37c8e2a0'
      const supportsERC20 = await diamond?.supportsInterface(IERC20InterfaceID._hex);
      expect(supportsERC20).to.be.true;

      log(`ERC20 interface validated on ${chainName}`);
    }
  });
  
  it('should verify that MINTER Role is set', async () => {
    for (const [chainName, provider] of chains.entries()) {
      console.log(`Validating ERC20 interface on chain: ${chainName}`);
      const chainInfo = {
        chainName: chainName,
        provider: provider,
      };
      // Retrieve the deployed GNUS Diamond contract
      const multichainDeployerInstance = MultiChainTestDeployer.getInstance(chainInfo);
      const diamond = multichainDeployerInstance.getDiamond();
      expect(diamond).to.not.be.null;
      
      // Check if the owner has the `MINTER_ROLE`, allowing them to mint tokens.
      const minterRole = await diamond?.MINTER_ROLE();
      const deployerAddress = await multichainDeployerInstance.getDeployInfo()?.DeployerAddress;
      expect(await diamond?.['hasRole(bytes32,address)'](minterRole!, deployerAddress!)).to.be.eq(true);
    }
  });
});
