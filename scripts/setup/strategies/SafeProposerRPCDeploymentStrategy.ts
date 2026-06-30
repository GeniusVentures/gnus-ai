/**
 * SafeProposerRPCDeploymentStrategy
 *
 * Subclass of RPCDeploymentStrategy that intercepts the diamondCut transaction
 * and proposes it to a Safe multisig wallet via the Safe Transaction Service
 * instead of sending it directly from the deployer EOA.
 *
 * All other deployment lifecycle methods (deployDiamondTasks, deployFacetsTasks,
 * etc.) are inherited unchanged — only the privileged diamondCut/admin upgrade
 * path is redirected through Safe.
 *
 * @module scripts/setup/strategies/SafeProposerRPCDeploymentStrategy
 */

import { RPCDeploymentStrategy, Diamond, getContractArtifact } from '@diamondslab/diamonds';
import { ethers } from 'ethers';
import { OperationType } from '@safe-global/types-kit';
import type { FacetCuts } from '@diamondslab/diamonds';
import chalk from 'chalk';

import { proposeSafeTransaction } from '../../safe/proposeSafeTransaction';
import { writeSafeProposalArtifact } from '../../safe/writeSafeProposalArtifact';

// ---------------------------------------------------------------------------
// Configuration interface
// ---------------------------------------------------------------------------

export interface SafeProposerStrategyConfig {
    rpcUrl: string;
    privateKey: string;
    proposerPrivateKey: string;
    safeAddress: string;
    chainId: number;
    gasLimitMultiplier?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    verbose?: boolean;
    safeTxServiceUrl?: string;
    safeApiKey?: string;
    safeOrigin?: string;
    diamondName: string;
    networkName: string;
}

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
                    { internalType: 'enum IDiamondCut.FacetCutAction', name: 'action', type: 'uint8' },
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
// Strategy class
// ---------------------------------------------------------------------------

export class SafeProposerRPCDeploymentStrategy extends RPCDeploymentStrategy {
    // Safe-specific fields (parent fields rpcUrl, privateKey, etc. are private
    // so we store our own copies). `safeRpcUrl` mirrors the parent's private
    // `rpcUrl` so this subclass does not depend on getConfig() to recover it.
    private readonly safeRpcUrl: string;
    private readonly safeAddress: string;
    private readonly proposerPrivateKey: string;
    private readonly chainId: number;
    private readonly safeTxServiceUrl?: string;
    private readonly safeApiKey?: string;
    private readonly safeOrigin: string;
    private readonly diamondName: string;
    private readonly networkName: string;

    /**
     * Creates a new SafeProposerRPCDeploymentStrategy.
     *
     * @param config - All fields required for the strategy.
     */
    constructor(config: SafeProposerStrategyConfig) {
        super(
            config.rpcUrl,
            config.privateKey,
            config.gasLimitMultiplier ?? 1.2,
            config.maxRetries ?? 3,
            config.retryDelayMs ?? 2000,
            config.verbose ?? false,
        );

        this.safeRpcUrl = config.rpcUrl;
        this.safeAddress = config.safeAddress;
        this.proposerPrivateKey = config.proposerPrivateKey;
        this.chainId = config.chainId;
        this.safeTxServiceUrl = config.safeTxServiceUrl;
        this.safeApiKey = config.safeApiKey;
        this.safeOrigin = config.safeOrigin || 'gnus-ai-rpc-upgrade';
        this.diamondName = config.diamondName;
        this.networkName = config.networkName;
    }

    // -----------------------------------------------------------------------
    // Override: performDiamondCutTasks — propose to Safe instead of sending
    // -----------------------------------------------------------------------

