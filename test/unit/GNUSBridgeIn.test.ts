import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import type { BaseWallet, HDNodeWallet } from 'ethers';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
import {
	BridgeMessageFields,
	BridgeMessageV2,
	aggregateCertificateV2,
	buildAttestorCertificate,
	buildValidatorMerkleTree,
	computeBridgeInStructHashV2,
	computeBridgeMessageId,
	signBridgeInCertificateV2,
} from '../utils/bridge-certificate';
import type { AttestorMerkleTree } from '../utils/bridge-certificate';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';

/**
 * Phase 15 rewrite (BRIDGE-19, D-10) — GNUSBridge bridgeIn for the post-removal
 * world. The Phase 10 legacy surface (six-argument flat bridge-in call shape,
 * selector 0x0bee6121, and the admin root/threshold setter, selector 0x1abd0f1e)
 * was deleted from the facets in Plan 15-02 (D-06); typechain calls to those
 * signatures are compile errors, which is why this file is rewritten rather
 * than patched. This suite now covers:
 *
 *   (1) legacy-selector removal — proven via the diamond loupe (hex selectors
 *       only, never the function-name strings) plus a raw-call revert;
 *   (2) the D-05 emergency recovery that replaced the legacy admin rotation;
 *   (3) every CARRIED Phase 10 semantic re-keyed to the V2 certificate path
 *       (fee, cap, supply, replay, domain binding, pause, D-18 mint) — this
 *       suite EXTENDS, does not replace, the Phase 10 coverage per BRIDGE-19.
 *
 * The full V2 matrix (bootstrap/current-root/root-transition/replay/existing-
 * token, 42 tests) lives in `test/unit/GNUSBridgeAttestorIn.test.ts`; the
 * threshold-override setter coverage (floor/cap/success) lives in
 * `test/unit/GNUSBridgeAttestorUpgrade.test.ts` and is deliberately not
 * duplicated here. The Phase 10 canonical cross-repo vector block that used to
 * live at the bottom of this file is SUPERSEDED by the checked-in BRIDGE-18
 * fixture (`test/fixtures/bridge-attestor-vectors.json`) and its consumer legs.
 *
 * Scaffold (LocalDiamondDeployer / treasury-seed probe / setChainID / snapshot
 * isolation / random attestor wallets + tree) and the local helper shape are
 * copied from `GNUSBridgeAttestorIn.test.ts` — keep the two in lockstep, do not
 * fork the logic. Attestor keys are fresh `Wallet.createRandom()` per suite run
 * (trees are built after creation, and the suite has snapshot isolation).
 *
 * Revert strings asserted below must match
 * `contracts/gnus-ai/GNUSBridgeAttestor.sol` constants exactly.
 */
