// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "./GeniusAIStorage.sol";
import "./GeniusAccessControl.sol";

contract GeniusAI is Initializable, GeniusAccessControl {
    using GeniusAIStorage for GeniusAIStorage.Layout;

    // one time initialization on, subsequent calls get ignored with initializer
    function GeniusAI_Initialize() public  {
        InitializableStorage.layout()._initializing = true;
        __GeniusAccessControl_init();
        InitializableStorage.layout()._initializing = false;
    }

    /// OpenEscrow
    /// msg.value = amount OF GNUS to deposit in escrow
    /// UUID - 128 bit/32 byte UUID (no dashes) of unique ID for Job structure in database
    function OpenEscrow(bytes32 UUID) public payable {
        address sender = _msgSender();
        uint256 escrowID = GeniusAIStorage.layout().numEscrows[sender]++;
        GeniusAIStorage.layout().AIProcessingJobs[sender][escrowID] = AIProcessingJob({ escrowID: escrowID, escrowAmount: msg.value, uuid: UUID });
    }

}
