## Design Document: GNUS.AI Withdraw Throttle

### Overview

The Withdraw Throttle is a rate-limiting gating mechanism that restricts the amount of GNUS tokens that can be withdrawn by any account within a configurable time window. This prevents rapid drainage of funds and provides additional security against exploits or unauthorized withdrawals.

### Architecture

Following the ERC-2535 Diamond pattern used in the GNUS.AI system, the implementation consists of:

1. **`GNUSWithdrawThrottleStorage.sol`** - Diamond storage library for throttle configuration and withdrawal records
2. **`GNUSWithdrawThrottle.sol`** - Facet implementing throttle logic and configuration management
3. **`DiamondInitFacet.sol`** - Modified to include initialization function for throttle settings
4. **Modifications to GNUSBridge.sol** - Integration of throttle checks into the existing `withdraw()` function

### Storage Design

```solidity
// GNUSWithdrawThrottleStorage.sol
```

**Data Structures:**

| Field | Type | Description |
|-------|------|-------------|
| `WithdrawRecord` | struct | Stores withdrawal amount and timestamp |
| `withdrawRecords` | mapping(address => WithdrawRecord[]) | Per-account withdrawal history |
| `accountLimits` | mapping(address => uint256) | Per-account custom withdrawal limits |
| `defaultLimitAmount` | uint256 | Default max GNUS tokens withdrawable within the time window |
| `withdrawLimitSeconds` | uint256 | Number of seconds in the throttle window |
| `aggregationSeconds` | uint256 | Time period for aggregating records (default: 3600 = 1 hour) |
| `throttleEnabled` | bool | Toggle to enable/disable throttling |

### Facet Design

**GNUSWithdrawThrottle.sol Functions:**

| Function | Access | Description |
|----------|--------|-------------|
| `setWithdrawLimitAmount(uint256)` | onlySuperAdminRole | Set default max withdrawable amount |
| `setAccountWithdrawLimit(address, uint256)` | onlySuperAdminRole | Set per-account custom limit |
| `setWithdrawLimitSeconds(uint256)` | onlySuperAdminRole | Set time window duration |
| `setAggregationSeconds(uint256)` | onlySuperAdminRole | Set aggregation period duration |
| `setThrottleEnabled(bool)` | onlySuperAdminRole | Enable/disable throttling |
| `getWithdrawThrottleConfig()` | view | Get current configuration |
| `getAccountWithdrawLimit(address)` | view | Get account's withdrawal limit |
| `getAccountWithdrawStatus(address)` | view | Get account's current usage |
| `checkWithdrawAllowed(address, uint256)` | internal | Core validation logic |
| `recordWithdraw(address, uint256)` | internal | Record new withdrawal |
| `aggregateRecords(address)` | internal | Aggregate old records to reduce gas |

### Core Algorithm

```
function checkAndRecordWithdraw(account, amount) internal returns (bool):
    if (!throttleEnabled) return true
    
    // Check if super admin - bypass throttle
    if (isSuperAdmin(account)) return true
    
    // 1. Aggregate old records if possible
    aggregateRecords(account)
    
    // 2. Clean expired records
    records = withdrawRecords[account]
    currentTime = block.timestamp
    expireTime = currentTime - withdrawLimitSeconds
    
    // Remove records where recordTimestamp < expireTime
    cleanExpiredRecords(account, expireTime)
    
    // 3. Sum active withdrawals
    activeTotal = 0
    for each record in withdrawRecords[account]:
        activeTotal += record.amount
    
    // 4. Get account limit (custom or default)
    limit = accountLimits[account] > 0 ? accountLimits[account] : defaultLimitAmount
    
    // 5. Check against limit
    if (activeTotal + amount > limit):
        emit WithdrawThrottleTriggered(account, amount, activeTotal, limit)
        revert("Withdraw throttle limit exceeded")
    
    // 6. Record new withdrawal
    withdrawRecords[account].push(WithdrawRecord(amount, currentTime))
    emit WithdrawRecorded(account, amount, currentTime)
    
    return true

function aggregateRecords(account) internal:
    records = withdrawRecords[account]
    if (records.length < 2) return  // Need at least 2 records to aggregate
    
    currentTime = block.timestamp
    aggregationCutoff = currentTime - aggregationSeconds
    
    // Find records older than aggregation cutoff
    aggregateAmount = 0
    oldestTimestamp = type(uint128).max
    recordsToAggregate = 0
    
    for i from 0 to records.length:
        if (records[i].timestamp < aggregationCutoff):
            aggregateAmount += records[i].amount
            oldestTimestamp = min(oldestTimestamp, records[i].timestamp)
            recordsToAggregate++
    
    // If we have multiple records to aggregate, replace with single record
    if (recordsToAggregate > 1):
        // Remove old records
        removeRecordsOlderThan(account, aggregationCutoff)
        
        // Add single aggregated record at oldest timestamp
        withdrawRecords[account].push(WithdrawRecord(aggregateAmount, oldestTimestamp))
        
        // Sort records by timestamp to maintain order
        sortRecordsByTimestamp(account)
```

