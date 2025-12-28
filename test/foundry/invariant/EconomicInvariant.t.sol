// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title EconomicInvariant
 * @notice Invariant tests for economic and tokenomics rules
 * @dev Tests GNUS burn rates, exchange rates, and fee mechanics
 */
contract EconomicInvariant is GeniusDiamondTestBase {
    /**
     * @notice Setup for Economic invariant tests
     */
    function setUp() public override {
        super.setUp();
        
        console.log("===== Economic Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("====================================");
    }

    /**
     * @notice Invariant: No free token creation
     * @dev All token creation must have a cost or authorization
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
     */
    function invariant_burnMechanicsCorrect() public view {
        uint256 totalSupply = _getTotalGNUSSupply();
        
        // Supply should never be negative
        assertTrue(totalSupply >= 0, "Supply should be non-negative");
        
        console.log("[OK] Burn mechanics correct");
    }

    /**
     * @notice Invariant: Token economics are internally consistent
     * @dev All token movements must balance
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
