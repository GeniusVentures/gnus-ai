import {
    LocalDiamondDeployer,
    loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundry/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';
import {
    MockBadERC20,
    MockERC20,
    MockNonPayable,
    TransferHelperWrapper,
} from '../../typechain-types';

describe('TransferHelper Library Tests', function () {
	let geniusDiamond: GeniusDiamond;
	let wrapper: TransferHelperWrapper;
	let goodToken: MockERC20;
	let badToken: MockBadERC20;
	let nonPayable: MockNonPayable;
	let owner: SignerWithAddress;
	let addr1: SignerWithAddress;
	let addr2: SignerWithAddress;

	let initialSnapshot: string;
	let testSnapshot: string;

	before(async function () {
		// Get signers
		[owner, addr1, addr2] = await hre.ethers.getSigners();

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

		// Deploy wrapper contract
		const WrapperFactory = await hre.ethers.getContractFactory('TransferHelperWrapper');
		wrapper = (await WrapperFactory.deploy()) as unknown as TransferHelperWrapper;
		await wrapper.waitForDeployment();

		// Deploy good ERC20 token
		const TokenFactory = await hre.ethers.getContractFactory('MockERC20');
		goodToken = (await TokenFactory.deploy(
			'Good Token',
			'GOOD',
			18,
		)) as unknown as MockERC20;
		await goodToken.waitForDeployment();

		// Deploy bad ERC20 token
		const BadTokenFactory = await hre.ethers.getContractFactory('MockBadERC20');
		badToken = (await BadTokenFactory.deploy(
			'Bad Token',
			'BAD',
			18,
		)) as unknown as MockBadERC20;
		await badToken.waitForDeployment();

		// Deploy non-payable contract
		const NonPayableFactory = await hre.ethers.getContractFactory('MockNonPayable');
		nonPayable = (await NonPayableFactory.deploy()) as unknown as MockNonPayable;
		await nonPayable.waitForDeployment();

		// Take initial snapshot
		initialSnapshot = await hre.network.provider.send('evm_snapshot');
	});

	beforeEach(async function () {
		testSnapshot = await hre.network.provider.send('evm_snapshot');
	});

	afterEach(async function () {
		await hre.network.provider.send('evm_revert', [testSnapshot]);
	});

	after(async function () {
		await hre.network.provider.send('evm_revert', [initialSnapshot]);
	});

	describe('safeApprove', function () {
		it('should successfully approve tokens', async function () {
			const amount = hre.ethers.parseEther('100');

			await expect(
				wrapper.testSafeApprove(
					await goodToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.not.be.reverted;

			const allowance = await goodToken.allowance(
				await wrapper.getAddress(),
				await addr1.getAddress(),
			);
			expect(allowance).to.equal(amount);
		});

		it('should fail when token approval reverts', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setFailApprove(true);

			await expect(
				wrapper.testSafeApprove(
					await badToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.be.revertedWith('SA');
		});

		it('should fail when token approval returns false', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setReturnFalse(true);

			await expect(
				wrapper.testSafeApprove(
					await badToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.be.revertedWith('SA');
		});

		it('should succeed when token approval returns nothing', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setReturnNothing(true);

			// This should succeed because the library handles tokens that don't return a value
			await expect(
				wrapper.testSafeApprove(
					await badToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.not.be.reverted;
		});

		it('should handle zero amount approval', async function () {
			await expect(
				wrapper.testSafeApprove(await goodToken.getAddress(), await addr1.getAddress(), 0),
			).to.not.be.reverted;

			const allowance = await goodToken.allowance(
				await wrapper.getAddress(),
				await addr1.getAddress(),
			);
			expect(allowance).to.equal(0);
		});
	});

	describe('safeTransfer', function () {
		beforeEach(async function () {
			// Mint tokens to wrapper for transfer tests
			const amount = hre.ethers.parseEther('1000');
			await goodToken.mint(await wrapper.getAddress(), amount);
			await badToken.mint(await wrapper.getAddress(), amount);
		});

		it('should successfully transfer tokens', async function () {
			const amount = hre.ethers.parseEther('100');
			const initialBalance = await goodToken.balanceOf(await addr1.getAddress());

			await expect(
				wrapper.testSafeTransfer(
					await goodToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.not.be.reverted;

			const finalBalance = await goodToken.balanceOf(await addr1.getAddress());
			expect(finalBalance - initialBalance).to.equal(amount);
		});

		it('should fail when token transfer reverts', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setFailTransfer(true);

			await expect(
				wrapper.testSafeTransfer(
					await badToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.be.revertedWith('ST');
		});

		it('should fail when token transfer returns false', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setReturnFalse(true);

			await expect(
				wrapper.testSafeTransfer(
					await badToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.be.revertedWith('ST');
		});

		it('should succeed when token transfer returns nothing', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setReturnNothing(true);

			await expect(
				wrapper.testSafeTransfer(
					await badToken.getAddress(),
					await addr1.getAddress(),
					amount,
				),
			).to.not.be.reverted;
		});

		it('should handle zero amount transfer', async function () {
			const initialBalance = await goodToken.balanceOf(await addr1.getAddress());

			await expect(
				wrapper.testSafeTransfer(await goodToken.getAddress(), await addr1.getAddress(), 0),
			).to.not.be.reverted;

			const finalBalance = await goodToken.balanceOf(await addr1.getAddress());
			expect(finalBalance).to.equal(initialBalance);
		});
	});

	describe('safeTransferFrom', function () {
		beforeEach(async function () {
			// Mint tokens to addr1 and approve wrapper
			const amount = hre.ethers.parseEther('1000');
			await goodToken.mint(await addr1.getAddress(), amount);
			await badToken.mint(await addr1.getAddress(), amount);

			// Approve wrapper to spend tokens
			await goodToken.connect(addr1).approve(await wrapper.getAddress(), amount);
			await badToken.connect(addr1).approve(await wrapper.getAddress(), amount);
		});

		it('should successfully transfer tokens from another address', async function () {
			const amount = hre.ethers.parseEther('100');
			const initialBalance = await goodToken.balanceOf(await addr2.getAddress());

			await expect(
				wrapper.testSafeTransferFrom(
					await goodToken.getAddress(),
					await addr1.getAddress(),
					await addr2.getAddress(),
					amount,
				),
			).to.not.be.reverted;

			const finalBalance = await goodToken.balanceOf(await addr2.getAddress());
			expect(finalBalance - initialBalance).to.equal(amount);
		});

		it('should fail when token transferFrom reverts', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setFailTransfer(true);

			await expect(
				wrapper.testSafeTransferFrom(
					await badToken.getAddress(),
					await addr1.getAddress(),
					await addr2.getAddress(),
					amount,
				),
			).to.be.revertedWith('STF');
		});

		it('should fail when token transferFrom returns false', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setReturnFalse(true);

			await expect(
				wrapper.testSafeTransferFrom(
					await badToken.getAddress(),
					await addr1.getAddress(),
					await addr2.getAddress(),
					amount,
				),
			).to.be.revertedWith('STF');
		});

		it('should succeed when token transferFrom returns nothing', async function () {
			const amount = hre.ethers.parseEther('100');
			await badToken.setReturnNothing(true);

			await expect(
				wrapper.testSafeTransferFrom(
					await badToken.getAddress(),
					await addr1.getAddress(),
					await addr2.getAddress(),
					amount,
				),
			).to.not.be.reverted;
		});

		it('should fail when insufficient allowance', async function () {
			const amount = hre.ethers.parseEther('2000'); // More than approved

			await expect(
				wrapper.testSafeTransferFrom(
					await goodToken.getAddress(),
					await addr1.getAddress(),
					await addr2.getAddress(),
					amount,
				),
			).to.be.reverted;
		});

		it('should handle zero amount transferFrom', async function () {
			const initialBalance = await goodToken.balanceOf(await addr2.getAddress());

			await expect(
				wrapper.testSafeTransferFrom(
					await goodToken.getAddress(),
					await addr1.getAddress(),
					await addr2.getAddress(),
					0,
				),
			).to.not.be.reverted;

			const finalBalance = await goodToken.balanceOf(await addr2.getAddress());
			expect(finalBalance).to.equal(initialBalance);
		});
	});

	describe('safeTransferETH', function () {
		beforeEach(async function () {
			// Fund wrapper with ETH
			const amount = hre.ethers.parseEther('10');
			await owner.sendTransaction({
				to: await wrapper.getAddress(),
				value: amount,
			});
		});

		it('should successfully transfer ETH to EOA', async function () {
			const amount = hre.ethers.parseEther('1');
			const initialBalance = await hre.ethers.provider.getBalance(await addr1.getAddress());

			await expect(wrapper.testSafeTransferETH(await addr1.getAddress(), amount)).to.not.be
				.reverted;

			const finalBalance = await hre.ethers.provider.getBalance(await addr1.getAddress());
			expect(finalBalance - initialBalance).to.equal(amount);
		});

		it('should successfully transfer ETH to payable contract', async function () {
			const amount = hre.ethers.parseEther('1');
			const wrapperAddress = await wrapper.getAddress();

			// Deploy another wrapper as a payable target
			const WrapperFactory = await hre.ethers.getContractFactory('TransferHelperWrapper');
			const payableTarget = await WrapperFactory.deploy();
			await payableTarget.waitForDeployment();

			const initialBalance = await hre.ethers.provider.getBalance(
				await payableTarget.getAddress(),
			);

			await expect(wrapper.testSafeTransferETH(await payableTarget.getAddress(), amount)).to
				.not.be.reverted;

			const finalBalance = await hre.ethers.provider.getBalance(
				await payableTarget.getAddress(),
			);
			expect(finalBalance - initialBalance).to.equal(amount);
		});

		it('should fail when transferring ETH to non-payable contract', async function () {
			const amount = hre.ethers.parseEther('1');

			await expect(
				wrapper.testSafeTransferETH(await nonPayable.getAddress(), amount),
			).to.be.revertedWith('STE');
		});

		it('should fail when insufficient ETH balance', async function () {
			const amount = hre.ethers.parseEther('100'); // More than wrapper has

			await expect(
				wrapper.testSafeTransferETH(await addr1.getAddress(), amount),
			).to.be.revertedWith('STE');
		});

		it('should handle zero amount ETH transfer', async function () {
			const initialBalance = await hre.ethers.provider.getBalance(await addr1.getAddress());

			await expect(wrapper.testSafeTransferETH(await addr1.getAddress(), 0)).to.not.be
				.reverted;

			const finalBalance = await hre.ethers.provider.getBalance(await addr1.getAddress());
			expect(finalBalance).to.equal(initialBalance);
		});
	});
});
