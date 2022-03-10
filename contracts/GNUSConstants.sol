// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

// Reserve Currency/Token Name
string constant GNUS_NAME = "Genius Tokens";
// Reserve Currency/Token Symbol
string constant GNUS_SYMBOL = "GNUS";
uint256 constant GNUS_DECIMALS = 10 ** 18;
uint256 constant GNUS_MAX_SUPPLY = 50000000 * GNUS_DECIMALS;  // 50 million tokens
string constant GNUS_URI = "https://nft.gnus.ai/{id}";
uint256 constant GNUS_TOKEN_ID = 0;

uint128 constant MAX_UINT128 = uint128(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
uint256 constant PARENT_MASK = uint256(MAX_UINT128) << 128; // the token type mask in the upper 128 bits
uint256 constant CHILD_MASK = MAX_UINT128; // the non-fungible index mask in the lower 128
