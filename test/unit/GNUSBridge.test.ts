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

describe('GNUS Bridge Tests', async function () {
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
			// keccak256("gnus.ai.treasury.storage") — GNUSTreasuryStorage layout base slot
			const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));
			let deployedDiamondAddress: string;

			let erc1155ProxyOperator: GeniusDiamond;

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
			deployedDiamondAddress = deployedDiamondData.DiamondAddress! || '';

				// Load the Diamond contract using the utility function
				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress! || '',
					hre.ethers,
				);

				ethersMultichain = ethers;
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
					ownerSigner;
				}
				ownerSigner = await ethersMultichain.getSigner(owner);
				ownerDiamond = geniusDiamond.connect(ownerSigner);

				const ERC1155ProxyOperatorFactory =
					await ethers.getContractFactory('ERC1155ProxyOperator');
				// erc1155ProxyOperator = ERC1155ProxyOperatorFactory.attach(ownerDiamond.address);
				erc1155ProxyOperator = ownerDiamond;
			});

			beforeEach(async function () {
				snapshotId = await provider.send('evm_snapshot', []);
			});

			afterEach(async () => {
				if (snapshotId) {
					await provider.send('evm_revert', [snapshotId]);
				}
			});

			// Validate the owner has the `MINTER_ROLE`
			it('should return true if owner has MINTER_ROLE', async () => {
				const minterRole = await ownerDiamond.MINTER_ROLE();
				const hasRole = await ownerDiamond.hasRole(minterRole, owner);
				expect(hasRole).to.be.true;
			});

			// Test case to validate the minting and burning functionality
			it('Testing Mint/Burn', async () => {
				// Retrieve the minter role
				const minterRole = await ownerDiamond.MINTER_ROLE();

				// Ensure a signer without the `MINTER_ROLE` cannot mint tokens
				await expect(
					signer2Diamond['mint(address,uint256)'](signer2, toWei(1)),
				).to.be.revertedWith(
					`AccessControl: account ${signer2.toLowerCase()} is missing role ${minterRole}`,
				);

				// Ensure a signer without the `MINTER_ROLE` cannot burn tokens
				await expect(
					signer2Diamond['burn(address,uint256)'](signer0, toWei(1)),
				).to.be.revertedWith(
					`AccessControl: account ${signer2.toLowerCase()} is missing role ${minterRole}`,
				);

				// Verify the initial token balance of a signer is zero
				let balance = await geniusDiamond['balanceOf(address)'](signer2);
				expect(balance).to.be.eq(toWei(0));

				// Mint tokens to the signer2's account and validate the updated balance
				await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
				balance = await geniusDiamond['balanceOf(address)'](signer2);
				expect(balance).to.be.eq(toWei(100));

				// Fetch the total supply of tokens
				const supply = await geniusDiamond['totalSupply()']();

				// Burn tokens from the signer's account and validate the supply reduction
				await ownerDiamond['burn(address,uint256)'](signer2, toWei(100));
				const supplyAfterBurned = await geniusDiamond['totalSupply()']();

				// Assert that the supply has decreased by the burned amount
				expect(supply - supplyAfterBurned).to.be.eq(toWei(100));

				// Verify the signer's balance is zero after burning
				balance = await geniusDiamond['balanceOf(address)'](signer2);
				expect(balance).to.be.eq(toWei(0));

				// Mint tokens again and validate that the total supply returns to its original value
				await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
				const supplyAfterMint = await geniusDiamond['totalSupply()']();
				expect(supplyAfterMint).to.be.eq(supply);

				// Attempt to burn tokens using the multi-dimensional burn function with invalid permissions
				await expect(
					geniusDiamond['burn(address,uint256,uint256)'](signer2, 0, toWei(100)),
				).to.be.rejectedWith(Error, 'ERC1155: caller is not owner nor approved');

				// Burn tokens using the multi-dimensional burn function with the correct permissions
				await signer2Diamond['burn(address,uint256,uint256)'](
					signer2,
					toWei(0),
					toWei(100),
				);

				// Verify the balance of the signer is zero after burning
				balance = await geniusDiamond['balanceOf(address)'](signer2);
				expect(balance).to.be.eq(toWei(0));
			});

			// Test case to validate the decreaseAllowance functionality
			it('Testing Decrease Allowance', async () => {
				// Verify the initial allowance of the owner to the signer is zero
				let allowance = await ownerDiamond.allowance(owner, signer2);
				expect(allowance).to.be.eq(toWei(0));

				// Increase the allowance of the owner to the signer
				await ownerDiamond.approve(signer2, toWei(100));

				// Validate the updated allowance
				allowance = await ownerDiamond.allowance(owner, signer2);
				expect(allowance).to.be.eq(toWei(100));

				// Decrease the allowance of the owner to the signer
				await ownerDiamond.decreaseAllowance(signer2, toWei(50));

				// Validate the updated allowance
				allowance = await ownerDiamond.allowance(owner, signer2);
				expect(allowance).to.be.eq(toWei(50));

				// Attempt to decrease the allowance of the owner to the signer with insufficient funds
				await expect(
					ownerDiamond.decreaseAllowance(signer2, toWei(100)),
				).to.be.revertedWith('ERC20: decreased allowance below zero');
			});

			// Withdraw Limiter Integration Tests (Phase 9: re-homed from withdraw() to
			// GNUSTreasury.convert() — the GNUS-terminal leg charges the limiter exactly
			// once, in minions, per WR-07/D4).
			describe('Withdraw Limiter Integration', function () {
				let nftID: bigint;

				beforeEach(async function () {
					// Seed the provenance counter so the global-cap check in
					// _mintWithBridgeFee can run (reverts when uninitialized, D8/Pitfall 4).
					// The GeniusDiamond fixture is shared (cached) across suites, so a prior
					// suite may already have seeded the one-shot SetSeedSupply — guard on
					// provenanceInitialized (slot +1).
					const initialized = await provider.send('eth_getStorageAt', [
						deployedDiamondAddress,
						ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
					]);
					if (BigInt(initialized) === 0n) {
						await ownerDiamond.GNUSTreasury_SetSeedSupply(0n);
					}

					// Create NFT for testing
					nftID = 1n;
					// exchangeRate is display-only under the conversion-native model (D2);
					// no rate math occurs in any state transition.
					const exchangeRate = 10;
					// Set max supply high enough for all tests
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

				// Test that convert() to GNUS triggers the limiter check
				it('should trigger limiter on convert', async function () {
					const convertAmount = toWei('1000'); // 1000 child minions -> 1000 GNUS (1:1)

					// Get initial status
					const initialStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);

					// First conversion should succeed
					await signer1Diamond.convert(nftID, 0n, convertAmount, signer1);

					// Check status shows usage increased by the minion amount
					const finalStatus = await geniusDiamond.getAccountWithdrawStatus(signer1);
					const usageIncrease = finalStatus.currentUsage - initialStatus.currentUsage;
					expect(usageIncrease).to.equal(convertAmount);
				});

				// Test that convert() charges the limiter in minions (rate never applied, D1/D2)
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
					// Mint plenty of GNUS to owner, then convert to child minions (1:1)
					await ownerDiamond['mint(address,uint256)'](owner, toWei('150000'));

					// Mint NFTs to owner (super admin)
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						owner,
						nftID,
						toWei('150000'),
						'0x',
					);

					// Super admin converts more than the default limit (150k GNUS > 100k limit)
					const hugeConversion = toWei('150000');
					await expect(ownerDiamond.convert(nftID, 0n, hugeConversion, owner)).to.not.be
						.reverted;

					// Check that super admin usage is NOT recorded
					const status = await geniusDiamond.getAccountWithdrawStatus(owner);
					expect(status.currentUsage).to.equal(0n);
				});

				// Test that convert() reverts with clear message when limit exceeded
				it('should revert with clear message when limit exceeded', async function () {
					// Default limit is 100,000 GNUS. signer1 starts with 5,000 child minions;
					// mint 100,000 more so they can reach the limit.
					await ownerDiamond['mint(address,uint256)'](owner, toWei('100000'));
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						signer1,
						nftID,
						toWei('100000'),
						'0x',
					);

					// Convert close to limit (95,000 GNUS)
					await signer1Diamond.convert(nftID, 0n, toWei('95000'), signer1);

					// Try to exceed limit (6,000 more; total would be 101,000 > 100,000)
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

					// Convert all 5000 child minions (no limit)
					await expect(signer1Diamond.convert(nftID, 0n, toWei('5000'), signer1)).to.not.be
						.reverted;

					// Re-enable for other tests
					await ownerDiamond.setLimiterEnabled(true);
				});
			});
		});
	}
});
