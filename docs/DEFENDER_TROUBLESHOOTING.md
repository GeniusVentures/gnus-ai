# OpenZeppelin Defender Deployment Troubleshooting

## Common Issues and Solutions

### Configuration Issues

#### Missing Environment Variables

**Error**: `Missing required environment variables: DEFENDER_API_KEY, DEFENDER_API_SECRET, DEFENDER_RELAYER_ADDRESS`

**Solution**:
1. Ensure your `.env` file exists and contains all required variables
2. Check that variable names are exactly as specified
3. Verify no extra spaces or quotes around values

```bash
# Correct format in .env
DEFENDER_API_KEY=your_api_key_here
DEFENDER_API_SECRET=your_api_secret_here
DEFENDER_RELAYER_ADDRESS=0x1234567890123456789012345678901234567890
```

#### Invalid Addresses

**Error**: `relayerAddress must be a valid Ethereum address`

**Solution**:
1. Verify the address is a valid Ethereum address (42 characters, starts with 0x)
2. Check for typos or missing characters
3. Ensure the address has sufficient balance for deployment

#### Safe Configuration Issues

**Error**: `safeAddress is required when viaType is "Safe"`

**Solution**:
1. When using `DEFENDER_VIA_TYPE=Safe`, also set `DEFENDER_SAFE_ADDRESS`
2. Ensure the Safe address is valid and accessible in Defender
3. Verify the Safe has the required signers and threshold

### Network Configuration Issues

#### Network Configuration Not Found

**Error**: `Network configuration not found: config/networks/mynetwork.json`

**Solution**:
1. Create the missing network configuration file
2. Use existing network files as templates
3. Ensure the file is properly formatted JSON

```json
{
  "name": "mynetwork",
  "chainId": 12345,
  "rpcUrl": "https://rpc.mynetwork.com",
  "blockExplorer": "https://explorer.mynetwork.com",
  "nativeCurrency": {
    "name": "MyToken",
    "symbol": "MTK",
    "decimals": 18
  },
  "defaultGasLimit": 5000000,
  "defaultMaxGasPrice": "50000000000"
}
```

#### RPC Connection Issues

**Error**: `Failed to connect to network RPC`

**Solution**:
1. Verify RPC URL is correct and accessible
2. Check if RPC service is operational
3. Test RPC connection manually:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  YOUR_RPC_URL
```

### Deployment Issues

#### Gas Limit Too Low

**Error**: `Transaction failed due to insufficient gas`

**Solution**:
1. Increase `DEFENDER_GAS_LIMIT` in your environment
2. Check current network gas requirements
3. Consider network-specific gas optimizations

```bash
# Increase gas limit
DEFENDER_GAS_LIMIT=8000000
```

#### Gas Price Too High

**Error**: `Gas price exceeds maximum allowed`

**Solution**:
1. Check current network gas prices
2. Adjust `DEFENDER_MAX_GAS_PRICE` accordingly
3. Consider deploying during lower traffic periods

#### Insufficient Balance

**Error**: `Insufficient funds for deployment`

**Solution**:
1. Verify relayer has sufficient balance
2. Check both native token and any required ERC-20 tokens
3. Transfer funds to relayer address

### Defender API Issues

#### Authentication Errors

**Error**: `Unauthorized: Invalid API credentials`

**Solution**:
1. Verify API key and secret are correct
2. Check if credentials have expired
3. Ensure proper permissions in Defender dashboard
4. Regenerate credentials if necessary

#### Rate Limiting

**Error**: `Rate limit exceeded`

**Solution**:
1. Wait before retrying the request
2. Implement exponential backoff in custom scripts
3. Check Defender rate limits for your plan

#### Proposal Creation Failed

**Error**: `Failed to create deployment proposal`

**Solution**:
1. Check proposal parameters
2. Verify contract bytecode is valid
3. Ensure relayer/Safe is properly configured
4. Check Defender logs for detailed error messages

### Contract Verification Issues

#### Missing API Key

**Error**: `Missing API key for block explorer verification`

**Solution**:
1. Set appropriate API key environment variable:
   - `ETHERSCAN_API_KEY` for Ethereum networks
   - `POLYGONSCAN_API_KEY` for Polygon
   - `BASESCAN_API_KEY` for Base
2. Obtain API key from respective block explorer

#### Verification Failed

**Error**: `Contract verification failed`

**Solution**:
1. Wait for more block confirmations
2. Check if contract is already verified
3. Verify constructor arguments are correct
4. Check if source code compilation matches deployed bytecode

### Diamond-Specific Issues

#### Facet Deployment Failures

**Error**: `Failed to deploy facet contracts`

**Solution**:
1. Check individual facet compilation
2. Verify facet configurations in diamond config
3. Ensure proper facet priorities and versions
4. Check for function selector conflicts

#### Diamond Cut Failures

**Error**: `Diamond cut transaction failed`

**Solution**:
1. Verify facet addresses are correct
2. Check function selectors for conflicts
3. Ensure proper initialization data
4. Verify diamond ownership permissions

### Monitoring and Status Issues

#### Status Not Updating

**Error**: Status remains "IN_PROGRESS" indefinitely

**Solution**:
1. Check Defender dashboard for proposal status
2. Verify network connectivity
3. Check for stuck transactions
4. Monitor gas price fluctuations

#### Deployment Timeout

**Error**: `Deployment timeout after 300000ms`

**Solution**:
1. Check network congestion
2. Increase gas price if needed
3. Verify proposal status in Defender
4. Check for any manual approval requirements

## Debugging Tools

### Enable Verbose Logging

```bash
VERBOSE=true npx ts-node scripts/deploy/deploy-defender.ts
```

### Check Network Status

```bash
npx ts-node scripts/deploy/status-defender.ts GeniusDiamond polygon --watch
```

### Verify Configuration

```typescript
import { DefenderDiamondDeployer } from './scripts/setup/DefenderDiamondDeployer';

