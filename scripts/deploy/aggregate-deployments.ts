#!/usr/bin/env npx ts-node
/**
 * Aggregate per-network deployment files into deployments.json.
 *
 * Reads geniusdiamond-<network>-<chainId>.json from the deployments directory
 * and produces a single deployments.json keyed by network name with chainId
 * embedded per network. Skips local Hardhat forks (chainId 31337) unless
 * --include-dev is passed.
 *
 * Usage:
 *   npx ts-node scripts/deploy/aggregate-deployments.ts [--include-dev]
 *
 * @module scripts/deploy/aggregate-deployments
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const kDeploymentsDir = join(__dirname, '..', '..', 'diamonds', 'GeniusDiamond', 'deployments');
const kOutputFile = join(kDeploymentsDir, 'deployments.json');
const kLocalDevChainId = 31337;
const kFilenamePattern = /^geniusdiamond-(.+)-(\d+)\.json$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeployedFacetInfo {
    address?: string;
    tx_hash?: string;
    version?: number;
    verified?: boolean;
    funcSelectors?: string[];
}

interface DeployedNetworkData {
    chainId: number;
    DiamondAddress?: string;
    DeployerAddress?: string;
    FacetDeployedInfo?: Record<string, DeployedFacetInfo>;
    ExternalLibraries?: Record<string, string>;
    protocolVersion?: number;
    lastExecTxHash?: string;
}

interface DeploymentsAggregate {
    [networkName: string]: DeployedNetworkData;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
    const includeDev = process.argv.includes('--include-dev');

    const files = readdirSync(kDeploymentsDir).filter((f) => kFilenamePattern.test(f));
    const aggregate: DeploymentsAggregate = {};

    for (const file of files) {
        const match = file.match(kFilenamePattern);
        if (!match) continue;

        const networkName = match[1];
        const chainId = parseInt(match[2], 10);

        // Skip local dev forks unless explicitly included
        if (chainId === kLocalDevChainId && !includeDev) continue;

        const data: DeployedNetworkData = JSON.parse(
            readFileSync(join(kDeploymentsDir, file), 'utf8'),
        );

        // Embed chainId into the network entry
        data.chainId = chainId;

        // Remove internal tracking fields from the published aggregate
        delete (data as Record<string, unknown>).lastExecTxHash;

        aggregate[networkName] = data;
    }

    writeFileSync(kOutputFile, JSON.stringify(aggregate, null, 2), 'utf8');

    const networkList = Object.keys(aggregate).join(', ');
    console.log(`✅ deployments.json written — ${Object.keys(aggregate).length} networks: ${networkList}`);
}

main();
