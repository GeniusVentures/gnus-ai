/**
 * EncodeOnlyRPCDeploymentStrategy
 *
 * Subclass of RPCDeploymentStrategy for the local manual dry-run workflow.
 * It runs the normal upgrade lifecycle — including deploying any new/updated
 * facets via RPC — but intercepts the diamondCut step to ENCODE the cut and
 * write it to a local artifact instead of executing or proposing it.
 *
 * Intended use: point the pipeline at a shared `anvil --fork-url` node, run
 * `upgrade ... --encode-only`, then feed the written artifact into a forge fork
 * test that Safe-executes the cut and asserts the post-upgrade state. This
 * keeps the TypeScript pipeline the single source of truth for the encoded cut
 * while letting forge verify execution off the live network.
 *
 * The canonical deployed-data file is NOT updated and no transaction is sent for
 * the cut itself (facet deployment still happens, since the encoded cut embeds
 * the real facet addresses).
 *
 * @module scripts/setup/strategies/EncodeOnlyRPCDeploymentStrategy
 */

import { RPCDeploymentStrategy, Diamond, type FacetCuts } from '@diamondslab/diamonds';
import chalk from 'chalk';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

import { encodeDiamondCutCalldata, type EncodedDiamondCut } from './diamondCutEncoding';

// ---------------------------------------------------------------------------
// Configuration interface
// ---------------------------------------------------------------------------

export interface EncodeOnlyStrategyConfig {
	rpcUrl: string;
	privateKey: string;
	chainId: number;
	gasLimitMultiplier?: number;
	maxRetries?: number;
	retryDelayMs?: number;
	verbose?: boolean;
	diamondName: string;
	networkName: string;
}

// ---------------------------------------------------------------------------
// Strategy class
// ---------------------------------------------------------------------------

export class EncodeOnlyRPCDeploymentStrategy extends RPCDeploymentStrategy {
	private readonly diamondName: string;
	private readonly networkName: string;
	private readonly chainId: number;

	/**
	 * Creates a new EncodeOnlyRPCDeploymentStrategy.
	 *
	 * @param config - All fields required for the strategy.
	 */
	constructor(config: EncodeOnlyStrategyConfig) {
		super(
			config.rpcUrl,
			config.privateKey,
			config.gasLimitMultiplier ?? 1.2,
			config.maxRetries ?? 3,
			config.retryDelayMs ?? 2000,
			config.verbose ?? false,
		);

		this.diamondName = config.diamondName;
		this.networkName = config.networkName;
		this.chainId = config.chainId;
	}

	// -----------------------------------------------------------------------
	// Override: validateNoOrphanedSelectors — permit Remove+Replace mix
	// -----------------------------------------------------------------------

	/**
	 * Overrides the library's orphaned-selector validation to permit Remove
	 * cuts that share a facetName with Replace/Add cuts. The library's default
	 * check flags a Remove cut as orphaned when its facetName has other cuts at
	 * a different address, but EIP-2535 allows removing some selectors while
	 * replacing the facet address for others in a single diamondCut — this
	 * happens when a new facet version drops a function selector (e.g.
	 * GNUSBridge v2.5 drops 0xe26d65a6).
	 */
	async validateNoOrphanedSelectors(facetCuts: FacetCuts): Promise<void> {
		const kFacetCutActionRemove = 2; // IDiamondCut.FacetCutAction.Remove
		const nonRemoveCuts = facetCuts.filter((fc) => fc.action !== kFacetCutActionRemove);
		return super.validateNoOrphanedSelectors(nonRemoveCuts);
	}

	// -----------------------------------------------------------------------
	// Override: performDiamondCutTasks — encode + artifact, no execution
	// -----------------------------------------------------------------------

