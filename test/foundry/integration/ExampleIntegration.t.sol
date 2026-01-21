// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondForgeHelpers.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondABILoader.sol";
import "../helpers/DiamondDeployment.sol";

/**
 * @title ExampleIntegrationTest
 * @notice Example integration test for Diamond contract
 * @dev Tests interactions between multiple facets and Diamond functionality
 */
contract ExampleIntegrationTest is Test {
    using DiamondForgeHelpers for address;
    using DiamondABILoader for string;

    address diamond;
    address deployer;

    // Test users
    address user1;
    address user2;

    function setUp() public {
        // Load Diamond deployment data using generated helper
        diamond = DiamondDeployment.getDiamondAddress();
        deployer = DiamondDeployment.getDeployerAddress();

        // Only validate Diamond if it has code (when forking from deployed network)
        // In non-fork mode, the deployment data is still valid for test reference
        uint256 codeSize;
        address diamondAddr = diamond;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }

        if (codeSize > 0) {
            // Validate Diamond using DiamondForgeHelpers when deployed
            DiamondForgeHelpers.assertValidDiamond(diamond);
            console.log("Diamond code size:", codeSize);
        } else {
            console.log("INFO: No code at Diamond address (not forking from deployed network)");
            console.log("INFO: Tests will use deployment data for reference");
        }

        // Set up test users
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // Fund test users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);

        console.log("=== ExampleIntegration Test Setup ===");
        console.log("Diamond:", diamond);
        console.log("Deployer:", deployer);
        console.log("User1:", user1);
        console.log("User2:", user2);
    }

    /**
     * @notice Test multi-facet interaction workflow
     * @dev Tests interaction between DiamondLoupe and AccessControl facets
     */
    function test_MultiFacetWorkflow() public view {
        // Skip if Diamond not deployed (not forking)
        uint256 codeSize;
        address diamondAddr = diamond;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }
        if (codeSize == 0) {
            console.log("Skipping: Diamond not deployed (not forking)");
            return;
        }

        console.log("Test: Multi-facet interaction workflow");

        // Use DiamondLoupe facet to get all facets
        (bool success, bytes memory data) = diamond.staticcall(
            abi.encodeWithSignature("facetAddresses()")
        );
        assertTrue(success, "facetAddresses() should succeed");

        address[] memory facetAddresses = abi.decode(data, (address[]));
        console.log("Total facets:", facetAddresses.length);
        assertTrue(facetAddresses.length >= 3, "Should have at least 3 facets");

        // Verify each facet has function selectors
        for (uint256 i = 0; i < facetAddresses.length; i++) {
            (bool selectorSuccess, bytes memory selectorData) = diamond.staticcall(
                abi.encodeWithSignature("facetFunctionSelectors(address)", facetAddresses[i])
            );
            assertTrue(selectorSuccess, "facetFunctionSelectors() should succeed");

            bytes4[] memory selectors = abi.decode(selectorData, (bytes4[]));
            console.log("Facet", i, "selector count:", selectors.length);
            assertTrue(selectors.length > 0, "Each facet should have at least one function");
        }

        // Interact with AccessControl facet - check DEFAULT_ADMIN_ROLE
        (bool roleSuccess, bytes memory roleData) = diamond.staticcall(
            abi.encodeWithSignature("DEFAULT_ADMIN_ROLE()")
        );
        assertTrue(roleSuccess, "DEFAULT_ADMIN_ROLE() should succeed");

        bytes32 defaultAdminRole = abi.decode(roleData, (bytes32));
        assertEq(defaultAdminRole, bytes32(0), "DEFAULT_ADMIN_ROLE should be 0x00");
        console.log("DEFAULT_ADMIN_ROLE verified");
    }

    /**
     * @notice Test cross-facet state management
     * @dev Tests that state is properly managed across different facets
     */
    function test_CrossFacetState() public view {
        // Skip if Diamond not deployed (not forking)
        uint256 codeSize;
        address diamondAddr = diamond;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }
        if (codeSize == 0) {
            console.log("Skipping: Diamond not deployed (not forking)");
            return;
        }

        console.log("Test: Cross-facet state management");

        // Get owner from OwnershipFacet
        (bool ownerSuccess, bytes memory ownerData) = diamond.staticcall(
            abi.encodeWithSignature("owner()")
        );
        assertTrue(ownerSuccess, "owner() should succeed");

        address diamondOwner = abi.decode(ownerData, (address));
        console.log("Diamond owner:", diamondOwner);
        assertTrue(diamondOwner != address(0), "Owner should not be zero address");

        // Check if owner has DEFAULT_ADMIN_ROLE via AccessControl facet
        bytes32 defaultAdminRole = bytes32(0);
        (bool hasRoleSuccess, bytes memory hasRoleData) = diamond.staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", defaultAdminRole, diamondOwner)
        );
        assertTrue(hasRoleSuccess, "hasRole() should succeed");

        bool ownerHasRole = abi.decode(hasRoleData, (bool));
        console.log("Owner has DEFAULT_ADMIN_ROLE:", ownerHasRole);

        // Verify owner can be queried from multiple facets (state consistency)
        (bool owner2Success, bytes memory owner2Data) = diamond.staticcall(
            abi.encodeWithSignature("owner()")
        );
        assertTrue(owner2Success, "Second owner() call should succeed");
        address diamondOwner2 = abi.decode(owner2Data, (address));
        assertEq(diamondOwner, diamondOwner2, "Owner should be consistent across calls");
    }

    /**
     * @notice Test Diamond is properly deployed and accessible
     * @dev Verifies DiamondForgeHelpers.assertValidDiamond works correctly
     */
    function test_DiamondDeploymentValid() public view {
        // Skip if Diamond not deployed (not forking)
        uint256 codeSize;
        address diamondAddr = diamond;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }
        if (codeSize == 0) {
            console.log("Skipping: Diamond not deployed (not forking)");
            return;
        }

        console.log("Test: Diamond deployment validation");

        // This should not revert - was already called in setUp() but test explicitly
        DiamondForgeHelpers.assertValidDiamond(diamond);
        console.log("Diamond validation passed");

        // Verify Diamond supports ERC165
        (bool supportsSuccess, bytes memory supportsData) = diamond.staticcall(
            abi.encodeWithSignature("supportsInterface(bytes4)", bytes4(0x01ffc9a7))
        );
        assertTrue(supportsSuccess, "supportsInterface() should succeed");

        bool supportsERC165 = abi.decode(supportsData, (bool));
        assertTrue(supportsERC165, "Diamond should support ERC165");
        console.log("Diamond supports ERC165");
    }
}
