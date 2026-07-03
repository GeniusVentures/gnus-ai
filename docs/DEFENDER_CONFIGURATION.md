# OpenZeppelin Defender Configuration Reference

## Overview

This document provides a comprehensive reference for configuring the DefenderDiamondDeployer for GNUS.AI diamond contract deployments. The configuration system supports environment variables, network-specific settings, and programmatic configuration.

## Configuration Structure

### DefenderDiamondDeployerConfig Interface

```typescript
interface DefenderDiamondDeployerConfig extends DiamondConfig {
  // Required OpenZeppelin Defender Settings
  apiKey: string; // Defender API key
  apiSecret: string; // Defender API secret
  relayerAddress: string; // Relayer wallet address
  autoApprove: boolean; // Auto-approve transactions
  viaType: "Safe" | "EOA"; // Transaction method
  networkName: string; // Target network name
  chainId: number; // Blockchain chain ID

  // Optional Settings
  safeAddress?: string; // Safe multi-sig address
  gasLimit?: number; // Gas limit for transactions
  maxGasPrice?: string; // Maximum gas price in wei
  provider?: JsonRpcProvider; // Custom provider instance
  signer?: SignerWithAddress; // Custom signer instance
  defenderDiamondDeployerKey?: string; // Custom instance key

  // Inherited from DiamondConfig
  diamondName: string; // Name of the diamond contract
  deploymentsPath?: string; // Path to deployment files
  contractsPath?: string; // Path to contract sources
  callbacksPath?: string; // Path to callback scripts
  deployedDiamondDataFilePath?: string; // Deployment data file path
  configFilePath?: string; // Diamond config file path
  diamondAbiPath?: string; // Diamond ABI output path
  diamondAbiFileName?: string; // Diamond ABI file name
  writeDeployedDiamondData?: boolean; // Write deployment data
}
```

### NetworkConfig Interface

```typescript
interface NetworkConfig {
  name: string; // Network display name
  chainId: number; // Blockchain chain ID
  rpcUrl: string; // RPC endpoint URL
  blockExplorer: string; // Block explorer base URL
  nativeCurrency: {
    // Native currency details
    name: string; // Currency name
    symbol: string; // Currency symbol
    decimals: number; // Currency decimals
  };
  defaultGasLimit: number; // Default gas limit
  defaultMaxGasPrice: string; // Default max gas price (wei)
}
```

## Environment Variables

### Required Variables

| Variable                   | Description                      | Example            | Notes                          |
| -------------------------- | -------------------------------- | ------------------ | ------------------------------ |
| `DEFENDER_API_KEY`         | OpenZeppelin Defender API key    | `dfndr_abc123...`  | Obtain from Defender dashboard |
| `DEFENDER_API_SECRET`      | OpenZeppelin Defender API secret | `secret_xyz789...` | Keep secure and private        |
| `DEFENDER_RELAYER_ADDRESS` | Relayer wallet address           | `0x1234...5678`    | Must have sufficient balance   |

### Optional Variables

| Variable                 | Description                | Default         | Valid Values            |
| ------------------------ | -------------------------- | --------------- | ----------------------- |
| `DEFENDER_AUTO_APPROVE`  | Auto-approve transactions  | `false`         | `true`, `false`         |
| `DEFENDER_VIA_TYPE`      | Transaction method         | `EOA`           | `EOA`, `Safe`           |
| `DEFENDER_SAFE_ADDRESS`  | Safe multi-sig address     | -               | Valid Ethereum address  |
| `DEFENDER_GAS_LIMIT`     | Gas limit for transactions | Network default | `21000` - `30000000`    |
| `DEFENDER_MAX_GAS_PRICE` | Maximum gas price (wei)    | Network default | Positive integer string |
| `VERBOSE`                | Enable verbose logging     | `false`         | `true`, `false`         |

### Network RPC Variables

