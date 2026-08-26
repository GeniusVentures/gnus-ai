import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { GeniusDiamond } from '../../diamond-typechain-types';
import vectorsJson from '../fixtures/bridge-attestor-vectors.json';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';
import {
	BRIDGE_CERTIFICATE_V2_DOMAIN,
	BridgeMessageV2,
	GNUS_TOKEN_ID,
	aggregateCertificateV2,
	buildValidatorMerkleTree,
	computeBridgeInStructHashV2,
	computeBridgeMessageId,
	signBridgeInCertificateV2,
} from '../utils/bridge-certificate';

/**
 * Phase 15 unit tests — GNUSBridgeAttestor.bridgeIn (V2 certificate path).
 *
 * BRIDGE-18 vector consumer (Task 2):
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
 *
 * Environment-bound fields: `chainid` AND `diamondAddress` are re-bound to the
 * live deployment in the on-chain legs — the frozen 31337 / 0x1111...11 remain
 * the off-chain C++ conformance constants proven by legs V1/V2.
 *
 * Scaffold: GNUSBridgeIn.test.ts (LocalDiamondDeployer + treasury-seed probe +
 * setChainID + snapshot isolation). Revert strings asserted below must match
 * contracts/gnus-ai/GNUSBridgeAttestor.sol exactly.
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

	// keccak256("gnus.ai.treasury.storage") — GNUSTreasuryStorage layout base slot
	const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let initialSnapshotId: string;
	let snapshotId: string;

	let diamondAddress: string;
	let localChainId: bigint;

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

		// Seed the provenance counter so the global-cap check in _mintWithBridgeFee
		// can run. Guarded by a storage probe so re-runs against a cached diamond
		// don't revert (GNUSBridgeIn.test.ts scaffold pattern).
		const initialized = await hre.network.provider.send('eth_getStorageAt', [
			diamondAddress,
			ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
		]);
		if (BigInt(initialized) === 0n) {
			await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
		}

		// Record the live chain id and point the diamond's chainID at it so
		// bridgeIn's destination-chain check passes (the V2 digest binds
		// block.chainid — certificates are re-signed over the live value).
		const network = await ethers.provider.getNetwork();
		localChainId = network.chainId;
		await geniusDiamond.setChainID(localChainId);

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
	});
});
