// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../../contracts/gnus-ai/libraries/TransferHelper.sol";

/// @title TransferHelper Test Wrapper
/// @notice Wrapper contract to test TransferHelper library functions
/// @dev Exposes internal library functions as external for testing
contract TransferHelperWrapper {
    using TransferHelper for address;

    /// @notice Wrapper for TransferHelper.safeApprove
    function wrapSafeApprove(address token, address to, uint256 value) external {
        TransferHelper.safeApprove(token, to, value);
    }

    /// @notice Wrapper for TransferHelper.safeTransfer
    function wrapSafeTransfer(address token, address to, uint256 value) external {
        TransferHelper.safeTransfer(token, to, value);
    }

    /// @notice Wrapper for TransferHelper.safeTransferFrom
    function wrapSafeTransferFrom(address token, address from, address to, uint256 value) external {
        TransferHelper.safeTransferFrom(token, from, to, value);
    }

    /// @notice Wrapper for TransferHelper.safeTransferETH
    function wrapSafeTransferETH(address to, uint256 value) external payable {
        TransferHelper.safeTransferETH(to, value);
    }

    /// @notice Allows contract to receive ETH
    receive() external payable {}
}
