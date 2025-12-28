// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {DiamondFuzzBase} from "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import {DiamondDeployment} from "../helpers/DiamondDeployment.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

/**
 * @title GeniusDiamondTestBase
 * @notice Base contract for all GeniusDiamond fuzz and invariant tests
 * @dev Extends DiamondFuzzBase with GeniusDiamond-specific setup and helpers
 * @dev All test contracts should inherit from this base
 */
abstract contract GeniusDiamondTestBase is DiamondFuzzBase {
    // ========================================
    // Role Constants (from GeniusAccessControl)
    // ========================================
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ========================================
    // Token Constants
    // ========================================
    uint256 public constant GNUS_TOKEN_ID = 0; // GNUS is token ID 0 in ERC1155
    uint256 public constant INITIAL_GNUS_SUPPLY = 1000000 ether; // 1M GNUS for testing

    // ========================================
    // Test Actors
    // ========================================
    address public deployer;
    address public owner;
    address public user1;
    address public user2;
    address public user3;
    address public attacker;

    /**
     * @notice Override to provide Diamond address from DiamondDeployment helper
     * @return diamondAddress The deployed GeniusDiamond address
     */
    function _loadDiamondAddress() internal pure override returns (address diamondAddress) {
        return DiamondDeployment.getDiamondAddress();
    }

    /**
     * @notice Override to provide Diamond ABI path from DiamondDeployment helper
     * @return abiPath The path to the GeniusDiamond ABI file
     */
    function _getDiamondABIPath() internal pure override returns (string memory abiPath) {
        return DiamondDeployment.getDiamondABIPath();
    }

    /**
     * @notice Setup function - called before each test
     * @dev Sets up the diamond, test actors, and grants necessary roles
     */
    function setUp() public virtual override {
        // Load diamond and ABI from parent
        super.setUp();

        // Load deployer and owner from deployment data
        deployer = DiamondDeployment.getDeployerAddress();
        owner = _getDiamondOwner();

        // Create test actors
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        attacker = makeAddr("attacker");

        // Grant test contract DEFAULT_ADMIN_ROLE for role management in tests
        vm.prank(owner);
        _grantRoleToSelf(DEFAULT_ADMIN_ROLE);

        // Setup initial token balances for testing
        _setupInitialBalances();

        console.log("===== GeniusDiamond Test Setup =====");
        console.log("Diamond:", diamond);
        console.log("Owner:", owner);
        console.log("Deployer:", deployer);
        console.log("Test Contract:", address(this));
        console.log("===================================");
    }

    // ========================================
    // Setup Helpers
    // ========================================

    /**
     * @notice Setup initial GNUS token balances for test actors
     * @dev Mints initial supply to test contract and distributes to users
     */
    function _setupInitialBalances() internal virtual {
        // Grant MINTER_ROLE to this contract for initial setup
        vm.prank(owner);
        _grantRoleToSelf(MINTER_ROLE);

        // Mint initial GNUS supply to test contract
        _mintGNUS(address(this), INITIAL_GNUS_SUPPLY);

        // Distribute to test users
        _transferGNUS(address(this), user1, 100000 ether);
        _transferGNUS(address(this), user2, 100000 ether);
        _transferGNUS(address(this), user3, 100000 ether);
    }

    // ========================================
    // Role Management Helpers
    // ========================================

    /**
     * @notice Grant MINTER_ROLE to an address
     * @param account Address to grant role to
     */
    function _grantMinterRole(address account) internal {
        _grantRole(MINTER_ROLE, account);
    }

    /**
     * @notice Grant PAUSER_ROLE to an address
     * @param account Address to grant role to
     */
    function _grantPauserRole(address account) internal {
        _grantRole(PAUSER_ROLE, account);
    }

    /**
     * @notice Grant UPGRADER_ROLE to an address
     * @param account Address to grant role to
     */
    function _grantUpgraderRole(address account) internal {
        _grantRole(UPGRADER_ROLE, account);
    }

    /**
     * @notice Check if address has MINTER_ROLE
     * @param account Address to check
     * @return hasMinterRole True if account has MINTER_ROLE
     */
    function _hasMinterRole(address account) internal view returns (bool) {
        return _hasRole(MINTER_ROLE, account);
    }

    // ========================================
    // Token Operation Helpers
    // ========================================

    /**
     * @notice Mint GNUS tokens (ERC1155 token ID 0)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function _mintGNUS(address to, uint256 amount) internal {
        bytes4 selector = bytes4(keccak256("mint(address,uint256,uint256,bytes)"));
        bytes memory data = abi.encode(to, GNUS_TOKEN_ID, amount, "");
        (bool success, bytes memory returnData) = _callDiamond(selector, data);
        require(success, string(abi.encodePacked("_mintGNUS failed: ", returnData)));
    }

    /**
     * @notice Transfer GNUS tokens using ERC1155 safeTransferFrom
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function _transferGNUS(address from, address to, uint256 amount) internal {
        bytes memory callData = abi.encodeWithSignature(
            "safeTransferFrom(address,address,uint256,uint256,bytes)",
            from,
            to,
            GNUS_TOKEN_ID,
            amount,
            ""
        );
        vm.prank(from);
        (bool success, bytes memory returnData) = diamond.call(callData);
        require(success, string(abi.encodePacked("_transferGNUS failed: ", returnData)));
    }

    /**
     * @notice Get GNUS balance of an address
     * @param account Address to check
     * @return balance GNUS balance
     */
    function _getGNUSBalance(address account) internal view returns (uint256) {
        bytes memory callData = abi.encodeWithSignature("balanceOf(address,uint256)", account, GNUS_TOKEN_ID);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        if (!success) return 0;
        return abi.decode(returnData, (uint256));
    }

    /**
     * @notice Get total GNUS supply
     * @return totalSupply Total GNUS tokens in circulation
     */
    function _getTotalGNUSSupply() internal view returns (uint256) {
        bytes memory callData = abi.encodeWithSignature("totalSupply(uint256)", GNUS_TOKEN_ID);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        if (!success) return 0;
        return abi.decode(returnData, (uint256));
    }

    // ========================================
    // Diamond Operation Helpers
    // ========================================

    /**
     * @notice Get all facets in the diamond
     * @return facets Array of Facet structs as encoded data
     */
    function _getFacets() internal view returns (bytes memory) {
        bytes memory callData = abi.encodeWithSignature("facets()");
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        require(success, "facets() call failed");
        return returnData;
    }

    /**
     * @notice Get facet address for a specific selector
     * @param selector Function selector
     * @return facetAddress Address of facet implementing this function
     */
    function _getFacetAddress(bytes4 selector) internal view returns (address) {
        bytes memory callData = abi.encodeWithSignature("facetAddress(bytes4)", selector);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        if (!success) return address(0);
        return abi.decode(returnData, (address));
    }

    /**
     * @notice Get all function selectors for a facet
     * @param facet Facet address
     * @return selectors Array of function selectors
     */
    function _getFacetFunctionSelectors(address facet) internal view returns (bytes4[] memory) {
        bytes memory callData = abi.encodeWithSignature("facetFunctionSelectors(address)", facet);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        if (!success) {
            return new bytes4[](0);
        }
        return abi.decode(returnData, (bytes4[]));
    }

    // ========================================
    // Assertion Helpers
    // ========================================

    /**
     * @notice Assert that an address has a specific role
     * @param role Role identifier
     * @param account Address to check
     */
    function assertHasRole(bytes32 role, address account) internal {
        assertTrue(_hasRole(role, account), "Account should have role");
    }

    /**
     * @notice Assert that an address does not have a specific role
     * @param role Role identifier
     * @param account Address to check
     */
    function assertDoesNotHaveRole(bytes32 role, address account) internal {
        assertFalse(_hasRole(role, account), "Account should not have role");
    }

    /**
     * @notice Assert GNUS balance equals expected amount
     * @param account Address to check
     * @param expected Expected balance
     */
    function assertGNUSBalance(address account, uint256 expected) internal {
        uint256 actual = _getGNUSBalance(account);
        assertEq(actual, expected, "GNUS balance mismatch");
    }

    /**
     * @notice Assert that all selectors route to valid (non-zero) facets
     */
    function assertAllSelectorsValid() internal {
        bytes4[] memory selectors = _getDiamondSelectors();
        for (uint256 i = 0; i < selectors.length; i++) {
            address facet = _getFacetAddress(selectors[i]);
            assertTrue(facet != address(0), "Selector has no facet");
        }
    }

    // ========================================
    // Utility Functions
    // ========================================

    /**
     * @notice Bound a uint256 value between min and max
     * @param value Value to bound
     * @param min Minimum value
     * @param max Maximum value
     * @return bounded Bounded value
     */
    function _boundUint256(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (max == min) return min;
        return min + (value % (max - min + 1));
    }

    /**
     * @notice Bound an address to exclude zero address and precompiles
     * @param addr Address to bound
     * @return bounded Non-zero address > 0x09
     */
    function _boundAddress(address addr) internal pure returns (address) {
        uint160 addrUint = uint160(addr);
        if (addrUint <= 9) {
            return address(uint160(10 + (addrUint % 1000)));
        }
        return addr;
    }
}
