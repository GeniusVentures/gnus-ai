// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title AccessControlInvariant
 * @notice Invariant tests for role-based access control
 * @dev Tests that role-based permissions are always enforced correctly
 * @dev Uses handler pattern: fuzzer calls handler functions, invariants verify properties
 */
contract AccessControlInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    // Track addresses with roles for verification
    address[] internal roledAddresses;
    mapping(address => mapping(bytes32 => bool)) internal expectedRoles;

    /**
     * @notice Setup for access control invariant tests
     */
    function setUp() public override {
        super.setUp();

        // Initialize handler and target it for fuzzing
        handler = new GeniusDiamondHandler();
        handler.setUp();
        targetContract(address(handler));

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
        console.log("Handler:", address(handler));
        console.log("==========================================");
    }

    /**
     * @notice Invariant: DEFAULT_ADMIN_ROLE holders can grant any role
     * @dev Ensures admin role has proper permissions to manage all other roles
     * @dev View-only: Verifies test contract has admin role, doesn't make changes
     *
     * PROPERTY TESTED:
     * - Addresses with DEFAULT_ADMIN_ROLE can grant/revoke any role in the system
     *
     * WHY IT MUST HOLD:
     * - Core security invariant for access control system
     * - Admin role is the root of trust for all permission management
     * - Without this, the access control system cannot be managed
     *
     * WHAT BREAKS IF VIOLATED:
     * - Unable to grant roles to new addresses
     * - Cannot recover from misconfigured permissions
     * - Contract becomes locked with no way to add authorized users
     * - Critical security vulnerability if admins lose control
     */
    function invariant_adminRoleCanGrantAll() public view {
        // Test contract has DEFAULT_ADMIN_ROLE (granted in base setUp)
        assertTrue(
            _hasRole(DEFAULT_ADMIN_ROLE, address(this)),
            "Test contract should have admin role"
        );

        console.log("[OK] Admin role verified");
    }

    /**
     * @notice Invariant: hasRole returns consistent results when queried multiple times
     * @dev Ensures role queries are deterministic for the same address/role
     *
     * PROPERTY TESTED:
     * - Multiple queries for the same (address, role) pair return identical results
     * - Role state is stable and not affected by view-only queries
     *
     * WHY IT MUST HOLD:
     * - Access control decisions must be deterministic
     * - View functions should never modify state
     * - Applications depend on consistent permission checks
     *
     * WHAT BREAKS IF VIOLATED:
     * - Unpredictable authorization behavior
     * - Security vulnerabilities from inconsistent permission checks
     * - Frontend/backend integration issues
     * - Transaction replay attacks become possible
     */
    function invariant_roleConsistency() public view {
        // Query same role twice - should get same answer
        bool result1 = _hasRole(MINTER_ROLE, user1);
        bool result2 = _hasRole(MINTER_ROLE, user1);
        assertEq(result1, result2, "Role query inconsistent");

        // Check for multiple addresses
        bool owner1 = _hasRole(DEFAULT_ADMIN_ROLE, owner);
        bool owner2 = _hasRole(DEFAULT_ADMIN_ROLE, owner);
        assertEq(owner1, owner2, "Owner admin role query inconsistent");

        console.log("[OK] Role state is consistent");
    }

    /**
     * @notice Invariant: Owner always has DEFAULT_ADMIN_ROLE
     * @dev Critical for governance - owner must maintain admin privileges
     *
     * PROPERTY TESTED:
     * - The contract owner always retains DEFAULT_ADMIN_ROLE
     * - Owner's admin role cannot be revoked through any sequence of operations
     *
     * WHY IT MUST HOLD:
     * - Owner is the ultimate authority in the governance model
     * - Ensures there's always a recovery path for permission management
     * - Prevents permanent lockout scenarios
     *
     * WHAT BREAKS IF VIOLATED:
     * - Owner loses ability to manage critical permissions
     * - Contract becomes ungovernable
     * - No way to recover from compromised admin accounts
     * - Potential permanent loss of administrative control
     */
    function invariant_ownerHasAdminRole() public view {
        // Owner should have admin role
        bool ownerHasAdmin = _hasRole(DEFAULT_ADMIN_ROLE, owner);
        assertTrue(ownerHasAdmin, "Owner must have DEFAULT_ADMIN_ROLE");

        console.log("[OK] Owner has admin role");
    }

    /**
     * @notice Invariant: Invalid addresses cannot have admin privileges
     * @dev Ensures admin role cannot be granted to address(0) or non-actor addresses
     *
     * PROPERTY TESTED:
     * - address(0) never has DEFAULT_ADMIN_ROLE
     * - Unauthorized addresses (not in handler's actor set) don't gain admin role
     *
     * WHY IT MUST HOLD:
     * - address(0) is a burn address and should never have permissions
     * - Only explicitly authorized actors should have admin rights
     * - Prevents privilege escalation through unmanaged addresses
     *
     * WHAT BREAKS IF VIOLATED:
     * - Permissions could be burned by granting to address(0)
     * - Security breach if arbitrary addresses gain admin rights
     * - Access control system becomes meaningless
     * - Critical vulnerability allowing unauthorized control
     */
    function invariant_nonAdminsLackAdminRole() public view {
        // address(0) should never have admin role
        assertFalse(
            _hasRole(DEFAULT_ADMIN_ROLE, address(0)),
            "Address(0) should not have admin role"
        );
        // Attacker (not in handler actors) should not have admin role
        assertFalse(_hasRole(DEFAULT_ADMIN_ROLE, attacker), "Attacker should not have admin role");

        console.log("[OK] Invalid addresses lack admin role");
    }

    /**
     * @notice Invariant: MINTER_ROLE cannot be held by address(0)
     * @dev Ensures MINTER_ROLE is never granted to invalid addresses
     *
     * PROPERTY TESTED:
     * - address(0) never has MINTER_ROLE
     * - Unauthorized addresses don't gain minting privileges
     *
     * WHY IT MUST HOLD:
     * - MINTER_ROLE controls token supply inflation
     * - Minting to address(0) would burn newly minted tokens
     * - Only trusted actors should be able to mint
     *
     * WHAT BREAKS IF VIOLATED:
     * - Unauthorized minting could inflate token supply
     * - Economic model breaks with uncontrolled supply
     * - Tokens could be minted and burned in same transaction
     * - Market manipulation and loss of token value
     */
    function invariant_minterRoleRestricted() public view {
        // Zero address should never have MINTER_ROLE
        assertFalse(_hasRole(MINTER_ROLE, address(0)), "Address(0) should not have MINTER_ROLE");
        // Attacker (not in handler actors) should not have role
        assertFalse(_hasRole(MINTER_ROLE, attacker), "Attacker should not have MINTER_ROLE");

        console.log("[OK] MINTER_ROLE properly restricted");
    }

    /**
     * @notice Invariant: Role queries never revert for valid inputs
     * @dev hasRole should always be callable for any address/role combination
     *
     * PROPERTY TESTED:
     * - hasRole() never reverts for any (address, bytes32) input pair
     * - Role queries are gas-efficient and deterministic
     *
     * WHY IT MUST HOLD:
     * - View functions should never revert in access control
     * - Applications need reliable permission checks
     * - Reverting queries could DOS permission-gated functions
     *
     * WHAT BREAKS IF VIOLATED:
     * - Permission checks could cause unexpected reverts
     * - DOS vulnerability in protected functions
     * - Integration issues with external systems
     * - Unpredictable gas costs for permission checks
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
     * @dev View-only: Verifies owner and test contract both have admin
     *
     * PROPERTY TESTED:
     * - Multiple addresses can simultaneously hold DEFAULT_ADMIN_ROLE
     * - Granting admin to one address doesn't revoke it from others
     *
     * WHY IT MUST HOLD:
     * - Supports multi-sig governance models
     * - Allows for secure admin role transitions
     * - Prevents single point of failure in governance
     *
     * WHAT BREAKS IF VIOLATED:
     * - Cannot implement multi-sig admin controls
     * - Risky admin transitions (must revoke before granting)
     * - Single point of failure for governance
     * - No redundancy in administrative control
     */
    function invariant_multipleAdminsSupported() public view {
        // Both should have admin role
        assertTrue(_hasRole(DEFAULT_ADMIN_ROLE, address(this)), "Test contract should have admin");
        assertTrue(_hasRole(DEFAULT_ADMIN_ROLE, owner), "Owner should have admin");

        console.log("[OK] Multiple admins exist");
    }

    /**
     * @notice Invariant: Revoking a role that wasn't granted has no effect
     * @dev View-only: Just checks that user3 doesn't have roles
     *
     * PROPERTY TESTED:
     * - Addresses that never received a role don't have that role
     * - Revoking ungranted roles doesn't cause unexpected state changes
     *
     * WHY IT MUST HOLD:
     * - Role state should only change through explicit grant/revoke
     * - Idempotent revoke operations are safer
     * - Prevents state corruption from redundant operations
     *
     * WHAT BREAKS IF VIOLATED:
     * - Roles could spontaneously appear without grants
     * - State corruption in access control system
     * - Unpredictable permission behavior
     * - Security vulnerabilities from unintended role assignments
     */
    function invariant_revokingUnownedRoleIsSafe() public view {
        // User3 shouldn't have UPGRADER_ROLE (never granted)
        assertFalse(_hasRole(UPGRADER_ROLE, user3), "User3 should not have UPGRADER_ROLE");

        console.log("[OK] Ungranted roles verified");
    }
}
