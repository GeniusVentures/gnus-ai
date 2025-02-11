import { ethers } from 'hardhat';
import { expect, assert } from 'chai';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import ChainManager from '../setup/chainManager';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';
import { IERC20Upgradeable__factory, IERC165Upgradeable__factory, IERC1155Upgradeable__factory } from '../../../../typechain-types';
import { toWei } from '../../../../scripts/common';
import { deployments } from '../../../../scripts/deployments';
import { multichain } from 'hardhat-multichain';
import { debug } from 'debug';

describe('Multichain GNUS ERC20 Hybrid Tests', function () {
  this.timeout(0); // Extend timeout for deployments and testing

  const diamonds: Map<string, GeniusDiamond> = new Map();
  const chains = multichain.getProviders();
  const ethersMultichain = ethers;
  const snapshots: Map<string, string> = new Map();
  

  before(async function () {
    const log: debug.Debugger = debug('GNUSDeploy:log');
    // Deploy the diamond contracts on each chain
    for (const [chainName, provider] of chains.entries()) {
      // TODO: Add the default hardhat network to the chain manager 
      const { chainId } = await provider.getNetwork();
      const deployConfig = {
        chainName: chainName,
        provider: provider,
      };
      const deployer = MultiChainTestDeployer.getInstance(deployConfig);
      await deployer.deploy();
      await deployer.upgrade();
      // Retrieve the deployed GNUS Diamond contract
      const diamond = deployer.getDiamond();
      if (diamond) {
        // Add the diamond to the map
        diamonds.set(chainName, diamond);
      } else {
        throw new Error(`Failed to retrieve diamond on chain ${chainName}`);
      }
    }
  });  
    
  // The snapshot ID to revert to the initial state after each test.
  let snapshotId: string;
  
  beforeEach(async () => {
    // Take a snapshot of each chain before each test
    for (const [chainName, provider] of chains.entries()) {
      snapshotId = await provider.send('evm_snapshot', []);
      snapshots.set(chainName, snapshotId);
    }
  });
    
  afterEach(async () => {
    for (const [chainName, provider] of chains.entries()) {
      snapshotId = snapshots.get(chainName) as string;
      await provider.send("evm_revert", [snapshotId]);
    }
  });

  it('should verify GNUS ERC20 interface compatibility on all chains', async function () {
    for (const [chainName, provider] of chains.entries()) {
      console.log(`Validating ERC20 interface on chain: ${chainName}`);
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

      console.log(`ERC20 interface validated on ${chainName}`);
    }
  });

  it('should verify MINTER role is set for the owner on all chains', async function () {
    for (const [chainName, diamond] of diamonds.entries()) {
      let provider = chains.get(chainName);
      console.log(`Verifying MINTER role on chain: ${chainName}`);
      if (provider) {
        ethersMultichain.provider = provider;
      } else {
        throw new Error(`Provider for chain ${chainName} is undefined`);
      }
      const ownershipFacet = await ethersMultichain.getContractAt('GeniusOwnershipFacet', diamond.address);
      const minterRole = await diamond['MINTER_ROLE']();
      const deployerAddress = deployments[chainName].DeployerAddress;
      const owner = await ownershipFacet.owner();
      const hasMinterRole = await ownershipFacet.hasRole(minterRole, deployerAddress);
      expect(hasMinterRole).to.be.true;
    }
  });

  it('should mint and transfer GNUS tokens correctly on all chains', async function () {
    for (const [chainName, diamond] of diamonds.entries()) {
      console.log(`Testing mint and transfer on chain: ${chainName}`);
      let provider = chains.get(chainName);
      if (provider) {
        ethersMultichain.provider = provider;
      } else {
        throw new Error(`Provider for chain ${chainName} is undefined`);
      }
      const signers = await ethersMultichain.getSigners();
      const owner = deployments[chainName].DeployerAddress;
      
      // get the signer for the owner
      const ownerSigner = ethersMultichain.provider.getSigner(owner);
      
      // Retrieve the owner's balance, which should be zero initially.
      let ownerSupply = await diamond['balanceOf(address)'](owner);

      // Mint GNUS tokens
      const result = await diamond.connect(ownerSigner)['mint(address,uint256)'](owner, toWei(150));
      const updatedOwnerBalance = await diamond['balanceOf(address)'](owner);
      expect(updatedOwnerBalance.eq(toWei(150))).to.be.true;

      // Transfer GNUS tokens
      await diamond.connect(ownerSigner).transfer(signers[3].address, toWei(150));
      const recipientBalance = await diamond.connect(ownerSigner)['balanceOf(address)'](signers[3].address);
      expect(recipientBalance.eq(toWei(150))).to.be.true;
    }
  });

  it('should handle transferFrom and approval correctly on all chains', async function () {
    for (const [chainName, diamond] of diamonds.entries()) {
      console.log(`Testing transferFrom and approval on chain: ${chainName}`);
      let provider = chains.get(chainName);
      if (provider) {
        ethersMultichain.provider = provider;
      } else {
        throw new Error(`Provider for chain ${chainName} is undefined`);
      }
      const signers = await ethersMultichain.getSigners();
      
      // get the signer for the owner
      const owner = deployments[chainName].DeployerAddress;
      const ownerSigner = ethersMultichain.provider.getSigner(owner);
      
      // // Check balances (used for debugging)
      // let ownerBalance = (await diamond['balanceOf(address)'](owner)).toString();
      // let signer0Balance = (await diamond['balanceOf(address)'](signers[0].address)).toString();
      // let signer3Balance = (await diamond['balanceOf(address)'](signers[3].address)).toString();
      // let signer4Balance = (await diamond['balanceOf(address)'](signers[4].address)).toString();

      // Owner Mints GNUS tokens into signer3 account
      await diamond.connect(ownerSigner)['mint(address,uint256)'](signers[3].address, toWei(100));
            
      // Check transferFrom expect to fail because signer4 trying to transfer for signer3
      const gnusForSigner4 = await diamond.connect(signers[4]);
      await expect(
        gnusForSigner4.transferFrom(signers[3].address, signers[0].address, toWei(150))
      ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);
      
            // Check balances (used for debugging)
      let ownerBalance = (await diamond['balanceOf(address)'](owner)).toString();
      let signer0Balance = (await diamond['balanceOf(address)'](signers[0].address)).toString();
      let signer3Balance = (await diamond['balanceOf(address)'](signers[3].address)).toString();
      let signer4Balance = (await diamond['balanceOf(address)'](signers[4].address)).toString();
      
      const gnusForOwner = await diamond.connect(ownerSigner);
      // Signer3 Approves transferFrom by owner
      const gnusForSigner3 = await diamond.connect(signers[3]);
      await gnusForSigner3.approve(owner, toWei(10));
      // Transfer GNUS tokens
      await expect(
         gnusForOwner.transferFrom(signers[3].address, signers[0].address, toWei(10))
         ).to.eventually.be.fulfilled;
               
      // Attempt transfer beyond allowance
      await expect(
        gnusForOwner.transferFrom(signers[3].address, signers[0].address, toWei(200))
      ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);
      
      
            // Check balances (used for debugging)
      ownerBalance = (await diamond['balanceOf(address)'](owner)).toString();
      signer0Balance = (await diamond['balanceOf(address)'](signers[0].address)).toString();
      signer3Balance = (await diamond['balanceOf(address)'](signers[3].address)).toString();
      signer4Balance = (await diamond['balanceOf(address)'](signers[4].address)).toString();
      
      // setApprovalForAll is for 1155 and 721 tokens so it should fail.  Probably unnecessary test
      await gnusForSigner3.setApprovalForAll(owner, true);
      
      // Transfer all tokens
      await expect(
        gnusForOwner.transferFrom(signers[3].address, signers[0].address, toWei(90))
        ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);
    }
  });
});
