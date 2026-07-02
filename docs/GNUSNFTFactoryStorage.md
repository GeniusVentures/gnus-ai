# GNUSNFTFactoryStorage

## Overview

#### License: MIT

```solidity
library GNUSNFTFactoryStorage
```

security-contact: support@gnus.ai

## Structs info

### Layout

```solidity
struct Layout {
	mapping(uint256 => NFT) NFTs;
}
```

## Functions info

### layout

```solidity
function layout()
    internal
    pure
    returns (GNUSNFTFactoryStorage.Layout storage l)
```

Retrieves the storage layout for the GNUS NFT Factory.

This function uses inline assembly to access the storage slot for the GNUS NFT Factory storage.

Return values:

| Name | Type                                | Description                                  |
| :--- | :---------------------------------- | :------------------------------------------- |
| l    | struct GNUSNFTFactoryStorage.Layout | The storage layout for the GNUS NFT Factory. |
