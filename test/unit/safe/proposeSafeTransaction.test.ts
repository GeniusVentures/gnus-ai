/**
 * Unit tests for proposeSafeTransaction helper.
 *
 * Proves that:
 *   - proposeSafeTransaction returns a result containing safeTxHash,
 *     proposerAddress, to, value, data, operation
 *   - SafeApiKit.prototype.proposeTransaction is called exactly once
 *     with the correct senderAddress
 *   - Safe.init is called with the expected config
 *
 * All Safe SDK classes are stubbed via sinon — no real Safe Transaction
 * Service calls are made.
 */

import { expect } from 'chai';
import { proposeSafeTransaction } from '../../../scripts/safe/proposeSafeTransaction';
import type {
    ProposeSafeTransactionInput,
    ProposeSafeTransactionResult,
} from '../../../scripts/safe/safeProposalTypes';
import { ethers } from 'hardhat';
import sinon from 'sinon';

// We import the SDK modules for stubbing
import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const VALID_SAFE_ADDRESS = ethers.getAddress('0x1234567890123456789012345678901234567890');
const TARGET_ADDRESS = ethers.getAddress('0xd1a0000000000000000000000000000000000000');
const SAFE_TX_HASH = '0x' + 'ab'.repeat(32);
const PROPOSER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Hardhat #0

