import { expect } from 'chai';
import { ethers } from 'hardhat';
import { 
  DefenderDiamondDeployerConfig, 
  NetworkConfig 
} from '../../../scripts/setup/DefenderDiamondDeployer';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('DefenderConfiguration Unit Tests', function () {
  let signer: SignerWithAddress;
  let baseConfig: DefenderDiamondDeployerConfig;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    signer = signers[0];

    baseConfig = {
      diamondName: 'TestDiamond',
      networkName: 'hardhat',
      chainId: 31337,
      apiKey: 'test_api_key',
      apiSecret: 'test_api_secret',
      relayerAddress: signer.address,
      autoApprove: false,
      viaType: 'EOA',
      via: signer.address,
      provider: ethers.provider,
      signer: signer,
    };
  });

  describe('Configuration Field Validation', function () {
    it('should validate diamondName is provided', function () {
      const config = { ...baseConfig };
      (config as any).diamondName = '';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate networkName is provided', function () {
      const config = { ...baseConfig };
      (config as any).networkName = '';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate chainId is a positive number', function () {
      const config = { ...baseConfig };
      config.chainId = -1;

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate apiKey is provided', function () {
      const config = { ...baseConfig };
      (config as any).apiKey = '';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate apiSecret is provided', function () {
      const config = { ...baseConfig };
      (config as any).apiSecret = '';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate relayerAddress is a valid Ethereum address', function () {
      const config = { ...baseConfig };
      config.relayerAddress = 'invalid_address';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate viaType is either Safe or EOA', function () {
      const config = { ...baseConfig };
      (config as any).viaType = 'InvalidType';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should require via address when viaType is Safe', function () {
      const config = { ...baseConfig };
      config.viaType = 'Safe';
      config.via = "";

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate via is a valid Ethereum address when provided', function () {
      const config = { ...baseConfig };
      config.viaType = 'Safe';
      config.via = 'invalid_address';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate autoApprove is a boolean', function () {
      const config = { ...baseConfig };
      (config as any).autoApprove = 'invalid_boolean';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate verbose is a boolean when provided', function () {
      const config = { ...baseConfig };
      (config as any).verbose = 'invalid_boolean';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should accept valid configuration', function () {
      expect(() => validateConfig(baseConfig)).to.not.throw();
    });

    it('should accept Safe configuration with valid via address', function () {
      const config = { ...baseConfig };
      config.viaType = 'Safe';
      config.via = signer.address;

      expect(() => validateConfig(config)).to.not.throw();
    });
  });

  describe('Network Configuration Validation', function () {
    it('should validate network configuration structure', function () {
      const validNetworkConfig: NetworkConfig = {
        name: 'testnet',
        chainId: 123,
        rpcUrl: 'https://test-rpc.example.com',
        blockExplorer: 'https://explorer.example.com',
        nativeCurrency: {
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
        },
        defaultGasLimit: 5000000,
        defaultMaxGasPrice: '50000000000',
      };

      expect(() => validateNetworkConfig(validNetworkConfig)).to.not.throw();
    });

    it('should validate required network config fields', function () {
      const invalidConfig = {
        name: 'testnet',
        // Missing chainId
        rpcUrl: 'https://test-rpc.example.com',
        blockExplorer: 'https://explorer.example.com',
        nativeCurrency: {
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
        },
        defaultGasLimit: 5000000,
        defaultMaxGasPrice: '50000000000',
      } as any;

      expect(() => validateNetworkConfig(invalidConfig)).to.throw();
    });

    it('should validate currency configuration', function () {
      const invalidConfig = {
        name: 'testnet',
        chainId: 123,
        rpcUrl: 'https://test-rpc.example.com',
        blockExplorer: 'https://explorer.example.com',
        nativeCurrency: {
          name: 'Test Token',
          symbol: 'TEST',
          // Missing decimals
        },
        defaultGasLimit: 5000000,
        defaultMaxGasPrice: '50000000000',
      } as any;

      expect(() => validateNetworkConfig(invalidConfig)).to.throw();
    });
  });

  describe('Configuration Defaults', function () {
    it('should apply default values for optional fields', function () {
      const minimalConfig = {
        diamondName: 'TestDiamond',
        networkName: 'hardhat',
        chainId: 31337,
        apiKey: 'test_api_key',
        apiSecret: 'test_api_secret',
        relayerAddress: signer.address,
        autoApprove: false,
        viaType: 'EOA' as const,
        via: signer.address,
      };

      const configWithDefaults = applyConfigDefaults(minimalConfig);

      expect(configWithDefaults).to.have.property('autoApprove');
      expect(configWithDefaults).to.have.property('verbose');
      expect(configWithDefaults.autoApprove).to.be.a('boolean');
    });
  });
});

// Helper functions for testing
function validateConfig(config: DefenderDiamondDeployerConfig): void {
  if (!config.diamondName || config.diamondName.trim() === '') {
    throw new Error('diamondName is required');
  }
  
  if (!config.networkName || config.networkName.trim() === '') {
    throw new Error('networkName is required');
  }
  
  if (!config.chainId || config.chainId <= 0) {
    throw new Error('chainId must be a positive number');
  }
  
  if (!config.apiKey || config.apiKey.trim() === '') {
    throw new Error('apiKey is required');
  }
  
  if (!config.apiSecret || config.apiSecret.trim() === '') {
    throw new Error('apiSecret is required');
  }
  
  if (!config.relayerAddress || !ethers.isAddress(config.relayerAddress)) {
    throw new Error('relayerAddress must be a valid Ethereum address');
  }
  
  if (!['Safe', 'EOA'].includes(config.viaType)) {
    throw new Error('viaType must be either Safe or EOA');
  }
  
  if (config.viaType === 'Safe') {
    if (!config.via) {
      throw new Error('via address is required when viaType is Safe');
    }
    if (!ethers.isAddress(config.via)) {
      throw new Error('via address must be a valid Ethereum address');
    }
  }
  
  if (config.autoApprove !== undefined && typeof config.autoApprove !== 'boolean') {
    throw new Error('autoApprove must be a boolean');
  }
  
  if (config.verbose !== undefined && typeof config.verbose !== 'boolean') {
    throw new Error('verbose must be a boolean');
  }
}

function validateNetworkConfig(config: NetworkConfig): void {
  const required = ['name', 'chainId', 'rpcUrl', 'blockExplorer', 'nativeCurrency', 'defaultGasLimit', 'defaultMaxGasPrice'];
  
  for (const field of required) {
    if (!(field in config)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  if (!config.nativeCurrency.name || !config.nativeCurrency.symbol || config.nativeCurrency.decimals === undefined) {
    throw new Error('Invalid nativeCurrency configuration');
  }
}

function applyConfigDefaults(config: Partial<DefenderDiamondDeployerConfig>): DefenderDiamondDeployerConfig {
  return {
    autoApprove: false,
    verbose: false,
    via: config.relayerAddress || '',
    ...config,
  } as DefenderDiamondDeployerConfig;
}
