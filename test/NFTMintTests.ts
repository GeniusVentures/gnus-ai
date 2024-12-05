import { ethers } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { logEvents } from '.';
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
import * as NFTMintChildTests from '../test/NFTMintChildTests';

// Exporting a test suite for minting NFTs through the GNUS NFT Factory
export function suite() {
  describe.only('GNUS NFT Factory Mint Testing', async function () {
    // Variables to store signers, contract instances, and a reference NFT ID
    let signers: SignerWithAddress[];
    let owner: string;
    let gdAddr1: GeniusDiamond;
    let gdAddr2: GeniusDiamond;
    const addr1ParentNFT: BigNumber = toBN(1); // Reference to the parent NFT
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

    // `before` hook to set up the testing environment
    before(async () => {
      // Retrieve available signers for testing
      signers = await ethers.getSigners();

      // Assign the first signer as the owner
      owner = signers[0].address;

      // Connect the `gnusDiamond` contract to different signers
      gdAddr1 = await gnusDiamond.connect(signers[1]);
      gdAddr2 = await gnusDiamond.connect(signers[2]);
    });

    // Test case to validate minting restrictions for unauthorized users
    it('Testing NFT Factory to mint child tokens of GNUS with address 2', async () => {
      // Attempt to mint child tokens as an unauthorized user, expecting rejection
      await expect(
        gdAddr2['mint(address,uint256,uint256,bytes)'](
          signers[2].address, // Recipient address
          addr1ParentNFT, // Parent NFT ID
          toWei(5), // Amount to mint
          [], // Additional data
        ),
      ).to.be.eventually.rejectedWith(Error, /Creator or Admin can only mint NFT/);
    });

    // Test case to validate successful minting of child NFTs by an authorized user
    it('Testing NFT Factory to mint child NFTS (tokens) of GNUS with address 1', async () => {
      // Retrieve the starting supply of GNUS tokens
      const startingSupply = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
      debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);

      // Mint child NFTs using an authorized user
      const tx = await gdAddr1['mint(address,uint256,uint256,bytes)'](
        signers[2].address, // Recipient address
        addr1ParentNFT, // Parent NFT ID
        toWei(5), // Amount to mint
        [], // Additional data
      );

      // Log the transaction events for debugging
      logEvents(tx);

      // Retrieve the ending supply of GNUS tokens
      const endingSupply = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

      // Calculate the burned supply as the difference between starting and ending supply
      const burntSupply = startingSupply.sub(endingSupply);

      // Assert that the burned supply matches the expected value based on the exchange rate
      assert(
        burntSupply.eq(toWei(5.0 * 2.0)), // Exchange rate: 2.0 GNUS burned per minted token
        `Burnt Supply should equal minted * exchange rate (5.0*2.0), but equals ${burntSupply.toString()}`,
      );

      // Log the total GNUS burned for debugging
      debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);
    });

    // Hook to execute additional test suites after completing this one
    after(() => {
      NFTMintChildTests.suite();
    });
  });
}
