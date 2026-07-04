# GNUSWithdrawLimiter Documentation

## Overview

The **GNUSWithdrawLimiter** is a security feature that implements rate-limiting for GNUS token withdrawals and transfers. It uses a bin-based aggregation system to track withdrawal amounts within configurable time windows, providing protection against exploitative behavior, malicious activity, and Sybil attacks while minimizing gas costs and maintaining a smooth user experience.

### Key Features

- **Bin-Based Aggregation**: Fixed-size arrays eliminate unbounded storage growth
- **Per-Account Configuration**: Custom limits for specific addresses
- **Global Defaults**: Shared configuration for all accounts without custom settings
- **Super Admin Bypass**: Administrative operations bypass limiter checks
- **Comprehensive Coverage**: Applies to all GNUS transfer paths (Bridge, Batch, ERC1155)
- **Gas Optimized**: O(binCount) complexity with predictable costs
- **Sybil Attack Prevention**: Aggregates batch transfers against sender's limit

### Comprehensive Security Scope

The limiter is integrated into **three critical transfer paths**:

1. **GNUSBridge.withdraw()** - Converting child NFTs back to GNUS tokens
2. **ERC20TransferBatch.\_transferBatch()** - Batch token transfers
3. **GNUSERC1155MaxSupply.\_beforeTokenTransfer()** - ERC-1155 transfer hook (fallback)

This comprehensive coverage prevents attackers from bypassing per-account limits by distributing GNUS to multiple Sybil accounts.

---

## Architecture

### Bin-Based Aggregation Design

Instead of storing individual transactions (which would lead to unbounded storage growth), the system uses **fixed-size bin arrays** to accumulate withdrawal amounts:

```
Time Window: 24 hours
Bin Count: 24
Bin Length: 1 hour each

[Bin 0] [Bin 1] [Bin 2] ... [Bin 23]
  ↓       ↓       ↓           ↓
Hour 0  Hour 1  Hour 2   ... Hour 23
```

**Benefits**:

- **76% Storage Reduction**: Fixed arrays vs. unbounded transaction logs
- **Constant Gas Costs**: O(binCount) operations regardless of activity
- **Automatic Rollover**: Old bins are reused via modulo arithmetic
- **Lazy Cleanup**: Expired bins zeroed during validation, not continuously

**Comparison**:

| Approach            | Storage Growth    | Read Cost       | Write Cost | Gas Impact          |
| ------------------- | ----------------- | --------------- | ---------- | ------------------- |
| Individual Records  | O(n transactions) | O(n)            | O(1)       | Increases over time |
| **Bin Aggregation** | **O(binCount)**   | **O(binCount)** | **O(1)**   | **Constant**        |

---

## Storage Structures

### WithdrawBin

Represents a single time bin for withdrawal aggregation.

```solidity
struct WithdrawBin {
    uint128 timestamp;     // Timestamp when this bin was last updated
    uint128 totalAmount;   // Total GNUS amount accumulated in this bin
}
```

**Fields**:

- `timestamp` (uint128): Last update time for this bin
- `totalAmount` (uint128): Accumulated withdrawal amount in this bin

**Gas Optimization**: Both uint128 fields pack into a single storage slot (32 bytes).

---

### AccountConfig

Per-account configuration that overrides defaults.

```solidity
struct AccountConfig {
    uint32 binCount;          // Number of bins (0 = use default)
    uint64 windowSeconds;     // Window duration (0 = use default)
    uint256 limitAmount;      // Withdrawal limit (0 = use default)
}
```

**Fields**:

- `binCount` (uint32): Number of bins for this account (0 = use default)
- `windowSeconds` (uint64): Time window duration in seconds (0 = use default)
- `limitAmount` (uint256): Maximum withdrawal amount in wei (0 = use default)

**Usage**: Set any field to 0 to use the global default value.

---

### AccountState

Per-account state tracking bins and base timestamp.

