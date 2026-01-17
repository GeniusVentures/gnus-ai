## Design Document: GNUS.AI Withdraw Limiter

### Overview

The Withdraw Limiter is a rate-limiting mechanism that restricts the amount of GNUS tokens that can be transferred or withdrawn by any account within a configurable time window. This prevents rapid drainage of funds and provides additional security against exploits, unauthorized withdrawals, and Sybil attacks.

The system uses a **bin-based aggregation** approach where GNUS token transfers are accumulated into time bins rather than storing individual transactions, providing superior gas efficiency while maintaining accurate rate limiting.

**Critical Security Scope**: The limiter applies to ALL outbound GNUS token transfers, not just NFT→GNUS conversions. This includes:
- NFT withdrawals via `GNUSBridge.withdraw()`
- Batch transfers via `ERC20TransferBatch.transferBatch()`
- Batch burn/transfer via `ERC20TransferBatch.transferOrBurnBatch()`
- ERC-1155 transfers via `safeTransferFrom()` and `safeBatchTransferFrom()`

This comprehensive coverage prevents attackers from bypassing per-account limits by distributing GNUS to multiple Sybil accounts.

### Architecture

Following the ERC-2535 Diamond pattern used in the GNUS.AI system, the implementation consists of:

1. **`GNUSWithdrawLimiterStorage.sol`** - Diamond storage library for limiter configuration and withdrawal bins
2. **`GNUSWithdrawLimiter.sol`** - Facet implementing limiter logic and configuration management
3. **`DiamondInitFacet.sol`** - Modified to include initialization function for limiter settings
4. **Modifications to GNUSBridge.sol** - Integration of limiter checks into the existing `withdraw()` function
5. **Modifications to ERC20TransferBatch.sol** - Integration of limiter checks into `transferBatch()` and `transferOrBurnBatch()` functions to prevent Sybil attack bypass
6. **Modifications to GNUSERC1155MaxSupply.sol** - Integration of limiter checks into `_beforeTokenTransfer()` hook for comprehensive coverage

### Storage Design

```solidity
// GNUSWithdrawLimiterStorage.sol
```

**Data Structures:**

| Field | Type | Description |
|-------|------|-------------|
| `WithdrawBin` | struct | Stores bin timestamp and accumulated withdrawal amount |
| `AccountConfig` | struct | Per-account configuration (binCount, windowSeconds, limitAmount) |
| `AccountState` | struct | Per-account state (bins array, baseTimestamp) |
| `accountStates` | mapping(address => AccountState) | Per-account withdrawal bins and base time |
| `accountConfigs` | mapping(address => AccountConfig) | Per-account custom configurations |
| `defaultBinCount` | uint256 | Default number of bins (e.g., 24 for hourly bins in 24-hour window) |
| `defaultWindowSeconds` | uint256 | Default window duration in seconds (e.g., 86400 = 1 day) |
| `defaultLimitAmount` | uint256 | Default max GNUS tokens withdrawable within the window |
| `limiterEnabled` | bool | Toggle to enable/disable limiting |

**WithdrawBin Structure:**
```solidity
struct WithdrawBin {
    uint128 timestamp;    // Timestamp of the bin
    uint128 totalAmount;  // Accumulated total for this bin
}
```

**AccountConfig Structure:**
```solidity
struct AccountConfig {
    uint32 binCount;          // Number of bins for this account (0 = use default)
    uint64 windowSeconds;     // Window duration for this account (0 = use default)
    uint256 limitAmount;      // Withdrawal limit for this account (0 = use default)
}
```

**AccountState Structure:**
```solidity
struct AccountState {
    uint128 baseTimestamp;     // First withdrawal timestamp (establishes bin timeline)
    WithdrawBin[] bins;        // Array of withdrawal bins
}
```

### Facet Design

**GNUSWithdrawLimiter.sol Functions:**

