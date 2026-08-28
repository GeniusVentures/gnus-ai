import { ethers } from 'hardhat';
import type { BaseWallet } from 'ethers';

/**
 * Bridge-in certificate helpers (Phase 10 — Lock/Release Bridge Vault; extended
 * by Phase 15 — Secure BridgeIn amendment).
 *
 * Pure utility module (no Hardhat network calls). The V2 helpers below produce
 * EIP-191 wrapped ECDSA certificates that round-trip against the on-chain
 * verifier in `contracts/gnus-ai/GNUSBridgeAttestor.sol`: the on-chain twin of
 * `computeBridgeInStructHashV2` is `_bridgeInDigestV2`, and the sorted+proofed
 * certificate shape feeds `_verifyBridgeAttestorCertificate` via `bridgeIn`.
 *
 * References:
 *  - CONTEXT D-08/D-10 — validators sign an EVM-compatible digest, EIP-191
 *    wrapped, binding the dest chain and the diamond (cross-chain,
 *    cross-diamond replay protection).
 *  - CONTEXT D-13 (extended by PD-BR-5) — signatures must be submitted sorted
 *    strictly ascending by recovered address (duplicate-proof, cap 16).
 *  - RESEARCH Pitfall 1 — do NOT manually prepend the EIP-191 prefix;
 *    `wallet.signMessage` applies it internally.
 *  - RESEARCH Pitfall 3 — merkle leaf is `keccak256(abi.encodePacked(address))`
 *    (20-byte packed encoding, NOT `abi.encode` which pads to 32 bytes).
 *
 * This file is also the reference implementation for the SuperGenius-side C++
 * `SignEVM` (see 10-RESEARCH.md §"SuperGenius-Side EVM Envelope Signer") — keep
 * it readable and side-effect free.
 *
 * RETAINED-FOR-HISTORY (Phase 10 block): the Phase 10 V1 digest/signature
 * exports (`BridgeInMessage`, `computeBridgeInStructHash`,
 * `signBridgeInCertificate`) were DELETED — their on-chain counterpart
 * (`GNUSBridge.sol::bridgeIn` / `_verifyThresholdCertificate`) was removed by
 * Phase 15 D-06 and they had zero consumers left. `aggregateCertificate` (the
 * ascending-sort/duplicate-guard aggregator) and `buildValidatorMerkleTree`
 * remain live: `aggregateCertificateV2` delegates to the former and every V2
 * certificate builder consumes the latter (the aggregation and tree
 * conventions are shared across V1/V2).
 *
 * Phase 15 (Secure BridgeIn amendment) extends the module additively with the
 * V2 helpers (BRIDGE_MESSAGE_ID_V2 composite replay key + BRIDGE_CERTIFICATE_V2
 * rolling-root digest + the genesis/active attestor certificate builder).
 * This file REMAINS the reference implementation for the SuperGenius C++
 * exporter's V2 `SignEVM`: every V2 helper below mirrors
 * `contracts/gnus-ai/GNUSBridgeAttestor.sol` field-for-field, and the
 * checked-in vectors in `test/fixtures/bridge-attestor-vectors.json` are the
 * cross-language parity contract (BRIDGE-18 / D-08).
 */

/**
 * Recovers each signer's address from the EIP-191 wrapped structHash and
 * returns the signatures sorted strictly ascending by recovered address
 * (per CONTEXT D-13). Throws on duplicate signers — the on-chain verifier
 * would revert anyway; failing fast in the helper surfaces the bug earlier.
 *
 * RETAINED-FOR-HISTORY (Phase 10): the V1 digest/signature callers were deleted
 * with Phase 15 D-06; this aggregator stays because `aggregateCertificateV2`
 * delegates to it — the aggregation semantics are V1/V2-identical.
 */
