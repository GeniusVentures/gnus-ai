# RPC Deployment Scripts

This directory contains comprehensive deployment, upgrade, and verification tools for GNUS.AI Diamond contracts using RPC-based deployment infrastructure. These scripts provide robust, production-ready deployment capabilities with extensive configuration options and error handling.

## 📁 Contents

| Script | Purpose | Description |
|--------|---------|-------------|
| `deploy-rpc.ts` | **Main Deployment** | Primary script for deploying Diamond contracts |
| `upgrade-rpc.ts` | **Upgrade Management** | Handles Diamond contract upgrades with analysis |
| `verify-rpc.ts` | **Verification** | Validates deployment integrity and contract verification |
| `status-rpc.ts` | **Status Monitoring** | Shows deployment status and configuration details |
| `deploy-rpc-manual.ts` | **Interactive Deployment** | Step-by-step manual deployment with confirmations |
| `common.ts` | **Shared Infrastructure** | Common utilities and configuration management |

## 🚀 Quick Start

### Basic Deployment

```bash
# Deploy to testnet (e.g., Sepolia)
npx ts-node scripts/deploy/rpc/deploy-rpc.ts GeniusDiamond sepolia

# Deploy to mainnet
npx ts-node scripts/deploy/rpc/deploy-rpc.ts GeniusDiamond mainnet
```

### Check Deployment Status

```bash
npx ts-node scripts/deploy/rpc/status-rpc.ts GeniusDiamond sepolia --detailed
```

### Verify Deployment

```bash
npx ts-node scripts/deploy/rpc/verify-rpc.ts GeniusDiamond sepolia --etherscan
```

## 🛠️ Detailed Usage

### 1. Environment Setup

Before running any deployment scripts, ensure your environment is properly configured:

#### Required Environment Variables

```bash
# .env file
RPC_URL=https://your-rpc-endpoint-with-api-key
PRIVATE_KEY=your_deployment_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional - for testnet deployments
TEST_PRIVATE_KEY=your_test_private_key
```

#### Session Export (Alternative to .env)

```bash
export PRIVATE_KEY=your_private_key
export RPC_URL=https://your-rpc-endpoint
```

### 2. Deployment Scripts

#### `deploy-rpc.ts` - Main Deployment

Deploys Diamond contracts with comprehensive configuration support.

**Basic Usage:**

```bash
npx ts-node scripts/deploy/rpc/deploy-rpc.ts <DiamondName> <network>
```

**Advanced Options:**

```bash
npx ts-node scripts/deploy/rpc/deploy-rpc.ts GeniusDiamond sepolia \
  --rpc-url https://custom-rpc \
  --private-key 0x... \
  --gas-multiplier 1.5 \
  --max-retries 5 \
  --force \
  --verbose
```

**Command Variations:**

```bash
# Legacy format
npx ts-node scripts/deploy/rpc/deploy-rpc.ts legacy GeniusDiamond sepolia

# Quick deployment with minimal output
npx ts-node scripts/deploy/rpc/deploy-rpc.ts quick GeniusDiamond sepolia
```

#### `deploy-rpc-manual.ts` - Interactive Deployment

Step-by-step deployment with user confirmations at each stage.

```bash
npx ts-node scripts/deploy/rpc/deploy-rpc-manual.ts GeniusDiamond sepolia \
  --debug \
  --verbose
```

**Features:**

- Interactive confirmations for each deployment step
- Detailed progress reporting
- Ability to pause and resume deployments
- Debug mode for troubleshooting

### 3. Upgrade Management

#### `upgrade-rpc.ts` - Contract Upgrades

Handles Diamond contract upgrades with comprehensive analysis.

**Basic Upgrade:**

```bash
npx ts-node scripts/deploy/rpc/upgrade-rpc.ts GeniusDiamond sepolia
```

**Dry Run Analysis:**

```bash
npx ts-node scripts/deploy/rpc/upgrade-rpc.ts GeniusDiamond sepolia \
  --dry-run \
  --verbose
```

**Advanced Options:**

```bash
npx ts-node scripts/deploy/rpc/upgrade-rpc.ts GeniusDiamond sepolia \
  --target-version 2.0.0 \
  --force \
  --skip-analysis
```

**Features:**

- Pre-upgrade analysis showing what will change
- Protocol version management
- Facet addition, removal, and updates
- Safety checks and confirmations

### 4. Status and Monitoring

#### `status-rpc.ts` - Deployment Status

Comprehensive status reporting for deployed contracts.

```bash
# Basic status
npx ts-node scripts/deploy/rpc/status-rpc.ts GeniusDiamond sepolia

# Detailed status with facet information
npx ts-node scripts/deploy/rpc/status-rpc.ts GeniusDiamond sepolia \
  --detailed \
  --show-facets \
  --verbose
```

**Status Information:**

- Diamond address and configuration
- Deployed facets and their addresses
- Protocol version information
- Network and chain details
- Gas settings and retry configuration

### 5. Verification

#### `verify-rpc.ts` - Contract Verification

Validates deployment integrity and performs Etherscan verification.

```bash
# Basic verification
npx ts-node scripts/deploy/rpc/verify-rpc.ts GeniusDiamond sepolia

# Full verification with Etherscan
npx ts-node scripts/deploy/rpc/verify-rpc.ts GeniusDiamond sepolia \
  --etherscan \
  --check-all \
  --verbose
```

**Verification Features:**

