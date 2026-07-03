# GeniusDiamond

## Overview

#### License: MIT

```solidity
contract GeniusDiamond is Diamond, ERC165StorageUpgradeable
```

Implements a modular and upgradeable diamond contract with ERC165 and ERC1155 compatibility.

Leverages the EIP-2535 Diamond Standard for modularity and the ERC165 interface for introspection.
Includes ERC1155 compatibility and ownership management through facets.

## Functions info

### constructor

```solidity
constructor(
    address _contractOwner,
    address _diamondCutFacet
) payable initializer Diamond(_contractOwner, _diamondCutFacet)
```

Initializes the GeniusDiamond contract with the contract owner and diamond cut facet.

This constructor registers supported interfaces and sets the initial state.
It also ensures compatibility with ERC1155 and ERC165 interfaces.

Parameters:

| Name              | Type    | Description                                  |
| :---------------- | :------ | :------------------------------------------- |
| \_contractOwner   | address | The address of the contract owner.           |
| \_diamondCutFacet | address | The address of the DiamondCutFacet contract. |

### supportsInterface (0x01ffc9a7)

```solidity
function supportsInterface(
    bytes4 interfaceId
) public view virtual override returns (bool)
```

Checks if the contract supports a specific interface.

Overrides the `supportsInterface` function to include diamond-specific interface storage.

Parameters:

| Name        | Type   | Description                        |
| :---------- | :----- | :--------------------------------- |
| interfaceId | bytes4 | The interface identifier to check. |

Return values:

| Name | Type | Description                                          |
| :--- | :--- | :--------------------------------------------------- |
| [0]  | bool | True if the interface is supported, otherwise false. |
