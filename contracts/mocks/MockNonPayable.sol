// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title Mock Non-Payable Contract
/// @notice Contract that rejects ETH transfers
/// @dev Used to test SafeTransferETH failure scenarios
contract MockNonPayable {
    // This contract explicitly does NOT have a receive() or fallback() function
    // to test ETH transfer failures

    bool public receivedCall;

    function markCalled() external {
        receivedCall = true;
    }
}
