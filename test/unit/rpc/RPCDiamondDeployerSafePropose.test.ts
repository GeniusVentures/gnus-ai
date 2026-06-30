/**
 * Unit tests for Safe Proposal mode in RPCDiamondDeployer.
 *
 * Covers:
 *   - createConfigFromEnv reading SAFE_PROPOSE and SAFE_ADDRESS
 *   - validateConfig Safe-propose and mainnet-guard branches
 *   - Strategy selection (RPCDeploymentStrategy vs SafeProposerRPCDeploymentStrategy)
 *
 * These tests use sinon sandboxes and DO NOT make real network calls.
 * RPCDiamondDeployer singletons are cleared between tests.
 */

import { expect } from 'chai';
import {
    RPCDiamondDeployer,
    RPCDiamondDeployerConfig,
} from '../../../scripts/setup/RPCDiamondDeployer';
import { RPCDeploymentStrategy } from '@diamondslab/diamonds';
import { SafeProposerRPCDeploymentStrategy } from '../../../scripts/setup/strategies/SafeProposerRPCDeploymentStrategy';
import { ethers } from 'hardhat';
import sinon from 'sinon';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Hardhat account #0 — valid 64-char hex key with 0x prefix */
const VALID_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/** Valid checksummed Safe address fixture */
const VALID_SAFE_ADDRESS = ethers.getAddress('0x1234567890123456789012345678901234567890');

