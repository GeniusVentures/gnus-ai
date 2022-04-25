// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/IERC20Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";

/// @custom:security-contact support@gnus.ai
contract PolyGNUSBridge is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl, IERC20Upgradeable
{
    using GNUSNFTFactoryStorage for GNUSNFTFactoryStorage.Layout;
    using ERC20Storage for ERC20Storage.Layout;
    bytes32 constant public PROXY_ROLE = keccak256("PROXY_ROLE");
    string constant public name = "Genius Token & NFT Collections";
    string constant public symbol = "GNUS";
    uint8 constant public decimals = 18;

    // no initialization function as it is already done by GNUSNFTFactory
    function PolyGNUSBridge_Initialize() public initializer onlySuperAdminRole {
        _grantRole(PROXY_ROLE, _msgSender());
        InitializableStorage.layout()._initialized = false;
        PolyGNUSBridge_Initialize_V1_0();
    }

    function PolyGNUSBridge_Initialize_V1_0() public onlySuperAdminRole {
        LibDiamond.diamondStorage().supportedInterfaces[type(IERC20Upgradeable).interfaceId] = true;
    }

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool) {
        return (ERC1155Upgradeable.supportsInterface(interfaceId) || AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
    }

    // The following functions are for the Ethereum -> Polygon Bridge for GNUS Tokens
    // Deposit ERC20 Tokens
    function deposit(address user, uint256 amount) external onlyRole(PROXY_ROLE) {

        // `amount` token getting minted here & equal amount got locked in RootChainManager
        // these are in Wei from the ERC20 contract.
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

    /**
      * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view override returns (uint256) {
        return totalSupply(GNUS_TOKEN_ID);
    }

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view override returns (uint256) {
        return balanceOf(account, GNUS_TOKEN_ID);
    }

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
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
    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return ERC20Storage.layout()._allowances[owner][spender];
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, ERC20Storage.layout()._allowances[owner][spender] + addedValue);
        return true;
    }

    /**
 * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = ERC20Storage.layout()._allowances[owner][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
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
        _safeTransferFrom(from, to, amount, GNUS_TOKEN_ID, "");
        emit Transfer(from, to, amount);
        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
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
    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

}

