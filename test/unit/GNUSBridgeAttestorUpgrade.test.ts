import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import type { HDNodeWallet } from 'ethers';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';

/**
 * Phase 15 unit tests — BRIDGE-10 storage-append slot probe + the GNUSBridgeAttestor
 * admin surface (BRIDGE-11 bootstrap, D-03 threshold override, D-05 emergency recovery).
 *
 * Slot map under test (base = keccak256("gnus.ai.bridge.validator.storage")):
 *   +0 processedMessages (mapping — not probed)   +1 validatorMerkleRoot (legacy, frozen)
 *   +2 validatorThreshold (legacy, frozen)        +3 bridgeAttestorRoot
 *   +4 bridgeAttestorEpoch (full slot, D-11)      +5 bridgeAttestorV2Initialized
 *   +6 activeAttestorThreshold
 *
 * Assertions (Plan 15-01 Task 3, in order):
 *   1. legacy slots +1/+2 hold values written via hardhat_setStorageAt and still decode
 *      as full 32-byte words after the append; +3..+6 read zero on a fresh deploy.
 *   2. initializeBridgeAttestorV2: non-superAdmin reverts with the access-control revert;
 *      owner bootstrap writes the one-leaf Genesis root at epoch 0, init flag 1, threshold 2;
 *      a second call reverts with the one-shot revert string (D-04).
 *   3. setBridgeAttestorActiveThreshold: 1 reverts at the floor, 17 at the cap, 5 succeeds
 *      and emits BridgeAttestorActiveThresholdSet(2, 5) with slot +6 reading 5 (D-03).
 *   4. emergencyRecoverAttestorSet: unpaused reverts; after emergencyPause() a nonzero root
 *      succeeds, emits BridgeAttestorEmergencyReset(0, 1, oldRoot, newRoot), leaves slot +5
 *      == 1, sets epoch to 1; a subsequent initializeBridgeAttestorV2 still reverts
 *      (Genesis structurally unrecoverable, D-05 / T-15-04).
 *
 * Genesis addresses are fresh Wallet.createRandom() per run — no hardcoded keys (T-15-05).
 * Revert strings asserted below must match contracts/gnus-ai/GNUSBridgeAttestor.sol exactly.
 */
