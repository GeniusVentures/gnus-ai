---
phase: 11-erc-20-proxy-hardening
plan: 01
subsystem: gnus-ai-diamond
tags: [erc1155, redeem-adapter, facet, proxy, diamond-cut]
requires:
  - "Phase 9 conversion-native model (D1/D2/D5)"
  - "Phase 10 no-custody bridge model"
provides:
  - "GNUSRedeemAdapter facet: permissionless redeem(from, childId, amount, recipient) with onERC1155Received hook"
  - "Diamond config registration at priority 118, version 3.0"
affects:
  - "erc20-gnus-proxy workstream (proxy calls the adapter; D-03 nested bump)"
tech-stack:
  added: []
  patterns:
    - "Pull-then-burn/mint adapter (D-08 option a) with from-keyed WR-07 limiter charge"
    - "Inline _burn/_mint instead of this.convert() self-call (Pitfall 2 resolution)"
key-files:
  created:
    - contracts/gnus-ai/GNUSRedeemAdapter.sol
  modified:
    - diamonds/GeniusDiamond/geniusdiamond.config.json
decisions:
  - "IERC165Upgradeable added to supportsInterface override list (required because IERC1155ReceiverUpgradeable inherits it)"
  - "Burn/mint inlined; no this.convert() self-call — limiter stays keyed to the user"
metrics:
  duration: "~20 min"
  completed: 2026-08-19
---

# Phase 11 Plan 01: GNUS Redeem Adapter Summary

Generic diamond-side redeem adapter letting any conforming external ERC-20 proxy convert a user's proxied-child ERC-1155 into GNUS atomically, with the WR-07 limiter charged to the user and GNUSTreasury.convert untouched.

## What Was Built

### Task 1: GNUSRedeemAdapter.sol facet (contracts/gnus-ai submodule @ 6c0a348)

- `contract GNUSRedeemAdapter is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl, IERC1155ReceiverUpgradeable`
- `redeem(address from, uint256 childId, uint256 amount, address recipient)` — validation-then-act CEI order: caller capture → childId/amount/recipient/from requires (exact GNUSTreasury-matching strings, incl. "Token not created." trailing period and "Cannot redeem GNUS itself") → nftCreated/nonConvertible checks → WR-07 `checkAndRecordWithdraw(from, amount)` or `SuperAdminBypass(..., "GNUSRedeemAdapter.redeem")` → `_safeTransferFrom(from, address(this), ...)` → `_burn(address(this), childId, amount)` → `_mint(recipient, GNUS_TOKEN_ID, amount, "")` → `RedeemedViaAdapter` event (3 indexed: caller, from, childId).
- `onERC1155Received` — `external pure`, returns magic selector (required: `_doSafeTransferAcceptanceCheck` has no `to == address(this)` special case — Pitfall 1).
- `onERC1155BatchReceived` — reverts "GNUSRedeemAdapter: batch transfers not accepted" (stranded-custody guard, T-11-05).
- `supportsInterface` — GNUSTreasury pattern plus `IERC1155ReceiverUpgradeable` interfaceId clause.
- Compiles clean; deployed bytecode 16,625 bytes (well under EIP-170 24,576).

### Task 2: geniusdiamond.config.json (diamonds/GeniusDiamond submodule @ 72489c2)

- Added `GNUSRedeemAdapter` at priority 118 (between GNUSTreasury 117 and GNUSWithdrawLimiter 120), version key `"3.0"` (string), `fromVersions: [0.0, 2.4, 2.5, 2.6]` (unquoted numbers), no init keys (stateless), `protocolVersion` untouched (2.6). No other facet blocks modified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] IERC165Upgradeable added to supportsInterface override list**
- **Found during:** Task 1 compile
- **Issue:** Implementing `IERC1155ReceiverUpgradeable` (which inherits `IERC165Upgradeable`) makes the linearization ambiguous; solc 0.8.19 errored: `Function needs to specify overridden contract "IERC165Upgradeable"`.
- **Fix:** `override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable, IERC165Upgradeable)`.
- **Files modified:** contracts/gnus-ai/GNUSRedeemAdapter.sol
- **Commit:** 6c0a348

**2. [Rule 3 - Blocking] NatSpec reworded to avoid literal `this.convert` substring**
- **Issue:** The plan's own verify grep requires the file NOT contain `this.convert`; the prescribed @dev wording contained it in a comment.
- **Fix:** Reworded to "an external self-call to the treasury's convert function".
- **Commit:** 6c0a348

## Commits

| Repo | Hash | Message |
|------|------|---------|
| contracts/gnus-ai (nested) | 6c0a348 | feat(11-01): add GNUSRedeemAdapter facet |
| gnus-ai superproject | 721cc18 | chore(11-01): bump contracts/gnus-ai submodule |
| diamonds/GeniusDiamond (nested) | 72489c2 | chore(11-01): register GNUSRedeemAdapter facet at priority 118 |
| gnus-ai superproject | ac107f2 | chore(11-01): bump diamonds/GeniusDiamond submodule |

## Verification

- `npx hardhat compile` — success (both tasks).
- Bytecode size: 16,625 bytes < 24,576 (EIP-170).
- Config JSON parses; automated node validation script passed (priority, version key, fromVersions, no init keys, other facets intact, protocolVersion 2.6).
- All plan grep checks pass (exact signature, revert strings, limiter call keyed to `from`, pull/burn/mint source order, no `this.convert` substring).
- Behavioral tests (revert matrix, limiter attribution, receiver hook, proxy-caller) deferred to Plan 11-02 per plan.

## Known Stubs

None.

## Self-Check: PASSED
