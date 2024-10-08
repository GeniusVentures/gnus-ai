// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.2;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Upgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@axelar-network/interchain-token-service/contracts/interfaces/ITokenManager.sol";
import "@axelar-network/interchain-token-service/contracts/interfaces/IInterchainTokenService.sol";

contract MockERC20Upgradeable is Initializable, ERC20Upgradeable {
    function __MockERC20_init(
        string memory _name,
        string memory _symbol,
        uint256 supply
    ) internal onlyInitializing {
        __ERC20_init_unchained(_name, _symbol);
        __MockERC20_init_unchained(_name, _symbol, supply);
    }

    function __MockERC20_init_unchained(
        string memory,
        string memory,
        uint256 supply
    ) internal onlyInitializing {
        _mint(msg.sender, supply);
    }

    function Token_Initialize(
        string memory _name,
        string memory _symbol,
        uint256 supply
    ) public initializer {
        __MockERC20_init(_name, _symbol, supply);
    }
}
