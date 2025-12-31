/**
 * Test Template for GNUS AI Smart Contracts
 *
 * This template follows the established pattern from NFTFactory.test.ts
 * All tests must use LocalDiamondDeployer and loadDiamondContract utilities
 *
 * Usage:
 * 1. Replace [ContractName] with your contract name
 * 2. Add contract-specific test cases
 * 3. Follow the setup pattern for Diamond deployment
 * 4. Use EVM snapshots for test isolation
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
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

describe('[ContractName] Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug(`GNUSDeploy:log:${diamondName}`);
	this.timeout(0); // Extended indefinitely for diamond deployment time

	const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

	// Setup network providers for testing
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
			// Contract instances and signers
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

			// Setup: Deploy Diamond and initialize contract instances
			before(async function () {
				// Configure Diamond deployment
				const config = {
					diamondName: diamondName,
					networkName: networkName,
					provider: provider,
					chainId: (await provider.getNetwork()).chainId,
					writeDeployedDiamondData: false,
					configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
				} as LocalDiamondDeployerConfig;

				// Deploy Diamond using LocalDiamondDeployer
				const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
				await diamondDeployer.setVerbose(true);
				diamond = await diamondDeployer.getDiamondDeployed();
				const deployedDiamondData = diamond.getDeployedDiamondData();

				// Load the Diamond contract with full ABI
				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress! || '',
					hre.ethers,
				);

				// Setup ethers and provider
				ethersMultichain = hre.ethers;
				ethersMultichain.provider = provider as any;

				// Retrieve signers
				signers = await ethersMultichain.getSigners();
				signer0 = signers[0].address;
				signer1 = signers[1].address;
				signer2 = signers[2].address;

				// Connect signers to contract instances
				signer0Diamond = geniusDiamond.connect(signers[0]);
				signer1Diamond = geniusDiamond.connect(signers[1]);
				signer2Diamond = geniusDiamond.connect(signers[2]);

				// Setup owner
				owner = diamond.getDeployedDiamondData().DeployerAddress || '';
				if (!owner) {
					diamond.setSigner(signers[0]);
					owner = signer0;
					ownerSigner = signers[0];
				} else {
					ownerSigner = await ethersMultichain.getSigner(owner);
				}
				ownerDiamond = geniusDiamond.connect(ownerSigner);

				// Take initial snapshot
				snapshotId = await provider.send('evm_snapshot', []);
			});

			// Teardown: Revert to initial snapshot
			after(async () => {
				if (snapshotId) {
					await provider.send('evm_revert', [snapshotId]);
				}
			});

			// Before each test: Take snapshot
			beforeEach(async () => {
				snapshotId = await provider.send('evm_snapshot', []);
			});

			// After each test: Revert to snapshot
			afterEach(async () => {
				if (snapshotId) {
					await provider.send('evm_revert', [snapshotId]);
				}
			});

			// =================================================================
			// ADD YOUR TEST CASES BELOW
			// =================================================================

			describe('[Feature Group]', function () {
				it('should [expected behavior] (happy path)', async () => {
					// Arrange: Setup test data

					// Act: Execute function

					// Assert: Verify results
					assert(true, 'Test not implemented');
				});

				it('should reject [invalid action] (error condition)', async () => {
					// Test error condition
					await expect(signer1Diamond['someFunction']()).to.eventually.be.rejectedWith(
						Error,
						/Expected error message/,
					);
				});

				it('should handle [edge case]', async () => {
					// Test edge case
					assert(true, 'Test not implemented');
				});
			});

			// Add more describe blocks for different feature groups
		});
	}
});
