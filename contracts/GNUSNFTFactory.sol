// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "./GNUSERC1155MaxSupply.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";

/// @custom:security-contact support@gnus.a
contract GNUSNFTFactory is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl
{
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC1155SupplyStorage for ERC1155SupplyStorage.Layout;

    bytes32 constant public CREATOR_ROLE = keccak256("CREATOR_ROLE");

    // one time initialization on, subsequent calls get ignored with initializer
    function GNUSNFTFactory_Initialize() public onlySuperAdminRole {
        InitializableStorage.layout()._initializing = true;
        __ERC1155_init("");
        __Pausable_init();
        __ERC1155Burnable_init();
        __ERC1155Supply_init();
        __GeniusAccessControl_init();

        address superAdmin = _msgSender();
        _grantRole(CREATOR_ROLE, superAdmin);

        createNFT(GNUS_TOKEN_ID, GNUS_NAME,  GNUS_SYMBOL, 1.0, GNUS_MAX_SUPPLY,  GNUS_URI);

        InitializableStorage.layout()._initialized = false;
    }

    function GNUSNFTFactory_Initialize230() public onlySuperAdminRole {
        if (!GNUSNFTFactoryStorage.layout().NFTs[GNUS_TOKEN_ID].nftCreated) {
            GNUSNFTFactory_Initialize();
        }
    }

    // set the top level URI for GNUS Token NFT
    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
        GNUSNFTFactoryStorage.layout().NFTs[GNUS_TOKEN_ID].uri = newuri;
    }

    // allow the minters to change their token URI
    function setURI(uint256 id, string memory newuri) public {

        address sender = _msgSender();
        NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
        require(nft.nftCreated, "NFT must have been created to set the URI for");
        require((nft.creator == sender) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Only Admin or Creator can set URI of NFT");
        nft.uri = newuri;
    }

    function uri(uint256 id) public view virtual override(ERC1155Upgradeable) returns (string memory) {

        NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
        require(nft.nftCreated, "NFT must already be created to get the URI for it");
        return nft.uri;
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function beforeMint(address to, uint256 id, NFT storage nft, uint256 amount) internal {
        address sender = _msgSender();
        require(id != GNUS_TOKEN_ID, "Shouldn't mint GNUS tokens tokens, only deposit and withdraw");
        require(to != address(0), "ERC1155: mint to the zero address");
        require(nft.nftCreated, "Cannot mint NFT that doesn't exist");
        require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Creator or Admin can only mint NFT");
        if ((id >> 128) == GNUS_TOKEN_ID) {
            uint256 convAmount = amount * nft.exchangeRate;
            require(balanceOf(sender, GNUS_TOKEN_ID) >= convAmount, "Not enough GNUS_TOKEN to burn");
            _burn(sender, GNUS_TOKEN_ID, convAmount);
        }
    }

    function mint(address to, uint256 id, uint256 amount, bytes memory data) external {
        NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];

        beforeMint(to, id, nft, amount);
        _mint(to, id, amount, data);

    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external {

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
            beforeMint(to, id, nft, amounts[i]);
        }

        _mintBatch(to, ids, amounts, data);
    }

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool) {
        return (ERC1155Upgradeable.supportsInterface(interfaceId) || AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
    }

    function createNFT(uint256 parentID, string memory name, string memory symbol, uint256 exchRate, uint256 max_supply,
        string memory newuri) public {
            createNFTs(parentID, asSingletonArray(name),  asSingletonArray(symbol),  asSingletonArray(exchRate), asSingletonArray(max_supply),  asSingletonArray(newuri));
    }

    function createNFTs(uint256 parentID, string[] memory names, string[] memory symbols, uint256[] memory exchRates, uint256[] memory max_supplies,
        string[] memory newuris) public {

        address sender = _msgSender();
        NFT memory nft = GNUSNFTFactoryStorage.layout().NFTs[parentID];
        if (parentID == GNUS_TOKEN_ID) {
            require(hasRole(DEFAULT_ADMIN_ROLE, sender) || (hasRole(CREATOR_ROLE, sender)), "Only Creators or Admins can create NFT child of GNUS");
        } else {
            require(nft.nftCreated, "Parent NFT Should have been created already");
            require(sender == nft.creator, "Only parent creator can create child NFTs");
        }
        uint numToCreate = names.length;
        require((numToCreate == symbols.length) && (numToCreate == exchRates.length) && (numToCreate == max_supplies.length) && (numToCreate == newuris.length),
            "NFT creation array lengths, should be the same");
        for (uint256 i=0; i< names.length; i++) {
            if (parentID == GNUS_TOKEN_ID) {
                require(exchRates[i] > 0, "Exchange Rate has to be > 0 for creating a new Child NFT of GNUS");
            }
            uint256 newTokenID = (parentID << 128) | nft.childCurIndex++;
            GNUSNFTFactoryStorage.layout().NFTs[newTokenID] = NFT({name: names[i], symbol: symbols[i], exchangeRate: exchRates[i],
                maxSupply: max_supplies[i], uri: newuris[i], creator: sender, childCurIndex: 0, nftCreated: true});
        }
        GNUSNFTFactoryStorage.layout().NFTs[parentID].childCurIndex = nft.childCurIndex;
    }

    function getNFTInfo(uint256 id) public view returns(NFT memory){
        require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "No Token created for this ID");
        return GNUSNFTFactoryStorage.layout().NFTs[id];
    }


}
