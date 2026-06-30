/**
 * Writes a local JSON artifact for a Safe proposal as a manual fallback /
 * audit trail. The artifact is stored alongside the Diamond's deployment data
 * under `diamonds/<diamondName>/safe-proposals/`.
 *
 * @module scripts/safe/writeSafeProposalArtifact
 */

import { OperationType } from '@safe-global/types-kit';
import { ethers } from 'ethers';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

import type { SafeProposalArtifact } from './safeProposalTypes';

/**
 * Parameters required to write a Safe proposal artifact.
 */
export interface WriteSafeProposalArtifactParams {
    /** Logical name of the Diamond (e.g. "GeniusDiamond") */
    diamondName: string;
    /** Human-readable network name (e.g. "sepolia") */
    networkName: string;
    /** Numeric chain ID */
    chainId: number;
    /** Safe multisig wallet address */
    safeAddress: string;
    /** Address of the proposing EOA */
    proposerAddress: string;
    /** Target Diamond proxy address */
    target: string;
    /** ETH value attached (string form, e.g. "0") */
    value: string;
    /** Safe operation type enum value */
    operation: OperationType;
    /** Hash of the proposed Safe transaction */
    safeTxHash: string;
    /** Full encoded calldata (hex string with `0x` prefix) */
    calldata: string;
    /** Origin string for tracing */
    origin: string;
}

/**
 * Write a Safe proposal artifact JSON file to disk.
 *
 * Path pattern:
 *   diamonds/<diamondName>/safe-proposals/<networkName>-<chainId>-<timestamp>-<safeTxHash>.json
 *
 * The directory is created automatically with `mkdirSync({ recursive: true })`.
 *
 * @param params - All fields required for the artifact.
 * @returns The absolute path to the written JSON file.
 */
export function writeSafeProposalArtifact(
    params: WriteSafeProposalArtifactParams,
): string {
    // -- 0. Validate inputs — the artifact is the source of truth once written,
    //       so unvalidated input must not be persisted.
    if (!ethers.isAddress(params.safeAddress)) {
        throw new Error(
            `writeSafeProposalArtifact: invalid 'safeAddress': ${params.safeAddress}`,
        );
    }
    if (!ethers.isAddress(params.proposerAddress)) {
        throw new Error(
            `writeSafeProposalArtifact: invalid 'proposerAddress': ${params.proposerAddress}`,
        );
    }
    if (!ethers.isAddress(params.target)) {
        throw new Error(
            `writeSafeProposalArtifact: invalid 'target': ${params.target}`,
        );
    }
    if (!/^0x[0-9a-fA-F]*$/.test(params.calldata)) {
        throw new Error(
            "writeSafeProposalArtifact: 'calldata' must be 0x-prefixed hex",
        );
    }

    // -- 1. Compute calldata selector (first 4 bytes = 10 hex chars incl. 0x)
    const calldataSelector = params.calldata.slice(0, 10);

    // -- 2. Map OperationType enum to the uppercase string form used in the
    //       artifact spec ("CALL" / "DELEGATECALL").
    //       OperationType[OperationType.Call] => 'Call', so we uppercase.
    const operationStr = OperationType[params.operation].toUpperCase();

    // -- 3. Build the artifact object
    const timestamp = Date.now();
    const artifact: SafeProposalArtifact = {
        diamondName: params.diamondName,
        networkName: params.networkName,
        chainId: params.chainId,
        safeAddress: params.safeAddress,
        proposerAddress: params.proposerAddress,
        target: params.target,
        value: params.value,
        operation: operationStr,
        safeTxHash: params.safeTxHash,
        calldata: params.calldata,
        calldataSelector,
        origin: params.origin,
        createdAt: new Date().toISOString(),
    };

    // -- 4. Determine output path and ensure parent directories exist
    const outputPath = join(
        process.cwd(),
        'diamonds',
        params.diamondName,
        'safe-proposals',
        `${params.networkName}-${params.chainId}-${timestamp}-${params.safeTxHash}.json`,
    );

    mkdirSync(dirname(outputPath), { recursive: true });

    // -- 5. Write JSON artifact
    writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');

    return outputPath;
}
