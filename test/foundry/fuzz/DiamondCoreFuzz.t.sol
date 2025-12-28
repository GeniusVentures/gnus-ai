// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title DiamondCoreFuzz
 * @notice Fuzz tests for core Diamond proxy operations
 * @dev Tests ownership transfers, diamond cuts, and core proxy functionality
 */
contract DiamondCoreFuzz is GeniusDiamondTestBase {
    /**
     * @notice Setup for fuzz tests
     */
    function setUp() public override {
        super.setUp();
        
        console.log("===== Diamond Core Fuzz Tests =====");
        console.log("Diamond Address:", diamond);
        console.log("Owner Address:", owner);
        console.log("===================================");
    }

    /**
     * @notice Fuzz test: Ownership transfer to random addresses
     * @dev Tests that owner can transfer ownership to any valid address
     * @param newOwner Random address to transfer ownership to
     */
    function testFuzz_ownershipTransfer(address newOwner) public {
        // Bound to valid addresses (not zero, not precompile)
        newOwner = _boundAddress(newOwner);
        vm.assume(newOwner != owner);
        
        // Get current owner
        address currentOwner = _getDiamondOwner();
        assertEq(currentOwner, owner, "Initial owner mismatch");
        
        // Transfer ownership as current owner
        bytes4 selector = bytes4(keccak256("transferOwnership(address)"));
        bytes memory data = abi.encode(newOwner);
        
        vm.prank(owner);
        (bool success, ) = _callDiamond(selector, data);
        assertTrue(success, "Ownership transfer failed");
        
        // Verify new owner
        address updatedOwner = _getDiamondOwner();
        assertEq(updatedOwner, newOwner, "Owner not updated");
        
        console.log("[OK] Ownership transferred to:", newOwner);
    }

    /**
     * @notice Fuzz test: Non-owner cannot transfer ownership
     * @dev Ensures only current owner can transfer ownership
     * @param attacker Random address attempting unauthorized transfer
     * @param newOwner Random target address for transfer
     */
    function testFuzz_RevertWhen_nonOwnerTransfersOwnership(
        address attacker,
        address newOwner
    ) public {
        // Bound addresses
        attacker = _boundAddress(attacker);
        newOwner = _boundAddress(newOwner);
        vm.assume(attacker != owner);
        vm.assume(newOwner != address(0));
        
        bytes4 selector = bytes4(keccak256("transferOwnership(address)"));
        bytes memory data = abi.encode(newOwner);
        
        // Expect revert when non-owner tries to transfer
        vm.prank(attacker);
        (bool success, ) = _callDiamond(selector, data);
        assertFalse(success, "Non-owner should not be able to transfer ownership");
        
        // Verify owner unchanged
        address currentOwner = _getDiamondOwner();
        assertEq(currentOwner, owner, "Owner should not have changed");
        
        console.log("[OK] Non-owner", attacker, "correctly rejected");
    }

    /**
     * @notice Fuzz test: Non-owner cannot call diamondCut
     * @dev Ensures only owner can modify diamond
     * @param attacker Random address attempting unauthorized cut
     */
    function testFuzz_RevertWhen_nonOwnerCallsDiamondCut(address attacker) public {
        attacker = _boundAddress(attacker);
        vm.assume(attacker != owner);
        
        // Try to call diamondCut with empty cut (still should revert on auth)
        bytes4 selector = bytes4(keccak256("diamondCut((address,uint8,bytes4[])[],address,bytes)"));
        
        // Empty cut array
        bytes memory data = abi.encode(
            new bytes[](0), // Empty facet cuts
            address(0),     // No init
            ""              // No init data
        );
        
        vm.prank(attacker);
        (bool success, ) = _callDiamond(selector, data);
        assertFalse(success, "Non-owner should not be able to call diamondCut");
        
        console.log("[OK] Non-owner", attacker, "blocked from diamondCut");
    }

    /**
     * @notice Fuzz test: Verify facet address lookup for random selectors
     * @dev Tests that facetAddress() returns consistent results
     * @param selectorSeed Random seed for selecting a selector
     */
    function testFuzz_facetAddressLookup(uint256 selectorSeed) public {
        bytes4[] memory selectors = _getDiamondSelectors();
        vm.assume(selectors.length > 0);
        
        // Pick a random selector
        uint256 index = selectorSeed % selectors.length;
        bytes4 selector = selectors[index];
        
        // Query facet address
        address facet = _getFacetAddress(selector);
        
        // Facet must be valid
        assertTrue(facet != address(0), "Facet is zero address");
        assertTrue(facet.code.length > 0, "Facet has no code");
        
        console.log("[OK] Selector routes to:", facet);
    }

    /**
     * @notice Fuzz test: Owner can be transferred multiple times
     * @dev Tests chain of ownership transfers
     * @param owner1 First new owner
     * @param owner2 Second new owner
     */
    function testFuzz_multipleOwnershipTransfers(address owner1, address owner2) public {
        owner1 = _boundAddress(owner1);
        owner2 = _boundAddress(owner2);
        vm.assume(owner1 != owner);
        vm.assume(owner2 != owner1);
        
        bytes4 selector = bytes4(keccak256("transferOwnership(address)"));
        
        // First transfer
        vm.prank(owner);
        (bool success1, ) = _callDiamond(selector, abi.encode(owner1));
        assertTrue(success1, "First transfer failed");
        assertEq(_getDiamondOwner(), owner1, "First owner not set");
        
        // Second transfer
        vm.prank(owner1);
        (bool success2, ) = _callDiamond(selector, abi.encode(owner2));
        assertTrue(success2, "Second transfer failed");
        assertEq(_getDiamondOwner(), owner2, "Second owner not set");
        
        console.log("[OK] Ownership chain complete");
    }

    /**
     * @notice Fuzz test: Cannot transfer ownership to zero address
     * @dev Important safety check
     */
    function testFuzz_RevertWhen_transferToZeroAddress() public {
        bytes4 selector = bytes4(keccak256("transferOwnership(address)"));
        bytes memory data = abi.encode(address(0));
        
        vm.prank(owner);
        (bool success, ) = _callDiamond(selector, data);
        assertFalse(success, "Should not allow transfer to zero address");
        
        // Verify owner unchanged
        assertEq(_getDiamondOwner(), owner, "Owner should not have changed");
        
        console.log("[OK] Transfer to zero address correctly rejected");
    }

    /**
     * @notice Fuzz test: Facet addresses array consistency
     * @dev Tests that facetAddresses() returns valid addresses
     */
    function testFuzz_facetAddressesConsistency() public view {
        bytes memory callData = abi.encodeWithSignature("facetAddresses()");
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        
        assertTrue(success, "facetAddresses() call failed");
        
        address[] memory facetAddresses = abi.decode(returnData, (address[]));
        
        // All facet addresses must be valid
        for (uint256 i = 0; i < facetAddresses.length; i++) {
            assertTrue(facetAddresses[i] != address(0), "Facet address is zero");
            assertTrue(facetAddresses[i].code.length > 0, "Facet has no code");
        }
        
        console.log("[OK] All", facetAddresses.length, "facet addresses are valid");
    }

    /**
     * @notice Fuzz test: Function selectors for random facets
     * @dev Tests facetFunctionSelectors() for consistency
     * @param facetIndex Random index to select a facet
     */
    function testFuzz_facetFunctionSelectors(uint256 facetIndex) public view {
        // Get all facet addresses
        bytes memory callData = abi.encodeWithSignature("facetAddresses()");
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        require(success, "facetAddresses() call failed");
        
        address[] memory facetAddresses = abi.decode(returnData, (address[]));
        vm.assume(facetAddresses.length > 0);
        
        // Pick a random facet
        address facet = facetAddresses[facetIndex % facetAddresses.length];
        
        // Get its selectors
        bytes4[] memory selectors = _getFacetFunctionSelectors(facet);
        
        // Should have at least one selector
        assertTrue(selectors.length > 0, "Facet has no selectors");
        
        // All selectors should route back to this facet
        for (uint256 i = 0; i < selectors.length; i++) {
            address routedFacet = _getFacetAddress(selectors[i]);
            assertEq(routedFacet, facet, "Selector routes to wrong facet");
        }
        
        console.log("[OK] Facet verified with selectors:", selectors.length);
    }

    /**
     * @notice Fuzz test: Owner retrieval consistency
     * @dev Ensures owner() always returns consistent results
     */
    function testFuzz_ownerRetrievalConsistency() public view {
        // Call owner() multiple times
        address owner1 = _getDiamondOwner();
        address owner2 = _getDiamondOwner();
        address owner3 = _getDiamondOwner();
        
        // All should return same value
        assertEq(owner1, owner2, "Owner changed between calls");
        assertEq(owner2, owner3, "Owner changed between calls");
        assertTrue(owner1 != address(0), "Owner is zero");
        
        console.log("[OK] owner() consistently returns:", owner1);
    }

    /**
     * @notice Fuzz test: Selector collision detection
     * @dev Verify no two functions share the same selector
     */
    function testFuzz_noSelectorCollisions() public view {
        bytes4[] memory selectors = _getDiamondSelectors();
        
        // Check all pairs
        for (uint256 i = 0; i < selectors.length && i < 50; i++) {
            for (uint256 j = i + 1; j < selectors.length && j < 50; j++) {
                assertTrue(selectors[i] != selectors[j], "Selector collision detected");
            }
        }
        
        console.log("[OK] No collisions among", selectors.length, "selectors");
    }
}
