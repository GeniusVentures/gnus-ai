# GeniusAccessControl

## Overview

#### License: MIT

```solidity
abstract contract GeniusAccessControl is Initializable, AccessControlEnumerableUpgradeable
```

Provides role-based access control with additional constraints for super admins.

Extends `AccessControlEnumerableUpgradeable` to enable enumerability and role management.

## Constants info

### UPGRADER_ROLE (0xf72c0d8b)

```solidity
bytes32 constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE")
```

Role identifier for the upgrader role.

## Modifiers info

### onlySuperAdminRole

```solidity
modifier onlySuperAdminRole()
```

Modifier to restrict access to functions for the super admin.

Ensures that the caller is the owner defined in the `LibDiamond` storage.

## Functions info

### renounceRole (0x36568abe)

```solidity
function renounceRole(bytes32 role, address account) public override
```

Allows an account to renounce a specific role.

Prevents the super admin from renouncing the `DEFAULT_ADMIN_ROLE`.
Overrides the `renounceRole` function from `IAccessControlUpgradeable`.

Parameters:

| Name    | Type    | Description                      |
| :------ | :------ | :------------------------------- |
| role    | bytes32 | The role to renounce.            |
| account | address | The account renouncing the role. |

### revokeRole (0xd547741f)

```solidity
function revokeRole(bytes32 role, address account) public override
```

Revokes a specific role from an account.

Prevents the super admin from being revoked from the `DEFAULT_ADMIN_ROLE`.
Overrides the `revokeRole` function from `IAccessControlUpgradeable`.

Parameters:

| Name    | Type    | Description                  |
| :------ | :------ | :--------------------------- |
| role    | bytes32 | The role to revoke.          |
| account | address | The account losing the role. |
