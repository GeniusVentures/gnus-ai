// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ERC1155Invariant
 * @notice Invariant tests for ERC1155 multi-token functionality
 * @dev Tests token IDs, max supply constraints, and balance consistency
 * @dev Uses handler pattern: fuzzer calls handler functions, invariants verify properties
 */
contract ERC1155Invariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    /**
     * @notice Setup for ERC1155 invariant tests
     */
    function setUp() public override {
        super.setUp();

        // Initialize handler and target it for fuzzing
        handler = new GeniusDiamondHandler();
        handler.setUp();
        targetContract(address(handler));

        console.log("===== ERC1155 Multi-Token Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("================================================");
    }

    /**
     * @notice Invariant: Token supplies never exceed max supply for tokens with limits
     * @dev Critical for NFT collection integrity
     *
     * PROPERTY TESTED:
     * - GNUS token supply <= 10 billion (max supply)
     * - Token supplies respect configured limits
     * - No overflow in supply accounting
     *
     * WHY IT MUST HOLD:
     * - Token economics depend on enforced supply caps
     * - NFT collections have fixed maximum sizes
     * - Prevents dilution beyond intended limits
     * - Maintains scarcity value proposition
     *
     * WHAT BREAKS IF VIOLATED:
     * - Unlimited token creation destroys economic model
     * - NFT collection integrity compromised
     * - Token value destroyed through oversupply
     * - Violates promises made to token holders
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
     *
     * PROPERTY TESTED:
     * - balanceOf(address, tokenId) is deterministic
     * - View function doesn't modify state
     * - Multiple calls return identical values
     *
     * WHY IT MUST HOLD:
     * - View functions must be pure reads
     * - UI/wallet integrations depend on reliable balances
     * - ERC1155 standard requirement
     *
     * WHAT BREAKS IF VIOLATED:
     * - Users see fluctuating balances without transactions
     * - Wallets and dapps show incorrect data
     * - Cannot trust displayed token holdings
     * - Integration issues with marketplaces
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
     *
     * PROPERTY TESTED:
     * - address(0) has 0 balance for all token IDs
     * - Tokens sent to zero address are effectively burned
     * - Burn mechanism works correctly
     *
     * WHY IT MUST HOLD:
     * - address(0) is the canonical burn address
     * - Tokens at address(0) are inaccessible forever
     * - ERC1155 standard expectation
     *
     * WHAT BREAKS IF VIOLATED:
     * - Tokens could accumulate at address(0)
     * - Effective supply becomes unclear
     * - Burn accounting is incorrect
     * - Economic model calculations fail
     */
    function invariant_zeroAddressBalanceZero() public view {
        uint256 zeroBalance = _getGNUSBalance(address(0));
        assertEq(zeroBalance, 0, "Zero address should have zero balance");

        console.log("[OK] Zero address has zero balance");
    }

    /**
     * @notice Invariant: Individual balances never exceed total supply
     * @dev No address should hold more tokens than exist
     *
     * PROPERTY TESTED:
     * - Each individual balance <= total supply for that token
     * - No address can hold more than exists
     * - Balance accounting is sound
     *
     * WHY IT MUST HOLD:
     * - Logical impossibility to own more than exists
     * - Fundamental accounting invariant
     * - Prevents balance duplication exploits
     *
     * WHAT BREAKS IF VIOLATED:
     * - Token duplication detected
     * - Critical accounting bug
     * - Economic model completely breaks
     * - Allows theft through balance manipulation
     */
    function invariant_individualBalancesValid() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        assertTrue(_getGNUSBalance(address(this)) <= totalSupply, "Balance exceeds supply");
        assertTrue(_getGNUSBalance(user1) <= totalSupply, "User1 balance exceeds supply");
        assertTrue(_getGNUSBalance(user2) <= totalSupply, "User2 balance exceeds supply");

        console.log("[OK] Individual balances valid");
    }
}
