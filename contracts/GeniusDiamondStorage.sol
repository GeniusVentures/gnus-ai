
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@gnus.ai/contracts-upgradeable-diamond/access/AccessControlEnumerableUpgradeable.sol";
import "./EscrowAIJob.sol";

// add global Diamond data to the diamond
library GeniusDiamondStorage {

    struct Layout {
        // the deployer of the contract is the SuperAdmin
        address superAdmin;
    }

   bytes32 constant GENIUS_DIAMOND_STORAGE_POSITION = keccak256("gnus.ai.global.storage");

    function layout() internal pure returns (Layout storage ds) {
        bytes32 position = GENIUS_DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
