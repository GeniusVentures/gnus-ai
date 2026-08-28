import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Diamond } from '@geniusventures/diamonds';
import {
	loadDiamondContract,
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { debug } from 'debug';
import { JsonRpcProvider } from 'ethers';
import hre, { ethers } from 'hardhat';
import { multichain } from '@geniusventures/hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';

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
			let snapshotId_1: string;
			let snapshotId_2: string;
			let nftID: bigint;

			before(async function () {
				// 13-04: deploy GNUSLifecyclePolicy library + install factory linker before diamond deploy.
				await setupLifecyclePolicyLinking();
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

				// Take snapshot after setup for test isolation
				snapshotId_1 = (await provider.send('evm_snapshot', [])) as string;
			});

			beforeEach(async function () {
				// Snapshot BEFORE setup so the afterEach revert restores the pre-initialized
				// provenance state (GNUSTreasury_SetSeedSupply is one-shot; a post-setup
				// snapshot would carry provenanceInitialized=true into the next test).
				snapshotId_2 = (await provider.send('evm_snapshot', [])) as string;

				// Phase 9 (09-05): seed the provenance counter so the global-cap check in
				// _mintWithBridgeFee can run (reverts when uninitialized per D8/Pitfall 4).
				// The GeniusDiamond fixture is shared (cached) across suites, so a prior
				// suite may already have seeded the one-shot SetSeedSupply — guard on
				// provenanceInitialized (slot +1).
				const TREASURY_STORAGE_SLOT = ethers.keccak256(
					ethers.toUtf8Bytes('gnus.ai.treasury.storage'),
				);
				const initialized = await provider.send('eth_getStorageAt', [
					geniusDiamond.target as string,
					ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
				]);
				if (BigInt(initialized) === 0n) {
					await ownerDiamond.GNUSTreasury_SetSeedSupply(0n);
				}

				// Create NFT fresh for each test
				nftID = 1n;
				// exchangeRate is display-only under the conversion-native model (D2); the
				// limiter is charged in minions directly (no rate math in state transitions).
				const exchangeRate = 10;
				await ownerDiamond.createNFT(
					0n,
					'Test NFT',
					'TNFT',
					exchangeRate,
					toWei('2000000'),
					'ipfs://test',
				);
				// Mint GNUS tokens to owner first (to burn when minting NFTs).
				// Minion-for-minion: minting 5000 child minions burns exactly 5000 GNUS (D1).
				const mintTx = await ownerDiamond['mint(address,uint256)'](owner, toWei('50000'));
				await mintTx.wait();

				// Owner mints NFTs to signer1 (burns 5,000 GNUS from owner)
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					signer1,
					nftID,
					toWei('5000'),
					'0x',
				);
			});

			afterEach(async function () {
				// Revert to snapshot after each test
				await provider.send('evm_revert', [snapshotId_2]);
			});

			after(async function () {
				// Final revert to clean up
				await provider.send('evm_revert', [snapshotId_1]);
			});

			// Test that convert() to GNUS triggers the limiter check
			it('should trigger limiter on convert', async function () {
				const convertAmount = toWei('1000'); // 1000 child minions -> 1000 GNUS minions (1:1)

				// Get initial status
				const initialStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);

				// First conversion should succeed
				await signer1Diamond.convert(nftID, 0n, convertAmount, signer1);

				// Check status shows usage increased by the minion amount
				const finalStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);
				const usageIncrease = finalStatus.currentUsage - initialStatus.currentUsage;
				expect(usageIncrease).to.equal(convertAmount);
			});

			// Test that convert() charges the limiter in minions (no exchange-rate math, D1/D2)
			it('should charge the limiter in minions (1:1, rate never applied)', async function () {
				const convertAmount = toWei('500'); // 500 child minions

				// Perform conversion
				await signer1Diamond.convert(nftID, 0n, convertAmount, signer1);

				// Check that limiter recorded the exact minion amount
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(convertAmount);
			});

			// Test that super admin can bypass limiter
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
					toWei('200000'),
					'0x',
				); // 200,000 child minions (costs 200k GNUS, 1:1)

				// Super admin converts more than default limit (100k GNUS)
				const hugeConversion = toWei('150000'); // 150,000 minions = 150,000 GNUS > 100k limit
				await expect(ownerDiamond.convert(nftID, 0n, hugeConversion, owner)).to.not.be
					.reverted;

				// Check that super admin usage is NOT recorded
				const status = await geniusDiamond.getAccountWithdrawStatus(owner);
				expect(status.currentUsage).to.equal(0n);
			});

			// Verify convert() completes successfully (verifying limiter integration)
			it('should complete convert without errors', async function () {
				const convertAmount = toWei('300'); // 300 child minions -> 300 GNUS

				// Conversion should complete successfully
				await expect(signer1Diamond.convert(nftID, 0n, convertAmount, signer1)).to.not.be
					.reverted;

				// Verify limiter recorded the conversion
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(convertAmount);
			});

			// Test that convert() reverts with clear message when limit exceeded
			it('should revert with clear message when limit exceeded', async function () {
				// Need more child minions to test exceeding the 100k GNUS default limit.
				// Mint 150k more GNUS to owner and convert to child minions for signer1.
				const bigMintTx = await ownerDiamond['mint(address,uint256)'](
					owner,
					toWei('150000'),
				);
				await bigMintTx.wait();
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					signer1,
					nftID,
					toWei('150000'),
					'0x',
				);

				// Convert close to limit: 95,000 minions = 95,000 GNUS
				await signer1Diamond.convert(nftID, 0n, toWei('95000'), signer1);

				// Try to exceed limit: 6,000 more (total would be 101,000 > 100,000)
				await expect(
					signer1Diamond.convert(nftID, 0n, toWei('6000'), signer1),
				).to.be.revertedWith('Withdrawal limit exceeded for time window');
			});

			// Additional test: Verify multiple small conversions accumulate
			it('should accumulate multiple small conversions', async function () {
				// Make 3 small conversions
				await signer1Diamond.convert(nftID, 0n, toWei('100'), signer1);
				await signer1Diamond.convert(nftID, 0n, toWei('50'), signer1);
				await signer1Diamond.convert(nftID, 0n, toWei('80'), signer1);

				// Total should be 230 GNUS
				const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
				expect(status.currentUsage).to.equal(toWei('230'));
				expect(status.remainingCapacity).to.equal(toWei('99770')); // 100k - 230
			});

			// Additional test: Verify limiter can be disabled
			it('should allow unlimited conversions when limiter disabled', async function () {
				// Disable limiter
				await ownerDiamond.setLimiterEnabled(false);

				// Need more child minions for a large conversion
				const bigMintTx = await ownerDiamond['mint(address,uint256)'](
					owner,
					toWei('150000'),
				);
				await bigMintTx.wait();
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					signer1,
					nftID,
					toWei('150000'),
					'0x',
				);

				// Convert way over limit: 155,000 minions total (signer1 has 5,000 + 150,000)
				await expect(signer1Diamond.convert(nftID, 0n, toWei('155000'), signer1)).to.not.be
					.reverted;

				// Re-enable for other tests
				await ownerDiamond.setLimiterEnabled(true);
			});
		});
	}
});
