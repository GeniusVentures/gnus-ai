---
phase: 11-erc-20-proxy-hardening
reviewed: 2026-08-21T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - contracts/gnus-ai/GNUSRedeemAdapter.sol
  - test/unit/GNUSRedeemAdapter.test.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 11: Post-Ship Rework Review — GNUSRedeemAdapter caller-bound simplification

**Reviewed:** 2026-08-21
**Depth:** standard
**Files Reviewed:** 2 (read in `gnus-ai/` submodule: `gnus-ai/contracts/gnus-ai/GNUSRedeemAdapter.sol`, `gnus-ai/test/unit/GNUSRedeemAdapter.test.ts`)
**Status:** issues_found

## Summary

Retroactive review of the caller-bound direct-burn rework. Cross-referenced
`GNUSERC1155MaxSupply._beforeTokenTransfer`, `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw`,
`GNUSTreasury.convert`, the diamond-config facet registration, and the actual
`ERC1155Upgradeable._mint` implementation in
`@gnus.ai/contracts-upgradeable-diamond`.

Verified as correct:

- **Limiter attribution and single-charge (WR-07).** The explicit
  `checkAndRecordWithdraw(from, amount)` keyed to the caller is the only charge:
  the burn leg is a child id (skipped by the hook's `id == GNUS_TOKEN_ID` filter)
  and the mint leg is hook-exempt (`isMinting` short-circuits aggregation).
  Matches the `GNUSTreasury.convert` GNUS-terminal charge matrix exactly.
- **CEI ordering.** Limiter charge -> `_burn` -> `_mint` -> `Redeemed` event. A
  limiter revert occurs before any state mutation; a burn/mint revert rolls back
  the limiter record atomically.
- **Supply neutrality.** Burn of child + mint of GNUS conserves minions; the
  mint leg intentionally bypasses `_mintWithBridgeFee`'s global-cap accounting,
  identical to `convert`'s GNUS-terminal leg (GNUSBridge.sol:134-135 documents
  this as deliberate: "conversion conserves").
- **No-custody hook reverts break no internal flow.** Grep across all facets
  finds no `_mint(address(this), ...)`, no `safeTransferFrom(..., address(this), ...)`,
  and no escrow/custody pattern targeting the diamond address. The unconditional
  `onERC1155Received`/`onERC1155BatchReceived` reverts only affect external
  senders. (Note: the GNUSBridge `_safeTransferFrom` override never calls the
  acceptance check, so ERC-20-style `transfer(diamond, ...)` already succeeds
  silently today — the hooks only gate the ERC-1155 `safeTransferFrom` path.)
- **Selector surface.** Old 4-arg selector gone; new `redeem(uint256,uint256)`
  registered via facet config (`geniusdiamond.config.json:120`); loupe test pins
  both. Facet is stateless (diamond-storage libraries only), so the deleted
  `REDEEM_IN_PROGRESS_SLOT` machinery leaves no live state.
- **Mock harness deletion.** `MockERC20Proxy.sol` / `ReenteringRecipient.sol`
  are gone from source; only planning docs reference them.

However, one premise of the rework is **factually wrong**, and it produces a
real defect: the claim that "OZ `_mint` does NOT call `onERC1155Received`" is
false for this facet's inheritance chain. See CR-01.

## Critical Issues

### CR-01: `_mint` DOES invoke the receiver hook — contract callers cannot redeem, and a reentrancy window exists

