// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

// section for GNUSAI contract, version 1.0
struct AIProcessingJob {
    uint256 escrowID;                               // auto incremented ID for Escrow
    bytes32 uuid;                                   // ipfs cid minus first 2 bytes (Qm)
    uint256 escrowAmount;                           // amount in gwei for Escrow on deposit
    // mapping (address => uint256) payeesAmount;      // for a particular job the payees
}

library GeniusAIStorage {

    struct Layout {
        // Current number of Escrows created by address
        mapping(address => uint256) numEscrows;
        // Map of AI Processing jobs, keyed by EscrowID
        mapping(address => mapping(uint256 => AIProcessingJob)) AIProcessingJobs;
    }

    bytes32 constant GENIUS_AI_STORAGE_POSITION = keccak256("gnus.ai.storage");

    function layout() internal pure returns (Layout storage ds) {
        bytes32 position = GENIUS_AI_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

}
