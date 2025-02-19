// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/security/PausableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GNUSControlStorage.sol";

/// @title GNUSERC1155MaxSupply
/// @notice This contract extends ERC1155 functionality with supply management, pausing, and burning capabilities.
/// @dev This contract uses the GNUSNFTFactoryStorage and GNUSControlStorage libraries for additional storage management.
contract GNUSERC1155MaxSupply is
    ERC1155SupplyUpgradeable,
    PausableUpgradeable,
    ERC1155BurnableUpgradeable
{
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using GNUSControlStorage for GNUSControlStorage.Layout;

    /// @notice Hook that is called before any token transfer. This includes minting and burning.
    /// @dev This function overrides the _beforeTokenTransfer function from ERC1155Upgradeable and ERC1155SupplyUpgradeable.
    /// It ensures that transfers are not paused, checks for banned transferors, and enforces max supply constraints.
    /// @param operator The address which initiated the transfer (i.e. msg.sender)
    /// @param from The address which previously owned the token
    /// @param to The address which will receive the token
    /// @param ids An array containing the ids of each token being transferred (order and length must match amounts array)
    /// @param amounts An array containing the amount of each token being transferred (order and length must match ids array)
    /// @param data Additional data with no specified format
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            require(!GNUSControlStorage.isBannedTransferor(id, operator), "Blocked transferor");
            if (from == address(0))
                require(
                    totalSupply(id) <= GNUSNFTFactoryStorage.layout().NFTs[id].maxSupply,
                    "Max Supply for NFT would be exceeded"
                );
        }
    }

    /// @notice Converts a uint256 element to a singleton array.
    /// @dev This function is used to create an array with a single uint256 element.
    /// @param element The uint256 element to be converted to an array.
    /// @return An array containing the single uint256 element.
    function asSingletonArray(uint256 element) internal pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](1);
        array[0] = element;

        return array;
    }

    /// @notice Converts a string element to a singleton array.
    /// @dev This function is used to create an array with a single string element.
    /// @param element The string element to be converted to an array.
    /// @return An array containing the single string element.
    function asSingletonArray(string memory element) internal pure returns (string[] memory) {
        string[] memory array = new string[](1);
        array[0] = element;

        return array;
    }
}
