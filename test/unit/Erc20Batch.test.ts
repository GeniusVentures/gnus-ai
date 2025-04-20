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
import { GeniusDiamond, IERC20Upgradeable__factory } from '../../typechain-types';
import { GNUS_TOKEN_ID } from '../../scripts/common';
import { debuglog } from 'util';
import { LocalDiamondDeployer } from '../setup/LocalDiamondDeployer';

describe('ERC20 Batch Transfer Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let chains = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const chainNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (chainNames.includes('hardhat')) {
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
      });

      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });

      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      it('Batch Transferring to two addresses', async () => {
        // Fetch the owner's balance.
        // This may be non-zero on forked chains so comparisons must take this into account.
        let initBalance = await (await geniusDiamond['balanceOf(address,uint256)']
          (owner, GNUS_TOKEN_ID)).toBigInt();
        const preTransferBalance0 = await geniusDiamond['balanceOf(address,uint256)'](
          signer2,
          GNUS_TOKEN_ID,
        );
        const preTransferBalance1 = await geniusDiamond['balanceOf(address,uint256)'](
          signer1,
          GNUS_TOKEN_ID,
        );
        // Test case to verify batch transfers of ERC20 tokens.
        let balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance before transfer1: ${balance.toString()}`);
        // Mint 150 GNUS tokens to the owner’s address and verify the updated balance.
        await ownerDiamond['mint(address,uint256)'](owner, toWei(150));
        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance after transfer2: ${balance.toString()}`);
        // Execute a batch transfer to `signer2` and `signer1` with specified token amounts.
        await ownerDiamond.transferBatch(
          [signer2, signer1],
          [toWei(2), toWei(1)],
        );

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
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

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance4: ${balance.toString()}`);
        // Assert that the updated balances match the expected values after the transfer.
        assert(
          updatedAmount1.eq(toWei(2).add(preTransferBalance1)),
          `Address 1 should equal ${utils.formatEther(
            toWei(2).add(preTransferBalance1),
          )}, but equals ${utils.formatEther(updatedAmount1)}`,
        );

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance5: ${balance.toString()}`);
        assert(
          updatedAmount2.eq(toWei(1).add(preTransferBalance1)),
          `Address 2 should equal ${utils.formatEther(
            toWei(1).add(preTransferBalance1),
          )}, but equals ${utils.formatEther(updatedAmount2)}`,
        );

        balance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance6: ${balance.toString()}`);
      });

      // Test case to verify the blocking and unblocking of transfers.
      it(`should verify the blocking and unblocking of transfers on ${networkName}`, async () => {
        // Fetch the owner's balance and mint additional tokens to the owner's account.
        let initBalance = await (await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance before transfer: ${initBalance.toString()}`);

        await ownerDiamond['mint(address,uint256)'](owner, toWei(100));
        let balance = await (await geniusDiamond['balanceOf(address)'](owner)).toBigInt();
        let expectedBalance = initBalance + toWei(100).toBigInt();
        debuglog(`Owner balance after transfer of ${expectedBalance}: ${balance.toString()}`);
        debuglog(`Expected balance: ${expectedBalance.toString()}`);

        // Assert that the owner's balance exceeds 100 after minting.
        expect(balance).to.be.eq(expectedBalance);

        // Transfer tokens to `signer2` and verify their balance.
        let receiverBalance = await (await geniusDiamond['balanceOf(address)'](signer2)).toBigInt();
        await ownerDiamond.transfer(signer2, toWei(10));
        receiverBalance = await (await geniusDiamond['balanceOf(address)'](signer2)).toBigInt();
        expectedBalance = toWei(10).toBigInt();
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
