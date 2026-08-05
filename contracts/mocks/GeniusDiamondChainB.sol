// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../gnus-ai/GeniusDiamond.sol";

/// @title GeniusDiamondChainB
/// @notice Test-only alias of GeniusDiamond used by the GNUSTreasury cross-chain
///         provenance suite to deploy a second, independent diamond instance on
///         the same in-process Hardhat network. The diamonds tooling resolves the
///         diamond contract artifact by diamond name, so a distinct logical name
///         requires a distinct contract artifact.
/// @dev Adds no behavior; identical bytecode semantics to GeniusDiamond.
contract GeniusDiamondChainB is GeniusDiamond {
    constructor(address _contractOwner, address _diamondCutFacet)
        GeniusDiamond(_contractOwner, _diamondCutFacet)
    {}
}
