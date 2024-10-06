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
 * @title Security Control Contract
 * @author ruymaster, supergenius
 * @notice This contract handles security for the protocol.
 */
contract GNUSControl is GeniusAccessControl {
    using GNUSControlStorage for GNUSControlStorage.Layout;

    uint256 private constant MAX_FEE = 200;
    event AddToBlackList(uint256[] tokenIds, address[] addresses);
    event RemoveFromBlackList(uint256[] tokenIds, address[] addresses);
    event AddToGlobalBlackList(address bannedAddress);
    event RemoveFromGlobalBlackList(address bannedAddress);
    event UpdateBridgeFee(uint256 indexed);
    bytes4 constant GNUS_NFT_INIT_SELECTOR = bytes4(keccak256("GNUSNFTFactory_Initialize()"));
    bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function GNUSControl_Initialize230() external onlySuperAdminRole {
        address sender = _msgSender();
        require(
            GNUSControlStorage.layout().protocolVersion < 230,
            "constructor was already initialized >= 2.30"
        );

        if (!GNUSNFTFactoryStorage.layout().NFTs[GNUS_TOKEN_ID].nftCreated) {
            // Perform the low-level call with the bytes array
            (bool success, bytes memory data) = address(this).call(abi.encode(GNUS_NFT_INIT_SELECTOR));
            require(success, "GNUS NFT initialization failed");
        }

        if (!hasRole(MINTER_ROLE, sender)) {
            grantRole(MINTER_ROLE, sender);
        }
        GNUSControlStorage.layout().protocolVersion = 230;
        InitializableStorage.layout()._initialized = false;
    }

    function banTransferorForAll(address bannedAddress) external onlySuperAdminRole {
        GNUSControlStorage.layout().gBannedTransferors[bannedAddress] = true;
        emit AddToGlobalBlackList(bannedAddress);
    }

    function allowTransferorForAll(address bannedAddress) external onlySuperAdminRole {
        GNUSControlStorage.layout().gBannedTransferors[bannedAddress] = false;
        emit RemoveFromGlobalBlackList(bannedAddress);
    }

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

    function updateBridgeFee(uint256 newFee) external onlySuperAdminRole {
        require(newFee <= MAX_FEE, "Too big fee");
        GNUSControlStorage.layout().bridgeFee = newFee;
        emit UpdateBridgeFee(newFee);
    }

    function setChainID(uint256 chainID) external onlySuperAdminRole {
        GNUSControlStorage.layout().chainID = chainID;
    }

    function protocolInfo() external view returns (uint256 bridgeFee, uint256 protocolVersion, uint256 chainID) {
        bridgeFee = GNUSControlStorage.layout().bridgeFee;
        protocolVersion = GNUSControlStorage.layout().protocolVersion;
        chainID = GNUSControlStorage.layout().chainID;
    }

}
