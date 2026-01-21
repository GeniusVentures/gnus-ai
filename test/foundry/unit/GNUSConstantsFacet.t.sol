// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../../../contracts/gnus-ai/GNUSConstants.sol";

/// @title GNUSConstants Test
/// @notice Test suite for verifying the constants defined in GNUSConstants
contract GNUSConstantsTest is Test {
    function setUp() public {
        // Setup code if needed
    }

    /// @notice Test that GNUS token name is correctly defined
    function test_GNUSName() public pure {
        assertEq(GNUS_NAME, "Genius Tokens");
    }

    /// @notice Test that GNUS token symbol is correctly defined
    function test_GNUSSymbol() public pure {
        assertEq(GNUS_SYMBOL, "GNUS");
    }

    /// @notice Test that GNUS decimals is correctly defined
    function test_GNUSDecimals() public pure {
        assertEq(GNUS_DECIMALS, 10 ** 18);
    }

    /// @notice Test that GNUS max supply is correctly calculated
    function test_GNUSMaxSupply() public pure {
        assertEq(GNUS_MAX_SUPPLY, 50000000 * 10 ** 18);
        assertEq(GNUS_MAX_SUPPLY, 50000000000000000000000000);
    }

    /// @notice Test that GNUS URI is correctly defined
    function test_GNUSURI() public pure {
        assertEq(GNUS_URI, "https://nft.gnus.ai/{id}");
    }

    /// @notice Test that GNUS token ID is correctly defined
    function test_GNUSTokenID() public pure {
        assertEq(GNUS_TOKEN_ID, 0);
    }

    /// @notice Test that MAX_UINT128 is correctly defined
    function test_MaxUint128() public pure {
        assertEq(MAX_UINT128, type(uint128).max);
        assertEq(MAX_UINT128, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
    }

    /// @notice Test that PARENT_MASK is correctly calculated
    function test_ParentMask() public pure {
        uint256 expected = uint256(type(uint128).max) << 128;
        assertEq(PARENT_MASK, expected);
    }

    /// @notice Test that CHILD_MASK is correctly defined
    function test_ChildMask() public pure {
        assertEq(CHILD_MASK, type(uint128).max);
    }

    /// @notice Test that ETHER address is correctly defined
    function test_EtherAddress() public pure {
        assertEq(ETHER, 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    }

    /// @notice Test that PARENT_MASK and CHILD_MASK don't overlap
    function test_MasksDoNotOverlap() public pure {
        assertEq(PARENT_MASK & CHILD_MASK, 0);
    }

    /// @notice Test that combining masks covers full uint256
    function test_MasksCoverFullRange() public pure {
        assertEq(PARENT_MASK | CHILD_MASK, type(uint256).max);
    }
}
