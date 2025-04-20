import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import { utils } from 'ethers';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID, toWei } from '../utils/helpers';
import { Diamond, deleteDeployInfo } from '@gnus.ai/diamonds';
import { GeniusDiamond } from '../../typechain-types';
import { GNUS_TOKEN_ID } from '../../scripts/common';
import { debuglog } from 'util';
import { LocalDiamondDeployer } from '../setup/LocalDiamondDeployer';


describe('GNUS Bridge Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let chains = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
      chains.set('hardhat', ethers.provider);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    chains.set('hardhat', ethers.provider);
  }

  for (const [networkName, provider] of chains.entries()) {
    describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
      let diamond: Diamond;
      let signers: SignerWithAddress[];
      let signer0: string;
      let signer1: string;
      let signer2: string;
      let owner: string;
      let ownerSigner: SignerWithAddress;
      let geniusDiamond: GeniusDiamond;
      let signer0Diamond: GeniusDiamond;
      let signer1Diamond: GeniusDiamond;
      let signer2Diamond: GeniusDiamond;
      let ownerDiamond: GeniusDiamond;
      let erc1155ProxyOperator: GeniusDiamond;

      let ethersMultichain: typeof ethers;
      let snapshotId: string;

      before(async function () {
        const diamondDeployer = await LocalDiamondDeployer.getInstance(diamondName, networkName, provider);
        await diamondDeployer.setVerbose(true);
        diamond = await diamondDeployer.getDiamondDeployed();
        let deployedDiamondData = diamond.getDeployedDiamondData();

        const hardhatDiamondAbiPath = 'hardhat-diamond-abi/HardhatDiamondABI.sol:';
        const diamondArtifactName = `${hardhatDiamondAbiPath}${diamond.diamondName}`;
        geniusDiamond = await ethers.getContractAt(diamondArtifactName, deployedDiamondData.DiamondAddress!) as GeniusDiamond;
        ethersMultichain = ethers;
        ethersMultichain.provider = provider;

        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer0 = signers[0].address;
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer0Diamond = geniusDiamond.connect(signers[0]);
        signer1Diamond = geniusDiamond.connect(signers[1]);
        signer2Diamond = geniusDiamond.connect(signers[2]);

        // get the signer for the owner
        owner = deployedDiamondData.DeployerAddress;  //  this will be = signer0 for hardhat;
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = geniusDiamond.connect(ownerSigner);

        const ERC1155ProxyOperatorFactory = await ethers.getContractFactory('ERC1155ProxyOperator');
        // erc1155ProxyOperator = ERC1155ProxyOperatorFactory.attach(ownerDiamond.address);
        erc1155ProxyOperator = ownerDiamond;
      });

      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });

      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      // Validate the owner has the `MINTER_ROLE`
      it('should return true if owner has MINTER_ROLE', async () => {
        const minterRole = await ownerDiamond.MINTER_ROLE();
        const hasRole = await ownerDiamond.hasRole(minterRole, owner);
        expect(hasRole).to.be.true;
      });

      // Test case to validate the minting and burning functionality
      it('Testing Mint/Burn', async () => {
        // Retrieve the minter role
        const minterRole = await ownerDiamond.MINTER_ROLE();

        // Ensure a signer without the `MINTER_ROLE` cannot mint tokens
        await expect(
          signer2Diamond['mint(address,uint256)'](signer2, toWei(1)),
        ).to.be.revertedWith(
          `AccessControl: account ${signer2.toLowerCase()} is missing role ${minterRole}`,
        );

        // Ensure a signer without the `MINTER_ROLE` cannot burn tokens
        await expect(
          signer2Diamond['burn(address,uint256)'](signer0, toWei(1)),
        ).to.be.revertedWith(
          `AccessControl: account ${signer2.toLowerCase()} is missing role ${minterRole}`,
        );

        // Verify the initial token balance of a signer is zero
        let balance = await geniusDiamond['balanceOf(address)'](signer2);
        expect(balance).to.be.eq(toWei(0));

        // Mint tokens to the signer2's account and validate the updated balance
        await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
        balance = await geniusDiamond['balanceOf(address)'](signer2);
        expect(balance).to.be.eq(toWei(100));

        // Fetch the total supply of tokens
        const supply = await geniusDiamond['totalSupply()']();

        // Burn tokens from the signer's account and validate the supply reduction
        await ownerDiamond['burn(address,uint256)'](signer2, toWei(100));
        const supplyAfterBurned = await geniusDiamond['totalSupply()']();

        // Assert that the supply has decreased by the burned amount
        expect(supply.sub(supplyAfterBurned)).to.be.eq(toWei(100));

        // Verify the signer's balance is zero after burning
        balance = await geniusDiamond['balanceOf(address)'](signer2);
        expect(balance).to.be.eq(toWei(0));

        // Mint tokens again and validate that the total supply returns to its original value
        await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
        const supplyAfterMint = await geniusDiamond['totalSupply()']();
        expect(supplyAfterMint).to.be.eq(supply);

        // Attempt to burn tokens using the multi-dimensional burn function with invalid permissions
        await expect(
          geniusDiamond['burn(address,uint256,uint256)'](signer2, 0, toWei(100)),
        ).to.be.rejectedWith(Error, 'ERC1155: caller is not owner nor approved');

        // Burn tokens using the multi-dimensional burn function with the correct permissions
        await signer2Diamond['burn(address,uint256,uint256)'](signer2, toWei(0), toWei(100));

        // Verify the balance of the signer is zero after burning
        balance = await geniusDiamond['balanceOf(address)'](signer2);
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
        ).to.be.revertedWith('ERC20: decreased allowance below zero');
      });
    });
  }
});
