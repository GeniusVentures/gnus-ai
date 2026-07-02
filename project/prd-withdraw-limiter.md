# Product Requirements Document: Withdraw Limiter

## Introduction/Overview

The Withdraw Limiter is a security feature for the GNUS.AI smart contract system that rate-limits the amount of GNUS tokens any account can transfer or withdraw within a configurable time window. This feature addresses the need to mitigate problematic withdrawal activity, providing a deterrent against exploiting accounts, malicious behavior, and Sybil attacks.

**Comprehensive Security Scope**: The limiter applies to ALL outbound GNUS token transfers, not just NFT→GNUS conversions. This includes NFT withdrawals via `GNUSBridge.withdraw()`, batch transfers via `ERC20TransferBatch`, and ERC-1155 transfers via `safeTransferFrom()` and `safeBatchTransferFrom()`. This comprehensive coverage prevents attackers from bypassing per-account limits by distributing GNUS to multiple Sybil accounts.

The limiter tracks transfer amounts using a **bin-based aggregation system** and blocks transactions that exceed per-account configured limits within a specified time window. This creates a temporal boundary that allows detection of abnormal withdrawal patterns while minimally impacting legitimate user behavior and maintaining optimal gas efficiency.

## Goals

1. **Configurable Rate Limiting**: Implement per-account withdrawal limits that can be adjusted based on user roles, reputation, or security requirements
2. **Minimal Impact on Legitimate Users**: Design limits that don't hinder normal user operations while catching abnormal behavior
3. **Administrative Control**: Provide super administrators with tools to configure limits, bypass limiters, and manage the system
4. **Gas Efficiency**: Implement storage and cleanup mechanisms that minimize gas costs while maintaining security

## User Stories

### As a Token Holder

- I want to withdraw my NFTs back to GNUS tokens without unnecessary friction
- I want to be protected from unauthorized withdrawals if my account is compromised
- I want clear error messages if my withdrawal is blocked so I understand why

### As a Super Administrator

- I want to configure different withdrawal limits for different user types (e.g., verified accounts, new accounts)
- I want to bypass throttle limits for emergency situations or administrative operations
- I want to disable throttling globally if needed during system maintenance or upgrades
- I want to monitor withdrawal patterns across accounts to detect suspicious behavior

### As a Security Auditor

- I want withdrawal limits to be enforced at the smart contract level, not just UI
- I want a transparent, auditable record of all throttle configurations and bypass events
- I want the system to be resilient against attempts to circumvent rate limits

## Functional Requirements

### Core Limiter Mechanism

1. The system **must** use a fixed-size array of time bins to accumulate withdrawal amounts instead of storing individual transactions
2. Each bin **must** store a timestamp and total accumulated withdrawal amount for that time period
3. The system **must** maintain configurable parameters: bin count (default: 24), time window (default: 86400 seconds), and maximum withdrawal amount (default: 100,000 GNUS)
4. On first withdrawal, the system **must** record a base timestamp to establish the bin timeline for that account
5. For each withdrawal, the system **must** calculate which bin the current time falls into using: `binIndex = (currentTime - baseTime) / binLength % binCount`
6. The system **must** add the withdrawal amount to the current bin's total, not create a new record
7. When validating a withdrawal, the system **must** sum all bins with timestamps within the active window
8. Bins with timestamps outside the window (timestamp < currentTime - windowSeconds) **must** be zeroed out
9. If the sum of active bins plus the requested amount exceeds the account's limit, the transaction **must** revert with a clear error message

### Per-Account Configuration

10. The system **must** support per-account configuration including: bin count, window duration, and withdrawal limit
11. Super administrators **must** be able to set custom configurations for specific addresses via `setAccountConfig(address, binCount, windowSeconds, limitAmount)`
12. The system **must** use default values for any account configuration parameter set to zero
13. The system **must** provide a function to query an account's effective configuration (custom or defaults)
14. The system **must** provide a function to query an account's current usage and remaining withdrawal capacity within the current window
15. Bin length **must** be calculated as: `binLength = windowSeconds / binCount`

### Administrative Controls

