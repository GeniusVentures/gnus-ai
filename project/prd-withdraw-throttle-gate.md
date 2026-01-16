# Product Requirements Document: Withdraw Throttle Gate

## Introduction/Overview

The Withdraw Throttle Gate is a security feature for the GNUS.AI smart contract system that rate-limits the amount of GNUS tokens any account can withdraw within a configurable time window. This feature addresses the need to mitigate problematic withdrawal activity, providing a deterent against exploiting accounts and malicious behavior.

When users convert hierarchical NFTs back to GNUS ERC-20 tokens via the `withdraw()` function, the throttle gate will track withdrawal amounts and block transactions that exceed per-account configured limits within a specified time window. This creates a temporal boundary that allows detection of abnormal withdrawal patterns while minimally impacting legitimate user behavior.

## Goals

1. **Configurable Rate Limiting**: Implement per-account withdrawal limits that can be adjusted based on user roles, reputation, or security requirements
2. **Minimal Impact on Legitimate Users**: Design limits that don't hinder normal user operations while catching abnormal behavior
3. **Administrative Control**: Provide super administrators with tools to configure limits, bypass throttles, and manage the system
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

### Core Throttle Mechanism

1. The system **must** track each withdrawal transaction including: account address, withdrawal amount (in GNUS), and timestamp
2. The system **must** maintain a configurable time window (default: 86400 seconds = 1 day)
3. The system **must** maintain a configurable maximum withdrawal amount per account per window (default: 100,000 GNUS)
4. When a withdrawal is attempted, the system **must** sum all withdrawals within the current time window for that account
5. If the sum of active withdrawals plus the requested amount exceeds the account's limit, the transaction **must** revert with a clear error message
6. If the withdrawal is allowed, the system **must** record the new withdrawal in storage before proceeding

### Per-Account Configuration

7. The system **must** support per-account withdrawal limit configuration
8. Super administrators **must** be able to set custom withdrawal limits for specific addresses
9. The system **must** use the default global limit for accounts without custom configuration
10. The system **must** provide a function to query an account's current withdrawal limit
11. The system **must** provide a function to query an account's remaining withdrawal capacity within the current window

### Administrative Controls

12. Only super administrators **must** be able to configure withdrawal limits
13. Super administrators **must** be able to enable/disable the throttle system globally
14. Super administrators **must** be able to bypass throttle checks when calling withdraw functions
15. Super administrators **must** be able to update the default global withdrawal limit
16. Super administrators **must** be able to update the time window duration
17. All administrative configuration changes **must** emit events for transparency
18. Initialization **must** be handled by `DiamondInitFacet.sol` with a dedicated function (e.g., `initializeGNUSWithdrawThrottle()`)
19. The initialization function **must** be called from the protocol initializer during DiamondCut
20. Initialization **must** set default values: 100,000 GNUS limit, 86,400 seconds window, throttle enabled

### Storage and Cleanup

21. The system **must** use lazy cleanup: expired records are removed during withdrawal checks, not automatically
22. The system **must** implement a maximum cap on stored withdrawal records per account (100 records) to prevent unbounded storage growth
23. If the record cap is reached, the system **must** remove the oldest expired records first
24. The system **must** use efficient data structures (arrays) to minimize gas costs

### Integration with Existing System

25. The throttle check **must** be integrated into the existing `withdraw()` function in `GNUSBridge.sol`
26. The throttle check **must** occur BEFORE any token burning or minting operations
27. The throttle amount **must** be calculated based on the GNUS output amount (after exchange rate conversion)
28. The system **must** follow the ERC-2535 Diamond standard architecture used in GNUS.AI
29. The system **must** use diamond storage pattern to avoid storage collisions

### Error Handling and Events

30. The system **must** emit a `WithdrawThrottleTriggered` event when a withdrawal is blocked, including: account, requested amount, active total, and limit
31. The system **must** emit a `WithdrawRecorded` event for each successful withdrawal recording
32. The system **must** emit a `WithdrawThrottleConfigUpdated` event when configuration changes
33. Reverted transactions **must** include descriptive error messages indicating why the throttle was triggered

## Non-Goals (Out of Scope)

1. **Whitelist Management**: This feature does not include a separate whitelist system (super admin bypass is sufficient)
2. **Withdrawal Queuing**: Blocked withdrawals will not be queued for later processing - users must wait for the window to expire
3. **Multi-Token Throttling**: Throttle only applies to GNUS withdrawals, not NFT minting or other token operations
4. **Block-Based Windows**: Using timestamps instead of block numbers for more predictable time windows across different chains
5. **Graduated Penalties**: No increasing penalties for repeat violations - simple binary allow/deny
6. **Cross-Chain Throttling**: Each chain's deployment has independent throttle tracking
7. **Front-End Integration**: This PRD covers smart contract implementation only; UI/UX changes are separate
8. **Historical Analytics**: No on-chain analytics dashboard - events can be indexed off-chain

## Design Considerations

### Storage Pattern

The implementation uses the Diamond Storage pattern to avoid storage collisions:

```solidity
library GNUSWithdrawThrottleStorage {
    bytes32 constant STORAGE_POSITION = keccak256("gnus.ai.withdraw.throttle.storage");
    
    struct WithdrawRecord {
        uint128 amount;      // Withdrawal amount in GNUS
        uint128 timestamp;   // Timestamp when withdrawal occurred
    }
    
    struct Layout {
        mapping(address => WithdrawRecord[]) withdrawRecords;
        mapping(address => uint256) accountLimits;
        uint256 defaultLimitAmount;
        uint256 limitSeconds;
        bool throttleEnabled;
    }
}
```

### Gas Optimization Strategies

