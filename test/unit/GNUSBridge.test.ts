import { debug } from 'debug';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import {debuglog,toWei,} from '../../scripts/common';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import { deployments } from '../../scripts/deployments';
import { GeniusDiamond } from '../../typechain-types/GeniusDiamond';

describe('GNUS Bridge Tests', async function () {
  const log: debug.Debugger = debug('GNUSDeploy:log');
  this.timeout(0); // Extend timeout to accommodate deployments
  
  let chains = multichain.getProviders() ?? new Map<string, JsonRpcProvider>();
  
  // Check the process.argv for the Hardhat network name
  if (process.argv.includes('test-multichain')) {
    const chainNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (chainNames.includes('hardhat')) {
      chains = chains.set('hardhat', ethers.provider);
      
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    chains = chains.set('hardhat', ethers.provider);
  }
  
  for (const [chainName, provider] of chains.entries()) { 
  
    describe(`${chainName} GNUS Bridge Tests`, async function () {
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
        owner = deployments[chainName]?.DeployerAddress || signer0;
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = gnusDiamond.connect(ownerSigner);
        
      });
      
      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });
        
      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      // Test case to validate the minting and burning functionality
      it('Testing Mint/Burn', async () => {
        // Retrieve the minter role
        const minterRole = await ownerDiamond.MINTER_ROLE();
        
        // Ensure a signer without the `MINTER_ROLE` cannot mint tokens
        await expect(
          signer2Diamond['mint(address,uint256)'](signer2, toWei(1)),
        ).to.be.rejectedWith(
          Error,
          `AccessControl: account ${signer2.toLowerCase()} is missing role ${minterRole}`,
        );

        // Ensure a signer without the `MINTER_ROLE` cannot burn tokens
        await expect(
          signer2Diamond['burn(address,uint256)'](signer0, toWei(1)),
        ).to.be.rejectedWith(
          Error,
          `AccessControl: account ${signer2.toLowerCase()} is missing role ${minterRole}`,
        );

        // Verify the initial token balance of a signer is zero
        let balance = await gnusDiamond['balanceOf(address)'](signer2);
        expect(balance).to.be.eq(toWei(0));

        // Mint tokens to the signer's account and validate the updated balance
        await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
        balance = await gnusDiamond['balanceOf(address)'](signer2);
        expect(balance).to.be.eq(toWei(100));

        // Fetch the total supply of tokens
        const supply = await gnusDiamond['totalSupply()']();

        // Burn tokens from the signer's account and validate the supply reduction
        await ownerDiamond['burn(address,uint256)'](signer2, toWei(100));
        const supplyAfterBurned = await gnusDiamond['totalSupply()']();

        // Assert that the supply has decreased by the burned amount
        expect(supply.sub(supplyAfterBurned)).to.be.eq(toWei(100));

        // Verify the signer's balance is zero after burning
        balance = await gnusDiamond['balanceOf(address)'](signer2);
        expect(balance).to.be.eq(toWei(0));

        // Mint tokens again and validate that the total supply returns to its original value
        await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
        const supplyAfterMint = await gnusDiamond['totalSupply()']();
        expect(supplyAfterMint).to.be.eq(supply);

        // Attempt to burn tokens using the multi-dimensional burn function with invalid permissions
        await expect(
          gnusDiamond['burn(address,uint256,uint256)'](signer2, 0, toWei(100)),
        ).to.be.rejectedWith(Error, 'ERC1155: caller is not owner nor approved');

        // Burn tokens using the multi-dimensional burn function with the correct permissions
        await signer2Diamond['burn(address,uint256,uint256)'](signer2, toWei(0), toWei(100));

        // Verify the balance of the signer is zero after burning
        balance = await gnusDiamond['balanceOf(address)'](signer2);
        expect(balance).to.be.eq(toWei(0));
      });
      
      // Test case to validate the decreaseAllowance functionality
      it('Testing Decrease Allowance', async () => {
        // Verify the initial allowance of the owner to the signer is zero
        let allowance = await ownerDiamond.allowance(owner, signer2);
        expect(allowance).to.be.eq(toWei(0));

        // Increase the allowance of the owner to the signer
        await ownerDiamond.approve(signer2, toWei(100));

        // Validate the updated allowance
        allowance = await ownerDiamond.allowance(owner, signer2);
        expect(allowance).to.be.eq(toWei(100));

        // Decrease the allowance of the owner to the signer
        await ownerDiamond.decreaseAllowance(signer2, toWei(50));

        // Validate the updated allowance
        allowance = await ownerDiamond.allowance(owner, signer2);
        expect(allowance).to.be.eq(toWei(50));

        // Attempt to decrease the allowance of the owner to the signer with insufficient funds
        await expect(
          ownerDiamond.decreaseAllowance(signer2, toWei(100)),
        ).to.be.rejectedWith(Error, 'ERC20: decreased allowance below zero');
      });
    });
  } 
});
