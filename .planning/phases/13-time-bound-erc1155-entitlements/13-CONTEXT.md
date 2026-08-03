# Phase 13: Time-Bound ERC-1155 Entitlements - Context

**Gathered:** 2026-07-27
**Updated:** 2026-08-03 — all decisions locked by Kenneth Hurley
**Status:** Approved for planning. Implementation begins only after Phase 9 completes.

<domain>
## Phase Boundary

Add a general-purpose lifecycle and transfer-policy model to the existing GNUS ERC-1155 child-token system so a token class can declare:

- when it becomes usable;
- when it expires (per-token-ID or per-holder);
- whether and how it may be transferred;
- how primary issuance is limited; and
- what happens to the remaining balance after expiration.

The primary initial use case is the AI Credits allocation: a user purchases AI Credits (e.g. $5 worth) with GNUS, receives ERC-1155 child-token credits, spends them on GCS/ELM services, and loses any unused allocation after their personal expiry. AI Credits are non-transferable, burn when spent or expired, and never redeem into or replenish GNUS, a parent token, a reserve, or a treasury.

The same primitive must remain reusable for album releases, tickets, event access, seasonal passes, software access, rentals, promotional allocations, and other tokenized rights.

This phase is limited to lifecycle metadata, transfer policy, issuance controls required by anti-scalping policies, expiration disposition, settlement, view functions, events, and tests. It does not implement a marketplace UI, fiat payment processing, the email product, GCS billing, the Banxa purchase-automation backend, or the Phase 9 reserve system itself.

**Hard dependency:** Phase 13 is implemented on top of completed Phase 9 code (per-child GNUS treasury/reserve, corrected exchange-rate math). Phase 13 is a single phase — no 13.1/13.2 split.
</domain>

<decisions>
## Locked Decisions

### D1. Lifecycle storage — appended to the `NFT` struct

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

### D2. Dual expiry model — explicit `ExpirationMode`

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

Validity predicate (conceptual — final naming in plan):

```solidity
function isSpendable(address holder, uint256 id) public view returns (bool) {
    TokenConfig memory cfg = tokenConfig[id];
    if (cfg.validFrom != 0 && block.timestamp < cfg.validFrom) return false;
    if (cfg.expirationMode == ExpirationMode.None)       return true;
    if (cfg.expirationMode == ExpirationMode.PerTokenId)
        return cfg.validUntil == 0 || block.timestamp < cfg.validUntil;
    // PerHolder
    return block.timestamp < _holderExpiresAt[id][holder];
}
```

### D3. Per-holder renewal semantics — stacked, settle-first

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

### D4. Mutability — creator-only, renewal-oriented

- `validFrom` / `validUntil` are mutable after first mint, **only by the token creator** (and DEFAULT_ADMIN_ROLE, matching existing `beforeMint` authorization). This supports subscription-window renewal and event rescheduling.
- `transferPolicy`, `expirationDisposition`, `expirationRecipient`, `expirationMode` are **immutable after first mint** — an administrator must not be able to convert a transferable token into a confiscatable or forced-return token after issuance, or change where expired value flows.
- Every lifecycle/policy mutation emits an explicit event.
- After a BURN settlement has occurred for a holder/token, creator timestamp mutation must not be able to un-burn it (ordering: settlement is final state).

### D5. Transfer policies — all six ship in v1

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

### D6. Single enforcement point — policy predicate in `_beforeTokenTransfer`

- One internal predicate `_enforceTransferPolicy(operator, from, to, id, amount)` called from `GNUSERC1155MaxSupply._beforeTokenTransfer()` for every mint/transfer/burn.
- **No operator exemptions for holder-to-holder moves.** `ERC1155ProxyOperator.isApprovedForAll` auto-approves `NFT_PROXY_OPERATOR_ROLE` — the predicate must still block holder-to-holder transfers initiated by marketplace operators. The only carve-outs are system operations: mint (from == 0), burn/settlement (to == 0 or fixed recipient), and issuer correction under ISSUER_ONLY/creator authority.
- The ERC-20 proxy (`erc20-gnus-proxy`) is a thin wrapper, not a custodian — its `transfer` delegates to `safeTransferFrom` on the diamond, which fires the hook. **No proxy changes needed in Phase 13.** Keep the proxy dumb.
- `ERC20TransferBatch` paths move GNUS_TOKEN_ID only and hardcode it — out of policy scope. Any future child-token batch path MUST reuse the same predicate (parity check required).
- Mixed-token batches revert atomically when any token violates policy.

