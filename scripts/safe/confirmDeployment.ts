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
import { Command } from 'commander';
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
// Decode diamondCut calldata — extract FacetCut[] argument
// ---------------------------------------------------------------------------

interface FacetCut {
    facetAddress: string;
    action: number; // 0=Add, 1=Replace, 2=Remove
    functionSelectors: string[];
}

function decodeFacetCuts(calldata: string): FacetCut[] {
    // diamondCut((address,uint8,bytes4[])[], address, bytes)
    // Layout (after 4-byte selector):
    //   offset-of-array (32)  — always 0x60 for the first dynamic arg
    //   init-address (32)
    //   offset-of-init-calldata (32)
    //   array-length (32)
    //   then for each element: facetAddress(32), action(32), offset-to-selectors-array(32)
    //   then each selector array: length(32), selector(32)...
    const data = calldata.slice(10); // strip 0x + 4-byte selector
    const readWord = (offset: number): string => data.slice(offset * 2, (offset + 32) * 2);

    const arrayOffset = parseInt(readWord(0), 16) / 32; // should be 3 (0x60)
    const arrayLen = parseInt(readWord(arrayOffset), 16);

    const cuts: FacetCut[] = [];
    let cursor = arrayOffset + 1;
    const selectorOffsets: number[] = [];

    for (let i = 0; i < arrayLen; i++) {
        const facetAddress = '0x' + readWord(cursor).slice(24);
        const action = parseInt(readWord(cursor + 1).slice(62), 16);
        const selOffset = parseInt(readWord(cursor + 2), 16) / 32;
        selectorOffsets.push(selOffset);
        cuts.push({ facetAddress, action, functionSelectors: [] });
        cursor += 3;
    }

    for (let i = 0; i < arrayLen; i++) {
        const selLen = parseInt(readWord(selectorOffsets[i]), 16);
        for (let j = 0; j < selLen; j++) {
            cuts[i].functionSelectors.push('0x' + readWord(selectorOffsets[i] + 1 + j).slice(0, 8));
        }
    }

    return cuts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const program = new Command();
    program
        .requiredOption('--artifact <path>', 'Safe proposal artifact JSON')
        .requiredOption('--deployment <path>', 'Diamond deployed-data JSON to update')
        .option('--rpc-url <url>', 'RPC endpoint', process.env.RPC_URL)
        .option('--protocol-version <version>', 'Protocol version to set', '2.5')
        .parse(process.argv);

    const opts = program.opts();

    if (!opts.rpcUrl) {
        console.error('❌ RPC URL required (--rpc-url or RPC_URL env)');
        process.exit(1);
    }

    // 1. Read proposal artifact
    const proposal: SafeProposalArtifact = JSON.parse(
        readFileSync(opts.artifact, 'utf8'),
    );
    const safeAddr = ethers.getAddress(proposal.safeAddress);
    const diamondAddr = ethers.getAddress(proposal.target);

    // 2. Connect to chain
    const provider = new ethers.JsonRpcProvider(opts.rpcUrl);
    const safe = new ethers.Contract(safeAddr, kSafeAbi, provider);

    // 3. Check Safe nonce — if advanced past the proposal nonce, executed
    const currentNonce = Number(await safe.nonce());
    const proposalNonce = proposal.nonce ?? currentNonce;
    if (currentNonce <= proposalNonce) {
        console.log(`⏳ Safe nonce ${currentNonce} ≤ proposal nonce ${proposalNonce} — not executed yet.`);
        process.exit(0);
    }
    console.log(`✅ Safe nonce advanced: ${proposalNonce} → ${currentNonce} — transaction executed.`);

    // 4. Read current diamond state
    const diamond = new ethers.Contract(diamondAddr, kIDiamondLoupeAbi, provider);
    const facets: { facetAddress: string; functionSelectors: string[] }[] = await diamond.facets();

    console.log(`🔍 Diamond has ${facets.length} facets post-upgrade.`);

    // 5. Decode the calldata for the diamondCut tx hash
    const cuts = decodeFacetCuts(proposal.calldata);
    console.log(`🔍 Decoded ${cuts.length} FacetCuts from the proposal calldata.`);

    // 6. Update the deployed-data file
    const deployedData = JSON.parse(readFileSync(opts.deployment, 'utf8'));

    // Determine the Safe exec transaction hash (we don't have it from the
    // proposal artifact — use the safeTxHash for tracking)
    const safeTxHash = proposal.safeTxHash;

    // Build a map of facetName → deployed info from the current state
    // Match on-chain facets to the known FacetDeployedInfo entries by address
    const currentDeployed = deployedData.FacetDeployedInfo || {};
    const newDeployed: Record<string, unknown> = {};

    // Track which known addresses we've matched
    const addrToName: Record<string, string> = {};
    for (const [name, info] of Object.entries(currentDeployed)) {
        const addr = (info as any).address?.toLowerCase();
        if (addr) addrToName[addr] = name;
    }

    // Also track from FacetCuts which facets were Added/Replaced
    const cutAddrToAction: Record<string, { action: number; selectors: string[] }> = {};
    for (const cut of cuts) {
        const addrLower = cut.facetAddress.toLowerCase();
        if (cut.action !== 2) {
            // aggregate selectors for this facet address
            if (!cutAddrToAction[addrLower]) {
                cutAddrToAction[addrLower] = { action: cut.action, selectors: [] };
            }
            cutAddrToAction[addrLower].selectors.push(...cut.functionSelectors);
        }
    }

    for (const facet of facets) {
        const addrLower = facet.facetAddress.toLowerCase();
        let name = addrToName[addrLower];

        if (!name) {
            // New facet — try to find name from FacetCuts
            // We don't have facet names in the on-chain data, so fall back to
            // a key derived from the cut or use "UnknownFacet_<address>"
            const cutInfo = cutAddrToAction[addrLower];
            // Try matching by selector overlap to known FacetDeployedInfo entries
            const selectorStr = facet.functionSelectors.map(s => s.toLowerCase()).sort().join(',');
            for (const [candidateName, info] of Object.entries(currentDeployed)) {
                const existingSels = (info as any).funcSelectors?.map((s: string) => s.toLowerCase()).sort().join(',');
                if (existingSels && existingSels === selectorStr) {
                    name = candidateName;
                    break;
                }
            }
        }

        if (!name) {
            console.log(`⚠️  Unrecognised facet at ${facet.facetAddress} — skipping.`);
            continue;
        }

        newDeployed[name] = {
            address: facet.facetAddress,
            tx_hash: safeTxHash,
            version: (currentDeployed[name] as any)?.version ?? 0,
            verified: false,
            funcSelectors: facet.functionSelectors,
        };
    }

    // Remove facets no longer on-chain
    for (const [name] of Object.entries(currentDeployed)) {
        const stillExists = facets.some(
            f => f.facetAddress.toLowerCase() === (currentDeployed[name] as any).address?.toLowerCase(),
        );
        if (!stillExists) {
            console.log(`🗑️  Removed: ${name}`);
        }
    }

    deployedData.FacetDeployedInfo = newDeployed;
    deployedData.protocolVersion = parseFloat(opts.protocolVersion);

    writeFileSync(opts.deployment, JSON.stringify(deployedData, null, 2), 'utf8');
    console.log(`✅ Deployed-data updated: ${Object.keys(newDeployed).length} facets, protocolVersion ${deployedData.protocolVersion}`);
    console.log(`   file: ${opts.deployment}`);
}

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
