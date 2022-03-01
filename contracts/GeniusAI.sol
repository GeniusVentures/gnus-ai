// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/UUPSUpgradeable.sol";
import "./GeniusAIStorage.sol";
import "./GeniusAccessControl.sol";

contract GeniusAI is Initializable, UUPSUpgradeable, GeniusAccessControl {
    using GeniusAIStorage for GeniusAIStorage.Layout;

    // section for GNUSAI contract, version 1.0
    struct AIProcessingJob {
        uint256 escrowID;       // auto incremented ID for Escrow
        bytes32 uuid;           // ipfs cid minus first 2 bytes (Qm)
        uint256 escrowAmount;   // amount in gwei for Escrow on deposit
    }

    // one time initialization on, subsequent calls get ignored with initializer
    function GeniusAI_Initialize() public initializer onlySuperAdminRole {
        __UUPSUpgradeable_init();
        __GeniusAccessControl_init();
        // since this should be the last facet initiliazed, keep that all the contracts have been initialized
        //InitializableStorage.layout()._initialized = false;
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