### D7. Bridging IS a transfer — policy-bound tokens are non-bridgeable in v1

- The bridge vault (Phase 10) receives no policy exemption. `lockTokens()` must run the same policy predicate.
- `SOULBOUND`, `ISSUER_ONLY`, `LOCKED_AFTER_START` (after start), and `CONTROLLED_RESALE` tokens cannot bridge in v1.
- `ALLOWLISTED` bridges only to allowlisted destinations; `UNRESTRICTED` bridges normally.
- Expiry is evaluated per-chain against that chain's `block.timestamp`. Tokens that expire while vault-locked arrive inert on the destination and are settled there per disposition. Small cross-chain timestamp skew is accepted and documented.

### D8. Expiration dispositions — all five fully implemented in v1

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

### D9. Settlement — permissionless, fixed-outcome, per-holder

```solidity
function settleExpired(address account, uint256 id) external;
```

- Permissionless: disposition and recipient are fixed at issuance; the caller cannot redirect value, capture anything, or influence the outcome. This eliminates operator-liveness risk.
- Must revert (or no-op — plan picks one and documents) when the token/holder is not expired; must be idempotent.
- Per-holder for PerHolder mode (settles only `account`'s clock-expired balance); per-token-ID for PerTokenId mode (settles `account`'s balance under the shared expired window).
- No unbounded loops over holders or token IDs. Bounded batch settlement may be added if the plan shows it's safe.
- Emits holder, ID, amount, disposition, destination.
- Expired-but-unsettled balances count as circulating supply until settled (Phase 12 ledger convention).

### D10. Anti-scalping issuance controls — full v1

Ship in v1, enforced in `GNUSNFTFactory.beforeMint()` (the natural hook):

- **Per-wallet mint cap** per token ID — tracked in `mapping(uint256 id => mapping(address wallet => uint256)) mintedPerWallet`. Documented as Sybil-vulnerable; not identity-proof.
- **Sale window** — covered by `validFrom` (and per-ID `validUntil`); no separate fields needed for windowed sales in PerTokenId mode.
- **Generic credential hook** — optional `credentialVerifier` contract address per token ID (0 = open minting). Called from `beforeMint` with minter, amount, and opaque `bytes credential`. Lets creators plug in EIP-712 vouchers, merkle allowlists, or identity providers later WITHOUT a diamond upgrade.
- **No per-transaction cap** — pure friction, trivially bypassed by multiple txs.
- Checks-effects-interactions: per-wallet mint count updates BEFORE the external verifier call; verifier call reentrancy into mint must be neutralized (existing reentrancy guard if present, else ordering + reentrancy note for the plan).

### D11. AI Credits product configuration

- **AI Credits is a direct child of GNUS**, `exchangeRate = 1.0` (minion-denominated). No grandchildren required — the PerHolder expiry model removes the window-ID-per-month bookkeeping.
- Configuration: `SOULBOUND`, `BURN` disposition, `PerHolder` expiration mode, `defaultDuration` per SKU (monthly / annual variants are separate SKUs or durations supplied at purchase), spending = consumption burn by the service backend.
- Purchased with GNUS via the standard conversion path. The $5 fiat leg: customer pays via Banxa → GNUS → converts to AI Credits. Price is a fixed GNUS amount per SKU in v1 (no oracle).
- **Banxa → conversion automation is app-layer scope, NOT Phase 13.** Launch pattern (recommended): treasury-direct — company wallet holds GNUS, Banxa payment confirmation triggers backend mint of AI Credits directly to the user from treasury-held GNUS. EIP-712 permit-based relayer automation is a later app-layer upgrade. Phase 13 contracts must not preclude either.

### D12. `withdraw()` is untouched — GNUS treasury only

