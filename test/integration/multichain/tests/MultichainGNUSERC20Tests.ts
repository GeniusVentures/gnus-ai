import { ethers } from 'hardhat';
import { expect } from 'chai';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import ChainManager from '../setup/chainManager';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';
import { IERC20Upgradeable__factory, IERC165Upgradeable__factory, IERC1155Upgradeable__factory } from '../../../../typechain-types';
import { toWei } from '../../../../scripts/common';
import { deployments } from '../../../../scripts/deployments';

describe('Multichain GNUS ERC20 Hybrid Tests', function () {
  this.timeout(0); // Extend timeout for deployments and testing

  let chains: Map<string, any>;
  const diamonds: Map<string, GeniusDiamond> = new Map();

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

      const multichainDeployer = MultiChainTestDeployer.getInstance(deployConfig);
      // await multichainDeployer.deploy();
      await multichainDeployer.upgrade();

      // Store the deployed diamond for reuse in tests
      const diamond = multichainDeployer.getDiamond();
      expect(diamond).to.not.be.null;
      diamonds.set(chainName, diamond!);
      // deploymentInfo.set(chainName, deployments[chainName]);
    }
  });

  after(function () {
    // Cleanup chain processes and deployment instances
    ChainManager.cleanup();
    MultiChainTestDeployer.cleanup();
  });

  it('should verify GNUS ERC20 interface compatibility on all chains', async function () {
    for (const [chainName, diamond] of diamonds.entries()) {
      let provider = chains.get(chainName);
      ethers.provider = provider;
      console.log(`Verifying ERC20 interface on chain: ${chainName}`);
      const IERC165Interface = IERC165Upgradeable__factory.createInterface();
      const IERC165InterfaceID = getInterfaceID(IERC165Interface);
      const IERC20Interface = IERC20Upgradeable__factory.createInterface();
      const IERC20InterfaceID = getInterfaceID(IERC20Interface).xor(IERC165InterfaceID);
      const supportsERC20 = await diamond.supportsInterface(IERC20InterfaceID._hex);
      expect(supportsERC20).to.be.true;
    }
  });

  // it('should verify MINTER role is set for the owner on all chains', async function () {
  //   for (const [chainName, diamond] of diamonds.entries()) {
  //     let provider = chains.get(chainName);
  //     ethers.provider = provider;
  //     console.log(`Verifying MINTER role on chain: ${chainName}`);
  //     const ownershipFacet = await ethers.getContractAt('GeniusOwnershipFacet', diamond.address);
  //     const minterRole = await diamond['MINTER_ROLE']();
  //     const deployerAddress = deployments[chainName].DeployerAddress;
  //     const owner = await ownershipFacet.owner();
  //     const hasMinterRole = await ownershipFacet.hasRole(minterRole, deployerAddress);
  //     expect(hasMinterRole).to.be.true;
  //   }
  // });

  // it('should mint and transfer GNUS tokens correctly on all chains', async function () {
  //   for (const [chainName, diamond] of diamonds.entries()) {
  //     console.log(`Testing mint and transfer on chain: ${chainName}`);
  //     const signers = await ethers.getSigners();
  //     const owner = signers[0].address;

  //     // Mint GNUS tokens
  //     await diamond['mint(address,uint256)'](owner, toWei(150));
  //     const updatedOwnerBalance = await diamond['balanceOf(address)'](owner);
  //     expect(updatedOwnerBalance.eq(toWei(150))).to.be.true;

  //     // Transfer GNUS tokens
  //     await diamond.transfer(signers[3].address, toWei(150));
  //     const recipientBalance = await diamond['balanceOf(address)'](signers[3].address);
  //     expect(recipientBalance.eq(toWei(150))).to.be.true;
  //   }
  // });

  // it('should handle transferFrom and approval correctly on all chains', async function () {
  //   for (const [chainName, diamond] of diamonds.entries()) {
  //     console.log(`Testing transferFrom and approval on chain: ${chainName}`);
  //     const signers = await ethers.getSigners();

  //     // Mint GNUS tokens
  //     await diamond['mint(address,uint256)'](signers[3].address, toWei(150));

  //     // Approve transfer
  //     const gnusForSigner3 = await diamond.connect(signers[3]);
  //     await gnusForSigner3.approve(signers[0].address, toWei(50));

  //     // Check transferFrom
  //     const gnusForSigner4 = await diamond.connect(signers[4]);
  //     await expect(
  //       gnusForSigner4.transferFrom(signers[3].address, signers[0].address, toWei(50))
  //     ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);

  //     // Transfer GNUS tokens
  //     await diamond.transferFrom(signers[3].address, signers[4].address, toWei(25));
  //     await diamond.transferFrom(signers[3].address, signers[0].address, toWei(25));

  //     // Attempt transfer beyond allowance
  //     await expect(
  //       diamond.transferFrom(signers[3].address, signers[0].address, toWei(1))
  //     ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);

  //     // Approve all tokens
  //     await gnusForSigner3.setApprovalForAll(signers[0].address, true);
  //   }
  // });
});
