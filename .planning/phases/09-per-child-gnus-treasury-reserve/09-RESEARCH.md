# Phase 9: Per-Child GNUS Treasury/Reserve - Research

**Researched:** 2026-08-04 (Revision 2 — conversion-native model; supersedes the reserve-ledger revision from earlier the same day)
**Domain:** Diamond-pattern ERC-1155 token economics — minion-native supply, display-only exchange rates, cross-chain supply provenance, facet sizing under EIP-170
**Confidence:** HIGH (every load-bearing claim verified against the actual codebase in this session; the one externally-unverifiable item — the bridge-in relayer flow — is explicitly flagged)

## Conversion-Native Model (Revision 2)

**The pivot.** The user has superseded the Revision-1 escrow-ledger model (CONTEXT D1/D3's `reserveOf`/`redeemableBacking` mappings, `issueBacked`, `depositToReserve`, custody/earmark questions) with a simpler, supply-native model. The revision-2 rules, as directed by the user (do not re-litigate):

1. **There are no "burns" in the economic model.** Conversion is reallocation of minions between token ids. Nothing leaves the GNUS economic system except bridging, which is true burn/mint across chains and provides provenance.
2. **Child balances and supplies are denominated in minions.** `balanceOf(account, id)` and `totalSupply(id)` are minion quantities at every id. `exchangeRate[id]` survives as a fixed-point rate (minions per 1 child unit, 1e18 scale) but applies **only on read** — display/unit-conversion views like `unitsOf(id, account) = balanceOf(account, id) * RATE_SCALE / exchangeRate[id]`. No multiplication in any state transition.
3. **Issuance:** `beforeMint` becomes minion-for-minion: caller passes a minion amount; `require(balanceOf(sender, GNUS_TOKEN_ID) >= amount)`; `_burn(sender, GNUS_TOKEN_ID, amount)`; `_mint(to, id, amount)` — same amount both sides. The multiplication at GNUSNFTFactory.sol:90 (`convAmount = amount * nft.exchangeRate`) dies.
4. **Conversion:** `convert(fromId, toId, minionAmount, to)` = `_burn(sender, fromId, minionAmount)` + `_mint(to, toId, minionAmount)`. Same number in/out. GNUS-terminal is `toId == GNUS_TOKEN_ID`. Rounding/dust exists only in read-side display functions, never in state transitions.
5. **Supply views:**
   - `totalSupply()` (ERC-20 facade, GNUSBridge.sol:250-252) → `totalSupply(GNUS_TOKEN_ID)` — free minions not converted into any child. Unchanged; this is what bridges/exchanges see.
   - `totalSupplyOfAll()` (NEW) → tree-wide GNUS across all ids on this chain **plus other chains' provenance** (see #6).
   - ERC-1155 `totalSupply(id)` → minions locked in token id (per-id, unchanged — ERC1155SupplyUpgradeable.sol:32-34).
6. **Reserve apparatus is DEAD.** No `reserveOf`/`redeemableBacking` mappings, no `issueBacked`, no `depositToReserve`, no surplus withdrawal, no custody/earmark question. CONCERNS #1 dies by construction: converting any id only ever releases the minions locked in that token's own supply — you cannot convert tokens you don't hold (`require(balanceOf(sender, fromId) >= minionAmount)` enforced by `_burn`'s balance check at GNUSBridge.sol:384-388 pattern / ERC1155 `_burn`).
7. **Cross-chain provenance (NEW requirement):** bridging is true burn/mint (`bridgeOut` burns on source; a relayer mints on destination). `totalSupplyOfAll()` must report the global figure across all chains. User direction: "we will have to have some sort of initialize function set." Mechanism proposed in §B below.

**What this does to Revision 1:** D1 (single escrow ledger) is **dead** — there is no ledger because there is nothing to escrow; locked minions ARE the child token's supply. D3's "no burn on convert" survives trivially (convert never touched id 0 under the old proposal either, but now the *issuance* path is also burn/mint-paired at equal amounts — supply-conserving by construction). D2 survives only as a display convention. D4 (withdraw removal), D7 (parentId + collision guard), D8 (`convert(fromId, toId, amount, to)` signature), D10 (limiter re-home) survive with modified semantics. D5/D6 die with the reserve apparatus. D9's rounding concern shrinks to display functions only.

## Summary

Phase 9 replaces the asymmetric burn-GNUS-on-mint / mint-GNUS-on-withdraw backing model with **minion-native conservation**: every balance and supply at every tree depth is denominated in minions of GNUS; minting a child burns the caller's GNUS 1:1 and mints the child 1:1; conversion burns one id and mints another at the same minion amount; `exchangeRate[id]` degenerates to a display-only fixed-point conversion rate for human-facing unit views. The codebase survey confirms the framing: `GNUSNFTFactory.beforeMint()` (lines 83-94) multiplies `amount * nft.exchangeRate` and burns GNUS only for direct children (`(id >> 128) == GNUS_TOKEN_ID`, line 89), while `GNUSBridge.withdraw()` (lines 162-191) divides and mints GNUS for **any** created id — the CONCERNS #1/#2 pair. Under Revision 2 both code paths are rewritten, not patched: the multiplication dies, the division dies, `withdraw()` dies, and the asymmetry question (which ids may be minted against which parent supply) is re-answered as a mint-path rule (§F).

The genuinely new engineering surface is **cross-chain supply provenance** (user requirement #6): a global-supply counter in diamond storage, seeded per-chain at initialize time, maintained by bridge burn/mint hooks, and exposed via `totalSupplyOfAll()`. The existing codebase has **no bridgeIn function** — bridge mint on the destination chain is performed by the MINTER_ROLE `mint()` overloads (GNUSBridge.sol:97-110, the `_mintWithBridgeFee` path) invoked by the relayer. There is no provenance counter anywhere today (grep for `bridgeIn|totalSupplyOfAll|globalSupply` across contracts/ returns nothing). This is greenfield state + hooks on existing mutation points.

Facet placement stays as Revision 1 recommended: a new `GNUSTreasury` facet, but **shrunk** — no reserve mappings, no `issueBacked`/`depositToReserve`, just `convert()`, display views (`unitsOf`, `totalUnitsOf`), `totalSupplyOfAll()`, the rate-scale constant, and the provenance counter storage + setter/initializer. GNUSNFTFactory is at 23,069 bytes of the 24,576-byte EIP-170 budget (1,507 bytes headroom) [VERIFIED: artifact measured this session] and cannot host the new code; GNUSBridge (18,872 bytes; 5,704 headroom) must absorb the provenance updates on its mint/burn/bridgeOut paths.

**Primary recommendation:** New `GNUSTreasury` facet + slim `GNUSTreasuryStorage.sol` library (global-supply counter + RATE_SCALE constant); rewrite `beforeMint` to minion-for-minion burn/mint; add `convert(fromId, toId, minionAmount, to)`; delete `withdraw()`; add `totalSupplyOfAll()` + `syncGlobalSupply()` provenance hooks on the MINTER_ROLE mint/burn and bridgeOut paths; display views `unitsOf`/`totalUnitsOf` read-only with floor rounding; `maxSupply[id]` reinterpreted as a per-id minion cap (no code change — semantics only, §C); global cap enforced against `totalSupplyOfAll` on root mint/bridge mint only.

<user_constraints>
## User Constraints (from CONTEXT.md + Revision-2 user direction)

> CONTEXT.md D1-D10 below are the Revision-1 locked decisions. The Revision-2 user pivot (this section, top) **supersedes D1, D3, D5, D6** and **modifies D2, D9** as annotated. D4, D7, D8, D10 stand with the noted semantic adjustments. The planner must treat the Revision-2 model section above as the controlling spec; D-numbers below are retained for traceability.

### Locked Decisions

**D1. ~~Single escrow ledger~~ — SUPERSEDED (Revision 2).** No `reserveOf`/`redeemableBacking` mappings. Locked minions are the child token's own supply (`ERC1155SupplyStorage._totalSupply[id]`); there is no separate escrow accounting. Solvency invariant is vacuous: conversion can only release minions the converter provably holds.

**D2. `exchangeRate` = fixed-point minions per 1 child unit — DISPLAY-ONLY (modified by Revision 2).** Fixed-point scaled integer at 1e18 scale, stored on the `NFT` struct as today, set at `createNFTs` time. Applies only in read-side unit-conversion views (`unitsOf`, `totalUnitsOf`). Never multiplied or divided in any state transition. Phase 13 D12's "child units per 1 direct-parent unit" framing remains superseded.

**D3. ~~Conversion is ledger reallocation~~ — SUPERSEDED (Revision 2): conversion is minion reallocation via supply.** `convert(fromId, toId, minionAmount, to)` = `_burn(sender, fromId, minionAmount)` + `_mint(to, toId, minionAmount)`. Same minion count in and out; tree-wide supply (`Σ_id totalSupply(id)`) is invariant under convert. GNUS-terminal conversion (`toId == GNUS_TOKEN_ID`) burns child minions and mints free GNUS minions. Nothing is stored "as claims" — supply IS the claim.

**D4. `GNUSBridge.withdraw()` REMOVED — `convert()` is the only redemption path.** Unchanged from Revision 1. `withdraw(amount, id)` (GNUSBridge.sol:162-191) deleted; WR-07 one-charge invariant re-homed onto the GNUS-terminal leg of `convert()` (charge once, in minions; super-admin bypass preserved). `GNUSContractAssets.withdrawToken` untouched. Phase 13 D12 amendment (`REDEEM_TO_PARENT` → `convert(id, parentId, amount, account)`) unchanged. `bridgeOut()`'s CR-03 limiter charge (GNUSBridge.sol:221-230) — see §C: under minion-native semantics the limiter charge for child bridging is just `amount` (it already IS minions); the `/ exchangeRate` division dies.

**D5. ~~`nonRedeemable` flag~~ — SUPERSEDED (Revision 2) pending user confirmation.** The flag existed to gate the reserve-redemption path; with no reserve, "redeemability" is just "can this id be a convert from/to-leg," which is inherent (you can always convert what you hold). If Phase 13 still needs burn-only semantics for AI Credits/SOULBOUND, a `nonConvertible` flag on the NFT struct (checked in `convert`, not in `mint`) preserves the intent. **Flag for plan-time user checkpoint.**

**D6. ~~`depositToReserve`~~ — SUPERSEDED (Revision 2).** No reserve, no deposits, no surplus-withdrawal question. Open Question 1 from Revision 1 is moot.

**D7. Hierarchy gaps: `parentId` struct field + collision guard; NO ID re-encoding.** Unchanged. Add `parentId` to the `NFT` struct (append-only); zero-default decodes as parent = GNUS_TOKEN_ID; add `require(!NFTs[newTokenID].nftCreated, ...)` in `createNFTs` (GNUSNFTFactory.sol:152-181). Struct-append ordering with Phase 13 stands.

**D8. API: `convert(fromId, toId, minionAmount, to)` — one function.** Signature unchanged; `amount` is now unambiguously **minions** (Revision 2 #4). GNUS-terminal when `toId == GNUS_TOKEN_ID`. Reverts: uncreated id(s), `fromId == toId`, zero amount, insufficient sender balance (via `_burn`). Permissionless, fixed-outcome. **`issueBacked` is dead** — issuance goes through the rewritten `mint()`/`mintBatch()` (minion-for-minion).

**D9. Rounding: floor, dust permitted — display-side only (modified by Revision 2).** State transitions are integer-exact minion moves; there is nothing to round. Floor rounding (reader-disfavoring) applies only inside `unitsOf`/`totalUnitsOf` display views.

**D10. Limiter + fee preservation.** WR-07 one-charge invariant and super-admin bypass re-home to the GNUS-terminal leg of `convert()` — **explicit charge in `convert()`** (see §G for why the hook does not cover it). `_mintWithBridgeFee` survives only for MINTER_ROLE mints (bridge-in relayer path); convert never touches it. Bridge fee on conversion is dead by construction (no fee hook on the convert path).

### Claude's Discretion

- Display-view set and names (`unitsOf`, `totalUnitsOf` — §D)
- Exact struct field layout/order for `NFT` appends (`parentId`; possibly `nonConvertible` pending D5 checkpoint) — coordinated with Phase 13's append list
- Provenance mechanism details: storage slot, setter gating, initialize signature (§B)
- Whether `convert()` + views live on a new `GNUSTreasury` facet (recommended) — GNUSNFTFactory has only 1,507 bytes headroom
- Event shapes (`Converted(fromId, toId, minionAmount, to)`, `GlobalSupplySynced(chainId, newTotal, ...)`)
- Storage library name/location (new `GNUSTreasuryStorage.sol` recommended)
- `mint()` behavior for depth ≥2 ids (§F) — recommended rule given, needs user sign-off at plan time

### Deferred Ideas (OUT OF SCOPE)

- `nonConvertible` flag (D5 successor) — plan-time user checkpoint
- Isolated vaults for high-value children — future hardening
- `redeemFromERC20Proxy` adapter — Phase 11 territory
- Cross-chain treasury mirroring beyond the provenance counter (full per-chain supply ledger) — Phase 12
- Phase 13 CONTEXT amendment (D12 `withdraw()`→`convert()`, rate framing) — at Phase 13 plan time
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREASURY-01 | ~~Per-child GNUS reserve backing model~~ → Minion-native supply conservation (no reserve state) | §Conversion-Native Model; §Architecture Patterns (beforeMint rewrite); §Code Examples |
| TREASURY-02 | ~~Backed issuance path~~ → Minion-for-minion issuance via rewritten `mint()`/`mintBatch()` | §Architecture Patterns (Pattern 2); §Common Pitfalls (P1); §A |
| TREASURY-03 | Redemption via `convert()` — supply reallocation, conservation invariant enforced | §Architecture Patterns (Pattern 3); §Code Examples (convert sketch); §Validation Architecture (invariant/fuzz tests); §G |

Plus Revision-2 additions the planner must treat as requirements:

| ID | Description | Research Support |
|----|-------------|------------------|
| TREASURY-04 (new) | `totalSupplyOfAll()` — global tree-wide supply incl. cross-chain provenance; initialize/setter + bridge hooks | §B; §Code Examples (provenance sketch); §Common Pitfalls (P5) |
| TREASURY-05 (new) | Display-only unit views (`unitsOf`, `totalUnitsOf`) at 1e18 rate scale | §D; §Code Examples |

Note: TREASURY-01/02/03 appear only in ROADMAP.md (line 27, 251) — not yet enumerated in REQUIREMENTS.md. The planner should treat the ROADMAP Phase 9 success criteria (lines 242-249) as the requirement text, **as superseded by the Revision-2 model above**.
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Conversion execution (`convert`) | New GNUSTreasury facet | — | GNUSNFTFactory at 23,069/24,576 B (EIP-170); GNUSBridge cohesion already poor; new facet = clean audit surface [VERIFIED: artifact sizes this session] |
| Child issuance (`mint`/`mintBatch` rewrite) | GNUSNFTFactory (edited in place) | — | `beforeMint` lives there (lines 83-94); the rewrite *removes* bytes (drops the rate multiplication + conditional), net-negative size impact |
| Display unit views (`unitsOf`, `totalUnitsOf`) | New GNUSTreasury facet | — | Read-only; co-located with RATE_SCALE and convert |
| Global supply provenance counter (storage + views) | New GNUSTreasuryStorage library + GNUSTreasury facet | DiamondInitFacet (initialize hook) | New keccak256-slotted Layout; initializer follows the versioned-initializer pattern (DiamondInitFacet.sol:43-57) |
| Provenance mutation hooks (root mint/burn, bridge mint, bridgeOut) | GNUSBridge (edited in place) | GNUSTreasuryStorage (counter field) | The mutation points live in GNUSBridge (`mint`×2, `burn`, `bridgeOut`); counter updates must happen exactly there |
| Token metadata (`parentId` field; collision guard) | GNUSNFTFactoryStorage.NFT struct append | GNUSNFTFactory.createNFTs | D7: struct fields live where the struct lives |
| Withdraw-limit charging (WR-07) | GNUSWithdrawLimiterStorage (unchanged) | GNUSTreasury facet (explicit call on GNUS-terminal convert leg) | §G: convert's GNUS leg is a mint → hook exempt → explicit charge required |
| Cross-chain bridging (`bridgeOut`) | GNUSBridge (unchanged home) | Provenance decrement; limiter math simplifies to `amount` (minions) | §C/§B |
| Admin asset recovery (`withdrawToken`) | GNUSContractAssets (untouched) | — | Different contract, different purpose |
| Per-id max supply enforcement | GNUSERC1155MaxSupply hook (unchanged code) | — | §C: hook already enforces `maxSupply[id]` on every mint; semantics reinterpret as minion cap, no code change |

## Revision-2 Research Questions (A–I)

### A. Touch points for `totalSupplyOfAll`

Every code path that changes total minions across all ids on this chain (local tree supply), with file/line evidence [all VERIFIED this session]:

| Path | Location | Supply effect | Provenance effect |
|------|----------|---------------|-------------------|
| Root GNUS mint (ERC-20 facade) | `GNUSBridge.mint(address,uint256)` line 97-99 → `_mintWithBridgeFee` → `_mint` | +amount to id 0 | **+amount global** (new minions enter the system) |
| Root/any-id mint (MINTER_ROLE) | `GNUSBridge.mint(address,uint256,uint256)` line 108-110 | +amount to any id | This overload can mint **child ids directly** — see warning below |
| Root GNUS burn | `GNUSBridge.burn(address,uint256)` line 118-121 | −amount id 0 | **−amount global** (true destruction — is this used? It's MINTER_ROLE-gated admin burn) |
| Bridge out | `GNUSBridge.bridgeOut` line 203-242 (`_burn` at line 232) | −amount from id | **−amount global** (leaves to another chain) |
| Bridge in | **No `bridgeIn` exists** [VERIFIED: grep]. Destination-chain mint = relayer calls `mint(user, tokenID, amount)` (line 108) with MINTER_ROLE | +amount | **+amount global** — indistinguishable on-chain from fresh issuance (see §B risk) |
| Child mint via factory | `GNUSNFTFactory.mint/mintBatch` → `beforeMint` (83-94) + `_mint` | burn id 0, mint id — **supply-neutral tree-wide** | none |
| `convert` (new) | GNUSTreasury | burn fromId, mint toId — **supply-neutral tree-wide** | none |
| ERC20TransferBatch | ERC20TransferBatch.sol:87 references `maxSupply[0]` | transfers only — supply-neutral | none |

**Warning (planner must surface):** the MINTER_ROLE 3-arg `mint(user, tokenID, amount)` overload can mint **child ids out of thin air** (no burn paired). Under the conservation model this is a conservation-breaking path for any id ≠ 0. Recommended Phase 9 change: restrict that overload to `tokenID == GNUS_TOKEN_ID` (bridge-in and root issuance), or delete it and let bridge-in use the 2-arg form. This is a one-line `require`. Flag as plan-time decision.

**Minimal mutation set for a global counter vs. computing from storage:** computing `Σ_id totalSupply(id)` on read is impossible on-chain (mapping iteration). A counter updated on the five paths above is the only viable mechanism. The counter equals local tree supply by construction if every `_mint`/`_burn` of **id 0 via MINTER_ROLE** and every `bridgeOut` updates it — child mint/convert are self-neutral and need no hook. Simplest correct placement: update the counter inside `_mintWithBridgeFee` (covers both mint overloads + bridge-in), inside `burn()`, and inside `bridgeOut()`. Do NOT hook the generic `_mint`/`_burn` — factory mint/convert would double-touch it (they burn id 0 and mint id k in the same tx; the net is zero but two counter updates per op is wasted gas and audit noise). **Counter updates belong on the supply-changing entry points, not the primitives.**

### B. Cross-chain provenance mechanism

**Requirement:** `totalSupplyOfAll()` must equal tree-wide GNUS across **all chains**. Bridging is true burn/mint. Each chain must know the global figure. User: "we will have to have some sort of initialize function set."

**What exists today:** nothing. No provenance counter, no bridgeIn, no cross-chain supply reads. `GNUSControlStorage.layout().chainID` identifies the local chain (GNUSControl.sol:176-178, 186-190). Deployments exist on 9 chains (diamonds/GeniusDiamond/deployments/*.json — mainnet, sepolia, base, base_sepolia, bsc, bsc_testnet, polygon, polygon_amoy, mumbai).

**Proposed mechanism (single counter, net-flow model):**

```solidity
// GNUSTreasuryStorage.sol — NEW library
library GNUSTreasuryStorage {
    struct Layout {
        uint256 globalMintedSupply;   // cumulative minions ever minted into existence (root mints + bridge-ins), minus admin burns
        uint256 netBridgedOut;        // cumulative (bridged out) − (bridged in) for THIS chain
        bool provenanceInitialized;   // guards one-time initialize
    }
    bytes32 constant GNUS_TREASURY_STORAGE_POSITION = keccak256("gnus.ai.treasury.storage");
    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_TREASURY_STORAGE_POSITION;
        assembly { l.slot := slot }
    }
}
```

**Semantics:**
- `totalSupplyOfAll() = globalMintedSupply − netBridgedOut` — the global figure as seen from this chain.
- Wait — that only works if `globalMintedSupply` is itself global. Two sub-designs, and the planner must pick at plan time:

  - **B1 (recommended): Global mint counter, seeded at deploy, synced on bridge.** `globalMintedSupply` represents *cumulative genesis-equivalent minions in the whole system*. Chain A (first deploy) initializes it to 0 (or genesis amount). Every root mint anywhere increments it **on that chain's copy**. Bridges do NOT touch it (bridge moves existing minions; global total unchanged). Then `totalSupplyOfAll() = globalMintedSupply − totalAdminBurned` and the ONLY consistency problem is: root mints on chain B don't show up on chain A until synced. **If root minting is restricted to one chain (or one minter with an off-chain sync ritual), this collapses to a single counter + occasional admin sync.** This matches the user's "initialize function set" intuition: deploy-time `initializeGlobalSupply(uint256 seed)` sets the starting figure so a chain deployed later starts from the then-current global number rather than zero.
  - **B2: Per-chain local supply + remote-sync.** `totalSupplyOfAll() = localTreeSupply + remoteChainsSupply`, where `remoteChainsSupply` is an admin-synced figure updated on every bridge event (relayer carries the update cross-chain). More moving parts, more double-count risk.

**Recommendation: B1**, with these concrete pieces:

1. **Storage:** `GNUSTreasuryStorage.Layout` above, minus `netBridgedOut` (B1 doesn't need it): just `uint256 globalSupply; bool provenanceInitialized;`.
2. **Initialize:** `GNUSTreasury_Initialize300(uint256 seedGlobalSupply)` — versioned initializer per the established pattern (DiamondInitFacet.sol:43-57 names initializers per version, e.g. `diamondInitialize250`; GNUSNFTFactory has `GNUSNFTFactory_Initialize230`). `onlySuperAdminRole`, guarded by `require(!provenanceInitialized)`, sets `globalSupply = seedGlobalSupply; provenanceInitialized = true;`. First chain seeds 0 (or the genesis mint schedule); later chains seed the then-current global figure communicated off-chain.
3. **Hook points (each ±amount on `globalSupply`):**
   - `_mintWithBridgeFee` (GNUSBridge.sol:77-89): **+amount** — covers 2-arg root mint, 3-arg MINTER mint (bridge-in), all fresh issuance. NOTE: use the pre-fee `amount` argument, not the post-fee reduced value — the fee portion is simply never minted (see caveat below).
   - `burn(address,uint256)` (GNUSBridge.sol:118-121): **−amount** — admin destruction.
   - Factory `mint`/`mintBatch` and `convert`: **no touch** (supply-neutral).
   - `bridgeOut`: **no touch under B1** — bridging conserves global supply (burn here, mint there; the + on the destination happens in its `_mintWithBridgeFee`). This is the key simplification over B2.
4. **Bridge-fee caveat (planner must resolve):** `_mintWithBridgeFee` mints `amount * (1000 - fee)/1000` — the fee portion vanishes (never minted anywhere; it's a haircut, not a redistribution). Under B1, increment `globalSupply` by the **post-fee** minted amount (`amount` after line 85's adjustment), because that's what actually enters existence. Otherwise the global figure drifts high on every bridge-in with nonzero fee.
5. **Role-gated sync (the honesty valve):** `syncGlobalSupply(uint256 newGlobal)` — `onlyRole(DEFAULT_ADMIN_ROLE)` (or super-admin), emits `GlobalSupplySynced(oldGlobal, newGlobal, msg.sender)`. This is the user's "initialize function set" generalized: the escape hatch for cross-chain drift when root mints happen on multiple chains. Every call is an auditable event.
6. **View:** `totalSupplyOfAll() external view returns (uint256)` → `globalSupply`.

**Double-count risks (explicitly flagged per the task):**
- **Deploy-time double-count:** if chain B is deployed after chain A already has supply S, B must initialize with `seedGlobalSupply = S` (the global figure), NOT 0 — and must not then count A's pre-existing supply again via bridge-ins. Under B1 this is automatic: bridge-in increments by the minted amount, which exactly offsets the bridge-out burn on A... but A's counter never decremented (B1 doesn't touch bridgeOut). **This is the one real flaw in naive B1:** bridge-out on A leaves A's `globalSupply` unchanged (correct — global supply didn't change), and bridge-in on B increments B's copy (correct — same reasoning). Both chains converge to the same figure only if they started in sync and every root mint/admin burn is synced. Bridge events require no sync. Root mints on multiple chains require sync. **Mitigation:** restrict MINTER_ROLE to one canonical issuance chain operationally, or accept `syncGlobalSupply` rituals. Document in plan.
- **Alternative conservative framing (B1′):** define `totalSupplyOfAll()` as *this chain's best knowledge of the global figure*, explicitly eventually-consistent, with the sync function as the coordination mechanism. For the stated consumer (cap enforcement §C + display), eventual consistency with admin sync is acceptable; flag for user confirmation.

**Relationship to Phase 12 (Cross-Chain Supply Ledger):** Phase 12 plans full per-token, per-chain supply tracking. Phase 9's counter is the minimal seed of that — a single global figure. Phase 12 can replace/extend the storage (append per-chain mapping) without breaking Phase 9 consumers if `totalSupplyOfAll()`'s semantics are preserved. Note the dependency direction: Phase 9 now lands a piece of Phase 12's scope early because the cap check (§C) needs it.

### C. Max-supply / cap enforcement under the new model

**What exists today [VERIFIED this session]:**
- Per-id cap: `GNUSERC1155MaxSupply._beforeTokenTransfer` lines 58-63 — on mint (`from == address(0)`), requires `totalSupply(id) <= NFTs[id].maxSupply`. Note the ordering: `super._beforeTokenTransfer` (line 41) runs first and ERC1155SupplyUpgradeable increments `_totalSupply[id]` on mint *before* this check, so the check is post-increment — correctly rejects any mint that would push supply over the cap. `<=` allows minting exactly to the cap.
- GNUS global cap: `GNUSConstants.sol:21` — `GNUS_MAX_SUPPLY = 50,000,000 × 1e18`, stored as `NFTs[0].maxSupply` at creation (GNUSNFTFactory.sol:34). Enforced **only** by the same hook on id-0 mints.
- Batch path: ERC20TransferBatch.sol:87 checks `newSupply <= NFTs[GNUS_TOKEN_ID].maxSupply` on its own mint path.

**Under Revision 2:**

1. **Per-id `maxSupply[id]` becomes a minion cap for that id.** No code change needed — the hook at lines 58-63 already enforces it on every mint, and mints of id k now take minion amounts directly. Semantics-only change; document. (`maxSupply[0]` stays 50M minions of free GNUS.)
2. **Convert's to-leg is a mint → the per-id cap check fires automatically.** Convert burns fromId first (supply down) then mints toId (cap check on toId). Correct placement already; nothing moves. One nuance: GNUS-terminal convert mints id 0, so `totalSupply(0)` must be ≤ 50M at that moment. Under conservation, `totalSupply(0) = globalSupply − Σ_children totalSupply(id) ≤ globalSupply ≤ 50M` — the check can only fail if the global cap was already exceeded elsewhere. **Verify in tests (invariant I4 below).**
3. **The global cap moves off per-id storage in spirit.** Today the 50M cap on free GNUS (id 0) is not a tree-wide cap: child mints *reduce* `totalSupply(0)` (they burn id 0), so the id-0 hook never sees the tree-wide figure. Under Revision 2 the system-wide invariant is `totalSupplyOfAll() ≤ GNUS_MAX_SUPPLY`. Enforcement points:
   - **Root GNUS mint / bridge-in mint (`_mintWithBridgeFee`):** add `require(globalSupply + mintedAmount <= GNUS_MAX_SUPPLY, ...)` alongside the counter increment. This is the only place the global figure grows.
   - **Admin burn / bridgeOut:** decrease or conserve — no check needed.
   - **Child mint / convert:** supply-neutral — no check needed.
   - Should the check use the synced global figure (B1)? Yes — that's the entire point of the provenance counter; without it, chain B could mint past the global cap while chain A's supply already consumed it. Eventual-consistency caveat from §B applies: the cap is only as fresh as the last sync. Acceptable for a 50M cap with admin-gated minting; **flag for user confirmation.**
4. **Hook placement decision:** the global check can go (a) inside `_mintWithBridgeFee` (one place, covers all fresh issuance), or (b) in the `_beforeTokenTransfer` hook for id-0 mints (would also catch convert-to-GNUS mints, which must NOT be cap-checked against the global figure since convert conserves). **Choose (a)** — the hook can't distinguish convert's conservation-neutral id-0 mint from fresh issuance without extra context.

### D. Display-function surface

Recommended minimal, non-redundant set (all on GNUSTreasury, all view):

| Function | Formula | Purpose |
|----------|---------|---------|
| `unitsOf(uint256 id, address account) → uint256` | `balanceOf(account, id) * RATE_SCALE / exchangeRate[id]` (floor) | Human-facing child-unit balance |
| `totalUnitsOf(uint256 id) → uint256` | `totalSupply(id) * RATE_SCALE / exchangeRate[id]` (floor) | Human-facing child-unit supply |
| `totalSupplyOfAll() → uint256` | `globalSupply` (§B) | Global tree-wide minions incl. provenance |
| `RATE_SCALE() → uint256` (constant getter optional) | `1e18` | Off-chain consumers need the scale convention |

**Deliberately excluded (non-redundancy):** no `minionsOf` alias — `balanceOf(account, id)` already IS minions; an alias invites the dual-unit confusion the model exists to kill. No on-chain convert-quote function that multiplies rates — conversion is 1:1 minions, nothing to quote. `exchangeRate(id)` is already readable via the existing `getNFTInfo(id)` (GNUSNFTFactory.sol:187-190).

**RATE_SCALE = 1e18** [carried from Revision 1, rationale unchanged]: GNUS is 18-decimal (GNUSConstants.sol:17, GNUSBridge.sol:26), so a 1:1 child pegs at exactly `1e18`; sub-unit rates get full precision; matches WAD convention. For id 0 (`exchangeRate = 1` stored via the `1.0` literal at GNUSNFTFactory.sol:34, truncating to 1), `unitsOf(0, acct)` would compute `balance * 1e18 / 1` — wrong by 1e18. **Guard:** views revert or special-case `id == GNUS_TOKEN_ID` (units of GNUS are ill-defined; GNUS is the minion unit itself). Planner: revert with a clear message.

### E. Migration impact on the existing mint path

**Semantics change:** `mint(to, id, amount, data)` callers previously passed **child units** and paid `units × exchangeRate` minions (beforeMint lines 89-93). Post-Phase 9 they pass **minions directly** and pay exactly `amount`. Zero child tokens exist on any deployment (user-confirmed), so no state migration — only caller semantics.

**Caller inventory [VERIFIED: grep this session]:**

| Caller | File:lines | Change needed |
|--------|-----------|---------------|
| NFTFactory.test.ts | 173, 297, 364, 407, 458 (5-arg `mint(address,uint256,uint256,bytes)`) | Amount semantics flip: previously child units priced via `exchRate` (tests create children with rates like 2, 10); now pass minions. Assertions on GNUS balance deltas change from `units*rate` to `amount`. Assertions on child balances change from `units` to `minions` (numerically different when rate ≠ 1). |
| GNUSNFTFactoryEnhanced.test.ts | 339, 359, 376, 390, 411, 417, 431, 435, 474 | Same flip; this file also asserts the burn behavior (e.g. "Not enough GNUS_TOKEN to burn" revert paths at 376, 390) — revert messages/conditions need review. |
| 2nd-gen tests (NFTFactory.test.ts:371-375, 522-525 per REQUIREMENTS.md line 149) | deeper-id mints | These assert the current no-burn behavior for 2nd-gen mints — the assertion target changes per §F's rule. |
| scripts/devops/smart-trigger.ts:389 | references `'mint'` selector | Verify which overload; update calldata semantics if it passes child units. |
| Foundry handlers (test/foundry/handlers/GeniusDiamondHandler.sol) | mint actions | Amount semantics in fuzz handlers; invariant assertions updated per §I. |

**`createNFTs` unchanged but re-documented:** still takes `exchRates[]` (GNUSNFTFactory.sol:152) and stores them on the struct (line 172). The field's meaning is now **display-rate-only** (minions per 1 child unit, 1e18 scale, used exclusively by `unitsOf`/`totalUnitsOf`). The `require(exchRates[i] > 0)` guard at line 166 stays (a zero display rate would divide-by-zero in views). Rename consideration: renaming the struct field/param to `displayRate` is a breaking struct-layout NO-OP (field order unchanged) but a source-level churn — recommend keeping the name `exchangeRate` with updated NatSpec (`GNUSNFTFactoryStorage.sol:14` comment "Exchange rate for withdrawing to GNUS" is now wrong — update to "Display-only fixed-point rate: minions per 1 child unit, 1e18 scale"). Plan-time call.

### F. Mint-path rule for depth ≥2 (the CONCERNS #1-adjacent question, re-answered)

**Current code:** `beforeMint` burns GNUS only when `(id >> 128) == GNUS_TOKEN_ID` (line 89) — direct children. Deeper descendants mint free (the 2nd-gen no-burn behavior documented in Phase 6 D-02 / REQUIREMENTS.md:149).

**Under the conservation model,** minting id k requires burning `amount` minions of *something*. Options:

1. **Burn GNUS for any depth (extend the line-89 condition to all ids):** minting a grandchild burns the minter's free GNUS. Conservation holds (Σ unchanged), but the *tree semantics* break: a grandchild's minions are no longer reachable by converting its parent — parent's supply doesn't back them. Converting parent→GNUS releases only parent's own supply; the grandchild's minions are separately GNUS-backed. Nothing is *insolvent* (you can only convert what you hold), but the mental model "child supply is carved from parent supply" is violated — the tree becomes flat GNUS-backed with decorative hierarchy.
2. **Burn parent-id supply for depth ≥2:** minting a grandchild burns the minter's balance of the parent child-token. This is exactly `convert(parentId, grandchildId, amount, to)` — **which already exists** as Phase 9's convert. A separate mint path for depth ≥2 that burns parent supply is a less-general duplicate of convert.
3. **Revert depth ≥2 mints; delegate to convert (RECOMMENDED):** `beforeMint` becomes: `require((id >> 128) == GNUS_TOKEN_ID, "Mint direct children only; use convert() for deeper descendants")` — wait, more precisely: direct-child mint burns GNUS (the issuance tap into the tree); all deeper issuance goes through `convert(parentId, childId, ...)` which the parent holder (typically the parent creator) invokes. This gives one issuance rule ("new minions enter the tree only from free GNUS, only at depth 1") and one reallocation rule ("everything deeper is convert"), keeps conservation by construction at every level, and makes the tree semantics exact: every descendant's supply is transitively carved out of GNUS via its ancestors' conversions.

**Recommendation: option 3**, with the precise `beforeMint` rewrite:

```solidity
function beforeMint(address to, uint256 id, NFT storage nft, uint256 amount) internal {
    address sender = _msgSender();
    require(id != GNUS_TOKEN_ID, "Use MINTER_ROLE mint for GNUS");
    require(to != address(0), "ERC1155: mint to the zero address");
    require(nft.nftCreated, "Cannot mint NFT that doesn't exist");
    require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Creator or Admin can only mint NFT");
    require((id >> 128) == GNUS_TOKEN_ID, "Direct children only; use convert() for descendants");
    require(balanceOf(sender, GNUS_TOKEN_ID) >= amount, "Not enough GNUS_TOKEN to convert");
    _burn(sender, GNUS_TOKEN_ID, amount);   // amount IS minions (Revision 2)
}
```

Note this also *preserves* the line-89 check's position (direct children) while killing the multiplication — the "which ids" answer matches today's gate, but now by design (deeper = convert) rather than by omission (deeper = free). **Caveat for the planner:** `createNFTs` builds deeper ids via `childCurIndex` on any parent (GNUSNFTFactory.sol:152-181) — token *creation* at any depth is unaffected; only *minting* is depth-gated. The `childCurIndex`-based id scheme and Phase 13/14 trees (License → credits → sub-allocations) work unchanged: credits are issued by `convert(licenseId, creditsId, ...)`. **User sign-off needed at plan time** (Claude's-discretion item): Phase 13's entitlement flows must be checked against "deeper issuance = convert only."

### G. WR-07 limiter re-home — verification in the new model

**Confirmed: exactly one explicit charge, inside `convert()`, on the GNUS-terminal leg only.** Evidence chain [all VERIFIED this session]:

1. The hook at GNUSERC1155MaxSupply.sol:44-52 aggregates `totalGNUSAmount` only when `!isMinting` (line 45: `bool isMinting = from == address(0)`; line 50: `if (!isMinting && id == GNUS_TOKEN_ID)`).
2. Convert's GNUS-terminal leg is `_mint(to, GNUS_TOKEN_ID, minionAmount)` — `from == address(0)` → `isMinting == true` → the limiter block at lines 75-84 is **skipped**. The mint is hook-exempt.
3. Convert's from-leg `_burn(sender, fromId, minionAmount)`: if `fromId != GNUS_TOKEN_ID`, the hook runs (burn is non-mint) but `id != GNUS_TOKEN_ID` contributes nothing to `totalGNUSAmount` (line 50's `id == GNUS_TOKEN_ID` filter) → no charge. If `fromId == GNUS_TOKEN_ID` (convert GNUS→child), the `_burn` of id 0 **does** route through the hook and **does** charge the limiter on the burn leg.
4. The WR-07 comment at lines 66-69 says paths that route through the hook must NOT add explicit charges. Convert's GNUS-terminal leg does NOT route through the hook (mint exemption), so an explicit charge is required and is not a double-charge.

**Resulting rule:**
- `convert(childId → GNUS_TOKEN_ID)`: burn leg = child id (no hook charge); mint leg = id 0 mint (hook-exempt) → **explicit `checkAndRecordWithdraw(sender, minionAmount)` in convert, once** (super-admin bypass + `SuperAdminBypass` event with `"GNUSTreasury.convert"` context string, mirroring GNUSBridge.sol:181-187).
- `convert(GNUS_TOKEN_ID → childId)`: burn leg = id 0 (hook charges automatically); mint leg = child mint (exempt) → **no explicit charge** — hook already charged. (Semantically fine: moving free GNUS into a child is a "withdrawal-like" outflow of free minions; keeping the hook charge preserves today's limiter coverage of all id-0 outflows. Flag as plan-time confirmation — if the user considers child-issuance-not-a-withdrawal, this leg needs a hook exemption instead, which is more invasive. Recommend keeping the hook charge: limiter conservatism is safer.)
- `convert(childA → childB)`: no id-0 movement → no charge, correct.

### H. Facet/storage placement — re-confirmed and shrunk

Revision 1's recommendation holds and shrinks [VERIFIED: artifact bytecode re-measured this session]:

| Contract | Deployed bytecode | EIP-170 headroom | Revision-2 impact |
|----------|------------------|------------------|-------------------|
| GNUSNFTFactory | 23,069 B | 1,507 B | `beforeMint` rewrite removes the rate multiplication (net-negative or neutral); `createNFTs` gains collision guard + parentId recording (~+100 B est.) — still fits, tight. |
| GNUSBridge | 18,872 B | 5,704 B | `withdraw()` deleted (−~700 B est.); `bridgeOut` limiter math simplifies (division dies); provenance hooks added to `_mintWithBridgeFee`/`burn` (+~300 B est.) — comfortably fits. |
| GNUSTreasury (NEW) | est. 3-5 KB | n/a (new) | `convert` + `unitsOf`/`totalUnitsOf` + `totalSupplyOfAll` + `syncGlobalSupply` + initializer + events/errors. Comparable to GNUSControl (7,287 B) — far under budget. |
| GNUSTreasuryStorage (NEW lib) | ~0 (library) | — | `Layout { uint256 globalSupply; bool provenanceInitialized; }` + slot constant + RATE_SCALE constant. |

**No reserve mappings** (Revision 1's `reserveOf`/`redeemableBacking` die). NFT struct appends: `parentId` only (D7); `nonRedeemable`→`nonConvertible` is a plan-time checkpoint (D5 successor). Selector surface: **removed** `withdraw(uint256,uint256)`; **added** `convert(uint256,uint256,uint256,address)`, `totalSupplyOfAll()`, `unitsOf(uint256,address)`, `totalUnitsOf(uint256)`, `syncGlobalSupply(uint256)`, `GNUSTreasury_Initialize300(uint256)` (init, likely called via diamondCut delegatecall not as a standing selector — planner decides per DiamondInitFacet precedent: existing versioned initializers ARE standing selectors on DiamondInitFacet, e.g. `diamondInitialize250`).

### I. Test migration inventory + new invariant set

**Tests that break [VERIFIED: grep this session]:**

| Test file | Why it breaks |
|-----------|---------------|
| test/unit/GNUSBridge.test.ts (12 `.withdraw(` refs) | Selector removed → rewrite against `convert(id, GNUS_TOKEN_ID, amount, caller)`; mind arg-order flip: withdraw is `(amount, id)`, convert is `(fromId, toId, minionAmount, to)` |
| test/unit/GNUSBridgeEnhanced.test.ts | Same |
| test/unit/GNUSWithdrawLimiterStorage.test.ts | Tests limiter *through* withdraw → re-home onto convert's GNUS-terminal leg |
| test/integration/withdraw-limiter-integration.test.ts | Same re-home |
| test/gas/withdraw-limiter-gas-comparison.test.ts | Same; gas baselines shift (convert is 2 supply ops, no fee path) |
| test/unit/NFTFactory.test.ts | Mint semantics flip (§E); 2nd-gen no-burn assertions (lines 371-375, 522-525 per REQUIREMENTS.md:149) now assert depth-gate revert + convert-based issuance |
| test/unit/GNUSNFTFactoryEnhanced.test.ts | Mint semantics flip; burn-amount assertions (`amount*rate` → `amount`) |
| test/unit/GNUSBridge.test.ts bridgeOut cases | CR-03 limiter math: charge becomes `amount` (already minions), division dies |
| test/foundry/* limiter/withdraw fuzz + handlers | Handler actions renamed/re-targeted to convert; invariant set replaced (below) |
| test/unit/Phase5-circuit-breaker.test.ts | Uses 2-arg root `mint` — should survive (root mint path unchanged except provenance hook); verify pause interplay with new hooks |
| ERC-20 facade tests | `totalSupply()` facade (GNUSBridge.sol:250-252) is **unchanged** in behavior (id-0 supply) — ERC-20 transfer/approve/allowance tests should survive wholesale. Verify. |

**New invariant set (enforcement for Revision 2):**

- **I1 (conservation):** `Σ_id totalSupply(id)` changes only via root mint (`_mintWithBridgeFee`), admin `burn`, and bridgeOut. Mint/convert sequences leave it identical.
- **I2 (convert neutrality):** `convert` never changes `Σ_id totalSupply(id)` and never changes `totalSupplyOfAll()` (global counter untouched on convert paths).
- **I3 (provenance consistency):** after any sequence of root mints, admin burns, and simulated bridge in/out (mint on "destination" diamond instance + bridgeOut on "source"), `totalSupplyOfAll()` equals the expected global figure; `totalSupplyOfAll() == totalSupply(0) + Σ_children totalSupply(id)` on a single-chain deployment with no bridges (sync-free case).
- **I4 (free-GNUS identity):** `totalSupply(0) == totalSupplyOfAll() − Σ_{id≠0} totalSupply(id)` — single-chain case; with bridges, `totalSupply(0) ≤` that figure (bridged-out children still count in provenance until synced… under B1 bridgeOut doesn't touch the counter, so on the source chain post-bridgeOut: `Σ` local dropped by amount, counter unchanged → identity becomes `localTreeSupply == counter − outstandingBridged`. **Planner: make I4 a single-chain invariant only; cross-chain consistency is I3's job.**)
- **I5 (cap):** `totalSupplyOfAll() ≤ GNUS_MAX_SUPPLY` after every root-mint/bridge-in.
- **I6 (limiter):** GNUS-terminal convert charges the limiter exactly once, in minions, super-admin bypassed; GNUS→child convert charges exactly once (via hook); child→child charges zero.

## Architecture Patterns

### System Architecture Diagram

```text
   Creator/Admin            MINTER_ROLE (issuance + bridge-in relayer)
        |                          |
        v                          v
   +------------------+   +-----------------------------+
   | GNUSNFTFactory   |   | GNUSBridge (edited)         |
   |  createNFTs      |   |  mint(user, amt)  ----------+--> _mintWithBridgeFee:
   |  mint/mintBatch  |   |  mint(user,id,amt) ---------+    id-0 mint + globalSupply += minted
   |   beforeMint:    |   |  burn(user, amt)  ----------+--> id-0 burn + globalSupply -= amt
   |    depth-1 gate  |   |  bridgeOut(...) -----------+--> id-k burn (counter UNTOUCHED, B1)
   |    burn GNUS 1:1 |   +-----------------------------+
   +--------+---------+            ^
            |                     |  (both call _mint/_burn → hook:
            |                     |   per-id maxSupply check on mints;
            v                     |   limiter on non-mint id-0 moves)
   +-----------------------------+---------+
   | GNUSTreasury (NEW facet)              |
   |  convert(fromId,toId,minionAmt,to)    |  burn fromId + mint toId, SAME amount
   |    GNUS-terminal: explicit limiter    |  charge once (WR-07, super-admin bypass)
   |  unitsOf / totalUnitsOf (display)     |  balance*RATE_SCALE/rate, floor, read-only
   |  totalSupplyOfAll()                   |  reads globalSupply
   |  syncGlobalSupply(newTotal) [admin]   |
   |  GNUSTreasury_Initialize300(seed)     |
   +------------------+--------------------+
                      |
                      v
   +---------------------------------------+
   | GNUSTreasuryStorage.Layout            |
   |  globalSupply : uint256               |
   |  provenanceInitialized : bool         |
   |  RATE_SCALE = 1e18 (constant)         |
   +---------------------------------------+

   Invariants after EVERY state transition:
     I1  Σ totalSupply(id) changes only via root mint / admin burn / bridgeOut
     I2  convert leaves Σ and globalSupply unchanged
     I5  globalSupply ≤ GNUS_MAX_SUPPLY (checked at _mintWithBridgeFee)
```

### Recommended Project Structure

```text
contracts/gnus-ai/
├── GNUSNFTFactoryStorage.sol      # APPEND: parentId to NFT struct (D7); UPDATE NatSpec on exchangeRate (display-only)
├── GNUSNFTFactory.sol             # EDIT: beforeMint rewrite (depth gate + 1:1 minion burn, §F);
│                                  #       createNFTs collision guard + parentId recording
├── GNUSTreasuryStorage.sol        # NEW: Layout { globalSupply, provenanceInitialized } + slot + RATE_SCALE
├── GNUSTreasury.sol               # NEW facet: convert, unitsOf, totalUnitsOf, totalSupplyOfAll,
│                                  #       syncGlobalSupply, GNUSTreasury_Initialize300
├── GNUSBridge.sol                 # EDIT: DELETE withdraw() (162-191);
│                                  #       provenance hooks in _mintWithBridgeFee (77-89) & burn (118-121);
│                                  #       bridgeOut limiter math: drop /exchangeRate (221-230);
│                                  #       optionally restrict 3-arg mint to id 0 (§A warning)
├── GNUSERC1155MaxSupply.sol       # UNCHANGED (per-id cap + limiter hook already correct, §C/§G)
├── GNUSWithdrawLimiterStorage.sol # UNCHANGED (call site moves, mechanics preserved)
└── DiamondInitFacet.sol           # REFERENCE ONLY for versioned-initializer pattern;
                                   #  Phase 9 initializer lives on GNUSTreasury (or DiamondInitFacet — planner's call,
                                   #  precedent favors DiamondInitFacet for diamond-level init)

diamonds/GeniusDiamond/
└── geniusdiamond.config.json      # EDIT: add GNUSTreasury facet entry (new version, e.g. "3.0");
                                   #  bump GNUSBridge/GNUSNFTFactory versions with fromVersions
```

### Pattern 1: Diamond-storage Layout append (established project pattern) — CARRIED FORWARD from Revision 1

**What:** New state lives in a `keccak256`-slotted library `Layout` struct; appends only.
**When to use:** GNUSTreasuryStorage (new) and the `parentId` NFT-struct append (D7).
**Example:**

```solidity
// Source: established pattern in GNUSNFTFactoryStorage.sol (lines 22-42) and
// GNUSWithdrawLimiterStorage.sol (lines 37-48) — verified in this session.
library GNUSTreasuryStorage {
    struct Layout {
        uint256 globalSupply;          // B1 provenance counter (§B)
        bool provenanceInitialized;    // one-time initializer guard
    }

    bytes32 constant GNUS_TREASURY_STORAGE_POSITION = keccak256("gnus.ai.treasury.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_TREASURY_STORAGE_POSITION;
        assembly { l.slot := slot }
    }
}
```

**Decision (carried forward): new library, not extension of GNUSNFTFactoryStorage.** Mutation surfaces stay disjoint: factory owns NFT metadata; treasury owns the provenance counter; matches the existing GNUSControlStorage/GNUSWithdrawLimiterStorage/ERC20Storage split.

### Pattern 2: Minion-for-minion issuance (beforeMint rewrite)

**What:** `beforeMint` burns exactly `amount` id-0 minions and the subsequent `_mint(to, id, amount)` mints the same amount of child minions. Depth-gated to direct children; deeper issuance goes through `convert`.
**When to use:** GNUSNFTFactory.mint / mintBatch (both call beforeMint per id — mintBatch loops at lines 115-120).
**Example:** see §F for the full rewritten function. Key properties: no multiplication, no rate read, conservation by construction (burn k, mint k in the same tx).

**Overflow note:** none needed — there is no `amount * rate` anymore anywhere in state transitions. Display views multiply `balance * RATE_SCALE` (max realistic balance ~5e25 × 1e18 = 5e43 < 2^256 ≈ 1.15e77 — non-binding; 0.8.19 checked arithmetic guards regardless).

### Pattern 3: WR-07 limiter re-home — explicit charge on the GNUS-terminal leg (verified in new model, §G)

```solidity
// Source: GNUSBridge.sol lines 181-187 (WR-07 charge block, verified this session) —
// transplanted onto convert's GNUS-terminal leg. The hook does NOT cover this leg
// because _mint is hook-exempt (isMinting, GNUSERC1155MaxSupply.sol:45,50,75).
if (toId == GNUS_TOKEN_ID) {
    if (LibDiamond.diamondStorage().contractOwner != sender) {
        GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(sender, minionAmount);
    } else {
        emit GNUSWithdrawLimiterStorage.SuperAdminBypass(sender, minionAmount, "GNUSTreasury.convert");
    }
}
```

**Anti-pattern (carried forward, now sharper):** do NOT add an explicit charge for `convert(GNUS → child)` — its `_burn(sender, 0, amount)` routes through the hook (non-mint, id 0) and charges automatically. Explicit + hook = double-charge, the exact bug WR-07's comment (lines 66-69) warns about.

### Anti-Patterns to Avoid

- **Reserve/ledger mappings (Revision 1 design):** superseded. Do not resurrect `reserveOf`/`redeemableBacking`/`issueBacked`/`depositToReserve` — the supply IS the backing.
- **Rate math in state transitions:** any `amount * exchangeRate` or `amount / exchangeRate` in a mutating function. Rates are display-only (D2 modified). The existing instances (GNUSNFTFactory.sol:90, GNUSBridge.sol:173, 224) all die in this phase.
- **Burn/mint asymmetry:** any path where the burned amount ≠ the minted amount on mint/convert. Conservation is the whole model.
- **Hooking provenance onto `_mint`/`_burn` primitives:** double-touches on supply-neutral paths (§A). Counter updates go on the supply-changing entry points only.
- **Deriving anything from `(id >> 128)` other than the depth gate:** the mint depth-gate (§F) legitimately uses it (it answers "is this a direct child"), matching current code; parent *lookup* must use the new `parentId` field (D7) — bit-shifting truncates at depth ≥2.
- **Dual-unit accounting / `minionsOf` aliases:** balances ARE minions; aliases re-create the confusion (§D).
- **Cap-checking convert's id-0 mint leg against the global figure:** convert conserves; the check belongs only on `_mintWithBridgeFee` (§C item 4).
- **Granularity guards (`require(amount >= exchangeRate)`):** dead with the rate math; integer-exact minion moves have no dust to guard.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-id supply tracking | New supply mappings | `ERC1155SupplyStorage._totalSupply[id]` (existing, hooked on every transfer) [VERIFIED: ERC1155SupplyUpgradeable.sol:55-70] | Already maintained by the `_beforeTokenTransfer` override chain; Phase 9 adds zero supply bookkeeping for children |
| Withdrawal rate limiting | New limiter | `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw` (existing) | Bin-based limiter audited through WR-02..WR-07; only the call site moves |
| Diamond storage isolation | Shared/unstructured storage | `keccak256`-slotted Layout library (project pattern) | Established across all existing storage libraries |
| Versioned upgrade initialization | Custom init guards | Versioned initializer + bool guard (DiamondInitFacet.sol:43-57 pattern; `provenanceInitialized`) | Precedent exists; prevents re-seeding on later cuts |
| Fixed-point display math | Custom WAD library | Native `a * 1e18 / rate` (0.8.19 checked) in views only | Read-only, bounded magnitudes; no state-transition math remains |

**Key insight (updated):** Revision 2 removes the phase's hardest Revision-1 problems (escrow custody, solvency invariants, ceil/floor asymmetry, double-conversion dust). What remains hard is **provenance consistency across chains** (§B — inherently eventually-consistent, mitigated by admin sync + restricted minting) and **test/caller migration** (§E/§I — the semantic flip touches many call sites). The on-chain mechanism is small; the coordination surface is the risk.

## Runtime State Inventory

> Rename/refactor/migration trigger: `withdraw()` selector removal + mint-semantics flip. No stored data carries units semantics (zero child tokens exist), but check runtime registrations.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NFT struct records on 9 deployed chains — only id 0 (GNUS) exists (user-confirmed no children). `NFTs[0].exchangeRate = 1` stored from the `1.0` literal (GNUSNFTFactory.sol:34) — semantically dead for display views if views special-case id 0 (§D) | None — code edit only (views guard id 0); no data migration |
| Live service config | Sepolia (and other testnet) diamonds hold MINTER_ROLE grants used by the bridge relayer to effect bridge-in via `mint(user, id, amount)` — no bridgeIn selector exists, so off-chain relayer config references the generic mint path | Operational note for deployment runbook: relayer semantics unchanged, but if §A's 3-arg-mint restriction lands, relayer calldata for child-id bridge-ins must switch to a two-step (mint id 0 → convert) or the restriction must exempt bridge-in. **Plan-time decision with ops impact.** |
| OS-registered state | None — verified: no Task Scheduler/systemd/pm2 registrations in this repo's scope (deployment tooling is Hardhat scripts + Safe proposer) | None |
| Secrets/env vars | None referencing withdraw/mint semantics — deployment configs are chain RPC + keys (diamonds/GeniusDiamond/deployments/rpc/) | None |
| Build artifacts | Typechain/hardhat artifacts will regenerate; `test/` and `scripts/` `.withdraw(` references (§I) are source, not artifacts | `npx hardhat clean` + recompile after facet changes |

## Common Pitfalls

### Pitfall 1: Stale rate math surviving in a corner
**What goes wrong:** Three multiplicative rate sites die in this phase: GNUSNFTFactory.sol:90 (`amount * nft.exchangeRate`), GNUSBridge.sol:173 (`amount / exchangeRate` in withdraw — dies with the function), GNUSBridge.sol:224 (`amount / exchangeRate` in bridgeOut's CR-03 charge). If the bridgeOut one is missed, the limiter charges `amount / rate` — with rate semantics now display-only 1e18-scaled, the charge becomes ~0 (never limits) or wildly wrong.
**Why it happens:** withdraw's death is obvious; bridgeOut's embedded division is easy to overlook because the function itself survives.
**How to avoid:** grep `exchangeRate` across contracts/ in the plan's verification step; post-Phase-9 the only reads may be `getNFTInfo` and the display views.
**Warning signs:** bridgeOut limiter never triggering, or triggering at absurd thresholds.

### Pitfall 2: Provenance hook on the wrong layer (double-touch)
**What goes wrong:** Incrementing `globalSupply` inside `_mint`/`_burn` primitives: factory mint burns id 0 (−) then mints child (+) → two counter ops netting zero per call; convert does the same ×2. Net is correct but every supply-neutral op costs two SSTOREs and pollutes the audit trail; worse, if the hook is added asymmetrically (mint only), the counter drifts.
**Why it happens:** "update it where supply changes" sounds like the primitives.
**How to avoid:** §A's rule — counter updates only on `_mintWithBridgeFee` (fresh issuance + bridge-in) and `burn` (admin destruction); bridgeOut untouched under B1 (destination's bridge-in mint is the + side).
**Warning signs:** gas regression on convert/mint; invariant fuzz showing counter ≠ Σ local supply on a no-bridge deployment.

### Pitfall 3: Bridge-fee drift in the global counter
**What goes wrong:** `_mintWithBridgeFee` mints `amount * (1000-fee)/1000` (GNUSBridge.sol:85). If the counter increments by the *requested* amount instead of the *minted* amount, `globalSupply` drifts high by the fee on every bridge-in / root mint with nonzero fee, and the I3/I5 invariants fail.
**Why it happens:** The increment is added at the function head before the fee adjustment at line 85.
**How to avoid:** increment by the post-adjustment `amount` (after line 85, before `_mint` at line 87). Pin with a unit test: nonzero bridgeFee, bridge-in 1000, assert counter += minted (900-ish), not requested.
**Warning signs:** `totalSupplyOfAll()` exceeding actual minted sums in fee-enabled tests.

### Pitfall 4: Deploy-time double-count on second-chain deployment
**What goes wrong:** Chain B deployed after chain A has supply S initializes `globalSupply = 0`; bridge-in of X onto B later makes B report X while A reports S — both wrong (truth is S, conserved).
**Why it happens:** default-zero storage + skipping the seed parameter.
**How to avoid:** `GNUSTreasury_Initialize300(seed)` is **mandatory with the correct seed** in the deployment runbook for every chain after the first; the `provenanceInitialized` guard makes "forgot to initialize" detectable (`totalSupplyOfAll()` should revert when uninitialized — planner decision; recommend revert to force the runbook step).
**Warning signs:** `totalSupplyOfAll()` returning less than local tree supply — impossible under conservation, so any such reading proves mis-seeding.

### Pitfall 5: The 3-arg MINTER mint as a conservation hole
**What goes wrong:** `mint(user, tokenID, amount)` (GNUSBridge.sol:108-110) mints **any** id with no paired burn — a MINTER_ROLE holder can inflate child supplies at will, breaking I1's "Σ changes only via root mint/burn/bridge."
**Why it happens:** the overload predates the conservation model; bridge-in relayers legitimately use it for id 0.
**How to avoid:** §A warning — restrict to `tokenID == GNUS_TOKEN_ID` (one-line require), or if child-id bridge-in is a real requirement, route it as mint id 0 → convert. Planner must get user sign-off; document the chosen rule.
**Warning signs:** fuzz handler calling 3-arg mint with random ids and I1 failing.

### Pitfall 6: `unitsOf` on id 0 returning garbage
**What goes wrong:** `NFTs[0].exchangeRate == 1` (stored `1.0` → 1), so `unitsOf(0, acct) = balance * 1e18 / 1` — inflated by 1e18.
**How to avoid:** display views revert on `id == GNUS_TOKEN_ID` (§D). One-line require + unit test.

### Pitfall 7 (carried forward): Storage-append ordering collision with Phase 13
**What goes wrong:** Phase 13 also appends to the `NFT` struct; conflicting append orders across branches corrupt slot decoding.
**How to avoid:** No child tokens exist and testnet redeploy is tolerated, but record Phase 9's append order (`parentId` — plus `nonConvertible` if the D5 checkpoint lands it) so Phase 13 appends after. Legacy-decode upgrade test against a pre-upgrade fixture.
**Warning signs:** `getNFTInfo` returning garbage for pre-upgrade records.

### Pitfall 8 (carried forward, re-scoped): `withdraw()` selector removal breaking call sites
**What goes wrong:** `.withdraw(` referenced in test/unit/GNUSBridge.test.ts (12 refs), GNUSBridgeEnhanced.test.ts, GNUSWithdrawLimiterStorage.test.ts, test/integration/withdraw-limiter-integration.test.ts, test/gas/withdraw-limiter-gas-comparison.test.ts [VERIFIED: grep this session — foundry refs from Revision 1 should be re-grepped at plan time]. GNUSContractAssets.test.ts uses `withdrawToken` — DO NOT touch.
**How to avoid:** migrate every `withdraw(amount, id)` → `convert(id, GNUS_TOKEN_ID, amount, caller)`; limiter tests re-target the GNUS-terminal leg.
**Warning signs:** `diamond.withdraw is not a function` post-cut; loupe test must assert selector absence + stale-calldata revert.

## Code Examples

Verified patterns from the codebase (line numbers verified in this session):

### Current code being replaced — carried forward from Revision 1 (still accurate)

- `GNUSBridge.withdraw` lines 162-191 — **DELETED** (D4). See Revision-1 quote in git history; the division at line 173 and granularity guards at 169-170 die with it.
- `GNUSNFTFactory.beforeMint` lines 83-94 — rewritten per §F; the multiplication at line 90 dies.

### New facet skeleton (GNUSTreasury.sol) — planner reference

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Source: synthesized from Revision-2 model + verified codebase patterns.
// Revert strings/event shapes are plan-time detail.
contract GNUSTreasury is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl {
    uint256 internal constant RATE_SCALE = 1e18;

    event Converted(uint256 indexed fromId, uint256 indexed toId, uint256 minionAmount, address indexed to);
    event GlobalSupplySynced(uint256 oldGlobal, uint256 newGlobal, address indexed operator);
    event GlobalSupplyInitialized(uint256 seedGlobalSupply, address indexed operator);

    /// @notice D8: one function, any depth. GNUS-terminal when toId == GNUS_TOKEN_ID.
    /// @dev Same minion count burned and minted — tree-wide supply invariant (I2).
    function convert(uint256 fromId, uint256 toId, uint256 minionAmount, address to) external {
        // checks: fromId != toId; minionAmount > 0; both ids created (getNFTInfo pattern);
        //         to != address(0)
        // GNUS-terminal limiter charge (WR-07; §G — mint leg is hook-exempt):
        if (toId == GNUS_TOKEN_ID) {
            if (LibDiamond.diamondStorage().contractOwner != _msgSender()) {
                GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(_msgSender(), minionAmount);
            } else {
                emit GNUSWithdrawLimiterStorage.SuperAdminBypass(_msgSender(), minionAmount, "GNUSTreasury.convert");
            }
        }
        _burn(_msgSender(), fromId, minionAmount);   // balance check inside _burn
        _mint(to, toId, minionAmount, "");           // per-id maxSupply hook fires here (§C)
        emit Converted(fromId, toId, minionAmount, to);
    }

    /// @notice Display-only (D2 modified). Reverts on id 0 (Pitfall 6). Floor rounding (D9).
    function unitsOf(uint256 id, address account) external view returns (uint256) {
        require(id != GNUS_TOKEN_ID, "GNUS has no child units");
        uint256 rate = GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
        require(rate > 0, "No display rate");
        return (balanceOf(account, id) * RATE_SCALE) / rate;
    }

    function totalUnitsOf(uint256 id) external view returns (uint256) {
        require(id != GNUS_TOKEN_ID, "GNUS has no child units");
        uint256 rate = GNUSNFTFactoryStorage.layout().NFTs[id].exchangeRate;
        require(rate > 0, "No display rate");
        return (totalSupply(id) * RATE_SCALE) / rate;
    }

    /// @notice Revision-2 #5: tree-wide GNUS incl. cross-chain provenance (§B).
    function totalSupplyOfAll() external view returns (uint256) {
        GNUSTreasuryStorage.Layout storage l = GNUSTreasuryStorage.layout();
        require(l.provenanceInitialized, "Global supply not initialized"); // Pitfall 4
        return l.globalSupply;
    }

    /// @notice One-time seed (§B). Versioned-initializer pattern (DiamondInitFacet precedent).
    function GNUSTreasury_Initialize300(uint256 seedGlobalSupply) external onlySuperAdminRole {
        GNUSTreasuryStorage.Layout storage l = GNUSTreasuryStorage.layout();
        require(!l.provenanceInitialized, "Already initialized");
        l.globalSupply = seedGlobalSupply;
        l.provenanceInitialized = true;
        emit GlobalSupplyInitialized(seedGlobalSupply, _msgSender());
    }

    /// @notice Honesty valve for cross-chain drift (§B). Every call auditable.
    function syncGlobalSupply(uint256 newGlobal) external onlyRole(DEFAULT_ADMIN_ROLE) {
        GNUSTreasuryStorage.Layout storage l = GNUSTreasuryStorage.layout();
        require(l.provenanceInitialized, "Not initialized");
        emit GlobalSupplySynced(l.globalSupply, newGlobal, _msgSender());
        l.globalSupply = newGlobal;
    }
}
```

### Provenance hooks in GNUSBridge (§B/§C)

```solidity
// _mintWithBridgeFee (GNUSBridge.sol:77-89) — after the fee adjustment, before _mint:
uint256 mintedAmount = amount; // post-fee-adjusted value (Pitfall 3)
GNUSTreasuryStorage.Layout storage t = GNUSTreasuryStorage.layout();
if (tokenID == GNUS_TOKEN_ID) {
    require(t.globalSupply + mintedAmount <= GNUS_MAX_SUPPLY, "Global max supply exceeded"); // §C.3
    t.globalSupply += mintedAmount;
}
// (child-id minting via this path: see Pitfall 5 — plan-time restriction decision)
_mint(user, tokenID, mintedAmount, "");
emit Transfer(address(0), user, mintedAmount);

// burn(address,uint256) (GNUSBridge.sol:118-121) — after _burn:
GNUSTreasuryStorage.layout().globalSupply -= amount;

// bridgeOut — NO counter touch under B1 (§B): destination chain's bridge-in mint
// is the + side; global total is conserved across the pair.
```

### Diamond config change (geniusdiamond.config.json) — carried forward, updated

```jsonc
// Add (new facet; priority 117 sits between GNUSBridge@115 and GNUSWithdrawLimiter@120):
"GNUSTreasury": { "priority": 117, "versions": { "3.0": {} } },
// Bump: "GNUSBridge": "3.0": { "fromVersions": [0.0, 2.4, 2.5] }
//       "GNUSNFTFactory": "3.0": { "fromVersions": [0.0, 2.0, 2.3] }
// protocolVersion 2.5 -> 3.0. Initialization call (GNUSTreasury_Initialize300 with the
// per-chain seed) must be wired into the 3.0 cut's init calldata per the diamonds tooling.
```

Selector surface: **removed** `withdraw(uint256,uint256)`; **added** per §H. The loupe test asserts the old selector reverts and new selectors resolve.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Burn `units × rate` GNUS on child mint / mint `units / rate` GNUS on withdraw | Minion-for-minion burn/mint (1:1) on mint; `convert` burns/mints same minion amount | This phase (Revision 2) | Conservation by construction; CONCERNS #1/#2 dead by construction |
| `exchangeRate` drives state transitions (multiply on mint, divide on withdraw) | `exchangeRate` display-only @1e18, read-side views only | This phase (D2 modified) | No rounding/dust in state; rates are UX, not economics |
| Revision-1 escrow ledger (`reserveOf`/`redeemableBacking`/`issueBacked`/`depositToReserve`) | No reserve state; child supply IS the locked backing | Revision 2 (this doc) | Smaller facet, no custody question, no solvency invariant to fuzz |
| No cross-chain supply awareness | `globalSupply` counter + per-chain seed initialize + admin sync + bridge hooks | This phase (§B; new requirement) | `totalSupplyOfAll()` available for cap enforcement + Phase 12 groundwork |
| Redeemability derived from `(id >> 128)` | Depth gate on mint only (§F); convert permissionless on holdings | This phase | Tree semantics exact; deeper issuance = convert |
| Per-id cap via hook; id-0 cap == global cap conflation | Per-id cap unchanged (minion semantics); global cap enforced on `_mintWithBridgeFee` against `totalSupplyOfAll` | This phase (§C) | 50M cap holds tree-wide across chains (up to sync freshness) |

**Deprecated/outdated:**
- `GNUSBridge.withdraw(uint256,uint256)` — selector removed (D4).
- Rate math in state transitions (GNUSNFTFactory.sol:90, GNUSBridge.sol:173/224) — deleted.
- `require(amount >= exchangeRate)` granularity guards (GNUSBridge.sol:170) — dead with rate math.
- Revision-1 reserve apparatus — never implemented; superseded before planning.
- Research doc's per-level-treasury framing and ROADMAP's "redeem() burns child tokens" wording — superseded.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bridge-in on destination chains is effected by a relayer calling the MINTER_ROLE `mint(user, id, amount)` overload (no `bridgeIn` selector exists) | §A, §B | HIGH if wrong — if some other component (SuperGenius node, separate contract) mints via a path not enumerated, the provenance hooks miss it. Mitigation: planner greps deployment scripts/relayer config before finalizing hook placement; the `_mintWithBridgeFee` placement covers all current mint paths regardless of caller. |
| A2 | B1 provenance model (single counter, bridgeOut untouched, eventual consistency via `syncGlobalSupply`) matches the user's "initialize function set" intent | §B | MEDIUM — user may intend full per-chain tracking (Phase 12 scope pulled in). If so, storage grows to a per-chain mapping; convert/mint invariants unchanged. Flag at plan-time checkpoint. |
| A3 | Depth ≥2 mints should revert in favor of convert (§F option 3) | §F | MEDIUM — if Phase 13 flows require direct minting of credits without the creator holding parent supply, the gate must allow an admin exception or option 1. Claude's-discretion item requiring user sign-off. |
| A4 | `convert(GNUS → child)` keeping the automatic hook charge (limiter treats locking GNUS as a withdrawal) is acceptable | §G | LOW-MEDIUM — semantically defensible either way; removing it requires a hook exemption mechanism (invasive). Recommend keeping; plan-time confirmation. |
| A5 | New GNUSTreasury facet fits EIP-170 comfortably | §H | LOW — surface is smaller than GNUSControl (7,287 B); measured comparables far under 24,576 B [VERIFIED: artifacts]. |
| A6 | No on-chain child tokens exist, so struct appends + semantic flip carry zero migration burden | §E, Pitfall 7 | User-confirmed; if wrong (Sepolia children exist), display-rate semantics on legacy records need a check (their stored `exchangeRate` was "units per GNUS" — inverted vs. the new display convention; legacy children's `unitsOf` would be wrong by rate². Since none exist: moot.) |
| A7 | The 50M global cap should be enforced against the synced global figure (B1) rather than local id-0 supply | §C | LOW — only matters when multiple chains mint; with single-chain minting the two coincide. |
| A8 | D5's successor (`nonConvertible` flag) is needed at all in Revision 2 | §D5 note | LOW — if Phase 13's burn-only tokens can simply never be converted socially (nobody converts what they don't want to), the flag is unnecessary; if contracts must enforce it, add the struct bit. Plan-time user checkpoint. |

## Open Questions

1. **Provenance model depth (B1 vs B2 vs Phase-12-style per-chain)**
   - What we know: user said "initialize function set"; B1 is the minimal mechanism satisfying it.
   - What's unclear: whether eventual consistency + admin sync is acceptable, or whether bridge events must synchronously update both chains' counters (impossible on-chain without a messenger — the relayer would need to call `syncGlobalSupply` on the source chain per bridge, which B2 formalizes).
   - Recommendation: B1 + documented sync ritual; Phase 12 replaces with full per-chain ledger. **User checkpoint at plan time.**

2. **3-arg MINTER mint restriction (Pitfall 5)**
   - What we know: the overload can mint any id with no paired burn — a conservation hole under Revision 2.
   - What's unclear: whether the bridge relayer ever bridges child ids (needs ops input).
   - Recommendation: restrict to id 0; if child bridging is real, relayer does mint(0) → convert. **User checkpoint.**

3. **Depth-gate admin exception (A3)**
   - What we know: §F option 3 reverts depth ≥2 mints unconditionally.
   - What's unclear: Phase 13's AI Credits issuance flow — does the License creator hold parent supply to convert from at credit-issuance time?
   - Recommendation: keep the gate strict; Phase 13 can convert on behalf via creator-held parent supply. Confirm against 13-CONTEXT at plan time.

4. **`totalSupplyOfAll()` behavior when uninitialized**
   - Revert (recommended — forces the runbook seed step, Pitfall 4) vs return local tree supply (forgiving, hides misconfiguration). Plan-time decision.

5. **Bridge-fee disposition under Revision 2** — partially resolved: convert never fees (no hook on convert path). Remaining: the fee haircut inside `_mintWithBridgeFee` means bridge-in mints less than bridge-out burned → global supply **decreases** by fees over time. Under "nothing leaves the system except bridging," is the fee a sanctioned destruction? It already was (pre-Phase-9 behavior); Revision 2 keeps it and the counter correctly tracks post-fee amounts (Pitfall 3). Document for user; no action recommended.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Hardhat build & unit tests | ✓ (node_modules, package-lock.json, yarn.lock present) | — | — |
| Hardhat + diamonds tooling | Compile, deploy, diamondCut | ✓ | per package.json | — |
| Foundry (forge) | Invariant/fuzz tests (I1-I6) | ✓ (test/foundry/ tree + GeniusDiamond.forge.config.json) | — | Hardhat-only fuzz (weaker) |
| Slither | Security scan (enforcement #7) | config exists (slither.config.json); currently excludes contracts/gnus-ai/ | — | Run manually on changed contracts |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** none identified.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit) | Hardhat + Mocha/Chai + TypeScript (test/unit/*.test.ts) |
| Framework (fuzz/invariant) | Foundry (test/foundry/{fuzz,invariant,handlers}/) — `GeniusDiamondHandler.sol`, `DiamondInvariants.t.sol` exist |
| Config files | hardhat.config.ts; test/foundry/GeniusDiamond.forge.config.json |
| Quick run command | `cd gnus-ai && npx hardhat test test/unit/GNUSTreasury.test.ts` (once Wave 0 lands) |
| Full suite command | `cd gnus-ai && npx hardhat test` + `forge test` (foundry tree) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREASURY-01 | Conservation I1: Σ supply changes only via root mint/burn/bridge | invariant (forge) | `forge test --match-contract ConservationInvariant` | ❌ Wave 0 (handler update) |
| TREASURY-02 | beforeMint: 1:1 minion burn, depth gate revert at ≥2, creator/admin gate | unit | `npx hardhat test test/unit/NFTFactory.test.ts` (rewrite) | ✅ rewrite |
| TREASURY-03 | convert child→GNUS: exact amounts, I2 neutrality, limiter once (I6), super-admin bypass | unit | `npx hardhat test test/unit/GNUSTreasury.test.ts -g "convert to GNUS"` | ❌ Wave 0 |
| TREASURY-03 | convert GNUS→child: hook charges once (no explicit), cap check on to-leg | unit | same, `-g "GNUS to child"` | ❌ Wave 0 |
| TREASURY-03 | convert child→child: no limiter, neutrality | unit | same, `-g "child to child"` | ❌ Wave 0 |
| TREASURY-03 | convert grandchild→GNUS single hop (via convert chain) | unit | same, `-g "deep"` | ❌ Wave 0 |
| TREASURY-03 | Reverts: same-id, zero amount, uncreated id, insufficient balance | unit | same, `-g reverts` | ❌ Wave 0 |
| TREASURY-03 | withdraw() selector gone — loupe + stale-calldata revert | unit | same, `-g "selector removed"` | ❌ Wave 0 |
| TREASURY-04 | Initialize seed; re-init revert; sync event + role gate; totalSupplyOfAll | unit | same, `-g provenance` | ❌ Wave 0 |
| TREASURY-04 | I3: simulated two-diamond bridge — source bridgeOut + dest mint → counters consistent (B1: unchanged both sides; local Σ shifts) | unit (two diamond fixtures) | same, `-g "cross chain"` | ❌ Wave 0 |
| TREASURY-04 | I5: global cap enforced on root mint & bridge-in (post-fee amount, Pitfall 3) | unit | same, `-g "global cap"` | ❌ Wave 0 |
| TREASURY-05 | unitsOf/totalUnitsOf floor rounding; id-0 revert (Pitfall 6); rate=0 revert | unit | same, `-g display` | ❌ Wave 0 |
| TREASURY-02/04 | Pitfall 2: convert & factory mint do NOT touch globalSupply (gas + correctness) | unit | same, `-g "counter untouched"` | ❌ Wave 0 |
| D7 | createNFTs collision guard + parentId at depth ≥2 | unit | NFTFactory.test.ts (extend) | ✅ extend |
| §C | Per-id maxSupply as minion cap: mint/convert to exactly cap OK, cap+1 reverts | unit | GNUSTreasury.test.ts `-g "minion cap"` | ❌ Wave 0 |
| §I | ERC-20 facade regression: totalSupply()/transfer/approve unchanged | unit | existing ERC-20 tests | ✅ verify green |
| WR-07 | Limiter integration via convert GNUS-terminal leg | integration | test/integration/withdraw-limiter-integration.test.ts (rewrite) | ✅ rewrite |

### Sampling Rate

- **Per task commit:** `npx hardhat test test/unit/GNUSTreasury.test.ts` + affected existing file
- **Per wave merge:** `npx hardhat test` (full TS suite)
- **Phase gate:** Full TS suite + `forge test` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/unit/GNUSTreasury.test.ts` — TREASURY-03/04/05 unit behaviors
- [ ] Foundry handler update: replace withdraw actions with convert actions in `test/foundry/handlers/GeniusDiamondHandler.sol`; new invariant contract for I1/I2/I3/I5
- [ ] Two-diamond fixture for cross-chain provenance test (deploy two GeniusDiamond instances in one test, simulate relayer)
- [ ] Pre-upgrade deployment fixture for legacy-decode test (parentId zero-default)
- [ ] No framework install needed — both toolchains present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (contract-internal; access control is V4) |
| V3 Session Management | no | — |
| V4 Access Control | yes | `onlyRole(DEFAULT_ADMIN_ROLE)` on syncGlobalSupply; `onlySuperAdminRole` on initialize; creator/admin gate in beforeMint (existing); MINTER_ROLE restriction decision (Pitfall 5) |
| V5 Input Validation | yes | same-id, zero-amount, zero-address, uncreated-id, id-0 display-view guards; depth gate |
| V6 Cryptography | no | — |
| V7 Error Handling / V9 Data Protection | partial | Revert-don't-return everywhere; provenance mis-seed detection via invariant I3/I4 tests |

### Known Threat Patterns for minion-native diamond ERC-1155

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Conservation break via privileged mint (Pitfall 5) | Elevation of Privilege | Restrict 3-arg mint to id 0; I1 invariant fuzz |
| Provenance counter drift (fee, double-touch, mis-seed) | Tampering / Repudiation | Pitfalls 2-4 mitigations; I2/I3 fuzz; sync events auditable; init guard + revert-when-uninitialized |
| Global cap bypass via multi-chain mint | Elevation of Privilege | Cap check on `_mintWithBridgeFee` against globalSupply (§C); sync ritual documented; A7 |
| Limiter bypass / double-charge (WR-07) | DoS / Elevation | §G charge matrix pinned by unit tests: exactly-once per leg type |
| Selector squatting after withdraw() removal | Spoofing | Loupe test asserting selector absence; stale-calldata revert test |
| Reentrancy on convert | Tampering | Checks-effects-interactions: burn before mint; `_mint` receiver hook fires after burn is final; no external calls. Per-id cap hook reads supply pre-mint-increment? No — hook increments then checks (§C.1); either ordering is consistent within the tx. |
| Depth-gate bypass via crafted id | Tampering | `(id >> 128) == GNUS_TOKEN_ID` is exact for direct children by construction of createNFTs (`parentID << 128 | childCurIndex`); collision guard (D7) prevents id reuse |
| Display-view manipulation | — (read-only) | Floor rounding documented; views revert on id 0 / rate 0; no state impact possible |

**Slither:** CONTEXT enforcement #7 — run slither on changed contracts in this phase (config currently excludes `contracts/gnus-ai/`; either targeted include or fix the exclusion here rather than waiting for Phase 7).

## Sources

### Primary (HIGH confidence) — all read/measured in this session (Revision 2 pass)

- `contracts/gnus-ai/GNUSBridge.sol` — full read: mint overloads 97-110, burn 118-121, `_mint` override 137-155, withdraw 162-191, WR-07 comment 175-179, bridgeOut 203-242 (CR-03 at 221-230), totalSupply facade 250-252, `_mintWithBridgeFee` 77-89
- `contracts/gnus-ai/GNUSNFTFactory.sol` — full read: initializers 24-45, beforeMint 83-94, mint/mintBatch 102-121, createNFTs 152-181, getNFTInfo 187-190
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` — full read: hook 32-85 (isMinting 45, limiter block 75-84, max-supply check 58-63, WR-03/WR-07 comments 66-74)
- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — full read: NFT struct 10-19, Layout pattern 22-42
- `contracts/gnus-ai/GNUSConstants.sol` — full read: GNUS_MAX_SUPPLY 21, GNUS_DECIMALS 17, GNUS_TOKEN_ID 29
- `contracts/gnus-ai/GNUSControl.sol` — full read: chainID setter/getter, protocolInfo, versioned initializer pattern (GNUSControl_Initialize230, 56-64)
- `contracts/gnus-ai/DiamondInitFacet.sol` — full read: versioned-initializer precedent (diamondInitialize250, 43-57)
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` — Layout struct 37-44, storage slot 47-48
- `node_modules/@gnus.ai/contracts-upgradeable-diamond/.../ERC1155SupplyUpgradeable.sol` — totalSupply 32-34, hook increment/decrement 55-70 (ordering vs. max-supply check)
- Compiled artifact bytecode sizes (GNUSBridge 18,872 B; GNUSNFTFactory 23,069 B; GNUSControl 7,287 B; GNUSWithdrawLimiter 7,677 B) — **re-measured this session**
- grep surveys: `bridgeIn|totalSupplyOfAll|globalSupply` (zero hits — provenance is greenfield); `.withdraw(` call sites (5 files); `mint(` call sites in NFTFactory/GNUSNFTFactoryEnhanced tests; `exchangeRate` usage (3 mutating sites + struct + views)
- `.planning/phases/09-.../09-CONTEXT.md` — D1-D10 (Revision-1 locks, annotated above)
- `.planning/config.json` — nyquist_validation: true
- `.planning/ROADMAP.md` — Phase 9 (238-258), Phase 10 (261+), Phase 12 (307+) scope boundaries

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md:149` — 2nd-gen no-burn test assertions referenced via Phase 6 D-02 (not independently re-read; line numbers from REQUIREMENTS text)
- Phase 13 CONTEXT dependency claims — via 09-CONTEXT dependency table; D12 amendment targets taken as accurate per 09-CONTEXT

### Tertiary (LOW confidence)

- Bridge-relayer operational flow (A1) — inferred from the absence of `bridgeIn` and the MINTER_ROLE mint overloads; no relayer code in this repo to verify against. Flagged for planner verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all existing deps verified in-tree
- Architecture: HIGH for on-chain mechanics (all mutation points traced to line numbers); MEDIUM for cross-chain provenance policy (B1 recommended, A2 flagged for user checkpoint — the mechanism is verified-feasible, the product choice is the user's)
- Pitfalls: HIGH — each traced to verified line numbers; the two cross-chain pitfalls (3, 4) are inherent to any counter-based provenance design

**Research date:** 2026-08-04 (Revision 2)
**Valid until:** 2026-09-03 (stable — internal codebase research; re-verify artifact sizes if unrelated PRs land on GNUSBridge/GNUSNFTFactory before planning; the CONTEXT.md D1-D10 annotations must be refreshed if the user formally re-locks decisions)

## RESEARCH COMPLETE

**Phase:** 9 - Per-Child GNUS Treasury/Reserve (Revision 2: Conversion-Native Model)
**Confidence:** HIGH (on-chain mechanics) / MEDIUM (provenance policy choice — user checkpoint needed)

### Key Findings

- **The Revision-2 pivot deletes more than it adds.** The entire reserve apparatus (reserveOf/redeemableBacking/issueBacked/depositToReserve, custody/earmark question, solvency fuzzing) is dead. The on-chain delta shrinks to: beforeMint rewrite (1:1 + depth gate), a small GNUSTreasury facet (convert + 3 views + sync + initialize), a 2-field storage library, and provenance hooks in GNUSBridge. GNUSNFTFactory's 1,507-byte headroom is untouched-to-negative; GNUSBridge shrinks (withdraw dies).
- **CONCERNS #1 dies by construction, twice over:** convert can only release minions the caller holds (ERC-1155 `_burn` balance check), and mint now burns exactly what it mints. No invariant left to violate — the conservation property is structural, not ledgered.
- **The genuinely new surface is cross-chain provenance** (user requirement #6): zero existing infrastructure (no bridgeIn, no counter — verified by grep). Recommended B1: single `globalSupply` counter + mandatory per-chain seed initialize + admin `syncGlobalSupply` + hooks on `_mintWithBridgeFee`/`burn` only. BridgeOut stays untouched (destination's bridge-in mint is the + side). Double-count risks: deploy-time mis-seed (Pitfall 4, mitigated by revert-when-uninitialized) and multi-chain root minting (mitigated by sync ritual; flag for user).
- **WR-07 re-home verified in the new model:** convert's GNUS-terminal leg is a mint → hook-exempt → exactly one explicit charge in convert (super-admin bypass preserved). GNUS→child convert is charged by the hook on its burn leg — do NOT add an explicit charge there (double-charge).
- **Cap enforcement re-splits:** per-id `maxSupply[id]` becomes a minion cap (hook unchanged — semantics only); the 50M global cap moves to `_mintWithBridgeFee` checked against `totalSupplyOfAll()` (the only place global supply grows). Convert's id-0 mint leg must NOT be global-cap-checked (it conserves).
- **Depth ≥2 mint rule (F):** recommend revert-in-favor-of-convert — one issuance tap (depth 1, from free GNUS) + one reallocation verb (convert) keeps tree semantics exact. Needs user sign-off against Phase 13's credit-issuance flows.
- **Three rate-math sites must all die** (NFTFactory:90, Bridge:173, Bridge:224); the bridgeOut one is the easy-to-miss survivor. Post-phase grep for `exchangeRate` in mutating code is a verification step.

### File Created

`/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/phases/09-per-child-gnus-treasury-reserve/09-RESEARCH.md` (updated in place, Revision 2)

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new deps; verified in-tree |
| Architecture (on-chain) | HIGH | All mutation points traced to file/line this session; artifact sizes re-measured |
| Architecture (cross-chain provenance) | MEDIUM | Mechanism verified-feasible; B1-vs-B2 policy choice + relayer flow (A1) need user/ops confirmation |
| Pitfalls | HIGH | Line-number-verified; cross-chain pitfalls inherent to counter designs |
| Test migration | HIGH | Call sites grep-verified; foundry refs should be re-grepped at plan time |

### Open Questions (requiring user checkpoints at plan time)

1. Provenance model depth: B1 eventual-consistency + sync ritual (recommended) vs fuller per-chain tracking (Phase 12 pull-in) — §B, Open Question 1.
2. 3-arg MINTER mint restriction to id 0 (conservation hole) vs preserving child-id bridge-in — §A warning, Open Question 2.
3. Depth ≥2 mint gate: strict revert (recommended) vs admin exception for Phase 13 flows — §F, Open Question 3.
4. `totalSupplyOfAll()` uninitialized behavior: revert (recommended) vs local fallback — Open Question 4.
5. D5 successor: is a `nonConvertible` flag needed in Revision 2 at all — §D5 note, A8.

### Ready for Planning

Research complete. The planner should treat the "Conversion-Native Model (Revision 2)" section as the controlling spec, the annotated D1-D10 as traceability, and questions A–I as the answered design space. Five user checkpoints are queued above; none block drafting the plan (recommendations are given for each), but all five should be confirmed before shipping.
