// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./GNUSBannedTransferorStorage.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";

/**
 * @title Security Control Contract
 * @author ruymaster
 * @notice This contract handles security for the protocol.
 */
contract GNUSSecControl {
    using GNUSBannedTransferorStorage for GNUSBannedTransferorStorage.Layout;

    event AddToBlackList(uint256[] tokenIds, address[] addresses);
    event RemoveFromBlackList(uint256[] tokenIds, address[] addresses);
    event AddToGlobalBlackList(address bannedAddress);
    event RemoveFromGlobalBlackList(address bannedAddress);

    function banTransferorForAll(address bannedAddress) external onlySuperAdminRole {
        GNUSBannedTransferorStorage.layout().gBannedTransferors[bannedAddress] = true;
        emit AddToGlobalBlackList(bannedAddress);
    }

    function allowTransferorForAll(address bannedAddress) external onlySuperAdminRole {
        GNUSBannedTransferorStorage.layout().gBannedTransferors[bannedAddress] = false;
        emit RemoveFromGlobalBlackList(bannedAddress);
    }

    function banTransferorBatch(
        uint256[] calldata tokenIds,
        address[] calldata bannedAddresses
    ) external onlySuperAdminRole {
        for (uint256 i; i < tokenIds.length; ) {
            GNUSBannedTransferorStorage.layout().bannedTransferors[tokenIds[i]][
                bannedAddresses[i]
            ] = true;
            unchecked {
                ++i;
            }
        }
        emit AddToBlackList(tokenIds, bannedAddresses);
    }

    function allowTransferorBatch(
        uint256[] calldata tokenIds,
        address[] calldata bannedAddresses
    ) external onlySuperAdminRole {
        for (uint256 i; i < tokenIds.length; ) {
            GNUSBannedTransferorStorage.layout().bannedTransferors[tokenIds[i]][
                bannedAddresses[i]
            ] = false;
            unchecked {
                ++i;
            }
        }
        emit RemoveFromBlackList(tokenIds, bannedAddresses);
    }

    modifier onlySuperAdminRole() {
        require(LibDiamond.diamondStorage().contractOwner == msg.sender, "Only SuperAdmin allowed");
        _;
    }
}
