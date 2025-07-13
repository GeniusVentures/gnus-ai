import { debuglog } from 'util';
import { GNUS_TOKEN_ID } from '../../scripts/common';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { logEvents } from '../../scripts/utils/logEvents';

import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import { formatEther } from 'ethers';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { JsonRpcProvider } from 'ethers';
import { multichain } from 'hardhat-multichain';
import { toWei } from '../../scripts/utils/helpers';
import { LocalDiamondDeployer, LocalDiamondDeployerConfig } from '../../scripts/setup/LocalDiamondDeployer';
import { Diamond } from 'diamonds';
import {
  GeniusDiamondABI,
} from '../../typechain-types/diamond-abi';
import { config } from 'dotenv';

// Create utils object for compatibility
const utils = { formatEther };

chai.use(chaiAsPromised);

describe('NFT Factory Tests', async function () {
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
      let diamond: Diamond;
      let signers: SignerWithAddress[];
      let signer0: string;
      let signer1: string;
      let signer2: string;
      let owner: string;
      let ownerSigner: SignerWithAddress;
      let geniusDiamond: GeniusDiamondABI;
      let signer0Diamond: GeniusDiamondABI;
      let signer1Diamond: GeniusDiamondABI;
      let signer2Diamond: GeniusDiamondABI;
      let ownerDiamond: GeniusDiamondABI;

      let ethersMultichain: typeof ethers;
      let snapshotId: string;

      let erc1155ProxyOperator: GeniusDiamondABI;

      before(async function () {
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

        // Try to get the diamond artifact - if it doesn't exist, use ERC20TransferBatch fallback
        try {
          const diamondAbiPath = 'diamond-abi';
          const diamondArtifactName = `${diamondAbiPath}/${diamond.diamondName}`;
          geniusDiamond = await ethers.getContractAt(diamondArtifactName, deployedDiamondData.DiamondAddress!) as unknown as GeniusDiamondABI;
        } catch (error) {
          console.warn(`Warning: Could not find hardhat-diamond-abi artifact for ${diamond.diamondName}, using ERC20TransferBatch`);
          // Fallback to using ERC20TransferBatch which has ERC20 transfer methods
          geniusDiamond = await ethers.getContractAt('ERC20TransferBatch', deployedDiamondData.DiamondAddress!) as unknown as GeniusDiamondABI;
        }

        ethersMultichain = ethers;
        ethersMultichain.provider = provider as any;

        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer0 = signers[0].address;
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer0Diamond = geniusDiamond.connect(signers[0]);
        signer1Diamond = geniusDiamond.connect(signers[1]);
        signer2Diamond = geniusDiamond.connect(signers[2]);

        // get the signer for the owner
        owner = diamond.getDeployedDiamondData().DeployerAddress || "";
        if (!owner) {
          diamond.setSigner(signers[0]);
          owner = signer0;
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

      it('Batch Transferring to two addresses', async () => {
        // Fetch the owner's balance.
        // This may be non-zero on forked chains so comparisons must take this into account.
        let initBalance = await (await geniusDiamond['balanceOf(address,uint256)']
          (owner, GNUS_TOKEN_ID));
        const preTransferBalance0 = await geniusDiamond['balanceOf(address,uint256)'](
          signer2,
          GNUS_TOKEN_ID,
        );
        const preTransferBalance1 = await geniusDiamond['balanceOf(address,uint256)'](
          signer1,
          GNUS_TOKEN_ID,
        );
        // Test case to verify batch transfers of ERC20 tokens.
        let balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID));
        debuglog(`Owner balance before transfer1: ${balance.toString()}`);
        // Mint 150 GNUS tokens to the owner’s address and verify the updated balance.
        await ownerDiamond['mint(address,uint256)'](owner, toWei(150));
        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID));
        debuglog(`Owner balance after transfer2: ${balance.toString()}`);
        // Execute a batch transfer to `signer2` and `signer1` with specified token amounts.
        await ownerDiamond.transferBatch(
          [signer2, signer1],
          [toWei(2), toWei(1)],
        );

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID));
        debuglog(`Owner balance3: ${balance.toString()}`);
        // Retrieve updated balances for `signer2` and `signer1`.
        const updatedAmount1 = await geniusDiamond['balanceOf(address,uint256)'](
          signer2,
          GNUS_TOKEN_ID,
        );
        const updatedAmount2 = await geniusDiamond['balanceOf(address,uint256)'](
          signer1,
          GNUS_TOKEN_ID,
        );

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID));
        debuglog(`Owner balance4: ${balance.toString()}`);
        // Assert that the updated balances match the expected values after the transfer.
        assert(
          updatedAmount1 === (toWei(2) + preTransferBalance1),
          `Address 1 should equal ${utils.formatEther(
            toWei(2) + preTransferBalance1,
          )}, but equals ${utils.formatEther(updatedAmount1)}`,
        );

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID));
        debuglog(`Owner balance5: ${balance.toString()}`);
        assert(
          updatedAmount2 === (toWei(1) + preTransferBalance1),
          `Address 2 should equal ${utils.formatEther(
            toWei(1) + preTransferBalance1,
          )}, but equals ${utils.formatEther(updatedAmount2)}`,
        );

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID));
        debuglog(`Owner balance6: ${balance.toString()}`);
      });

      // Test case to verify the blocking and unblocking of transfers.
      it(`should verify the blocking and unblocking of transfers on ${networkName}`, async () => {
        // Fetch the owner's balance and mint additional tokens to the owner's account.
        let initBalance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID));
        debuglog(`Owner balance before transfer: ${initBalance.toString()}`);

        await ownerDiamond['mint(address,uint256)'](owner, toWei(100));
        let balance = await (await geniusDiamond['balanceOf(address)'](owner));
        let expectedBalance = initBalance + toWei(100);
        debuglog(`Owner balance after transfer of ${expectedBalance}: ${balance.toString()}`);
        debuglog(`Expected balance: ${expectedBalance.toString()}`);

        // Assert that the owner's balance exceeds 100 after minting.
        expect(balance).to.be.eq(expectedBalance);

        // Transfer tokens to `signer2` and verify their balance.
        let receiverBalance = await (await geniusDiamond['balanceOf(address)'](signer2));
        await ownerDiamond.transfer(signer2, toWei(10));
        receiverBalance = await (await geniusDiamond['balanceOf(address)'](signer2));
        expectedBalance = toWei(10);
        // Expect the receiver's balance to match the transferred amount.
        expect(receiverBalance).to.be.eq(expectedBalance);

        // Block the owner from transferring tokens and verify the restriction.
        await ownerDiamond.banTransferorForAll(signer2);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.rejectedWith(
          Error,
          'Blocked transferor',
        );

        // Unblock the owner and retry the transfer.
        await ownerDiamond.allowTransferorForAll(signer2);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.fulfilled;

        // Block the owner using a batch transfer restriction and verify.
        await ownerDiamond.banTransferorBatch([0], [signer2]);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.rejectedWith(
          Error,
          'Blocked transferor',
        );

        // Remove the batch restriction and verify successful transfer.
        await ownerDiamond.allowTransferorBatch([0], [signer2]);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.fulfilled;

      });
    });
  }
});
