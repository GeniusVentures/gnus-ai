import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Diamond } from '@diamondslab/diamonds';
import {
	loadDiamondContract,
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { debug } from 'debug';
import { JsonRpcProvider } from 'ethers';
import hre, { ethers } from 'hardhat';
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';

chai.use(chaiAsPromised);

/**
 * Integration Tests for ERC-1155 Transfer Hook Limiter
 *
 * Tests withdrawal limiter integration with GNUSERC1155MaxSupply._beforeTokenTransfer hook.
 * This is the third and final integration point for comprehensive Sybil attack prevention.
 *
 * PRD References:
 * - FR-42: Apply limiter to all ERC-1155 transfers of GNUS tokens
 * - FR-43: Hook positioned after supply validation
 * - FR-44: Filter by GNUS_TOKEN_ID only
 * - FR-45: Support both single and batch transfers
 * - FR-46: Aggregate amounts in batch transfers
 */
describe('ERC-1155 Transfer Hook Limiter Integration Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
	this.timeout(0);

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
			let signer1: string;
			let signer2: string;
			let owner: string;
			let ownerSigner: SignerWithAddress;
			let geniusDiamond: GeniusDiamond;
			let signer1Diamond: GeniusDiamond;
			let signer2Diamond: GeniusDiamond;
			let ownerDiamond: GeniusDiamond;

			let ethersMultichain: typeof ethers;
			let snapshotId: string;

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

				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress! || '',
					hre.ethers,
				);

				ethersMultichain = ethers;
				ethersMultichain.provider = provider as any;

				signers = await ethersMultichain.getSigners();
				ownerSigner = signers[0];
				owner = ownerSigner.address;
				signer1 = signers[1].address;
				signer2 = signers[2].address;

				ownerDiamond = geniusDiamond.connect(ownerSigner);
				signer1Diamond = geniusDiamond.connect(signers[1]);
				signer2Diamond = geniusDiamond.connect(signers[2]);

				log('Diamond deployed at:', geniusDiamond.target);
				log('Owner:', owner);
				log('Signer1:', signer1);
				log('Signer2:', signer2);

				// Enable limiter with 100k GNUS limit
				await ownerDiamond.setLimiterEnabled(true);
				await ownerDiamond.setDefaultLimitAmount(toWei('100000'));
			});

			beforeEach(async function () {
				// Mint 200k GNUS to signer1 for testing (above limit)
				const mintTx = await ownerDiamond['mint(address,uint256)'](
					signer1,
					toWei('200000'),
				);
				await mintTx.wait();

				snapshotId = (await provider.send('evm_snapshot', [])) as string;
			});

			afterEach(async function () {
				await provider.send('evm_revert', [snapshotId]);
			});

			/**
			 * Test 5.1: safeTransferFrom should trigger limiter for GNUS_TOKEN_ID
			 * Verifies that single GNUS token transfers are checked against limiter
			 */
			it('should trigger limiter on safeTransferFrom for GNUS_TOKEN_ID', async function () {
				const transferAmount = toWei('50000'); // 50k GNUS

				// Transfer 50k GNUS from signer1 to signer2
				const transferTx = await signer1Diamond.safeTransferFrom(
					signer1,
					signer2,
					0,
					transferAmount,
					'0x',
				);
				await transferTx.wait();

				// Verify limiter recorded the withdrawal
				const [currentUsage] = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(currentUsage).to.equal(
					transferAmount,
					'Limiter should record 50k GNUS transfer',
				);
			});

			/**
			 * Test 5.2: safeBatchTransferFrom should aggregate amounts
			 * Verifies that batch transfers aggregate all GNUS amounts for limiter check
			 */
			it('should aggregate batch amounts and trigger limiter', async function () {
				const amount1 = toWei('30000'); // 30k
				const amount2 = toWei('20000'); // 20k
				const amount3 = toWei('10000'); // 10k
				const totalAmount = BigInt(amount1) + BigInt(amount2) + BigInt(amount3); // 60k total

				// Mint GNUS to owner for NFT creation (NFT creation burns GNUS)
				// Need to mint 100k GNUS to cover minting 100k NFTs at exchange rate 1
				await (await ownerDiamond['mint(address,uint256)'](owner, toWei('100000'))).wait();

				// Create NFT for batch testing
				const nftTx = await ownerDiamond.createNFT(
					0n,
					'Test NFT',
					'TNFT',
					1, // exchange rate
					toWei('1000000'),
					'ipfs://test',
				);
				const receipt = await nftTx.wait();
				const nftID = BigInt(1); // First created NFT

				// Mint NFTs to signer1
				await (
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						signer1,
						nftID,
						toWei('100000'),
						'0x',
					)
				).wait();

				// Batch transfer: GNUS (id=0) with multiple amounts, plus other NFT
				const ids = [0, 0, 0, nftID]; // Three GNUS transfers + one NFT
				const amounts = [amount1, amount2, amount3, toWei('1000')];

				const batchTx = await signer1Diamond.safeBatchTransferFrom(
					signer1,
					signer2,
					ids,
					amounts,
					'0x',
				);
				await batchTx.wait();

				// Verify limiter recorded aggregated GNUS amounts only (not NFT)
				const [currentUsage] = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(currentUsage).to.equal(
					totalAmount,
					'Limiter should aggregate 30k+20k+10k = 60k GNUS',
				);
			});

			/**
			 * Test 5.3: Super admin should bypass limiter in ERC-1155 transfers
			 * Verifies that contract owner transfers are not limited
			 */
			it('should allow super admin bypass for ERC-1155 transfers', async function () {
				const largeAmount = toWei('160000'); // 160k > 100k limit

				// Mint large amount to owner (super admin)
				await (await ownerDiamond['mint(address,uint256)'](owner, largeAmount)).wait();

				// Owner transfers 160k GNUS (should bypass limiter)
				const transferTx = await ownerDiamond.safeTransferFrom(
					owner,
					signer2,
					0,
					largeAmount,
					'0x',
				);
				await transferTx.wait();

				// Verify owner's usage is 0 (bypassed limiter)
				const [ownerUsage] = await geniusDiamond.getAccountWithdrawStatus(owner);
				expect(ownerUsage).to.equal(0, 'Super admin should bypass limiter');
			});

			/**
			 * Test 5.4: Should revert when ERC-1155 transfer exceeds limit
			 * Verifies that limiter blocks excessive transfers in hook
			 */
			it('should revert when ERC-1155 transfer exceeds limit', async function () {
				const transfer1 = toWei('95000'); // 95k
				const transfer2 = toWei('6000'); // 6k (total = 101k > 100k)

				// First transfer: 95k GNUS (within limit)
				await (
					await signer1Diamond.safeTransferFrom(signer1, signer2, 0, transfer1, '0x')
				).wait();

				// Second transfer: 6k GNUS (total 101k > 100k, should revert)
				await expect(
					signer1Diamond.safeTransferFrom(signer1, signer2, 0, transfer2, '0x'),
				).to.be.rejectedWith('Withdrawal limit exceeded for time window');
			});

			/**
			 * Test 5.5: Transfer hook should not affect minting
			 * Verifies that minting (from == address(0)) bypasses limiter
			 */
			it('should not trigger limiter on minting operations', async function () {
				// Mint 150k GNUS to signer1 (exceeds limit but it's minting, not transfer)
				const mintAmount = toWei('150000');
				const mintTx = await ownerDiamond['mint(address,uint256)'](signer1, mintAmount);
				await mintTx.wait();

				// Verify limiter was NOT triggered (usage should be 0 after snapshot revert)
				const [currentUsage] = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(currentUsage).to.equal(0, 'Minting should not trigger limiter');
			});

			/**
			 * Test 5.6: Transfer hook should not affect non-GNUS tokens
			 * Verifies that limiter only checks GNUS_TOKEN_ID (id=0)
			 */
			it('should not trigger limiter for non-GNUS token transfers', async function () {
				// Mint GNUS to owner for NFT creation (NFT creation burns GNUS)
				// Need to mint 150k GNUS to cover minting 150k NFTs at exchange rate 1
				await (await ownerDiamond['mint(address,uint256)'](owner, toWei('150000'))).wait();

				// Create and mint custom NFT
				const nftTx = await ownerDiamond.createNFT(
					0n,
					'Custom NFT',
					'CNFT',
					1, // exchange rate
					toWei('1000000'),
					'ipfs://custom',
				);
				const receipt = await nftTx.wait();
				const nftID = BigInt(1); // First created NFT

				const nftAmount = toWei('150000'); // 150k tokens
				await (
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						signer1,
						nftID,
						nftAmount,
						'0x',
					)
				).wait();

				// Transfer 150k of custom NFT (NOT GNUS, should not trigger limiter)
				const transferTx = await signer1Diamond.safeTransferFrom(
					signer1,
					signer2,
					nftID,
					nftAmount,
					'0x',
				);
				await transferTx.wait();

				// Verify limiter was NOT triggered
				const [currentUsage] = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(currentUsage).to.equal(0, 'Non-GNUS transfers should not trigger limiter');
			});

			/**
			 * Test 5.7: Disabled limiter should allow unlimited ERC-1155 transfers
			 * Verifies that disabled limiter doesn't block any transfers
			 */
			it('should allow unlimited ERC-1155 transfers when limiter disabled', async function () {
				// Disable limiter
				await ownerDiamond.setLimiterEnabled(false);

				const largeAmount = toWei('160000'); // 160k > 100k limit

				// Transfer 160k GNUS (should succeed with disabled limiter)
				const transferTx = await signer1Diamond.safeTransferFrom(
					signer1,
					signer2,
					0,
					largeAmount,
					'0x',
				);
				await transferTx.wait();

				// Verify usage is 0 (limiter disabled)
				const [currentUsage] = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(currentUsage).to.equal(0, 'Disabled limiter should not record usage');
			});
		});
	}
});
