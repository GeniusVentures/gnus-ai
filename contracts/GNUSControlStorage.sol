// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "contracts-starter/contracts/libraries/LibDiamond.sol";

/// @title GNUS Control Storage Library
/// @notice This library defines the storage layout and utility functions for managing GNUS control data.
/// @dev Utilizes the diamond storage pattern to manage control-related state.
/// @custom:security-contact support@gnus.ai
library GNUSControlStorage {
    /**
     * @notice Defines the storage structure for GNUS control.
     */
    struct Layout {
        /// @dev Mapping from token ID to address to indicate if the transferor is banned or allowed.
        mapping(uint256 => mapping(address => bool)) bannedTransferors;
        /// @dev Global mapping of addresses banned from transferring any token ID.
        mapping(address => bool) gBannedTransferors;
        /// @dev Percentage fee applied when minting through the bridge.
        uint256 bridgeFee;
        /// @dev Current protocol version for GNUS.
        uint256 protocolVersion;
        /// @dev The chain ID for the current chain.
        uint256 chainID;
    }

    using LibDiamond for LibDiamond.DiamondStorage;

    /// @dev Unique storage slot identifier for GNUS control storage.
    bytes32 constant GNUS_CONTROL_STORAGE_POSITION = keccak256("gnus.ai.control.storage");

    /**
     * @notice Accesses the GNUS control storage layout.
     * @return l A reference to the storage layout.
     */
    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_CONTROL_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }

    /**
     * @notice Checks if a transferor is banned for a specific token ID.
     * @param tokenId The ID of the token.
     * @param sender The address of the transferor.
     * @return bool True if the transferor is banned, otherwise false.
     */
    function isBannedTransferor(uint256 tokenId, address sender) internal view returns (bool) {
        return layout().gBannedTransferors[sender] || layout().bannedTransferors[tokenId][sender];
    }

    /**
     * @notice Executes a delegate call to a facet with the given selector and parameters.
     * @param facetSelector The function selector of the target facet.
     * @param encodedParameters The encoded function parameters.
     * @return success True if the delegate call succeeds, otherwise false.
     * @return data The returned data from the delegate call.
     * @dev Reverts if the facet address is not found.
     */
    function callFacetDelegate(bytes4 facetSelector, bytes memory encodedParameters) internal returns (bool success, bytes memory data) {
        address facetAddress = address(bytes20(LibDiamond.diamondStorage().facets[facetSelector]));

        require(facetAddress != address(0), "Diamond: Function does not exist");
        return facetAddress.delegatecall(abi.encodePacked(facetSelector, encodedParameters));
    }
}