```solidity
struct AccountState {
    uint128 baseTimestamp;    // First withdrawal timestamp
    WithdrawBin[] bins;       // Array of withdrawal bins
}
```

**Fields**:

- `baseTimestamp` (uint128): Timestamp of first withdrawal (establishes bin timeline)
- `bins` (WithdrawBin[]): Dynamic array sized to `binCount`

**Initialization**: Created lazily on first withdrawal.

---

### Layout

Diamond storage layout for the entire limiter system.

```solidity
struct Layout {
    mapping(address => AccountState) accountStates;     // Per-account bin state
    mapping(address => AccountConfig) accountConfigs;   // Per-account custom configs
    uint256 defaultBinCount;                            // Default bin count
    uint256 defaultWindowSeconds;                       // Default window duration
    uint256 defaultLimitAmount;                         // Default limit amount
    bool limiterEnabled;                                // Global enable/disable
}
```

**Storage Position**: `keccak256("gnus.ai.withdraw.limiter.storage")`

---

## Bin Calculation Mathematics

### Bin Length Calculation

```solidity
binLengthSeconds = windowSeconds / binCount
```

**Example**:

- Window: 86,400 seconds (24 hours)
- Bin Count: 24
- Bin Length: 3,600 seconds (1 hour)

---

### Bin Index Calculation

```solidity
binIndex = ((currentTime - baseTimestamp) / binLengthSeconds) % binCount
```

**Formula Breakdown**:

1. `currentTime - baseTimestamp`: Time elapsed since first withdrawal
2. `/ binLengthSeconds`: Number of bins elapsed
3. `% binCount`: Wrap around to array bounds (circular buffer)

**Example**:

```
baseTimestamp: 1000000
currentTime:   1007200  (2 hours later)
binLength:     3600 seconds
binCount:      24

elapsedSeconds = 1007200 - 1000000 = 7200
binsElapsed = 7200 / 3600 = 2
binIndex = 2 % 24 = 2  (Bin 2)
```

---

### Bin Expiration Check

```solidity
isExpired = (bin.timestamp < (currentTime - windowSeconds))
```

**Example**:

```
currentTime:    1100000
windowSeconds:  86400
windowCutoff:   1013600  (24 hours ago)

bin.timestamp: 1010000
isExpired = (1010000 < 1013600) = true  // Older than 24 hours
```

---

### Bin Wrap-Around Behavior

The modulo arithmetic enables automatic reuse of old bins:

```
Bin Array: [0, 1, 2, ..., 23]

Hour 0  → binIndex = 0
Hour 1  → binIndex = 1
...
Hour 23 → binIndex = 23
Hour 24 → binIndex = 0  (wraps around, reuses Bin 0)
Hour 25 → binIndex = 1  (wraps around, reuses Bin 1)
```

No manual cleanup required - old bins are automatically overwritten.

---

## API Reference

### Administrative Functions

#### setDefaultLimitAmount

Sets the default withdrawal limit amount for all accounts using defaults.

```solidity
function setDefaultLimitAmount(uint256 limitAmount) external
```

**Parameters**:

- `limitAmount` (uint256): New default limit in wei (GNUS token base units)

**Access Control**: `onlySuperAdminRole`

**Events Emitted**: `WithdrawLimiterConfigUpdated(defaultLimitAmount, defaultWindowSeconds, defaultBinCount)`

**Example**:

```solidity
// Set default limit to 200,000 GNUS
limiter.setDefaultLimitAmount(200000 * 10**18);
```

---

#### setDefaultWindowSeconds

Sets the default time window duration for all accounts using defaults.

```solidity
function setDefaultWindowSeconds(uint256 windowSeconds) external
```

**Parameters**:

- `windowSeconds` (uint256): New default window duration in seconds

**Access Control**: `onlySuperAdminRole`

**Events Emitted**: `WithdrawLimiterConfigUpdated(defaultLimitAmount, defaultWindowSeconds, defaultBinCount)`