| Function | Access | Description |
|----------|--------|-------------|
| `setDefaultLimitAmount(uint256)` | onlySuperAdminRole | Set default max withdrawable amount |
| `setDefaultWindowSeconds(uint256)` | onlySuperAdminRole | Set default time window duration |
| `setDefaultBinCount(uint256)` | onlySuperAdminRole | Set default number of bins |
| `setAccountConfig(address, uint32, uint64, uint256)` | onlySuperAdminRole | Set per-account custom configuration |
| `setLimiterEnabled(bool)` | onlySuperAdminRole | Enable/disable limiting |
| `getWithdrawLimiterConfig()` | view | Get default configuration |
| `getAccountConfig(address)` | view | Get account's configuration (custom or defaults) |
| `getAccountWithdrawStatus(address)` | view | Get account's current usage and remaining capacity |
| `checkWithdrawAllowed(address, uint256)` | internal | Core validation logic |
| `recordWithdraw(address, uint256)` | internal | Add amount to current bin |
| `calculateCurrentBin(address, uint256)` | internal | Determine which bin current time falls into |
| `sumActiveBins(address, uint256)` | internal | Sum bins within active window |

### Core Algorithm

```
function checkAndRecordWithdraw(account, amount) internal returns (bool):
    if (!limiterEnabled) return true
    
    // Check if super admin - bypass limiter
    if (isSuperAdmin(account)) return true
    
    // Get account configuration (custom or defaults)
    config = getAccountConfigOrDefaults(account)
    currentTime = block.timestamp
    
    // Initialize account state on first withdrawal
    if (accountStates[account].baseTimestamp == 0):
        accountStates[account].baseTimestamp = currentTime
        // Initialize bins array with config.binCount entries
        for i from 0 to config.binCount:
            accountStates[account].bins.push(WithdrawBin(0, 0))
    
    // Calculate which bin the current time falls into
    binIndex = calculateCurrentBin(account, currentTime, config)
    
    // Zero out expired bins (outside the window)
    zeroExpiredBins(account, currentTime, config)
    
    // Sum all active bins to get total withdrawals in window
    activeTotal = sumActiveBins(account, currentTime, config)
    
    // Check against limit
    if (activeTotal + amount > config.limitAmount):
        emit WithdrawLimiterTriggered(account, amount, activeTotal, config.limitAmount)
        revert("Withdraw limit exceeded for time window")
    
    // Add amount to current bin
    accountStates[account].bins[binIndex].totalAmount += amount
    accountStates[account].bins[binIndex].timestamp = currentTime
    
    emit WithdrawRecorded(account, amount, currentTime, binIndex)
    
    return true

function calculateCurrentBin(account, currentTime, config) internal view returns (uint256):
    baseTime = accountStates[account].baseTimestamp
    binLength = config.windowSeconds / config.binCount
    
    // Calculate elapsed time since base
    elapsed = currentTime - baseTime
    
    // Calculate current bin index (wraps around)
    binIndex = (elapsed / binLength) % config.binCount
    
    return binIndex

function zeroExpiredBins(account, currentTime, config) internal:
    bins = accountStates[account].bins
    windowCutoff = currentTime - config.windowSeconds
    
    for i from 0 to bins.length:
        // If bin timestamp is outside window, reset it
        if (bins[i].timestamp < windowCutoff):
            bins[i].totalAmount = 0
            bins[i].timestamp = 0

function sumActiveBins(account, currentTime, config) internal view returns (uint256):
    bins = accountStates[account].bins
    windowCutoff = currentTime - config.windowSeconds
    total = 0
    
    for i from 0 to bins.length:
        // Only sum bins within the active window
        if (bins[i].timestamp >= windowCutoff):
            total += bins[i].totalAmount
    
    return total

function getAccountConfigOrDefaults(account) internal view returns (AccountConfig):
    custom = accountConfigs[account]
    
    return AccountConfig({
        binCount: custom.binCount > 0 ? custom.binCount : defaultBinCount,
        windowSeconds: custom.windowSeconds > 0 ? custom.windowSeconds : defaultWindowSeconds,
        limitAmount: custom.limitAmount > 0 ? custom.limitAmount : defaultLimitAmount
    })
```

### Bin Calculation Mathematics

**Bin Length Calculation:**
```
binLengthSeconds = windowSeconds / binCount
```

**Current Bin Index:**
```
elapsedSeconds = currentTime - baseTimestamp
binIndex = (elapsedSeconds / binLengthSeconds) % binCount
```

**Example:**
- Window: 86400 seconds (24 hours)
- Bin Count: 24
- Bin Length: 3600 seconds (1 hour per bin)
- Base Time: 2026-01-16 00:00:00
- Current Time: 2026-01-16 14:30:00
- Elapsed: 52200 seconds
- Bin Index: (52200 / 3600) % 24 = 14.5 → 14

**Window Expiration Check:**
```
windowCutoff = currentTime - windowSeconds

For each bin:
    if (bin.timestamp < windowCutoff):
        bin is expired, set totalAmount = 0
```