| Variable           | Description                  | Required For         |
| ------------------ | ---------------------------- | -------------------- |
| `MAINNET_RPC`      | Ethereum mainnet RPC URL     | Mainnet deployments  |
| `POLYGON_RPC`      | Polygon RPC URL              | Polygon deployments  |
| `ARBITRUM_RPC`     | Arbitrum RPC URL             | Arbitrum deployments |
| `BASE_RPC`         | Base RPC URL                 | Base deployments     |
| `SEPOLIA_RPC`      | Sepolia testnet RPC URL      | Sepolia testing      |
| `POLYGON_AMOY_RPC` | Polygon Amoy testnet RPC URL | Amoy testing         |
| `BASE_SEPOLIA_RPC` | Base Sepolia testnet RPC URL | Base testing         |

### Block Explorer API Keys

| Variable              | Description         | Used For                      |
| --------------------- | ------------------- | ----------------------------- |
| `ETHERSCAN_API_KEY`   | Etherscan API key   | Ethereum network verification |
| `POLYGONSCAN_API_KEY` | Polygonscan API key | Polygon network verification  |
| `BASESCAN_API_KEY`    | Basescan API key    | Base network verification     |
| `BSCSCAN_API_KEY`     | BSCScan API key     | BSC network verification      |

## Network Configuration Files

Network configurations are stored in `config/networks/[network].json` files.

### Mainnet Configuration

**File**: `config/networks/mainnet.json`

```json
{
  "name": "mainnet",
  "chainId": 1,
  "rpcUrl": "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
  "blockExplorer": "https://etherscan.io",
  "nativeCurrency": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "defaultGasLimit": 5000000,
  "defaultMaxGasPrice": "50000000000"
}
```

### Polygon Configuration

**File**: `config/networks/polygon.json`

```json
{
  "name": "polygon",
  "chainId": 137,
  "rpcUrl": "https://polygon-rpc.com",
  "blockExplorer": "https://polygonscan.com",
  "nativeCurrency": {
    "name": "Polygon",
    "symbol": "MATIC",
    "decimals": 18
  },
  "defaultGasLimit": 5000000,
  "defaultMaxGasPrice": "50000000000"
}
```

### Arbitrum Configuration

**File**: `config/networks/arbitrum.json`

```json
{
  "name": "arbitrum",
  "chainId": 42161,
  "rpcUrl": "https://arb1.arbitrum.io/rpc",
  "blockExplorer": "https://arbiscan.io",
  "nativeCurrency": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "defaultGasLimit": 5000000,
  "defaultMaxGasPrice": "1000000000"
}
```

### Base Configuration

**File**: `config/networks/base.json`

```json
{
  "name": "base",
  "chainId": 8453,
  "rpcUrl": "https://mainnet.base.org",
  "blockExplorer": "https://basescan.org",
  "nativeCurrency": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "defaultGasLimit": 5000000,
  "defaultMaxGasPrice": "1000000000"
}
```

## Configuration Methods

### 1. Environment Variable Configuration

The simplest method uses environment variables:

```bash
# .env file
DEFENDER_API_KEY=your_api_key
DEFENDER_API_SECRET=your_api_secret
DEFENDER_RELAYER_ADDRESS=0x...
DEFENDER_AUTO_APPROVE=false
DEFENDER_VIA_TYPE=EOA
```

```typescript
// Usage
const config = DefenderDiamondDeployer.createConfigFromEnv(
  "GeniusDiamond",
  "polygon",
);
const deployer = await DefenderDiamondDeployer.getInstance(config);
```

### 2. Programmatic Configuration

For more control, create configuration objects directly:

```typescript
const config: DefenderDiamondDeployerConfig = {
  diamondName: "CustomDiamond",
  networkName: "arbitrum",
  chainId: 42161,
  apiKey: process.env.DEFENDER_API_KEY!,
  apiSecret: process.env.DEFENDER_API_SECRET!,
  relayerAddress: process.env.DEFENDER_RELAYER_ADDRESS!,
  autoApprove: false,
  viaType: "Safe",
  safeAddress: process.env.DEFENDER_SAFE_ADDRESS!,
  gasLimit: 8000000,
  maxGasPrice: "100000000000",
};

const deployer = await DefenderDiamondDeployer.getInstance(config);
```

