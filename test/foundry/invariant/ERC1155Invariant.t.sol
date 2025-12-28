// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ERC1155Invariant
 * @notice Invariant tests for ERC1155 multi-token functionality
 * @dev Tests token IDs, max supply constraints, and balance consistency
 */
contract ERC1155Invariant is GeniusDiamondTestBase {
    /**
     * @notice Setup for ERC1155 invariant tests
     */
    function setUp() public override {
        super.setUp();

        console.log("===== ERC1155 Multi-Token Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("================================================");
    }

    /**
     * @notice Invariant: Token supplies never exceed max supply for tokens with limits
     * @dev Critical for NFT collection integrity
     */
    function invariant_tokenSupplyNeverExceedsMax() public view {
        // GNUS token (ID 0) should have supply tracking
        uint256 gnusSupply = _getTotalGNUSSupply();
        uint256 MAX_SUPPLY = 10_000_000_000 ether;

        assertTrue(gnusSupply <= MAX_SUPPLY, "GNUS supply exceeds max");

        console.log("[OK] Token supplies within max bounds");
    }

    /**
     * @notice Invariant: balanceOf returns consistent results
     * @dev Multiple queries should return same value
     */
    function invariant_balanceConsistency() public view {
        uint256 balance1 = _getGNUSBalance(user1);
        uint256 balance2 = _getGNUSBalance(user1);

        assertEq(balance1, balance2, "Balance queries inconsistent");

        console.log("[OK] Balance queries are consistent");
    }

    /**
     * @notice Invariant: Zero address always has zero balance
     * @dev Tokens sent to zero should be burned
     */
    function invariant_zeroAddressBalanceZero() public view {
        uint256 zeroBalance = _getGNUSBalance(address(0));
        assertEq(zeroBalance, 0, "Zero address should have zero balance");

        console.log("[OK] Zero address has zero balance");
    }

    /**
     * @notice Invariant: Individual balances never exceed total supply
     * @dev No address should hold more tokens than exist
     */
    function invariant_individualBalancesValid() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        assertTrue(_getGNUSBalance(address(this)) <= totalSupply, "Balance exceeds supply");
        assertTrue(_getGNUSBalance(user1) <= totalSupply, "User1 balance exceeds supply");
        assertTrue(_getGNUSBalance(user2) <= totalSupply, "User2 balance exceeds supply");

        console.log("[OK] Individual balances valid");
    }
}
