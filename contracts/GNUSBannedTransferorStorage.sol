// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @custom:security-contact support@gnus.ai
library GNUSBannedTransferorStorage {
    struct Layout {
        // token ID to address to banned or allowed
        mapping(uint256 => mapping(address => bool)) bannedTransferors;
        // global transferors banned for all token ids
        mapping(address => bool) gBannedTransferors;
    }

    bytes32 constant GNUS_BANNED_TRANSFEROR_STORAGE_POSITION =
        keccak256("gnus.ai.banned.transferor.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_BANNED_TRANSFEROR_STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }

    function isBannedTransferor(uint256 tokenId, address sender) internal view returns (bool) {
        return layout().gBannedTransferors[sender] || layout().bannedTransferors[tokenId][sender];
    }
}