export async function aggregateCertificate(
	signatures: string[],
	structHash: string,
): Promise<string[]> {
	const digest = ethers.hashMessage(ethers.getBytes(structHash));
	const withAddr = signatures.map((sig) => ({
		sig,
		addr: ethers.recoverAddress(digest, sig).toLowerCase(),
	}));
	withAddr.sort((a, b) => (a.addr < b.addr ? -1 : a.addr > b.addr ? 1 : 0));
	for (let i = 1; i < withAddr.length; i++) {
		if (withAddr[i].addr === withAddr[i - 1].addr) {
			throw new Error(`Duplicate signer in certificate: ${withAddr[i].addr}`);
		}
	}
	return withAddr.map(({ sig }) => sig);
}

/**
 * Builds a keccak256 merkle tree over `abi.encodePacked(address)` leaves.
 *
 * Returns the root hex string and a Map from lowercase validator address to
 * the proof array (ordered leaf-to-root). Matches OpenZeppelin's
 * `MerkleProofUpgradeable.verify` expectations:
 *   - leaf is `keccak256(abi.encodePacked(signer))` — 20-byte packed (Pitfall 3)
 *   - each level sorts the pair (min, max) before hashing — `_hashPair`
 *   - odd-numbered levels promote the last node unchanged
 *
 * Single-leaf case: root == leaf, proof == [].
 */
export function buildValidatorMerkleTree(validatorAddresses: string[]): {
	root: string;
	proofs: Map<string, string[]>;
} {
	if (validatorAddresses.length === 0) {
		throw new Error('buildValidatorMerkleTree: empty validator set');
	}

	// Build leaves and record index per (lowercase) address for proof mapping.
	const leaves: string[] = validatorAddresses.map((addr) =>
		ethers.keccak256(ethers.solidityPacked(['address'], [addr])),
	);
	const addressByLeaf = new Map<string, string>();
	validatorAddresses.forEach((addr, i) => {
		addressByLeaf.set(leaves[i], addr.toLowerCase());
	});

	// Proof accumulator per leaf index.
	const proofsByIndex: string[][] = leaves.map(() => []);

	// Track ALL leaf indices under each node so every leaf in a merged subtree
	// receives the new sibling when its ancestor combines.
	let level: string[] = leaves.slice();
	let levelMembers: number[][] = leaves.map((_, i) => [i]);

	while (level.length > 1) {
		const nextLevel: string[] = [];
		const nextMembers: number[][] = [];
		for (let i = 0; i < level.length; i += 2) {
			if (i + 1 < level.length) {
				const a = level[i];
				const b = level[i + 1];
				const [lo, hi] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
				const parent = ethers.keccak256(ethers.concat([lo, hi]));
				// Every leaf under the left child gets `b` appended to its proof;
				// every leaf under the right child gets `a` appended.
				for (const leafIdx of levelMembers[i]) {
					proofsByIndex[leafIdx].push(b);
				}
				for (const leafIdx of levelMembers[i + 1]) {
					proofsByIndex[leafIdx].push(a);
				}
				nextLevel.push(parent);
				nextMembers.push([...levelMembers[i], ...levelMembers[i + 1]]);
			} else {
				// Odd node: promote unchanged, no proof addition.
				nextLevel.push(level[i]);
				nextMembers.push(levelMembers[i]);
			}
		}
		level = nextLevel;
		levelMembers = nextMembers;
	}

	const root = level[0];
	const proofs = new Map<string, string[]>();
	leaves.forEach((leaf, i) => {
		const addr = addressByLeaf.get(leaf);
		if (addr === undefined) {
			throw new Error('buildValidatorMerkleTree: leaf-to-address mapping missing');
		}
		proofs.set(addr, proofsByIndex[i]);
	});

	return { root, proofs };
}

// ---------------------------------------------------------------------------
// Phase 15 — V2 attestor certificate helpers (BRIDGE-12..15, D-02/D-03).
// The Phase 10 V1 digest/signature exports were deleted (D-06 removed their
// on-chain twin); aggregateCertificate + buildValidatorMerkleTree above are
// retained-for-history AND live (V2 delegation / shared tree convention).
// ---------------------------------------------------------------------------