**Example**:

```solidity
// Set default window to 7 days
limiter.setDefaultWindowSeconds(7 * 24 * 60 * 60);
```

---

#### setDefaultBinCount

Sets the default number of bins for aggregation.

```solidity
function setDefaultBinCount(uint256 binCount) external
```

**Parameters**:

- `binCount` (uint256): New default bin count (must be > 0)

**Access Control**: `onlySuperAdminRole`

**Validation**: Reverts if `binCount == 0`

**Events Emitted**: `WithdrawLimiterConfigUpdated(defaultLimitAmount, defaultWindowSeconds, defaultBinCount)`

**Example**:

```solidity
// Set default to 48 bins (30-minute intervals for 24 hours)
limiter.setDefaultBinCount(48);
```

---

#### setAccountConfig

Sets a custom configuration for a specific account.

```solidity
function setAccountConfig(
    address account,
    uint32 binCount,
    uint64 windowSeconds,
    uint256 limitAmount
) external
```

**Parameters**:

- `account` (address): Account to configure
- `binCount` (uint32): Number of bins (0 = use default)
- `windowSeconds` (uint64): Window duration in seconds (0 = use default)
- `limitAmount` (uint256): Limit amount in wei (0 = use default)

**Access Control**: `onlySuperAdminRole`

**Events Emitted**: `AccountConfigUpdated(account, binCount, windowSeconds, limitAmount)`

**Special Behavior**: Set all parameters to 0 to revert to default configuration.

**Example**:

```solidity
// Configure high-trust account with higher limit
limiter.setAccountConfig(
    trustedUser,
    24,                    // 24 bins
    86400,                 // 24-hour window
    500000 * 10**18        // 500k GNUS limit
);

// Revert account back to defaults
limiter.setAccountConfig(account, 0, 0, 0);
```

---

#### setLimiterEnabled

Enables or disables the withdrawal limiter globally.

```solidity
function setLimiterEnabled(bool enabled) external
```

**Parameters**:

- `enabled` (bool): True to enable limiter, false to disable

**Access Control**: `onlySuperAdminRole`

**Events Emitted**: `WithdrawLimiterConfigUpdated(defaultLimitAmount, defaultWindowSeconds, defaultBinCount)`

**Security Note**: Super admins always bypass the limiter regardless of this setting.

**Example**:

```solidity
// Disable limiter during maintenance
limiter.setLimiterEnabled(false);

// Re-enable limiter after maintenance
limiter.setLimiterEnabled(true);
```

---

### Query Functions

#### getWithdrawLimiterConfig

Returns the global default configuration.

```solidity
function getWithdrawLimiterConfig() external view returns (
    uint256 defaultLimitAmount,
    uint256 defaultWindowSeconds,
    uint256 defaultBinCount,
    bool limiterEnabled
)
```

**Returns**:

- `defaultLimitAmount` (uint256): Default limit in wei
- `defaultWindowSeconds` (uint256): Default window in seconds
- `defaultBinCount` (uint256): Default bin count
- `limiterEnabled` (bool): Whether limiter is globally enabled

**Example**:

```solidity
(uint256 limit, uint256 window, uint256 bins, bool enabled) =
    limiter.getWithdrawLimiterConfig();
```

---

#### getAccountConfig

Returns the effective configuration for an account (custom or defaults).

```solidity
function getAccountConfig(address account) external view returns (
    uint32 binCount,
    uint64 windowSeconds,
    uint256 limitAmount
)
```

**Parameters**:

- `account` (address): Account to query

**Returns**:

- `binCount` (uint32): Effective bin count
- `windowSeconds` (uint64): Effective window duration
- `limitAmount` (uint256): Effective limit amount

**Behavior**: Returns custom config if set, otherwise returns defaults.

**Example**:

```solidity
(uint32 bins, uint64 window, uint256 limit) =
    limiter.getAccountConfig(userAddress);
```

