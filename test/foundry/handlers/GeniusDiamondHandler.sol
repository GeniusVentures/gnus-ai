// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title GeniusDiamondHandler
 * @notice Handler contract for stateful invariant testing
 * @dev Provides bounded action handlers with ghost variable tracking
 */
contract GeniusDiamondHandler is GeniusDiamondTestBase {
    // Ghost variables to track expected state
    uint256 public ghost_totalMinted;
    uint256 public ghost_totalBurned;
    uint256 public ghost_totalTransfers;
    uint256 public ghost_totalApprovals;
    uint256 public ghost_totalCollectionsCreated;
    uint256 public ghost_totalBridgeDeposits;
    uint256 public ghost_totalBridgeWithdrawals;

    // Action counters for call summary
    uint256 public calls_transfer;
    uint256 public calls_approve;
    uint256 public calls_mint;
    uint256 public calls_burn;
    uint256 public calls_createCollection;
    uint256 public calls_bridgeDeposit;

    // Track actors
    address[] public actors;
    address internal currentActor;

    /**
     * @notice Setup handler
     */
    function setUp() public override {
        super.setUp();

        // Initialize actor list
        actors.push(address(this));
        actors.push(user1);
        actors.push(user2);
        actors.push(user3);

        console.log("===== GeniusDiamond Stateful Handler =====");
        console.log("Diamond:", diamond);
        console.log("Actors:", actors.length);
        console.log("=========================================");
    }

    /**
     * @notice Bounded transfer handler
     * @param actorSeed Seed to select actor
     * @param recipientSeed Seed to select recipient
     * @param amount Amount to transfer
     */
    function handler_transfer(uint256 actorSeed, uint256 recipientSeed, uint256 amount) public {
        // Select actor and recipient
        currentActor = actors[actorSeed % actors.length];
        address recipient = actors[recipientSeed % actors.length];

        // Bound amount to actor's balance
        uint256 balance = _getGNUSBalance(currentActor);
        if (balance == 0) return;

        amount = _boundUint256(amount, 1, balance);

        // Execute transfer
        vm.prank(currentActor);
        _transferGNUS(currentActor, recipient, amount);

        // Update ghosts
        ghost_totalTransfers++;
        calls_transfer++;

        console.log("[HANDLER] Transfer:", amount);
    }

    /**
     * @notice Bounded approve handler
     * @param actorSeed Seed to select actor
     * @param spenderSeed Seed to select spender
     * @param amount Approval amount
     */
    function handler_approve(uint256 actorSeed, uint256 spenderSeed, uint256 amount) public {
        currentActor = actors[actorSeed % actors.length];
        address spender = actors[spenderSeed % actors.length];

        amount = _boundUint256(amount, 0, type(uint128).max);

        bytes memory callData = abi.encodeWithSignature(
            "approve(address,uint256)",
            spender,
            amount
        );

        vm.prank(currentActor);
        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_totalApprovals++;
            calls_approve++;
        }

        console.log("[HANDLER] Approve:", amount);
    }

    /**
     * @notice Bounded mint handler
     * @param recipientSeed Seed to select recipient
     * @param amount Amount to mint
     */
    function handler_mint(uint256 recipientSeed, uint256 amount) public {
        address recipient = actors[recipientSeed % actors.length];
        amount = _boundUint256(amount, 1 ether, 1000 ether);

        // Only test contract has MINTER_ROLE
        _mintGNUS(recipient, amount);

        ghost_totalMinted += amount;
        calls_mint++;

        console.log("[HANDLER] Mint:", amount);
    }

    /**
     * @notice Bounded collection creation handler
     * @param maxSupply Maximum supply for collection
     * @param exchRate Exchange rate
     */
    function handler_createCollection(uint256 maxSupply, uint256 exchRate) public {
        maxSupply = _boundUint256(maxSupply, 1, 10000);
        exchRate = _boundUint256(exchRate, 1 ether, 100 ether);

        // Ensure test contract has enough GNUS
        uint256 balance = _getGNUSBalance(address(this));
        if (balance < exchRate) {
            _mintGNUS(address(this), exchRate - balance + 100 ether);
        }

        bytes memory callData = abi.encodeWithSignature(
            "createNFTCollection(string,string,uint256,uint256)",
            "Test Collection",
            "TEST",
            maxSupply,
            exchRate
        );

        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_totalCollectionsCreated++;
            ghost_totalBurned += exchRate; // GNUS burned on creation
            calls_createCollection++;
        }

        console.log("[HANDLER] Create Collection");
    }

    /**
     * @notice Bounded bridge deposit handler
     * @param actorSeed Seed to select actor
     * @param amount Amount to bridge
     */
    function handler_bridgeDeposit(uint256 actorSeed, uint256 amount) public {
        currentActor = actors[actorSeed % actors.length];

        uint256 balance = _getGNUSBalance(currentActor);
        if (balance == 0) return;

        amount = _boundUint256(amount, 1 ether, balance);

        bytes memory callData = abi.encodeWithSignature(
            "bridgeOut(uint256,uint256,uint256)",
            amount,
            GNUS_TOKEN_ID,
            1 // destination chain
        );

        vm.prank(currentActor);
        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_totalBridgeDeposits++;
            calls_bridgeDeposit++;
        }

        console.log("[HANDLER] Bridge Deposit:", amount);
    }

    /**
     * @notice Get call summary for debugging
     */
    function callSummary() external view {
        console.log("===== Handler Call Summary =====");
        console.log("Transfers:", calls_transfer);
        console.log("Approvals:", calls_approve);
        console.log("Mints:", calls_mint);
        console.log("Burns:", calls_burn);
        console.log("Collections:", calls_createCollection);
        console.log("Bridge Deposits:", calls_bridgeDeposit);
        console.log("================================");
        console.log("Ghost Total Minted:", ghost_totalMinted);
        console.log("Ghost Total Burned:", ghost_totalBurned);
        console.log("Ghost Total Transfers:", ghost_totalTransfers);
    }
}
