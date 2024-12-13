import { ethers } from 'hardhat';
import { utils } from 'ethers';
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
// Import additional test suites for NFT minting functionality
import * as NFTMintTests from '../test/NFTMintTests';

// Exporting a test suite for testing NFT creation functionality in the GNUS NFT Factory
export function suite() {
  describe('GNUS NFT Factory Testing', async function () {
    // Variables to store signers, contract instances, and roles
    let signers: SignerWithAddress[];
    let owner: string;
    let gdAddr1: GeniusDiamond;
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

    // `before` hook to set up the testing environment
    before(async () => {
      // Retrieve available signers for testing
      signers = await ethers.getSigners();
      owner = signers[0].address; // Assign the first signer as the owner

      // Retrieve the total supply of GNUS tokens for reference
      const amount = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

      // Connect the `gnusDiamond` contract to a specific signer
      gdAddr1 = await gnusDiamond.connect(signers[1]);
    });

    // Test case to validate the burning of GNUS tokens for NFT creation
    it('Testing NFT Factory that GNUS Tokens will burn for address 1', async () => {
      // Mint GNUS tokens to the second signer
      await gnusDiamond['mint(address,uint256)'](signers[1].address, toWei(2000));

      // Burn 1000 GNUS tokens from the signer's account
      await gdAddr1['burn(address,uint256,uint256)'](
        signers[1].address,
        GNUS_TOKEN_ID,
        toWei(1000),
      );

      // Attempt to burn tokens again, expecting rejection due to lack of approval
      const tx = await expect(
        gnusDiamond['burn(address,uint256,uint256)'](
          signers[1].address,
          GNUS_TOKEN_ID,
          toWei(1000),
        ),
      ).to.eventually.be.rejectedWith(Error, /ERC1155: caller is not owner nor approved/);

      // Log the transaction events for debugging
      logEvents(tx);

      // Verify the remaining balance of the signer after burning
      const amount = await gnusDiamond['balanceOf(address,uint256)'](
        signers[1].address,
        GNUS_TOKEN_ID,
      );
      assert(
        amount.eq(toWei(1000)),
        `Address one should equal 1000, but equals ${utils.formatEther(amount)}`,
      );
    });

    // Test case to validate restrictions on minting GNUS tokens
    it('Testing NFT Factory to mint GNUS Token', async () => {
      // Attempt to mint GNUS tokens directly, expecting rejection due to factory restrictions
      await expect(
        gnusDiamond["mint(address,uint256,uint256,bytes)"](owner, GNUS_TOKEN_ID, toWei(2000), []),
      ).to.eventually.be.rejectedWith(
        Error,
        /Shouldn\'t mint GNUS tokens tokens, only deposit and withdraw/,
      );
    });

    // Test case to validate restrictions on NFT creation for unauthorized users
    it('Testing NFT Factory to create new token for non-creator nor admin', async () => {
      // Attempt to create an NFT as an unauthorized user, expecting rejection
      await expect(
        gdAddr1.createNFT(
          GNUS_TOKEN_ID,
          'Addr1Token',
          'ADDR1',
          200,
          toWei(50000000 * 200),
          '',
        ),
      ).to.eventually.be.rejectedWith(
        Error,
        /Only Creators or Admins can create NFT child of GNUS/,
      );
    });

    // Test case to validate NFT creation functionality for authorized creators
    it('Testing NFT Factory to create new NFT & child NFTs for creator', async () => {
      // Grant the `CREATOR_ROLE` to the second signer
      await gnusDiamond.grantRole(utils.id('CREATOR_ROLE'), signers[1].address);

      // Retrieve information about the GNUS NFT
      const GNUSNFTInfo = await gdAddr1.getNFTInfo(GNUS_TOKEN_ID);

      // Generate a new parent NFT ID
      const newParentNFTID = GNUSNFTInfo.childCurIndex;

      // Create a new NFT with a specified exchange rate
      await gdAddr1.createNFT(
        GNUS_TOKEN_ID,
        'TEST GAME',
        'TESTGAME',
        toBN(2.0), // Exchange rate: 2.0 tokens for 1 GNUS token
        toWei(50000000 * 2),
        '',
      );

      // Retrieve information about the newly created NFT
      let newNFTInfo = await gdAddr1.getNFTInfo(newParentNFTID);
      debuglog(`NfTInfo ${iObjToString(newNFTInfo)}`);

      // Attempt to create multiple child NFTs with mismatched array lengths, expecting rejection
      await expect(
        gdAddr1.createNFTs(
          newParentNFTID,
          ['TESTGAME:NFT1', 'TESTGAME:NFT2', 'TESTGAME:NFT3'],
          [],
          [],
          [100],
          [],
        ),
      ).to.eventually.be.rejectedWith(
        Error,
        /NFT creation array lengths, should be the same/,
      );

      // Create multiple child NFTs with valid parameters
      await gdAddr1.createNFTs(
        newParentNFTID,
        ['TESTGAME:NFT1', 'TESTGAME:NFT2', 'TESTGAME:NFT3'],
        ['', '', ''], // Metadata URIs
        [1, 1, 1], // Exchange rates
        [100, 1, 1], // Supply limits
        ['https://www.gnus.ai', '', ''], // URLs
      );

      // Retrieve updated information about the parent NFT
      newNFTInfo = await gdAddr1.getNFTInfo(newParentNFTID);
      assert(
        newNFTInfo.childCurIndex.eq(3),
        `Should have created 3 NFT's, but created ${newNFTInfo.childCurIndex.toString()}`,
      );
      debuglog(`NfTInfo ${iObjToString(newNFTInfo)}`);

      // Iterate through the created child NFTs and log their details
      for (let i = 0; i < 3; i++) {
        const nftID = newParentNFTID.shl(128).or(i);
        const nftInfo = await gdAddr1.getNFTInfo(nftID);
        debuglog(`nftInfo${i.toString()} ${iObjToString(nftInfo)}}`);
      }
    });

    // Execute additional test suites after completing this one
    after(() => {
      NFTMintTests.suite();
    });
  });
}
