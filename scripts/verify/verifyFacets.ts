/**
 * Verify deployed facets on Etherscan (V2) via the hardhat-verify plugin.
 *
 * Reads a diamond deployed-data JSON, finds facets where `verified !== true`,
 * and submits each to Etherscan through `hre.run("verify:verify", ...)`. This
 * restores the per-facet verify loop the repo used to have (commit 8d63437,
 * `scripts/VerifyContracts.ts`) using the standard hardhat-verify plugin — no
 * forge dependency.
 *
 * Must run under hardhat so `verify:verify` uses the selected network's
 * etherscan config (apiKey + apiURL from hardhat.config.ts):
 *
 *   npx hardhat run scripts/verify/verifyFacets.ts --network sepolia
 *
 * Override the deployed-data file with DEPLOYMENT_DATA=<path>; otherwise it
 * defaults to diamonds/GeniusDiamond/deployments/geniusdiamond-<network>-<chainId>.json.
 *
 * Requires: ETHERSCAN_API_KEY in .env (Etherscan V2 key), already wired into
 * hardhat.config.ts `etherscan.apiKey`.
 *
 * @module scripts/verify/verifyFacets
 */

import hre from 'hardhat';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { config as dotenv } from 'dotenv';
dotenv();

// ---------------------------------------------------------------------------
// Source resolver
// ---------------------------------------------------------------------------

/** Directory holding project-owned facet sources. */
const kContractsDir = 'contracts/gnus-ai';

/** Shape of a single FacetDeployedInfo entry in a deployed-data file. */
interface FacetDeployedInfo {
	address: string;
	verified?: boolean;
	tx_hash?: string;
	version?: number;
	funcSelectors?: string[];
}

/**
 * Fully-qualified hardhat contract name for a facet, or null if its source is
 * not found. The ':Name' suffix is hardhat/Foundry source-unit syntax and is
 * only meaningful as the returned reference — it must NOT be passed to
 * existsSync (a colon-form string is never a real file).
 */
function resolveFullyQualifiedName(facetName: string): string | null {
	const sourceFile = `${kContractsDir}/${facetName}.sol`;
	return existsSync(sourceFile) ? `${sourceFile}:${facetName}` : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const networkName = hre.network.name;
	// Canonical deployed-data filename — must match the deployer's
	// `${diamondName}-${networkName}-${chainId}.json` convention
	// (scripts/setup/RPCDiamondDeployer.ts). The diamond name is fixed to
	// GeniusDiamond, matching the hardcoded diamonds/GeniusDiamond path below.
	const chainId = hre.network.config.chainId;
	const deploymentPath =
		process.env.DEPLOYMENT_DATA ||
		`diamonds/GeniusDiamond/deployments/geniusdiamond-${networkName}-${chainId}.json`;

	// 1. Read deployed data
	const data = JSON.parse(readFileSync(deploymentPath, 'utf8'));
	const facets = (data.FacetDeployedInfo || {}) as Record<string, FacetDeployedInfo>;

	// 2. Find unverified facets
	const unverified = Object.entries(facets)
		.filter(([, info]) => info.verified !== true)
		.map(([name, info]) => ({ name, address: info.address }));

	if (unverified.length === 0) {
		console.log('✅ All facets already verified.');
		return;
	}

	console.log(`🔍 [${networkName}] ${unverified.length} unverified facet(s):`);
	for (const f of unverified) {
		console.log(`   ${f.name} @ ${f.address}`);
	}

	// 3. Verify each via the hardhat-verify plugin
	let updated = 0;
	for (const { name, address } of unverified) {
		const contract = resolveFullyQualifiedName(name);
		if (!contract) {
			console.log(`⚠️  ${name}: no source at ${kContractsDir}/${name}.sol — skipping`);
			continue;
		}

		console.log(`\n📝 Verifying ${name} (${contract}) @ ${address}...`);
		try {
			// Facets in this project have no constructors (verified), so
			// constructorArguments is empty. Passing `contract` (FQN) forces
			// source detection so diamond facets that share storage patterns
			// are not mis-attributed.
			await hre.run('verify:verify', {
				address,
				contract,
				constructorArguments: [],
			});
			facets[name].verified = true;
			updated++;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('Already Verified') || msg.includes('already verified')) {
				console.log('   ℹ️  Already verified on Etherscan');
				facets[name].verified = true;
				updated++;
			} else {
				console.log(`   ❌ Verification failed: ${msg.slice(0, 200)}`);
			}
		}
	}

	// 4. Write back
	if (updated > 0) {
		writeFileSync(deploymentPath, JSON.stringify(data, null, 2), 'utf8');
		console.log(
			`\n✅ ${updated}/${unverified.length} facets verified. Deployed-data updated.`,
		);
	} else {
		console.log('\n⚠️  0 facets verified.');
	}
}

main().catch((err) => {
	console.error('❌', err.message);
	process.exit(1);
});