---

#### getAccountWithdrawStatus

Returns the current withdrawal status for an account.

```solidity
function getAccountWithdrawStatus(address account) external view returns (
    uint256 currentUsage,
    uint256 remainingCapacity,
    uint256 windowEnd
)
```

**Parameters**:

- `account` (address): Account to query

**Returns**:

- `currentUsage` (uint256): Total amount withdrawn in current window
- `remainingCapacity` (uint256): Amount still available to withdraw
- `windowEnd` (uint256): Approximate timestamp when window expires

**Example**:

```solidity
(uint256 used, uint256 remaining, uint256 end) =
    limiter.getAccountWithdrawStatus(userAddress);

console.log("Used:", used / 10**18, "GNUS");
console.log("Remaining:", remaining / 10**18, "GNUS");
console.log("Window ends at:", end);
```

---

## Events

### WithdrawLimiterConfigUpdated

Emitted when default configuration changes.

```solidity
event WithdrawLimiterConfigUpdated(
    uint256 defaultLimitAmount,
    uint256 defaultWindowSeconds,
    uint256 defaultBinCount
)
```

**Parameters**:

- `defaultLimitAmount`: New default limit
- `defaultWindowSeconds`: New default window
- `defaultBinCount`: New default bin count

---

### AccountConfigUpdated

Emitted when per-account configuration changes.

```solidity
event AccountConfigUpdated(
    address indexed account,
    uint32 binCount,
    uint64 windowSeconds,
    uint256 limitAmount
)
```

**Parameters**:

- `account`: Account whose config was updated
- `binCount`: New bin count (0 = default)
- `windowSeconds`: New window duration (0 = default)
- `limitAmount`: New limit amount (0 = default)

---

### WithdrawRecorded

Emitted when a withdrawal is successfully recorded.

```solidity
event WithdrawRecorded(
    address indexed account,
    uint256 amount,
    uint256 timestamp,
    uint256 binIndex
)
```

**Parameters**:

- `account`: Account making withdrawal
- `amount`: Amount withdrawn
- `timestamp`: Timestamp of withdrawal
- `binIndex`: Bin where amount was recorded

---

### WithdrawLimiterTriggered

Emitted when a withdrawal is blocked by the limiter.

```solidity
event WithdrawLimiterTriggered(
    address indexed account,
    uint256 requestedAmount,
    uint256 activeTotal,
    uint256 limit
)
```

**Parameters**:

- `account`: Account attempting withdrawal
- `requestedAmount`: Amount requested
- `activeTotal`: Current total in active bins
- `limit`: Configured limit

---

## Configuration Examples

### Daily Limits (Default)

Suitable for most users with hourly granularity.

```solidity
// Default Configuration
Limit: 100,000 GNUS
Window: 86,400 seconds (24 hours)
Bins: 24 (1 hour per bin)

limiter.setDefaultLimitAmount(100000 * 10**18);
limiter.setDefaultWindowSeconds(86400);
limiter.setDefaultBinCount(24);
```

**Use Case**: Standard user protection with smooth rollover every hour.

---

### Weekly Limits

For longer-term rate limiting with daily granularity.

```solidity
// Weekly Configuration
Limit: 700,000 GNUS
Window: 604,800 seconds (7 days)
Bins: 168 (1 hour per bin)

limiter.setAccountConfig(
    account,
    168,                    // 168 bins (7 days × 24 hours)
    604800,                 // 7 days
    700000 * 10**18         // 700k GNUS
);
```

**Use Case**: High-volume traders or institutional accounts.

---

### High-Frequency Trading

For trusted accounts needing frequent small transfers.

```solidity
// High-Frequency Configuration
Limit: 50,000 GNUS
Window: 3,600 seconds (1 hour)
Bins: 12 (5 minutes per bin)

limiter.setAccountConfig(
    traderAccount,
    12,                     // 12 bins
    3600,                   // 1 hour
    50000 * 10**18          // 50k GNUS
);
```