/**
 * keccak256("GNUS_BRIDGE_MESSAGE_ID_V2") — the V2 source-event message domain
 * (PD-BR-3 / BRIDGE-12). Hardcoded with its derivation so the reference stays
 * a pure literal; MUST equal the private constant in GNUSBridgeAttestor.sol.
 */
export const BRIDGE_MESSAGE_ID_V2_DOMAIN =
	'0xcad6f4b492a613b2322ad77e106df9e952c4686b8455874b7af1d7508943a434';

/**
 * keccak256("GNUS_BRIDGE_CERTIFICATE_V2") — the V2 certificate domain
 * separator (PD-BR-4 / BRIDGE-13). Hardcoded with its derivation so the
 * reference stays a pure literal; MUST equal the private constant in
 * GNUSBridgeAttestor.sol.
 */
export const BRIDGE_CERTIFICATE_V2_DOMAIN =
	'0x0c9113fc73963b588d64629e34320173d476269c17e86929f707794e43f12c5b';

/**
 * GNUS_TOKEN_ID — hardcoded into the V2 digest on-chain (D-14: bridge-in mints
 * the GNUS root token only; there is no tokenId parameter on bridgeIn).
 */
export const GNUS_TOKEN_ID = 0n;

/**
 * The six canonical BridgeMessage fields (SPEC :247-290 / BRIDGE-12).
 * Subset of {@link BridgeMessageV2} — every message-carrying V2 helper accepts it.
 */
export type BridgeMessageFields = Pick<
	BridgeMessageV2,
	'srcChainID' | 'sourceBridgeID' | 'sourceTxHash' | 'sourceEventIndex' | 'recipient' | 'amount'
>;

/**
 * Fields committed into the V2 bridge-in certificate digest. Field ORDER and
 * TYPES are load-bearing — they must match `_bridgeInDigestV2` in
 * contracts/gnus-ai/GNUSBridgeAttestor.sol EXACTLY (the on-chain twin of
 * `computeBridgeInStructHashV2`):
 *
 *   structHash = keccak256(abi.encode(
 *       BRIDGE_CERTIFICATE_V2,                  // domain (bytes32)
 *       currentEpoch,                           // uint64 on-chain — one zero-padded
 *                                               //   word, identical to uint256 here
 *       currentRoot,                            // attestor root verified against
 *       nextRoot,                               // root the certificate installs
 *       srcChainID,                             // message identity group —
 *       sourceBridgeID,                         //   the four fields that also key
 *       sourceTxHash,                           //   the messageId replay hash
 *       sourceEventIndex,                       //   (BRIDGE-12)
 *       destChainID,                            // environment group — block.chainid
 *       diamondAddress,                         //   and address(this) on-chain:
 *       recipient,                              //   cross-chain + cross-diamond
 *                                               //   replay binding (D-08/D-10)
 *       GNUS_TOKEN_ID,                          // hardcoded 0 (D-14)
 *       amount                                  // PRE-FEE amount
 *   ))
 *
 * On-chain the 13 words are produced by a bytes.concat of three partial
 * abi.encode groups (D-02 split-encode — the flat form hits the 0.8.19 stack
 * limit). Every field is a value type occupying exactly one 32-byte word, so
 * the split and flat encodings are byte-identical; the off-chain reference
 * computes the FLAT form (what the C++ exporter will compute) and the
 * equivalence is PROVEN by the BRIDGE-18 vectors + the flat/split unit test —
 * never assumed.
 */