### Integration Points

**1. GNUSBridge.sol `withdraw()` function modification:**

The existing withdraw function at GNUSBridge.sol:

```solidity
function withdraw(uint256 amount, uint256 id) external {
    address sender = _msgSender();
    require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
    require(id != GNUS_TOKEN_ID, "Cannot withdraw GNUS tokens.");
    require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
    
    // ADD: Limiter check before proceeding
    uint256 gnusAmount = amount / GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
    GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(sender, gnusAmount);
    
    _burn(sender, id, amount);
    _mintWithdrawFee(sender, GNUS_TOKEN_ID, gnusAmount);
}
```

**2. ERC20TransferBatch.sol `_transferBatch()` function modification:**

**Security Rationale**: Without this check, attackers could convert NFTs to GNUS (hitting limiter), then use `transferBatch()` to distribute GNUS to N Sybil accounts (bypassing limiter), with each Sybil withdrawing independently (N × limit total).

```solidity
function _transferBatch(
    address[] memory destinations,
    uint256[] memory amounts,
    bool checkBurn
) internal virtual {
    address operator = _msgSender();
    require(
        destinations.length == amounts.length,
        "TransferBatch: to and amounts length mismatch"
    );

    // ADD: Limiter check for batch transfers (prevent Sybil bypass)
    // Super admins bypass limiter checks
    if (!hasRole(SUPER_ADMIN_ROLE, operator)) {
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        // Check aggregate transfer amount against limiter
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(operator, totalAmount);
    }

    _beforeTokenTransfer(operator, destinations, amounts);

    for (uint256 i = 0; i < destinations.length; i++) {
        address to = destinations[i];
        if (checkBurn) {
            require(to != address(0), "TransferBatch: transfer to the zero address");
        }

        uint256 fromBalance = ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][operator];
        require(
            fromBalance >= amounts[i],
            "TransferBatch: transfer amount exceeds balance"
        );
        unchecked {
            ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][operator] = fromBalance - amounts[i];
            ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][to] += amounts[i];
        }
    }

    emit TransferBatch(operator, operator, destinations, amounts);

    _afterTokenTransfer(operator, operator, destinations, amounts);
}
```

**Note**: This modification applies to both `transferBatch()` and `transferOrBurnBatch()` since they both call `_transferBatch()` internally.

**3. GNUSERC1155MaxSupply.sol `_beforeTokenTransfer()` hook modification:**

**Security Rationale**: Provides a fallback layer to catch any ERC-1155 GNUS token transfers (including `safeTransferFrom()` and `safeBatchTransferFrom()`) that might bypass other integration points.

```solidity
function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
) internal virtual override {
    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    
    // ADD: Limiter check for GNUS token transfers
    // Only check outbound transfers (from != address(0))
    // Skip burns (to == address(0)) as they're handled separately
    // Super admins bypass limiter checks
    if (from != address(0) && to != address(0) && !hasRole(SUPER_ADMIN_ROLE, operator)) {
        uint256 totalGnusAmount = 0;
        
        // Accumulate GNUS token amounts (GNUS_TOKEN_ID = 1)
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == GNUS_TOKEN_ID) {
                totalGnusAmount += amounts[i];
            }
        }
        
        // Check aggregate GNUS transfer amount against limiter
        if (totalGnusAmount > 0) {
            GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(from, totalGnusAmount);
        }
    }
}
```

### Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `defaultLimitAmount` | 100,000 GNUS (100000 * 10^18) | Default max GNUS withdrawable per window |
| `defaultWindowSeconds` | 86400 (1 day) | Default window duration in seconds |
| `defaultBinCount` | 24 | Default number of time bins (hourly bins for 24-hour window) |
| `accountConfigs[address]` | {0, 0, 0} (uses defaults) | Per-account custom configurations |
| `limiterEnabled` | true | Limiting active by default |

**Bin Length Calculation:**
```
binLengthSeconds = windowSeconds / binCount
```

**Example Configurations:**

| Bin Count | Window (sec) | Window (hrs) | Bin Length | Use Case |
|-----------|--------------|--------------|------------|----------|
| 24 | 86400 | 24 hrs | 3600 sec (1 hr) | Standard daily limit |
| 7 | 604800 | 168 hrs | 86400 sec (1 day) | Weekly limit with daily bins |
| 48 | 86400 | 24 hrs | 1800 sec (30 min) | High-frequency trading |
| 12 | 43200 | 12 hrs | 3600 sec (1 hr) | Half-day limit |

