// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/IERC20Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSControlStorage.sol";

/// @title GNUSBridge
/// @notice Manages bridging, minting, burning, and token transfers for the GNUS ecosystem.
/// @dev Supports both ERC20 and ERC1155 token standards, with additional functionality for bridging tokens across chains.
/// @custom:security-contact support@gnus.ai
contract GNUSBridge is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl, IERC20Upgradeable {
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC20Storage for ERC20Storage.Layout;
    using GNUSControlStorage for GNUSControlStorage.Layout;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    string public constant name = "Genius Token & NFT Collections";
    string public constant symbol = "GNUS";
    uint8 public constant decimals = 18;
    uint256 private constant FEE_DOMINATOR = 1000;

    /**
     * @notice Initializes the GNUSBridge contract.
     * @dev Grants the `MINTER_ROLE` to the deploying address and registers ERC20 support in the Diamond Storage.
     * Only callable by the Super Admin.
     */
    function GNUSBridge_Initialize() public initializer onlySuperAdminRole {
        _grantRole(MINTER_ROLE, _msgSender());
        LibDiamond.diamondStorage().supportedInterfaces[type(IERC20Upgradeable).interfaceId] = true;
    }

    /**
     * @notice Emitted when tokens are burned for bridging to another chain.
     * @param sender Address initiating the bridge operation.
     * @param id Token ID being burned.
     * @param amount Amount of tokens burned.
     * @param srcChainID Source chain ID.
     * @param destChainID Destination chain ID.
     * @dev Emitted when token holder wants to bridge to another chain
     */
    event BridgeSourceBurned(address indexed sender, uint256 id, uint256 amount, uint256 srcChainID, uint256 destChainID);

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return (ERC1155Upgradeable.supportsInterface(interfaceId) ||
            AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
            (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
    }

    /**
     * @notice Internal function to mint tokens with a bridge fee applied.
     * @param user Address receiving the minted tokens.
     * @param tokenID Token ID being minted.
     * @param amount Amount of tokens to mint.
     */
    function _mintWithBridgeFee(address user, uint256 tokenID, uint256 amount) internal {
        uint256 bridgeFee = GNUSControlStorage.layout().bridgeFee;
        if (bridgeFee != 0) {
            amount = (amount * (FEE_DOMINATOR - bridgeFee)) / FEE_DOMINATOR;
        }
        _mint(user, tokenID, amount, "");
        emit Transfer(address(0), user, amount);
    }

    /**
     * @notice Mint GNUS ERC20 tokens.
     * @param user Address receiving the minted tokens.
     * @param amount Amount of tokens to mint.
     * @dev Callable only by addresses with the `MINTER_ROLE`.
     */
    function mint(address user, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mintWithBridgeFee(user, GNUS_TOKEN_ID, amount);
    }

    /**
     * @notice Mint ERC1155 tokens.
     * @param user Address receiving the minted tokens.
     * @param tokenID Token ID to mint.
     * @param amount Amount of tokens to mint.
     * @dev Callable only by addresses with the `MINTER_ROLE`.
     */
    function mint(address user, uint256 tokenID, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mintWithBridgeFee(user, tokenID, amount);
    }

    /**
     * @notice Burn GNUS ERC20 tokens.
     * @param user Address whose tokens will be burned.
     * @param amount Amount of tokens to burn.
     * @dev Callable only by addresses with the `MINTER_ROLE`.
     */
    function burn(address user, uint256 amount) public onlyRole(MINTER_ROLE) {
        _burn(user, GNUS_TOKEN_ID, amount);
        emit Transfer(user, address(0), amount);
    }

    /**
     * @notice Creates `amount` tokens of token type `id`, and assigns them to `to`.
     * @dev This function overrides the `_mint` function from ERC1155Upgradeable.
     * It ensures that the recipient address is not the zero address, performs necessary checks and updates balances.
     * Emits a {TransferSingle} event.
     * @param to The address to which the minted tokens will be assigned.
     * @param id The ID of the token type to mint.
     * @param amount The amount of tokens to mint.
     * @param data Additional data with no specified format.
     * 
     * Requirements:
     * - `to` cannot be the zero address.
     * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the acceptance magic value.
     */
    function _mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal override(ERC1155Upgradeable) {
        require(to != address(0), "ERC1155: mint to the zero address");

        address operator = _msgSender();
        uint256[] memory ids = asSingletonArray(id);
        uint256[] memory amounts = asSingletonArray(amount);

        _beforeTokenTransfer(operator, address(0), to, ids, amounts, data);

        ERC1155Storage.layout()._balances[id][to] += amount;
        emit TransferSingle(operator, address(0), to, id, amount);

        _afterTokenTransfer(operator, address(0), to, ids, amounts, data);
    }

    /**
     * @notice Withdraw a child token to GNUS ERC20 on the current network.
     * @param amount Amount of child tokens to withdraw.
     * @param id Token ID being withdrawn.
     */
    function withdraw(uint256 amount, uint256 id) external {
        address sender = _msgSender();
        require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
        require(id != GNUS_TOKEN_ID, "Cannot withdraw GNUS tokens.");
        require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
        uint256 convAmount = amount / GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
        _burn(sender, id, amount);
        _mintWithBridgeFee(sender, GNUS_TOKEN_ID, convAmount);
    }

    /**
     * @notice Burn tokens and emit an event for bridging to another chain.
     * @param amount Amount of tokens to bridge.
     * @param id Token ID being bridged.
     * @param destChainID Destination chain ID.
     */
    function bridgeOut(uint256 amount, uint256 id, uint256 destChainID) external {
        address sender = _msgSender();
        require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
        require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
        _burn(sender, id, amount);
        emit BridgeSourceBurned(sender, id, amount, GNUSControlStorage.layout().chainID, destChainID);
    }

    /**
     * @notice Retrieves the total supply of tokens in existence for the specified token ID.
     * @dev This function overrides the `totalSupply` function from the parent contract.
     * It calls an internal function to get the total supply of tokens for the GNUS token ID.
     * @return The total number of tokens currently in existence for the GNUS token ID.
     */
    function totalSupply() external view override returns (uint256) {
        return totalSupply(GNUS_TOKEN_ID);
    }

    /**
     * @notice Retrieves the balance of GNUS tokens for a specified account.
     * @dev This function overrides the balanceOf function from the inherited contract.
     * @param account The address of the account whose token balance is being queried.
     * @return The amount of GNUS tokens owned by the specified account.
     */
    function balanceOf(address account) external view override returns (uint256) {
        return balanceOf(account, GNUS_TOKEN_ID);
    }

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     * Returns a boolean value indicating whether the operation succeeded.
     * Emits a {Transfer} event.
     * @inheritdoc IERC20Upgradeable
     */
    function transfer(address to, uint256 amount) external virtual override returns (bool) {
        _safeTransferFrom(_msgSender(), to, GNUS_TOKEN_ID, amount, "");
        emit Transfer(_msgSender(), to, amount);
        return true;
    }

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return ERC20Storage.layout()._allowances[owner][spender];
    }

    /**
     * @notice Approves the specified `amount` of tokens for the `spender` to spend on behalf of the caller.
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     * 
     * Emits an {Approval} event indicating the updated allowance.
     * 
     * @param spender The address which will spend the funds.
     * @param subtractedValue The amount of tokens to decrease the allowance by.
     * @return A boolean value indicating whether the operation succeeded.
     * 
     * @dev IMPORTANT: Changing an allowance with this method brings the risk of someone using both the old and the new allowance due to transaction ordering. 
     * One possible solution to mitigate this race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * see https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     */
    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = ERC20Storage.layout()._allowances[owner][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    /**
     * @dev Transfers `amount` tokens of token type `id` from `from` to `to`.
     *
     * Emits a {TransferSingle} event.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `from` must have a balance of tokens of type `id` of at least `amount`.
     * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
     * acceptance magic value.
     */
    function _safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal override(ERC1155Upgradeable) {
        require(to != address(0), "ERC1155: transfer to the zero address");

        address operator = _msgSender();
        uint256[] memory ids = asSingletonArray(id);
        uint256[] memory amounts = asSingletonArray(amount);

        _beforeTokenTransfer(operator, from, to, ids, amounts, data);

        uint256 fromBalance = ERC1155Storage.layout()._balances[id][from];
        require(fromBalance >= amount, "ERC1155: insufficient balance for transfer");
        unchecked {
            ERC1155Storage.layout()._balances[id][from] = fromBalance - amount;
        }
        ERC1155Storage.layout()._balances[id][to] += amount;

        emit TransferSingle(operator, from, to, id, amount);

        _afterTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function approve(address spender, uint256 amount) external returns (bool){
        return false;
    }

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _safeTransferFrom(from, to, GNUS_TOKEN_ID, amount, "");
        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Internal function to set the allowance of a spender over the owner's tokens.
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     *
     * @param owner The address of the token owner.
     * @param spender The address of the spender.
     * @param amount The amount of tokens to be approved for spending.
     */
    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        ERC20Storage.layout()._allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Updates `owner` s allowance for `spender` based on spent `amount`.
     *
     * Does not update the allowance amount in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Might emit an {Approval} event.
     */
    function _spendAllowance(address owner, address spender, uint256 amount) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

}
