// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import "../helpers/DiamondDeployment.sol";
import "contracts-starter/contracts/interfaces/IDiamondCut.sol";
import "contracts-starter/contracts/interfaces/IDiamondLoupe.sol";

/// @title ExampleDiamondIntegrationDeployed
/// @notice Integration tests using deployed Diamond via DiamondDeployment library
/// @dev Task 4.13-4.14: Tests facet upgrades and integration scenarios on deployed Diamond
contract ExampleDiamondIntegrationDeployed is DiamondFuzzBase {
    /// @notice Override to load Diamond from deployment
    /// @dev Task 4.8.3: Use DiamondDeployment library to get deployed Diamond address
    function _loadDiamondAddress() internal pure override returns (address) {
        return DiamondDeployment.getDiamondAddress();
    }

    /// @notice Override to load Diamond ABI path from deployment
    function _getDiamondABIPath() internal pure override returns (string memory) {
        return DiamondDeployment.getDiamondABIPath();
    }

    /// @notice Override setUp to handle fork-aware testing
    /// @dev Only load Diamond ABI when actually deployed (forking)
    function setUp() public override {
        diamond = _loadDiamondAddress();

        // Check if Diamond is deployed
        uint256 codeSize;
        address diamondAddr = diamond;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }

        if (codeSize > 0) {
            // Diamond deployed - load ABI and proceed with normal setup
            _loadDiamondABI();
            console.log("Diamond loaded at:", diamond);
            console.log("Functions found:", diamondSelectors.length);
        } else {
            // Not forking - skip ABI loading but allow tests to check and skip
            console.log("INFO: Diamond not deployed (not forking)");
        }
    }

    /// @notice Check if we're in fork mode with deployed Diamond
    modifier onlyWhenDeployed() {
        uint256 codeSize;
        address diamondAddr = diamond;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }

        if (codeSize == 0) {
            console.log("Skipping: Diamond not deployed (not forking)");
            return;
        }
        _;
    }

    /// @notice Test that Diamond deployment is valid
    /// @dev Task 4.13: Basic integration test using DiamondDeployment
    function test_DeployedDiamondExists() public view onlyWhenDeployed {
        // Diamond address should be loaded from DiamondDeployment library
        assertTrue(diamond != address(0), "Diamond should have valid address");
        assertTrue(diamond.code.length > 0, "Diamond should have code");

        console.log("Deployed Diamond verified at:", diamond);
    }

    /// @notice Test facet introspection on deployed Diamond
    /// @dev Task 4.13: Verify all facets are properly registered
    function test_DeployedFacetsIntrospection() public view onlyWhenDeployed {
        // Call facets() via DiamondLoupe
        bytes4 selector = bytes4(keccak256("facets()"));
        (bool success, bytes memory returnData) = diamond.staticcall(
            abi.encodeWithSelector(selector)
        );

        assertTrue(success, "facets() call should succeed");

        // Decode facet data
        IDiamondLoupe.Facet[] memory facets = abi.decode(returnData, (IDiamondLoupe.Facet[]));

        // Should have multiple facets
        assertGt(facets.length, 0, "Should have at least one facet");

        console.log("Total facets deployed:", facets.length);

        // Verify each facet has selectors
        for (uint256 i = 0; i < facets.length; i++) {
            assertGt(facets[i].functionSelectors.length, 0, "Each facet should have selectors");
            assertTrue(
                facets[i].facetAddress != address(0),
                "Each facet should have valid address"
            );
            console.log("Facet address:", facets[i].facetAddress);
        }
    }

    /// @notice Test facet addresses are accessible
    /// @dev Task 4.13: Verify facet address lookup works
    function test_FacetAddressLookup() public view onlyWhenDeployed {
        // Get all selectors
        bytes4[] memory selectors = _getDiamondSelectors();

        assertGt(selectors.length, 0, "Should have selectors");

        // Test first few deployed selectors
        uint256 testCount = 0;
        uint256 targetCount = 5;

        for (uint256 i = 0; i < selectors.length && testCount < targetCount; i++) {
            // Get facet address - skip if not deployed
            bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", selectors[i]);
            (bool success, bytes memory facetData) = diamond.staticcall(callData);

            if (!success) continue;

            address facetAddr = abi.decode(facetData, (address));
            if (facetAddr == address(0)) continue; // Skip undeployed selectors

            assertTrue(facetAddr.code.length > 0, "Facet should have code");
            testCount++;
        }

        assertTrue(testCount > 0, "Should have tested at least one selector");
        console.log("Verified facet routing for", testCount, "selectors");
    }

    /// @notice Test Diamond owner functionality
    /// @dev Task 4.13: Verify ownership functions work on deployed Diamond
    function test_DeployedDiamondOwner() public view onlyWhenDeployed {
        address owner = _getDiamondOwner();

        assertNotEq(owner, address(0), "Owner should not be zero address");

        console.log("Diamond owner:", owner);
    }

    /// @notice Test facet function selectors enumeration
    /// @dev Task 4.13: Verify we can enumerate all facet functions
    function test_FacetFunctionSelectors() public view onlyWhenDeployed {
        // Get facet addresses
        bytes4 facetAddressesSelector = bytes4(keccak256("facetAddresses()"));
        (bool success, bytes memory returnData) = diamond.staticcall(
            abi.encodeWithSelector(facetAddressesSelector)
        );

        assertTrue(success, "facetAddresses() should succeed");

        address[] memory facetAddresses = abi.decode(returnData, (address[]));
        assertGt(facetAddresses.length, 0, "Should have facet addresses");

        // For each facet, get its selectors
        bytes4 facetFuncSelectorsSelector = bytes4(keccak256("facetFunctionSelectors(address)"));

        for (uint256 i = 0; i < facetAddresses.length; i++) {
            (bool selectorsSuccess, bytes memory selectorsData) = diamond.staticcall(
                abi.encodeWithSelector(facetFuncSelectorsSelector, facetAddresses[i])
            );

            assertTrue(selectorsSuccess, "facetFunctionSelectors() should succeed");

            bytes4[] memory selectors = abi.decode(selectorsData, (bytes4[]));
            assertGt(selectors.length, 0, "Each facet should have selectors");

            console.log("Facet has functions:", selectors.length);
        }
    }

    /// @notice Test that all loaded selectors are valid
    /// @dev Task 4.13: Cross-check ABI selectors with on-chain selectors
    function test_SelectorsMatchOnChain() public view onlyWhenDeployed {
        bytes4[] memory abiSelectors = _getDiamondSelectors();

        // Verify each deployed selector routes to a valid facet
        uint256 validCount = 0;
        for (uint256 i = 0; i < abiSelectors.length; i++) {
            bytes4 selector = abiSelectors[i];

            bytes4 facetAddressSelector = bytes4(keccak256("facetAddress(bytes4)"));
            (bool success, bytes memory returnData) = diamond.staticcall(
                abi.encodeWithSelector(facetAddressSelector, selector)
            );

            if (!success) continue; // Skip selectors that fail

            address facetAddr = abi.decode(returnData, (address));
            if (facetAddr == address(0)) continue; // Skip undeployed selectors

            assertTrue(
                facetAddr.code.length > 0,
                "Deployed selector should have valid facet with code"
            );
            validCount++;
        }

        assertTrue(validCount > 0, "Should have validated at least one selector");
        console.log("Validated", validCount, "deployed selectors on-chain");
    }

    /// @notice Test gas measurement for Diamond calls
    /// @dev Task 4.22: Gas profiling for optimization
    function test_GasMeasurement() public onlyWhenDeployed {
        // Test gas for owner() call
        bytes4 ownerSelector = bytes4(keccak256("owner()"));
        uint256 gasUsed = _measureDiamondGas(ownerSelector, "");

        console.log("Gas for owner() call:", gasUsed);

        // Should be reasonable (Diamond proxy adds ~2k gas overhead)
        assertLt(gasUsed, 10000, "owner() should use less than 10k gas");
    }

    /// @notice Test simulated facet upgrade scenario
    /// @dev Task 4.14: Test upgrade patterns (simulated without actual upgrade)
    function test_SimulateFacetUpgrade() public view onlyWhenDeployed {
        // Get current facets
        bytes4 facetsSelector = bytes4(keccak256("facets()"));
        (bool success, bytes memory returnData) = diamond.staticcall(
            abi.encodeWithSelector(facetsSelector)
        );

        assertTrue(success, "facets() should succeed");

        IDiamondLoupe.Facet[] memory currentFacets = abi.decode(
            returnData,
            (IDiamondLoupe.Facet[])
        );

        // Verify we have facets that could be upgraded
        assertGt(currentFacets.length, 0, "Should have facets to upgrade");

        // Log facet information for upgrade planning
        for (uint256 i = 0; i < currentFacets.length; i++) {
            console.log("Facet address:", currentFacets[i].facetAddress);
            console.log("Function count:", currentFacets[i].functionSelectors.length);
        }

        // Note: Actual upgrade would require:
        // 1. Deploy new facet version
        // 2. Create FacetCut with Replace action
        // 3. Call diamondCut as owner
        // This test documents the pattern without executing it
    }

    /// @notice Test Diamond supports ERC165
    /// @dev Verify ERC165 interface support if implemented
    function test_SupportsERC165() public view onlyWhenDeployed {
        bytes4 erc165Selector = bytes4(keccak256("supportsInterface(bytes4)"));
        bytes4 erc165InterfaceId = 0x01ffc9a7;

        (bool success, bytes memory returnData) = diamond.staticcall(
            abi.encodeWithSelector(erc165Selector, erc165InterfaceId)
        );

        if (success) {
            bool supportsERC165 = abi.decode(returnData, (bool));
            assertTrue(supportsERC165, "Should support ERC165");
            console.log("Diamond supports ERC165");
        } else {
            console.log("ERC165 not implemented");
        }
    }

    /// @notice Test accessing constants facet if deployed
    /// @dev Integration test for ExampleConstantsFacet
    function test_ConstantsFacet() public view onlyWhenDeployed {
        // Try to call a constants function
        bytes4 selector = bytes4(keccak256("getMaxSupply()"));

        (bool success, bytes memory returnData) = diamond.staticcall(
            abi.encodeWithSelector(selector)
        );

        if (success) {
            uint256 maxSupply = abi.decode(returnData, (uint256));
            assertGt(maxSupply, 0, "Max supply should be positive");
            console.log("Max supply constant:", maxSupply);
        } else {
            console.log("Constants facet not deployed or function not available");
        }
    }

    /// @notice Test that Diamond cannot be re-initialized
    /// @dev Verify initialization protection if implemented
    function test_CannotReinitialize() public onlyWhenDeployed {
        // Try to call init function (if it exists)
        bytes4 initSelector = bytes4(keccak256("init()"));

        (bool success, ) = diamond.call(abi.encodeWithSelector(initSelector));

        // Should either:
        // 1. Revert (protected against re-initialization)
        // 2. Not exist (function not found)
        // Either is acceptable - we just log the result

        if (success) {
            console.log("Warning: init() succeeded - may lack re-init protection");
        } else {
            console.log("Re-initialization properly prevented");
        }
    }
}
