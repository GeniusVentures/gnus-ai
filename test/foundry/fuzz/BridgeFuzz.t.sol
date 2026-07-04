// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase, IGNUSBridgeOut} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title BridgeFuzz
 * @notice Fuzz tests for bridge operations
 * @dev Exercises the current bridgeOut(uint256,uint256,uint256,bytes32,bool) signature via a
 *      typed interface so assertions check real on-chain effects and specific revert reasons.
 */
contract BridgeFuzz is GeniusDiamondTestBase {
    /// @dev Mirror of GNUSBridge.BridgeOutInitiated for vm.expectEmit.
    event BridgeOutInitiated(
        address indexed sender,
        uint256 id,
        uint256 amount,
        uint256 srcChainID,
        uint256 destChainID,
        bytes32 sgnsDestination,
        bool destinationYOdd
    );

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
     * @notice Fuzz test: a valid bridgeOut burns the sender's balance and emits BridgeOutInitiated.
     * @param amount Amount to bridge
     */
    function testFuzz_bridgeDeposit(uint256 amount) public {
        amount = _boundUint256(amount, 1 ether, 1000 ether);

        uint256 balance = _getGNUSBalance(address(this));
        if (balance < amount) {
            _mintGNUS(address(this), amount - balance + 100 ether);
        }

        uint256 balanceBefore = _getGNUSBalance(address(this));

        // Expect the bridge-out event (check indexed sender topic; full arg matching is M1-E1).
        vm.expectEmit(true, false, false, false, diamond);
        emit BridgeOutInitiated(
            address(this),
            GNUS_TOKEN_ID,
            amount,
            0, // srcChainID (configured chainID defaults to 0 in tests)
            DEST_CHAIN_ID,
            SGNS_DESTINATION,
            SGNS_DESTINATION_Y_ODD
        );
        IGNUSBridgeOut(diamond).bridgeOut(
            amount,
            GNUS_TOKEN_ID,
            DEST_CHAIN_ID,
            SGNS_DESTINATION,
            SGNS_DESTINATION_Y_ODD
        );

        // The bridged amount must be burned from the sender (bridgeFee defaults to 0).
        assertEq(
            _getGNUSBalance(address(this)),
            balanceBefore - amount,
            "bridgeOut must burn the bridged amount"
        );
    }

    /**
     * @notice Fuzz test: bridging more than the balance reverts with "Insufficient tokens.".
     * @param excessAmount Amount exceeding balance
     */
    function testFuzz_RevertWhen_depositExceedsBalance(uint256 excessAmount) public {
        uint256 balance = _getGNUSBalance(address(this));
        vm.assume(excessAmount > balance && excessAmount < type(uint256).max - 1000 ether);

        vm.expectRevert("Insufficient tokens.");
        IGNUSBridgeOut(diamond).bridgeOut(
            excessAmount,
            GNUS_TOKEN_ID,
            DEST_CHAIN_ID,
            SGNS_DESTINATION,
            SGNS_DESTINATION_Y_ODD
        );

        console.log("[OK] Excess bridge deposit rejected with the expected reason");
    }

    /**
     * @notice Fuzz test: any valid bounded amount (with sufficient balance) bridges successfully.
     * @param amount Random amount
     */
    function testFuzz_bridgeAmountEdgeCases(uint256 amount) public {
        amount = _boundUint256(amount, 1, 10000 ether);

        // Ensure the sender holds at least `amount` so the bridge can succeed.
        uint256 balance = _getGNUSBalance(address(this));
        if (balance < amount) {
            _mintGNUS(address(this), amount - balance);
        }

        IGNUSBridgeOut(diamond).bridgeOut(
            amount,
            GNUS_TOKEN_ID,
            DEST_CHAIN_ID,
            SGNS_DESTINATION,
            SGNS_DESTINATION_Y_ODD
        );

        console.log("[OK] Edge case bridged successfully");
    }
}
