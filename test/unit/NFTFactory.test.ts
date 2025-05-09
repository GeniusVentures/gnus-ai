import { iObjToString } from '../../scripts/utils/iObjToString';
import { BigNumber, utils } from 'ethers';
import { GNUS_TOKEN_ID, toBN } from '../../scripts/common';
import { debuglog } from 'util';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { logEvents } from '../../scripts/utils/logEvents';

import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID, toWei } from '../../scripts/utils/helpers';
import { LocalDiamondDeployer, LocalDiamondDeployerConfig } from '../../scripts/setup/LocalDiamondDeployer';
import { Diamond, deleteDeployInfo } from '@gnus.ai/diamonds';
import {
  GeniusDiamond,
  IERC20Upgradeable__factory,
  IDiamondCut__factory,
  IDiamondLoupe__factory
} from '../../typechain-types';
import { config } from 'dotenv';

chai.use(chaiAsPromised);

describe('NFT Factory Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
      networkProviders.set('hardhat', ethers.provider);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    networkProviders.set('hardhat', ethers.provider);
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
      let geniusDiamond: GeniusDiamond;
      let signer0Diamond: GeniusDiamond;
      let signer1Diamond: GeniusDiamond;
      let signer2Diamond: GeniusDiamond;
      let ownerDiamond: GeniusDiamond;

      let ethersMultichain: typeof ethers;
      let snapshotId: string;

      const ParentNFTID: BigNumber = toBN(1); // Reference to the parent NFT

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
        owner = diamond.getDeployedDiamondData().DeployerAddress;
        if (!owner) {
          diamond.setSigner(signers[0]);
          owner = signer0;
          ownerSigner
        }
        ownerSigner = await ethersMultichain.getSigner(owner);

        ownerDiamond = geniusDiamond.connect(ownerSigner);

        snapshotId = await provider.send('evm_snapshot', []);
      });

      after(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      // Test case to validate the burning of GNUS tokens for NFT creation
      it('Testing NFT Factory that GNUS Tokens will burn for address 1', async () => {
        // Mint GNUS tokens to the second signer
        await ownerDiamond['mint(address,uint256)'](signer1, toWei(2000));

        // Signer Burns 1000 GNUS tokens from the signer's account
        await signer1Diamond['burn(address,uint256,uint256)'](
          signer1,
          GNUS_TOKEN_ID,
          toWei(1000),
        );

        // Attempt to burn tokens again, expecting rejection due to lack of approval
        const tx = await expect(
          ownerDiamond['burn(address,uint256,uint256)'](
            signer1,
            GNUS_TOKEN_ID,
            toWei(1000),
          ),
        ).to.eventually.be.rejectedWith(Error, /ERC1155: caller is not owner nor approved/);

        // Log the transaction events for debugging
        // await logEvents(tx);

        // Verify the remaining balance of the signer after burning
        const amount = await ownerDiamond['balanceOf(address,uint256)'](
          signer1,
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
          ownerDiamond["mint(address,uint256,uint256,bytes)"](owner, GNUS_TOKEN_ID, toWei(2000), []),
        ).to.eventually.be.rejectedWith(
          Error,
          /Shouldn\'t mint GNUS tokens tokens, only deposit and withdraw/,
        );
      });

      // Test case to validate restrictions on NFT creation for unauthorized users
      it('Testing NFT Factory to create new token for non-creator nor admin', async () => {
        // Attempt to create an NFT as an unauthorized user, expecting rejection
        await expect(
          signer1Diamond.createNFT(
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
        await ownerDiamond.grantRole(utils.id('CREATOR_ROLE'), signer1);

        // Retrieve information about the GNUS NFT
        const GNUSNFTInfo = await signer1Diamond.getNFTInfo(GNUS_TOKEN_ID);

        // Generate a new parent NFT ID
        const newParentNFTID = GNUSNFTInfo.childCurIndex;

        // Create a new NFT with a specified exchange rate
        await signer1Diamond.createNFT(
          GNUS_TOKEN_ID,
          'TEST GAME',
          'TESTGAME',
          toBN(2.0), // Exchange rate: 2.0 tokens for 1 GNUS token
          toWei(50000000 * 2),
          '',
        );

        // Retrieve information about the newly created NFT
        let newNFTInfo = await signer1Diamond.getNFTInfo(newParentNFTID);
        debuglog(`NfTInfo ${iObjToString(newNFTInfo)}`);

        // Attempt to create multiple child NFTs with mismatched array lengths, expecting rejection
        await expect(
          signer1Diamond.createNFTs(
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
        await signer1Diamond.createNFTs(
          newParentNFTID,
          ['TESTGAME:NFT1', 'TESTGAME:NFT2', 'TESTGAME:NFT3'],
          ['', '', ''], // Metadata URIs
          [1, 1, 1], // Exchange rates
          [100, 1, 1], // Supply limits
          ['https://www.gnus.ai', '', ''], // URLs
        );

        // Retrieve updated information about the parent NFT
        newNFTInfo = await signer1Diamond.getNFTInfo(newParentNFTID);
        assert(
          newNFTInfo.childCurIndex.eq(3),
          `Should have created 3 NFT's, but created ${newNFTInfo.childCurIndex.toString()}`,
        );
        debuglog(`NfTInfo ${iObjToString(newNFTInfo)}`);

        // Iterate through the created child NFTs and log their details
        // This is really just for debugging, could be removed.
        for (let i = 0; i < 3; i++) {
          const nftID = newParentNFTID.shl(128).or(i);
          const nftInfo = await signer1Diamond.getNFTInfo(nftID);
          debuglog(`nftInfo${i.toString()} ${iObjToString(nftInfo)}}`);
        }
      });

      // Test case to validate minting restrictions for unauthorized users
      it('Testing NFT Factory to mint child tokens of GNUS with address 2', async () => {
        // Attempt to mint child tokens as an unauthorized user, expecting rejection
        try {
          await signer2Diamond['mint(address,uint256,uint256,bytes)'](
            signer2, // Recipient address
            ParentNFTID, // Parent NFT ID
            toWei(5), // Amount to mint
            [], // Additional data
          );
          assert.fail('Expected transaction to fail, but it succeeded');
        } catch (error: any) {
          console.error('Transaction failed with error:', error.message);
          assert.match(error.message, /Creator or Admin can only mint NFT/, 'Error message does not match expected');
        }
      });

      // Test case to validate successful minting of child NFTs by an authorized user
      it('Testing NFT Factory to mint child NFTS (tokens) of GNUS with address 1', async () => {
        // Retrieve the starting supply of GNUS tokens
        const startingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
        debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);

        // Mint child NFTs using an authorized user
        const tx = await signer1Diamond['mint(address,uint256,uint256,bytes)'](
          signer2, // Recipient address
          ParentNFTID, // Parent NFT ID
          toWei(5), // Amount to mint
          [], // Additional data
        );

        // Log the transaction events for debugging
        await logEvents(tx);

        // Retrieve the ending supply of GNUS tokens
        const endingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

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


      // Test case to validate minting restrictions for unauthorized users
      it("Testing NFT Factory to mint child NFTs of Addr1 Token", async () => {
        // Calculate the child NFT ID based on the parent NFT ID
        const addr1childNFT1 = ParentNFTID.shl(128).or(0);

        // Attempt to mint child NFTs as an unauthorized user, expecting rejection
        await expect(
          signer2Diamond['mint(address,uint256,uint256,bytes)'](
            signer2, // Recipient address
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
        const startingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
        debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);

        // Attempt to mint more tokens than allowed, expecting rejection
        await expect(
          signer1Diamond['mintBatch(address,uint256[],uint256[],bytes)'](
            signer2, // Recipient address
            [addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
            [5, 100, 10], // Exceeding amounts
            [], // Additional data
          ),
        ).to.be.eventually.rejectedWith(Error, 'Max Supply for NFT would be exceeded');

        // Mint valid amounts for child NFTs
        const tx = await signer1Diamond['mintBatch(address,uint256[],uint256[],bytes)'](
          signer2, // Recipient address
          [addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
          [50, 1, 1], // Valid amounts
          [], // Additional data
        );

        // Log the transaction events for debugging
        await logEvents(tx);

        // Retrieve the ending supply of GNUS tokens
        const endingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

        // Calculate the burned supply as the difference between starting and ending supply
        const burntSupply = startingSupply.sub(endingSupply);
        debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);

        // Iterate through the child NFTs to log their total supply
        // Only needed for troubleshooting.
        // for (let i = 0; i < 3; i++) {
        //   const nftID = ParentNFTID.shl(128).or(i);
        //   const totalSupply = await signer1Diamond['totalSupply(uint256)'](nftID);
        //   debuglog(`Total Supply for ParentNFT1:NFT${i + 1} ${totalSupply}`);
        // }

        // Retrieve and store symbols for the GNUS token and parent NFT
        const symbols: string[] = [];
        symbols.push((await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID)).symbol);
        symbols.push((await geniusDiamond.getNFTInfo(ParentNFTID)).symbol);

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
        const ownedNFTs = await geniusDiamond.balanceOfBatch(addrs, tokenIDs);

        // Log the balances for each address and NFT
        ownedNFTs.forEach((bn, index) => {
          const addr = Math.floor(index / 5); // Determine address index
          const parentNFT = index % 5 ? 1 : 0; // Check if it's a parent NFT
          const childNFT = parentNFT ? Math.floor((index - 1) % 5) : 0; // Determine child NFT index
          debuglog(
            `Address ${addr} has ${parentNFT && childNFT ? bn.toNumber() : utils.formatEther(bn)
            } ${symbols[parentNFT]}::ChildNFT${childNFT} NFTs`,
          );
        });

        // TODO There is no test at the end of all this processing.  Its just a lot of logging.
      });
    });
  }
});
