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


    function mintBatch( address payable[] destinations,
        uint256[] memory amounts) external {

        require(hasRole(DEFAULT_ADMIN_ROLE, operator), "Creator or Admin can only mint GNUS Tokens");
        _mintBatch(destinations, amounts);
    }

    event TransferBatch(
        address indexed operator,
        address indexed from,
        address payable[] indexed destinations,
        uint256[] values
    );


    /**
     * @dev .
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address payable[] destinations,
        uint256[] memory amounts
    ) internal virtual {

        // mint check
        if (from == address(0)) {
            for (uint256 i = 0; i < amounts.length; ++i) {
                ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID] += amounts[i];
            }
            require(totalSupply(GNUS_TOKEN_ID) <= GNUSNFTFactoryStorage.layout().NFTs[GNUS_TOKEN_ID].maxSupply,
                "Max Supply for GNUS Token would be exceeded");
        }

        // check if burning any amounts
        uint256 supply = ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID];
        uint256 burnAmount = 0;
        for (uint256 i = 0; i < destinations.length; ++i) {
            if (destinations[i] == address(0)) {
                burnAmount += amounts[i];
            }
        }
        if (burnAmount > 0) {
            require(supply >= burnAmount, "GNUS Token: burn amount exceeds totalSupply");
            unchecked {
                ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID] = supply - burnAmount;
            }
        }
    }


    function _afterTokenTransfer(
        address operator,
        address from,
        address payable[] destinations,
        uint256[] memory amounts
    ) internal virtual {
    }


    /*
     * Requirements:
     *
     * - `destinations` and `amounts` must have the same length.
     */
    function _mintBatch(
        address payable[] destinations,
        uint256[] memory amounts
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

    /*
 * Requirements:
 *
 * - `destinations` and `amounts` must have the same length.
 */
    function _transferBatch(
        address payable[] destinations,
        uint256[] memory amounts
    ) internal virtual {
        address operator = _msgSender();

        require(destinations.length == amounts.length, "TransferBatch: to and amounts length mismatch");

        _beforeTokenTransfer(operator, operator, destinations, amounts);

        for (uint256 i = 0; i < destinations.length; i++) {
            address payable to = destinations[i];

            require(to != address(0), "TransferBatch: mint to the zero address");

            ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][to] += amounts[i];
        }

        emit TransferBatch(operator, address(0), destinatiosn, amounts);

        _afterTokenTransfer(operator, address(0), destinations, amounts);
    }

    function TransferBatch(
        address payable[] destinations,
        uint256[] memory amounts
    ) public {

    }

}
