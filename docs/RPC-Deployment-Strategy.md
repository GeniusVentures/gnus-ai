# RPC Deployment Strategy for GNUS.AI Diamond Project

This implementation provides direct RPC-based deployment capabilities for GNUS.AI Diamond contracts, enabling production deployments and CI/CD integration without relying on Hardhat's deployment abstractions.

## Features

- **Direct RPC Communication**: Deploy directly to blockchain networks using RPC endpoints
- **Singleton Pattern**: Consistent deployment state management with instance caching
- **Retry Logic**: Built-in retry mechanisms with exponential backoff for network resilience
- **Comprehensive Validation**: Configuration and network validation before deployment
- **Status Tracking**: Real-time deployment monitoring and status reporting
- **Upgrade Support**: Intelligent upgrade detection and execution
- **Manual Deployment**: Step-by-step interactive deployment with user confirmations

## Quick Start

### 1. Environment Setup

Copy and configure the environment variables:

```bash
# Required variables
DIAMOND_NAME=GeniusDiamond
RPC_URL=https://sepolia.infura.io/v3/your-project-id
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12
NETWORK_NAME=sepolia

# Optional configuration
GAS_LIMIT_MULTIPLIER=1.2
MAX_RETRIES=3
RETRY_DELAY_MS=2000
VERBOSE=true
```

### 2. Quick Deployment

```bash
# Deploy using environment variables
npx ts-node deploy-rpc.ts quick

# Or deploy with specific parameters
npx ts-node deploy-rpc.ts deploy \
  --diamond-name GeniusDiamond \
  --rpc-url https://sepolia.infura.io/v3/your-key \
  --private-key 0x... \
  --network-name sepolia \
  --verbose
```

### 3. Check Status

```bash
# Quick status check
npx ts-node status-rpc.ts quick

# Detailed status with on-chain validation
npx ts-node status-rpc.ts check \
  --show-config \
  --show-facets \
  --on-chain-validation
```

### 4. Upgrade Diamond

```bash
# Preview upgrade changes (dry run)
npx ts-node upgrade-rpc.ts upgrade --dry-run

# Execute upgrade
npx ts-node upgrade-rpc.ts quick
```

## Available Scripts

### Core Deployment Scripts

#### `deploy-rpc.ts`

Primary deployment script for initial diamond deployment.

```bash
# Commands
npx ts-node deploy-rpc.ts deploy [options]
npx ts-node deploy-rpc.ts quick [options]

# Key Options
--diamond-name <name>         Diamond contract name
--rpc-url <url>              RPC endpoint URL
--private-key <key>          Deployer private key (0x prefixed)
--network-name <name>        Network identifier
--gas-limit-multiplier <n>   Gas limit multiplier (1.0-2.0)
--max-retries <n>           Maximum retry attempts (1-10)
--verbose                   Enable detailed logging
```

#### `upgrade-rpc.ts`

Upgrade script for diamond contract upgrades.

```bash
# Commands
npx ts-node upgrade-rpc.ts upgrade [options]
npx ts-node upgrade-rpc.ts quick [options]

# Key Options
--dry-run                   Preview changes without execution
--force                     Force upgrade even if no changes detected
--target-version <n>        Target protocol version
```

#### `status-rpc.ts`

Status checking and validation script.

```bash
# Commands
npx ts-node status-rpc.ts check [options]
npx ts-node status-rpc.ts quick [options]

# Key Options
--show-config              Display configuration details
--show-facets              Show deployed facets information
--show-selectors           Show function selectors registry
--on-chain-validation      Perform on-chain validation
```

#### `verify-rpc.ts`

Contract verification and integrity validation.

```bash
# Commands
npx ts-node verify-rpc.ts verify [options]
npx ts-node verify-rpc.ts full [options]
npx ts-node verify-rpc.ts quick [options]

# Key Options
--validate-abi             Validate contract ABIs
--validate-selectors       Validate function selectors
--compare-on-chain         Compare with on-chain state
--verify-contracts         Show contract verification info
--etherscan-api-key <key>  Etherscan API key for verification
```

#### `deploy-rpc-manual.ts`

Interactive manual deployment with step-by-step confirmations.

```bash
# Commands
npx ts-node deploy-rpc-manual.ts deploy [options]
npx ts-node deploy-rpc-manual.ts interactive

# Key Options
--skip-confirmations       Skip all confirmation prompts
--debug-mode              Enable debug mode with detailed logging
```

## Configuration

### Environment Variables

