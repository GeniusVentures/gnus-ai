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

describe('GNUS Withdraw Limiter Storage Tests', async function () {
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
			let owner: SignerWithAddress;
			let user1: SignerWithAddress;
			let user2: SignerWithAddress;
			let geniusDiamond: GeniusDiamond;
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

				// Load the Diamond contract using the utility function
				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress! || '',
					hre.ethers,
				);

				ethersMultichain = ethers;
				ethersMultichain.provider = provider as any;

				signers = await ethersMultichain.getSigners();
				owner = signers[0];
				user1 = signers[1];
				user2 = signers[2];

				log('Diamond deployed at:', deployedDiamondData.DiamondAddress);
				log('Owner:', owner.address);
				log('User1:', user1.address);
				log('User2:', user2.address);
			});

			beforeEach(async function () {
				snapshotId = await ethers.provider.send('evm_snapshot', []);
			});

			afterEach(async function () {
				await ethers.provider.send('evm_revert', [snapshotId]);
			});

			describe('Bin Calculation', function () {
				it('should calculate bin length correctly', async function () {
					// Test: windowSeconds / binCount = binLength
					// FR-15: binLength = windowSeconds / binCount

					// Default config: 86400 seconds / 24 bins = 3600 seconds per bin
					const defaultWindowSeconds = 86400;
					const defaultBinCount = 24;
					const expectedBinLength = 3600;

					// Test with custom config
					const customWindowSeconds = 604800; // 1 week
					const customBinCount = 7; // 7 bins (1 day each)
					const expectedCustomBinLength = 86400;

					// Note: Actual calculation will be verified once storage contract is implemented
					// This test will call getAccountConfig and verify binLength calculation
					expect(defaultWindowSeconds / defaultBinCount).to.equal(expectedBinLength);
					expect(customWindowSeconds / customBinCount).to.equal(expectedCustomBinLength);
				});

				it('should calculate bin index using modulo arithmetic', async function () {
					// Test: ((currentTime - baseTimestamp) / binLengthSeconds) % binCount
					// FR-55

					const baseTimestamp = 1000000;
					const windowSeconds = 86400; // 24 hours
					const binCount = 24;
					const binLength = windowSeconds / binCount; // 3600 seconds

					// Test case 1: Current time is 3600 seconds after base (should be bin 1)
					const currentTime1 = baseTimestamp + 3600;
					const expectedBinIndex1 = 1;
					const calculatedBinIndex1 =
						Math.floor((currentTime1 - baseTimestamp) / binLength) % binCount;
					expect(calculatedBinIndex1).to.equal(expectedBinIndex1);

					// Test case 2: Current time is 14.5 hours after base (should be bin 14)
					const currentTime2 = baseTimestamp + 14.5 * 3600;
					const expectedBinIndex2 = 14;
					const calculatedBinIndex2 =
						Math.floor((currentTime2 - baseTimestamp) / binLength) % binCount;
					expect(calculatedBinIndex2).to.equal(expectedBinIndex2);

					// Test case 3: Current time wraps around (25 hours = bin 1)
					const currentTime3 = baseTimestamp + 25 * 3600;
					const expectedBinIndex3 = 1; // (25 hours / 1 hour per bin) % 24 = 1
					const calculatedBinIndex3 =
						Math.floor((currentTime3 - baseTimestamp) / binLength) % binCount;
					expect(calculatedBinIndex3).to.equal(expectedBinIndex3);
				});

				it('should handle bin wrap-around at array boundary', async function () {
					// Test: When binIndex reaches binCount, it wraps to 0
					// FR-30

					const baseTimestamp = 1000000;
					const binCount = 24;
					const binLength = 3600; // 1 hour per bin

					// Test multiple complete cycles
					for (let cycle = 0; cycle < 5; cycle++) {
						// After each complete cycle, should wrap back to bin 0
						const timeAtCycleStart = baseTimestamp + cycle * binCount * binLength;
						const binIndex =
							Math.floor((timeAtCycleStart - baseTimestamp) / binLength) % binCount;
						expect(binIndex).to.equal(0, `Cycle ${cycle} should wrap to bin 0`);

						// Verify each bin in the cycle
						for (let bin = 0; bin < binCount; bin++) {
							const timeInBin = timeAtCycleStart + bin * binLength;
							const calculatedBin =
								Math.floor((timeInBin - baseTimestamp) / binLength) % binCount;
							expect(calculatedBin).to.equal(
								bin,
								`Cycle ${cycle}, bin ${bin} should match`,
							);
						}
					}
				});
			});

			describe('Account State Initialization', function () {
				it('should initialize baseTimestamp on first withdrawal', async function () {
					// Test: First withdrawal sets baseTimestamp = block.timestamp
					// FR-4, FR-56
					// This test will verify that when an account makes its first withdrawal:
					// 1. baseTimestamp is set to current block.timestamp
					// 2. Bins array is initialized with binCount elements
					// 3. Current bin receives the withdrawal amount
					// Will be implemented once checkAndRecordWithdraw is available
					// const withdrawAmount = toWei('1000');
					// await expect(geniusDiamond.connect(user1).withdraw(withdrawAmount, nftId))
					//   .to.emit(geniusDiamond, 'WithdrawRecorded');
					// const state = await geniusDiamond.getAccountWithdrawStatus(user1.address);
					// expect(state.baseTimestamp).to.be.gt(0);
				});
			});

			describe('Bin Expiration and Cleanup', function () {
				it('should zero expired bins during validation', async function () {
					// Test: bin.timestamp < (currentTime - windowSeconds) => bin.totalAmount = 0
					// FR-28, FR-57

					const windowSeconds = 86400; // 24 hours
					const currentTime = 1100000;
					const windowCutoff = currentTime - windowSeconds; // 1100000 - 86400 = 1013600

					// Bins with timestamp < 1013600 should be zeroed
					const expiredBinTimestamp = 1000000; // < cutoff, should be expired
					const activeBinTimestamp = 1020000; // >= cutoff, should be active

					expect(expiredBinTimestamp < windowCutoff).to.be.true;
					expect(activeBinTimestamp >= windowCutoff).to.be.true;

					// Will implement actual storage test once zeroExpiredBins is available
				});
			});

			describe('Bin Aggregation', function () {
				it('should sum only active bins within window', async function () {
					// Test: Sum all bins where timestamp >= (currentTime - windowSeconds)
					// FR-7

					const windowSeconds = 86400;
					const currentTime = 1100000;
					const windowCutoff = currentTime - windowSeconds;

					// Example bins:
					// Bin 0: timestamp = 1000000, amount = 1000 (expired, should not count)
					// Bin 1: timestamp = 1020000, amount = 2000 (active, should count)
					// Bin 2: timestamp = 1050000, amount = 3000 (active, should count)
					// Expected sum: 2000 + 3000 = 5000

					// Will implement actual storage test once sumActiveBins is available
				});

				it('should accumulate withdrawals in current bin', async function () {
					// Test: Multiple withdrawals in same time period add to same bin
					// FR-6
					// Scenario:
					// - User withdraws 1000 GNUS at time T (bin index = 5)
					// - User withdraws 2000 GNUS at time T+100 (still bin index = 5)
					// - Bin 5 totalAmount should be 3000
					// Will implement actual storage test once checkAndRecordWithdraw is available
				});
			});

			describe('Limit Enforcement', function () {
				it('should revert when withdrawal exceeds limit', async function () {
					// Test: If sum(active bins) + requested amount > limit, revert
					// FR-9

					const limit = toWei('100000'); // 100,000 GNUS
					const activeBinsTotal = toWei('95000'); // Current usage
					const requestedAmount1 = toWei('4000'); // Should succeed (95000 + 4000 <= 100000)
					const requestedAmount2 = toWei('6000'); // Should fail (95000 + 6000 > 100000)

					// Will implement actual revert test once checkAndRecordWithdraw is available
					// await expect(geniusDiamond.connect(user1).withdraw(requestedAmount2, nftId))
					//   .to.be.revertedWith('Withdrawal limit exceeded for time window');
				});
			});

			describe('Configuration', function () {
				it('should use default config when account config is zero', async function () {
					// Test: accountConfig = {0, 0, 0} => use defaults
					// FR-12

					// Default values:
					const defaultBinCount = 24;
					const defaultWindowSeconds = 86400;
					const defaultLimitAmount = toWei('100000');

					// If account has no custom config (all zeros), should use these defaults
					// Will implement actual test once getAccountConfigOrDefaults is available
					// const config = await geniusDiamond.getAccountConfig(user1.address);
					// expect(config.binCount).to.equal(defaultBinCount);
					// expect(config.windowSeconds).to.equal(defaultWindowSeconds);
					// expect(config.limitAmount).to.equal(defaultLimitAmount);
				});
			});
		});
	}
});
