# Phase 13 Discussion Log

**Date:** 2026-08-03 (resumed from 2026-07-27 draft context)
**Mode:** Advisor mode, update of existing CONTEXT.md
**Outcome:** All 17 previously-open decisions resolved; context approved for planning.

---

## Discussion Summary

The 2026-07-27 CONTEXT.md captured a proposed model with 17 open decisions. This session resolved them through 6 grouped gray areas plus follow-up deep-dives, with one parallel research agent pass covering resale/issuance/settlement/ID-strategy and one covering Phase 9–13 interdependencies.

## Area 1: Core lifecycle shape

**Q:** Field naming, storage location, mutability, period model.
**User decisions:**
- `validFrom` / `validUntil` naming, `block.timestamp`-based.
- Append to `NFT` struct — "otherwise wallet has to grab information from two different functions." (Rejected the research agent's separate-storage-library suggestion as over-engineering.)
- Mutable after mint, creator-only, subscription-renewal semantics.
- Creator-supplied timestamps (no hardcoded annual period).

**Later refinement (Area 8 follow-up):** user rejected per-ID-only expiry as incorrect for the product — per-holder expiry clocks required. Final layered model: static per-ID policy/lifecycle config stays appended to the `NFT` struct (single wallet read); per-holder `expiresAt[tokenId][holder]` lives in a separate mapping; explicit `ExpirationMode { None, PerTokenId, PerHolder }` enum selects the clock source.

## Area 2: Transfer policy scope

**Q:** Which policies ship v1; AI allocation policy; ticket default.
**User decision:** All six policies ship in v1 (UNRESTRICTED, SOULBOUND, ISSUER_ONLY, ALLOWLISTED, CONTROLLED_RESALE, LOCKED_AFTER_START). AI allocations SOULBOUND.

## Area 3: Controlled resale mechanism

**Q:** v1 feature depth; consideration handling.
**User decision:** Resale features (price caps, gifting, refunds, count caps, cutoffs) are v2. v1's CONTROLLED_RESALE blocks ordinary transfers only.
**Claude's discretion:** v2 deferred-ideas entry; consideration-settlement question recorded for v2.

## Area 4: Anti-scalping issuance controls

**Q:** Which primary-sale controls ship v1.
**Research recommendation:** per-wallet cap + sale window + generic credential-verifier hook; skip per-tx cap; CEI ordering on verifier call.
**User decision:** Adopted (full v1). Wallet caps documented as Sybil-vulnerable.

## Area 5: Dispositions & settlement

**Q:** Which dispositions v1; settlement authorization.
**Research recommendation:** permissionless settlement (fixed outcome, no caller-redirectable value); all dispositions v1.
**User decision:** Adopted; REDEEM_TO_PARENT fully implemented since Phase 9 lands first (user rejected the "reserved enum that reverts" framing — "Phase 9 is going to be next... this needs to be finished for it to work").

## Area 6: AI allocation identity → AI Credits architecture

**Q:** Token-ID strategy (cohort/per-purchase/per-user).
**Evolution through discussion:**
1. User clarified product: $5 allocations with varying windows (monthly for some, annual for others), minion-denominated, conversion factor > 0.
2. User: "AI Credits will be our own [direct GNUS child] and should just be exchRate of 1.0" — grandchildren settle back into AI Credits at their rate.
3. User distinguished `withdraw()` as GNUS-treasury-only (Phase 9's domain), not general settlement; Phase 13 settlement targets direct parent (`id >> 128`).
4. User: treasury escrow model ("moving minions between ERC-1155 tokens") replaces burn/mint — that's Phase 9's job; Phase 13 builds on it.
5. User: AI allocation purchased with GNUS on open market; Banxa fiat onramp; automation needs thought.
6. User: "Why can't AI Credits just do all this without grandchildren?" → per-holder expiry eliminates window-IDs. **Final: AI Credits = direct GNUS child, rate 1.0, SOULBOUND, BURN, PerHolder expiry, no grandchildren.**

**Banxa automation:** app-layer scope, not Phase 13. Launch: treasury-direct mint on payment confirmation. Later: EIP-712 permit relayer. Phase 13 must not preclude either.

## Area 7: Phase sequencing & interdependencies

**Q:** Does Phase 13 build on today's burn/mint or Phase 9's treasury model?
**User decision:** Phase 13 is based on Phase 9's completed code — full dependency, no 13.1/13.2 split ("phase 13 is dependent on phase 9 being completed").

**Full 9–13 interdependency analysis (agent) — accepted findings:**
- 9→11 HARD only for proxy `redeem()`; 10→12 HARD (ledger needs lock/release producers); 9→13 HARD (reserve + collateralization classification).
- Proxy is a thin wrapper, not custodian → hook covers it; bypass risk is `NFT_PROXY_OPERATOR_ROLE` auto-approval → no operator exemptions.
- Bridging IS a transfer; vault gets no exemption; policy-bound tokens non-bridgeable v1; expiry evaluated per-chain on local timestamp.
- Phase 12 v1: expired-unsettled balances count as circulating.

## Key rulings (user's exact semantics, recorded verbatim in CONTEXT.md)

**Renewal (stacked, settle-first):**
```
if active balance:  expiry += purchasedDuration
if expired balance: settleExpired() first, then expiry = now + purchasedDuration
if zero balance:    expiry = now + purchasedDuration
```
Invariant: expired balances never resurrect.

**Per-holder expiry for SOULBOUND/subscription tokens; per-ID validUntil for transferable/event tokens** — as explicit `ExpirationMode`, not implicit fallback.

## Deferred ideas
- Controlled-resale mechanism (price caps/gifting/refunds/caps/cutoffs/consideration) → v2
- Banxa purchase-automation backend → app-layer
- USD oracle-priced purchases → v2
- Cross-chain soulbound via attestation → future
- Per-mint-lot provenance / return-to-original-sender → permanently out of scope
- Phase 12 v2 active-supply metric

## Claude's discretion items
- Grouped 17 open decisions into 6 gray areas for tractable discussion.
- Recorded `isSpendable(holder, id)` / `holderExpiresAt` view-function sketches (final names deferred to plan).
- Noted PerHolder + transferable-policy combination should be constrained at config time.
