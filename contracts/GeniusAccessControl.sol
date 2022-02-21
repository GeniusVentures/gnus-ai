
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/access/AccessControlEnumerableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/UUPSUpgradeable.sol";
import "./GeniusDiamondStorage.sol";


contract GeniusAccessControl is Initializable, AccessControlEnumerableUpgradeable, UUPSUpgradeable {
    using GeniusDiamondStorage for GeniusDiamondStorage.Layout;

    bytes32 constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    function __GeniusAccessControl_init() internal onlyInitializing {
        __AccessControlEnumerable_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __GeniusAccessControl_init_unchained();
    }

    function __GeniusAccessControl_init_unchained() internal onlyInitializing {
        address superAdmin = _msgSender();
        GeniusDiamondStorage.layout().superAdmin = superAdmin;
        grantRole(UPGRADER_ROLE, superAdmin);
    }

    function renounceRole(bytes32 role, address account) public override(IAccessControlUpgradeable) {
        require(!(hasRole(DEFAULT_ADMIN_ROLE, account) && (GeniusDiamondStorage.layout().superAdmin == account)), "Cannot renounce superAdmin from Admin Role");
        super.renounceRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public override(IAccessControlUpgradeable)
        onlyRole(DEFAULT_ADMIN_ROLE) {

        require(!(hasRole(DEFAULT_ADMIN_ROLE, account) && (GeniusDiamondStorage.layout().superAdmin == account)), "Cannot revoke superAdmin from Admin Role");
        super.revokeRole(role, account);
    }

    function _authorizeUpgrade(address newImplementation) internal override(UUPSUpgradeable) onlyRole(UPGRADER_ROLE) {
    }


}
