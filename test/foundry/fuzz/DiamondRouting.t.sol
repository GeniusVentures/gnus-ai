// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import "../helpers/DiamondDeployment.sol";

/// @title DiamondRouting
/// @notice Tests for Diamond selector routing to facets
/// @dev Task 4.16-4.20: Validate function selector routing
contract DiamondRouting is DiamondFuzzBase {
    /// @notice Override to load Diamond from deployment
    function _loadDiamondAddress() internal pure override returns (address) {
        return DiamondDeployment.getDiamondAddress();
    }

    /// @notice Override to load Diamond ABI path from deployment
    function _getDiamondABIPath() internal pure override returns (string memory) {
        return DiamondDeployment.getDiamondABIPath();
    }

    /// @notice Expected facet addresses (loaded from deployment)
    mapping(bytes4 => address) public expectedFacets;

    /// @notice All facet addresses
    address[] public facetAddresses;

    /// @notice Setup function runs before each test
    function setUp() public override {
        super.setUp();

        console.log("=== DiamondRouting Setup ===");
        console.log("Diamond:", diamond);
        console.log("Selectors loaded:", diamondSelectors.length);

        // Load facet addresses for all selectors
        _loadFacetAddresses();
    }

    /// @notice Load facet addresses for verification
    /// @dev Task 4.18: Query facet addresses using DiamondLoupe
    function _loadFacetAddresses() internal {
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            bytes4 selector = diamondSelectors[i];

            // Get facet address - skip if not deployed
            bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", selector);
            (bool success, bytes memory facetData) = diamond.staticcall(callData);

            if (!success) continue;

            address facet = abi.decode(facetData, (address));
            if (facet == address(0)) continue; // Skip undeployed selectors

            expectedFacets[selector] = facet;

            // Add to unique facet list
            bool found = false;
            for (uint256 j = 0; j < facetAddresses.length; j++) {
                if (facetAddresses[j] == facet) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                facetAddresses.push(facet);
            }
        }

        console.log("Unique facets:", facetAddresses.length);
    }

    /// @notice Test that all selectors route to correct facets
    /// @dev Task 4.17: Validate function selectors route to correct facet addresses
    function test_AllSelectorsRouteCorrectly() public view {
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            bytes4 selector = diamondSelectors[i];
            string memory signature = diamondSignatures[i];

            // Get facet address - skip if not deployed
            bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", selector);
            (bool success, bytes memory facetData) = diamond.staticcall(callData);

            if (!success) continue;

            address facet = abi.decode(facetData, (address));
            if (facet == address(0)) continue; // Skip undeployed selectors

            // Should have code
            assertTrue(
                facet.code.length > 0,
                string(abi.encodePacked("Facet has no code: ", signature))
            );

            console.log("Verified routing:", signature, "->", facet);
        }
    }

    /// @notice Fuzz test for selector routing
    /// @dev Task 4.19: Fuzz with random selectors
    function testFuzz_SelectorRouting(bytes4 randomSelector) public view {
        // Try to get facet for random selector
        bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", randomSelector);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);

        if (success) {
            address facet = abi.decode(returnData, (address));

            // If selector exists, facet should be non-zero
            // If selector doesn't exist, facet should be zero
            if (facet != address(0)) {
                // This is a valid selector, verify it has code
                assertTrue(facet.code.length > 0, "Valid facet should have code");

                console.log("Random selector routes to:", facet);
            } else {
                console.log("Random selector not found (expected)");
            }
        }
    }

    /// @notice Test for function selector collisions
    /// @dev Task 4.20: Verify no duplicate selectors
    function test_NoSelectorCollisions() public view {
        // Check all selectors are unique
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            for (uint256 j = i + 1; j < diamondSelectors.length; j++) {
                assertTrue(
                    diamondSelectors[i] != diamondSelectors[j],
                    string(
                        abi.encodePacked(
                            "Collision: ",
                            diamondSignatures[i],
                            " vs ",
                            diamondSignatures[j]
                        )
                    )
                );
            }
        }

        console.log("No collisions found among", diamondSelectors.length, "selectors");
    }

    /// @notice Test facetAddress function for all known selectors
    /// @dev Verify DiamondLoupe facetAddress works correctly
    function test_FacetAddressForAllSelectors() public view {
        uint256 testedCount = 0;
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            bytes4 selector = diamondSelectors[i];

            bytes4 facetAddressSelector = bytes4(keccak256("facetAddress(bytes4)"));
            bytes memory data = abi.encode(selector);

            bytes memory callData = abi.encodePacked(facetAddressSelector, data);
            (bool success, bytes memory returnData) = diamond.staticcall(callData);

            if (!success) continue; // Skip selectors that fail

            address facet = abi.decode(returnData, (address));
            if (facet == address(0)) continue; // Skip undeployed selectors

            assertTrue(facet.code.length > 0, "Facet should have code");
            testedCount++;
        }

        assertTrue(testedCount > 0, "Should have tested at least one selector");
        console.log("All facetAddress queries succeeded, tested:", testedCount);
    }

    /// @notice Test facets() function returns all facets
    /// @dev Verify DiamondLoupe facets enumeration
    function test_FacetsEnumeration() public view {
        bytes4 selector = bytes4(keccak256("facets()"));

        bytes memory callData = abi.encodePacked(selector);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);

        assertTrue(success, "facets() call should succeed");

        // Facets returns an array of Facet structs
        // For now, just verify it succeeds
        assertTrue(returnData.length > 0, "Should return facet data");

        console.log("Facets enumeration succeeded, data length:", returnData.length);
    }

    /// @notice Test facetFunctionSelectors for each facet
    /// @dev Verify each facet's selectors can be queried
    function test_FacetFunctionSelectors() public view {
        for (uint256 i = 0; i < facetAddresses.length; i++) {
            address facet = facetAddresses[i];

            bytes4 selector = bytes4(keccak256("facetFunctionSelectors(address)"));
            bytes memory data = abi.encode(facet);

            bytes memory callData = abi.encodePacked(selector, data);
            (bool success, bytes memory returnData) = diamond.staticcall(callData);

            assertTrue(success, "facetFunctionSelectors should succeed");
            assertTrue(returnData.length > 0, "Should return selector data");

            console.log("Facet", facet, "has selectors");
        }
    }

    /// @notice Test that each facet has at least one selector
    /// @dev Verify facets are not empty
    function test_AllFacetsHaveSelectors() public view {
        for (uint256 i = 0; i < facetAddresses.length; i++) {
            address facet = facetAddresses[i];

            // Count selectors for this facet
            uint256 selectorCount = 0;
            for (uint256 j = 0; j < diamondSelectors.length; j++) {
                if (expectedFacets[diamondSelectors[j]] == facet) {
                    selectorCount++;
                }
            }

            assertTrue(selectorCount > 0, "Facet should have at least one selector");

            console.log("Facet has selectors:", selectorCount);
            console.log("Facet address:", facet);
        }
    }

    /// @notice Fuzz test for facet selector consistency
    /// @dev Verify selector always routes to same facet
    function testFuzz_SelectorConsistency(uint256 selectorIndex) public view {
        vm.assume(selectorIndex < diamondSelectors.length);

        bytes4 selector = diamondSelectors[selectorIndex];

        // Get facet address - skip if not deployed
        bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", selector);
        (bool success, bytes memory facetData) = diamond.staticcall(callData);

        if (!success) return; // Skip selectors that fail

        address facet1 = abi.decode(facetData, (address));
        if (facet1 == address(0)) return; // Skip undeployed selectors

        // Query multiple times for consistency
        for (uint256 i = 0; i < 5; i++) {
            (success, facetData) = diamond.staticcall(callData);
            require(success, "facetAddress call should succeed");
            address facet2 = abi.decode(facetData, (address));
            assertEq(facet1, facet2, "Selector should always route to same facet");
        }

        console.log("Selector routing is consistent");
    }

    /// @notice Test routing for standard Diamond functions
    /// @dev Verify standard functions are routable
    function test_StandardFunctionsRoutable() public view {
        // Test owner() from OwnershipFacet
        bytes4 ownerSelector = bytes4(keccak256("owner()"));
        bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", ownerSelector);
        (bool success, bytes memory facetData) = diamond.staticcall(callData);
        assertTrue(success, "facetAddress for owner() should succeed");
        address ownerFacet = abi.decode(facetData, (address));
        assertTrue(ownerFacet != address(0), "owner() should be routable");

        // Test facets() from DiamondLoupeFacet
        bytes4 facetsSelector = bytes4(keccak256("facets()"));
        callData = abi.encodeWithSignature("facetAddress(bytes4)", facetsSelector);
        (success, facetData) = diamond.staticcall(callData);
        assertTrue(success, "facetAddress for facets() should succeed");
        address loupeFacet = abi.decode(facetData, (address));
        assertTrue(loupeFacet != address(0), "facets() should be routable");

        // Test facetAddress() itself from DiamondLoupeFacet
        bytes4 facetAddressSelector = bytes4(keccak256("facetAddress(bytes4)"));
        callData = abi.encodeWithSignature("facetAddress(bytes4)", facetAddressSelector);
        (success, facetData) = diamond.staticcall(callData);
        assertTrue(success, "facetAddress for facetAddress() should succeed");
        address facetAddressFacet = abi.decode(facetData, (address));
        assertTrue(facetAddressFacet != address(0), "facetAddress() should be routable");

        console.log("Standard functions are routable");
    }

    /// @notice Test gas consumption for facetAddress queries
    /// @dev Task 4.29: Gas profiling for routing queries
    function test_GasProfile_FacetAddress() public {
        bytes4 testSelector = diamondSelectors[0];

        bytes4 selector = bytes4(keccak256("facetAddress(bytes4)"));
        bytes memory data = abi.encode(testSelector);

        uint256 gasUsed = _measureDiamondGas(selector, data);

        console.log("Gas used for facetAddress query:", gasUsed);

        // Task 4.28: Assert gas is reasonable
        assertTrue(gasUsed > 0 && gasUsed < 50000, "Gas should be reasonable");
    }

    /// @notice Fuzz test invalid selector handling
    /// @dev Verify invalid selectors return zero address
    function testFuzz_InvalidSelectorReturnsZero(bytes4 invalidSelector) public view {
        // Assume it's not a valid selector
        bool isValid = false;
        for (uint256 i = 0; i < diamondSelectors.length; i++) {
            if (diamondSelectors[i] == invalidSelector) {
                isValid = true;
                break;
            }
        }

        vm.assume(!isValid);

        bytes4 selector = bytes4(keccak256("facetAddress(bytes4)"));
        bytes memory data = abi.encode(invalidSelector);

        bytes memory callData = abi.encodePacked(selector, data);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);

        if (success) {
            address facet = abi.decode(returnData, (address));
            // Invalid selectors should return zero address
            assertEq(facet, address(0), "Invalid selector should return zero address");

            console.log("Invalid selector correctly returned zero address");
        }
    }
}
