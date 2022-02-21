// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/security/PausableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/UUPSUpgradeable.sol";
import "./GNUSNFTFactory.sol";

/// @custom:security-contact support@gnus.ai
library  GNUSNFTFactoryStorage
{
    struct Layout {
        uint256 NFTCurIndex;         // can be either token or NFT starts from GNUS_TOKEN_ID+1

        // unique ID for Token to extra data for tokens
        mapping(uint256 => GNUSNFTFactory.Token) Tokens;

        // unique ID for ChildNFTs with parent Token
        mapping(uint256 => GNUSNFTFactory.ChildNFT) ChildNFTs;
    }

    bytes32 constant GNUS_NFT_FACTORY_STORAGE_POSITION = keccak256("gnus.ai.nft.factory.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_NFT_FACTORY_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }

}

