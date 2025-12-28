// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ERC1155Fuzz
 * @notice Fuzz tests for ERC1155 multi-token operations
 * @dev Tests safeTransferFrom, batch operations, and operator approvals
 */
contract ERC1155Fuzz is GeniusDiamondTestBase {
    /**
     * @notice Setup for ERC1155 fuzz tests
     */
    function setUp() public override {
        super.setUp();
        
        console.log("===== ERC1155 Multi-Token Fuzz Tests =====");
        console.log("Diamond:", diamond);
        console.log("==========================================");
    }

    /**
     * @notice Fuzz test: SafeTransferFrom with random amounts
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function testFuzz_safeTransferFrom(address to, uint256 amount) public {
        to = _boundAddress(to);
        vm.assume(to != address(this));
        
        uint256 balance = _getGNUSBalance(address(this));
        amount = _boundUint256(amount, 0, balance);
        
        uint256 toBalanceBefore = _getGNUSBalance(to);
        
        // Transfer
        _transferGNUS(address(this), to, amount);
        
        // Verify
        assertEq(_getGNUSBalance(to), toBalanceBefore + amount, "Recipient balance incorrect");
        
        console.log("[OK] SafeTransferFrom:", amount);
    }

    /**
     * @notice Fuzz test: SetApprovalForAll
     * @param operator Operator address
     * @param approved Approval status
     */
    function testFuzz_setApprovalForAll(address operator, bool approved) public {
        operator = _boundAddress(operator);
        
        bytes memory callData = abi.encodeWithSignature(
            "setApprovalForAll(address,bool)",
            operator,
            approved
        );
        (bool success, ) = diamond.call(callData);
        assertTrue(success, "SetApprovalForAll should succeed");
        
        // Check approval status
        bytes memory queryData = abi.encodeWithSignature(
            "isApprovedForAll(address,address)",
            address(this),
            operator
        );
        (bool querySuccess, bytes memory returnData) = diamond.staticcall(queryData);
        assertTrue(querySuccess, "isApprovedForAll query should succeed");
        
        bool isApproved = abi.decode(returnData, (bool));
        assertEq(isApproved, approved, "Approval status incorrect");
        
        console.log("[OK] SetApprovalForAll tested");
    }

    /**
     * @notice Fuzz test: Transfer without approval reverts
     * @param from Token owner
     * @param to Recipient
     * @param amount Amount to transfer
     */
    function testFuzz_RevertWhen_transferWithoutApproval(
        address from,
        address to,
        uint256 amount
    ) public {
        from = _boundAddress(from);
        to = _boundAddress(to);
        vm.assume(from != to && from != address(this));
        
        // Ensure 'from' has balance
        if (_getGNUSBalance(from) < amount) {
            _mintGNUS(from, amount);
        }
        amount = _boundUint256(amount, 1, _getGNUSBalance(from));
        
        // Try transfer without approval
        bytes memory callData = abi.encodeWithSignature(
            "safeTransferFrom(address,address,uint256,uint256,bytes)",
            from,
            to,
            GNUS_TOKEN_ID,
            amount,
            ""
        );
        
        vm.prank(address(this));
        (bool success, ) = diamond.call(callData);
        assertFalse(success, "Transfer without approval should fail");
        
        console.log("[OK] Unauthorized transfer rejected");
    }

    /**
     * @notice Fuzz test: Transfer exceeding balance reverts
     * @param to Recipient
     * @param excessAmount Amount exceeding balance
     */
    function testFuzz_RevertWhen_transferExceedsBalance(address to, uint256 excessAmount) public {
        to = _boundAddress(to);
        vm.assume(to != address(this));
        
        uint256 balance = _getGNUSBalance(address(this));
        vm.assume(excessAmount > balance && excessAmount < type(uint256).max - 1000 ether);
        
        vm.expectRevert();
        _transferGNUS(address(this), to, excessAmount);
        
        console.log("[OK] Excess transfer rejected");
    }
}
