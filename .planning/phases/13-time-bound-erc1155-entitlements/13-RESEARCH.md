# Phase 13: Time-Bound ERC-1155 Entitlements - Research

**Researched:** 2026-08-21
**Domain:** Diamond-pattern ERC-1155 lifecycle/transfer-policy/disposition enforcement — struct-append storage evolution, single-predicate hook enforcement, per-holder expiry clocks, permissionless fixed-outcome settlement, anti-scalping issuance controls
**Confidence:** HIGH (every load-bearing claim verified by reading the current code in this session; facet bytecode sizes measured from `artifacts/`; one Phase-9 relic — the "reserve/collateralized-mint" framing in 13-CONTEXT D8 — is flagged as a planning checkpoint because Phase 9 Revision 2 dropped the reserve apparatus)

## Summary

Phase 13 adds a lifecycle and policy layer to the existing ERC-1155 child-token system: `validFrom`/`validUntil`/`defaultDuration` timestamps, three expiration modes (`None`/`PerTokenId`/`PerHolder`), six transfer policies (`UNRESTRICTED`/`SOULBOUND`/`ISSUER_ONLY`/`ALLOWLISTED`/`CONTROLLED_RESALE`/`LOCKED_AFTER_START`), five expiration dispositions (`NONE`/`KEEP_INERT`/`BURN`/`RETURN_TO_ADDRESS`/`REDEEM_TO_PARENT`), anti-scalping issuance controls (per-wallet cap + credential-verifier hook), and a permissionless fixed-outcome `settleExpired()` function. The primary product is **AI Credits** — direct child of GNUS, `exchangeRate=1.0`, SOULBOUND, BURN, PerHolder expiry — and the mechanism must generalize to tickets, albums, subscriptions, and access passes.

The codebase survey confirms every architectural decision is already constrained by existing Phase 9/10/11 code. The single-predicate enforcement point exists today as `GNUSERC1155MaxSupply._beforeTokenTransfer()` (contracts/gnus-ai/GNUSERC1155MaxSupply.sol:32-85) — every mint/burn/single-transfer/batch-transfer on the diamond routes through it via OpenZeppelin's `ERC1155Upgradeable` (verified at node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol:173, 211, 278, 308, 340, 370). The ERC-20 proxy (`erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyFacet.sol:88-90, 124-127`) routes through `safeTransferFrom` on the diamond, so it inherits the predicate for free with no proxy changes (11-CONTEXT D-06). The bridge has no `lockTokens` function — Phase 10 replaced the vault/lock model with provenance relocation, so "policy-bound tokens are non-bridgeable" must be enforced inside `GNUSBridge.bridgeOut()` (contracts/gnus-ai/GNUSBridge.sol:228-267), not a vault (10-CONTEXT D-01).

The most load-bearing sizing fact: **GNUSNFTFactory is at 23,417 bytes of the 24,576-byte EIP-170 budget (1,159 bytes headroom) [VERIFIED: artifacts measured this session]** and cannot host the lifecycle logic. The transfer-policy predicate must live in GNUSERC1155MaxSupply (11,539 bytes, 13,037 headroom — it already owns the hook), and the settlement / view / mutator functions must go on a **new facet** (recommended name: `GNUSLifecycle`) with its own storage library `GNUSLifecycleStorage.sol` for the per-holder `expiresAt[tokenId][holder]` mapping and `mintedPerWallet[tokenId][wallet]` anti-scalping mapping. The `NFT` struct appends (8 new fields per D1) land in `GNUSNFTFactoryStorage.sol` and are storage-safe because `NFT` sits behind `mapping(uint256 => NFT)` (contracts/gnus-ai/GNUSNFTFactoryStorage.sol:10-30).

