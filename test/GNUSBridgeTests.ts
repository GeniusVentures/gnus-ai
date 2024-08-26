import { ethers } from 'hardhat';
import { dc, assert, expect, toWei, GNUS_TOKEN_ID } from '../scripts/common';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GeniusDiamond } from '../typechain-types/GeniusDiamond';
import { getInterfaceID } from '../scripts/FacetSelectors';
import { IERC20Upgradeable__factory } from '../typechain-types/factories/IERC20Upgradeable__factory';

export function suite() {
  describe('GNUS Bridge Testing', async function () {
    let signers: SignerWithAddress[];
    let owner: string;
    let gdAddr1: GeniusDiamond;
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    let minterRole: string;
    before(async () => {
      signers = await ethers.getSigners();
      owner = signers[0].address;
      gdAddr1 = gnusDiamond.connect(signers[1]);
      minterRole = await gnusDiamond['MINTER_ROLE']();
    });

    it('Testing Mint/Burn', async () => {
      await expect(
        gnusDiamond
          .connect(signers[2])
          ['mint(address,uint256)'](signers[2].address, toWei(1)),
      ).to.be.rejectedWith(
        Error,
        `AccessControl: account ${signers[2].address.toLowerCase()} is missing role ${minterRole}`,
      );
      await expect(
        gnusDiamond
          .connect(signers[2])
          ['burn(address,uint256)'](signers[0].address, toWei(1)),
      ).to.be.rejectedWith(
        Error,
        `AccessControl: account ${signers[2].address.toLowerCase()} is missing role ${minterRole}`,
      );
      let balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(0));
      await gnusDiamond['mint(address,uint256)'](signers[2].address, toWei(100));
      balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(100));
      const supply = await gnusDiamond['totalSupply()']();
      await gnusDiamond['burn(address,uint256)'](signers[2].address, toWei(100));
      const supplyAfterBurned = await gnusDiamond['totalSupply()']();
      // total supply should be decreased
      expect(supply.sub(supplyAfterBurned)).to.be.eq(toWei(100));
      balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(0));
      await gnusDiamond['mint(address,uint256)'](signers[2].address, toWei(100));
      const supplyAfterMint = await gnusDiamond['totalSupply()']();
      expect(supplyAfterMint).to.be.eq(supply);
      // user burn function
      await expect(
        gnusDiamond['burn(address,uint256,uint256)'](signers[2].address, 0, toWei(100)),
      ).to.be.rejectedWith(Error, 'ERC1155: caller is not owner nor approved');
      await gnusDiamond
        .connect(signers[2])
        ['burn(address,uint256,uint256)'](signers[2].address, toWei(0), toWei(100));
      balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(0));
    });
  });
}
