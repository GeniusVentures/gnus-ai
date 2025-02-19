// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "./GeniusAIStorage.sol";
import "./GeniusAccessControl.sol";

/// @title Genius AI Contract
/// @notice Provides escrow functionality for processing jobs in the Genius AI system.
/// @dev Uses `Initializable` for upgradable initialization and extends `GeniusAccessControl` for role-based access.
contract GeniusAI is Initializable, GeniusAccessControl {
    using GeniusAIStorage for GeniusAIStorage.Layout;

    /**
     * @notice Initializes the Genius AI contract.
     * @dev This function is a one-time initialization method that enables access control.
     * Subsequent calls are ignored due to the `initializer` modifier from `Initializable`.
     */
    function GeniusAI_Initialize() public {
        InitializableStorage.layout()._initializing = true;
        __GeniusAccessControl_init();
        InitializableStorage.layout()._initializing = false;
    }

    /**
     * @notice Opens an escrow for a processing job.
     * @dev The sender deposits GNUS tokens into escrow for the job specified by the `UUID`.
     * The escrow amount is taken from `msg.value`.
     * @param UUID A 32-byte unique identifier for the job structure in the database (128-bit UUID without dashes).
     */
    function OpenEscrow(bytes32 UUID) public payable {
        address sender = _msgSender();
        uint256 escrowID = GeniusAIStorage.layout().numEscrows[sender]++;
        GeniusAIStorage.layout().AIProcessingJobs[sender][escrowID] = AIProcessingJob({
            escrowID: escrowID,
            escrowAmount: msg.value,
            uuid: UUID
        });
    }
}