### 3. Mixed Configuration

Combine environment variables with programmatic overrides:

```typescript
// Start with environment configuration
const baseConfig = DefenderDiamondDeployer.createConfigFromEnv(
  "GeniusDiamond",
  "polygon",
);

// Override specific settings
const customConfig = {
  ...baseConfig,
  autoApprove: true,
  gasLimit: 7000000,
  viaType: "Safe" as const,
  safeAddress: "0x...",
};

const deployer = await DefenderDiamondDeployer.getInstance(customConfig);
```

## Configuration Validation

### Automatic Validation

The DefenderDiamondDeployer automatically validates configurations:

```typescript
// This will throw detailed validation errors
try {
  const deployer = await DefenderDiamondDeployer.getInstance(config);
} catch (error) {
  console.error("Configuration error:", error.message);
}
```

### Validation Rules

1. **Required Fields**: All required fields must be present and non-empty
2. **Address Format**: Ethereum addresses must be valid (42 characters, starts with 0x)
3. **Via Type**: Must be exactly 'Safe' or 'EOA'
4. **Safe Address**: Required when viaType is 'Safe'
5. **Gas Limit**: Must be between 21,000 and 30,000,000
6. **Gas Price**: Must be a valid positive integer string
7. **Chain ID**: Must be a positive integer

### Custom Validation

Add custom validation for specific requirements:

```typescript
function validateCustomConfig(config: DefenderDiamondDeployerConfig): void {
  // Custom business rules
  if (config.networkName === "mainnet" && config.autoApprove) {
    throw new Error("Auto-approve not allowed on mainnet");
  }

  if (config.gasLimit && config.gasLimit > 10000000) {
    console.warn("High gas limit detected:", config.gasLimit);
  }
}
```

## Advanced Configuration

### Custom Provider Configuration

```typescript
import { JsonRpcProvider } from "@ethersproject/providers";

const customProvider = new JsonRpcProvider("https://custom-rpc-endpoint.com");

const config: DefenderDiamondDeployerConfig = {
  // ... other config
  provider: customProvider,
};
```

### Custom Signer Configuration

```typescript
import { ethers } from "hardhat";

const customSigner = await ethers.getSigner("0x...");

const config: DefenderDiamondDeployerConfig = {
  // ... other config
  signer: customSigner,
};
```

### Diamond-Specific Configuration

```typescript
const config: DefenderDiamondDeployerConfig = {
  // ... other config
  diamondName: "CustomDiamond",
  deploymentsPath: "custom/deployments",
  contractsPath: "custom/contracts",
  configFilePath: "custom/diamond.config.json",
  writeDeployedDiamondData: true,
};
```

## Environment-Specific Configurations

### Development Environment

```bash
# .env.development
DEFENDER_API_KEY=dev_api_key
DEFENDER_API_SECRET=dev_api_secret
DEFENDER_RELAYER_ADDRESS=0x...
DEFENDER_AUTO_APPROVE=true
DEFENDER_VIA_TYPE=EOA
DEFENDER_GAS_LIMIT=8000000
VERBOSE=true
```

### Staging Environment

```bash
# .env.staging
DEFENDER_API_KEY=staging_api_key
DEFENDER_API_SECRET=staging_api_secret
DEFENDER_RELAYER_ADDRESS=0x...
DEFENDER_AUTO_APPROVE=false
DEFENDER_VIA_TYPE=Safe
DEFENDER_SAFE_ADDRESS=0x...
DEFENDER_GAS_LIMIT=6000000
VERBOSE=true
```

### Production Environment

```bash
# .env.production
DEFENDER_API_KEY=prod_api_key
DEFENDER_API_SECRET=prod_api_secret
DEFENDER_RELAYER_ADDRESS=0x...
DEFENDER_AUTO_APPROVE=false
DEFENDER_VIA_TYPE=Safe
DEFENDER_SAFE_ADDRESS=0x...
DEFENDER_GAS_LIMIT=5000000
DEFENDER_MAX_GAS_PRICE=50000000000
VERBOSE=false
```