16. Only super administrators **must** be able to configure limiter parameters
17. Super administrators **must** be able to enable/disable the limiter system globally
18. Super administrators **must** be able to bypass limiter checks when calling withdraw functions
19. Super administrators **must** be able to update default global parameters: `setDefaultLimitAmount()`, `setDefaultWindowSeconds()`, `setDefaultBinCount()`
20. Super administrators **must** be able to set per-account custom configurations
21. All administrative configuration changes **must** emit events for transparency
22. Initialization **must** be handled by `DiamondInitFacet.sol` with a dedicated function (e.g., `initializeGNUSWithdrawLimiter()`)
23. The initialization function **must** be called from the protocol initializer during DiamondCut
24. Initialization **must** set default values: 100,000 GNUS limit, 86,400 seconds window, 24 bins, limiter enabled

### Storage and Cleanup

25. The system **must** use fixed-size bin arrays (size = binCount) per account to eliminate unbounded storage growth
26. Bins **must** be initialized on the account's first withdrawal
27. The system **must** use lazy cleanup: expired bins are zeroed during withdrawal validation, not automatically
28. Bin expiration **must** be determined by: `bin.timestamp < (currentTime - windowSeconds)`
29. The system **must** use efficient data structures: `uint128` for timestamps and amounts to pack two values per storage slot
30. Bin arrays **must** use modulo arithmetic for wrap-around, automatically reusing old bins as time progresses

### Integration with Existing System

31. The limiter check **must** be integrated into the existing `withdraw()` function in `GNUSBridge.sol`
32. The limiter check **must** occur BEFORE any token burning or minting operations
33. The limiter amount **must** be calculated based on the GNUS output amount (after exchange rate conversion)
34. The system **must** follow the ERC-2535 Diamond standard architecture used in GNUS.AI
35. The system **must** use diamond storage pattern to avoid storage collisions
36. Integration **must** call `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(account, amount)`

### Sybil Attack Prevention (Critical Security)

37. The limiter **must** be integrated into `ERC20TransferBatch._transferBatch()` to prevent Sybil account bypass
38. Batch transfers **must** aggregate total amounts across all destinations and check against the SENDER's limit
39. The limiter check in batch transfers **must** occur BEFORE `_beforeTokenTransfer()` hook execution
40. Super admin transfers via batch functions **must** bypass limiter checks (consistent with other integration points)
41. The limiter **must** be integrated into `GNUSERC1155MaxSupply._beforeTokenTransfer()` hook as fallback coverage
42. The transfer hook **must** filter for GNUS_TOKEN_ID (token ID = 1) and accumulate amounts
43. The transfer hook **must** skip minting operations (from == address(0)) and burning operations (to == address(0))
44. The transfer hook **must** only check outbound transfers where both from and to are non-zero addresses
45. Both `transferBatch()` and `transferOrBurnBatch()` **must** be covered by the `_transferBatch()` modification
46. Mixed-token batch transfers **must** only count GNUS token amounts toward the limiter

### Error Handling and Events

47. The system **must** emit a `WithdrawLimiterTriggered` event when a withdrawal is blocked, including: account, requested amount, active total, and limit
48. The system **must** emit a `WithdrawRecorded` event for each successful withdrawal, including: account, amount, timestamp, and binIndex
49. The system **must** emit a `WithdrawLimiterConfigUpdated` event when default configuration changes
50. The system **must** emit an `AccountConfigUpdated` event when per-account configuration changes
51. Reverted transactions **must** include descriptive error messages indicating why the limiter was triggered
52. Event names **must** use "Limiter" terminology consistently throughout
53. Batch transfer events **must** indicate if limiter was triggered for batch operation (not per-destination)

### Bin Calculation Mathematics

54. Bin length **must** be calculated as: `binLengthSeconds = windowSeconds / binCount`
55. Current bin index **must** be calculated as: `binIndex = ((currentTime - baseTimestamp) / binLengthSeconds) % binCount`
56. The first withdrawal **must** initialize `baseTimestamp = block.timestamp`
57. Bin expiration check **must** use: `isExpired = (bin.timestamp < (currentTime - windowSeconds))`
58. The system **must** handle edge cases: zero bin count, first withdrawal, exact bin boundaries, wrap-around
59. All timestamp arithmetic **must** use `uint128` to fit two values per storage slot

