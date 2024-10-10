// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "contracts-starter/contracts/libraries/LibDiamond.sol";

/// @custom:security-contact support@gnus.ai
library GNUSControlStorage {
    struct Layout {
        // token ID to address to banned or allowed
        mapping(uint256 => mapping(address => bool)) bannedTransferors;
        // global transferors banned for all token ids
        mapping(address => bool) gBannedTransferors;
        // percentage when mint
        uint256 bridgeFee;
        // current protocol version
        uint256 protocolVersion;
        // this chains ID
        uint256 chainID;
    }

    using LibDiamond for LibDiamond.DiamondStorage;

    bytes32 constant GNUS_CONTROL_STORAGE_POSITION = keccak256("gnus.ai.control.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_CONTROL_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }

    function isBannedTransferor(uint256 tokenId, address sender) internal view returns (bool) {
        return layout().gBannedTransferors[sender] || layout().bannedTransferors[tokenId][sender];
    }

    function callFacetDelegate(bytes4 facetSelector, bytes memory encodedParameters) internal returns (bool, bytes memory) {
        address facetAddress = address(bytes20(LibDiamond.diamondStorage().facets[facetSelector]));

        require(facetAddress != address(0), "Diamond: Function does not exist");
        return facetAddress.delegatecall(abi.encodePacked(facetSelector, encodedParameters));
    }

}
