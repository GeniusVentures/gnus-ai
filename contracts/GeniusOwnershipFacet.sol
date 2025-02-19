// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "contracts-starter/contracts/libraries/LibDiamond.sol";
import { IERC173 } from "contracts-starter/contracts/interfaces/IERC173.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";

/// @title GeniusOwnershipFacet
/// @notice Provides ownership management for the Genius contract using EIP-173 standards.
/// @dev Extends GeniusAccessControl for role-based permissions and integrates with the Diamond Standard.
contract GeniusOwnershipFacet is IERC173, GeniusAccessControl {
    /**
     * @notice Transfers contract ownership to a new address.
     * @param _newOwner The address of the new owner.
     * @dev Enforces that the caller is the current contract owner. Updates the `DEFAULT_ADMIN_ROLE` and
     * `UPGRADER_ROLE` for the new owner and revokes these roles from the previous owner.
     */
    function transferOwnership(address _newOwner) external override {
        // Ensure the caller is the current contract owner
        LibDiamond.enforceIsContractOwner();

        // Update contract ownership
        LibDiamond.setContractOwner(_newOwner);

        // Grant admin and upgrader roles to the new owner
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
        _grantRole(UPGRADER_ROLE, _newOwner);

        // Revoke roles from the previous owner, if different
        if (msg.sender != _newOwner) {
            _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
            _revokeRole(UPGRADER_ROLE, msg.sender);
        }
    }

    /**
     * @notice Returns the address of the current contract owner.
     * @return owner_ The address of the contract owner.
     * @dev Retrieves the owner address from the LibDiamond storage.
     */
    function owner() external override view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}
