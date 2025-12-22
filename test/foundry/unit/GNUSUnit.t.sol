// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondForgeHelpers.sol";
import "../helpers/DiamondDeployment.sol";

/**
 * @title ExampleUnitTest
 * @notice Example unit test for Diamond contract
 * @dev This is a template - customize for your specific Diamond implementation
 */
contract ExampleUnitTest is Test {
    using DiamondForgeHelpers for address;

    address diamond;
    address deployer;

    function setUp() public {
        // Load Diamond deployment data
        diamond = DiamondDeployment.getDiamondAddress();
        deployer = DiamondDeployment.getDeployerAddress();

        console.log("Diamond deployed at:", diamond);
        console.log("Deployed by:", deployer);

        // Validate Diamond deployment
        DiamondForgeHelpers.assertValidDiamond(diamond);
    }

    /**
     * @notice Test that Diamond was deployed successfully
     */
    function test_DiamondDeployed() public view {
        // Check that Diamond address is not zero
        assertNotEq(diamond, address(0), "Diamond address should not be zero");

        // Check that Diamond has code
        address diamondAddr = diamond;
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }
        assertGt(codeSize, 0, "Diamond should have code deployed");
    }

    /**
     * @notice Test that deployer address is set correctly
     */
    function test_DeployerSet() public view {
        assertNotEq(deployer, address(0), "Deployer address should not be zero");
    }

    /**
     * @notice Example test - customize for your Diamond's functionality
     */
    function test_ExampleFunctionality() public {
        // TODO: Add your Diamond-specific tests here
        // Example:
        // MyDiamond(diamond).someFunction();
        // assertEq(result, expectedValue);

        assertTrue(true, "Replace this with actual test");
    }
}
