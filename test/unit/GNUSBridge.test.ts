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

			let erc1155ProxyOperator: GeniusDiamond;

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

			// Withdraw Limiter Integration Tests
			describe('Withdraw Limiter Integration', function () {
				let nftID: bigint;
				let exchangeRate: number;

				beforeEach(async function () {
					// Create NFT for testing
					nftID = 1n;
					// Exchange rate of 10 means: minting 1 NFT costs 10 GNUS, withdrawing 1 NFT gives 0.1 GNUS
					exchangeRate = 10;
					// Set max supply high enough for all tests (2M NFTs)
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
				});

				// Test that withdraw() triggers the limiter check
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

				// Test that withdraw() calculates GNUS amount from exchange rate before checking limit
				it('should calculate GNUS amount from exchange rate', async function () {
					const withdrawAmount = toWei('500'); // 500 NFTs
					const expectedGNUS = toWei('50'); // 500 / 10 = 50 GNUS

					// Perform withdrawal
					await signer1Diamond.withdraw(withdrawAmount, nftID);

					// Check that limiter recorded the correct GNUS amount
					const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
					expect(status.currentUsage).to.equal(expectedGNUS);
				});

				// Test that super admin can bypass limiter
				it('should allow super admin bypass', async function () {
					// Mint plenty of GNUS to owner
					// Need 15M GNUS to mint 1.5M NFTs (1.5M * exchangeRate of 10)
					await ownerDiamond['mint(address,uint256)'](owner, toWei('15000000'));

					// Mint NFTs to owner (super admin)
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						owner,
						nftID,
						toWei('1500000'),
						'0x',
					);

					// Super admin withdraws more than default limit (1.5M NFTs / 10 = 150k GNUS > 100k limit)
					const hugeWithdrawal = toWei('1500000'); // 1.5M NFTs = 150,000 GNUS
					await expect(ownerDiamond.withdraw(hugeWithdrawal, nftID)).to.not.be.reverted;

					// Check that super admin usage is NOT recorded
					const status = await geniusDiamond.getAccountWithdrawStatus(owner);
					expect(status.currentUsage).to.equal(0n);
				});

				// Test that withdraw() reverts with clear message when limit exceeded
				it('should revert with clear message when limit exceeded', async function () {
					// Default limit is 100,000 GNUS
					// With exchangeRate 10, need 1,000,000 NFTs to get 100k GNUS (1M / 10 = 100k)
					// Mint enough GNUS to owner first: need 10.55M GNUS to mint 1.055M NFTs
					await ownerDiamond['mint(address,uint256)'](owner, toWei('10550000'));

					// Mint additional NFTs to signer1: already have 5000, need 1,055,000 more
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						signer1,
						nftID,
						toWei('1055000'),
						'0x',
					);

					// Now signer1 has 1,060,000 NFTs total
					// Withdraw close to limit (950,000 NFTs = 95,000 GNUS)
					await signer1Diamond.withdraw(toWei('950000'), nftID); // 95k GNUS

					// Try to exceed limit (60,000 NFTs = 6,000 GNUS, total would be 101k)
					await expect(signer1Diamond.withdraw(toWei('60000'), nftID)).to.be.revertedWith(
						'Withdrawal limit exceeded for time window',
					);
				});

				// Additional test: Verify multiple small withdrawals accumulate
				it('should accumulate multiple small withdrawals', async function () {
					// Make 3 small withdrawals
					await signer1Diamond.withdraw(toWei('1000'), nftID); // 100 GNUS (1000/10)
					await signer1Diamond.withdraw(toWei('500'), nftID); // 50 GNUS (500/10)
					await signer1Diamond.withdraw(toWei('800'), nftID); // 80 GNUS (800/10)

					// Total should be 230 GNUS
					const status = await geniusDiamond.getAccountWithdrawStatus(signer1);
					expect(status.currentUsage).to.equal(toWei('230'));
					expect(status.remainingCapacity).to.equal(toWei('99770')); // 100k - 230
				});

				// Additional test: Verify limiter can be disabled
				it('should allow unlimited withdrawals when limiter disabled', async function () {
					// Disable limiter
					await ownerDiamond.setLimiterEnabled(false);

					// Withdraw all 5000 NFTs = 500 GNUS (no limit)
					await expect(signer1Diamond.withdraw(toWei('5000'), nftID)).to.not.be.reverted; // 500 GNUS

					// Re-enable for other tests
					await ownerDiamond.setLimiterEnabled(true);
				});
			});
		});
	}
});
