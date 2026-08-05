---
phase: 09-per-child-gnus-treasury-reserve
plan: 03
subsystem: contracts/gnus-ai (GNUSBridge facet)
tags: [phase-9, conversion-native, gnus-bridge, wave-2]
dependency_graph:
  requires:
    - contracts/gnus-ai/GNUSTreasuryStorage.sol (09-01: globalSupply + provenanceInitialized)
    - contracts/gnus-ai/GNUSConstants.sol (GNUS_TOKEN_ID, GNUS_MAX_SUPPLY)
    - contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol (checkAndRecordWithdraw + SuperAdminBypass)
    - contracts/gnus-ai/GNUSControlStorage.sol (bridgeFee field for _mintWithBridgeFee)
  provides:
    - GNUSBridge.withdraw(uint256,uint256) deleted (D4)
    - 3-arg MINTER_ROLE mint gated to GNUS_TOKEN_ID (D10)
    - _mintWithBridgeFee: globalSupply increment (post-fee) + global cap enforcement (D8/D9)
    - burn: globalSupply decrement (D8)
    - bridgeOut: limiter charged with amount directly (no exchangeRate division) (D1/D2)
    - No exchangeRate math in any state-transition path in this facet
  affects:
    - Plan 09-04 (diamond config 3.0 removes the withdraw selector; loupe test asserts absence)
    - Plan 09-05 (test migration: 5 .withdraw call sites + NFTFactory mint semantics)
    - test/unit/GNUSBridge.test.ts (withdraw cases must be deleted in 09-05)
tech_stack:
  added: []
  patterns:
    - "Provenance hooks on entry points only (D8) — never on _mint/_burn primitives (Pitfall 2)"
    - "Post-fee counter increment (Pitfall 3) — globalSupply += amount AFTER fee-adjustment if block"
    - "Global cap scoped to GNUS_TOKEN_ID mints only — convert's GNUS-terminal leg never cap-checked (research §C item 4)"
    - "B1 bridge provenance — bridgeOut does NOT touch globalSupply; destination's bridge-in mint is the + side"
key_files:
  created: []
  modified:
    - contracts/gnus-ai/GNUSBridge.sol
decisions:
  - "Provenance counter increments use the post-fee `amount` local variable (not a separately captured pre-fee value) — Pitfall 3 compliance"
  - "Cap check placed inside `if (tokenID == GNUS_TOKEN_ID)` — defense-in-depth after D10 restriction; convert's mint leg bypasses this path entirely"
  - "bridgeOut limiter charge uses `amount` directly — minion-denominated under D1/D2; division removed entirely"
  - "No globalSupply hook on bridgeOut — B1 model (destination chain's bridge-in mint is the + side)"
  - "GNUSBridge deployedBytecode: 18181 bytes (down from ~18872 baseline; net negative byte impact per research §H)"
metrics:
  duration_seconds: ~150
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
  completed_date: 2026-08-05
---

# Phase 09 Plan 03: GNUSBridge Rewiring — Summary

**One-liner:** Rewired the GNUSBridge facet to the conversion-native model — `withdraw()` deleted, MINTER_ROLE 3-arg mint gated to id 0, global-supply counter + cap hooked into `_mintWithBridgeFee`/`burn` (post-fee, id-0-only), and bridgeOut's limiter charge simplified to minion-denominated direct-amount — with zero `exchangeRate` math remaining in any state-transition path.

## Tasks Completed

| Task | Name | Inner Commit | Files |
|------|------|--------------|-------|
| 1 | Delete withdraw() + restrict MINTER_ROLE 3-arg mint to id 0 | `d728ce0` (contracts/gnus-ai) | contracts/gnus-ai/GNUSBridge.sol (MOD) |
| 2 | Provenance hooks + global cap in _mintWithBridgeFee and burn + bridgeOut rate-math cleanup | `9dffa65` (contracts/gnus-ai) | contracts/gnus-ai/GNUSBridge.sol (MOD) |

## Acceptance Verification

### Task 1