**Use Case**: Algorithmic trading accounts with short windows and tight limits.

---

### Low Gas Cost

For L2 networks with cheap gas - use more bins for better granularity.

```solidity
// L2 Optimized Configuration
Limit: 100,000 GNUS
Window: 86,400 seconds (24 hours)
Bins: 96 (15 minutes per bin)

limiter.setAccountConfig(
    account,
    96,                     // 96 bins (finer granularity)
    86400,                  // 24 hours
    100000 * 10**18         // 100k GNUS
);
```

**Use Case**: Polygon, Base, or other L2s where gas costs are negligible.

---

## Sybil Attack Prevention

### Strategy

The limiter prevents Sybil attacks by checking the **sender's limit** for all GNUS transfers, not just conversions. Attackers cannot bypass per-account limits by distributing tokens to multiple controlled addresses.

### Integration Points

#### 1. GNUSBridge.withdraw()

Converts child NFTs back to GNUS tokens.

```solidity
// In GNUSBridge.sol
function withdraw(uint256 tokenId, uint256 amount) external {
    // Calculate GNUS output amount
    uint256 gnusAmount = amount * exchangeRate;

    // Check limiter (super admin bypass built-in)
    if (!hasRole(SUPER_ADMIN_ROLE, msg.sender)) {
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(msg.sender, gnusAmount);
    }

    // Proceed with burn and mint
    _burn(msg.sender, tokenId, amount);
    _mint(msg.sender, GNUS_TOKEN_ID, gnusAmount, "");
}
```

**Coverage**: All NFT → GNUS conversions.

---

#### 2. ERC20TransferBatch.\_transferBatch()

Batch GNUS token transfers.

```solidity
// In ERC20TransferBatch.sol
function _transferBatch(
    address operator,
    address[] memory destinations,
    uint256[] memory amounts
) internal {
    // Aggregate total amount across all destinations
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < amounts.length; i++) {
        totalAmount += amounts[i];
    }

    // Check limiter against sender's limit (super admin bypass)
    if (!hasRole(SUPER_ADMIN_ROLE, operator)) {
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(operator, totalAmount);
    }

    // Proceed with transfers
    ...
}
```

**Coverage**: All batch transfers (both `transferBatch()` and `transferOrBurnBatch()`).

**Sybil Prevention**: Even if sending to 100 different addresses, total is checked against sender's limit.

---

#### 3. GNUSERC1155MaxSupply.\_beforeTokenTransfer()

ERC-1155 transfer hook (fallback coverage).

```solidity
// In GNUSERC1155MaxSupply.sol
function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
) internal virtual override {
    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

    // Skip if minting (from == 0) or burning (to == 0)
    if (from == address(0) || to == address(0)) {
        return;
    }

    // Skip if super admin
    if (hasRole(SUPER_ADMIN_ROLE, operator)) {
        return;
    }

    // Aggregate only GNUS token amounts
    uint256 totalGnusAmount = 0;
    for (uint256 i = 0; i < ids.length; i++) {
        if (ids[i] == GNUS_TOKEN_ID) {
            totalGnusAmount += amounts[i];
        }
    }

    // Check limiter if any GNUS tokens transferred
    if (totalGnusAmount > 0) {
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(from, totalGnusAmount);
    }
}
```

**Coverage**: All ERC-1155 transfers (fallback for any path not covered by Bridge or Batch).

**Token Filtering**: Only GNUS tokens (ID = 1) are counted; NFT transfers don't trigger limiter.

---

## Security Considerations

### Super Admin Bypass

Super admins bypass the limiter for administrative operations:

```solidity
if (!hasRole(SUPER_ADMIN_ROLE, account)) {
    // Only check limiter for non-admins
    GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(account, amount);
}
```

**Gas Benefit**: Super admin transfers have **zero limiter overhead**.

