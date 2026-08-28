import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';

describe('GNUSControlStorage Tests', function () {
	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;

	let initialSnapshotId: string;
	let snapshotId: string;

	const SUPER_ADMIN_ROLE =
		'0x0000000000000000000000000000000000000000000000000000000000000000';
	const GNUS_TOKEN_ID = 0;
	const NFT_TOKEN_ID_1 = 1;
	const NFT_TOKEN_ID_2 = 2;

	before(async function () {
				// 13-04: deploy GNUSLifecyclePolicy library + install factory linker before diamond deploy.
				await setupLifecyclePolicyLinking();
		// Get signers
		const signers = await hre.ethers.getSigners();
		owner = signers[0]; // Owner has SUPER_ADMIN_ROLE by default
		user1 = signers[1];
		user2 = signers[2];
		user3 = signers[3];

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

	describe('Storage layout and protocol info', function () {
		it('should return initial protocol info', async function () {
			// Bridge suites alias the shared diamond's chainID to the local
			// chain (GNUSBridgeIn scaffold) and that mutation intentionally
			// outlives their snapshots — normalize it before asserting
			// defaults (same reset as the zero-chain-ID edge case below).
			await geniusDiamond.setChainID(0);
			const info = await geniusDiamond.protocolInfo();

			// Should have protocol version set during initialization
			expect(info.protocolVersion).to.be.greaterThan(0);
			expect(info.bridgeFee).to.equal(0); // Default bridge fee
			expect(info.chainID).to.equal(0); // Default chain ID
		});

		it('should update and retrieve protocol version', async function () {
			const newVersion = 300;
			await geniusDiamond.setProtocolVersion(newVersion);

			const info = await geniusDiamond.protocolInfo();
			expect(info.protocolVersion).to.equal(newVersion);
		});

		it('should update and retrieve chain ID', async function () {
			const newChainID = 1; // Ethereum mainnet
			await geniusDiamond.setChainID(newChainID);

			const info = await geniusDiamond.protocolInfo();
			expect(info.chainID).to.equal(newChainID);
		});
	});

	describe('Bridge fee management', function () {
		it('should update bridge fee', async function () {
			const newFee = 50; // 5% fee
			await geniusDiamond.updateBridgeFee(newFee);

			const info = await geniusDiamond.protocolInfo();
			expect(info.bridgeFee).to.equal(newFee);
		});

		it('should emit UpdateBridgeFee event', async function () {
			const newFee = 100;
			await expect(geniusDiamond.updateBridgeFee(newFee))
				.to.emit(geniusDiamond, 'UpdateBridgeFee')
				.withArgs(newFee);
		});

		it('should revert if fee exceeds maximum', async function () {
			const tooHighFee = 201; // MAX_FEE is 200
			await expect(geniusDiamond.updateBridgeFee(tooHighFee)).to.be.revertedWith(
				'Too big fee',
			);
		});

		it('should allow maximum fee of 200', async function () {
			const maxFee = 200;
			await geniusDiamond.updateBridgeFee(maxFee);

			const info = await geniusDiamond.protocolInfo();
			expect(info.bridgeFee).to.equal(maxFee);
		});

		it('should revert if non-admin tries to update bridge fee', async function () {
			const newFee = 50;
			await expect(geniusDiamond.connect(user1).updateBridgeFee(newFee)).to.be.reverted;
		});
	});

	describe('Global banned transferors', function () {
		it('should ban address globally', async function () {
			const addr = await user1.getAddress();
			await geniusDiamond.banTransferorForAll(addr);

			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(true);
		});

		it('should emit AddToGlobalBlackList event', async function () {
			await expect(geniusDiamond.banTransferorForAll(await user1.getAddress()))
				.to.emit(geniusDiamond, 'AddToGlobalBlackList')
				.withArgs(await user1.getAddress());
		});

		it('should allow address globally after ban', async function () {
			const addr = await user1.getAddress();
			await geniusDiamond.banTransferorForAll(addr);
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(true);

			await geniusDiamond.allowTransferorForAll(addr);

			// Address should now be allowed
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(false);
		});

		it('should emit RemoveFromGlobalBlackList event', async function () {
			await geniusDiamond.banTransferorForAll(await user1.getAddress());

			await expect(geniusDiamond.allowTransferorForAll(await user1.getAddress()))
				.to.emit(geniusDiamond, 'RemoveFromGlobalBlackList')
				.withArgs(await user1.getAddress());
		});

		it('should ban multiple addresses globally', async function () {
			const addr1 = await user1.getAddress();
			const addr2 = await user2.getAddress();
			const addr3 = await user3.getAddress();

			await geniusDiamond.banTransferorForAll(addr1);
			await geniusDiamond.banTransferorForAll(addr2);
			await geniusDiamond.banTransferorForAll(addr3);

			// All addresses should be banned globally
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr1)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr2)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr3)).to.equal(true);
		});

		it('should revert if non-admin tries to ban globally', async function () {
			await expect(
				geniusDiamond.connect(user1).banTransferorForAll(await user2.getAddress()),
			).to.be.reverted;
		});

		it('should revert if non-admin tries to unban globally', async function () {
			await geniusDiamond.banTransferorForAll(await user1.getAddress());

			await expect(
				geniusDiamond.connect(user2).allowTransferorForAll(await user1.getAddress()),
			).to.be.reverted;
		});
	});

	describe('Token-specific banned transferors', function () {
		it('should ban address for specific token', async function () {
			const addr = await user1.getAddress();
			const tokenIds = [NFT_TOKEN_ID_1];
			const addresses = [addr];

			await geniusDiamond.banTransferorBatch(tokenIds, addresses);

			// Address should be banned for NFT_TOKEN_ID_1 only
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr)).to.equal(false);
		});

		it('should emit AddToBlackList event', async function () {
			const tokenIds = [NFT_TOKEN_ID_1];
			const addresses = [await user1.getAddress()];

			await expect(geniusDiamond.banTransferorBatch(tokenIds, addresses))
				.to.emit(geniusDiamond, 'AddToBlackList')
				.withArgs(tokenIds, addresses);
		});

		it('should allow address for specific token after ban', async function () {
			const addr = await user1.getAddress();
			const tokenIds = [NFT_TOKEN_ID_1];
			const addresses = [addr];

			await geniusDiamond.banTransferorBatch(tokenIds, addresses);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(true);

			await geniusDiamond.allowTransferorBatch(tokenIds, addresses);

			// Address should now be allowed for NFT_TOKEN_ID_1
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(false);
		});

		it('should emit RemoveFromBlackList event', async function () {
			const tokenIds = [NFT_TOKEN_ID_1];
			const addresses = [await user1.getAddress()];

			await geniusDiamond.banTransferorBatch(tokenIds, addresses);

			await expect(geniusDiamond.allowTransferorBatch(tokenIds, addresses))
				.to.emit(geniusDiamond, 'RemoveFromBlackList')
				.withArgs(tokenIds, addresses);
		});

		it('should ban multiple addresses for multiple tokens', async function () {
			const addr1 = await user1.getAddress();
			const addr2 = await user2.getAddress();
			const addr3 = await user3.getAddress();
			const tokenIds = [NFT_TOKEN_ID_1, NFT_TOKEN_ID_2, GNUS_TOKEN_ID];
			const addresses = [addr1, addr2, addr3];

			await geniusDiamond.banTransferorBatch(tokenIds, addresses);

			// Each address should be banned for corresponding token
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr1)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr2)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr3)).to.equal(true);
		});

		it('should handle same address for multiple tokens', async function () {
			const addr = await user1.getAddress();
			const tokenIds = [NFT_TOKEN_ID_1, NFT_TOKEN_ID_2];
			const addresses = [addr, addr];

			await geniusDiamond.banTransferorBatch(tokenIds, addresses);

			// user1 should be banned for both tokens
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr)).to.equal(true);
		});

		it('should revert if non-admin tries to ban for token', async function () {
			const tokenIds = [NFT_TOKEN_ID_1];
			const addresses = [await user2.getAddress()];

			await expect(geniusDiamond.connect(user1).banTransferorBatch(tokenIds, addresses)).to
				.be.reverted;
		});

		it('should revert if non-admin tries to unban for token', async function () {
			const tokenIds = [NFT_TOKEN_ID_1];
			const addresses = [await user1.getAddress()];

			await geniusDiamond.banTransferorBatch(tokenIds, addresses);

			await expect(geniusDiamond.connect(user2).allowTransferorBatch(tokenIds, addresses))
				.to.be.reverted;
		});
	});

	describe('getBannedTransferor view', function () {
		it('should report per-token ban set by banTransferorBatch', async function () {
			const addr = await user1.getAddress();

			await geniusDiamond.banTransferorBatch([NFT_TOKEN_ID_1], [addr]);

			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr)).to.equal(false);
		});

		it('should report unbanned after allowTransferorBatch', async function () {
			const addr = await user1.getAddress();

			await geniusDiamond.banTransferorBatch([NFT_TOKEN_ID_1], [addr]);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(true);

			await geniusDiamond.allowTransferorBatch([NFT_TOKEN_ID_1], [addr]);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(false);
		});

		it('should report global ban via tokenId 0 and via any other tokenId', async function () {
			const addr = await user1.getAddress();

			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(false);

			await geniusDiamond.banTransferorForAll(addr);
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(true);

			await geniusDiamond.allowTransferorForAll(addr);
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, addr)).to.equal(false);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr)).to.equal(false);
		});

		it('should round-trip batch bans across multiple token/address pairs', async function () {
			const addr1 = await user1.getAddress();
			const addr2 = await user2.getAddress();

			await geniusDiamond.banTransferorBatch(
				[NFT_TOKEN_ID_1, NFT_TOKEN_ID_2],
				[addr1, addr2],
			);

			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr1)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr2)).to.equal(true);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr1)).to.equal(false);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr2)).to.equal(false);

			await geniusDiamond.allowTransferorBatch(
				[NFT_TOKEN_ID_1, NFT_TOKEN_ID_2],
				[addr1, addr2],
			);

			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr1)).to.equal(false);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr2)).to.equal(false);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_2, addr1)).to.equal(false);
			expect(await geniusDiamond.getBannedTransferor(NFT_TOKEN_ID_1, addr2)).to.equal(false);
		});
	});

	describe('Protocol initialization', function () {
		it('should have initialized protocol version', async function () {
			const info = await geniusDiamond.protocolInfo();
			expect(info.protocolVersion).to.be.greaterThanOrEqual(230);
		});

		it('should prevent re-initialization', async function () {
			// GNUSControl_Initialize230 should revert if called again
			await expect(geniusDiamond.GNUSControl_Initialize230()).to.be.revertedWith(
				'Constructor was already initialized >= 2.30',
			);
		});
	});

	describe('Access control', function () {
		it('should allow owner to set protocol version', async function () {
			await expect(geniusDiamond.setProtocolVersion(300)).to.not.be.reverted;
		});

		it('should allow owner to set chain ID', async function () {
			await expect(geniusDiamond.setChainID(1)).to.not.be.reverted;
		});

		it('should revert if non-owner tries to set protocol version', async function () {
			await expect(geniusDiamond.connect(user1).setProtocolVersion(300)).to.be.reverted;
		});

		it('should revert if non-owner tries to set chain ID', async function () {
			await expect(geniusDiamond.connect(user1).setChainID(1)).to.be.reverted;
		});
	});

	describe('Edge cases', function () {
		it('should handle zero address in global ban', async function () {
			await geniusDiamond.banTransferorForAll(hre.ethers.ZeroAddress);

			// Zero address should be banned globally
			expect(await geniusDiamond.getBannedTransferor(GNUS_TOKEN_ID, hre.ethers.ZeroAddress)).to
				.equal(true);
		});

		it('should handle empty batch operations', async function () {
			const tokenIds: number[] = [];
			const addresses: string[] = [];

			await expect(geniusDiamond.banTransferorBatch(tokenIds, addresses)).to.not.be
				.reverted;
		});

		it('should handle zero bridge fee', async function () {
			await geniusDiamond.updateBridgeFee(0);

			const info = await geniusDiamond.protocolInfo();
			expect(info.bridgeFee).to.equal(0);
		});

		it('should handle zero chain ID', async function () {
			await geniusDiamond.setChainID(0);

			const info = await geniusDiamond.protocolInfo();
			expect(info.chainID).to.equal(0);
		});

		it('should handle large batch operations', async function () {
			const tokenIds = Array(10)
				.fill(0)
				.map((_, i) => i);
			const addresses = Array(10)
				.fill(0)
				.map(() => hre.ethers.Wallet.createRandom().address);

			await geniusDiamond.banTransferorBatch(tokenIds, addresses);

			// All 10 addresses should be banned for corresponding tokens
			for (let i = 0; i < 10; i++) {
				expect(await geniusDiamond.getBannedTransferor(tokenIds[i], addresses[i])).to.equal(
					true,
				);
			}
		});
	});
});
