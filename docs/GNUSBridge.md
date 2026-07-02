# GNUSBridge

## Overview

#### License: MIT

```solidity
contract GNUSBridge is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl, IERC20Upgradeable
```

Manages bridging, minting, burning, and token transfers for the GNUS ecosystem.

Supports both ERC20 and ERC1155 token standards, with additional functionality for bridging tokens across chains.

security-contact: support@gnus.ai

## Events info

### BridgeSourceBurned

```solidity
event BridgeSourceBurned(address indexed sender, uint256 id, uint256 amount, uint256 srcChainID, uint256 destChainID)
```

Emitted when tokens are burned for bridging to another chain.

Emitted when token holder wants to bridge to another chain

Parameters:

| Name        | Type    | Description                              |
| :---------- | :------ | :--------------------------------------- |
| sender      | address | Address initiating the bridge operation. |
| id          | uint256 | Token ID being burned.                   |
| amount      | uint256 | Amount of tokens burned.                 |
| srcChainID  | uint256 | Source chain ID.                         |
| destChainID | uint256 | Destination chain ID.                    |

## Constants info

### MINTER_ROLE (0xd5391393)

```solidity
bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE")
```

### name (0x06fdde03)

```solidity
string constant name = "Genius Token & NFT Collections"
```

### symbol (0x95d89b41)

```solidity
string constant symbol = "GNUS"
```

### decimals (0x313ce567)

```solidity
uint8 constant decimals = 18
```

## Functions info

### GNUSBridge_Initialize (0x5e3e0c59)

```solidity
function GNUSBridge_Initialize() public initializer onlySuperAdminRole
```

Initializes the GNUSBridge contract.

Grants the `MINTER_ROLE` to the deploying address and registers ERC20 support in the Diamond Storage.
Only callable by the Super Admin.

### supportsInterface (0x01ffc9a7)

```solidity
function supportsInterface(
    bytes4 interfaceId
) public view virtual override returns (bool)
```

Returns true if this contract implements the interface defined by
`interfaceId`. See the corresponding
https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
to learn more about how these ids are created.

This function call must use less than 30 000 gas.

### mint (0x40c10f19)

```solidity
function mint(address user, uint256 amount) public onlyRole(MINTER_ROLE)
```

Mint GNUS ERC20 tokens.

Callable only by addresses with the `MINTER_ROLE`.

Parameters:

| Name   | Type    | Description                          |
| :----- | :------ | :----------------------------------- |
| user   | address | Address receiving the minted tokens. |
| amount | uint256 | Amount of tokens to mint.            |

### mint (0x156e29f6)

```solidity
function mint(
    address user,
    uint256 tokenID,
    uint256 amount
) public onlyRole(MINTER_ROLE)
```

Mint ERC1155 tokens.

Callable only by addresses with the `MINTER_ROLE`.

Parameters:

| Name    | Type    | Description                          |
| :------ | :------ | :----------------------------------- |
| user    | address | Address receiving the minted tokens. |
| tokenID | uint256 | Token ID to mint.                    |
| amount  | uint256 | Amount of tokens to mint.            |

### burn (0x9dc29fac)

```solidity
function burn(address user, uint256 amount) public onlyRole(MINTER_ROLE)
```

Burn GNUS ERC20 tokens.

Callable only by addresses with the `MINTER_ROLE`.

Parameters:

| Name   | Type    | Description                          |
| :----- | :------ | :----------------------------------- |
| user   | address | Address whose tokens will be burned. |
| amount | uint256 | Amount of tokens to burn.            |

### withdraw (0x441a3e70)

```solidity
function withdraw(uint256 amount, uint256 id) external
```

Withdraw a child token to GNUS ERC20 on the current network.

Parameters:

| Name   | Type    | Description                         |
| :----- | :------ | :---------------------------------- |
| amount | uint256 | Amount of child tokens to withdraw. |
| id     | uint256 | Token ID being withdrawn.           |

### bridgeOut (0xe26d65a6)

```solidity
function bridgeOut(uint256 amount, uint256 id, uint256 destChainID) external
```

Burn tokens and emit an event for bridging to another chain.

Parameters:

| Name        | Type    | Description                 |
| :---------- | :------ | :-------------------------- |
| amount      | uint256 | Amount of tokens to bridge. |
| id          | uint256 | Token ID being bridged.     |
| destChainID | uint256 | Destination chain ID.       |

### totalSupply (0x18160ddd)

```solidity
function totalSupply() external view override returns (uint256)
```

Retrieves the total supply of tokens in existence for the specified token ID.

This function overrides the `totalSupply` function from the parent contract.
It calls an internal function to get the total supply of tokens for the GNUS token ID.

Return values:

| Name | Type    | Description                                                              |
| :--- | :------ | :----------------------------------------------------------------------- |
| [0]  | uint256 | The total number of tokens currently in existence for the GNUS token ID. |

### balanceOf (0x70a08231)

```solidity
function balanceOf(address account) external view override returns (uint256)
```

Retrieves the balance of GNUS tokens for a specified account.

This function overrides the balanceOf function from the inherited contract.

Parameters:

| Name    | Type    | Description                                                      |
| :------ | :------ | :--------------------------------------------------------------- |
| account | address | The address of the account whose token balance is being queried. |

Return values:

| Name | Type    | Description                                               |
| :--- | :------ | :-------------------------------------------------------- |
| [0]  | uint256 | The amount of GNUS tokens owned by the specified account. |

### transfer (0xa9059cbb)

```solidity
function transfer(
    address to,
    uint256 amount
) external virtual override returns (bool)
```

Moves `amount` tokens from the caller's account to `to`.
Returns a boolean value indicating whether the operation succeeded.
Emits a {Transfer} event.

### allowance (0xdd62ed3e)

```solidity
function allowance(
    address owner,
    address spender
) public view virtual override returns (uint256)
```

Returns the remaining number of tokens that `spender` will be
allowed to spend on behalf of `owner` through {transferFrom}. This is
zero by default.

This value changes when {approve} or {transferFrom} are called.

### decreaseAllowance (0xa457c2d7)

```solidity
function decreaseAllowance(
    address spender,
    uint256 subtractedValue
) public virtual returns (bool)
```

Approves the specified `amount` of tokens for the `spender` to spend on behalf of the caller.

Sets `amount` as the allowance of `spender` over the caller's tokens.

Emits an {Approval} event indicating the updated allowance.

Parameters:

| Name            | Type    | Description                                        |
| :-------------- | :------ | :------------------------------------------------- |
| spender         | address | The address which will spend the funds.            |
| subtractedValue | uint256 | The amount of tokens to decrease the allowance by. |

Return values:

| Name | Type | Description                                                 |
| :--- | :--- | :---------------------------------------------------------- |
| [0]  | bool | A boolean value indicating whether the operation succeeded. |

### transferFrom (0x23b872dd)

```solidity
function transferFrom(
    address from,
    address to,
    uint256 amount
) external virtual override returns (bool)
```

Moves `amount` tokens from `from` to `to` using the
allowance mechanism. `amount` is then deducted from the caller's
allowance.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event.

### approve (0x095ea7b3)

```solidity
function approve(
    address spender,
    uint256 amount
) public virtual override returns (bool)
```

Sets `amount` as the allowance of `spender` over the caller's tokens.

Returns a boolean value indicating whether the operation succeeded.

IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

Emits an {Approval} event.
