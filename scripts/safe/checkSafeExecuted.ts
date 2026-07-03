/**
 * Check whether a Safe-proposed diamond upgrade has been executed on-chain.
 *
 * Polls the Safe Transaction Service for the proposal's safeTxHash. When the
 * Safe has executed the transaction, records the real on-chain execution
 * tx_hash in the diamond deployed-data file and clears any `pending` marker.
 * When the Safe has NOT executed within the wait window, stamps a coarse
 * top-level `pending: true` + `pendingSafeTxHash` on the deployed-data file so
 * the in-flight upgrade is self-documenting, and exits with code 2.
 *
 * This is the coarse (non-patch) confirmation path: it does NOT read the
 * diamond loupe or rebuild FacetDeployedInfo. The deployed-data file is the
 * source of truth for the upgrade; this command only confirms execution and
 * records the exec tx hash.
 *
 * Usage:
 *   yarn check:safe-executed -- \
 *     --artifact diamonds/GeniusDiamond/safe-proposals/sepolia-11155111-<ts>-<hash>.json \
 *     --deployment diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155111.json
 *   # or directly:
 *   npx ts-node --transpile-only scripts/safe/checkSafeExecuted.ts \
 *     --artifact <path> --deployment <path> [--time-out 300] [--poll-interval 15] [--rpc-url $RPC_URL]
 *
 * --time-out 0  => single check, no wait loop.
 *
 * Exit codes:
 *   0 = executed; deployed-data updated with on-chain tx hash.
 *   2 = not executed within timeout; deployed-data stamped pending.
 *   1 = error (bad inputs, chain mismatch, or executed-but-reverted).
 *
 * @module scripts/safe/checkSafeExecuted
 */

import SafeApiKit from '@safe-global/api-kit';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import { config as dotenv } from 'dotenv';
dotenv();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default wait window before declaring the proposal not-yet-executed. */
const kDefaultTimeoutSeconds = 300; // 5 minutes
/** Default seconds between Safe Transaction Service polls. */
const kDefaultPollSeconds = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve after `seconds` (operational polling pause, not test code). */
function sleep(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/** Parsed CLI options. Hand-rolled because the repo's top-level commander is */
/*  2.20.3 (pre-requiredOption/.opts). Supports only `--key value` form.    */
interface CliOptions {
	artifact: string | undefined;
	deployment: string | undefined;
	rpcUrl: string | undefined;
	timeOut: string;
	pollInterval: string;
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
		timeOut: get('--time-out') ?? String(kDefaultTimeoutSeconds),
		pollInterval: get('--poll-interval') ?? String(kDefaultPollSeconds),
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

	const timeOutSec = Number(opts.timeOut);
	const pollSec = Number(opts.pollInterval);
	if (!Number.isFinite(timeOutSec) || timeOutSec < 0) {
		console.error(`❌ Invalid --time-out: ${opts.timeOut}`);
		process.exit(1);
	}
	if (!Number.isFinite(pollSec) || pollSec <= 0) {
		console.error(`❌ Invalid --poll-interval: ${opts.pollInterval}`);
		process.exit(1);
	}

	// 1. Read proposal artifact
	const proposal = JSON.parse(readFileSync(opts.artifact, 'utf8'));
	const safeTxHash: string | undefined = proposal.safeTxHash;
	const chainId: number | undefined = proposal.chainId;
	if (!safeTxHash || chainId === undefined) {
		console.error('❌ Artifact missing safeTxHash or chainId');
		process.exit(1);
	}

	// 2. Chain-id guard — the RPC must match the chain the proposal was built
	// for, otherwise the Safe Transaction Service query targets the wrong chain.
	const provider = new ethers.JsonRpcProvider(opts.rpcUrl);
	const network = await provider.getNetwork();
	if (Number(network.chainId) !== chainId) {
		console.error(
			`❌ Chain mismatch: RPC is on chain ${Number(network.chainId)}, ` +
				`proposal artifact is for chain ${chainId}`,
		);
		process.exit(1);
	}

	// 3. Safe Transaction Service client (conditional spread mirrors
	// proposeSafeTransaction.ts). SafeApiKitConfig.chainId is bigint; the
	// artifact stores chainId as a JSON number, so wrap it.
	const apiKit = new SafeApiKit({
		chainId: BigInt(chainId),
		...(process.env.SAFE_TX_SERVICE_URL
			? { txServiceUrl: process.env.SAFE_TX_SERVICE_URL }
			: {}),
		...(process.env.SAFE_API_KEY ? { apiKey: process.env.SAFE_API_KEY } : {}),
	});

	// 4. Poll loop. deadline of 0 with timeOutSec 0 means a single check.
	const deadline = timeOutSec === 0 ? 0 : Date.now() + timeOutSec * 1000;
	for (;;) {
		// getTransaction returns null until the service has indexed the proposal.
		const tx = await apiKit.getTransaction(safeTxHash);

		if (tx && tx.isExecuted && tx.transactionHash) {
			if (tx.isSuccessful === false) {
				// Executed on-chain but reverted — terminal failure, not pending.
				console.error(
					`❌ Safe transaction executed but reverted (tx ${tx.transactionHash}).`,
				);
				process.exit(1);
			}
			// Executed successfully — record the real on-chain tx hash.
			const data = JSON.parse(readFileSync(opts.deployment, 'utf8'));
			data.lastExecTxHash = tx.transactionHash;
			delete data.pending;
			delete data.pendingSafeTxHash;
			writeFileSync(opts.deployment, JSON.stringify(data, null, 2), 'utf8');
			console.log(`✅ Executed. on-chain tx_hash: ${tx.transactionHash}`);
			console.log(`   nonce: ${tx.nonce}, executor: ${tx.executor ?? 'unknown'}`);
			console.log(`   file: ${opts.deployment}`);
			process.exit(0);
		}

		// Not executed (or not yet indexed).
		if (timeOutSec === 0 || Date.now() >= deadline) {
			const data = JSON.parse(readFileSync(opts.deployment, 'utf8'));
			data.pending = true;
			data.pendingSafeTxHash = safeTxHash;
			writeFileSync(opts.deployment, JSON.stringify(data, null, 2), 'utf8');
			const waited = timeOutSec === 0 ? 'single check' : `${timeOutSec}s`;
			console.log(`⏳ Not executed (${waited}). Stamped pending on ${opts.deployment}.`);
			process.exit(2);
		}

		console.log(`⏳ Not executed yet (nonce ${tx?.nonce ?? '?'}). Waiting ${pollSec}s...`);
		await sleep(pollSec);
	}
}

main().catch((err) => {
	console.error('❌', err.message);
	process.exit(1);
});
