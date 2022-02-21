// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/UUPSUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/utils/escrow/ConditionalEscrowUpgradeable.sol";
import "./GeniusAccessControl.sol";


contract EscrowAIJob is Initializable, ConditionalEscrowUpgradeable, UUPSUpgradeable, GeniusAccessControl {

    // one time initialization on, subsequent calls get ignored with initializer
    function initialize() public initializer override(EscrowUpgradeable) onlyRole(DEFAULT_ADMIN_ROLE) {
        __ConditionalEscrow_init();
        __UUPSUpgradeable_init();
        __GeniusAccessControl_init();
    }

    function withdrawalAllowed(address payee) public view virtual override returns (bool) {
        // TODO: zkSnark check based on some random seed and macro job index and hashes.
        //require(_payees.)
        // logic here for allowing withdrawals to a payee
        return false;
    }

    function _addPayees(address[] memory payees) internal {
    }

}
