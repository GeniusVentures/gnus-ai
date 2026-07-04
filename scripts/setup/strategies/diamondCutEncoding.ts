/**
 * Shared diamondCut encoding helper.
 *
 * Extracts the "encode the diamondCut calldata" logic that both the Safe
 * proposer strategy and the encode-only dry-run strategy need, so the two
 * strategies share one source of truth for:
 *   - resolving the IDiamondCut ABI (Hardhat artifact, with a local fallback),
 *   - gathering init calldata + facet cuts,
 *   - validating that no selectors would be orphaned,
 *   - building the FacetCut[] argument and ABI-encoding the call.
 *
 * The function is pure with respect to side effects on chain: it performs NO
 * transactions and sends NO proposals. Each caller decides what to do with the
 * returned calldata (propose to Safe, write an artifact, etc.).
 *
 * @module scripts/setup/strategies/diamondCutEncoding
 */

import { RPCDeploymentStrategy, Diamond, getContractArtifact } from '@diamondslab/diamonds';
import type { FacetCuts } from '@diamondslab/diamonds';
import { ethers } from 'ethers';
import chalk from 'chalk';

// ---------------------------------------------------------------------------
// ABI fragment for diamondCut — used as a local fallback since IDiamondCut
// resolution via getContractArtifact relies on Hardhat artifact paths that may
// not be available in all deployment environments.
// ---------------------------------------------------------------------------

const kIDiamondCutAbi: ethers.InterfaceAbi = [
	{
		inputs: [
			{
				components: [
					{ internalType: 'address', name: 'facetAddress', type: 'address' },
					{
						internalType: 'enum IDiamondCut.FacetCutAction',
						name: 'action',
						type: 'uint8',
					},
					{ internalType: 'bytes4[]', name: 'functionSelectors', type: 'bytes4[]' },
				],
				internalType: 'struct IDiamondCut.FacetCut[]',
				name: '_diamondCut',
				type: 'tuple[]',
			},
			{ internalType: 'address', name: '_init', type: 'address' },
			{ internalType: 'bytes', name: '_calldata', type: 'bytes' },
		],
		name: 'diamondCut',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The result of encoding a diamondCut: everything a caller needs to propose,
 * persist, or dry-run the cut. `facetCuts` is returned so callers can implement
 * their own empty-cut short-circuit without re-deriving the cuts.
 */
export interface EncodedDiamondCut {
	/** Target Diamond proxy address the cut is encoded against. */
	diamondAddress: string;
	/** Full ABI-encoded diamondCut calldata (0x-prefixed hex). */
	calldata: string;
	/** The FacetCut[] that was encoded (may be empty for a no-op). */
	facetCuts: FacetCuts;
	/** Init contract address passed as the second diamondCut argument. */
	initAddress: string;
	/** Init calldata passed as the third diamondCut argument. */
	initCalldata: string;
}

// ---------------------------------------------------------------------------
// Encoding helper
// ---------------------------------------------------------------------------

/**
 * Encodes a diamondCut calldata for the given diamond, using the supplied
 * strategy to gather init calldata and facet cuts. Performs no on-chain action.
 *
 * Steps:
 *   1. Read the deployed DiamondAddress (throws if absent).
 *   2. Resolve the IDiamondCut ABI via the Hardhat artifact, falling back to a
 *      local ABI fragment when the artifact is unavailable.
 *   3. Gather init calldata + facet cuts via the strategy's public methods and
 *      validate no selectors would be orphaned.
 *   4. Build the FacetCut[] argument.
 *   5. ABI-encode the diamondCut call.
 *
 * @param strategy - The deployment strategy providing getInitCalldata /
 *   getFacetCuts / validateNoOrphanedSelectors (e.g. a Safe proposer or
 *   encode-only strategy instance).
 * @param diamond - The Diamond being upgraded.
 * @param verbose - When true, log the IDiamondCut artifact fallback reason.
 * @returns The encoded cut plus the inputs used to produce it.
 */
export async function encodeDiamondCutCalldata(
	strategy: RPCDeploymentStrategy,
	diamond: Diamond,
	verbose?: boolean,
): Promise<EncodedDiamondCut> {
	// -- 1. Get diamond metadata ----------------------------------------
	const deployedDiamondData = diamond.getDeployedDiamondData();
	const diamondAddress = deployedDiamondData.DiamondAddress;
	if (!diamondAddress) {
		throw new Error('Cannot encode diamondCut: the diamond has no deployed DiamondAddress');
	}

	// -- 2. Resolve IDiamondCut artifact -------------------------------
	let diamondCutAbi = kIDiamondCutAbi;
	try {
		const diamondCutArtifact = await getContractArtifact('IDiamondCut', diamond);
		diamondCutAbi = diamondCutArtifact.abi;
	} catch (error) {
		// Fall through — use the local ABI fragment. Bind the error so verbose
		// mode can distinguish "Hardhat not available" (expected) from "artifact
		// file corrupted" (actionable).
		if (verbose) {
			console.log(
				chalk.gray(
					`ℹ️  IDiamondCut artifact not resolved via Hardhat (${(error as Error).message}); using local ABI fragment.`,
				),
			);
		}
	}

	// Encoding only needs the Interface — no signer or contract instance is
	// required, which keeps this helper side-effect-free on chain.
	const diamondCutInterface = new ethers.Interface(diamondCutAbi);

	// -- 3. Gather init calldata and facet cuts ------------------------
	const [initCalldata, initAddress] = await strategy.getInitCalldata(diamond);
	const facetCuts: FacetCuts = await strategy.getFacetCuts(diamond);

	// Validate no orphaned selectors before proceeding.
	await strategy.validateNoOrphanedSelectors(facetCuts);

	// -- 4. Build the FacetCut[] argument ------------------------------
	const facetSelectorCutMap = facetCuts.map((fc) => ({
		facetAddress: fc.facetAddress,
		action: fc.action,
		functionSelectors: fc.functionSelectors,
	}));

	// -- 5. Encode the diamondCut calldata -----------------------------
	const calldata = diamondCutInterface.encodeFunctionData('diamondCut', [
		facetSelectorCutMap,
		initAddress,
		initCalldata,
	]);

	return { diamondAddress, calldata, facetCuts, initAddress, initCalldata };
}
