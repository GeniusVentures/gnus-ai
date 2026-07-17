import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';

describe('Phase 5: Circuit Breaker & Performance', function () {
	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	const GNUS_TOKEN_ID = 0;
	const kMintAmount = 1000;
	const kTransferAmount = 100;

	let snapshotId: string;

	before(async function () {
		const signers = await hre.ethers.getSigners();
		owner = signers[0];
		user = signers[1];

		const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
		const deployer = await LocalDiamondDeployer.getInstance(hre, config);
		const diamond = await deployer.getDiamondDeployed();
		const addr = diamond.getDeployedDiamondData().DiamondAddress || '';
		geniusDiamond = await loadDiamondContract<GeniusDiamond>(diamond, addr, hre.ethers);
	});

	beforeEach(async function () {
		snapshotId = await hre.network.provider.send('evm_snapshot');
	});

	afterEach(async function () {
		await hre.network.provider.send('evm_revert', [snapshotId]);
	});

	// ── T1-T2: Diamond-Wide Emergency Pause ──────────────────────────

	describe('Emergency Pause', function () {
		it('should allow super admin to pause', async function () {
			await expect(geniusDiamond.connect(owner).emergencyPause()).to.not.be.reverted;
		});

		it('should return paused = true after pause', async function () {
			await geniusDiamond.connect(owner).emergencyPause();
			expect(await geniusDiamond.isEmergencyPaused()).to.be.true;
		});

		it('should allow super admin to unpause', async function () {
			await geniusDiamond.connect(owner).emergencyPause();
			await expect(geniusDiamond.connect(owner).emergencyUnpause()).to.not.be.reverted;
			expect(await geniusDiamond.isEmergencyPaused()).to.be.false;
		});

		it('should revert transfers when paused', async function () {
			await geniusDiamond.connect(owner).mint(owner.address, kMintAmount);
			await geniusDiamond.connect(owner).emergencyPause();
			await expect(
				geniusDiamond.connect(owner).transfer(user.address, kTransferAmount),
			).to.be.revertedWith('GNUSControl: contract paused');
		});

		it('should allow transfers after unpause', async function () {
			await geniusDiamond.connect(owner).mint(owner.address, kMintAmount);
			await geniusDiamond.connect(owner).emergencyPause();
			await geniusDiamond.connect(owner).emergencyUnpause();
			await expect(geniusDiamond.connect(owner).transfer(user.address, kTransferAmount)).to
				.not.be.reverted;
		});

		it('should revert when non-admin tries to pause', async function () {
			await expect(geniusDiamond.connect(user).emergencyPause()).to.be.reverted;
		});

		it('should revert when non-admin tries to emergencyUnpause', async function () {
			await geniusDiamond.connect(owner).emergencyPause();
			await expect(geniusDiamond.connect(user).emergencyUnpause()).to.be.reverted;
		});
	});

	// ── CR-01: Batch Paths Honor Diamond-Wide Pause ─────────────────

	describe('Batch Paths Honor Pause (CR-01)', function () {
		it('should revert mintBatch when paused', async function () {
			await geniusDiamond.connect(owner).emergencyPause();
			await expect(
				geniusDiamond['mintBatch(address[],uint256[])']([user.address], [kMintAmount]),
			).to.be.revertedWith('GNUSControl: contract paused');
		});

		it('should revert transferBatch when paused', async function () {
			await geniusDiamond['mintBatch(address[],uint256[])']([owner.address], [kMintAmount]);
			await geniusDiamond.connect(owner).emergencyPause();
			await expect(
				geniusDiamond.connect(owner).transferBatch([user.address], [kTransferAmount]),
			).to.be.revertedWith('GNUSControl: contract paused');
		});

		it('should revert transferOrBurnBatch when paused', async function () {
			await geniusDiamond['mintBatch(address[],uint256[])']([owner.address], [kMintAmount]);
			await geniusDiamond.connect(owner).emergencyPause();
			await expect(
				geniusDiamond.connect(owner).transferOrBurnBatch([user.address], [kTransferAmount]),
			).to.be.revertedWith('GNUSControl: contract paused');
		});
	});

	// ── T4: Bin Count Cap ───────────────────────────────────────────

	describe('Bin Count Cap', function () {
		it('should accept binCount within cap', async function () {
			await expect(geniusDiamond.connect(owner).setDefaultBinCount(256)).to.not.be.reverted;
		});

		it('should revert when binCount exceeds cap', async function () {
			await expect(geniusDiamond.connect(owner).setDefaultBinCount(257)).to.be.revertedWith(
				'Bin count exceeds maximum',
			);
		});

		it('should revert when binCount is zero', async function () {
			await expect(geniusDiamond.connect(owner).setDefaultBinCount(0)).to.be.revertedWith(
				'Bin count must be greater than 0',
			);
		});
	});

	// ── CR-02: Bin Config Change Must Not Lock Funds ───────────────

	describe('Bin Config Change Safety (CR-02)', function () {
		const kWindowSeconds = 200;
		const kInitialBins = 2;
		const kLargerBins = 10;
		const kAdvanceSeconds = 50;
		const kLargeLimit = 1_000_000;
		const kTransferForLimiter = 10;

		it('should not lock funds when binCount increases after first withdrawal', async function () {
			await geniusDiamond.connect(owner).setDefaultLimitAmount(kLargeLimit);
			await geniusDiamond.connect(owner).setDefaultWindowSeconds(kWindowSeconds);
			await geniusDiamond.connect(owner).setDefaultBinCount(kInitialBins);
			await geniusDiamond.connect(owner).setLimiterEnabled(true);

			await geniusDiamond.connect(owner).mint(user.address, kMintAmount);

			// First withdrawal initializes the bins array sized to kInitialBins (== 2).
			await geniusDiamond.connect(user).transfer(owner.address, kTransferForLimiter);

			// Increase binCount. Without reset-on-change, calculateCurrentBin indexes
			// modulo the NEW binCount (10) into an array of the OLD length (2), going
			// out of bounds and permanently locking the account out of its funds.
			await geniusDiamond.connect(owner).setDefaultBinCount(kLargerBins);

			// Advance time so the bin index lands beyond the original array length:
			// index = floor(50 / (200/10)) % 10 = floor(50/20) % 10 = 2, which is >= 2.
			await hre.network.provider.send('evm_increaseTime', [kAdvanceSeconds]);
			await hre.network.provider.send('evm_mine');

			await expect(geniusDiamond.connect(user).transfer(owner.address, kTransferForLimiter))
				.to.not.be.reverted;
		});
	});

	// ── CR-03: bridgeOut Must Apply Limiter To Child Tokens ─────────

	describe('Bridge-Out Limiter (CR-03)', function () {
		const kExchangeRate = 2;
		const kChildMintAmount = 100;
		const kSmallLimitGnus = 1;
		const kWindowSeconds = 3600;
		const kBinCount = 8;
		const kDestChainID = 1;
		const kPublicKeyByteLength = 32;
		const kSgnsDestination = '0x' + 'ab'.repeat(kPublicKeyByteLength);
		const kChildId = 1; // first child of GNUS_TOKEN_ID (id 0)

		async function setupChildToken(): Promise<void> {
			await geniusDiamond.connect(owner).setDefaultLimitAmount(kSmallLimitGnus);
			await geniusDiamond.connect(owner).setDefaultWindowSeconds(kWindowSeconds);
			await geniusDiamond.connect(owner).setDefaultBinCount(kBinCount);
			await geniusDiamond.connect(owner).setLimiterEnabled(true);

			await geniusDiamond.connect(owner).mint(owner.address, kMintAmount);
			await geniusDiamond
				.connect(owner)
				.createNFT(GNUS_TOKEN_ID, 'Child', 'CHLD', kExchangeRate, kMintAmount, 'uri');
		}

		it('should apply the withdrawal limiter to child-token bridgeOut', async function () {
			await setupChildToken();
			// Mint child tokens to user (owner's GNUS is burned by the mint hook).
			await geniusDiamond
				.connect(owner)
				[
					'mint(address,uint256,uint256,bytes)'
				](user.address, kChildId, kChildMintAmount, '0x');

			// bridgeOut converts childAmount/exchangeRate = 100/2 = 50 GNUS-equivalent,
			// far exceeding the 1 GNUS limit. Before CR-03 this bypassed the limiter.
			await expect(
				geniusDiamond
					.connect(user)
					.bridgeOut(kChildMintAmount, kChildId, kDestChainID, kSgnsDestination, false),
			).to.be.revertedWith('Withdrawal limit exceeded for time window');
		});

		it('should emit SuperAdminBypass when super admin bridges out a child token', async function () {
			await setupChildToken();
			await geniusDiamond
				.connect(owner)
				[
					'mint(address,uint256,uint256,bytes)'
				](owner.address, kChildId, kChildMintAmount, '0x');

			// convAmount = 100/2 = 50 GNUS-equivalent; owner bypasses the limiter and
			// must emit the audit event. The event is declared in a library and is not in
			// the diamond typechain ABI, so parse the raw log topic instead.
			const kExpectedConvAmount = 50;
			const tx = await geniusDiamond
				.connect(owner)
				.bridgeOut(kChildMintAmount, kChildId, kDestChainID, kSgnsDestination, false);
			const receipt = await tx.wait();
			const bypassTopic = hre.ethers.id('SuperAdminBypass(address,uint256,string)');
			const bypassLog = receipt!.logs.find((log) => log.topics[0] === bypassTopic);
			expect(bypassLog, 'SuperAdminBypass event not emitted').to.not.be.undefined;
			const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
				['uint256', 'string'],
				bypassLog!.data,
			);
			expect(decoded[0]).to.equal(kExpectedConvAmount);
			expect(decoded[1]).to.equal('GNUSBridge.bridgeOut');
		});
	});
});
