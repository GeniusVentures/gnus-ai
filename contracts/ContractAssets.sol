// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/IERC20Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSControlStorage.sol";
import "./GNUSConstants.sol";

/// @custom:security-contact support@gnus.ai
contract GNUSContractAssets is Initializable, GeniusAccessControl, IERC20Upgradeable {

    event WithdrawToken(address indexed token, address to, uint256 amount);
    error ErrorWithdrawingEther();
    error CannotWithdrawGNUS();
    /// @notice withdraw external tokens that users sent to contract (mistake?)
    /// @param token token address
    /// @param to destination address
    /// @param amount token amount
    function withdrawToken(address token, address to, uint256 amount) external onlySuperAdminRole {
        /// @dev can't withdraw GNUS token
        if (token == address(this))
            revert CannotWithdrawGNUS();
        if (token == ETHER) {
            (bool success, ) = to.call{value: amount}(new bytes(0));
            if (!success)
                revert ErrorWithdrawingEther();
        } else {
            IERC20Upgradeable(token).safeTransfer(to, amount);
        }
        emit WithdrawToken(token, msg.sender, amount);
    }
}