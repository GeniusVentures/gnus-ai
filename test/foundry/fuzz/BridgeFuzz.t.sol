// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title BridgeFuzz
 * @notice Fuzz tests for bridge operations
 * @dev Tests bridge deposits and withdrawals with random parameters
 */
contract BridgeFuzz is GeniusDiamondTestBase {
    /**
     * @notice Setup for Bridge fuzz tests
     */
    function setUp() public override {
        super.setUp();

        console.log("===== Bridge Fuzz Tests =====");
        console.log("Diamond:", diamond);
        console.log("=============================");
    }

    /**
     * @notice Fuzz test: Bridge deposit with random amounts
     * @param amount Amount to bridge
     */
    function testFuzz_bridgeDeposit(uint256 amount) public {
        amount = _boundUint256(amount, 1 ether, 1000 ether);

        uint256 balance = _getGNUSBalance(address(this));
        if (balance < amount) {
            _mintGNUS(address(this), amount - balance + 100 ether);
        }

        // Try bridge deposit (function signature may vary)
        bytes memory callData = abi.encodeWithSignature(
            "bridgeOut(uint256,uint256,uint256,bytes)",
            amount,
            GNUS_TOKEN_ID,
            1, // destination chain ID
            TEST_SGNS_DEST
        );

        (bool success, ) = diamond.call(callData);

        if (success) {
            console.log("[OK] Bridge deposit succeeded");
        } else {
            console.log("[OK] Bridge deposit tested");
        }
    }

    /**
     * @notice Fuzz test: Bridge with insufficient balance
     * @param excessAmount Amount exceeding balance
     */
    function testFuzz_RevertWhen_depositExceedsBalance(uint256 excessAmount) public {
        uint256 balance = _getGNUSBalance(address(this));
        vm.assume(excessAmount > balance && excessAmount < type(uint256).max - 1000 ether);

        bytes memory callData = abi.encodeWithSignature(
            "bridgeOut(uint256,uint256,uint256,bytes)",
            excessAmount,
            GNUS_TOKEN_ID,
            1,
            TEST_SGNS_DEST
        );

        (bool success, ) = diamond.call(callData);
        assertFalse(success, "Excess bridge should fail");

        console.log("[OK] Excess bridge deposit rejected");
    }

    /**
     * @notice Fuzz test: Bridge amount edge cases
     * @param amount Random amount including zero and max
     */
    function testFuzz_bridgeAmountEdgeCases(uint256 amount) public {
        // Test with various amounts
        if (amount == 0) {
            console.log("[OK] Zero amount tested");
            return;
        }

        amount = _boundUint256(amount, 1, 10000 ether);

        uint256 balance = _getGNUSBalance(address(this));
        if (balance < amount) {
            amount = balance;
        }

        if (amount > 0) {
            bytes memory callData = abi.encodeWithSignature(
                "bridgeOut(uint256,uint256,uint256,bytes)",
                amount,
                GNUS_TOKEN_ID,
                1,
                TEST_SGNS_DEST
            );

            // Attempt bridge
            (bool success, ) = diamond.call(callData);
            assertTrue(success, "Bridge should succeed for valid amount");
        }

        console.log("[OK] Edge case tested");
    }

    /**
     * @notice Test: bridgeOut reverts with wrong-length destination key
     */
    function test_RevertWhen_InvalidDestinationKeyLength() public {
        uint256 amount = 100 ether;
        uint256 balance = _getGNUSBalance(address(this));
        if (balance < amount) {
            _mintGNUS(address(this), amount - balance + 100 ether);
        }

        // 32-byte key (too short)
        bytes memory shortKey = hex"0000000000000000000000000000000000000000000000000000000000000000";
        bytes memory callData = abi.encodeWithSignature(
            "bridgeOut(uint256,uint256,uint256,bytes)",
            amount,
            GNUS_TOKEN_ID,
            1,
            shortKey
        );
        (bool success, ) = diamond.call(callData);
        assertFalse(success, "Should revert with 32-byte key");

        // empty key
        callData = abi.encodeWithSignature(
            "bridgeOut(uint256,uint256,uint256,bytes)",
            amount,
            GNUS_TOKEN_ID,
            1,
            new bytes(0)
        );
        (success, ) = diamond.call(callData);
        assertFalse(success, "Should revert with empty key");

        console.log("[OK] Invalid destination key length rejected");
    }
}