describe('GNUSBridgeAttestor V2 upgrade', function () {
	this.timeout(0); // Extended indefinitely for diamond deployment time

	// keccak256("gnus.ai.bridge.validator.storage") — GNUSBridgeValidatorStorage layout base slot
	const BRIDGE_VALIDATOR_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.bridge.validator.storage'));
	// keccak256("gnus.ai.treasury.storage") — GNUSTreasuryStorage layout base slot
	const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

	// Raw slot offsets from the layout base (BRIDGE-10 / D-11 append map).
	const SLOT_VALIDATOR_MERKLE_ROOT = 1n; // legacy, frozen once V2 is active
	const SLOT_VALIDATOR_THRESHOLD = 2n; // legacy, frozen once V2 is active
	const SLOT_ATTESTOR_ROOT = 3n; // bytes32(0) = not bootstrapped
	const SLOT_ATTESTOR_EPOCH = 4n; // 0 = Genesis epoch
	const SLOT_ATTESTOR_V2_INITIALIZED = 5n; // one-shot, never resets
	const SLOT_ACTIVE_THRESHOLD = 6n; // init writes 2; setter bounds 2..16

	// D-03 named-threshold values (mirror the facet constants).
	const GENESIS_ATTESTOR_THRESHOLD = 1n;
	const ACTIVE_ATTESTOR_THRESHOLD = 2n;
	const THRESHOLD_FLOOR_REVERT = 1n;
	const THRESHOLD_CAP_REVERT = 17n;
	const THRESHOLD_VALID = 5n;

	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let initialSnapshotId: string;
	let snapshotId: string;
	let diamondAddress: string;

	/// Raw storage slot at base + offset, 32-byte zero-padded hex.
	function attestorSlot(offset: bigint): string {
		return ethers.toBeHex(BigInt(BRIDGE_VALIDATOR_STORAGE_SLOT) + offset, 32);
	}

	/// Read the raw 32-byte word at base + offset as a bigint.
	async function readSlot(offset: bigint): Promise<bigint> {
		const value = await hre.network.provider.send('eth_getStorageAt', [diamondAddress, attestorSlot(offset)]);
		return BigInt(value);
	}

	/// Write a raw 32-byte word at base + offset (bypasses Solidity — layout probe only).
	async function writeSlot(offset: bigint, value: string): Promise<void> {
		await hre.network.provider.send('hardhat_setStorageAt', [diamondAddress, attestorSlot(offset), value]);
	}

	/// Bootstraps the V2 attestor set from the superAdmin with a fresh random Genesis address
	/// and returns the one-leaf Genesis root written at slot +3.
	async function bootstrapGenesis(): Promise<string> {
		const genesis: HDNodeWallet = Wallet.createRandom();
		await geniusDiamond.initializeBridgeAttestorV2(genesis.address);
		return ethers.keccak256(ethers.solidityPacked(['address'], [genesis.address]));
	}

	before(async function () {
		// 13-04: deploy GNUSLifecyclePolicy library + install factory linker before diamond deploy.
		await setupLifecyclePolicyLinking();
		const config = {
			diamondName: 'GeniusDiamond',
			network: 'hardhat',
		};

		const deployer = await LocalDiamondDeployer.getInstance(hre, config);
		const diamond = await deployer.getDiamondDeployed();
		const deployedData = diamond.getDeployedDiamondData();
		diamondAddress = deployedData.DiamondAddress || '';

		geniusDiamond = await loadDiamondContract<GeniusDiamond>(diamond, diamondAddress, hre.ethers);

		[owner, user1] = await ethers.getSigners();

		// Seed the provenance counter (scaffold guard — this suite never mints, but re-runs
		// against a cached diamond must not revert). Guarded by a storage probe.
		const initialized = await hre.network.provider.send('eth_getStorageAt', [
			diamondAddress,
			ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
		]);
		if (BigInt(initialized) === 0n) {
			await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
		}

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

	describe('BRIDGE-10 storage append (slot probe)', function () {
		it('legacy slots +1/+2 hold hardhat_setStorageAt values and decode as full 32-byte words after the append', async function () {
			const legacyRoot = ethers.id('legacy-validator-root');
			const legacyThreshold = 3n;
			await writeSlot(SLOT_VALIDATOR_MERKLE_ROOT, legacyRoot);
			await writeSlot(SLOT_VALIDATOR_THRESHOLD, ethers.toBeHex(legacyThreshold, 32));

			expect(await readSlot(SLOT_VALIDATOR_MERKLE_ROOT)).to.equal(BigInt(legacyRoot));
			expect(await readSlot(SLOT_VALIDATOR_THRESHOLD)).to.equal(legacyThreshold);
		});

		it('appended slots +3..+6 read zero on a fresh deploy (legacy diamonds see V2 inactive)', async function () {
			expect(await readSlot(SLOT_ATTESTOR_ROOT)).to.equal(0n);
			expect(await readSlot(SLOT_ATTESTOR_EPOCH)).to.equal(0n);
			expect(await readSlot(SLOT_ATTESTOR_V2_INITIALIZED)).to.equal(0n);
			expect(await readSlot(SLOT_ACTIVE_THRESHOLD)).to.equal(0n);
		});
	});

	describe('initializeBridgeAttestorV2 (BRIDGE-11, D-04 one-shot bootstrap)', function () {
		it('reverts "Only SuperAdmin allowed" when called by a non-superAdmin signer', async function () {
			const genesis = Wallet.createRandom();
			await expect(
				geniusDiamond.connect(user1).initializeBridgeAttestorV2(genesis.address),
			).to.be.revertedWith('Only SuperAdmin allowed');
		});

		it('bootstraps once from the superAdmin: one-leaf root at +3, epoch 0 at +4, init flag at +5, threshold 2 at +6', async function () {
			const genesisRoot = await bootstrapGenesis();

			expect(await readSlot(SLOT_ATTESTOR_ROOT)).to.equal(BigInt(genesisRoot));
			expect(await readSlot(SLOT_ATTESTOR_EPOCH)).to.equal(0n);
			expect(await readSlot(SLOT_ATTESTOR_V2_INITIALIZED)).to.equal(1n);
			// The getter is the EFFECTIVE epoch-derived threshold (facet spec): at epoch 0 it
			// returns GENESIS_ATTESTOR_THRESHOLD (1), while the STORED override (slot +6 raw)
			// holds the ACTIVE default (2) written by init per D-03 "defaults set at init".
			expect(await geniusDiamond.activeBridgeAttestorThreshold()).to.equal(GENESIS_ATTESTOR_THRESHOLD);
			expect(await readSlot(SLOT_ACTIVE_THRESHOLD)).to.equal(ACTIVE_ATTESTOR_THRESHOLD);

			// View getters agree with the raw slots.
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(genesisRoot);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(0n);
		});

		it('a second init call reverts with the one-shot revert string', async function () {
			await bootstrapGenesis();
			await expect(
				geniusDiamond.initializeBridgeAttestorV2(Wallet.createRandom().address),
			).to.be.revertedWith('Attestor set already initialized');
		});
	});

	describe('setBridgeAttestorActiveThreshold (D-03 bounded override)', function () {
		it('reverts at the floor for 1 (structurally cannot recreate 1-of-N)', async function () {
			await bootstrapGenesis();
			await expect(
				geniusDiamond.setBridgeAttestorActiveThreshold(THRESHOLD_FLOOR_REVERT),
			).to.be.revertedWith('Threshold below active floor');
		});

		it('reverts at the cap for 17 (above MAX_ATTESTOR_SIGNATURES)', async function () {
			await bootstrapGenesis();
			await expect(
				geniusDiamond.setBridgeAttestorActiveThreshold(THRESHOLD_CAP_REVERT),
			).to.be.revertedWith('Threshold above attestor cap');
		});

		it('accepts 5: emits BridgeAttestorActiveThresholdSet(2, 5) and writes slot +6 == 5', async function () {
			await bootstrapGenesis();
			await expect(geniusDiamond.setBridgeAttestorActiveThreshold(THRESHOLD_VALID))
				.to.emit(geniusDiamond, 'BridgeAttestorActiveThresholdSet')
				.withArgs(ACTIVE_ATTESTOR_THRESHOLD, THRESHOLD_VALID);
			expect(await readSlot(SLOT_ACTIVE_THRESHOLD)).to.equal(THRESHOLD_VALID);
		});
	});

	describe('emergencyRecoverAttestorSet (D-05 paused-gated recovery)', function () {
		it('reverts while the diamond is unpaused', async function () {
			await bootstrapGenesis();
			await expect(
				geniusDiamond.emergencyRecoverAttestorSet(ethers.id('recovery-root')),
			).to.be.revertedWith('GNUSControl: contract must be paused');
		});

		it('recovers while paused: emits (0, 1, oldRoot, newRoot), epoch = old + 1, init flag untouched, Genesis unrecoverable', async function () {
			const genesisRoot = await bootstrapGenesis();
			const recoveryRoot = ethers.id('recovery-root');

			await geniusDiamond.emergencyPause();
			await expect(geniusDiamond.emergencyRecoverAttestorSet(recoveryRoot))
				.to.emit(geniusDiamond, 'BridgeAttestorEmergencyReset')
				.withArgs(0n, 1n, genesisRoot, recoveryRoot);

			expect(await readSlot(SLOT_ATTESTOR_ROOT)).to.equal(BigInt(recoveryRoot));
			expect(await readSlot(SLOT_ATTESTOR_EPOCH)).to.equal(1n);
			expect(await readSlot(SLOT_ATTESTOR_V2_INITIALIZED)).to.equal(1n);
			// Effective threshold is epoch-derived: at epoch 1 the stored override (2) governs.
			expect(await geniusDiamond.activeBridgeAttestorThreshold()).to.equal(ACTIVE_ATTESTOR_THRESHOLD);

			// T-15-04: bootstrap is still impossible after recovery — epoch 0 is unreachable.
			await expect(
				geniusDiamond.initializeBridgeAttestorV2(Wallet.createRandom().address),
			).to.be.revertedWith('Attestor set already initialized');
		});
	});
});