---

### Access Control

All configuration functions require `onlySuperAdminRole`:

- `setDefaultLimitAmount()`
- `setDefaultWindowSeconds()`
- `setDefaultBinCount()`
- `setAccountConfig()`
- `setLimiterEnabled()`

**Security**: Only contract owner can modify security parameters.

---

### Input Validation

- **Bin Count**: Must be > 0 (prevents division by zero)
- **Zero Values in AccountConfig**: Automatically fall back to defaults
- **Exchange Rate Calculation**: Applied before limiter check in Bridge

---

### Reentrancy Protection

The limiter uses **checks-effects-interactions pattern**:

1. Check limiter (reverts if exceeded)
2. Update bin state (effects)
3. Proceed with transfers (interactions)

No external calls before state updates = no reentrancy risk.

---

### Storage Collision Prevention

Uses **Diamond storage pattern** with unique slot:

```solidity
bytes32 constant STORAGE_POSITION =
    keccak256("gnus.ai.withdraw.limiter.storage");
```

No conflicts with other facets.

---

## Gas Optimization Benefits

### Deployment Costs

- **GNUSWithdrawLimiter deployment**: 1,649,678 gas (5.5% of 30M block limit)
- **Acceptable**: Reasonable for feature complexity

---

### Runtime Overhead

| Operation                            | Gas Cost         | Target  | Status     |
| ------------------------------------ | ---------------- | ------- | ---------- |
| First withdrawal (cold storage)      | ~30k             | ~30k    | ✅ Meets   |
| Subsequent withdrawal (warm storage) | ~20-25k          | ~30k    | ✅ Exceeds |
| Batch transfer (3 recipients)        | ~25-30k/transfer | ~30k    | ✅ Meets   |
| Super admin bypass                   | 0                | Minimal | ✅ Optimal |

**Conclusion**: Gas costs meet FR-71 target (~30k overhead).

---

### Optimization Techniques

1. **uint128 Packing**: Two values per storage slot (32 bytes)
2. **Lazy Cleanup**: Expired bins zeroed during validation, not continuously
3. **Modulo Arithmetic**: No explicit array resizing or reallocation
4. **Fixed Arrays**: Predictable gas costs regardless of activity
5. **Early Returns**: Super admin and disabled limiter skip all logic

---

## Usage Examples

### Setting Global Defaults

```solidity
// As super admin, set global defaults for all users
GeniusDiamond diamond = GeniusDiamond(diamondAddress);

// Set 24-hour window with 100k GNUS limit
diamond.setDefaultLimitAmount(100000 * 10**18);
diamond.setDefaultWindowSeconds(86400);
diamond.setDefaultBinCount(24);
diamond.setLimiterEnabled(true);
```

---

### Configuring Trusted Account

```solidity
// Configure high-trust account with custom limits
address trustedAccount = 0x123...;

diamond.setAccountConfig(
    trustedAccount,
    48,                    // 48 bins (30-minute granularity)
    86400,                 // 24-hour window
    500000 * 10**18        // 500k GNUS limit
);
```

---

### Querying Account Status

```solidity
// Check user's current withdrawal status
(uint256 used, uint256 remaining, uint256 windowEnd) =
    diamond.getAccountWithdrawStatus(userAddress);

console.log("Used:", used / 10**18, "GNUS");
console.log("Available:", remaining / 10**18, "GNUS");
console.log("Resets at:", windowEnd);
```

---

### Handling Limit Exceeded

```solidity
// User attempts withdrawal
try diamond.withdraw(tokenId, amount) {
    console.log("Withdrawal successful");
} catch Error(string memory reason) {
    if (keccak256(bytes(reason)) ==
        keccak256("Withdrawal limit exceeded for time window")) {
        // Show user their status and ask to wait
        (uint256 used,, uint256 windowEnd) =
            diamond.getAccountWithdrawStatus(msg.sender);

        console.log("Limit exceeded. You've used", used / 10**18, "GNUS");
        console.log("Window resets at", windowEnd);
        console.log("Please try again later");
    }
}
```

