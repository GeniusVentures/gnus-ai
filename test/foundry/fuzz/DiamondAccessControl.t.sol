// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import "../helpers/DiamondDeployment.sol";

/// @title ExampleDiamondAccessControl
/// @notice Fuzzing tests for Diamond access control mechanisms
/// @dev Task 4.5-4.9: Tests role granting, revocation, renunciation, and unauthorized access
contract ExampleDiamondAccessControl is DiamondFuzzBase {
    /// @notice Override to load Diamond from deployment
    function _loadDiamondAddress() internal pure override returns (address) {
        return DiamondDeployment.getDiamondAddress();
    }

    /// @notice Override to load Diamond ABI path from deployment
    function _getDiamondABIPath() internal pure override returns (string memory) {
        return DiamondDeployment.getDiamondABIPath();
    }

    /// @notice Default admin role identifier
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /// @notice Test role identifier for fuzzing
    bytes32 public constant TEST_ROLE = keccak256("TEST_ROLE");

    /// @notice Another test role for multi-role scenarios
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Setup function for access control tests
    function setUp() public override {
        super.setUp();

        address owner = _getDiamondOwner();
        address deployer = DiamondDeployment.getDeployerAddress();

        // If no one has admin role, the Diamond wasn't initialized - initialize it now
        if (!_hasRole(DEFAULT_ADMIN_ROLE, deployer) && !_hasRole(DEFAULT_ADMIN_ROLE, owner)) {
            console.log("Diamond not initialized - calling diamondInitialize000()");
            vm.prank(deployer);
            bytes4 selector = bytes4(keccak256("diamondInitialize000()"));
            (bool success, ) = _callDiamond(selector, "");
            require(success, "Diamond initialization failed");
        }

        // Grant DEFAULT_ADMIN_ROLE to this contract for testing purposes
        address adminAccount = _hasRole(DEFAULT_ADMIN_ROLE, deployer) ? deployer : owner;
        vm.prank(adminAccount);
        _grantRole(DEFAULT_ADMIN_ROLE, address(this));
    }

    /// @notice Fuzz test for granting roles to random addresses
    /// @dev Task 4.6: Tests role granting with random addresses and roles
    /// @param recipient Random address to receive the role
    /// @param roleIndex Index to select which role to grant
    function testFuzz_GrantRole(address recipient, uint8 roleIndex) public {
        // Constrain inputs to valid values
        vm.assume(recipient != address(0));
        vm.assume(recipient != address(this));
        vm.assume(recipient.code.length == 0); // Not a contract

        // Select role based on index
        bytes32 role = roleIndex % 3 == 0 ? TEST_ROLE : roleIndex % 3 == 1
            ? MINTER_ROLE
            : DEFAULT_ADMIN_ROLE;

        // Skip if recipient already has the role (e.g., owner has DEFAULT_ADMIN_ROLE from init)
        if (_hasRole(role, recipient)) {
            return;
        }

        // Verify recipient doesn't have role initially
        assertFalse(_hasRole(role, recipient), "Recipient should not have role initially");

        // Grant role as admin
        vm.prank(_getDiamondOwner());
        _grantRole(role, recipient);

        // Verify recipient now has the role
        assertTrue(_hasRole(role, recipient), "Recipient should have role after granting");

        // Log for debugging
        console.log("Granted role to:", recipient);
        console.log("Role index:", roleIndex);
    }

    /// @notice Fuzz test for revoking roles from random addresses
    /// @dev Task 4.7: Tests role revocation
    /// @param recipient Random address to have role revoked
    /// @param roleIndex Index to select which role to revoke
    function testFuzz_RevokeRole(address recipient, uint8 roleIndex) public {
        // Constrain inputs
        vm.assume(recipient != address(0));
        vm.assume(recipient != address(this));
        vm.assume(recipient != _getDiamondOwner()); // Owner may have superAdmin protection
        vm.assume(recipient != DiamondDeployment.getDeployerAddress()); // Deployer may have superAdmin protection
        vm.assume(recipient.code.length == 0);

        // Select role
        bytes32 role = roleIndex % 2 == 0 ? TEST_ROLE : MINTER_ROLE;

        // First grant the role
        vm.prank(_getDiamondOwner());
        _grantRole(role, recipient);

        // Verify role was granted
        assertTrue(_hasRole(role, recipient), "Role should be granted");

        // Revoke the role
        vm.prank(_getDiamondOwner());
        _revokeRole(role, recipient);

        // Verify role was revoked
        assertFalse(_hasRole(role, recipient), "Role should be revoked");

        console.log("Revoked role from:", recipient);
    }

    /// @notice Fuzz test for role renunciation
    /// @dev Task 4.8: Tests role renunciation (self-revocation)
    /// @param user Random address that will renounce their role
    function testFuzz_RenounceRole(address user) public {
        // Constrain inputs
        vm.assume(user != address(0));
        vm.assume(user != address(this));
        vm.assume(user != _getDiamondOwner()); // Owner may have superAdmin protection
        vm.assume(user != DiamondDeployment.getDeployerAddress()); // Deployer may have superAdmin protection
        vm.assume(user.code.length == 0);

        // Grant TEST_ROLE to user
        vm.prank(_getDiamondOwner());
        _grantRole(TEST_ROLE, user);

        // Verify role was granted
        assertTrue(_hasRole(TEST_ROLE, user), "User should have role");

        // User renounces their own role
        vm.prank(user);
        bytes4 selector = bytes4(keccak256("renounceRole(bytes32,address)"));
        bytes memory data = abi.encode(TEST_ROLE, user);
        (bool success, ) = _callDiamond(selector, data);

        assertTrue(success, "Renounce should succeed");

        // Verify role was renounced
        assertFalse(_hasRole(TEST_ROLE, user), "Role should be renounced");

        console.log("User renounced role:", user);
    }

    /// @notice Fuzz test for unauthorized access attempts
    /// @dev Task 4.9: Tests that unauthorized addresses cannot grant roles
    /// @param unauthorized Random address without admin role
    /// @param recipient Address that unauthorized user tries to grant role to
    function testFuzz_UnauthorizedGrantRole(address unauthorized, address recipient) public {
        // Constrain inputs
        vm.assume(unauthorized != address(0));
        vm.assume(unauthorized != _getDiamondOwner());
        vm.assume(unauthorized != address(this));
        vm.assume(recipient != address(0));
        vm.assume(unauthorized.code.length == 0);

        // Ensure unauthorized doesn't have admin role
        assertFalse(_hasRole(DEFAULT_ADMIN_ROLE, unauthorized), "Unauthorized should not be admin");

        // Attempt to grant role as unauthorized user (should revert)
        vm.prank(unauthorized);
        bytes4 selector = bytes4(keccak256("grantRole(bytes32,address)"));
        bytes memory data = abi.encode(TEST_ROLE, recipient);

        (bool success, ) = _callDiamond(selector, data);

        // Should fail
        assertFalse(success, "Unauthorized grant should fail");

        // Verify role was not granted
        assertFalse(_hasRole(TEST_ROLE, recipient), "Role should not be granted by unauthorized");

        console.log("Unauthorized access denied for:", unauthorized);
    }

    /// @notice Fuzz test for unauthorized revocation attempts
    /// @dev Additional test for unauthorized access patterns
    /// @param unauthorized Random address without admin role
    /// @param victim Address that has a role
    function testFuzz_UnauthorizedRevokeRole(address unauthorized, address victim) public {
        // Constrain inputs
        vm.assume(unauthorized != address(0));
        vm.assume(unauthorized != _getDiamondOwner());
        vm.assume(unauthorized != address(this));
        vm.assume(victim != address(0));
        vm.assume(victim != unauthorized);
        vm.assume(unauthorized.code.length == 0);
        vm.assume(victim.code.length == 0);

        // Grant role to victim
        vm.prank(_getDiamondOwner());
        _grantRole(TEST_ROLE, victim);

        // Verify role was granted
        assertTrue(_hasRole(TEST_ROLE, victim), "Victim should have role");

        // Ensure unauthorized doesn't have admin role
        assertFalse(_hasRole(DEFAULT_ADMIN_ROLE, unauthorized), "Unauthorized should not be admin");

        // Attempt to revoke role as unauthorized user (should fail)
        vm.prank(unauthorized);
        bytes4 selector = bytes4(keccak256("revokeRole(bytes32,address)"));
        bytes memory data = abi.encode(TEST_ROLE, victim);

        (bool success, ) = _callDiamond(selector, data);

        // Should fail
        assertFalse(success, "Unauthorized revoke should fail");

        // Verify role still exists
        assertTrue(_hasRole(TEST_ROLE, victim), "Role should still exist after failed revoke");

        console.log("Unauthorized revocation denied for:", unauthorized);
    }

    /// @notice Fuzz test for multiple role assignments
    /// @dev Tests that an address can have multiple roles simultaneously
    /// @param user Random address to receive multiple roles
    function testFuzz_MultipleRoles(address user) public {
        // Constrain inputs
        vm.assume(user != address(0));
        vm.assume(user != address(this));
        vm.assume(user != _getDiamondOwner()); // Owner may have superAdmin protection
        vm.assume(user != DiamondDeployment.getDeployerAddress()); // Deployer may have superAdmin protection
        vm.assume(user.code.length == 0);

        // Grant multiple roles
        vm.startPrank(_getDiamondOwner());
        _grantRole(TEST_ROLE, user);
        _grantRole(MINTER_ROLE, user);
        vm.stopPrank();

        // Verify both roles exist
        assertTrue(_hasRole(TEST_ROLE, user), "User should have TEST_ROLE");
        assertTrue(_hasRole(MINTER_ROLE, user), "User should have MINTER_ROLE");

        // Revoke one role
        vm.prank(_getDiamondOwner());
        _revokeRole(TEST_ROLE, user);

        // Verify only one role was revoked
        assertFalse(_hasRole(TEST_ROLE, user), "TEST_ROLE should be revoked");
        assertTrue(_hasRole(MINTER_ROLE, user), "MINTER_ROLE should still exist");

        console.log("Multiple roles tested for:", user);
    }
}