## Configuration Security

### Sensitive Data Protection

1. **Never commit sensitive data to version control**
2. **Use environment variables for secrets**
3. **Rotate API keys regularly**
4. **Use different credentials for different environments**

### Recommended .gitignore Entries

```gitignore
# Environment files
.env
.env.*
!.env.example

# Deployment data
diamonds/*/deployments/*.json
!diamonds/*/deployments/.gitkeep

# Local configuration
config/local.*
```

### CI/CD Security

```yaml
# GitHub Actions example
- name: Deploy with Defender
  env:
    DEFENDER_API_KEY: ${{ secrets.DEFENDER_API_KEY }}
    DEFENDER_API_SECRET: ${{ secrets.DEFENDER_API_SECRET }}
    DEFENDER_RELAYER_ADDRESS: ${{ secrets.DEFENDER_RELAYER_ADDRESS }}
  run: npx ts-node scripts/deploy/deploy-defender.ts
```

## Configuration Testing

### Test Configuration Loading

```typescript
import { DefenderDiamondDeployer } from "./scripts/setup/DefenderDiamondDeployer";

async function testConfig() {
  try {
    // Test environment configuration
    const config = DefenderDiamondDeployer.createConfigFromEnv(
      "TestDiamond",
      "polygon",
    );
    console.log("✅ Configuration loaded successfully");

    // Test network configuration
    const networkConfig = DefenderDiamondDeployer.loadNetworkConfig("polygon");
    console.log("✅ Network configuration loaded successfully");

    // Test deployer creation
    const deployer = await DefenderDiamondDeployer.getInstance(config);
    console.log("✅ Deployer created successfully");
  } catch (error) {
    console.error("❌ Configuration test failed:", error.message);
  }
}
```

### Validate All Networks

```typescript
async function validateAllNetworks() {
  const networks = ["mainnet", "polygon", "arbitrum", "base"];

  for (const network of networks) {
    try {
      const config = DefenderDiamondDeployer.loadNetworkConfig(network);
      console.log(`✅ ${network}: Valid configuration`);
    } catch (error) {
      console.error(`❌ ${network}: ${error.message}`);
    }
  }
}
```

## Configuration Migration

### Upgrading from Previous Versions

When upgrading DefenderDiamondDeployer versions:

1. **Backup existing configuration**
2. **Review breaking changes in new version**
3. **Update environment variables as needed**
4. **Test configuration with new version**

### Configuration Schema Versioning

```typescript
// Version 1.0 configuration
interface ConfigV1 {
  apiKey: string;
  apiSecret: string;
  // ... other fields
}

// Version 2.0 configuration (with migration)
interface ConfigV2 extends ConfigV1 {
  viaType: "Safe" | "EOA";
  safeAddress?: string;
}

function migrateConfig(v1Config: ConfigV1): ConfigV2 {
  return {
    ...v1Config,
    viaType: "EOA", // Default for migration
  };
}
```

## Troubleshooting Configuration

### Common Configuration Errors

1. **Missing required fields**: Check that all required environment variables are set
2. **Invalid addresses**: Verify Ethereum address format and checksums
3. **Network mismatches**: Ensure chain ID matches network name
4. **API credential issues**: Verify Defender API key and secret are correct

### Configuration Debugging

```typescript
function debugConfig(config: DefenderDiamondDeployerConfig) {
  console.log("Configuration Debug:");
  console.log("- Diamond Name:", config.diamondName);
  console.log("- Network:", config.networkName);
  console.log("- Chain ID:", config.chainId);
  console.log("- Via Type:", config.viaType);
  console.log("- Auto Approve:", config.autoApprove);
  console.log("- Gas Limit:", config.gasLimit);
  console.log("- Has API Key:", !!config.apiKey);
  console.log("- Has API Secret:", !!config.apiSecret);
  console.log("- Relayer Address:", config.relayerAddress);
  if (config.safeAddress) {
    console.log("- Safe Address:", config.safeAddress);
  }
}
```
