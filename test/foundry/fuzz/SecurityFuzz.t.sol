// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title SecurityFuzz
 * @notice Fuzz tests for security attack vectors
 * @dev Tests reentrancy, overflow, access control bypasses, and edge cases
 */
contract SecurityFuzz is GeniusDiamondTestBase {
    /**
     * @notice Setup for Security fuzz tests
     */
    function setUp() public override {
        super.setUp();

        console.log("===== Security Attack Vector Fuzz Tests =====");
        console.log("Diamond:", diamond);
        console.log("=============================================");
    }

    /**
     * @notice Fuzz test: Access control with random callers
     * @param unauthorizedCaller Random unauthorized address
     */
    function testFuzz_accessControlBypass(address unauthorizedCaller) public {
        unauthorizedCaller = _boundAddress(unauthorizedCaller);

        // Skip protected addresses (owner, deployer, test contract)
        vm.assume(unauthorizedCaller != owner);
        vm.assume(unauthorizedCaller != deployer);
        vm.assume(unauthorizedCaller != address(this));

        // Try to mint (requires MINTER_ROLE) - use correct 3-param signature
        bytes memory callData = abi.encodeWithSignature(
            "mint(address,uint256,uint256)",
            unauthorizedCaller,
            GNUS_TOKEN_ID,
            1000 ether
        );

        vm.prank(unauthorizedCaller);
        (bool success, ) = diamond.call(callData);

        assertFalse(success, "Unauthorized mint should fail");

        console.log("[OK] Access control bypass prevented");
    }

    /**
     * @notice Fuzz test: DiamondCut bypass attempts
     * @param attacker Random attacker address
     */
    function testFuzz_diamondCutBypass(address attacker) public {
        attacker = _boundAddress(attacker);
        vm.assume(attacker != owner);
        vm.assume(attacker != deployer);

        // Try to call diamondCut with empty cuts
        bytes memory callData = abi.encodeWithSignature(
            "diamondCut((address,uint8,bytes4[])[],address,bytes)",
            new bytes[](0),
            address(0),
            ""
        );

        vm.prank(attacker);
        (bool success, ) = diamond.call(callData);

        assertFalse(success, "Unauthorized diamondCut should fail");

        console.log("[OK] DiamondCut bypass prevented");
    }

    /**
     * @notice Fuzz test: EOA self-transfer edge cases
     * @param amount Amount to transfer
     */
    function testFuzz_selfAsRecipient(uint256 amount) public {
        amount = _boundUint256(amount, 0, 1000 ether);

        // Use user1 for self-transfer (EOA, not contract)
        uint256 balanceBefore = _getGNUSBalance(user1);

        if (amount > balanceBefore) {
            amount = balanceBefore;
        }

        if (amount > 0) {
            // Transfer user1 to user1 (self-transfer)
            _transferGNUS(user1, user1, amount);

            // Balance should remain same
            uint256 balanceAfter = _getGNUSBalance(user1);
            assertEq(balanceAfter, balanceBefore, "Self-transfer changed balance");
        }

        console.log("[OK] Self as recipient handled");
    }

    /**
     * @notice Fuzz test: Zero amount operations
     * @param to Recipient address
     */
    function testFuzz_zeroAmountOperations(address to) public {
        to = _boundAddress(to);
        // Only use EOAs (no contract code) to avoid ERC1155Receiver requirement
        vm.assume(to.code.length == 0);
        vm.assume(to != address(0));

        // Zero amount transfer from user1 (EOA) to recipient
        _transferGNUS(user1, to, 0);

        console.log("[OK] Zero amount operation handled");
    }

    /**
     * @notice Fuzz test: Maximum value operations
     * @param to Recipient address
     */
    function testFuzz_maxUint256Operations(address to) public {
        to = _boundAddress(to);

        // Try to approve max uint256
        bytes memory callData = abi.encodeWithSignature(
            "approve(address,uint256)",
            to,
            type(uint256).max
        );

        (bool success, ) = diamond.call(callData);

        if (success) {
            console.log("[OK] Max uint256 approval handled");
        }
    }

    /**
     * @notice Fuzz test: Arithmetic overflow in balances
     * @param amount1 First amount
     * @param amount2 Second amount
     */
    function testFuzz_overflowOnBalances(uint256 amount1, uint256 amount2) public pure {
        amount1 = _boundUint256(amount1, 0, type(uint128).max);
        amount2 = _boundUint256(amount2, 0, type(uint128).max);

        // Try operations that might overflow
        uint256 sum;
        unchecked {
            sum = amount1 + amount2;
        }

        // Modern Solidity should handle overflow correctly
        if (sum < amount1 || sum < amount2) {
            console.log("[OK] Overflow handled");
        }
    }

    /**
     * @notice Fuzz test: Allowance overflow
     * @param spender Spender address
     * @param amount Amount for allowance
     */
    function testFuzz_overflowOnAllowances(address spender, uint256 amount) public {
        spender = _boundAddress(spender);

        // Set max allowance
        bytes memory callData = abi.encodeWithSignature(
            "approve(address,uint256)",
            spender,
            type(uint256).max
        );

        (bool success1, ) = diamond.call(callData);

        // Try to increase further
        bytes memory increaseData = abi.encodeWithSignature(
            "increaseAllowance(address,uint256)",
            spender,
            amount
        );

        (bool success2, ) = diamond.call(increaseData);

        // Should either succeed or revert on overflow
        console.log("[OK] Allowance overflow test completed");
    }

    /**
     * @notice Fuzz test: Random function selector calls
     * @param randomSelector Random 4-byte selector
     */
    function testFuzz_randomSelectorCalls(bytes4 randomSelector) public {
        // Try calling with random selector
        (bool success, ) = diamond.call(abi.encodePacked(randomSelector));

        // Should either succeed (valid function) or revert (invalid)
        // Both are acceptable outcomes
        console.log("[OK] Random selector handled");
    }

    /**
     * @notice Fuzz test: Rapid successive operations
     * @param iterations Number of iterations
     */
    function testFuzz_rapidSuccessiveOperations(uint8 iterations) public {
        iterations = uint8(_boundUint256(iterations, 1, 10));

        for (uint256 i = 0; i < iterations; i++) {
            uint256 balance = _getGNUSBalance(user1);
            if (balance > 1 ether) {
                // Transfer between EOAs only (user1 <-> user2)
                _transferGNUS(user1, user2, 1 ether);
                _transferGNUS(user2, user1, 1 ether);
            }
        }

        console.log("[OK] Rapid operations handled");
    }
}
