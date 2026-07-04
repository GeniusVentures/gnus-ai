import { Diamond } from '@diamondslab/diamonds';
import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types/GeniusDiamond';

describe('GeniusOwnershipFacet', function () {
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

	describe('owner()', function () {
		it('should return the current contract owner', async function () {
			const currentOwner = await geniusDiamond.owner();
			expect(currentOwner).to.equal(owner.address);
		});

		it('should return owner address that matches deployer', async function () {
			const currentOwner = await geniusDiamond.owner();
			expect(currentOwner).to.not.equal(hre.ethers.ZeroAddress);
			expect(currentOwner).to.be.properAddress;
		});
	});

	describe('transferOwnership()', function () {
		it('should transfer ownership to a new valid address', async function () {
			// Get initial owner
			const initialOwner = await geniusDiamond.owner();
			expect(initialOwner).to.equal(owner.address);

			// Transfer ownership to user1
			await expect(geniusDiamond.connect(owner).transferOwnership(user1.address))
				.to.emit(geniusDiamond, 'OwnershipTransferred')
				.withArgs(owner.address, user1.address);

			// Verify new owner
			const newOwner = await geniusDiamond.owner();
			expect(newOwner).to.equal(user1.address);
		});

		it('should emit OwnershipTransferred event with correct parameters', async function () {
			await expect(geniusDiamond.connect(owner).transferOwnership(user1.address))
				.to.emit(geniusDiamond, 'OwnershipTransferred')
				.withArgs(owner.address, user1.address);
		});

		it('should grant DEFAULT_ADMIN_ROLE to new owner', async function () {
			const DEFAULT_ADMIN_ROLE = await geniusDiamond.DEFAULT_ADMIN_ROLE();

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// Verify new owner has DEFAULT_ADMIN_ROLE
			const hasRole = await geniusDiamond.hasRole(DEFAULT_ADMIN_ROLE, user1.address);
			expect(hasRole).to.be.true;
		});

		it('should grant UPGRADER_ROLE to new owner', async function () {
			const UPGRADER_ROLE = await geniusDiamond.UPGRADER_ROLE();

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// Verify new owner has UPGRADER_ROLE
			const hasRole = await geniusDiamond.hasRole(UPGRADER_ROLE, user1.address);
			expect(hasRole).to.be.true;
		});

		it('should revoke DEFAULT_ADMIN_ROLE from previous owner', async function () {
			const DEFAULT_ADMIN_ROLE = await geniusDiamond.DEFAULT_ADMIN_ROLE();

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// Verify old owner no longer has DEFAULT_ADMIN_ROLE
			const hasRole = await geniusDiamond.hasRole(DEFAULT_ADMIN_ROLE, owner.address);
			expect(hasRole).to.be.false;
		});

		it('should revoke UPGRADER_ROLE from previous owner', async function () {
			const UPGRADER_ROLE = await geniusDiamond.UPGRADER_ROLE();

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// Verify old owner no longer has UPGRADER_ROLE
			const hasRole = await geniusDiamond.hasRole(UPGRADER_ROLE, owner.address);
			expect(hasRole).to.be.false;
		});

		it('should revert when non-owner tries to transfer ownership', async function () {
			await expect(
				geniusDiamond.connect(user1).transferOwnership(user2.address),
			).to.be.revertedWith('LibDiamond: Must be contract owner');
		});

		it('should allow new owner to transfer ownership again', async function () {
			// First transfer: owner -> user1
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// Verify user1 is now owner
			expect(await geniusDiamond.owner()).to.equal(user1.address);

			// Second transfer: user1 -> user2
			await expect(geniusDiamond.connect(user1).transferOwnership(user2.address))
				.to.emit(geniusDiamond, 'OwnershipTransferred')
				.withArgs(user1.address, user2.address);

			// Verify user2 is now owner
			expect(await geniusDiamond.owner()).to.equal(user2.address);
		});

		it('should allow owner to transfer to self (no-op)', async function () {
			// Transfer to self should work but not change ownership
			await expect(geniusDiamond.connect(owner).transferOwnership(owner.address))
				.to.emit(geniusDiamond, 'OwnershipTransferred')
				.withArgs(owner.address, owner.address);

			// Owner should remain the same
			expect(await geniusDiamond.owner()).to.equal(owner.address);
		});

		it('should prevent old owner from calling owner-only functions after transfer', async function () {
			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// Old owner should not be able to transfer ownership
			await expect(
				geniusDiamond.connect(owner).transferOwnership(user2.address),
			).to.be.revertedWith('LibDiamond: Must be contract owner');
		});

		it('should maintain role grants across ownership transfer', async function () {
			const MINTER_ROLE = await geniusDiamond.MINTER_ROLE();

			// Grant MINTER_ROLE to user2 before transfer
			await geniusDiamond.connect(owner).grantRole(MINTER_ROLE, user2.address);

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// user2 should still have MINTER_ROLE
			const hasRole = await geniusDiamond.hasRole(MINTER_ROLE, user2.address);
			expect(hasRole).to.be.true;
		});
	});

	describe('Access Control Integration', function () {
		it('should allow new owner to grant roles', async function () {
			const MINTER_ROLE = await geniusDiamond.MINTER_ROLE();

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// New owner should be able to grant roles
			await expect(geniusDiamond.connect(user1).grantRole(MINTER_ROLE, user2.address)).to
				.not.be.reverted;

			// Verify role was granted
			const hasRole = await geniusDiamond.hasRole(MINTER_ROLE, user2.address);
			expect(hasRole).to.be.true;
		});

		it('should prevent old owner from granting roles after transfer', async function () {
			const MINTER_ROLE = await geniusDiamond.MINTER_ROLE();

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// Old owner should not be able to grant roles
			await expect(geniusDiamond.connect(owner).grantRole(MINTER_ROLE, user2.address)).to.be
				.reverted;
		});

		it('should allow new owner to revoke roles', async function () {
			const MINTER_ROLE = await geniusDiamond.MINTER_ROLE();

			// Grant role before transfer
			await geniusDiamond.connect(owner).grantRole(MINTER_ROLE, user2.address);

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);

			// New owner should be able to revoke roles
			await expect(geniusDiamond.connect(user1).revokeRole(MINTER_ROLE, user2.address)).to
				.not.be.reverted;

			// Verify role was revoked
			const hasRole = await geniusDiamond.hasRole(MINTER_ROLE, user2.address);
			expect(hasRole).to.be.false;
		});
	});

	describe('Edge Cases', function () {
		it('should handle multiple rapid ownership transfers', async function () {
			// Transfer owner -> user1
			await geniusDiamond.connect(owner).transferOwnership(user1.address);
			expect(await geniusDiamond.owner()).to.equal(user1.address);

			// Transfer user1 -> user2
			await geniusDiamond.connect(user1).transferOwnership(user2.address);
			expect(await geniusDiamond.owner()).to.equal(user2.address);

			// Transfer user2 -> owner (back to original)
			await geniusDiamond.connect(user2).transferOwnership(owner.address);
			expect(await geniusDiamond.owner()).to.equal(owner.address);
		});

		it('should maintain contract state across ownership transfer', async function () {
			// Establish persistent state without the removed escrow feature:
			// a token balance and a granted role should both survive an ownership transfer,
			// since the diamond owner (LibDiamond contractOwner) is separate from AccessControl roles.
			await geniusDiamond['mint(address,uint256)'](
				user1.address,
				hre.ethers.parseEther('100'),
			);
			const role = await geniusDiamond.MINTER_ROLE();
			await geniusDiamond.connect(owner).grantRole(role, user2.address);

			// Record pre-transfer state
			const balanceBefore = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(await geniusDiamond.hasRole(role, user2.address)).to.be.true;

			// Transfer ownership
			await geniusDiamond.connect(owner).transferOwnership(user1.address);
			expect(await geniusDiamond.owner()).to.equal(user1.address);

			// State should be unchanged after the transfer
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(
				balanceBefore,
			);
			expect(await geniusDiamond.hasRole(role, user2.address)).to.be.true;
		});

		it('should allow ownership queries from any address', async function () {
			// Any address should be able to query owner
			const ownerFromUser1 = await geniusDiamond.connect(user1).owner();
			const ownerFromUser2 = await geniusDiamond.connect(user2).owner();

			expect(ownerFromUser1).to.equal(owner.address);
			expect(ownerFromUser2).to.equal(owner.address);
		});
	});
});
