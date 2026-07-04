# ERC20TransferBatch

## Overview

#### License: MIT

```solidity
contract ERC20TransferBatch is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl
```

Facilitates batch transfers, minting, and burning of ERC20-like tokens.

Extends `GNUSERC1155MaxSupply` and `GeniusAccessControl` to enforce token supply limits and role-based access control.
security-contact: support@gnus.ai

## Events info

### TransferBatch

```solidity
event TransferBatch(address indexed operator, address indexed from, address[] indexed destinations, uint256[] values)
```

Event emitted when a batch transfer occurs.

Parameters:

| Name         | Type      | Description                                           |
| :----------- | :-------- | :---------------------------------------------------- |
| operator     | address   | The address initiating the transfer.                  |
| from         | address   | The address sending the tokens (or zero for minting). |
| destinations | address[] | The addresses receiving the tokens.                   |
| values       | uint256[] | The amounts of tokens transferred to each address.    |

## Functions info

### supportsInterface (0x01ffc9a7)

```solidity
function supportsInterface(
    bytes4 interfaceId
) public view virtual override returns (bool)
```

Checks if the contract supports a given interface.

Parameters:

| Name        | Type   | Description                                        |
| :---------- | :----- | :------------------------------------------------- |
| interfaceId | bytes4 | The interface identifier, as specified in ERC-165. |

Return values:

| Name | Type | Description                                            |
| :--- | :--- | :----------------------------------------------------- |
| [0]  | bool | True if the contract supports the specified interface. |

### mintBatch (0x7c88e3d9)

```solidity
function mintBatch(
    address[] memory destinations,
    uint256[] memory amounts
) external payable
```

Mints a batch of tokens to multiple destinations.

Requires the caller to have the `DEFAULT_ADMIN_ROLE`.

Parameters:

| Name         | Type      | Description                                                       |
| :----------- | :-------- | :---------------------------------------------------------------- |
| destinations | address[] | The addresses to receive the minted tokens.                       |
| amounts      | uint256[] | The corresponding amounts of tokens to mint for each destination. |

### transferBatch (0x3b3e672f)

```solidity
function transferBatch(
    address[] memory destinations,
    uint256[] memory amounts
) public payable
```

Transfers a batch of tokens from the caller to multiple destinations.

Parameters:

| Name         | Type      | Description                                         |
| :----------- | :-------- | :-------------------------------------------------- |
| destinations | address[] | The addresses to receive the tokens.                |
| amounts      | uint256[] | The amounts of tokens to transfer for each address. |

### transferOrBurnBatch (0x1bdc02ba)

```solidity
function transferOrBurnBatch(
    address[] memory destinations,
    uint256[] memory amounts
) public payable
```

Transfers or burns a batch of tokens from the caller.

Parameters:

| Name         | Type      | Description                                                      |
| :----------- | :-------- | :--------------------------------------------------------------- |
| destinations | address[] | The addresses to receive the tokens or the zero address to burn. |
| amounts      | uint256[] | The amounts of tokens to transfer or burn for each address.      |