- `npx hardhat compile` → **green** (2 Solidity files compiled, 44 typechain typings generated)
- `grep -c "function withdraw" contracts/gnus-ai/GNUSBridge.sol` → **0** ✓
- `grep -c "MINTER_ROLE mints GNUS only" contracts/gnus-ai/GNUSBridge.sol` → **1** ✓
- `grep -c "convAmount" contracts/gnus-ai/GNUSBridge.sol` → **3** (bridgeOut's convAmount survived Task 1; died in Task 2) ✓
- 3-arg `mint` first statement is `require(tokenID == GNUS_TOKEN_ID, "MINTER_ROLE mints GNUS only");` ✓
- 2-arg `mint` and `burn` byte-identical to pre-plan state in this task ✓

### Task 2

- `npx hardhat compile` → **green**
- `grep -c "GNUSTreasuryStorage" contracts/gnus-ai/GNUSBridge.sol` → **4** (import + using + 2 hook sites) ✓
- `grep -c "Global max supply exceeded" contracts/gnus-ai/GNUSBridge.sol` → **1** ✓
- `grep -c "globalSupply" contracts/gnus-ai/GNUSBridge.sol` → **4** (cap require + increment + decrement + B1 comment) ✓
- `grep -c "exchangeRate" contracts/gnus-ai/GNUSBridge.sol` → **0** (after comment reword; see Deviation 1) ✓
- `grep -c "convAmount" contracts/gnus-ai/GNUSBridge.sol` → **0** ✓
- `grep -c "checkAndRecordWithdraw(sender, amount)" contracts/gnus-ai/GNUSBridge.sol` → **1** ✓
- `_mintWithBridgeFee` body ordering verified: fee adjustment → `if (tokenID == GNUS_TOKEN_ID) { require(...cap...); globalSupply += amount; }` → `_mint(...)` → `emit Transfer(...)` ✓
- `burn` body verified: `_burn(user, GNUS_TOKEN_ID, amount);` → `GNUSTreasuryStorage.layout().globalSupply -= amount;` → `emit Transfer(...)` ✓
- `bridgeOut` body contains `checkAndRecordWithdraw(sender, amount)` — no `convAmount`, no division ✓
- `bridgeOut` does NOT touch `globalSupply` (B1 model — only a comment mentions it) ✓
- `totalSupply()` ERC-20 facade unchanged ✓
- **Deployed bytecode: 18181 bytes** (< 24576 EIP-170 budget; net negative impact per research §H) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Acceptance-grep collision with comment text**
- **Found during:** Task 2 verification
- **Issue:** After implementing the bridgeOut simplification, `grep -c "exchangeRate"` returned 1 — but the hit was a comment I had added (`no exchangeRate division`) documenting the removal, not actual code. The acceptance criterion demands 0 hits.
- **Fix:** Reworded the comment from `no exchangeRate division` to `no rate division`. Code semantics unchanged; the acceptance grep now returns 0.
- **Files modified:** contracts/gnus-ai/GNUSBridge.sol (comment only, folded into Task 2 commit `9dffa65`)
- **Commit:** `9dffa65` (single commit, no separate fixup)

No other deviations. Both tasks executed exactly as written otherwise.

## Authentication Gates

None.

## Threat Model Notes

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-13 (EoP — 3-arg MINTER mint conservation hole) | mitigate | ✅ `require(tokenID == GNUS_TOKEN_ID, "MINTER_ROLE mints GNUS only")` first statement of the 3-arg overload |
| T-09-14 (Tampering — globalSupply double-touch) | mitigate | ✅ Hooks placed ONLY on `_mintWithBridgeFee` and `burn` — verified by grep that `globalSupply` appears nowhere else in executable code (lines 95, 96, 133 + one B1 comment) |
| T-09-15 (Tampering — bridge-fee drift) | mitigate | ✅ Counter incremented by POST-fee `amount` (the local variable is reassigned inside the fee block at line 89 before the hook at line 96 reads it) |
| T-09-16 (EoP — global cap bypass) | mitigate | ✅ Cap check inside `if (tokenID == GNUS_TOKEN_ID)` — convert's GNUS-terminal mint leg routes through `GNUSTreasury.convert` → `_mint`, never through `_mintWithBridgeFee`, so it is NOT cap-checked (conservation) |
| T-09-17 (Tampering — bridgeOut rate-math survivor) | mitigate | ✅ Division `amount / exchangeRate` deleted; charge uses `amount` directly; final grep returns 0 for both `exchangeRate` and `convAmount` in the file |
| T-09-18 (Tampering — selector squatting) | mitigate | ⏳ Deferred to Plan 09-04 (diamond cut removes selector; loupe test asserts absence) |
| T-09-19 (DoS — limiter double-charge) | mitigate | ✅ bridgeOut explicit block fires only when `id != GNUS_TOKEN_ID`; id-0 bridgeOut is hook-charged on its `_burn` (no overlap) |
| T-09-SC (Tampering — npm installs) | accept | ✅ No new dependencies added |

## Known Stubs

None. All edits are live code. The Plan 09-04 follow-up (diamond config + loupe selector assertion) is a separate plan, not a stub left by this plan.

## Threat Flags

None. The facet's surface changes (withdraw removal, MINTER restriction, counter hooks, bridgeOut simplification) are fully enumerated in the plan's `<threat_model>`. No new network endpoints, auth paths, file access patterns, or schema changes beyond what was threat-modeled.

## Files Created/Modified (Absolute Paths)

- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSBridge.sol` (MOD, net -38/+20 across both tasks)

## Self-Check: PASSED

- `09-03-SUMMARY.md` exists at the expected path ✓
- Inner commits `d728ce0` (Task 1) and `9dffa65` (Task 2) present in `git log` of contracts/gnus-ai ✓
- `npx hardhat compile` exit 0 after each task and on final re-run ✓
- All acceptance greps return the expected counts ✓
- Deployed bytecode 18181 bytes < 24576 (EIP-170) ✓
