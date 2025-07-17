# GeniusAI

## Overview

#### License: MIT

```solidity
contract GeniusAI is Initializable, GeniusAccessControl
```

Provides escrow functionality for processing jobs in the Genius AI system.

Uses `Initializable` for upgradable initialization and extends `GeniusAccessControl` for role-based access.
## Functions info

### GeniusAI_Initialize (0x6ea9fd36)

```solidity
function GeniusAI_Initialize() public
```

Initializes the Genius AI contract.

This function is a one-time initialization method that enables access control.
Subsequent calls are ignored due to the `initializer` modifier from `Initializable`.
### OpenEscrow (0x31d6388d)

```solidity
function OpenEscrow(bytes32 UUID) public payable
```

Opens an escrow for a processing job.

The sender deposits GNUS tokens into escrow for the job specified by the `UUID`.
The escrow amount is taken from `msg.value`.


Parameters:

| Name | Type    | Description                                                                                      |
| :--- | :------ | :----------------------------------------------------------------------------------------------- |
| UUID | bytes32 | A 32-byte unique identifier for the job structure in the database (128-bit UUID without dashes). |
