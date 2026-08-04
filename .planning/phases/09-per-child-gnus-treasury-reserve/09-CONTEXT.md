# Phase 9: Per-Child GNUS Treasury/Reserve - Context

**Gathered:** 2026-08-04 (amended 2026-08-04 — conversion-native revision)
**Status:** Ready for planning
**Priority:** P0 (security-critical) — unblocks Phase 13; Phase 7 audit gate blocked until this lands

> **Amendment note:** This CONTEXT was revised after research revision 2 (09-RESEARCH.md, commit 9cf2e58). The user pivoted the design from a per-token reserve-ledger model to the **conversion-native model**: all supplies denominated in minions, conversion as pure reallocation, no reserve apparatus. D1/D3/D6/D8/D9 from the original capture were amended or deleted; the discussion log (09-DISCUSSION-LOG.md) preserves the original alternatives.

<domain>
## Phase Boundary

Replace the implicit burn-GNUS-on-mint / mint-GNUS-on-withdraw backing model with the **conversion-native model**: every token's supply and balances are denominated in **minions of GNUS**, and moving value between token ids is a *conversion* — a supply-neutral reallocation (`_burn` from one id, `_mint` the same minion amount to another id) — never a burn-to-zero/mint-from-nothing pair.

This fixes the asymmetric backing invariant (CONCERNS #1) **by construction**: converting any token id only ever releases the minions locked in that token's own supply, at its own rate. A holder cannot convert tokens they don't hold, so no unbacked-mint path exists. It also fixes the exchange-rate inconsistency (CONCERNS #2): rates apply **only on read** (display/unit-conversion), never in state transitions — there is no multiplicative redemption path to get wrong.

**Terminology (user-locked):** no "burns" in the economic model. Conversion is reallocation; nothing leaves the GNUS economic system except bridging (true burn/mint across chains — which is what makes cross-chain provenance trackable).

In scope: `convert()` API on a new GNUSTreasury facet, child supply/balances in minions, read-side display functions, `totalSupplyOfAll()` with cross-chain provenance, `nonConvertible` flag, `parentId` struct field + collision guard, depth-gate on mint, MINTER_ROLE mint restricted to id 0, removal of `GNUSBridge.withdraw()` with WR-07 limiter re-homing, global-cap enforcement at tree level, invariant tests. Out of scope: bridge vault (Phase 10), fuller cross-chain supply reconciliation (Phase 12), ERC-20 proxy changes (Phase 11), lifecycle/transfer policy (Phase 13), licensing model (Phase 14).
</domain>

<decisions>
## Locked Decisions

### D1. Conversion-native model — all supplies in minions; NO reserve ledger

Child token supply and balances ARE minions of GNUS. The ERC-1155 accounting for every id is minion-denominated. **There is no reserve apparatus**: no `reserveOf`/`redeemableBacking` mappings, no `issueBacked`, no `depositToReserve`, no surplus-withdrawal policy, no custody/earmark mechanism. The escrow function is served by supply itself: minions locked in a child's supply are the backing, and only holders of that child can convert them out.

- Solvency is identity, not invariant: `supply(0) + Σ child supplies` changes only via root GNUS mint and bridge mint/burn. Child mint and convert are supply-neutral.
- Issuance: `beforeMint` becomes — caller passes a **minion amount**; `require(balanceOf(sender, GNUS_TOKEN_ID) >= amount)`; burn `amount` minions from sender's id-0 balance; mint the SAME `amount` to the child id. The current `convAmount = amount * nft.exchangeRate` multiplication (GNUSNFTFactory.sol:90) is deleted.
- Caller-facing semantics change: `mint()`/`mintBatch()` callers pass minions, not child units. Zero child tokens exist (user-confirmed) — no state migration; tests/scripts whose call semantics change are inventoried in 09-RESEARCH.md §E.

### D2. `exchangeRate` = fixed-point minions per 1 child unit — READ-ONLY

- Denomination is minions of GNUS per 1 child unit at every tree depth. Scale: **1e18** (matches GNUS decimals; 1:1 peg is exactly `1e18`).
- The rate applies **only on read** — display and unit-conversion views. State transitions (mint, convert, transfer) never multiply or divide by it. Rounding/dust exists only in display functions (floor, converter-disfavoring) and never touches stored state.
- Display surface (minimal, on the GNUSTreasury facet): `unitsOf(id, account)`, `totalUnitsOf(id)`, `totalSupplyOfAll()`, `RATE_SCALE` constant. No `minionsOf` alias (balances ARE minions). Views revert on id 0 (GNUS's stored rate is `1` from the `1.0` literal — applying the scale would inflate by 1e18).
- `createNFTs` still takes `exchangeRate` — its meaning is now display-rate-only. Document in the plan.
- Phase 13 D12's "child units per 1 direct-parent unit" framing is superseded. **Phase 13 CONTEXT must be amended.**

### D3. `convert(fromId, toId, minionAmount, to)` — one function, supply-neutral

```solidity
function convert(uint256 fromId, uint256 toId, uint256 minionAmount, address to) external;
```

Mechanics: `_burn(sender, fromId, minionAmount)` + `_mint(to, toId, minionAmount)` — same number in, same number out. No rate math, no rounding, no supply change.

- GNUS-terminal: `toId == GNUS_TOKEN_ID` releases minions back to free circulation.
- GNUS-source: `fromId == GNUS_TOKEN_ID` converts free minions into a child.
- Token-to-token: both non-zero ids; minions move between the two supplies.
- `to` enables settle-on-behalf (contracts, relayers, Phase 13's permissionless `settleExpired`).
- Reverts: `nonConvertible[fromId]` or `nonConvertible[toId]` (when the respective id != GNUS — GNUS itself is always convertible), insufficient sender balance, zero amount, `toId` not created, `toId == fromId`.
- Permissionless, fixed-outcome (Phase 13 D9 convention).
- Max-supply check: the mint leg passes through the existing per-id cap hook (GNUSERC1155MaxSupply.sol:58-63 — now a minion cap, no code change needed). The GNUS-terminal mint leg must NOT be global-cap checked (conversion conserves).

### D4. `GNUSBridge.withdraw()` REMOVED — `convert()` is the only path back to GNUS

- `withdraw(amount, id)` deleted — its burn/mint pair is the CONCERNS #1 vulnerability. Selector removed in the same diamondCut that adds the new facet.
- **WR-07 re-home (verified against hook code):** the `_beforeTokenTransfer` hook exempts mints (`isMinting`, GNUSERC1155MaxSupply.sol:45,50,75). Therefore: `convert()` charges the limiter **explicitly, exactly once, in minions** on the GNUS-terminal leg (`checkAndRecordWithdraw(sender, minionAmount)`), with the super-admin bypass preserved. GNUS→child convert is charged **automatically** by the hook on its burn leg (non-mint id-0 movement) — an explicit charge there would double-charge. Token-to-token converts never touch the limiter.
- `GNUSContractAssets.withdrawToken(token, to, amount)` — admin recovery of wrongly-deposited assets — is a different contract, **untouched**.
- `bridgeOut()`'s limiter charge in GNUS-equivalent terms (CR-03, GNUSBridge.sol ~221-230) uses `amount / exchangeRate` — updated to the fixed-point minion convention: `(amount * exchangeRate) / RATE_SCALE`... under D1/D2, if bridgeOut's `amount` is minion-denominated the division may disappear entirely — **plan verifies against the actual bridgeOut signature**. Phase 10 may supersede.
- **Phase 13 D12 amendment:** `REDEEM_TO_PARENT` settlement calls `convert(id, parentId, amount, account)`.

### D5. `nonConvertible` flag — zero-default FALSE = convertible (opt-out)

- Successor to the original `nonRedeemable` framing — there is no "redemption" in this model, only conversion. Struct field `nonConvertible` (inverted): storage zero-default `false` means every token is convertible by default.
- No migration — no child tokens exist (user-confirmed).
- Burn-only tokens (Phase 13 AI Credits, SOULBOUND allocations) set `nonConvertible = true` at creation. Phase 13 D8's "AI Credits never credit GNUS" is enforced by this flag.
- Flag is immutable after first issuance (prevents converting a convertible token into a confiscation trap post-issuance).

### D6. Depth gate: mint creates direct children only; deeper issuance goes through `convert()`

- `beforeMint` gains: `require((id >> 128) == GNUS_TOKEN_ID, "Direct children only; use convert()")`.
- One issuance tap at depth 1 from free GNUS; everything deeper (grandchild NFTs, sub-allocations, Phase 13 credits under a License NFT) is issued via `convert(parentId, childId, ...)` — making "child supply carved from parent supply" literally true in the accounting.
- **Phase 13 impact:** credit flows under License NFTs use `convert`, not `mint`. Phase 13 CONTEXT amendment covers this.

### D7. Hierarchy gaps: `parentId` struct field + collision guard; NO ID re-encoding

- Add `parentId` to the `NFT` struct in `GNUSNFTFactoryStorage.sol` (append-only). Parent is currently only recoverable via `id >> 128`, which truncates at depth ≥2. Zero-default decodes as parent = GNUS_TOKEN_ID (0), correct for all existing direct children.
- Add `require(!NFTs[newTokenID].nftCreated, ...)` collision guard in `createNFTs`.
- No re-encoding of `(parentID << 128) | childCurIndex++`.
- Struct-append ordering with Phase 13's lifecycle fields: whichever lands second appends after the other (Phase 13 D1 anticipates this).

### D8. Supply views: `totalSupply()` = free GNUS; `totalSupplyOfAll()` = tree-wide + cross-chain provenance

- `totalSupply()` (ERC-20 facade, GNUSBridge.sol:250-251) → `totalSupply(GNUS_TOKEN_ID)` — **free minions not converted into any child**. Unchanged behavior; bridges/exchanges see this.
- ERC-1155 `totalSupply(id)` → minions locked in token id (per-id, unchanged).
- `totalSupplyOfAll()` (NEW, on GNUSTreasury facet) → **global GNUS across all token ids AND all chains** (user requirement: "totalSupplyOfAll should include other chains' provenances, which we will have to have some sort of initialize function set").

**Provenance mechanism (user-approved B1):**
- `GNUSTreasuryStorage.Layout` gains `uint256 globalSupply` + `bool provenanceInitialized`.
- Versioned initializer `GNUSTreasury_Initialize300(uint256 seed)` (DiamondInitFacet.sol:43-57 precedent) seeds the global figure at deployment per chain.
- Bridge maintains it automatically: bridge-out burn decrements nothing (destination's bridge-in mint is the + side); the counter's mutation points are the entry points identified in research §A — `_mintWithBridgeFee` (covers both mint overloads + bridge-in), `burn`, `bridgeOut`. Counter hooks go on entry points, NEVER on `_mint`/`_burn` primitives (double-touch trap).
- Admin-gated `syncGlobalSupply(uint256 newGlobal)` — honesty valve for cross-chain drift (eventual consistency; fuller reconciliation is Phase 12).
- **Uninitialized behavior (user-confirmed):** `totalSupplyOfAll()` **reverts** ("provenance not initialized") until seeded — a missed deploy ritual fails loudly, and the global-cap check (D9) cannot be silently bypassed on an unseeded chain.
- Double-count risks documented in research §B: deploy-time mis-seed (mitigated by the revert) and multi-chain root mints (mitigated by the sync ritual).

### D9. Global cap enforced at tree level

- The 50M GNUS cap check moves to `_mintWithBridgeFee` (the single root/bridge mint entry point), checked against `totalSupplyOfAll()`.
- Convert's GNUS-terminal mint leg is NOT global-cap checked (conversion conserves).
- Per-id `maxSupply[id]` becomes a minion cap — the existing hook (GNUSERC1155MaxSupply.sol:58-63) enforces it unchanged.

### D10. MINTER_ROLE 3-arg mint restricted to id 0

- `GNUSBridge.mint(user, id, amount)` (lines 108-110) can currently mint ANY id — under the conversion-native model that creates minions from nothing (conservation hole). Restrict to `id == GNUS_TOKEN_ID` (bridge-in and root issuance are its legitimate uses; child issuance goes through the factory mint path at depth 1, or `convert` deeper).

### D11. Bridge fee dies with `withdraw()`

- `_mintWithBridgeFee`'s bridge-fee path existed to fee minted GNUS on withdrawal. Under the new model there is no mint-based withdrawal — release ≠ issuance. Convert charges no bridge fee. Verified (research rev 1): `bridgeFee`/`_mintWithBridgeFee` appear only in GNUSBridge, GNUSControl (setter/getter), GNUSControlStorage (field); no hidden dependents. The fee mechanism remains for MINTER_ROLE mints (root/bridge-in) — only the convert path is fee-free.

### Claude's Discretion

- Exact struct field layout/order for `GNUSNFTFactoryStorage.NFT` appends (`parentId`, `nonConvertible`) — coordinated with Phase 13's append list
- `GNUSTreasuryStorage.Layout` field order (`globalSupply`, `provenanceInitialized`)
- Event shapes (`Converted(fromId, toId, minionAmount, to)`, `GlobalSupplySeeded(seed)`, `GlobalSupplySynced(oldGlobal, newGlobal)`)
- Whether `unitsOf`/`totalUnitsOf` revert or return raw on id 0 (research recommends revert)
- Exact revert messages
- Deploy-script wiring for the initializer seed value per chain

</decisions>

<enforcement>
## Enforcement Requirements

1. **Conservation:** Σ supply across all ids changes only via root GNUS mint (`_mintWithBridgeFee` paths) and bridge mint/burn. Proven by invariant/fuzz tests (research §I: I1–I6).
2. **Convert-neutrality:** `convert()` never changes tree-wide supply — supply-before/after assertions across random convert sequences.
3. **Provenance consistency:** `totalSupplyOfAll()` tracks bridge operations correctly (two-diamond fixture in tests); reverts before initialization.
4. `nonConvertible` tokens reject conversion as source and (non-GNUS) destination.
5. Limiter charged exactly once per GNUS-terminal conversion; exactly once (via hook) per GNUS→child conversion; never on token-to-token conversion (charge matrix in research §I6).
6. `nonConvertible` immutable after first issuance.
7. Depth gate: `mint()` reverts for depth ≥2 ids; `convert()` handles them.
8. MINTER_ROLE mint reverts for non-zero ids.
</enforcement>

<security_and_upgrade>
## Security and Upgrade Requirements

1. Storage appends only; existing `NFT` records decode with zero defaults — `parentId = 0` (= GNUS_TOKEN_ID, correct for existing direct children), `nonConvertible = false` (= convertible, intended default). Upgrade test required.
2. `withdraw()` removal is a **breaking selector change** — diamond cut removes the selector; testnet redeploy acceptable (no mainnet). All tests/scripts referencing `withdraw(` updated to `convert()` (blast radius: 5 test files + smart-trigger.ts:389, per research §E).
3. Mint-semantics flip (units → minions) is a **breaking API change** for `mint()`/`mintBatch()` callers — zero on-chain children exist so no state migration, but all test/script callers updated (research §E inventory).
4. Global-supply counter mutations only at the enumerated entry points (research §A) — never in `_mint`/`_burn` primitives.
5. `syncGlobalSupply` is DEFAULT_ADMIN_ROLE-gated and emits an event — it's an honesty valve, not a routine path.
6. No unbounded loops; single-token operations only. `totalSupplyOfAll()` is O(1) (counter + local supply reads), never enumerates children.
7. Full regression: existing GNUS transfer/bridge/ERC-20 facade paths unaffected (ERC-20 `totalSupply()` semantics unchanged).
8. Slither must run on the changed contracts (CONCERNS: slither currently excludes `contracts/gnus-ai/` — flag for Phase 7 audit).
</security_and_upgrade>

<testing>
## Required Test Categories

- Legacy decode: pre-upgrade `NFT` records → `parentId == 0`, `nonConvertible == false`, behaviorally unchanged;
- Issuance: mint direct child with minion amount — id-0 balance decreases by exactly `amount`, child supply increases by exactly `amount`, tree supply unchanged;
- Depth gate: mint at depth ≥2 reverts; same issuance via `convert(parentId, childId, ...)` succeeds with exact conservation;
- `convert` child→GNUS: holder receives exact minions, supply-neutral, limiter charged exactly once, super-admin bypass preserved;
- `convert` GNUS→child: hook charges limiter automatically (no double charge);
- `convert` token-to-token: exact reallocation, no limiter charge, supply-neutral;
- `convert` deep token (grandchild) → GNUS: single hop, no tree-walking, rate never applied in-transition;
- Display: `unitsOf`/`totalUnitsOf` floor correctly; revert on id 0; sub-unit dust never enters stored state;
- Reverts: `nonConvertible` source/destination, insufficient balance, zero amount, uncreated `toId`, `fromId == toId`;
- MINTER_ROLE mint: id 0 succeeds, non-zero id reverts;
- Invariant fuzz (research §I): I1 conservation, I2 convert-neutrality, I3 provenance consistency (two-diamond fixture), I4 free-GNUS identity (single-chain), I5 global cap ≤ 50M, I6 limiter charge matrix;
- `totalSupplyOfAll`: reverts pre-initialization; equals seed + bridge deltas after; `syncGlobalSupply` admin-gated and emits;
- Global cap: root mint reverts beyond 50M tree-wide; convert-to-GNUS never cap-checked;
- `withdraw()` selector removed — diamond loupe shows it gone; old calldata reverts;
- Zero bridge fee on any convert path;
- Phase 13 compatibility: `REDEEM_TO_PARENT`-style settlement via `convert(id, parentId, ...)` round-trip.
</testing>

<dependencies>
## Phase Dependencies

| Phase | Relationship |
|---|---|
| **13 — Entitlements** | **Unblocked by this phase.** Phase 13 D8 (`REDEEM_TO_PARENT`), D9 (permissionless settle), D12 assume this model. **Phase 13 CONTEXT needs amendment**: D12 `withdraw()`→`convert()`; rate framing → read-only display rate (D2); credit issuance under License NFTs → `convert` per depth gate (D6); `nonRedeemable`→`nonConvertible` naming (D5). |
| **10 — Bridge Vault** | D4: `bridgeOut()` limiter math (CR-03) updated to minion convention or superseded by Phase 10 — plan verifies. Bridge burn/mint is the provenance counter's mutation surface (D8). |
| **12 — Supply Ledger** | D8's `globalSupply` + `syncGlobalSupply` is the eventual-consistency seed; Phase 12 owns fuller cross-chain reconciliation. Local conservation (D1) gives it a stable base. |
| **11 — ERC-20 Proxy** | No interaction — proxy wraps the facade; `totalSupply()` semantics unchanged (D8). |
| **7 — Dependency Hardening** | Phase 7's final audit gate is blocked until this phase (and 10–14) complete (Phase 7 D-01). |
| **08.x** | No interaction. |

</dependencies>

<canonical_refs>
## Canonical References

Downstream research, planning, or implementation agents must read:

### Primary design sources

- `.planning/phases/09-per-child-gnus-treasury-reserve/09-RESEARCH.md` — revision 2 (conversion-native model): touch-point enumeration, provenance mechanism, hook analysis, invariant set I1–I6, test migration inventory. **The authoritative technical base for planning.**
- `../.planning/Update-Smart-Contracts-Architecture.md` (TokenContracts root `.planning/`) — original reserve-model rationale and CONCERNS #1–#8 mapping. **Superseded in model, still canonical for concern descriptions.** The conversion-native model resolves CONCERNS #1/#2 by construction rather than by escrow accounting.

### Code being changed

- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — `NFT` struct (append `parentId`, `nonConvertible`; coordinate with Phase 13 appends);
- `contracts/gnus-ai/GNUSNFTFactory.sol` — `beforeMint` (lines 83–94: delete rate multiplication, add depth gate, minion-denominated), `createNFTs` (lines 152–176: collision guard, parentId recording), `mint`/`mintBatch` (caller semantics → minions);
- `contracts/gnus-ai/GNUSBridge.sol` — `withdraw()` (lines 156–186: REMOVED, WR-07 re-home), `bridgeOut()` (~210–235: CR-03 rate math), `_mintWithBridgeFee` (global-cap check added, D9), MINTER_ROLE 3-arg mint (lines 108–110: restrict to id 0, D10);
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` — `_beforeTokenTransfer` (lines 32–85: hook semantics UNCHANGED — research verified the charge matrix works as-is; per-id maxSupply now a minion cap);
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` — `checkAndRecordWithdraw` (explicit charge on GNUS-terminal convert leg);
- `contracts/gnus-ai/GNUSConstants.sol` — GNUS decimals (18), `GNUS_TOKEN_ID = 0`;
- NEW `contracts/gnus-ai/GNUSTreasury.sol` — facet: `convert`, display views, `totalSupplyOfAll`, `syncGlobalSupply`;
- NEW `contracts/gnus-ai/GNUSTreasuryStorage.sol` — Layout: `globalSupply`, `provenanceInitialized` (+ RATE_SCALE constant);
- NEW `contracts/gnus-ai/GNUSTreasury_Initialize300.sol` (or DiamondInitFacet extension) — provenance seed initializer;
- `geniusdiamond.config.json` — facet/selector registration (remove `withdraw`, add new facet).

### Project docs

- `.planning/ROADMAP.md` §Phase 9 (lines 238–259) — goal/success criteria (**superseded**: "gnusReserve/redeemableSupply storage", "redeem() burns child tokens", "mintBackedChild" — the conversion-native model replaces all three; TREASURY-01/02/03 requirement text reinterpreted per research §phase_requirements);
- `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` — D8/D12 dependencies, D1 struct-append coordination, amendment targets;
- `.planning/codebase/CONCERNS.md` — #1 asymmetric backing, #2 exchange-rate math;
- `.planning/private-network-ai.md` — licensing hierarchy context (License → credits trees: credit issuance under licenses uses `convert` per D6).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `_beforeTokenTransfer` hook (GNUSERC1155MaxSupply.sol:32-85) — verified by research to need NO changes: mints exempt from limiter, non-mint id-0 moves charged, per-id maxSupply enforced post-increment. The new model slots into it cleanly;
- `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw` — explicit charge for the GNUS-terminal convert leg;
- `ERC1155SupplyUpgradeable.totalSupply(id)` — per-id minion supply, unchanged;
- DiamondInitFacet versioned-initializer pattern (lines 43–57) — precedent for `GNUSTreasury_Initialize300`;
- Foundry invariant harness (`test/foundry/invariant/`, `GeniusDiamondHandler.sol`) — exists for the I1–I6 fuzz suite.

### Established Patterns

- Diamond storage: keccak256-slotted `Layout` structs, append-only evolution;
- New-facet-per-concern: GNUSTreasury facet estimated 3–5 KB (research §H) — zero EIP-170 pressure;
- `require`-based validation; super-admin bypass convention (limiter);
- Phase 13's permissionless fixed-outcome settlement convention (D9) — `convert` follows it;
- Selector changes in one diamondCut via `geniusdiamond.config.json`.

### Integration Points

- `GNUSNFTFactory.beforeMint` — depth gate + minion-denominated issuance;
- `GNUSBridge` — loses `withdraw()`, gains cap check in `_mintWithBridgeFee`, MINTER restriction, bridgeOut rate math;
- `_mintWithBridgeFee`/`burn`/`bridgeOut` — the provenance counter's mutation points (research §A);
- Phase 13 `_enforceTransferPolicy` / settlement — calls `convert()`;
- Deploy scripts — per-chain provenance seed at initialize.

</code_context>

<specifics>
## Specific Ideas

- "Burn means send to zero address and not usable any more — it's more of a conversion than a burn/mint" — user's terminology lock; the model has no burns except cross-chain bridging;
- "Keep supply(id) in minions — why the multiplier? Only when totalSupply is called will it return the minions supply * rate[id]" — the user insight that collapsed the reserve ledger into read-side display math (D1/D2);
- "totalSupply() should return only the GNUS tokens that aren't in another token, and totalSupplyOfAll() should return the total supply of all tokens — because when we bridge, it does burn and mint, which means we can track provenance also" — D8's view split and the provenance rationale;
- "We will have to have some sort of initialize function set" — the provenance seed requirement that became `GNUSTreasury_Initialize300`;
- Hierarchy example: Parent (company token) → Child (game token, e.g. NeoSpace) → grandchild (NFT) → grand-grandchild (sub-NFT), all minion-denominated — served by depth-1 mint + `convert` everywhere deeper (D6).

</specifics>

<deferred>
## Deferred Ideas

- **Fuller cross-chain supply reconciliation** (per-chain tracking, drift detection) — Phase 12; Phase 9 ships the counter + sync valve (D8);
- **Isolated vaults for high-value children** (original research doc Option B) — moot under the conversion-native model (no custody to isolate);
- **`redeemFromERC20Proxy` adapter** — Phase 11 territory if wanted;
- **Phase 13 CONTEXT amendment** (D12 `withdraw()`→`convert()`, rate framing, credit issuance via `convert`, `nonRedeemable`→`nonConvertible`) — at Phase 13 plan time or as a small docs task once this phase's plan lands;
- **ROADMAP.md Phase 9 success-criteria rewrite** — the listed criteria reference the superseded reserve model; update when the plan lands (planner or a docs task).

</deferred>

---

*Phase: 9-Per-Child GNUS Treasury/Reserve*
*Context gathered: 2026-08-04; amended to conversion-native model: 2026-08-04*
