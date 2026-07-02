# GNUSControlStorage

## Overview

#### License: MIT

```solidity
library GNUSControlStorage
```

This library defines the storage layout and utility functions for managing GNUS control data.

Utilizes the diamond storage pattern to manage control-related state.

security-contact: support@gnus.ai

## Structs info

### Layout

```solidity
struct Layout {
	mapping(uint256 => mapping(address => bool)) bannedTransferors;
	mapping(address => bool) gBannedTransferors;
	uint256 bridgeFee;
	uint256 protocolVersion;
	uint256 chainID;
}
```

## Functions info

### layout

```solidity
function layout() internal pure returns (GNUSControlStorage.Layout storage l)
```

Accesses the GNUS control storage layout.

Return values:

| Name | Type                             | Description                        |
| :--- | :------------------------------- | :--------------------------------- |
| l    | struct GNUSControlStorage.Layout | A reference to the storage layout. |

### isBannedTransferor

```solidity
function isBannedTransferor(
    uint256 tokenId,
    address sender
) internal view returns (bool)
```

Checks if a transferor is banned for a specific token ID.

Parameters:

| Name    | Type    | Description                    |
| :------ | :------ | :----------------------------- |
| tokenId | uint256 | The ID of the token.           |
| sender  | address | The address of the transferor. |

Return values:

| Name | Type | Description                                             |
| :--- | :--- | :------------------------------------------------------ |
| [0]  | bool | bool True if the transferor is banned, otherwise false. |

### callFacetDelegate

```solidity
function callFacetDelegate(
    bytes4 facetSelector,
    bytes memory encodedParameters
) internal returns (bool success, bytes memory data)
```

Executes a delegate call to a facet with the given selector and parameters.

Reverts if the facet address is not found.

Parameters:

| Name              | Type   | Description                                |
| :---------------- | :----- | :----------------------------------------- |
| facetSelector     | bytes4 | The function selector of the target facet. |
| encodedParameters | bytes  | The encoded function parameters.           |

Return values:

| Name    | Type  | Description                                          |
| :------ | :---- | :--------------------------------------------------- |
| success | bool  | True if the delegate call succeeds, otherwise false. |
| data    | bytes | The returned data from the delegate call.            |
