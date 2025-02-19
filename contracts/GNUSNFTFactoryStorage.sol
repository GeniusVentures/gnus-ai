// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title GNUSNFTFactoryStorage
/// @notice This library provides storage layout and functions for managing NFTs within the GNUS ecosystem.
/// @dev This library uses a struct to define the storage layout and provides functions to access and manipulate the storage.

/// @notice Struct representing an NFT.
/// @dev This struct contains various properties related to an NFT, including its name, symbol, URI, exchange rate, max supply, creator, child index, and creation status.
struct NFT {
    string name;            ///< Token/NFT Name
    string symbol;          ///< Token/NFT Symbol
    string uri;             ///< Token/NFT URI for metadata
    uint256 exchangeRate;   ///< Exchange rate for withdrawing to GNUS
    uint256 maxSupply;      ///< Maximum supply of NFTs
    address creator;        ///< The creator of the token
    uint128 childCurIndex;  ///< The current child NFT count created
    bool nftCreated;        ///< Indicates if the NFT has been created
}

/// @custom:security-contact support@gnus.ai
library GNUSNFTFactoryStorage {
    /// @notice Struct representing the storage layout for the GNUS NFT Factory.
    /// @dev This struct contains a mapping from token IDs to NFT information.
    struct Layout {
        mapping(uint256 => NFT) NFTs; ///< Mapping from token ID to NFT information
    }

    /// @notice The storage position for the GNUS NFT Factory storage.
    /// @dev This constant is used to identify the storage slot for the GNUS NFT Factory storage.
    bytes32 constant GNUS_NFT_FACTORY_STORAGE_POSITION = keccak256("gnus.ai.nft.factory.storage");

    /// @notice Retrieves the storage layout for the GNUS NFT Factory.
    /// @dev This function uses inline assembly to access the storage slot for the GNUS NFT Factory storage.
    /// @return l The storage layout for the GNUS NFT Factory.
    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_NFT_FACTORY_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }
}
