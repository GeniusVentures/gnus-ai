// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../../../contracts/gnus-ai/GeniusDiamond.sol";
import "../../../contracts/gnus-ai/GeniusOwnershipFacet.sol";
import "contracts-starter/contracts/facets/DiamondCutFacet.sol";
import "contracts-starter/contracts/facets/DiamondLoupeFacet.sol";
import "contracts-starter/contracts/interfaces/IDiamondCut.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";

/// @title Basic Diamond Integration Test
/// @notice Tests basic Diamond pattern contracts with Foundry
/// @dev Deployment, facet addition, and function delegation
/// @dev requires change of import from ExampleDiamond to actual Diamond Contract
contract BasicDiamondIntegrationTest is Test {
    Diamond diamond;
    DiamondCutFacet diamondCutFacet;
    DiamondLoupeFacet diamondLoupeFacet;
    GeniusOwnershipFacet ownershipFacet;

    address owner;
    address user1;
    address user2;

    /// @notice Set up the test environment
    function setUp() public {
        // Create test accounts
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // Label addresses for better trace output
        vm.label(owner, "Owner");
        vm.label(user1, "User1");
        vm.label(user2, "User2");

        // Deploy core facets
        diamondCutFacet = new DiamondCutFacet();
        diamondLoupeFacet = new DiamondLoupeFacet();
        ownershipFacet = new GeniusOwnershipFacet();

        // Label facets
        vm.label(address(diamondCutFacet), "DiamondCutFacet");
        vm.label(address(diamondLoupeFacet), "DiamondLoupeFacet");
        vm.label(address(ownershipFacet), "OwnershipFacet");

        // Deploy diamond with DiamondCutFacet
        diamond = new Diamond(owner, address(diamondCutFacet));
        vm.label(address(diamond), "Diamond");

        // Prepare facet cuts to add after deployment
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](2);

        // Add DiamondLoupeFacet
        bytes4[] memory loupeSelectors = new bytes4[](4);
        loupeSelectors[0] = DiamondLoupeFacet.facets.selector;
        loupeSelectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        loupeSelectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        loupeSelectors[3] = DiamondLoupeFacet.facetAddress.selector;

        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(diamondLoupeFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: loupeSelectors
        });

        // Add OwnershipFacet
        bytes4[] memory ownershipSelectors = new bytes4[](2);
        ownershipSelectors[0] = GeniusOwnershipFacet.transferOwnership.selector;
        ownershipSelectors[1] = GeniusOwnershipFacet.owner.selector;

        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(ownershipFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: ownershipSelectors
        });

        // Add facets to diamond via diamondCut
        DiamondCutFacet(address(diamond)).diamondCut(cuts, address(0), "");
    } /// @notice Test that diamond is properly initialized

    function test_DiamondInitialization() public view {
        // Verify diamond was deployed
        assertTrue(address(diamond) != address(0), "Diamond should be deployed");

        // Verify owner is set correctly
        GeniusOwnershipFacet ownershipProxy = GeniusOwnershipFacet(address(diamond));
        assertEq(ownershipProxy.owner(), owner, "Owner should be set correctly");
    }

    /// @notice Test facet introspection
    function test_FacetIntrospection() public view {
        DiamondLoupeFacet loupeProxy = DiamondLoupeFacet(address(diamond));

        // Get all facets
        IDiamondLoupe.Facet[] memory facets = loupeProxy.facets();

        // Should have DiamondCutFacet, DiamondLoupeFacet, and OwnershipFacet
        assertGe(facets.length, 3, "Should have at least 3 facets");

        // Verify DiamondLoupeFacet is registered
        address loupeAddress = loupeProxy.facetAddress(DiamondLoupeFacet.facets.selector);
        assertEq(loupeAddress, address(diamondLoupeFacet), "Loupe facet should be registered");
    }

    /// @notice Test ownership transfer
    function test_OwnershipTransfer() public {
        GeniusOwnershipFacet ownershipProxy = GeniusOwnershipFacet(address(diamond));

        // Initial owner should be this contract
        assertEq(ownershipProxy.owner(), owner, "Initial owner should be correct");

        // Transfer ownership
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferred(owner, user1);
        ownershipProxy.transferOwnership(user1);

        // Verify new owner
        assertEq(ownershipProxy.owner(), user1, "Owner should be transferred");
    }

    /// @notice Test ownership transfer from non-owner should fail
    function test_OwnershipTransferUnauthorized() public {
        GeniusOwnershipFacet ownershipProxy = GeniusOwnershipFacet(address(diamond));

        // Try to transfer from non-owner
        vm.prank(user1);
        vm.expectRevert(); // Should revert with "LibDiamond: Must be contract owner"
        ownershipProxy.transferOwnership(user2);

        // Owner should remain unchanged
        assertEq(ownershipProxy.owner(), owner, "Owner should not change");
    }

    /// @notice Test fuzzing ownership transfer with various addresses
    function testFuzz_OwnershipTransfer(address newOwner) public {
        // Skip zero address and current owner
        vm.assume(newOwner != address(0));
        vm.assume(newOwner != owner);

        GeniusOwnershipFacet ownershipProxy = GeniusOwnershipFacet(address(diamond));

        // Transfer ownership
        ownershipProxy.transferOwnership(newOwner);

        // Verify transfer
        assertEq(ownershipProxy.owner(), newOwner, "Fuzz: Owner should be transferred");
    }

    /// @notice Test gas consumption for ownership transfer
    function test_OwnershipTransferGas() public {
        GeniusOwnershipFacet ownershipProxy = GeniusOwnershipFacet(address(diamond));

        uint256 gasBefore = gasleft();
        ownershipProxy.transferOwnership(user1);
        uint256 gasUsed = gasBefore - gasleft();

        // Log gas usage for reference
        emit log_named_uint("Gas used for ownership transfer", gasUsed);

        // Assert reasonable gas usage (Diamond proxy adds overhead, so higher limit)
        assertLt(gasUsed, 250_000, "Ownership transfer should use less than 250k gas");
    } /// @notice Test that diamond supports expected interfaces

    function test_SupportsInterface() public pure {
        // Diamond should support ERC165
        // bytes4 erc165InterfaceId = 0x01ffc9a7;
        // Note: This test assumes diamond implements ERC165 via a facet
        // You may need to add an ERC165 facet for this to work
        // For now, this is a placeholder showing the pattern
        // Example:
        // IERC165 diamond165 = IERC165(address(diamond));
        // assertTrue(diamond165.supportsInterface(erc165InterfaceId), "Should support ERC165");
    }

    // Events for testing
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
}