/** Valid base config (safePropose=false) for strategy tests */
function makeBaseConfig(overrides: Partial<RPCDiamondDeployerConfig> = {}): RPCDiamondDeployerConfig {
    return {
        diamondName: 'GeniusDiamond',
        networkName: 'localhost',
        chainId: 31337,
        rpcUrl: 'http://localhost:8545',
        privateKey: VALID_PRIVATE_KEY,
        gasLimitMultiplier: 1.2,
        maxRetries: 3,
        retryDelayMs: 1000,
        verbose: false,
        writeDeployedDiamondData: true,
        deploymentsPath: './test-assets/deployments-test',
        configFilePath: 'diamonds/GeniusDiamond/geniusdiamond.config.json',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('RPCDiamondDeployer Safe Proposal Mode', function () {
    this.timeout(60000);

    let sandbox: sinon.SinonSandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
        // Clear singleton instances between tests to prevent state leak
        (RPCDiamondDeployer as any).instances.clear();
        // Clean up Safe-related env vars
        delete process.env.SAFE_PROPOSE;
        delete process.env.SAFE_ADDRESS;
        delete process.env.SAFE_PROPOSER_PRIVATE_KEY;
        delete process.env.SAFE_TX_SERVICE_URL;
        delete process.env.SAFE_API_KEY;
        delete process.env.SAFE_ORIGIN;
    });

    // -----------------------------------------------------------------------
    // createConfigFromEnv — Safe env var reading
    // -----------------------------------------------------------------------

    describe('createConfigFromEnv', function () {
        beforeEach(function () {
            // Ensure base required env vars are set
            process.env.DIAMOND_NAME = 'GeniusDiamond';
            process.env.RPC_URL = 'http://localhost:8545';
            process.env.PRIVATE_KEY = VALID_PRIVATE_KEY;
        });

        afterEach(function () {
            delete process.env.DIAMOND_NAME;
            delete process.env.RPC_URL;
            delete process.env.PRIVATE_KEY;
        });

        it('should read SAFE_PROPOSE and SAFE_ADDRESS from process.env', function () {
            process.env.SAFE_PROPOSE = 'true';
            process.env.SAFE_ADDRESS = VALID_SAFE_ADDRESS;

            const config = RPCDiamondDeployer.createConfigFromEnv();

            expect(config.safePropose).to.equal(true);
            expect(config.safeAddress).to.equal(VALID_SAFE_ADDRESS);
        });

        it('should default safeOrigin to "gnus-ai-rpc-upgrade"', function () {
            process.env.SAFE_PROPOSE = 'true';
            process.env.SAFE_ADDRESS = VALID_SAFE_ADDRESS;

            const config = RPCDiamondDeployer.createConfigFromEnv();

            expect(config.safeOrigin).to.equal('gnus-ai-rpc-upgrade');
        });

        it('should read SAFE_ORIGIN from process.env when set', function () {
            process.env.SAFE_PROPOSE = 'true';
            process.env.SAFE_ADDRESS = VALID_SAFE_ADDRESS;
            process.env.SAFE_ORIGIN = 'ci-pipeline';

            const config = RPCDiamondDeployer.createConfigFromEnv();

            expect(config.safeOrigin).to.equal('ci-pipeline');
        });

        it('should read SAFE_PROPOSER_PRIVATE_KEY from process.env', function () {
            process.env.SAFE_PROPOSE = 'true';
            process.env.SAFE_ADDRESS = VALID_SAFE_ADDRESS;
            process.env.SAFE_PROPOSER_PRIVATE_KEY =
                '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

            const config = RPCDiamondDeployer.createConfigFromEnv();

            expect(config.safeProposerPrivateKey).to.equal(
                '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            );
        });

        it('should default safePropose to false when SAFE_PROPOSE is not "true"', function () {
            // SAFE_PROPOSE not set or set to something other than 'true'
            const config = RPCDiamondDeployer.createConfigFromEnv();

            expect(config.safePropose).to.equal(false);
        });

        it('should apply safe-related overrides passed to createConfigFromEnv', function () {
            process.env.SAFE_PROPOSE = 'true';
            process.env.SAFE_ADDRESS = VALID_SAFE_ADDRESS;

            const overrides: Partial<RPCDiamondDeployerConfig> = {
                safePropose: false,
                safeAddress: '0xoverride',
                safeOrigin: 'override-origin',
            };

            const config = RPCDiamondDeployer.createConfigFromEnv(overrides);

            // Overrides take precedence over env vars
            expect(config.safePropose).to.equal(false);
            expect(config.safeAddress).to.equal('0xoverride');
            expect(config.safeOrigin).to.equal('override-origin');
        });
    });

    // -----------------------------------------------------------------------
    // validateConfig — Safe-propose branches
    // -----------------------------------------------------------------------

    describe('validateConfig Safe branches', function () {
        it('should fail when SAFE_PROPOSE=true and SAFE_ADDRESS is missing', function () {
            const config = makeBaseConfig({
                safePropose: true,
                // safeAddress intentionally omitted
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.throw(
                'SAFE_ADDRESS is required when SAFE_PROPOSE=true',
            );
        });

        it('should fail when SAFE_PROPOSE=true and SAFE_ADDRESS is not a valid address', function () {
            const config = makeBaseConfig({
                safePropose: true,
                safeAddress: 'not-an-address',
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.throw(
                'SAFE_ADDRESS must be a valid address',
            );
        });

        it('should fail when SAFE_PROPOSE=true and no proposer private key is provided', function () {
            const config = makeBaseConfig({
                safePropose: true,
                safeAddress: VALID_SAFE_ADDRESS,
                privateKey: '', // empty, no fallback
                // safeProposerPrivateKey also omitted
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.throw(
                'A proposer private key is required when SAFE_PROPOSE=true',
            );
        });

        it('should fail when SAFE_PROPOSE=true and proposer key has invalid format', function () {
            const config = makeBaseConfig({
                safePropose: true,
                safeAddress: VALID_SAFE_ADDRESS,
                safeProposerPrivateKey: '0xdeadbeef', // too short
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.throw(
                'Safe proposer private key must be 64 hex characters (0x prefix optional)',
            );
        });

        it('should not throw when SAFE_PROPOSE=true with valid safeAddress and valid proposer key', function () {
            const config = makeBaseConfig({
                safePropose: true,
                safeAddress: VALID_SAFE_ADDRESS,
                privateKey: VALID_PRIVATE_KEY,
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.not.throw();
        });

        it('should use privateKey as fallback proposer key when safeProposerPrivateKey is not set', function () {
            const config = makeBaseConfig({
                safePropose: true,
                safeAddress: VALID_SAFE_ADDRESS,
                privateKey: VALID_PRIVATE_KEY,
                // safeProposerPrivateKey omitted — should fall back to privateKey
            });

            // Should not throw — the fallback to privateKey kicks in
            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.not.throw();
        });
    });

    // -----------------------------------------------------------------------
    // validateConfig — mainnet guard
    // -----------------------------------------------------------------------

    describe('validateConfig mainnet guard', function () {
        it('should fail for mainnet when safePropose is not true', function () {
            const config = makeBaseConfig({
                networkName: 'mainnet',
                safePropose: false,
                safeAddress: undefined,
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.throw(
                'Mainnet privileged Diamond cut/admin upgrades require SAFE_PROPOSE=true — refusing to deploy directly',
            );
        });

        it('should fail for mainnet when safePropose is undefined (falsy)', function () {
            const config = makeBaseConfig({
                networkName: 'mainnet',
                // safePropose not set at all
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.throw(
                'Mainnet privileged Diamond cut/admin upgrades require SAFE_PROPOSE=true — refusing to deploy directly',
            );
        });

        it('should not throw for mainnet when SAFE_PROPOSE=true', function () {
            const config = makeBaseConfig({
                networkName: 'mainnet',
                safePropose: true,
                safeAddress: VALID_SAFE_ADDRESS,
                privateKey: VALID_PRIVATE_KEY,
            });

            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.not.throw();
        });

        it('should not throw mainnet guard for non-mainnet networks (e.g. sepolia)', function () {
            const config = makeBaseConfig({
                networkName: 'sepolia',
                safePropose: false,
            });

            // Should not trigger the mainnet guard
            expect(() => (RPCDiamondDeployer as any).validateConfig(config)).to.not.throw();
        });
    });

    // -----------------------------------------------------------------------
    // Strategy selection
    // -----------------------------------------------------------------------

    describe('Strategy selection', function () {
        /**
         * Helper: stub enough of the RPCDiamondDeployer.getInstance machinery
         * to avoid real RPC calls while still exercising the strategy branch.
         */
        async function getDeployerForConfig(
            config: RPCDiamondDeployerConfig,
        ): Promise<RPCDiamondDeployer> {
            // Stub JsonRpcProvider to avoid network calls during constructor
            const mockProvider = {
                getNetwork: sandbox.stub().resolves({ name: config.networkName, chainId: BigInt(config.chainId) }),
            };
            sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

            // Stub validateConnection on RPCDeploymentStrategy.prototype
            // (SafeProposerRPCDeploymentStrategy inherits from it, so one
            // stub covers both classes via the prototype chain).
            sandbox.stub(
                RPCDeploymentStrategy.prototype,
                'validateConnection',
            ).resolves();

            return await RPCDiamondDeployer.getInstance(config);
        }

        it('should return RPCDeploymentStrategy when safePropose is false', async function () {
            const config = makeBaseConfig({ safePropose: false });

            const deployer = await getDeployerForConfig(config);
            const strategy = deployer.getStrategy();

            expect(strategy).to.be.instanceOf(RPCDeploymentStrategy);
        });

        it('should return RPCDeploymentStrategy when safePropose is undefined', async function () {
            const config = makeBaseConfig({});
            // safePropose not explicitly set

            const deployer = await getDeployerForConfig(config);
            const strategy = deployer.getStrategy();

            expect(strategy).to.be.instanceOf(RPCDeploymentStrategy);
        });

        it('should return SafeProposerRPCDeploymentStrategy when safePropose is true', async function () {
            const config = makeBaseConfig({
                safePropose: true,
                safeAddress: VALID_SAFE_ADDRESS,
                privateKey: VALID_PRIVATE_KEY,
            });

            const deployer = await getDeployerForConfig(config);
            const strategy = deployer.getStrategy();

            expect(strategy).to.be.instanceOf(SafeProposerRPCDeploymentStrategy);
        });

        it('should use safeProposerPrivateKey when both privateKey and safeProposerPrivateKey are set', async function () {
            const proposerKey = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
            const config = makeBaseConfig({
                safePropose: true,
                safeAddress: VALID_SAFE_ADDRESS,
                privateKey: VALID_PRIVATE_KEY,
                safeProposerPrivateKey: proposerKey,
            });

            const deployer = await getDeployerForConfig(config);
            const strategy = deployer.getStrategy();

            // The strategy was constructed — verify it is the correct class
            expect(strategy).to.be.instanceOf(SafeProposerRPCDeploymentStrategy);
            // The proposerPrivateKey passed to the strategy should be the dedicated key
            const strategyConfig = (strategy as any).proposerPrivateKey;
            expect(strategyConfig).to.equal(proposerKey);
        });
    });
});
