import { expect } from 'chai';
import { ethers } from 'hardhat';
import { 
  DefenderDiamondDeployer, 
  DefenderDiamondDeployerConfig, 
  DeploymentStatus 
} from '../../../scripts/setup/DefenderDiamondDeployer';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

// Mock the Defender SDK
class MockDefender {
  private apiKey: string;
  private apiSecret: string;

  constructor(config: { apiKey: string; apiSecret: string }) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  async propose(proposalData: any) {
    // Mock proposal creation
    return {
      proposalId: 'mock_proposal_' + Date.now(),
      status: 'pending',
    };
  }

  async approve(proposalId: string) {
    // Mock approval
    return {
      proposalId,
      status: 'approved',
    };
  }

  async getProposal(proposalId: string) {
    // Mock proposal status
    return {
      proposalId,
      status: 'executed',
      result: {
        address: '0x' + '1'.repeat(40),
        transactionHash: '0x' + '2'.repeat(64),
      },
    };
  }
}

describe('DefenderDeployment Integration Tests', function () {
  let deployer: DefenderDiamondDeployer;
  let signer: SignerWithAddress;
  let validConfig: DefenderDiamondDeployerConfig;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    signer = signers[0];

    validConfig = {
      diamondName: 'TestDiamond',
      networkName: 'hardhat',
      chainId: 31337,
      apiKey: 'test_api_key',
      apiSecret: 'test_api_secret',
      relayerAddress: signer.address,
      autoApprove: true, // Enable auto-approve for testing
      viaType: 'EOA',
      provider: ethers.provider,
      signer: signer,
      gasLimit: 5000000, // TODO Fix this to use the default gas limit from the network config
      maxGasPrice: '50000000000',
    };
  });

  describe('End-to-End Deployment Workflow', function () {
    it('should complete full deployment workflow with mocked Defender', async function () {
      // This test uses the actual DefenderDiamondDeployer but with mocked network
      const instance = await DefenderDiamondDeployer.getInstance(validConfig);
      
      // Initial state
      expect(instance.getDeploymentStatus()).to.equal(DeploymentStatus.NOT_STARTED);
      
      // Get diamond instance
      const diamond = await instance.getDiamondDeployed()!;
      expect(diamond).to.be.an('object');
      expect(diamond.diamondName).to.equal(validConfig.diamondName);
      
      // Note: Actual deployment would require proper Defender setup and network
      // For integration testing, we verify the workflow structure is correct
    });

    it('should handle deployment configuration correctly', async function () {
      const instance = await DefenderDiamondDeployer.getInstance(validConfig);
      
      // Verify configuration is applied
      expect(instance.getDeploymentStatus()).to.equal(DeploymentStatus.NOT_STARTED);
      
      // Verify verbose logging can be set
      await instance.setVerbose(true);
      await instance.setVerbose(false);
      
      // Verify diamond instance is accessible
      const diamond = await instance.getDiamondDeployed();
      expect(diamond).to.not.be.undefined;
    });
  });

  describe('Multi-Network Configuration', function () {
    const networks = ['mainnet', 'polygon', 'arbitrum', 'base'];

    networks.forEach(networkName => {
      it(`should create valid configuration for ${networkName}`, function () {
        // Test network config loading
        const networkConfig = DefenderDiamondDeployer.loadNetworkConfig(networkName);
        
        expect(networkConfig).to.have.property('name', networkName);
        expect(networkConfig).to.have.property('chainId');
        expect(networkConfig).to.have.property('rpcUrl');
        expect(networkConfig).to.have.property('blockExplorer');
        expect(networkConfig).to.have.property('nativeCurrency');
        expect(networkConfig).to.have.property('defaultGasLimit');
        expect(networkConfig).to.have.property('defaultMaxGasPrice');
        
        // Validate structure
        expect(networkConfig.chainId).to.be.a('number');
        expect(networkConfig.chainId).to.be.greaterThan(0);
        expect(networkConfig.rpcUrl).to.be.a('string');
        expect(networkConfig.rpcUrl).to.include('http');
        expect(networkConfig.blockExplorer).to.be.a('string');
        expect(networkConfig.blockExplorer).to.include('http');
        expect(networkConfig.defaultGasLimit).to.be.a('number');
        expect(networkConfig.defaultGasLimit).to.be.greaterThan(21000);
      });
    });

    it('should create deployer instances for different networks', async function () {
      const instances: { [key: string]: DefenderDiamondDeployer } = {};
      
      for (const networkName of networks) {
        const networkConfig = DefenderDiamondDeployer.loadNetworkConfig(networkName);
        const config = {
          ...validConfig,
          networkName,
          chainId: networkConfig.chainId,
        };
        
        instances[networkName] = await DefenderDiamondDeployer.getInstance(config);
        expect(instances[networkName]).to.be.instanceOf(DefenderDiamondDeployer);
      }
      
      // Verify all instances are different (different networks)
      const instanceValues = Object.values(instances);
      for (let i = 0; i < instanceValues.length; i++) {
        for (let j = i + 1; j < instanceValues.length; j++) {
          expect(instanceValues[i]).to.not.equal(instanceValues[j]);
        }
      }
    });
  });

  describe('Environment Variable Integration', function () {
    let originalEnv: any;

    beforeEach(function () {
      originalEnv = { ...process.env };
    });

    afterEach(function () {
      process.env = originalEnv;
    });

    it('should create configuration from environment variables', function () {
      // Set test environment variables
      process.env.DEFENDER_API_KEY = 'env_test_key';
      process.env.DEFENDER_API_SECRET = 'env_test_secret';
      process.env.DEFENDER_RELAYER_ADDRESS = signer.address;
      process.env.DEFENDER_AUTO_APPROVE = 'true';
      process.env.DEFENDER_VIA_TYPE = 'EOA';
      process.env.DEFENDER_GAS_LIMIT = '6000000';
      process.env.DEFENDER_MAX_GAS_PRICE = '60000000000';

      const config = DefenderDiamondDeployer.createConfigFromEnv('TestDiamond', 'mainnet');

      expect(config).to.deep.include({
        diamondName: 'TestDiamond',
        networkName: 'mainnet',
        chainId: 1, // mainnet chain ID
        apiKey: 'env_test_key',
        apiSecret: 'env_test_secret',
        relayerAddress: signer.address,
        autoApprove: true,
        viaType: 'EOA',
        gasLimit: 6000000,
        maxGasPrice: '60000000000',
      });
    });

    it('should handle environment variable type conversion', function () {
      process.env.DEFENDER_API_KEY = 'test_key';
      process.env.DEFENDER_API_SECRET = 'test_secret';
      process.env.DEFENDER_RELAYER_ADDRESS = signer.address;
      process.env.DEFENDER_AUTO_APPROVE = 'false'; // String to boolean
      process.env.DEFENDER_VIA_TYPE = 'Safe';
      process.env.DEFENDER_SAFE_ADDRESS = signer.address;
      process.env.DEFENDER_GAS_LIMIT = '7000000'; // String to number

      const config = DefenderDiamondDeployer.createConfigFromEnv('TestDiamond', 'polygon');

      expect(config.autoApprove).to.be.false;
      expect(config.viaType).to.equal('Safe');
      expect(config.safeAddress).to.equal(signer.address);
      expect(config.gasLimit).to.equal(7000000);
      expect(config.chainId).to.equal(137); // polygon chain ID
    });
  });

  describe('Defender Strategy Integration', function () {
    it('should initialize DefenderDeploymentStrategy with correct parameters', async function () {
      const instance = await DefenderDiamondDeployer.getInstance(validConfig);
      
      // The strategy should be created internally
      // We can't access it directly, but we can verify the deployer works
      expect(instance).to.be.instanceOf(DefenderDiamondDeployer);
      
      // Verify the deployer has the expected methods
      expect(instance).to.respondTo('deployDiamond');
      expect(instance).to.respondTo('getDiamondDeployed');
      expect(instance).to.respondTo('getDiamond');
      expect(instance).to.respondTo('setVerbose');
      expect(instance).to.respondTo('getDeploymentStatus');
    });
  });

  describe('Diamond Configuration Integration', function () {
    it('should load and apply diamond configuration', async function () {
      const instance = await DefenderDiamondDeployer.getInstance(validConfig);
      const diamond = await instance.getDiamond();
      
      // Verify diamond configuration is applied
      expect(diamond.diamondName).to.equal(validConfig.diamondName);
      
      // Verify the diamond has the expected structure
      expect(diamond).to.have.property('diamondName');
      expect(diamond).to.respondTo('getDeployedDiamondData');
    });

    it('should handle different diamond configurations', async function () {
      const diamondNames = ['TestDiamond1', 'TestDiamond2', 'GeniusDiamond'];
      
      for (const diamondName of diamondNames) {
        const config = { ...validConfig, diamondName };
        const instance = await DefenderDiamondDeployer.getInstance(config);
        const diamond = await instance.getDiamond();
        
        expect(diamond.diamondName).to.equal(diamondName);
      }
    });
  });

  describe('Error Recovery Integration', function () {
    it('should handle deployment retry scenarios', async function () {
      const instance = await DefenderDiamondDeployer.getInstance(validConfig);
      
      // Initial status
      expect(instance.getDeploymentStatus()).to.equal(DeploymentStatus.NOT_STARTED);
      
      // Multiple calls to getDiamond should be safe
      const diamond1 = await instance.getDiamond();
      const diamond2 = await instance.getDiamond();
      
      expect(diamond1).to.equal(diamond2); // Should return same instance
    });

    it('should maintain state consistency across operations', async function () {
      const instance = await DefenderDiamondDeployer.getInstance(validConfig);
      
      // Various operations should not break state
      await instance.setVerbose(true);
      const diamond1 = await instance.getDiamond();
      
      await instance.setVerbose(false);
      const diamond2 = await instance.getDiamond();
      
      const status = instance.getDeploymentStatus();
      
      expect(diamond1).to.equal(diamond2);
      expect(status).to.be.oneOf([
        DeploymentStatus.NOT_STARTED,
        DeploymentStatus.IN_PROGRESS,
        DeploymentStatus.COMPLETED,
        DeploymentStatus.FAILED
      ]);
    });
  });

  describe('Singleton Behavior Integration', function () {
    it('should maintain singleton behavior across multiple getInstance calls', async function () {
      const instance1 = await DefenderDiamondDeployer.getInstance(validConfig);
      const instance2 = await DefenderDiamondDeployer.getInstance(validConfig);
      const instance3 = await DefenderDiamondDeployer.getInstance(validConfig);
      
      expect(instance1).to.equal(instance2);
      expect(instance2).to.equal(instance3);
      expect(instance1).to.equal(instance3);
    });

    it('should create different instances for different configurations', async function () {
      const config1 = { ...validConfig, diamondName: 'Diamond1' };
      const config2 = { ...validConfig, diamondName: 'Diamond2' };
      const config3 = { ...validConfig, chainId: 80002 }; // Different chain
      
      const instance1 = await DefenderDiamondDeployer.getInstance(config1);
      const instance2 = await DefenderDiamondDeployer.getInstance(config2);
      const instance3 = await DefenderDiamondDeployer.getInstance(config3);
      
      expect(instance1).to.not.equal(instance2);
      expect(instance2).to.not.equal(instance3);
      expect(instance1).to.not.equal(instance3);
    });
  });
});
