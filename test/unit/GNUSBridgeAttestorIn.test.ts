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
import vectorsJson from '../fixtures/bridge-attestor-vectors.json';
import { toWei } from '../../scripts/utils/helpers';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';
import { ensureDiamondTestBaseline } from '../utils/diamond-baseline';
import {
	BRIDGE_CERTIFICATE_V2_DOMAIN,
	BridgeMessageV2,
	BridgeMessageFields,
	GNUS_TOKEN_ID,
	aggregateCertificateV2,
	buildAttestorCertificate,
	buildValidatorMerkleTree,
	computeBridgeInStructHashV2,
	computeBridgeMessageId,
	signBridgeInCertificateV2,
} from '../utils/bridge-certificate';
import type { AttestorMerkleTree } from '../utils/bridge-certificate';

/**
 * Phase 15 unit tests — GNUSBridgeAttestor.bridgeIn (V2 certificate path).
 *
 * BRIDGE-18 vector consumer (Task 2, SPEC :708-727):
 *   V1. flat 13-field abi.encode == on-chain split bytes.concat encode ==
 *       fixture structHash (D-02 byte-identity — the C++ exporter contract).
 *   V2. fixture signatures recover off-chain to the recorded addresses and
 *       re-sign deterministically (regenerate-and-diff); trees/roots/proofs
 *       rebuild from the frozen keys.
 *   V3. on-chain round-trip — initializeBridgeAttestorV2(fixture genesis),
 *       bridgeIn with the genesis-transition certificate re-signed over the
 *       LIVE chainid + deployed diamondAddress from the FROZEN field/key/proof
 *       values; asserts BridgeReleased + BridgeAttestorSetAdvanced(0,1,...)
 *       + recipient balance (environment-bound re-sign, plan 15-03 Task 2(b)(iii)).
 *   V4. native SuperGenius-style vote-bytes signature (non-EIP-191, over the
 *       raw structHash) never verifies (PD-BR-7).
 *   V5. on-chain round-trip for the ACTIVE vector — bootstrap → genesis
 *       transition via vector 0 → active-root-claim via vector 1, submitted in
 *       the FIXTURE-RECORDED signers order. Pins the strictly-ascending
 *       recording invariant (CR-01) against the on-chain verifier: a fixture
 *       that drifts out of order reverts "Signers not strictly ascending".
 *
 * BRIDGE-19 amendment matrix (Task 3, SPEC :657-707 — 36 checkpoints):
 *   Bootstrap (SPEC :657-665):
 *     B1. initialization accepts one nonzero Genesis attestor (emits
 *         BridgeAttestorSetInitialized with the one-leaf root); zero address
 *         is rejected.
 *     B2. initialization cannot run twice.
 *     B3. epoch zero accepts ONE valid Genesis signature (threshold 1).
 *     B4. epoch zero rejects zero signatures ("Below threshold").
 *     B5. epoch zero rejects a certificate keeping the root unchanged
 *         ("Genesis certificate must install API attestors").
 *     B6. first valid certificate installs a different root and emits
 *         BridgeAttestorSetAdvanced(0, 1, ...).
 *     B7. after the transition one signature is no longer enough
 *         ("Below threshold" at the epoch-derived threshold 2).
 *   Current-root verification (SPEC :667-676):
 *     C1. two current-root attestors authorize a claim.
 *     C2. a signer in nextRoot but NOT currentRoot cannot authorize the
 *         transition (next-tree proof fails vs the current root).
 *     C3. an unknown/public-only signer fails ("Not a registered attestor").
 *     C4. a malformed signature fails ("Bad signature").
 *     C5. an invalid/wrong-leaf merkle proof fails.
 *     C6. a duplicate signer fails ("Signers not strictly ascending").
 *     C7. unsorted signers fail ("Signers not strictly ascending").
 *     C8. more than MAX_ATTESTOR_SIGNATURES (17 from a 32-attestor tree)
 *         fails at the cap.
 *   Root transitions (SPEC :678-685):
 *     R1. nextRoot == currentRoot processes a claim with NO epoch bump and
 *         no advance event.
 *     R2. multiple claims against an unchanged root all succeed.
 *     R3. a changed root increments the epoch exactly once.
 *     R4. a certificate signed against an OLD root fails after rotation.
 *     R5. two competing rotations from the same old root — the second reverts
 *         ("Message already processed"; root/epoch reflect only the first).
 *     R6. failed minting reverts the root update AND the replay marker.
 *   Replay and domain binding (SPEC :687-697):
 *     D1. the same source event cannot execute twice.
 *     D2. two event indexes in the same source transaction produce different
 *         messageIds and BOTH bridge in.
 *     D3. changing sourceBridgeID changes the messageId and digest.
 *     D4. changing the source chain changes the digest.
 *     D5. changing the recipient changes the digest (messageId unchanged —
 *         recipient is digest-bound only, BRIDGE-12).
 *     D6. changing the amount changes the digest (messageId unchanged).
 *     D7. a certificate for another destination chain fails.
 *     D8. a certificate for another diamond address fails.
 *     D9. a signature over the native SuperGenius vote bytes fails (PD-BR-7;
 *         active-epoch companion to V4).
 *   Existing token behavior (SPEC :699-706):
 *     E1. bridge fee remains applied to the pre-fee amount.
 *     E2. zero post-fee amount reverts ("Bridge fee consumes entire amount").
 *     E3. global max supply remains enforced.
 *     E4. globalSupply/chainSupply deltas are post-fee-correct.
 *     E5. BridgeReleased reports the pre-fee amount.
 *     E6. pause check occurs before certificate work.
 *     E7. the mint leg still runs enforceMintGate — perWalletMintCap[0] is
 *         enforced AND consumed by bridge-in mints (WR-02 coupling, 15 review).
 *   Plus: the fee-replica pairing mint() vs bridgeIn() (Pitfall 1) and the
 *   [GAS] 16-signature certificate measurement (research A1).
 *
 * Digest-mismatch rows (D3-D8) run at the GENESIS epoch with a single
 * signature: the recovered address of a mis-bound certificate is foreign to
 * the root, the sole signature always satisfies strict-ascending, and the
 * failure pins deterministically to "Not a registered attestor". R4 (old-root
 * after rotation) must run at the active epoch with two signatures, where the
 * two foreign recoveries are effectively random — it asserts bare reversion,
 * the Phase-10 digest-mismatch precedent (GNUSBridgeIn.test.ts:416-448).
 *
 * Environment-bound fields: `chainid` AND `diamondAddress` are re-bound to the
 * live deployment in the on-chain legs — the frozen 31337 / 0x1111...11 remain
 * the off-chain C++ conformance constants proven by legs V1/V2.
 *
 * Scaffold: GNUSBridgeIn.test.ts (LocalDiamondDeployer + treasury-seed probe +
 * setChainID + snapshot isolation). Matrix style: GNUSBridgePolicy.test.ts.
 * Revert strings asserted below must match contracts/gnus-ai/GNUSBridgeAttestor.sol
 * exactly.
 */

