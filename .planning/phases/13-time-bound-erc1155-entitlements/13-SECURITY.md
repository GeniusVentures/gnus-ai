# Phase 13 Security Audit — time-bound-erc1155-entitlements

**Auditor:** gsd-security-auditor
**Date:** 2026-08-25
**ASVS Level:** L2 | **block_on:** critical
**Method:** Every declared mitigation grep-verified in implementation at the cited location. No new-threat scan performed (register authored at plan time).

## Threat Register

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-13-01-01 | Tampering / struct append | mitigate | CLOSED | `contracts/gnus-ai/GNUSLifecycleStorage.sol:12` append-only marker; slot-math (+9/+10 packing) + legacy zero-default decode tests: `test/unit/GNUSLifecycleUpgrade.test.ts:31,182-183` |
| T-13-01-02 | Tampering / storage slot | mitigate | CLOSED | `GNUSLifecycleStorage.sol:30` `keccak256("gnus.ai.lifecycle.storage")` — grep across all `*StoragePosition` constants shows unique vs control/bridge-validator/nft-factory/treasury/withdraw-limiter |
| T-13-01-03 | Tampering / enum ordinal-0 | mitigate | CLOSED | raw `uint8` storage (`uint8(ExpirationMode.PerHolder)` etc. in `GNUSLifecycle.sol:182-196`); legacy decode test asserts zero defaults |
| T-13-02-01 | EoP / settleExpired | mitigate | CLOSED | `GNUSLifecycleMint.sol:186` `settleExpired(address account, uint256 id)` — no recipient param; disposition/recipient from immutable config |
| T-13-02-02 | Tampering / configureLifecycle | mitigate | CLOSED | `GNUSLifecycle.sol:175,186-197` `_totalSupply[id]==0` gate (Q6), creator-or-admin auth, PerHolder+transferable revert (Q2), REDEEM nonConvertible revert (Q1), enum range requires lines 182/184 |
| T-13-02-03 | Tampering / REDEEM inflation | mitigate | CLOSED | `GNUSLifecycleMint.sol:312-324` `_burn(account,id)+_mint(account,parentId)` no-custody pair; no `convert` call; conservation invariant L2 |
| T-13-02-04 | Tampering / resurrection | mitigate | CLOSED | `GNUSLifecycleMint.sol:219+` `_applyPerHolderRenewal` settle-first, pre-mint balance semantics (Doxygen documents Pitfall P5) |
| T-13-02-05 | Tampering / selector collision | mitigate | CLOSED | `test/unit/GNUSLifecycle.test.ts:179` diamond-deploy collision check (deploy is the assertion) |
| T-13-02-06 | DoS / unbounded loops | mitigate | CLOSED | `settleExpired` settles exactly one (account, id); no holder/id iteration in `GNUSLifecycleMint.sol:186-208` |
| T-13-03-01 | Tampering / verifier reentrancy | mitigate | CLOSED | Cap increment single write point in hook (`GNUSLifecyclePolicy.sol:101-103`, CEI require-then-write); verifier is `view`/STATICCALL — ordering deviation from plan (cap after verify) documented and accepted in 13-03 REPLAN ADDENDUM; reenterMint driver test `test/unit/GNUSNFTFactoryAntiScalping.test.ts:311-341` |
| T-13-03-03 | Tampering / renewal resurrection | mitigate | CLOSED | `_applyPerHolderRenewal` pre-mint settle-first (same evidence as T-13-02-04); L1 invariant |
| T-13-03-04 | DoS / EIP-170 | mitigate | CLOSED | Facet split; measured sizes 24,335 / 21,206 / 18,776 ≤ 24,576 (13-03-SUMMARY.md:110-112) |
| T-13-03-05 | Tampering / legacy selector drift | mitigate | CLOSED | `GNUSNFTFactory.sol:104,116` mint/mintBatch signatures unchanged; factory reverted to HEAD (13-03-SUMMARY) |
| T-13-04-01 | EoP / operator-role bypass | mitigate | CLOSED | grep `NFT_PROXY_OPERATOR_ROLE\|isApprovedForAll` in `GNUSLifecyclePolicy.sol` = 0; grant-then-revert test `test/unit/GNUSLifecyclePolicy.test.ts:228` |
| T-13-04-02 | Tampering / dual enforcement drift | mitigate | CLOSED | Single predicate (`GNUSLifecyclePolicy.sol` relocated verbatim, single call site); ERC20TransferBatch documented out-of-scope |
| T-13-04-03 | Tampering / SOULBOUND carve-out | mitigate | CLOSED | `GNUSLifecyclePolicy.sol:191-210` carve-out destination immutable `nft.expirationRecipient` only; WR-03 creator/admin carve-out; accepted-risk comment at line 194 (IN-01) |
| T-13-04-05 | Tampering / GNUS lockout | mitigate | CLOSED | `GNUSLifecyclePolicy.sol:160` hardcoded early return for `id == GNUS_TOKEN_ID` |
| T-13-05-01 | Tampering / resurrection | mitigate | CLOSED | `test/foundry/invariant/LifecycleInvariant.t.sol:145` invariant_L1_settleFirstNoResurrect (ghost_resurrections == 0) |
| T-13-05-02 | Tampering / settle inflation | mitigate | CLOSED | LifecycleInvariant.t.sol:154 invariant_L2 conservation across all five dispositions |
| T-13-05-03 | Tampering / test vacuity | mitigate | CLOSED | LifecycleInvariant.t.sol:174-183 afterInvariant guards ghost_settleCalls>0, ghost_renewalCalls>0 |
| T-13-05-04 | Tampering / test workaround | mitigate | CLOSED | 13-04-SUMMARY root-cause fix pattern (test fix only, no production accommodation); acceptance criterion in 13-05-PLAN |
| T-13-06-01 | Tampering / bridge policy bypass | mitigate | CLOSED | `GNUSBridge.sol:251` `_enforceBridgePolicy(sender, id)` before `_burn` (line 268); per-policy revert tests in `GNUSBridgePolicy.test.ts` |
| T-13-06-02 | DoS / limiter griefing | mitigate | CLOSED | `GNUSBridge.sol:251` policy check before `checkAndRecordWithdraw` (line 262); limiter-unchanged test `GNUSBridgePolicy.test.ts:290` |
| T-13-06-03 | Tampering / AI Credits leakage | mitigate | CLOSED | BURN disposition forces nonConvertible (`GNUSLifecycle.sol:363,381` D11); SC7 zero-delta assertions incl. totalSupplyOfAll `GNUSLifecycleAICredits.test.ts:278-306` |
| T-13-06-04 | EoP / AI Credits exfil | mitigate | CLOSED | SOULBOUND predicate (13-04) + bridge policy; explicit revert tests in GNUSLifecycleAICredits/GNUSBridgePolicy suites |
| T-13-06-05 | Tampering / selector collision | mitigate | CLOSED | Loupe uniqueness over all 11 Phase 13 selectors: `GNUSLifecycleAICredits.test.ts:345` |

