---
phase: 13-time-bound-erc1155-entitlements
verified: 2026-08-25T00:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
---

# Phase 13: Time-Bound ERC-1155 Entitlements — Verification Report

**Phase Goal:** Lifecycle (validFrom/validUntil, per-token-ID and per-holder expiry), six transfer policies, anti-scalping mint controls, expiration dispositions with settlement, AI Credits product.
**Verified:** 2026-08-25
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria 1–9)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lifecycle config appended to NFT struct; zero-defaults keep legacy tokens active/unrestricted; decode-compat upgrade test | ✓ VERIFIED | `GNUSNFTFactoryStorage.sol:23-36` — 8 fields appended (validFrom/validUntil/defaultDuration ×3 uint64, mode/policy/disposition ×3 uint8 packed slot +8; expirationRecipient slot +9; credentialVerifier slot +10) with slot annotations; `test/unit/GNUSLifecycleUpgrade.test.ts` (raw-storage decode assertions, legacy zero-defaults per 13-UAT) |
| 2 | ExpirationMode None/PerTokenId/PerHolder with per-holder clocks; settle-first renewal | ✓ VERIFIED | `GNUSLifecycleTypes.sol:5-10` (3 modes); per-holder clock lives in `GNUSLifecycleStorage.Layout.holderExpiresAt` (line ~14) — name differs from roadmap's `expiresAt` but semantics identical (`GNUSLifecycle.sol:122,140`); settle-first in `GNUSLifecycleMint.sol` `_applyPerHolderRenewal` (expired balances settled before renewal, line ~252 dispatch shared with settleExpired); 48 tests in GNUSLifecycleSettle.test.ts; `test/foundry/invariant/LifecycleInvariant.t.sol` |
| 3 | Six policies enforced by single predicate in `_beforeTokenTransfer`; no operator exemptions | ✓ VERIFIED | `GNUSERC1155MaxSupply.sol:126` calls `_enforceTransferPolicy` per-id from the single `_beforeTokenTransfer` hook (line 87); body in `GNUSLifecyclePolicy.sol:163-247` covers all six (UNRESTRICTED, SOULBOUND, ISSUER_ONLY, ALLOWLISTED, CONTROLLED_RESALE, LOCKED_AFTER_START); NFT_PROXY_OPERATOR_ROLE grant-then-revert bypass test in GNUSLifecyclePolicy.test.ts:68-71 |
| 4 | Policy-bound tokens non-bridgeable in v1 | ✓ VERIFIED | `GNUSBridge.sol:251` calls `_enforceBridgePolicy(sender, id)` in bridgeOut BEFORE limiter charge and burn (line 281-309); `test/unit/GNUSBridgePolicy.test.ts` (11 tests) |
| 5 | Five dispositions; permissionless fixed-outcome settleExpired; REDEEM_TO_PARENT to direct parent, collateralized only | ✓ VERIFIED | `GNUSLifecycleMint.sol:186` external `settleExpired(address, uint256)` (no permission gate, no recipient param); disposition dispatch at line ~252; Q1 gate `REDEEM_TO_PARENT requires convertible token` (GNUSLifecycle.sol:196-197) and RETURN_TO_ADDRESS non-zero recipient (D8, lines 200-202) |
| 6 | Anti-scalping: per-wallet mint cap CEI + credential hook in beforeMint | ✓ VERIFIED | `GNUSLifecycleStorage.Layout.perWalletMintCap` (line 18); `GNUSNFTFactory.beforeMint` (line 87) invoked from all mint paths (106, 120); mintWithCredential + createNFTWithLifecycle overloads; `GNUSNFTFactoryAntiScalping.test.ts` (11 tests) |
| 7 | AI Credits: direct child, rate 1.0, SOULBOUND/BURN/PerHolder; zero GNUS/parent/reserve/treasury credit on spend & expiry | ✓ VERIFIED | `GNUSLifecycleAICredits.test.ts` (9 tests) — D11 shape documented lines 27-45 incl. zero-credit economics assertions (zero GNUS delta, tree supply decreases by burned amounts, totalSupplyOfAll never moves, convert() reverts non-convertible); createNFTWithLifecycle forces nonConvertible=true for BURN |
| 8 | Timestamps creator-only mutable post-mint; policy/disposition/mode/recipient immutable after first mint; all mutations emit | ✓ VERIFIED | `GNUSLifecycle.sol:222-249` setValidFrom/setValidUntil guarded by `_requireCreatorOrAdmin` with `ValidFromUpdated`/`ValidUntilUpdated` events; configureLifecycle "reverts once _totalSupply[id] > 0" (immutability Q6, line 158); `LifecycleConfigured`/`PerWalletCapSet` events emitted (214, 262, 392) |
| 9 | (Roadmap wiring criterion) Diamond config: lifecycle facets registered, protocolVersion 2.6 | ✓ VERIFIED | `diamonds/GeniusDiamond/geniusdiamond.config.json` — protocolVersion "2.6" (line 2), GNUSLifecycle priority 119, GNUSLifecycleMint priority 121 |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `contracts/gnus-ai/GNUSLifecycleStorage.sol` (41 L) | ✓ VERIFIED | Diamond storage lib: holderExpiresAt, perWalletMintCap, creator-or-admin auth |
| `contracts/gnus-ai/GNUSLifecycleTypes.sol` (58 L) | ✓ VERIFIED | 3 enums (3 modes, 6 policies, 5 dispositions) + LifecycleConfig |
| `contracts/gnus-ai/GNUSLifecycle.sol` (394 L) | ✓ VERIFIED | Views, configureLifecycle gates, setters, events — wired via config priority 119 |
| `contracts/gnus-ai/GNUSLifecycleMint.sol` (353 L) | ✓ VERIFIED | settleExpired + disposition dispatch + renewal — wired via config priority 121 |
| `contracts/gnus-ai/GNUSLifecyclePolicy.sol` (256 L) | ✓ VERIFIED | Relocated D6 predicate body; called from `_beforeTokenTransfer` |
| `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` | ✓ VERIFIED | NFT struct append with slot annotations |
| `contracts/gnus-ai/GNUSBridge.sol` | ✓ VERIFIED | `_enforceBridgePolicy` pre-limiter gate |
| 7 unit test files (2601 lines total) + `LifecycleInvariant.t.sol` | ✓ VERIFIED | All exist and substantive (test counts: 10/11/15/48/11/9/4) |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| GNUSERC1155MaxSupply._beforeTokenTransfer | GNUSLifecyclePolicy._enforceTransferPolicy | internal call line 126 | ✓ WIRED |
| GNUSBridge.bridgeOut | policy gate | `_enforceBridgePolicy` line 251, pre-limiter | ✓ WIRED |
| GNUSNFTFactory mints | beforeMint cap/credential hook | lines 106/120 | ✓ WIRED |
| Diamond config | GNUSLifecycle / GNUSLifecycleMint facets | priorities 119/121, protocol 2.6 | ✓ WIRED |

