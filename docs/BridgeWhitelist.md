# Bridge Whitelist Implementation

## Overview

The GNUS Bridge Whitelist is a security feature that restricts bridge operations (minting, burning, and bridging tokens across chains) to whitelisted accounts only. This implementation uses the **second most significant bit (2nd MSB)** of account balances to efficiently store whitelist status without requiring additional storage mappings.

## Architecture

### Bit Layout

The GNUS system uses the two most significant bits of the 256-bit balance storage for control flags:

```
Bit 255 (MSB):     Blacklist flag (existing BlacklistV2 implementation)
Bit 254 (2nd MSB): Whitelist flag (new Bridge Whitelist implementation)
Bits 0-253:       Actual token balance (2^254 - 1 maximum)
```

### Key Components

1. **GNUSWhitelistStorage.sol** - Storage library with bit manipulation utilities
2. **GNUSWhitelistFacet.sol** - Main whitelist management facet
3. **GNUSBridge.sol** - Updated bridge contract with whitelist enforcement
4. **IGNUSWhitelist.sol** - Interface for whitelist operations

## Features

### Core Functionality

- **Account Whitelisting**: Add/remove accounts from bridge whitelist
- **Batch Operations**: Efficiently whitelist/unwhitelist multiple accounts
- **Global Toggle**: Enable/disable whitelist enforcement system-wide
- **Bridge Enforcement**: Restrict mint/burn/bridge operations to whitelisted accounts
- **Backward Compatibility**: Whitelist starts disabled to maintain existing functionality

### Integration with BlacklistV2

The whitelist system is designed to work alongside the existing BlacklistV2 implementation:

- Both systems use separate bits (255 and 254) in the same storage slot
- An account can be both blacklisted AND whitelisted
- Blacklist always takes precedence over whitelist for transfers
- Both bits are preserved during balance operations

## Contract Functions

### Administrative Functions

```solidity
// Initialize the whitelist system (one-time setup)
function initializeWhitelist() external

// Enable/disable global whitelist enforcement
function setWhitelistEnabled(bool enabled) external

// Whitelist a single account
function whitelistAccount(address account) external

// Remove account from whitelist
function unwhitelistAccount(address account) external

// Batch whitelist operations
function whitelistAccountsBatch(address[] accounts) external
function unwhitelistAccountsBatch(address[] accounts) external

// Emergency balance fix with whitelist preservation
function emergencyFixBalanceWithWhitelist(
    address account, 
    uint256 newBalance, 
    bool maintainWhitelist
) external
```

### View Functions

```solidity
// Check if account is whitelisted
function isWhitelisted(address account) external view returns (bool)

// Check if whitelist is globally enabled
function isWhitelistEnabled() external view returns (bool)

// Get comprehensive account status
function getAccountStatus(address account) external view returns (
    bool whitelisted,
    bool blacklisted,
    uint256 actualBalance,
    bool whitelistEnabled
)

// Get whitelist system information
function getWhitelistInfo() external view returns (
    bool enabled,
    uint256 version,
    uint256 activationBlock
)
```

## Bridge Operations

When whitelist is **enabled**, the following operations require the account to be whitelisted:

### Minting Operations
- `mint(address user, uint256 amount)` - Recipient must be whitelisted
- `mint(address user, uint256 tokenID, uint256 amount)` - Recipient must be whitelisted

### Burning Operations
- `burn(address user, uint256 amount)` - User must be whitelisted

### Cross-Chain Bridging
- `bridgeOut(uint256 amount, uint256 id, uint256 destChainID)` - Sender must be whitelisted

When whitelist is **disabled**, all bridge operations work without restriction (backward compatibility).

## Security Considerations

### Access Control
- Only accounts with `DEFAULT_ADMIN_ROLE` can manage whitelist
- Whitelist operations are restricted to authorized administrators
- Emergency functions are available for critical situations

### Precedence Rules
1. **Blacklist Override**: Blacklisted accounts cannot perform regular transfers regardless of whitelist status
2. **Whitelist Enforcement**: When enabled, only whitelisted accounts can perform bridge operations
3. **Admin Bypass**: Administrators can always manage the system regardless of their whitelist status

### Gas Optimization
- Bit manipulation operations are extremely gas-efficient
- Single storage slot update for whitelist status changes
- Batch operations reduce transaction costs for multiple accounts

## Deployment and Configuration

### Diamond Configuration

Add to `diamonds/GeniusDiamond/geniusdiamond.config.json`:

```json
{
  "GNUSWhitelistFacet": {
    "priority": 47,
    "versions": {
      "0.0": {
        "deployInit": "initializeWhitelist()"
      }
    }
  }
}
```

### Deployment Steps

1. Deploy `GNUSWhitelistFacet` as part of diamond upgrade
2. Initialize whitelist system (automatic via deployInit)
3. Whitelist starts **disabled** by default for backward compatibility
4. Enable whitelist when ready: `setWhitelistEnabled(true)`
5. Whitelist authorized bridge users before enabling

## Usage Examples

### Enable Bridge Whitelist

```solidity
// Enable whitelist enforcement
await diamond.setWhitelistEnabled(true);

// Whitelist bridge users
await diamond.whitelistAccount("0x123...");
await diamond.whitelistAccount("0x456...");

// Or batch whitelist
await diamond.whitelistAccountsBatch([
    "0x123...",
    "0x456...",
    "0x789..."
]);
```

### Bridge Operations (Whitelisted Account)

```solidity
// Account must be whitelisted when whitelist is enabled
await diamond.bridgeOut(ethers.parseEther("100"), 0, 137); // To Polygon

// Minting to whitelisted account (MINTER_ROLE required)
await diamond.mint("0x123...", ethers.parseEther("50"));
```

### Emergency Scenarios

```solidity
// Fix balance while preserving whitelist status
await diamond.emergencyFixBalanceWithWhitelist(
    "0x123...",
    ethers.parseEther("1000"),
    true  // maintain whitelist status
);
```

## Migration and Backward Compatibility

### Seamless Integration
- Existing contracts continue to work without modification
- Whitelist starts disabled by default
- No breaking changes to existing functionality

### Balance Compatibility
- All existing balance operations work correctly
- `balanceOf()` returns clean balance without control bits
- Total supply calculations remain accurate

## Testing

Comprehensive test suite covers:
- Basic whitelist/unwhitelist operations
- Batch operations
- Bridge operation enforcement
- Interaction with blacklist system
- Gas optimization validation
- Edge cases and error conditions
- Access control verification

## Future Considerations

### Extensibility
- System designed to accommodate additional control bits if needed
- Clean separation between whitelist and other systems
- Modular architecture supports future enhancements

### Monitoring
- Events emitted for all whitelist changes
- Status query functions for external monitoring
- Gas usage tracking for optimization

## Technical Specifications

### Storage Efficiency
- **Storage Slots**: 0 additional slots (uses existing balance storage)
- **Gas Cost**: ~2,300 gas for whitelist status change
- **Maximum Balance**: 2^254 - 1 tokens (extremely large)

### Bit Manipulation
- Uses bitwise operations for maximum efficiency
- Atomic operations ensure consistency
- No risk of bit collision between blacklist and whitelist

### Error Handling
- Clear, descriptive error messages
- Graceful handling of edge cases
- Comprehensive input validation

This implementation provides a robust, efficient, and secure bridge whitelist system that integrates seamlessly with the existing GNUS ecosystem while maintaining full backward compatibility.
