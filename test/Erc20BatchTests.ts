import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { dc, GNUS_TOKEN_ID, expect, toWei } from '../scripts/common';
import { assert } from 'chai';
import { GeniusDiamond, ERC20TransferBatch } from '../typechain-types';

// Exporting a test suite for batch transfer functionality of GNUS ERC20 tokens.
export function suite() {
  describe('Testing Batch transfer erc20', async function () {
    // Declaring variables for GeniusDiamond instances, signers, and balances.
    const gnusDiamond = dc.GeniusDiamond;
    const gnusERC20TransferBatch = dc.GeniusDiamond as ERC20TransferBatch;
    let owner: SignerWithAddress,
      minter: SignerWithAddress, // ToDO Remove Never Used
      sender: SignerWithAddress, // ToDo Remove Never Used
      receiver1: SignerWithAddress,
      receiver2: SignerWithAddress;
    let oldTokenAmount1: bigint, oldTokenAmount2: bigint;

    // `before` hook runs once before all tests to set up the testing environment.
    before(async () => {
      // Retrieve available signers for the test and initialize roles.
      [owner, minter, sender, receiver1, receiver2] = await ethers.getSigners();
      // Retrieve the total supply of the GNUS token and initialize a connected instance.
      const totalSupply = await gnusERC20TransferBatch.totalSupply(GNUS_TOKEN_ID);
      const gdAddr1 = (await gnusDiamond.connect(owner)) as GeniusDiamond;

      // Fetch the balance of the owner and the two receivers for the GNUS token.
      const ownerSupply = await gnusERC20TransferBatch.balanceOf(
        owner.address,
        GNUS_TOKEN_ID,
      );
      oldTokenAmount1 = await gnusERC20TransferBatch.balanceOf(
        receiver1.address,
        GNUS_TOKEN_ID,
      );
      oldTokenAmount2 = await gnusERC20TransferBatch.balanceOf(
        receiver2.address,
        GNUS_TOKEN_ID,
      );

      // Log the initial token supply and balances for debugging.
      console.log(
        `totalSupply, owner, receivers balance:`,
        ethers.formatEther(totalSupply).toString(),
        ethers.formatEther(ownerSupply).toString(),
        ethers.formatEther(oldTokenAmount1).toString(),
        ethers.formatEther(oldTokenAmount2).toString(),
      );
      // assert(ownerSupply.gt(toWei(100)), `Owner balanceOf should be > 100, but is ${ethers.utils.formatEther(ownerSupply)}`);
    });

    // The snapshot ID to revert to the initial state after each test.
    let snapshotId: string;

    beforeEach(async () => {
      snapshotId = await network.provider.send('evm_snapshot');
    });

    afterEach(async () => {
      await network.provider.send('evm_revert', [snapshotId]);
    });

    // Test case to verify batch transfers of ERC20 tokens.
    it('Batch Transferring to two addresses', async () => {
      // Mint 150 GNUS tokens to the owner’s address and verify the updated balance.
      await gnusERC20TransferBatch.mint(owner.address, toWei(150));

      // Execute a batch transfer to `receiver1` and `receiver2` with specified token amounts.
      await gnusERC20TransferBatch.transferBatch(
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
      const receiverBalance = await gnusDiamond['balanceOf(address)'](receiver1.address);
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
