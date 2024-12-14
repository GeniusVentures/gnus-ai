import { ethers, network } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import {
  dc,
  debuglog,
  GNUS_TOKEN_ID,
  expect,
  toBN,
  toWei,
} from '../scripts/common';
import { assert } from 'chai';
import { iObjToString } from './iObjToString';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GeniusDiamond } from '../typechain-types/GeniusDiamond';

// Exporting a test suite for batch transfer functionality of GNUS ERC20 tokens.
export function suite() {
  describe('Testing Batch transfer erc20', async function () {
    // Declaring variables for GeniusDiamond instances, signers, and balances.
    let gdAddr1: GeniusDiamond;
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    let owner: SignerWithAddress,
      minter: SignerWithAddress,
      sender: SignerWithAddress,
      receiver1: SignerWithAddress,
      receiver2: SignerWithAddress;
    let oldTokenAmount1: BigNumber, oldTokenAmount2: BigNumber;

    // `before` hook runs once before all tests to set up the testing environment.
    before(async () => {
      // Retrieve available signers for the test and initialize roles.
      [owner, minter, sender, receiver1, receiver2] = await ethers.getSigners();

      // Retrieve the total supply of the GNUS token and initialize a connected instance.
      const totalSupply = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
      gdAddr1 = await gnusDiamond.connect(owner);

      // Fetch the balance of the owner and the two receivers for the GNUS token.
      const ownerSupply = await gnusDiamond['balanceOf(address,uint256)'](
        owner.address,
        GNUS_TOKEN_ID,
      );
      oldTokenAmount1 = await gnusDiamond['balanceOf(address,uint256)'](
        receiver1.address,
        GNUS_TOKEN_ID,
      );
      oldTokenAmount2 = await gnusDiamond['balanceOf(address,uint256)'](
        receiver2.address,
        GNUS_TOKEN_ID,
      );

      // Log the initial token supply and balances for debugging.
      console.log(
        `totalSupply, owner, receivers balance:`,
        utils.formatEther(totalSupply).toString(),
        utils.formatEther(ownerSupply).toString(),
        utils.formatEther(oldTokenAmount1).toString(),
        utils.formatEther(oldTokenAmount2).toString(),
      );
      // assert(ownerSupply.gt(toWei(100)), `Owner balanceOf should be > 100, but is ${ethers.utils.formatEther(ownerSupply)}`);
    });
    
    // The snapshot ID to revert to the initial state after each test.
    let snapshotId: string;

    beforeEach(async () => {
      snapshotId = await network.provider.send('evm_snapshot');
    });
      
    afterEach(async () => {
      await network.provider.send("evm_revert", [snapshotId]);
    });
    
    // Test case to verify batch transfers of ERC20 tokens.
    it('Batch Transferring to two addresses', async () => {
      
      // Mint 150 GNUS tokens to the owner’s address and verify the updated balance.
      await gnusDiamond['mint(address,uint256)'](owner.address, toWei(150));
      
      // Execute a batch transfer to `receiver1` and `receiver2` with specified token amounts.
      await gdAddr1.transferBatch(
        [receiver1.address, receiver2.address],
        [toWei(2), toWei(1)],
      );

      // Retrieve updated balances for `receiver1` and `receiver2`.
      const updatedAmount1 = await gnusDiamond['balanceOf(address,uint256)'](
        receiver1.address,
        GNUS_TOKEN_ID,
      );
      const updatedAmount2 = await gnusDiamond['balanceOf(address,uint256)'](
        receiver2.address,
        GNUS_TOKEN_ID,
      );

      // Assert that the updated balances match the expected values after the transfer.
      assert(
        updatedAmount1.eq(toWei(2).add(oldTokenAmount1)),
        `Address 1 should equal ${utils.formatEther(
          toWei(2).add(oldTokenAmount1),
        )}, but equals ${utils.formatEther(updatedAmount1)}`,
      );
      assert(
        updatedAmount2.eq(toWei(1).add(oldTokenAmount2)),
        `Address 2 should equal ${utils.formatEther(
          toWei(1).add(oldTokenAmount2),
        )}, but equals ${utils.formatEther(updatedAmount2)}`,
      );
    });

    // Test case to verify the blocking and unblocking of transfers.
    it('Block Transfer', async () => {
      // Fetch the owner's balance and mint additional tokens to the owner's account.
      let balance = await gnusDiamond['balanceOf(address)'](owner.address);
      await gnusDiamond['mint(address,uint256)'](owner.address, toWei(100));
      balance = await gnusDiamond['balanceOf(address)'](owner.address);

      // Assert that the owner's balance exceeds 100 after minting.
      expect(balance).to.be.eq(toWei(100));

      // Transfer tokens to `receiver1` and verify their balance.
      await gnusDiamond.transfer(receiver1.address, toWei(10));
      let receiverBalance = await gnusDiamond['balanceOf(address)'](receiver1.address);
      expect(receiverBalance).to.be.eq(toWei(10));

      // Block the owner from transferring tokens and verify the restriction.
      await gnusDiamond.banTransferorForAll(owner.address);
      await expect(gnusDiamond.transfer(receiver1.address, toWei(10))).to.be.rejectedWith(
        Error,
        'Blocked transferor',
      );

      // Unblock the owner and retry the transfer.
      await gnusDiamond.allowTransferorForAll(owner.address);
      await gnusDiamond.transfer(receiver1.address, toWei(1));

      // Block the owner using a batch transfer restriction and verify.
      await gnusDiamond.banTransferorBatch([0], [owner.address]);
      await expect(gnusDiamond.transfer(receiver1.address, toWei(10))).to.be.rejectedWith(
        Error,
        'Blocked transferor',
      );

      // Remove the batch restriction and verify successful transfer.
      await gnusDiamond.allowTransferorBatch([0], [owner.address]);
    });

    // Hook to execute additional test suites after this one completes.
    after(() => {
      // Uncomment if additional tests are to be executed sequentially.
      // NFTMintTests.suite();
    });
  });
}
