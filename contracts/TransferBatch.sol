// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/IERC20Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";

/// @custom:security-contact support@gnus.ai
contract TransferBatch is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC20Storage for ERC20Storage.Layout;
    bytes32 constant public PROXY_ROLE = keccak256("PROXY_ROLE");


    function mintBatch() {
        require(hasRole(DEFAULT_ADMIN_ROLE, operator), "Creator or Admin can only mint NFT");
    }

    event TransferBatch(
        address indexed operator,
        address indexed from,
        address[] indexed to,
        uint256[] values
    );

    /**
     * @dev .
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        if (from == address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                ERC1155SupplyStorage.layout()._totalSupply[ids[i]] += amounts[i];
            }
        }

        if (to == address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                uint256 id = ids[i];
                uint256 amount = amounts[i];
                uint256 supply = ERC1155SupplyStorage.layout()._totalSupply[id];
                require(supply >= amount, "ERC1155: burn amount exceeds totalSupply");
            unchecked {
                ERC1155SupplyStorage.layout()._totalSupply[id] = supply - amount;
            }
            }
        }
    }

    /**
    * @dev _mintBatch erc20/erc1155 blended contract
     *
     * Requirements:
     *
     * - `to` and `amounts` must have the same length.
     */
    function _mintBatch(
        address payable[] destinations,
        uint256[] memory amounts,
    ) internal virtual {
        address operator = _msgSender();

        require(destinations.length == amounts.length, "TransferBatch: to and amounts length mismatch");

        _beforeTokenTransfer(operator, address(0), destinations, amounts);

        for (uint256 i = 0; i < ids.length; i++) {
            address payable to = destinations[i];

            require(to != address(0), "TransferBatch: mint to the zero address");

            ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][to] += amounts[i];
        }

        emit TransferBatch(operator, address(0), destinatiosn, amounts);

        _afterTokenTransfer(operator, address(0), destinations, amounts);
    }


}
