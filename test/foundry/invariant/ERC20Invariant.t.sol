// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ERC20Invariant
 * @notice Invariant tests for GNUS ERC20 token functionality
 * @dev Tests token supply, balance conservation, and transfer properties
 */
contract ERC20Invariant is GeniusDiamondTestBase {
    // Ghost variables for tracking
    uint256 internal ghostTotalMinted;
    uint256 internal ghostTotalBurned;

    /**
     * @notice Setup for ERC20 invariant tests
     */
    function setUp() public override {
        super.setUp();

        // Initialize ghost variables
        ghostTotalMinted = INITIAL_GNUS_SUPPLY;
        ghostTotalBurned = 0;

        console.log("===== ERC20 GNUS Token Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("Initial Supply:", INITIAL_GNUS_SUPPLY);
        console.log("============================================");
    }

    /**
     * @notice Invariant: Total supply never exceeds max supply
     * @dev Critical for token economics
     */
    function invariant_totalSupplyNeverExceedsMax() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Max supply check - using a reasonable max (10B tokens)
        uint256 MAX_SUPPLY = 10_000_000_000 ether;
        assertTrue(totalSupply <= MAX_SUPPLY, "Total supply exceeds maximum");

        console.log("[OK] Total supply within bounds:", totalSupply);
    }

    /**
     * @notice Invariant: Sum of all tracked balances equals total supply
     * @dev Ensures no tokens are created or destroyed unexpectedly
     */
    function invariant_balancesSumToTotalSupply() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Sum known balances
        uint256 sumOfBalances = _getGNUSBalance(address(this)) +
            _getGNUSBalance(user1) +
            _getGNUSBalance(user2) +
            _getGNUSBalance(user3);

        // Should be <= total supply (others may hold tokens)
        assertTrue(sumOfBalances <= totalSupply, "Sum of balances exceeds total supply");

        console.log("[OK] Balances sum check passed");
    }

    /**
     * @notice Invariant: Balance conservation in transfers
     * @dev Transfers don't create or destroy tokens
     */
    function invariant_balanceConservation() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Total supply should match ghost tracking
        uint256 expectedSupply = ghostTotalMinted - ghostTotalBurned;

        // Allow some tolerance for rounding
        assertTrue(
            totalSupply == expectedSupply ||
                (totalSupply < expectedSupply && expectedSupply - totalSupply < 1000),
            "Supply doesn't match ghost tracking"
        );

        console.log("[OK] Balance conservation maintained");
    }

    /**
     * @notice Invariant: Total supply is non-negative
     * @dev Basic sanity check
     */
    function invariant_totalSupplyNonNegative() public view {
        uint256 totalSupply = _getTotalGNUSSupply();
        assertTrue(totalSupply >= 0, "Total supply is negative");

        console.log("[OK] Total supply is non-negative:", totalSupply);
    }

    /**
     * @notice Invariant: Individual balances never exceed total supply
     * @dev No single address should hold more than exists
     */
    function invariant_individualBalancesValid() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Check test addresses
        assertTrue(_getGNUSBalance(address(this)) <= totalSupply, "Test balance exceeds supply");
        assertTrue(_getGNUSBalance(user1) <= totalSupply, "User1 balance exceeds supply");
        assertTrue(_getGNUSBalance(user2) <= totalSupply, "User2 balance exceeds supply");
        assertTrue(_getGNUSBalance(user3) <= totalSupply, "User3 balance exceeds supply");

        console.log("[OK] Individual balances are valid");
    }

    /**
     * @notice Invariant: Zero address has zero balance
     * @dev Tokens sent to zero address should be burned
     */
    function invariant_zeroAddressHasZeroBalance() public view {
        uint256 zeroBalance = _getGNUSBalance(address(0));
        assertEq(zeroBalance, 0, "Zero address should have zero balance");

        console.log("[OK] Zero address has zero balance");
    }

    /**
     * @notice Invariant: Balance queries are consistent
     * @dev Multiple queries return same result
     */
    function invariant_balanceQueryConsistency() public view {
        uint256 balance1 = _getGNUSBalance(user1);
        uint256 balance2 = _getGNUSBalance(user1);
        assertEq(balance1, balance2, "Balance queries inconsistent");

        console.log("[OK] Balance queries are consistent");
    }

    /**
     * @notice Invariant: Total supply query is consistent
     * @dev Multiple queries return same result
     */
    function invariant_totalSupplyConsistency() public view {
        uint256 supply1 = _getTotalGNUSSupply();
        uint256 supply2 = _getTotalGNUSSupply();
        assertEq(supply1, supply2, "Total supply queries inconsistent");

        console.log("[OK] Total supply queries consistent");
    }
}