    /**
     * Overrides the parent performDiamondCutTasks to encode the diamondCut
     * calldata and propose it to the Safe wallet instead of sending it
     * directly from the deployer EOA.
     *
     * The canonical deployed-data file is NOT updated — the upgrade is
     * "proposed," not "executed." The local artifact written by
     * writeSafeProposalArtifact serves as the source of truth until Safe
     * signers execute the transaction.
     */
    protected async performDiamondCutTasks(diamond: Diamond): Promise<void> {
        // -- Mainnet defensive check (belt-and-suspenders) ------------------
        // Normalize (trim + lowercase) so casing/whitespace variants cannot
        // bypass the guard. Mirrors RPCDiamondDeployer.validateConfig.
        if (this.networkName.trim().toLowerCase() === 'mainnet') {
            console.warn(
                chalk.yellow(
                    '🛡️  DIAMOND CUT VIA SAFE: A Safe proposal will be created for this mainnet diamondCut.',
                ),
            );
        }

        // -- 1. Get diamond metadata ----------------------------------------
        const deployedDiamondData = diamond.getDeployedDiamondData();
        const diamondAddress = deployedDiamondData.DiamondAddress;

        // -- 2. Resolve IDiamondCut artifact -------------------------------
        let diamondCutAbi = kIDiamondCutAbi;
        try {
            const diamondCutArtifact = await getContractArtifact('IDiamondCut', diamond);
            diamondCutAbi = diamondCutArtifact.abi;
        } catch {
            // Fall through — use the local ABI fragment
            if (this.verbose) {
                console.log(
                    chalk.gray(
                        'ℹ️  IDiamondCut artifact not resolved via Hardhat; using local ABI fragment.',
                    ),
                );
            }
        }

        const diamondContract = new ethers.Contract(
            diamondAddress,
            diamondCutAbi,
            this.getSigner(),
        );

        // -- 3. Gather init calldata and facet cuts ------------------------
        const [initCalldata, initAddress] = await this.getInitCalldata(diamond);
        const facetCuts: FacetCuts = await this.getFacetCuts(diamond);

        // Validate no orphaned selectors before proceeding
        await this.validateNoOrphanedSelectors(facetCuts);

        // Short-circuit on empty facet cuts — matches the OZ Defender strategy.
        // Without this, a no-op re-run or idempotent re-proposal would create a
        // Safe proposal containing diamondCut([], ZeroAddress, '0x'), wasting
        // signer attention and producing a misleading artifact.
        if (facetCuts.length === 0) {
            console.log(
                chalk.yellow(
                    '⏩ No DiamondCut operations needed — no Safe proposal will be created.',
                ),
            );
            return;
        }

        // -- 4. Build the FacetCut[] argument ------------------------------
        const facetSelectorCutMap = facetCuts.map((fc) => ({
            facetAddress: fc.facetAddress,
            action: fc.action,
            functionSelectors: fc.functionSelectors,
        }));

        // -- 5. Encode the diamondCut calldata -----------------------------
        const calldata = diamondContract.interface.encodeFunctionData('diamondCut', [
            facetSelectorCutMap,
            initAddress,
            initCalldata,
        ]);

        // -- 6. Propose the transaction to the Safe ------------------------
        const result = await proposeSafeTransaction({
            chainId: BigInt(this.chainId),
            rpcUrl: this.safeRpcUrl,
            safeAddress: this.safeAddress,
            proposerPrivateKey: this.proposerPrivateKey,
            safeTxServiceUrl: this.safeTxServiceUrl,
            safeApiKey: this.safeApiKey,
            to: diamondAddress,
            value: '0',
            data: calldata,
            operation: OperationType.Call,
            origin: this.safeOrigin,
        });

        // -- 7. Write the local artifact -----------------------------------
        const artifactPath = writeSafeProposalArtifact({
            diamondName: this.diamondName,
            networkName: this.networkName,
            chainId: this.chainId,
            safeAddress: this.safeAddress,
            proposerAddress: result.proposerAddress,
            target: diamondAddress,
            value: '0',
            operation: OperationType.Call,
            safeTxHash: result.safeTxHash,
            calldata,
            origin: this.safeOrigin,
        });

        // -- 8. Log the success block --------------------------------------
        console.log(chalk.greenBright('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.greenBright('  ✅ Safe Proposal Created Successfully'));
        console.log(chalk.greenBright('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.bold(`  💎 Diamond:  `) + chalk.white(this.diamondName));
        console.log(chalk.bold(`  🌐 Network:  `) + chalk.white(`${this.networkName} (Chain ID: ${this.chainId})`));
        console.log(chalk.bold(`  🛡️  Safe:     `) + chalk.white(this.safeAddress));
        console.log(chalk.bold(`  👤 Proposer: `) + chalk.white(result.proposerAddress));
        console.log(chalk.bold(`  🎯 Target:   `) + chalk.white(diamondAddress));
        console.log(chalk.bold(`  💰 Value:    `) + chalk.white('0'));
        console.log(chalk.bold(`  ⚙️  Op:       `) + chalk.white('CALL'));
        console.log(
            chalk.bold(`  🔑 SafeTx:   `) + chalk.cyan(result.safeTxHash),
        );
        console.log(chalk.gray(`  📄 Artifact: ${artifactPath}`));
        console.log(chalk.greenBright('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
        console.log(
            chalk.yellow(
                '⚠️  The diamondCut has been proposed but NOT yet executed. Safe signers must approve and execute it via the Safe UI.',
            ),
        );
        console.log(
            chalk.gray(
                '   The canonical deployment data file has NOT been updated. The local artifact above is the source of truth.',
            ),
        );
        console.log('');

        // -- DELIBERATELY EXCLUDED: -----------------------------------------
        // - postDiamondCutDeployedDataUpdate(diamond, txHash)
        //   The Safe tx has NOT executed yet — the canonical deployment state
        //   must NOT be marked as complete.
        //
        // - this.store?.markDeploymentComplete()
        //   Same reason — the upgrade is only "proposed," not "executed."
        //
        // - executeInitializerFunctions(diamond)
        //   These run AFTER the diamondCut is mined. Until Safe signers
        //   execute, they cannot run.
    }
}