**File:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:93`
**Issue:** The rework's reentrancy analysis (11-POST-SHIP-REWORK.md and the
review context: "OZ `_mint` does NOT call `onERC1155Received`; only
`_safeTransferFrom` does") is incorrect **for this facet**. That claim is true
only for `GNUSBridge`, which overrides `_mint` (GNUSBridge.sol:198-216) and
omits the acceptance check. `GNUSRedeemAdapter` does **not** inherit from
`GNUSBridge`; its `_mint` resolves through
`GNUSERC1155MaxSupply -> ERC1155SupplyUpgradeable -> ERC1155Upgradeable._mint`,
and `ERC1155Upgradeable._mint` (line 283) calls
`_doSafeTransferAcceptanceCheck`, which — when the recipient `to.isContract()` —
externally calls `to.onERC1155Received(operator, address(0), id, amount, data)`
and reverts unless the magic value is returned
(`ERC1155Upgradeable.sol:461-480`).

Because `redeem` hard-binds the mint recipient to the caller
(`_mint(from, GNUS_TOKEN_ID, amount, "")`), two consequences follow:

1. **Functional denial for contract holders.** Any child-token holder that is a
   contract — a Gnosis Safe, a smart wallet, or one of the external ERC-20 proxy
   contracts this very phase exists to serve (PROXY-03) — will have `redeem`
   revert with `"ERC1155: transfer to non ERC1155Receiver implementer"` (or the
   rejection string) unless it implements `IERC1155Receiver`. The burn is rolled
   back atomically, so no funds are lost, but the redemption path is unusable
   for exactly the contract-caller demographic the phase targets. Unlike
   `GNUSTreasury.convert`, where the caller can route the mint leg to an EOA via
   the `to` parameter, `redeem` offers no escape hatch.
2. **Reentrancy window.** A contract caller's `onERC1155Received` hook executes
   after the burn+mint state changes but before `redeem` returns (only the
   `Redeemed` event is pending). A reentrant `redeem` would re-charge the
   caller's limiter and burn/mint again from the caller's own balance — bounded
   to self-affecting behavior, so not a theft vector, but the "no reentrancy
   surface remains" claim is wrong, and the deleted `REDEEM_IN_PROGRESS_SLOT`
   flag was the mechanism that previously made this explicit.

**Fix:** Pick one of:
- (a) Override `_mint` in `GNUSRedeemAdapter` (or route through a shared
  internal) mirroring `GNUSBridge._mint` — no acceptance check — making the
  diamond's mint behavior uniform across facets and the doc claim true. This
  matches the existing diamond convention (GNUSBridge already mints to contracts
  without a hook, e.g. bridge-in to a contract address).
- (b) Keep the hook but document it, revert the "no reentrancy surface" claim in
  11-POST-SHIP-REWORK.md, and add tests covering (i) a contract caller that
  implements `IERC1155Receiver` redeeming successfully and (ii) a contract
  caller that does not, reverting. Note that (b) leaves the PROXY-03 use case
  broken for non-receiver proxies.

Option (a) is the minimal, convention-consistent fix:

```solidity
/// @dev Mirrors GNUSBridge._mint: no receiver acceptance check, so contract
///      holders (Safes, ERC-20 proxies) can redeem. Burn+mint state is final
///      before any external interaction; the only external call eliminated is
///      the recipient hook on the caller itself.
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
```

Whichever option is chosen, the rework doc's security rationale must be
corrected — downstream reviewers are currently being told a falsehood about the
code's external-call surface.

## Warnings

### WR-01: Insufficient-balance test asserts the supply-exhaustion revert, not the balance revert

**File:** `test/unit/GNUSRedeemAdapter.test.ts:289-295`
**Issue:** The "reverts when caller has insufficient balance" case redeems 200
child when only 100 exist **in total supply**. The revert therefore fires in
`ERC1155SupplyUpgradeable._beforeTokenTransfer`
(`require(supply >= amount, "ERC1155: burn amount exceeds totalSupply")`)
*before* the caller-balance check in `_burn`
(`"ERC1155: burn amount exceeds balance"`) is ever reached. The test name
promises caller-balance coverage but actually pins supply-exhaustion. The
caller-balance path — amount <= totalSupply but > caller balance (e.g. two
holders each with 100, one redeems 150) — is untested.
**Fix:** Add a second holder and mint additional supply so total supply exceeds
the attempted redeem amount, then assert `'ERC1155: burn amount exceeds balance'`;
keep the existing case but rename it to reflect supply exhaustion.

### WR-02: No contract-caller or reentrancy test coverage for the mint-back hook

**File:** `test/unit/GNUSRedeemAdapter.test.ts` (suite-wide)
**Issue:** The rework deleted `ReenteringRecipient.sol` on the premise that no
reentrancy surface remains, and deleted `MockERC20Proxy.sol` on the premise that
contract callers are out of scope. Per CR-01, both premises are false for this
facet's `_mint` resolution. The suite has no test where the caller is a
contract, so the CR-01 denial-of-service ships undetected; and there is no test
pinning behavior when the caller's receiver hook reenters `redeem`.
**Fix:** After resolving CR-01, add (i) a minimal contract caller implementing
`IERC1155Receiver` that redeems successfully, and (ii) either a reverting
non-receiver contract caller (option b) or a reentering receiver proving the
hook is gone (option a).

## Info

### IN-01: Diamond advertises `IERC1155Receiver` while rejecting all inbound transfers

**File:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:41,50-64`
**Issue:** `supportsInterface` reports `type(IERC1155ReceiverUpgradeable).interfaceId`
as supported, yet both receiver functions revert unconditionally. This is
intentional (loud rejection per the no-custody model) and internally
consistent — the interface must be declared for the reverts to be reachable via
the standard acceptance-check path — but integrators probing ERC-165 will see a
receiver that can never receive. A one-line comment in `supportsInterface`
noting "advertised so safeTransfer reverts with our reason string instead of
'non ERC1155Receiver implementer'" would prevent future confusion.
**Fix:** Add the comment; no code change.

### IN-02: `Initializable` inherited but never used

**File:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:4,24`
**Issue:** The facet inherits `Initializable` but declares no initializer, and
the facet config (`geniusdiamond.config.json:120-128`) registers no
`deployInit`/`upgradeInit` for it. This matches the pattern of several sibling
facets, so it is consistent rather than wrong, but the import and base class are
dead weight here.
**Fix:** Optional — drop `Initializable` from the inheritance list and imports,
or leave for facet-pattern uniformity. No functional impact.

---

_Reviewed: 2026-08-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
