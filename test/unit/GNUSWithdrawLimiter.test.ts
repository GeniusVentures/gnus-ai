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

describe('GNUS Withdraw Limiter Facet Tests', async function () {
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
			let initialSnapshotId: string;

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
				initialSnapshotId = await ethers.provider.send('evm_snapshot', []);
			});

			beforeEach(async function () {
				// Take snapshot before each test for isolation
				snapshotId = (await provider.send('evm_snapshot', [])) as string;
			});

			afterEach(async function () {
				// Revert to snapshot after each test
				await provider.send('evm_revert', [snapshotId]);
			});

			after(async function () {
				// Final revert to clean up
				await ethers.provider.send('evm_revert', [initialSnapshotId]);
			});

			// Task 2.1: Test initialization with defaults (FR-24)
			it('should initialize limiter with correct default values', async function () {
				const config = await ownerDiamond.getWithdrawLimiterConfig();
				expect(config.defaultLimitAmount).to.equal(toWei('100000')); // 100,000 GNUS
				expect(config.defaultWindowSeconds).to.equal(86400n); // 1 day
				expect(config.defaultBinCount).to.equal(24n); // hourly bins
			});

			// Task 2.2: Test setDefaultLimitAmount (FR-19)
			it('should allow super admin to set default limit amount', async function () {
				const newLimit = toWei('200000'); // 200,000 GNUS
				await ownerDiamond.setDefaultLimitAmount(newLimit);

				const config = await ownerDiamond.getWithdrawLimiterConfig();
				expect(config.defaultLimitAmount).to.equal(newLimit);
			});

			// Task 2.3: Test setDefaultWindowSeconds (FR-19)
			it('should allow super admin to set default window seconds', async function () {
				const sevenDays = 7n * 24n * 60n * 60n; // 7 days in seconds
				await ownerDiamond.setDefaultWindowSeconds(sevenDays);

				const config = await ownerDiamond.getWithdrawLimiterConfig();
				expect(config.defaultWindowSeconds).to.equal(sevenDays);
			});

			// Task 2.5: Test setDefaultBinCount with validation (FR-19)
			it('should allow super admin to set default bin count with validation', async function () {
				const newBinCount = 48n; // twice-hourly bins
				await ownerDiamond.setDefaultBinCount(newBinCount);

				const config = await ownerDiamond.getWithdrawLimiterConfig();
				expect(config.defaultBinCount).to.equal(newBinCount);

				// Test validation: binCount must be > 0
				await expect(ownerDiamond.setDefaultBinCount(0n)).to.be.revertedWith(
					'Bin count must be greater than 0',
				);
			});

			// Task 2.6: Test setAccountConfig (FR-11, FR-20)
			it('should allow super admin to set per-account config', async function () {
				const customBinCount = 12n;
				const customWindowSeconds = 43200n; // 12 hours
				const customLimitAmount = toWei('50000'); // 50,000 GNUS

				await ownerDiamond.setAccountConfig(
					signer0,
					customBinCount,
					customWindowSeconds,
					customLimitAmount,
				);

				const config0 = await ownerDiamond.getAccountConfig(signer0);
				expect(config0.binCount).to.equal(customBinCount);
				expect(config0.windowSeconds).to.equal(customWindowSeconds);
				expect(config0.limitAmount).to.equal(customLimitAmount);

				// Verify signer1 still has defaults
				const config1 = await ownerDiamond.getAccountConfig(signer1);
				expect(config1.binCount).to.equal(24n); // default
				expect(config1.windowSeconds).to.equal(86400n); // default
				expect(config1.limitAmount).to.equal(toWei('100000')); // default
			});

			// Task 2.7: Test setLimiterEnabled (FR-17)
			it('should allow super admin to enable/disable limiter globally', async function () {
				// Disable limiter
				await ownerDiamond.setLimiterEnabled(false);
				const configDisabled = await ownerDiamond.getWithdrawLimiterConfig();
				expect(configDisabled.limiterEnabled).to.be.false;

				// Re-enable limiter
				await ownerDiamond.setLimiterEnabled(true);
				const configEnabled = await ownerDiamond.getWithdrawLimiterConfig();
				expect(configEnabled.limiterEnabled).to.be.true;
			});

			// Task 2.8: Test getAccountWithdrawStatus (FR-14)
			it('should return correct account withdrawal status', async function () {
				// This test will be fully implemented after integration with GNUSBridge
				// For now, test with zero usage (no withdrawals yet)
				const status = await ownerDiamond.getAccountWithdrawStatus(signer0);
				expect(status.currentUsage).to.equal(0n);
				expect(status.remainingCapacity).to.equal(toWei('100000')); // full default limit
			});

			// Task 2.9: Test WithdrawLimiterConfigUpdated event (FR-49)
			it('should emit WithdrawLimiterConfigUpdated event', async function () {
				const newLimit = toWei('300000');
				const tx = await ownerDiamond.setDefaultLimitAmount(newLimit);
				await expect(tx).to.emit(ownerDiamond, 'WithdrawLimiterConfigUpdated');
			});

			// Task 2.10: Test AccountConfigUpdated event (FR-50)
			it('should emit AccountConfigUpdated event', async function () {
				const tx = await ownerDiamond.setAccountConfig(
					signer0,
					12n,
					43200n,
					toWei('50000'),
				);
				await expect(tx)
					.to.emit(ownerDiamond, 'AccountConfigUpdated')
					.withArgs(signer0, 12n, 43200n, toWei('50000'));
			});

			// Task 2.11: Test access control (FR-16)
			it('should revert when non-admin tries to configure', async function () {
				// Use signer0Diamond (non-admin) to try administrative functions
				await expect(signer0Diamond.setDefaultLimitAmount(toWei('999999'))).to.be.reverted;
				await expect(signer0Diamond.setDefaultWindowSeconds(999999n)).to.be.reverted;
				await expect(signer0Diamond.setDefaultBinCount(999n)).to.be.reverted;
				await expect(signer0Diamond.setAccountConfig(signer1, 12n, 43200n, toWei('50000')))
					.to.be.reverted;
				await expect(signer0Diamond.setLimiterEnabled(false)).to.be.reverted;
			});
		});
	}
});
