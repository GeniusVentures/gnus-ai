# GNUS.AI OpenZeppelin Defender Deployment Guide

## Overview

This guide covers the deployment of GNUS.AI Diamond contracts using OpenZeppelin Defender. The DefenderDiamondDeployer provides a production-ready deployment solution that integrates with OpenZeppelin Defender for secure, managed contract deployments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Basic Deployment](#basic-deployment)
5. [Advanced Features](#advanced-features)
6. [Monitoring and Status](#monitoring-and-status)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Prerequisites

### Required Software

- Node.js (v18+ recommended)
- npm or yarn
- Git

### Required Accounts

- OpenZeppelin Defender account with API access
- Deployed relayer or Safe multi-signature wallet
- Network provider (Infura, Alchemy, etc.)
- Block explorer API keys for contract verification

### Environment Setup

1. Clone the GNUS.AI repository
2. Install dependencies: `npm install`
3. Configure environment variables (see [Configuration](#configuration))

## Initial Setup

### 1. OpenZeppelin Defender Setup

1. **Create Defender Account**
   - Visit [OpenZeppelin Defender](https://defender.openzeppelin.com/)
   - Create an account and project
   - Generate API credentials

2. **Configure Relayer or Safe**
   - **EOA Relayer**: Create a relayer in Defender with sufficient balance
   - **Safe Multi-sig**: Connect your existing Safe wallet to Defender

3. **Network Configuration**
   - Ensure your target networks are supported
   - Configure RPC endpoints and gas settings

### 2. Project Configuration

1. **Copy Environment Template**

   ```bash
   cp .env.example .env
   ```

2. **Configure Network Settings**
   - Review `config/networks/` directory
   - Modify network configurations as needed
   - Ensure RPC URLs and block explorers are correct

## Configuration

### Environment Variables

Create a `.env` file with the following required variables:

```bash
# OpenZeppelin Defender Configuration
DEFENDER_API_KEY=your_api_key_here
DEFENDER_API_SECRET=your_api_secret_here
DEFENDER_RELAYER_ADDRESS=0x...
DEFENDER_AUTO_APPROVE=false
DEFENDER_VIA_TYPE=EOA

# Optional Defender Configuration
DEFENDER_SAFE_ADDRESS=0x...              # Required if VIA_TYPE is Safe
DEFENDER_GAS_LIMIT=5000000              # Custom gas limit
DEFENDER_MAX_GAS_PRICE=50000000000      # Maximum gas price in wei

# Network Configuration
MAINNET_RPC=https://...
POLYGON_RPC=https://...
ARBITRUM_RPC=https://...
BASE_RPC=https://...

# Block Explorer API Keys (for verification)
ETHERSCAN_API_KEY=your_etherscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key
BASESCAN_API_KEY=your_basescan_key

# Development
VERBOSE=true
PRIVATE_KEY=your_private_key_for_local_testing
```

### Configuration Options

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DEFENDER_API_KEY` | OpenZeppelin Defender API key | Yes | - |
| `DEFENDER_API_SECRET` | OpenZeppelin Defender API secret | Yes | - |
| `DEFENDER_RELAYER_ADDRESS` | Relayer wallet address | Yes | - |
| `DEFENDER_AUTO_APPROVE` | Auto-approve transactions | No | `false` |
| `DEFENDER_VIA_TYPE` | Transaction method (EOA/Safe) | No | `EOA` |
| `DEFENDER_SAFE_ADDRESS` | Safe multi-sig address | Conditional | - |
| `DEFENDER_GAS_LIMIT` | Gas limit for transactions | No | `5000000` |
| `DEFENDER_MAX_GAS_PRICE` | Maximum gas price in wei | No | Network default |

### Network Configuration Files

Network-specific settings are stored in `config/networks/[network].json`:

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

## Basic Deployment

### 1. Simple Deployment

Deploy to the default network with auto-configuration:

```bash
npx ts-node scripts/deploy/deploy-defender.ts
```

### 2. Network-Specific Deployment

Deploy to a specific network:

```bash
npx ts-node scripts/deploy/deploy-defender.ts GeniusDiamond polygon
```

### 3. Custom Diamond Deployment

Deploy a custom diamond configuration:

```bash
npx ts-node scripts/deploy/deploy-defender.ts MyCustomDiamond mainnet
```

### 4. Safe Multi-Signature Deployment

For Safe multi-signature workflows:

```bash
DEFENDER_VIA_TYPE=Safe DEFENDER_SAFE_ADDRESS=0x... npx ts-node scripts/deploy/deploy-defender.ts
```

## Advanced Features

### 1. Programmatic Deployment

```typescript
import { DefenderDiamondDeployer } from './scripts/setup/DefenderDiamondDeployer';

async function deployDiamond() {
  // Create configuration from environment
  const config = DefenderDiamondDeployer.createConfigFromEnv('GeniusDiamond', 'polygon');
  
  // Get deployer instance
  const deployer = await DefenderDiamondDeployer.getInstance(config);
  
  // Enable verbose logging
  await deployer.setVerbose(true);
  
  // Deploy diamond
  const diamond = await deployer.deployDiamond();
  
  // Get deployment data
  const deployedData = diamond.getDeployedDiamondData();
  console.log('Diamond deployed at:', deployedData.DiamondAddress);
}
```

### 2. Custom Configuration

```typescript
import { DefenderDiamondDeployerConfig } from './scripts/setup/DefenderDiamondDeployer';

const customConfig: DefenderDiamondDeployerConfig = {
  diamondName: 'CustomDiamond',
  networkName: 'arbitrum',
  chainId: 42161,
  apiKey: process.env.DEFENDER_API_KEY!,
  apiSecret: process.env.DEFENDER_API_SECRET!,
  relayerAddress: process.env.DEFENDER_RELAYER_ADDRESS!,
  autoApprove: false,
  viaType: 'Safe',
  safeAddress: process.env.DEFENDER_SAFE_ADDRESS!,
  gasLimit: 8000000,
  maxGasPrice: '100000000000',
};

const deployer = await DefenderDiamondDeployer.getInstance(customConfig);
```

### 3. Deployment with Custom Strategy

The DefenderDiamondDeployer uses a custom `DefenderDeploymentStrategy` that integrates with OpenZeppelin Defender. You can extend this for custom deployment logic:

```typescript
// This is handled internally by DefenderDiamondDeployer
// The strategy is automatically configured based on your Defender settings
```

## Monitoring and Status

### 1. Check Deployment Status

Monitor deployment progress:

```bash
npx ts-node scripts/deploy/status-defender.ts GeniusDiamond polygon
```

### 2. Watch Mode

Continuous monitoring:

```bash
npx ts-node scripts/deploy/status-defender.ts GeniusDiamond polygon --watch
```

### 3. Custom Interval Monitoring

Set custom check intervals:

```bash
npx ts-node scripts/deploy/status-defender.ts GeniusDiamond polygon --watch --interval=30
```

### 4. Programmatic Status Checking

```typescript
const deployer = await DefenderDiamondDeployer.getInstance(config);
const status = deployer.getDeploymentStatus();

console.log('Current status:', status);
// Possible values: NOT_STARTED, IN_PROGRESS, COMPLETED, FAILED, PAUSED
```

## Contract Verification

### 1. Automatic Verification

Verify contracts after deployment:

```bash
npx ts-node scripts/deploy/verify-defender.ts GeniusDiamond polygon
```

### 2. Verify Specific Contract

Verify a specific contract address:

```bash
npx ts-node scripts/deploy/verify-defender.ts GeniusDiamond polygon 0x123...abc
```

### 3. Programmatic Verification

```typescript
// Verification is handled by the verify-defender.ts script
// It uses Hardhat's built-in verification system
```

## Upgrade Workflows

### 1. Diamond Upgrades

```bash
npx ts-node scripts/deploy/upgrade-defender.ts GeniusDiamond polygon
```

### 2. Version-Specific Upgrades

```bash
npx ts-node scripts/deploy/upgrade-defender.ts GeniusDiamond polygon 2.6
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Polygon
        env:
          DEFENDER_API_KEY: ${{ secrets.DEFENDER_API_KEY }}
          DEFENDER_API_SECRET: ${{ secrets.DEFENDER_API_SECRET }}
          DEFENDER_RELAYER_ADDRESS: ${{ secrets.DEFENDER_RELAYER_ADDRESS }}
          DEFENDER_AUTO_APPROVE: 'true'
        run: npx ts-node scripts/deploy/deploy-defender.ts GeniusDiamond polygon
      
      - name: Verify contracts
        env:
          POLYGONSCAN_API_KEY: ${{ secrets.POLYGONSCAN_API_KEY }}
        run: npx ts-node scripts/deploy/verify-defender.ts GeniusDiamond polygon
```

## Best Practices

### 1. Security

- **Never commit private keys or API secrets**
- **Use environment variables for all sensitive data**
- **Enable Safe multi-signature for production deployments**
- **Set appropriate gas limits to prevent runaway transactions**
- **Always verify contracts after deployment**

### 2. Testing

- **Test deployments on testnets first**
- **Use the `--watch` flag to monitor long-running deployments**
- **Verify all facet deployments and function selectors**
- **Run integration tests after deployment**

### 3. Operations

- **Monitor Defender dashboard during deployments**
- **Keep deployment logs for audit trails**
- **Use descriptive proposal titles in Defender**
- **Set up alerting for failed deployments**
- **Document any custom configuration changes**

### 4. Cost Optimization

- **Monitor gas prices and adjust `maxGasPrice` accordingly**
- **Use appropriate gas limits for each network**
- **Consider batching multiple operations when possible**
- **Review transaction costs in Defender before approval**

### 5. Network-Specific Considerations

#### Ethereum Mainnet

- Higher gas costs - monitor gas prices
- Longer confirmation times
- Use conservative gas limits

#### Polygon

- Lower gas costs
- Faster confirmations
- Watch for network congestion

#### Arbitrum

- Very low gas costs
- Fast finality
- Different gas calculation model

#### Base

- Low gas costs
- Fast confirmations
- Newer network - verify explorer support

## Troubleshooting

See [DEFENDER_TROUBLESHOOTING.md](./DEFENDER_TROUBLESHOOTING.md) for detailed troubleshooting information.

## Support

- **Documentation Issues**: Create an issue in the repository
- **Defender Issues**: Check [OpenZeppelin Defender Docs](https://docs.openzeppelin.com/defender/)
- **Network Issues**: Verify RPC endpoints and network status
- **Gas Issues**: Check current network gas prices and adjust limits

## References

- [OpenZeppelin Defender Documentation](https://docs.openzeppelin.com/defender/)
- [ERC-2535 Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [Hardhat Documentation](https://hardhat.org/docs)
- [GNUS.AI Technical Documentation](../README.md)
