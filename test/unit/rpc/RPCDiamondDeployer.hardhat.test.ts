import '@geniusventures/hardhat-diamonds';
import { expect } from 'chai';
import hre from 'hardhat';
import { RPCDiamondDeployer } from '../../../scripts/setup/RPCDiamondDeployer';

// CI runners have no .env, so chainManager's sepolia rpcUrl resolves to ''
// there. Tests that need a URL pass one via createConfigFromHardhat's
// overrides (its public seam); the loader test asserts flow-through equality
// against the ambient config instead of assuming secrets are present.
const HERMETIC_RPC_URL = 'http://127.0.0.1:8545';

type ChainManagerLike = {
	chainManager: { chains: Record<string, { rpcUrl?: string }> };
};

describe('RPCDiamondDeployer - Hardhat Integration', function () {
	this.timeout(60000);

	beforeEach(function () {
		// Clear singleton instances before each test
		(RPCDiamondDeployer as any).instances.clear();
	});

	describe('Hardhat Configuration Loading', function () {
		it('should load diamond configuration from @geniusventures/hardhat-diamonds', function () {
			try {
				const diamondConfig =
					RPCDiamondDeployer.getDiamondConfigFromHardhat('GeniusDiamond');

				expect(diamondConfig).to.be.an('object');
				expect(diamondConfig).to.have.property('deploymentsPath');
				expect(diamondConfig).to.have.property('contractsPath');
				expect(diamondConfig.deploymentsPath).to.equal('diamonds');
				expect(diamondConfig.contractsPath).to.equal('contracts/gnus-ai');
			} catch (error) {
				expect.fail(`Failed to load diamond configuration: ${(error as Error).message}`);
			}
		});

		it('should throw error for non-existent diamond configuration', function () {
			expect(() => {
				RPCDiamondDeployer.getDiamondConfigFromHardhat('NonExistentDiamond');
			}).to.throw('Failed to load diamond configuration for "NonExistentDiamond"');
		});

		it('should load network configuration from hardhat chainManager', function () {
			try {
				const networkConfig = RPCDiamondDeployer.getNetworkConfigFromHardhat('sepolia');

				expect(networkConfig).to.be.an('object');
				expect(networkConfig).to.have.property('name');
				expect(networkConfig).to.have.property('chainId');
				expect(networkConfig).to.have.property('rpcUrl');
				expect(networkConfig.name).to.equal('sepolia');
				expect(networkConfig.chainId).to.equal(11155111);
				// rpcUrl flows through from the ambient chainManager config
				// (env-derived) — assert equality, not a live-looking value
				const configuredRpcUrl = (hre.config as unknown as ChainManagerLike).chainManager
					.chains.sepolia?.rpcUrl;
				expect(networkConfig.rpcUrl).to.equal(configuredRpcUrl ?? '');
			} catch (error) {
				expect.fail(`Failed to load network configuration: ${(error as Error).message}`);
			}
		});

		it('should throw error for non-existent network configuration', function () {
			expect(() => {
				RPCDiamondDeployer.getNetworkConfigFromHardhat('nonexistent');
			}).to.throw('Failed to load network configuration for "nonexistent"');
		});
	});

	describe('Configuration Creation from Hardhat', function () {
		it('should create configuration using hardhat settings', function () {
			const testPrivateKey =
				'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

			try {
				const config = RPCDiamondDeployer.createConfigFromHardhat(
					'GeniusDiamond',
					'sepolia',
					testPrivateKey,
					{ rpcUrl: HERMETIC_RPC_URL },
				);

				expect(config).to.be.an('object');
				expect(config.diamondName).to.equal('GeniusDiamond');
				expect(config.networkName).to.equal('sepolia');
				expect(config.chainId).to.equal(11155111);
				// The override wins over the (env-derived) chainManager value
				expect(config.rpcUrl).to.equal(HERMETIC_RPC_URL);
				expect(config.privateKey).to.equal(testPrivateKey);
				expect(config.deploymentsPath).to.equal('diamonds');
				expect(config.contractsPath).to.equal('contracts/gnus-ai');
				expect(config.configFilePath).to.include(
					'diamonds/GeniusDiamond/geniusdiamond.config.json',
				);
			} catch (error) {
				expect.fail(
					`Failed to create configuration from hardhat: ${(error as Error).message}`,
				);
			}
		});

		it('should apply configuration overrides', function () {
			const testPrivateKey =
				'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

			try {
				const config = RPCDiamondDeployer.createConfigFromHardhat(
					'GeniusDiamond',
					'sepolia',
					testPrivateKey,
					{
						verbose: true,
						gasLimitMultiplier: 1.5,
						maxRetries: 5,
					},
				);

				expect(config.verbose).to.be.true;
				expect(config.gasLimitMultiplier).to.equal(1.5);
				expect(config.maxRetries).to.equal(5);
				// Default values should still be present
				expect(config.retryDelayMs).to.equal(2000);
			} catch (error) {
				expect.fail(
					`Failed to create configuration with overrides: ${(error as Error).message}`,
				);
			}
		});
	});

	describe('Integration with getInstance', function () {
		it('should create deployer instance using hardhat configuration', async function () {
			const testPrivateKey =
				'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

			try {
				const config = RPCDiamondDeployer.createConfigFromHardhat(
					'GeniusDiamond',
					'sepolia',
					testPrivateKey,
					{ rpcUrl: HERMETIC_RPC_URL },
				);

				// Mock the provider to avoid network calls
				const mockProvider = {
					getNetwork: () => Promise.resolve({ name: 'sepolia', chainId: 11155111n }),
				};
				config.provider = mockProvider as any;

				const deployer = await RPCDiamondDeployer.getInstance(config);

				expect(deployer).to.be.instanceOf(RPCDiamondDeployer);
				expect(deployer.getConfig().diamondName).to.equal('GeniusDiamond');
				expect(deployer.getConfig().networkName).to.equal('sepolia');
				expect(deployer.getConfig().chainId).to.equal(11155111);
			} catch (error) {
				expect.fail(`Failed to create deployer instance: ${(error as Error).message}`);
			}
		});
	});

	describe('Deployment Repository Path Resolution', function () {
		it('should create deployment repository with correct paths', async function () {
			const testPrivateKey =
				'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

			try {
				const config = RPCDiamondDeployer.createConfigFromHardhat(
					'GeniusDiamond',
					'sepolia',
					testPrivateKey,
					{ rpcUrl: HERMETIC_RPC_URL },
				);

				// Mock the provider to avoid network calls
				const mockProvider = {
					getNetwork: () => Promise.resolve({ name: 'sepolia', chainId: 11155111n }),
				};
				config.provider = mockProvider as any;

				const deployer = await RPCDiamondDeployer.getInstance(config);
				const repository = deployer.getRepository();

				expect(repository).to.exist;
				// The repository should be configured with the diamond deployment paths
			} catch (error) {
				expect.fail(`Failed to create deployment repository: ${(error as Error).message}`);
			}
		});
	});
});
