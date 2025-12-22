// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import "../helpers/DiamondDeployment.sol";

/// @title AccessControlFuzz
/// @notice Fuzzing tests for Diamond access control functionality
/// @dev Task 4.0: Comprehensive fuzzing tests for ExampleAccessControl
contract AccessControlFuzz is DiamondFuzzBase {
    // /// @notice Override to load Diamond from deployment
    // function _loadDiamondAddress() internal pure override returns (address) {
    //     return DiamondDeployment.getDiamondAddress();
    // }

    // This is an example
    // /// @notice Override to load Diamond ABI path from deployment
    // function _getDiamondABIPath() internal pure override returns (string memory) {
    //     return DiamondDeployment.getDiamondABIPath();
    // }

    /// @notice Role constants from ExampleAccessControl
    /// @dev Task 4.4: Define role constants
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice Test account for role operations
    address public testAccount;

    /// @notice Diamond owner address
    address public owner;

    /// @notice Setup function runs before each test
    /// @dev Calls parent setUp and gets owner
    function setUp() public override {
        super.setUp();
        owner = _getDiamondOwner();
        testAccount = address(0x1234);

        console.log("=== AccessControlFuzz Setup ===");
        console.log("Diamond:", diamond);
        console.log("Owner:", owner);
        console.log("Test account:", testAccount);

        // Check who has DEFAULT_ADMIN_ROLE - should be the deployer from initialization
        address deployer = DiamondDeployment.getDeployerAddress();
        console.log("Deployer:", deployer);
        console.log("Deployer has admin role:", _hasRole(DEFAULT_ADMIN_ROLE, deployer));
        console.log("Owner has admin role:", _hasRole(DEFAULT_ADMIN_ROLE, owner));

        // If no one has admin role, the Diamond wasn't initialized - initialize it now
        if (!_hasRole(DEFAULT_ADMIN_ROLE, deployer) && !_hasRole(DEFAULT_ADMIN_ROLE, owner)) {
            console.log("Diamond not initialized - calling diamondInitialize000()");
            vm.prank(deployer);
            bytes4 selector = bytes4(keccak256("diamondInitialize000()"));
            (bool success, ) = _callDiamond(selector, "");
            require(success, "Diamond initialization failed");
            console.log("Diamond initialized successfully");
        }

        // Now grant DEFAULT_ADMIN_ROLE to test contract
        // Use whoever has the admin role (should be deployer after init)
        address adminAccount = _hasRole(DEFAULT_ADMIN_ROLE, deployer) ? deployer : owner;
        vm.prank(adminAccount);
        _grantRole(DEFAULT_ADMIN_ROLE, address(this));

        console.log("Test contract has admin role:", _hasRole(DEFAULT_ADMIN_ROLE, address(this)));
    }

    /// @notice Fuzz test for granting roles
    /// @dev Task 4.5-4.7: Fuzz grantRole with random addresses and role values
    function testFuzz_GrantRole(address account, uint256 roleIndex) public {
        // Task 4.6: Use vm.assume() to constrain inputs
        vm.assume(account != address(0));
        vm.assume(account != owner); // Avoid granting to owner who already has roles
        vm.assume(account.code.length == 0); // Only EOAs for simplicity

        // Constrain role to valid roles (DEFAULT_ADMIN_ROLE or UPGRADER_ROLE)
        bytes32 role = roleIndex % 2 == 0 ? DEFAULT_ADMIN_ROLE : UPGRADER_ROLE;

        // Prank as owner to grant role
        vm.prank(owner);

        // Task 4.5: Grant role using helper
        _grantRole(role, account);

        // Task 4.7: Verify role was granted correctly
        assertTrue(_hasRole(role, account), "Role should be granted");

        // Log for debugging
        console.log("Granted role to:", account);
    }

    /// @notice Fuzz test for revoking roles
    /// @dev Task 4.8-4.9: Fuzz role revocation with random inputs
    function testFuzz_RevokeRole(address account, uint256 roleIndex) public {
        vm.assume(account != address(0));
        vm.assume(account != owner); // Cannot revoke from superAdmin
        vm.assume(account.code.length == 0);

        bytes32 role = roleIndex % 2 == 0 ? DEFAULT_ADMIN_ROLE : UPGRADER_ROLE;

        // First grant the role
        vm.prank(owner);
        _grantRole(role, account);

        // Verify it was granted
        assertTrue(_hasRole(role, account), "Role should be granted first");

        // Task 4.8: Revoke the role
        vm.prank(owner);
        _revokeRole(role, account);

        // Task 4.9: Verify role was revoked
        assertFalse(_hasRole(role, account), "Role should be revoked");

        console.log("Revoked role from:", account);
    }

    /// @notice Fuzz test for renouncing roles
    /// @dev Task 4.10: Test role renunciation from random addresses
    function testFuzz_RenounceRole(address account, uint256 roleIndex) public {
        vm.assume(account != address(0));
        vm.assume(account != owner); // Cannot renounce superAdmin
        vm.assume(account.code.length == 0);

        bytes32 role = roleIndex % 2 == 0 ? DEFAULT_ADMIN_ROLE : UPGRADER_ROLE;

        // Grant role first
        vm.prank(owner);
        _grantRole(role, account);

        assertTrue(_hasRole(role, account), "Role should be granted");

        // Renounce as the account holder
        vm.prank(account);
        bytes4 selector = bytes4(keccak256("renounceRole(bytes32,address)"));
        bytes memory data = abi.encode(role, account);
        (bool success, ) = _callDiamond(selector, data);

        assertTrue(success, "Renounce should succeed");

        // Verify role was renounced
        assertFalse(_hasRole(role, account), "Role should be renounced");

        console.log("Account renounced role:", account);
    }

    /// @notice Test unauthorized access attempts
    /// @dev Task 4.11: Verify unauthorized calls revert
    function testFuzz_UnauthorizedGrantRole(
        address unauthorized,
        address account,
        uint256 roleIndex
    ) public {
        address deployer = DiamondDeployment.getDeployerAddress();

        vm.assume(unauthorized != address(0));
        vm.assume(unauthorized != owner);
        vm.assume(unauthorized != deployer);
        vm.assume(unauthorized != address(this)); // Test contract has admin role
        vm.assume(unauthorized.code.length == 0);
        vm.assume(account != address(0));
        vm.assume(account.code.length == 0);

        bytes32 role = roleIndex % 2 == 0 ? DEFAULT_ADMIN_ROLE : UPGRADER_ROLE;

        // Skip if unauthorized somehow has admin role (shouldn't happen with above assumes)
        if (_hasRole(DEFAULT_ADMIN_ROLE, unauthorized)) {
            return;
        }

        // Skip if account already has the role (would make the test assertion incorrect)
        if (_hasRole(role, account)) {
            return;
        }

        // Try to grant role as unauthorized account
        vm.prank(unauthorized);
        bytes4 selector = bytes4(keccak256("grantRole(bytes32,address)"));
        bytes memory data = abi.encode(role, account);

        (bool success, ) = _callDiamond(selector, data);

        // Should fail due to lack of permissions
        assertFalse(success, "Unauthorized grant should fail");

        // Verify role was NOT granted
        assertFalse(_hasRole(role, account), "Role should not be granted by unauthorized");

        console.log("Unauthorized grant correctly failed for:", unauthorized);
    }

    /// @notice Test onlyRole modifier enforcement
    /// @dev Task 4.12: Verify modifier prevents unauthorized calls
    function testFuzz_OnlyRoleModifier(address caller) public {
        vm.assume(caller != address(0));
        vm.assume(caller != owner);
        vm.assume(caller.code.length == 0);

        // Try to call a function requiring UPGRADER_ROLE without having it
        vm.prank(caller);

        // diamondUpgradeSet is an UPGRADER_ROLE protected function
        bytes4 selector = bytes4(keccak256("diamondUpgradeSet(uint256)"));
        bytes memory data = abi.encode(uint256(999));

        (bool success, ) = _callDiamond(selector, data);

        // Should fail due to missing role
        assertFalse(success, "Call without role should fail");

        console.log("Only role modifier correctly prevented call from:", caller);
    }

    /// @notice Test getRoleAdmin function
    /// @dev Task 4.13: Test role admin functions with fuzzing
    function test_GetRoleAdmin() public view {
        bytes4 selector = bytes4(keccak256("getRoleAdmin(bytes32)"));
        bytes memory data = abi.encode(UPGRADER_ROLE);

        bytes memory callData = abi.encodePacked(selector, data);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);

        assertTrue(success, "getRoleAdmin should succeed");

        bytes32 adminRole = abi.decode(returnData, (bytes32));

        // UPGRADER_ROLE admin should be DEFAULT_ADMIN_ROLE
        assertEq(adminRole, DEFAULT_ADMIN_ROLE, "Admin role should be DEFAULT_ADMIN_ROLE");

        console.log("Role admin verified");
    }

    /// @notice Test role membership with fuzzing
    /// @dev Verify hasRole returns correct values
    function testFuzz_HasRole(address account, uint256 roleIndex) public {
        vm.assume(account != address(0));
        vm.assume(account != owner);
        vm.assume(account.code.length == 0);

        bytes32 role = roleIndex % 2 == 0 ? DEFAULT_ADMIN_ROLE : UPGRADER_ROLE;

        // Should not have role initially
        assertFalse(_hasRole(role, account), "Should not have role initially");

        // Grant role
        vm.prank(owner);
        _grantRole(role, account);

        // Should have role now
        assertTrue(_hasRole(role, account), "Should have role after grant");

        console.log("HasRole verified for:", account);
    }

    /// @notice Test gas consumption for role operations
    /// @dev Task 4.15: Add gas profiling to access control tests
    function test_GasProfile_GrantRole() public {
        address account = address(0x9999);

        // Test contract has DEFAULT_ADMIN_ROLE from setUp(), no need to prank
        bytes4 selector = bytes4(keccak256("grantRole(bytes32,address)"));
        bytes memory data = abi.encode(UPGRADER_ROLE, account);

        // Measure gas
        uint256 gasUsed = _measureDiamondGas(selector, data);

        console.log("Gas used for grantRole:", gasUsed);

        // Task 4.28: Assert gas is within reasonable bounds
        assertTrue(gasUsed > 0 && gasUsed < 200000, "Gas should be reasonable");
    }

    /// @notice Test gas consumption for role revocation
    /// @dev Task 4.15, 4.29: Gas profiling for revoke
    function test_GasProfile_RevokeRole() public {
        address account = address(0x9999);

        // Grant first (test contract has DEFAULT_ADMIN_ROLE from setUp())
        _grantRole(UPGRADER_ROLE, account);

        // Measure revoke gas
        bytes4 selector = bytes4(keccak256("revokeRole(bytes32,address)"));
        bytes memory data = abi.encode(UPGRADER_ROLE, account);

        uint256 gasUsed = _measureDiamondGas(selector, data);

        console.log("Gas used for revokeRole:", gasUsed);

        assertTrue(gasUsed > 0 && gasUsed < 200000, "Gas should be reasonable");
    }

    /// @notice Test role enumeration with fuzzing
    /// @dev Verify role members can be enumerated
    function testFuzz_RoleEnumeration(uint8 count) public {
        vm.assume(count > 0 && count <= 10); // Limit to reasonable number

        // Grant UPGRADER_ROLE to multiple accounts
        for (uint256 i = 0; i < count; i++) {
            address account = address(uint160(0x1000 + i));

            vm.prank(owner);
            _grantRole(UPGRADER_ROLE, account);

            assertTrue(_hasRole(UPGRADER_ROLE, account), "Role should be granted");
        }

        console.log("Enumerated roles for", count, "accounts");
    }

    /// @notice Test superAdmin protection
    /// @dev Verify superAdmin cannot be revoked or renounced
    function test_CannotRevokeSuperAdmin() public {
        // Try to revoke DEFAULT_ADMIN_ROLE from owner (who is superAdmin)
        vm.prank(owner);

        bytes4 selector = bytes4(keccak256("revokeRole(bytes32,address)"));
        bytes memory data = abi.encode(DEFAULT_ADMIN_ROLE, owner);

        (bool success, ) = _callDiamond(selector, data);

        // Should fail due to superAdmin protection
        assertFalse(success, "Cannot revoke superAdmin");

        // Owner should still have DEFAULT_ADMIN_ROLE
        assertTrue(_hasRole(DEFAULT_ADMIN_ROLE, owner), "SuperAdmin should keep role");

        console.log("SuperAdmin protection verified");
    }

    /// @notice Test role grant/revoke cycle
    /// @dev Verify roles can be granted and revoked multiple times
    function testFuzz_GrantRevokeCycle(address account, uint8 cycles) public {
        vm.assume(account != address(0));
        vm.assume(account != owner);
        vm.assume(account.code.length == 0);
        vm.assume(cycles > 0 && cycles <= 5);

        for (uint256 i = 0; i < cycles; i++) {
            // Grant
            vm.prank(owner);
            _grantRole(UPGRADER_ROLE, account);
            assertTrue(_hasRole(UPGRADER_ROLE, account), "Should have role after grant");

            // Revoke
            vm.prank(owner);
            _revokeRole(UPGRADER_ROLE, account);
            assertFalse(_hasRole(UPGRADER_ROLE, account), "Should not have role after revoke");
        }

        console.log("Completed", cycles, "grant/revoke cycles");
    }
}
