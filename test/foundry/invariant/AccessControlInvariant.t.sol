// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title AccessControlInvariant
 * @notice Invariant tests for role-based access control
 * @dev Tests that role-based permissions are always enforced correctly
 */
contract AccessControlInvariant is GeniusDiamondTestBase {
    // Track addresses with roles for verification
    address[] internal roledAddresses;
    mapping(address => mapping(bytes32 => bool)) internal expectedRoles;

    /**
     * @notice Setup for access control invariant tests
     */
    function setUp() public override {
        super.setUp();

        // Setup some initial roles for testing
        vm.prank(owner);
        _grantRole(MINTER_ROLE, user1);
        expectedRoles[user1][MINTER_ROLE] = true;
        roledAddresses.push(user1);

        vm.prank(owner);
        _grantRole(PAUSER_ROLE, user2);
        expectedRoles[user2][PAUSER_ROLE] = true;
        roledAddresses.push(user2);

        console.log("===== Access Control Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("Owner:", owner);
        console.log("Admin (test contract):", address(this));
        console.log("==========================================");
    }

    /**
     * @notice Invariant: DEFAULT_ADMIN_ROLE holders can grant any role
     * @dev Ensures admin role has proper permissions
     */
    function invariant_adminRoleCanGrantAll() public {
        // Test contract has DEFAULT_ADMIN_ROLE (granted in base setUp)
        assertTrue(
            _hasRole(DEFAULT_ADMIN_ROLE, address(this)),
            "Test contract should have admin role"
        );

        // Try granting a role to user3
        address testTarget = user3;
        bytes32 testRole = UPGRADER_ROLE;

        // Should succeed
        _grantRole(testRole, testTarget);

        // Verify role was granted
        assertTrue(_hasRole(testRole, testTarget), "Admin should be able to grant role");

        // Clean up
        _revokeRole(testRole, testTarget);

        console.log("[OK] Admin can grant roles");
    }

    /**
     * @notice Invariant: hasRole returns consistent results with granted/revoked state
     * @dev Ensures role queries match expected state
     */
    function invariant_roleConsistency() public view {
        // Check all tracked role assignments
        for (uint256 i = 0; i < roledAddresses.length; i++) {
            address account = roledAddresses[i];

            // Check MINTER_ROLE
            bool hasMinter = _hasRole(MINTER_ROLE, account);
            assertEq(hasMinter, expectedRoles[account][MINTER_ROLE], "MINTER_ROLE state mismatch");

            // Check PAUSER_ROLE
            bool hasPauser = _hasRole(PAUSER_ROLE, account);
            assertEq(hasPauser, expectedRoles[account][PAUSER_ROLE], "PAUSER_ROLE state mismatch");
        }

        console.log("[OK] Role state is consistent");
    }

    /**
     * @notice Invariant: Owner always has DEFAULT_ADMIN_ROLE
     * @dev Critical for governance - owner must maintain admin privileges
     */
    function invariant_ownerHasAdminRole() public view {
        // Owner should have admin role
        bool ownerHasAdmin = _hasRole(DEFAULT_ADMIN_ROLE, owner);
        assertTrue(ownerHasAdmin, "Owner must have DEFAULT_ADMIN_ROLE");

        console.log("[OK] Owner has admin role");
    }

    /**
     * @notice Invariant: Non-admin addresses cannot have admin privileges
     * @dev Ensures admin role is properly restricted
     */
    function invariant_nonAdminsLackAdminRole() public view {
        // Random users should not have admin role
        assertFalse(_hasRole(DEFAULT_ADMIN_ROLE, attacker), "Attacker should not have admin role");
        assertFalse(_hasRole(DEFAULT_ADMIN_ROLE, user1), "User1 should not have admin role");
        assertFalse(_hasRole(DEFAULT_ADMIN_ROLE, user2), "User2 should not have admin role");

        console.log("[OK] Non-admins lack admin role");
    }

    /**
     * @notice Invariant: Addresses without MINTER_ROLE cannot have it
     * @dev Ensures MINTER_ROLE is properly restricted
     */
    function invariant_minterRoleRestricted() public view {
        // Only user1 was granted MINTER_ROLE
        assertTrue(_hasRole(MINTER_ROLE, user1), "User1 should have MINTER_ROLE");
        assertFalse(_hasRole(MINTER_ROLE, user2), "User2 should not have MINTER_ROLE");
        assertFalse(_hasRole(MINTER_ROLE, attacker), "Attacker should not have MINTER_ROLE");

        console.log("[OK] MINTER_ROLE properly restricted");
    }

    /**
     * @notice Invariant: Role queries never revert for valid inputs
     * @dev hasRole should always be callable
     */
    function invariant_roleQueriesNeverRevert() public view {
        // Should not revert for any address/role combination
        _hasRole(DEFAULT_ADMIN_ROLE, address(0));
        _hasRole(MINTER_ROLE, address(this));
        _hasRole(PAUSER_ROLE, owner);
        _hasRole(bytes32(0), user1);

        console.log("[OK] Role queries work for all inputs");
    }

    /**
     * @notice Invariant: Multiple admins can coexist
     * @dev System should support multiple DEFAULT_ADMIN_ROLE holders
     */
    function invariant_multipleAdminsSupported() public {
        // Grant admin to user3
        _grantRole(DEFAULT_ADMIN_ROLE, user3);

        // Both should have admin role
        assertTrue(_hasRole(DEFAULT_ADMIN_ROLE, address(this)), "Test contract should have admin");
        assertTrue(_hasRole(DEFAULT_ADMIN_ROLE, user3), "User3 should have admin");

        // Clean up
        _revokeRole(DEFAULT_ADMIN_ROLE, user3);

        console.log("[OK] Multiple admins supported");
    }

    /**
     * @notice Invariant: Revoking a role that wasn't granted has no effect
     * @dev Should not revert or cause state corruption
     */
    function invariant_revokingUnownedRoleIsSafe() public {
        // User3 doesn't have UPGRADER_ROLE
        assertFalse(_hasRole(UPGRADER_ROLE, user3), "User3 should not have UPGRADER_ROLE");

        // Revoking it should work
        _revokeRole(UPGRADER_ROLE, user3);

        // Still shouldn't have it
        assertFalse(_hasRole(UPGRADER_ROLE, user3), "User3 still should not have role");

        console.log("[OK] Revoking unowned role is safe");
    }
}
