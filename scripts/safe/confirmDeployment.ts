/**
 * Confirm Safe deployment script.
 *
 * Given a Safe proposal artifact, checks whether the Safe executed the
 * diamondCut on-chain and updates the Diamond's deployed-data file with the
 * new facet addresses, selectors, transaction hash, and protocol version.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/safe/confirmDeployment.ts \
 *     --artifact diamonds/GeniusDiamond/safe-proposals/sepolia-11155111-<ts>-<hash>.json \
 *     --deployment diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155111.json
 *
 * @module scripts/safe/confirmDeployment
 */

import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import { config as dotenv } from 'dotenv';
dotenv();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SafeProposalArtifact {
	safeAddress: string;
	safeTxHash: string;
	proposerAddress: string;
	target: string;
	calldata: string;
	chainId: number;
	nonce?: number;
}

/** Shape of a single FacetDeployedInfo entry in a deployed-data file. */
interface DeployedFacetInfo {
	address?: string;
	tx_hash?: string;
	version?: number;
	verified?: boolean;
	funcSelectors?: string[];
}

/** Minimal ABI fragment for a standard EIP-2535 Diamond. */
const kIDiamondLoupeAbi = [
	'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
];

/** Safe contract nonce slot. */
const kSafeAbi = [
	'function nonce() external view returns (uint256)',
	'function getOwners() external view returns (address[])',
];

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

/** Parsed CLI options. Hand-rolled: repo's top-level commander is 2.20.3
 *  (pre-requiredOption/.opts). Supports only `--key value` form. */
interface CliOptions {
	artifact: string | undefined;
	deployment: string | undefined;
	rpcUrl: string | undefined;
	protocolVersion: string;
}

