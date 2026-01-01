import { expect } from 'chai';
import hre from 'hardhat';
import { LocalDiamondDeployer } from '@diamondslab/hardhat-diamonds/dist/utils';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { loadDiamondContract } from '../../scripts/utils/loadDiamondArtifact';
import type { Signer } from 'ethers';
import type { Diamond } from '@diamondslab/diamonds';

describe('GNUSContractAssets', function () {
	let geniusDiamond: GeniusDiamond;
	let diamond: Diamond;
	let diamondAddress: string;
	let owner: Signer;
	let user1: Signer;
	let user2: Signer;
	let ownerAddress: string;
	let user1Address: string;
	let user2Address: string;
	let initialSnapshotId: string;

	before(async function () {
		// Get signers
		[owner, user1, user2] = await hre.ethers.getSigners();
		ownerAddress = await owner.getAddress();
		user1Address = await user1.getAddress();
		user2Address = await user2.getAddress();

		// Setup Diamond deployment configuration
		const diamondName = 'GeniusDiamond';
		const networkName = hre.network.name;
		const chainId = (await hre.ethers.provider.getNetwork()).chainId;
		const provider = hre.ethers.provider;

		const config = {
			diamondName,
			networkName,
			provider,
			chainId,
			isLocalhost: networkName === 'hardhat' || networkName === 'localhost',
			baseFolder: hre.config.paths.root,
			artifactsPath: hre.config.paths.artifacts,
			diamondsPath: `${hre.config.paths.root}/diamonds`,
			skipVerifyList: [] as string[],
			instantiateDiamondCut: false,
		};

		// Deploy Diamond
		const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
		diamond = await diamondDeployer.getDiamondDeployed();
		const deployedDiamondData = diamond.getDeployedDiamondData();
		diamondAddress = deployedDiamondData.DiamondAddress || '';

		// Load Diamond contract with full ABI
		geniusDiamond = await loadDiamondContract<GeniusDiamond>(
			diamond,
			diamondAddress,
			hre.ethers,
		);

		// Note: owner is already the super admin (contract owner)
		// No need to grant additional roles

		// Take initial snapshot
		initialSnapshotId = await hre.ethers.provider.send('evm_snapshot', []);
	});

	let snapshotId: string;

	beforeEach(async function () {
		// Take a snapshot before each test
		snapshotId = await hre.ethers.provider.send('evm_snapshot', []);
	});

	afterEach(async function () {
		// Revert to snapshot after each test
		await hre.ethers.provider.send('evm_revert', [snapshotId]);
	});

	after(async function () {
		// Revert to initial snapshot after all tests
		await hre.ethers.provider.send('evm_revert', [initialSnapshotId]);
	});

	describe('withdrawToken', function () {
		describe('Access Control', function () {
			it('should revert when called by non-super-admin', async function () {
				await expect(
					geniusDiamond.connect(user1).withdrawToken(user2Address, user2Address, 100n),
				).to.be.revertedWith('Only SuperAdmin allowed');
			});

			it('should allow super admin to call withdrawToken', async function () {
				// Deploy a mock ERC20 token and send some to the diamond
				const MockERC20 = await hre.ethers.getContractFactory(
					'contracts/mocks/MockERC20.sol:MockERC20',
				);
				const mockToken = await MockERC20.deploy('Mock Token', 'MOCK', 18);
				await mockToken.waitForDeployment();
				const mockTokenAddress = await mockToken.getAddress();

				// Mint tokens to the diamond
				await mockToken.mint(diamondAddress, 1000n);

				// Super admin (owner) should be able to withdraw
				await expect(
					geniusDiamond.connect(owner).withdrawToken(mockTokenAddress, user1Address, 500n),
				).to.not.be.reverted;
			});
		});

		describe('GNUS Token Protection', function () {
			it('should revert when attempting to withdraw GNUS token', async function () {
				// Attempting to withdraw from the contract itself (GNUS token)
				await expect(
					geniusDiamond.connect(owner).withdrawToken(diamondAddress, user1Address, 100n),
				).to.be.revertedWithCustomError(geniusDiamond, 'CannotWithdrawGNUS');
			});
		});

		describe('ERC20 Token Withdrawal', function () {
			it('should withdraw ERC20 tokens successfully', async function () {
				// Deploy a mock ERC20 token
				const MockERC20 = await hre.ethers.getContractFactory(
					'contracts/mocks/MockERC20.sol:MockERC20',
				);
				const mockToken = await MockERC20.deploy('Mock Token', 'MOCK', 18);
				await mockToken.waitForDeployment();
				const mockTokenAddress = await mockToken.getAddress();

				// Mint tokens to the diamond
				const withdrawAmount = 1000n;
				await mockToken.mint(diamondAddress, withdrawAmount);

				const balanceBefore = await mockToken.balanceOf(user1Address);

				// Withdraw tokens
				await expect(
					geniusDiamond
						.connect(owner)
						.withdrawToken(mockTokenAddress, user1Address, withdrawAmount),
				)
					.to.emit(geniusDiamond, 'WithdrawToken')
					.withArgs(mockTokenAddress, ownerAddress, withdrawAmount);

				const balanceAfter = await mockToken.balanceOf(user1Address);
				expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
			});

			it('should handle partial ERC20 token withdrawal', async function () {
				// Deploy a mock ERC20 token
				const MockERC20 = await hre.ethers.getContractFactory(
					'contracts/mocks/MockERC20.sol:MockERC20',
				);
				const mockToken = await MockERC20.deploy('Mock Token', 'MOCK', 18);
				await mockToken.waitForDeployment();
				const mockTokenAddress = await mockToken.getAddress();

				// Mint tokens to the diamond
				const totalAmount = 1000n;
				const withdrawAmount = 600n;
				await mockToken.mint(diamondAddress, totalAmount);

				const diamondBalanceBefore = await mockToken.balanceOf(diamondAddress);
				const recipientBalanceBefore = await mockToken.balanceOf(user1Address);

				// Withdraw partial amount
				await geniusDiamond
					.connect(owner)
					.withdrawToken(mockTokenAddress, user1Address, withdrawAmount);

				const diamondBalanceAfter = await mockToken.balanceOf(diamondAddress);
				const recipientBalanceAfter = await mockToken.balanceOf(user1Address);

				expect(diamondBalanceBefore - diamondBalanceAfter).to.equal(withdrawAmount);
				expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(withdrawAmount);
				expect(diamondBalanceAfter).to.equal(totalAmount - withdrawAmount);
			});
		});

		describe('Ether Withdrawal', function () {
			it('should withdraw Ether successfully', async function () {
				// Send Ether to the diamond
				const etherAmount = hre.ethers.parseEther('1.0');
				await owner.sendTransaction({
					to: diamondAddress,
					value: etherAmount,
				});

				const ETHER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
				const recipientBalanceBefore = await hre.ethers.provider.getBalance(user1Address);

				// Withdraw Ether
				const withdrawAmount = hre.ethers.parseEther('0.5');
				await expect(
					geniusDiamond.connect(owner).withdrawToken(ETHER, user1Address, withdrawAmount),
				)
					.to.emit(geniusDiamond, 'WithdrawToken')
					.withArgs(ETHER, ownerAddress, withdrawAmount);

				const recipientBalanceAfter = await hre.ethers.provider.getBalance(user1Address);
				expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(withdrawAmount);
			});

			it('should handle multiple Ether withdrawals', async function () {
				// Send Ether to the diamond
				const etherAmount = hre.ethers.parseEther('5.0');
				await owner.sendTransaction({
					to: diamondAddress,
					value: etherAmount,
				});

				const ETHER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
				const diamondBalanceBefore = await hre.ethers.provider.getBalance(diamondAddress);

				// First withdrawal
				const firstWithdraw = hre.ethers.parseEther('2.0');
				await geniusDiamond
					.connect(owner)
					.withdrawToken(ETHER, user1Address, firstWithdraw);

				// Second withdrawal
				const secondWithdraw = hre.ethers.parseEther('1.5');
				await geniusDiamond
					.connect(owner)
					.withdrawToken(ETHER, user2Address, secondWithdraw);

				const diamondBalanceAfter = await hre.ethers.provider.getBalance(diamondAddress);
				expect(diamondBalanceBefore - diamondBalanceAfter).to.equal(
					firstWithdraw + secondWithdraw,
				);
			});
		});

		describe('Event Emission', function () {
			it('should emit WithdrawToken event with correct parameters', async function () {
				// Deploy a mock ERC20 token
				const MockERC20 = await hre.ethers.getContractFactory(
					'contracts/mocks/MockERC20.sol:MockERC20',
				);
				const mockToken = await MockERC20.deploy('Mock Token', 'MOCK', 18);
				await mockToken.waitForDeployment();
				const mockTokenAddress = await mockToken.getAddress();

				const withdrawAmount = 500n;
				await mockToken.mint(diamondAddress, withdrawAmount);

				// Check event emission
				await expect(
					geniusDiamond
						.connect(owner)
						.withdrawToken(mockTokenAddress, user1Address, withdrawAmount),
				)
					.to.emit(geniusDiamond, 'WithdrawToken')
					.withArgs(mockTokenAddress, ownerAddress, withdrawAmount);
			});
		});
	});
});
