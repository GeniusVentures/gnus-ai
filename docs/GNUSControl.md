# GNUSControl

## Overview

#### License: MIT

```solidity
contract GNUSControl is GeniusAccessControl
```

This contract allows super administrators to manage global and token-specific blacklists,
update protocol parameters, and handle bridge fees.

Manages protocol-level security and controls, including blacklists and bridge fees.

security-contact: support@gnus.ai

## Events info

### AddToBlackList

```solidity
event AddToBlackList(uint256[] tokenIds, address[] addresses)
```

Emitted when addresses or token IDs are added to the blacklist.

### RemoveFromBlackList

```solidity
event RemoveFromBlackList(uint256[] tokenIds, address[] addresses)
```

Emitted when addresses or token IDs are removed from the blacklist.

### AddToGlobalBlackList

```solidity
event AddToGlobalBlackList(address bannedAddress)
```

Emitted when an address is added to the global blacklist.

### RemoveFromGlobalBlackList

```solidity
event RemoveFromGlobalBlackList(address bannedAddress)
```

Emitted when an address is removed from the global blacklist.

### UpdateBridgeFee

```solidity
event UpdateBridgeFee(uint256 indexed newFee)
```

Emitted when the bridge fee is updated.

Parameters:

| Name   | Type    | Description               |
| :----- | :------ | :------------------------ |
| newFee | uint256 | The new bridge fee value. |

## Functions info

### GNUSControl_Initialize230 (0x72f6ac43)

```solidity
function GNUSControl_Initialize230() external onlySuperAdminRole
```

Initializes the protocol to version 2.30.

Ensures the protocol version is not already initialized to 2.30 or greater.
Sets the protocol version to 230.

### banTransferorForAll (0x1307a4be)

```solidity
function banTransferorForAll(address bannedAddress) external onlySuperAdminRole
```

Adds an address to the global transfer ban list.

Parameters:

| Name          | Type    | Description                                               |
| :------------ | :------ | :-------------------------------------------------------- |
| bannedAddress | address | The address to ban from transferring all tokens globally. |

### allowTransferorForAll (0x9ceb1593)

```solidity
function allowTransferorForAll(
    address bannedAddress
) external onlySuperAdminRole
```

Removes an address from the global transfer ban list.

Parameters:

| Name          | Type    | Description                                                 |
| :------------ | :------ | :---------------------------------------------------------- |
| bannedAddress | address | The address to unban from transferring all tokens globally. |

### banTransferorBatch (0x19a8b28a)

```solidity
function banTransferorBatch(
    uint256[] calldata tokenIds,
    address[] calldata bannedAddresses
) external onlySuperAdminRole
```

Adds a batch of addresses and token IDs to the blacklist.

Parameters:

| Name            | Type      | Description                                               |
| :-------------- | :-------- | :-------------------------------------------------------- |
| tokenIds        | uint256[] | The list of token IDs.                                    |
| bannedAddresses | address[] | The list of addresses to ban for the specified token IDs. |

### allowTransferorBatch (0x9e8e7134)

```solidity
function allowTransferorBatch(
    uint256[] calldata tokenIds,
    address[] calldata bannedAddresses
) external onlySuperAdminRole
```

Removes a batch of addresses and token IDs from the blacklist.

Parameters:

| Name            | Type      | Description                                                 |
| :-------------- | :-------- | :---------------------------------------------------------- |
| tokenIds        | uint256[] | The list of token IDs.                                      |
| bannedAddresses | address[] | The list of addresses to unban for the specified token IDs. |

### updateBridgeFee (0x5a1c0366)

```solidity
function updateBridgeFee(uint256 newFee) external onlySuperAdminRole
```

Updates the bridge fee.

Ensures the new fee does not exceed the maximum allowed fee.

Parameters:

| Name   | Type    | Description               |
| :----- | :------ | :------------------------ |
| newFee | uint256 | The new bridge fee value. |

### setChainID (0xed8d47e6)

```solidity
function setChainID(uint256 chainID) external onlySuperAdminRole
```

Sets the chain ID for the protocol.

Parameters:

| Name    | Type    | Description       |
| :------ | :------ | :---------------- |
| chainID | uint256 | The new chain ID. |

### protocolInfo (0x93420cf4)

```solidity
function protocolInfo()
    external
    view
    returns (uint256 bridgeFee, uint256 protocolVersion, uint256 chainID)
```

Retrieves protocol information.

Return values:

| Name            | Type    | Description                   |
| :-------------- | :------ | :---------------------------- |
| bridgeFee       | uint256 | The current bridge fee.       |
| protocolVersion | uint256 | The current protocol version. |
| chainID         | uint256 | The current chain ID.         |

### setProtocolVersion (0xceba5598)

```solidity
function setProtocolVersion(
    uint256 protocolVersion
) external onlySuperAdminRole
```

Sets the protocol version.

Parameters:

| Name            | Type    | Description               |
| :-------------- | :------ | :------------------------ |
| protocolVersion | uint256 | The new protocol version. |