export interface BridgeMessageV2 {
	/** Chain ID the bridge-out was initiated on (must differ from destChainID). */
	srcChainID: bigint;
	/** Canonical source bridge identifier — EVM source address left-padded to bytes32. */
	sourceBridgeID: string;
	/** Source transaction hash (or equivalent source-ledger transaction ID). */
	sourceTxHash: string;
	/** EVM log index / SuperGenius output index within sourceTxHash. */
	sourceEventIndex: bigint;
	/** Address receiving the minted (post-fee) tokens on the destination chain. */
	recipient: string;
	/** PRE-FEE GNUS amount; the destination bridge fee applies in _mintWithBridgeFee. */
	amount: bigint;
	/** Attestor merkle root the certificate is verified against (currentRoot on-chain). */
	currentRoot: string;
	/** Epoch of currentRoot (uint64 on-chain; one zero-padded abi word). */
	currentEpoch: bigint;
	/** Attestor root the certificate installs (nextAttestorRoot on-chain; may equal currentRoot). */
	nextRoot: string;
	/** Destination chain ID — block.chainid in the on-chain digest. */
	destChainID: bigint;
	/** Target diamond address — address(this) in the on-chain digest. */
	diamondAddress: string;
}

/**
 * Computes the V2 composite messageId (replay key) for a bridge message
 * (BRIDGE-12 / SPEC :272-290).
 *
 * messageId = keccak256(abi.encode(
 *     BRIDGE_MESSAGE_ID_V2, srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex
 * ))
 *
 * Recipient and amount are deliberately NOT in the replay key — they are bound
 * by the certificate digest instead. Must be byte-identical to the on-chain
 * `_bridgeMessageId` (feeds the slot-0 processedMessages mapping, D-07).
 */
export function computeBridgeMessageId(
	message: Pick<BridgeMessageV2, 'srcChainID' | 'sourceBridgeID' | 'sourceTxHash' | 'sourceEventIndex'>,
): string {
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
		['bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256'],
		[
			BRIDGE_MESSAGE_ID_V2_DOMAIN,
			message.srcChainID,
			message.sourceBridgeID,
			message.sourceTxHash,
			message.sourceEventIndex,
		],
	);
	return ethers.keccak256(encoded);
}

/**
 * Computes the V2 structHash (pre-EIP-191) for a bridge-in certificate
 * (BRIDGE-13 / D-02).
 *
 * FLAT single 13-field abi.encode in the exact on-chain field order documented
 * on {@link BridgeMessageV2}. The on-chain `_bridgeInDigestV2` computes the
 * byte-identical split-encode (three partial groups joined by bytes.concat) —
 * the flat form here is the reference the C++ exporter mirrors, and the
 * flat==split==vector equality is asserted by the BRIDGE-18 consumer test.
 */
export function computeBridgeInStructHashV2(cert: BridgeMessageV2): string {
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
		[
			'bytes32', // BRIDGE_CERTIFICATE_V2 domain
			'uint256', // currentEpoch (uint64 on-chain — identical padded word)
			'bytes32', // currentRoot
			'bytes32', // nextRoot
			'uint256', // srcChainID
			'bytes32', // sourceBridgeID
			'bytes32', // sourceTxHash
			'uint256', // sourceEventIndex
			'uint256', // destChainID (block.chainid)
			'address', // diamondAddress (address(this))
			'address', // recipient
			'uint256', // GNUS_TOKEN_ID (D-14 — hardcoded on-chain)
			'uint256', // amount
		],
		[
			BRIDGE_CERTIFICATE_V2_DOMAIN,
			cert.currentEpoch,
			cert.currentRoot,
			cert.nextRoot,
			cert.srcChainID,
			cert.sourceBridgeID,
			cert.sourceTxHash,
			cert.sourceEventIndex,
			cert.destChainID,
			cert.diamondAddress,
			cert.recipient,
			GNUS_TOKEN_ID,
			cert.amount,
		],
	);
	return ethers.keccak256(encoded);
}

/**
 * Signs a V2 bridge-in certificate with the given attestor wallet.
 *
 * Returns the 65-byte EIP-191 wrapped signature `r‖s‖v` (low-s canonical) as a
 * hex string. `wallet.signMessage` applies the `"\x19Ethereum Signed
 * Message:\n32"` prefix internally — do NOT prepend it manually (Pitfall 1).
 */
