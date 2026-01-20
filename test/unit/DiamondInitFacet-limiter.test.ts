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
 * Unit Tests for DiamondInitFacet Withdraw Limiter Initialization
 *
 * Tests the initialization of the GNUS withdrawal limiter system via DiamondInitFacet.
 * Verifies that default values are correctly set during Diamond initialization.
 *
 * Test Coverage:
 * - Default limit amount initialization (100,000 GNUS)
 * - Default window seconds initialization (86400 = 24 hours)
 * - Default bin count initialization (24 bins)
 * - Limiter enabled state initialization (true)
 * - InitLog event emission during initialization
 *
 * PRD References:
 * - FR-22: Initialize limiter during Diamond initialization
 * - FR-23: Call initialization in protocol initializer
 * - FR-24: Set default values (100k GNUS, 24 hours, 24 bins, enabled)
 */
describe('DiamondInitFacet Withdraw Limiter Initialization Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug(`GNUSDeploy:log:${diamondName}`);
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
			let owner: string;
			let ownerSigner: SignerWithAddress;
			let geniusDiamond: GeniusDiamond;
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

				ownerDiamond = geniusDiamond.connect(ownerSigner);

				log('Diamond deployed at:', geniusDiamond.target);
				log('Owner:', owner);
				initialSnapshotId = await ethers.provider.send('evm_snapshot', []);
			});

			beforeEach(async function () {
				snapshotId = await ethers.provider.send('evm_snapshot', []);
			});

			afterEach(async function () {
				await provider.send('evm_revert', [snapshotId]);
			});

			after(async function () {
				await ethers.provider.send('evm_revert', [initialSnapshotId]);
			});

			/**
			 * Test 6.1: Should initialize limiter with correct default values
			 * Verifies all default configuration values are set correctly during initialization
			 */
			it('should initialize limiter with correct default values', async function () {
				// Query the limiter configuration
				const [defaultLimitAmount, defaultWindowSeconds, defaultBinCount, limiterEnabled] =
					await geniusDiamond.getWithdrawLimiterConfig();

				// Verify default limit amount is 100,000 GNUS (100,000 * 10^18)
				expect(defaultLimitAmount).to.equal(
					toWei('100000'),
					'Default limit should be 100,000 GNUS',
				);

				// Verify default window is 86400 seconds (24 hours)
				expect(defaultWindowSeconds).to.equal(86400, 'Default window should be 24 hours');

				// Verify default bin count is 24 (hourly bins)
				expect(defaultBinCount).to.equal(24, 'Default bin count should be 24');
			});

			/**
			 * Test 6.2: Should set limiter enabled to true after initialization
			 * Verifies the limiter is enabled by default
			 */
			it('should set limiter enabled to true after initialization', async function () {
				// Query the limiter configuration
				const [, , , limiterEnabled] = await geniusDiamond.getWithdrawLimiterConfig();

				// Verify limiter is enabled by default
				expect(limiterEnabled).to.be.true;
			});

			/**
			 * Test 6.3: Should emit InitLog event during initialization
			 * Verifies that the initialization function emits the correct event
			 * Note: This test verifies the event is in the deployment transaction logs
			 */
			it('should have emitted InitLog event during deployment', async function () {
				// Get deployment transaction from diamond deployer
				const deployedDiamondData = diamond.getDeployedDiamondData();
				const diamondAddress = deployedDiamondData.DiamondAddress;

				// Query recent InitLog events from the contract
				// Note: The event should have been emitted during diamondInitialize250() call
				const filter = geniusDiamond.filters.InitLog();
				const events = await geniusDiamond.queryFilter(filter);

				// Verify at least one InitLog event was emitted
				expect(events.length).to.be.greaterThan(
					0,
					'InitLog event should have been emitted during initialization',
				);

				// Find the event with the initialization message
				const initEvent = events.find((e) => e.args?.initializer?.includes('Initialize'));

				// Verify the initialization event was found
				expect(initEvent).to.not.be.undefined;
				expect(initEvent?.args?.sender).to.equal(owner);
			});

			/**
			 * Additional test: Should allow querying account status after initialization
			 * Verifies that the limiter storage is properly initialized and queryable
			 */
			it('should allow querying account status after initialization', async function () {
				// Query withdrawal status for any account (should return zeros for unused account)
				const [currentUsage, remainingCapacity, windowEnd] =
					await geniusDiamond.getAccountWithdrawStatus(owner);

				// Verify initial state
				expect(currentUsage).to.equal(0, 'Initial usage should be 0');
				expect(remainingCapacity).to.equal(
					toWei('100000'),
					'Initial remaining capacity should equal default limit',
				);
				expect(windowEnd).to.be.greaterThan(0, 'Window end should be set');
			});

			/**
			 * Additional test: Should use initialized defaults for accounts without custom config
			 * Verifies that accounts without custom configuration use the initialized defaults
			 */
			it('should use initialized defaults for accounts without custom config', async function () {
				// Query account config for account that has no custom config
				const [binCount, windowSeconds, limitAmount] =
					await geniusDiamond.getAccountConfig(owner);

				// Verify defaults are used
				expect(binCount).to.equal(24, 'Should use default bin count');
				expect(windowSeconds).to.equal(86400, 'Should use default window seconds');
				expect(limitAmount).to.equal(toWei('100000'), 'Should use default limit amount');
			});
		});
	}
});
