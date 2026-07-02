/**
 * Verify deployed facets on Etherscan.
 *
 * Reads a diamond deployed-data JSON file, finds facets marked
 * `verified: false`, and submits each one to Etherscan via
 * `forge verify-contract` (V2 API).
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/verify/verifyFacets.ts \
 *     --deployment diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155111.json \
 *     --chain-id 11155111
 *
 * Requires: ETHERSCAN_API_KEY in .env, solc 0.8.19 available.
 *
 * @module scripts/verify/verifyFacets
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { config as dotenv } from 'dotenv';
import { Command } from 'commander';
dotenv();

// ---------------------------------------------------------------------------
// Contract-path resolver
// ---------------------------------------------------------------------------

/** Map a facet name to a forge-compatible contract path. */
function resolveContractPath(facetName: string): string | null {
    // Primary: contracts/gnus-ai/<Name>.sol:<Name>
    const primary = `contracts/gnus-ai/${facetName}.sol:${facetName}`;
    if (existsSync(primary)) return primary;

    // contracts-starter fallback (external diamond base facets)
    const starter = `contracts-starter/contracts/facets/${facetName}.sol:${facetName}`;
    if (existsSync(starter)) return starter;

    return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const program = new Command();
    program
        .requiredOption('--deployment <path>', 'Diamond deployed-data JSON')
        .requiredOption('--chain-id <id>', 'Chain ID (e.g. 11155111)')
        .option('--compiler-version <ver>', 'Solidity compiler version', '0.8.19')
        .parse(process.argv);

    const opts = program.opts();
    const etherscanKey = process.env.ETHERSCAN_API_KEY;
    if (!etherscanKey) {
        console.error('❌ ETHERSCAN_API_KEY env required');
        process.exit(1);
    }

    // 1. Read deployed data
    const data = JSON.parse(readFileSync(opts.deployment, 'utf8'));
    const facets = data.FacetDeployedInfo || {};

    // 2. Find unverified facets
    const unverified = Object.entries(facets)
        .filter(([, info]: [string, any]) => info.verified !== true)
        .map(([name, info]: [string, any]) => ({ name, address: info.address }));

    if (unverified.length === 0) {
        console.log('✅ All facets already verified.');
        process.exit(0);
    }

    console.log(`🔍 ${unverified.length} unverified facet(s):`);
    for (const f of unverified) {
        console.log(`   ${f.name} @ ${f.address}`);
    }

    // 3. Verify each
    let updated = 0;
    for (const { name, address } of unverified) {
        const contractPath = resolveContractPath(name);
        if (!contractPath) {
            console.log(`⚠️  ${name}: no contract file found — skipping`);
            continue;
        }

        console.log(`\n📝 Verifying ${name} (${contractPath}) @ ${address}...`);
        try {
            const cmd = [
                'forge', 'verify-contract',
                '--chain-id', opts.chainId,
                '--etherscan-api-key', etherscanKey,
                '--compiler-version', opts.compilerVersion,
                address,
                contractPath,
            ].join(' ');
            const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
            console.log(output.trim().split('\n').pop());

            // Mark verified
            facets[name].verified = true;
            updated++;
        } catch (err: any) {
            const stderr = err.stderr || err.message || '';
            if (stderr.includes('Already Verified') || stderr.includes('already verified')) {
                console.log('   ℹ️  Already verified on Etherscan');
                facets[name].verified = true;
                updated++;
            } else {
                console.log(`   ❌ Verification failed: ${stderr.slice(0, 200)}`);
            }
        }
    }

    // 4. Write back
    if (updated > 0) {
        writeFileSync(opts.deployment, JSON.stringify(data, null, 2), 'utf8');
        console.log(`\n✅ ${updated}/${unverified.length} facets verified. Deployed-data updated.`);
    } else {
        console.log('\n⚠️  0 facets verified.');
    }
}

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