// Test configuration loading
try {
  const config = DefenderDiamondDeployer.createConfigFromEnv('TestDiamond', 'polygon');
  console.log('Configuration valid:', config);
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

### Test Network Connectivity

```typescript
import { ethers } from 'hardhat';

async function testNetwork() {
  try {
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    console.log('Network:', network.name);
    console.log('Chain ID:', network.chainId);
    console.log('Latest block:', blockNumber);
  } catch (error) {
    console.error('Network test failed:', error.message);
  }
}
```

## Performance Optimization

### Reduce Deployment Time

1. **Optimize Gas Settings**
   - Use appropriate gas limits
   - Set competitive gas prices
   - Consider network-specific optimizations

2. **Batch Operations**
   - Deploy multiple facets in single transaction when possible
   - Use diamond cut for multiple facet updates

3. **Network Selection**
   - Choose less congested networks for testing
   - Deploy during off-peak hours

### Monitor Resource Usage

1. **Track Gas Consumption**
   ```bash
   # Monitor gas usage during deployment
   REPORT_GAS=true npx ts-node scripts/deploy/deploy-defender.ts
   ```

2. **Monitor API Rate Limits**
   - Track Defender API usage
   - Implement request throttling if needed

## Recovery Procedures

### Stuck Deployment Recovery

1. **Check Proposal Status**
   - Login to Defender dashboard
   - Review proposal details and status
   - Check for manual approval requirements

2. **Cancel Stuck Proposal**
   ```bash
   # Use Defender dashboard to cancel proposals
   # Or implement programmatic cancellation
   ```

3. **Restart Deployment**
   ```bash
   # Clear deployment state if needed
   # Restart with fresh configuration
   npx ts-node scripts/deploy/deploy-defender.ts
   ```

### Failed Transaction Recovery

1. **Analyze Failure Reason**
   - Check transaction hash in block explorer
   - Review error messages and logs
   - Verify contract state changes

2. **Adjust Parameters**
   - Increase gas limit if needed
   - Adjust gas price for network conditions
   - Fix configuration issues

3. **Resume Deployment**
   - Use deployment status to determine restart point
   - Continue from last successful step

## Getting Help

### Log Collection

When seeking support, collect the following information:

1. **Environment Details**
   ```bash
   node --version
   npm --version
   npx hardhat --version
   ```

2. **Configuration (sanitized)**
   ```bash
   # Remove sensitive data before sharing
   cat .env | grep -v "API_KEY\|API_SECRET\|PRIVATE_KEY"
   ```

3. **Error Logs**
   - Complete error messages
   - Stack traces
   - Transaction hashes if available

4. **Network Information**
   - Target network name and chain ID
   - Block number when issue occurred
   - Gas price and limit settings

### Support Channels

1. **GNUS.AI Repository Issues**
   - Create detailed issue with reproduction steps
   - Include environment and configuration details
   - Provide error logs and stack traces

2. **OpenZeppelin Defender Support**
   - Use Defender dashboard support
   - Check Defender documentation
   - Review Defender status page

3. **Community Resources**
   - Hardhat Discord
   - OpenZeppelin Forum
   - Ethereum development communities

## Prevention

### Best Practices

1. **Test Thoroughly**
   - Always test on testnets first
   - Use staging environments
   - Verify all configurations

2. **Monitor Proactively**
   - Set up deployment monitoring
   - Track gas price trends
   - Monitor network congestion

3. **Maintain Backups**
   - Keep deployment configuration backups
   - Document custom modifications
   - Maintain deployment logs

4. **Stay Updated**
   - Keep dependencies current
   - Monitor Defender service updates
   - Follow network upgrade schedules

### Health Checks

Run regular health checks to prevent issues:

```bash
# Test configuration
npx ts-node scripts/deploy/status-defender.ts --help

# Verify network connectivity
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $YOUR_RPC_URL

# Check balances
# Use block explorer or custom scripts to verify relayer balances
```