/** Parse `--key value` pairs from argv; apply defaults. */
function parseArgs(): CliOptions {
	const args = process.argv.slice(2);
	const get = (name: string): string | undefined => {
		const i = args.indexOf(name);
		return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
	};
	return {
		artifact: get('--artifact'),
		deployment: get('--deployment'),
		rpcUrl: get('--rpc-url') ?? process.env.RPC_URL,
		protocolVersion: get('--protocol-version') ?? '2.5',
	};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const opts = parseArgs();

	if (!opts.artifact) {
		console.error('❌ --artifact <path> required');
		process.exit(1);
	}
	if (!opts.deployment) {
		console.error('❌ --deployment <path> required');
		process.exit(1);
	}
	if (!opts.rpcUrl) {
		console.error('❌ RPC URL required (--rpc-url or RPC_URL env)');
		process.exit(1);
	}

	// 1. Read proposal artifact
	const proposal: SafeProposalArtifact = JSON.parse(readFileSync(opts.artifact, 'utf8'));
	const safeAddr = ethers.getAddress(proposal.safeAddress);
	const diamondAddr = ethers.getAddress(proposal.target);

	// 2. Connect to chain
	const provider = new ethers.JsonRpcProvider(opts.rpcUrl);

	// Guard: the RPC must be on the same chain the proposal artifact was built
	// for, otherwise the Safe nonce check below reads the wrong Safe.
	const network = await provider.getNetwork();
	if (Number(network.chainId) !== proposal.chainId) {
		console.error(
			`❌ Chain mismatch: RPC is on chain ${Number(network.chainId)}, ` +
				`proposal artifact is for chain ${proposal.chainId}`,
		);
		process.exit(1);
	}

	const safe = new ethers.Contract(safeAddr, kSafeAbi, provider);

	// 3. Check Safe nonce — if advanced past the proposal nonce, executed.
	//    Artifacts from writeSafeProposalArtifact do not carry nonce; when
	//    nonce is absent the Safe Transaction Service must be used instead
	//    (see checkSafeExecuted.ts / yarn check:safe-executed).
	if (proposal.nonce === undefined || proposal.nonce === null) {
		console.log(
			'⚠️  Proposal artifact missing nonce — cannot confirm via Safe nonce. ' +
				'Use check:safe-executed (Safe Transaction Service) instead.',
		);
		process.exit(0);
	}
	const currentNonce = Number(await safe.nonce());
	const proposalNonce = proposal.nonce;
	if (currentNonce <= proposalNonce) {
		console.log(
			`⏳ Safe nonce ${currentNonce} ≤ proposal nonce ${proposalNonce} — not executed yet.`,
		);
		process.exit(0);
	}
	console.log(
		`✅ Safe nonce advanced: ${proposalNonce} → ${currentNonce} — transaction executed.`,
	);

	// 4. Read current diamond state
	const diamond = new ethers.Contract(diamondAddr, kIDiamondLoupeAbi, provider);
	const facets: { facetAddress: string; functionSelectors: string[] }[] =
		await diamond.facets();

	console.log(`🔍 Diamond has ${facets.length} facets post-upgrade.`);

	// 5. Update the deployed-data file
	const deployedData = JSON.parse(readFileSync(opts.deployment, 'utf8'));

	// Determine the Safe exec transaction hash (we don't have it from the
	// proposal artifact — use the safeTxHash for tracking)
	const safeTxHash = proposal.safeTxHash;

	// Build a map of facetName → deployed info from the current state
	// Match on-chain facets to the known FacetDeployedInfo entries by address
	const currentDeployed = (deployedData.FacetDeployedInfo || {}) as Record<
		string,
		DeployedFacetInfo
	>;
	const newDeployed: Record<string, unknown> = {};

	// Track which known addresses we've matched
	const addrToName: Record<string, string> = {};
	for (const [name, info] of Object.entries(currentDeployed)) {
		const addr = info.address?.toLowerCase();
		if (addr) addrToName[addr] = name;
	}

	for (const facet of facets) {
		const addrLower = facet.facetAddress.toLowerCase();
		let name = addrToName[addrLower];

		if (!name) {
			// On-chain data carries no facet names; match by best selector
			// overlap against known FacetDeployedInfo entries. Uses majority
			// overlap (≥60%) so replaced facets with changed selectors
			// (e.g. GNUSBridge after bridgeOut signature change) still match.
			const onChainSels = new Set(
				facet.functionSelectors.map((s) => s.toLowerCase()),
			);
			let bestName: string | undefined;
			let bestOverlap = 0;
			for (const [candidateName, info] of Object.entries(currentDeployed)) {
				const existingSels = (info.funcSelectors || []).map((s: string) =>
					s.toLowerCase(),
				);
				if (existingSels.length === 0) continue;
				const overlap = existingSels.filter((s) => onChainSels.has(s)).length;
				const ratio = overlap / existingSels.length;
				if (ratio >= 0.6 && overlap > bestOverlap) {
					bestOverlap = overlap;
					bestName = candidateName;
				}
			}
			name = bestName;
		}

		if (!name) {
			console.log(`⚠️  Unrecognised facet at ${facet.facetAddress} — skipping.`);
			continue;
		}

		newDeployed[name] = {
			address: facet.facetAddress,
			tx_hash: safeTxHash,
			version: currentDeployed[name]?.version ?? 0,
			verified: false,
			funcSelectors: facet.functionSelectors,
		};
	}

	// Remove facets no longer on-chain
	for (const [name] of Object.entries(currentDeployed)) {
		const stillExists = facets.some(
			(f) => f.facetAddress.toLowerCase() === currentDeployed[name].address?.toLowerCase(),
		);
		if (!stillExists) {
			console.log(`🗑️  Removed: ${name}`);
		}
	}

	deployedData.FacetDeployedInfo = newDeployed;
	deployedData.protocolVersion = parseFloat(opts.protocolVersion);

	writeFileSync(opts.deployment, JSON.stringify(deployedData, null, 2), 'utf8');
	console.log(
		`✅ Deployed-data updated: ${Object.keys(newDeployed).length} facets, protocolVersion ${deployedData.protocolVersion}`,
	);
	console.log(`   file: ${opts.deployment}`);
}

main().catch((err) => {
	console.error('❌', err.message);
	process.exit(1);
});
