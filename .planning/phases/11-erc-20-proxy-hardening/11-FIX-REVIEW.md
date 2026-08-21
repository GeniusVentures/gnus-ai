---
phase: 11-erc-20-proxy-hardening
reviewed: 2026-08-21T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - contracts/gnus-ai/GNUSRedeemAdapter.sol
  - contracts/mocks/MockRedeemCaller.sol
  - test/unit/GNUSRedeemAdapter.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 11: Code Review Report (FIX verification — fix/11-redeem-mint-hook)

**Reviewed:** 2026-08-21
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This is a fix-verification review of the five findings from `11-POST-SHIP-REWORK-REVIEW.md`. The substantive fixes (CR-01 `_mint` override, WR-01 test split, WR-02 mock + contract-caller test, IN-01 comment, IN-02 import removal) are all present and the code-level changes are correct. Two residual issues were found: the WR-02 regression test does not actually discriminate against the pre-fix bug (it would have passed before the CR-01 fix), and its in-comment justification is factually wrong about which contract the acceptance check targets.

## Fix Verification

### CR-01 (verified fixed): hook-free `_mint` override

`GNUSRedeemAdapter.sol:73-91` adds a `_mint` override that is a faithful mirror of `GNUSBridge._mint` (GNUSBridge.sol:198-216):

- **Signature/visibility/specifier:** `internal override(ERC1155Upgradeable)` — correct. The base (`node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol:266`) is `internal virtual`, single-inheritance path here, so `override(ERC1155Upgradeable)` is the right specifier.
- **No acceptance check:** the override omits `_doSafeTransferAcceptanceCheck` (present at base line 283). Confirmed by direct diff against the base body.
- **State finalized before external interaction:** there are no external calls at all in the override — `_beforeTokenTransfer` / `_afterTokenTransfer` are internal hooks, balance update (line 87) and `TransferSingle` emit (line 88) complete before `_afterTokenTransfer`. The bounded reentrancy window is eliminated, not just narrowed.
- **Shadows the base for the redeem path:** `redeem` (line 122) calls `_mint(from, GNUS_TOKEN_ID, amount, "")`, which statically resolves to the override within this facet contract. Confirmed.
- **Blast radius on other facets:** none. `GNUSNFTFactory` (GNUSNFTFactory.sol:107,122), `GNUSTreasury` (GNUSTreasury.sol:110), and `GNUSBridge` are separately compiled facet contracts; each keeps its own `_mint` resolution (factory/treasury keep the acceptance check, bridge has its own hook-free override). Diamond delegatecall dispatch is per-facet, so the override only affects calls whose code runs inside `GNUSRedeemAdapter` — i.e., `redeem`. `_mintBatch` is not overridden but is never called by this facet.
- **CEI ordering in `redeem`:** limiter charge (line 116) → burn (line 121) → mint (line 122) → event (line 124). The burn's `_beforeTokenTransfer` supply/balance checks run before the mint leg mutates GNUS balances. Correct.

### WR-1 (verified fixed): supply-exhaustion vs caller-balance test split

- `test/unit/GNUSRedeemAdapter.test.ts:290-297` (supply-exhaustion): supply 100, redeem 200 → trips `ERC1155SupplyUpgradeable._beforeTokenTransfer` (line 67: `supply >= amount`) before the balance check → `'ERC1155: burn amount exceeds totalSupply'`. Correct path.
- Lines 299-307 (balance path): owner minted an extra 100 so supply = 200 > amount = 150 > caller balance = 100 → supply check passes, base `_burn` balance check (ERC1155Upgradeable.sol:343) reverts with `'ERC1155: burn amount exceeds balance'`. The test genuinely exercises the balance branch. The limiter does not interfere (limiter disabled by default in the fixture; the dedicated limiter tests configure it explicitly).

### IN-01 (verified fixed): supportsInterface comment

`GNUSRedeemAdapter.sol:31-34` — the comment accurately states why `IERC1155ReceiverUpgradeable` is advertised (inbound safeTransfer reverts with the facet's reason string instead of the generic base message). Accurate: with the interface advertised, `safeTransferFrom` → acceptance check → delegatecall to `onERC1155Received` (line 53) → `revert("GNUSRedeemAdapter: unexpected transfer")`. The pinned revert strings in the no-custody tests (test lines 418, 431) confirm this behavior.

### IN-02 (verified fixed): Initializable removal

No `Initializable` import or inheritance remains in `GNUSRedeemAdapter.sol` (grep clean). Transitive `Initializable` via `ERC1155SupplyUpgradeable` is inherited through `GNUSERC1155MaxSupply` and is unrelated to the finding.

## Warnings

### WR-01: WR-02 contract-caller test does not discriminate against the pre-fix bug; its justification comment is factually wrong

**File:** `test/unit/GNUSRedeemAdapter.test.ts:376-412` (comment at 381-385), `contracts/mocks/MockRedeemCaller.sol:32-39`

**Issue:** The test's stated mechanism is incorrect. The comment claims "the facet's unconditional-revert hooks are shadowed by the override, so any acceptance check on the mint-back would revert this transaction." But the pre-fix acceptance check (`_doSafeTransferAcceptanceCheck`, ERC1155Upgradeable.sol:461-480) invokes `onERC1155Received` on the **recipient** — `to = mockAddress` — not on the diamond. `MockRedeemCaller.onERC1155Received` returns the correct magic selector, so the pre-fix acceptance check would have **succeeded**. Traced concretely: pre-fix, this exact test passes unchanged. The regression test therefore does not pin CR-01; a future revert of the `_mint` override would not be caught by this suite.

The facet's own unconditional-revert hooks are only invoked when the **diamond** is the transfer recipient (the no-custody tests), which is a different code path.

The real pre-fix failure mode is a recipient contract that does NOT implement `IERC1155Receiver` (Safes without the receiver fallback, minimal proxies) — the catch-all at ERC1155Upgradeable.sol:476-477 reverts with "ERC1155: transfer to non ERC1155Receiver implementer". The mock cannot be that shape today because it must be funded through `GNUSNFTFactory.mint`, which keeps the acceptance check (mock comment lines 14-18 acknowledge this constraint).

**Fix:** Add a discriminating case: deploy a receiver-less caller contract (or an EOA-impersonating contract) and fund it by writing the child balance directly via `hardhat_setStorageAt` on the `ERC1155Storage` balances mapping (plus the `ERC1155SupplyStorage` totalSupply slot) — the same direct-storage technique already used by `bootWithNonConvertibleChild` (test lines 189-201). Then redeem from it and assert success; pre-fix this reverts, post-fix it passes. At minimum, correct the comment at lines 381-385 to describe the actual mechanism (recipient-hook elimination for non-receiver recipients) rather than the incorrect diamond-hook-shadowing claim.

## Info

### IN-01: Malformed line join / stray tab characters at describe block boundary

**File:** `test/unit/GNUSRedeemAdapter.test.ts:414`

**Issue:** Line 414 joins the `describe('no-custody receiver hooks', ...)` opener and the first `it` on one line with embedded tab characters:

```
describe('no-custody receiver hooks', function () {				it('reverts on direct single transfer to the diamond', async function () {
```

Cosmetic only, but it breaks the file's otherwise consistent formatting and will show up as noise in future diffs.

**Fix:** Split onto two lines and re-indent the `it` block.

---

_Reviewed: 2026-08-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