export async function signBridgeInCertificateV2(
	wallet: BaseWallet,
	cert: BridgeMessageV2,
): Promise<string> {
	const structHash = computeBridgeInStructHashV2(cert);
	return wallet.signMessage(ethers.getBytes(structHash));
}

/**
 * V2 twin of {@link aggregateCertificate}: recovers each signer from the
 * EIP-191 wrapped structHash and returns signatures sorted strictly ascending
 * by recovered address (D-13), throwing on duplicates. The V1/V2 aggregation
 * semantics are identical — only the structHash derivation differs — so this
 * delegates to the Phase 10 helper unchanged.
 */
export async function aggregateCertificateV2(
	signatures: string[],
	structHash: string,
): Promise<string[]> {
	return aggregateCertificate(signatures, structHash);
}

/** buildValidatorMerkleTree output shape — the attestor-set commitment. */
export type AttestorMerkleTree = { root: string; proofs: Map<string, string[]> };

/** A complete, submission-ready V2 attestor certificate. */
export interface AttestorCertificate {
	/** Signatures sorted strictly ascending by recovered address (D-13). */
	sortedSigs: string[];
	/** Merkle proofs parallel to sortedSigs, one per signer, against currentTree's root. */
	merkleProofs: string[][];
	/** V2 composite replay key (computeBridgeMessageId output). */
	messageId: string;
	/** Flat-form structHash the signers signed (computeBridgeInStructHashV2 output). */
	structHash: string;
}

/**
 * Builds a complete V2 attestor certificate: signs the digest with each signer
 * wallet, sorts strictly ascending by recovered address, and attaches the
 * per-signer merkle proofs PARALLEL to the sorted signatures from the tree the
 * caller supplies over the CURRENT root's addresses (`buildValidatorMerkleTree`
 * output — the builder never re-derives the caller's tree; proofs against the
 * CURRENT root only, T-15-10).
 *
 * `environment` (destChainID + diamondAddress) is explicit and has no default:
 * this reference implementation is side-effect free and cannot query the live
 * chain. Wrong-chain / cross-diamond negatives pass different values — the
 * Phase-10 `:139-150` override pattern lives in the test wrapper that knows
 * the live values.
 *
 * The single-leaf Genesis case works naturally: buildValidatorMerkleTree over
 * one address yields root == leaf and proof == [].
 */
export async function buildAttestorCertificate(
	message: BridgeMessageFields,
	signers: BaseWallet[],
	currentTree: AttestorMerkleTree,
	currentEpoch: bigint,
	nextRoot: string,
	environment: { destChainID: bigint; diamondAddress: string },
): Promise<AttestorCertificate> {
	const cert: BridgeMessageV2 = {
		...message,
		currentRoot: currentTree.root,
		currentEpoch,
		nextRoot,
		destChainID: environment.destChainID,
		diamondAddress: environment.diamondAddress,
	};
	const structHash = computeBridgeInStructHashV2(cert);
	const sigs = await Promise.all(signers.map((w) => signBridgeInCertificateV2(w, cert)));
	const sortedSigs = await aggregateCertificateV2(sigs, structHash);

	// Recover each sorted sig's signer and pull its proof — the proofs array
	// MUST be parallel to sortedSigs for _verifyBridgeAttestorCertificate.
	const digest = ethers.hashMessage(ethers.getBytes(structHash));
	const merkleProofs = sortedSigs.map((sig) => {
		const addr = ethers.recoverAddress(digest, sig).toLowerCase();
		const proof = currentTree.proofs.get(addr);
		if (proof === undefined) {
			throw new Error(`No proof for signer ${addr} — not in the current attestor set`);
		}
		return proof;
	});

	return { sortedSigs, merkleProofs, messageId: computeBridgeMessageId(message), structHash };
}
