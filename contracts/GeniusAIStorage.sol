// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title Genius AI Storage Library
/// @notice Provides the layout and utility functions for managing AI processing jobs and escrow data.
/// @dev This library defines the storage structure and facilitates access to the Genius AI-specific storage position.

/// @dev Represents a single AI processing job associated with an escrow.
struct AIProcessingJob {
    uint256 escrowID;       ///< Auto-incremented ID for the escrow associated with the job.
    bytes32 uuid;           ///< IPFS CID (Content Identifier) minus the first 2 bytes (Qm prefix).
    uint256 escrowAmount;   ///< Amount in Gwei deposited into escrow for the job.
    // mapping (address => uint256) payeesAmount;  // Uncomment to support multiple payees per job.
}

/// @dev Library for managing Genius AI-specific storage layout.
library GeniusAIStorage {

    /// @dev Defines the storage structure for the Genius AI contract.
    struct Layout {
        mapping(address => uint256) numEscrows;   ///< Tracks the number of escrows created by each address.
        mapping(address => mapping(uint256 => AIProcessingJob)) AIProcessingJobs; ///< Stores AI processing jobs mapped by address and escrow ID.
    }

    /// @dev The storage position used to uniquely identify Genius AI storage.
    bytes32 constant GENIUS_AI_STORAGE_POSITION = keccak256("gnus.ai.storage");

    /**
     * @notice Provides access to the `Layout` instance stored in the Genius AI storage position.
     * @dev Uses the EVM assembly `sload` to retrieve the storage pointer.
     * @return ds The `Layout` instance for Genius AI storage.
     */
    function layout() internal pure returns (Layout storage ds) {
        bytes32 position = GENIUS_AI_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
