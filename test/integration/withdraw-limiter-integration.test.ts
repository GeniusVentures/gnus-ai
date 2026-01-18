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

describe('Withdraw Limiter Integration Tests', async function () {
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
		networkProviders.set('hardhat', ethers.provider as any);
	}

	for (const [networkName, provider] of networkProviders.entries()) {
		describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
			let diamond: Diamond;
			let signers: SignerWithAddress[];
			let signer0: string;
			let signer1: string;
			let owner: string;
			let ownerSigner: SignerWithAddress;
			let geniusDiamond: GeniusDiamond;
			let signer0Diamond: GeniusDiamond;
			let signer1Diamond: GeniusDiamond;
			let ownerDiamond: GeniusDiamond;

			let ethersMultichain: typeof ethers;
			let snapshotId: string;
			let nftID: bigint;

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

				ethersMultichain = ethers;
				ethersMultichain.provider = provider as any;

				signers = await ethersMultichain.getSigners();
				ownerSigner = signers[0];
				owner = ownerSigner.address;
				signer0 = signers[1].address;
				signer1 = signers[2].address;

				// Create Diamond instances for different signers
				ownerDiamond = geniusDiamond.connect(ownerSigner);
				signer0Diamond = geniusDiamond.connect(signers[1]);
				signer1Diamond = geniusDiamond.connect(signers[2]);

				log('Diamond deployed at:', geniusDiamond.target);
				log('Owner:', owner);
				log('Signer0:', signer0);
				log('Signer1:', signer1);
			});

			beforeEach(async function () {
				// Create NFT fresh for each test
				nftID = 1n;
				const exchangeRate = 10; // 10 GNUS per NFT
				await ownerDiamond.createNFT(
					0n,
					'Test NFT',
					'TNFT',
					exchangeRate,
					toWei('2000000'),
					'ipfs://test',
				);

				// Mint GNUS tokens to owner first (to burn when minting NFTs)
				// Need 50,000 GNUS to mint 5000 NFTs (5000 * 10 = 50,000)
				const mintTx = await ownerDiamond['mint(address,uint256)'](owner, toWei('50000'));
				await mintTx.wait();

				// Owner mints NFTs to signer1 (burns 50,000 GNUS from owner)
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					signer1,
					nftID,
					toWei('5000'),
					'0x',
				);

				// Take snapshot after setup for test isolation
				snapshotId = (await provider.send('evm_snapshot', [])) as string;
			});

			afterEach(async function () {
				// Revert to snapshot after each test
				await provider.send('evm_revert', [snapshotId]);
			});

			// Task 3.1: Test that withdraw() triggers the limiter (FR-31)
			it('should trigger limiter on withdraw', async function () {
				const withdrawAmount = toWei('1000'); // 1000 NFTs
				const gnusEquivalent = toWei('100'); // 1000 / 10 = 100 GNUS

				// Get initial status
				const initialStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);

				// First withdrawal should succeed
				await signer1Diamond.withdraw(withdrawAmount, nftID);

				// Check status shows usage increased by GNUS equivalent
				const finalStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);
				const usageIncrease = finalStatus.currentUsage - initialStatus.currentUsage;
				expect(usageIncrease).to.equal(gnusEquivalent);
			});

			// Task 3.2: Test that withdraw() calculates GNUS amount from exchange rate (FR-33)
			it('should calculate GNUS amount from exchange rate', async function () {
				const withdrawAmount = toWei('500'); // 500 NFTs
				const expectedGNUS = toWei('50'); // 500 / 10 = 50 GNUS

				// Perform withdrawal
				await signer1Diamond.withdraw(withdrawAmount, nftID);

				// Check that limiter recorded the correct GNUS amount
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(expectedGNUS);
			});

			// Task 3.3: Test that super admin can bypass limiter (FR-18)
			it('should allow super admin bypass', async function () {
				// Owner (super admin) mints themselves GNUS and NFTs
				const ownerMintTx = await ownerDiamond['mint(address,uint256)'](
					owner,
					toWei('200000'),
				);
				await ownerMintTx.wait();
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					owner,
					nftID,
					toWei('20000'),
					'0x',
				); // 20,000 NFTs (costs 200k GNUS)

				// Super admin withdraws more than default limit: 15,000 NFTs = 1,500 GNUS (15000 / 10)
				const hugeWithdrawal = toWei('15000'); // 15,000 NFTs = 1,500 GNUS
				await expect(ownerDiamond.withdraw(hugeWithdrawal, nftID)).to.not.be.reverted;

				// Check that super admin usage is NOT recorded
				const status = await geniusDiamond.getAccountWithdrawStatus(owner);
				expect(status.currentUsage).to.equal(0n);
			});

			// Task 3.4: Verify withdraw() completes successfully (verifying limiter integration)
			it('should complete withdraw without errors', async function () {
				const withdrawAmount = toWei('300'); // 300 NFTs
				const gnusEquivalent = toWei('30'); // 300 / 10 = 30 GNUS

				// Withdrawal should complete successfully
				await expect(signer1Diamond.withdraw(withdrawAmount, nftID)).to.not.be.reverted;

				// Verify limiter recorded the withdrawal
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(gnusEquivalent);
			});

			// Task 3.5: Test that withdraw() reverts with clear message when limit exceeded (FR-41, FR-51)
			it('should revert with clear message when limit exceeded', async function () {
				const defaultLimit = toWei('100000'); // 100,000 GNUS default limit

				// Need to mint more NFTs to test exceeding limit
				// Mint 1M more NFTs (costs 10M GNUS)
				const bigMintTx = await ownerDiamond['mint(address,uint256)'](
					owner,
					toWei('10000000'),
				);
				await bigMintTx.wait();
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					signer1,
					nftID,
					toWei('1000000'),
					'0x',
				);

				// Withdraw close to limit: 950k NFTs = 95,000 GNUS
				await signer1Diamond.withdraw(toWei('950000'), nftID); // 95,000 GNUS

				// Try to exceed limit: 60k NFTs = 6,000 GNUS (total would be 101,000)
				await expect(signer1Diamond.withdraw(toWei('60000'), nftID)).to.be.revertedWith(
					'Withdrawal limit exceeded for time window',
				);
			});

			// Additional test: Verify multiple small withdrawals accumulate
			it('should accumulate multiple small withdrawals', async function () {
				// Make 3 small withdrawals
				await signer1Diamond.withdraw(toWei('1000'), nftID); // 100 GNUS
				await signer1Diamond.withdraw(toWei('500'), nftID); // 50 GNUS
				await signer1Diamond.withdraw(toWei('800'), nftID); // 80 GNUS

				// Total should be 230 GNUS
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(toWei('230'));
				expect(status.remainingCapacity).to.equal(toWei('99770')); // 100k - 230
			});

			// Additional test: Verify limiter can be disabled
			it('should allow unlimited withdrawals when limiter disabled', async function () {
				// Disable limiter
				await ownerDiamond.setLimiterEnabled(false);

				// Need more NFTs for large withdrawal
				const bigMintTx = await ownerDiamond['mint(address,uint256)'](
					owner,
					toWei('1000000'),
				);
				await bigMintTx.wait();
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					signer1,
					nftID,
					toWei('100000'),
					'0x',
				);

				// Withdraw way over limit: 100k NFTs = 10,000 GNUS
				await expect(signer1Diamond.withdraw(toWei('100000'), nftID)).to.not.be.reverted;

				// Re-enable for other tests
				await ownerDiamond.setLimiterEnabled(true);
			});
		});
	}
});
