# GNUSNFTFactory

## Overview

#### License: MIT

```solidity
contract GNUSNFTFactory is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl
```

This contract manages the creation, minting, and management of NFTs within the GNUS ecosystem.

This contract extends GNUSERC1155MaxSupply and GeniusAccessControl for additional functionality.
security-contact: support@gnus.ai

## Constants info

### CREATOR_ROLE (0x8aeda25a)

```solidity
bytes32 constant CREATOR_ROLE = keccak256("CREATOR_ROLE")
```

Role identifier for creators.

## Functions info

### GNUSNFTFactory_Initialize (0x101521f8)

```solidity
function GNUSNFTFactory_Initialize() public onlySuperAdminRole
```

Initializes the GNUSNFTFactory contract.

This function is called only once and subsequent calls are ignored due to the initializer modifier.

### GNUSNFTFactory_Initialize230 (0x52dbff7a)

```solidity
function GNUSNFTFactory_Initialize230() public onlySuperAdminRole
```

Initializes the GNUSNFTFactory contract for version 2.3.0.

This function ensures that the GNUS token is created if it hasn't been already.

### setURI (0x02fe5305)

```solidity
function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE)
```

Sets the top-level URI for the GNUS Token NFT.

This function can only be called by an account with the DEFAULT_ADMIN_ROLE.

Parameters:

| Name   | Type   | Description         |
| :----- | :----- | :------------------ |
| newuri | string | The new URI to set. |

### setURI (0x862440e2)

```solidity
function setURI(uint256 id, string memory newuri) public
```

Sets the URI for a specific NFT.

This function can only be called by the creator of the NFT or an account with the DEFAULT_ADMIN_ROLE.

Parameters:

| Name   | Type    | Description         |
| :----- | :------ | :------------------ |
| id     | uint256 | The ID of the NFT.  |
| newuri | string  | The new URI to set. |

### uri (0x0e89341c)

```solidity
function uri(uint256 id) public view virtual override returns (string memory)
```

Retrieves the URI for a specific NFT.

This function overrides the uri function from ERC1155Upgradeable.

Parameters:

| Name | Type    | Description        |
| :--- | :------ | :----------------- |
| id   | uint256 | The ID of the NFT. |

Return values:

| Name | Type   | Description         |
| :--- | :----- | :------------------ |
| [0]  | string | The URI of the NFT. |

### pause (0x8456cb59)

```solidity
function pause() public onlyRole(DEFAULT_ADMIN_ROLE)
```

Pauses all token transfers.

This function can only be called by an account with the DEFAULT_ADMIN_ROLE.

### unpause (0x3f4ba83a)

```solidity
function unpause() public onlyRole(DEFAULT_ADMIN_ROLE)
```

Unpauses all token transfers.

This function can only be called by an account with the DEFAULT_ADMIN_ROLE.

### mint (0x731133e9)

```solidity
function mint(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
) external
```

Mints a new NFT.

This function mints a new NFT to the specified address.

Parameters:

| Name   | Type    | Description                               |
| :----- | :------ | :---------------------------------------- |
| to     | address | The address to mint the NFT to.           |
| id     | uint256 | The ID of the NFT.                        |
| amount | uint256 | The amount of the NFT to mint.            |
| data   | bytes   | Additional data with no specified format. |

### mintBatch (0x1f7fdffa)

```solidity
function mintBatch(
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
) external
```

Mints a batch of new NFTs.

This function mints a batch of new NFTs to the specified address.

Parameters:

| Name    | Type      | Description                               |
| :------ | :-------- | :---------------------------------------- |
| to      | address   | The address to mint the NFTs to.          |
| ids     | uint256[] | The IDs of the NFTs.                      |
| amounts | uint256[] | The amounts of the NFTs to mint.          |
| data    | bytes     | Additional data with no specified format. |

### supportsInterface (0x01ffc9a7)

```solidity
function supportsInterface(
    bytes4 interfaceId
) public view virtual override returns (bool)
```

Checks if the contract supports a specific interface.

This function overrides the supportsInterface function from ERC1155Upgradeable and AccessControlEnumerableUpgradeable.

Parameters:

| Name        | Type   | Description                       |
| :---------- | :----- | :-------------------------------- |
| interfaceId | bytes4 | The ID of the interface to check. |

Return values:

| Name | Type | Description                                          |
| :--- | :--- | :--------------------------------------------------- |
| [0]  | bool | True if the interface is supported, false otherwise. |

### createNFT (0xf667ab7c)

```solidity
function createNFT(
    uint256 parentID,
    string memory name,
    string memory symbol,
    uint256 exchRate,
    uint256 max_supply,
    string memory newuri
) public
```

Creates a new NFT.

This function creates a new NFT with the specified parameters.

Parameters:

| Name       | Type    | Description                    |
| :--------- | :------ | :----------------------------- |
| parentID   | uint256 | The ID of the parent NFT.      |
| name       | string  | The name of the NFT.           |
| symbol     | string  | The symbol of the NFT.         |
| exchRate   | uint256 | The exchange rate of the NFT.  |
| max_supply | uint256 | The maximum supply of the NFT. |
| newuri     | string  | The URI of the NFT.            |

### createNFTs (0x1a9d2360)

```solidity
function createNFTs(
    uint256 parentID,
    string[] memory names,
    string[] memory symbols,
    uint256[] memory exchRates,
    uint256[] memory max_supplies,
    string[] memory newuris
) public
```

Creates multiple new NFTs.

This function creates multiple new NFTs with the specified parameters.

Parameters:

| Name         | Type      | Description                       |
| :----------- | :-------- | :-------------------------------- |
| parentID     | uint256   | The ID of the parent NFT.         |
| names        | string[]  | The names of the NFTs.            |
| symbols      | string[]  | The symbols of the NFTs.          |
| exchRates    | uint256[] | The exchange rates of the NFTs.   |
| max_supplies | uint256[] | The maximum supplies of the NFTs. |
| newuris      | string[]  | The URIs of the NFTs.             |

### getNFTInfo (0xd188929f)

```solidity
function getNFTInfo(uint256 id) public view returns (NFT memory)
```

Retrieves information about a specific NFT.

This function returns the NFT storage object for the specified ID.

Parameters:

| Name | Type    | Description        |
| :--- | :------ | :----------------- |
| id   | uint256 | The ID of the NFT. |

Return values:

| Name | Type       | Description             |
| :--- | :--------- | :---------------------- |
| [0]  | struct NFT | The NFT storage object. |