describe('GNUSBridge bridgeIn (post-removal V2 surface)', function () {
	this.timeout(0); // Extended indefinitely for diamond deployment time

	// keccak256("gnus.ai.treasury.storage") — GNUSTreasuryStorage layout base slot
	const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

	// Selector constants — HEX LITERALS ONLY for the legacy shapes (asserting on
	// the function-name strings would defeat the zero-legacy-reference gate).
	// Legacy six-argument flat bridge-in call shape (removed, Plan 15-02 D-06).
	const SELECTOR_LEGACY_BRIDGE_IN = '0x0bee6121';
	// Legacy admin root/threshold setter (removed; converted to D-05 recovery).
	const SELECTOR_LEGACY_ADMIN_ROOT_SETTER = '0x1abd0f1e';
	// V2 surface — must all resolve to the GNUSBridgeAttestor facet.
	const SELECTOR_BRIDGE_IN_V2 = '0x4d2e0756';
	const SELECTOR_INIT_ATTESTOR_V2 = '0x8c864f52';
	const SELECTOR_THRESHOLD_V2 = '0x604c3b10';
	const SELECTOR_EMERGENCY_RECOVERY_V2 = '0x669588d5';
	const V2_SELECTORS = [
		SELECTOR_BRIDGE_IN_V2,
		SELECTOR_INIT_ATTESTOR_V2,
		SELECTOR_THRESHOLD_V2,
		SELECTOR_EMERGENCY_RECOVERY_V2,
	];

	// The signature string of GNUSBridge's surviving bridge-out entry point —
	// used only to identify the bridge facet address through the loupe.
	const BRIDGE_OUT_SIGNATURE = 'bridgeOut(uint256,uint256,uint256,bytes32,bool)';

	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let initialSnapshotId: string;
	let snapshotId: string;

	let diamondAddress: string;
	let localChainId: bigint;

	// Attestor sets (fresh per suite run — trees are built after creation so
	// randomness is irrelevant; GNUSBridgeAttestorIn.test.ts pattern).
	let attestors: HDNodeWallet[];
	let recoveryAttestors: HDNodeWallet[];
	let nonAttestor: HDNodeWallet;
	let activeTree: AttestorMerkleTree;

	// Named constants (no magic numbers).
	const SRC_CHAIN_ID = 137n; // != localChainId (cross-chain guard, SPEC :490)
	const DEFAULT_AMOUNT = toWei(10);
	const GENESIS_EPOCH = 0n;
	const ACTIVE_EPOCH = 1n; // epoch after the genesis transition / recovery
	const ACTIVE_THRESHOLD = 2n; // D-03 default installed by initializeBridgeAttestorV2
	const BRIDGE_FEE_TEN_PERCENT = 100; // thousandths (FEE_DENOMINATOR = 1000)
	const POST_FEE_NINETY_PERCENT = 90; // 100 * (1000 - 100) / 1000, in whole tokens
	const OVER_CAP_AMOUNT = toWei(50000000) + 1n; // GNUS_MAX_SUPPLY + 1 wei
	const WRONG_CHAIN_OFFSET = 999n; // destChainID override for the wrong-chain negative
	const D18_MINT_AMOUNT = toWei(25);
	let messageCounter = 0; // unique sourceTxHash per makeMessage() call

	/** The live (on-chain) environment the certificates bind to. */
	function liveEnvironment() {
		return { destChainID: localChainId, diamondAddress };
	}

	/** A canonical BridgeMessage with a unique sourceTxHash per call. */
	function makeMessage(overrides: Partial<BridgeMessageFields> = {}): BridgeMessageFields {
		messageCounter += 1;
		return {
			srcChainID: SRC_CHAIN_ID,
			sourceBridgeID: ethers.zeroPadValue('0xabcd', 32),
			sourceTxHash: ethers.id(`carried-message-${messageCounter}`),
			sourceEventIndex: 0n,
			recipient: user1.address,
			amount: DEFAULT_AMOUNT,
			...overrides,
		};
	}

	/** BridgeMessageFields -> the on-chain BridgeMessage tuple. */
	function messageTuple(message: BridgeMessageFields) {
		return { ...message };
	}

	/**
	 * BridgeMessageFields + attestor-set shape -> the full V2 certificate, with
	 * the destChainID/diamondAddress override pattern for the domain-binding
	 * negatives (defaults are the LIVE values; negatives pass different ones).
	 */
	function v2Cert(
		message: BridgeMessageFields,
		currentRoot: string,
		currentEpoch: bigint,
		nextRoot: string,
		overrides: Partial<Pick<BridgeMessageV2, 'destChainID' | 'diamondAddress'>> = {},
	): BridgeMessageV2 {
		return {
			...message,
			currentRoot,
			currentEpoch,
			nextRoot,
			destChainID: overrides.destChainID ?? localChainId,
			diamondAddress: overrides.diamondAddress ?? diamondAddress,
		};
	}

	/**
	 * Signs `cert` with each signer, sorts strictly ascending, and attaches proofs
	 * from `proofTree` parallel to the sorted signatures. The proof tree is a
	 * separate argument from the cert's currentRoot so negatives can attach
	 * proofs from a tree the on-chain root does not match.
	 */
	async function signAndAttach(
		cert: BridgeMessageV2,
		signers: BaseWallet[],
		proofTree: AttestorMerkleTree,
	): Promise<{ sortedSigs: string[]; merkleProofs: string[][] }> {
		const structHash = computeBridgeInStructHashV2(cert);
		const sigs = await Promise.all(signers.map((w) => signBridgeInCertificateV2(w, cert)));
		const sortedSigs = await aggregateCertificateV2(sigs, structHash);
		const digest = ethers.hashMessage(ethers.getBytes(structHash));
		const merkleProofs = sortedSigs.map((sig) => {
			const proof = proofTree.proofs.get(ethers.recoverAddress(digest, sig).toLowerCase());
			if (proof === undefined) {
				throw new Error('signAndAttach: no proof for signer in the supplied tree');
			}
			return proof;
		});
		return { sortedSigs, merkleProofs };
	}

	/** Bootstraps a fresh random Genesis set and returns the Genesis wallet. */
	async function bootstrapGenesis(): Promise<HDNodeWallet> {
		const genesis = Wallet.createRandom();
		await geniusDiamond.initializeBridgeAttestorV2(genesis.address);
		return genesis;
	}

	/**
	 * Installs `target` as the active root via a one-signature Genesis certificate
	 * (epoch 0 -> 1). Every active-epoch test starts here. The transition mint is
	 * directed at the OWNER (a sink address) so per-test recipient-balance
	 * assertions on user1 start from zero.
	 */
	async function transitionTo(target: AttestorMerkleTree): Promise<void> {
		const genesis = await bootstrapGenesis();
		const genesisTree = buildValidatorMerkleTree([genesis.address]);
		const message = makeMessage({ recipient: owner.address });
		const cert = await buildAttestorCertificate(
			message,
			[genesis],
			genesisTree,
			GENESIS_EPOCH,
			target.root,
			liveEnvironment(),
		);
		await geniusDiamond.bridgeIn(messageTuple(message), target.root, cert.sortedSigs, cert.merkleProofs);
	}

	/** transitionTo(activeTree) — the standard 3-attestor active set at epoch 1. */
	async function transitionToActive(): Promise<void> {
		await transitionTo(activeTree);
	}

	/**
	 * Active-epoch certificate via the reference builder: 3-attestor current tree,
	 * epoch 1, `nextRoot` (defaults to the unchanged current root), over the given
	 * (possibly wrong, for the domain-binding negatives) environment.
	 */
	async function activeCert(
		message: BridgeMessageFields,
		signers: BaseWallet[],
		nextRoot: string = activeTree.root,
		environment: { destChainID: bigint; diamondAddress: string } = liveEnvironment(),
	) {
		return buildAttestorCertificate(
			message,
			signers,
			activeTree,
			ACTIVE_EPOCH,
			nextRoot,
			environment,
		);
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

		[owner, user1, user2] = await ethers.getSigners();

		// Seed the provenance counter so the global-cap check in the fee-mint
		// replica can run (reverts when uninitialized, Phase 9 D8/Pitfall 4).
		// Guarded by a storage probe so re-runs against a cached diamond don't revert.
		const initialized = await hre.network.provider.send('eth_getStorageAt', [
			diamondAddress,
			ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
		]);
		if (BigInt(initialized) === 0n) {
			await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
		}

		// Record the live chain id and point the diamond's chainID at it so
		// bridgeIn's destination-chain check passes (certificates are signed over
		// the live value).
		const network = await ethers.provider.getNetwork();
		localChainId = network.chainId;
		await geniusDiamond.setChainID(localChainId);

		// Attestor sets: a 3-attestor active tree, a disjoint 3-attestor recovery
		// tree, and one non-attestor.
		attestors = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
		recoveryAttestors = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
		nonAttestor = Wallet.createRandom();
		activeTree = buildValidatorMerkleTree(attestors.map((a) => a.address));

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

	describe('legacy selector removal (BRIDGE-16, D-06)', function () {
		it('no facet in the diamond registry owns the removed legacy selectors', async function () {
			// The loupe is the registry source of truth: an unowned selector maps to
			// the zero address. This proves the removal across ALL facets, not just
			// the bridge facet.
			expect(await geniusDiamond.facetAddress(SELECTOR_LEGACY_BRIDGE_IN)).to.equal(
				ethers.ZeroAddress,
			);
			expect(await geniusDiamond.facetAddress(SELECTOR_LEGACY_ADMIN_ROOT_SETTER)).to.equal(
				ethers.ZeroAddress,
			);
		});

		it('the bridge facet selector list contains neither legacy selector', async function () {
			// Identify GNUSBridge through its surviving bridgeOut entry point.
			const bridgeOutSelector = geniusDiamond.interface.getFunction(BRIDGE_OUT_SIGNATURE).selector;
			const bridgeFacet = await geniusDiamond.facetAddress(bridgeOutSelector);
			expect(bridgeFacet, 'bridgeOut selector must resolve to a facet').to.not.equal(
				ethers.ZeroAddress,
			);

			const selectors = (await geniusDiamond.facetFunctionSelectors(bridgeFacet)).map((s) =>
				s.toLowerCase(),
			);
			expect(selectors).to.not.include(SELECTOR_LEGACY_BRIDGE_IN);
			expect(selectors).to.not.include(SELECTOR_LEGACY_ADMIN_ROOT_SETTER);
		});

		it('the attestor facet owns all four V2 selectors (registry wiring end-to-end)', async function () {
			// All four V2 entry points must live on ONE facet, and that facet's
			// selector list must contain each of them — proves the 15-01/15-02 cut
			// wiring, not just the ABI.
			const attestorFacet = await geniusDiamond.facetAddress(SELECTOR_BRIDGE_IN_V2);
			expect(attestorFacet).to.not.equal(ethers.ZeroAddress);
			for (const selector of V2_SELECTORS) {
				expect(await geniusDiamond.facetAddress(selector)).to.equal(attestorFacet);
			}

			const selectors = (await geniusDiamond.facetFunctionSelectors(attestorFacet)).map((s) =>
				s.toLowerCase(),
			);
			for (const selector of V2_SELECTORS) {
				expect(selectors).to.include(selector);
			}
		});

		it('a raw call to the removed bridge-in selector reverts (no fallback)', async function () {
			// Hand-built calldata: selector + abi-encoded legacy argument shape.
			// The diamond exposes no fallback for unowned selectors, so the raw
			// call must revert instead of silently succeeding.
			const legacyCalldata = ethers.concat([
				SELECTOR_LEGACY_BRIDGE_IN,
				ethers.AbiCoder.defaultAbiCoder().encode(
					['bytes32', 'uint256', 'address', 'uint256', 'bytes[]', 'bytes32[][]'],
					[
						ethers.id('legacy-shape-source-tx'),
						SRC_CHAIN_ID,
						user1.address,
						DEFAULT_AMOUNT,
						[`0x${'00'.repeat(65)}`],
						[[]],
					],
				),
			]);

			await expect(
				owner.sendTransaction({ to: diamondAddress, data: legacyCalldata }),
			).to.be.reverted;
		});
	});

	describe('emergencyRecoverAttestorSet (D-05 conversion of the legacy admin rotation)', function () {
		it('reverts "Only SuperAdmin allowed" when called by a non-superAdmin signer', async function () {
			// The role modifier runs before the pause gate — pause state is irrelevant here.
			await expect(
				geniusDiamond.connect(user1).emergencyRecoverAttestorSet(ethers.id('recovery-root')),
			).to.be.revertedWith('Only SuperAdmin allowed');
		});

		it('reverts "GNUSControl: contract must be paused" while the diamond is unpaused', async function () {
			await bootstrapGenesis();
			await expect(
				geniusDiamond.emergencyRecoverAttestorSet(ethers.id('recovery-root')),
			).to.be.revertedWith('GNUSControl: contract must be paused');
		});

		it('reverts "Invalid recovery root" on a zero root while paused', async function () {
			await bootstrapGenesis();
			await geniusDiamond.emergencyPause();
			await expect(
				geniusDiamond.emergencyRecoverAttestorSet(ethers.ZeroHash),
			).to.be.revertedWith('Invalid recovery root');
		});

		it('reverts "Attestor set not initialized" when the V2 set was never bootstrapped', async function () {
			await geniusDiamond.emergencyPause();
			await expect(
				geniusDiamond.emergencyRecoverAttestorSet(ethers.id('recovery-root')),
			).to.be.revertedWith('Attestor set not initialized');
		});

		it('recovers from the owner while paused: emits (oldEpoch, oldEpoch+1, oldRoot, newRoot), epoch increments, init flag stays set', async function () {
			const genesis = await bootstrapGenesis();
			const genesisRoot = ethers.keccak256(ethers.solidityPacked(['address'], [genesis.address]));
			const recoveryRoot = ethers.id('recovery-root');

			await geniusDiamond.emergencyPause();
			await expect(geniusDiamond.emergencyRecoverAttestorSet(recoveryRoot))
				.to.emit(geniusDiamond, 'BridgeAttestorEmergencyReset')
				.withArgs(GENESIS_EPOCH, GENESIS_EPOCH + 1n, genesisRoot, recoveryRoot);

			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(recoveryRoot);
			// epoch = oldEpoch + 1 — the post-state can never be epoch 0.
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(GENESIS_EPOCH + 1n);

			// The init flag is never touched by recovery: bootstrap stays one-shot,
			// so Genesis is structurally unrecoverable (D-05 / T-15-04).
			await expect(
				geniusDiamond.initializeBridgeAttestorV2(Wallet.createRandom().address),
			).to.be.revertedWith('Attestor set already initialized');
		});

		it('bridgeIn works against the emergency root with the new tree (2-of-N); 1-of-N never suffices post-emergency', async function () {
			const recoveryTree = buildValidatorMerkleTree(recoveryAttestors.map((a) => a.address));
			await bootstrapGenesis();
			await geniusDiamond.emergencyPause();
			await geniusDiamond.emergencyRecoverAttestorSet(recoveryTree.root);
			await geniusDiamond.emergencyUnpause();

			// 2-of-3 from the recovery tree at the post-recovery epoch.
			const message = makeMessage();
			const cert = await buildAttestorCertificate(
				message,
				[recoveryAttestors[0], recoveryAttestors[1]],
				recoveryTree,
				ACTIVE_EPOCH,
				recoveryTree.root,
				liveEnvironment(),
			);
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), recoveryTree.root, cert.sortedSigs, cert.merkleProofs),
			)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(cert.messageId, user1.address, DEFAULT_AMOUNT, SRC_CHAIN_ID, localChainId);
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(DEFAULT_AMOUNT);

			// The epoch-derived threshold after recovery is the ACTIVE floor (2) —
			// a single signature can never authorize a post-emergency claim.
			const single = makeMessage();
			const singleCert = await buildAttestorCertificate(
				single,
				[recoveryAttestors[0]],
				recoveryTree,
				ACTIVE_EPOCH,
				recoveryTree.root,
				liveEnvironment(),
			);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(single),
					recoveryTree.root,
					singleCert.sortedSigs,
					singleCert.merkleProofs,
				),
			).to.be.revertedWith('Below threshold');
		});
	});

	describe('carried Phase 10 semantics on the V2 path (BRIDGE-19)', function () {
		it('reverts "Below threshold" when fewer signatures than the active threshold', async function () {
			await transitionToActive();
			const message = makeMessage();
			// Only ONE signer at the active threshold 2.
			const cert = await activeCert(message, [attestors[0]]);
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, cert.merkleProofs),
			).to.be.revertedWith('Below threshold');
		});

		it('mints on a valid certificate, emits BridgeReleased with the V2 messageId', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1], attestors[2]]);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);

			// BridgeReleased carries the composite replay key + PRE-FEE amount
			// (matches BridgeOutInitiated semantics).
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(computeBridgeMessageId(message), user1.address, DEFAULT_AMOUNT, SRC_CHAIN_ID, localChainId);

			// Default bridge fee is 0 — recipient receives the full amount.
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(DEFAULT_AMOUNT);
		});

		it('applies the bridge fee: recipient receives the post-fee amount, the event emits the pre-fee amount', async function () {
			await transitionToActive();
			// 10% bridge fee (100 out of FEE_DENOMINATOR=1000).
			await geniusDiamond.updateBridgeFee(BRIDGE_FEE_TEN_PERCENT);

			const amount = toWei(100);
			const message = makeMessage({ amount });
			const cert = await activeCert(message, [attestors[0], attestors[1], attestors[2]]);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);

			// Event carries PRE-FEE amount per BridgeOutInitiated parity.
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(computeBridgeMessageId(message), user1.address, amount, SRC_CHAIN_ID, localChainId);

			// Recipient receives amount * (1000 - 100) / 1000 = 90.
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(toWei(POST_FEE_NINETY_PERCENT));
		});

		it('increments globalSupply (and with it chainSupply) by the post-fee amount', async function () {
			await transitionToActive();
			const message = makeMessage();

			// `chainSupply` is not exposed via a public reader on the diamond ABI
			// (GNUSTreasury only exposes `totalSupplyOfAll`); the two writes happen
			// in the same fee-mint block, so observing the global delta is
			// sufficient evidence the per-chain delta was applied. Foundry
			// invariant coverage asserts the per-chain partition directly via
			// storage reads.
			const globalSupplyBefore = await geniusDiamond.totalSupplyOfAll();

			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);

			const globalSupplyAfter = await geniusDiamond.totalSupplyOfAll();
			// No bridge fee set — post-fee == pre-fee.
			expect(globalSupplyAfter - globalSupplyBefore).to.equal(DEFAULT_AMOUNT);
		});

		it('reverts "Message already processed" on replay of the same source event', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);

			// First call succeeds.
			await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);

			// Second call with the same source event reverts.
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(message),
					activeTree.root,
					cert.sortedSigs,
					cert.merkleProofs,
				),
			).to.be.revertedWith('Message already processed');
		});

		it('reverts on wrong destination chain (certificate signed for a different destChainID)', async function () {
			await transitionToActive();
			const message = makeMessage();

			// Sign with a destChainID that doesn't match the live chain — the diamond
			// computes the digest with block.chainid, so the recovered signers will
			// NOT match the attestor root.
			const cert = await activeCert(message, [attestors[0], attestors[1]], activeTree.root, {
				...liveEnvironment(),
				destChainID: localChainId + WRONG_CHAIN_OFFSET,
			});

			// Reverts during verification — could be the ordering check or attestor
			// membership (both foreign recoveries are effectively random at the
			// active epoch). Don't pin the exact string — the digest mismatch is the
			// behavior under test (Phase-10 digest-mismatch precedent).
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, cert.merkleProofs),
			).to.be.reverted;
		});

		it('reverts on cross-diamond replay (certificate signed for a different diamond)', async function () {
			await transitionToActive();
			const message = makeMessage();

			// Sign as if targeting a different diamond address — digest mismatch.
			const cert = await activeCert(message, [attestors[0], attestors[1]], activeTree.root, {
				...liveEnvironment(),
				diamondAddress: Wallet.createRandom().address,
			});

			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, cert.merkleProofs),
			).to.be.reverted;
		});

		it('reverts "Signers not strictly ascending" when signatures are out of order', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);

			// Reverse the sorted array to break strict-ascending — reverse proofs too
			// so the revert comes from the ordering check, not from merkle verification.
			const reversedSigs = [...cert.sortedSigs].reverse();
			const reversedProofs = [...cert.merkleProofs].reverse();

			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, reversedSigs, reversedProofs),
			).to.be.revertedWith('Signers not strictly ascending');
		});

		it('reverts "Signers not strictly ascending" on duplicate signer', async function () {
			await transitionToActive();
			const message = makeMessage();

			// Sign with attestor[0] TWICE — bypass the aggregator's duplicate throw
			// by signing directly.
			const cert = v2Cert(message, activeTree.root, ACTIVE_EPOCH, activeTree.root);
			const sig = await signBridgeInCertificateV2(attestors[0], cert);
			const proof = activeTree.proofs.get(attestors[0].address.toLowerCase());
			if (proof === undefined) {
				throw new Error('attestor[0] proof missing');
			}

			// Submit the same signature twice — strictly-ascending check rejects.
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, [sig, sig], [proof, proof]),
			).to.be.revertedWith('Signers not strictly ascending');
		});

		it('reverts "Not a registered attestor" when a signer is not in the attestor root', async function () {
			await transitionToActive();
			const message = makeMessage();

			// Build a certificate with one real attestor + one NON-attestor.
			// The non-attestor has no proof — give it attestor[0]'s proof, which
			// will fail merkle verification for the recovered (non-attestor) address.
			const cert = v2Cert(message, activeTree.root, ACTIVE_EPOCH, activeTree.root);
			const structHash = computeBridgeInStructHashV2(cert);
			const sigs = await Promise.all([
				signBridgeInCertificateV2(attestors[0], cert),
				signBridgeInCertificateV2(nonAttestor, cert),
			]);
			const sortedSigs = await aggregateCertificateV2(sigs, structHash);
			const proof0 = activeTree.proofs.get(attestors[0].address.toLowerCase());
			if (proof0 === undefined) {
				throw new Error('attestor[0] proof missing');
			}

			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, sortedSigs, [proof0, proof0]),
			).to.be.revertedWith('Not a registered attestor');
		});

		it('reverts "GNUSControl: contract paused" when the diamond is paused', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);

			// Pause the diamond (snapshot isolation will revert this).
			await geniusDiamond.emergencyPause();

			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, cert.merkleProofs),
			).to.be.revertedWith('GNUSControl: contract paused');
		});

		it('reverts "Global max supply exceeded" when the mint would push globalSupply above the cap', async function () {
			await transitionToActive();
			// GNUS_MAX_SUPPLY is 50_000_000 * 10^18 — an amount of that plus 1 wei
			// exceeds the cap on its own, no seeding near the cap required.
			const message = makeMessage({ amount: OVER_CAP_AMOUNT });
			const cert = await activeCert(message, [attestors[0], attestors[1]]);

			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, cert.merkleProofs),
			).to.be.revertedWith('Global max supply exceeded');
		});
	});

	describe('D-18 manual Super Admin bridge-in regression', function () {
		it('existing 2-arg mint(address,uint256) continues to work alongside the certificate path', async function () {
			// The manual Super Admin bridge-in path (D-18) uses the 2-arg mint. This
			// test is a regression check — the V2 rewrite must NOT have broken it.
			await geniusDiamond['mint(address,uint256)'](user1.address, D18_MINT_AMOUNT);
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(D18_MINT_AMOUNT);
		});
	});
});
