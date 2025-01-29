import { expect, assert } from 'chai';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import ChainManager from '../setup/chainManager';
import { ethers } from 'hardhat';
import { debug } from 'debug';

// IERC20Upgradeable__factory
import { IERC20Upgradeable__factory } from '../../../../typechain-types';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';

describe('Multichain Integration Tests with Diamond Deployment', function () {
  const log: debug.Debugger = debug('GNUSDeploy:log');
  this.timeout(0); // Extend timeout to accommodate deployments

  let chains: Map<string, any>;

  before(async function () {
    // Setup chains based on command-line arguments
    const chainArgs = process.env.CHAINS?.split(',') || ['sepolia'];
    chains = await ChainManager.setupChains(chainArgs);

    // Deploy the diamond contracts on each chain
    for (const [chainName, provider] of chains.entries()) {
      ethers.provider = provider;
      const { chainId } = await provider.getNetwork();
      const deployConfig = {
        networkName: chainName,
        chainID: chainId,
        rpcURL: provider.connection.url,
      };
      const deployer = MultiChainTestDeployer.getInstance(deployConfig);
      // TODO The deployment status on a particular chain should be switch with the deployer
      // await deployer.deploy();
      await deployer.upgrade();
    }
  });

  after(function () {
    // Cleanup chain processes and deployment instances
    ChainManager.cleanup();
    MultiChainTestDeployer.cleanup();
  });

  it('should verify that chain providers are defined and have valid block numbers', async function () {
    for (const [chainName, provider] of chains.entries()) {
      log(`Checking chain provider for: ${chainName}`);
      expect(provider).to.not.be.undefined;

      ethers.provider = provider;
      const blockNumber = await ethers.provider.getBlockNumber();
      log(`Block number for ${chainName}: ${blockNumber}`);
      expect(blockNumber).to.be.a('number');
      expect(blockNumber).to.be.greaterThan(0);
    }
  });

  it('should verify the deployment of GNUS Diamond and validate interface compatibility', async function () {
    for (const [chainName, provider] of chains.entries()) {
      log(`Validating diamond deployment on chain: ${chainName}`);
      const deployConfig = {
        networkName: chainName,
        chainID: provider.network.chainId,
        rpcURL: provider.connection.url,
      };
      const deployer = MultiChainTestDeployer.getInstance(deployConfig);

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
      const deployConfig = {
        networkName: chainName,
        chainID: provider.network.chainId,
        rpcURL: provider.connection.url,
      };
      const deployer = MultiChainTestDeployer.getInstance(deployConfig);

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
      const deployConfig = {
        networkName: chainName,
        chainID: provider.network.chainId,
        rpcURL: provider.connection.url,
      };
      const deployer = MultiChainTestDeployer.getInstance(deployConfig);

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
  
  it('Testing MINTER Role is set', async () => {
    for (const [chainName, provider] of chains.entries()) {
      log(`Validating ERC20 interface on chain: ${chainName}`);
      const deployConfig = {
        networkName: chainName,
        chainID: provider.network.chainId,
        rpcURL: provider.connection.url,
      };
      // Retrieve the deployed GNUS Diamond contract
      const multichainDeployerInstance = MultiChainTestDeployer.getInstance(deployConfig);
      const diamond = multichainDeployerInstance.getDiamond();
      expect(diamond).to.not.be.null;
      const ownershipFacet = await ethers.getContractAt(
        'GeniusOwnershipFacet',
        diamond?.address ? diamond.address.toString() : '',
      );
      
      // Check if the owner has the `MINTER_ROLE`, allowing them to mint tokens.
      const minterRole = await diamond?.MINTER_ROLE();
      expect(await ownershipFacet.hasRole(minterRole, multichainDeployerInstance.getDeployInfo()?.DeployerAddress)).to.be.eq(true);
    }
  });

  it('should ensure that each chain object can be retrieved and reused', async function () {
    for (const [chainName, provider] of chains.entries()) {
      log(`Retrieving chain object for: ${chainName}`);
      const retrievedProvider = await ChainManager.getChain(chainName);
      expect(retrievedProvider).to.not.be.undefined;
      const providerConnectionUrl = provider.connection.url;
      const retrievedConnectionUrl = retrievedProvider.connection.url;
      expect(retrievedProvider.connection.url).to.equal(provider.connection.url);

      ethers.provider = retrievedProvider;
      const blockNumber = await ethers.provider.getBlockNumber();
      log(`Block number for retrieved ${chainName} provider: ${blockNumber}`);
      expect(blockNumber).to.be.a('number');
    }
  });
});
