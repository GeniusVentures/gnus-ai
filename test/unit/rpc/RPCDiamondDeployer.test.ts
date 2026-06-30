import { expect } from 'chai';
import {
	RPCDiamondDeployer,
	RPCDiamondDeployerConfig,
	DeploymentStatus,
} from '../../../scripts/setup/RPCDiamondDeployer';
import { ethers } from 'hardhat';
import sinon from 'sinon';

describe('RPCDiamondDeployer', function () {
	this.timeout(60000);

	let config: RPCDiamondDeployerConfig;
	let sandbox: sinon.SinonSandbox;

	before(async function () {
		sandbox = sinon.createSandbox();

		// Set up test environment variables with proper 64-character private key
		process.env.DIAMOND_NAME = 'GeniusDiamond';
		process.env.RPC_URL = 'http://localhost:8545';
		process.env.PRIVATE_KEY =
			'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
		process.env.NETWORK_NAME = 'localhost';
		process.env.CHAIN_ID = '31337';

		config = {
			diamondName: 'GeniusDiamond',
			networkName: 'localhost',
			chainId: 31337,
			rpcUrl: 'http://localhost:8545',
			privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
			gasLimitMultiplier: 1.2,
			maxRetries: 3,
			retryDelayMs: 1000,
			verbose: false,
			deploymentsPath: './test-assets/deployments-test',
			configFilePath: 'diamonds/GeniusDiamond/geniusdiamond.config.json',
			writeDeployedDiamondData: true,
		};
	});

	afterEach(function () {
		sandbox.restore();
	});

	after(async function () {
		// Clean up environment variables
		delete process.env.DIAMOND_NAME;
		delete process.env.RPC_URL;
		delete process.env.PRIVATE_KEY;
		delete process.env.NETWORK_NAME;
		delete process.env.CHAIN_ID;

		// Clear singleton instances after tests
		(RPCDiamondDeployer as any).instances.clear();
	});

	describe('Configuration Validation', function () {
		it('should validate required configuration fields', function () {
			const validConfig: RPCDiamondDeployerConfig = {
				diamondName: 'TestDiamond',
				networkName: 'localhost',
				chainId: 31337,
				rpcUrl: 'http://localhost:8545',
				privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
				writeDeployedDiamondData: true,
			};

			expect(() => (RPCDiamondDeployer as any).validateConfig(validConfig)).to.not.throw();
		});

		it('should throw error for missing diamond name', function () {
			const invalidConfig = { ...config };
			delete (invalidConfig as any).diamondName;

			expect(() => (RPCDiamondDeployer as any).validateConfig(invalidConfig)).to.throw(
				'Configuration validation failed',
			);
		});

		it('should throw error for missing RPC URL', function () {
			const invalidConfig = { ...config };
			delete (invalidConfig as any).rpcUrl;

			expect(() => (RPCDiamondDeployer as any).validateConfig(invalidConfig)).to.throw(
				'Configuration validation failed',
			);
		});

		it('should throw error for missing private key', function () {
			const invalidConfig = { ...config };
			delete (invalidConfig as any).privateKey;

			expect(() => (RPCDiamondDeployer as any).validateConfig(invalidConfig)).to.throw(
				'Configuration validation failed',
			);
		});

		it('should throw error for invalid private key format', function () {
			const invalidConfig = { ...config, privateKey: 'invalid-key' };

			expect(() => (RPCDiamondDeployer as any).validateConfig(invalidConfig)).to.throw(
				'Private key must be 64 hex characters (0x prefix optional)',
			);
		});

		it('should throw error for invalid gas limit multiplier', function () {
			const invalidConfig = { ...config, gasLimitMultiplier: 3.0 };

			expect(() => (RPCDiamondDeployer as any).validateConfig(invalidConfig)).to.throw(
				'Gas limit multiplier must be between 1.0 and 2.0',
			);
		});

		it('should throw error for invalid max retries', function () {
			const invalidConfig = { ...config, maxRetries: 15 };

			expect(() => (RPCDiamondDeployer as any).validateConfig(invalidConfig)).to.throw(
				'Max retries must be between 1 and 10',
			);
		});

		it('should throw error for invalid retry delay', function () {
			const invalidConfig = { ...config, retryDelayMs: 50000 };

			expect(() => (RPCDiamondDeployer as any).validateConfig(invalidConfig)).to.throw(
				'Retry delay must be between 100ms and 30000ms',
			);
		});
	});

	describe('Environment Configuration', function () {
		it('should create configuration from environment variables', function () {
			const envConfig = RPCDiamondDeployer.createConfigFromEnv();

			expect(envConfig.diamondName).to.equal('GeniusDiamond');
			expect(envConfig.rpcUrl).to.equal('http://localhost:8545');
			expect(envConfig.privateKey).to.equal(
				'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
			);
			expect(envConfig.networkName).to.equal('localhost');
		});

		it('should throw error for missing required environment variables', function () {
			delete process.env.DIAMOND_NAME;

			expect(() => RPCDiamondDeployer.createConfigFromEnv()).to.throw(
				'Missing required environment variable: DIAMOND_NAME',
			);

			// Restore for other tests
			process.env.DIAMOND_NAME = 'GeniusDiamond';
		});

		it('should apply overrides to environment configuration', function () {
			const overrides = {
				diamondName: 'OverriddenDiamond',
				verbose: true,
			};

			const envConfig = RPCDiamondDeployer.createConfigFromEnv(overrides);

			expect(envConfig.diamondName).to.equal('OverriddenDiamond');
			expect(envConfig.verbose).to.equal(true);
			expect(envConfig.rpcUrl).to.equal('http://localhost:8545'); // Should keep env value
		});
	});

	describe('Singleton Pattern', function () {
		it('should create singleton instance', async function () {
			// Mock network calls to avoid actual network requests
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

			const instance1 = await RPCDiamondDeployer.getInstance(config);
			const instance2 = await RPCDiamondDeployer.getInstance(config);

			expect(instance1).to.equal(instance2);
		});

		it('should create different instances for different configurations', async function () {
			// Mock network calls
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

			const config1 = { ...config, networkName: 'localhost' };
			const config2 = { ...config, networkName: 'sepolia', chainId: 11155111 };

			const instance1 = await RPCDiamondDeployer.getInstance(config1);
			const instance2 = await RPCDiamondDeployer.getInstance(config2);

			expect(instance1).to.not.equal(instance2);
		});
	});

	describe('Deployment Status', function () {
		let deployer: RPCDiamondDeployer;

		beforeEach(async function () {
			// Mock network calls
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

			deployer = await RPCDiamondDeployer.getInstance(config);
		});

		it('should return NOT_STARTED status initially', function () {
			const status = deployer.getDeploymentStatus();
			expect(status).to.equal(DeploymentStatus.NOT_STARTED);
		});

		it('should report diamond not deployed initially', function () {
			const isDeployed = deployer.isDiamondDeployed();
			expect(isDeployed).to.be.false;
		});

		it('should return COMPLETED status when deployment is complete', async function () {
			// Mock the diamond and deployment data
			const mockDiamond = {
				getDeployedDiamondData: () => ({
					DiamondAddress: '0x1234567890abcdef1234567890abcdef12345678',
					protocolVersion: 1,
				}),
				getDeployConfig: () => ({ protocolVersion: 1 }),
			};

			// Access private property for testing
			(deployer as any).diamond = mockDiamond;
			(deployer as any).deployComplete = true;

			const status = deployer.getDeploymentStatus();
			expect(status).to.equal(DeploymentStatus.COMPLETED);
		});

		it('should return UPGRADE_AVAILABLE status when newer protocol version exists', async function () {
			// Mock the diamond and deployment data with version mismatch
			const mockDiamond = {
				getDeployedDiamondData: () => ({
					DiamondAddress: '0x1234567890abcdef1234567890abcdef12345678',
					protocolVersion: 1,
				}),
				getDeployConfig: () => ({ protocolVersion: 2 }),
			};

			(deployer as any).diamond = mockDiamond;
			(deployer as any).deployComplete = true;

			const status = deployer.getDeploymentStatus();
			expect(status).to.equal(DeploymentStatus.UPGRADE_AVAILABLE);
		});

		it('should return IN_PROGRESS status during deployment', function () {
			(deployer as any).deployInProgress = true;
			(deployer as any).deployComplete = false;

			const status = deployer.getDeploymentStatus();
			expect(status).to.equal(DeploymentStatus.IN_PROGRESS);
		});
	});

	describe('Configuration Validation', function () {
		let deployer: RPCDiamondDeployer;

		beforeEach(async function () {
			// Mock network calls
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

			deployer = await RPCDiamondDeployer.getInstance(config);
		});

		it('should validate configuration successfully with valid setup', async function () {
			// Mock provider's getNetwork method on the deployer instance
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			const mockDiamond = {
				getDeployConfig: () => ({
					facets: {
						DiamondCutFacet: {},
						DiamondLoupeFacet: {},
					},
				}),
			};

			// Replace provider and diamond on the deployer instance
			(deployer as any).provider = mockProvider;
			(deployer as any).diamond = mockDiamond;

			const validation = await deployer.validateConfiguration();

			expect(validation.valid).to.be.true;
			expect(validation.errors).to.be.empty;
		});

		it('should report validation errors when diamond is not initialized', async function () {
			(deployer as any).diamond = null;

			const validation = await deployer.validateConfiguration();

			expect(validation.valid).to.be.false;
			expect(validation.errors).to.include('Diamond instance not initialized');
		});

		it('should report validation errors when no facets are configured', async function () {
			const mockStrategy = {
				validateConnection: sandbox.stub().resolves(),
			};

			const mockDiamond = {
				getDeployConfig: () => ({ facets: {} }),
			};

			(deployer as any).strategy = mockStrategy;
			(deployer as any).diamond = mockDiamond;

			const validation = await deployer.validateConfiguration();

			expect(validation.valid).to.be.false;
			expect(validation.errors).to.include('No facets configured for deployment');
		});

		it('should report validation errors when network validation fails', async function () {
			// Mock provider's getNetwork to reject
			const mockProvider = {
				getNetwork: sandbox.stub().rejects(new Error('Network connection failed')),
			};

			const mockDiamond = {
				getDeployConfig: () => ({
					facets: { DiamondCutFacet: {} },
				}),
			};

			// Replace provider and diamond on the deployer instance
			(deployer as any).provider = mockProvider;
			(deployer as any).diamond = mockDiamond;

			const validation = await deployer.validateConfiguration();

			expect(validation.valid).to.be.false;
			expect(validation.errors.some((e) => e.includes('Network validation failed'))).to.be
				.true;
		});
	});

	describe('Network Information', function () {
		let deployer: RPCDiamondDeployer;

		beforeEach(async function () {
			// Mock network calls
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

			deployer = await RPCDiamondDeployer.getInstance(config);
		});

		it('should return network information', async function () {
			// Mock provider methods
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ chainId: 31337n }),
				getBalance: sandbox.stub().resolves(ethers.parseEther('1.0')),
				getFeeData: sandbox.stub().resolves({ gasPrice: ethers.parseUnits('20', 'gwei') }),
				getBlockNumber: sandbox.stub().resolves(12345),
			};

			const mockSigner = {
				getAddress: sandbox.stub().resolves('0x1234567890abcdef1234567890abcdef12345678'),
			};

			(deployer as any).provider = mockProvider;
			(deployer as any).signer = mockSigner;

			const networkInfo = await deployer.getNetworkInfo();

			expect(networkInfo.networkName).to.equal('localhost');
			expect(networkInfo.chainId).to.equal(31337);
			expect(networkInfo.signerAddress).to.equal(
				'0x1234567890abcdef1234567890abcdef12345678',
			);
			expect(networkInfo.balance).to.equal(ethers.parseEther('1.0').toString());
			expect(networkInfo.blockNumber).to.equal(12345);
		});
	});

	describe('Verbose Logging', function () {
		let deployer: RPCDiamondDeployer;

		beforeEach(async function () {
			// Mock network calls
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

			deployer = await RPCDiamondDeployer.getInstance(config);
		});

		it('should enable and disable verbose logging', async function () {
			expect((deployer as any).verbose).to.be.false;

			await deployer.setVerbose(true);
			expect((deployer as any).verbose).to.be.true;

			await deployer.setVerbose(false);
			expect((deployer as any).verbose).to.be.false;
		});
	});

	describe('Configuration Access', function () {
		let deployer: RPCDiamondDeployer;

		beforeEach(async function () {
			// Mock network calls
			const mockProvider = {
				getNetwork: sandbox.stub().resolves({ name: 'localhost', chainId: 31337n }),
			};

			sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider as any);

			deployer = await RPCDiamondDeployer.getInstance(config);
		});

		it('should return configuration copy', function () {
			const returnedConfig = deployer.getConfig();

			expect(returnedConfig.diamondName).to.equal(config.diamondName);
			expect(returnedConfig.rpcUrl).to.equal(config.rpcUrl);
			expect(returnedConfig.networkName).to.equal(config.networkName);

			// Ensure it's a copy, not the original
			returnedConfig.diamondName = 'Modified';
			expect(deployer.getConfig().diamondName).to.equal(config.diamondName);
		});

		it('should return strategy instance', function () {
			const strategy = deployer.getStrategy();
			expect(strategy).to.exist;
		});

		it('should return repository instance', function () {
			const repository = deployer.getRepository();
			expect(repository).to.exist;
		});
	});
});
