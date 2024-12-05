import { ethers } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { logEvents } from '.';
import {
  debuglog,
  GNUS_TOKEN_ID,
  expect,
  toBN,
  toWei,
  dc,
} from '../scripts/common';
import { assert } from 'chai';
import { iObjToString } from './iObjToString';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GeniusDiamond } from '../typechain-types/GeniusDiamond';

// Exporting a test suite for minting child NFTs through the GNUS NFT Factory
export function suite() {
  describe.only('GNUS NFT Factory Mint Child NFTs Testing', async function () {
    // Variables to store signers, contract instances, and a reference NFT ID
    let signers: SignerWithAddress[];
    let owner: string;
    let gdAddr1: GeniusDiamond;
    let gdAddr2: GeniusDiamond;
    const ParentNFTID: BigNumber = toBN(1); // Reference to the parent NFT
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
    it("Testing NFT Factory to mint child NFT's of Addr1 Token", async () => {
      // Calculate the child NFT ID based on the parent NFT ID
      const addr1childNFT1 = ParentNFTID.shl(128).or(0);

      // Attempt to mint child NFTs as an unauthorized user, expecting rejection
      await expect(
        gdAddr2['mint(address,uint256,uint256,bytes)'](
          signers[2].address, // Recipient address
          addr1childNFT1, // Child NFT ID
          toWei(5), // Amount to mint
          [], // Additional data
        ),
      ).to.be.eventually.rejectedWith(Error, /Creator or Admin can only mint NFT/);
    });

    // Test case to validate successful minting of multiple child NFTs by an authorized user
    it('Testing NFT Factory to mint child NFTs of Addr1 with address 1', async () => {
      // Calculate IDs for three child NFTs based on the parent NFT ID
      const addr1childNFT1 = ParentNFTID.shl(128).or(0);
      const addr1childNFT2 = ParentNFTID.shl(128).or(1);
      const addr1childNFT3 = ParentNFTID.shl(128).or(2);

      // Retrieve the starting supply of GNUS tokens
      const startingSupply = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
      debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);

      // Attempt to mint more tokens than allowed, expecting rejection
      await expect(
        gdAddr1['mintBatch(address,uint256[],uint256[],bytes)'](
          signers[2].address, // Recipient address
          [addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
          [5, 100, 10], // Exceeding amounts
          [], // Additional data
        ),
      ).to.be.eventually.rejectedWith(Error, 'Max Supply for NFT would be exceeded');

      // Mint valid amounts for child NFTs
      const tx = await gdAddr1['mintBatch(address,uint256[],uint256[],bytes)'](
        signers[2].address, // Recipient address
        [addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
        [50, 1, 1], // Valid amounts
        [], // Additional data
      );

      // Log the transaction events for debugging
      logEvents(tx);

      // Retrieve the ending supply of GNUS tokens
      const endingSupply = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

      // Calculate the burned supply as the difference between starting and ending supply
      const burntSupply = startingSupply.sub(endingSupply);
      debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);

      // Iterate through the child NFTs to log their total supply
      for (let i = 0; i < 3; i++) {
        const nftID = ParentNFTID.shl(128).or(i);
        const totalSupply = await gdAddr1['totalSupply(uint256)'](nftID);
        debuglog(`Total Supply for ParentNFT1:NFT${i + 1} ${totalSupply}`);
      }

      // Retrieve and store symbols for the GNUS token and parent NFT
      const symbols: string[] = [];
      symbols.push((await gnusDiamond.getNFTInfo(GNUS_TOKEN_ID)).symbol);
      symbols.push((await gnusDiamond.getNFTInfo(ParentNFTID)).symbol);

      // Prepare arrays to query batch balances
      const addrs: string[] = [];
      const tokenIDs: BigNumber[] = [];

      // Fill the arrays with addresses and token IDs
      for (let i = 0; i < 3; i++) {
        addrs.push(signers[i].address);
        tokenIDs.push(GNUS_TOKEN_ID); // GNUS token
        addrs.push(signers[i].address);
        tokenIDs.push(ParentNFTID); // Parent NFT
        for (let j = 0; j < 3; j++) {
          addrs.push(signers[i].address);
          tokenIDs.push(ParentNFTID.shl(128).or(j)); // Child NFTs
        }
      }

      // Query batch balances for the prepared addresses and token IDs
      const ownedNFTs = await gnusDiamond.balanceOfBatch(addrs, tokenIDs);

      // Log the balances for each address and NFT
      ownedNFTs.forEach((bn, index) => {
        const addr = Math.floor(index / 5); // Determine address index
        const parentNFT = index % 5 ? 1 : 0; // Check if it's a parent NFT
        const childNFT = parentNFT ? Math.floor((index - 1) % 5) : 0; // Determine child NFT index
        debuglog(
          `Address ${addr} has ${
            parentNFT && childNFT ? bn.toNumber() : utils.formatEther(bn)
          } ${symbols[parentNFT]}::ChildNFT${childNFT} NFTs`,
        );
      });
    });
  });
}
