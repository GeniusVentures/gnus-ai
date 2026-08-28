---
status: complete
phase: 13-time-bound-erc1155-entitlements
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md, 13-05-SUMMARY.md, 13-06-SUMMARY.md]
started: 2026-08-25T02:47:15Z
updated: 2026-08-25T03:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Legacy token behavior unchanged (SC1 upgrade safety)
expected: On the deployed 2.6 diamond, a token created with NO lifecycle configuration behaves exactly as before Phase 13: mint + safeTransferFrom work with no window/cap/expiry/policy interference. (Evidence: GNUSLifecycleUpgrade.test.ts, 3 tests)
result: pass
evidence: Suite green (3 passing). Raw-storage decode assertions confirm all 8 Phase 13 fields read zero-defaults (validFrom=0, mode=None, policy=UNRESTRICTED, disposition=NONE, verifier=0x0) on legacy records; pre-existing fields unchanged.

### 2. Lifecycle configuration + immutability (Q6/Q2/Q1 gates)
expected: configureLifecycle sets window/policy/disposition and emits LifecycleConfigured; reverts "Policy immutable after first mint" after any mint; PerHolder + transferable combos revert; REDEEM on non-convertible reverts; RETURN with zero recipient reverts; out-of-range enum ordinals revert (WR-01).
result: pass
evidence: GNUSLifecycle.test.ts (10 tests, 12 revert assertions) + settle-suite Q2 matrix green. WR-01 enum-range regression tests added in CR fix run (part of 569-total regression).

### 3. Credential-gated mint + per-wallet cap (SC6)
expected: mintWithCredential enforces the credential verifier (garbage credential fails when verifier configured; succeeds when verifier is 0) and the per-wallet cap reverts "Per-wallet mint cap exceeded" — single write point, both mint paths gated.
result: pass
evidence: GNUSNFTFactoryAntiScalping.test.ts green (9 tests incl. cap single/batch/repeat + credential valid/invalid/no-verifier rows).

### 4. Transfer policy enforcement, no operator bypass (SC3)
expected: SOULBOUND blocks holder-to-holder transfers even when the mover holds NFT_PROXY_OPERATOR_ROLE; all six policies dispatch; mixed batches revert atomically.
result: pass
evidence: GNUSLifecyclePolicy.test.ts green (14 tests, 11 revert assertions, incl. the NFT_PROXY_OPERATOR_ROLE grant-then-revert bypass attempt and both-balances-unchanged atomicity).

### 5. PerHolder renewal semantics (SC2/D3)
expected: Renewal stacks on an active clock (clock_new == clock_old + D); expired pile settled first, never resurrected; zero balance starts fresh.
result: pass
evidence: GNUSLifecycleSettle.test.ts renewal block green — numeric clock stacking, settle-first (Settled + HolderExpiryUpdated in one tx), no-resurrection supply assertion.

### 6. Settlement dispositions, permissionless + fixed-outcome (SC5/D9)
expected: Any caller: BURN zeroes balance/supply; RETURN pays only configured recipient; REDEEM supply-neutral; NONE/KEEP_INERT inert; idempotent second call reverts; unsettled balances stay in circulating supply. Foundry L1/L2 invariants hold under fuzz.
result: pass
evidence: GNUSLifecycleSettle.test.ts settlement block green (third-party no-redirect test included); LifecycleInvariant campaign 2 passed with both coverage guards non-zero.

### 7. Bridge policy gate (SC4/D7)
expected: bridgeOut reverts "Policy-bound token cannot bridge in v1" for policy-bound tokens BEFORE the limiter charge (zero limiter consumption on revert); UNRESTRICTED/GNUS bridge normally.
result: pass
evidence: GNUSBridgePolicy.test.ts green (7 tests incl. the limiter-not-charged ordering proof and LOCKED pre/post-start pair).

### 8. AI Credits product end-to-end (SC7/D11)
expected: SOULBOUND/BURN/PerHolder child mints via conversion, spends, expires — ZERO GNUS/parent/treasury credit anywhere; convert() reverts; transfers and bridges revert.
result: pass
evidence: GNUSLifecycleAICredits.test.ts green (7 tests; zero-delta snapshots across spend + expiry; "Token is non-convertible" revert asserted).

### 9. Selector surface collision-free (deployment integrity)
expected: Each of the 11 Phase 13 selectors appears exactly once via the loupe; deploy-time collision check passes on every boot.
result: pass
evidence: Selector-collision loupe test green in GNUSLifecycleAICredits.test.ts; all 30+ diamond-deploying suites boot through the hardhat-diamonds collision check on every run.

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Mock & Unhappy-Path Audit (user-requested, 2026-08-25)

User asked: run the suites AND verify unhappy paths exist AND that no mock hides unfinished work.

- **All 7 evidence suites re-run: 76 passing, 0 failing.**
- **Unhappy paths:** 66 `revertedWith`/reverted assertions across the evidence suites (12 + 9 + 11 + 13 + 8 + 3). GNUSLifecycleUpgrade.test.ts has 0 reverts by design — its scope is legacy zero-default decode compat; the failure modes for configured tokens live in the other six suites.
- **Mock audit — nothing hidden:** MockCredentialVerifier is a single public bool (`acceptCredentials`, flipped via `hardhat_setStorageAt` to exercise BOTH verifier outcomes) + the `reenterMint` reentrancy driver, which IS exercised in the anti-scalping suite. MockAllowlistRegistry is a bare settable mapping. Neither contains logic that could fake production behavior; both mirror the MockRedeemCaller thin-mock convention.
- **Intentional interface-only extension points (not hidden gaps):** NO production implementation of `ICredentialVerifier` or `IAllowlistRegistry` exists in contracts/ — the only non-mock files referencing them are consumers (facets/library/storage). This is by design (13-CONTEXT plug-in decisions): creators configure a verifier/registry address at token setup; `address(0)` = open mint / no allowlist. Flagged here so it is a known decision, not a surprise: first real integrator must supply their own verifier/registry contracts.

## Gaps

[none]
