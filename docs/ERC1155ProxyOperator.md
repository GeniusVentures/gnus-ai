# ERC1155ProxyOperator

## Overview

#### License: MIT

```solidity
contract ERC1155ProxyOperator is GeniusAccessControl
```

Provides additional functionality for ERC1155 tokens, including proxy operator approvals and supply tracking.

Extends `GeniusAccessControl` for role-based access control and integrates with ERC1155 storage layouts.
## Constants info

### NFT_PROXY_OPERATOR_ROLE (0xa2dd2453)

```solidity
bytes32 constant NFT_PROXY_OPERATOR_ROLE = keccak256("NFT_PROXY_OPERATOR_ROLE")
```

Role identifier for NFT Proxy Operators.
## Functions info

### isApprovedForAll (0xe985e9c5)

```solidity
function isApprovedForAll(
    address account,
    address operator
) public view returns (bool isApproved)
```

Checks if an operator is approved to manage all tokens of a given account.

This function overrides the default `isApprovedForAll` to enable proxy accounts for gas-free listings.


Parameters:

| Name     | Type    | Description                            |
| :------- | :------ | :------------------------------------- |
| account  | address | The address of the token owner.        |
| operator | address | The address of the operator to check.  |


Return values:

| Name       | Type | Description                                        |
| :--------- | :--- | :------------------------------------------------- |
| isApproved | bool | True if the operator is approved, false otherwise. |

### totalSupply (0xbd85b039)

```solidity
function totalSupply(uint256 id) public view returns (uint256 curSupply)
```

Retrieves the total supply of a specific token ID.

Uses `ERC1155SupplyStorage` to fetch the current total supply.


Parameters:

| Name | Type    | Description             |
| :--- | :------ | :---------------------- |
| id   | uint256 | The token ID to query.  |


Return values:

| Name      | Type    | Description                               |
| :-------- | :------ | :---------------------------------------- |
| curSupply | uint256 | The current total supply of the token ID. |

### creators (0xcd53d08e)

```solidity
function creators(uint256 id) public view returns (address creator)
```

Retrieves the creator address of a specific token ID.

Uses `GNUSNFTFactoryStorage` to fetch the creator information.


Parameters:

| Name | Type    | Description             |
| :--- | :------ | :---------------------- |
| id   | uint256 | The token ID to query.  |


Return values:

| Name    | Type    | Description                         |
| :------ | :------ | :---------------------------------- |
| creator | address | The address of the token's creator. |
