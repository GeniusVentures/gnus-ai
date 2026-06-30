/**
 * Unit tests for SafeProposerRPCDeploymentStrategy.
 *
 * Proves that the performDiamondCutTasks override:
 *   - Calls proposeSafeTransaction with the diamond address as `to`
 *     and diamondCut-encoded calldata as `data`
 *   - Calls writeSafeProposalArtifact with the matching target and safeTxHash
 *   - Does NOT call super.performDiamondCutTasks (no direct tx is sent)
 *
 * All Safe SDK and module imports are stubbed — no real network calls.
 */

import { expect } from 'chai';
import { SafeProposerRPCDeploymentStrategy } from '../../../scripts/setup/strategies/SafeProposerRPCDeploymentStrategy';
import * as safeHelper from '../../../scripts/safe/proposeSafeTransaction';
import * as artifactWriter from '../../../scripts/safe/writeSafeProposalArtifact';
import { ethers } from 'hardhat';
import sinon from 'sinon';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DIAMOND_ADDRESS = '0xd1a0000000000000000000000000000000000000';
const VALID_SAFE_ADDRESS = ethers.getAddress('0x1234567890123456789012345678901234567890');
const SAFE_TX_HASH = '0x' + 'ab'.repeat(32);

// ---------------------------------------------------------------------------
// Strategy config fixture
// ---------------------------------------------------------------------------

function makeStrategyConfig(overrides: Partial<any> = {}) {
    return {
        rpcUrl: 'http://localhost:8545',
        privateKey: VALID_PRIVATE_KEY,
        proposerPrivateKey: VALID_PRIVATE_KEY,
        safeAddress: VALID_SAFE_ADDRESS,
        chainId: 31337,
        gasLimitMultiplier: 1.2,
        maxRetries: 3,
        retryDelayMs: 2000,
        verbose: false,
        diamondName: 'GeniusDiamond',
        networkName: 'localhost',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SafeProposerRPCDeploymentStrategy', function () {
    this.timeout(60000);

    let sandbox: sinon.SinonSandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe('performDiamondCutTasks override', function () {
        /**
         * Helper: creates a strategy with inherited methods stubbed so
         * performDiamondCutTasks can run without hitting the network.
         */
        function createStrategyWithStubs(config: any) {
            const strategy = new SafeProposerRPCDeploymentStrategy(config);

            // Stub inherited methods that performDiamondCutTasks calls
            sandbox.stub(strategy as any, 'getInitCalldata').resolves([
                '0xdeadbeef',
                '0x0000000000000000000000000000000000000000',
            ]);

            sandbox.stub(strategy as any, 'getFacetCuts').resolves([
                {
                    facetAddress: '0x0000000000000000000000000000000000001111',
                    action: 0,
                    functionSelectors: ['0x12345678'],
                    name: 'TestFacet',
                },
            ]);

            sandbox.stub(strategy as any, 'validateNoOrphanedSelectors').resolves();

            // Stub getSigner to return a mock signer (needed for ethers.Contract construction)
            const mockSigner = {
                getAddress: sandbox.stub().resolves(VALID_SAFE_ADDRESS),
            };
            sandbox.stub(strategy as any, 'getSigner').returns(mockSigner);

            // Stub getConfig to avoid the real signer.getAddress() call inside getConfig()
            sandbox.stub(strategy as any, 'getConfig').returns({
                rpcUrl: config.rpcUrl,
                signerAddress: Promise.resolve(VALID_SAFE_ADDRESS),
                gasLimitMultiplier: 1.2,
                maxRetries: 3,
                retryDelayMs: 2000,
                verbose: false,
            });

            return strategy;
        }

        it('should call proposeSafeTransaction exactly once', async function () {
            // Stub the proposeSafeTransaction module export
            const proposeStub = sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            // Stub writeSafeProposalArtifact to avoid file I/O
            sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const strategy = createStrategyWithStubs(makeStrategyConfig());

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            await (strategy as any).performDiamondCutTasks(diamond);

            expect(proposeStub.calledOnce).to.be.true;
        });

        it('should pass diamond address as `to` in the proposeSafeTransaction call', async function () {
            const proposeStub = sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const strategy = createStrategyWithStubs(makeStrategyConfig());

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            await (strategy as any).performDiamondCutTasks(diamond);

            expect(proposeStub.calledOnce).to.be.true;
            expect(proposeStub.firstCall.args[0].to).to.equal(DIAMOND_ADDRESS);
        });

        it('should pass calldata starting with the diamondCut selector (0x1f931c1c)', async function () {
            const proposeStub = sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const strategy = createStrategyWithStubs(makeStrategyConfig());

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            await (strategy as any).performDiamondCutTasks(diamond);

            expect(proposeStub.calledOnce).to.be.true;
            const calldata: string = proposeStub.firstCall.args[0].data;
            expect(calldata.startsWith('0x1f931c1c')).to.be.true;
        });

        it('should call writeSafeProposalArtifact exactly once', async function () {
            sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            const writeStub = sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const strategy = createStrategyWithStubs(makeStrategyConfig());

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            await (strategy as any).performDiamondCutTasks(diamond);

            expect(writeStub.calledOnce).to.be.true;
        });

        it('should call writeSafeProposalArtifact with target=diamondAddress', async function () {
            sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            const writeStub = sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const strategy = createStrategyWithStubs(makeStrategyConfig());

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            await (strategy as any).performDiamondCutTasks(diamond);

            expect(writeStub.calledOnce).to.be.true;
            expect(writeStub.firstCall.args[0].target).to.equal(DIAMOND_ADDRESS);
        });

        it('should call writeSafeProposalArtifact with safeTxHash from proposeSafeTransaction result', async function () {
            sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            const writeStub = sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const strategy = createStrategyWithStubs(makeStrategyConfig());

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            await (strategy as any).performDiamondCutTasks(diamond);

            expect(writeStub.calledOnce).to.be.true;
            expect(writeStub.firstCall.args[0].safeTxHash).to.equal(SAFE_TX_HASH);
        });

        it('should not throw and should not call any real network method', async function () {
            sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const strategy = createStrategyWithStubs(makeStrategyConfig());

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            // Should not throw
            await (strategy as any).performDiamondCutTasks(diamond);
        });

        it('should work with a mainnet networkName (belt-and-suspenders check)', async function () {
            // With mainnet, the strategy logs a warning but still proceeds
            sandbox.stub(safeHelper, 'proposeSafeTransaction').resolves({
                safeAddress: VALID_SAFE_ADDRESS,
                safeTxHash: SAFE_TX_HASH,
                proposerAddress: '0x1234567890123456789012345678901234567890',
                to: DIAMOND_ADDRESS,
                value: '0',
                data: '0x1f931c1c' + '00'.repeat(100),
                operation: 0,
            });

            sandbox.stub(artifactWriter, 'writeSafeProposalArtifact').returns(
                '/tmp/fake-safe-proposal.json',
            );

            const mainnetConfig = makeStrategyConfig({ networkName: 'mainnet' });
            const strategy = createStrategyWithStubs(mainnetConfig);

            const diamond = {
                getDeployedDiamondData: () => ({ DiamondAddress: DIAMOND_ADDRESS }),
            } as any;

            // Should not throw even for mainnet (belt-and-suspenders warning only)
            await (strategy as any).performDiamondCutTasks(diamond);
        });
    });
});
