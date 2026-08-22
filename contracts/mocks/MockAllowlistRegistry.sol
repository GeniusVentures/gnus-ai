// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../gnus-ai/interfaces/IAllowlistRegistry.sol";

/// @title Mock Allowlist Registry
/// @notice Test mock for IAllowlistRegistry — exposes a settable allow mapping.
/// @dev Mirrors MockRedeemCaller conventions: thin, public-state-driven, no logic beyond the flag.
contract MockAllowlistRegistry is IAllowlistRegistry {
    /// @dev Per-address allowlist flag. Tests set via setAllowed.
    mapping(address => bool) public allowed;

    /// @notice IAllowlistRegistry implementation. Returns the per-address flag.
    function isAllowed(address account) external view override returns (bool) {
        return allowed[account];
    }

    /// @notice Test setter — flips the allow flag for an address.
    function setAllowed(address account, bool isAllowedFlag) external {
        allowed[account] = isAllowedFlag;
    }
}
