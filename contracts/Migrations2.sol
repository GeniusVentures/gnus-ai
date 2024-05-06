// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/IERC20Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";

import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSControlStorage.sol";

/// @custom:security-contact support@gnus.ai
contract Migrations2 is ERC1155BurnableUpgradeable, GeniusAccessControl {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC20Storage for ERC20Storage.Layout;
    using GNUSControlStorage for GNUSControlStorage.Layout;

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControlEnumerableUpgradeable, ERC1155Upgradeable) returns (bool) {}

    function batchBurn(
        address[] calldata addresses,
        uint256[] calldata amounts
    ) external onlySuperAdminRole {
        for (uint256 i; i < addresses.length; ) {
            _burn(addresses[i], GNUS_TOKEN_ID, amounts[i]);
            unchecked {
                ++i;
            }
        }
    }
}