- Contract code validation
- ABI integrity checks
- Function selector validation
- Etherscan contract verification
- Diamond structure validation

## 🔧 Configuration Options

### Common Options (All Scripts)

| Option | Description | Default |
|--------|-------------|---------|
| `--rpc-url` | Custom RPC endpoint | From .env |
| `--private-key` | Deployment private key | From .env |
| `--verbose` | Detailed logging | false |
| `--config-path` | Custom config file path | Auto-detected |
| `--deployments-path` | Deployment records path | ./deployments |
| `--gas-multiplier` | Gas limit multiplier | 1.2 |
| `--max-retries` | Maximum retry attempts | 3 |
| `--retry-delay` | Retry delay in ms | 2000 |

### Deployment-Specific Options

| Option | Description | Default |
|--------|-------------|---------|
| `--force` | Force deployment even if exists | false |
| `--skip-verification` | Skip post-deployment verification | false |

### Upgrade-Specific Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Analyze without executing | false |
| `--target-version` | Specific version to upgrade to | Latest |
| `--skip-analysis` | Skip pre-upgrade analysis | false |

### Verification-Specific Options

| Option | Description | Default |
|--------|-------------|---------|
| `--etherscan` | Verify contracts on Etherscan | false |
| `--check-all` | Perform comprehensive checks | false |

## 📋 Deployment Procedures

### Testnet Deployment Procedure

1. **Clean Previous Deployment (if needed)**

   ```bash
   # Archive or remove previous deployment records
   mv deployments/GeniusDiamond/sepolia deployments/archive/
   ```

2. **Set Environment**

   ```bash
   export PRIVATE_KEY=your_test_private_key
   export RPC_URL=https://sepolia.infura.io/v3/your-key
   ```

3. **Deploy Diamond**

   ```bash
   npx ts-node scripts/deploy/rpc/deploy-rpc.ts GeniusDiamond sepolia --verbose
   ```

4. **Verify Deployment**

   ```bash
   npx ts-node scripts/deploy/rpc/verify-rpc.ts GeniusDiamond sepolia --etherscan
   ```

5. **Check Status**

   ```bash
   npx ts-node scripts/deploy/rpc/status-rpc.ts GeniusDiamond sepolia --detailed
   ```

### Testnet Upgrade Procedure

1. **Analyze Upgrade**

   ```bash
   npx ts-node scripts/deploy/rpc/upgrade-rpc.ts GeniusDiamond sepolia --dry-run
   ```

2. **Execute Upgrade**

   ```bash
   npx ts-node scripts/deploy/rpc/upgrade-rpc.ts GeniusDiamond sepolia --verbose
   ```

3. **Verify Upgrade**

   ```bash
   npx ts-node scripts/deploy/rpc/verify-rpc.ts GeniusDiamond sepolia --check-all
   ```

### Mainnet Deployment Procedure

1. **Final Environment Check**

   ```bash
   # Ensure production private key and RPC
   export PRIVATE_KEY=your_production_private_key
   export RPC_URL=https://mainnet.infura.io/v3/your-key
   ```

2. **Deploy with Manual Confirmations**

   ```bash
   npx ts-node scripts/deploy/rpc/deploy-rpc-manual.ts GeniusDiamond mainnet --verbose
   ```

3. **Comprehensive Verification**

   ```bash
   npx ts-node scripts/deploy/rpc/verify-rpc.ts GeniusDiamond mainnet \
     --etherscan --check-all --verbose
   ```

4. **Final Status Check**

   ```bash
   npx ts-node scripts/deploy/rpc/status-rpc.ts GeniusDiamond mainnet --detailed
   ```

## 📝 Post-Deployment Tasks

1. **Commit Deployment Records**

   ```bash
   git add deployments/
   git commit -m "Deploy GeniusDiamond to [network] - [diamond-address]"
   git tag -a v[version] -m "GeniusDiamond deployment v[version]"
   ```

2. **Update Documentation**
   - Update deployment addresses in README
   - Update API documentation if needed
   - Inform stakeholders of new deployment

3. **Monitoring Setup**
   - Configure monitoring for the new deployment
   - Set up alerts for contract interactions
   - Verify integration with existing systems

## 🐛 Troubleshooting

### Common Issues

1. **"Module not found" errors**

   ```bash
   npm install  # Ensure dependencies are installed
   ```

2. **RPC connection issues**

   ```bash
   # Check RPC URL and API key
   curl -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}' \
        $RPC_URL
   ```

3. **Insufficient gas errors**

   ```bash
   # Increase gas multiplier
   --gas-multiplier 2.0
   ```

4. **Previous deployment exists**

   ```bash
   # Use force flag or clean deployments
   --force
   ```

### Debug Mode

For detailed debugging, use:

```bash
npx ts-node scripts/deploy/rpc/deploy-rpc-manual.ts GeniusDiamond sepolia \
  --debug --verbose
```

## 🔐 Security Notes

- Never commit private keys to version control
- Use environment variables or secure key management
- Verify contract addresses before proceeding with operations
- Use testnet deployments for testing and validation
- Always verify contracts on Etherscan after deployment

## 🏗️ Architecture

The RPC deployment system is built on the `RPCDiamondDeployer` class which provides:

- Robust error handling and retries
- Comprehensive logging and status reporting
- Flexible configuration management
- Integration with existing Hardhat infrastructure
- Support for multiple deployment strategies

## Mainnet Upgrade Procedure

A Mainnet upgrade will require `step` record removal or archiving since
no files should exist.