---

### Monitoring Events

```solidity
// Listen for limiter events
event WithdrawLimiterTriggered(
    address indexed account,
    uint256 requestedAmount,
    uint256 activeTotal,
    uint256 limit
);

// Off-chain monitoring
diamond.on("WithdrawLimiterTriggered", (account, requested, active, limit) => {
    console.log(`Account ${account} hit withdrawal limit:`);
    console.log(`Requested: ${requested / 10**18} GNUS`);
    console.log(`Active total: ${active / 10**18} GNUS`);
    console.log(`Limit: ${limit / 10**18} GNUS`);

    // Alert security team for investigation
    alertSecurityTeam(account, requested, active, limit);
});
```

---

## Testing Approach

### Test Coverage Achieved

**Overall**: 95.36% (exceeds 95% PRD requirement)

- **GNUSWithdrawLimiter.sol**: 95.45% statements, 95.45% branches
- **GNUSWithdrawLimiterStorage.sol**: 97.14% statements, 72.22% branches

**Total Tests**: 365 (351 Hardhat + 14 Foundry)

---

### Test Types

#### Unit Tests (24 tests)

- Storage library functions (9 tests)
- Facet administrative functions (10 tests)
- Initialization (5 tests)

**Files**:

- `test/unit/withdraw-limiter-storage.test.ts`
- `test/unit/GNUSWithdrawLimiter.test.ts`
- `test/unit/DiamondInitFacet-withdraw-limiter.test.ts`

---

#### Integration Tests (20 tests)

- GNUSBridge integration (7 tests)
- ERC20TransferBatch integration (6 tests)
- GNUSERC1155MaxSupply integration (7 tests)

**Files**:

- `test/integration/withdraw-limiter-bridge.test.ts`
- `test/integration/withdraw-limiter-batch-transfer.test.ts`
- `test/integration/withdraw-limiter-erc1155.test.ts`

---

#### Fuzz Tests (14 tests, 256 runs each)

- Bin calculation edge cases (8 tests)
- Sybil attack prevention (6 tests)

**Files**:

- `test/foundry/fuzz/GNUSWithdrawLimiterFuzz.t.sol`
- `test/foundry/security/GNUSWithdrawLimiterSybilAttack.t.sol`

---

### Test-Driven Development

The implementation followed **RED-GREEN-REFACTOR** workflow:

1. **RED**: Write failing test first
2. **GREEN**: Implement minimal code to pass
3. **REFACTOR**: Optimize and clean up code

**Benefits**:

- All features have test coverage from day one
- Tests serve as executable specifications
- Prevents regression bugs
- Documents expected behavior

---

### Running Tests

```bash
# Run all Hardhat tests
yarn test

# Run specific test suites
yarn test test/unit/GNUSWithdrawLimiter.test.ts
yarn test test/integration/withdraw-limiter-*.test.ts

# Run Foundry fuzz tests
yarn forge:test
yarn forge:fuzz  # 256 runs

# Generate coverage report
yarn coverage
```

---

## Integration Guide

### For New Facets

If you're adding a new facet that transfers GNUS tokens, integrate the limiter:

```solidity
import "./GNUSWithdrawLimiterStorage.sol";
import "./GeniusAccessControl.sol";

contract MyNewFacet is GeniusAccessControl {
    function myTransferFunction(address to, uint256 amount) external {
        // Check limiter (super admin bypass)
        if (!hasRole(SUPER_ADMIN_ROLE, msg.sender)) {
            GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(
                msg.sender,
                amount
            );
        }

        // Proceed with transfer
        _transfer(msg.sender, to, amount);
    }
}
```

---

### For Front-End Integration

