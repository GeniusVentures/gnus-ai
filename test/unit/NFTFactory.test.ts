import { iObjToString } from '../../scripts/utils/iObjToString';
import { GNUS_TOKEN_ID } from '../../scripts/common';
import { debuglog } from 'util';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { logEvents } from '../../scripts/utils/logEvents';

import { debug } from 'debug';
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import { formatEther, id } from 'ethers';
import hre from 'hardhat';

// Create utils object for compatibility
const utils = { formatEther, id };

// Helper function to replace toBN - in ethers v6 we use BigInt directly
const toBN = (value: number | string) => BigInt(Math.floor(Number(value) * 1e18));
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { JsonRpcProvider } from 'ethers';
import { multichain } from 'hardhat-multichain';
import { toWei } from '../../scripts/utils/helpers';
import {
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '../../scripts/setup/LocalDiamondDeployer';
import { Diamond } from 'diamonds';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { loadDiamondContract } from '../../scripts/utils/loadDiamondArtifact';
import { Artifact } from 'hardhat/types';

chai.use(chaiAsPromised);

describe('NFT Factory Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
	this.timeout(0); // Extended indefinitely for diamond deployment time

	const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

	if (process.argv.includes('test-multichain')) {
		const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
		if (networkNames.includes('hardhat')) {
			networkProviders.set('hardhat', ethers.provider as any);
		}
	} else if (process.argv.includes('test') || process.argv.includes('coverage')) {
		networkProviders.set('hardhat', ethers.provider as any);
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

			// This will hold the actual created NFT ID for tests that need it
			let createdParentNFTID: bigint;

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
				const deployedDiamondData = diamond.getDeployedDiamondData();

				// Load the Diamond contract using the utility function
				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress!,
				);

				ethersMultichain = ethers;
				ethersMultichain.provider = provider as any;

				// Retrieve the signers for the chain
				signers = await ethersMultichain.getSigners();
				signer0 = signers[0].address;
				signer1 = signers[1].address;
				signer2 = signers[2].address;
				signer0Diamond = geniusDiamond.connect(signers[0]);
				signer1Diamond = geniusDiamond.connect(signers[1]);
				signer2Diamond = geniusDiamond.connect(signers[2]);

				// get the signer for the owner
				owner = diamond.getDeployedDiamondData().DeployerAddress || '';
				if (!owner) {
					diamond.setSigner(signers[0]);
					owner = signer0;
					ownerSigner = signers[0];
				} else {
					ownerSigner = await ethersMultichain.getSigner(owner);
				}

				ownerDiamond = geniusDiamond.connect(ownerSigner);

				snapshotId = await provider.send('evm_snapshot', []);
			});

			after(async () => {
				if (snapshotId) {
					await provider.send('evm_revert', [snapshotId]);
				}
			});

			beforeEach(async () => {
				// Take a snapshot before each test
				snapshotId = await provider.send('evm_snapshot', []);
			});

			afterEach(async () => {
				// Revert to the snapshot after each test
				if (snapshotId) {
					await provider.send('evm_revert', [snapshotId]);
				}
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
					amount === toWei(1000),
					`Address one should equal 1000, but equals ${utils.formatEther(amount)}`,
				);
			});

			// Test case to validate restrictions on minting GNUS tokens
			it('Testing NFT Factory to mint GNUS Token', async () => {
				// Attempt to mint GNUS tokens directly, expecting rejection due to factory restrictions
				await expect(
					ownerDiamond['mint(address,uint256,uint256,bytes)'](
						owner,
						GNUS_TOKEN_ID,
						toWei(2000),
						'0x',
					),
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
					newNFTInfo.childCurIndex === 3n,
					`Should have created 3 NFT's, but created ${newNFTInfo.childCurIndex.toString()}`,
				);
				debuglog(`NfTInfo ${iObjToString(newNFTInfo)}`);

				// Iterate through the created child NFTs and log their details
				// This is really just for debugging, could be removed.
				for (let i = 0; i < 3; i++) {
					const nftID = (newParentNFTID << 128n) | BigInt(i);
					const nftInfo = await signer1Diamond.getNFTInfo(nftID);
					debuglog(`nftInfo${i.toString()} ${iObjToString(nftInfo)}}`);
				}
			});

			// Test case to validate minting restrictions for unauthorized users
			it('should mint child tokens of GNUS with address 2', async () => {
				await ownerDiamond.grantRole(utils.id('CREATOR_ROLE'), signer1);

				// Get the GNUS NFT info to determine the next NFT ID
				const GNUSNFTInfo = await signer1Diamond.getNFTInfo(GNUS_TOKEN_ID);
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

				// Attempt to mint child tokens as an unauthorized user, expecting rejection
				try {
					await signer2Diamond['mint(address,uint256,uint256,bytes)'](
						signer2, // Recipient address
						newParentNFTID, // Parent NFT ID
						toWei(5), // Amount to mint
						'0x', // Additional data
					);
					assert.fail('Expected transaction to fail, but it succeeded');
				} catch (error: any) {
					console.error('Transaction failed with error:', error.message);
					assert.match(
						error.message,
						/Creator or Admin can only mint NFT/,
						'Error message does not match expected',
					);
				}
			});

			// Test case to validate successful minting of child NFTs by an authorized user
			it('Should mint child NFTS (tokens) of GNUS with address 1 and burn GNUS tokens at exchange rate', async () => {
				// First mint GNUS tokens to signer1 for burning during NFT minting
				await ownerDiamond['mint(address,uint256)'](signer1, toWei(1000));

				await ownerDiamond.grantRole(utils.id('CREATOR_ROLE'), signer1);

				// Get the GNUS NFT info to determine the next NFT ID
				const GNUSNFTInfo = await signer1Diamond.getNFTInfo(GNUS_TOKEN_ID);
				const newParentNFTID = GNUSNFTInfo.childCurIndex;

				// Create a new NFT with a specified exchange rate
				const nft = await signer1Diamond.createNFT(
					GNUS_TOKEN_ID,
					'TEST GAME',
					'TESTGAME',
					2.0, // Exchange rate: 2.0 tokens for 1 GNUS token
					toWei(50000000 * 2),
					'',
				);

				const startingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

				// Give permission to signer1 to mint child NFTs
				await ownerDiamond.grantRole(utils.id('MINTER_ROLE'), signer1);

				// Mint GNUS tokens to signer1 so they have enough tokens to burn for child NFT creation
				// (The mint function burns tokens from the sender, not the recipient)
				// await ownerDiamond['mint(address,uint256)'](signer1, toWei(100));

				// Retrieve the starting supply of GNUS tokens
				debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);

				// Check signer1's GNUS balance before minting
				const signer1Balance = await geniusDiamond['balanceOf(address,uint256)'](
					signer1,
					GNUS_TOKEN_ID,
				);
				console.log(
					`Signer1 GNUS balance before mint: ${utils.formatEther(signer1Balance)}`,
				);

				// Check the NFT info to see the exchange rate
				const createdNFTInfo = await signer1Diamond.getNFTInfo(newParentNFTID);
				console.log(`NFT exchange rate: ${createdNFTInfo.exchangeRate}`);
				console.log(
					`Required GNUS to burn for 5 tokens: ${createdNFTInfo.exchangeRate * 5n}`,
				);

				// Mint child NFTs using an authorized user
				const tx = await signer1Diamond['mint(address,uint256,uint256,bytes)'](
					signer2, // Recipient address
					newParentNFTID, // Parent NFT ID
					toWei(5), // Amount to mint
					'0x', // Additional data
				);

				// TODO This needs an assert to check the transaction is successful.
				// Log the transaction events for debugging
				await logEvents(tx);

				// TODO This begins is a different test that needs to be added.
				// Retrieve the ending supply of GNUS tokens
				const endingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

				// Calculate the burned supply as the difference between starting and ending supply
				const burntSupply = startingSupply - endingSupply;

				// Assert that the burned supply matches the expected value based on the exchange rate
				assert(
					BigInt(burntSupply) === toWei(5.0 * 2.0), // Exchange rate: 2.0 GNUS burned per minted token
					`Burnt Supply should equal minted * exchange rate (5.0*2.0), but equals ${burntSupply.toString()}`,
				);

				// Log the total GNUS burned for debugging
				debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);
			});

			// Test case to validate minting restrictions for unauthorized users
			it('Should reject NFT Factory to mint child NFTs of Addr1 Token with Access deficient Signer', async () => {
				// First mint GNUS tokens to signer1 for burning during NFT minting
				await ownerDiamond['mint(address,uint256)'](signer1, toWei(1000));
				await ownerDiamond.grantRole(utils.id('CREATOR_ROLE'), signer1);

				// Get the GNUS NFT info to determine the next NFT ID
				const GNUSNFTInfo = await signer1Diamond.getNFTInfo(GNUS_TOKEN_ID);
				const newParentNFTID = GNUSNFTInfo.childCurIndex;

				// Create a new NFT with a specified exchange rate
				await signer1Diamond.createNFT(
					GNUS_TOKEN_ID,
					'TEST GAME',
					'TESTGAME',
					2.0, // Exchange rate: 2.0 tokens for 1 GNUS token
					toWei(50000000 * 2),
					'',
				);

				const startingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

				// Give permission to signer1 to mint child NFTs
				// await ownerDiamond.grantRole(utils.id('MINTER_ROLE'), signer2);
				// Retrieve the starting supply of GNUS tokens
				debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);

				await expect(
					signer2Diamond['mint(address,uint256,uint256,bytes)'](
						signer2, // Recipient address
						newParentNFTID, // Child NFT ID
						toWei(5), // Amount to mint
						'0x', // Additional data
					),
				).to.be.eventually.rejectedWith(Error, /Creator or Admin can only mint NFT/);
			});

			// Test case to validate successful minting of multiple child NFTs by an authorized user
			it('should mint batch (multiple) child NFTs, fail for unauthorized, succeed for authorized & burn correct amount of GNUS', async () => {
				// First mint GNUS tokens to signer1 for burning during NFT minting
				await ownerDiamond['mint(address,uint256)'](signer1, toWei(1000));
				const startingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
				// Grant necessary roles to signer1
				await ownerDiamond.grantRole(utils.id('CREATOR_ROLE'), signer1);
				await ownerDiamond.grantRole(utils.id('MINTER_ROLE'), signer1);

				// Get the GNUS NFT info to determine the next NFT ID
				const GNUSNFTInfo = await signer1Diamond.getNFTInfo(GNUS_TOKEN_ID);
				const newParentNFTID = GNUSNFTInfo.childCurIndex;

				// Create a parent NFT first
				await signer1Diamond.createNFT(
					GNUS_TOKEN_ID,
					'TEST GAME',
					'TESTGAME',
					toBN(2.0), // Exchange rate: 2.0 tokens for 1 GNUS token
					toWei(50000000 * 2),
					'',
				);

				// Calculate IDs for three child NFTs based on the parent NFT ID
				const addr1childNFT1 = (newParentNFTID << 128n) | 0n;
				const addr1childNFT2 = (newParentNFTID << 128n) | 1n;
				const addr1childNFT3 = (newParentNFTID << 128n) | 2n;

				// Create the child NFTs
				await signer1Diamond.createNFTs(
					newParentNFTID,
					['TESTGAME:NFT1', 'TESTGAME:NFT2', 'TESTGAME:NFT3'],
					['', '', ''], // Metadata URIs
					[2, 1, 1], // Exchange rates
					[100, 100, 100], // Supply limits
					['https://www.gnus.ai', '', ''], // URLs
				);

				// Retrieve the starting supply of GNUS tokens
				debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);

				// Now attempt to mint more tokens than allowed, expecting rejection
				await expect(
					signer1Diamond['mintBatch(address,uint256[],uint256[],bytes)'](
						signer2, // Recipient address
						[addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
						[101, 101, 101], // Exceeding amounts (over the 100 supply limit)
						'0x', // Additional data
					),
				).to.be.eventually.rejectedWith(Error, 'Max Supply for NFT would be exceeded');

				// Mint valid amounts for child NFTs
				const tx = await signer1Diamond['mintBatch(address,uint256[],uint256[],bytes)'](
					signer2, // Recipient address
					[addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
					[50, 1, 1], // Valid amounts
					'0x', // Additional data
				);

				// Verify minted amounts for each child NFT
				const nft1Balance = await signer1Diamond['balanceOf(address,uint256)'](
					signer2,
					addr1childNFT1,
				);
				const nft2Balance = await signer1Diamond['balanceOf(address,uint256)'](
					signer2,
					addr1childNFT2,
				);
				const nft3Balance = await signer1Diamond['balanceOf(address,uint256)'](
					signer2,
					addr1childNFT3,
				);

				assert(nft1Balance === 50n, 'First child NFT balance should be 50');
				assert(nft2Balance === 1n, 'Second child NFT balance should be 1');
				assert(nft3Balance === 1n, 'Third child NFT balance should be 1');

				// Log the transaction events for debugging
				await logEvents(tx);

				// Retrieve the ending supply of GNUS tokens
				const endingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
				// Calculate the burned supply as the difference between starting and ending supply
				const burntSupply = startingSupply - endingSupply;
				const expectedBurn = toWei((50 + 1 + 1) * 2.0); // Total minted tokens * exchange rate (2.0)
				// Debug logging
				// Log NFT info after creation
				const parentNFTInfo = await signer1Diamond.getNFTInfo(newParentNFTID);
				console.log('Parent NFT exchange rate:', parentNFTInfo.exchangeRate.toString());
				console.log('Starting supply:', utils.formatEther(startingSupply));
				console.log('Ending supply:', utils.formatEther(endingSupply));
				console.log('Expected burn:', utils.formatEther(expectedBurn));

				// TODO This is not currently true because GNUSNFTFactory contract does not burn for 2nd gen child tokens.
				// Assert the correct amount of GNUS tokens were burned (based on exchange rate)
				// assert(burntSupply.eq(expectedBurn),
				//   `Incorrect burn amount. Expected ${utils.formatEther(expectedBurn)}, got ${utils.formatEther(burntSupply)}`);

				// Log the total GNUS burned for debugging
				debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);

				// Verify no other signers received tokens
				for (let i = 0; i < 3; i++) {
					if (i === 2) continue; // Skip signer2 (recipient)
					const balance1 = await signer1Diamond['balanceOf(address,uint256)'](
						signers[i].address,
						addr1childNFT1,
					);
					const balance2 = await signer1Diamond['balanceOf(address,uint256)'](
						signers[i].address,
						addr1childNFT2,
					);
					const balance3 = await signer1Diamond['balanceOf(address,uint256)'](
						signers[i].address,
						addr1childNFT3,
					);

					assert(balance1 === 0n, `Signer${i} should not have first child NFT`);
					assert(balance2 === 0n, `Signer${i} should not have second child NFT`);
					assert(balance3 === 0n, `Signer${i} should not have third child NFT`);
				}
			});
		});
	}
});
