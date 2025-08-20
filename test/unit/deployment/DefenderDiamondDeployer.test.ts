import { expect } from "chai";
import { DefenderDiamondDeployer, DefenderDiamondDeployerConfig, DeploymentStatus } from "../../../scripts/setup/DefenderDiamondDeployer";
import { ethers } from "hardhat";

describe("DefenderDiamondDeployer", function () {
    this.timeout(60000);

    let config: DefenderDiamondDeployerConfig;
    
    before(async function () {
        // Set up test environment variables
        process.env.DEFENDER_API_KEY = "test-api-key";
        process.env.DEFENDER_API_SECRET = "test-secret-key";
        process.env.DEFENDER_RELAYER_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
        process.env.DEFENDER_SAFE_ADDRESS = "0x9876543210fedcba9876543210fedcba98765432";
        process.env.NETWORK = "sepolia";
        process.env.DIAMOND_NAME = "GeniusDiamond";
        
        config = {
            diamondName: "GeniusDiamond",
            networkName: "sepolia",
            chainId: 11155111,
            apiKey: "test-api-key",
            apiSecret: "test-secret-key",
            relayerAddress: "0x1234567890abcdef1234567890abcdef12345678",
            via: "0x9876543210fedcba9876543210fedcba98765432",
            viaType: "Safe",
            autoApprove: false,
            verbose: false,
            deploymentsPath: "./test-assets/deployments-test",
            configFilePath: "diamonds/GeniusDiamond/geniusdiamond.config.json"
        };
    });

    after(async function () {
        // Clean up environment variables
        delete process.env.DEFENDER_API_KEY;
        delete process.env.DEFENDER_API_SECRET;
        delete process.env.DEFENDER_RELAYER_ADDRESS;
        delete process.env.DEFENDER_SAFE_ADDRESS;
        delete process.env.NETWORK;
        delete process.env.DIAMOND_NAME;
        
        // Clear singleton instances after tests
        DefenderDiamondDeployer.clearInstances();
    });

    describe("Configuration Validation", function () {
        it("should validate required configuration fields", function () {
            const validConfig: DefenderDiamondDeployerConfig = {
                diamondName: "GeniusDiamond",
                networkName: "sepolia",
                chainId: 11155111,
                apiKey: "test-api-key",
                apiSecret: "test-secret-key",
                relayerAddress: "0x1234567890abcdef1234567890abcdef12345678",
                via: "0x9876543210fedcba9876543210fedcba98765432",
                viaType: "Safe",
                autoApprove: false,
                deploymentsPath: "./test-assets/deployments-test",
                configFilePath: "diamonds/GeniusDiamond/geniusdiamond.config.json"
            };

            expect(validConfig.diamondName).to.equal("GeniusDiamond");
            expect(validConfig.apiKey).to.equal("test-api-key");
            expect(validConfig.apiSecret).to.equal("test-secret-key");
            expect(validConfig.relayerAddress).to.equal("0x1234567890abcdef1234567890abcdef12345678");
            expect(validConfig.networkName).to.equal("sepolia");
            expect(validConfig.via).to.equal("0x9876543210fedcba9876543210fedcba98765432");
            expect(validConfig.viaType).to.equal("Safe");
        });

        it("should accept Safe multisig configuration", function () {
            const safeConfig: DefenderDiamondDeployerConfig = {
                diamondName: "GeniusDiamond",
                networkName: "sepolia",
                chainId: 11155111,
                apiKey: "test-api-key",
                apiSecret: "test-secret-key",
                relayerAddress: "0x1234567890abcdef1234567890abcdef12345678",
                via: "0x9876543210fedcba9876543210fedcba98765432",
                viaType: "Safe",
                deploymentsPath: "./test-assets/deployments-test",
                configFilePath: "diamonds/GeniusDiamond/geniusdiamond.config.json"
            };

            expect(safeConfig.via).to.equal("0x9876543210fedcba9876543210fedcba98765432");
            expect(safeConfig.viaType).to.equal("Safe");
        });

        it("should accept EOA wallet configuration", function () {
            const eoaConfig: DefenderDiamondDeployerConfig = {
                diamondName: "GeniusDiamond",
                networkName: "sepolia",
                chainId: 11155111,
                apiKey: "test-api-key",
                apiSecret: "test-secret-key",
                relayerAddress: "0x1234567890abcdef1234567890abcdef12345678",
                via: "0x5555555555555555555555555555555555555555",
                viaType: "EOA",
                deploymentsPath: "./test-assets/deployments-test",
                configFilePath: "diamonds/GeniusDiamond/geniusdiamond.config.json"
            };

            expect(eoaConfig.via).to.equal("0x5555555555555555555555555555555555555555");
            expect(eoaConfig.viaType).to.equal("EOA");
        });
    });

    describe("Environment Variable Loading", function () {
        it("should create configuration from environment variables", function () {
            const configFromEnv = DefenderDiamondDeployer.createConfigFromEnv({ networkName: "sepolia" });
            
            expect(configFromEnv.apiKey).to.equal("test-api-key");
            expect(configFromEnv.apiSecret).to.equal("test-secret-key");
            expect(configFromEnv.relayerAddress).to.equal("0x1234567890abcdef1234567890abcdef12345678");
            expect(configFromEnv.networkName).to.equal("sepolia");
            expect(configFromEnv.via).to.equal("0x9876543210fedcba9876543210fedcba98765432");
            expect(configFromEnv.viaType).to.equal("Safe");
        });

        it("should throw error when trying to create instance with invalid config", async function () {
            delete process.env.DEFENDER_API_KEY;
            
            const configFromEnv = DefenderDiamondDeployer.createConfigFromEnv({ networkName: "sepolia" });
            
            try {
                await DefenderDiamondDeployer.getInstance(configFromEnv);
                expect.fail("Should have thrown error for missing API key");
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.include("Defender API key is required");
            }
            
            // Restore for other tests
            process.env.DEFENDER_API_KEY = "test-api-key";
        });
    });

    describe("Singleton Pattern", function () {
        it("should return the same instance for the same configuration", async function () {
            const instance1 = await DefenderDiamondDeployer.getInstance(config);
            const instance2 = await DefenderDiamondDeployer.getInstance(config);
            
            expect(instance1).to.equal(instance2);
        });

        it("should create new instance for different network", async function () {
            const config1 = { ...config, networkName: "sepolia", chainId: 11155111 };
            const config2 = { ...config, networkName: "polygon", chainId: 137 };
            
            const instance1 = await DefenderDiamondDeployer.getInstance(config1);
            const instance2 = await DefenderDiamondDeployer.getInstance(config2);
            
            expect(instance1).to.not.equal(instance2);
        });

        it("should create new instance for different via configuration", async function () {
            const config1 = { 
                ...config, 
                via: "0x1111111111111111111111111111111111111111", 
                viaType: "EOA" as const,
                defenderDiamondDeployerKey: "test-key-1"
            };
            const config2 = { 
                ...config, 
                via: "0x2222222222222222222222222222222222222222", 
                viaType: "Safe" as const,
                defenderDiamondDeployerKey: "test-key-2"
            };
            
            const instance1 = await DefenderDiamondDeployer.getInstance(config1);
            const instance2 = await DefenderDiamondDeployer.getInstance(config2);
            
            expect(instance1).to.not.equal(instance2);
        });
    });

    describe("Deployment Status", function () {
        it("should have correct initial deployment status", async function () {
            const deployer = await DefenderDiamondDeployer.getInstance(config);
            const status = deployer.getDeploymentStatus();
            
            expect(status).to.equal(DeploymentStatus.NOT_STARTED);
            expect(deployer.isDiamondDeployed()).to.be.false;
        });

        it("should return undefined for diamond when not deployed", async function () {
            const deployer = await DefenderDiamondDeployer.getInstance(config);
            const diamond = deployer.getDiamondDeployed();
            
            expect(diamond).to.be.undefined;
        });
    });

    describe("Configuration Management", function () {
        it("should allow setting verbose mode", async function () {
            const deployer = await DefenderDiamondDeployer.getInstance(config);
            
            expect(() => deployer.setVerbose(true)).to.not.throw();
            expect(() => deployer.setVerbose(false)).to.not.throw();
        });

        it("should return current configuration", async function () {
            const deployer = await DefenderDiamondDeployer.getInstance(config);
            const currentConfig = deployer.getConfig();
            
            expect(currentConfig).to.not.be.undefined;
            expect(currentConfig.diamondName).to.equal("GeniusDiamond");
            expect(currentConfig.networkName).to.equal("sepolia");
        });
    });

    describe("Static Methods", function () {
        it("should clear instances when needed", function () {
            expect(() => DefenderDiamondDeployer.clearInstances()).to.not.throw();
        });

        it("should return instances map", function () {
            const instances = DefenderDiamondDeployer.getInstances();
            expect(instances).to.be.instanceOf(Map);
        });
    });

    describe("Error Handling", function () {
        it("should handle invalid API credentials", async function () {
            const invalidConfig = {
                ...config,
                apiKey: "",
                apiSecret: ""
            };
            
            try {
                await DefenderDiamondDeployer.getInstance(invalidConfig);
                expect.fail("Should have thrown error for invalid config");
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });

        it("should handle invalid network name", async function () {
            const invalidConfig = {
                ...config,
                networkName: "",
                chainId: 0
            };
            
            try {
                await DefenderDiamondDeployer.getInstance(invalidConfig);
                expect.fail("Should have thrown error for invalid network");
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });

        it("should handle invalid via configuration", async function () {
            const invalidConfig = {
                ...config,
                via: "",
                viaType: "Safe" as const
            };
            
            try {
                await DefenderDiamondDeployer.getInstance(invalidConfig);
                expect.fail("Should have thrown error for invalid via config");
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });
    });
});
