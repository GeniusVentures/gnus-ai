// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSNFTFactoryStorage.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Storage.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyStorage.sol";

/// @title ERC1155 Proxy Operator Contract
/// @notice Provides additional functionality for ERC1155 tokens, including proxy operator approvals and supply tracking.
/// @dev Extends `GeniusAccessControl` for role-based access control and integrates with ERC1155 storage layouts.
contract ERC1155ProxyOperator is GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC1155SupplyStorage for ERC1155SupplyStorage.Layout;
    using ERC1155Storage for ERC1155Storage.Layout;

    /// @notice Role identifier for NFT Proxy Operators.
    bytes32 public constant NFT_PROXY_OPERATOR_ROLE = keccak256("NFT_PROXY_OPERATOR_ROLE");

    /**
     * @notice Checks if an operator is approved to manage all tokens of a given account.
     * @dev This function overrides the default `isApprovedForAll` to enable proxy accounts for gas-free listings.
     * @param account The address of the token owner.
     * @param operator The address of the operator to check.
     * @return isApproved True if the operator is approved, false otherwise.
     */
    function isApprovedForAll(
        address account,
        address operator
    ) public view returns (bool isApproved) {
        // Automatically approve operators with the `NFT_PROXY_OPERATOR_ROLE`.
        if (hasRole(NFT_PROXY_OPERATOR_ROLE, operator)) {
            return true;
        }

        // Check the standard ERC1155 operator approvals.
        return ERC1155Storage.layout()._operatorApprovals[account][operator];
    }

    /**
     * @notice Retrieves the total supply of a specific token ID.
     * @dev Uses `ERC1155SupplyStorage` to fetch the current total supply.
     * @param id The token ID to query.
     * @return curSupply The current total supply of the token ID.
     */
    function totalSupply(uint256 id) public view returns (uint256 curSupply) {
        return ERC1155SupplyStorage.layout()._totalSupply[id];
    }

    /**
     * @notice Retrieves the creator address of a specific token ID.
     * @dev Uses `GNUSNFTFactoryStorage` to fetch the creator information.
     * @param id The token ID to query.
     * @return creator The address of the token's creator.
     */
    function creators(uint256 id) public view returns (address creator) {
        return GNUSNFTFactoryStorage.layout().NFTs[id].creator;
    }
}