function makeInput(overrides: Partial<ProposeSafeTransactionInput> = {}): ProposeSafeTransactionInput {
    return {
        chainId: 11155111n,
        rpcUrl: 'http://localhost:8545',
        safeAddress: VALID_SAFE_ADDRESS,
        proposerPrivateKey: VALID_PRIVATE_KEY,
        safeTxServiceUrl: 'http://localhost:8000/txs', // needed to avoid SafeApiKit apiKey requirement
        to: TARGET_ADDRESS,
        value: '0',
        data: '0x1f931c1c' + '00'.repeat(100),
        operation: 0, // Call
        origin: 'test-suite',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('proposeSafeTransaction', function () {
    this.timeout(30000);

    let sandbox: sinon.SinonSandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should return a ProposeSafeTransactionResult with expected fields', async function () {
        // Stub SafeApiKit.proposeTransaction on the prototype
        sandbox.stub(SafeApiKit.prototype, 'proposeTransaction').resolves();

        // Stub Safe.init (static method) to return a mock protocolKit with
        // the methods used by proposeSafeTransaction
        const mockProtocolKit = {
            createTransaction: sandbox.stub().resolves({
                data: {
                    to: TARGET_ADDRESS,
                    value: '0',
                    data: '0x1f931c1c' + '00'.repeat(100),
                    operation: 0,
                },
            }),
            // CR-01: signTransaction embeds the proposer signature on the
            // returned SafeTransaction. Stub resolves to the same shape the
            // real SDK returns so downstream .data access works.
            signTransaction: sandbox.stub().callsFake((tx: unknown) => Promise.resolve(tx)),
            getTransactionHash: sandbox.stub().resolves(SAFE_TX_HASH),
            signHash: sandbox.stub().resolves({ data: '0x' + 'cd'.repeat(65) }),
        };
        sandbox.stub(Safe, 'init').resolves(mockProtocolKit as any);

        // Stub ethers.JsonRpcProvider and ethers.Wallet to avoid real RPC
        const mockProvider = {
            getNetwork: sandbox.stub().resolves({ name: 'sepolia', chainId: 11155111n }),
        };
        sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

        const input = makeInput();
        const result: ProposeSafeTransactionResult = await proposeSafeTransaction(input);

        expect(result.safeAddress).to.equal(VALID_SAFE_ADDRESS);
        expect(result.safeTxHash).to.equal(SAFE_TX_HASH);
        // Wallet.getAddress() returns checksummed; compare case-insensitively
        expect(result.proposerAddress.toLowerCase()).to.equal(PROPOSER_ADDRESS.toLowerCase());
        expect(result.to).to.equal(TARGET_ADDRESS);
        expect(result.value).to.equal('0');
        expect(result.data).to.equal(input.data);
        expect(result.operation).to.equal(0);
    });

    it('should call SafeApiKit.proposeTransaction exactly once', async function () {
        const proposeTxStub = sandbox.stub(SafeApiKit.prototype, 'proposeTransaction').resolves();

        const mockProtocolKit = {
            createTransaction: sandbox.stub().resolves({
                data: {
                    to: TARGET_ADDRESS,
                    value: '0',
                    data: '0x1f931c1c' + '00'.repeat(100),
                    operation: 0,
                },
            }),
            // CR-01: signTransaction embeds the proposer signature on the
            // returned SafeTransaction. Stub resolves to the same shape the
            // real SDK returns so downstream .data access works.
            signTransaction: sandbox.stub().callsFake((tx: unknown) => Promise.resolve(tx)),
            getTransactionHash: sandbox.stub().resolves(SAFE_TX_HASH),
            signHash: sandbox.stub().resolves({ data: '0x' + 'cd'.repeat(65) }),
        };
        sandbox.stub(Safe, 'init').resolves(mockProtocolKit as any);

        const mockProvider = {
            getNetwork: sandbox.stub().resolves({ name: 'sepolia', chainId: 11155111n }),
        };
        sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

        await proposeSafeTransaction(makeInput());

        expect(proposeTxStub.calledOnce).to.be.true;
    });

    it('should call SafeApiKit.proposeTransaction with senderAddress matching proposer wallet', async function () {
        const proposeTxStub = sandbox.stub(SafeApiKit.prototype, 'proposeTransaction').resolves();

        const mockProtocolKit = {
            createTransaction: sandbox.stub().resolves({
                data: {
                    to: TARGET_ADDRESS,
                    value: '0',
                    data: '0x1f931c1c' + '00'.repeat(100),
                    operation: 0,
                },
            }),
            // CR-01: signTransaction embeds the proposer signature on the
            // returned SafeTransaction. Stub resolves to the same shape the
            // real SDK returns so downstream .data access works.
            signTransaction: sandbox.stub().callsFake((tx: unknown) => Promise.resolve(tx)),
            getTransactionHash: sandbox.stub().resolves(SAFE_TX_HASH),
            signHash: sandbox.stub().resolves({ data: '0x' + 'cd'.repeat(65) }),
        };
        sandbox.stub(Safe, 'init').resolves(mockProtocolKit as any);

        const mockProvider = {
            getNetwork: sandbox.stub().resolves({ name: 'sepolia', chainId: 11155111n }),
        };
        sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

        await proposeSafeTransaction(makeInput());

        expect(proposeTxStub.calledOnce).to.be.true;
        // The proposer's EOA address derived from the test private key
        const callArgs = proposeTxStub.firstCall.args[0];
        // Wallet.getAddress() returns checksummed; compare case-insensitively
        expect(callArgs.senderAddress.toLowerCase()).to.equal(PROPOSER_ADDRESS.toLowerCase());
    });

    it('should call Safe.init with the expected configuration', async function () {
        sandbox.stub(SafeApiKit.prototype, 'proposeTransaction').resolves();

        const mockProtocolKit = {
            createTransaction: sandbox.stub().resolves({
                data: {
                    to: TARGET_ADDRESS,
                    value: '0',
                    data: '0x1f931c1c' + '00'.repeat(100),
                    operation: 0,
                },
            }),
            // CR-01: signTransaction embeds the proposer signature on the
            // returned SafeTransaction. Stub resolves to the same shape the
            // real SDK returns so downstream .data access works.
            signTransaction: sandbox.stub().callsFake((tx: unknown) => Promise.resolve(tx)),
            getTransactionHash: sandbox.stub().resolves(SAFE_TX_HASH),
            signHash: sandbox.stub().resolves({ data: '0x' + 'cd'.repeat(65) }),
        };
        const initStub = sandbox.stub(Safe, 'init').resolves(mockProtocolKit as any);

        const mockProvider = {
            getNetwork: sandbox.stub().resolves({ name: 'sepolia', chainId: 11155111n }),
        };
        sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

        const input = makeInput();
        await proposeSafeTransaction(input);

        expect(initStub.calledOnce).to.be.true;
        const initArgs = initStub.firstCall.args[0];
        expect(initArgs.provider).to.equal(input.rpcUrl);
        expect(initArgs.signer).to.equal(input.proposerPrivateKey);
        expect(initArgs.safeAddress).to.equal(input.safeAddress);
    });

    it('should default value to "0" when not provided', async function () {
        sandbox.stub(SafeApiKit.prototype, 'proposeTransaction').resolves();

        const mockProtocolKit = {
            createTransaction: sandbox.stub().resolves({
                data: {
                    to: TARGET_ADDRESS,
                    value: '0',
                    data: '0x1f931c1c' + '00'.repeat(100),
                    operation: 0,
                },
            }),
            // CR-01: signTransaction embeds the proposer signature on the
            // returned SafeTransaction. Stub resolves to the same shape the
            // real SDK returns so downstream .data access works.
            signTransaction: sandbox.stub().callsFake((tx: unknown) => Promise.resolve(tx)),
            getTransactionHash: sandbox.stub().resolves(SAFE_TX_HASH),
            signHash: sandbox.stub().resolves({ data: '0x' + 'cd'.repeat(65) }),
        };
        sandbox.stub(Safe, 'init').resolves(mockProtocolKit as any);

        const mockProvider = {
            getNetwork: sandbox.stub().resolves({ name: 'sepolia', chainId: 11155111n }),
        };
        sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

        // Omit `value` from input
        const input = makeInput();
        delete (input as any).value;

        const result = await proposeSafeTransaction(input);
        expect(result.value).to.equal('0');
    });

    it('should default origin when not provided', async function () {
        sandbox.stub(SafeApiKit.prototype, 'proposeTransaction').resolves();

        const mockProtocolKit = {
            createTransaction: sandbox.stub().resolves({
                data: {
                    to: TARGET_ADDRESS,
                    value: '0',
                    data: '0x1f931c1c' + '00'.repeat(100),
                    operation: 0,
                },
            }),
            // CR-01: signTransaction embeds the proposer signature on the
            // returned SafeTransaction. Stub resolves to the same shape the
            // real SDK returns so downstream .data access works.
            signTransaction: sandbox.stub().callsFake((tx: unknown) => Promise.resolve(tx)),
            getTransactionHash: sandbox.stub().resolves(SAFE_TX_HASH),
            signHash: sandbox.stub().resolves({ data: '0x' + 'cd'.repeat(65) }),
        };
        sandbox.stub(Safe, 'init').resolves(mockProtocolKit as any);

        const mockProvider = {
            getNetwork: sandbox.stub().resolves({ name: 'sepolia', chainId: 11155111n }),
        };
        sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

        // Omit `origin` from input
        const input = makeInput();
        delete (input as any).origin;

        // Should not throw — origin defaults to 'gnus-ai-rpc-upgrade'
        await proposeSafeTransaction(input);
    });
});