### Test-Driven Development

60. Implementation **must** follow Test-Driven Development (TDD) methodology
61. Tests **must** be written before implementation code for each function
62. Minimum 95% code coverage **must** be achieved
63. Test suite **must** include: unit tests, integration tests, fuzz tests, gas benchmarks, and security tests
64. All bin calculation edge cases **must** have explicit test coverage: first withdrawal, wrap-around, bin boundaries, expiration
65. All error conditions **must** have test cases
66. Tests **must** follow RED-GREEN-REFACTOR workflow
67. **Sybil attack simulation tests** **must** verify that batch transfers aggregate amounts against sender's limit
68. **Sybil attack tests** **must** verify that distributing GNUS to multiple accounts via `transferBatch()` does not bypass limiter
69. **Integration tests** **must** verify limiter is triggered in all three integration points: `GNUSBridge.withdraw()`, `ERC20TransferBatch._transferBatch()`, and `GNUSERC1155MaxSupply._beforeTokenTransfer()`
70. **Edge case tests** **must** verify mixed-token batch transfers only count GNUS_TOKEN_ID amounts
71. **Gas benchmarks** **must** measure overhead added to batch transfers (~30k gas expected)

## Non-Goals (Out of Scope)

1. **Whitelist Management**: This feature does not include a separate whitelist system (super admin bypass is sufficient)
2. **Withdrawal Queuing**: Blocked withdrawals will not be queued for later processing - users must wait for the window to expire
3. **Multi-Token Limiting**: Limiter only applies to GNUS withdrawals, not NFT minting or other token operations
4. **Block-Based Windows**: Using timestamps instead of block numbers for more predictable time windows across different chains
5. **Graduated Penalties**: No increasing penalties for repeat violations - simple binary allow/deny
6. **Cross-Chain Limiting**: Each chain's deployment has independent limiter tracking
7. **Front-End Integration**: This PRD covers smart contract implementation only; UI/UX changes are separate
8. **Historical Analytics**: No on-chain analytics dashboard - events can be indexed off-chain
9. **Individual Transaction Storage**: System stores bin totals, not individual transaction records

## Design Considerations

### Storage Pattern

The implementation uses the Diamond Storage pattern with bin-based aggregation to avoid storage collisions and optimize gas costs:

```solidity
library GNUSWithdrawLimiterStorage {
    bytes32 constant STORAGE_POSITION = keccak256("gnus.ai.withdraw.limiter.storage");

    struct WithdrawBin {
        uint128 timestamp;    // Timestamp of the bin
        uint128 totalAmount;  // Accumulated total for this bin
    }

    struct AccountConfig {
        uint32 binCount;          // Number of bins (0 = use default)
        uint64 windowSeconds;     // Window duration (0 = use default)
        uint256 limitAmount;      // Withdrawal limit (0 = use default)
    }

    struct AccountState {
        uint128 baseTimestamp;    // First withdrawal timestamp
        WithdrawBin[] bins;       // Fixed-size array of bins
    }

    struct Layout {
        mapping(address => AccountState) accountStates;
        mapping(address => AccountConfig) accountConfigs;
        uint256 defaultBinCount;
        uint256 defaultWindowSeconds;
        uint256 defaultLimitAmount;
        bool limiterEnabled;
    }
}
```

### Gas Optimization Strategies

- **Bin-Based Aggregation**: Fixed-size arrays of bins eliminate unbounded storage growth, providing O(binCount) read/write complexity
- **Lazy Cleanup**: Expired bins are zeroed during validation, distributing gas costs across transactions
- **Efficient Data Types**: Using `uint128` for timestamps/amounts packs two values in one storage slot (32 bytes)
- **Modulo Arithmetic**: Bins wrap around automatically, reusing old bins without explicit cleanup
- **Constant Storage**: Each account uses exactly `binCount` bins, regardless of transaction frequency
- **No Individual Records**: Accumulating totals per bin avoids storing thousands of individual transactions