### Events

```solidity
event WithdrawLimiterConfigUpdated(uint256 defaultLimitAmount, uint256 defaultWindowSeconds, uint256 defaultBinCount, bool enabled);
event AccountConfigUpdated(address indexed account, uint32 binCount, uint64 windowSeconds, uint256 limitAmount);
event WithdrawLimiterTriggered(address indexed account, uint256 requestedAmount, uint256 activeTotal, uint256 limit);
event WithdrawRecorded(address indexed account, uint256 amount, uint256 timestamp, uint256 binIndex);
```

### Security Considerations

1. **Gas Optimization**: Fixed-size bin arrays eliminate unbounded storage growth
2. **Bin-Based Aggregation**: Accumulating withdrawals into bins (instead of storing each transaction) dramatically reduces gas costs
3. **Constant Time Lookup**: Calculating current bin is O(1), summing bins is O(binCount) where binCount is fixed
4. **Array Bounds**: Bin count is fixed per account, preventing DoS via storage exhaustion
5. **Access Control**: Only `onlySuperAdminRole` can modify limiter parameters
6. **Super Admin Bypass**: Super admin withdrawals bypass limiter checks for emergency operations
7. **Per-Account Configuration**: Custom limits allow flexibility for different user tiers without gas overhead
8. **Precision**: Limiter applies to GNUS output amount (after exchange rate conversion)
9. **Base Timestamp**: First withdrawal establishes consistent bin timeline for the account
10. **Wrap-Around Logic**: Bins wrap around using modulo arithmetic, automatically reusing old bins

#### Sybil Attack Prevention

**Attack Vector Identified**: An attacker could attempt to bypass per-account limits by:
1. Converting NFTs to GNUS tokens (hits limiter)
2. Using `transferBatch()` to distribute GNUS to N Sybil accounts (bypasses limiter if unchecked)
3. Each Sybil account withdraws independently, each getting full withdrawal limit
4. **Result**: N × limit can be extracted instead of 1 × limit

**Mitigation Strategy**: The limiter is integrated into ALL GNUS token transfer paths:
- **`GNUSBridge.withdraw()`**: Primary NFT→GNUS conversion point
- **`ERC20TransferBatch._transferBatch()`**: Aggregates batch transfer amounts and checks against limiter BEFORE executing transfers
- **`GNUSERC1155MaxSupply._beforeTokenTransfer()`**: Hook catches any ERC-1155 GNUS token transfers as fallback

**Design Decision**: Batch transfers aggregate total amount across all destinations and check against the SENDER's limit, not individual recipient limits. This prevents distributing large amounts to Sybil accounts for later extraction.

**Edge Cases Covered**:
- Single transfers via `safeTransferFrom()` → caught by `_beforeTokenTransfer()` hook
- Batch transfers via `safeBatchTransferFrom()` → caught by `_beforeTokenTransfer()` hook
- Batch transfers via `transferBatch()` → caught by `_transferBatch()` modification
- Batch burn/transfer via `transferOrBurnBatch()` → caught by `_transferBatch()` modification
- Mixed token batch transfers → hook filters for GNUS_TOKEN_ID only

**Gas Impact**: Batch transfer limiter check adds ~30k gas overhead (bin calculation + storage updates), consistent with single withdrawal overhead.

### Diamond Configuration Entry

Add to geniusdiamond.config.json:

```json
"GNUSWithdrawLimiter": {
  "priority": 115,
  "versions": {
    "0.0": {}
  }
}
```

**Initialization**: Handled by `DiamondInitFacet.sol` via `initializeGNUSWithdrawLimiter()` function called from the protocol initializer (e.g., `diamondInitialize250()`). Default values:
- `defaultLimitAmount` = 100,000 GNUS (100000 * 10^18)
- `defaultWindowSeconds` = 86,400 seconds (1 day)
- `defaultBinCount` = 24 bins
- `limiterEnabled` = true

### File Structure

```
contracts/gnus-ai/
├── GNUSWithdrawLimiter.sol         # New facet
├── GNUSWithdrawLimiterStorage.sol  # New storage library
├── DiamondInitFacet.sol            # Modified (add initialization)
├── GNUSBridge.sol                  # Modified (add limiter check)
```

---

### Gas Optimization: Bin-Based Aggregation

