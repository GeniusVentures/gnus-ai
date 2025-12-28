// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title AccessControlFuzz
 * @notice Fuzz tests for role-based access control
 * @dev Tests role granting, revoking, and permission checks with randomized inputs
 */
contract AccessControlFuzz is GeniusDiamondTestBase {
    /**
     * @notice Setup for access control fuzz tests
     */
    function setUp() public override {
        super.setUp();

        console.log("===== Access Control Fuzz Tests =====");
        console.log("Diamond:", diamond);
        console.log("Owner:", owner);
        console.log("Admin (test contract):", address(this));
        console.log("=====================================");
    }

    /**
     * @notice Fuzz test: Grant role to random addresses
     * @dev Tests that admin can grant any role to any valid address
     * @param account Random address to grant role to
     * @param roleSeed Seed to select a role
     */
    function testFuzz_grantRole(address account, uint256 roleSeed) public {
        account = _boundAddress(account);

        // Select a role based on seed
        bytes32 role = _selectRole(roleSeed);

        // Grant the role as admin
        _grantRole(role, account);

        // Verify role was granted
        assertTrue(_hasRole(role, account), "Role should be granted");

        console.log("[OK] Granted role to:", account);
    }

    /**
     * @notice Fuzz test: Revoke role from random addresses
     * @dev Tests that admin can revoke roles
     * @param account Random address to revoke role from
     * @param roleSeed Seed to select a role
     */
    function testFuzz_revokeRole(address account, uint256 roleSeed) public {
        account = _boundAddress(account);
        bytes32 role = _selectRole(roleSeed);

        // Grant role first
        _grantRole(role, account);
        assertTrue(_hasRole(role, account), "Role should be granted initially");

        // Revoke the role
        _revokeRole(role, account);

        // Verify role was revoked
        assertFalse(_hasRole(role, account), "Role should be revoked");

        console.log("[OK] Revoked role from:", account);
    }

    /**
     * @notice Fuzz test: Renounce role
     * @dev Tests that accounts can renounce their own roles
     * @param account Random address to renounce role
     * @param roleSeed Seed to select a role
     */
    function testFuzz_renounceRole(address account, uint256 roleSeed) public {
        account = _boundAddress(account);
        bytes32 role = _selectRole(roleSeed);

        // Skip DEFAULT_ADMIN_ROLE for test contract
        if (account == address(this) && role == DEFAULT_ADMIN_ROLE) {
            return;
        }

        // Grant role first
        _grantRole(role, account);
        assertTrue(_hasRole(role, account), "Role should be granted");

        // Renounce role as the account holder
        bytes4 selector = bytes4(keccak256("renounceRole(bytes32,address)"));
        bytes memory data = abi.encode(role, account);

        vm.prank(account);
        (bool success, ) = _callDiamond(selector, data);
        assertTrue(success, "Renounce should succeed");

        // Verify role was renounced
        assertFalse(_hasRole(role, account), "Role should be renounced");

        console.log("[OK] Role renounced by:", account);
    }

    /**
     * @notice Fuzz test: Unauthorized address cannot grant roles
     * @dev Tests access control on grantRole function
     * @param unauthorizedCaller Random unauthorized address
     * @param target Random target address
     * @param roleSeed Seed to select a role
     */
    function testFuzz_RevertWhen_unauthorizedGrantRole(
        address unauthorizedCaller,
        address target,
        uint256 roleSeed
    ) public {
        unauthorizedCaller = _boundAddress(unauthorizedCaller);
        target = _boundAddress(target);

        // Ensure caller doesn't have admin role
        vm.assume(!_hasRole(DEFAULT_ADMIN_ROLE, unauthorizedCaller));

        bytes32 role = _selectRole(roleSeed);

        // Try to grant role as unauthorized caller
        bytes4 selector = bytes4(keccak256("grantRole(bytes32,address)"));
        bytes memory data = abi.encode(role, target);

        vm.prank(unauthorizedCaller);
        (bool success, ) = _callDiamond(selector, data);

        // Should fail
        assertFalse(success, "Unauthorized grant should fail");

        // Target should not have role
        assertFalse(_hasRole(role, target), "Role should not be granted");

        console.log("[OK] Unauthorized caller blocked:", unauthorizedCaller);
    }

    /**
     * @notice Fuzz test: Unauthorized address cannot revoke roles
     * @dev Tests access control on revokeRole function
     * @param unauthorizedCaller Random unauthorized address
     * @param target Random target address
     * @param roleSeed Seed to select a role
     */
    function testFuzz_RevertWhen_unauthorizedRevokeRole(
        address unauthorizedCaller,
        address target,
        uint256 roleSeed
    ) public {
        unauthorizedCaller = _boundAddress(unauthorizedCaller);
        target = _boundAddress(target);

        // Ensure caller doesn't have admin role
        vm.assume(!_hasRole(DEFAULT_ADMIN_ROLE, unauthorizedCaller));

        bytes32 role = _selectRole(roleSeed);

        // Grant role first as admin
        _grantRole(role, target);
        assertTrue(_hasRole(role, target), "Role should be granted");

        // Try to revoke as unauthorized caller
        bytes4 selector = bytes4(keccak256("revokeRole(bytes32,address)"));
        bytes memory data = abi.encode(role, target);

        vm.prank(unauthorizedCaller);
        (bool success, ) = _callDiamond(selector, data);

        // Should fail
        assertFalse(success, "Unauthorized revoke should fail");

        // Target should still have role
        assertTrue(_hasRole(role, target), "Role should not be revoked");

        console.log("[OK] Unauthorized revoke blocked");
    }

    /**
     * @notice Fuzz test: Role-protected functions reject callers without role
     * @dev Tests that MINTER_ROLE is required for minting
     * @param caller Random address attempting to mint
     */
    function testFuzz_roleProtectedFunctions(address caller) public {
        caller = _boundAddress(caller);

        // Ensure caller doesn't have MINTER_ROLE
        if (_hasRole(MINTER_ROLE, caller)) {
            _revokeRole(MINTER_ROLE, caller);
        }
        assertFalse(_hasRole(MINTER_ROLE, caller), "Caller should not have MINTER_ROLE");

        // Try to mint as caller without role
        bytes4 selector = bytes4(keccak256("mint(address,uint256,uint256,bytes)"));
        bytes memory data = abi.encode(caller, GNUS_TOKEN_ID, 1000 ether, "");

        vm.prank(caller);
        (bool success, ) = _callDiamond(selector, data);

        // Should fail
        assertFalse(success, "Mint without MINTER_ROLE should fail");

        console.log("[OK] Role-protected function blocked caller:", caller);
    }

    /**
     * @notice Fuzz test: hasRole consistency across multiple calls
     * @dev Ensures role state doesn't change between queries
     * @param account Random address to check
     * @param roleSeed Seed to select a role
     */
    function testFuzz_hasRoleConsistency(address account, uint256 roleSeed) public {
        account = _boundAddress(account);
        bytes32 role = _selectRole(roleSeed);

        // Grant role
        _grantRole(role, account);

        // Check multiple times
        bool check1 = _hasRole(role, account);
        bool check2 = _hasRole(role, account);
        bool check3 = _hasRole(role, account);

        // All should return true
        assertTrue(check1, "First check should be true");
        assertEq(check1, check2, "Results should be consistent");
        assertEq(check2, check3, "Results should be consistent");

        console.log("[OK] hasRole is consistent");
    }

    /**
     * @notice Fuzz test: Grant and revoke cycles maintain consistency
     * @dev Tests repeated grant/revoke operations
     * @param account Random address
     * @param roleSeed Seed to select a role
     * @param cycles Number of grant/revoke cycles
     */
    function testFuzz_grantRevokeCycles(address account, uint256 roleSeed, uint256 cycles) public {
        account = _boundAddress(account);
        bytes32 role = _selectRole(roleSeed);
        cycles = _boundUint256(cycles, 1, 10); // Limit to 10 cycles

        for (uint256 i = 0; i < cycles; i++) {
            // Grant
            _grantRole(role, account);
            assertTrue(_hasRole(role, account), "Should have role after grant");

            // Revoke
            _revokeRole(role, account);
            assertFalse(_hasRole(role, account), "Should not have role after revoke");
        }

        console.log("[OK] Grant/revoke cycles completed:", cycles);
    }

    /**
     * @notice Fuzz test: Role admin hierarchy
     * @dev Tests that admin role can manage other roles
     * @param newAdmin Random address to become admin
     * @param targetUser Random target user
     * @param roleSeed Seed to select a role
     */
    function testFuzz_roleAdminHierarchy(
        address newAdmin,
        address targetUser,
        uint256 roleSeed
    ) public {
        newAdmin = _boundAddress(newAdmin);
        targetUser = _boundAddress(targetUser);
        vm.assume(newAdmin != targetUser);

        bytes32 role = _selectRole(roleSeed);

        // Grant admin role to newAdmin
        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        assertTrue(_hasRole(DEFAULT_ADMIN_ROLE, newAdmin), "Should have admin role");

        // newAdmin should be able to grant roles
        vm.prank(newAdmin);
        _grantRole(role, targetUser);

        // Verify role was granted
        assertTrue(_hasRole(role, targetUser), "Role should be granted by new admin");

        // Clean up
        vm.prank(newAdmin);
        _revokeRole(role, targetUser);
        _revokeRole(DEFAULT_ADMIN_ROLE, newAdmin);

        console.log("[OK] Admin hierarchy works correctly");
    }

    /**
     * @notice Fuzz test: Multiple roles per address
     * @dev Tests that one address can have multiple roles
     * @param account Random address
     */
    function testFuzz_multipleRolesPerAddress(address account) public {
        account = _boundAddress(account);

        // Grant multiple roles
        _grantRole(MINTER_ROLE, account);
        _grantRole(PAUSER_ROLE, account);
        _grantRole(UPGRADER_ROLE, account);

        // Verify all roles
        assertTrue(_hasRole(MINTER_ROLE, account), "Should have MINTER_ROLE");
        assertTrue(_hasRole(PAUSER_ROLE, account), "Should have PAUSER_ROLE");
        assertTrue(_hasRole(UPGRADER_ROLE, account), "Should have UPGRADER_ROLE");

        // Revoke one role
        _revokeRole(PAUSER_ROLE, account);

        // Others should remain
        assertTrue(_hasRole(MINTER_ROLE, account), "Should still have MINTER_ROLE");
        assertFalse(_hasRole(PAUSER_ROLE, account), "Should not have PAUSER_ROLE");
        assertTrue(_hasRole(UPGRADER_ROLE, account), "Should still have UPGRADER_ROLE");

        console.log("[OK] Multiple roles per address work");
    }

    // ========================================
    // Helper Functions
    // ========================================

    /**
     * @notice Select a role based on seed
     * @param seed Random seed
     * @return role Selected role
     */
    function _selectRole(uint256 seed) internal pure returns (bytes32 role) {
        uint256 roleIndex = seed % 4;

        if (roleIndex == 0) return bytes32(0); // DEFAULT_ADMIN_ROLE
        if (roleIndex == 1) return keccak256("MINTER_ROLE");
        if (roleIndex == 2) return keccak256("PAUSER_ROLE");
        return keccak256("UPGRADER_ROLE");
    }
}
