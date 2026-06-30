/**
 * Safe SDK proposal helper.
 *
 * Builds, signs, and submits a Safe transaction to the Safe Transaction Service.
 * Does **not** perform any network I/O at module load — all RPC and HTTP calls
 * happen inside the function body when invoked.
 *
 * @module scripts/safe/proposeSafeTransaction
 */

import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';
import { OperationType } from '@safe-global/types-kit';
import type { MetaTransactionData } from '@safe-global/types-kit';
import { ethers } from 'ethers';

import type {
    ProposeSafeTransactionInput,
    ProposeSafeTransactionResult,
} from './safeProposalTypes';

/**
 * Build a Safe transaction, compute its hash, sign it with the proposer's
 * private key, and submit the proposal to the Safe Transaction Service.
 *
 * The caller must ensure:
 *  - The proposer EOA has been added as a **Proposer** in the Safe UI
 *    (Settings -> Proposers) for the target Safe.
 *  - The Safe Transaction Service is available for `chainId`
 *    (see https://docs.safe.global/api-kit/available-services).
 *
 * @param input - Fully populated proposal parameters.
 * @returns The result metadata including `safeTxHash` for tracking.
 */
export async function proposeSafeTransaction(
    input: ProposeSafeTransactionInput,
): Promise<ProposeSafeTransactionResult> {
    // -- 0. Validate inputs before any network I/O ----------------------------
    //
    // The canonical deployment data file is intentionally NOT updated when a
    // Safe proposal is created, so the local artifact becomes the only source
    // of truth. A malformed `to`, `safeAddress`, `value`, or `data` baked into
    // that artifact is a silent failure that signers may not catch until
    // execution. Validate here to fail fast.
    if (!ethers.isAddress(input.to)) {
        throw new Error(`proposeSafeTransaction: invalid 'to' address: ${input.to}`);
    }
    if (!ethers.isAddress(input.safeAddress)) {
        throw new Error(
            `proposeSafeTransaction: invalid 'safeAddress': ${input.safeAddress}`,
        );
    }
    if (!/^0x[0-9a-fA-F]*$/.test(input.data)) {
        throw new Error("proposeSafeTransaction: 'data' must be 0x-prefixed hex");
    }
    if (input.value !== undefined) {
        try {
            BigInt(input.value);
        } catch {
            throw new Error(
                `proposeSafeTransaction: 'value' must be a wei integer: ${input.value}`,
            );
        }
    }

    // -- 1. Derive proposer address -------------------------------------------
    //
    // Derive the proposer EOA address directly from the private key with no
    // network I/O. The actual signing is delegated to protocolKit via
    // Safe.init({ signer }) below, so a second provider+wallet here would be
    // dead weight that doubles the connection-failure surface.
    const proposerAddress = ethers.computeAddress(input.proposerPrivateKey);

    // -- 2. API Kit (Safe Transaction Service client) --------------------------
    const apiKit = new SafeApiKit({
        chainId: input.chainId,
        ...(input.safeTxServiceUrl ? { txServiceUrl: input.safeTxServiceUrl } : {}),
        ...(input.safeApiKey ? { apiKey: input.safeApiKey } : {}),
    });

    // -- 3. Protocol Kit (Safe contract interface) -----------------------------
    //
    // protocol-kit@8.0.1 accepts provider as Eip1193Provider | HttpTransport |
    // SocketTransport. HttpTransport = string, so passing the RPC URL directly
    // is valid and avoids type compatibility issues with JsonRpcProvider.
    const protocolKit = await Safe.init({
        provider: input.rpcUrl,
        signer: input.proposerPrivateKey,
        safeAddress: input.safeAddress,
    });

    // -- 4. Build the Safe transaction data ------------------------------------
    const safeTransactionData: MetaTransactionData = {
        to: input.to,
        value: input.value || '0',
        data: input.data,
        operation: input.operation ?? OperationType.Call,
    };

    const safeTransaction = await protocolKit.createTransaction({
        transactions: [safeTransactionData],
    });

    // -- 5. Sign the Safe transaction so the proposer's signature is embedded --
    //
    // The canonical protocol-kit pattern signs the SafeTransaction object
    // *before* submitting, so the proposer's signature is part of the encoded
    // payload. Relying on `signHash` alone leaves the SafeTransaction unsigned,
    // which can cause the Safe Transaction Service to either silently discard
    // the signature or reject the proposal with an HTTP 422.
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);

    const safeTxHash = await protocolKit.getTransactionHash(signedSafeTransaction);

    // protocol-kit@8.0.1: signHash returns SafeSignature whose `.data`
    // property is the hex-encoded signature bytes.
    const senderSignature = await protocolKit.signHash(safeTxHash);

    // -- 6. Submit the proposal to the Safe Transaction Service ----------------
    //
    // signedSafeTransaction.data is typed as SafeTransactionData, which satisfies
    // the `safeTransactionData` field of ProposeTransactionProps and carries the
    // proposer's embedded signature.
    await apiKit.proposeTransaction({
        safeAddress: input.safeAddress,
        safeTransactionData: signedSafeTransaction.data,
        safeTxHash,
        senderAddress: proposerAddress,
        senderSignature: senderSignature.data,
        origin: input.origin || 'gnus-ai-rpc-upgrade',
    });

    // -- 7. Return result metadata ---------------------------------------------
    return {
        safeAddress: input.safeAddress,
        safeTxHash,
        proposerAddress,
        to: input.to,
        value: input.value || '0',
        data: input.data,
        operation: input.operation ?? OperationType.Call,
    };
}
