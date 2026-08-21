// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/utils/introspection/IERC165Upgradeable.sol";

interface IGNUSRedeemDiamond {
    function redeem(uint256 childId, uint256 amount) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

/// @title Mock Redeem Caller
/// @notice Minimal contract holder that redeems child tokens through the diamond.
/// @dev Implements IERC1155Receiver ONLY so the owner can mint child tokens to it
///      through GNUSNFTFactory (whose _mint keeps the acceptance check). The
///      redeem path itself (CR-01 _mint override) must succeed without any hook —
///      a plain non-receiver caller would work for redeem; this mock needs the
///      receiver solely to hold a balance in the first place.
contract MockRedeemCaller is IERC1155ReceiverUpgradeable {
    /// @dev Post-fix this always succeeds (the receiver magic value is returned).
    ///      Flipped to true by the WR-01 test via hardhat_setStorageAt to simulate
    ///      a recipient that rejects the mint-back — pre-CR-01 that rejection came
    ///      from the OZ acceptance check itself; post-fix the mint-back has no hook,
    ///      so the revert is only reachable through this flag.
    bool public rejectTransfers;

    function redeem(address diamond, uint256 childId, uint256 amount) external {
        IGNUSRedeemDiamond(diamond).redeem(childId, amount);
    }

    function childBalance(address diamond, uint256 childId) external view returns (uint256) {
        return IGNUSRedeemDiamond(diamond).balanceOf(address(this), childId);
    }

    function gnusBalance(address diamond) external view returns (uint256) {
        return IGNUSRedeemDiamond(diamond).balanceOf(address(this), 0);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        require(!rejectTransfers, "MockRedeemCaller: transfer rejected");
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155ReceiverUpgradeable).interfaceId ||
            interfaceId == type(IERC165Upgradeable).interfaceId;
    }
}
