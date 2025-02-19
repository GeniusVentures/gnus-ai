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
/// @title ERC20 Transfer Batch Contract
/// @notice Facilitates batch transfers, minting, and burning of ERC20-like tokens.
/// @dev Extends `GNUSERC1155MaxSupply` and `GeniusAccessControl` to enforce token supply limits and role-based access control.
contract ERC20TransferBatch is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC20Storage for ERC20Storage.Layout;

    /// @notice Checks if the contract supports a given interface.
    /// @param interfaceId The interface identifier, as specified in ERC-165.
    /// @return True if the contract supports the specified interface.
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable) 
        returns (bool) 
    {
        return (ERC1155Upgradeable.supportsInterface(interfaceId) || 
                AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) || 
                (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
    }

    /// @notice Mints a batch of tokens to multiple destinations.
    /// @dev Requires the caller to have the `DEFAULT_ADMIN_ROLE`.
    /// @param destinations The addresses to receive the minted tokens.
    /// @param amounts The corresponding amounts of tokens to mint for each destination.
    function mintBatch(address[] memory destinations, uint256[] memory amounts) external payable {
        address operator = _msgSender();
        require(hasRole(DEFAULT_ADMIN_ROLE, operator), "Creator or Admin can only mint GNUS Tokens");
        _mintBatch(destinations, amounts);
    }

    /// @notice Event emitted when a batch transfer occurs.
    /// @param operator The address initiating the transfer.
    /// @param from The address sending the tokens (or zero for minting).
    /// @param destinations The addresses receiving the tokens.
    /// @param values The amounts of tokens transferred to each address.
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address[] indexed destinations,
        uint256[] values
    );

    /// @dev Ensures supply constraints and prevents burns exceeding total supply.
    /// @param operator The address initiating the transfer.
    /// @param from The address sending the tokens (or zero for minting).
    /// @param destinations The addresses receiving the tokens.
    /// @param amounts The amounts of tokens being transferred or burned.
    function _beforeTokenTransfer(
        address operator,
        address from,
        address[] memory destinations,
        uint256[] memory amounts
    ) internal virtual {
        uint256 supply = ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID];

        if (from == address(0)) {
            // Minting tokens
            uint256 newSupply = supply;
            for (uint256 i = 0; i < amounts.length; ++i) {
                newSupply += amounts[i];
            }
            require(newSupply <= GNUSNFTFactoryStorage.layout().NFTs[GNUS_TOKEN_ID].maxSupply,
                "Max Supply for GNUS Token would be exceeded");
            ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID] = newSupply;
        } else {
            // Burning tokens
            uint256 burnAmount = 0;
            for (uint256 i = 0; i < destinations.length; ++i) {
                if (destinations[i] == address(0)) {
                    burnAmount += amounts[i];
                }
            }
            require(supply >= burnAmount, "GNUS Token: burn amount exceeds totalSupply");
            unchecked {
                ERC1155SupplyStorage.layout()._totalSupply[GNUS_TOKEN_ID] = supply - burnAmount;
            }
        }
    }

    /// @dev Placeholder for post-transfer logic. Can be extended as needed.
    function _afterTokenTransfer(
        address operator,
        address from,
        address[] memory destinations,
        uint256[] memory amounts
    ) internal virtual {}

    /// @dev Internal function to mint a batch of tokens.
    /// @param destinations The addresses to receive the tokens.
    /// @param amounts The amounts of tokens to mint for each address.
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

    /// @dev Internal function to transfer a batch of tokens, with optional burn checks.
    /// @param destinations The addresses to receive the tokens.
    /// @param amounts The amounts of tokens to transfer or burn for each address.
    /// @param checkBurn If true, disallows burning (transfer to the zero address).
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
            if (checkBurn) {
                require(to != address(0), "TransferBatch: can't burn/transfer to the zero address");
            }

            uint256 fromBalance = ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][operator];
            require(fromBalance >= amounts[i], "TransferBatch: from account does not have sufficient tokens");
            unchecked {
                ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][operator] = fromBalance - amounts[i];
                ERC1155Storage.layout()._balances[GNUS_TOKEN_ID][to] += amounts[i];
            }
        }

        emit TransferBatch(operator, operator, destinations, amounts);

        _afterTokenTransfer(operator, operator, destinations, amounts);
    }

    /// @notice Transfers a batch of tokens from the caller to multiple destinations.
    /// @param destinations The addresses to receive the tokens.
    /// @param amounts The amounts of tokens to transfer for each address.
    function transferBatch(
        address[] memory destinations,
        uint256[] memory amounts
    ) public payable {
        _transferBatch(destinations, amounts, true);
    }

    /// @notice Transfers or burns a batch of tokens from the caller.
    /// @param destinations The addresses to receive the tokens or the zero address to burn.
    /// @param amounts The amounts of tokens to transfer or burn for each address.
    function transferOrBurnBatch(
        address[] memory destinations,
        uint256[] memory amounts
    ) public payable {
        _transferBatch(destinations, amounts, false);
    }
}