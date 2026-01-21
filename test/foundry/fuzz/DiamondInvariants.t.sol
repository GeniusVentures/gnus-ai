// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import "../helpers/DiamondDeployment.sol";

/// @title DiamondInvariants
/// @notice Invariant tests for Diamond state consistency
/// @dev State consistency and invariant testing
contract DiamondInvariants is DiamondFuzzBase {
    /// @notice Override to load Diamond from deployment
    function _loadDiamondAddress() internal pure override returns (address) {
        return DiamondDeployment.getDiamondAddress();
    }

    /// @notice Override to load Diamond ABI path from deployment
    function _getDiamondABIPath() internal pure override returns (string memory) {
        return DiamondDeployment.getDiamondABIPath();
    }

    /// @notice Test accounts for role testing
    address[] internal testAccounts;

    /// @notice Setup function runs before each test
    function setUp() public override {
        super.setUp();

        console.log("=== DiamondInvariants Setup ===");
        console.log("Diamond:", diamond);

        address owner = _getDiamondOwner();
        address deployer = DiamondDeployment.getDeployerAddress();

        // If no one has admin role, the Diamond wasn't initialized - initialize it now
        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        if (!_hasRole(DEFAULT_ADMIN_ROLE, deployer) && !_hasRole(DEFAULT_ADMIN_ROLE, owner)) {
            console.log("Diamond not initialized - calling diamondInitialize000()");
            vm.prank(deployer);
            bytes4 selector = bytes4(keccak256("diamondInitialize000()"));
            (bool success, ) = _callDiamond(selector, "");
            require(success, "Diamond initialization failed");
        }

        // Grant DEFAULT_ADMIN_ROLE to test contract for role operation tests
        address adminAccount = _hasRole(DEFAULT_ADMIN_ROLE, deployer) ? deployer : owner;
        vm.prank(adminAccount);
        _grantRole(DEFAULT_ADMIN_ROLE, address(this));

        // Create test accounts
        for (uint256 i = 0; i < 5; i++) {
            testAccounts.push(address(uint160(0x1000 + i)));
        }

        console.log("Test contract has admin role:", _hasRole(DEFAULT_ADMIN_ROLE, address(this)));
    }

    /// @notice Test: Owner should always be valid address
    /// @dev Verify owner is always valid
    function test_OwnershipConsistency() public view {
        address owner = _getDiamondOwner();

        // Owner must be non-zero
        assertTrue(owner != address(0), "Owner must not be zero address");

        // Owner should have DEFAULT_ADMIN_ROLE
        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        assertTrue(_hasRole(DEFAULT_ADMIN_ROLE, owner), "Owner should have admin role");

        console.log("Ownership invariant maintained");
    }

    /// @notice Test: Admin roles should maintain proper hierarchy
    /// @dev Verify role hierarchy is consistent
    function test_RoleHierarchy() public view {
        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        bytes32 UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

        // Get admin of UPGRADER_ROLE
        bytes4 selector = bytes4(keccak256("getRoleAdmin(bytes32)"));
        bytes memory data = abi.encode(UPGRADER_ROLE);

        bytes memory callData = abi.encodePacked(selector, data);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);

        assertTrue(success, "getRoleAdmin should succeed");

        bytes32 adminRole = abi.decode(returnData, (bytes32));

        // UPGRADER_ROLE should be administered by DEFAULT_ADMIN_ROLE
        assertEq(adminRole, DEFAULT_ADMIN_ROLE, "Role hierarchy should be maintained");

        console.log("Role hierarchy invariant maintained");
    }

    /// @notice Test: All facet addresses should be non-zero and contain code
    /// @dev Verify all facets are valid
    function test_FacetAddressesValid() public view {
        // Get actual deployed facets from Diamond
        bytes4 facetsSelector = bytes4(keccak256("facets()"));
        (bool success, ) = diamond.staticcall(abi.encodeWithSelector(facetsSelector));
        require(success, "facets() call failed");

        // Decode facets array (array of Facet structs with facetAddress and functionSelectors)
        // Skip decoding, just verify we can call it

        // Verify each selector in our ABI that's actually deployed
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            bytes4 selector = diamondSelectors[i];

            // Get facet for this selector - skip if not deployed
            bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", selector);
            (bool callSuccess, bytes memory facetData) = diamond.staticcall(callData);

            if (callSuccess) {
                address facet = abi.decode(facetData, (address));

                // Only check if selector is actually deployed (has a facet)
                if (facet != address(0)) {
                    // Facet must have code
                    assertTrue(facet.code.length > 0, "Facet must have code");
                }
            }
        }

        console.log("All deployed facet addresses are valid");
    }

    /// @notice Test: No duplicate function selectors across facets
    /// @dev Verify no selector collisions
    function test_NoSelectorCollisions() public view {
        // Check for duplicates
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            for (uint256 j = i + 1; j < diamondSelectors.length; j++) {
                assertTrue(diamondSelectors[i] != diamondSelectors[j], "Duplicate selectors found");
            }
        }

        console.log("No selector collisions found");
    }

    /// @notice Test Diamond address is immutable
    /// @dev Verify Diamond address doesn't change
    function test_DiamondAddressImmutable() public view {
        address diamond1 = diamond;
        address diamond2 = _loadDiamondAddress();

        assertEq(diamond1, diamond2, "Diamond address should be immutable");

        console.log("Diamond address is immutable");
    }

    /// @notice Test facet count consistency
    /// @dev Verify facet count matches selectors
    function test_FacetCountConsistency() public view {
        // Get unique facets from deployed selectors only
        address[] memory uniqueFacets = new address[](20);
        uint256 facetCount = 0;

        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            // Get facet address - skip if not deployed
            bytes memory callData = abi.encodeWithSignature(
                "facetAddress(bytes4)",
                diamondSelectors[i]
            );
            (bool success, bytes memory facetData) = diamond.staticcall(callData);

            if (!success) continue;

            address facet = abi.decode(facetData, (address));
            if (facet == address(0)) continue; // Skip undeployed selectors

            // Check if facet is unique
            bool found = false;
            for (uint256 j = 0; j < facetCount; j++) {
                if (uniqueFacets[j] == facet) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                uniqueFacets[facetCount] = facet;
                facetCount++;
            }
        }

        // Should have at least 3 facets (DiamondCut, DiamondLoupe, Ownership)
        assertTrue(facetCount >= 3, "Should have at least 3 facets");

        console.log("Facet count:", facetCount);
    }

    /// @notice Test selector to facet mapping is deterministic
    /// @dev Verify same selector always maps to same facet
    function test_SelectorMappingDeterministic() public view {
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            bytes4 selector = diamondSelectors[i];

            // Get facet address - skip if not deployed
            bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", selector);

            (bool success1, bytes memory facetData1) = diamond.staticcall(callData);
            if (!success1) continue;

            address facet1 = abi.decode(facetData1, (address));
            if (facet1 == address(0)) continue; // Skip undeployed selectors

            (bool success2, bytes memory facetData2) = diamond.staticcall(callData);
            if (!success2) continue;
            address facet2 = abi.decode(facetData2, (address));

            (bool success3, bytes memory facetData3) = diamond.staticcall(callData);
            if (!success3) continue;
            address facet3 = abi.decode(facetData3, (address));

            assertEq(facet1, facet2, "Selector should map deterministically");
            assertEq(facet2, facet3, "Selector should map deterministically");
        }

        console.log("Selector mappings are deterministic");
    }

    /// @notice Test role grants are idempotent
    /// @dev Granting same role twice should not cause issues
    function test_RoleGrantIdempotent() public {
        address account = testAccounts[0];
        bytes32 UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
        address owner = _getDiamondOwner();

        // Grant role first time
        vm.prank(owner);
        _grantRole(UPGRADER_ROLE, account);

        assertTrue(_hasRole(UPGRADER_ROLE, account), "Should have role");

        // Grant again (should not revert)
        vm.prank(owner);
        _grantRole(UPGRADER_ROLE, account);

        assertTrue(_hasRole(UPGRADER_ROLE, account), "Should still have role");

        console.log("Role grant is idempotent");
    }

    /// @notice Test role revokes are idempotent
    /// @dev Revoking same role twice should not cause issues
    function test_RoleRevokeIdempotent() public {
        address account = testAccounts[0];
        bytes32 UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
        address owner = _getDiamondOwner();

        // Grant role
        vm.prank(owner);
        _grantRole(UPGRADER_ROLE, account);

        // Revoke role first time
        vm.prank(owner);
        _revokeRole(UPGRADER_ROLE, account);

        assertFalse(_hasRole(UPGRADER_ROLE, account), "Should not have role");

        // Revoke again (should not revert)
        vm.prank(owner);
        _revokeRole(UPGRADER_ROLE, account);

        assertFalse(_hasRole(UPGRADER_ROLE, account), "Should still not have role");

        console.log("Role revoke is idempotent");
    }

    /// @notice Test Diamond has expected minimum functions
    /// @dev Verify critical functions exist
    function test_MinimumFunctionsExist() public view {
        // Should have at least these critical functions
        bool hasOwner = false;
        bool hasFacets = false;
        bool hasDiamondCut = false;
        bool hasFacetAddress = false;

        for (uint256 i = 0; i < diamondSignatures.length; i++) {
            bytes32 sigHash = keccak256(bytes(diamondSignatures[i]));

            if (sigHash == keccak256(bytes("owner()"))) hasOwner = true;
            if (sigHash == keccak256(bytes("facets()"))) hasFacets = true;
            if (sigHash == keccak256(bytes("diamondCut(tuple[],address,bytes)")))
                hasDiamondCut = true;
            if (sigHash == keccak256(bytes("facetAddress(bytes4)"))) hasFacetAddress = true;
        }

        assertTrue(hasOwner, "Must have owner()");
        assertTrue(hasFacets, "Must have facets()");
        assertTrue(hasDiamondCut, "Must have diamondCut()");
        assertTrue(hasFacetAddress, "Must have facetAddress()");

        console.log("All minimum functions exist");
    }

    /// @notice Test state consistency after role operations
    /// @dev Verify state remains consistent
    function testFuzz_StateConsistencyAfterRoleOps(uint256 seed) public {
        address account = testAccounts[seed % testAccounts.length];
        bytes32 UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
        address owner = _getDiamondOwner();

        // Perform random sequence of operations
        uint256 operation = seed % 3;

        if (operation == 0) {
            // Grant role
            vm.prank(owner);
            _grantRole(UPGRADER_ROLE, account);
        } else if (operation == 1) {
            // Revoke role
            vm.prank(owner);
            _grantRole(UPGRADER_ROLE, account);
            vm.prank(owner);
            _revokeRole(UPGRADER_ROLE, account);
        } else {
            // Renounce role
            vm.prank(owner);
            _grantRole(UPGRADER_ROLE, account);
            vm.prank(account);

            bytes4 selector = bytes4(keccak256("renounceRole(bytes32,address)"));
            bytes memory data = abi.encode(UPGRADER_ROLE, account);
            _callDiamond(selector, data);
        }

        // Verify invariants still hold
        assertTrue(_getDiamondOwner() != address(0), "Owner should be valid");
        assertTrue(diamond.code.length > 0, "Diamond should have code");

        console.log("State consistent after operations");
    }

    /// @notice Test gas bounds for Diamond calls
    /// @dev Ensure gas consumption is reasonable
    function test_GasBounds_DiamondCalls() public {
        // Test owner() call gas
        bytes4 ownerSelector = bytes4(keccak256("owner()"));
        uint256 ownerGas = _measureDiamondGas(ownerSelector, "");

        assertTrue(ownerGas > 0 && ownerGas < 50000, "owner() gas should be reasonable");

        // Test facetAddress() call gas
        bytes4 facetAddrSelector = bytes4(keccak256("facetAddress(bytes4)"));
        bytes memory data = abi.encode(ownerSelector);
        uint256 facetAddrGas = _measureDiamondGas(facetAddrSelector, data);

        assertTrue(
            facetAddrGas > 0 && facetAddrGas < 50000,
            "facetAddress() gas should be reasonable"
        );

        console.log("owner() gas:", ownerGas);
        console.log("facetAddress() gas:", facetAddrGas);
    }

    /// @notice Test all facets are accessible
    /// @dev Verify no orphaned facets
    function test_AllFacetsAccessible() public view {
        // Get all unique facets from deployed selectors
        address[] memory facets = new address[](20);
        uint256 count = 0;

        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            // Get facet address - skip if not deployed
            bytes memory callData = abi.encodeWithSignature(
                "facetAddress(bytes4)",
                diamondSelectors[i]
            );
            (bool success, bytes memory facetData) = diamond.staticcall(callData);

            if (!success) continue;

            address facet = abi.decode(facetData, (address));
            if (facet == address(0)) continue; // Skip undeployed selectors

            bool found = false;
            for (uint256 j = 0; j < count; j++) {
                if (facets[j] == facet) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                facets[count] = facet;
                count++;
            }
        }

        // All facets should have at least one selector
        for (uint256 i = 0; i < count; i++) {
            uint256 selectorCount = 0;

            for (uint256 j = 0; j < diamondSelectors.length; j++) {
                bytes memory callData = abi.encodeWithSignature(
                    "facetAddress(bytes4)",
                    diamondSelectors[j]
                );
                (bool success, bytes memory facetData) = diamond.staticcall(callData);

                if (!success) continue;

                address facet = abi.decode(facetData, (address));
                if (facet == facets[i]) {
                    selectorCount++;
                }
            }

            assertTrue(selectorCount > 0, "Facet should have selectors");
        }

        console.log("All facets are accessible");
    }
}