**Gas Cost Comparison:**
| Approach | Storage Growth | Read Cost | Write Cost | Active User Impact |
|----------|---------------|-----------|------------|-------------------|
| Individual Records | O(n transactions) | O(n) | O(1) | Increases over time |
| Bin Aggregation | O(binCount) | O(binCount) | O(1) | Constant |

### Access Control Integration

The feature integrates with the existing `GeniusAccessControl` system:

- Uses `onlySuperAdminRole` modifier for administrative functions
- Super admin bypass implemented via role check in limiter validation
- Consistent with existing security patterns in GNUS.AI

## Technical Considerations

### Architecture Components

1. **New Facet**: `GNUSWithdrawLimiter.sol` - Main facet with configuration and query functions
2. **New Storage Library**: `GNUSWithdrawLimiterStorage.sol` - Diamond storage layout and helper functions
3. **Modified Facet**: `GNUSBridge.sol` - Add limiter check to `withdraw()` function
4. **Modified Init Facet**: `DiamondInitFacet.sol` - Add initialization function for limiter settings
5. **Diamond Configuration**: Update `geniusdiamond.config.json` with new facet

### Diamond Integration

The facet should be added at priority 115 (between GNUSControl at 110 and GNUSBridge at 120):

```json
"GNUSWithdrawLimiter": {
  "priority": 115,
  "versions": {
    "0.0": {}
  }
}
```

**Note**: Initialization is handled by `DiamondInitFacet.sol`, not by the facet itself. The facet configuration does not include a `deployInit` property.

### Dependencies

- `@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol`
- `contracts-starter/contracts/libraries/LibDiamond.sol`
- `./GeniusAccessControl.sol` - For access control modifiers
- `./GNUSConstants.sol` - For GNUS_TOKEN_ID and GNUS_DECIMALS
- `./GNUSWithdrawLimiterStorage.sol` - Storage library
- `./DiamondInitFacet.sol` - Protocol initialization (modified)

### Upgrade Path

This is a new feature, so initial deployment will:

1. Add `initializeGNUSWithdrawLimiter()` function to `DiamondInitFacet.sol` to set default values:
   - `defaultLimitAmount` = 100,000 GNUS (100000 \* 10^18)
   - `defaultWindowSeconds` = 86,400 seconds (1 day)
   - `defaultBinCount` = 24 bins
   - `limiterEnabled` = true
2. Update the protocol initializer (e.g., `diamondInitialize250()`) to call `initializeGNUSWithdrawLimiter()`
3. Deploy the new `GNUSWithdrawLimiter` facet
4. Modify `GNUSBridge` facet to include limiter check
5. Create a DiamondCut transaction that:
   - Adds the `GNUSWithdrawLimiter` facet
   - Upgrades the `GNUSBridge` facet
   - Calls the protocol initializer function to initialize all new/updated components

**Initialization Pattern**: The GNUS.AI system uses `DiamondInitFacet.sol` as the centralized protocol initializer. Each new feature adds its initialization logic to this facet, which is then called during the DiamondCut transaction. This ensures all initialization happens atomically in a single transaction.

### Testing Requirements

**Test-Driven Development**: All implementation **must** follow TDD methodology (RED-GREEN-REFACTOR).

- **Unit Tests**: Test bin calculation, limit enforcement, configuration management
  - Bin index calculation with various timestamps
  - Wrap-around behavior after `binCount` bins
  - Expiration logic for bins outside window
  - Per-account vs default configuration
- **Multi-Chain Tests**: Verify limiter works independently on different chains
- **Integration Tests**: Test interaction with existing withdraw functionality in GNUSBridge
- **Fuzz Tests**: Property-based testing for bin calculations and edge cases
- **Gas Benchmarks**: Measure gas costs with varying bin counts and active bins

**Coverage Requirements:**

- Minimum 95% code coverage across all facets and storage libraries
- 100% coverage for bin calculation logic
- All error conditions must have corresponding test cases

## Success Metrics

