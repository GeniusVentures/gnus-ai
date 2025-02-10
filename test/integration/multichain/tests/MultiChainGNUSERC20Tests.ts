import { ethers } from 'hardhat';
import { expect } from 'chai';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import ChainManager from '../setup/chainManager';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';
import { IERC20Upgradeable__factory, IERC165Upgradeable__factory, IERC1155Upgradeable__factory } from '../../../../typechain-types';
import { toWei } from '../../../../scripts/common';
import { deployments } from '../../../../scripts/deployments';
import { multichain } from 'hardhat-multichain';

describe('Multichain GNUS ERC20 Hybrid Tests', function () {
  this.timeout(0); // Extend timeout for deployments and testing

  const diamonds: Map<string, GeniusDiamond> = new Map();
  const chains = multichain.getProviders();


  before(async function () {

    // TODO: This should be moved to a separate script with a multiton pattern so it is not repeated for a single chain over various tests
    // Deploy the diamond contracts on each chain
    for (const [chainName, provider] of chains.entries()) {
      // TODO Replace with Hardhat-Multichain types
      // ethers.provider = provider;
      const { chainId } = await provider.getNetwork();
      const deployConfig = {
        networkName: chainName,
        chainID: chainId,
        provider: provider,
      };
      const deployer = MultiChainTestDeployer.getInstance(deployConfig);
      // TODO The deployment status on a particular chain should be switch with the deployer
      // await deployer.deploy();
      await deployer.upgrade();
    }
  });

  it('should verify GNUS ERC20 interface compatibility on all chains', async function () {
    for (const [chainName, diamond] of diamonds.entries()) {
      let provider = chains.get(chainName);
      console.log(`Verifying ERC20 interface on chain: ${chainName}`);
      const IERC165Interface = IERC165Upgradeable__factory.createInterface();
      const IERC165InterfaceID = getInterfaceID(IERC165Interface);
      const IERC20Interface = IERC20Upgradeable__factory.createInterface();
      const IERC20InterfaceID = getInterfaceID(IERC20Interface).xor(IERC165InterfaceID);
      const supportsERC20 = await diamond.supportsInterface(IERC20InterfaceID._hex);
      expect(supportsERC20).to.be.true;
    }
  });

  it('should verify MINTER role is set for the owner on all chains', async function () {
    for (const [chainName, diamond] of diamonds.entries()) {
      let provider = chains.get(chainName);
      console.log(`Verifying MINTER role on chain: ${chainName}`);
      // const ethersProvider = new ethers.providers.JsonRpcProvider(provider?.connection.url);
      const ethersLocal = require('ethers').ether;
      ethersLocal.provider = provider;
      const ownershipFacet = await ethersLocal.getContractAt('GeniusOwnershipFacet', diamond.address);
      const minterRole = await diamond['MINTER_ROLE']();
      const deployerAddress = deployments[chainName].DeployerAddress;
      const owner = await ownershipFacet.owner();
      const hasMinterRole = await ownershipFacet.hasRole(minterRole, deployerAddress);
      expect(hasMinterRole).to.be.true;
    }
  });

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
