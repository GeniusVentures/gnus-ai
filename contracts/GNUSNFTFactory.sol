// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/security/PausableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/UUPSUpgradeable.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";

/// @custom:security-contact support@gnus.ai
contract GNUSNFTFactory is Initializable, ERC1155Upgradeable, PausableUpgradeable,
    ERC1155BurnableUpgradeable, ERC1155SupplyUpgradeable, UUPSUpgradeable, GeniusAccessControl
{
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;

    struct Token {
        string name;
        string symbol;
        uint256 exchangeRate;
        uint256 maxSupply;      // maximum supply of tokens
        string uri;             // custom URI for child token base
        address owner;          // the creator of the token
        bool tokenCreated;      // if there is a mapping/token created
    }

    struct ChildNFT {
        uint256 parentID;           // the parent token of this NFT
        uint256 maxSupply;      // maximum supply of tokens
        string uri;             // custom URI for child token base
        bool nftCreated;        // if the NFT was created
    }

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // one time initialization on, subsequent calls get ignored with initializer
    function GNUSNFTFactory_Initialize() public initializer onlySuperAdminRole {
        __ERC1155_init("");
        __Pausable_init();
        __ERC1155Burnable_init();
        __ERC1155Supply_init();
        __UUPSUpgradeable_init();
        __GeniusAccessControl_init();

        address superAdmin = LibDiamond.diamondStorage().contractOwner;
        grantRole(MINTER_ROLE, superAdmin);
        grantRole(PAUSER_ROLE, superAdmin);

        createToken(GNUS_NAME, GNUS_SYMBOL, 1.0 * GNUS_DECIMALS, GNUS_MAX_SUPPLY, GNUS_URI);

        InitializableStorage.layout()._initialized = false;
    }

    // set the top level URI for GNUS Tokens
    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
        GNUSNFTFactoryStorage.layout().Tokens[GNUS_TOKEN_ID].uri = newuri;
    }

    // allow the minters to change their token URI
    function setURI(string memory newuri, uint256 id) public onlyRole(MINTER_ROLE) {

        address operator = _msgSender();
        require(GNUSNFTFactoryStorage.layout().Tokens[id].tokenCreated, "Base Token must have been created to set the URI for");
        require((GNUSNFTFactoryStorage.layout().Tokens[id].owner == operator) || hasRole(DEFAULT_ADMIN_ROLE, operator), "Only Admin or Owner can set URI of Token");
        GNUSNFTFactoryStorage.layout().Tokens[id].uri = newuri;
    }

    function uri(uint256 id) public view virtual override(ERC1155Upgradeable) returns (string memory) {

        if (GNUSNFTFactoryStorage.layout().Tokens[id].tokenCreated) {
            return GNUSNFTFactoryStorage.layout().Tokens[id].uri;
        } else {
            require(GNUSNFTFactoryStorage.layout().ChildNFTs[id].nftCreated, "Token or NFT must already be created to get the URI for it");
            return GNUSNFTFactoryStorage.layout().Tokens[GNUSNFTFactoryStorage.layout().ChildNFTs[id].parentID].uri;
        }
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data) external onlyRole(MINTER_ROLE) {

        require(account != address(0), "ERC1155: mint to the zero address");

        address operator = _msgSender();

        // if minting a token, then have to have on deposit (GNUS tokens / conversion)
        // tokens to mint them and be the owner. This also can transfer GNUS_TOKENS between addresses
        if (GNUSNFTFactoryStorage.layout().Tokens[id].tokenCreated) {
            require((operator == GNUSNFTFactoryStorage.layout().Tokens[id].owner) || hasRole(DEFAULT_ADMIN_ROLE, operator), "Owner or Admin can only mint tokens");
            uint256 convAmount = amount * GNUSNFTFactoryStorage.layout().Tokens[id].exchangeRate;
            require(balanceOf(operator, GNUS_TOKEN_ID) >= convAmount, "Not enough GNUS_TOKEN to burn");
            _burn(operator, GNUS_TOKEN_ID, convAmount);
        } else {
            //           require(ChildNFTs[id].nftCreated, "Token ID doesn't match any precreated Token, so nothing to mint");
            //           require((GNUSNFTFactoryStorage.layout().Tokens[GNUSNFTFactoryStorage.layout().ChildNFTs[id].parentID].owner == operator) || hasRole(DEFAULT_ADMIN_ROLE, operator), "caller must be Admin or Owner of parent token of NFT");
        }

        //        _mint(account, id, amount, data);

    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external
        onlyRole(MINTER_ROLE) {

        address operator = _msgSender();

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            if (GNUSNFTFactoryStorage.layout().Tokens[id].tokenCreated) {
                require((operator == GNUSNFTFactoryStorage.layout().Tokens[id].owner) || hasRole(DEFAULT_ADMIN_ROLE, operator), "Owner or Admin can only mint tokens");
                uint256 convAmount = amounts[i] * GNUSNFTFactoryStorage.layout().Tokens[id].exchangeRate;
                // if minting any child token, then have to have on deposit (GNUS tokens / conversion),
                // tokens to mint them and be the owner
                _burn(operator, GNUS_TOKEN_ID, convAmount);
            }
        }

        _mintBatch(to, ids, amounts, data);
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids,
        uint256[] memory amounts, bytes memory data) internal whenNotPaused
    override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {

        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool) {
        return (ERC1155Upgradeable.supportsInterface(interfaceId) || AccessControlEnumerableUpgradeable.supportsInterface(interfaceId));
    }

    function _createToken(address owner, string memory name, string memory symbol, uint256 exchRate, uint256 max_supply,
        string memory newuri) internal {

        require(exchRate > 0, "Exchange Rate has to be >0 for creating a new token");
        GNUSNFTFactoryStorage.layout().Tokens[GNUSNFTFactoryStorage.layout().NFTCurIndex++] = Token({name: name, symbol: symbol, exchangeRate: exchRate,
            maxSupply: max_supply, uri: newuri, owner: owner, tokenCreated: true});

    }

    // create new token that will be the base token for other NFTs
    function createToken(string memory name, string memory symbol, uint256 exchRate, uint256 max_supply,
        string memory newuri) public onlyRole(MINTER_ROLE) {

        _createToken(_msgSender(), name, symbol, exchRate, max_supply, newuri);
    }

    // Admin create new token that will be the base token for other NFTs
    function createToken(address owner, string memory name, string memory symbol, uint256 exchRate, uint256 max_supply,
        string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {

        _createToken(owner, name, symbol, exchRate, max_supply, newuri);
    }

    // create a sub NFT for an existing parent Token
    function createNFT(uint256 parentID, uint256 max_supply, string memory newuri) external onlyRole(MINTER_ROLE) {

        address operator = _msgSender();
        require(GNUSNFTFactoryStorage.layout().Tokens[parentID].tokenCreated, "Parent token should have been created first");
        require((GNUSNFTFactoryStorage.layout().Tokens[parentID].owner == operator) || hasRole(DEFAULT_ADMIN_ROLE, operator), "Caller must be Admin or Owner of parent Token to create MFTs");
        GNUSNFTFactoryStorage.layout().ChildNFTs[GNUSNFTFactoryStorage.layout().NFTCurIndex++] = ChildNFT({parentID: parentID, maxSupply: max_supply, uri: newuri, nftCreated: true});
    }

    function _mintChildToken(address operator, uint256 id, uint256 amount, address to) internal {

        require(balanceOf(operator, id) + amount <= GNUSNFTFactoryStorage.layout().Tokens[id].maxSupply, "Conversion would exceed Max Supply of Child Token");
        uint256 convAmount = GNUSNFTFactoryStorage.layout().Tokens[id].exchangeRate * amount;
        // this will assert with underflow
        _burn(operator, GNUS_TOKEN_ID, convAmount);
        _mint(to, id, amount, "");
    }

    function getTokenInfo(uint256 id) public view returns(Token memory){
        require(GNUSNFTFactoryStorage.layout().Tokens[id].tokenCreated, "No Token created for this ID");
        return GNUSNFTFactoryStorage.layout().Tokens[id];
    }

}