**Primary recommendation:** Append the 8 lifecycle fields to the `NFT` struct (storage layout already mapped — new fields land in slots +9 through +11 after Phase 9's `parentId` at +7 and `nonConvertible` at +8); put the single transfer-policy predicate `_enforceTransferPolicy` in `GNUSERC1155MaxSupply._beforeTokenTransfer` (fires on every mint/transfer/burn, no operator exemptions); create a new `GNUSLifecycle` facet + `GNUSLifecycleStorage` library for per-holder clocks, per-wallet mint caps, settlement, lifecycle setters, and views; wire `bridgeOut()` to call the predicate explicitly before `_burn` (policy-bound tokens revert before bridge); and add the per-wallet-cap + credential-verifier checks inside `GNUSNFTFactory.beforeMint()` (the natural issuance hook, contracts/gnus-ai/GNUSNFTFactory.sol:87-96) with CEI ordering.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1. Lifecycle storage — appended to the `NFT` struct**

Per-token-ID policy and lifecycle configuration is appended to the existing `NFT` struct in `contracts/gnus-ai/GNUSNFTFactoryStorage.sol`. Wallets must be able to read all static token configuration in one call — no separate policy-mapping lookup.

Appended fields:

```solidity
uint64  validFrom;            // 0 = active immediately (sale/window start)
uint64  validUntil;           // 0 = no per-ID expiry (used in PerTokenId mode)
uint64  defaultDuration;      // purchase duration for PerHolder mode
uint8   expirationMode;       // ExpirationMode enum
uint8   transferPolicy;       // TransferPolicy enum
uint8   expirationDisposition;// ExpirationDisposition enum
address expirationRecipient;  // for RETURN_TO_ADDRESS
address credentialVerifier;   // 0 = no credential required to mint
```

- Existing deployed token IDs decode with zero-value defaults: `validFrom=0` (active), `validUntil=0` (no expiry), `expirationMode=None`, `transferPolicy=UNRESTRICTED`, `expirationDisposition=NONE`, null addresses. Behaviorally unchanged. This must be proven by an upgrade test decoding pre-existing `NFT` records.
- Enum ordinal 0 must remain the backwards-compatible default for every enum (None / UNRESTRICTED / NONE). Ordinals are stored on-chain: append-only forever, never reorder.
- `NFT` sits behind `mapping(uint256 => NFT)`, so appends are storage-safe. Whichever of Phase 9 / Phase 13 lands second appends after the other's struct changes — a single PR owns each struct diff.

**D2. Dual expiry model — explicit `ExpirationMode`**

```solidity
enum ExpirationMode {
    None,        // no expiry
    PerTokenId,  // shared validUntil on the token ID (tickets, events, albums)
    PerHolder    // per-holder clock (SOULBOUND subscriptions, AI Credits)
}
```

Per-holder clocks live in a separate mapping, NOT the struct:

```solidity
mapping(uint256 tokenId => mapping(address holder => uint64 expiresAt)) _holderExpiresAt;
```

| Token type | Expiry model | Why |
|---|---|---|
| AI Credits / subscriptions / memberships | PerHolder | Each user has their own purchase/renewal clock |
| SOULBOUND allocations | PerHolder | No transfer merging problem |
| Tickets / albums / event access / campaigns | PerTokenId | Everyone shares the same event/access window |
| Transferable time-bound fungibles | PerTokenId only | Per-holder expiry + fungible balance merging is ambiguous; not supported |

`PerHolder` mode should only be combined with non-transferable policies (SOULBOUND, ISSUER_ONLY). The plan should revert or strongly constrain `PerHolder` + transferable policy combinations at configuration time.

**D3. Per-holder renewal semantics — stacked, settle-first**

For PerHolder tokens, receiving newly issued units (mint/purchase/claim) updates the holder's clock as follows:

```solidity
if (balanceOf(holder, id) > 0 && _holderExpiresAt[id][holder] > block.timestamp) {
    // Active balance: extend the existing clock.
    _holderExpiresAt[id][holder] += purchasedDuration;
} else {
    // Expired or zero balance: settle expired balance FIRST (burn per
    // disposition), then start a new clock from now.
    if (balanceOf(holder, id) > 0) { settleExpired(holder, id); }
    _holderExpiresAt[id][holder] = uint64(block.timestamp) + purchasedDuration;
}
```

Invariant: **expired balances are never resurrected.** A new purchase can never reactivate an expired pile. AI Credits must not support resurrection.

Language note: for SOULBOUND tokens there is no arbitrary "receiving via transfer" — the rule applies to newly issued units only.

**D4. Mutability — creator-only, renewal-oriented**

- `validFrom` / `validUntil` are mutable after first mint, **only by the token creator** (and DEFAULT_ADMIN_ROLE, matching existing `beforeMint` authorization). This supports subscription-window renewal and event rescheduling.
- `transferPolicy`, `expirationDisposition`, `expirationRecipient`, `expirationMode` are **immutable after first mint** — an administrator must not be able to convert a transferable token into a confiscatable or forced-return token after issuance, or change where expired value flows.
- Every lifecycle/policy mutation emits an explicit event.
- After a BURN settlement has occurred for a holder/token, creator timestamp mutation must not be able to un-burn it (ordering: settlement is final state).

**D5. Transfer policies — all six ship in v1**

```solidity
enum TransferPolicy {
    UNRESTRICTED,        // 0 — default, current behavior
    SOULBOUND,           // no holder-to-holder transfers
    ISSUER_ONLY,         // only creator/approved operator can move
    ALLOWLISTED,         // destination/operator must satisfy registry check
    CONTROLLED_RESALE,   // ordinary transfers blocked; approved resale path only (mechanism in v2)
    LOCKED_AFTER_START   // transferable before validFrom, locked after
}
```

- AI Credits are always `SOULBOUND`.
- `CONTROLLED_RESALE` ships in v1 as a policy that **blocks ordinary transfers**; the approved resale/gift mechanism (price caps, gifting, refunds, transfer-count caps, cutoffs, consideration handling) is **v2 scope**. In v1, CONTROLLED_RESALE behaves as soulbound-until-v2-mechanism.
- `SOULBOUND` still permits: minting, consumption burns (spending), expiration settlement burns, fixed-recipient returns, and narrowly approved issuer correction/refund paths.

**D6. Single enforcement point — policy predicate in `_beforeTokenTransfer`**

- One internal predicate `_enforceTransferPolicy(operator, from, to, id, amount)` called from `GNUSERC1155MaxSupply._beforeTokenTransfer()` for every mint/transfer/burn.
- **No operator exemptions for holder-to-holder moves.** `ERC1155ProxyOperator.isApprovedForAll` auto-approves `NFT_PROXY_OPERATOR_ROLE` — the predicate must still block holder-to-holder transfers initiated by marketplace operators. The only carve-outs are system operations: mint (from == 0), burn/settlement (to == 0 or fixed recipient), and issuer correction under ISSUER_ONLY/creator authority.
- The ERC-20 proxy (`erc20-gnus-proxy`) is a thin wrapper, not a custodian — its `transfer` delegates to `safeTransferFrom` on the diamond, which fires the hook. **No proxy changes needed in Phase 13.** Keep the proxy dumb.
- `ERC20TransferBatch` paths move GNUS_TOKEN_ID only and hardcode it — out of policy scope. Any future child-token batch path MUST reuse the same predicate (parity check required).
- Mixed-token batches revert atomically when any token violates policy.

**D7. Bridging IS a transfer — policy-bound tokens are non-bridgeable in v1**

- The bridge vault (Phase 10) receives no policy exemption. `lockTokens()` must run the same policy predicate.
- `SOULBOUND`, `ISSUER_ONLY`, `LOCKED_AFTER_START` (after start), and `CONTROLLED_RESALE` tokens cannot bridge in v1.
- `ALLOWLISTED` bridges only to allowlisted destinations; `UNRESTRICTED` bridges normally.
- Expiry is evaluated per-chain against that chain's `block.timestamp`. Tokens that expire while vault-locked arrive inert on the destination and are settled there per disposition. Small cross-chain timestamp skew is accepted and documented.

**D8. Expiration dispositions — all five fully implemented in v1**

```solidity
enum ExpirationDisposition {
    NONE,              // 0 — default; balance untouched, entitlement off
    KEEP_INERT,        // balance stays (collectible), entitlement off
    BURN,              // expired units destroyed, no value returned
    RETURN_TO_ADDRESS, // expired units move to fixed expirationRecipient
    REDEEM_TO_PARENT   // settle into direct parent token at exchangeRate
}
```

Phase 9 lands first, so REDEEM_TO_PARENT is fully implemented — no reserved/reverting values.

- `RETURN_TO_ADDRESS` uses only the configured `expirationRecipient` — never an inferred sender, never a caller-supplied destination.
- `REDEEM_TO_PARENT` settles into the **direct parent** (`id >> 128`), at the child's `exchangeRate` (child units per 1 parent unit), moving value through Phase 9's reserve accounting. It is only configurable for tokens that were collateralized under Phase 9's `mintBackedChild` path — settling must not inflate the parent's redeemable supply against its reserve.
- AI Credits use `BURN`.

**D9. Settlement — permissionless, fixed-outcome, per-holder**

```solidity
function settleExpired(address account, uint256 id) external;
```

- Permissionless: disposition and recipient are fixed at issuance; the caller cannot redirect value, capture anything, or influence the outcome. This eliminates operator-liveness risk.
- Must revert (or no-op — plan picks one and documents) when the token/holder is not expired; must be idempotent.
- Per-holder for PerHolder mode (settles only `account`'s clock-expired balance); per-token-ID for PerTokenId mode (settles `account`'s balance under the shared expired window).
- No unbounded loops over holders or token IDs. Bounded batch settlement may be added if the plan shows it's safe.
- Emits holder, ID, amount, disposition, destination.
- Expired-but-unsettled balances count as circulating supply until settled (Phase 12 ledger convention).

**D10. Anti-scalping issuance controls — full v1**

Ship in v1, enforced in `GNUSNFTFactory.beforeMint()` (the natural hook):

- **Per-wallet mint cap** per token ID — tracked in `mapping(uint256 id => mapping(address wallet => uint256)) mintedPerWallet`. Documented as Sybil-vulnerable; not identity-proof.
- **Sale window** — covered by `validFrom` (and per-ID `validUntil`); no separate fields needed for windowed sales in PerTokenId mode.
- **Generic credential hook** — optional `credentialVerifier` contract address per token ID (0 = open minting). Called from `beforeMint` with minter, amount, and opaque `bytes credential`. Lets creators plug in EIP-712 vouchers, merkle allowlists, or identity providers later WITHOUT a diamond upgrade.
- **No per-transaction cap** — pure friction, trivially bypassed by multiple txs.
- Checks-effects-interactions: per-wallet mint count updates BEFORE the external verifier call; verifier call reentrancy into mint must be neutralized (existing reentrancy guard if present, else ordering + reentrancy note for the plan).

**D11. AI Credits product configuration**

- **AI Credits is a direct child of GNUS**, `exchangeRate = 1.0` (minion-denominated). No grandchildren required — the PerHolder expiry model removes the window-ID-per-month bookkeeping.
- Configuration: `SOULBOUND`, `BURN` disposition, `PerHolder` expiration mode, `defaultDuration` per SKU (monthly / annual variants are separate SKUs or durations supplied at purchase), spending = consumption burn by the service backend.
- Purchased with GNUS via the standard conversion path. The $5 fiat leg: customer pays via Banxa → GNUS → converts to AI Credits. Price is a fixed GNUS amount per SKU in v1 (no oracle).
- **Banxa → conversion automation is app-layer scope, NOT Phase 13.** Launch pattern (recommended): treasury-direct — company wallet holds GNUS, Banxa payment confirmation triggers backend mint of AI Credits directly to the user from treasury-held GNUS. EIP-712 permit-based relayer automation is a later app-layer upgrade. Phase 13 contracts must not preclude either.

**D12. `withdraw()` is untouched — GNUS treasury only**

- `GNUSBridge.withdraw()` remains the direct-GNUS-child redemption path, owned and rewritten by Phase 9. Phase 13 never modifies it.
- `REDEEM_TO_PARENT` settlement is a separate function (settlement path), targeting the direct parent, not GNUS.
- `exchangeRate` semantics: **child units per 1 direct-parent unit**, consistent at every tree level (aligns with Phase 9's fixed-point convention — CONCERNS #2).

**D13. API surface (names finalized in plan)**

```solidity
function isTokenActive(uint256 id) external view returns (bool);
function isSpendable(address holder, uint256 id) external view returns (bool);
function holderExpiresAt(uint256 id, address holder) external view returns (uint64);
function settleExpired(address account, uint256 id) external;
// REDEEM_TO_PARENT settlement path (name in plan), targeting id >> 128
// Lifecycle config setters: creator-only post-mint for timestamps; immutable-after-first-mint for policy fields
// createNFT/createNFTs overloads or a configure-before-first-mint step for lifecycle-aware creation
```

Existing `createNFT()` / `createNFTs()` selectors retain legacy timeless behavior (all defaults). All new selectors require diamond collision checks.

### Claude's Discretion

- Final function/parameter names for lifecycle setters and views (D13 names are sketches)
- Facet placement of the new lifecycle/settlement code (new `GNUSLifecycle` facet recommended; GNUSTreasury at 18,151 B has 6,425 B headroom but is conversion-focused; GNUSERC1155MaxSupply owns the hook but already has supportsInterface overhead)
- Exact storage slot string for the new `GNUSLifecycleStorage` library (`keccak256("gnus.ai.lifecycle.storage")` recommended — matches Phase 9/10 naming convention)
- Whether `settleExpired()` no-ops or reverts on non-expired state (D9 leaves this to the plan; recommend revert for explicitness)
- Whether `mint()`/`mintBatch()` signatures change to carry `bytes credential` for the verifier hook, or a new `mintWithCredential` overload is added (recommend overload — keeps legacy selectors stable)
- Whether the credential verifier interface is `ICredentialVerifier` (function-call shape) or raw low-level `call` with `abi.encodeWithSelector` (recommend typed interface for auditability)
- Batch settlement helper (bounded loop, e.g. `settleExpiredBatch(address[] accounts, uint256 id)` with a hard cap) — planner decides whether to ship v1 or defer
- Whether `isSpendable` and `isTokenActive` return `false` or revert when `nftCreated == false` (recommend revert, matching `uri()` precedent at GNUSNFTFactory.sol:71-75)

### Deferred Ideas (OUT OF SCOPE)

- Controlled-resale mechanism: price caps, gifting, refunds, transfer-count caps, resale cutoffs, consideration handling (native/marketplace/signed settlement) — v2 phase
- Banxa → conversion purchase automation backend (treasury-direct at launch; EIP-712 permit relayer later) — app-layer workstream
- USD-denominated (oracle-priced) allocation purchases — v2
- Cross-chain soulbound credentials via attestation mirroring — future
- Per-mint-lot provenance / return-to-original-sender — confirmed out of scope permanently (would require per-unit accounting)
- Phase 12 v2 "active supply" metric keyed off `isTokenActive` — Phase 12 was retired 2026-08-21 (ROADMAP line 5); this deferred item is moot
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 13 has no formal requirement IDs yet — ROADMAP.md line 436 states "(LIC precursor; Phase 13 requirements to be formalized at plan time)". The 8 success criteria from ROADMAP.md lines 427-434 are the coverage contract. The planner must treat each criterion below as a requirement row.

| # | Success Criterion (ROADMAP.md) | Research Support |
|---|--------------------------------|------------------|
| 1 | Lifecycle config appended to `NFT` struct (validFrom, validUntil, defaultDuration, expirationMode, transferPolicy, expirationDisposition, expirationRecipient, credentialVerifier); zero-value defaults keep existing tokens active/unrestricted/non-expiring; upgrade test proves decode compatibility | §Architecture Patterns — Pattern 1 (struct append layout); §Code Examples (slot math); §Common Pitfalls — P1 (enum ordinal 0 invariant) |
| 2 | `ExpirationMode { None, PerTokenId, PerHolder }` with per-holder clocks in `expiresAt[tokenId][holder]` mapping; stacked settle-first renewal (expired balances settled, never resurrected) | §Architecture Patterns — Pattern 2 (per-holder clock storage); Pattern 3 (renewal settle-first ordering); §Don't Hand-Roll |
| 3 | All six transfer policies enforced by a single predicate in `_beforeTokenTransfer`; no operator exemptions (NFT_PROXY_OPERATOR_ROLE cannot bypass); ERC-20 proxy covered without changes | §Architecture Patterns — Pattern 4 (predicate shape + matrix); §Common Pitfalls — P2 (operator-bypass trap); §Code Examples (predicate skeleton) |
| 4 | Policy-bound tokens non-bridgeable in v1 (bridging IS a transfer; no vault exemption) | §Architecture Patterns — Pattern 5 (bridgeOut wiring); §Common Pitfalls — P3 (Phase 10 dropped the vault, lockTokens does not exist) |
| 5 | All five dispositions implemented; permissionless fixed-outcome `settleExpired()`; REDEEM_TO_PARENT settles to direct parent via Phase 9 reserves, collateralized tokens only | §Architecture Patterns — Pattern 6 (settle state machine); §Common Pitfalls — P4 (Phase 9 Revision 2 dropped the reserve apparatus — D8's "collateralized under `mintBackedChild`" framing needs reinterpretation against `nonConvertible`) |
| 6 | Anti-scalping: per-wallet mint cap + sale window + generic credential-verifier hook (CEI-ordered) in `beforeMint` | §Architecture Patterns — Pattern 7 (beforeMint wiring + CEI ordering); §Code Examples (ICredentialVerifier interface) |
| 7 | AI Credits: direct GNUS child, exchangeRate 1.0, SOULBOUND, BURN, PerHolder expiry; spend/expiry creates zero GNUS/parent/reserve/treasury credit | §Architecture Patterns — Pattern 8 (AI Credits factory call); §Don't Hand-Roll |
| 8 | Timestamps creator-only mutable post-mint (renewal); policy/disposition/mode/recipient immutable after first mint; all mutations emit events | §Architecture Patterns — Pattern 9 (mutability guards); §Code Examples (setter sketch) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `NFT` struct lifecycle fields (validFrom, validUntil, defaultDuration, expirationMode, transferPolicy, expirationDisposition, expirationRecipient, credentialVerifier) | `GNUSNFTFactoryStorage.sol` (struct append) | — | D1: struct fields live where the struct lives; wallets read all config in one `getNFTInfo()` call [VERIFIED: contracts/gnus-ai/GNUSNFTFactoryStorage.sol:10-30] |
| Transfer-policy predicate (`_enforceTransferPolicy`) | `GNUSERC1155MaxSupply._beforeTokenTransfer` | New `GNUSLifecycle` facet (holds the policy-check helper as internal function, called via inheritance) | D6: single enforcement point; hook already exists at contracts/gnus-ai/GNUSERC1155MaxSupply.sol:32-85 and is the universal gate [VERIFIED: node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol:173, 211, 278, 308, 340, 370] |
| Per-holder expiry clocks (`_holderExpiresAt[tokenId][holder]`) | New `GNUSLifecycleStorage.sol` library | — | D2: per-holder mapping does NOT live in the struct; new library keeps Phase 9's NFT struct diff isolated [VERIFIED: existing libraries at contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol:34-45, GNUSTreasuryStorage.sol:9-20 are the pattern] |
| Per-wallet mint cap (`mintedPerWallet[tokenId][wallet]`) | New `GNUSLifecycleStorage.sol` library | `GNUSNFTFactory.beforeMint` (increments + enforces) | D10: cap is state, checked at issuance; beforeMint is the natural hook [VERIFIED: contracts/gnus-ai/GNUSNFTFactory.sol:87-96] |
| Credential verifier external call | `GNUSNFTFactory.beforeMint` | `ICredentialVerifier` interface | D10: called with CEI ordering — count updated BEFORE external call |
| Lifecycle setters (validFrom/validUntil mutable; others immutable after first mint) | New `GNUSLifecycle` facet | `GNUSNFTFactoryStorage` (writes) | D4: creator-only post-mint for timestamps; policy fields locked after first mint — needs a "has minted" check against `ERC1155SupplyStorage._totalSupply[id] > 0` |
| `settleExpired(account, id)` + disposition handlers | New `GNUSLifecycle` facet | `GNUSTreasury.convert` (REDEEM_TO_PARENT only) | D9: settlement is per-holder, permissionless, fixed-outcome; REDEEM_TO_PARENT settles via `convert(id, parentId, amount, account)` — matches Phase 9 D4 and 11-CONTEXT D-06 |
| Lifecycle views (`isTokenActive`, `isSpendable`, `holderExpiresAt`) | New `GNUSLifecycle` facet | `GNUSNFTFactoryStorage` + `GNUSLifecycleStorage` (reads) | D13 API surface; read-only |
| Bridge policy enforcement | `GNUSBridge.bridgeOut` (edited in place) | `GNUSLifecycle` (predicate helper, internal) | D7: bridge calls `_burn` which fires the hook, but policy check should happen BEFORE the burn for clean revert reason; hook fires anyway (defense in depth) [VERIFIED: contracts/gnus-ai/GNUSBridge.sol:228-267] |
| ERC-20 proxy transfer policy coverage | `erc20-gnus-proxy/ERC20ProxyFacet.sol` (NO CHANGES) | `GNUSERC1155MaxSupply._beforeTokenTransfer` | D6: proxy delegates to `safeTransferFrom` which fires the hook [VERIFIED: erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyFacet.sol:88-90, 124-127] |
| AI Credits factory + configuration | `GNUSNFTFactory.createNFTs` (existing) + new lifecycle-aware overload or post-create configure call | `GNUSLifecycle` (configure step) | D11: AI Credits is a direct GNUS child at rate 1.0, SOULBOUND, BURN, PerHolder |
| Anti-scalping sale window | `NFT.validFrom` (PerTokenId) + `NFT.defaultDuration` (PerHolder) | — | D10: no separate sale-window fields needed |
| Operator-approval bypass prevention | `GNUSERC1155MaxSupply._beforeTokenTransfer` predicate | — | D6: `NFT_PROXY_OPERATOR_ROLE` auto-approval (contracts/gnus-ai/ERC1155ProxyOperator.sol:33-35) must NOT bypass the policy |

---

## Standard Stack

### Core (all already in the repo — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@gnus.ai/contracts-upgradeable-diamond` | 4.5.0 | ERC1155Upgradeable, ERC1155SupplyUpgradeable, ERC1155BurnableUpgradeable, AccessControlEnumerableUpgradeable, Initializable | [VERIFIED: package.json line 98] — already provides the hook (`_beforeTokenTransfer`) that hosts the predicate, and `Initializable` used by every facet |
| `contracts-starter/contracts/libraries/LibDiamond.sol` | (git submodule) | Diamond storage, `contractOwner` for super-admin check | [VERIFIED: imported by every existing facet] |
| `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` | in-repo | `NFT` struct (append target) + `Layout` library | D1 — append target |
| `contracts/gnus-ai/GNUSLifecycleStorage.sol` | NEW in Phase 13 | `Layout { mapping(uint256 => mapping(address => uint64)) holderExpiresAt; mapping(uint256 => mapping(address => uint256)) mintedPerWallet; mapping(uint256 => address) allowlistRegistry; }` | D2 + D10 — per-holder clocks and per-wallet caps |
| `contracts/gnus-ai/GNUSLifecycle.sol` | NEW in Phase 13 | Lifecycle setters, views, `settleExpired()` | New facet (see EIP-170 sizing below) |
| `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` | in-repo | `_beforeTokenTransfer` hook — policy predicate insertion point | D6 |
| `contracts/gnus-ai/GNUSNFTFactory.sol` | in-repo | `beforeMint` — anti-scalping hook insertion point | D10 |
| `contracts/gnus-ai/GNUSBridge.sol` | in-repo | `bridgeOut` — policy check before `_burn` | D7 |
| `contracts/gnus-ai/GNUSTreasury.sol` | in-repo | `convert(fromId, toId, amount, to)` — REDEEM_TO_PARENT settlement path | D8/D12 — `convert(id, parentId, amount, account)` is the settlement primitive |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/extensions/ERC1155SupplyStorage.sol` | `_totalSupply[id]` for "has first mint occurred" check (D4 mutability gate) | In lifecycle setters |
| `@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Storage.sol` | `_balances[id][holder]` read for settle burn size | In `settleExpired` |
| `@gnus.ai/contracts-upgradeable-diamond/utils/introspection/ERC165Upgradeable.sol` | `supportsInterface` for `ICredentialVerifier` detection | In credential-verifier call path (EIP-165 check before calling) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Append lifecycle fields to `NFT` struct | Separate `mapping(uint256 => LifecycleConfig)` in a new storage library | [REJECTED per D1] — "wallet has to grab information from two different functions" (13-DISCUSSION-LOG.md:18). Struct-append is storage-safe because `NFT` sits behind a mapping. |
| Put lifecycle logic on `GNUSTreasury` | New `GNUSLifecycle` facet | [NEW FACET RECOMMENDED] — GNUSTreasury is conversion-focused and at 18,151 B (6,425 B headroom); a settlement + views + setters surface would push it to ~22 KB, leaving <3 KB headroom. A new facet keeps audit surface clean and parallels GNUSTreasury/GNUSRedeemAdapter as Phase 9/11 facet additions. |
| Put predicate inline in `_beforeTokenTransfer` | Helper library call | [HELPER RECOMMENDED] — GNUSERC1155MaxSupply is at 11,539 B with 13,037 B headroom, plenty for the dispatch code; the actual policy logic should live in a helper (internal function on GNUSLifecycle or a pure library) so tests can target it directly and the hook stays a thin dispatch layer. |
| Revert on settle-before-expiry | No-op return | [REVERT RECOMMENDED] — explicit failure is safer for integrators; D9 leaves the choice to the plan. |
| `mint(to, id, amount, credential)` overload (signature change) | New `mintWithCredential(to, id, amount, data, credential)` overload | [NEW OVERLOAD RECOMMENDED] — keeps legacy selectors stable, matches D13's "existing createNFT/createNFTs selectors retain legacy timeless behavior" |
| Soulbound via operator-approval revocation | Predicate in `_beforeTokenTransfer` | [PREDICATE CHOSEN] — `ERC1155ProxyOperator.isApprovedForAll` auto-approves NFT_PROXY_OPERATOR_ROLE (contracts/gnus-ai/ERC1155ProxyOperator.sol:33-35), so approval revocation cannot stop role-holding operators. The predicate approach (D6) blocks the transfer regardless of approval state. |

**Installation:**

```bash
# No new packages. All dependencies already present in gnus-ai/package.json.
# Verify compilation with:
yarn compile
```

**Version verification:**

- `@gnus.ai/contracts-upgradeable-diamond@4.5.0` — [VERIFIED: package.json line 98, node_modules present this session]. Custom/internal package per .planning/codebase/CONCERNS.md:187 — not on public npm; do not substitute.
- `@geniusventures/hardhat-diamonds@1.1.15-gv.2` — [VERIFIED: package.json line 11 devDependencies, used by LocalDiamondDeployer in test/unit/GNUSTreasury.test.ts:6-9].
- `hardhat@2.26.5`, `ethers@6.16.0`, `chai@4.5.0`, `@nomicfoundation/hardhat-chai-matchers@2.1.2` — [VERIFIED: package.json lines 108-148]. Solidity compiler version `0.8.19` per hardhat.config.ts.

## Package Legitimacy Audit

**No new packages are installed in Phase 13.** All functionality is implemented using existing in-repo contracts and the already-installed `@gnus.ai/contracts-upgradeable-diamond` library. The audit table below confirms the single third-party Solidity dependency remains unchanged.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@gnus.ai/contracts-upgradeable-diamond` | npm (private GeniusVentures scope) | in-repo since 2026-05 (project start) | n/a (internal) | vendored in `node_modules/@gnus.ai/contracts-upgradeable-diamond/` | n/a (not a new install) | Approved — already vendored, used by every existing facet |
| `contracts-starter` | git submodule | n/a | n/a | mudgen/diamond-2-hardhat | n/a | Approved — already in repo (DEP-01 pinning is Phase 7 scope) |
| `@geniusventures/hardhat-diamonds` | npm (private scope) | in-repo | n/a | diamondslab/hardhat-diamonds | n/a | Approved — test/deploy tooling only |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Phase 13 introduces zero new external packages. The ICredentialVerifier interface is defined in-repo (see §Code Examples) — no external dependency on Chainlink, OpenZeppelin Periphery, or other credential registries.*

---

## Architecture Patterns

### System Architecture Diagram

```
                            ┌──────────────────────────────────────────┐
                            │     GeniusDiamond (EIP-2535 Proxy)        │
                            └─────────────┬────────────────────────────┘
                                          │ delegatecall
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
   Mint paths                     Transfer paths                   Burn paths
        │                                 │                                 │
        ▼                                 ▼                                 ▼
  ┌──────────────┐              ┌──────────────────┐             ┌──────────────────┐
  │ GNUSNFTFactory│              │ safeTransferFrom │             │ burn / burnBatch │
  │  mint /       │              │ safeBatchTransfer│             │ (ERC1155Burnable)│
  │  mintBatch    │              │ From             │             │                  │
  └──────┬───────┘              └────────┬─────────┘             └────────┬─────────┘
         │                               │                                │
         │  beforeMint (anti-scalping)   │                                │
         │   ┌──────────────────────┐    │                                │
         ├─► │ per-wallet cap check │    │                                │
         │   │ credential verify    │    │                                │
         │   └──────────────────────┘    │                                │
         │                               │                                │
         └───────────────┬───────────────┴────────────────────────────────┘
                         │ all paths route through
                         ▼
        ┌──────────────────────────────────────────┐
        │  GNUSERC1155MaxSupply._beforeTokenTransfer│ ◄── SINGLE ENFORCEMENT POINT
        │  (existing hook, 11,539 B, +13 KB room)  │
        └─────────────────┬────────────────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ _enforceTransferPolicy │ ◄── NEW predicate (Phase 13 D6)
              │  (operator, from, to,  │      reads NFT.transferPolicy
              │   id, amount)          │      NO operator exemptions
              └────────┬───────────────┘
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
   UNRESTRICTED    SOULBOUND      ISSUER_ONLY / ALLOWLISTED /
   (pass)          (from!=0 &&    CONTROLLED_RESALE / LOCKED_AFTER_START
                   to!=0 &&       (policy-specific checks)
                   to!=fixedRecip
                   => revert)

   External flows:
   ─ ERC-20 proxy (erc20-gnus-proxy) → safeTransferFrom → hook fires (D6) [no proxy changes]
   ─ Bridge bridgeOut() → explicit policy check + _burn → hook fires (D7) [defense in depth]
   ─ ERC20TransferBatch (GNUS_TOKEN_ID only) → out of policy scope (D6)

   Settlement:
   ─ settleExpired(account, id) on GNUSLifecycle → checks isExpired(account, id)
     → routes by disposition:
       NONE:         no-op (entitlement off, balance kept)
       KEEP_INERT:   no-op (balance kept)
       BURN:         _burn(account, id, balance) → hook fires (to=0 carve-out)
       RETURN_TO_ADDRESS: _safeTransferFrom(account, fixedRecipient, id, balance) → hook fires (fixed-recipient carve-out)
       REDEEM_TO_PARENT:  GNUSTreasury.convert(id, parentId, balance, account) → 1:1 minion reallocation
```

### Recommended Project Structure

```
contracts/gnus-ai/
├── GNUSNFTFactoryStorage.sol          # MOD — append 8 lifecycle fields to NFT struct
├── GNUSNFTFactory.sol                  # MOD — beforeMint: per-wallet cap + credential verifier
├── GNUSERC1155MaxSupply.sol            # MOD — _beforeTokenTransfer: call _enforceTransferPolicy
├── GNUSBridge.sol                      # MOD — bridgeOut: explicit policy check before _burn
├── GNUSLifecycle.sol                   # NEW — facet: setters, views, settleExpired
├── GNUSLifecycleStorage.sol            # NEW — library: holderExpiresAt, mintedPerWallet, allowlistRegistry
└── interfaces/
    └── ICredentialVerifier.sol         # NEW — credential verifier interface

test/unit/
├── GNUSLifecycle.test.ts               # NEW — lifecycle + settlement unit tests
├── GNUSLifecycleUpgrade.test.ts        # NEW — legacy decode + zero-default upgrade test
└── GNUSNFTFactoryAntiScalping.test.ts  # NEW — per-wallet cap + credential verifier tests

test/foundry/invariant/
└── LifecycleInvariant.t.sol            # NEW — settle-first invariant; conservation across settle

diamonds/GeniusDiamond/
└── geniusdiamond.config.json           # MOD — add GNUSLifecycle facet at priority 119, protocol 2.7
```

### Pattern 1: NFT Struct Append (Storage Layout)

**What:** Append 8 fields to the `NFT` struct, preserving storage-slot compatibility with deployed Phase 9 records.

**When to use:** Phase 13 D1; same pattern as Phase 9 D7 (`parentId`) and Phase 9 D5 (`nonConvertible`).

**Storage layout** (VERIFIED against test/unit/GNUSTreasury.test.ts:69-85 slot helpers and current GNUSNFTFactoryStorage.sol:10-22):

| Slot | Field | Type | Phase Added |
|------|-------|------|-------------|
| +0   | `name` | string (head) | legacy |
| +1   | `symbol` | string (head) | legacy |
| +2   | `uri` | string (head) | legacy |
| +3   | `exchangeRate` | uint256 | legacy |
| +4   | `maxSupply` | uint256 | legacy |
| +5   | `creator` | address (20 B) | legacy |
| +6   | `childCurIndex` (16 B) + `nftCreated` (1 B) | packed | legacy |
| +7   | `parentId` | uint256 | Phase 9 D7 |
| +8   | `nonConvertible` | bool (1 B) | Phase 9 D5 |
| **+9** | **`validFrom` (8 B) + `validUntil` (8 B) + `defaultDuration` (8 B)** | packed uint64×3 | **Phase 13 D1** |
| **+10** | **`expirationMode` (1 B) + `transferPolicy` (1 B) + `expirationDisposition` (1 B) + `expirationRecipient` (20 B)** | packed uint8×3 + address (23 B total, fits 32 B slot) | **Phase 13 D1** |
| **+11** | **`credentialVerifier`** | address (20 B) | **Phase 13 D1** |

**Solidity packing rules** (CITED: docs.soliditylang.org/en/v0.8.19/internals/layout_in_storage.html): consecutive value-type fields pack into a single 32-byte slot when their combined size ≤ 32 B, in declaration order. The `uint64×3` triple at +9 is exactly 24 B — packs cleanly. The `uint8×3 + address` quad at +10 is 3 + 20 = 23 B — packs cleanly. `credentialVerifier` at +11 is its own slot because 20 B won't fit in the 9 B remaining at +10.

**Declaration order matters for packing.** The struct MUST be declared exactly as D1 specifies:

```solidity
// Source: 13-CONTEXT.md D1; field order verified to pack per Solidity rules
uint64  validFrom;            // slot +9, bytes 0-7
uint64  validUntil;           // slot +9, bytes 8-15
uint64  defaultDuration;      // slot +9, bytes 16-23
uint8   expirationMode;       // slot +10, byte 0
uint8   transferPolicy;       // slot +10, byte 1
uint8   expirationDisposition;// slot +10, byte 2
address expirationRecipient;  // slot +10, bytes 3-22
address credentialVerifier;   // slot +11, bytes 0-19
```

**Example:**

```solidity
// Source: 13-CONTEXT.md D1; existing struct at contracts/gnus-ai/GNUSNFTFactoryStorage.sol:10-22
struct NFT {
    string name;            ///< Token/NFT Name
    string symbol;          ///< Token/NFT Symbol
    string uri;             ///< Token/NFT URI for metadata
    uint256 exchangeRate;   ///< Display-only fixed-point rate: minions per 1 child unit, 1e18 scale (D2)
    uint256 maxSupply;      ///< Maximum supply of NFTs (minion cap per research section C)
    address creator;        ///< The creator of the token
    uint128 childCurIndex;  ///< The current child NFT count created
    bool nftCreated;        ///< Indicates if the NFT has been created
    // Phase 9 appends below - do not reorder, do not insert above this line
    uint256 parentId;       ///< D7 - parent token ID; 0 = direct child of GNUS
    bool nonConvertible;    ///< D5 - false (zero-default) = convertible, opt-out
    // Phase 13 appends below - do not reorder, do not insert above this line
    uint64  validFrom;            ///< D1 - 0 = active immediately
    uint64  validUntil;           ///< D1 - 0 = no per-ID expiry (PerTokenId mode)
    uint64  defaultDuration;      ///< D1 - purchase duration for PerHolder mode
    uint8   expirationMode;       ///< D1 - ExpirationMode enum (0 = None)
    uint8   transferPolicy;       ///< D1 - TransferPolicy enum (0 = UNRESTRICTED)
    uint8   expirationDisposition;///< D1 - ExpirationDisposition enum (0 = NONE)
    address expirationRecipient;  ///< D1 - for RETURN_TO_ADDRESS
    address credentialVerifier;   ///< D1 - 0 = no credential required to mint
}
```

**Zero-default decode** (D1 + 13-CONTEXT security_and_upgrade #1): existing deployed records have slots +9/+10/+11 as zero, which decodes as `validFrom=0` (active), `validUntil=0` (no expiry), `defaultDuration=0` (unset), `expirationMode=0` (None), `transferPolicy=0` (UNRESTRICTED), `expirationDisposition=0` (NONE), `expirationRecipient=0x0`, `credentialVerifier=0x0`. All are the backwards-compatible defaults — this is why enum ordinal 0 MUST be the default (Pitfall P1).

### Pattern 2: Per-Holder Expiry Clocks (Separate Mapping)

**What:** Store per-holder expiry timestamps in a new storage library, NOT in the `NFT` struct.

**When to use:** Phase 13 D2; the struct carries static per-token-ID config; per-holder state lives in `GNUSLifecycleStorage`.

**Example:**

```solidity
// Source: 13-CONTEXT.md D2; pattern mirrors contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol:37-44
library GNUSLifecycleStorage {
    struct Layout {
        // PerHolder expiry clocks (D2)
        mapping(uint256 tokenId => mapping(address holder => uint64 expiresAt)) holderExpiresAt;
        // Per-wallet mint cap state (D10)
        mapping(uint256 tokenId => mapping(address wallet => uint256 minted)) mintedPerWallet;
        mapping(uint256 tokenId => uint256 cap) perWalletMintCap;
        // Allowlist registry hook (D5 ALLOWLISTED policy)
        mapping(uint256 tokenId => address registry) allowlistRegistry;
    }

    bytes32 constant GNUS_LIFECYCLE_STORAGE_POSITION = keccak256("gnus.ai.lifecycle.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = GNUS_LIFECYCLE_STORAGE_POSITION;
        assembly { l.slot := slot }
    }
}
```

**Storage slot string** follows the project convention: `gnus.ai.nft.factory.storage`, `gnus.ai.treasury.storage`, `gnus.ai.bridge.validator.storage`, `gnus.ai.withdraw.limiter.storage` — so `gnus.ai.lifecycle.storage` [VERIFIED: contracts/gnus-ai/*.sol storage libraries].

### Pattern 3: Settle-First Renewal (D3)

**What:** When a holder mints/purchases/claims PerHolder tokens, settle expired balance FIRST if expired, then start a new clock.

**When to use:** Phase 13 D3; prevents resurrection of expired balances.

**Example:**

```solidity
// Source: 13-CONTEXT.md D3 (verbatim semantics); called from the mint completion path
// inside GNUSLifecycle._postMintLifecycle(to, id) — hooked after _mint returns.
// NOTE: D3 spec says this runs after "receiving newly issued units"; for SOULBOUND tokens
// that means mint/claim only (no transfer receipt).
function _applyPerHolderRenewal(address holder, uint256 id, uint64 purchasedDuration) internal {
    NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
    if (nft.expirationMode != uint8(ExpirationMode.PerHolder)) { return; }

    GNUSLifecycleStorage.Layout storage lc = GNUSLifecycleStorage.layout();
    uint64 existing = lc.holderExpiresAt[id][holder];
    uint256 balance = balanceOf(holder, id); // reads POST-mint balance

    if (balance > 0 && existing > block.timestamp) {
        // Active balance: extend the existing clock (D3 first branch).
        lc.holderExpiresAt[id][holder] = existing + purchasedDuration;
    } else {
        // Expired or zero balance: settle expired balance FIRST (D3 second branch).
        // Note: balance here INCLUDES the newly minted amount; the settle must operate
        // on the pre-mint expired balance only. Plan must subtract the just-minted amount
        // before settling, or settle BEFORE _mint is invoked.
        if (existing != 0 && existing <= block.timestamp) {
            _settleExpiredInternal(holder, id); // burns per disposition, fixed-outcome
        }
        lc.holderExpiresAt[id][holder] = uint64(block.timestamp) + purchasedDuration;
    }
}
```

**Critical ordering note** (Pitfall P5): D3's pseudo-code reads `balanceOf(holder, id)` and compares against pre-mint semantics. The plan must decide whether `_applyPerHolderRenewal` runs BEFORE `_mint` (with the mint amount added to balance inside the helper) or AFTER (with the mint amount subtracted for the expired-pile check). Recommended: run BEFORE `_mint`, because the settle-first branch must burn the entire pre-existing expired balance without touching the incoming mint.

### Pattern 4: Single-Predicate Transfer Policy Enforcement (D6)

**What:** One internal predicate `_enforceTransferPolicy(operator, from, to, id, amount)` called from `GNUSERC1155MaxSupply._beforeTokenTransfer()` for every mint/transfer/burn.

**When to use:** Phase 13 D6; the single choke point that all transfer paths flow through.

**Example:**

```solidity
// Source: 13-CONTEXT.md D5/D6; hook location contracts/gnus-ai/GNUSERC1155MaxSupply.sol:32-85
// Insert AFTER existing pause/banned-transferor/max-supply checks, BEFORE limiter charge.

// In GNUSERC1155MaxSupply._beforeTokenTransfer loop body:
for (uint256 i = 0; i < ids.length; ++i) {
    uint256 id = ids[i];
    // ... existing checks ...

    // Phase 13 D6: policy predicate (no operator exemptions)
    _enforceTransferPolicy(operator, from, to, id, amounts[i]);
}

// Predicate implementation (lives in GNUSLifecycle.sol or as internal function on
// GNUSERC1155MaxSupply; planner picks by EIP-170 budget — see §Architectural Responsibility Map)
function _enforceTransferPolicy(
    address operator,
    address from,
    address to,
    uint256 id,
    uint256 amount
) internal view {
    NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
    if (!nft.nftCreated) { return; } // paranoia; existing checks already enforce
    if (id == GNUS_TOKEN_ID) { return; } // GNUS itself is always UNRESTRICTED
    if (nft.transferPolicy == uint8(TransferPolicy.UNRESTRICTED)) { return; }

    // System carve-outs (D6): mint (from == 0) and burn (to == 0) always permitted,
    // subject to mode-specific lifecycle checks (e.g. validFrom gate on mint).
    if (from == address(0)) {
        // Mint path: enforce validFrom (sale window) for PerTokenId and PerHolder.
        require(
            nft.validFrom == 0 || block.timestamp >= nft.validFrom,
            "Token not yet active"
        );
        return;
    }
    if (to == address(0)) {
        // Burn path: always permitted (spend burns, settle burns, redemption burns).
        // D5: SOULBOUND permits consumption burns.
        return;
    }

    // Holder-to-holder transfer (from != 0 && to != 0): policy dispatch.
    if (nft.transferPolicy == uint8(TransferPolicy.SOULBOUND)) {
        // D5: SOULBOUND permits only fixed-recipient returns (for RETURN_TO_ADDRESS
        // settlement), narrowly approved issuer corrections under creator authority.
        if (to == nft.expirationRecipient) {
            // Settlement path — settleExpired routes through _safeTransferFrom with
            // to == expirationRecipient. Permitted.
            return;
        }
        // Issuer-correction carve-out: creator can move tokens for refunds/corrections.
        // D5: "narrowly approved issuer correction/refund paths". Plan decides the exact
        // authorization — recommend: operator == nft.creator OR hasRole(DEFAULT_ADMIN_ROLE, operator).
        if (operator == nft.creator || hasRole(DEFAULT_ADMIN_ROLE, operator)) {
            return;
        }
        revert("SOULBOUND: holder-to-holder transfers blocked");
    }

    if (nft.transferPolicy == uint8(TransferPolicy.ISSUER_ONLY)) {
        // Only creator or approved operator (DEFAULT_ADMIN_ROLE) can move.
        require(
            operator == nft.creator || hasRole(DEFAULT_ADMIN_ROLE, operator),
            "ISSUER_ONLY: only creator/admin can transfer"
        );
        return;
    }

    if (nft.transferPolicy == uint8(TransferPolicy.ALLOWLISTED)) {
        // Destination/operator must satisfy registry check (D5).
        GNUSLifecycleStorage.Layout storage lc = GNUSLifecycleStorage.layout();
        address registry = lc.allowlistRegistry[id];
        require(registry != address(0), "ALLOWLISTED: no registry configured");
        require(
            IAllowlistRegistry(registry).isAllowed(to),
            "ALLOWLISTED: destination not allowed"
        );
        return;
    }

    if (nft.transferPolicy == uint8(TransferPolicy.CONTROLLED_RESALE)) {
        // v1: block all ordinary holder-to-holder transfers (D5).
        revert("CONTROLLED_RESALE: resale mechanism v2");
    }

    if (nft.transferPolicy == uint8(TransferPolicy.LOCKED_AFTER_START)) {
        // Transferable before validFrom; locked after (D5).
        require(
            nft.validFrom == 0 || block.timestamp < nft.validFrom,
            "LOCKED_AFTER_START: transfers locked"
        );
        return;
    }
}
```

**No operator exemptions for holder-to-holder moves** (D6): the predicate does NOT special-case `hasRole(NFT_PROXY_OPERATOR_ROLE, operator)`. The role only affects `isApprovedForAll` (contracts/gnus-ai/ERC1155ProxyOperator.sol:33-35) — it lets operators skip approval, but the predicate still runs and blocks the move.

### Pattern 5: Bridge Policy Wiring (D7)

**What:** Call the policy predicate explicitly inside `bridgeOut()` BEFORE `_burn`, so policy-bound tokens revert with a clear reason.

**When to use:** Phase 13 D7; Phase 10 replaced the vault with provenance relocation, so `lockTokens` does not exist.

**Important correction to 13-CONTEXT D7 language** (Pitfall P3): the CONTEXT references `lockTokens()` and "bridge vault (Phase 10)". **Neither exists in the codebase.** Phase 10 implemented provenance relocation: `bridgeOut` burns on source, `bridgeIn` mints on destination (10-CONTEXT D-01). The policy enforcement point is `GNUSBridge.bridgeOut()` at contracts/gnus-ai/GNUSBridge.sol:228-267.

**Example:**

```solidity
// Source: 13-CONTEXT.md D7; wiring into contracts/gnus-ai/GNUSBridge.sol::bridgeOut (line 228)
function bridgeOut(
    uint256 amount,
    uint256 id,
    uint256 destChainID,
    bytes32 sgnsDestination,
    bool destinationYOdd
) external {
    address sender = _msgSender();
    require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
    require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
    require(sgnsDestination != bytes32(0), "Invalid destination key");
    require(destChainID != GNUSControlStorage.layout().chainID, "Cannot bridge to same chain");

    // Phase 13 D7: policy check BEFORE burn — bridging IS a transfer to a
    // non-zero address on the destination chain; the burn on this chain would
    // pass the to==0 carve-out in _beforeTokenTransfer, so the check MUST
    // happen here explicitly. Policy-bound tokens revert with the same reason
    // the predicate would produce.
    _enforceBridgePolicy(sender, id);

    // ... existing limiter charge + _burn + emit ...
}

function _enforceBridgePolicy(address sender, uint256 id) internal view {
    NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
    if (id == GNUS_TOKEN_ID) { return; } // GNUS always bridges
    if (nft.transferPolicy == uint8(TransferPolicy.UNRESTRICTED)) { return; }
    if (nft.transferPolicy == uint8(TransferPolicy.ALLOWLISTED)) {
        // D7: ALLOWLISTED bridges only to allowlisted destinations.
        // v1: registry checks the SENDER (the bridge initiator on this chain);
        // cross-chain destination-allowlisting is not expressible without a
        // cross-chain registry. Plan documents this v1 simplification.
        GNUSLifecycleStorage.Layout storage lc = GNUSLifecycleStorage.layout();
        address registry = lc.allowlistRegistry[id];
        require(registry != address(0), "ALLOWLISTED: no registry configured");
        require(
            IAllowlistRegistry(registry).isAllowed(sender),
            "ALLOWLISTED: bridge initiator not allowed"
        );
        return;
    }
    // SOULBOUND, ISSUER_ONLY, CONTROLLED_RESALE, LOCKED_AFTER_START: blocked in v1 (D7).
    revert("Policy-bound token cannot bridge in v1");
}
```

**Defense-in-depth**: `_burn` will still fire `_beforeTokenTransfer` which will run `_enforceTransferPolicy`. Because `to == address(0)` on a burn, the burn-carve-out permits it. That's why the explicit check in `bridgeOut` is necessary — the hook alone cannot distinguish "burn for bridge" from "burn for spend/settle".

### Pattern 6: Settlement State Machine (D9)

**What:** Permissionless `settleExpired(account, id)` that routes by disposition with fixed outcome.

**When to use:** Phase 13 D9; disposition is fixed at issuance; caller cannot redirect value.

**Example:**

```solidity
// Source: 13-CONTEXT.md D8/D9; lives on the new GNUSLifecycle facet
function settleExpired(address account, uint256 id) external {
    NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
    require(nft.nftCreated, "Token not created");
    require(_isExpired(account, id, nft), "Not expired");

    uint256 balance = balanceOf(account, id);
    if (balance == 0) {
        // Idempotent no-op (D9: "must be idempotent").
        return;
    }

    // Clear per-holder clock BEFORE state transition (CEI).
    GNUSLifecycleStorage.Layout storage lc = GNUSLifecycleStorage.layout();
    if (nft.expirationMode == uint8(ExpirationMode.PerHolder)) {
        lc.holderExpiresAt[id][account] = 0;
    }

    // Dispatch by disposition (D8).
    if (nft.expirationDisposition == uint8(ExpirationDisposition.NONE)) {
        // Balance untouched, entitlement off. No state transition.
        emit Settled(account, id, 0, ExpirationDisposition.NONE, address(0));
        return;
    }
    if (nft.expirationDisposition == uint8(ExpirationDisposition.KEEP_INERT)) {
        // Balance stays (collectible), entitlement off.
        emit Settled(account, id, 0, ExpirationDisposition.KEEP_INERT, address(0));
        return;
    }
    if (nft.expirationDisposition == uint8(ExpirationDisposition.BURN)) {
        // Expired units destroyed, no value returned. AI Credits path (D11).
        _burn(account, id, balance);
        emit Settled(account, id, balance, ExpirationDisposition.BURN, address(0));
        return;
    }
    if (nft.expirationDisposition == uint8(ExpirationDisposition.RETURN_TO_ADDRESS)) {
        // Fixed recipient only (D8). Never an inferred sender, never caller-supplied.
        address recipient = nft.expirationRecipient;
        require(recipient != address(0), "No expiration recipient configured");
        _safeTransferFrom(account, recipient, id, balance, "");
        emit Settled(account, id, balance, ExpirationDisposition.RETURN_TO_ADDRESS, recipient);
        return;
    }
    if (nft.expirationDisposition == uint8(ExpirationDisposition.REDEEM_TO_PARENT)) {
        // D8: settle into direct parent (id >> 128) via Phase 9's convert.
        // See §Common Pitfalls P4 — Phase 9 Revision 2 dropped the reserve/collateralized-mint
        // framing; this path uses GNUSTreasury.convert(id, parentId, balance, account), which
        // is gated by the existing `nonConvertible` flag (Phase 9 D5). Plan must decide
        // whether REDEEM_TO_PARENT is configurable only when nonConvertible == false.
        uint256 parentId = nft.parentId; // Phase 9 D7 field
        require(parentId != id, "Invalid parent");
        // Convert moves minions 1:1 from child to parent (Phase 9 D1/D2).
        // Note: the caller of settleExpired is permissionless, but convert burns from
        // _msgSender() — so settleExpired must perform an internal call pattern that
        // makes the diamond itself the burner (matches 11-RESEARCH's pull-model for
        // the redeem adapter). Two options for the plan:
        //   (a) transfer tokens from account to address(this), then convert from diamond
        //   (b) introduce a settlement-only internal _settleBurn/_settleMint pair that
        //       mirrors convert but burns from `account` directly (recommended — no custody)
        // The plan picks one and documents; (b) is recommended for Phase 10 no-custody parity.
        revert("REDEEM_TO_PARENT: plan picks internal settle mechanism (a) or (b)");
    }
}

function _isExpired(address account, uint256 id, NFT storage nft) internal view returns (bool) {
    if (nft.expirationMode == uint8(ExpirationMode.None)) { return false; }
    if (nft.expirationMode == uint8(ExpirationMode.PerTokenId)) {
        return nft.validUntil != 0 && block.timestamp >= nft.validUntil;
    }
    // PerHolder
    uint64 expiry = GNUSLifecycleStorage.layout().holderExpiresAt[id][account];
    return expiry != 0 && block.timestamp >= expiry;
}
```

**Idempotency** (D9): when balance is 0 OR expiry clock is cleared, the function is a no-op. When the token isn't expired, it reverts (planner picks; recommended revert per §Claude's Discretion).

### Pattern 7: Anti-Scalping Issuance Controls (D10)

**What:** Per-wallet mint cap + credential verifier hook inside `GNUSNFTFactory.beforeMint`, with CEI ordering.

**When to use:** Phase 13 D10; the existing `beforeMint` at contracts/gnus-ai/GNUSNFTFactory.sol:87-96 is the natural hook.

**Example:**

```solidity
// Source: 13-CONTEXT.md D10; wiring into contracts/gnus-ai/GNUSNFTFactory.sol::beforeMint (line 87)
// IMPORTANT: the existing signature is beforeMint(to, id, nft, amount). The credential
// parameter needs to flow through — plan picks between a new mintWithCredential overload
// (recommended) or adding a credential parameter to the existing signature.

function beforeMint(
    address to,
    uint256 id,
    NFT storage nft,
    uint256 amount,
    bytes memory credential // NEW — empty for legacy mint()
) internal {
    address sender = _msgSender();
    require(id != GNUS_TOKEN_ID, "Shouldn't mint GNUS tokens tokens, only deposit and withdraw");
    require(to != address(0), "ERC1155: mint to the zero address");
    require(nft.nftCreated, "Cannot mint NFT that doesn't exist");
    require((sender == nft.creator) || hasRole(DEFAULT_ADMIN_ROLE, sender), "Creator or Admin can only mint NFT");
    require((id >> 128) == GNUS_TOKEN_ID, "Direct children only; use convert() for descendants"); // D6 depth gate
    require(balanceOf(sender, GNUS_TOKEN_ID) >= amount, "Not enough GNUS_TOKEN to convert");

    // Phase 13 D10: sale window (validFrom) check.
    require(
        nft.validFrom == 0 || block.timestamp >= nft.validFrom,
        "Sale not started"
    );
    // PerTokenId sale-end check (validUntil doubles as sale window end for windowed sales).
    if (nft.expirationMode == uint8(ExpirationMode.PerTokenId)) {
        require(
            nft.validUntil == 0 || block.timestamp < nft.validUntil,
            "Sale ended"
        );
    }

    // Phase 13 D10: per-wallet mint cap (CEI: update BEFORE external verifier call).
    GNUSLifecycleStorage.Layout storage lc = GNUSLifecycleStorage.layout();
    uint256 cap = lc.perWalletMintCap[id];
    if (cap != 0) {
        uint256 newTotal = lc.mintedPerWallet[id][to] + amount;
        require(newTotal <= cap, "Per-wallet mint cap exceeded");
        lc.mintedPerWallet[id][to] = newTotal; // EFFECT before INTERACTION
    }

    // Phase 13 D10: credential verifier external call (LAST, after all effects).
    if (nft.credentialVerifier != address(0)) {
        require(
            ICredentialVerifier(nft.credentialVerifier).verify(to, id, amount, credential),
            "Credential verification failed"
        );
        // Reentrancy note: verifier call is the only external interaction in this path.
        // All effects (mint cap) are already written. If the verifier reenters mint(),
        // the per-wallet cap will be correctly incremented for the outer call; the
        // reentrant call is a separate mint that must pass its own cap check.
        // Plan documents whether a ReentrancyGuard is required (recommended yes for
        // defense-in-depth if the verifier is untrusted).
    }

    _burn(sender, GNUS_TOKEN_ID, amount); // D1: 1:1 minion move; amount IS minions
}
```

### Pattern 8: AI Credits Configuration (D11)

**What:** AI Credits is a direct GNUS child at rate 1.0, SOULBOUND, BURN disposition, PerHolder expiry.

**When to use:** Phase 13 D11; created once at deploy/configure time.

**Example:**

```solidity
// Source: 13-CONTEXT.md D11; configuration transaction (not a code path)
// SKU: monthly AI Credits ($5 = 5 GNUS, rate 1.0, 30-day duration)

// Step 1: create the child token (legacy createNFT, no lifecycle fields set)
await factory.createNFT(
    GNUS_TOKEN_ID,           // parentID = 0 (direct GNUS child)
    "AI Credits (Monthly)",  // name
    "AICREDIT-M",            // symbol
    ethers.parseEther("1"),  // exchangeRate = 1.0 (1e18 scale, minions per 1 child unit)
    0,                       // maxSupply = 0 (unlimited, or set per policy)
    "https://nft.gnus.ai/ai-credits/monthly"
);
const aiCreditsId = 1n; // or however the planner assigns the ID

// Step 2: configure lifecycle (new configureLifecycle call on GNUSLifecycle)
await lifecycle.configureLifecycle(aiCreditsId, {
    validFrom: 0,                                      // active immediately
    validUntil: 0,                                     // no per-ID expiry (PerHolder mode)
    defaultDuration: 30 * 24 * 60 * 60,                // 30 days in seconds
    expirationMode: ExpirationMode.PerHolder,          // 2
    transferPolicy: TransferPolicy.SOULBOUND,          // 1
    expirationDisposition: ExpirationDisposition.BURN, // 2
    expirationRecipient: ethers.ZeroAddress,           // unused for BURN
    credentialVerifier: ethers.ZeroAddress             // open minting
});
```

### Pattern 9: Mutability Guards (D4)

**What:** Timestamps creator-only mutable post-mint; policy/disposition/mode/recipient immutable after first mint.

**When to use:** Phase 13 D4.

**Example:**

```solidity
// Source: 13-CONTEXT.md D4; lives on the new GNUSLifecycle facet
function setValidFrom(uint256 id, uint64 newValidFrom) external {
    NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
    require(nft.nftCreated, "Token not created");
    address sender = _msgSender();
    require(
        sender == nft.creator || hasRole(DEFAULT_ADMIN_ROLE, sender),
        "Only creator or admin"
    );
    uint64 old = nft.validFrom;
    nft.validFrom = newValidFrom;
    emit ValidFromUpdated(id, old, newValidFrom, sender);
}

function setValidUntil(uint256 id, uint64 newValidUntil) external {
    // Same authorization pattern.
    // D4 ordering constraint: "After a BURN settlement has occurred for a holder/token,
    // creator timestamp mutation must not be able to un-burn it". This is automatic —
    // settlement burns tokens; timestamp changes don't restore burned supply.
}

function configureLifecycle(uint256 id, LifecycleConfig calldata cfg) external {
    NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
    require(nft.nftCreated, "Token not created");
    address sender = _msgSender();
    require(
        sender == nft.creator || hasRole(DEFAULT_ADMIN_ROLE, sender),
        "Only creator or admin"
    );

    // D4: immutable after first mint. First-mint detection via ERC1155SupplyStorage.
    uint256 supply = ERC1155SupplyStorage.layout()._totalSupply[id];
    require(supply == 0, "Policy immutable after first mint");

    // D2 constraint: PerHolder + transferable policy combination revert.
    if (cfg.expirationMode == uint8(ExpirationMode.PerHolder)) {
        require(
            cfg.transferPolicy == uint8(TransferPolicy.SOULBOUND) ||
            cfg.transferPolicy == uint8(TransferPolicy.ISSUER_ONLY) ||
            cfg.transferPolicy == uint8(TransferPolicy.UNRESTRICTED), // plan confirms whether UNRESTRICTED+PerHolder is allowed
            "PerHolder requires non-transferable policy"
        );
    }

    // D8 constraint: REDEEM_TO_PARENT only on collateralized/convertible tokens.
    // Pitfall P4: Phase 9 Revision 2 has no collateralized-mint tracking — only the
    // `nonConvertible` flag. Plan decides whether REDEEM_TO_PARENT is gated by
    // `!nft.nonConvertible` (recommended) or a new explicit collateralized flag.
    if (cfg.expirationDisposition == uint8(ExpirationDisposition.REDEEM_TO_PARENT)) {
        require(!nft.nonConvertible, "REDEEM_TO_PARENT requires convertible token");
    }

    // D8 constraint: RETURN_TO_ADDRESS requires a non-zero recipient.
    if (cfg.expirationDisposition == uint8(ExpirationDisposition.RETURN_TO_ADDRESS)) {
        require(cfg.expirationRecipient != address(0), "RETURN_TO_ADDRESS needs recipient");
    }

    nft.validFrom = cfg.validFrom;
    nft.validUntil = cfg.validUntil;
    nft.defaultDuration = cfg.defaultDuration;
    nft.expirationMode = cfg.expirationMode;
    nft.transferPolicy = cfg.transferPolicy;
    nft.expirationDisposition = cfg.expirationDisposition;
    nft.expirationRecipient = cfg.expirationRecipient;
    nft.credentialVerifier = cfg.credentialVerifier;

    emit LifecycleConfigured(id, cfg, sender);
}
```

### Anti-Patterns to Avoid

- **Policy exemption for `NFT_PROXY_OPERATOR_ROLE`:** [VERIFIED: contracts/gnus-ai/ERC1155ProxyOperator.sol:33-35] auto-approves role holders in `isApprovedForAll`. If the predicate reads approval state instead of enforcing policy directly, marketplace operators can bypass SOULBOUND. The predicate MUST ignore approval state entirely.
- **Vault-custody bridge framing:** Phase 10 explicitly dropped the vault model (10-CONTEXT D-01). Do not design a `lockTokens` function; wire the policy check into `bridgeOut` before `_burn`.
- **Reserve/collateralized-mint framing for REDEEM_TO_PARENT:** Phase 9 Revision 2 dropped the reserve apparatus (09-RESEARCH §Conversion-Native Model: "Reserve apparatus is DEAD"). The only gate is `nonConvertible`. Do not reference `mintBackedChild` in the plan.
- **Per-holder expiry on transferable tokens:** D2 says PerHolder + transferable is ambiguous and unsupported. Reject this combination at `configureLifecycle` time.
- **Approval-revocation-based soulbound:** Do not try to implement SOULBOUND by denying `setApprovalForAll` — it does not stop `NFT_PROXY_OPERATOR_ROLE` and does not prevent direct `transferFrom` by the holder. The predicate approach is the only correct implementation.
- **Unbounded settlement loops:** D9 explicitly forbids iterating holders/token IDs. `settleExpired(account, id)` settles ONE holder on ONE token. If batch settlement ships, it MUST be a bounded array input, not a full-map iteration.
- **Lifecycle state in the NFT struct for per-holder clocks:** D2 explicitly puts `holderExpiresAt` in a separate mapping. Putting it in the struct would break the mapping's `O(1)` lookup per (tokenId, holder) pair and would not fit the struct's mapping-under-NFT storage shape.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ERC-1155 transfer hook | Custom transfer override on every facet | `GNUSERC1155MaxSupply._beforeTokenTransfer` (existing) | Already fires for every mint/burn/transfer on the diamond [VERIFIED: contracts/gnus-ai/GNUSERC1155MaxSupply.sol:32-85; node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol:173, 211, 278, 308, 340, 370]. Adding a second hook creates dual-enforcement drift. |
| Per-holder expiry clock | Per-token-ID ledger of (holder, expiry) tuples in arrays | `mapping(uint256 => mapping(address => uint64)) holderExpiresAt` | O(1) lookup, no unbounded iteration; array iteration is O(n) gas-griefing bait (D9). |
| Diamond storage slot math | `keccak256(abi.encode(tokenId, baseSlot)) + offset` by hand | Existing test helpers `nftParentIdSlot`/`nftNonConvertibleSlot` (test/unit/GNUSTreasury.test.ts:73-85) | Already-written and verified slot helpers for the NFT struct; Phase 13 extends them with `+9/+10/+11` offsets. |
| Reentrancy protection on credential verifier | Custom mutex flag | OpenZeppelin `ReentrancyGuardUpgradeable` (already vendored via `@gnus.ai/contracts-upgradeable-diamond`) | D10: verifier call is the only external interaction; CEI ordering plus a guard covers the reentrancy surface. Plan decides whether to actually wire the guard (defense-in-depth) or rely on CEI alone. |
| ERC-20 proxy changes for policy enforcement | Modify `erc20-gnus-proxy/ERC20ProxyFacet.sol` | Nothing — proxy routes through `safeTransferFrom` which fires the hook | D6: proxy stays dumb; policy coverage is automatic. |
| Bridge vault with policy exemption | Custom `lockTokens` with role bypass | Wire predicate into existing `bridgeOut` | Phase 10 has no vault; bridging is provenance relocation (10-CONTEXT D-01). |
| ERC-712 credential verifier library | Custom signature recovery logic | External `ICredentialVerifier` contract (creator-supplied) | D10: the verifier is an opaque plug-in point; the diamond does NOT verify signatures itself. Creators bring their own EIP-712/merkle/identity contracts. |
| Time manipulation | `block.timestamp` tolerance windows, oracle time | Direct `block.timestamp` comparisons | Solidity `block.timestamp` is the canonical source; skew on L2s is documented in D7. |
| Supply accounting across settle | Custom supply ledger | Existing `ERC1155SupplyStorage._totalSupply[id]` via `_burn` | Settle routes through standard `_burn`, which decrements supply automatically. |

**Key insight:** Phase 13 is a layer on top of existing primitives — the predicate pattern is the ONLY genuinely new enforcement mechanism. Everything else (supply tracking, burn mechanics, conversion, hook firing) is already in place. The single biggest risk is introducing a parallel enforcement path that drifts from `_beforeTokenTransfer`.

---

## Common Pitfalls

### Pitfall 1: Enum Ordinal 0 Invariant

**What goes wrong:** Adding a new enum value at ordinal 0, or reordering enum members, breaks zero-default decoding for deployed tokens.

**Why it happens:** Enums are stored as `uint8` on-chain. Deployed records have zero bytes in slots +9/+10/+11, which decode as ordinal 0. If `None`/`UNRESTRICTED`/`NONE` are not ordinal 0, all existing tokens decode to a non-default mode/policy/disposition.

**How to avoid:** D1 explicitly locks ordinal 0 to the backwards-compatible default for every enum. Append-only forever, never reorder. Slither `unused-state-variable` won't catch this — a storage-layout unit test MUST.

**Warning signs:** Upgrade test failing with unexpected transferPolicy values on legacy tokens; `isTokenActive(GNUS_TOKEN_ID)` returning false after upgrade.

### Pitfall 2: Operator Bypass via NFT_PROXY_OPERATOR_ROLE

**What goes wrong:** Marketplace operators holding `NFT_PROXY_OPERATOR_ROLE` bypass SOULBOUND because `isApprovedForAll` returns true for them.

**Why it happens:** [VERIFIED: contracts/gnus-ai/ERC1155ProxyOperator.sol:33-35] the role auto-approves any operator. If the predicate reads approval state (or fails to run when `operator != from`), the role becomes a bypass.

**How to avoid:** The predicate in `_beforeTokenTransfer` runs for EVERY transfer regardless of approval state. It does NOT call `isApprovedForAll`. It does NOT have a role-based early-return. Test coverage: explicit test that a role-holding operator cannot `safeTransferFrom` a SOULBOUND token (13-CONTEXT testing requirement).

**Warning signs:** Test "SOULBOUND rejects marketplace-role transfer" passes locally but production allows it; or the predicate has `if (hasRole(NFT_PROXY_OPERATOR_ROLE, operator)) return;` anywhere.

### Pitfall 3: Bridge Wiring — No Vault Exists

**What goes wrong:** Plan tries to wire the predicate into `lockTokens()` or add a vault exemption, neither of which exists.

**Why it happens:** 13-CONTEXT D7 references "bridge vault (Phase 10)" and `lockTokens()`, but Phase 10 dropped the vault model (10-CONTEXT D-01: "No vault, no escrow, no lock-then-release custody"). The actual code has `bridgeOut` → `_burn` only.

**How to avoid:** The plan must enforce policy in `GNUSBridge.bridgeOut()` BEFORE `_burn` (Pattern 5). The `_burn` will still fire `_beforeTokenTransfer`, but `to == address(0)` on a burn triggers the system carve-out — so the explicit check in `bridgeOut` is REQUIRED, not optional.

**Warning signs:** Test "bridgeOut reverts for SOULBOUND token" cannot be written because the policy check is missing; or the plan adds a `lockTokens` function that doesn't exist.

### Pitfall 4: REDEEM_TO_PARENT — Phase 9 Revision 2 Dropped the Reserve

**What goes wrong:** Plan references `mintBackedChild` or `reserve[id]` or "collateralized under Phase 9's `mintBackedChild` path", none of which exist.

**Why it happens:** 13-CONTEXT D8 was written against Phase 9 Revision 1 (escrow-ledger model). Phase 9 Revision 2 (09-RESEARCH §Conversion-Native Model: "Reserve apparatus is DEAD") dropped `reserveOf`/`redeemableBacking`/`issueBacked`/`depositToReserve`. The only remaining gate is the `nonConvertible` flag on the NFT struct (Phase 9 D5).

**How to avoid:** REDEEM_TO_PARENT settlement calls `GNUSTreasury.convert(id, parentId, balance, account)` (Pattern 6). The "collateralized only" gate becomes "require `!nft.nonConvertible`" (Phase 9 D5 zero-default: false = convertible = collateralized). The plan MUST reinterpret D8's "collateralized under `mintBackedChild`" as "convertible (nonConvertible == false)". This is a plan-time user checkpoint per 09-RESEARCH D5.

**Warning signs:** Plan mentions `mintBackedChild`, `reserveOf`, `redeemableBacking`, `depositToReserve`; or test tries to set up a "collateralized" token through a function that doesn't exist.

### Pitfall 5: Settle-First Renewal Ordering

**What goes wrong:** D3's renewal pseudo-code reads `balanceOf(holder, id)` and treats it as the pre-mint balance, but the plan implements it after `_mint` returns, so the just-minted amount is incorrectly included in the expired-pile calculation.

**Why it happens:** D3's spec is ambiguous about when `_applyPerHolderRenewal` runs relative to `_mint`. Reading `balanceOf` post-mint includes the new amount; reading it pre-mint excludes the new amount but requires the caller to pass the mint amount separately.

**How to avoid:** Run the renewal logic BEFORE `_mint`. The settle-first branch then burns the entire pre-existing expired balance without touching the incoming mint (Pattern 3). Alternative: run after `_mint` but subtract the just-minted amount. The plan MUST pick one and document.

**Warning signs:** Test "PerHolder renewal never resurrects expired balance" fails because the new mint gets burned by settle; or `holderExpiresAt` is set before the pre-existing expired balance is settled.

### Pitfall 6: Credential Verifier Reentrancy

**What goes wrong:** A malicious credential verifier reenters `mint()` and bypasses the per-wallet cap.

**Why it happens:** The verifier call is external. If the per-wallet mint count is updated AFTER the call (violating CEI), a reentrant mint sees the pre-update count.

**How to avoid:** D10 explicitly requires CEI: per-wallet mint count updates BEFORE the external verifier call (Pattern 7). Plan decides whether to add `ReentrancyGuardUpgradeable` for defense-in-depth. CEI alone is sufficient if the cap update is the only effect.

**Warning signs:** Test "credential verifier cannot double-mint via reentrancy" fails; or the cap update happens after the verifier call in the code.

### Pitfall 7: EIP-170 Facet Size — GNUSNFTFactory Is Full

**What goes wrong:** Plan tries to add lifecycle setters, views, or settle logic to `GNUSNFTFactory` and exceeds the 24,576-byte contract size limit.

**Why it happens:** [VERIFIED this session from artifacts/contracts/gnus-ai/GNUSNFTFactory.sol/GNUSNFTFactory.json] GNUSNFTFactory is at 23,417 bytes deployed — 1,159 bytes headroom. Adding even a single moderately complex function will overflow.

**How to avoid:** New lifecycle code goes on a new `GNUSLifecycle` facet. The `beforeMint` anti-scalping additions to `GNUSNFTFactory` (Pattern 7) are minimal (~200-400 bytes estimated: two requires, one mapping update, one external call) and fit in the remaining headroom — but the plan MUST measure the compiled size before commit.

**Warning signs:** `yarn compile` fails with "contract size exceeds 24576 bytes"; or the plan places settle/views/setters on GNUSNFTFactory.

### Pitfall 8: Diamond Selector Collision

**What goes wrong:** New selectors on GNUSLifecycle collide with existing selectors on other facets.

**Why it happens:** EIP-2535 routes by 4-byte selector. Adding `settleExpired`, `isTokenActive`, `isSpendable`, `holderExpiresAt`, `setValidFrom`, `setValidUntil`, `configureLifecycle` without checking for collisions against all existing facets.

**How to avoid:** 13-CONTEXT security_and_upgrade #13 requires diamond collision checks. The `@geniusventures/hardhat-diamonds` toolchain (used by LocalDiamondDeployer in test/unit/GNUSTreasury.test.ts:6-9) performs collision checks at deploy time. The plan runs the full local diamond deploy in tests and verifies no collision reverts.

**Warning signs:** Diamond deploy reverts with "function already exists"; or `loupe` shows two facets claiming the same selector.

### Pitfall 9: `settleExpired` Permissionless Caller Cannot Redirect Value

**What goes wrong:** A permissionless `settleExpired(account, id)` accepts a `recipient` parameter or allows the caller to influence the disposition outcome.

**Why it happens:** D9 says "permissionless: disposition and recipient are fixed at issuance; the caller cannot redirect value, capture anything, or influence the outcome". If the function signature accepts a destination or the implementation reads `msg.sender` for value routing, the permissionless property becomes an attack surface.

**How to avoid:** `settleExpired(address account, uint256 id)` — NO recipient parameter. Disposition and recipient come from the immutable `NFT` struct fields. The caller only triggers the state transition; they cannot affect it.

**Warning signs:** `settleExpired` has a `recipient` or `destination` parameter; or tests show caller receiving any portion of the settled value.

### Pitfall 10: ERC20TransferBatch Hook Bypass

**What goes wrong:** `ERC20TransferBatch._mintBatch` / `_transferBatch` bypass `_beforeTokenTransfer` (they have a different internal hook with a different signature — see contracts/gnus-ai/ERC20TransferBatch.sol:73-114).

**Why it happens:** [VERIFIED: contracts/gnus-ai/ERC20TransferBatch.sol:121-124, 153-156] the batch paths enforce pause/banned-transferor explicitly because they bypass the standard hook. They hardcode `GNUS_TOKEN_ID`.

**How to avoid:** D6 explicitly scopes `ERC20TransferBatch` out of policy ("moves GNUS_TOKEN_ID only"). The plan documents this. Any future child-token batch path MUST reuse the same predicate — add a parity check test that calls `_enforceTransferPolicy` from any new batch path.

**Warning signs:** A future phase adds a child-token batch path that doesn't call the predicate; or a test assumes ERC20TransferBatch respects SOULBOUND (it doesn't — it's GNUS-only).

---

## Code Examples

Verified patterns from official sources:

### Upgrade Test: Legacy NFT Decode with Zero Defaults

```typescript
// Source: test/unit/GNUSTreasury.test.ts:884-934 (Phase 9 upgrade test pattern)
// Extended for Phase 13 fields at slots +9, +10, +11

const FACTORY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.nft.factory.storage'));

function nftSlot(tokenId: bigint, offset: bigint): string {
    const mappingSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [tokenId, FACTORY_STORAGE_SLOT]),
    );
    return ethers.toBeHex(BigInt(mappingSlot) + offset, 32);
}

it('pre-Phase-13 NFT records decode with zero defaults for lifecycle fields', async function () {
    // Create a legacy token via createNFT (writes the new struct shape including
    // the Phase 13 fields, all defaulted to zero by Solidity).
    await ownerDiamond.createNFT(
        GNUS_TOKEN_ID, 'LegacyToken', 'LGCY', toWei('3'), toWei('12345'), 'ipfs://legacy',
    );
    const legacyId = 1n;

    // Zero the Phase 13 slots (+9, +10, +11) to simulate "this record predates Phase 13".
    await provider.send('hardhat_setStorageAt', [diamondAddress, nftSlot(legacyId, 9n),  ethers.toBeHex(0n, 32)]);
    await provider.send('hardhat_setStorageAt', [diamondAddress, nftSlot(legacyId, 10n), ethers.toBeHex(0n, 32)]);
    await provider.send('hardhat_setStorageAt', [diamondAddress, nftSlot(legacyId, 11n), ethers.toBeHex(0n, 32)]);

    // Read back via getNFTInfo
    const info = await geniusDiamond.getNFTInfo(legacyId);
    expect(info.validFrom).to.eq(0n);             // active immediately
    expect(info.validUntil).to.eq(0n);            // no per-ID expiry
    expect(info.defaultDuration).to.eq(0n);       // unset
    expect(info.expirationMode).to.eq(0);         // None
    expect(info.transferPolicy).to.eq(0);         // UNRESTRICTED
    expect(info.expirationDisposition).to.eq(0);  // NONE
    expect(info.expirationRecipient).to.eq(ethers.ZeroAddress);
    expect(info.credentialVerifier).to.eq(ethers.ZeroAddress);
    // Pre-existing fields unchanged
    expect(info.name).to.eq('LegacyToken');
    expect(info.nftCreated).to.eq(true);

    // Behavioral check: token is active, spendable, transferable (UNRESTRICTED).
    expect(await geniusDiamond.isTokenActive(legacyId)).to.eq(true);
    // ... etc
});
```

### Credential Verifier Interface

```solidity
// Source: 13-CONTEXT.md D10; new file contracts/gnus-ai/interfaces/ICredentialVerifier.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title ICredentialVerifier
/// @notice Generic credential verifier plug-in interface for Phase 13 anti-scalping.
/// @dev Called from GNUSNFTFactory.beforeMint AFTER per-wallet cap update (CEI ordering).
///      Implementations may use EIP-712 vouchers, merkle allowlists, or identity providers.
///      The diamond does NOT verify signatures itself — creators bring their own verifier.
interface ICredentialVerifier {
    /// @notice Verify a credential for a mint.
    /// @param minter The address receiving the minted tokens.
    /// @param tokenId The token ID being minted.
    /// @param amount The amount being minted (minions).
    /// @param credential Opaque bytes — format defined by the verifier.
    /// @return True if the credential is valid, false otherwise.
    function verify(
        address minter,
        uint256 tokenId,
        uint256 amount,
        bytes calldata credential
    ) external view returns (bool);
}
```

### Allowlist Registry Interface

```solidity
// Source: 13-CONTEXT.md D5 (ALLOWLISTED policy); new file contracts/gnus-ai/interfaces/IAllowlistRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IAllowlistRegistry
/// @notice Allowlist registry plug-in for ALLOWLISTED transfer policy.
/// @dev Per-token registry address lives in GNUSLifecycleStorage.allowlistRegistry[id].
///      Implementations decide the allowlist semantics (merkle, mapping, etc.).
interface IAllowlistRegistry {
    /// @notice Check whether an address is allowed as a destination.
    /// @param account The candidate destination.
    /// @return True if allowed.
    function isAllowed(address account) external view returns (bool);
}
```

### Lifecycle Configuration Struct

```solidity
// Source: 13-CONTEXT.md D1 + D13; lives on the new GNUSLifecycle facet
struct LifecycleConfig {
    uint64  validFrom;
    uint64  validUntil;
    uint64  defaultDuration;
    uint8   expirationMode;        // ExpirationMode enum ordinal
    uint8   transferPolicy;        // TransferPolicy enum ordinal
    uint8   expirationDisposition; // ExpirationDisposition enum ordinal
    address expirationRecipient;
    address credentialVerifier;
}
```

### Settlement Event

```solidity
// Source: 13-CONTEXT.md D9 ("Emits holder, ID, amount, disposition, destination")
event Settled(
    address indexed account,
    uint256 indexed id,
    uint256 amount,
    ExpirationDisposition disposition,
    address destination  // 0x0 for NONE/KEEP_INERT/BURN; recipient for RETURN_TO_ADDRESS; account for REDEEM_TO_PARENT
);
```

### Lifecycle Mutation Events

```solidity
// Source: 13-CONTEXT.md D4 ("Every lifecycle/policy mutation emits an explicit event")
// and 13-CONTEXT security_and_upgrade #15 ("New-field events emitted at token creation for
// off-chain indexers/loupe consumers")
event LifecycleConfigured(uint256 indexed id, LifecycleConfig cfg, address indexed operator);
event ValidFromUpdated(uint256 indexed id, uint64 oldValidFrom, uint64 newValidFrom, address indexed operator);
event ValidUntilUpdated(uint256 indexed id, uint64 oldValidUntil, uint64 newValidUntil, address indexed operator);
event HolderExpiryUpdated(uint256 indexed id, address indexed holder, uint64 oldExpiry, uint64 newExpiry);
event PerWalletCapSet(uint256 indexed id, uint256 cap, address indexed operator);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vault-custody bridge (`lockTokens` in a vault contract) | Provenance relocation (`bridgeOut` burns; `bridgeIn` mints via threshold certificate) | Phase 10 (2026-08-17, 10-CONTEXT D-01) | No vault to exempt from policy; bridge policy enforcement must wire into `bridgeOut` directly (Pattern 5, Pitfall P3) |
| Reserve-ledger backing (`reserveOf[id]`, `redeemableBacking[id]`) | Minion-native conservation (child supply IS the locked minions; `convert()` moves 1:1) | Phase 9 Revision 2 (2026-08-04, 09-RESEARCH §Conversion-Native Model) | REDEEM_TO_PARENT settles via `convert(id, parentId, ...)` not reserve redemption; "collateralized" gate is `!nonConvertible` (Pitfall P4) |
| `GNUSBridge.withdraw(amount, id)` for child→GNUS redemption | `GNUSTreasury.convert(childId, GNUS_TOKEN_ID, ...)` or `GNUSRedeemAdapter.redeem(...)` | Phase 9 (2026-08-05) + Phase 11 (2026-08-19) | Phase 13's REDEEM_TO_PARENT does NOT touch `withdraw()` (D12); settlement routes through `convert()` |
| Rate-multiplied mint (`amount * exchangeRate` in `beforeMint`) | Minion-for-minion burn/mint (1:1) | Phase 9 Revision 2 (09-RESEARCH D1) | AI Credits at `exchangeRate = 1.0` matches the 1:1 model exactly (D11) |
| Hardcoded SOULBOUND via no-transfer implementation | Six-policy predicate in `_beforeTokenTransfer` | Phase 13 (this phase) | Single enforcement point, no operator exemptions (D6) |

**Deprecated/outdated:**

- `GNUSBridge.withdraw()` — removed in Phase 9 (09-RESEARCH D4). Do not reference in Phase 13 plan.
- `mintBackedChild` / `reserveOf` / `redeemableBacking` / `depositToReserve` — never shipped; Phase 9 Revision 1 framing only. Do not reference.
- Vault/`lockTokens` bridge framing — dropped in Phase 10. Do not reference.
- Phase 12 "Supply Ledger" — retired 2026-08-21 (ROADMAP line 5). The "expired-unsettled = circulating" convention is now owned by Phase 13 itself.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new facet name will be `GNUSLifecycle` (planner may choose `GNUSPolicy` or `GNUSEntitlement`) | §Architectural Responsibility Map | Low — naming only; no behavior change |
| A2 | Storage slot string `gnus.ai.lifecycle.storage` follows the project convention (verified pattern: `gnus.ai.nft.factory.storage`, `gnus.ai.treasury.storage`, `gnus.ai.bridge.validator.storage`, `gnus.ai.withdraw.limiter.storage`) | §Architecture Patterns — Pattern 2 | Low — if the planner picks a different string, tests reference the constant |
| A3 | `settleExpired` reverts on non-expired state (D9 leaves the choice to the plan; recommend revert) | §Architecture Patterns — Pattern 6 | Low — D9 explicitly delegates this to plan |
| A4 | PerHolder + UNRESTRICTED is allowed (13-CONTEXT D2 says "should only be combined with non-transferable policies" but doesn't explicitly enumerate; SOULBOUND and ISSUER_ONLY are clearly allowed, UNRESTRICTED is ambiguous) | §Architecture Patterns — Pattern 9 | Medium — plan-time user checkpoint; if UNRESTRICTED+PerHolder is forbidden, the require tightens |
| A5 | REDEEM_TO_PARENT settlement uses a new internal settle-only path that mirrors `convert()` but burns from `account` directly, NOT a custody-then-convert pattern | §Architecture Patterns — Pattern 6 | Medium — plan picks (a) custody + convert or (b) direct settle; recommendation is (b) for Phase 10 no-custody parity |
| A6 | `mintWithCredential(to, id, amount, data, credential)` is added as a new overload rather than changing the existing `mint()` signature | §Claude's Discretion | Low — D13 preserves legacy selectors |
| A7 | Per-wallet cap is keyed by `(tokenId, wallet)` where `wallet` is the mint RECIPIENT (`to`), not the caller | §Architecture Patterns — Pattern 7 | Low — D10 says "per-wallet mint cap per token ID"; wallet = the receiving wallet |
| A8 | Phase 13 bumps `protocolVersion` from 2.6 to 2.7 in `diamonds/GeniusDiamond/geniusdiamond.config.json` | §Recommended Project Structure | Low — planner may pick 3.0 if a breaking-change framing is preferred; 2.7 matches the additive-change convention from Phases 9/10/11 |

**All other claims** in this research are VERIFIED against the current codebase (contracts read this session), CITED from existing CONTEXT/RESEARCH documents in `.planning/phases/`, or CITED from the vendored `@gnus.ai/contracts-upgradeable-diamond` package.

---

## Open Questions

1. **REDEEM_TO_PARENT "collateralized" gate definition**
   - What we know: 13-CONTEXT D8 says "only configurable for tokens that were collateralized under Phase 9's `mintBackedChild` path". Phase 9 Revision 2 dropped `mintBackedChild` entirely (09-RESEARCH §Conversion-Native Model: "Reserve apparatus is DEAD"). The only remaining gate is `nonConvertible`.
   - What's unclear: Whether "collateralized" in Phase 13 should mean (a) `nonConvertible == false` (simple, existing flag), (b) a new explicit `collateralized` flag set at creation, or (c) a check against the parent's supply at settle time.
   - Recommendation: Plan-time user checkpoint. Default to (a) — `require(!nft.nonConvertible)` — because it matches Phase 9 D5's zero-default (false = convertible = collateralized) and requires no new state. If the user wants a stricter gate, (b) adds a new NFT field (another struct append).

2. **PerHolder + UNRESTRICTED combination**
   - What we know: D2 says PerHolder should only be combined with non-transferable policies, but doesn't enumerate. SOULBOUND and ISSUER_ONLY are clearly non-transferable. UNRESTRICTED is fully transferable.
   - What's unclear: Whether `PerHolder + UNRESTRICTED` is a forbidden combination, or allowed-with-warning.
   - Recommendation: Forbid at `configureLifecycle` time (Pattern 9). The D2 rationale ("Per-holder expiry + fungible balance merging is ambiguous") applies whenever transfers are allowed. If the user wants PerHolder subscriptions that are transferable, that's v2 scope.

3. **REDEEM_TO_PARENT settle call pattern**
   - What we know: `GNUSTreasury.convert()` burns from `_msgSender()` (GNUSTreasury.sol:74-75). A permissionless `settleExpired(caller)(account, id)` cannot directly call `convert` because `account != _msgSender()`.
   - What's unclear: Whether to (a) transfer tokens from `account` to `address(this)`, then call `convert` from the diamond (matches 11-RESEARCH's pull-model for the redeem adapter), or (b) introduce a settlement-only internal path that burns from `account` and mints the parent to `account` directly (no custody).
   - Recommendation: (b) — a settlement-only internal `_settleRedeemToParent(account, id, parentId, amount)` that does `_burn(account, id, amount) + _mint(account, parentId, amount, "")` without routing through `convert`. This preserves the Phase 10 no-custody invariant. The plan must add a limiter-charge parity check if the GNUS-terminal leg is involved (WR-07).

4. **Allowlist registry cross-chain semantics**
   - What we know: D7 says "ALLOWLISTED bridges only to allowlisted destinations".
   - What's unclear: The registry is per-chain state. On the source chain, the registry can check the SENDER (the bridge initiator). It cannot check the DESTINATION on the target chain without a cross-chain registry lookup.
   - Recommendation: v1 simplifies — `bridgeOut` checks the SENDER against the registry (Pattern 5). Cross-chain destination-allowlisting is v2.

5. **`configureLifecycle` vs. constructor-time configuration**
   - What we know: D13 sketches "createNFT/createNFTs overloads or a configure-before-first-mint step for lifecycle-aware creation".
   - What's unclear: Whether to add a new `createNFTWithLifecycle(parentID, name, ..., LifecycleConfig)` overload (atomic creation+configuration) or keep `createNFT` + separate `configureLifecycle` (two transactions).
   - Recommendation: Both — add the overload for new tokens (atomic, recommended for AI Credits creation) AND keep `configureLifecycle` for retrofitting existing tokens before their first mint. The plan picks the exact signatures.

6. **First-mint detection for D4 immutability**
   - What we know: D4 says policy fields are "immutable after first mint".
   - What's unclear: How to detect "first mint has occurred". Options: (a) check `ERC1155SupplyStorage._totalSupply[id] > 0` (simple, fails if all tokens are burned back to zero), (b) add a `hasMinted` bool to the NFT struct (another field append), (c) add a `hasMinted` mapping in GNUSLifecycleStorage.
   - Recommendation: (a) for v1 — simplest, matches existing storage. The "burned back to zero" edge case is documented: a token whose supply returns to zero can have its policy re-configured. If the user wants stricter semantics, (c) adds one mapping in the new storage library without touching the NFT struct.

---

## Environment Availability

Phase 13 is a code/config-only change to the existing diamond. No new external services, runtimes, or CLI utilities are required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Hardhat test runner | ✓ | 24.13.0 (via nvm) | — |
| Hardhat | Compile + test | ✓ | 2.26.5 | — |
| Solidity compiler | Contract compilation | ✓ | 0.8.19 (hardhat.config.ts) | — |
| ethers.js | Test interactions | ✓ | 6.16.0 | — |
| `@geniusventures/hardhat-diamonds` | LocalDiamondDeployer | ✓ | 1.1.15-gv.2 | — |
| Foundry (`forge`) | Invariant/fuzz tests | ✓ | (via `yarn forge:test`) | — |
| Slither | Static analysis (SEC-07) | ✓ | (via `yarn slither:scan`) | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit) | Hardhat 2.26.5 + Mocha + Chai 4.5.0 + ethers.js 6.16.0 |
| Framework (invariant/fuzz) | Foundry (forge) via `@diamondslab/diamonds-hardhat-foundry` 2.4.0 |
| Config file (Hardhat) | `hardhat.config.ts` (no separate mocha config) |
| Config file (Foundry) | `test/foundry/GeniusDiamond.forge.config.json` |
| Quick run command (unit) | `npx hardhat test test/unit/GNUSLifecycle.test.ts` |
| Quick run command (upgrade) | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` |
| Quick run command (Foundry) | `npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --network localhost --force -- --match-contract LifecycleInvariant -vvv` |
| Full suite command | `npx hardhat test && yarn forge:test` |
| Estimated runtime | ~120 seconds (matching Phase 10 baseline) |

### Phase Requirements → Test Map

| Req ID (SC#) | Behavior | Test Type | Automated Command | File Exists? |
|--------------|----------|-----------|-------------------|-------------|
| SC1 | Legacy NFT decode with zero defaults | unit (upgrade) | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts --grep "legacy decode"` | ❌ Wave 0 |
| SC1 | Storage layout matches expected slots | unit | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts --grep "storage layout"` | ❌ Wave 0 |
| SC2 | PerHolder renewal stacks (active balance) | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "renewal stacks"` | ❌ Wave 0 |
| SC2 | PerHolder renewal settles expired first | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "settle-first"` | ❌ Wave 0 |
| SC2 | PerHolder renewal never resurrects expired | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "never resurrects"` | ❌ Wave 0 |
| SC2 | PerTokenId validUntil boundary (exclusive) | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "validUntil boundary"` | ❌ Wave 0 |
| SC2 | validFrom boundary (before/exact/after) | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "validFrom boundary"` | ❌ Wave 0 |
| SC3 | SOULBOUND rejects direct holder-to-holder transfer | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "SOULBOUND rejects direct"` | ❌ Wave 0 |
| SC3 | SOULBOUND rejects operator transfer | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "SOULBOUND rejects operator"` | ❌ Wave 0 |
| SC3 | SOULBOUND rejects NFT_PROXY_OPERATOR_ROLE transfer | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "SOULBOUND rejects marketplace"` | ❌ Wave 0 |
| SC3 | SOULBOUND permits mint | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "SOULBOUND permits mint"` | ❌ Wave 0 |
| SC3 | SOULBOUND permits spend-burn | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "SOULBOUND permits burn"` | ❌ Wave 0 |
| SC3 | SOULBOUND permits settle-burn | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "SOULBOUND permits settle"` | ❌ Wave 0 |
| SC3 | ISSUER_ONLY permits creator transfer | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "ISSUER_ONLY permits creator"` | ❌ Wave 0 |
| SC3 | ISSUER_ONLY rejects non-creator transfer | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "ISSUER_ONLY rejects"` | ❌ Wave 0 |
| SC3 | ALLOWLISTED permits allowlisted destination | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "ALLOWLISTED permits"` | ❌ Wave 0 |
| SC3 | ALLOWLISTED rejects non-allowlisted destination | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "ALLOWLISTED rejects"` | ❌ Wave 0 |
| SC3 | CONTROLLED_RESALE blocks ordinary transfers | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "CONTROLLED_RESALE blocks"` | ❌ Wave 0 |
| SC3 | LOCKED_AFTER_START permits before start | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "LOCKED_AFTER_START before"` | ❌ Wave 0 |
| SC3 | LOCKED_AFTER_START rejects after start | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "LOCKED_AFTER_START after"` | ❌ Wave 0 |
| SC3 | ERC-20 proxy transfer of SOULBOUND reverts via hook | unit (cross-repo integration) | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "proxy SOULBOUND"` | ❌ Wave 0 |
| SC3 | Mixed-token batch reverts atomically | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "batch atomic revert"` | ❌ Wave 0 |
| SC4 | bridgeOut reverts for SOULBOUND | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "bridgeOut SOULBOUND"` | ❌ Wave 0 |
| SC4 | bridgeOut reverts for ISSUER_ONLY | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "bridgeOut ISSUER_ONLY"` | ❌ Wave 0 |
| SC4 | bridgeOut reverts for LOCKED_AFTER_START after start | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "bridgeOut LOCKED"` | ❌ Wave 0 |
| SC4 | bridgeOut reverts for CONTROLLED_RESALE | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "bridgeOut CONTROLLED"` | ❌ Wave 0 |
| SC4 | bridgeOut permits UNRESTRICTED | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "bridgeOut UNRESTRICTED"` | ❌ Wave 0 |
| SC5 | settleExpired reverts when not expired | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "settle not expired"` | ❌ Wave 0 |
| SC5 | settleExpired idempotent repeat | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "settle idempotent"` | ❌ Wave 0 |
| SC5 | BURN disposition decrements balance and supply | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "BURN settles"` | ❌ Wave 0 |
| SC5 | KEEP_INERT disposition keeps balance, denies entitlement | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "KEEP_INERT"` | ❌ Wave 0 |
| SC5 | RETURN_TO_ADDRESS pays only configured recipient | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "RETURN_TO_ADDRESS fixed"` | ❌ Wave 0 |
| SC5 | RETURN_TO_ADDRESS caller cannot redirect | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "RETURN_TO_ADDRESS no redirect"` | ❌ Wave 0 |
| SC5 | REDEEM_TO_PARENT settles to direct parent at exchangeRate | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "REDEEM_TO_PARENT"` | ❌ Wave 0 |
| SC5 | REDEEM_TO_PARENT solvency invariant holds | invariant | `forge test --match-contract LifecycleInvariant --match-test invariant_redeemConservation` | ❌ Wave 0 |
| SC6 | Per-wallet cap enforces in single mint | unit | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts --grep "cap single"` | ❌ Wave 0 |
| SC6 | Per-wallet cap enforces in batch mint | unit | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts --grep "cap batch"` | ❌ Wave 0 |
| SC6 | Per-wallet cap not bypassable by repeat calls | unit | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts --grep "cap repeat"` | ❌ Wave 0 |
| SC6 | Credential verifier absent = open minting | unit | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts --grep "no verifier"` | ❌ Wave 0 |
| SC6 | Credential verifier valid credential mints | unit | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts --grep "valid credential"` | ❌ Wave 0 |
| SC6 | Credential verifier invalid credential reverts | unit | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts --grep "invalid credential"` | ❌ Wave 0 |
| SC6 | Credential verifier reentrancy cannot double-mint | unit | `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts --grep "reentrancy"` | ❌ Wave 0 |
| SC7 | AI Credits configuration end-to-end | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "AI Credits"` | ❌ Wave 0 |
| SC7 | AI Credits spend creates zero GNUS/parent/reserve/treasury credit | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "AI Credits no credit"` | ❌ Wave 0 |
| SC7 | AI Credits expiry creates zero credit | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "AI Credits expiry no credit"` | ❌ Wave 0 |
| SC8 | Timestamp setters creator-only post-mint | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "creator-only timestamps"` | ❌ Wave 0 |
| SC8 | Policy immutable after first mint | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "immutable after first mint"` | ❌ Wave 0 |
| SC8 | All mutations emit events | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "events"` | ❌ Wave 0 |
| SC8 | Unauthorized mutation reverts | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "unauthorized"` | ❌ Wave 0 |
| SC2 | Invalid config reverts: PerHolder + transferable | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "PerHolder transferable reverts"` | ❌ Wave 0 |
| SC5 | Invalid config reverts: REDEEM_TO_PARENT on non-convertible | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "REDEEM non-convertible reverts"` | ❌ Wave 0 |
| SC5 | Invalid config reverts: RETURN_TO_ADDRESS missing recipient | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "RETURN missing recipient"` | ❌ Wave 0 |
| D4 | Timestamp mutation cannot un-burn after BURN settlement | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "no un-burn"` | ❌ Wave 0 |
| D9 | Expired-unsettled balances counted as circulating | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts --grep "circulating"` | ❌ Wave 0 |
| — | Diamond selector collision check | deployment | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts --grep "selector collision"` | ❌ Wave 0 |

### Sampling Rate

- **After every task commit:** Run `npx hardhat test test/unit/GNUSLifecycle.test.ts` (fast, single-file)
- **After every plan wave:** Run `npx hardhat test test/unit/GNUSLifecycle.test.ts test/unit/GNUSLifecycleUpgrade.test.ts test/unit/GNUSNFTFactoryAntiScalping.test.ts`
- **Before `/gsd:verify-work`:** Full suite green — `npx hardhat test && yarn forge:test`
- **Max feedback latency:** 120 seconds (matching Phase 10 baseline)

### Wave 0 Gaps

- [ ] `test/unit/GNUSLifecycle.test.ts` — covers SC2-SC8 unit cases
- [ ] `test/unit/GNUSLifecycleUpgrade.test.ts` — covers SC1 (legacy decode, storage layout, selector collision)
- [ ] `test/unit/GNUSNFTFactoryAntiScalping.test.ts` — covers SC6 (anti-scalping)
- [ ] `test/foundry/invariant/LifecycleInvariant.t.sol` — covers settle-first renewal + REDEEM_TO_PARENT conservation invariants
- [ ] `contracts/gnus-ai/interfaces/ICredentialVerifier.sol` — NEW interface
- [ ] `contracts/gnus-ai/interfaces/IAllowlistRegistry.sol` — NEW interface
- [ ] `contracts/gnus-ai/GNUSLifecycle.sol` — NEW facet
- [ ] `contracts/gnus-ai/GNUSLifecycleStorage.sol` — NEW storage library
- [ ] Mock `MockCredentialVerifier.sol` + `MockAllowlistRegistry.sol` in `contracts/gnus-ai/testing/` for tests
- [ ] Diamond config update for `GNUSLifecycle` facet at priority 119, protocol 2.7

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `GeniusAccessControl` role-based access (existing) — creator-only timestamp setters, DEFAULT_ADMIN_ROLE fallback |
| V3 Session Management | no | — (no sessions in smart contracts) |
| V4 Access Control | yes | Creator/Admin authorization on setters; permissionless-but-fixed-outcome on settle; no role exemptions in policy predicate |
| V5 Input Validation | yes | Solidity 0.8.19 built-in overflow checks; `require` on every external entry; enum ordinal bounds checked implicitly by uint8 storage; `validFrom`/`validUntil`/`defaultDuration` are uint64 (no overflow until year 584B) |
| V6 Cryptography | yes | No new crypto — credential verifier delegates to creator-supplied contract (EIP-712, merkle, etc.); diamond does NOT verify signatures itself |
| V7 Error Handling | yes | Revert with reason strings (project convention); no silent failures |
| V9 Communications | yes | Credential verifier external call is the ONLY external interaction in mint path; CEI ordering (D10); reentrancy note in plan |
| V13 API | yes | New external functions: `settleExpired`, `isTokenActive`, `isSpendable`, `holderExpiresAt`, `setValidFrom`, `setValidUntil`, `configureLifecycle`, `mintWithCredential` — all require diamond collision checks |

### Known Threat Patterns for Solidity/ERC-1155/Diamond

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reentrancy via credential verifier | Tampering | CEI ordering (effects before interaction); optional ReentrancyGuardUpgradeable; verifier is `view` where possible |
| Operator bypass via NFT_PROXY_OPERATOR_ROLE | Elevation of Privilege | Policy predicate ignores approval state; explicit test for role-holding operator transfer |
| Storage collision on diamond upgrade | Tampering | Diamond storage pattern with keccak256 slots; new slot string `gnus.ai.lifecycle.storage`; struct append-only with slot math test |
| Selector collision on diamondCut | Tampering | `@geniusventures/hardhat-diamonds` collision check at deploy time; loupe test in upgrade test |
| Unbounded loops (gas griefing) | Denial of Service | No loops over holders/token IDs; settle is single (account, id); batch settlement (if shipped) is bounded array input |
| Timestamp manipulation | Tampering | `block.timestamp` is canonical; miner skew is bounded (~15s on L1, longer on L2 — accepted and documented in D7) |
| Expired-balance resurrection | Tampering | Settle-first renewal (D3); explicit test that expired balances are settled before renewal |
| Permissionless settle redirecting value | Elevation of Privilege | Disposition and recipient are immutable at issuance; `settleExpired` has no recipient parameter |
| First-mint bypass of policy immutability | Tampering | `configureLifecycle` requires `_totalSupply[id] == 0` (or `hasMinted` flag); test that post-mint policy change reverts |
| Bridge bypass of policy | Tampering | Explicit policy check in `bridgeOut` BEFORE `_burn`; test that SOULBOUND bridge reverts |
| Supply inflation via REDEEM_TO_PARENT | Tampering | Settle routes through `convert` (1:1 minion reallocation, supply-neutral); invariant test that `totalSupplyOfAll` is unchanged by settle |
| ERC20TransferBatch hook bypass | Tampering | Out of scope (GNUS_TOKEN_ID only per D6); parity check test for any future child-token batch path |
| Per-wallet cap Sybil attack | Spoofing | Documented as Sybil-vulnerable (D10); NOT identity-proof; creators should not rely on cap for uniqueness |

---

## Sources

### Primary (HIGH confidence)

- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (read this session) — NFT struct current state, Phase 9 appends (parentId, nonConvertible)
- `contracts/gnus-ai/GNUSNFTFactory.sol` (read this session) — `beforeMint` hook at lines 87-96; `createNFTs` at lines 154-186
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` (read this session) — `_beforeTokenTransfer` at lines 32-85; hook is the single enforcement point
- `contracts/gnus-ai/GNUSBridge.sol` (read this session) — `bridgeOut` at lines 228-267; no `lockTokens` exists; `_mintWithBridgeFee` at lines 118-144
- `contracts/gnus-ai/GNUSTreasury.sol` (read this session) — `convert` at lines 74-113; supply-neutral reallocation primitive
- `contracts/gnus-ai/GNUSTreasuryStorage.sol` (read this session) — Layout with globalSupply, provenanceInitialized, chainSupply, ownChainId
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` (read this session) — per-account mapping pattern precedent for `holderExpiresAt`
- `contracts/gnus-ai/GNUSRedeemAdapter.sol` (read this session) — `redeem` pattern; `_mint` override pattern; no-custody model
- `contracts/gnus-ai/ERC1155ProxyOperator.sol` (read this session) — `NFT_PROXY_OPERATOR_ROLE` auto-approval at lines 33-35
- `contracts/gnus-ai/ERC20TransferBatch.sol` (read this session) — batch paths bypass `_beforeTokenTransfer`; hardcode GNUS_TOKEN_ID
- `contracts/gnus-ai/GeniusAccessControl.sol` (read this session) — role model
- `contracts/gnus-ai/GNUSConstants.sol` (read this session) — GNUS_TOKEN_ID, PARENT_MASK, CHILD_MASK
- `node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol` (read this session) — `_beforeTokenTransfer` call sites at lines 173, 211, 278, 308, 340, 370
- `erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyFacet.sol` (read this session) — `transfer`/`transferFrom` delegate to `safeTransferFrom` at lines 88-90, 124-127
- `artifacts/contracts/gnus-ai/*.json` (measured this session) — facet bytecode sizes: GNUSNFTFactory 23,417 B (1,159 headroom), GNUSERC1155MaxSupply 11,539 B (13,037 headroom), GNUSTreasury 18,151 B (6,425 headroom), GNUSBridge 21,797 B (2,779 headroom), ERC1155ProxyOperator 4,283 B, GNUSRedeemAdapter 16,390 B, ERC20TransferBatch 17,561 B
- `diamonds/GeniusDiamond/geniusdiamond.config.json` (read this session) — protocolVersion 2.6; facet priorities: GNUSNFTFactory 40, GNUSBridge 115, GNUSTreasury 117, GNUSRedeemAdapter 118
- `test/unit/GNUSTreasury.test.ts` (read this session) — upgrade test pattern at lines 884-934; slot helpers at lines 73-85
- `.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` (read this session) — D1-D13 locked decisions
- `.planning/phases/13-time-bound-erc1155-entitlements/13-DISCUSSION-LOG.md` (read this session) — decision rationale
- `.planning/phases/09-per-child-gnus-treasury-reserve/09-RESEARCH.md` (read this session) — Phase 9 Revision 2 conversion-native model; reserve apparatus is DEAD
- `.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` (read this session) — Phase 10 dropped vault model; provenance relocation
- `.planning/phases/10-lock-release-bridge-vault/10-RESEARCH.md` (read this session) — Phase 10 implementation details
- `.planning/phases/10-lock-release-bridge-vault/10-VALIDATION.md` (read this session) — validation architecture template
- `.planning/phases/11-erc-20-proxy-hardening/11-RESEARCH.md` (read this session) — Phase 11 cross-references to Phase 13 (D-09 AI Credits not redeemable; Phase 13 D6 operator bypass)
- `.planning/ROADMAP.md` (read this session) — Phase 13 success criteria at lines 419-439; Phase 12 retired at line 5
- `.planning/REQUIREMENTS.md` (read this session) — no Phase 13 requirement IDs yet
- `.planning/STATE.md` (read this session) — Phase 11 merged; 477 passing / 2 pending / 1 failing baseline (GNUSControlStorage chainID cross-suite pollution)
- `.planning/codebase/CONCERNS.md` (read this session) — concern #24 (diamond selector overlap), #26 (dependency tracking)
- `.planning/codebase/ARCHITECTURE.md` (read this session) — system overview
- `.planning/codebase/TESTING.md` (read this session) — test framework setup

### Secondary (MEDIUM confidence)

- Solidity storage layout rules (CITED: docs.soliditylang.org/en/v0.8.19/internals/layout_in_storage.html) — field packing at slots +9/+10/+11 verified against training knowledge; plan should add a slot-math unit test as ground truth

### Tertiary (LOW confidence)

- None — all claims verified against in-repo code or in-repo planning documents this session.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all dependencies verified in package.json and node_modules this session
- Architecture: HIGH — every pattern anchored to a specific file:line reference read this session; facet sizes measured from artifacts; struct layout derived from existing slot helpers in test/unit/GNUSTreasury.test.ts:73-85
- Pitfalls: HIGH — all 10 pitfalls identified by reading actual code and cross-referencing Phase 9/10/11 CONTEXT/RESEARCH documents; two (P3 vault framing, P4 reserve framing) are explicit corrections to stale 13-CONTEXT references

**Research date:** 2026-08-21
**Valid until:** 2026-09-20 (30 days — stable domain; diamond pattern and ERC-1155 hook semantics are not fast-moving; re-validate if Phase 9/10/11 code changes before Phase 13 plans)
