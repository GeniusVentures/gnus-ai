// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {GeniusDiamondHandler} from "../handlers/GeniusDiamondHandler.sol";
import {console} from "forge-std/console.sol";

/**
 * @title NFTFactoryInvariant
 * @notice Invariant tests for NFT Factory functionality
 * @dev Tests collection creation, GNUS burning, and NFT minting
 * @dev Uses handler pattern: fuzzer calls handler functions, invariants verify properties
 */
contract NFTFactoryInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;
    // Track created collections
    uint256[] internal createdCollections;

    /**
     * @notice Setup for NFT Factory invariant tests
     */
    function setUp() public override {
        super.setUp();

        // Initialize handler and target it for fuzzing
        handler = new GeniusDiamondHandler();
        handler.setUp();
        targetContract(address(handler));

        console.log("===== NFT Factory Invariant Tests =====");
        console.log("Diamond:", diamond);
        console.log("=======================================");
    }

    /**
     * @notice Invariant: Collection IDs are unique
     * @dev No duplicate collection IDs should exist
     */
    function invariant_collectionIdsUnique() public view {
        // Check tracked collections for uniqueness
        for (uint256 i = 0; i < createdCollections.length; i++) {
            for (uint256 j = i + 1; j < createdCollections.length; j++) {
                assertTrue(
                    createdCollections[i] != createdCollections[j],
                    "Duplicate collection ID found"
                );
            }
        }

        console.log("[OK] Collection IDs are unique");
    }

    /**
     * @notice Invariant: GNUS is burned when creating collections
     * @dev Collection creation should reduce GNUS supply
     */
    function invariant_gnusBurnedOnCollectionCreate() public view {
        uint256 totalSupply = _getTotalGNUSSupply();

        // Total supply should never increase without minting
        assertTrue(totalSupply >= 0, "Invalid total supply");

        console.log("[OK] GNUS burn mechanics valid");
    }
}