/** Signer record inside a fixture vector (SPEC :712-725 field list). */
interface FixtureSigner {
	role: string;
	privateKey: string;
	sgPublicKey64: string;
	evmAddress: string;
	signature: string;
	recoveredAddress: string;
	merkleProof: string[];
}

/** One fixture vector (SPEC :712-725 field list). */
interface FixtureVector {
	name: string;
	description: string;
	currentRoot: string;
	currentEpoch: string;
	nextRoot: string;
	message: {
		srcChainID: string;
		sourceBridgeID: string;
		sourceTxHash: string;
		sourceEventIndex: string;
		recipient: string;
		amount: string;
	};
	messageId: string;
	structHash: string;
	eip191Digest: string;
	signers: FixtureSigner[];
}

/** The checked-in fixture typed for consumption (all uint fields are strings). */
const fixture = vectorsJson as unknown as {
	version: number;
	environment: { chainid: string; diamondAddress: string; recipient: string };
	constants: Record<string, string>;
	genesisKey: { privateKey: string; evmAddress: string };
	attestorSet: { role: string; privateKey: string; evmAddress: string }[];
	vectors: FixtureVector[];
};

describe('GNUSBridgeAttestor bridgeIn (V2 certificates)', function () {
	this.timeout(0); // Extended indefinitely for diamond deployment time

	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let initialSnapshotId: string;
	let snapshotId: string;

	let diamondAddress: string;
	let localChainId: bigint;

	// Matrix wallets/trees (fresh per suite run — the GNUSBridgeIn.test.ts:101-112
	// pattern; the trees are built after creation so randomness is irrelevant).
	let attestors: HDNodeWallet[];
	let nextAttestors: HDNodeWallet[];
	let nonAttestor: HDNodeWallet;
	let activeTree: AttestorMerkleTree;
	let nextTree: AttestorMerkleTree;

	// Matrix named constants (no magic numbers).
	const SRC_CHAIN_ID = 137n; // != localChainId (cross-chain guard, SPEC :490)
	const DEFAULT_AMOUNT = toWei(10);
	const ACTIVE_EPOCH = 1n; // epoch after the genesis transition
	const GENESIS_EPOCH = 0n;
	const ACTIVE_THRESHOLD = 2n; // D-03 default installed by initializeBridgeAttestorV2
	const MAX_ATTESTOR_SIGNATURES = 16n;
	const OVER_CAP_SIG_COUNT = 17;
	const THIRTY_TWO_ATTESTORS = 32;
	const BRIDGE_FEE_TEN_PERCENT = 100; // thousandths (FEE_DENOMINATOR = 1000)
	const BRIDGE_FEE_MAX = 200; // GNUSControl.MAX_FEE
	const OVER_CAP_AMOUNT = toWei(50000000) + 1n; // GNUS_MAX_SUPPLY + 1 wei
	const CAP_SIG_COUNT = 16; // == MAX_ATTESTOR_SIGNATURES (the A1 gas measurement)
	const WRONG_CHAIN_OFFSET = 999n; // destChainID override for the wrong-chain negative
	const MULTI_CLAIM_COUNT = 2; // R2: multiple claims against an unchanged root
	let messageCounter = 0; // unique sourceTxHash per makeMessage() call

	/** Fixture vector -> full V2 certificate over the given (possibly live) environment. */
	function certFromVector(vector: FixtureVector, environment: { destChainID: bigint; diamondAddress: string }): BridgeMessageV2 {
		return {
			srcChainID: BigInt(vector.message.srcChainID),
			sourceBridgeID: vector.message.sourceBridgeID,
			sourceTxHash: vector.message.sourceTxHash,
			sourceEventIndex: BigInt(vector.message.sourceEventIndex),
			recipient: vector.message.recipient,
			amount: BigInt(vector.message.amount),
			currentRoot: vector.currentRoot,
			currentEpoch: BigInt(vector.currentEpoch),
			nextRoot: vector.nextRoot,
			destChainID: environment.destChainID,
			diamondAddress: environment.diamondAddress,
		};
	}

	/** The frozen (C++ conformance) environment from the fixture. */
	const frozenEnvironment = {
		destChainID: BigInt(fixture.environment.chainid),
		diamondAddress: fixture.environment.diamondAddress,
	};

	/** The live (on-chain round-trip) environment. */
	function liveEnvironment() {
		return { destChainID: localChainId, diamondAddress };
	}

	/** Fixture vector -> the on-chain BridgeMessage tuple. */
	function messageTupleFromVector(vector: FixtureVector) {
		return {
			srcChainID: BigInt(vector.message.srcChainID),
			sourceBridgeID: vector.message.sourceBridgeID,
			sourceTxHash: vector.message.sourceTxHash,
			sourceEventIndex: BigInt(vector.message.sourceEventIndex),
			recipient: vector.message.recipient,
			amount: BigInt(vector.message.amount),
		};
	}

	// -----------------------------------------------------------------------
	// Matrix helpers (BRIDGE-19).
	// -----------------------------------------------------------------------

	/** A canonical BridgeMessage with a unique sourceTxHash per call. */
	function makeMessage(overrides: Partial<BridgeMessageFields> = {}): BridgeMessageFields {
		messageCounter += 1;
		return {
			srcChainID: SRC_CHAIN_ID,
			sourceBridgeID: ethers.zeroPadValue('0xabcd', 32),
			sourceTxHash: ethers.id(`matrix-message-${messageCounter}`),
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
	 * Builds a BridgeMessageV2 over the given attestor-set shape with the
	 * destChainID/diamondAddress override pattern (GNUSBridgeIn.test.ts:139-150 —
	 * defaults are the LIVE values; negatives pass different values).
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
	 * separate argument from the cert's currentRoot so negative tests can attach
	 * proofs from a tree the on-chain root does not match (C2/C3).
	 */
	async function signAndAttach(
		cert: BridgeMessageV2,
		signers: BaseWallet[],
		proofTree: AttestorMerkleTree,
	): Promise<{ sortedSigs: string[]; merkleProofs: string[][]; structHash: string }> {
		const structHash = computeBridgeInStructHashV2(cert);
		const sigs = await Promise.all(signers.map((w) => signBridgeInCertificateV2(w, cert)));
		const sortedSigs = await aggregateCertificateV2(sigs, structHash);
		const digest = ethers.hashMessage(ethers.getBytes(structHash));
		const merkleProofs = sortedSigs.map((sig) => {
			const proof = proofTree.proofs.get(ethers.recoverAddress(digest, sig).toLowerCase());
			if (proof === undefined) {
				throw new Error(`signAndAttach: no proof for signer in the supplied tree`);
			}
			return proof;
		});
		return { sortedSigs, merkleProofs, structHash };
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
	 * epoch 1, `nextRoot` (defaults to the unchanged current root).
	 */
	async function activeCert(
		message: BridgeMessageFields,
		signers: BaseWallet[],
		nextRoot: string = activeTree.root,
		overrides: Partial<Pick<BridgeMessageV2, 'destChainID' | 'diamondAddress'>> = {},
	) {
		return buildAttestorCertificate(
			message,
			signers,
			activeTree,
			ACTIVE_EPOCH,
			nextRoot,
			{
				destChainID: overrides.destChainID ?? localChainId,
				diamondAddress: overrides.diamondAddress ?? diamondAddress,
			},
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

		// Declare the protocol baseline BEFORE the snapshot so reverts restore it;
		// the 31337 re-alias below re-applies the bridge chainID inside this window
		await ensureDiamondTestBaseline(geniusDiamond, diamondAddress);

		// Record the live chain id and point the diamond's chainID at it so
		// bridgeIn's destination-chain check passes (the V2 digest binds
		// block.chainid — certificates are re-signed over the live value).
		const network = await ethers.provider.getNetwork();
		localChainId = network.chainId;
		await geniusDiamond.setChainID(localChainId);

		// Matrix attestor sets: a 3-attestor active tree, a disjoint 3-attestor
		// next tree (rotations / next-root-only signers), and one non-attestor.
		attestors = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
		nextAttestors = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
		nonAttestor = Wallet.createRandom();
		activeTree = buildValidatorMerkleTree(attestors.map((a) => a.address));
		nextTree = buildValidatorMerkleTree(nextAttestors.map((a) => a.address));

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

	describe('BRIDGE-18 vector consumer (cross-language parity)', function () {
		it('V1: flat 13-field abi.encode == on-chain split bytes.concat encode == fixture structHash (D-02 byte-identity)', async function () {
			for (const vector of fixture.vectors) {
				const cert = certFromVector(vector, frozenEnvironment);

				// FLAT form — the off-chain reference / C++ exporter form.
				const flat = computeBridgeInStructHashV2(cert);

				// SPLIT form — the exact bytes.concat of three partial abi.encode
				// groups compiled into _bridgeInDigestV2 on-chain (D-02). Computed
				// inline so the proof is visible, not silently re-derived (T-15-17).
				const coder = ethers.AbiCoder.defaultAbiCoder();
				const group1 = coder.encode(
					['bytes32', 'uint256', 'bytes32', 'bytes32'],
					[BRIDGE_CERTIFICATE_V2_DOMAIN, cert.currentEpoch, cert.currentRoot, cert.nextRoot],
				);
				const group2 = coder.encode(
					['uint256', 'bytes32', 'bytes32', 'uint256'],
					[cert.srcChainID, cert.sourceBridgeID, cert.sourceTxHash, cert.sourceEventIndex],
				);
				const group3 = coder.encode(
					['uint256', 'address', 'address', 'uint256', 'uint256'],
					[cert.destChainID, cert.diamondAddress, cert.recipient, GNUS_TOKEN_ID, cert.amount],
				);
				const split = ethers.keccak256(ethers.concat([group1, group2, group3]));

				expect(flat, `${vector.name}: flat != split`).to.equal(split);
				expect(flat, `${vector.name}: flat != fixture structHash`).to.equal(vector.structHash);
			}
		});

		it('V2: fixture signatures recover to the recorded addresses, re-sign deterministically, and the trees/roots/proofs rebuild from the frozen keys', async function () {
			// The 3-attestor tree rebuilds from the frozen attestorSet keys.
			const attestorTree = buildValidatorMerkleTree(fixture.attestorSet.map((a) => a.evmAddress));
			const genesisTree = buildValidatorMerkleTree([fixture.genesisKey.evmAddress]);
			const genesisVector = fixture.vectors[0];
			const activeVector = fixture.vectors[1];

			// Roots are environment-independent — the frozen values must rebuild.
			expect(genesisTree.root).to.equal(genesisVector.currentRoot);
			expect(attestorTree.root).to.equal(genesisVector.nextRoot);
			expect(attestorTree.root).to.equal(activeVector.currentRoot);
			expect(attestorTree.root).to.equal(activeVector.nextRoot);

			// The EIP-191 digest recorded in the fixture re-derives from the structHash.
			for (const vector of fixture.vectors) {
				expect(ethers.hashMessage(ethers.getBytes(vector.structHash))).to.equal(vector.eip191Digest);
				expect(computeBridgeMessageId({
					srcChainID: BigInt(vector.message.srcChainID),
					sourceBridgeID: vector.message.sourceBridgeID,
					sourceTxHash: vector.message.sourceTxHash,
					sourceEventIndex: BigInt(vector.message.sourceEventIndex),
				})).to.equal(vector.messageId);

				for (const signer of vector.signers) {
					// Off-chain recovery matches the recorded address (both == the
					// key's derived EVM address).
					const recovered = ethers.recoverAddress(
						ethers.hashMessage(ethers.getBytes(vector.structHash)),
						signer.signature,
					);
					expect(recovered.toLowerCase()).to.equal(signer.recoveredAddress.toLowerCase());
					expect(recovered.toLowerCase()).to.equal(signer.evmAddress.toLowerCase());

					// Regenerate-and-diff: deterministic ECDSA re-signs byte-identically
					// from the frozen private key + fields.
					const wallet = new Wallet(signer.privateKey);
					const resigned = await signBridgeInCertificateV2(
						wallet,
						certFromVector(vector, frozenEnvironment),
					);
					expect(resigned).to.equal(signer.signature);

					// Recorded merkle proofs match the rebuilt tree's proofs.
					const rebuiltProof = (vector.name === 'genesis-transition' ? genesisTree : attestorTree)
						.proofs.get(signer.evmAddress.toLowerCase());
					expect(rebuiltProof, `${signer.role}: no rebuilt proof`).to.not.be.undefined;
					expect(rebuiltProof).to.deep.equal(signer.merkleProof);
				}
			}
		});

		it('V3: on-chain round-trip — the fixture genesis-transition certificate bridges in against the live diamond (environment-bound re-sign)', async function () {
			const vector = fixture.vectors[0];
			const genesis = new Wallet(fixture.genesisKey.privateKey);

			// Bootstrap with the FIXTURE genesis address — the on-chain one-leaf root
			// equals the fixture's frozen currentRoot (roots are env-independent).
			await expect(geniusDiamond.initializeBridgeAttestorV2(genesis.address))
				.to.emit(geniusDiamond, 'BridgeAttestorSetInitialized')
				.withArgs(genesis.address, vector.currentRoot, owner.address);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(vector.currentRoot);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(0n);

			// ENVIRONMENT-BOUND RE-SIGN: frozen field/key/proof values + LIVE chainid
			// and LIVE deployed diamondAddress. A certificate signed over the frozen
			// 0x1111...11 could never verify on a real deploy (the digest binds
			// address(this)); signing the TS flat form while the chain verifies the
			// split form is exactly the D-02 kill-switch proven by V1.
			const liveCert = certFromVector(vector, liveEnvironment());
			const liveStructHash = computeBridgeInStructHashV2(liveCert);
			const signature = await signBridgeInCertificateV2(genesis, liveCert);
			const sortedSigs = await aggregateCertificateV2([signature], liveStructHash);

			const tx = await geniusDiamond.bridgeIn(
				messageTupleFromVector(vector),
				vector.nextRoot,
				sortedSigs,
				[[]], // single-leaf genesis tree: proof == []
			);

			// BridgeReleased carries the V2 messageId (env-independent — equal to the
			// fixture value) and the PRE-FEE amount; fee is 0 by default.
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(
					vector.messageId,
					vector.message.recipient,
					BigInt(vector.message.amount),
					BigInt(vector.message.srcChainID),
					localChainId,
				);
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeAttestorSetAdvanced')
				.withArgs(0n, 1n, vector.currentRoot, vector.nextRoot);

			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(vector.nextRoot);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(1n);
			expect(
				await geniusDiamond['balanceOf(address)'](vector.message.recipient),
			).to.equal(BigInt(vector.message.amount));
		});

		it('V4: a native SuperGenius-style vote-bytes signature (non-EIP-191, over the raw structHash) never verifies (PD-BR-7)', async function () {
			const vector = fixture.vectors[0];
			const genesis = new Wallet(fixture.genesisKey.privateKey);
			await geniusDiamond.initializeBridgeAttestorV2(genesis.address);

			const liveCert = certFromVector(vector, liveEnvironment());
			const liveStructHash = computeBridgeInStructHashV2(liveCert);

			// NATIVE form: raw secp256k1 over the 32-byte structHash with NO EIP-191
			// prefix (`wallet.signingKey.sign` bypasses signMessage's prefixing). The
			// on-chain verifier recovers against toEthSignedMessageHash(structHash),
			// so the native ConsensusVote-style signature recovers a foreign address
			// and fails attestor membership — it must NEVER authorize a claim.
			const nativeSig = genesis.signingKey.sign(ethers.getBytes(liveStructHash)).serialized;
			expect(ethers.getBytes(nativeSig).length).to.equal(65);

			await expect(
				geniusDiamond.bridgeIn(
					messageTupleFromVector(vector),
					vector.nextRoot,
					[nativeSig],
					[[]],
				),
			).to.be.revertedWith('Not a registered attestor');
		});

		it('V5: on-chain round-trip — the fixture active-root-claim certificate claims at the active epoch in the RECORDED signer order (CR-01 ordering contract)', async function () {
			const genesisVector = fixture.vectors[0];
			const activeVector = fixture.vectors[1];

			// The recorded signers array must itself be strictly ascending — the
			// submission order the fixture conveys (constants.signerOrdering; the
			// on-chain check below is the enforcement, this is the diagnostic).
			const recordedAddresses = activeVector.signers.map((s) => BigInt(s.recoveredAddress));
			for (let i = 1; i < recordedAddresses.length; i++) {
				expect(
					recordedAddresses[i],
					`${activeVector.name}: signers[${i}] must be > signers[${i - 1}] (strictly ascending)`,
				).to.be.greaterThan(recordedAddresses[i - 1]);
			}

			// Bootstrap + genesis transition exactly as V3: the fixture genesis key
			// installs the 3-attestor root 0x0391da16... at epoch 1.
			const genesis = new Wallet(fixture.genesisKey.privateKey);
			await geniusDiamond.initializeBridgeAttestorV2(genesis.address);
			const genesisLiveCert = certFromVector(genesisVector, liveEnvironment());
			const genesisSig = await signBridgeInCertificateV2(genesis, genesisLiveCert);
			const genesisSorted = await aggregateCertificateV2(
				[genesisSig],
				computeBridgeInStructHashV2(genesisLiveCert),
			);
			await geniusDiamond.bridgeIn(
				messageTupleFromVector(genesisVector),
				genesisVector.nextRoot,
				genesisSorted,
				[[]], // single-leaf genesis tree: proof == []
			);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(activeVector.currentRoot);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(ACTIVE_EPOCH);

			// Active-root claim (2-of-3, unchanged root): re-sign each RECORDED
			// signer over the live environment and submit IN THE RECORDED ARRAY
			// ORDER with its recorded merkle proof — deliberately NOT re-sorted by
			// aggregateCertificateV2. If the fixture ever records its signers out of
			// strictly-ascending order again, the verifier rejects this leg with
			// "Signers not strictly ascending" (the CR-01 regression).
			const activeLiveCert = certFromVector(activeVector, liveEnvironment());
			const orderedSigs: string[] = [];
			const orderedProofs: string[][] = [];
			for (const signer of activeVector.signers) {
				const wallet = new Wallet(signer.privateKey);
				orderedSigs.push(await signBridgeInCertificateV2(wallet, activeLiveCert));
				orderedProofs.push(signer.merkleProof);
			}

			const tx = await geniusDiamond.bridgeIn(
				messageTupleFromVector(activeVector),
				activeVector.nextRoot,
				orderedSigs,
				orderedProofs,
			);

			// Claim-only: BridgeReleased carries the env-independent messageId and
			// the pre-fee amount; NO advance event and NO epoch bump (R1 semantics).
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(
					activeVector.messageId,
					activeVector.message.recipient,
					BigInt(activeVector.message.amount),
					BigInt(activeVector.message.srcChainID),
					localChainId,
				);
			await expect(tx).to.not.emit(geniusDiamond, 'BridgeAttestorSetAdvanced');
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(ACTIVE_EPOCH);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(activeVector.currentRoot);

			// Both vector mints (V3's genesis leg minted to the same frozen recipient
			// within THIS test) landed: 1000 + 750e18 raw units, fee is 0 by default.
			expect(
				await geniusDiamond['balanceOf(address)'](activeVector.message.recipient),
			).to.equal(
				BigInt(genesisVector.message.amount) + BigInt(activeVector.message.amount),
			);
		});
	});

	describe('BRIDGE-19 bootstrap matrix (SPEC :657-665)', function () {
		it('B1: initialization accepts one nonzero Genesis attestor and emits BridgeAttestorSetInitialized with the one-leaf root', async function () {
			// The "nonzero" half of the row.
			await expect(geniusDiamond.initializeBridgeAttestorV2(ethers.ZeroAddress)).to.be.revertedWith(
				'Genesis attestor is zero address',
			);

			const genesis = Wallet.createRandom();
			const oneLeafRoot = ethers.keccak256(ethers.solidityPacked(['address'], [genesis.address]));
			await expect(geniusDiamond.initializeBridgeAttestorV2(genesis.address))
				.to.emit(geniusDiamond, 'BridgeAttestorSetInitialized')
				.withArgs(genesis.address, oneLeafRoot, owner.address);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(oneLeafRoot);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(GENESIS_EPOCH);
			// Epoch-derived effective threshold: 1 at Genesis (D-03).
			expect(await geniusDiamond.activeBridgeAttestorThreshold()).to.equal(1n);
		});

		it('B2: initialization cannot run twice', async function () {
			await bootstrapGenesis();
			await expect(
				geniusDiamond.initializeBridgeAttestorV2(Wallet.createRandom().address),
			).to.be.revertedWith('Attestor set already initialized');
		});

		it('B3: epoch zero accepts ONE valid Genesis signature (threshold 1)', async function () {
			const genesis = await bootstrapGenesis();
			const genesisTree = buildValidatorMerkleTree([genesis.address]);
			const message = makeMessage();
			const cert = await buildAttestorCertificate(
				message,
				[genesis],
				genesisTree,
				GENESIS_EPOCH,
				activeTree.root,
				liveEnvironment(),
			);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(cert.messageId, user1.address, DEFAULT_AMOUNT, SRC_CHAIN_ID, localChainId);
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(DEFAULT_AMOUNT);
		});

		it('B4: epoch zero rejects zero signatures ("Below threshold")', async function () {
			await bootstrapGenesis();
			const message = makeMessage();
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, [], []),
			).to.be.revertedWith('Below threshold');
		});

		it('B5: epoch zero rejects a certificate that keeps the Genesis root unchanged', async function () {
			const genesis = await bootstrapGenesis();
			const genesisRoot = await geniusDiamond.bridgeAttestorRoot();
			const genesisTree = buildValidatorMerkleTree([genesis.address]);
			const message = makeMessage();
			const cert = await buildAttestorCertificate(
				message,
				[genesis],
				genesisTree,
				GENESIS_EPOCH,
				genesisRoot,
				liveEnvironment(),
			);
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), genesisRoot, cert.sortedSigs, cert.merkleProofs),
			).to.be.revertedWith('Genesis certificate must install API attestors');
		});

		it('B6: the first valid certificate installs a different root and emits BridgeAttestorSetAdvanced(0, 1, ...)', async function () {
			const genesis = await bootstrapGenesis();
			const genesisRoot = await geniusDiamond.bridgeAttestorRoot();
			const genesisTree = buildValidatorMerkleTree([genesis.address]);
			const message = makeMessage();
			const cert = await buildAttestorCertificate(
				message,
				[genesis],
				genesisTree,
				GENESIS_EPOCH,
				activeTree.root,
				liveEnvironment(),
			);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeAttestorSetAdvanced')
				.withArgs(GENESIS_EPOCH, ACTIVE_EPOCH, genesisRoot, activeTree.root);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(activeTree.root);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(ACTIVE_EPOCH);
		});

		it('B7: after the first transition one signature is no longer enough', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0]]); // 1-of-3 at threshold 2
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, cert.merkleProofs),
			).to.be.revertedWith('Below threshold');
		});
	});

	describe('BRIDGE-19 current-root verification matrix (SPEC :667-676)', function () {
		it('C1: two current-root attestors authorize a claim', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(cert.messageId, user1.address, DEFAULT_AMOUNT, SRC_CHAIN_ID, localChainId);
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(DEFAULT_AMOUNT);
		});

		it('C2: a signer in nextRoot but NOT currentRoot cannot authorize the transition (next-tree proof vs the current root)', async function () {
			await transitionToActive();
			const message = makeMessage();
			// Correctly signed against the TRUE on-chain digest (current root/epoch),
			// by two attestors that exist only in the NEXT tree presenting their
			// next-tree membership proofs — membership is checked against the
			// CURRENT root only (T-15-10).
			const cert = v2Cert(message, activeTree.root, ACTIVE_EPOCH, nextTree.root);
			const { sortedSigs, merkleProofs } = await signAndAttach(
				cert,
				[nextAttestors[0], nextAttestors[1]],
				nextTree,
			);
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), nextTree.root, sortedSigs, merkleProofs),
			).to.be.revertedWith('Not a registered attestor');
		});

		it('C3: an unknown/public-only signer cannot authorize a claim ("Not a registered attestor")', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = v2Cert(message, activeTree.root, ACTIVE_EPOCH, activeTree.root);
			const structHash = computeBridgeInStructHashV2(cert);
			const sigs = await Promise.all([
				signBridgeInCertificateV2(attestors[0], cert),
				signBridgeInCertificateV2(nonAttestor, cert),
			]);
			const sortedSigs = await aggregateCertificateV2(sigs, structHash);
			// The non-attestor has no proof — give it attestor[0]'s proof (its leaf
			// differs, so membership fails) — GNUSBridgeIn.test.ts:546-598 pattern.
			const proof0 = activeTree.proofs.get(attestors[0].address.toLowerCase());
			if (proof0 === undefined) {
				throw new Error('attestor[0] proof missing');
			}
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, sortedSigs, [proof0, proof0]),
			).to.be.revertedWith('Not a registered attestor');
		});

		it('C4: a malformed signature fails ("Bad signature")', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			// Wrong length (31 bytes) -> tryRecover InvalidSignatureLength.
			const malformed = `0x${'00'.repeat(31)}`;
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(message),
					activeTree.root,
					[malformed, cert.sortedSigs[1]],
					[cert.merkleProofs[0], cert.merkleProofs[1]],
				),
			).to.be.revertedWith('Bad signature');
		});

		it('C5: an invalid Merkle proof fails', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			// Valid-format proof attached to the WRONG signer slot (slot 1 gets
			// slot 0's proof — leaf mismatch fails membership).
			const swappedProofs = [cert.merkleProofs[0], cert.merkleProofs[0]];
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, swappedProofs),
			).to.be.revertedWith('Not a registered attestor');
		});

		it('C6: a duplicate signer fails ("Signers not strictly ascending")', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = v2Cert(message, activeTree.root, ACTIVE_EPOCH, activeTree.root);
			// Sign with attestor[0] TWICE — bypasses aggregateCertificateV2's
			// duplicate throw by signing directly (GNUSBridgeIn.test.ts:510-544 pattern).
			const sig = await signBridgeInCertificateV2(attestors[0], cert);
			const proof = activeTree.proofs.get(attestors[0].address.toLowerCase());
			if (proof === undefined) {
				throw new Error('attestor[0] proof missing');
			}
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, [sig, sig], [proof, proof]),
			).to.be.revertedWith('Signers not strictly ascending');
		});

		it('C7: unsorted signers fail ("Signers not strictly ascending")', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			// Reverse sigs AND proofs so the revert comes from ordering, not membership.
			const reversedSigs = [...cert.sortedSigs].reverse();
			const reversedProofs = [...cert.merkleProofs].reverse();
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, reversedSigs, reversedProofs),
			).to.be.revertedWith('Signers not strictly ascending');
		});

		it('C8: more than MAX_ATTESTOR_SIGNATURES (17 from a 32-attestor tree) fails at the cap', async function () {
			const manyAttestors = Array.from({ length: THIRTY_TWO_ATTESTORS }, () => Wallet.createRandom());
			const bigTree = buildValidatorMerkleTree(manyAttestors.map((a) => a.address));
			await transitionTo(bigTree);
			const message = makeMessage();
			const cert = await buildAttestorCertificate(
				message,
				manyAttestors.slice(0, OVER_CAP_SIG_COUNT),
				bigTree,
				ACTIVE_EPOCH,
				bigTree.root,
				liveEnvironment(),
			);
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), bigTree.root, cert.sortedSigs, cert.merkleProofs),
			).to.be.revertedWith('Too many attestor signatures');
		});
	});

	describe('BRIDGE-19 root-transition matrix (SPEC :678-685)', function () {
		it('R1: nextRoot == currentRoot processes a claim without incrementing the epoch and without an advance event', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]); // unchanged root
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(tx).to.emit(geniusDiamond, 'BridgeReleased');
			await expect(tx).to.not.emit(geniusDiamond, 'BridgeAttestorSetAdvanced');
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(ACTIVE_EPOCH);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(activeTree.root);
		});

		it('R2: multiple claims can execute against an unchanged root', async function () {
			await transitionToActive();
			for (let i = 0; i < MULTI_CLAIM_COUNT; i++) {
				const message = makeMessage();
				const cert = await activeCert(message, [attestors[i], attestors[i + 1]]);
				await expect(
					geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, cert.sortedSigs, cert.merkleProofs),
				).to.emit(geniusDiamond, 'BridgeReleased');
			}
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(ACTIVE_EPOCH);
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(
				DEFAULT_AMOUNT * BigInt(MULTI_CLAIM_COUNT),
			);
		});

		it('R3: a changed root increments the epoch exactly once', async function () {
			await transitionToActive();
			const epochBefore = await geniusDiamond.bridgeAttestorEpoch();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]], nextTree.root);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				nextTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeAttestorSetAdvanced')
				.withArgs(ACTIVE_EPOCH, ACTIVE_EPOCH + 1n, activeTree.root, nextTree.root);
			const epochAfter = await geniusDiamond.bridgeAttestorEpoch();
			expect(epochAfter - epochBefore).to.equal(1n);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(nextTree.root);
		});

		it('R4: a certificate signed against an OLD root fails after rotation', async function () {
			await transitionToActive();
			// Rotate active -> next (epoch becomes 2).
			const rotationMessage = makeMessage();
			const rotationCert = await activeCert(rotationMessage, [attestors[0], attestors[1]], nextTree.root);
			await geniusDiamond.bridgeIn(
				messageTuple(rotationMessage),
				nextTree.root,
				rotationCert.sortedSigs,
				rotationCert.merkleProofs,
			);

			// Fresh message (avoids the replay guard) signed against the OLD root/
			// epoch by the OLD attestors — the on-chain digest is computed over the
			// NEW root, so both recoveries yield foreign addresses. Bare-revert
			// assertion: the two foreign addresses are effectively random, so the
			// failure could surface as either ordering or membership — the digest
			// mismatch is the behavior under test (Phase-10 digest-mismatch
			// precedent, GNUSBridgeIn.test.ts:416-448).
			const staleMessage = makeMessage();
			const stale = await activeCert(staleMessage, [attestors[0], attestors[1]], nextTree.root);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(staleMessage),
					nextTree.root,
					stale.sortedSigs,
					stale.merkleProofs,
				),
			).to.be.reverted;
		});

		it('R5: two competing rotations from the same old root — the second reverts and the root/epoch reflect only the first', async function () {
			await transitionToActive();
			const competingTree = buildValidatorMerkleTree([
				Wallet.createRandom().address,
				Wallet.createRandom().address,
				Wallet.createRandom().address,
			]);
			const message = makeMessage(); // the SAME source event for both rotations

			const first = await activeCert(message, [attestors[0], attestors[1]], nextTree.root);
			await geniusDiamond.bridgeIn(
				messageTuple(message),
				nextTree.root,
				first.sortedSigs,
				first.merkleProofs,
			);
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(nextTree.root);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(ACTIVE_EPOCH + 1n);

			// Same messageId, different target root — replay fires before the digest.
			const second = await activeCert(message, [attestors[0], attestors[1]], competingTree.root);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(message),
					competingTree.root,
					second.sortedSigs,
					second.merkleProofs,
				),
			).to.be.revertedWith('Message already processed');
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(nextTree.root);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(ACTIVE_EPOCH + 1n);
		});

		it('R6: failed minting reverts the root update AND the replay marker', async function () {
			await transitionToActive();
			const rootBefore = await geniusDiamond.bridgeAttestorRoot();
			const epochBefore = await geniusDiamond.bridgeAttestorEpoch();

			// Over-cap amount; the certificate would ALSO rotate active -> next.
			const doomed = makeMessage({ amount: OVER_CAP_AMOUNT });
			const doomedCert = await activeCert(doomed, [attestors[0], attestors[1]], nextTree.root);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(doomed),
					nextTree.root,
					doomedCert.sortedSigs,
					doomedCert.merkleProofs,
				),
			).to.be.revertedWith('Global max supply exceeded');

			// Root/epoch unchanged (atomic revert of the transition).
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(rootBefore);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(epochBefore);

			// The replay marker also reverted: the SAME over-cap certificate fails
			// on the cap again — NOT on "Message already processed".
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(doomed),
					nextTree.root,
					doomedCert.sortedSigs,
					doomedCert.merkleProofs,
				),
			).to.be.revertedWith('Global max supply exceeded');

			// A corrected resubmission (valid amount, same rotation) still works.
			const corrected = makeMessage();
			const correctedCert = await activeCert(corrected, [attestors[0], attestors[1]], nextTree.root);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(corrected),
					nextTree.root,
					correctedCert.sortedSigs,
					correctedCert.merkleProofs,
				),
			).to.emit(geniusDiamond, 'BridgeAttestorSetAdvanced');
			expect(await geniusDiamond.bridgeAttestorRoot()).to.equal(nextTree.root);
			expect(await geniusDiamond.bridgeAttestorEpoch()).to.equal(epochBefore + 1n);
		});
	});

	describe('BRIDGE-19 replay + domain-binding matrix (SPEC :687-697)', function () {
		/**
		 * Genesis-epoch digest-mismatch harness: signs a certificate over the
		 * PERTURBED values (or environment overrides) and returns it with the
		 * ORIGINAL message for submission. See the file header: with a single
		 * signature the foreign recovery always satisfies strict-ascending and
		 * always fails membership, so the revert pins deterministically.
		 */
		async function genesisSignedWith(
			perturb: (base: BridgeMessageFields) => BridgeMessageFields,
			overrides: Partial<Pick<BridgeMessageV2, 'destChainID' | 'diamondAddress'>> = {},
		): Promise<{ original: BridgeMessageFields; signed: { sortedSigs: string[]; merkleProofs: string[][] } }> {
			const genesis = await bootstrapGenesis();
			const genesisTree = buildValidatorMerkleTree([genesis.address]);
			const original = makeMessage();
			const cert = v2Cert(perturb(original), genesisTree.root, GENESIS_EPOCH, activeTree.root, overrides);
			const signed = await signAndAttach(cert, [genesis], genesisTree);
			return { original, signed };
		}

		/** Submits the ORIGINAL message with the PERTURBED certificate — must fail membership. */
		async function submitExpectingMismatch(
			original: BridgeMessageFields,
			signed: { sortedSigs: string[]; merkleProofs: string[][] },
		): Promise<void> {
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(original),
					activeTree.root,
					signed.sortedSigs,
					signed.merkleProofs,
				),
			).to.be.revertedWith('Not a registered attestor');
		}

		it('D1: the same source event cannot execute twice ("Message already processed")', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(message),
					activeTree.root,
					cert.sortedSigs,
					cert.merkleProofs,
				),
			).to.be.revertedWith('Message already processed');
		});

		it('D2: two event indexes in the same source transaction produce different messageIds and both bridge in', async function () {
			await transitionToActive();
			const sourceTxHash = ethers.id('matrix-same-source-tx');
			const eventA = makeMessage({ sourceTxHash, sourceEventIndex: 0n });
			const eventB = makeMessage({ sourceTxHash, sourceEventIndex: 1n });
			expect(computeBridgeMessageId(eventA)).to.not.equal(computeBridgeMessageId(eventB));

			for (const message of [eventA, eventB]) {
				const cert = await activeCert(message, [attestors[0], attestors[1]]);
				await expect(
					geniusDiamond.bridgeIn(
						messageTuple(message),
						activeTree.root,
						cert.sortedSigs,
						cert.merkleProofs,
					),
				)
					.to.emit(geniusDiamond, 'BridgeReleased')
					.withArgs(
						computeBridgeMessageId(message),
						user1.address,
						DEFAULT_AMOUNT,
						SRC_CHAIN_ID,
						localChainId,
					);
			}
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(
				DEFAULT_AMOUNT * BigInt(MULTI_CLAIM_COUNT),
			);
		});

		it('D3: changing sourceBridgeID changes the messageId and the digest (old cert fails)', async function () {
			const perturbedBridgeID = ethers.zeroPadValue('0xffff', 32);
			const { original, signed } = await genesisSignedWith((m) => ({
				...m,
				sourceBridgeID: perturbedBridgeID,
			}));
			expect(
				computeBridgeMessageId({ ...original, sourceBridgeID: perturbedBridgeID }),
			).to.not.equal(computeBridgeMessageId(original));
			await submitExpectingMismatch(original, signed);
		});

		it('D4: changing the source chain changes the digest', async function () {
			const perturbedSrcChainId = 1n; // != SRC_CHAIN_ID, != localChainId
			const { original, signed } = await genesisSignedWith((m) => ({
				...m,
				srcChainID: perturbedSrcChainId,
			}));
			// srcChainID is also one of the four messageId identity fields.
			expect(
				computeBridgeMessageId({ ...original, srcChainID: perturbedSrcChainId }),
			).to.not.equal(computeBridgeMessageId(original));
			await submitExpectingMismatch(original, signed);
		});

		it('D5: changing the recipient changes the digest (messageId unchanged — recipient is digest-bound only)', async function () {
			const { original, signed } = await genesisSignedWith((m) => ({ ...m, recipient: user2.address }));
			// BRIDGE-12: recipient is NOT in the replay key — the messageId is
			// unchanged, the digest is not.
			expect(computeBridgeMessageId({ ...original, recipient: user2.address })).to.equal(
				computeBridgeMessageId(original),
			);
			await submitExpectingMismatch(original, signed);
		});

		it('D6: changing the amount changes the digest (messageId unchanged — amount is digest-bound only)', async function () {
			const perturbedAmount = DEFAULT_AMOUNT + DEFAULT_AMOUNT;
			const { original, signed } = await genesisSignedWith((m) => ({ ...m, amount: perturbedAmount }));
			expect(computeBridgeMessageId({ ...original, amount: perturbedAmount })).to.equal(
				computeBridgeMessageId(original),
			);
			await submitExpectingMismatch(original, signed);
		});

		it('D7: a certificate for another destination chain fails', async function () {
			const { original, signed } = await genesisSignedWith((m) => m, {
				destChainID: localChainId + WRONG_CHAIN_OFFSET,
			});
			await submitExpectingMismatch(original, signed);
		});

		it('D8: a certificate for another diamond address fails', async function () {
			const { original, signed } = await genesisSignedWith((m) => m, {
				diamondAddress: Wallet.createRandom().address,
			});
			await submitExpectingMismatch(original, signed);
		});

		it('D9: a signature over the native SuperGenius vote bytes fails (PD-BR-7; active-epoch companion to V4)', async function () {
			await transitionToActive();
			const message = makeMessage();
			const cert = v2Cert(message, activeTree.root, ACTIVE_EPOCH, activeTree.root);
			const structHash = computeBridgeInStructHashV2(cert);
			const digest = ethers.hashMessage(ethers.getBytes(structHash));

			// Native (non-EIP-191) signatures over the RAW structHash, sorted by the
			// addresses they recover to against the on-chain digest — even a
			// correctly-ordered native certificate recovers foreign addresses and
			// fails attestor membership.
			const nativeSigs = [attestors[0], attestors[1]].map((w) =>
				w.signingKey.sign(ethers.getBytes(structHash)).serialized,
			);
			const sortedNative = nativeSigs
				.map((sig) => ({ sig, addr: ethers.recoverAddress(digest, sig).toLowerCase() }))
				.sort((a, b) => (a.addr < b.addr ? -1 : 1))
				.map(({ sig }) => sig);
			const proof0 = activeTree.proofs.get(attestors[0].address.toLowerCase());
			if (proof0 === undefined) {
				throw new Error('attestor[0] proof missing');
			}
			await expect(
				geniusDiamond.bridgeIn(messageTuple(message), activeTree.root, sortedNative, [proof0, proof0]),
			).to.be.revertedWith('Not a registered attestor');
		});
	});

	describe('BRIDGE-19 existing-token-behavior matrix (SPEC :699-706)', function () {
		it('E1: the bridge fee remains applied to the pre-fee amount (10% fee -> recipient receives 90%)', async function () {
			await transitionToActive();
			await geniusDiamond.updateBridgeFee(BRIDGE_FEE_TEN_PERCENT);
			const amount = toWei(100);
			const message = makeMessage({ amount });
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(toWei(90));
		});

		it('E2: a zero post-fee amount reverts ("Bridge fee consumes entire amount")', async function () {
			await transitionToActive();
			// Max fee 20%: 1 wei * (1000 - 200) / 1000 floors to zero (WR-02).
			await geniusDiamond.updateBridgeFee(BRIDGE_FEE_MAX);
			const message = makeMessage({ amount: 1n });
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(message),
					activeTree.root,
					cert.sortedSigs,
					cert.merkleProofs,
				),
			).to.be.revertedWith('Bridge fee consumes entire amount');
		});

		it('E3: the global max supply remains enforced', async function () {
			await transitionToActive();
			const message = makeMessage({ amount: OVER_CAP_AMOUNT });
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(message),
					activeTree.root,
					cert.sortedSigs,
					cert.merkleProofs,
				),
			).to.be.revertedWith('Global max supply exceeded');
		});

		it('E4: globalSupply/chainSupply deltas are post-fee-correct (totalSupplyOfAll delta pattern)', async function () {
			await transitionToActive();
			await geniusDiamond.updateBridgeFee(BRIDGE_FEE_TEN_PERCENT);
			const amount = toWei(50); // post-fee 45
			const message = makeMessage({ amount });
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			const supplyBefore = await geniusDiamond.totalSupplyOfAll();
			await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			const supplyAfter = await geniusDiamond.totalSupplyOfAll();
			// `chainSupply` has no public per-chain reader (GNUSTreasury exposes only
			// totalSupplyOfAll); both writes happen in the same _mintWithBridgeFee
			// block, so the post-fee global delta evidences both (Phase-10 pattern).
			expect(supplyAfter - supplyBefore).to.equal(toWei(45));
		});

		it('E5: BridgeReleased reports the pre-fee amount', async function () {
			await transitionToActive();
			await geniusDiamond.updateBridgeFee(BRIDGE_FEE_TEN_PERCENT);
			const amount = toWei(100);
			const message = makeMessage({ amount });
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(cert.messageId, user1.address, amount, SRC_CHAIN_ID, localChainId); // PRE-fee
		});

		it('E6: the pause check occurs before certificate work (garbage certificate while paused -> pause revert)', async function () {
			await transitionToActive();
			await geniusDiamond.emergencyPause();
			// GARBAGE certificate: zero signatures over an all-zero message would
			// fail many later checks — asserting the PAUSE revert proves the
			// ordering (pause first, SPEC :476-479 step (a)).
			await expect(
				geniusDiamond.bridgeIn(
					{
						srcChainID: 0n,
						sourceBridgeID: ethers.ZeroHash,
						sourceTxHash: ethers.ZeroHash,
						sourceEventIndex: 0n,
						recipient: ethers.ZeroAddress,
						amount: 0n,
					},
					ethers.ZeroHash,
					[],
					[],
				),
			).to.be.revertedWith('GNUSControl: contract paused');
		});

		it('E7: the mint leg still runs enforceMintGate — perWalletMintCap[GNUS_TOKEN_ID] is consumed by the first bridge-in and enforced against the second (WR-02)', async function () {
			await transitionToActive();
			// The bridgeIn mint leg inherits the lifecycle mint gate via
			// _mint -> _beforeTokenTransfer -> GNUSLifecyclePolicy.enforceMintGate —
			// there is NO GNUS_TOKEN_ID carve-out there (unlike the D-24 transfer-policy
			// predicate). Cap the recipient's wallet at exactly one DEFAULT_AMOUNT and
			// prove BOTH halves of the coupling: consumption (the first claim fills the
			// allowance) and enforcement (the second claim reverts on the cap).
			await geniusDiamond.setPerWalletMintCap(GNUS_TOKEN_ID, DEFAULT_AMOUNT);

			const first = makeMessage(); // recipient user1, amount DEFAULT_AMOUNT
			const firstCert = await activeCert(first, [attestors[0], attestors[1]]);
			await geniusDiamond.bridgeIn(
				messageTuple(first),
				activeTree.root,
				firstCert.sortedSigs,
				firstCert.merkleProofs,
			);
			// The first claim minted AND consumed the full per-wallet allowance.
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(DEFAULT_AMOUNT);

			const second = makeMessage(); // fresh source event, same recipient/amount
			const secondCert = await activeCert(second, [attestors[0], attestors[1]]);
			await expect(
				geniusDiamond.bridgeIn(
					messageTuple(second),
					activeTree.root,
					secondCert.sortedSigs,
					secondCert.merkleProofs,
				),
			).to.be.revertedWith('Per-wallet mint cap exceeded');
			expect(await geniusDiamond['balanceOf(address)'](user1.address)).to.equal(DEFAULT_AMOUNT);
		});
	});

	describe('fee-replica pairing + gas measurement (Pitfall 1 / research A1)', function () {
		it('mint() and bridgeIn() produce identical post-fee recipient balances under the same fee (twin _mintWithBridgeFee replicas)', async function () {
			await transitionToActive();
			await geniusDiamond.updateBridgeFee(BRIDGE_FEE_TEN_PERCENT);
			const amount = toWei(100);

			// GNUSBridge.mint(address,uint256) -> GNUSBridge._mintWithBridgeFee (twin A).
			await geniusDiamond['mint(address,uint256)'](user2.address, amount);

			// GNUSBridgeAttestor.bridgeIn -> inline _mintWithBridgeFee replica (twin B).
			const message = makeMessage({ amount });
			const cert = await activeCert(message, [attestors[0], attestors[1]]);
			await geniusDiamond.bridgeIn(
				messageTuple(message),
				activeTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);

			const balanceMintPath = await geniusDiamond['balanceOf(address)'](user2.address);
			const balanceBridgePath = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balanceBridgePath).to.equal(balanceMintPath); // NO replica drift
			expect(balanceMintPath).to.equal(toWei(90));
		});

		it('[GAS] 16-signature certificate (16-of-32 tree, legitimately under the cap) records gasUsed', async function () {
			const manyAttestors = Array.from({ length: THIRTY_TWO_ATTESTORS }, () => Wallet.createRandom());
			const bigTree = buildValidatorMerkleTree(manyAttestors.map((a) => a.address));
			await transitionTo(bigTree);
			const message = makeMessage();
			const cert = await buildAttestorCertificate(
				message,
				manyAttestors.slice(0, CAP_SIG_COUNT),
				bigTree,
				ACTIVE_EPOCH,
				bigTree.root,
				liveEnvironment(),
			);
			const tx = await geniusDiamond.bridgeIn(
				messageTuple(message),
				bigTree.root,
				cert.sortedSigs,
				cert.merkleProofs,
			);
			await expect(tx).to.emit(geniusDiamond, 'BridgeReleased');
			const receipt = await tx.wait();
			if (receipt === null) {
				throw new Error('16-sig certificate receipt missing');
			}
			// A1 measurement — no bound enforced (the cap is the design bound).
			expect(receipt.gasUsed).to.be.greaterThan(0n);
			// eslint-disable-next-line no-console
			console.log(`[GAS] 16-sig certificate: ${receipt.gasUsed}`);
		});
	});
});
