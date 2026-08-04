# Phase 9: Per-Child GNUS Treasury/Reserve - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 9-per-child-gnus-treasury-reserve
**Areas discussed:** Reserve topology, exchangeRate semantics, child-token disposition on redemption, withdraw() fate, redeemability default, backing granularity, hierarchy/ID gaps, two-path vs one-function conversion, treasury necessity

---

## Reserve Topology

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: per-child accounting in diamond | `mapping(uint256 => uint256) reserveOf` inside diamond storage — efficient, no vault deployments | ✓ |
| Option B: vault contract per child | Stronger isolation, more deployment surface | |

**User's choice:** A
**Notes:** Research doc recommended A to start. Discussion then sharpened it further: minion denomination (D2) removes the need for per-level treasuries entirely — one escrow ledger with per-token claims.

---

## exchangeRate Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Child units per 1 parent unit (divide) | Matches current `withdraw()` comment; Phase 13 D12's original framing | |
| Minions of parent per 1 child unit (multiply) | Children are fractions of parents; rate is a price | ✓ |

**User's choice:** "exchange rate is really how many minions and most child units will be fractions of the parents, so this must stay"
**Notes:** Current code is inverted AND self-inconsistent (mint multiplies, withdraw divides — CONCERNS #2). Later refined: **fixed-point** scaled integer, and **minions of GNUS** (not parent units) at every level — enabling single-hop conversion at any depth.

---

## Child-Token Disposition on Redemption

| Option | Description | Selected |
|--------|-------------|----------|
| Burn on convert | Research doc default; simplest supply semantics | |
| Treasury inventory (re-issuable) | "Put back into the treasury" — buy-back-and-resell | |
| **Ledger reallocation (no burn at all)** | Conversion moves backing claims between token ids; nothing destroyed | ✓ |

**User's choice:** "the treasury reserve is not really a burn, its a put back into the treasury, burns go away. really." → refined to: "Burn on convert means nothing, it's reducing the owners supply of one token and removing that redeemableSupply[id] and transferring that to new token id redeemableSupply[to tokenID]"
**Notes:** Final form stores redeemable supply **as minions** — multiplier applied only on read. User: "reserveOf[id] >= redeemableSupply[id] * exchangeRate[id] should just store redeemable Supply as minions, really, then the function to get total supply would do the exchangeRate multiplier only."

---

## withdraw() Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Thin wrapper over redeem | Compat shim for existing callers | |
| Kept separate for direct children | Phase 13 D12's original assumption | |
| **Removed entirely** | `convert(fromId, toId, amount, to)` covers all paths | ✓ |

**User's choice:** (b) removed
**Notes:** User initially suspected `withdraw()` was admin-only contract-asset recovery — verification showed that's `GNUSContractAssets.withdrawToken` (untouched), while `GNUSBridge.withdraw` is genuinely the child→GNUS redemption path (burn child + `_mintWithBridgeFee` GNUS). Phase 13 D12 flagged for amendment.

---

## Redeemability Default

| Option | Description | Selected |
|--------|-------------|----------|
| `redeemable` flag, zero-default false (opt-in) | Conservative; new tokens non-convertible unless marked | |
| **`nonRedeemable` flag, zero-default false = redeemable (opt-out)** | Inverted flag; convertible by default | ✓ |

**User's choice:** "redeemable probably should be non-redeemable so default is redeemable"
**Notes:** No migration needed — user confirmed no child tokens have been created yet. Burn-only tokens (Phase 13 AI Credits) set `nonRedeemable = true` at creation. Flag immutable after first backed issuance.

---

## Backing Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Strict exact-deposit at mint only | Research doc's `mintBackedChild` sketch | |
| **Allow `depositToReserve` pre-fund/top-up** | Deposits decoupled from issuance | ✓ |

**User's choice:** allow depositToReserve
**Notes:** Over-collateralization permitted. Surplus-withdrawal policy left to plan.

---

## Hierarchy / ID Collision (CONCERNS #4)

| Option | Description | Selected |
|--------|-------------|----------|
| Full ID re-encoding | Fix deep-hierarchy truncation in `(parentID << 128)` scheme | |
| **Add `parentId` field + collision guard only** | Walk up via stored parent; guard duplicate creation | ✓ |
| Nothing needed | Rely on bit-shift derivation | |

**User's choice:** "I'm not sure what is needed here, you can walk up a hierarchy just fine, I think because the child token/nft has the parent ID... but verify any gaps"
**Notes:** Verification found: `NFT` struct has NO `parentId` field (parent only via `id >> 128`, truncates at depth ≥2), and no `nftCreated` collision guard in `createNFTs`. Minimal fix locked: add `parentId` + one-line require; no re-encoding.

---

## Two-Path vs One-Function Conversion

| Option | Description | Selected |
|--------|-------------|----------|
| Two paths: `redeem()` (child→parent) + `withdraw()` (parent→GNUS) | Per-level settlement; matches Phase 13 D8/D12 framing | |
| **One function: `convert(fromId, toId, amount, to)`** | Minion denomination collapses the chain; single hop any depth | ✓ |

**User's choice:** "it would be nice if it was one function to redeem had a to part. since they are minions, this should really be a convert function()"
**Notes:** The pivotal question — "all denominated in minions, so do we even need a treasury then?" — resolved as: yes, escrow ledger still required (else conversion is an unbacked mint), but per-level treasuries are not. Hierarchy example from user: company token → game token (NeoSpace) → NFT → sub-NFT.

---

## Rounding / Dust

| Option | Description | Selected |
|--------|-------------|----------|
| Granularity guard (revert on non-clean division) | No dust ever created | |
| **Floor rounding, dust permitted** | Economically negligible | ✓ |

**User's choice:** "granularity guard, just let dust create, it'll be so small it won't matter"
**Notes:** Floor in converter-disfavoring direction — rounding can never inflate claims against the reserve.

---

## Claude's Discretion

- Fixed-point scale constant and rounding helper
- Struct field layout/order (coordinated with Phase 13 appends)
- Surplus-reserve withdrawal policy
- `convert()` placement: `GNUSBridge` vs new `GNUSTreasury` facet (24KB budget)
- Event shapes
- Bridge-fee disposition on GNUS-terminal convert (recommendation: remove — release ≠ issuance)
- Storage library: extend `GNUSNFTFactoryStorage` vs new `GNUSTreasuryStorage.sol`

## Deferred Ideas

- Isolated vaults for high-value children (research doc Option B) — future hardening
- `redeemFromERC20Proxy` adapter — Phase 11 territory
- Cross-chain treasury mirroring — Phase 10/12
- Phase 13 CONTEXT amendment (D12 withdraw→convert, rate framing) — at Phase 13 plan time
