import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';

describe('ERC20TransferBatch Tests', function () {
	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let user4: SignerWithAddress;

	let initialSnapshotId: string;
	let snapshotId: string;

	const DEFAULT_ADMIN_ROLE =
		'0x0000000000000000000000000000000000000000000000000000000000000000';
	const GNUS_TOKEN_ID = 0;

	before(async function () {
		// Get signers
		const signers = await hre.ethers.getSigners();
		owner = signers[0]; // Owner has DEFAULT_ADMIN_ROLE by default
		user1 = signers[1];
		user2 = signers[2];
		user3 = signers[3];
		user4 = signers[4];

		// Deploy Diamond using LocalDiamondDeployer
		const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
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

		// Take initial snapshot for test isolation
		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
	});

	beforeEach(async function () {
		snapshotId = await hre.network.provider.send('evm_snapshot');
	});

	afterEach(async function () {
		await hre.network.provider.send('evm_revert', [snapshotId]);
	});

	after(async function () {
		await hre.network.provider.send('evm_revert', [initialSnapshotId]);
	});

	describe('mintBatch', function () {
		it('should successfully mint batch tokens to multiple destinations', async function () {
			const destinations = [
				await user1.getAddress(),
				await user2.getAddress(),
				await user3.getAddress(),
			];
			const amounts = [
				hre.ethers.parseEther('100'),
				hre.ethers.parseEther('200'),
				hre.ethers.parseEther('300'),
			];

			await geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts);

			// Verify balances
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[0]);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user2.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[1]);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user3.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[2]);
		});

		it('should update total supply correctly after batch mint', async function () {
			const destinations = [await user1.getAddress(), await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('500'), hre.ethers.parseEther('700')];

			const initialSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			await geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts);

			const newSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(newSupply).to.equal(initialSupply + amounts[0] + amounts[1]);
		});

		it('should emit TransferBatch event on mint', async function () {
			const destinations = [await user1.getAddress(), await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('100'), hre.ethers.parseEther('200')];

			await expect(geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts)).to.emit(
				geniusDiamond,
				'TransferBatch(address,address,address[],uint256[])',
			);
		});

		it("should revert if caller doesn't have DEFAULT_ADMIN_ROLE", async function () {
			const destinations = [await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('100')];

			await expect(
				geniusDiamond.connect(user1)['mintBatch(address[],uint256[])'](destinations, amounts),
			).to.be.revertedWith('Creator or Admin can only mint GNUS Tokens');
		});

		it('should revert if destinations and amounts lengths mismatch', async function () {
			const destinations = [await user1.getAddress(), await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('100')]; // Mismatched length

			await expect(geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts)).to.be.revertedWith(
				'TransferBatch: to and amounts length mismatch',
			);
		});

		it('should revert if trying to mint to zero address', async function () {
			const destinations = [hre.ethers.ZeroAddress];
			const amounts = [hre.ethers.parseEther('100')];

			await expect(geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts)).to.be.revertedWith(
				'TransferBatch: mint to the zero address',
			);
		});

		it('should handle empty arrays', async function () {
			const destinations: string[] = [];
			const amounts: bigint[] = [];

			// Should not revert with empty arrays
			await expect(geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts)).to.not.be.reverted;
		});

		it('should handle minting zero amounts', async function () {
			const destinations = [await user1.getAddress()];
			const amounts = [0n];

			await geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(0);
		});
	});

	describe('transferBatch', function () {
		beforeEach(async function () {
			// Mint some tokens to owner for transfer tests
			const destinations = [await owner.getAddress()];
			const amounts = [hre.ethers.parseEther('10000')];
			await geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts);
		});

		it('should successfully transfer batch tokens to multiple destinations', async function () {
			const destinations = [
				await user1.getAddress(),
				await user2.getAddress(),
				await user3.getAddress(),
			];
			const amounts = [
				hre.ethers.parseEther('100'),
				hre.ethers.parseEther('200'),
				hre.ethers.parseEther('300'),
			];

			await geniusDiamond.transferBatch(destinations, amounts);

			// Verify balances
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[0]);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user2.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[1]);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user3.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[2]);
		});

		it("should deduct correct amount from sender's balance", async function () {
			const initialBalance = await geniusDiamond['balanceOf(address,uint256)'](
				await owner.getAddress(),
				GNUS_TOKEN_ID,
			);
			const destinations = [await user1.getAddress(), await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('500'), hre.ethers.parseEther('300')];

			await geniusDiamond.transferBatch(destinations, amounts);

			const finalBalance = await geniusDiamond['balanceOf(address,uint256)'](
				await owner.getAddress(),
				GNUS_TOKEN_ID,
			);
			expect(finalBalance).to.equal(initialBalance - amounts[0] - amounts[1]);
		});

		it('should emit TransferBatch event on transfer', async function () {
			const destinations = [await user1.getAddress()];
			const amounts = [hre.ethers.parseEther('100')];

			await expect(geniusDiamond.transferBatch(destinations, amounts)).to.emit(
				geniusDiamond,
				'TransferBatch(address,address,address[],uint256[])',
			);
		});

		it('should not change total supply after transfer', async function () {
			const initialSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			const destinations = [await user1.getAddress(), await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('100'), hre.ethers.parseEther('200')];

			await geniusDiamond.transferBatch(destinations, amounts);

			const finalSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(finalSupply).to.equal(initialSupply);
		});

		it('should revert if destinations and amounts lengths mismatch', async function () {
			const destinations = [await user1.getAddress(), await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('100')];

			await expect(geniusDiamond.transferBatch(destinations, amounts)).to.be.revertedWith(
				'TransferBatch: to and amounts length mismatch',
			);
		});

		it('should revert if trying to transfer to zero address', async function () {
			const destinations = [hre.ethers.ZeroAddress];
			const amounts = [hre.ethers.parseEther('100')];

			await expect(geniusDiamond.transferBatch(destinations, amounts)).to.be.revertedWith(
				"TransferBatch: can't burn/transfer to the zero address",
			);
		});

		it('should revert if sender has insufficient balance', async function () {
			const destinations = [await user1.getAddress()];
			const amounts = [hre.ethers.parseEther('100000')]; // More than available

			await expect(geniusDiamond.transferBatch(destinations, amounts)).to.be.revertedWith(
				'TransferBatch: from account does not have sufficient tokens',
			);
		});

		it('should handle transferring zero amounts', async function () {
			const initialBalance1 = await geniusDiamond['balanceOf(address,uint256)'](
				await user1.getAddress(),
				GNUS_TOKEN_ID,
			);
			const destinations = [await user1.getAddress()];
			const amounts = [0n];

			await geniusDiamond.transferBatch(destinations, amounts);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(initialBalance1);
		});
	});

	describe('transferOrBurnBatch', function () {
		beforeEach(async function () {
			// Mint tokens to owner for burn tests
			const destinations = [await owner.getAddress()];
			const amounts = [hre.ethers.parseEther('10000')];
			await geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts);
		});

		it('should successfully transfer tokens to valid addresses', async function () {
			const destinations = [await user1.getAddress(), await user2.getAddress()];
			const amounts = [hre.ethers.parseEther('100'), hre.ethers.parseEther('200')];

			await geniusDiamond.transferOrBurnBatch(destinations, amounts);

			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[0]);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user2.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[1]);
		});

		it('should successfully burn tokens by transferring to zero address', async function () {
			const initialSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			const burnAmount = hre.ethers.parseEther('500');
			const destinations = [hre.ethers.ZeroAddress];
			const amounts = [burnAmount];

			await geniusDiamond.transferOrBurnBatch(destinations, amounts);

			const finalSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(finalSupply).to.equal(initialSupply - burnAmount);
		});

		it('should handle mixed transfers and burns', async function () {
			const initialSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			const destinations = [
				await user1.getAddress(),
				hre.ethers.ZeroAddress,
				await user2.getAddress(),
			];
			const amounts = [
				hre.ethers.parseEther('100'),
				hre.ethers.parseEther('200'),
				hre.ethers.parseEther('300'),
			];

			await geniusDiamond.transferOrBurnBatch(destinations, amounts);

			// Check user balances
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[0]);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user2.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[2]);

			// Check supply decreased by burn amount
			const finalSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(finalSupply).to.equal(initialSupply - amounts[1]);
		});

		it('should emit TransferBatch event on burn', async function () {
			const destinations = [hre.ethers.ZeroAddress];
			const amounts = [hre.ethers.parseEther('100')];

			await expect(geniusDiamond.transferOrBurnBatch(destinations, amounts)).to.emit(
				geniusDiamond,
				'TransferBatch(address,address,address[],uint256[])',
			);
		});

		it('should revert if trying to burn more than total supply', async function () {
			const totalSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			const destinations = [hre.ethers.ZeroAddress];
			const amounts = [totalSupply + hre.ethers.parseEther('1')]; // More than total supply

			await expect(
				geniusDiamond.transferOrBurnBatch(destinations, amounts),
			).to.be.revertedWith('GNUS Token: burn amount exceeds totalSupply');
		});

		it('should revert if sender has insufficient balance for burn', async function () {
			const destinations = [hre.ethers.ZeroAddress];
			const amounts = [hre.ethers.parseEther('100000')]; // More than owner has

			// Note: burn amount check happens before balance check in _beforeTokenTransfer
			await expect(
				geniusDiamond.transferOrBurnBatch(destinations, amounts),
			).to.be.revertedWith('GNUS Token: burn amount exceeds totalSupply');
		});

		it('should handle multiple burns correctly', async function () {
			const initialSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			const destinations = [
				hre.ethers.ZeroAddress,
				hre.ethers.ZeroAddress,
				hre.ethers.ZeroAddress,
			];
			const amounts = [
				hre.ethers.parseEther('100'),
				hre.ethers.parseEther('200'),
				hre.ethers.parseEther('300'),
			];

			await geniusDiamond.transferOrBurnBatch(destinations, amounts);

			const finalSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			const totalBurned = amounts[0] + amounts[1] + amounts[2];
			expect(finalSupply).to.equal(initialSupply - totalBurned);
		});
	});

	describe('Supply constraints', function () {
		it('should respect max supply when minting', async function () {
			// Get current max supply (50M GNUS tokens as per project spec)
			const maxSupply = hre.ethers.parseEther('50000000');

			// Try to mint more than max supply (assuming we start near zero)
			const destinations = [await user1.getAddress()];
			const amounts = [maxSupply + hre.ethers.parseEther('1')];

			await expect(geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts)).to.be.revertedWith(
				'Max Supply for GNUS Token would be exceeded',
			);
		});

		it('should allow minting up to max supply', async function () {
			// This test mints a large amount close to max supply
			// Note: Adjust based on any tokens already minted in initialization
			const currentSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			const maxSupply = hre.ethers.parseEther('50000000');
			const remainingSupply = maxSupply - currentSupply;

			const destinations = [await user1.getAddress()];
			const amounts = [remainingSupply];

			// Should not revert
			await expect(geniusDiamond['mintBatch(address[],uint256[])'](destinations, amounts)).to.not.be.reverted;

			const finalSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(finalSupply).to.equal(maxSupply);
		});

		it('should correctly track supply through multiple mint and burn operations', async function () {
			const mintAmount = hre.ethers.parseEther('1000');
			const burnAmount = hre.ethers.parseEther('300');

			// Mint
			await geniusDiamond['mintBatch(address[],uint256[])']([await user1.getAddress()], [mintAmount]);
			const supplyAfterMint = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

			// Transfer to user1 so they can burn
			await geniusDiamond['mintBatch(address[],uint256[])']([await user1.getAddress()], [burnAmount]);
			// Burn
			await geniusDiamond
				.connect(user1)
				.transferOrBurnBatch([hre.ethers.ZeroAddress], [burnAmount]);
			const supplyAfterBurn = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

			expect(supplyAfterBurn).to.equal(supplyAfterMint);
		});
	});

	describe('Edge cases', function () {
		beforeEach(async function () {
			// Mint tokens for edge case tests
			await geniusDiamond['mintBatch(address[],uint256[])'](
				[await owner.getAddress()],
				[hre.ethers.parseEther('10000')],
			);
		});

		it('should handle single element arrays', async function () {
			const destinations = [await user1.getAddress()];
			const amounts = [hre.ethers.parseEther('100')];

			await geniusDiamond.transferBatch(destinations, amounts);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(amounts[0]);
		});

		it('should handle large batch sizes', async function () {
			// Create arrays with 10 destinations
			const destinations = [];
			const amounts = [];
			for (let i = 0; i < 10; i++) {
				destinations.push(await user1.getAddress());
				amounts.push(hre.ethers.parseEther('10'));
			}

			await geniusDiamond.transferBatch(destinations, amounts);

			const totalTransferred = hre.ethers.parseEther('10') * BigInt(10);
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(totalTransferred);
		});

		it('should handle transfers to the same address multiple times in one batch', async function () {
			const destinations = [
				await user1.getAddress(),
				await user1.getAddress(),
				await user1.getAddress(),
			];
			const amounts = [
				hre.ethers.parseEther('100'),
				hre.ethers.parseEther('200'),
				hre.ethers.parseEther('300'),
			];

			await geniusDiamond.transferBatch(destinations, amounts);

			const totalReceived = amounts[0] + amounts[1] + amounts[2];
			expect(
				await geniusDiamond['balanceOf(address,uint256)'](
					await user1.getAddress(),
					GNUS_TOKEN_ID,
				),
			).to.equal(totalReceived);
		});

		it('should maintain balance integrity across complex operations', async function () {
			const initialOwnerBalance = await geniusDiamond['balanceOf(address,uint256)'](
				await owner.getAddress(),
				GNUS_TOKEN_ID,
			);

			// Transfer to multiple users
			await geniusDiamond.transferBatch(
				[await user1.getAddress(), await user2.getAddress()],
				[hre.ethers.parseEther('100'), hre.ethers.parseEther('200')],
			);

			// Transfer back from user1
			await geniusDiamond
				.connect(user1)
				.transferBatch([await owner.getAddress()], [hre.ethers.parseEther('50')]);

			// Burn from user2
			await geniusDiamond
				.connect(user2)
				.transferOrBurnBatch([hre.ethers.ZeroAddress], [hre.ethers.parseEther('100')]);

			const finalOwnerBalance = await geniusDiamond['balanceOf(address,uint256)'](
				await owner.getAddress(),
				GNUS_TOKEN_ID,
			);
			const finalUser1Balance = await geniusDiamond['balanceOf(address,uint256)'](
				await user1.getAddress(),
				GNUS_TOKEN_ID,
			);
			const finalUser2Balance = await geniusDiamond['balanceOf(address,uint256)'](
				await user2.getAddress(),
				GNUS_TOKEN_ID,
			);

			// Verify expected balances
			expect(finalOwnerBalance).to.equal(
				initialOwnerBalance - hre.ethers.parseEther('300') + hre.ethers.parseEther('50'),
			);
			expect(finalUser1Balance).to.equal(hre.ethers.parseEther('50'));
			expect(finalUser2Balance).to.equal(hre.ethers.parseEther('100'));
		});
	});
});
