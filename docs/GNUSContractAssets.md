# GNUSContractAssets

## Overview

#### License: MIT

```solidity
contract GNUSContractAssets is Initializable, GeniusAccessControl
```

Provides functionality to manage and withdraw external assets sent to the contract.

Allows withdrawal of tokens mistakenly sent to the contract, with safeguards for GNUS tokens.

security-contact: support@gnus.ai
## Events info

### WithdrawToken

```solidity
event WithdrawToken(address indexed token, address to, uint256 amount)
```

Emitted when tokens are withdrawn from the contract.


Parameters:

| Name   | Type    | Description                                  |
| :----- | :------ | :------------------------------------------- |
| token  | address | The address of the token being withdrawn.    |
| to     | address | The destination address for the withdrawal.  |
| amount | uint256 | The amount of tokens withdrawn.              |

## Errors info

### ErrorWithdrawingEther

```solidity
error ErrorWithdrawingEther()
```

Reverts when an error occurs while withdrawing Ether.
### CannotWithdrawGNUS

```solidity
error CannotWithdrawGNUS()
```

Reverts when attempting to withdraw the GNUS token.
## Functions info

### withdrawToken (0x01e33667)

```solidity
function withdrawToken(
    address token,
    address to,
    uint256 amount
) external onlySuperAdminRole
```

Withdraw external tokens mistakenly sent to the contract.

This function allows the super admin to withdraw tokens mistakenly sent to the contract,
but it does not allow withdrawing GNUS tokens.


Parameters:

| Name   | Type    | Description                                                                                                                                                                                                                             |
| :----- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| token  | address | The address of the token to withdraw. Use the constant `ETHER` for native Ether.                                                                                                                                                        |
| to     | address | The destination address to receive the tokens.                                                                                                                                                                                          |
| amount | uint256 | The amount of tokens to withdraw. Requirements: - Caller must have the `SUPER_ADMIN_ROLE`. - Cannot withdraw the GNUS token. - For Ether withdrawal, the transfer must succeed. Emits a {WithdrawToken} event on successful withdrawal. |
