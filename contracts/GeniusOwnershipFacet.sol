// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "contracts-starter/contracts/libraries/LibDiamond.sol";
import { IERC173 } from "contracts-starter/contracts/interfaces/IERC173.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";

contract GeniusOwnershipFacet is IERC173, GeniusAccessControl {
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
        _grantRole(UPGRADER_ROLE, _newOwner);
        if (msg.sender != _newOwner) {
            _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
            _revokeRole(UPGRADER_ROLE, msg.sender);
        }
    }

    function owner() external override view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}