1. **Security**: Zero successful circumventions of limiter limits in production
2. **Detection Rate**: Limiter triggers on 100% of withdrawals exceeding configured limits
3. **False Positive Rate**: <1% of legitimate withdrawals blocked (indicates proper limit configuration)
4. **Gas Efficiency**:
   - Average gas overhead <30k gas for limiter check with 24 bins
   - Gas costs remain constant regardless of account activity level
5. **Storage Efficiency**: Maximum storage per account = `binCount * 32 bytes` (predictable and bounded)
6. **Administrative Usage**: Super admin configuration functions work without errors 100% of the time
7. **System Stability**: No increase in failed transactions due to limiter implementation bugs

## Open Questions

1. **Default Bin Count**: Is 24 bins optimal, or should it vary by network (faster chains = more bins)?
2. **Limit Selection**: Should the default 100,000 GNUS limit be based on analysis of historical withdrawal patterns?
3. **Time Window Duration**: Is 86,400 seconds (1 day) the optimal window, or should different networks use different defaults?
4. **Alert Mechanism**: Should there be an off-chain alerting system when limiters are frequently triggered for an account?
5. **Limit Adjustment Policy**: What criteria should be used to approve custom per-account configurations?
6. **Emergency Procedures**: What is the process for super admin to temporarily disable limiters during legitimate high-volume events?
7. **Bin Data Export**: Should there be a view function to export all bin data for off-chain analysis?
8. **Multi-Signature**: Should limiter configuration changes require multi-sig approval for additional security?

## Implementation Timeline

**Note**: All implementation must follow Test-Driven Development (TDD) - tests written before code.

- **Phase 1** (Week 1):
  - Write test specifications for all bin calculation logic
  - Implement storage library with bin structures
  - Implement facet contract following TDD
- **Phase 2** (Week 1-2):
  - Write integration tests for GNUSBridge interaction
  - Integrate limiter check with GNUSBridge
  - Test locally across multiple chains
- **Phase 3** (Week 2):
  - Write comprehensive test suite (Hardhat + Foundry)
  - Fuzz tests for bin calculations
  - Gas benchmarking with various configurations
  - Achieve 95%+ code coverage
- **Phase 4** (Week 3):
  - Security audit and gas optimization
  - Address any findings from audit
- **Phase 5** (Week 3):
  - Deploy to testnet and validate
  - Run extended soak tests
- **Phase 6** (Week 4):
  - Deploy to production networks
  - Monitor initial deployment

## Notes for Junior Developers

- **Diamond Pattern**: This system uses ERC-2535 Diamond proxy. Each facet is like a module that adds functions to the main contract. Think of it like plugins that extend the base functionality.
- **Storage Pattern**: Diamond storage uses a specific slot to store data, preventing conflicts between facets. Always use the storage library to access data.
- **Bin-Based System**: Instead of storing each withdrawal as a separate record, we accumulate them into time bins (like hourly buckets). This keeps storage constant and gas costs predictable.
- **Initialization Pattern**: In the Diamond system, initialization is centralized in `DiamondInitFacet.sol`. When adding a new facet, you create an initialization function in `DiamondInitFacet` (e.g., `initializeGNUSWithdrawLimiter()`), then call it from the main protocol initializer (e.g., `diamondInitialize250()`). This ensures all initialization happens atomically during the DiamondCut transaction.
- **Timestamps vs Block Numbers**: We use `block.timestamp` for time windows because it provides consistent, human-readable time periods across all EVM chains regardless of block time variations.
- **Modulo Arithmetic**: The bin system uses `% binCount` to wrap around - when you run out of bins, it automatically starts reusing the oldest ones. This is like a circular buffer.
- **Gas Optimization**: By using fixed-size arrays and accumulating totals, we avoid the gas cost explosion that comes from iterating through hundreds or thousands of individual transaction records.
- **Access Control**: The `onlySuperAdminRole` modifier ensures only the contract owner can change security-critical settings.
- **Test-Driven Development**: Write tests first! This ensures your code does what it's supposed to do and catches bugs early. Follow RED (failing test) → GREEN (passing code) → REFACTOR (cleanup) cycle.
