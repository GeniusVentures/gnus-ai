// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/security/PausableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "./GNUSNFTFactoryStorage.sol";

contract GNUSERC1155MaxSupply is ERC1155SupplyUpgradeable, PausableUpgradeable, ERC1155BurnableUpgradeable {

    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids,
        uint256[] memory amounts, bytes memory data) internal whenNotPaused
        override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {

        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        if (from == address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                uint256 id = ids[i];
                require(totalSupply(id) <= GNUSNFTFactoryStorage.layout().NFTs[id].maxSupply, "Max Supply for NFT would be exceeded");
            }
        }
    }
}