| Variable               | Required | Default     | Description                        |
| ---------------------- | -------- | ----------- | ---------------------------------- |
| `DIAMOND_NAME`         | Yes      | -           | Name of the diamond contract       |
| `RPC_URL`              | Yes      | -           | RPC endpoint URL                   |
| `PRIVATE_KEY`          | Yes      | -           | Deployer private key (0x prefixed) |
| `NETWORK_NAME`         | No       | Auto-detect | Network identifier                 |
| `CHAIN_ID`             | No       | Auto-detect | Blockchain chain ID                |
| `GAS_LIMIT_MULTIPLIER` | No       | 1.2         | Gas limit multiplier (1.0-2.0)     |
| `MAX_RETRIES`          | No       | 3           | Maximum retry attempts (1-10)      |
| `RETRY_DELAY_MS`       | No       | 2000        | Retry delay in milliseconds        |
| `VERBOSE`              | No       | false       | Enable verbose logging             |
| `DEPLOYMENTS_PATH`     | No       | diamonds    | Deployments directory path         |
| `DIAMOND_CONFIG_PATH`  | No       | Auto-detect | Diamond configuration file path    |

### Network Examples

#### Ethereum Sepolia

```bash
NETWORK_NAME=sepolia
RPC_URL=https://sepolia.infura.io/v3/your-project-id
CHAIN_ID=11155111
```

#### Polygon Amoy

```bash
NETWORK_NAME=polygon-amoy
RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
```

#### Base Sepolia

```bash
NETWORK_NAME=base-sepolia
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
```

## Architecture

### Class Structure

```typescript
RPCDiamondDeployer
├── Singleton pattern with instance management
├── Configuration validation and environment loading
├── Network information retrieval
├── Deployment lifecycle management
└── Integration with RPCDeploymentStrategy

RPCDeploymentStrategy (from diamonds module)
├── Direct RPC communication
├── Retry logic with exponential backoff
├── Gas estimation and optimization
└── Transaction monitoring
```

### Deployment Process

1. **Configuration Validation**
   - Environment variables validation
   - Network connectivity check
   - Diamond configuration validation

2. **Pre-deployment Analysis**
   - Balance verification
   - Gas price estimation
   - Deployment cost calculation

3. **Diamond Core Deployment**
   - DiamondCutFacet deployment
   - Diamond proxy contract deployment

4. **Facet Deployment**
   - Sequential facet deployment
   - Function selector registration
   - Diamond cut execution

5. **Post-deployment Verification**
   - On-chain validation
   - ABI verification
   - Function selector validation

## Testing

### Unit Tests

```bash
# Run RPC-specific unit tests
npx hardhat test test/unit/rpc/RPCDiamondDeployer.test.ts

# Run all unit tests
npx hardhat test test/unit/**/*.test.ts
```

### Integration Tests

```bash
# Run RPC integration tests
npx hardhat test test/integration/rpc/rpc-deployment.test.ts

# Run all integration tests
npx hardhat test test/integration/**/*.test.ts
```

## Error Handling

The RPC deployment strategy includes comprehensive error handling:

- **Network Connection Errors**: Automatic retry with exponential backoff
- **Gas Estimation Failures**: Fallback gas limit calculation
- **Transaction Failures**: Detailed error reporting with suggested solutions
- **Configuration Errors**: Validation with specific error messages

## Security Considerations

- **Private Key Management**: Use environment variables, never commit keys
- **Network Validation**: Always verify network and chain ID before deployment
- **Gas Price Monitoring**: Monitor gas prices to avoid overpaying
- **Contract Verification**: Always verify contracts on block explorers

## Troubleshooting

### Common Issues

1. **"Network connection validation failed"**
   - Check RPC URL is accessible
   - Verify network supports the chain ID
   - Check firewall/proxy settings

2. **"Insufficient balance for deployment"**
   - Ensure deployer address has sufficient ETH
   - Check gas price isn't too high
   - Verify balance on correct network

3. **"Configuration validation failed"**
   - Verify all required environment variables are set
   - Check private key format (64 hex chars with 0x prefix)
   - Ensure diamond configuration file exists

4. **"Diamond is already deployed"**
   - Use `upgrade-rpc.ts` for upgrades
   - Use `--force` flag to force redeployment
   - Check deployment status with `status-rpc.ts`

### Debug Mode

Enable debug mode for detailed logging:

```bash
npx ts-node deploy-rpc-manual.ts deploy --debug-mode --verbose
```

## Integration with Existing Project

The RPC deployment strategy integrates seamlessly with the existing GNUS.AI project:

- **Hardhat Integration**: Uses existing hardhat configuration and contract compilation
- **Diamond Configuration**: Reads existing diamond configuration files
- **ABI Generation**: Automatically generates TypeScript types and ABIs
- **File Structure**: Follows existing project directory conventions

## Contributing

When contributing to the RPC deployment strategy:

1. Follow existing code patterns and conventions
2. Include comprehensive tests for new features
3. Update documentation for any API changes
4. Ensure backward compatibility with existing deployments

## License

This implementation is part of the GNUS.AI project and follows the same licensing terms.
