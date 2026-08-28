---
title: "Phase 14.1: network-key mint validation (privateNetworkId = Ed25519 pubkey)"
date: 2026-08-25
status: CLOSED (plan 14-05, 2026-08-25) — research question #5 resolved: per-leg amounts are
  FIXED IN THE SKU (operator-configured; buyer picks among SKUs, never supplies amounts —
  preserves D-27 permissionlessness and D-10 exact-burn). Buyer-chosen splits at purchase are
  DEFERRED. Implemented as `creditAmount` (private leg, semantics unchanged) + appended
  `publicCreditAmount` (public leg).
priority: P1
source: /gsd-explore 2026-08-25 (see notes/network-pubkey-identity.md)
---

# Phase 14.1 candidate: network-key mint validation

Phase 14 executed and verified WITHOUT mint-time validation of `privateNetworkId`. This
follow-up closes the gap so the field can safely serve as the network's Ed25519 public key.

## Scope (mint-logic only — no storage changes)

1. **License creation (`createLicense` / GNUSLicensingPurchase):**
   - reject `privateNetworkId == 0` (a real Ed25519 pubkey can never be zero; zero = public,
     and a license IS a private network identity)
   - reject duplicates: no second NFT may claim an existing networkId (registry mapping or
     uniqueness scan per the facet-split pattern)
2. **Credit children:** propagate the parent license's networkId; enforce consistency
   (credit.networkId == parent license networkId — a credit cannot claim a network it is
   not a child of). Public credits mint with 0.
3. **Split-mint SKU:** generalize `creditAmount` to per-leg `privateCreditAmount` /
   `publicCreditAmount` (either may be zero); purchase mints both legs in one tx, one
   `LicenseActivated`. Backwards compat: existing single-leg SKUs decode as
   private-only or public-only.
4. **Open question for planning (research question logged):** who selects public-vs-private
   allocation — fixed in the SKU (operator-configured) vs buyer-chosen split at purchase.

## Constraints (standing)

protocolVersion 2.6 (never 2.7+); Solidity 0.8.19; EIP-170 per facet (GNUSLicensingPurchase
currently 21,494 B — headroom is ~3 KB); no magic numbers; append-only storage (none needed
here); baseline 593/2/1 Hardhat (the 1 is the known-stale chainID failure — never fix).

## Trigger

Run as a Phase 14 gap-closure plan before ship, or as Phase 14.1 immediately after Phase 14
ships. Storage field already exists — purely additive validation + SKU shape.
