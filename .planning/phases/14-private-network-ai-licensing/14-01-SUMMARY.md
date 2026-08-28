---
phase: 14-private-network-ai-licensing
plan: 01
subsystem: gnus-ai licensing storage + planning docs
tags: [storage-append, eip-170, docs-amendment, d-03, d-25, d-24, d-26, d-28, d-29]
requires: [phase-13 NFT struct +8..+10]
provides: [NFT.companyAdmin, NFT.privateNetworkId, NFT.networkScope, NFT.publicSettlementEnabled, slots +11/+12/+13 probes]
affects: [GNUSNFTFactory creation path (EIP-170 relief), GNUSLifecycle.createNFTWithLifecycle literal]
tech-stack:
  added: []
  patterns: ["non-zero field stores on virgin storage record for EIP-170 relief (13-04 Option A precedent)"]
key-files:
  created: []
  modified:
    - contracts/gnus-ai/GNUSNFTFactoryStorage.sol
    - contracts/gnus-ai/GNUSNFTFactory.sol
    - contracts/gnus-ai/GNUSLifecycle.sol
    - test/unit/GNUSLifecycleUpgrade.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md
decisions:
  - "D-03/D-25 fields appended at slots +11/+12/+13 with zero-default decode proven by storage probe"
  - "GNUSNFTFactory createNFT switched to non-zero field stores (24,155 B) after full struct literal pushed the facet to 24,833 B (> 24,576 EIP-170 limit)"
  - "Docs annotations reworded to avoid the literal tokens 'Banxa'/'mintBackedChild' so the acceptance greps (count 0) hold"
metrics:
  duration: ~1.5h
  completed: 2026-08-25
---

# Phase 14 Plan 01: Storage Foundation + Docs Amendments Summary

**Append-only D-03/D-25 NFT struct fields (`companyAdmin` +11, `privateNetworkId` +12, `networkScope`+`publicSettlementEnabled` packed +13) with zero-default decode proven by eth_getStorageAt probes, plus D-24/D-26/D-28/D-29 planning-docs amendments — with an EIP-170 relief refactor on the GNUSNFTFactory creation path.**

## What Was Built

### Task 1 — Docs amendments (commit 01b01bd, root)

- **LIC-04** (REQUIREMENTS.md): GNUS-minions-only rail (paid GNUS burned, D-10) + off-chain operator fiat path per D-26; USDC/Banxa rail wording removed entirely.
- **LIC-07**: annotated RESOLVED by D-07/D-08 (SG spend → GV wallet → Phase 10 bridgeIn → ops burn; no new mechanism).
- **LIC-06**: amended per D-28 — hybrid redeemability = Phase 13 REDEEM_TO_PARENT + Phase 9 `GNUSTreasury.convert()`; the `mintBackedChild` reference is dead terminology and gone.
- **ROADMAP §Phase 14**: goal line now "GNUS-burn payment router + operator fiat path"; SC4 rewritten per D-26; SC7 prefixed RESOLVED (D-07/D-29).
- **ROADMAP §Phase 13 SC4 + 13-CONTEXT §D7**: D-24 amendment pointers (SOULBOUND may bridgeOut for CREATOR/ADMIN while unexpired; implemented in 14-04). Only these two other-phase entries were touched; `grep -c AMENDED` in 13-CONTEXT = 1.

### Task 2 — Struct append + slot-probe tests (TDD)

- **RED** (commit ab68774, root): two failing tests in `test/unit/GNUSLifecycleUpgrade.test.ts` — zero-default decode and +11/+12/+13 packed-slot round-trip via `hardhat_setStorageAt` + `getNFTInfo`.
- **GREEN** (submodule commit f0815c0, root bump 8986b5b):
  - `GNUSNFTFactoryStorage.sol`: 4 fields appended under a "Phase 14 appends below" banner with slot annotations mirroring the Phase 13 block; Doxygen `///< D-03/PD-3 ...` comments.
  - `GNUSLifecycle.sol`: `createNFTWithLifecycle` literal extended with the four zero-default fields.
  - `GNUSNFTFactory.sol`: creation path reworked (see Deviation 1).
