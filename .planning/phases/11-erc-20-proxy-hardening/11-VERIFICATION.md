---
phase: 11-erc-20-proxy-hardening
verified: 2026-08-19T00:00:00Z
status: passed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
---

# Phase 11: ERC-20 Proxy Hardening (gnus-ai scope) Verification Report

**Phase Goal (this repo):** PROXY-03 only — generic redeem adapter on the diamond. Criteria 1-4/6 (PROXY-01/02) live in the erc20-gnus-proxy repo and are out of scope here.
**Verified:** 2026-08-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Any external proxy can call redeem(from, childId, amount, recipient); child → GNUS in one tx | ✓ VERIFIED | `contracts/gnus-ai/GNUSRedeemAdapter.sol:82-116` pull/burn/mint atomic; `MockERC20Proxy.sol` drives it contract-caller; tests "converts child tokens to GNUS...via the mock proxy" pass |
| 2 | onERC1155Received returns magic selector | ✓ VERIFIED | GNUSRedeemAdapter.sol:54-56, `external pure override` returning `IERC1155ReceiverUpgradeable.onERC1155Received.selector` |
| 3 | GNUS self-redeem revert (T-11-02) | ✓ VERIFIED | Line 85 `require(childId != GNUS_TOKEN_ID, "Cannot redeem GNUS itself")`; test passes |
| 4 | amount == 0 / recipient == 0 reverts | ✓ VERIFIED | Lines 86-87; tests pass |
| 5 | nonConvertible revert (T-11-03, D-09) | ✓ VERIFIED | Line 92 `require(!childNft.nonConvertible, "Token is non-convertible")`; test passes |
| 6 | Insufficient `from` balance reverts | ✓ VERIFIED | `_safeTransferFrom` balance check; test "reverts when caller has insufficient balance" passes |
| 7 | `from` must have ERC-1155-approved the diamond | ✓ VERIFIED | Wave 2 explicit gate, lines 97-100 `require(from == caller \|\| isApprovedForAll(from, address(this)), "ERC1155: caller is not token owner or approved")` (commit d4575e8 — the internal `_safeTransferFrom` has no approval check); test passes |
| 8 | WR-07 limiter charges `from`, not diamond/proxy | ✓ VERIFIED | Lines 105-109 `checkAndRecordWithdraw(from, amount)` before pull; test "charges the withdrawal limiter against from, not the proxy or the diamond" passes |
| 9 | SuperAdminBypass when `from` is contract owner | ✓ VERIFIED | Line 108 emit with context "GNUSRedeemAdapter.redeem"; test (raw topic) passes |
| 10 | No custody across transactions (atomic pull+burn, batch rejected) | ✓ VERIFIED | Lines 111-112 adjacent pull/burn; `onERC1155BatchReceived` reverts (lines 62-68); batch test passes |
| 11 | Diamond config: GNUSRedeemAdapter priority 118, version 3.0, fromVersions [0.0,2.4,2.5,2.6] | ✓ VERIFIED | `diamonds/GeniusDiamond/geniusdiamond.config.json` parses: `{"priority":118,"versions":{"3.0":{"fromVersions":[0,2.4,2.5,2.6]}}}` (JSON 0.0 serializes as 0); protocolVersion still 2.6, Treasury 117 intact; commit 72489c2 |
| 12 | GNUSTreasury.convert NOT modified | ✓ VERIFIED | `git log` for phase shows only new facet, mock, and config commits; no treasury commits |
| 13 | D-06 conversion-native (inline burn/mint, no reserve apparatus) | ✓ VERIFIED | No reserveOf/redeemableBacking/depositToReserve in adapter; `_burn`/`_mint` inlined |
| 14 | D-07 1:1 conversion, no slippage/replay apparatus | ✓ VERIFIED | `_mint(recipient, GNUS_TOKEN_ID, amount, "")` — same amount, no rate math |
| 15 | D-08 pull-model allowance chain | ✓ VERIFIED | `_safeTransferFrom(from, address(this), childId, amount, "")` line 111; explicit operator gate covers approval |
| 16 | CEI ordering (charge → pull → burn → mint → event) | ✓ VERIFIED | Source order lines 105-115 matches |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `contracts/gnus-ai/GNUSRedeemAdapter.sol` | ✓ VERIFIED | 117 lines, full 4-function surface (supportsInterface with IERC1155Receiver clause, onERC1155Received, onERC1155BatchReceived reverting, redeem), NatSpec, no this.convert/ReentrancyGuard/custom errors; commits 6c0a348 + d4575e8 |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` | ✓ VERIFIED | GNUSRedeemAdapter entry present, correct shape, no init keys, other facets intact |
| `test/unit/GNUSRedeemAdapter.test.ts` | ✓ VERIFIED | 14 tests, 14 passing (ran `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts`) |
| `contracts/gnus-ai/testing/MockERC20Proxy.sol` | ✓ VERIFIED | Generic third-party caller proving D-05; commit f51bda1 |

### Key Link Verification

| From | Via | Status |
|------|-----|--------|
| redeem → _safeTransferFrom | `_safeTransferFrom(from, address(this)` | ✓ WIRED (line 111) |
| redeem → checkAndRecordWithdraw(from, ...) | limiter charge | ✓ WIRED (line 106) |
| redeem → _burn(address(this), childId, ...) | burn pulled child | ✓ WIRED (line 112) |
| redeem → _mint(recipient, GNUS_TOKEN_ID, ...) | mint GNUS | ✓ WIRED (line 113) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts` | 14 passing, 0 failing | ✓ PASS |
| Config parses with correct entry | `node -e require(...)` | priority 118, 3.0, fromVersions numeric | ✓ PASS |

### Threat Model Mitigation Confirmation

T-11-01 CEI (✓ line order), T-11-02 (✓), T-11-03 (✓), T-11-04 (✓ from-keyed charge), T-11-05 (✓ batch revert + atomicity), T-11-06 accepted/documented in NatSpec (✓), T-11-07 (✓), T-11-08 accept (clean revert via Wave 2 gate, test present), T-11-09/T-11-10 accept (documented), T-11-SC no new packages (✓).

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|---------------------|--------|----------|
| PROXY-03 | Generic redeem adapter on gnus-ai diamond, callable by any conforming external ERC-20 proxy | ✓ SATISFIED | GNUSRedeemAdapter shipped, registered, tested. Note: requirement text says "via GNUSTreasury.convert()" but locked decision D-06 (11-CONTEXT.md) supersedes with the inlined burn/mint to preserve from-keyed limiter attribution — functional intent (single-tx child→GNUS) fully met |
| PROXY-01/02 | Cross-repo (erc20-gnus-proxy workstream) | N/A | Out of scope for this repo per phase definition |

REQUIREMENTS.md row still shows "Pending" for PROXY-03 — status bookkeeping only, implementation is complete.

### Anti-Patterns Found

None. No TODO/FIXME/TBD/XXX, no placeholder returns, no console imports in the phase files.

### Human Verification Required

None — all truths verified via code inspection and passing on-chain tests.

### Gaps Summary

No gaps. Wave 2 operator-approval require (the one real security gap — internal `_safeTransferFrom` performs no approval check) is present and tested.

---

_Verified: 2026-08-19_
_Verifier: Claude (gsd-verifier)_
