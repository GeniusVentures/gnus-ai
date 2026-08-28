---
phase: 11-erc-20-proxy-hardening
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - contracts/gnus-ai/GNUSRedeemAdapter.sol
  - diamonds/GeniusDiamond/geniusdiamond.config.json
  - test/unit/GNUSRedeemAdapter.test.ts
  - contracts/gnus-ai/testing/MockERC20Proxy.sol
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the new GNUSRedeemAdapter facet, the diamond config registration, its unit test suite, and the MockERC20Proxy helper, cross-referencing `GNUSTreasury.convert`, `GNUSERC1155MaxSupply._beforeTokenTransfer`, and `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw`.

Core security posture is sound: the operator-approval require (line 97-100) is correctly placed before the pull; CEI ordering holds (all attacker-influenceable external calls occur after state finalization — the mint acceptance hook on `recipient` fires after balances are updated); there is no double limiter charge (the pull moves `childId != GNUS_TOKEN_ID`, so the WR-07 hook in `_beforeTokenTransfer` never fires; the burn is a child id; the mint leg is hook-exempt — matching the treasury's documented charge matrix); GNUS self-redeem and nonConvertible reverts are present and match treasury semantics; and the limiter is correctly keyed to `from`, not the diamond or the proxy.

The main residual risk is that the unconditional `onERC1155Received` acceptance hook newly enables **any** single ERC-1155 transfer into the diamond, not just adapter-initiated pulls — the NatSpec claim of "enables only the self-transfer redeem initiates" is inaccurate, and such tokens are permanently stranded (no sweep function, T-11-06).

## Warnings

### WR-01: onERC1155Received accepts transfers from anyone, contradicting its NatSpec and enabling permanent token strandings

**File:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:50-56`
**Issue:** The hook is stateless and returns the magic selector unconditionally. Because the adapter's `_safeTransferFrom` targets `address(this)` (the diamond itself is also the ERC-1155 token contract), the hook call arrives with `msg.sender == address(this)` during redeem — indistinguishable from a user's direct `safeTransferFrom(user, diamond, ...)` of the same token. So registering this hook makes every previously-reverting single ERC-1155 transfer into the diamond succeed. Any user who is phished, or fat-fingers a transfer, permanently strands GNUS or child tokens in the diamond (no sweep exists — T-11-06 acknowledges stranded direct transfers, but this facet is what newly enables them for single transfers). This is a real, newly-introduced fund-loss vector, not merely the pre-existing accepted risk.
**Fix:** Tighten the NatSpec at minimum, and consider mitigations: (a) restrict acceptance to zero-value/self-context is not possible in a pure hook, so (b) add a sweep/ rescue path (e.g., owner-only `rescue stranded ERC-1155`), or (c) gate the hook on a transient "redeem in progress" flag set immediately before `_safeTransferFrom` and cleared after, so direct transfers still revert:
```solidity
bool private _redeemInProgress; // app-storage or a dedicated diamond-storage bool

function onERC1155Received(address, address, uint256, uint256, bytes calldata)
    external
    override
    returns (bytes4)
{
    require(msg.sender == address(this) && _redeemInProgress, "GNUSRedeemAdapter: unexpected transfer");
    return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
}
```
The flag must be set before and cleared after `_safeTransferFrom` (note: with the flag approach the function can no longer be `pure`, and reverts mid-redeem auto-clear storage).

### WR-02: Fresh deploys at protocolVersion 2.6 will not include the GNUSRedeemAdapter facet

**File:** `diamonds/GeniusDiamond/geniusdiamond.config.json:2,123-130`
**Issue:** `protocolVersion` is 2.6, but `GNUSRedeemAdapter` only defines version `"3.0"` with `fromVersions [0.0, 2.4, 2.5, 2.6]` — an upgrade-migration declaration. There is no version entry satisfying a brand-new diamond deployed at the current protocol version, so a fresh deploy (test fixture or a new chain) either omits the facet entirely or fails selector resolution for `redeem`. Notably, the unit test suite deploys a fresh diamond via `LocalDiamondDeployer` using this config file — meaning the tests pass only if the deployer falls forward to 3.0; on the upgrade path (existing sepolia/mainnet diamonds at 2.6), verify the tooling actually cuts the facet in when stepping protocol 2.6 → 3.0.
**Fix:** Either bump `protocolVersion` to 3.0 (mirroring the GNUSBridge `3.0` entry that appears prepared for this) or add a deploy-applicable version entry for the facet (e.g. `"2.6": {}`) so fresh deploys register `redeem`. Confirm which path the LocalDiamondDeployer takes and align `protocolVersion` accordingly.

### WR-03: Test runner crashes if `test-multichain` is invoked without `--chains`

**File:** `test/unit/GNUSRedeemAdapter.test.ts:44-48`
**Issue:** When `process.argv` contains `test-multichain` but not `--chains`, `process.argv.indexOf('--chains') + 1` evaluates to `0`, so `process.argv[0]` (the node binary path) is dereferenced with `.split(',')` — a hard TypeError that kills the whole suite rather than failing with a clear message. This is a test-reliability defect (one bad CI invocation masks all results).
**Fix:**
```typescript
if (process.argv.includes('test-multichain')) {
    const chainsIdx = process.argv.indexOf('--chains');
    const chainsArg = chainsIdx >= 0 ? process.argv[chainsIdx + 1] : undefined;
    const networkNames = (chainsArg ?? 'hardhat').split(',');
    ...
}
```

## Info

### IN-01: Unused inheritance — Initializable and GeniusAccessControl add nothing to GNUSRedeemAdapter

**File:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:27`
**Issue:** The facet declares `is Initializable, ... GeniusAccessControl` but defines no initializer and uses no roles. The inherited members (role admin functions, `Initializable` logic) are dead weight and — depending on the diamond tooling's selector collection — could attempt to register colliding selectors (`supportsInterface`, role setters) already owned by other facets.
**Fix:** Confirm the LocalDiamondDeployer excludes inherited/duplicate selectors (`protocolExcludeFuncSelectors` is empty `[]` at `diamonds/GeniusDiamond/geniusdiamond.config.json:4`, which suggests exclusion is not configured); if not excluded, add the colliding selectors to the exclude list, or drop the unused base contracts.

### IN-02: Super-admin bypass semantics differ from treasury (bypass keyed to `from`, not caller)

**File:** `contracts/gnus-ai/GNUSRedeemAdapter.sol:105-109`
**Issue:** `GNUSTreasury.convert` bypasses when `sender == contractOwner`; the adapter bypasses when `from == contractOwner`. A non-owner caller redeeming the owner's tokens (owner having approved the diamond) bypasses the limiter without any SuperAdminBypass visibility of the caller. Documented and low-impact (it's the owner's own funds), but worth a NatSpec note.
**Fix:** Add one line to the @dev comment noting the bypass is keyed to `from` and that the caller identity is captured in `RedeemedViaAdapter`.

### IN-03: Test suite gaps — limiter-exceeded revert and reentrancy/recipient-hook paths untested

**File:** `test/unit/GNUSRedeemAdapter.test.ts:363-411`
**Issue:** The WR-07 describe block verifies attribution and bypass but never drives `"Withdrawal limit exceeded for time window"` through `redeem` (the charge happens before the pull, so the ordering of charge-vs-pull on a failing limit is unpinned), and no test uses a malicious `recipient` contract whose `onERC1155Received` reenters `redeem` (the CEI claim is load-bearing for a security-critical facet).
**Fix:** Add two tests: (1) pre-exhaust `from`'s limiter via `getAccountWithdrawStatus`/prior redeems and assert the exact revert string; (2) a reentering recipient that calls `redeem` in its hook and asserts balances are unchanged / expected revert.

### IN-04: Debug logger tag is a frozen template literal

**File:** `test/unit/GNUSRedeemAdapter.test.ts:39`
**Issue:** `` debug('GNUSRedeemAdapter:log:${diamondName}') `` uses single quotes — the `${diamondName}` is a literal, never interpolated.
**Fix:** Use backticks: `` debug(`GNUSRedeemAdapter:log:${diamondName}`) ``.

---

Reviewed: 2026-08-20
Reviewer: Claude (gsd-code-reviewer)
Depth: standard