	/**
	 * Overrides the parent performDiamondCutTasks to encode the diamondCut
	 * calldata and write it to a local artifact instead of sending or proposing
	 * it. The canonical deployed-data file is NOT updated — the artifact is the
	 * source of truth for the dry run.
	 */
	protected async performDiamondCutTasks(diamond: Diamond): Promise<void> {
		// -- 1. Encode the diamondCut calldata (shared helper) -------------
		const encoded = await encodeDiamondCutCalldata(this, diamond, this.verbose);

		// Short-circuit on empty facet cuts — there is nothing to encode or
		// verify, so writing an artifact would be misleading.
		if (encoded.facetCuts.length === 0) {
			console.log(chalk.yellow('⏩ No DiamondCut operations needed — nothing to encode.'));
			return;
		}

		// -- 2. Write the calldata artifact --------------------------------
		const artifactPath = this.writeCalldataArtifact(encoded);

		// -- 3. Log the success block --------------------------------------
		const selectorCount = encoded.facetCuts.reduce(
			(sum, fc) => sum + fc.functionSelectors.length,
			0,
		);
		console.log(chalk.greenBright('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
		console.log(chalk.greenBright('  ✅ DiamondCut Encoded (encode-only dry run)'));
		console.log(chalk.greenBright('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
		console.log(chalk.bold(`  💎 Diamond:   `) + chalk.white(this.diamondName));
		console.log(
			chalk.bold(`  🌐 Network:   `) +
				chalk.white(`${this.networkName} (Chain ID: ${this.chainId})`),
		);
		console.log(chalk.bold(`  🎯 Target:    `) + chalk.white(encoded.diamondAddress));
		console.log(
			chalk.bold(`  🧱 FacetCuts: `) + chalk.white(`${encoded.facetCuts.length}`),
		);
		console.log(chalk.bold(`  🎯 Selectors: `) + chalk.white(`${selectorCount}`));
		console.log(
			chalk.bold(`  📦 Init:       `) +
				chalk.white(
					`${encoded.initAddress} (${encoded.initCalldata.length <= 2 ? 'no calldata' : `${encoded.initCalldata.length} chars hex`})`,
				),
		);
		console.log(chalk.bold(`  🔣 Selector:  `) + chalk.cyan(encoded.calldata.slice(0, 10)));
		console.log(chalk.gray(`  📄 Artifact:  ${artifactPath}`));
		console.log(chalk.greenBright('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
		console.log(
			chalk.gray(
				'   Encoded calldata written to artifact. The diamondCut has NOT been proposed or executed.',
			),
		);
		console.log(
			chalk.gray(
				'   Feed this artifact to the forge fork harness to Safe-execute and verify the upgrade.',
			),
		);
		console.log('');

		// -- DELIBERATELY EXCLUDED: -----------------------------------------
		// - proposeSafeTransaction / Safe Transaction Service
		//   Encode-only is a local dry run — no proposal is submitted.
		//
		// - postDiamondCutDeployedDataUpdate(diamond, txHash)
		//   The cut has NOT executed — the canonical deployment state must NOT
		//   be marked as complete.
		//
		// - executeInitializerFunctions(diamond)
		//   These run AFTER the diamondCut is mined. In encode-only mode the cut
		//   is never sent, so they cannot run here.
	}

	// -----------------------------------------------------------------------
	// Artifact writer
	// -----------------------------------------------------------------------

	/**
	 * Writes the encoded diamondCut to a JSON artifact consumable by the forge
	 * fork harness.
	 *
	 * Path pattern:
	 *   diamonds/<diamondName>/encoded-cuts/<networkName>-<chainId>-<timestamp>.json
	 *
	 * @param encoded - The encoded diamondCut result.
	 * @returns The absolute path to the written JSON file.
	 */
	private writeCalldataArtifact(encoded: EncodedDiamondCut): string {
		const artifact = {
			diamondName: this.diamondName,
			networkName: this.networkName,
			chainId: this.chainId,
			diamondAddress: encoded.diamondAddress,
			calldata: encoded.calldata,
			calldataSelector: encoded.calldata.slice(0, 10),
			initAddress: encoded.initAddress,
			initCalldata: encoded.initCalldata,
			// Strip the library-only `name` field so the artifact's facetCuts stay
			// flat (facetAddress/action/functionSelectors).
			facetCuts: encoded.facetCuts.map((fc) => ({
				facetAddress: fc.facetAddress,
				action: fc.action,
				functionSelectors: fc.functionSelectors,
			})),
			// Flat parallel arrays for the forge harness: forge 1.7.1's JSON codec
			// cannot decode an array of structs that nest a dynamic array, so the
			// Solidity side reads these primitive arrays via vm.parseJsonAddressArray
			// / vm.parseJsonUintArray instead. Indices align 1:1 with facetCuts.
			facetAddresses: encoded.facetCuts.map((fc) => fc.facetAddress),
			facetSelectorCounts: encoded.facetCuts.map((fc) => fc.functionSelectors.length),
			note: 'encode-only dry run — diamondCut encoded but NOT proposed or executed',
		};

		const outputPath = join(
			process.cwd(),
			'diamonds',
			this.diamondName,
			'encoded-cuts',
			`${this.networkName}-${this.chainId}-${Date.now()}.json`,
		);

		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');

		return outputPath;
	}
}
