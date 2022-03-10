// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";

/// @custom:security-contact support@gnus.ai
contract PolyGNUSBridge is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl
{
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;

    bytes32 public constant PROXY_ROLE = keccak256("PROXY_ROLE");

    // no initialization function as it is already done by GNUSNFTFactory
    function PolyGNUSBridge_Initialize() public initializer onlySuperAdminRole {
        _grantRole(PROXY_ROLE, _msgSender());
        InitializableStorage.layout()._initialized = false;
    }

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool) {
        return (ERC1155Upgradeable.supportsInterface(interfaceId) || AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
    }

    event Transfer(address indexed from, address indexed to, uint256 value);

    // The following functions are for the Ethereum -> Polygon Bridge for GNUS Tokens
    // Deposit ERC20 Tokens
    function deposit(address user, uint256 amount) external onlyRole(PROXY_ROLE) {

        // `amount` token getting minted here & equal amount got locked in RootChainManager
        _mint(user, GNUS_TOKEN_ID, amount, "");

        // emit ERC20 Transfer notification
        emit Transfer(address(0), user, amount);
    }

    // withdraw ERC 20 tokens (GNUS Tokens)
    function withdraw(uint256 amount) public {

        address sender = _msgSender();

        _burn(sender, GNUS_TOKEN_ID, amount);

        // emit ERC20 Transfer notification
        emit Transfer(sender, address(0), amount);

    }

    // this will withdraw a child token to a GNUS Token on the Ethereum network
    function withdraw(uint256 amount, uint256 id) external {

        address sender = _msgSender();

        require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "This token can't be withdrawn, as it hasn't been created yet!");
        // first burn the child createToken
        require(balanceOf(sender, id) >= amount, "Not enough child tokens to withdraw");
        uint256 convAmount = amount / GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
        _burn(sender, id, amount);
        // emit ERC20 Transfer notification
        emit Transfer(sender, address(0), convAmount);
    }

}

