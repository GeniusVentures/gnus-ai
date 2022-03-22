// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSNFTFactoryStorage.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Storage.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyStorage.sol";

contract ERC1155ProxyOperator is GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC1155SupplyStorage for ERC1155SupplyStorage.Layout;
    using ERC1155Storage for ERC1155Storage.Layout;

    bytes32 public constant NFT_PROXY_OPERATOR_ROLE = keccak256("NFT_PROXY_OPERATOR_ROLE");

    /**
     * Override isApprovedForAll to whitelist user's OpenSea proxy accounts to enable gas-free listings.
     */
    function isApprovedForAll(
        address account,
        address operator
    ) public view returns (bool isApproved) {

        if (hasRole(NFT_PROXY_OPERATOR_ROLE, operator))
            return true;

        return ERC1155Storage.layout()._operatorApprovals[account][operator];
    }

    function tokenSupply(uint256 id) public view returns (uint256 curSupply) {
        return ERC1155SupplyStorage.layout()._totalSupply[id];
    }

    function creators(uint256 id) public view returns (address creator) {
        return GNUSNFTFactoryStorage.layout().NFTs[id].creator;
    }

}
