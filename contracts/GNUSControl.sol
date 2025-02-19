// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./GNUSConstants.sol";
import "./GNUSControlStorage.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
import "./GNUSBridge.sol";

/**
 * @title GNUS Control Contract
 * @dev Manages protocol-level security and controls, including blacklists and bridge fees.
 * @notice This contract allows super administrators to manage global and token-specific blacklists,
 * update protocol parameters, and handle bridge fees.
 * @custom:security-contact support@gnus.ai
 */
contract GNUSControl is GeniusAccessControl {
    using GNUSControlStorage for GNUSControlStorage.Layout;

    uint256 private constant MAX_FEE = 200;

    /// @dev Emitted when addresses or token IDs are added to the blacklist.
    event AddToBlackList(uint256[] tokenIds, address[] addresses);

    /// @dev Emitted when addresses or token IDs are removed from the blacklist.
    event RemoveFromBlackList(uint256[] tokenIds, address[] addresses);

    /// @dev Emitted when an address is added to the global blacklist.
    event AddToGlobalBlackList(address bannedAddress);

    /// @dev Emitted when an address is removed from the global blacklist.
    event RemoveFromGlobalBlackList(address bannedAddress);

    /// @dev Emitted when the bridge fee is updated.
    /// @param newFee The new bridge fee value.
    event UpdateBridgeFee(uint256 indexed newFee);

    bytes4 constant GNUS_NFT_INIT_SELECTOR = bytes4(keccak256(bytes('GNUSNFTFactory_Initialize()')));
    bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice Initializes the protocol to version 2.30.
     * @dev Ensures the protocol version is not already initialized to 2.30 or greater.
     * Sets the protocol version to 230.
     */
    function GNUSControl_Initialize230() external onlySuperAdminRole {
        require(
            GNUSControlStorage.layout().protocolVersion < 230,
            "Constructor was already initialized >= 2.30"
        );

        GNUSControlStorage.layout().protocolVersion = 230;
        InitializableStorage.layout()._initialized = true;
    }

    /**
     * @notice Adds an address to the global transfer ban list.
     * @param bannedAddress The address to ban from transferring all tokens globally.
     */
    function banTransferorForAll(address bannedAddress) external onlySuperAdminRole {
        GNUSControlStorage.layout().gBannedTransferors[bannedAddress] = true;
        emit AddToGlobalBlackList(bannedAddress);
    }

    /**
     * @notice Removes an address from the global transfer ban list.
     * @param bannedAddress The address to unban from transferring all tokens globally.
     */
    function allowTransferorForAll(address bannedAddress) external onlySuperAdminRole {
        GNUSControlStorage.layout().gBannedTransferors[bannedAddress] = false;
        emit RemoveFromGlobalBlackList(bannedAddress);
    }

    /**
     * @notice Adds a batch of addresses and token IDs to the blacklist.
     * @param tokenIds The list of token IDs.
     * @param bannedAddresses The list of addresses to ban for the specified token IDs.
     */
    function banTransferorBatch(
        uint256[] calldata tokenIds,
        address[] calldata bannedAddresses
    ) external onlySuperAdminRole {
        for (uint256 i; i < tokenIds.length; ) {
            GNUSControlStorage.layout().bannedTransferors[tokenIds[i]][bannedAddresses[i]] = true;
            unchecked {
                ++i;
            }
        }
        emit AddToBlackList(tokenIds, bannedAddresses);
    }

    /**
     * @notice Removes a batch of addresses and token IDs from the blacklist.
     * @param tokenIds The list of token IDs.
     * @param bannedAddresses The list of addresses to unban for the specified token IDs.
     */
    function allowTransferorBatch(
        uint256[] calldata tokenIds,
        address[] calldata bannedAddresses
    ) external onlySuperAdminRole {
        for (uint256 i; i < tokenIds.length; ) {
            GNUSControlStorage.layout().bannedTransferors[tokenIds[i]][bannedAddresses[i]] = false;
            unchecked {
                ++i;
            }
        }
        emit RemoveFromBlackList(tokenIds, bannedAddresses);
    }

    /**
     * @notice Updates the bridge fee.
     * @param newFee The new bridge fee value.
     * @dev Ensures the new fee does not exceed the maximum allowed fee.
     */
    function updateBridgeFee(uint256 newFee) external onlySuperAdminRole {
        require(newFee <= MAX_FEE, "Too big fee");
        GNUSControlStorage.layout().bridgeFee = newFee;
        emit UpdateBridgeFee(newFee);
    }

    /**
     * @notice Sets the chain ID for the protocol.
     * @param chainID The new chain ID.
     */
    function setChainID(uint256 chainID) external onlySuperAdminRole {
        GNUSControlStorage.layout().chainID = chainID;
    }

    /**
     * @notice Retrieves protocol information.
     * @return bridgeFee The current bridge fee.
     * @return protocolVersion The current protocol version.
     * @return chainID The current chain ID.
     */
    function protocolInfo() external view returns (uint256 bridgeFee, uint256 protocolVersion, uint256 chainID) {
        bridgeFee = GNUSControlStorage.layout().bridgeFee;
        protocolVersion = GNUSControlStorage.layout().protocolVersion;
        chainID = GNUSControlStorage.layout().chainID;
    }

    /**
     * @notice Sets the protocol version.
     * @param protocolVersion The new protocol version.
     */
    function setProtocolVersion(uint256 protocolVersion) external onlySuperAdminRole {
        GNUSControlStorage.layout().protocolVersion = protocolVersion;
    }
}
