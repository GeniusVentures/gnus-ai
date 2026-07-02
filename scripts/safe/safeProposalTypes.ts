/**
 * Shared type contracts for the Safe proposal subsystem.
 *
 * These interfaces define the input, output, and artifact shapes consumed by
 * `proposeSafeTransaction` (the Safe SDK helper), `writeSafeProposalArtifact`
 * (the local artifact writer), and the Safe-proposal deployment strategy
 * (Plan 02). All consumers import from this single module so the shapes stay
 * in sync without codebase exploration.
 *
 * @module scripts/safe/safeProposalTypes
 */

import { OperationType } from '@safe-global/types-kit';

// ---------------------------------------------------------------------------
// Input shape for the Safe proposal helper
// ---------------------------------------------------------------------------

export interface ProposeSafeTransactionInput {
	/** EVM chain ID (e.g. 11155111n for Sepolia) */
	chainId: bigint;
	/** JSON-RPC endpoint for the target chain */
	rpcUrl: string;
	/** The Safe multisig wallet address that owns the Diamond */
	safeAddress: string;
	/** Private key of the EOA authorized to submit proposals to the Safe Transaction Service */
	proposerPrivateKey: string;
	/** Optional custom Safe Transaction Service URL (defaults to the public service for `chainId`) */
	safeTxServiceUrl?: string;
	/** Optional API key when the configured Safe Transaction Service requires one */
	safeApiKey?: string;
	/** Target contract address (the Diamond proxy) */
	to: string;
	/** ETH value attached to the transaction (default "0") */
	value?: string;
	/** Encoded calldata (hex string with `0x` prefix) */
	data: string;
	/** Safe operation type (Call or DelegateCall); defaults to Call */
	operation?: OperationType;
	/** Origin string shown/stored with the Safe proposal for tracing */
	origin?: string;
}

// ---------------------------------------------------------------------------
// Result shape returned after a successful Safe proposal submission
// ---------------------------------------------------------------------------

export interface ProposeSafeTransactionResult {
	/** The Safe multisig wallet address */
	safeAddress: string;
	/** Hash of the proposed Safe transaction (used to track in the Safe UI) */
	safeTxHash: string;
	/** Address of the EOA that submitted the proposal */
	proposerAddress: string;
	/** Target contract address */
	to: string;
	/** ETH value attached */
	value: string;
	/** Encoded calldata */
	data: string;
	/** Safe operation type */
	operation: OperationType;
}

// ---------------------------------------------------------------------------
// Local artifact written as a fallback / audit trail for a Safe proposal
// ---------------------------------------------------------------------------

export interface SafeProposalArtifact {
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
	/** Operation as an uppercase string ("CALL" or "DELEGATECALL") */
	operation: string;
	/** Hash of the proposed Safe transaction */
	safeTxHash: string;
	/** Full encoded calldata (hex string with `0x` prefix) */
	calldata: string;
	/** First 4 bytes of the calldata (function selector, e.g. "0x1f931c1c") */
	calldataSelector: string;
	/** Origin string for tracing */
	origin: string;
	/** ISO-8601 timestamp of artifact creation */
	createdAt: string;
}
