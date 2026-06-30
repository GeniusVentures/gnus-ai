// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Fork-aware DiamondDeployment — provides Sepolia mainnet diamond address,
///         ABI path, and deployer address for Foundry fork tests.
/// @dev    NOT generated — committed source of truth for fork-compatible addresses.
///         Use DiamondDeployment.sol (generated, gitignored) for local Hardhat tests.
library DiamondDeploymentFork {
    // GeniusDiamond on Sepolia (11155111)
    address constant DIAMOND_ADDRESS = 0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70;

    // Hardhat account #0 — used as deployer proxy in fork tests
    address constant DEPLOYER_ADDRESS = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    function getDiamondAddress() internal pure returns (address) {
        return DIAMOND_ADDRESS;
    }

    function getDiamondABIPath() internal pure returns (string memory) {
        return "diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155111.json";
    }

    function getDeployerAddress() internal pure returns (address) {
        return DEPLOYER_ADDRESS;
    }
}
