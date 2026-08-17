import { ethers } from 'hardhat';
import type { Wallet } from 'ethers';

/**
 * Bridge-in certificate helpers (Phase 10 — Lock/Release Bridge Vault).
 *
 * Pure utility module (no Hardhat network calls). Produces EIP-191 wrapped
 * ECDSA certificates that round-trip against the on-chain verifier in
 * `contracts/gnus-ai/GNUSBridge.sol::bridgeIn` / `_verifyThresholdCertificate`.
 *
 * References:
 *  - CONTEXT D-08 — digest binds transferId, srcChainID, destChainID, diamond,
 *    recipient, tokenId, amount (cross-chain, cross-diamond replay protection).
 *  - CONTEXT D-10 — validators sign an EVM-compatible digest, EIP-191 wrapped.
 *  - CONTEXT D-13 — signatures must be submitted sorted strictly ascending by
 *    recovered address (duplicate-proof).
 *  - RESEARCH Pitfall 1 — do NOT manually prepend the EIP-191 prefix;
 *    `wallet.signMessage` applies it internally.
 *  - RESEARCH Pitfall 3 — merkle leaf is `keccak256(abi.encodePacked(address))`
 *    (20-byte packed encoding, NOT `abi.encode` which pads to 32 bytes).
 *
 * This file is also the reference implementation for the SuperGenius-side C++
 * `SignEVM` (see 10-RESEARCH.md §"SuperGenius-Side EVM Envelope Signer") — keep
 * it readable and side-effect free.
 */

/**
 * Fields committed into the bridge-in digest. Field ORDER and TYPES are
 * load-bearing — they must match `_bridgeInDigest` in GNUSBridge.sol:
 *
 *   structHash = keccak256(abi.encode(
 *       transferId, srcChainID, destChainID, diamondAddress,
 *       recipient, tokenId, amount
 *   ))
 */
export interface BridgeInMessage {
	/** Source-chain burn transaction hash (replay-protection key). */
	transferId: string;
	/** Chain ID the bridge-out was initiated on. */
	srcChainID: bigint;
	/** Chain ID the bridge-in is executing on (== block.chainid on the test chain). */
	destChainID: bigint;
	/** Diamond address (== address(this) on the diamond). */
	diamondAddress: string;
	/** Recipient of the minted tokens. */
	recipient: string;
	/** Token ID — always 0n for GNUS (D-14). */
	tokenId: bigint;
	/** PRE-FEE amount of tokens to bridge in. */
	amount: bigint;
}

/**
 * Computes the structHash (pre-EIP-191) for a bridge-in message.
 *
 * Must produce byte-identical output to the on-chain `keccak256(abi.encode(...))`
 * in `_bridgeInDigest`. Exported so tests can recover signer addresses off-chain
 * (via `aggregateCertificate`) using the same digest the diamond will compute.
 */
export function computeBridgeInStructHash(message: BridgeInMessage): string {
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
		['bytes32', 'uint256', 'uint256', 'address', 'address', 'uint256', 'uint256'],
		[
			message.transferId,
			message.srcChainID,
			message.destChainID,
			message.diamondAddress,
			message.recipient,
			message.tokenId,
			message.amount,
		],
	);
	return ethers.keccak256(encoded);
}

/**
 * Signs a bridge-in message with the given validator wallet.
 *
 * Returns the 65-byte EIP-191 wrapped signature `r‖s‖v` as a hex string.
 * `wallet.signMessage` applies the `"\x19Ethereum Signed Message:\n32"` prefix
 * internally — do NOT prepend it manually (RESEARCH Pitfall 1).
 */
export async function signBridgeInCertificate(
	wallet: Wallet,
	message: BridgeInMessage,
): Promise<string> {
	const structHash = computeBridgeInStructHash(message);
	return wallet.signMessage(ethers.getBytes(structHash));
}

/**
 * Recovers each signer's address from the EIP-191 wrapped structHash and
 * returns the signatures sorted strictly ascending by recovered address
 * (per CONTEXT D-13). Throws on duplicate signers — the on-chain verifier
 * would revert anyway; failing fast in the helper surfaces the bug earlier.
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

	let level: string[] = leaves.slice();
	let levelIndex: number[] = leaves.map((_, i) => i);

	while (level.length > 1) {
		const nextLevel: string[] = [];
		const nextIndex: number[] = [];
		for (let i = 0; i < level.length; i += 2) {
			if (i + 1 < level.length) {
				const a = level[i];
				const b = level[i + 1];
				const [lo, hi] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
				const parent = ethers.keccak256(ethers.concat([lo, hi]));
				// For each child, the sibling goes into the child's proof.
				proofsByIndex[levelIndex[i]].push(b);
				proofsByIndex[levelIndex[i + 1]].push(a);
				nextLevel.push(parent);
				// The parent inherits the left child's leaf index (proofsByIndex
				// for the right child has already been updated with the left sibling).
				nextIndex.push(levelIndex[i]);
			} else {
				// Odd node: promote unchanged, no proof addition.
				nextLevel.push(level[i]);
				nextIndex.push(levelIndex[i]);
			}
		}
		level = nextLevel;
		levelIndex = nextIndex;
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
