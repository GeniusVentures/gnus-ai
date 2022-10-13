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
contract ERC20TransferBatch is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC20Storage for ERC20Storage.Layout;


    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool) {
        return (ERC1155Upgradeable.supportsInterface(interfaceId) || AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
    }

    function mintBatch( address[] memory destinations,
        uint256[] memory amounts) external payable {
        address operator = _msgSender();

        require(hasRole(DEFAULT_ADMIN_ROLE, operator), "Creator or Admin can only mint GNUS Tokens");
        _mintBatch(destinations, amounts);
    }

    event TransferBatch(
        address indexed operator,
        address indexed from,
        address[] indexed destinations,
        uint256[] values
    );


    /**
     * @dev . check to not exceed supply, or burn more than supply
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address[] memory destinations,
        uint256[] memory amounts
    ) internal virtual {

        uint256 supply = ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID];

        // mint check
        if (from == address(0)) {
            uint256 newSupply = supply;
            for (uint256 i = 0; i < amounts.length; ++i) {
                newSupply += amounts[i];
            }
            require(newSupply <= GNUSNFTFactoryStorage.layout().NFTs[GNUS_TOKEN_ID].maxSupply,
                "Max Supply for GNUS Token would be exceeded");
            ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID] = newSupply;
        } else {
            // check if burning any amounts
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
    }


    function _afterTokenTransfer(
        address operator,
        address from,
        address[] memory destinations,
        uint256[] memory amounts
    ) internal virtual {
    }


    /*
     * Requirements:
     *
     * - `destinations` and `amounts` must have the same length.
     */
    function _mintBatch(
        address[] memory destinations,
        uint256[] memory amounts
    ) internal virtual {
        address operator = _msgSender();

        require(destinations.length == amounts.length, "TransferBatch: to and amounts length mismatch");

        _beforeTokenTransfer(operator, address(0), destinations, amounts);

        for (uint256 i = 0; i < destinations.length; i++) {
            address to = destinations[i];

            require(to != address(0), "TransferBatch: mint to the zero address");

            ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][to] += amounts[i];
        }

        emit TransferBatch(operator, address(0), destinations, amounts);

        _afterTokenTransfer(operator, address(0), destinations, amounts);
    }

    /*
 * Requirements:
 *
 * - `destinations` and `amounts` must have the same length.
 */
    function _transferBatch(
        address[] memory destinations,
        uint256[] memory amounts,
        bool checkBurn
    ) internal virtual {
        address operator = _msgSender();

        require(destinations.length == amounts.length, "TransferBatch: to and amounts length mismatch");

        _beforeTokenTransfer(operator, operator, destinations, amounts);

        for (uint256 i = 0; i < destinations.length; i++) {
            address to = destinations[i];
            // this prevents burns during transfer
            if (checkBurn) {
                require(to != address(0), "TranferBatch: can't burn/transfer to the zero address");
            }

            uint256 fromBalance = ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][operator];
            require(fromBalance >= amounts[i],
                "TransferBatch: from account does not have sufficient tokens");
            unchecked {
                ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][operator] = fromBalance - amounts[i];
                ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][to] += amounts[i];
            }
        }

        emit TransferBatch(operator, operator, destinations, amounts);

        _afterTokenTransfer(operator, operator, destinations, amounts);
    }

    function transferBatch(
        address[] memory destinations,
        uint256[] memory amounts
    ) public payable {
        _transferBatch(destinations, amounts, true);
    }

    /*
    * This allows us to burn
    */
    function transferOrBurnBatch(
        address[] memory destinations,
        uint256[] memory amounts
    ) public payable {
        _transferBatch(destinations, amounts, false);
    }
}
