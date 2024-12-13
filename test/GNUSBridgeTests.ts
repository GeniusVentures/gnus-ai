import { ethers } from 'hardhat';
import { dc, expect, toWei, GNUS_TOKEN_ID } from '../scripts/common';
import { assert } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GeniusDiamond } from '../typechain-types/GeniusDiamond';
import { getInterfaceID } from '../scripts/FacetSelectors';
import { IERC20Upgradeable__factory } from '../typechain-types/factories/IERC20Upgradeable__factory';

// Exporting a test suite for testing the GNUS Bridge functionality
export function suite() {
  describe('GNUS Bridge Testing', async function () {
    // Variables to store signer accounts, contract instances, and roles
    let signers: SignerWithAddress[];
    let owner: string;
    let gdAddr1: GeniusDiamond;
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    let minterRole: string;

    // `before` hook to set up the testing environment
    before(async () => {
      // Retrieve available signers for testing
      signers = await ethers.getSigners();
      owner = signers[0].address; // Assign the first signer as the owner

      // Connect the `gnusDiamond` contract to a specific signer
      gdAddr1 = gnusDiamond.connect(signers[1]);

      // Fetch the `MINTER_ROLE` constant from the `gnusDiamond` contract
      minterRole = await gnusDiamond['MINTER_ROLE']();
    });

    // Test case to validate the minting and burning functionality
    it('Testing Mint/Burn', async () => {
      // Ensure a signer without the `MINTER_ROLE` cannot mint tokens
      await expect(
        gnusDiamond
          .connect(signers[2])
          ['mint(address,uint256)'](signers[2].address, toWei(1)),
      ).to.be.rejectedWith(
        Error,
        `AccessControl: account ${signers[2].address.toLowerCase()} is missing role ${minterRole}`,
      );

      // Ensure a signer without the `MINTER_ROLE` cannot burn tokens
      await expect(
        gnusDiamond
          .connect(signers[2])
          ['burn(address,uint256)'](signers[0].address, toWei(1)),
      ).to.be.rejectedWith(
        Error,
        `AccessControl: account ${signers[2].address.toLowerCase()} is missing role ${minterRole}`,
      );

      // Verify the initial token balance of a signer is zero
      let balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(0));

      // Mint tokens to the signer's account and validate the updated balance
      await gnusDiamond['mint(address,uint256)'](signers[2].address, toWei(100));
      balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(100));

      // Fetch the total supply of tokens
      const supply = await gnusDiamond['totalSupply()']();

      // Burn tokens from the signer's account and validate the supply reduction
      await gnusDiamond['burn(address,uint256)'](signers[2].address, toWei(100));
      const supplyAfterBurned = await gnusDiamond['totalSupply()']();

      // Assert that the supply has decreased by the burned amount
      expect(supply.sub(supplyAfterBurned)).to.be.eq(toWei(100));

      // Verify the signer's balance is zero after burning
      balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(0));

      // Mint tokens again and validate that the total supply returns to its original value
      await gnusDiamond['mint(address,uint256)'](signers[2].address, toWei(100));
      const supplyAfterMint = await gnusDiamond['totalSupply()']();
      expect(supplyAfterMint).to.be.eq(supply);

      // Attempt to burn tokens using the multi-dimensional burn function with invalid permissions
      await expect(
        gnusDiamond['burn(address,uint256,uint256)'](signers[2].address, 0, toWei(100)),
      ).to.be.rejectedWith(Error, 'ERC1155: caller is not owner nor approved');

      // Burn tokens using the multi-dimensional burn function with the correct permissions
      await gnusDiamond
        .connect(signers[2])
        ['burn(address,uint256,uint256)'](signers[2].address, toWei(0), toWei(100));

      // Verify the balance of the signer is zero after burning
      balance = await gnusDiamond['balanceOf(address)'](signers[2].address);
      expect(balance).to.be.eq(toWei(0));
    });
  });
}