import { ethers } from 'hardhat';
import { expect, assert } from 'chai';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';
import { IERC20Upgradeable__factory, IERC165Upgradeable__factory, IERC1155Upgradeable__factory } from '../../../../typechain-types';
import { toWei } from '../../../../scripts/common';
import { deployments } from '../../../../scripts/deployments';
import { multichain } from 'hardhat-multichain';
import { debug } from 'debug';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Multichain GNUS ERC20 Hybrid Tests', async function () {
  this.timeout(0); // Extend timeout for deployments and testing
  const log: debug.Debugger = debug('GNUSDeploy:log');

  // Get the existing providers for each chain created by the Hardhat-Multichain 
  const chains = multichain.getProviders();
  
  for (const [chainName, provider] of chains.entries()) {
    
    describe(`GNUS ERC20 Hybrid Tests on ${chainName}`, async function () {
      let deployer: MultiChainTestDeployer;
      let deployment: boolean | void;
      let upgrade: boolean | void;
      let signers: SignerWithAddress[];
      let signer0: string;
      let signer1: string;
      let signer2: string;
      let signer0Diamond: GeniusDiamond;
      let signer1Diamond: GeniusDiamond;
      let signer2Diamond: GeniusDiamond;
      // get the signer for the owner
      let owner: string;
      let ownerSigner: SignerWithAddress;
      let ownerDiamond: GeniusDiamond;
      let gnusDiamond: GeniusDiamond;
      
      let ethersMultichain: typeof ethers;
      let snapshotId: string;
      
      before(async function () {
        const deployConfig = {
          chainName: chainName,
          provider: provider,
        };
        deployer = await MultiChainTestDeployer.getInstance(deployConfig);
        deployment = await deployer.deploy();
        expect(deployment).to.be.true;
        upgrade = await deployer.upgrade();
        expect(upgrade).to.be.true;
        // Retrieve the deployed GNUS Diamond contract
        gnusDiamond = await deployer.getDiamond();    
        if (!gnusDiamond) {
          throw new Error(`gnusDiamond is null for chain ${chainName}`);
        }
        
        ethersMultichain = ethers;
        ethersMultichain.provider = provider;
        
        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer0 = signers[0].address;
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer0Diamond = gnusDiamond.connect(signers[0]);
        signer1Diamond = gnusDiamond.connect(signers[1]);
        signer2Diamond = gnusDiamond.connect(signers[2]);
        
        // get the signer for the owner
        owner = deployments[chainName].DeployerAddress;
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = gnusDiamond.connect(ownerSigner);
        
      });
      
      // The snapshot ID to revert to the initial state after each test.
      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });
      
      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      it('should verify GNUS ERC20 interface compatibility on all chains', async function () {
        console.log(`Validating ERC20 interface on chain: ${chainName}`);

        const IERC20UpgradeableInterface = IERC20Upgradeable__factory.createInterface();
        // Generate the ERC20 interface ID by XORing with the base interface ID.
        const IERC20InterfaceID = getInterfaceID(IERC20UpgradeableInterface);
        // Assert that the `gnusDiamond` contract supports the ERC20 interface.
        assert(
          await gnusDiamond?.supportsInterface(IERC20InterfaceID._hex),
          "Doesn't support IERC20Upgradeable",
        );
        
        // Test ERC165 interface compatibility for ERC20 '0x37c8e2a0'
        const supportsERC20 = await gnusDiamond?.supportsInterface(IERC20InterfaceID._hex);
        expect(supportsERC20).to.be.true;

        console.log(`ERC20 interface validated on ${chainName}`);
      });

      it('should verify MINTER role is set for the owner on all chains', async function () {
        console.log(`Verifying MINTER role on chain: ${chainName}`);

        const ownershipFacet = await ethersMultichain.getContractAt('GeniusOwnershipFacet', gnusDiamond.address);
        const minterRole = await gnusDiamond['MINTER_ROLE']();
        const deployerAddress = deployments[chainName].DeployerAddress;
        const owner = await ownershipFacet.owner();
        const hasMinterRole = await ownershipFacet.hasRole(minterRole, deployerAddress);
        expect(hasMinterRole).to.be.true;
      });

      it('should mint and transfer GNUS tokens correctly on all chains', async function () {
        console.log(`Testing mint and transfer on chain: ${chainName}`);
        

        // Mint GNUS tokens
        await ownerDiamond['mint(address,uint256)'](owner, toWei(150));
        const updatedOwnerBalance = await gnusDiamond['balanceOf(address)'](owner);
        expect(updatedOwnerBalance.eq(toWei(150))).to.be.true;

        // Transfer GNUS tokens
        await ownerDiamond.transfer(signer2, toWei(150));
        const recipientBalance = await ownerDiamond['balanceOf(address)'](signer2);
        expect(recipientBalance.eq(toWei(150))).to.be.true;
      });

      it('should handle transferFrom and approval correctly on all chains', async function () {
        console.log(`Testing transferFrom and approval on chain: ${chainName}`);
        // transferFrom expect to fail because signer2 trying to transferFrom without approval
        await expect(signer2Diamond.transferFrom(signer1, signer0, toWei(150))).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);
        
        // Mint GNUS tokens to signer2    
        await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
        // Signer2 Approves transferFrom by owner
        await signer2Diamond.approve(owner, toWei(10));
        // Owner transfers GNUS tokens from signer2 to signer0
        await expect(ownerDiamond.transferFrom(signer2, signer0, toWei(10))
          ).to.eventually.be.fulfilled;
                
        // Attempt transfer beyond allowance
        await expect(ownerDiamond.transferFrom(signer2, signer0, toWei(200))
          ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);
        
        // setApprovalForAll is for 1155 and 721 tokens so it should fail.  Probably unnecessary test
        await signer2Diamond.setApprovalForAll(owner, true);
        
        // Transfer all tokens
        await expect(ownerDiamond.transferFrom(signer2, signer0, toWei(90))
          ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);
      });
    });
  }
});