- `GNUSBridge.withdraw()` remains the direct-GNUS-child redemption path, owned and rewritten by Phase 9. Phase 13 never modifies it.
- `REDEEM_TO_PARENT` settlement is a separate function (settlement path), targeting the direct parent, not GNUS.
- `exchangeRate` semantics: **child units per 1 direct-parent unit**, consistent at every tree level (aligns with Phase 9's fixed-point convention — CONCERNS #2).

### D13. API surface (names finalized in plan)

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
</decisions>

<enforcement>
## Enforcement Requirements

Transfer policy must be enforced in every applicable balance-moving path, not only in UI metadata:

- ordinary ERC-1155 single and batch transfers (via `_beforeTokenTransfer` predicate);
- mint and burn paths (policy-specific restrictions);
- consumption/spend burns for AI Credits (allowed under SOULBOUND);
- expiration settlement paths;
- bridge `lockTokens()` (policy-bound tokens non-bridgeable in v1 — D7);
- any future custom direct-balance batch paths (must reuse the predicate — D6).

The `NFT_PROXY_OPERATOR_ROLE` auto-approval must not become a policy bypass (D6).
</enforcement>

<security_and_upgrade>
## Security and Upgrade Requirements

1. Storage changes append-only; existing `NFT` records decode with zero defaults = active, UNRESTRICTED, NONE disposition, no expiry (upgrade test required).
2. Enum ordinals stored on-chain: 0 = backwards-compatible default; append-only; never reorder.
3. Policy/disposition/mode/recipient immutable after first mint; timestamps creator-only mutable; all mutations emit events (D4).
4. Settlement is permissionless but fixed-outcome: no caller-controlled value flow, no caller-dependent side effects (D9).
5. Expired balances are never resurrected by renewal (D3); settlement is final.
6. SOULBOUND permits only mint, consumption burn, settlement burn, fixed-recipient return, narrowly approved issuer correction (D5/D6).
7. `NFT_PROXY_OPERATOR_ROLE` and bridge vault get no policy exemptions (D6/D7).
8. REDEEM_TO_PARENT only for Phase-9-collateralized tokens; settlement must not break `reserve[id] >= quoteRedeem(id, totalRedeemableSupply[id])` (D8).
9. Per-wallet caps documented as Sybil-vulnerable, never described as identity-proof (D10).
10. Credential-verifier external call follows CEI; mint-count updated before the call (D10).
11. No unbounded loops over holders or token IDs.
12. Burn-only AI tokens never credit GNUS, parent, reserve, treasury, refund, or rollover balances.
13. All new selectors pass diamond collision checks; policy storage setters and enforcement hooks ship in the same diamondCut (no unenforced-policy window).
14. Testnet upgrade, storage-layout verification, selector verification, rollback plan, Slither review, full regression before mainnet.
15. New-field events emitted at token creation for off-chain indexers/loupe consumers.
</security_and_upgrade>

<testing>
## Required Test Categories

- legacy NFT: zero-default decode; active, non-expiring, UNRESTRICTED, behaviorally unchanged after upgrade;
- `validFrom` boundary: cannot spend/mint before start; exact boundary active;
- PerTokenId `validUntil`: exact expiry boundary (exclusive); expired cannot spend;
- PerHolder: purchase sets clock; active renewal stacks (`expiry += duration`); expired renewal settles-then-restarts from `now + duration`; zero-balance starts from `now + duration`;
- PerHolder renewal never resurrects expired balance (settle-first proven by balance before/after);
- invalid config reverts: PerHolder + transferable policy; REDEEM_TO_PARENT on non-collateralized token; disposition/recipient mismatch;
- policy immutability after first mint; timestamp creator-only mutability; unauthorized mutation reverts; events emitted;
- SOULBOUND rejects direct, operator, and marketplace-role (`NFT_PROXY_OPERATOR_ROLE`) holder-to-holder transfers; permits mint, spend-burn, settlement burn;
- ISSUER_ONLY / ALLOWLISTED / LOCKED_AFTER_START boundary behavior;
- CONTROLLED_RESALE (v1) blocks ordinary single + batch transfers;
- bridge `lockTokens()` reverts for policy-bound tokens; UNRESTRICTED bridges;
- per-wallet mint cap atomic in single + batch; cap not bypassable by repeat calls; tests document Sybil limitation;
- credential verifier: absent = open; present = valid credential mints, invalid reverts; CEI ordering (no reentrancy double-mint);
- BURN settlement decreases holder balance and total supply; KEEP_INERT keeps balance, denies entitlement; RETURN_TO_ADDRESS pays only configured recipient; caller cannot redirect; settlement before expiry reverts; idempotent repeat;
- REDEEM_TO_PARENT settles into direct parent at exchangeRate via Phase 9 reserve; solvency invariant holds post-settlement;
- burn-only AI spend/expiry creates zero GNUS/parent/reserve/treasury/refund/rollover credit;
- ERC-20 proxy transfer of SOULBOUND token reverts via hook (no proxy changes);
- mixed-token batches revert atomically on any policy violation;
- expired-unsettled balances counted as circulating (Phase 12 convention).
</testing>

<dependencies>
## Phase Dependencies

| Phase | Relationship |
|---|---|
| **9 — Treasury/Reserve** | **HARD prerequisite — implement after Phase 9 completes.** REDEEM_TO_PARENT settlement, exchange-rate conventions, collateralized-mint classification all build on Phase 9's reserve model |
| **10 — Bridge Vault** | CONSTRAINT: Phase 13 ships the policy predicate; whoever lands second wires it into `lockTokens()`. Policy-bound tokens non-bridgeable in v1 (D7) |
| **11 — ERC-20 Proxy Hardening** | No code interaction: proxy is a thin wrapper covered by the hook. Constraint: Phase 11 must not add operator-exemption logic to the proxy (D6) |
| **12 — Supply Ledger** | Convention shared: expired-unsettled = circulating; settlement burns flow through standard `_burn` hooks (D9) |

Phases 7 and 8.2: no interaction.
</dependencies>

<canonical_refs>
## Canonical References

Downstream research, planning, or implementation agents must read:

- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — NFT struct (append target);
- `contracts/gnus-ai/GNUSNFTFactory.sol` — createNFT/createNFTs, mint/mintBatch, beforeMint (issuance hook);
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` — `_beforeTokenTransfer` (enforcement hook);
- `contracts/gnus-ai/ERC20TransferBatch.sol` — GNUS-only batch paths (hook-bypass precedent);
- `contracts/gnus-ai/GNUSBridge.sol` — withdraw (GNUS treasury path, Phase 9 owns), bridgeOut (Phase 10 owns);
- `contracts/gnus-ai/ERC1155ProxyOperator.sol` — NFT_PROXY_OPERATOR_ROLE auto-approval (bypass risk);
- `erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyFacet.sol` — thin-wrapper proxy (covered by hook);
- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` — per-account mapping pattern precedent;
- `.planning/ROADMAP.md` — Phase 9 spec (lines 231-251), Phases 10-12;
- `.planning/codebase/CONCERNS.md` — concerns #1, #2, #5, #24;
- `.planning/codebase/ARCHITECTURE.md`;
- Phase 9 CONTEXT/PLAN when created — reserve storage shapes that D8/D12 build on.
</canonical_refs>

<deferred>
## Deferred Ideas (not Phase 13 scope)

- Controlled-resale mechanism: price caps, gifting, refunds, transfer-count caps, resale cutoffs, consideration handling (native/marketplace/signed settlement) — v2 phase;
- Banxa → conversion purchase automation backend (treasury-direct at launch; EIP-712 permit relayer later) — app-layer workstream;
- USD-denominated (oracle-priced) allocation purchases — v2;
- Cross-chain soulbound credentials via attestation mirroring — future;
- Per-mint-lot provenance / return-to-original-sender — confirmed out of scope permanently (would require per-unit accounting);
- Phase 12 v2 "active supply" metric keyed off isTokenActive.
</deferred>

---

*Phase: 13-Time-Bound ERC-1155 Entitlements*
*Context gathered: 2026-07-27; decisions locked: 2026-08-03*
*Approval: approved for planning — implementation blocked until Phase 9 completes*
</content>
