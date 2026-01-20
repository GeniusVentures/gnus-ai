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

describe('ERC20TransferBatch Limiter Integration Tests', async function () {
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
			let initialSnapshotId: string;
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

				initialSnapshotId = await ethers.provider.send('evm_snapshot', []);
			});

			beforeEach(async function () {
				// Mint GNUS tokens to signer1 for batch transfer tests
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

			after(async function () {
				await ethers.provider.send('evm_revert', [initialSnapshotId]);
			});

			// Test that transferBatch() aggregates amounts and triggers limiter
			it('should aggregate batch amounts and trigger limiter', async function () {
				const destinations = [signer2, signer2, signer2]; // Same destination multiple times
				const amounts = [toWei('30000'), toWei('20000'), toWei('10000')]; // Total: 60,000 GNUS

				// Initial status should be zero
				const initialStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);

				// Perform batch transfer
				await signer1Diamond.transferBatch(destinations, amounts);

				// Check that limiter recorded the total aggregated amount
				const finalStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);
				const usageIncrease = finalStatus.currentUsage - initialStatus.currentUsage;
				expect(usageIncrease).to.equal(toWei('60000')); // Sum of all amounts
			});

			// Test that transferBatch() allows super admin bypass
			it('should allow super admin bypass for batch transfers', async function () {
				// Owner mints themselves tokens
				const ownerMintTx = await ownerDiamond['mint(address,uint256)'](
					owner,
					toWei('200000'),
				);
				await ownerMintTx.wait();

				// Super admin transfers more than default limit (100k GNUS) in batch
				const destinations = [signer1, signer2];
				const amounts = [toWei('80000'), toWei('80000')]; // Total: 160,000 GNUS

				await expect(ownerDiamond.transferBatch(destinations, amounts)).to.not.be.reverted;

				// Check that super admin usage is NOT recorded
				const status = await geniusDiamond.getAccountWithdrawStatus(owner);
				expect(status.currentUsage).to.equal(0n);
			});

			// Test that batch transfers block when limit exceeded
			it('should revert when batch transfer exceeds limit', async function () {
				// First batch transfer close to limit
				const destinations1 = [signer2];
				const amounts1 = [toWei('95000')]; // 95,000 GNUS
				await signer1Diamond.transferBatch(destinations1, amounts1);

				// Second batch should exceed limit
				const destinations2 = [signer2, signer2];
				const amounts2 = [toWei('3000'), toWei('3000')]; // 6,000 GNUS (total would be 101,000)

				await expect(
					signer1Diamond.transferBatch(destinations2, amounts2),
				).to.be.revertedWith('Withdrawal limit exceeded for time window');
			});

			// Test that multiple batch transfers accumulate in bins
			it('should accumulate multiple batch transfers', async function () {
				// First batch
				await signer1Diamond.transferBatch([signer2], [toWei('10000')]);

				// Second batch
				await signer1Diamond.transferBatch(
					[signer2, signer2],
					[toWei('15000'), toWei('5000')],
				);

				// Third batch
				await signer1Diamond.transferBatch([signer2], [toWei('20000')]);

				// Total should be 50,000 GNUS
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(toWei('50000'));
				expect(status.remainingCapacity).to.equal(toWei('50000')); // 100k - 50k
			});

			// Test that transferOrBurnBatch also triggers limiter
			it('should trigger limiter on transferOrBurnBatch', async function () {
				const destinations = [signer2, ethers.ZeroAddress]; // Transfer and burn
				const amounts = [toWei('30000'), toWei('20000')]; // Total: 50,000 GNUS

				await signer1Diamond.transferOrBurnBatch(destinations, amounts);

				// Check that limiter recorded the total
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(toWei('50000'));
			});

			// Test that limiter can be disabled for batch transfers
			it('should allow unlimited batch transfers when limiter disabled', async function () {
				// Disable limiter
				await ownerDiamond.setLimiterEnabled(false);

				// Batch transfer way over limit
				const destinations = [signer2, signer2];
				const amounts = [toWei('80000'), toWei('80000')]; // 160,000 GNUS

				await expect(signer1Diamond.transferBatch(destinations, amounts)).to.not.be
					.reverted;

				// Re-enable for other tests
				await ownerDiamond.setLimiterEnabled(true);
			});
		});
	}
});
