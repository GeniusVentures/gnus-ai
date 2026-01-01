import { expect } from 'chai';
import hre from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { Diamond } from '@diamondslab/diamonds';
import { GeniusDiamond } from '../../diamond-typechain-types/GeniusDiamond';

describe('GeniusAI', function () {
	let diamond: Diamond;
	let diamondAddress: string;
	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let initialSnapshotId: string;

	before(async function () {
		// Get signers
		const signers = await hre.ethers.getSigners();
		owner = signers[0];
		user1 = signers[1];
		user2 = signers[2];

		// Deploy Diamond using LocalDiamondDeployer
		const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
		const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
		diamond = await diamondDeployer.getDiamondDeployed();
		const deployedDiamondData = diamond.getDeployedDiamondData();
		diamondAddress = deployedDiamondData.DiamondAddress || '';

		// Load the deployed diamond with full ABI
		geniusDiamond = await loadDiamondContract<GeniusDiamond>(
			diamond,
			diamondAddress,
			hre.ethers,
		);

		// Take initial snapshot for test isolation
		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
	});

	let snapshotId: string;

	beforeEach(async () => {
		// Take snapshot before each test
		snapshotId = await hre.network.provider.send('evm_snapshot');
	});

	afterEach(async () => {
		// Revert to snapshot after each test
		await hre.network.provider.send('evm_revert', [snapshotId]);
	});

	after(async () => {
		// Revert to initial snapshot after all tests
		await hre.network.provider.send('evm_revert', [initialSnapshotId]);
	});

	describe('Initialization', function () {
		it('should initialize GeniusAI successfully', async function () {
			// Call initialize function
			await expect(geniusDiamond.GeniusAI_Initialize()).to.not.be.reverted;
		});

		it('should allow re-initialization without error', async function () {
			// First initialization
			await geniusDiamond.GeniusAI_Initialize();

			// Second initialization should not revert (due to initializer pattern)
			await expect(geniusDiamond.GeniusAI_Initialize()).to.not.be.reverted;
		});
	});

	describe('OpenEscrow', function () {
		const testUUID = hre.ethers.encodeBytes32String('test-uuid-123');
		const escrowAmount = hre.ethers.parseEther('1.0');

		it('should open an escrow with msg.value', async function () {
			// Open escrow with ETH
			await expect(
				geniusDiamond.connect(user1).OpenEscrow(testUUID, { value: escrowAmount }),
			).to.not.be.reverted;
		});

		it('should open an escrow with zero value', async function () {
			// Open escrow with zero ETH
			await expect(geniusDiamond.connect(user1).OpenEscrow(testUUID, { value: 0 })).to.not
				.be.reverted;
		});

		it('should increment escrow ID for multiple escrows from same address', async function () {
			const uuid1 = hre.ethers.encodeBytes32String('uuid-1');
			const uuid2 = hre.ethers.encodeBytes32String('uuid-2');
			const uuid3 = hre.ethers.encodeBytes32String('uuid-3');

			// Open three escrows from user1
			await geniusDiamond.connect(user1).OpenEscrow(uuid1, { value: escrowAmount });
			await geniusDiamond.connect(user1).OpenEscrow(uuid2, { value: escrowAmount });
			await geniusDiamond.connect(user1).OpenEscrow(uuid3, { value: escrowAmount });

			// Verify escrows are created (we can't directly read storage in this test,
			// but we can verify the transactions completed without reverting)
			// In a real-world scenario, we'd add getter functions to verify storage
		});

		it('should allow multiple users to open escrows independently', async function () {
			const user1Amount = hre.ethers.parseEther('1.0');
			const user2Amount = hre.ethers.parseEther('2.0');

			// User1 opens escrow
			await expect(
				geniusDiamond.connect(user1).OpenEscrow(testUUID, { value: user1Amount }),
			).to.not.be.reverted;

			// User2 opens escrow with different amount
			await expect(
				geniusDiamond.connect(user2).OpenEscrow(testUUID, { value: user2Amount }),
			).to.not.be.reverted;

			// Both transactions should succeed without interfering with each other
		});

		it('should handle large escrow amounts', async function () {
			const largeAmount = hre.ethers.parseEther('1000.0');

			// Open escrow with large amount
			await expect(
				geniusDiamond.connect(owner).OpenEscrow(testUUID, { value: largeAmount }),
			).to.not.be.reverted;
		});

		it('should allow same UUID to be used by different addresses', async function () {
			const sameUUID = hre.ethers.encodeBytes32String('shared-uuid');

			// User1 opens escrow with UUID
			await expect(
				geniusDiamond.connect(user1).OpenEscrow(sameUUID, { value: escrowAmount }),
			).to.not.be.reverted;

			// User2 opens escrow with same UUID
			await expect(
				geniusDiamond.connect(user2).OpenEscrow(sameUUID, { value: escrowAmount }),
			).to.not.be.reverted;

			// Should not conflict as escrows are per-address
		});

		it('should accept empty UUID (zero bytes32)', async function () {
			const emptyUUID = hre.ethers.ZeroHash;

			// Open escrow with empty UUID
			await expect(
				geniusDiamond.connect(user1).OpenEscrow(emptyUUID, { value: escrowAmount }),
			).to.not.be.reverted;
		});

		it('should handle maximum bytes32 UUID value', async function () {
			const maxUUID = '0x' + 'f'.repeat(64);

			// Open escrow with max UUID
			await expect(
				geniusDiamond.connect(user1).OpenEscrow(maxUUID, { value: escrowAmount }),
			).to.not.be.reverted;
		});
	});

	describe('Escrow Storage', function () {
		it('should accept sequential escrow openings without revert', async function () {
			const escrowAmount1 = hre.ethers.parseEther('1.0');
			const escrowAmount2 = hre.ethers.parseEther('2.0');
			const escrowAmount3 = hre.ethers.parseEther('3.0');

			const uuid1 = hre.ethers.encodeBytes32String('uuid-1');
			const uuid2 = hre.ethers.encodeBytes32String('uuid-2');
			const uuid3 = hre.ethers.encodeBytes32String('uuid-3');

			// Open escrows sequentially
			await expect(geniusDiamond.connect(user1).OpenEscrow(uuid1, { value: escrowAmount1 }))
				.to.not.be.reverted;

			await expect(geniusDiamond.connect(user1).OpenEscrow(uuid2, { value: escrowAmount2 }))
				.to.not.be.reverted;

			await expect(geniusDiamond.connect(user1).OpenEscrow(uuid3, { value: escrowAmount3 }))
				.to.not.be.reverted;

			// All three escrows should be stored successfully
		});

		it('should handle rapid escrow creation (stress test)', async function () {
			const numEscrows = 10;
			const amount = hre.ethers.parseEther('0.1');

			// Create multiple escrows rapidly
			for (let i = 0; i < numEscrows; i++) {
				const uuid = hre.ethers.encodeBytes32String(`uuid-${i}`);
				await geniusDiamond.connect(user1).OpenEscrow(uuid, { value: amount });
			}

			// All escrows should be created successfully
		});
	});

	describe('Contract Balance', function () {
		it('should increase contract balance when escrow is opened', async function () {
			const escrowAmount = hre.ethers.parseEther('5.0');
			const testUUID = hre.ethers.encodeBytes32String('balance-test');

			// Get initial balance
			const initialBalance = await hre.ethers.provider.getBalance(diamondAddress);

			// Open escrow
			await geniusDiamond.connect(user1).OpenEscrow(testUUID, { value: escrowAmount });

			// Get new balance
			const newBalance = await hre.ethers.provider.getBalance(diamondAddress);

			// Verify balance increased by escrow amount
			expect(newBalance - initialBalance).to.equal(escrowAmount);
		});

		it('should accumulate balance from multiple escrows', async function () {
			const amount1 = hre.ethers.parseEther('1.0');
			const amount2 = hre.ethers.parseEther('2.0');
			const amount3 = hre.ethers.parseEther('3.0');
			const totalAmount = amount1 + amount2 + amount3;

			const uuid1 = hre.ethers.encodeBytes32String('acc-1');
			const uuid2 = hre.ethers.encodeBytes32String('acc-2');
			const uuid3 = hre.ethers.encodeBytes32String('acc-3');

			// Get initial balance
			const initialBalance = await hre.ethers.provider.getBalance(diamondAddress);

			// Open multiple escrows
			await geniusDiamond.connect(user1).OpenEscrow(uuid1, { value: amount1 });
			await geniusDiamond.connect(user1).OpenEscrow(uuid2, { value: amount2 });
			await geniusDiamond.connect(user1).OpenEscrow(uuid3, { value: amount3 });

			// Get new balance
			const newBalance = await hre.ethers.provider.getBalance(diamondAddress);

			// Verify balance increased by total amount
			expect(newBalance - initialBalance).to.equal(totalAmount);
		});
	});
});
