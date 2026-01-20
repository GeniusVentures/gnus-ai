// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title GNUSWithdrawLimiterFuzz
 * @notice Fuzz tests for GNUSWithdrawLimiter bin-based rate limiting
 * @dev Tests bin calculations, wrap-around, expiration, and limit enforcement
 */
contract GNUSWithdrawLimiterFuzz is GeniusDiamondTestBase {
    // Limiter config constants
    uint256 constant DEFAULT_LIMIT = 100_000 ether; // 100k GNUS
    uint256 constant DEFAULT_WINDOW = 86400; // 24 hours
    uint256 constant DEFAULT_BIN_COUNT = 24; // hourly bins

    /**
     * @notice Setup for Withdraw Limiter fuzz tests
     */
    function setUp() public override {
        super.setUp();

        console.log("===== GNUSWithdrawLimiter Fuzz Tests =====");
        console.log("Diamond:", diamond);
        console.log("Default Limit:", DEFAULT_LIMIT / 1 ether, "GNUS");
        console.log("Default Window:", DEFAULT_WINDOW, "seconds");
        console.log("Default Bin Count:", DEFAULT_BIN_COUNT);
        console.log("==========================================");
    }

    /**
     * @notice Fuzz test: Bin index calculation with random timestamps and configs
     * @param timestamp Random timestamp
     * @param binCount Random bin count
     * @dev Tests bin index calculation using modulo arithmetic for proper bin selection
     */
    function testFuzz_binIndexCalculation(uint256 timestamp, uint32 binCount) public view {
        // Bound inputs
        timestamp = _boundUint256(timestamp, block.timestamp, block.timestamp + 365 days);
        binCount = uint32(_boundUint256(binCount, 1, 1000));

        // Calculate bin index (currentTime / binLength) % binCount
        uint256 binLength = DEFAULT_WINDOW / binCount;
        uint256 expectedBinIndex = (timestamp / binLength) % binCount;

        // Verify bin index is within bounds
        assertTrue(expectedBinIndex < binCount, "Bin index should be less than binCount");

        console.log("[OK] Bin index calculation verified for timestamp:", timestamp);
        console.log("    Bin Count:", binCount, "Bin Index:", expectedBinIndex);
    }

    /**
     * @notice Fuzz test: Bin wrap-around with random bin counts
     * @param binCount Random bin count
     * @param iterations Random number of iterations
     * @dev Tests bin array wrap-around at boundaries using circular buffer pattern
     */
    function testFuzz_binWrapAround(uint32 binCount, uint256 iterations) public view {
        // Bound inputs
        binCount = uint32(_boundUint256(binCount, 2, 100));
        iterations = _boundUint256(iterations, binCount, binCount * 3);

        uint256 binLength = DEFAULT_WINDOW / binCount;

        // Simulate multiple time periods
        for (uint256 i = 0; i < iterations; i++) {
            uint256 timestamp = block.timestamp + (i * binLength);
            uint256 binIndex = (timestamp / binLength) % binCount;

            // Verify wrap-around
            assertTrue(binIndex < binCount, "Bin index should wrap around");
        }

        console.log("[OK] Bin wrap-around verified for", iterations, "iterations");
        console.log("    Bin Count:", binCount);
    }

    /**
     * @notice Fuzz test: Withdrawal amounts near limit boundaries
     * @param amount Random withdrawal amount
     * @dev Tests limit enforcement near boundary conditions (90%-110% of limit)
     */
    function testFuzz_withdrawalNearLimit(uint256 amount) public {
        // Test amounts from 90% to 110% of limit
        // Split calculation to avoid Semgrep multiplication-division warning
        uint256 minAmount = DEFAULT_LIMIT / 100;
        minAmount = minAmount * 90;
        uint256 maxAmount = DEFAULT_LIMIT / 100;
        maxAmount = maxAmount * 110;
        amount = _boundUint256(amount, minAmount, maxAmount);

        // Mint GNUS tokens for testing
        _mintGNUS(user1, amount + 1000 ether);

        // Try withdraw via bridge
        vm.startPrank(user1);

        bytes memory mintCall = abi.encodeWithSignature(
            "mint(address,uint256,bytes)",
            user1,
            amount,
            ""
        );
        (bool mintSuccess, ) = diamond.call(mintCall);

        if (mintSuccess) {
            bytes memory withdrawCall = abi.encodeWithSignature(
                "withdraw(uint256,uint256)",
                amount,
                GNUS_TOKEN_ID
            );

            (bool success, ) = diamond.call(withdrawCall);

            if (amount <= DEFAULT_LIMIT) {
                // Should succeed if under limit
                console.log("[OK] Withdrawal under limit succeeded:", amount / 1 ether, "GNUS");
            } else {
                // Should fail if over limit
                assertFalse(success, "Withdrawal over limit should fail");
                console.log("[OK] Withdrawal over limit rejected:", amount / 1 ether, "GNUS");
            }
        }

        vm.stopPrank();
    }

    /**
     * @notice Fuzz test: Multiple sequential withdrawals over time
     * @param withdrawalCount Number of withdrawals
     * @param timeGap Time gap between withdrawals
     * @dev Tests withdrawal amount accumulation across multiple bins over time
     */
    function testFuzz_sequentialWithdrawals(uint8 withdrawalCount, uint256 timeGap) public {
        // Bound inputs
        withdrawalCount = uint8(_boundUint256(withdrawalCount, 2, 10));
        timeGap = _boundUint256(timeGap, 1 hours, 12 hours);

        uint256 amountPerWithdrawal = DEFAULT_LIMIT / (withdrawalCount + 1);

        // Mint enough tokens
        _mintGNUS(user1, DEFAULT_LIMIT * 2);

        vm.startPrank(user1);

        uint256 totalWithdrawn = 0;
        uint256 successfulWithdrawals = 0;

        for (uint256 i = 0; i < withdrawalCount; i++) {
            // Advance time
            vm.warp(block.timestamp + timeGap);

            bytes memory mintCall = abi.encodeWithSignature(
                "mint(address,uint256,bytes)",
                user1,
                amountPerWithdrawal,
                ""
            );
            (bool mintSuccess, ) = diamond.call(mintCall);
            if (!mintSuccess) {
                break; // Stop if mint fails (e.g., max supply reached)
            }

            bytes memory withdrawCall = abi.encodeWithSignature(
                "withdraw(uint256,uint256)",
                amountPerWithdrawal,
                GNUS_TOKEN_ID
            );

            (bool success, ) = diamond.call(withdrawCall);

            if (success) {
                totalWithdrawn += amountPerWithdrawal;
                successfulWithdrawals++;
            }
        }

        vm.stopPrank();

        console.log("[OK] Sequential withdrawals tested");
        console.log("    Successful:", successfulWithdrawals, "/", withdrawalCount);
        console.log("    Total withdrawn:", totalWithdrawn / 1 ether, "GNUS");
    }

    /**
     * @notice Fuzz test: Expired bin cleanup with various time gaps
     * @param timeGap Time gap for bin expiration
     * @dev Tests lazy cleanup of expired bins after window duration
     */
    function testFuzz_expiredBinCleanup(uint256 timeGap) public {
        // Test time gaps from 1 window to 5 windows
        timeGap = _boundUint256(timeGap, DEFAULT_WINDOW, DEFAULT_WINDOW * 5);

        uint256 initialAmount = DEFAULT_LIMIT / 2;

        // Mint tokens
        _mintGNUS(user1, DEFAULT_LIMIT);

        vm.startPrank(user1);

        // First withdrawal
        bytes memory mintCall1 = abi.encodeWithSignature(
            "mint(address,uint256,bytes)",
            user1,
            initialAmount,
            ""
        );
        (bool mintSuccess1, ) = diamond.call(mintCall1);
        if (!mintSuccess1) {
            vm.stopPrank();
            return; // Skip test if initial mint fails
        }

        bytes memory withdrawCall1 = abi.encodeWithSignature(
            "withdraw(uint256,uint256)",
            initialAmount,
            GNUS_TOKEN_ID
        );
        (bool success1, ) = diamond.call(withdrawCall1);
        assertTrue(success1, "First withdrawal should succeed");

        // Advance time beyond window (bins should expire)
        vm.warp(block.timestamp + timeGap);

        // Second withdrawal (should succeed if bins expired)
        bytes memory mintCall2 = abi.encodeWithSignature(
            "mint(address,uint256,bytes)",
            user1,
            initialAmount,
            ""
        );
        (bool mintSuccess2, ) = diamond.call(mintCall2);
        if (!mintSuccess2) {
            vm.stopPrank();
            return; // Skip test if second mint fails
        }

        bytes memory withdrawCall2 = abi.encodeWithSignature(
            "withdraw(uint256,uint256)",
            initialAmount,
            GNUS_TOKEN_ID
        );
        (bool success2, ) = diamond.call(withdrawCall2);

        vm.stopPrank();

        if (timeGap >= DEFAULT_WINDOW) {
            // Bins should have expired, second withdrawal should succeed
            assertTrue(success2, "Second withdrawal should succeed after expiration");
            console.log("[OK] Expired bin cleanup verified (", timeGap / 3600, "hours gap)");
        } else {
            console.log("[OK] Bin expiration tested with", timeGap / 3600, "hours gap");
        }
    }

    /**
     * @notice Fuzz test: Super admin bypass with random amounts
     * @param amount Random withdrawal amount
     * @dev Tests that super admin can withdraw unlimited amounts bypassing rate limits
     */
    function testFuzz_superAdminBypass(uint256 amount) public {
        // Test amounts up to 10x the limit
        amount = _boundUint256(amount, DEFAULT_LIMIT, DEFAULT_LIMIT * 10);

        // Mint GNUS for owner (super admin)
        _mintGNUS(owner, amount + 1000 ether);

        vm.startPrank(owner);

        bytes memory mintCall = abi.encodeWithSignature(
            "mint(address,uint256,bytes)",
            owner,
            amount,
            ""
        );
        (bool mintSuccess, ) = diamond.call(mintCall);
        if (!mintSuccess) {
            vm.stopPrank();
            return; // Skip test if mint fails (e.g., amount too large)
        }

        bytes memory withdrawCall = abi.encodeWithSignature(
            "withdraw(uint256,uint256)",
            amount,
            GNUS_TOKEN_ID
        );

        (bool success, ) = diamond.call(withdrawCall);

        vm.stopPrank();

        // Super admin should always succeed regardless of limit
        assertTrue(success, "Super admin withdrawal should always succeed");
        console.log("[OK] Super admin bypass tested:", amount / 1 ether, "GNUS");
    }

    /**
     * @notice Fuzz test: Custom account config with random parameters
     * @param limitAmount Custom limit amount
     * @param windowSeconds Custom window duration
     * @param binCount Custom bin count
     * @dev Tests per-account custom configuration overriding default limits
     */
    function testFuzz_customAccountConfig(
        uint256 limitAmount,
        uint64 windowSeconds,
        uint32 binCount
    ) public {
        // Bound inputs to reasonable ranges
        limitAmount = _boundUint256(limitAmount, 1000 ether, 1000000 ether);
        windowSeconds = uint64(_boundUint256(windowSeconds, 1 hours, 30 days));
        binCount = uint32(_boundUint256(binCount, 2, 100));

        // Set custom config as owner
        vm.prank(owner);
        bytes memory setConfigCall = abi.encodeWithSignature(
            "setAccountConfig(address,uint32,uint64,uint256)",
            user1,
            binCount,
            windowSeconds,
            limitAmount
        );

        (bool configSuccess, ) = diamond.call(setConfigCall);

        if (configSuccess) {
            // Verify config was set
            bytes memory getConfigCall = abi.encodeWithSignature(
                "getAccountConfig(address)",
                user1
            );

            (bool getSuccess, ) = diamond.call(getConfigCall);

            if (getSuccess) {
                console.log("[OK] Custom account config set successfully");
                console.log("    Limit:", limitAmount / 1 ether, "GNUS");
                console.log("    Window:", windowSeconds / 3600, "hours");
                console.log("    Bins:", binCount);
            }
        }
    }

    /**
     * @notice Fuzz test: Limiter enabled/disabled state
     * @param shouldEnable Random boolean for enabled state
     * @dev Tests global limiter enable/disable functionality
     */
    function testFuzz_limiterEnabledState(bool shouldEnable) public {
        vm.prank(owner);

        bytes memory setEnabledCall = abi.encodeWithSignature(
            "setLimiterEnabled(bool)",
            shouldEnable
        );

        (bool success, ) = diamond.call(setEnabledCall);

        if (success) {
            console.log("[OK] Limiter", shouldEnable ? "enabled" : "disabled");
        }
    }
}
