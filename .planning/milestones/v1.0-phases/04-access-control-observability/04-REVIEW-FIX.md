---
phase: 04-access-control-observability
fixed_at: 2026-07-21T00:00:00Z
review_path: .planning/phases/04-access-control-observability/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-07-21
**Source review:** .planning/phases/04-access-control-observability/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (4 warnings, 4 info; fix_scope=all)
- Fixed: 8
- Skipped: 0

**Verification:** `yarn hardhat clean && yarn hardhat compile` → "Compiled 58 Solidity files successfully (evm target: paris)" with 0 errors after all fixes.

**Commit layout:** All 8 source fixes were committed atomically inside the nested `contracts/gnus-ai` submodule on branch `fix/phase-04-review-findings` (8 commits, one per finding). The parent repo received a single submodule pointer bump commit (`chore(04): bump gnus-ai submodule — phase 04 code-review fixes`).

## Fixed Issues

### WR-01: DiamondInitFacet uses deprecated `_setupRole` instead of `_grantRole`

**Files modified:** `contracts/gnus-ai/DiamondInitFacet.sol`
**Commit:** `2adda32` (nested submodule)
**Applied fix:** Replaced all three `_setupRole(...)` calls in `diamondInitialize250()` with `_grantRole(...)`, matching the convention used by `GeniusAccessControl.sol`, `GeniusOwnershipFacet.sol`, and `GNUSNFTFactory.sol`.

### WR-02: GNUSWithdrawLimiterStorage.calculateCurrentBin — division by zero when binCount > windowSeconds

**Files modified:** `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol`
**Commit:** `8731c3c` (nested submodule)
**Applied fix:** Added a point-of-use guard `require(config.binCount <= config.windowSeconds, "binCount exceeds windowSeconds");` immediately before `binLengthSeconds` is computed. Point-of-use was chosen over setter validation (Option B in the review) because the effective config can mix a custom `binCount` with the default `windowSeconds` (and vice versa), so setter-only validation cannot catch all bad combinations.

### WR-03: GNUSERC1155MaxSupply._beforeTokenTransfer — withdrawal limiter tracks operator instead of token owner in transferFrom path

**Files modified:** `contracts/gnus-ai/GNUSERC1155MaxSupply.sol`
**Commit:** `334b362` (nested submodule)
**Status:** fixed: requires human verification
**Applied fix:** Compute `limiterSubject = (from != address(0) && from != operator) ? from : operator;` and charge the limiter (and emit the `SuperAdminBypass` event) against `limiterSubject` rather than `operator`. This causes the ERC20 `transferFrom` path to rate-limit the token owner instead of the approved spender. The super-admin bypass predicate is intentionally still keyed on `operator` (the caller), preserving the existing "super admin bypasses the limiter" semantic. This is a behavioral change to the limiter subject and should be confirmed against the intended rate-limiting policy before shipping.

### WR-04: GNUSBridge._mintWithBridgeFee lacks defense-in-depth validation of bridgeFee against FEE_DOMINATOR

**Files modified:** `contracts/gnus-ai/GNUSBridge.sol`
**Commit:** `37c149f` (nested submodule)
**Applied fix:** Added `require(bridgeFee <= FEE_DOMINATOR, "Bridge fee exceeds dominator");` inside the `if (bridgeFee != 0)` branch of `_mintWithBridgeFee`, so a mis-configured or future-raised fee fails with an informative revert instead of a panic on the subtraction. (The revert string was subsequently updated to "denominator" in the IN-01 commit.)

### IN-01: FEE_DOMINATOR typo — should be FEE_DENOMINATOR

**Files modified:** `contracts/gnus-ai/GNUSBridge.sol`, `contracts/gnus-ai/GNUSControl.sol`
**Commit:** `c158f58` (nested submodule)
**Applied fix:** Renamed `FEE_DOMINATOR` to `FEE_DENOMINATOR` in `GNUSBridge.sol` (constant declaration + all uses, including the WR-04 guard and revert message) and updated the cross-reference comment in `GNUSControl.sol`. The constant is `private`, so no external consumers are affected. Historical phase-05 planning docs and coverage HTML artifacts were left unchanged.

### IN-02: diamondInitialize250 embeds version number in function name

**Files modified:** `contracts/gnus-ai/DiamondInitFacet.sol`
**Commit:** `2691cea` (nested submodule)
**Applied fix:** Extended the `@dev` NatSpec on `diamondInitialize250()` to document the version-embedded naming convention (each diamond version gets its own uniquely-named initializer so upgrades target a specific initializer and prior initializers are never re-executed).

### IN-03: transferBatch and transferOrBurnBatch have unnecessary payable modifier

**Files modified:** `contracts/gnus-ai/ERC20TransferBatch.sol`
**Commit:** `ed71156` (nested submodule)
**Applied fix:** Removed the `payable` modifier from `transferBatch` and `transferOrBurnBatch`. Neither function reads `msg.value`; removing `payable` eliminates the stuck-ETH risk and the per-call gas overhead. Function selectors are unchanged (payability is not part of the selector), so no interface or test updates are required.

### IN-04: mintBatch is payable but rejects ETH — self-contradicting pattern

**Files modified:** `contracts/gnus-ai/ERC20TransferBatch.sol`
**Commit:** `634d3eb` (nested submodule)
**Applied fix:** Removed the `payable` modifier and the `require(msg.value == 0, "ETH not accepted")` guard from `mintBatch`, and documented the change in the function's `@dev` NatSpec (chosen over keeping the pattern with a comment, for consistency with the IN-03 fix on the sibling functions). Solidity's built-in non-payable revert now handles accidental ETH sends.

## Skipped Issues

None — all 8 in-scope findings were fixed.

---

_Fixed: 2026-07-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
