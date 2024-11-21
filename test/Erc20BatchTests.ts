import { ethers } from 'hardhat';
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
import { assert } from 'chai';

export function suite() {
  describe('Testing Batch transfer erc20', async function () {
    let gdAddr1: GeniusDiamond;
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    let owner: SignerWithAddress,
      minter: SignerWithAddress,
      sender,
      receiver1: SignerWithAddress,
      receiver2: SignerWithAddress;
    let oldTokenAmount1: BigNumber, oldTokenAmount2: BigNumber;
    before(async () => {
      [owner, minter, sender, receiver1, receiver2] = await ethers.getSigners();
      const totalSupply = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
      gdAddr1 = await gnusDiamond.connect(owner);
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
      console.log(
        `totalSupply, owner, receivers balance:`,
        utils.formatEther(totalSupply).toString(),
        utils.formatEther(ownerSupply).toString(),
        utils.formatEther(oldTokenAmount1).toString(),
        utils.formatEther(oldTokenAmount2).toString(),
      );
      // assert(ownerSupply.gt(toWei(100)), `Owner balanceOf should be > 100, but is ${ethers.utils.formatEther(ownerSupply)}`);
    });

    it('Batch Transferring to two addresses', async () => {
      await gdAddr1.transferBatch(
        [receiver1.address, receiver2.address],
        [toWei(2), toWei(1)],
      );
      const updatedAmount1 = await gnusDiamond['balanceOf(address,uint256)'](
        receiver1.address,
        GNUS_TOKEN_ID,
      );
      const updatedAmount2 = await gnusDiamond['balanceOf(address,uint256)'](
        receiver2.address,
        GNUS_TOKEN_ID,
      );
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
    it('Block Transfer', async () => {
      let balance = await gnusDiamond['balanceOf(address)'](owner.address);
      await gnusDiamond['mint(address,uint256)'](owner.address, toWei(100));
      balance = await gnusDiamond['balanceOf(address)'](owner.address);
      expect(balance).to.be.gt(toWei(100));
      await gnusDiamond.transfer(receiver1.address, toWei(10));
      let receiverBalance = await gnusDiamond['balanceOf(address)'](receiver1.address);
      expect(receiverBalance).to.be.gt(toWei(10));
      await gnusDiamond.banTransferorForAll(owner.address);
      await expect(gnusDiamond.transfer(receiver1.address, toWei(10))).to.be.rejectedWith(
        Error,
        'Blocked transferor',
      );
      await gnusDiamond.allowTransferorForAll(owner.address);
      await gnusDiamond.transfer(receiver1.address, toWei(1));
      await gnusDiamond.banTransferorBatch([0], [owner.address]);
      await expect(gnusDiamond.transfer(receiver1.address, toWei(10))).to.be.rejectedWith(
        Error,
        'Blocked transferor',
      );
      await gnusDiamond.allowTransferorBatch([0], [owner.address]);
    });
    after(() => {
      // NFTMintTests.suite();
    });
  });
}
