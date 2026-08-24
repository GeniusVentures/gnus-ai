/**
 * @title Withdraw Limiter Gas Usage Comparison Tests
 * @notice Measures gas usage for different bin count configurations
 * @dev Tests GNUSTreasury and ERC20TransferBatch operations with varying bin counts
 *
 * Test Coverage:
 * - Bin counts: 6, 12, 24, 48, 96
 * - Operations: convert() (GNUS-terminal), bridgeOut(), transferBatch(), transferOrBurnBatch()
 * - Scenarios: first conversion (cold), subsequent conversion (warm), limit exceeded
 *
 * Output: CSV data for gas-coverage/withdraw-limiter-gas-comparison.md
 *
 * Phase 9 (09-05): withdraw() was removed (D4); the limiter is now exercised through
 * GNUSTreasury.convert() on its GNUS-terminal leg. Amounts are minion-denominated
 * (1:1, no exchange-rate math), so gas baselines differ from the withdraw-era figures:
 * convert is two supply ops (burn + mint) with an explicit limiter charge, no fee path.
 */

import {
	loadDiamondContract,
	LocalDiamondDeployer,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import hre, { ethers } from 'hardhat';
import type { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
import {
	SGNS_DESTINATION,
	SGNS_DESTINATION_Y_ODD,
	DEST_CHAIN_ID,
} from '../utils/bridge-fixtures';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';

interface GasResult {
	binCount: number;
	operation: string;
	scenario: string;
	gasUsed: bigint;
	success: boolean;
}

describe('Withdraw Limiter Gas Usage Comparison', function () {
	this.timeout(300000); // 5 minutes for comprehensive testing

	const networkName = 'hardhat';

	describe(`🔗 Chain: ${networkName}`, function () {
		let geniusDiamond: GeniusDiamond;
		let owner: SignerWithAddress;
		let user1: SignerWithAddress;
		let user2: SignerWithAddress;
		let user3: SignerWithAddress;

		const BIN_COUNTS = [6, 12, 24, 48, 96];
		const WINDOW_SECONDS = 86400; // 24 hours
		const LIMIT_AMOUNT = ethers.parseEther('100000'); // 100k GNUS
		const GNUS_TOKEN_ID = 0;
		const CHILD_NFT_ID = 1;
		const EXCHANGE_RATE = 100; // 100 NFTs = 1 GNUS

		let gasResults: GasResult[] = [];
		let initialSnapshotId: string;

		before(async function () {
				// 13-04: deploy GNUSLifecyclePolicy library + install factory linker before diamond deploy.
				await setupLifecyclePolicyLinking();
			// Deploy Diamond using LocalDiamondDeployer
			const config = { diamondName: 'GeniusDiamond', network: networkName };
			const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
			const diamond = await diamondDeployer.getDiamondDeployed();
			const deployedDiamondData = diamond.getDeployedDiamondData();
			const diamondAddress = deployedDiamondData.DiamondAddress || '';

			// Load the deployed diamond with full ABI
			geniusDiamond = await loadDiamondContract<GeniusDiamond>(
				diamond,
				diamondAddress,
				hre.ethers,
			);

			// Get signers
			const signers = await hre.ethers.getSigners();
			owner = signers[0];
			user1 = signers[1];
			user2 = signers[2];
			user3 = signers[3];

			initialSnapshotId = await ethers.provider.send('evm_snapshot', []);

			// Seed the provenance counter so the global-cap check in _mintWithBridgeFee
			// can run (reverts when uninitialized, Phase 9 D8/Pitfall 4). The GeniusDiamond
			// fixture is shared (cached) across suites, so a prior suite may already have
			// seeded the one-shot SetSeedSupply — guard on provenanceInitialized (slot +1).
			const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));
			const initialized = await ethers.provider.send('eth_getStorageAt', [
				diamondAddress,
				ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
			]);
			if (BigInt(initialized) === 0n) {
				await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
			}

			// Create child NFT for convert tests
			// createNFT(parentId, name, symbol, exchangeRate, maxSupply, uri)
			await geniusDiamond.createNFT(
				GNUS_TOKEN_ID, // parent = GNUS (tokenId 0)
				'Child NFT', // name
				'CNFT', // symbol
				EXCHANGE_RATE, // exchangeRate (display-only under the conversion-native model, D2)
				toWei(50000000), // maxSupply (50M tokens)
				'', // uri
			);

			console.log('      ✓ Test setup complete');
		});

		after(async function () {
			await ethers.provider.send('evm_revert', [initialSnapshotId]);
		});

		// Helper function to record gas usage
		function recordGas(
			binCount: number,
			operation: string,
			scenario: string,
			gasUsed: bigint,
			success: boolean,
		) {
			gasResults.push({ binCount, operation, scenario, gasUsed, success });
			console.log(
				`      📊 [${binCount} bins] ${operation} - ${scenario}: ${gasUsed.toString()} gas ${success ? '✓' : '✗'}`,
			);
		}

		// Helper function to setup user with tokens.
		// Phase 9: child minions are minted via the factory mint path (D10 restricts the
		// MINTER_ROLE 3-arg mint to id 0). The factory mint burns the CALLER's id-0
		// balance 1:1, so the owner funds themselves first, then mints to the user.
		async function setupUserWithTokens(
			user: SignerWithAddress,
			gnusAmount: bigint,
			nftAmount: bigint,
		) {
			// Mint GNUS tokens
			if (gnusAmount > 0n) {
				await geniusDiamond['mint(address,uint256)'](user.address, gnusAmount);
			}
			// Mint child NFT tokens (owner pays the 1:1 minion burn)
			if (nftAmount > 0n) {
				await geniusDiamond['mint(address,uint256)'](owner.address, nftAmount);
				await geniusDiamond['mint(address,uint256,uint256,bytes)'](
					user.address,
					CHILD_NFT_ID,
					nftAmount,
					'0x',
				);
			}
		}

		// Test each bin count configuration
		for (const binCount of BIN_COUNTS) {
			describe(`Bin Count: ${binCount}`, function () {
				let snapshotId: string;

				beforeEach(async function () {
					snapshotId = await ethers.provider.send('evm_snapshot', []);

					// Configure limiter with this bin count
					await geniusDiamond.setDefaultBinCount(binCount);
					await geniusDiamond.setDefaultWindowSeconds(WINDOW_SECONDS);
					await geniusDiamond.setDefaultLimitAmount(LIMIT_AMOUNT);
					await geniusDiamond.setLimiterEnabled(true);
				});

				afterEach(async function () {
					await ethers.provider.send('evm_revert', [snapshotId]);
				});

				describe('GNUSTreasury.convert() (GNUS-terminal)', function () {
					it(`should measure gas for first conversion (cold storage) - ${binCount} bins`, async function () {
						const nftAmount = ethers.parseEther('10000'); // 10k child minions = 10k GNUS (1:1)

						await setupUserWithTokens(user1, 0n, nftAmount);

						const tx = await geniusDiamond
							.connect(user1)
							.convert(CHILD_NFT_ID, GNUS_TOKEN_ID, nftAmount, user1.address);
						const receipt = await tx.wait();

						recordGas(binCount, 'convert()', 'first (cold)', receipt!.gasUsed, true);
					});

					it(`should measure gas for subsequent conversion (warm storage) - ${binCount} bins`, async function () {
						const nftAmount = ethers.parseEther('5000'); // 5k child minions each
						await setupUserWithTokens(user1, 0n, nftAmount * 2n);

						// First conversion to initialize storage
						await geniusDiamond
							.connect(user1)
							.convert(CHILD_NFT_ID, GNUS_TOKEN_ID, nftAmount, user1.address);

						// Advance time slightly (1 hour)
						await ethers.provider.send('evm_increaseTime', [3600]);
						await ethers.provider.send('evm_mine', []);

						// Second conversion (warm storage)
						const tx = await geniusDiamond
							.connect(user1)
							.convert(CHILD_NFT_ID, GNUS_TOKEN_ID, nftAmount, user1.address);
						const receipt = await tx.wait();

						recordGas(binCount, 'convert()', 'subsequent (warm)', receipt!.gasUsed, true);
					});

					it(`should measure gas for failed conversion (limit exceeded) - ${binCount} bins`, async function () {
						const nftAmount = ethers.parseEther('150000'); // 150k minions = 150k GNUS (exceeds 100k limit)
						await setupUserWithTokens(user1, 0n, nftAmount);

						try {
							const tx = await geniusDiamond
								.connect(user1)
								.convert(CHILD_NFT_ID, GNUS_TOKEN_ID, nftAmount, user1.address);
							const receipt = await tx.wait();
							recordGas(binCount, 'convert()', 'limit exceeded', receipt!.gasUsed, false);
						} catch (error: any) {
							// Get gas from error
							const gasUsed = error.receipt?.gasUsed || 0n;
							recordGas(binCount, 'convert()', 'limit exceeded', gasUsed, false);
						}
					});
				});

				describe('GNUSBridge.bridgeOut()', function () {
					it(`should measure gas for first bridgeOut (cold storage) - ${binCount} bins`, async function () {
						const gnusAmount = ethers.parseEther('10000'); // 10k GNUS
						await setupUserWithTokens(user1, gnusAmount, 0n);

						// Note: bridgeOut doesn't trigger limiter, but we measure it for comparison
						const tx = await geniusDiamond
							.connect(user1)
							.bridgeOut(
								gnusAmount,
								GNUS_TOKEN_ID,
								DEST_CHAIN_ID,
								SGNS_DESTINATION,
								SGNS_DESTINATION_Y_ODD,
							);
						const receipt = await tx.wait();

						recordGas(
							binCount,
							'bridgeOut()',
							'first (no limiter)',
							receipt!.gasUsed,
							true,
						);
					});
				});

				describe('ERC20TransferBatch.transferBatch()', function () {
					it(`should measure gas for first batch transfer (cold storage) - ${binCount} bins`, async function () {
						const totalAmount = ethers.parseEther('30000'); // 30k GNUS total
						const destinations = [user2.address, user3.address];
						const amounts = [ethers.parseEther('15000'), ethers.parseEther('15000')];

						await setupUserWithTokens(user1, totalAmount, 0n);

						const tx = await geniusDiamond
							.connect(user1)
							.transferBatch(destinations, amounts);
						const receipt = await tx.wait();

						recordGas(binCount, 'transferBatch()', 'first (cold)', receipt!.gasUsed, true);
					});

					it(`should measure gas for subsequent batch transfer (warm storage) - ${binCount} bins`, async function () {
						const totalAmount = ethers.parseEther('60000'); // 60k GNUS total
						const destinations = [user2.address, user3.address];
						const amounts = [ethers.parseEther('10000'), ethers.parseEther('10000')];

						await setupUserWithTokens(user1, totalAmount, 0n);

						// First transfer to initialize
						await geniusDiamond.connect(user1).transferBatch(destinations, amounts);

						// Advance time
						await ethers.provider.send('evm_increaseTime', [3600]);
						await ethers.provider.send('evm_mine', []);

						// Second transfer (warm)
						const tx = await geniusDiamond
							.connect(user1)
							.transferBatch(destinations, amounts);
						const receipt = await tx.wait();

						recordGas(
							binCount,
							'transferBatch()',
							'subsequent (warm)',
							receipt!.gasUsed,
							true,
						);
					});

					it(`should measure gas for failed batch transfer (limit exceeded) - ${binCount} bins`, async function () {
						const totalAmount = ethers.parseEther('120000'); // 120k GNUS (exceeds 100k limit)
						const destinations = [user2.address, user3.address];
						const amounts = [ethers.parseEther('60000'), ethers.parseEther('60000')];

						await setupUserWithTokens(user1, totalAmount, 0n);

						try {
							const tx = await geniusDiamond
								.connect(user1)
								.transferBatch(destinations, amounts);
							const receipt = await tx.wait();
							recordGas(
								binCount,
								'transferBatch()',
								'limit exceeded',
								receipt!.gasUsed,
								false,
							);
						} catch (error: any) {
							const gasUsed = error.receipt?.gasUsed || 0n;
							recordGas(binCount, 'transferBatch()', 'limit exceeded', gasUsed, false);
						}
					});
				});

				describe('ERC20TransferBatch.transferOrBurnBatch()', function () {
					it(`should measure gas for first transferOrBurnBatch (cold storage) - ${binCount} bins`, async function () {
						const totalAmount = ethers.parseEther('30000'); // 30k GNUS
						const destinations = [user2.address, ethers.ZeroAddress]; // Transfer + burn
						const amounts = [ethers.parseEther('20000'), ethers.parseEther('10000')];

						await setupUserWithTokens(user1, totalAmount, 0n);

						const tx = await geniusDiamond
							.connect(user1)
							.transferOrBurnBatch(destinations, amounts);
						const receipt = await tx.wait();

						recordGas(
							binCount,
							'transferOrBurnBatch()',
							'first (cold)',
							receipt!.gasUsed,
							true,
						);
					});

					it(`should measure gas for subsequent transferOrBurnBatch (warm storage) - ${binCount} bins`, async function () {
						const totalAmount = ethers.parseEther('60000'); // 60k GNUS
						const destinations = [user2.address, ethers.ZeroAddress];
						const amounts = [ethers.parseEther('10000'), ethers.parseEther('5000')];

						await setupUserWithTokens(user1, totalAmount, 0n);

						// First transfer
						await geniusDiamond.connect(user1).transferOrBurnBatch(destinations, amounts);

						// Advance time
						await ethers.provider.send('evm_increaseTime', [3600]);
						await ethers.provider.send('evm_mine', []);

						// Second transfer (warm)
						const tx = await geniusDiamond
							.connect(user1)
							.transferOrBurnBatch(destinations, amounts);
						const receipt = await tx.wait();

						recordGas(
							binCount,
							'transferOrBurnBatch()',
							'subsequent (warm)',
							receipt!.gasUsed,
							true,
						);
					});

					it(`should measure gas for failed transferOrBurnBatch (limit exceeded) - ${binCount} bins`, async function () {
						const totalAmount = ethers.parseEther('120000'); // 120k GNUS
						const destinations = [user2.address, ethers.ZeroAddress];
						const amounts = [ethers.parseEther('80000'), ethers.parseEther('40000')];

						await setupUserWithTokens(user1, totalAmount, 0n);

						try {
							const tx = await geniusDiamond
								.connect(user1)
								.transferOrBurnBatch(destinations, amounts);
							const receipt = await tx.wait();
							recordGas(
								binCount,
								'transferOrBurnBatch()',
								'limit exceeded',
								receipt!.gasUsed,
								false,
							);
						} catch (error: any) {
							const gasUsed = error.receipt?.gasUsed || 0n;
							recordGas(
								binCount,
								'transferOrBurnBatch()',
								'limit exceeded',
								gasUsed,
								false,
							);
						}
					});
				});
			});
		}

		after(function () {
			// Export results as CSV for report generation
			console.log('\n📊 Gas Usage Results Summary:\n');
			console.log('BinCount,Operation,Scenario,GasUsed,Success');
			for (const result of gasResults) {
				console.log(
					`${result.binCount},${result.operation},${result.scenario},${result.gasUsed},${result.success}`,
				);
			}

			// Generate summary statistics
			console.log('\n📈 Summary Statistics:\n');
			const operations = [
				'convert()',
				'bridgeOut()',
				'transferBatch()',
				'transferOrBurnBatch()',
			];
			const scenarios = ['first (cold)', 'subsequent (warm)', 'limit exceeded'];

			for (const operation of operations) {
				for (const scenario of scenarios) {
					const filtered = gasResults.filter(
						(r) => r.operation === operation && r.scenario.includes(scenario.split(' ')[0]),
					);
					if (filtered.length > 0) {
						const avgGas =
							filtered.reduce((sum, r) => sum + r.gasUsed, 0n) / BigInt(filtered.length);
						const minGas = filtered.reduce(
							(min, r) => (r.gasUsed < min ? r.gasUsed : min),
							filtered[0].gasUsed,
						);
						const maxGas = filtered.reduce(
							(max, r) => (r.gasUsed > max ? r.gasUsed : max),
							filtered[0].gasUsed,
						);
						console.log(`${operation} - ${scenario}:`);
						console.log(`  Average: ${avgGas.toString()} gas`);
						console.log(`  Range: ${minGas.toString()} - ${maxGas.toString()} gas`);
						if (minGas > 0n) {
							console.log(
								`  Difference: ${(maxGas - minGas).toString()} gas (${Number(((maxGas - minGas) * 100n) / minGas)}% increase)`,
							);
						} else {
							console.log(
								`  Difference: ${(maxGas - minGas).toString()} gas (N/A - minGas is 0)`,
							);
						}
					}
				}
			}
		});
	});
});