### Behavioral Spot-Checks

Step 7b: SKIPPED — test suites deliberately not re-run per verifier constraints (full UAT re-run 2026-08-25: Hardhat 569 passing / 2 pending / 1 known-stale never-fix GNUSControlStorage chainID failure; Foundry 215 passed / 2 known-stale Phase 08.1 setUp reverts / 3 skipped). Static substance checks on test files performed instead (describe-block behavior lists, per-file test counts, NFT_PROXY_OPERATOR_ROLE bypass assertion present).

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared in phase plans; no `scripts/*/tests/probe-*.sh` relevant to this phase.

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/PLACEHOLDER markers in any Phase 13 implementation file. WR-04 transient settleRedeemMintActive flag carries an accepted-risk comment (declared intentional, not a gap). No empty returns or stub handlers found.

### Human Verification Required

None newly identified. Phase 13-UAT.md records a completed 9/9 human UAT pass (2026-08-25) covering the behavioral surfaces that grep cannot verify; no open items remain.

### Gaps Summary

No gaps. All nine success criteria are implemented, substantive, and wired. Naming deviation note (informational, not a gap): the per-holder clock mapping is named `holderExpiresAt` rather than the roadmap's `expiresAt` — same signature `[id][holder]`, same semantics.

---

_Verified: 2026-08-25_
_Verifier: Claude (gsd-verifier)_
