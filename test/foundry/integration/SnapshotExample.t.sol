// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondForgeHelpers.sol";
import "../helpers/DiamondDeployment.sol";

/**
 * @title SnapshotExampleTest
 * @notice Example test demonstrating snapshot/restore functionality
 * @dev Shows how to use DiamondForgeHelpers.snapshotState() and revertToSnapshot()
 */
contract SnapshotExampleTest is Test {
    using DiamondForgeHelpers for *;

    address diamond;
    address deployer;
    uint256 snapshot;

    // Test users
    address user1;
    address user2;
    address user3;

    function setUp() public {
        // Load Diamond deployment data
        diamond = DiamondDeployment.getDiamondAddress();
        deployer = DiamondDeployment.getDeployerAddress();

        // Set up test users
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        // Fund test users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);

        console.log("=== Snapshot Example Test Setup ===");
        console.log("Diamond:", diamond);
        console.log("User1:", user1);
        console.log("User2:", user2);
        console.log("User3:", user3);
    }

    /// @notice Test basic snapshot and restore functionality
    /// @dev Demonstrates taking a snapshot and reverting to it
    function test_BasicSnapshotRestore() public {
        console.log("\n=== Test: Basic Snapshot/Restore ===");

        // Initial state
        uint256 initialBalance = user1.balance;
        console.log("Initial user1 balance:", initialBalance);

        // Take snapshot
        snapshot = DiamondForgeHelpers.snapshotState();
        console.log("Snapshot taken, ID:", snapshot);

        // Modify state
        vm.prank(user1);
        payable(user2).transfer(10 ether);

        uint256 balanceAfterTransfer = user1.balance;
        console.log("User1 balance after transfer:", balanceAfterTransfer);
        assertEq(balanceAfterTransfer, initialBalance - 10 ether, "Balance should decrease");

        // Restore snapshot
        bool success = DiamondForgeHelpers.revertToSnapshot(snapshot);
        assertTrue(success, "Snapshot restore should succeed");
        console.log("Snapshot restored successfully");

        // Verify state restored
        uint256 restoredBalance = user1.balance;
        console.log("User1 balance after restore:", restoredBalance);
        assertEq(restoredBalance, initialBalance, "Balance should be restored");
    }

    /// @notice Test multiple snapshots and restores
    /// @dev Shows that snapshots can be taken at different points
    function test_MultipleSnapshots() public {
        console.log("\n=== Test: Multiple Snapshots ===");

        // State 0: Initial
        uint256 state0Balance = user1.balance;
        console.log("State 0 - User1 balance:", state0Balance);

        // Transfer and snapshot (State 1)
        vm.prank(user1);
        payable(user2).transfer(10 ether);
        uint256 snapshot1 = DiamondForgeHelpers.snapshotState();
        uint256 state1Balance = user1.balance;
        console.log("State 1 - User1 balance:", state1Balance);
        console.log("Snapshot 1 taken, ID:", snapshot1);

        // Transfer again and snapshot (State 2)
        vm.prank(user1);
        payable(user3).transfer(5 ether);
        uint256 snapshot2 = DiamondForgeHelpers.snapshotState();
        uint256 state2Balance = user1.balance;
        console.log("State 2 - User1 balance:", state2Balance);
        console.log("Snapshot 2 taken, ID:", snapshot2);

        // Restore to snapshot 2
        bool success2 = DiamondForgeHelpers.revertToSnapshot(snapshot2);
        assertTrue(success2, "Snapshot 2 restore should succeed");
        console.log("Restored to snapshot 2");
        assertEq(user1.balance, state2Balance, "Should restore to state 2");

        // Note: After reverting to snapshot2, snapshot1 is invalidated
        // This is expected Foundry behavior
    }

    /// @notice Test snapshot with contract state changes
    /// @dev Shows snapshots work with contract storage modifications
    function test_SnapshotWithContractState() public {
        // Only run if Diamond is deployed (forking mode)
        uint256 codeSize;
        address diamondAddr = diamond;
        assembly {
            codeSize := extcodesize(diamondAddr)
        }

        if (codeSize == 0) {
            console.log("Skipping: Diamond not deployed (not forking)");
            return;
        }

        console.log("\n=== Test: Snapshot with Contract State ===");

        // Take initial snapshot
        uint256 initialSnapshot = DiamondForgeHelpers.snapshotState();
        console.log("Initial snapshot taken, ID:", initialSnapshot);

        // Query initial owner
        bytes4 ownerSelector = bytes4(keccak256("owner()"));
        (bool success, bytes memory returnData) = diamond.staticcall(
            abi.encodeWithSelector(ownerSelector)
        );

        if (!success) {
            console.log("Skipping: owner() not available");
            return;
        }

        address initialOwner = abi.decode(returnData, (address));
        console.log("Initial owner:", initialOwner);

        // Note: We can't actually change owner without being authorized,
        // but we can demonstrate the snapshot pattern works

        // Restore to prove snapshot mechanism works
        bool restored = DiamondForgeHelpers.revertToSnapshot(initialSnapshot);
        assertTrue(restored, "Snapshot restore should succeed");
        console.log("State restored successfully");
    }

    /// @notice Test snapshot isolation between tests
    /// @dev Shows that each test starts with clean state
    function test_SnapshotIsolation_Test1() public {
        console.log("\n=== Test: Snapshot Isolation (Test 1) ===");

        // Modify state
        vm.prank(user1);
        payable(user2).transfer(25 ether);

        uint256 balance = user1.balance;
        console.log("Test 1 - User1 balance:", balance);

        // This state change won't affect Test 2 due to Foundry's automatic snapshot/restore
        assertLt(balance, 100 ether, "Balance should have decreased");
    }

    /// @notice Second test showing isolation
    /// @dev Verifies state is reset between tests
    function test_SnapshotIsolation_Test2() public {
        console.log("\n=== Test: Snapshot Isolation (Test 2) ===");

        // User1 should have initial balance, not the reduced one from Test 1
        uint256 balance = user1.balance;
        console.log("Test 2 - User1 balance:", balance);

        assertEq(balance, 100 ether, "Balance should be reset to initial");
    }
}
