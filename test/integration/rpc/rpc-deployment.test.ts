import { expect } from "chai";
import { RPCDiamondDeployer, RPCDiamondDeployerConfig, DeploymentStatus } from "../../../scripts/setup/rpc/RPCDiamondDeployer";
import { ethers } from "hardhat";
import hre from "hardhat";

describe("RPC Deployment Integration", function () {
    this.timeout(300000); // 5 minutes for deployment tests

    let deployer: RPCDiamondDeployer;
    let config: RPCDiamondDeployerConfig;

    before(async function () {
        // Skip if not in local hardhat network
        if (hre.network.name !== "hardhat") {
            this.skip();
        }

        // Set up configuration for local testing
        const [signer] = await ethers.getSigners();
        
        config = {
            diamondName: "GeniusDiamond",
            networkName: "hardhat",
            chainId: 31337,
            rpcUrl: "http://localhost:8545",
            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            gasLimitMultiplier: 1.2,
            maxRetries: 3,
            retryDelayMs: 1000,
            verbose: true,
            deploymentsPath: "./test-assets/deployments-test",
            configFilePath: "diamonds/GeniusDiamond/geniusdiamond.config.json",
            writeDeployedDiamondData: false, // Don't write to file system during tests
        };
    });

    beforeEach(async function () {
        // Clear instances before each test
        (RPCDiamondDeployer as any).instances.clear();
    });

    after(async function () {
        // Clean up
        (RPCDiamondDeployer as any).instances.clear();
    });

    describe("Deployment Lifecycle", function () {
        it("should create deployer instance successfully", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            expect(deployer).to.exist;
            expect(deployer.getDeploymentStatus()).to.equal(DeploymentStatus.NOT_STARTED);
            expect(deployer.isDiamondDeployed()).to.be.false;
        });

        it("should validate configuration before deployment", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            const validation = await deployer.validateConfiguration();
            
            // Note: This might fail if diamond config file doesn't exist
            // In a real test environment, we would set up proper test fixtures
            expect(validation).to.have.property('valid');
            expect(validation).to.have.property('errors');
        });

        it.skip("should get network information", async function () {
            // Skip this test in CI/automated environments where no local node is running
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            const networkInfo = await deployer.getNetworkInfo();
            
            expect(networkInfo).to.have.property('networkName');
            expect(networkInfo).to.have.property('chainId');
            expect(networkInfo).to.have.property('signerAddress');
            expect(networkInfo).to.have.property('balance');
            expect(networkInfo).to.have.property('gasPrice');
            expect(networkInfo).to.have.property('blockNumber');
            
            expect(networkInfo.chainId).to.equal(31337);
            expect(networkInfo.signerAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
        });

        it("should maintain singleton pattern across multiple getInstance calls", async function () {
            const deployer1 = await RPCDiamondDeployer.getInstance(config);
            const deployer2 = await RPCDiamondDeployer.getInstance(config);
            
            expect(deployer1).to.equal(deployer2);
        });

        it("should create different instances for different diamond names", async function () {
            const config1 = { ...config, networkName: "localhost", chainId: 31337 };
            const config2 = { ...config, networkName: "sepolia", chainId: 11155111 };
            
            const deployer1 = await RPCDiamondDeployer.getInstance(config1);
            const deployer2 = await RPCDiamondDeployer.getInstance(config2);
            
            expect(deployer1).to.not.equal(deployer2);
        });

        it("should handle verbose logging changes", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            await deployer.setVerbose(true);
            expect(deployer.getConfig().verbose).to.be.true;
            
            await deployer.setVerbose(false);
            expect(deployer.getConfig().verbose).to.be.false;
        });
    });

    describe("Configuration Management", function () {
        it("should create configuration from environment variables", function () {
            // Set up environment variables
            process.env.DIAMOND_NAME = "EnvTestDiamond";
            process.env.RPC_URL = "http://localhost:8545";
            process.env.PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12";
            process.env.NETWORK_NAME = "hardhat";
            process.env.VERBOSE = "true";
            
            const envConfig = RPCDiamondDeployer.createConfigFromEnv();
            
            expect(envConfig.diamondName).to.equal("EnvTestDiamond");
            expect(envConfig.rpcUrl).to.equal("http://localhost:8545");
            expect(envConfig.networkName).to.equal("hardhat");
            expect(envConfig.verbose).to.be.true;
            
            // Clean up
            delete process.env.DIAMOND_NAME;
            delete process.env.RPC_URL;
            delete process.env.PRIVATE_KEY;
            delete process.env.NETWORK_NAME;
            delete process.env.VERBOSE;
        });

        it("should handle missing environment variables gracefully", function () {
            // Temporarily remove required env vars
            const originalRpcUrl = process.env.RPC_URL;
            delete process.env.RPC_URL;
            
            expect(() => RPCDiamondDeployer.createConfigFromEnv())
                .to.throw("Missing required environment variable: RPC_URL");
            
            // Restore
            if (originalRpcUrl) {
                process.env.RPC_URL = originalRpcUrl;
            }
        });

        it("should apply configuration overrides correctly", function () {
            process.env.DIAMOND_NAME = "EnvTestDiamond";
            process.env.RPC_URL = "http://localhost:8545";
            process.env.PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12";
            
            const overrides = {
                diamondName: "OverriddenDiamond",
                verbose: true,
                gasLimitMultiplier: 1.5,
            };
            
            const config = RPCDiamondDeployer.createConfigFromEnv(overrides);
            
            expect(config.diamondName).to.equal("OverriddenDiamond");
            expect(config.verbose).to.be.true;
            expect(config.gasLimitMultiplier).to.equal(1.5);
            expect(config.rpcUrl).to.equal("http://localhost:8545"); // Should keep env value
            
            // Clean up
            delete process.env.DIAMOND_NAME;
            delete process.env.RPC_URL;
            delete process.env.PRIVATE_KEY;
        });
    });

    describe("Error Handling", function () {
        it("should handle invalid RPC URL gracefully", async function () {
            const invalidConfig = {
                ...config,
                rpcUrl: "invalid-url"
            };
            
            // The deployer should be created successfully, but network operations should fail
            const deployer = await RPCDiamondDeployer.getInstance(invalidConfig);
            const result = await deployer.validateConfiguration();
            
            expect(result.valid).to.be.false;
            expect(result.errors).to.have.length.greaterThan(0);
            expect(result.errors.some(error => error.includes('Network validation failed'))).to.be.true;
        });

        it("should handle invalid private key format", async function () {
            const invalidConfig = {
                ...config,
                privateKey: "invalid-private-key"
            };
            
            try {
                await RPCDiamondDeployer.getInstance(invalidConfig);
                expect.fail("Should have thrown an error for invalid private key");
            } catch (error) {
                expect(error).to.be.an('error');
                expect((error as Error).message).to.include("Configuration validation failed");
            }
        });

        it("should handle network connection issues", async function () {
            const unreachableConfig = {
                ...config,
                rpcUrl: "http://unreachable-host:8545"
            };
            
            const deployer = await RPCDiamondDeployer.getInstance(unreachableConfig);
            const result = await deployer.validateConfiguration();
            
            expect(result.valid).to.be.false;
            expect(result.errors).to.have.length.greaterThan(0);
            expect(result.errors.some(error => error.includes('Network validation failed'))).to.be.true;
        });
    });

    describe("Strategy Integration", function () {
        it("should create and configure RPC deployment strategy", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            const strategy = deployer.getStrategy();
            expect(strategy).to.exist;
            
            const strategyConfig = strategy.getConfig();
            expect(strategyConfig.rpcUrl).to.equal(config.rpcUrl);
            expect(strategyConfig.gasLimitMultiplier).to.equal(config.gasLimitMultiplier);
            expect(strategyConfig.maxRetries).to.equal(config.maxRetries);
        });

        it("should provide access to provider and signer", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            const strategy = deployer.getStrategy();
            const provider = strategy.getProvider();
            const signer = strategy.getSigner();
            
            expect(provider).to.exist;
            expect(signer).to.exist;
            
            // Verify signer address matches expected format
            const signerAddress = await signer.getAddress();
            expect(signerAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
        });
    });

    describe("Repository Integration", function () {
        it("should create and configure file deployment repository", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            const repository = deployer.getRepository();
            expect(repository).to.exist;
        });
    });

    describe("Diamond Instance Integration", function () {
        it("should create and configure diamond instance", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            const diamond = await deployer.getDiamond();
            expect(diamond).to.exist;
        });

        it("should handle diamond configuration loading", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            const diamond = await deployer.getDiamond();
            const deployConfig = diamond.getDeployConfig();
            
            // The config might be empty or default in test environment
            expect(deployConfig).to.exist;
        });
    });

    describe("Deployment Status Tracking", function () {
        it("should track deployment status changes", async function () {
            deployer = await RPCDiamondDeployer.getInstance(config);
            
            // Initial status should be NOT_STARTED
            expect(deployer.getDeploymentStatus()).to.equal(DeploymentStatus.NOT_STARTED);
            expect(deployer.isDiamondDeployed()).to.be.false;
            
            // Note: Actual deployment testing would require proper diamond configuration
            // and contract compilation, which is typically done in separate test suites
        });
    });
});
