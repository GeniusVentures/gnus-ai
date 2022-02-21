// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./GeniusAI.sol";

library GeniusAIStorage {

    struct Layout {
        // Current number of Escrows created by address
        mapping(address => uint256) numEscrows;
        // Map of AI Processing jobs, keyed by EscrowID
        mapping(address => mapping(uint256 => GeniusAI.AIProcessingJob)) AIProcessingJobs;
    }

    bytes32 constant GENIUS_AI_STORAGE_POSITION = keccak256("gnus.ai.storage");

    function layout() internal pure returns (Layout storage ds) {
        bytes32 position = GENIUS_AI_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

}