### Integration Points

**GNUSBridge.sol `withdraw()` function modification:**

The existing withdraw function at GNUSBridge.sol:

```solidity
function withdraw(uint256 amount, uint256 id) external {
    address sender = _msgSender();
    require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
    require(id != GNUS_TOKEN_ID, "Cannot withdraw GNUS tokens.");
    require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
    
    // ADD: Throttle check before proceeding
    uint256 gnusAmount = amount / GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
    GNUSWithdrawThrottleStorage._checkAndRecordWithdraw(sender, gnusAmount);
    
    _burn(sender, id, amount);
    _mintWithBridgeFee(sender, GNUS_TOKEN_ID, gnusAmount);
}
```

### Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `defaultLimitAmount` | 100,000 GNUS (100000 * 10^18) | Default max GNUS withdrawable per window |
| `accountLimits[address]` | 0 (uses default) | Per-account custom limits |
| `withdrawLimitSeconds` | 86400 (1 day) | Time window for rate limiting in seconds |
| `aggregationSeconds` | 3600 (1 hour) | Time period for aggregating records |
| `throttleEnabled` | true | Throttling active by default |

### Events

```solidity
event WithdrawThrottleConfigUpdated(uint256 defaultLimitAmount, uint256 limitSeconds, uint256 aggregationSeconds, bool enabled);
event AccountWithdrawLimitUpdated(address indexed account, uint256 newLimit);
event WithdrawThrottleTriggered(address indexed account, uint256 requestedAmount, uint256 activeTotal, uint256 limit);
event WithdrawRecorded(address indexed account, uint256 amount, uint256 timestamp);
event WithdrawRecordsAggregated(address indexed account, uint256 recordsAggregated, uint256 totalAmount);
```

### Security Considerations

1. **Gas Optimization**: Records are cleaned lazily during withdrawal checks to avoid excessive gas costs
2. **Record Aggregation**: Old records (beyond aggregation window) are consolidated into single records, dramatically reducing gas costs for active accounts
3. **Array Bounds**: Maximum records per account should be bounded (suggest: 100 entries before aggregation)
4. **Access Control**: Only `onlySuperAdminRole` can modify throttle parameters
5. **Super Admin Bypass**: Super admin withdrawals bypass throttle checks for emergency operations
6. **Per-Account Limits**: Custom limits allow flexibility for different user tiers
7. **Precision**: Throttle applies to GNUS output amount (after exchange rate conversion)

### Diamond Configuration Entry

Add to geniusdiamond.config.json:

```json
"GNUSWithdrawThrottle": {
  "priority": 115,
  "versions": {
    "0.0": {}
  }
}
```

**Initialization**: Handled by `DiamondInitFacet.sol` via `initializeGNUSWithdrawThrottle()` function called from the protocol initializer (e.g., `diamondInitialize250()`). Default values:
- `defaultLimitAmount` = 100,000 GNUS (100000 * 10^18)
- `withdrawLimitSeconds` = 86,400 seconds (1 day)
- `aggregationSeconds` = 3,600 seconds (1 hour)
- `throttleEnabled` = true

### File Structure

```
contracts/gnus-ai/
├── GNUSWithdrawThrottle.sol        # New facet
├── GNUSWithdrawThrottleStorage.sol # New storage library
├── DiamondInitFacet.sol            # Modified (add initialization)
├── GNUSBridge.sol                  # Modified (add throttle check)
```

---

### Gas Optimization: Record Aggregation

**Problem**: Without aggregation, highly active accounts accumulate many withdrawal records, causing gas costs to increase with each transaction as the system iterates through all records.

**Solution**: Periodically aggregate old withdrawal records (beyond the aggregation window) into a single consolidated record. This maintains accurate throttling while dramatically reducing iteration costs.

**Example**:
```
Before Aggregation (10 withdrawals in past 2-23 hours):
- Record 1: 1000 GNUS at timestamp T-23h
- Record 2: 2000 GNUS at timestamp T-22h
- Record 3: 1500 GNUS at timestamp T-21h
- Record 4: 3000 GNUS at timestamp T-20h
- Record 5: 2500 GNUS at timestamp T-19h
... (5 more records from T-18h to T-2h)

After Aggregation (aggregationSeconds = 3600 = 1 hour):
- Aggregated: 10000 GNUS at timestamp T-23h (consolidated records 1-5)
- Record 6: 1800 GNUS at timestamp T-18h
... (4 more individual records from last hour)

Result: 10 records → 6 records (40% reduction)
```

**Benefits**:
- Reduces gas costs for active users
- Maintains accurate throttling (total amounts preserved)
- Automatic cleanup prevents unbounded array growth
- Configurable aggregation period allows tuning per deployment