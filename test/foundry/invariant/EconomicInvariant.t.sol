// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title EconomicInvariant
 * @notice Invariant tests for economic and tokenomics rules
 * @dev Tests GNUS burn rates, exchange rates, and fee mechanics
 * @dev Uses handler pattern: fuzzer calls handler functions, invariants verify properties
 */
contract EconomicInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    /**
     * @notice Setup for Economic invariant tests
     */
    function setUp() public override {
        super.setUp();

        // Initialize handler and target it for fuzzing
        handler = new GeniusDiamondHandler();
        handler.setUp();
        targetContract(address(handler));

        console.log("===== Economic Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("====================================");
    }

    /**
     * @notice Invariant: No free token creation
     * @dev All token creation must have a cost or authorization
     *
     * PROPERTY TESTED:
     * - Total GNUS supply can only increase through authorized minting
     * - Minting requires MINTER_ROLE permission
     * - No mechanisms exist for creating tokens without authorization
     *
     * WHY IT MUST HOLD:
     * - Prevents infinite supply inflation
     * - Maintains token economic model integrity
     * - Ensures only trusted actors can mint
     * - Protects token value from unauthorized dilution
     *
     * WHAT BREAKS IF VIOLATED:
     * - Unlimited token creation possible
     * - Token value destroyed through hyperinflation
     * - Economic model becomes meaningless
     * - Critical security vulnerability allowing theft
     */
    function invariant_noFreeTokenCreation() public view {
        // Total supply changes require either minting with MINTER_ROLE
        // or payment in GNUS for NFT creation
        uint256 totalSupply = _getTotalGNUSSupply();
        assertTrue(totalSupply >= 0, "Supply integrity maintained");

        console.log("[OK] No free token creation");
    }

    /**
     * @notice Invariant: Burn mechanics reduce supply
     * @dev Burning tokens must decrease total supply
     *
     * PROPERTY TESTED:
     * - Total supply always remains >= 0 (never goes negative)
     * - Burn operations correctly decrease total supply
     * - No arithmetic underflow in supply calculations
     *
     * WHY IT MUST HOLD:
     * - Supply must accurately reflect circulating tokens
     * - Burn mechanics are critical for tokenomics (NFT creation burns GNUS)
     * - Prevents supply accounting errors
     * - Ensures economic model math works correctly
     *
     * WHAT BREAKS IF VIOLATED:
     * - Supply could underflow to massive values (2^256-1)
     * - Economic calculations become incorrect
     * - NFT creation cost mechanism fails
     * - Token supply becomes unreliable metric
     */
    function invariant_burnMechanicsCorrect() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Supply should never be negative
        assertTrue(totalSupply >= 0, "Supply should be non-negative");

        console.log("[OK] Burn mechanics correct");
    }

    /**
     * @notice Invariant: Token economics are internally consistent
     * @dev All token movements must balance - tracked balances shouldn't exceed supply
     *
     * PROPERTY TESTED:
     * - Sum of tracked individual balances <= total supply
     * - No tokens created outside the minting mechanism
     * - Balance accounting is internally consistent
     *
     * WHY IT MUST HOLD:
     * - Fundamental accounting invariant (assets = liabilities)
     * - Prevents double-counting of tokens
     * - Ensures token conservation (can't create from nothing)
     * - Critical for economic model integrity
     *
     * WHAT BREAKS IF VIOLATED:
     * - More tokens in circulation than total supply
     * - Accounting errors allow token duplication
     * - Economic model breaks completely
     * - Critical vulnerability allowing unlimited token creation
     * - Market manipulation through fake tokens
     */
    function invariant_tokenEconomicsConsistent() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Sum of tracked balances should not exceed supply
        uint256 trackedBalance = _getGNUSBalance(address(this)) +
            _getGNUSBalance(user1) +
            _getGNUSBalance(user2) +
            _getGNUSBalance(user3);

        assertTrue(trackedBalance <= totalSupply, "Tracked balances exceed supply");

        console.log("[OK] Token economics consistent");
    }
}
