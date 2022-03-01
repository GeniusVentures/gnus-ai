
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/access/AccessControlEnumerableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/UUPSUpgradeable.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";

abstract contract GeniusAccessControl is Initializable, AccessControlEnumerableUpgradeable, UUPSUpgradeable {

    bytes32 constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    function __GeniusAccessControl_init() internal onlyInitializing onlySuperAdminRole {
        __AccessControlEnumerable_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __GeniusAccessControl_init_unchained();
    }

    function __GeniusAccessControl_init_unchained() onlyInitializing internal {
        address superAdmin = _msgSender();
        _grantRole(UPGRADER_ROLE, superAdmin);
        _grantRole(DEFAULT_ADMIN_ROLE, superAdmin);
    }

    function renounceRole(bytes32 role, address account) public override(IAccessControlUpgradeable) {
        require(!(hasRole(DEFAULT_ADMIN_ROLE, account) && (LibDiamond.diamondStorage().contractOwner == account)), "Cannot renounce superAdmin from Admin Role");
        super.renounceRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public override(IAccessControlUpgradeable) {
        require(!(hasRole(DEFAULT_ADMIN_ROLE, account) && (LibDiamond.diamondStorage().contractOwner == account)), "Cannot revoke superAdmin from Admin Role");
        super.revokeRole(role, account);
    }

    function _authorizeUpgrade(address newImplementation) internal override(UUPSUpgradeable) onlyRole(UPGRADER_ROLE) {
    }

    modifier onlySuperAdminRole {
        require(LibDiamond.diamondStorage().contractOwner == msg.sender, "Only SuperAdmin allowed");
        _;
    }


}
