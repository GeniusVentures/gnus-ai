# Phase 9: Per-Child GNUS Treasury/Reserve - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning
**Priority:** P0 (security-critical) — unblocks Phase 13; Phase 7 audit gate blocked until this lands

<domain>
## Phase Boundary

Replace the implicit burn-GNUS-on-mint / mint-GNUS-on-withdraw backing model with explicit, minion-denominated escrow accounting. Fix the asymmetric backing invariant (CONCERNS #1): descendants minted without GNUS backing can currently be redeemed for freshly-minted GNUS via `GNUSBridge.withdraw()` — an unbacked-mint vulnerability.

The core reframe (from user discussion): **all tokens at every tree level are denominated in minions of GNUS**, so conversion is a single-hop ledger reallocation — not a tree walk, not a burn/mint pair, and not a per-level treasury hierarchy. One escrow ledger with per-token claims; backing moves between token-id ledger entries on convert; total GNUS supply never changes.

In scope: escrow ledger storage, `convert()` API, backed issuance path, `nonRedeemable` flag, `depositToReserve()`, removal of `GNUSBridge.withdraw()`, `parentId` struct field + ID collision guard, exchange-rate math fix (CONCERNS #2), invariant tests. Out of scope: bridge vault (Phase 10), cross-chain supply ledger (Phase 12), ERC-20 proxy changes (Phase 11), lifecycle/transfer policy (Phase 13), licensing model (Phase 14).
</domain>

<decisions>
## Locked Decisions

### D1. Single escrow ledger — no per-level treasuries

One GNUS escrow accounting structure inside diamond storage with per-token-id claims:

```solidity
mapping(uint256 tokenId => uint256 minionsLocked)  reserveOf;          // backing held per token, in minions
mapping(uint256 tokenId => uint256 backingMinions) redeemableBacking;  // total redeemable backing per token, in minions
```

Because every level is minion-denominated (D2), parent-unit reserves are unnecessary. Each token's solvency invariant:

```text
reserveOf[id] >= redeemableBacking[id]
```

(Equality in steady state; `depositToReserve` can over-collateralize.) The diamond already holds all GNUS as id-0 balances — the "treasury" is earmarking accounting over that balance, not separate vault contracts (research doc Option A, sharpened).

### D2. `exchangeRate` = fixed-point minions per 1 child unit, every level

- Denomination is **minions of GNUS per 1 child unit** at every tree depth — company token, game token, NFT, sub-NFT all price directly in minions. Conversion any depth → single hop, no tree-walking.
- **Fixed-point scaled integer** (exact scale convention — e.g. 1e18 — chosen at plan time; children are typically fractions of parents so sub-unit rates must be representable).
- Current code is inverted against this convention and self-inconsistent: `beforeMint` multiplies (`amount * exchangeRate`), `withdraw` divides (`amount / exchangeRate`). Both are replaced by the ledger model (D3); the CONCERNS #2 inconsistency disappears with them.
- Phase 13 D12's "child units per 1 direct-parent unit" framing is superseded — minion denomination makes parent-relative rates unnecessary. **Phase 13 CONTEXT must be amended** (D4 below covers the mechanics).

### D3. No burn — conversion is ledger reallocation; redeemable supply stored AS minions

"Burn on convert" was rejected. Conversion moves claims between token ids:

```text
redeemableBacking[fromId] -= amount * exchangeRate[fromId]   // claim leaves from-token
reserveOf[fromId]         -= amount * exchangeRate[fromId]   // escrow released from from-token
holder balance[fromId]    -= amount
redeemableBacking[toId]   += minionsOut                      // claim arrives at to-token
reserveOf[toId]           += minionsOut                      // escrow re-earmarked to to-token
holder/to receives toId units
```

- **Redeemable supply is stored as minions** (`redeemableBacking[id]`), not child units. Child-unit quantities are derived on read: `redeemableUnits(id) = redeemableBacking[id] / exchangeRate[id]`. No dual-unit accounting, no rounding drift between two stored quantities.
- GNUS-terminal conversion is the special case `toId == GNUS_TOKEN_ID`: backing is released from escrow and becomes the holder's free minion balance. Nothing minted, nothing burned — a transfer of existing minions.
- Total GNUS supply is invariant under convert. Phase 12's cross-chain ledger and Phase 10's bridge vault get a stable supply target.

### D4. `GNUSBridge.withdraw()` REMOVED — `convert()` is the only redemption path

- `GNUSBridge.withdraw(amount, id)` is deleted. Its burn/mint pair is the CONCERNS #1 vulnerability; the withdraw-limiter integration (WR-07 one-charge invariant, lines ~176-186) must be re-homed onto the GNUS-terminal leg of `convert()` — limiter charging semantics preserved (charge once, in minions, on GNUS release; super-admin bypass preserved).
- `GNUSContractAssets.withdrawToken(token, to, amount)` — the admin recovery path for wrongly-deposited ETH/ERC-20s — is a different contract and is **untouched**.
- **Phase 13 D12 amendment:** `REDEEM_TO_PARENT` settlement calls `convert(id, parentId, amount, account)` instead of routing through `withdraw()`. Phase 13's "Phase 9 owns `withdraw()`" references now read "Phase 9's `convert()`".
- `bridgeOut()`'s limiter charge in GNUS-equivalent terms (CR-03, lines ~221-230) uses `amount / exchangeRate` — must be updated to the fixed-point minion convention (D2) when the rate semantics flip. Verify at plan time whether bridge limiter math survives or is superseded by Phase 10.

### D5. `nonRedeemable` flag — zero-default FALSE = redeemable (opt-out)

- Struct field is `nonRedeemable` (inverted): storage zero-default `false` means **every token is convertible by default**.
- No migration needed — no child tokens have been created yet (user-confirmed).
- Burn-only tokens (Phase 13 AI Credits, SOULBOUND allocations) must set `nonRedeemable = true` at creation. Phase 13 D8's "AI Credits never credit GNUS" constraint is enforced by the flag + zero backing, not by a default-off gate.
- Flag is immutable after first backed issuance (prevents converting a redeemable token into a confiscation trap post-issuance — same spirit as Phase 13 D4 mutability rules).

### D6. `depositToReserve(id, amount)` — pre-funding and top-ups in minions

- Deposits are minion-denominated, decoupled from issuance. Creators/admins can pre-fund a token's escrow or top it up at any time.
- Over-collateralization is permitted (`reserveOf[id] > redeemableBacking[id]`).
- **Surplus withdrawal:** plan decides whether creators can withdraw surplus above the invariant, or reserve is one-way (in via deposit, out via holder conversion only). Flagged as plan-time decision — user did not weigh in.

### D7. Hierarchy gaps: `parentId` struct field + collision guard; NO ID re-encoding

- Add `parentId` to the `NFT` struct in `GNUSNFTFactoryStorage.sol` (append-only). Parent is currently only recoverable via `id >> 128`, which truncates at depth ≥2 — Phase 13/14 trees (License NFT → credits → sub-allocations) need real parent lookup. Zero-default decodes as parent = GNUS_TOKEN_ID (0), correct for all existing direct children.
- Add `require(!NFTs[newTokenID].nftCreated, ...)` collision guard in `createNFTs`.
- **No re-encoding** of the `(parentID << 128) | childCurIndex++` scheme — user-verified that walking up via parentId is sufficient; gaps beyond that are theoretical with zero tokens deployed.
- Struct-append ordering with Phase 13's lifecycle fields: whichever phase lands second appends after the other (Phase 13 D1 already anticipates this).

### D8. API: `convert(fromId, toId, amount, to)` — one function

```solidity
function convert(uint256 fromId, uint256 toId, uint256 amount, address to) external;
```

- `to` enables settle-on-behalf (contracts, relayers, Phase 13's permissionless `settleExpired`).
- GNUS-terminal when `toId == GNUS_TOKEN_ID` (backing → free minion balance).
- Token-to-token when both ids are redeemable (backing moves between ledger entries).
- Reverts: `nonRedeemable[fromId]`, `nonRedeemable[toId]` (when toId != GNUS), insufficient `reserveOf[fromId]`, insufficient holder balance.
- Permissionless, fixed-outcome (Phase 13 D9 convention): caller cannot redirect value beyond choosing `to` for their own conversion output.
- Backed issuance mirror: `issueBacked(address to, uint256 id, uint256 amount)` — caller deposits `amount * exchangeRate[id]` minions into `reserveOf[id]`, receives child units. Unbacked utility mints (badges, licenses with no redemption intent) stay on the existing `mint()` path — gated by `nonRedeemable`/zero-backing consistency checks at plan time.

### D9. Rounding: floor, dust permitted

- No granularity guard. Fixed-point floor rounding; dust is economically negligible (user call).
- Plan documents the rounding direction explicitly (floor, in the converter-disfavoring direction, so rounding can never inflate claims against the reserve).

### D10. Limiter + fee preservation

- WR-07 one-charge invariant and super-admin bypass (currently in `withdraw()`) re-home to the GNUS-terminal leg of `convert()`. Charge once, in minions, on release.
- `_mintWithBridgeFee` bridge-fee behavior on conversion-to-GNUS: plan decides whether the fee survives the removal of mint-based withdrawal (the fee was charged on minted GNUS; under escrow release there is no mint). Fee-preservation vs fee-removal flagged for plan with a recommendation to simplify (remove) since release ≠ issuance.

### Claude's Discretion

- Fixed-point scale constant and rounding helper (D2/D9)
- Exact struct field layout/order for `GNUSNFTFactoryStorage.NFT` appends (D5, D7) — coordinated with Phase 13's append list
- Surplus-reserve withdrawal policy (D6)
- Whether `convert()` lives on `GNUSBridge` or a new `GNUSTreasury` facet (24KB facet-size budget vs cohesion)
- Event shapes (`Converted(fromId, toId, amount, minionsOut, to)`, `ReserveDeposited(id, amount, depositor)`)
- Bridge-fee disposition (D10)
- Storage library name/location (`GNUSNFTFactoryStorage` extension vs new `GNUSTreasuryStorage.sol`)

</decisions>

<enforcement>
## Enforcement Requirements

1. Solvency invariant `reserveOf[id] >= redeemableBacking[id]` holds after every state transition — proven by invariant/fuzz tests (research doc §Suggested invariant tests).
2. GNUS total supply is invariant under `convert()` — no mint/burn on the conversion path, proven by supply-before/after assertions.
3. `nonRedeemable` tokens reject conversion both as source and (non-GNUS) destination.
4. Backing can never be created by conversion — only moved or released. `redeemableBacking` total across ids changes only via `issueBacked` (adds), GNUS-terminal convert (releases), or admin settlement paths.
5. Limiter charged exactly once per GNUS-terminal conversion (WR-07 semantics preserved).
6. `nonRedeemable` immutable after first backed issuance.
</enforcement>

<security_and_upgrade>
## Security and Upgrade Requirements

1. Storage appends only; existing `NFT` records decode with zero defaults — `parentId = 0` (= GNUS_TOKEN_ID, correct for existing direct children), `nonRedeemable = false` (= redeemable, intended default). Upgrade test required.
2. `withdraw()` removal is a **breaking selector change** — diamond cut removes the selector; testnet redeploy acceptable (no mainnet). All tests/scripts referencing `withdraw(` updated to `convert()`.
3. Reserve accounting must not be touchable by direct storage writes outside the treasury logic — all mutations through `convert`/`issueBacked`/`depositToReserve` (and Phase 13 settlement paths calling `convert`).
4. Fixed-point math: overflow-safe multiplication for `amount * exchangeRate` (Solidity 0.8.19 checked arithmetic; document the practical max amounts).
5. No unbounded loops; single-token operations only.
6. Full regression: existing GNUS transfer/bridge/mint paths unaffected (D3 ledger is additive state).
7. Slither must run on the changed contracts (CONCERNS: slither currently excludes `contracts/gnus-ai/` — flag for Phase 7 audit).
</security_and_upgrade>

<testing>
## Required Test Categories

- Legacy decode: pre-upgrade `NFT` records → `parentId == 0`, `nonRedeemable == false`, behaviorally unchanged;
- `issueBacked`: exact-deposit mint, `reserveOf`/`redeemableBacking` deltas correct, unbacked mint path unaffected for utility tokens;
- `convert` token-to-GNUS: holder receives exact minions, backing released, GNUS total supply unchanged, limiter charged once, super-admin bypass preserved;
- `convert` token-to-token: backing moves between ledgers, no minions created, rounding floors toward reserve;
- `convert` deep token (grandchild) → GNUS: single hop, rate applied once, no tree-walking;
- Reverts: `nonRedeemable` source/destination, insufficient reserve, insufficient balance, zero amount;
- Invariant fuzz: `reserveOf[id] >= redeemableBacking[id]` across random sequences of issue/convert/deposit;
- Supply invariant: GNUS `totalSupply` identical before/after any convert sequence;
- `depositToReserve`: pre-fund then issue against it; top-up; over-collateralization;
- Dust: sub-unit conversions floor correctly, dust never accumulates as claim against reserve;
- Collision guard: `createNFTs` reverts on duplicate id; `parentId` recorded correctly at depth ≥2;
- `withdraw()` selector removed — diamond loupe shows it gone; old calldata reverts;
- Bridge fee (if retained): fee applied on GNUS-terminal convert; if removed, zero-fee assertion;
- Phase 13 compatibility: `REDEEM_TO_PARENT`-style settlement via `convert(id, parentId, ...)` round-trip.
</testing>

<dependencies>
## Phase Dependencies

| Phase | Relationship |
|---|---|
| **13 — Entitlements** | **Unblocked by this phase.** Phase 13 D8 (`REDEEM_TO_PARENT` via reserves, collateralized tokens only) and D12 (`withdraw()` ownership) assume this model. **Phase 13 CONTEXT needs amendment**: D12's `withdraw()` references → `convert()`; D12's "child units per 1 direct-parent unit" rate framing → minion denomination (D2). |
| **10 — Bridge Vault** | D4: `bridgeOut()` limiter math (CR-03) uses old rate convention — update or supersede. Stable GNUS supply (D3) simplifies vault accounting. |
| **12 — Supply Ledger** | D3: conversion doesn't change supply — ledger tracks only bridge locks and issuance. Expired-unsettled convention (Phase 13 D9) unaffected. |
| **11 — ERC-20 Proxy** | No interaction — proxy is a thin wrapper; conversion happens on the diamond. |
| **7 — Dependency Hardening** | Phase 7's final audit gate is blocked until this phase (and 10–14) complete (Phase 7 D-01). |
| **08.x** | No interaction. |

</dependencies>

<canonical_refs>
## Canonical References

Downstream research, planning, or implementation agents must read:

### Primary design source (the de-facto spec)

- `../.planning/Update-Smart-Contracts-Architecture.md` (TokenContracts root `.planning/`) — reserve model rationale (§"Why treasury-backed children are safer"), `mintBackedChild`/`redeem` sketches, Option A vs B analysis, invariant test list, recommended-fixes list (CONCERNS #1–#8 mapping). Note: this CONTEXT supersedes the doc's per-level-treasury framing with the single minion-denominated ledger (D1–D3).

### Code being changed

- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — `NFT` struct (append `parentId`, `nonRedeemable`; coordinate with Phase 13 appends);
- `contracts/gnus-ai/GNUSNFTFactory.sol` — `beforeMint` (lines 83–94: inverted rate math, burn-to-be-replaced), `createNFTs` (lines 152–176: collision guard, parentId recording);
- `contracts/gnus-ai/GNUSBridge.sol` — `withdraw()` (lines 156–186: REMOVED, limiter WR-07 re-home), `bridgeOut()` (lines ~210–235: CR-03 rate math update), `_mintWithBridgeFee`;
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` — `checkAndRecordWithdraw` (charge-once semantics to preserve);
- `contracts/gnus-ai/GNUSContractAssets.sol` — `withdrawToken` (untouched; here for contrast only);
- `contracts/gnus-ai/GNUSConstants.sol` — GNUS decimals (18), `GNUS_TOKEN_ID = 0`.

### Project docs

- `.planning/ROADMAP.md` §Phase 9 (lines 238–259) — goal/success criteria (superseded in part: "redeem() burns child tokens" → D3 reallocation model);
- `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` — D8/D12 dependencies on this phase, D1 struct-append coordination, amendment targets;
- `.planning/phases/06-test-coverage/06-CONTEXT.md` — D-02: current 2nd-gen no-burn behavior (this phase replaces the invariant it documented);
- `.planning/codebase/CONCERNS.md` — #1 asymmetric backing, #2 exchange-rate math (roadmap numbering; see ROADMAP §Phase 9 concern list);
- `.planning/private-network-ai.md` — licensing hierarchy context (License → credits trees this model must serve).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- Diamond-internal GNUS balance (id 0) — escrow needs no external token custody; it's storage accounting over balances the diamond already holds;
- `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw` — limiter charging, reused on the GNUS-terminal convert leg;
- `GNUSNFTFactoryStorage.Layout` — established append pattern for new mappings (`reserveOf`, `redeemableBacking`);
- Research doc's `mintBackedChild`/`redeem` sketches — direct ancestors of `issueBacked`/`convert`.

### Established Patterns

- Diamond storage pattern: `keccak256`-slotted `Layout` structs, append-only evolution;
- `require`-based validation + custom errors; super-admin bypass convention (limiter);
- Phase 13's permissionless fixed-outcome settlement convention (D9) — `convert` follows it;
- Versioned initializers for facet migrations.

### Integration Points

- `GNUSNFTFactory.beforeMint` — issuance hook where backed-mint deposit is enforced (or `issueBacked` as separate entry);
- `GNUSBridge` — current home of `withdraw()`/`bridgeOut()`; candidate home for `convert()` unless a new facet is warranted;
- Phase 13 `_enforceTransferPolicy` predicate — settlement paths call `convert()`;
- Diamond config `geniusdiamond.config.json` — selector removal (`withdraw`) + additions (`convert`, `issueBacked`, `depositToReserve`) in one diamondCut.

</code_context>

<specifics>
## Specific Ideas

- "exchange rate is really how many minions and most child units will be fractions of the parents, so this must stay" — user's denomination framing that collapsed the per-level-treasury design into D1's single ledger;
- "the treasury reserve is not really a burn, it's a put back into the treasury, burns go away. really." — user's reframe that became D3's reallocation model;
- "redeemable probably should be non-redeemable so default is redeemable" — D5's inverted flag, exactly as the user stated it;
- "just let dust create, it'll be so small it won't matter" — D9;
- Hierarchy example from discussion: Parent (company token) → Child (game token, e.g. NeoSpace) → grandchild (NFT) → grand-grandchild (sub-NFT), all minion-denominated — the depth scenario D2's single-hop conversion must serve.

</specifics>

<deferred>
## Deferred Ideas

- **Surplus-reserve withdrawal policy** (D6) — plan-time decision;
- **Bridge-fee disposition on conversion** (D10) — plan-time, recommendation to remove;
- **Isolated vaults for high-value children** (research doc Option B) — possible future hardening, not needed at current scale;
- **`redeemFromERC20Proxy` adapter** (research doc §How this affects the ERC-20 proxy) — Phase 11 territory if wanted;
- **Cross-chain treasury mirroring** — Phase 10/12;
- **Phase 13 CONTEXT amendment** (D12 `withdraw()`→`convert()`, rate framing) — do at Phase 13 plan time or as a small docs task once this phase's plan lands.

</deferred>

---

*Phase: 9-Per-Child GNUS Treasury/Reserve*
*Context gathered: 2026-08-04*
