// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "contracts-starter/contracts/facets/DiamondLoupeFacet.sol";
import "contracts-starter/contracts/facets/DiamondCutFacet.sol";
import "contracts-starter/contracts/Diamond.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/utils/introspection/ERC165StorageUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/IERC1155Upgradeable.sol";
import "./GeniusOwnershipFacet.sol";

contract GeniusDiamond is Diamond, ERC165StorageUpgradeable {

    using LibDiamond for LibDiamond.DiamondStorage;

    constructor(address _contractOwner, address _diamondCutFacet) initializer payable
        Diamond(_contractOwner, _diamondCutFacet) {
        __ERC165Storage_init();
        // this is so that any contract deployment watchers will be able to check interfaces on deployment
        _registerInterface(type(IERC1155Upgradeable).interfaceId);
        _registerInterface(type(IERC165Upgradeable).interfaceId);
        _registerInterface(type(IDiamondCut).interfaceId);
        _registerInterface(type(IDiamondLoupe).interfaceId);
        InitializableStorage.layout()._initialized = false;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId) ||
            LibDiamond.diamondStorage().supportedInterfaces[interfaceId];
    }
}
