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

    it('should require safeAddress when viaType is Safe', function () {
      const config = { ...baseConfig };
      config.viaType = 'Safe';
      config.via = "";

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate safeAddress is a valid Ethereum address when provided', function () {
      const config = { ...baseConfig };
      config.viaType = 'Safe';
      config.safeAddress = 'invalid_address';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate gasLimit is within reasonable bounds', function () {
      const config = { ...baseConfig };
      config.gasLimit = 20000; // Below minimum

      expect(() => validateConfig(config)).to.throw();

      config.gasLimit = 50000000; // Above reasonable maximum
      expect(() => validateConfig(config)).to.throw();
    });

    it('should validate maxGasPrice is a valid number string', function () {
      const config = { ...baseConfig };
      config.maxGasPrice = 'invalid_number';

      expect(() => validateConfig(config)).to.throw();
    });

    it('should accept valid configuration', function () {
      expect(() => validateConfig(baseConfig)).to.not.throw();
    });

    it('should accept Safe configuration with valid safeAddress', function () {
      const config = { ...baseConfig };
      config.viaType = 'Safe';
      config.safeAddress = signer.address;

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
      };

      const configWithDefaults = applyConfigDefaults(minimalConfig);

      expect(configWithDefaults).to.have.property('gasLimit');
      expect(configWithDefaults).to.have.property('maxGasPrice');
      expect(configWithDefaults.gasLimit).to.be.greaterThan(21000);
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
    if (!config.safeAddress) {
      throw new Error('safeAddress is required when viaType is Safe');
    }
    if (!ethers.isAddress(config.safeAddress)) {
      throw new Error('safeAddress must be a valid Ethereum address');
    }
  }
  
  if (config.gasLimit !== undefined) {
    if (config.gasLimit < 21000 || config.gasLimit > 30000000) {
      throw new Error('gasLimit must be between 21000 and 30000000');
    }
  }
  
  if (config.maxGasPrice !== undefined) {
    try {
      const parsed = BigInt(config.maxGasPrice);
      if (parsed <= 0) {
        throw new Error('maxGasPrice must be positive');
      }
    } catch {
      throw new Error('maxGasPrice must be a valid number string');
    }
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
    gasLimit: 5000000,
    maxGasPrice: '50000000000',
    ...config,
  } as DefenderDiamondDeployerConfig;
}
