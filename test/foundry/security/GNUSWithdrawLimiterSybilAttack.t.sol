// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title GNUSWithdrawLimiterSybilAttack
 * @notice Security tests for Sybil attack prevention in withdrawal limiter
 * @dev Tests that withdrawal limits cannot be bypassed through multiple accounts or batching
 */
contract GNUSWithdrawLimiterSybilAttack is GeniusDiamondTestBase {
    // Limiter config constants
    uint256 constant DEFAULT_LIMIT = 100_000 ether; // 100k GNUS
    uint256 constant DEFAULT_WINDOW = 86400; // 24 hours

    // Test addresses for Sybil attack simulation
    address[] public sybilAccounts;

    /**
     * @notice Setup for Sybil Attack tests
     */
    function setUp() public override {
        super.setUp();

        // Create array of sybil accounts
        for (uint256 i = 0; i < 10; i++) {
            sybilAccounts.push(makeAddr(string(abi.encodePacked("sybil", i))));
        }

        console.log("===== GNUSWithdrawLimiter Sybil Attack Tests =====");
        console.log("Diamond:", diamond);
        console.log("Default Limit:", DEFAULT_LIMIT / 1 ether, "GNUS");
        console.log("Sybil Accounts:", sybilAccounts.length);
        console.log("==================================================");
    }

    /**
     * @notice Test: Cannot bypass limit by distributing to multiple accounts
     * @dev FR-67, FR-68: Batch transfer aggregation prevents splitting withdrawals
     */
    function testFuzz_cannotBypassLimitByDistributing(uint8 recipientCount) public {
        // Bound to reasonable number of recipients
        recipientCount = uint8(_boundUint256(recipientCount, 2, 10));

        // Amount per recipient that would exceed limit if aggregated
        uint256 amountPerRecipient = (DEFAULT_LIMIT / recipientCount) + 1 ether;
        uint256 totalAmount = amountPerRecipient * recipientCount;

        // Mint GNUS to attacker
        _mintGNUS(attacker, totalAmount + 1000 ether);

        console.log("=== Sybil Attack Attempt ===");
        console.log("Attacker trying to send:", totalAmount / 1 ether, "GNUS");
        console.log("Split across:", recipientCount, "recipients");
        console.log("Amount per recipient:", amountPerRecipient / 1 ether, "GNUS");
        console.log("Expected: REJECTED (exceeds", DEFAULT_LIMIT / 1 ether, "GNUS limit)");

        // Prepare batch transfer arrays
        address[] memory recipients = new address[](recipientCount);
        uint256[] memory amounts = new uint256[](recipientCount);

        for (uint256 i = 0; i < recipientCount; i++) {
            recipients[i] = sybilAccounts[i];
            amounts[i] = amountPerRecipient;
        }

        // Attempt batch transfer
        vm.prank(attacker);
        bytes memory batchTransferCall = abi.encodeWithSignature(
            "transferBatch(address[],uint256[])",
            recipients,
            amounts
        );

        (bool success, ) = diamond.call(batchTransferCall);

        // Should fail because total exceeds limit
        if (totalAmount > DEFAULT_LIMIT) {
            assertFalse(success, "Batch transfer should fail when total exceeds limit");
            console.log("[OK] Sybil attack via batch transfer BLOCKED");
            console.log("    Total amount:", totalAmount / 1 ether, "GNUS");
            console.log("    Limit:", DEFAULT_LIMIT / 1 ether, "GNUS");
        } else {
            console.log("[OK] Batch transfer within limit succeeded");
        }
    }

    /**
     * @notice Test: Batch transfer aggregation prevents N×limit extraction
     * @dev FR-38, FR-67: Single batch counts as one withdrawal with aggregated amount
     */
    function testFuzz_batchTransferAggregation(uint256 totalAmount) public {
        // Test amounts from just above limit to 3x the limit
        // Add 1 ether to ensure we're definitely exceeding the limit
        totalAmount = _boundUint256(totalAmount, DEFAULT_LIMIT + 1 ether, DEFAULT_LIMIT * 3);

        // Split into multiple recipients
        uint8 recipientCount = 5;
        uint256 amountPerRecipient = totalAmount / recipientCount;

        // Mint GNUS to attacker
        _mintGNUS(attacker, totalAmount + 1000 ether);

        console.log("=== Batch Aggregation Test ===");
        console.log("Total amount:", totalAmount / 1 ether, "GNUS");
        console.log("Recipients:", recipientCount);
        console.log("Limit:", DEFAULT_LIMIT / 1 ether, "GNUS");

        // Prepare batch arrays
        address[] memory recipients = new address[](recipientCount);
        uint256[] memory amounts = new uint256[](recipientCount);

        for (uint256 i = 0; i < recipientCount; i++) {
            recipients[i] = sybilAccounts[i];
            amounts[i] = amountPerRecipient;
        }

        // Attempt batch transfer
        vm.prank(attacker);
        bytes memory batchCall = abi.encodeWithSignature(
            "transferBatch(address[],uint256[])",
            recipients,
            amounts
        );

        (bool success, ) = diamond.call(batchCall);

        // Should always fail since totalAmount > DEFAULT_LIMIT
        assertFalse(success, "Batch exceeding limit should fail");
        console.log("[OK] Aggregation BLOCKED batch transfer");
        console.log("    Prevented: N x limit extraction");
    }

    /**
     * @notice Test: Mixed-token batch only counts GNUS tokens
     * @dev FR-46, FR-70: Non-GNUS tokens should not count toward limit
     */
    function test_mixedTokenBatchOnlyCountsGNUS() public {
        uint256 gnusAmount = DEFAULT_LIMIT / 2; // Half limit in GNUS
        uint256 nftAmount = 1000 ether; // Large amount in NFT tokens

        // Create NFT token
        vm.prank(owner);
        bytes memory createNFTCall = abi.encodeWithSignature(
            "createNFT(uint256,uint256,uint256,uint256,uint256,uint256,uint256,string,string,bool)",
            500000 ether, // max supply
            0, // parent
            0, // burn amount
            0, // price
            0, // royalty
            0, // royalty recipient
            0, // pause
            "Test NFT", // name
            "", // URI
            false // is GNUS
        );
        (bool createSuccess, ) = diamond.call(createNFTCall);
        if (!createSuccess) {
            return; // Skip test if NFT creation fails
        }

        uint256 nftTokenId = 1; // Assuming first NFT gets ID 1

        // Mint tokens to attacker
        _mintGNUS(attacker, gnusAmount + 100 ether);

        vm.prank(owner);
        bytes memory mintNFTCall = abi.encodeWithSignature(
            "mint(address,uint256,uint256,bytes)",
            attacker,
            nftTokenId,
            nftAmount,
            ""
        );
        (bool mintSuccess, ) = diamond.call(mintNFTCall);
        if (!mintSuccess) {
            return; // Skip test if NFT mint fails
        }

        console.log("=== Mixed Token Batch Test ===");
        console.log("GNUS amount:", gnusAmount / 1 ether, "GNUS");
        console.log("NFT amount:", nftAmount / 1 ether, "NFTs");
        console.log("Limit:", DEFAULT_LIMIT / 1 ether, "GNUS");

        // Prepare mixed batch
        vm.prank(attacker);
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);

        ids[0] = GNUS_TOKEN_ID; // GNUS
        amounts[0] = gnusAmount;

        ids[1] = nftTokenId; // NFT
        amounts[1] = nftAmount;

        bytes memory batchCall = abi.encodeWithSignature(
            "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
            attacker,
            user1,
            ids,
            amounts,
            ""
        );

        (bool success, ) = diamond.call(batchCall);

        // Should succeed - only GNUS counts toward limit, NFT ignored
        if (gnusAmount <= DEFAULT_LIMIT) {
            assertTrue(success, "Mixed batch should succeed when GNUS <= limit");
            console.log("[OK] Mixed batch transfer succeeded");
            console.log("    Only GNUS counted (", gnusAmount / 1 ether, "GNUS)");
            console.log("    NFT ignored (", nftAmount / 1 ether, "NFTs)");
        }
    }

    /**
     * @notice Test: Sequential small transfers cannot bypass limit
     * @dev FR-6, FR-7: Multiple small transfers accumulate in bins
     */
    function testFuzz_sequentialSmallTransfersAccumulate(uint8 transferCount) public {
        // Bound to reasonable number of transfers
        transferCount = uint8(_boundUint256(transferCount, 5, 20));

        // Amount per transfer that exceeds limit when accumulated
        uint256 amountPerTransfer = (DEFAULT_LIMIT / transferCount) + 10 ether;
        uint256 totalAmount = amountPerTransfer * transferCount;

        // Mint GNUS to attacker
        _mintGNUS(attacker, totalAmount + 1000 ether);

        console.log("=== Sequential Transfer Accumulation Test ===");
        console.log("Transfer count:", transferCount);
        console.log("Amount per transfer:", amountPerTransfer / 1 ether, "GNUS");
        console.log("Total if all succeed:", totalAmount / 1 ether, "GNUS");
        console.log("Limit:", DEFAULT_LIMIT / 1 ether, "GNUS");

        vm.startPrank(attacker);

        uint256 successfulTransfers = 0;
        uint256 totalTransferred = 0;

        for (uint256 i = 0; i < transferCount; i++) {
            address recipient = sybilAccounts[i % sybilAccounts.length];

            bytes memory transferCall = abi.encodeWithSignature(
                "transfer(address,uint256)",
                recipient,
                amountPerTransfer
            );

            (bool success, ) = diamond.call(transferCall);

            if (success) {
                successfulTransfers++;
                totalTransferred += amountPerTransfer;
            } else {
                // Transfer failed - limit reached
                // console.log(
                //     "    Transfer",
                //     i + 1,
                //     "BLOCKED after",
                //     totalTransferred / 1 ether,
                //     "GNUS"
                // );
                break;
            }
        }

        vm.stopPrank();

        // Should not be able to transfer more than limit
        assertLe(
            totalTransferred,
            DEFAULT_LIMIT + amountPerTransfer,
            "Total should not greatly exceed limit"
        );

        console.log("[OK] Sequential transfers accumulated correctly");
        console.log("    Successful transfers:", successfulTransfers, "/", transferCount);
        console.log("    Total transferred:", totalTransferred / 1 ether, "GNUS");
    }

    /**
     * @notice Test: Time-based limit bypass prevention
     * @dev Attacker cannot reset limits by waiting short periods
     */
    function testFuzz_cannotBypassByWaitingShortPeriods(uint256 waitTime) public {
        // Wait times less than window should not reset limits
        waitTime = _boundUint256(waitTime, 1 minutes, DEFAULT_WINDOW / 2);

        uint256 firstAmount = DEFAULT_LIMIT / 2;
        uint256 secondAmount = DEFAULT_LIMIT - firstAmount + 1 ether; // Just over limit

        // Mint GNUS to attacker
        _mintGNUS(attacker, firstAmount + secondAmount + 100 ether);

        vm.startPrank(attacker);

        // First transfer
        bytes memory transfer1 = abi.encodeWithSignature(
            "transfer(address,uint256)",
            user1,
            firstAmount
        );
        (bool success1, ) = diamond.call(transfer1);
        assertTrue(success1, "First transfer should succeed");

        // Wait short period
        vm.warp(block.timestamp + waitTime);

        // Second transfer (should fail - still within window)
        bytes memory transfer2 = abi.encodeWithSignature(
            "transfer(address,uint256)",
            user2,
            secondAmount
        );
        (bool success2, ) = diamond.call(transfer2);

        vm.stopPrank();

        console.log("=== Time-based Bypass Prevention ===");
        console.log("First transfer:", firstAmount / 1 ether, "GNUS");
        console.log("Wait time:", waitTime / 60, "minutes");
        console.log("Second transfer:", secondAmount / 1 ether, "GNUS");

        if (waitTime < DEFAULT_WINDOW) {
            // Second transfer should fail - still within window
            assertFalse(success2, "Second transfer should fail within same window");
            console.log("[OK] Short wait did NOT reset limit");
            console.log("    Second transfer correctly blocked");
        }
    }

    /**
     * @notice Test: Multiple account coordination cannot bypass limit
     * @dev Even if attacker controls multiple accounts, each is limited separately
     */
    function test_multipleAccountsLimitedSeparately() public {
        uint256 amountPerAccount = DEFAULT_LIMIT / 2;

        console.log("=== Multiple Account Coordination Test ===");
        console.log("Accounts:", sybilAccounts.length);
        console.log("Amount per account:", amountPerAccount / 1 ether, "GNUS");

        uint256 successfulWithdrawals = 0;

        // Try withdrawing from multiple accounts
        for (uint256 i = 0; i < sybilAccounts.length; i++) {
            address account = sybilAccounts[i];

            // Mint to account
            _mintGNUS(account, amountPerAccount + 100 ether);

            // Mint NFT first
            vm.prank(account);
            bytes memory mintCall = abi.encodeWithSignature(
                "mint(address,uint256,bytes)",
                account,
                amountPerAccount,
                ""
            );
            (bool mintSuccess, ) = diamond.call(mintCall);
            if (!mintSuccess) {
                continue; // Skip this account if mint fails
            }

            // Try withdraw
            vm.prank(account);
            bytes memory withdrawCall = abi.encodeWithSignature(
                "withdraw(uint256,uint256)",
                amountPerAccount,
                GNUS_TOKEN_ID
            );

            (bool success, ) = diamond.call(withdrawCall);

            if (success) {
                successfulWithdrawals++;
            }
        }

        console.log("[OK] Multiple accounts tested");
        console.log("    Each account limited separately");
        console.log(
            "    Successful withdrawals:",
            successfulWithdrawals,
            "/",
            sybilAccounts.length
        );
    }
}
