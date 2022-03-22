// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

struct NFT {
    string name;            // Token/MFT Name
    string symbol;          // Token/MFT Symbol
    string uri;             // Token/NFT uri for metadata
    uint256 exchangeRate;   // only for withdrawing to GNUS
    uint256 maxSupply;      // maximum supply of NFTs
    address creator;        // the creator of the token
    uint128 childCurIndex;  // the current childNFT count created
    bool nftCreated;        // if there is a mapping/token created
}

/// @custom:security-contact support@gnus.ai
library  GNUSNFTFactoryStorage
{
    struct Layout {
        // token ID to NFT information
        mapping(uint256 => NFT) NFTs;
    }

    bytes32 constant GNUS_NFT_FACTORY_STORAGE_POSITION = keccak256("gnus.ai.nft.factory.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_NFT_FACTORY_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }

}

