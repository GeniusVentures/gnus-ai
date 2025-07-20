import { iObjToString } from '../../scripts/utils/iObjToString';
import { GNUS_TOKEN_ID } from '../../scripts/common';
import { debuglog } from 'util';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { logEvents } from '../../scripts/utils/logEvents';

import { debug } from 'debug';
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import { formatEther, id } from 'ethers';
import hre from 'hardhat';

// Create utils object for compatibility
const utils = { formatEther, id };

// Helper function to replace toBN - in ethers v6 we use BigInt directly
const toBN = (value: number | string) => BigInt(Math.floor(Number(value) * 1e18));
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { JsonRpcProvider } from 'ethers';
import { multichain } from 'hardhat-multichain';
import { toWei } from '../../scripts/utils/helpers';
import { LocalDiamondDeployer, LocalDiamondDeployerConfig } from '../../scripts/setup/LocalDiamondDeployer';
import { Diamond } from 'diamonds';
// import {
//   GeniusDiamond,
// } from '../../diamond-typechain-types';
import { Contract, BaseContract } from 'ethers';
import { loadDiamondContract } from '../../scripts/utils/loadDiamondArtifact';
import { Artifact } from 'hardhat/types';

chai.use(chaiAsPromised);

describe('GNUS Whitelist Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
      networkProviders.set('hardhat', ethers.provider as any);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    networkProviders.set('hardhat', ethers.provider as any);
  }

  for (const [networkName, provider] of networkProviders.entries()) {
    describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
      let snapshotId: string;
      let geniusDiamond: any;
      let diamond: Diamond;
      let owner: string;
      let signer1: string;
      let signer2: string;
      let signer3: string;
      let signers: SignerWithAddress[];
      let ownerSigner: SignerWithAddress;
      let signer1Diamond: any;
      let signer2Diamond: any;
      let signer3Diamond: any;
      let ownerDiamond: any;
      let ethersMultichain: typeof ethers;

      before(async () => {
        const config = {
          diamondName: diamondName,
          networkName: networkName,
          provider: provider,
          chainId: (await provider.getNetwork()).chainId,
          writeDeployedDiamondData: false,
          configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
        } as LocalDiamondDeployerConfig;
        const diamondDeployer = await LocalDiamondDeployer.getInstance(config);
        await diamondDeployer.setVerbose(true);
        diamond = await diamondDeployer.getDiamondDeployed();
        let deployedDiamondData = diamond.getDeployedDiamondData();

        // Load the Diamond contract using the utility function
        geniusDiamond = await loadDiamondContract(diamond, deployedDiamondData.DiamondAddress!);

        ethersMultichain = ethers;
        ethersMultichain.provider = provider as any;

        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer3 = signers[3].address;
        signer1Diamond = geniusDiamond.connect(signers[1]);
        signer2Diamond = geniusDiamond.connect(signers[2]);
        signer3Diamond = geniusDiamond.connect(signers[3]);

        // get the signer for the owner
        owner = diamond.getDeployedDiamondData().DeployerAddress || "";
        if (!owner) {
          diamond.setSigner(signers[0]);
          owner = signers[0].address;
        }
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = geniusDiamond.connect(ownerSigner);
      });

      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });

      afterEach(async () => {
        if (snapshotId) {
          await provider.send('evm_revert', [snapshotId]);
        }
      });

      describe('Whitelist Implementation', function () {
        it('should whitelist account using 2nd MSB', async () => {
          // First mint some tokens when whitelist is disabled
          await ownerDiamond['mint(address,uint256)'](signer1, toWei(1000));
          
          // Enable whitelist for testing
          await ownerDiamond.setWhitelistEnabled(true);
          
          // Initially not whitelisted
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.false;
          
          // Get initial balance - use the clean balance function
          const balance = await geniusDiamond['balanceOf(address)'](signer1);
          expect(balance).to.be.gt(0);
          
          // Try to mint to non-whitelisted account - should fail
          await expect(
            ownerDiamond['mint(address,uint256)'](signer1, toWei(100))
          ).to.be.revertedWith('GNUSBridge: recipient not whitelisted for bridge operations');
          
          // Whitelist the account
          const tx = await ownerDiamond.whitelistAccount(signer1);
          
          // Should now be whitelisted
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.true;
          
          // Mint should now work
          await ownerDiamond['mint(address,uint256)'](signer1, toWei(100));
          
          // Check that balance is correct (clean balance)
          const newBalance = await geniusDiamond['balanceOf(address)'](signer1);
          expect(newBalance).to.equal(balance + toWei(100));
          
          // Verify event was emitted
          await expect(tx).to.emit(geniusDiamond, 'AccountWhitelisted').withArgs(signer1);
        });

        it('should unwhitelist account using 2nd MSB', async () => {
          // Enable whitelist and whitelist the account
          await ownerDiamond.setWhitelistEnabled(true);
          await ownerDiamond.whitelistAccount(signer1);
          
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.true;
          
          // Unwhitelist the account
          const tx = await ownerDiamond.unwhitelistAccount(signer1);
          
          // Should no longer be whitelisted
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.false;
          
          // Mint should fail now
          await expect(
            ownerDiamond['mint(address,uint256)'](signer1, toWei(100))
          ).to.be.revertedWith('GNUSBridge: recipient not whitelisted for bridge operations');
          
          // Verify event was emitted
          await expect(tx).to.emit(geniusDiamond, 'AccountUnwhitelisted').withArgs(signer1);
        });

        it('should handle batch whitelist operations', async () => {
          await ownerDiamond.setWhitelistEnabled(true);
          
          const accounts = [signer1, signer2];
          
          // Initially not whitelisted
          for (const account of accounts) {
            expect(await geniusDiamond.isWhitelisted(account)).to.be.false;
          }
          
          // Batch whitelist
          await ownerDiamond.whitelistAccountsBatch(accounts);
          
          // Should all be whitelisted
          for (const account of accounts) {
            expect(await geniusDiamond.isWhitelisted(account)).to.be.true;
          }
          
          // Batch unwhitelist
          await ownerDiamond.unwhitelistAccountsBatch(accounts);
          
          // Should all be unwhitelisted
          for (const account of accounts) {
            expect(await geniusDiamond.isWhitelisted(account)).to.be.false;
          }
        });

        it('should enforce bridge operations when whitelist enabled', async () => {
          await ownerDiamond.setWhitelistEnabled(true);
          
          // Whitelist signer1 but not signer2
          await ownerDiamond.whitelistAccount(signer1);
          
          // Mint to whitelisted account should work
          await ownerDiamond['mint(address,uint256)'](signer1, toWei(100));
          
          // Mint to non-whitelisted account should fail
          await expect(
            ownerDiamond['mint(address,uint256)'](signer2, toWei(100))
          ).to.be.revertedWith('GNUSBridge: recipient not whitelisted for bridge operations');
          
          // Burn from whitelisted account should work
          await ownerDiamond['burn(address,uint256)'](signer1, toWei(50));
          
          // Try to burn from non-whitelisted account should fail
          await expect(
            ownerDiamond['burn(address,uint256)'](signer2, toWei(50))
          ).to.be.revertedWith('GNUSBridge: sender not whitelisted for bridge operations');
        });

        it('should not enforce whitelist when disabled', async () => {
          // Ensure whitelist is disabled
          await ownerDiamond.setWhitelistEnabled(false);
          
          // Should be able to mint to any account
          await ownerDiamond['mint(address,uint256)'](signer1, toWei(100));
          await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
          
          // Should be able to burn from any account
          await ownerDiamond['burn(address,uint256)'](signer1, toWei(50));
          await ownerDiamond['burn(address,uint256)'](signer2, toWei(50));
          
          // Balances should be readable
          expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, GNUS_TOKEN_ID)).to.be.gt(0);
          expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID)).to.be.gt(0);
        });

        it('should work with blacklist and whitelist together', async () => {
          await ownerDiamond.setWhitelistEnabled(true);
          
          // Whitelist account
          await ownerDiamond.whitelistAccount(signer1);
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.true;
          expect(await geniusDiamond.isBlacklisted(signer1)).to.be.false;
          
          // Should be able to mint
          await ownerDiamond['mint(address,uint256)'](signer1, toWei(100));
          
          // Now blacklist the same account
          await ownerDiamond.blacklistAccount(signer1);
          expect(await geniusDiamond.isBlacklisted(signer1)).to.be.true;
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.true; // Should still be whitelisted
          
          // Should not be able to mint (blacklist takes precedence)
          await expect(
            ownerDiamond['mint(address,uint256)'](signer1, toWei(100))
          ).to.be.revertedWith('Blacklisted: to address');
          
          // Balance should still show the actual balance (blacklist doesn't hide it)
          const cleanBalance = await geniusDiamond['balanceOf(address)'](signer1);
          expect(cleanBalance).to.be.gt(0);
          
          // Get account status
          const status = await geniusDiamond.getAccountStatus(signer1);
          expect(status.whitelisted).to.be.true;
          expect(status.blacklisted).to.be.true;
          expect(status.actualBalance).to.be.gt(0); // Has actual tokens
        });

        it('should preserve whitelist bit during blacklist operations', async () => {
          await ownerDiamond.setWhitelistEnabled(true);
          
          // Whitelist and mint
          await ownerDiamond.whitelistAccount(signer1);
          await ownerDiamond['mint(address,uint256)'](signer1, toWei(100));
          
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.true;
          
          // Blacklist account
          await ownerDiamond.blacklistAccount(signer1);
          
          // Should still be whitelisted
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.true;
          expect(await geniusDiamond.isBlacklisted(signer1)).to.be.true;
          
          // Unblacklist
          await ownerDiamond.unblacklistAccount(signer1);
          
          // Should still be whitelisted
          expect(await geniusDiamond.isWhitelisted(signer1)).to.be.true;
          expect(await geniusDiamond.isBlacklisted(signer1)).to.be.false;
        });

        it('should handle emergency balance operations', async () => {
          await ownerDiamond.setWhitelistEnabled(true);
          
          // First mint tokens when both whitelist and blacklist are not set
          await ownerDiamond.setWhitelistEnabled(false);
          await ownerDiamond['mint(address,uint256)'](signer1, toWei(100));
          
          // Now enable whitelist and set both bits for testing
          await ownerDiamond.setWhitelistEnabled(true);
          await ownerDiamond.whitelistAccount(signer1);
          await ownerDiamond.blacklistAccount(signer1);
          
          const status = await geniusDiamond.getAccountStatus(signer1);
          expect(status.whitelisted).to.be.true;
          expect(status.blacklisted).to.be.true;
          expect(status.actualBalance).to.be.gt(0);
          
          // Emergency fix to clean balance, maintaining whitelist status
          await ownerDiamond.emergencyFixBalanceWithWhitelist(signer1, status.actualBalance, false);
          
          const newStatus = await geniusDiamond.getAccountStatus(signer1);
          expect(newStatus.actualBalance).to.equal(status.actualBalance); // Balance preserved
          expect(newStatus.whitelisted).to.be.false; // maintainWhitelist = false
          expect(newStatus.blacklisted).to.be.true; // Blacklist status preserved
        });

        it('should enforce access control', async () => {
          // Non-admin should not be able to manage whitelist
          await expect(
            signer1Diamond.whitelistAccount(signer2)
          ).to.be.revertedWith('AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000');
          
          await expect(
            signer1Diamond.setWhitelistEnabled(true)
          ).to.be.revertedWith('AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000');
          
          await expect(
            signer1Diamond.whitelistAccountsBatch([signer2])
          ).to.be.revertedWith('AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000');
        });

        it('should emit events for whitelist operations', async () => {
          // Test AccountWhitelisted event
          await expect(ownerDiamond.whitelistAccount(signer1))
            .to.emit(geniusDiamond, 'AccountWhitelisted')
            .withArgs(signer1);
          
          // Test AccountUnwhitelisted event
          await expect(ownerDiamond.unwhitelistAccount(signer1))
            .to.emit(geniusDiamond, 'AccountUnwhitelisted')
            .withArgs(signer1);
          
          // Test WhitelistEnabledChanged event
          await expect(ownerDiamond.setWhitelistEnabled(true))
            .to.emit(geniusDiamond, 'WhitelistEnabledChanged')
            .withArgs(true);
        });

        it('should handle gas optimization for batch operations', async () => {
          const accounts = [signer1, signer2, signer3];
          
          // Test batch whitelist - should be more gas efficient than individual calls
          const tx = await ownerDiamond.whitelistAccountsBatch(accounts);
          const receipt = await tx.wait();
          console.log(`Batch whitelist gas used: ${receipt.gasUsed}`);
          
          // Verify all accounts are whitelisted
          for (const account of accounts) {
            expect(await geniusDiamond.isWhitelisted(account)).to.be.true;
          }
          
          // Test batch unwhitelist
          const tx2 = await ownerDiamond.unwhitelistAccountsBatch(accounts);
          const receipt2 = await tx2.wait();
          console.log(`Batch unwhitelist gas used: ${receipt2.gasUsed}`);
          
          // Verify all accounts are unwhitelisted
          for (const account of accounts) {
            expect(await geniusDiamond.isWhitelisted(account)).to.be.false;
          }
        });
      });
    });
  }
});