- **Lazy Cleanup**: Records are only cleaned when users make withdrawals, distributing gas costs
- **Efficient Data Types**: Using `uint128` for amounts/timestamps to pack two values in one storage slot
- **Array Pruning**: Removing expired records during iteration, avoiding separate cleanup transactions
- **Bounded Storage**: Maximum 100 records per account prevents unbounded loops

### Access Control Integration

The feature integrates with the existing `GeniusAccessControl` system:
- Uses `onlySuperAdminRole` modifier for administrative functions
- Super admin bypass implemented via role check in throttle validation
- Consistent with existing security patterns in GNUS.AI

## Technical Considerations

### Architecture Components

1. **New Facet**: `GNUSWithdrawThrottle.sol` - Main facet with configuration and query functions
2. **New Storage Library**: `GNUSWithdrawThrottleStorage.sol` - Diamond storage layout and helper functions
3. **Modified Facet**: `GNUSBridge.sol` - Add throttle check to `withdraw()` function
4. **Modified Init Facet**: `DiamondInitFacet.sol` - Add initialization function for throttle settings
5. **Diamond Configuration**: Update `geniusdiamond.config.json` with new facet

### Diamond Integration

The facet should be added at priority 115 (between GNUSControl at 110 and GNUSBridge at 120):

```json
"GNUSWithdrawThrottle": {
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
- `./GNUSWithdrawThrottleStorage.sol` - Storage library
- `./DiamondInitFacet.sol` - Protocol initialization (modified)

### Upgrade Path

This is a new feature, so initial deployment will:

1. Add `initializeGNUSWithdrawThrottle()` function to `DiamondInitFacet.sol` to set default values:
   - `defaultLimitAmount` = 10,000 GNUS (10000 * 10^18)
   - `limitSeconds` = 86,400 seconds (1 day)
   - `throttleEnabled` = true
2. Update the protocol initializer (e.g., `diamondInitialize250()`) to call `initializeGNUSWithdrawThrottle()`
3. Deploy the new `GNUSWithdrawThrottle` facet
4. Modify `GNUSBridge` facet to include throttle check
5. Create a DiamondCut transaction that:
   - Adds the `GNUSWithdrawThrottle` facet
   - Upgrades the `GNUSBridge` facet
   - Calls the protocol initializer function to initialize all new/updated components

**Initialization Pattern**: The GNUS.AI system uses `DiamondInitFacet.sol` as the centralized protocol initializer. Each new feature adds its initialization logic to this facet, which is then called during the DiamondCut transaction. This ensures all initialization happens atomically in a single transaction.

### Testing Requirements

- **Unit Tests**: Test throttle logic with various scenarios (under limit, at limit, over limit)
- **Multi-Chain Tests**: Verify throttle works independently on different chains
- **Integration Tests**: Test interaction with existing withdraw functionality
- **Foundry Fuzz Tests**: Property-based testing for edge cases
- **Gas Benchmarks**: Measure gas costs for withdrawals with various record counts

## Success Metrics

1. **Security**: Zero successful circumventions of throttle limits in production
2. **Detection Rate**: Throttle triggers on 100% of withdrawals exceeding configured limits
3. **False Positive Rate**: <1% of legitimate withdrawals blocked (indicates proper limit configuration)
4. **Gas Efficiency**: Average gas overhead <50k gas for throttle check with typical record counts
5. **Administrative Usage**: Super admin configuration functions work without errors 100% of the time
6. **System Stability**: No increase in failed transactions due to throttle implementation bugs

## Open Questions

1. **Default Limit Selection**: Should the default 100,000 GNUS limit be based on analysis of historical withdrawal patterns?
2. **Time Window Duration**: Is 86,400 seconds (1 day) the optimal window, or should different networks use different defaults?
3. **Alert Mechanism**: Should there be an off-chain alerting system when throttles are frequently triggered for an account?
4. **Limit Adjustment Policy**: What criteria should be used to approve custom per-account limits?
5. **Emergency Procedures**: What is the process for super admin to temporarily disable throttles during legitimate high-volume events?
6. **Historical Data**: Should expired withdrawal records be permanently deleted or archived off-chain for analytics?
7. **Multi-Signature**: Should throttle configuration changes require multi-sig approval for additional security?

## Implementation Timeline

- **Phase 1** (Week 1): Implement storage library and facet contract
- **Phase 2** (Week 1-2): Integrate with GNUSBridge and test locally
- **Phase 3** (Week 2): Write comprehensive test suite (Hardhat + Foundry)
- **Phase 4** (Week 3): Security audit and gas optimization
- **Phase 5** (Week 3): Deploy to testnet and validate
- **Phase 6** (Week 4): Deploy to production networks

## Notes for Junior Developers

- **Diamond Pattern**: This system uses ERC-2535 Diamond proxy. Each facet is like a module that adds functions to the main contract. Think of it like plugins that extend the base functionality.
- **Storage Pattern**: Diamond storage uses a specific slot to store data, preventing conflicts between facets. Always use the storage library to access data.
- **Initialization Pattern**: In the Diamond system, initialization is centralized in `DiamondInitFacet.sol`. When adding a new facet, you create an initialization function in `DiamondInitFacet` (e.g., `initializeGNUSWithdrawThrottle()`), then call it from the main protocol initializer (e.g., `diamondInitialize250()`). This ensures all initialization happens atomically during the DiamondCut transaction.
- **Timestamps vs Block Numbers**: We use `block.timestamp` for time windows because it provides consistent, human-readable time periods across all EVM chains regardless of block time variations.
- **Gas Optimization**: Lazy cleanup means we only clean up old records when necessary (during withdrawals), spreading the gas cost over time instead of requiring expensive batch operations.
- **Access Control**: The `onlySuperAdminRole` modifier ensures only the contract owner can change security-critical settings.
