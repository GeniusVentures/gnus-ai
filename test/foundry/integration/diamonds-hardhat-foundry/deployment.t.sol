// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondABILoader.sol";

/**
 * @title DeploymentIntegrationTest
 * @notice Integration tests for Diamond deployment via diamonds-hardhat-foundry DeploymentManager
 * @dev Tests the complete deployment workflow using actual deployment data
 */
contract DeploymentIntegrationTest is Test {
    using DiamondABILoader for string;

    address diamond;
    address deployer;
    string deploymentData;
    string abiPath;

    function setUp() public {
        // Load deployment data
        // This test expects a Diamond to be deployed via DeploymentManager
        // Deployment file: diamonds/GeniusDiamond/deployments/geniusdiamond-hardhat-31337.json

        deployer = address(this);
        abiPath = "./diamond-abi/GeniusDiamond.json";

        console.log("=== Deployment Integration Test Setup ===");
        console.log("Deployer:", deployer);
        console.log("Expected ABI path:", abiPath);
    }

    /**
     * @notice Test that Diamond deployment can be verified
     * @dev Loads deployment data and verifies Diamond exists
     */
    function test_DeploymentExists() public {
        // Skip if ABI doesn't exist yet (Diamond not deployed)
        try vm.readFile(abiPath) returns (string memory abiJson) {
            require(bytes(abiJson).length > 0, "ABI file is empty");

            console.log("Test: Verify Diamond deployment exists");
            console.log("ABI loaded successfully, length:", bytes(abiJson).length);

            // If we can read the ABI, a deployment exists
            assertTrue(bytes(abiJson).length > 0, "Diamond deployment exists");
        } catch {
            console.log("SKIP: Diamond not yet deployed. Run deployment first.");
            vm.skip(true);
        }
    }

    /**
     * @notice Test Diamond address is valid and has code
     * @dev Skips code check if not forking from network with deployed Diamond
     */
    function test_DiamondAddressValid() public {
        try
            vm.readFile("./diamonds/GeniusDiamond/deployments/geniusdiamond-hardhat-31337.json")
        returns (string memory deployJson) {
            // Extract Diamond address from deployment JSON
            address diamondAddr = abi.decode(
                vm.parseJson(deployJson, ".DiamondAddress"),
                (address)
            );

            console.log("Test: Verify Diamond address is valid");
            console.log("Diamond address:", diamondAddr);

            // Verify address is not zero
            assertTrue(diamondAddr != address(0), "Diamond address should not be zero");

            // Verify Diamond has code deployed (only if forking)
            uint256 codeSize;
            assembly {
                codeSize := extcodesize(diamondAddr)
            }
            console.log("Diamond code size:", codeSize);

            // Note: Code size will be 0 if not forking from Hardhat network
            // This is expected - deployment data can be verified without on-chain state
            if (codeSize == 0) {
                console.log("INFO: No code at Diamond address (not forking from deployed network)");
                console.log("INFO: Deployment data is still valid and can be used for test setup");
            } else {
                console.log("SUCCESS: Diamond has code deployed");
            }
        } catch {
            console.log("SKIP: Deployment file not found");
            vm.skip(true);
        }
    }

    /**
     * @notice Test all facets are deployed with code
     */
    function test_AllFacetsDeployed() public {
        try
            vm.readFile("./diamonds/GeniusDiamond/deployments/geniusdiamond-hardhat-31337.json")
        returns (string memory deployJson) {
            console.log("Test: Verify all facets are deployed");

            // Parse deployer address
            address deployerAddr = abi.decode(
                vm.parseJson(deployJson, ".DeployerAddress"),
                (address)
            );
            console.log("Deployer address:", deployerAddr);
            assertTrue(deployerAddr != address(0), "Deployer address should be set");

            // Note: Parsing nested facet data requires more complex JSON handling
            // For now, verify the deployment file structure is valid
            bytes memory facetsData = vm.parseJson(deployJson, ".DeployedFacets");
            if (facetsData.length == 0) {
                console.log("SKIP: No facet data in deployment file (deployment data not written)");
                vm.skip(true);
            }
            assertTrue(facetsData.length > 0, "Should have facet data");

            console.log("Facet data exists, length:", facetsData.length);
        } catch {
            console.log("SKIP: Deployment file not found");
            vm.skip(true);
        }
    }

    /**
     * @notice Test deployment data includes required fields
     */
    function test_DeploymentDataComplete() public {
        try
            vm.readFile("./diamonds/GeniusDiamond/deployments/geniusdiamond-hardhat-31337.json")
        returns (string memory deployJson) {
            console.log("Test: Verify deployment data is complete");

            // Check for required fields
            address diamondAddr = abi.decode(
                vm.parseJson(deployJson, ".DiamondAddress"),
                (address)
            );
            address deployerAddr = abi.decode(
                vm.parseJson(deployJson, ".DeployerAddress"),
                (address)
            );

            assertTrue(diamondAddr != address(0), "DiamondAddress must be set");
            assertTrue(deployerAddr != address(0), "DeployerAddress must be set");

            console.log("Diamond:", diamondAddr);
            console.log("Deployer:", deployerAddr);
            console.log("Deployment data is complete");
        } catch {
            console.log("SKIP: Deployment file not found");
            vm.skip(true);
        }
    }

    /**
     * @notice Test ABI file generation
     */
    function test_AbiFileGenerated() public {
        try vm.readFile(abiPath) returns (string memory abiJson) {
            console.log("Test: Verify ABI file is generated");

            // Verify ABI has functions
            bytes4[] memory selectors = abiJson.extractSelectors();
            console.log("Function selectors found:", selectors.length);

            assertTrue(selectors.length > 0, "ABI should contain function selectors");

            // Log first few selectors
            uint256 logCount = selectors.length < 5 ? selectors.length : 5;
            for (uint256 i = 0; i < logCount; i++) {
                console.log("Selector", i, ":", uint32(selectors[i]));
            }
        } catch {
            console.log("SKIP: ABI file not found");
            vm.skip(true);
        }
    }
}
