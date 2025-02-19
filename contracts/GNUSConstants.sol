// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title GNUS Constants
/// @notice This file defines global constants used throughout the GNUS project.

// Reserve Currency/Token Name
/// @dev The name of the Genius Token (GNUS).
string constant GNUS_NAME = "Genius Tokens";

// Reserve Currency/Token Symbol
/// @dev The symbol of the Genius Token (GNUS).
string constant GNUS_SYMBOL = "GNUS";

// Decimals for the Genius Token
/// @dev The number of decimals for the Genius Token (GNUS).
uint256 constant GNUS_DECIMALS = 10 ** 18;

// Maximum Supply for the Genius Token
/// @dev The maximum supply of Genius Tokens (50 million tokens with 18 decimals).
uint256 constant GNUS_MAX_SUPPLY = 50000000 * GNUS_DECIMALS;

// Metadata URI for GNUS NFTs
/// @dev The URI for accessing metadata of GNUS NFTs. The `{id}` is a placeholder for the token ID.
string constant GNUS_URI = "https://nft.gnus.ai/{id}";

// Token ID for GNUS ERC20 Token
/// @dev The unique ID for the Genius Token (GNUS) in the ERC1155 token standard.
uint256 constant GNUS_TOKEN_ID = 0;

// Maximum Value for a uint128
/// @dev The maximum possible value for a uint128 variable.
uint128 constant MAX_UINT128 = uint128(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);

// Parent Token Mask
/// @dev A mask used to identify the parent type of a token. This uses the upper 128 bits of a uint256.
uint256 constant PARENT_MASK = uint256(MAX_UINT128) << 128;

// Child Token Mask
/// @dev A mask used to identify the child type of a token. This uses the lower 128 bits of a uint256.
uint256 constant CHILD_MASK = MAX_UINT128;

// Native Ether Address
/// @dev A placeholder address used to represent native Ether in the GNUS system.
address constant ETHER = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