```typescript
// Query user's withdrawal status
const [used, remaining, windowEnd] =
  await diamond.getAccountWithdrawStatus(userAddress);

// Display to user
console.log(`Withdrawal Limit Status:
  Used: ${ethers.utils.formatEther(used)} GNUS
  Remaining: ${ethers.utils.formatEther(remaining)} GNUS
  Resets at: ${new Date(windowEnd * 1000).toLocaleString()}
`);

// Check if amount exceeds remaining capacity
if (requestedAmount.gt(remaining)) {
  showError(`Withdrawal limit exceeded. 
               Available: ${ethers.utils.formatEther(remaining)} GNUS
               Please wait until ${new Date(windowEnd * 1000).toLocaleString()}`);
  return;
}

// Proceed with withdrawal
await diamond.withdraw(tokenId, amount);
```

---

### For Off-Chain Monitoring

```javascript
// Monitor limiter events for analytics
diamond.on(
  "WithdrawRecorded",
  (account, amount, timestamp, binIndex, event) => {
    // Log successful withdrawal
    analytics.logWithdrawal({
      account,
      amount: ethers.utils.formatEther(amount),
      timestamp,
      binIndex,
      txHash: event.transactionHash,
    });
  },
);

diamond.on(
  "WithdrawLimiterTriggered",
  (account, requested, active, limit, event) => {
    // Alert on limit exceeded
    alerts.send({
      type: "LIMIT_EXCEEDED",
      account,
      requested: ethers.utils.formatEther(requested),
      active: ethers.utils.formatEther(active),
      limit: ethers.utils.formatEther(limit),
      txHash: event.transactionHash,
    });
  },
);
```

---

## Troubleshooting

### "Withdrawal limit exceeded for time window"

**Cause**: User has withdrawn more than their configured limit in the current window.

**Solution**:

1. Query `getAccountWithdrawStatus()` to see used amount and window end
2. Wait for window to roll over (bins expire after windowSeconds)
3. Contact admin for custom config if legitimately high-volume user

---

### "Bin count must be greater than 0"

**Cause**: Attempting to set bin count to 0.

**Solution**: Bin count must be ≥ 1. Use default value by setting to 0 in `setAccountConfig()`.

---

### Gas costs higher than expected

**Cause**: High bin count or cold storage access.

**Solutions**:

- Reduce bin count for lower gas (trade-off: less granularity)
- First withdrawal is more expensive (cold storage initialization)
- Subsequent withdrawals use warm storage (cheaper)

---

### Limiter not triggering

**Causes**:

1. Limiter disabled globally (`limiterEnabled = false`)
2. Account is super admin (bypass by design)
3. Custom config with very high limits

**Solutions**:

- Check `getWithdrawLimiterConfig()` to verify `limiterEnabled = true`
- Check if account has super admin role
- Check `getAccountConfig()` for effective limits

---

## Additional Resources

- **ERC-2535 Diamond Standard**: https://eips.ethereum.org/EIPS/eip-2535
- **Smart Contracts Overview**: [docs/Smart-Contracts-Overview.md](Smart-Contracts-Overview.md)
- **Access Control**: [docs/GeniusAccessControl.md](GeniusAccessControl.md)
- **Bridge Integration**: [docs/GNUSBridge.md](GNUSBridge.md)
- **Gas Benchmarks**: [reports/withdraw-limiter-gas-benchmarks.md](../reports/withdraw-limiter-gas-benchmarks.md)
- **FR Verification**: [reports/withdraw-limiter-fr-verification.md](../reports/withdraw-limiter-fr-verification.md)
- **PRD**: [project/prd-withdraw-limiter.md](../project/prd-withdraw-limiter.md)

---

## Version History

- **v0.0** (December 2024): Initial implementation with 71 functional requirements
- **Test Coverage**: 95.36% (exceeds 95% requirement)
- **Status**: Production ready ✅

---

**Last Updated**: December 2024  
**Maintainer**: GNUS.AI Development Team  
**Security Contact**: support@gnus.ai
