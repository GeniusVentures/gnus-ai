import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { debuglog } from 'util';
import { GNUS_TOKEN_ID } from '../../scripts/common';
import { iObjToString } from '../../scripts/utils/iObjToString';
import { logEvents } from '../../scripts/utils/logEvents';

import { Diamond } from '@diamondslab/diamonds';
import {
	loadDiamondContract,
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { assert, expect } from 'chai';
import { debug } from 'debug';
import { formatEther, id, JsonRpcProvider } from 'ethers';
import hre, { ethers } from 'hardhat';
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';

// Create utils object for compatibility
const utils = { formatEther, id };

// Helper function to replace toBN - in ethers v6 we use BigInt directly
const toBN = (value: number | string) => BigInt(Math.floor(Number(value) * 1e18));

chai.use(chaiAsPromised);

describe('NFT Factory Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug(`GNUSDeploy:log:${diamondName}`);
	this.timeout(0); // Extended indefinitely for diamond deployment time

	const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

	if (process.argv.includes('test-multichain')) {
		const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
		if (networkNames.includes('hardhat')) {
			networkProviders.set('hardhat', hre.ethers.provider as any);
		}
	} else if (process.argv.includes('test') || process.argv.includes('coverage')) {
		networkProviders.set('hardhat', hre.ethers.provider as any);
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
				const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
				await diamondDeployer.setVerbose(true);
				diamond = await diamondDeployer.getDiamondDeployed();
				const deployedDiamondData = diamond.getDeployedDiamondData();

				// Load the Diamond contract using the utility function
				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress! || '',
					hre.ethers,
				);

				ethersMultichain = hre.ethers;
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

				// Seed the provenance counter so the global-cap check in
				// _mintWithBridgeFee can run (reverts when uninitialized, Phase 9 D8/Pitfall 4).
				await ownerDiamond.GNUSTreasury_Initialize260(0n);

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
				// // Ensure signer1 doesn't have CREATOR_ROLE (may persist from other test files)
				// const CREATOR_ROLE = utils.id('CREATOR_ROLE');
				// const hasRole = await signer1Diamond.hasRole(CREATOR_ROLE, signer1);
				// if (hasRole) {
				// 	await ownerDiamond.revokeRole(CREATOR_ROLE, signer1);
				// }

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

				// Assert the mint transaction succeeded (receipt status === 1)
				const receipt = await tx.wait();
				assert(
					receipt !== null && receipt.status === 1,
					'Child NFT mint transaction should succeed',
				);

				// Log the transaction events for debugging
				await logEvents(tx);
			});

			// Test case to validate the correct amount of GNUS is burned for a 1st gen (direct child of GNUS) mint
			it('Should burn correct GNUS supply for 1st gen (direct child of GNUS) NFT mint', async () => {
				// Self-contained setup: each mocha test must not share mutable locals.
				await ownerDiamond['mint(address,uint256)'](signer1, toWei(1000));
				await ownerDiamond.grantRole(utils.id('CREATOR_ROLE'), signer1);
				await ownerDiamond.grantRole(utils.id('MINTER_ROLE'), signer1);

				// Derive the next parent NFT ID from on-chain state
				const GNUSNFTInfo = await signer1Diamond.getNFTInfo(GNUS_TOKEN_ID);
				const newParentNFTID = GNUSNFTInfo.childCurIndex;

				// Create a fresh parent NFT with the same exchange rate as the previous test
				await signer1Diamond.createNFT(
					GNUS_TOKEN_ID,
					'TEST GAME',
					'TESTGAME',
					2.0, // Exchange rate: 2.0 tokens for 1 GNUS token
					toWei(50000000 * 2),
					'',
				);

				// Snapshot GNUS supply before the mint
				const startingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

				// Perform an identical 1st-gen child mint (signer2 recipient, 5 tokens)
				await signer1Diamond['mint(address,uint256,uint256,bytes)'](
					signer2, // Recipient address
					newParentNFTID, // Parent NFT ID
					toWei(5), // Amount to mint
					'0x', // Additional data
				);

				// Retrieve the ending supply of GNUS tokens
				const endingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

				// Calculate the burned supply as the difference between starting and ending supply
				const burntSupply = startingSupply - endingSupply;

				// Assert that the burned supply matches the minted minion amount (1:1, D1 —
				// the exchange rate is display-only and never applied in state transitions)
				assert(
					BigInt(burntSupply) === toWei(5.0),
					`Burnt Supply should equal minted minions (5.0, 1:1), but equals ${burntSupply.toString()}`,
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

				// Now attempt to mint more tokens than allowed, expecting rejection.
				// Phase 9 (D6): depth >= 2 mints hit the depth gate before the max-supply
				// check, so the revert reason is the depth-gate message.
				await expect(
					signer1Diamond['mintBatch(address,uint256[],uint256[],bytes)'](
						signer2, // Recipient address
						[addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
						[101, 101, 101], // Exceeding amounts (over the 100 supply limit)
						'0x', // Additional data
					),
				).to.be.eventually.rejectedWith(
					Error,
					'Direct children only; use convert() for descendants',
				);

				// Mint valid amounts for child NFTs.
				// Phase 9 (D6): minting a depth >= 2 id reverts with the depth gate — deeper
				// issuance goes through GNUSTreasury.convert() from the parent holder.
				await expect(
					signer1Diamond['mintBatch(address,uint256[],uint256[],bytes)'](
						signer2, // Recipient address
						[addr1childNFT1, addr1childNFT2, addr1childNFT3], // Child NFT IDs
						[50, 1, 1], // Amounts within the 100-supply limit
						'0x', // Additional data
					),
				).to.be.eventually.rejectedWith(
					Error,
					'Direct children only; use convert() for descendants',
				);

				// Deeper issuance via convert: signer1 holds 1,000 GNUS; converting GNUS ->
				// grandchild directly is allowed (convert is permissionless on holdings, D3).
				await signer1Diamond.convert(GNUS_TOKEN_ID, addr1childNFT1, 52, signer1);

				// Verify converted amounts (1:1 minions)
				const nft1Balance = await signer1Diamond['balanceOf(address,uint256)'](
					signer1,
					addr1childNFT1,
				);

				assert(nft1Balance === 52n, 'First child NFT balance should be 52 (converted 1:1)');

				// Retrieve the ending supply of GNUS tokens
				const endingSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
				// Calculate the supply delta as the difference between starting and ending supply.
				// The batch mint reverted (depth gate) and convert() is supply-neutral tree-wide
				// (D3): free GNUS decreased only by the 52 wei converted into the grandchild.
				const burntSupply = startingSupply - endingSupply;
				// Debug logging
				// Log NFT info after creation
				const parentNFTInfo = await signer1Diamond.getNFTInfo(newParentNFTID);
				console.log('Parent NFT exchange rate:', parentNFTInfo.exchangeRate.toString());
				console.log('Starting supply:', utils.formatEther(startingSupply));
				console.log('Ending supply:', utils.formatEther(endingSupply));

				// Phase 9 (D3/D6): depth >= 2 mints revert; convert() moves exactly the
				// converted minion amount out of free GNUS into the grandchild supply.
				assert(
					burntSupply === 52n,
					`2nd gen issuance via convert should move exactly 52 minions out of free GNUS, but moved ${utils.formatEther(burntSupply)}`,
				);

				// Log the total GNUS burned for debugging
				debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);

				// Verify no other signers received tokens
				for (let i = 0; i < 3; i++) {
					if (i === 1) continue; // Skip signer1 (converter/recipient)
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
