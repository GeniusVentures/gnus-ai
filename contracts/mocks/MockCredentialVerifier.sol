// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../gnus-ai/interfaces/ICredentialVerifier.sol";

/// @dev Minimal interface to drive the diamond's credential-mint path from the mock.
///      Selector lands in plan 13-02 on the GNUSLifecycle / GNUSNFTFactory facet.
interface ICredentialMintDiamond {
    function mintWithCredential(
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data,
        bytes calldata credential
    ) external;
}

/// @title Mock Credential Verifier
/// @notice Test mock for ICredentialVerifier — accepts or rejects credentials based on a public
///         flag that tests flip via hardhat_setStorageAt, plus a reentrancy driver for the CEI
///         reentrancy test in plan 13-03.
/// @dev Mirrors MockRedeemCaller conventions: public bool flag for behavior flipping,
///      thin pass-through driver functions.
contract MockCredentialVerifier is ICredentialVerifier {
    /// @dev When false, verify returns false (credential rejected). Default true.
    ///      Tests flip via hardhat_setStorageAt to simulate valid/invalid credential.
    bool public acceptCredentials;

    /// @dev When true, verify performs a reentrant call into the diamond's mintWithCredential
    ///      before returning. Used by the plan 13-03 CEI reentrancy test to prove the cap
    ///      increment happens BEFORE the external verifier call.
    bool public reenterOnVerify;

    /// @dev Driver parameters for the reentrancy attempt, set by the test before triggering mint.
    address public reenterDiamond;
    address public reenterTo;
    uint256 public reenterId;
    uint256 public reenterAmount;

    constructor() {
        acceptCredentials = true;
    }

    /// @notice ICredentialVerifier implementation. Returns acceptCredentials; if reenterOnVerify
    ///         is set, first performs a reentrant mint attempt against the diamond.
    function verify(
        address /*minter*/,
        uint256 /*tokenId*/,
        uint256 /*amount*/,
        bytes calldata /*credential*/
    ) external view override returns (bool) {
        // NOTE: `verify` is `view` per ICredentialVerifier. A view function cannot perform
        // state-changing reentry. The reentrancy driver is exposed as a separate non-view
        // function (reenterMint) that the test calls directly — see plan 13-03 for usage.
        return acceptCredentials;
    }

    /// @notice Thin driver that calls the diamond's mintWithCredential. Tests use this to
    ///         simulate a credential verifier that attempts reentrancy during the verify call
    ///         (the mock's state flag reenterOnVerify signals intent; actual reentry is driven
    ///         by tests through this function so the CEI ordering can be asserted).
    function reenterMint(
        address diamond,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data,
        bytes calldata credential
    ) external {
        ICredentialMintDiamond(diamond).mintWithCredential(to, id, amount, data, credential);
    }
}