## Accepted Risks Log

| ID | Risk | Evidence |
|----|------|----------|
| T-13-SC (×6) | No new packages installed | 13-RESEARCH Package Legitimacy Audit |
| T-13-03-02 | Per-wallet cap is Sybil-vulnerable | Documented in test comments per D10 (GNUSNFTFactoryAntiScalping.test.ts) |
| T-13-04-04 | Malicious creator-configured registry bricks only that token | Plan 13-04 accept; registry set pre-first-mint (Q6 gate); view call only |
| WR-04 | Transient `settleRedeemMintActive` flag exempts sale-window/cap checks during `_settleRedeemToParent` | Accepted-risk comment `GNUSLifecyclePolicy.sol:71`; parent maxSupply still enforced; mint paths creator/admin-gated |
| IN-01 | SOULBOUND fixed-recipient early return not scoped to settlement — holder may voluntarily exit to `expirationRecipient` pre-expiry | Accepted-risk comment `GNUSLifecyclePolicy.sol:194-196` |
| Cross-facet `_isExpired` duplication | Pure storage-read predicate duplicated in GNUSLifecycle + GNUSLifecycleMint | KEEP-IN-SYNC comment `GNUSLifecycleMint.sol:329`; drift risk assessed minimal (13-03-SUMMARY) |
| ICredentialVerifier / IAllowlistRegistry interface-only | address(0) = open mint / unrestricted; plug-in trust is creator's choice | 13-01 plan trust boundary |

## Unregistered Flags

None blocking. Two informational deployment-surface notes (mapped, not unregistered):
1. **Library linking harness** (13-04-SUMMARY): library address must be wired at every future production facet deployment linking GNUSERC1155MaxSupply. Related review finding WR (per-network cache) fixed in c73b877 (13-REVIEW.md:111).
2. **protocolVersion 2.6** confirmed in `diamonds/GeniusDiamond/geniusdiamond.config.json:2` (prior-work flag resolved).

## Known Residuals (prior disposition, recorded not escalated)

- WR-04 and interface-only plug-ins as listed in Accepted Risks above.

## Audit Trail

- Threat models extracted from 13-01..13-06 PLAN.md `<threat_model>` blocks.
- Threat Flags sections reviewed: 13-01, 13-02, 13-03 (explicit), 13-04 ("Threat notes" section), 13-05, 13-06 (none beyond plan).
- Implementation greps executed against contracts/gnus-ai/{GNUSLifecycleStorage,GNUSLifecycle,GNUSLifecycleMint,GNUSLifecyclePolicy,GNUSERC1155MaxSupply,GNUSBridge}.sol; test evidence greps against test/unit/* and test/foundry/invariant/LifecycleInvariant.t.sol.
- Test suites NOT re-run per audit constraints (UAT: 76 passing across evidence suites; Hardhat 569/2/1, Foundry 215/2/3, verified 2026-08-25).
- Implementation files not modified.

**Threats open: 0 / 27**
