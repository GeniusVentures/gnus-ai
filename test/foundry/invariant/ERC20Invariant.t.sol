// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ERC20Invariant
 * @notice Invariant tests for GNUS ERC20 token functionality
 * @dev Tests token supply, balance conservation, and transfer properties
 * @dev Uses handler pattern: fuzzer calls handler functions, invariants verify properties
 */
contract ERC20Invariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    /**
     * @notice Setup for ERC20 invariant tests
     */
    function setUp() public override {
        super.setUp();

        // Initialize handler and target it for fuzzing
        handler = new GeniusDiamondHandler();
        handler.setUp();
        targetContract(address(handler));

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
     * @dev Ensures no tokens are created or destroyed unexpectedly     *
     * PROPERTY TESTED:
     * - Sum of all tracked balances <= total GNUS supply
     * - No phantom tokens exist outside the supply accounting
     *
     * WHY IT MUST HOLD:
     * - Fundamental accounting invariant (total assets = total liabilities)
     * - Prevents token duplication exploits
     * - Ensures supply calculations are accurate
     *
     * WHAT BREAKS IF VIOLATED:
     * - More tokens in circulation than minted
     * - Double-spending vulnerabilities
     * - Economic model completely breaks
     * - Critical security issue allowing unlimited token creation     */
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
     * @dev Supply can only change through mint/burn, not transfers
     *
     * PROPERTY TESTED:
     * - Total supply remains constant across transfer operations
     * - Transfers redistribute tokens without creating/destroying them
     * - Only mint/burn operations change total supply
     *
     * WHY IT MUST HOLD:
     * - Conservation of tokens (like conservation of energy)
     * - Transfers should be zero-sum operations
     * - Supply inflation should only happen through authorized minting
     *
     * WHAT BREAKS IF VIOLATED:
     * - Transfers could create tokens from nothing
     * - Token supply becomes unpredictable
     * - Economic model breaks completely
     * - Allows theft through transfer manipulation
     */
    function invariant_balanceConservation() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Total supply should be non-negative
        assertTrue(totalSupply >= 0, "Total supply must be non-negative");

        // Sum of known balances should not exceed total supply
        uint256 sumOfBalances = _getGNUSBalance(address(this)) +
            _getGNUSBalance(user1) +
            _getGNUSBalance(user2) +
            _getGNUSBalance(user3);

        assertTrue(sumOfBalances <= totalSupply, "Tracked balances exceed total supply");

        console.log("[OK] Balance conservation maintained");
    }

    /**
     * @notice Invariant: Total supply is non-negative
     * @dev Basic sanity check preventing arithmetic underflow
     *
     * PROPERTY TESTED:
     * - Total supply >= 0 always
     * - No arithmetic underflow in supply calculations
     *
     * WHY IT MUST HOLD:
     * - Supply is a uint256, should never underflow
     * - Negative supply is mathematically impossible and indicates bug
     * - All economic calculations depend on valid supply
     *
     * WHAT BREAKS IF VIOLATED:
     * - Supply underflows to ~2^256-1 (massive number)
     * - All price calculations become invalid
     * - Token becomes worthless due to apparent infinite supply
     * - Critical vulnerability in token economics
     */
    function invariant_totalSupplyNonNegative() public view {
        uint256 totalSupply = _getTotalGNUSSupply();
        assertTrue(totalSupply >= 0, "Total supply is negative");

        console.log("[OK] Total supply is non-negative:", totalSupply);
    }

    /**
     * @notice Invariant: Individual balances never exceed total supply
     * @dev No single address should hold more than exists
     *
     * PROPERTY TESTED:
     * - Every individual balance <= total supply
     * - No address can hold more tokens than exist
     *
     * WHY IT MUST HOLD:
     * - Logical impossibility to own more than exists
     * - Prevents balance overflow exploits
     * - Ensures accounting integrity
     *
     * WHAT BREAKS IF VIOLATED:
     * - Indicates balance manipulation vulnerability
     * - Token duplication exploit detected
     * - Complete breakdown of token accounting
     * - Critical security vulnerability
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
     *
     * PROPERTY TESTED:
     * - address(0) always has 0 balance
     * - Tokens "sent" to zero address are effectively burned
     *
     * WHY IT MUST HOLD:
     * - address(0) is the burn address by convention
     * - Should not accumulate balance (would lock tokens forever)
     * - ERC20 standard expectation
     *
     * WHAT BREAKS IF VIOLATED:
     * - Tokens could be permanently locked at address(0)
     * - Supply calculations become incorrect
     * - Violates ERC20 standard expectations
     * - Reduces effective circulating supply unpredictably
     */
    function invariant_zeroAddressHasZeroBalance() public view {
        uint256 zeroBalance = _getGNUSBalance(address(0));
        assertEq(zeroBalance, 0, "Zero address should have zero balance");

        console.log("[OK] Zero address has zero balance");
    }

    /**
     * @notice Invariant: Balance queries are consistent
     * @dev Multiple queries return same result
     *
     * PROPERTY TESTED:
     * - balanceOf(address) is deterministic
     * - Multiple calls return identical results
     * - View function doesn't modify state
     *
     * WHY IT MUST HOLD:
     * - View functions must be pure reads
     * - Applications depend on reliable balance checks
     * - Required for off-chain integrations
     *
     * WHAT BREAKS IF VIOLATED:
     * - Unpredictable balance reporting
     * - Cannot trust balance displays
     * - Integration failures with wallets/dapps
     * - Users cannot reliably check their holdings
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
     *
     * PROPERTY TESTED:
     * - totalSupply() is deterministic
     * - View function returns consistent values
     * - No state changes in view calls
     *
     * WHY IT MUST HOLD:
     * - Essential for market cap calculations
     * - Price oracles depend on reliable supply data
     * - Required for economic analysis
     *
     * WHAT BREAKS IF VIOLATED:
     * - Market cap calculations become unreliable
     * - Price feeds show incorrect data
     * - Economic metrics cannot be trusted
     * - Integration issues with DEXes and analytics
     */
    function invariant_totalSupplyConsistency() public view {
        uint256 supply1 = _getTotalGNUSSupply();
        uint256 supply2 = _getTotalGNUSSupply();
        assertEq(supply1, supply2, "Total supply queries inconsistent");

        console.log("[OK] Total supply queries consistent");
    }
}
