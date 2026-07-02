# GeniusOwnershipFacet

## Overview

#### License: MIT

```solidity
contract GeniusOwnershipFacet is IERC173, GeniusAccessControl
```

Provides ownership management for the Genius contract using EIP-173 standards.

Extends GeniusAccessControl for role-based permissions and integrates with the Diamond Standard.

## Functions info

### transferOwnership (0xf2fde38b)

```solidity
function transferOwnership(address _newOwner) external override
```

Transfers contract ownership to a new address.

Enforces that the caller is the current contract owner. Updates the `DEFAULT_ADMIN_ROLE` and
`UPGRADER_ROLE` for the new owner and revokes these roles from the previous owner.

Parameters:

| Name       | Type    | Description                   |
| :--------- | :------ | :---------------------------- |
| \_newOwner | address | The address of the new owner. |

### owner (0x8da5cb5b)

```solidity
function owner() external view override returns (address owner_)
```

Returns the address of the current contract owner.

Retrieves the owner address from the LibDiamond storage.

Return values:

| Name    | Type    | Description                        |
| :------ | :------ | :--------------------------------- |
| owner\_ | address | The address of the contract owner. |
