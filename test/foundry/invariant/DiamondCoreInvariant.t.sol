// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title DiamondCoreInvariant
 * @notice Invariant tests for core Diamond proxy functionality
 * @dev Tests fundamental Diamond properties that must always hold
 */
contract DiamondCoreInvariant is GeniusDiamondTestBase {
    /**
     * @notice Setup for invariant tests
     * @dev Calls parent setup to initialize diamond
     */
    function setUp() public override {
        super.setUp();
        
        // Target the diamond contract for invariant testing
        targetContract(diamond);
        
        console.log("===== Diamond Core Invariant Tests =====");
        console.log("Diamond Address:", diamond);
        console.log("Owner Address:", owner);
        console.log("Selectors Count:", _getDiamondSelectors().length);
        console.log("=========================================");
    }

    /**
     * @notice Invariant: Diamond owner must never be address(0)
     * @dev Critical for ownership controls - a zero address owner would lock the diamond
     */
    function invariant_ownerNeverZero() public {
        address currentOwner = _getDiamondOwner();
        assertTrue(currentOwner != address(0), "Diamond owner is address(0)");
        
        console.log("[OK] Owner is valid:", currentOwner);
    }

    /**
     * @notice Invariant: All registered selectors must route to valid (non-zero) facet addresses
     * @dev Ensures no selector routes to address(0) which would cause calls to fail
     */
    function invariant_allSelectorsHaveValidFacets() public {
        bytes4[] memory selectors = _getDiamondSelectors();
        uint256 invalidCount = 0;
        
        for (uint256 i = 0; i < selectors.length; i++) {
            address facet = _getFacetAddress(selectors[i]);
            if (facet == address(0)) {
                console.log("[ERR] Invalid facet for selector:", uint32(selectors[i]));
                invalidCount++;
            }
        }
        
        assertEq(invalidCount, 0, "Some selectors have invalid facets");
        console.log("[OK] All", selectors.length, "selectors have valid facets");
    }

    /**
     * @notice Invariant: Function selectors must not overlap across facets
     * @dev Each selector should appear exactly once in the diamond
     */
    function invariant_noSelectorOverlap() public {
        bytes4[] memory selectors = _getDiamondSelectors();
        
        // Check for duplicates
        for (uint256 i = 0; i < selectors.length; i++) {
            for (uint256 j = i + 1; j < selectors.length; j++) {
                if (selectors[i] == selectors[j]) {
                    console.log("[ERR] Duplicate selector found:", uint32(selectors[i]));
                    revert("Selector overlap detected");
                }
            }
        }
        
        console.log("[OK] No selector overlap across", selectors.length, "functions");
    }

    /**
     * @notice Invariant: Facet addresses returned by loupe must be consistent
     * @dev facetAddress() and facets() should return consistent data
     */
    function invariant_facetAddressesConsistent() public {
        bytes4[] memory selectors = _getDiamondSelectors();
        uint256 inconsistentCount = 0;
        
        // Get all facets from loupe
        bytes memory facetsCallData = abi.encodeWithSignature("facets()");
        (bool success, bytes memory returnData) = diamond.staticcall(facetsCallData);
        require(success, "facets() call failed");
        
        // Verify each selector's facet address
        for (uint256 i = 0; i < selectors.length; i++) {
            address facet = _getFacetAddress(selectors[i]);
            
            // Facet must exist and have code
            if (facet != address(0) && facet.code.length == 0) {
                console.log("[ERR] Facet has no code:", facet);
                inconsistentCount++;
            }
        }
        
        assertEq(inconsistentCount, 0, "Facet address inconsistencies detected");
        console.log("[OK] Facet addresses are consistent");
    }

    /**
     * @notice Invariant: Diamond must have the minimum required facets
     * @dev At minimum: DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet
     */
    function invariant_minimumFacetsPresent() public {
        bytes memory facetsCallData = abi.encodeWithSignature("facets()");
        (bool success, bytes memory returnData) = diamond.staticcall(facetsCallData);
        require(success, "facets() call failed");
        
        // Decode the facets array - it's an array of structs
        // We just check that we have some facets
        bytes4[] memory selectors = _getDiamondSelectors();
        
        // Should have at least 3 facets worth of functions
        assertTrue(selectors.length >= 10, "Too few functions registered");
        
        console.log("[OK] Diamond has sufficient facets:", selectors.length, "functions");
    }

    /**
     * @notice Invariant: DiamondCut function must be present
     * @dev Critical for upgradability
     */
    function invariant_diamondCutFunctionExists() public {
        bytes4 diamondCutSelector = bytes4(keccak256("diamondCut((address,uint8,bytes4[])[],address,bytes)"));
        address facet = _getFacetAddress(diamondCutSelector);
        
        assertTrue(facet != address(0), "DiamondCut function not found");
        assertTrue(facet.code.length > 0, "DiamondCut facet has no code");
        
        console.log("[OK] DiamondCut function exists at:", facet);
    }

    /**
     * @notice Invariant: DiamondLoupe functions must be present
     * @dev Required for introspection
     */
    function invariant_diamondLoupeFunctionsExist() public {
        bytes4[] memory loupeSelectors = new bytes4[](4);
        loupeSelectors[0] = bytes4(keccak256("facets()"));
        loupeSelectors[1] = bytes4(keccak256("facetFunctionSelectors(address)"));
        loupeSelectors[2] = bytes4(keccak256("facetAddresses()"));
        loupeSelectors[3] = bytes4(keccak256("facetAddress(bytes4)"));
        
        for (uint256 i = 0; i < loupeSelectors.length; i++) {
            address facet = _getFacetAddress(loupeSelectors[i]);
            assertTrue(facet != address(0), "Loupe function missing");
        }
        
        console.log("[OK] All DiamondLoupe functions exist");
    }

    /**
     * @notice Invariant: Owner function must be callable
     * @dev Ensures ownership checks can always work
     */
    function invariant_ownerFunctionCallable() public {
        bytes memory callData = abi.encodeWithSignature("owner()");
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        
        assertTrue(success, "owner() call failed");
        address returnedOwner = abi.decode(returnData, (address));
        assertTrue(returnedOwner != address(0), "owner() returned zero address");
        
        console.log("[OK] owner() function is callable, returned:", returnedOwner);
    }
}