**Problem**: Storing individual withdrawal transactions causes unbounded array growth, leading to increasing gas costs as accounts become more active.

**Solution**: Use a fixed-size array of time bins where each bin accumulates the total withdrawal amount for its time period. This provides O(1) writes and O(binCount) reads, where binCount is small and fixed.

**How It Works:**

1. **Bin Array Initialization**: When an account makes their first withdrawal, create a fixed array of bins (e.g., 24 bins for 24-hour window)

2. **Base Timestamp**: Record the timestamp of the first withdrawal as the "base time" for calculating bin positions

3. **Current Bin Calculation**: For each withdrawal, calculate which bin it falls into:
   ```
   elapsedTime = currentTime - baseTime
   binLength = windowSeconds / binCount
   binIndex = (elapsedTime / binLength) % binCount
   ```

4. **Accumulation**: Add the withdrawal amount to the calculated bin's total:
   ```
   bins[binIndex].totalAmount += withdrawalAmount
   bins[binIndex].timestamp = currentTime
   ```

5. **Window Validation**: Sum all bins with timestamps within the window:
   ```
   windowCutoff = currentTime - windowSeconds
   for each bin:
       if bin.timestamp >= windowCutoff:
           total += bin.totalAmount
   ```

6. **Automatic Expiration**: Bins outside the window are zeroed when checked, automatically recycled as time progresses

**Example Scenario (24 bins, 24-hour window):**

```
Initial State (first withdrawal at T0):
- Base Timestamp: T0
- Bins: [0, 0, 0, ..., 0] (24 empty bins)

Withdrawal at T0 + 0h (1000 GNUS):
- Bin 0: {timestamp: T0, total: 1000}

Withdrawal at T0 + 3.5h (2000 GNUS):
- Bin 3: {timestamp: T0+3.5h, total: 2000}

Withdrawal at T0 + 25h (500 GNUS):
- Bin 1: {timestamp: T0+25h, total: 500}
- Note: Bin 0 is now expired (>24h old), automatically excluded from sum
```

**Benefits:**

| Aspect | Individual Records | Bin-Based |
|--------|-------------------|-----------|
| Storage Growth | Unbounded (O(n)) | Fixed (O(binCount)) |
| Write Cost | O(1) + cleanup | O(1) |
| Read Cost | O(n) | O(binCount) |
| Gas for Active Users | Increases over time | Constant |
| Memory Per Account | ~32 bytes × transactions | ~32 bytes × binCount |

**Example Gas Savings:**

- Traditional approach with 100 withdrawals: ~3.2KB storage, O(100) read
- Bin approach with 24 bins: ~768 bytes storage, O(24) read
- **76% storage reduction, predictable gas costs**

---

### Test-Driven Development Approach

This feature **must** be implemented using Test-Driven Development (TDD) methodology:

1. **Write Tests First**: Before implementing each function, write comprehensive tests covering:
   - Happy path scenarios
   - Edge cases (boundaries, zero values, max values)
   - Failure cases (exceeded limits, invalid inputs)
   - Integration scenarios with GNUSBridge

2. **Test Categories**:
   - **Unit Tests**: Test individual functions in isolation
   - **Integration Tests**: Test limiter interaction with withdrawal system
   - **Fuzz Tests**: Property-based testing for bin calculations
   - **Gas Benchmarking**: Measure and optimize gas costs

3. **Test Coverage Requirements**:
   - Minimum 95% code coverage
   - All public/external functions must have test cases
   - All error conditions must be tested
   - Bin calculation edge cases (wrap-around, expiration) must be tested

4. **Example Test Structure**:
   ```typescript
   describe("GNUSWithdrawLimiter", () => {
     describe("Bin Calculation", () => {
       it("should calculate correct bin index for first withdrawal")
       it("should wrap around after binCount bins")
       it("should handle withdrawals exactly on bin boundaries")
     })
     
     describe("Limit Enforcement", () => {
       it("should allow withdrawals under limit")
       it("should reject withdrawals that exceed limit")
       it("should use per-account config when set")
       it("should fall back to defaults when no account config")
     })
     
     describe("Bin Expiration", () => {
       it("should exclude bins outside window from total")
       it("should automatically zero expired bins")
       it("should recycle bins as time progresses")
     })
   })
   ```

5. **TDD Workflow**:
   - RED: Write failing test
   - GREEN: Write minimum code to pass test
   - REFACTOR: Optimize and clean up code
   - Repeat for each function/feature