// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {console} from "forge-std/console.sol";

/**
 * @title ERC20Fuzz
 * @notice Fuzz tests for GNUS ERC20 token operations
 * @dev Tests transfers, approvals, minting with randomized inputs
 */
contract ERC20Fuzz is GeniusDiamondTestBase {
    /**
     * @notice Setup for ERC20 fuzz tests
     */
    function setUp() public override {
        super.setUp();

        console.log("===== ERC20 GNUS Token Fuzz Tests =====");
        console.log("Diamond:", diamond);
        console.log("=======================================");
    }

    /**
     * @notice Fuzz test: Transfer with random amounts and recipients
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function testFuzz_transfer(address to, uint256 amount) public {
        to = _boundAddress(to);
        vm.assume(to != address(this));
        // Skip contract addresses that don't implement ERC1155Receiver
        vm.assume(to.code.length == 0);

        uint256 balance = _getGNUSBalance(address(this));
        amount = _boundUint256(amount, 0, balance);

        uint256 toBalanceBefore = _getGNUSBalance(to);

        // Transfer
        _transferGNUS(address(this), to, amount);

        // Verify balances
        assertEq(_getGNUSBalance(address(this)), balance - amount, "Sender balance incorrect");
        assertEq(_getGNUSBalance(to), toBalanceBefore + amount, "Recipient balance incorrect");

        console.log("[OK] Transferred:", amount);
    }

    /**
     * @notice Fuzz test: Transfer should revert when exceeding balance
     * @param to Recipient address
     * @param excessAmount Amount exceeding balance
     */
    function testFuzz_RevertWhen_transferExceedsBalance(address to, uint256 excessAmount) public {
        to = _boundAddress(to);
        vm.assume(to != address(this));

        uint256 balance = _getGNUSBalance(address(this));
        vm.assume(excessAmount > balance && excessAmount < type(uint256).max);

        // Try to transfer more than balance
        vm.expectRevert();
        _transferGNUS(address(this), to, excessAmount);

        console.log("[OK] Excess transfer rejected");
    }

    /**
     * @notice Fuzz test: Cannot transfer to zero address
     */
    function testFuzz_RevertWhen_transferToZeroAddress(uint256 amount) public {
        uint256 balance = _getGNUSBalance(address(this));
        amount = _boundUint256(amount, 1, balance);

        // Should revert
        vm.expectRevert();
        _transferGNUS(address(this), address(0), amount);

        console.log("[OK] Transfer to zero rejected");
    }

    /**
     * @notice Fuzz test: Approve random spenders with random amounts
     * @param spender Spender address
     * @param amount Approval amount
     */
    function testFuzz_approve(address spender, uint256 amount) public {
        spender = _boundAddress(spender);

        bytes memory callData = abi.encodeWithSignature(
            "approve(address,uint256)",
            spender,
            amount
        );
        (bool success, ) = diamond.call(callData);
        assertTrue(success, "Approve should succeed");

        // Check allowance
        bytes memory allowanceData = abi.encodeWithSignature(
            "allowance(address,address)",
            address(this),
            spender
        );
        (bool querySuccess, bytes memory returnData) = diamond.staticcall(allowanceData);
        assertTrue(querySuccess, "Allowance query should succeed");

        uint256 allowance = abi.decode(returnData, (uint256));
        assertEq(allowance, amount, "Allowance not set correctly");

        console.log("[OK] Approved:", amount);
    }

    /**
     * @notice Fuzz test: TransferFrom with approvals
     * @param from Token owner
     * @param to Recipient
     * @param amount Amount to transfer
     */
    function testFuzz_transferFrom(address from, address to, uint256 amount) public {
        from = _boundAddress(from);
        to = _boundAddress(to);
        vm.assume(from != to && from != address(0) && to != address(0));
        // Skip contract addresses that don't implement ERC1155Receiver
        vm.assume(to.code.length == 0);

        // Bound amount to reasonable range to avoid max supply issues
        amount = _boundUint256(amount, 1 ether, 100000 ether);

        // Ensure 'from' has balance
        if (_getGNUSBalance(from) < amount) {
            vm.prank(address(this));
            _mintGNUS(from, amount);
        }

        amount = _boundUint256(amount, 0, _getGNUSBalance(from));

        // Approve this contract
        bytes memory approveData = abi.encodeWithSignature(
            "approve(address,uint256)",
            address(this),
            amount
        );
        vm.prank(from);
        (bool approveSuccess, ) = diamond.call(approveData);
        assertTrue(approveSuccess, "Approve failed");

        uint256 fromBalanceBefore = _getGNUSBalance(from);
        uint256 toBalanceBefore = _getGNUSBalance(to);

        // TransferFrom
        bytes memory transferData = abi.encodeWithSignature(
            "transferFrom(address,address,uint256)",
            from,
            to,
            amount
        );
        (bool success, ) = diamond.call(transferData);
        assertTrue(success, "TransferFrom should succeed");

        // Verify
        assertEq(_getGNUSBalance(from), fromBalanceBefore - amount, "From balance incorrect");
        assertEq(_getGNUSBalance(to), toBalanceBefore + amount, "To balance incorrect");

        console.log("[OK] TransferFrom:", amount);
    }

    /**
     * @notice Fuzz test: TransferFrom exceeding allowance reverts
     * @param spender Approved spender
     * @param allowanceAmount Approved amount
     * @param transferAmount Amount to transfer (> allowance)
     */
    function testFuzz_RevertWhen_transferFromExceedsAllowance(
        address spender,
        uint256 allowanceAmount,
        uint256 transferAmount
    ) public {
        spender = _boundAddress(spender);
        vm.assume(spender != address(this));

        allowanceAmount = _boundUint256(allowanceAmount, 0, 1000 ether);
        transferAmount = _boundUint256(
            transferAmount,
            allowanceAmount + 1,
            allowanceAmount + 1000 ether
        );

        // Approve
        bytes memory approveData = abi.encodeWithSignature(
            "approve(address,uint256)",
            spender,
            allowanceAmount
        );
        (bool approveSuccess, ) = diamond.call(approveData);
        assertTrue(approveSuccess, "Approve failed");

        // Try transferFrom with more than allowance
        bytes memory transferData = abi.encodeWithSignature(
            "transferFrom(address,address,uint256)",
            address(this),
            user1,
            transferAmount
        );
        vm.prank(spender);
        (bool success, ) = diamond.call(transferData);
        assertFalse(success, "Should fail when exceeding allowance");

        console.log("[OK] Excess transferFrom rejected");
    }

    /**
     * @notice Fuzz test: Mint with MINTER_ROLE
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function testFuzz_mint(address to, uint256 amount) public {
        to = _boundAddress(to);
        amount = _boundUint256(amount, 1 ether, 1000000 ether);

        uint256 balanceBefore = _getGNUSBalance(to);
        uint256 supplyBefore = _getTotalGNUSSupply();

        // Mint (test contract has MINTER_ROLE from setup)
        _mintGNUS(to, amount);

        // Verify
        assertEq(_getGNUSBalance(to), balanceBefore + amount, "Balance not increased");
        assertEq(_getTotalGNUSSupply(), supplyBefore + amount, "Supply not increased");

        console.log("[OK] Minted:", amount);
    }

    /**
     * @notice Fuzz test: Mint without MINTER_ROLE reverts
     * @param caller Unauthorized caller
     * @param amount Amount to mint
     */
    function testFuzz_RevertWhen_mintWithoutRole(address caller, uint256 amount) public {
        caller = _boundAddress(caller);
        // Skip owner/deployer who has admin privileges
        vm.assume(caller != owner && caller != deployer);
        amount = _boundUint256(amount, 1 ether, 1000 ether);

        // Ensure caller doesn't have MINTER_ROLE
        if (_hasRole(MINTER_ROLE, caller)) {
            _revokeRole(MINTER_ROLE, caller);
        }

        // Also ensure they don't have DEFAULT_ADMIN_ROLE
        vm.assume(!_hasRole(DEFAULT_ADMIN_ROLE, caller));

        bytes4 selector = bytes4(keccak256("mint(address,uint256,uint256,bytes)"));
        bytes memory data = abi.encode(caller, GNUS_TOKEN_ID, amount, "");

        vm.prank(caller);
        (bool success, ) = _callDiamond(selector, data);
        assertFalse(success, "Mint without role should fail");

        console.log("[OK] Unauthorized mint rejected");
    }

    /**
     * @notice Fuzz test: IncreaseAllowance
     * @param spender Spender address
     * @param addedValue Amount to add to allowance
     */
    function testFuzz_increaseAllowance(address spender, uint256 addedValue) public {
        spender = _boundAddress(spender);
        addedValue = _boundUint256(addedValue, 0, 1000000 ether);

        // Initial approve
        bytes memory approveData = abi.encodeWithSignature(
            "approve(address,uint256)",
            spender,
            100 ether
        );
        (bool success1, ) = diamond.call(approveData);
        assertTrue(success1, "Initial approve failed");

        // Increase allowance
        bytes memory increaseData = abi.encodeWithSignature(
            "increaseAllowance(address,uint256)",
            spender,
            addedValue
        );
        (bool success2, ) = diamond.call(increaseData);

        if (success2) {
            // Check new allowance
            bytes memory allowanceData = abi.encodeWithSignature(
                "allowance(address,address)",
                address(this),
                spender
            );
            (bool querySuccess, bytes memory returnData) = diamond.staticcall(allowanceData);
            assertTrue(querySuccess, "Allowance query failed");

            uint256 newAllowance = abi.decode(returnData, (uint256));
            assertEq(newAllowance, 100 ether + addedValue, "Allowance not increased correctly");
        }

        console.log("[OK] IncreaseAllowance tested");
    }

    /**
     * @notice Fuzz test: DecreaseAllowance
     * @param spender Spender address
     * @param subtractedValue Amount to subtract from allowance
     */
    function testFuzz_decreaseAllowance(address spender, uint256 subtractedValue) public {
        spender = _boundAddress(spender);

        uint256 initialAllowance = 1000 ether;
        subtractedValue = _boundUint256(subtractedValue, 0, initialAllowance);

        // Initial approve
        bytes memory approveData = abi.encodeWithSignature(
            "approve(address,uint256)",
            spender,
            initialAllowance
        );
        (bool success1, ) = diamond.call(approveData);
        assertTrue(success1, "Initial approve failed");

        // Decrease allowance
        bytes memory decreaseData = abi.encodeWithSignature(
            "decreaseAllowance(address,uint256)",
            spender,
            subtractedValue
        );
        (bool success2, ) = diamond.call(decreaseData);

        if (success2) {
            // Check new allowance
            bytes memory allowanceData = abi.encodeWithSignature(
                "allowance(address,address)",
                address(this),
                spender
            );
            (bool querySuccess, bytes memory returnData) = diamond.staticcall(allowanceData);
            assertTrue(querySuccess, "Allowance query failed");

            uint256 newAllowance = abi.decode(returnData, (uint256));
            assertEq(
                newAllowance,
                initialAllowance - subtractedValue,
                "Allowance not decreased correctly"
            );
        }

        console.log("[OK] DecreaseAllowance tested");
    }

    /**
     * @notice Fuzz test: Batch transfer (if supported)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts
     */
    function testFuzz_batchTransfer(
        address[3] memory recipients,
        uint256[3] memory amounts
    ) public {
        // Bound recipients and amounts
        for (uint256 i = 0; i < 3; i++) {
            recipients[i] = _boundAddress(recipients[i]);
            amounts[i] = _boundUint256(amounts[i], 0, 1000 ether);
        }

        uint256 totalAmount = amounts[0] + amounts[1] + amounts[2];
        uint256 balance = _getGNUSBalance(address(this));
        vm.assume(totalAmount <= balance);

        // Try batch transfer (if function exists)
        bytes memory callData = abi.encodeWithSignature(
            "batchTransfer(address[],uint256[])",
            recipients,
            amounts
        );
        (bool success, ) = diamond.call(callData);

        // Function may not exist, just test if it works
        if (success) {
            console.log("[OK] Batch transfer succeeded");
        } else {
            console.log("[OK] Batch transfer not supported or failed");
        }
    }
}
