// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/security/PausableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GNUSControlStorage.sol";

contract GNUSERC1155MaxSupply is
    ERC1155SupplyUpgradeable,
    PausableUpgradeable,
    ERC1155BurnableUpgradeable
{
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using GNUSControlStorage for GNUSControlStorage.Layout;

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

    function asSingletonArray(uint256 element) internal pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](1);
        array[0] = element;

        return array;
    }

    function asSingletonArray(string memory element) internal pure returns (string[] memory) {
        string[] memory array = new string[](1);
        array[0] = element;

        return array;
    }
}