- Suite: `GNUSLifecycleUpgrade.test.ts` **5 passing** (3 Phase 13 tests unmodified + 2 new). Adjacent regression sanity (Lifecycle, LifecycleAICredits, LifecycleSettle, NFTFactory x3): **92 passing, 0 failing**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] EIP-170: full struct literal pushed GNUSNFTFactory to 24,833 B (limit 24,576)**
- **Found during:** Task 2 GREEN compile — diamond deploy failed with "trying to deploy a contract whose code is too large" at `GNUSNFTFactory.constructor`. Baseline facet was 24,501 B — only 75 B headroom; the 22-field literal added 332 B.
- **Fix:** Switched `createNFT`'s loop body from the full named struct literal to individual stores of only the non-zero fields (name, symbol, exchangeRate, maxSupply, uri, creator, nftCreated, parentId). The D7 collision guard plus monotonic `childCurIndex` guarantee a virgin all-zero storage record, so zero-default fields (incl. the Phase 13 D1 defaults previously written as explicit zeros) decode identically without stores. This follows the user-approved 13-04 Option A EIP-170-relief precedent (13-04-SUMMARY: 26,372 B → under limit).
- **Result:** factory deployedBytecode **24,155 B** (346 B headroom, smaller than the 24,501 B baseline). All Phase 13/14 decode tests and adjacent suites pass.
- **Files:** contracts/gnus-ai/GNUSNFTFactory.sol
- **Commits:** f0815c0 (submodule), 8986b5b (root bump)

**2. [Rule 3 - Blocking] Plan-prescribed annotation strings failed the plan's own acceptance greps**
- **Found during:** Task 1 verify — the plan's prescribed LIC-04 annotation "(amended 2026-08-25, D-26 — no USDC/Banxa contract code)" contains "Banxa" and the LIC-06 wording contains "mintBackedChild", contradicting acceptance criteria `grep -c Banxa == 0` and "no remaining mintBackedChild mention".
- **Fix:** Annotations reworded ("no USDC or fiat-onramp contract code"; "the Phase 9 backed-child mint helper ... never shipped") — same meaning, grep-clean.
- **Files:** .planning/REQUIREMENTS.md
- **Commit:** 01b01bd

**3. [Rule 1 - Bug] Test hex literal used non-hex characters**
- **Found during:** Task 2 RED run — `0x...AdmIn007` is not valid hex.
- **Fix:** replaced with `0x...ABcd0007`.
- **Commit:** ab68774

### Concurrency note (not a deviation from plan scope)

Wave 1 plans 14-02/14-04 executed concurrently in this same tree. My submodule commit initially landed on `gsd/phase-14-plan-04-bridge-gate` (the 14-04 agent had switched the shared submodule HEAD mid-run); I cherry-picked it onto `develop` (f0815c0) and restored submodule HEAD to develop. The 14-04 branch retains a duplicate at 4f054a3 — identical patch, merge-safe. No 14-04/14-02 files were modified by this plan.

## TDD Gate Compliance

- RED: ab68774 `test(14-01): add failing slot-probe tests ...` (2 failing asserted before implementation)
- GREEN: f0815c0 `feat(14-01): append D-03/D-25 NFT struct fields ...` (5 passing)

## Verification

- `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` → 5 passing (incl. +11/+12/+13 probes and zero-default decode)
- Task 1 docs grep chain → DOCS-OK (Banxa count 0, all amendment markers present, AMENDED count 1 in 13-CONTEXT)
- Adjacent suites (creation-path consumers): 92 passing / 0 failing
- Known-stale GNUSControlStorage chainID failure: untouched, as instructed

## Self-Check: PASSED

- Commits verified in git: 01b01bd, ab68774, 8986b5b (root); f0815c0, 4f054a3 (submodule)
- Modified files verified present with expected content
