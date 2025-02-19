// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./libraries/TransferHelper.sol";

/// @title GNUS Contract Assets Management
/// @notice Provides functionality to manage and withdraw external assets sent to the contract.
/// @dev Allows withdrawal of tokens mistakenly sent to the contract, with safeguards for GNUS tokens.
/// @custom:security-contact support@gnus.ai
contract GNUSContractAssets is Initializable, GeniusAccessControl {
    /// @dev Emitted when tokens are withdrawn from the contract.
    /// @param token The address of the token being withdrawn.
    /// @param to The destination address for the withdrawal.
    /// @param amount The amount of tokens withdrawn.
    event WithdrawToken(address indexed token, address to, uint256 amount);

    /// @dev Reverts when an error occurs while withdrawing Ether.
    error ErrorWithdrawingEther();

    /// @dev Reverts when attempting to withdraw the GNUS token.
    error CannotWithdrawGNUS();

    /**
     * @notice Withdraw external tokens mistakenly sent to the contract.
     * @dev This function allows the super admin to withdraw tokens mistakenly sent to the contract,
     * but it does not allow withdrawing GNUS tokens.
     * @param token The address of the token to withdraw. Use the constant `ETHER` for native Ether.
     * @param to The destination address to receive the tokens.
     * @param amount The amount of tokens to withdraw.
     * Requirements:
     * - Caller must have the `SUPER_ADMIN_ROLE`.
     * - Cannot withdraw the GNUS token.
     * - For Ether withdrawal, the transfer must succeed.
     * Emits a {WithdrawToken} event on successful withdrawal.
     */
    function withdrawToken(address token, address to, uint256 amount) external onlySuperAdminRole {
        /// @dev Ensure that the GNUS token cannot be withdrawn.
        if (token == address(this)) {
            revert CannotWithdrawGNUS();
        }
 
        if (token == ETHER) {
            /// @dev Handle Ether withdrawal.
            (bool success, ) = to.call{value: amount}(new bytes(0));
            if (!success) {
                revert ErrorWithdrawingEther();
            }
        } else {
            /// @dev Use TransferHelper to safely transfer ERC20 tokens.
            TransferHelper.safeTransfer(token, to, amount);
        }

        emit WithdrawToken(token, msg.sender, amount);
    }
}
