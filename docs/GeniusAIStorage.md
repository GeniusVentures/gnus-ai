# GeniusAIStorage

## Overview

#### License: MIT

```solidity
library GeniusAIStorage
```

Library for managing Genius AI-specific storage layout.
## Structs info

### Layout

```solidity
struct Layout {
	mapping(address => uint256) numEscrows;
	mapping(address => mapping(uint256 => AIProcessingJob)) AIProcessingJobs;
}
```


## Functions info

### layout

```solidity
function layout() internal pure returns (GeniusAIStorage.Layout storage ds)
```

Provides access to the `Layout` instance stored in the Genius AI storage position.

Uses the EVM assembly `sload` to retrieve the storage pointer.


Return values:

| Name | Type                          | Description                                  |
| :--- | :---------------------------- | :------------------------------------------- |
| ds   | struct GeniusAIStorage.Layout | The `Layout` instance for Genius AI storage. |
