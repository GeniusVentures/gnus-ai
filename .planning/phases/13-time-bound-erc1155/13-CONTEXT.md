# Phase 13: Time-Bound ERC-1155 Tokens — Discussion Context

**Gathered:** 2026-07-27  
**Status:** Discussion — explicit user approval required before planning or implementation  
**Target code:** `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` and dependent ERC-1155 paths  
**External design reference:** https://grok.com/share/bGVnYWN5_1fcc8abf-f66b-4dc5-9718-14ec27870006

> This document records the requested feature and the code paths that must be considered. Nothing below is a locked implementation decision until the user approves the temporal semantics and enforcement rules.

---

<domain>
## Phase Boundary

Add optional token-level time bounds to the GNUS ERC-1155 NFT metadata model. The existing `NFT` struct in `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` is the canonical per-token-ID metadata record and is therefore the intended storage location.

The feature must support scheduled activation and/or expiration without breaking existing deployed token metadata, diamond storage layout, existing token IDs, or existing function selectors.

This phase is about **token-type validity** for an ERC-1155 ID. It is not per-holder vesting and not per-mint-lot expiration.
</domain>

---

<current_code>
## Existing Code Findings

### Canonical ERC-1155 metadata

`contracts/gnus-ai/GNUSNFTFactoryStorage.sol` currently defines:

```solidity
struct NFT {
    string name;
    string symbol;
    string uri;
    uint256 exchangeRate;
    uint256 maxSupply;
    address creator;
    uint128 childCurIndex;
    bool nftCreated;
}
```

`GNUSNFTFactory.createNFTs()` writes this struct with a literal initializer. Any appended temporal fields must therefore be populated explicitly for newly created tokens while existing deployed entries continue to decode safely with zero-valued appended fields.

### Transfer enforcement point

`GNUSERC1155MaxSupply._beforeTokenTransfer()` is the shared hook for ordinary ERC-1155 mint, transfer, and burn operations. It already iterates every token ID for pause, banned-transferor, max-supply, and limiter enforcement. Time-bound validation should reuse this existing pass rather than introduce another full loop.

### Non-standard batch path

`ERC20TransferBatch` has a separate `_beforeTokenTransfer` overload and directly mutates GNUS balances. It does not flow through the normal ERC-1155 hook. If time bounds can ever apply to `GNUS_TOKEN_ID`, this path requires explicit enforcement. If GNUS is permanently unbounded, the document and tests must state that invariant.

### Bridge, redemption, and burn paths

Bridge-out, withdrawal, redemption, and burn behavior must be reviewed separately. Expiry must not accidentally strand value by blocking the only exit path available to a holder.
</current_code>

---

<recommended_baseline>
## Recommended Baseline for Approval

The following is a proposed baseline, not yet a locked decision.

### Candidate storage fields

Append these fields to the end of `NFT`; do not reorder any existing field:

```solidity
uint64 validFrom;
uint64 validUntil;
```

Proposed semantics:

- `validFrom == 0`: active immediately.
- `validUntil == 0`: no expiration.
- Otherwise the token is active when `block.timestamp >= validFrom && block.timestamp < validUntil`.
- `validUntil` must be zero or strictly greater than `validFrom`.
- Existing NFTs have both fields equal to zero and remain permanently active.

Two absolute timestamps are preferred over a duration because they are deterministic, queryable, bridgeable, and do not depend on when a later operation happens to execute.

### Proposed default behavior

- Existing `createNFT()` and `createNFTs()` selectors remain unchanged and create unbounded tokens.
- New explicit creation APIs or a pre-mint configuration API set time bounds without changing deployed selectors.
- Minting before activation or at/after expiration reverts.
- Transfers before activation or at/after expiration revert.
- Burning remains allowed after expiration so holders are not trapped.
- Redemption or reserve withdrawal remains allowed after expiration unless token economics explicitly require a different rule.
- Expiration changes transferability and mintability; it does not delete balances, reduce total supply, or automatically burn tokens.
- `GNUS_TOKEN_ID` remains permanently unbounded unless separately approved.

### Proposed mutability rule

Time bounds should be immutable after the token is first minted. If administrative correction is required before first mint, it must emit an event and pass the same validity checks. Post-mint extension would otherwise let a creator revive an expired token or materially change holder expectations.
</recommended_baseline>

---

<approval_questions>
## Decisions Requiring User Approval

1. **One timestamp or a full window:** only `expiresAt`, or both `validFrom` and `validUntil`?
2. **Boundary rule:** should `validUntil` be exclusive (`timestamp < validUntil`) or inclusive?
3. **Zero-value meaning:** should zero mean unbounded, or should all new tokens require an explicit bound?
4. **GNUS token:** must token ID `0` always remain unbounded?
5. **Expired balances:** should holders retain burn and redemption rights after expiry?
6. **Bridge behavior:** should an expired token be bridgeable, burnable for bridge-out, or neither?
7. **Mutation:** immutable at creation, mutable until first mint, or admin-adjustable later?
8. **Parent/child inheritance:** may a child token outlive its parent, or must its validity window be contained within the parent window?
9. **Creation API:** overload existing creation functions, add new named functions, or configure bounds separately before first mint?
10. **Scope:** token-ID-level bounds only, or a future requirement for per-mint-lot/per-holder expiration?
11. **Metadata/UI:** should `getNFTInfo()` remain the only read surface, or should dedicated `isTokenActive()` / `getTokenTimeBounds()` views be added?
12. **Legacy policy:** confirm all existing deployed NFTs remain permanently active through zero-value defaults.
</approval_questions>

---

<implementation_constraints>
## Required Implementation Constraints

These constraints apply regardless of the approved semantics:

- **Append-only storage:** temporal fields must be appended to `NFT`. Existing fields must not be reordered, removed, narrowed, or repacked intentionally.
- **Storage verification:** run a storage-layout comparison against the deployed diamond before proposing the upgrade.
- **No holder enumeration:** expiry must be evaluated lazily during operations and views; no loop over token holders.
- **No automatic state mutation:** reading an expired token must not mutate balances or supply.
- **Shared enforcement helper:** define one internal active-window predicate/check and reuse it from mint/transfer/bridge paths.
- **Batch correctness:** mixed-ID ERC-1155 batches must reject the whole atomic operation if any ID is inactive.
- **No selector collision:** any new facet functions must be checked against the diamond selector table.
- **Event observability:** initial configuration and any permitted updates require explicit events containing token ID and both bounds.
- **Timestamp limitations:** use `block.timestamp`; do not present sub-minute precision or exact wall-clock guarantees.
- **Backward compatibility:** existing token IDs and existing creation APIs must keep their current behavior unless explicitly migrated.
</implementation_constraints>

---

<proposed_requirements>
## Proposed Requirement IDs

These IDs are provisional until the phase is approved and added to `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`.

- **TIME-01 — Storage:** Append approved temporal-bound fields to the ERC-1155 `NFT` metadata struct without corrupting existing diamond storage.
- **TIME-02 — Configuration:** Provide validated, observable creation/configuration paths for bounded and unbounded token IDs while preserving existing selectors.
- **TIME-03 — Enforcement:** Enforce activation/expiration consistently across ordinary mint and transfer paths, batches, and any approved bridge behavior.
- **TIME-04 — Holder Safety:** Preserve the approved burn/redemption exit rights after expiration and never silently delete balances.
- **TIME-05 — Compatibility:** Existing deployed NFTs remain valid under zero-valued temporal fields; storage-layout and upgrade tests prove compatibility.
- **TIME-06 — Testing:** Cover exact boundary timestamps, legacy tokens, mixed batches, mutation authorization, GNUS-token invariants, and bridge/redeem/burn behavior.
</proposed_requirements>

---

<validation>
## Required Validation Before Merge

1. Storage-layout diff proves all existing `NFT` fields retain their original slots and offsets.
2. Upgrade/fork test reads existing NFT records before and after the facet/storage upgrade with identical legacy values.
3. Legacy token with zero bounds remains mintable and transferable under existing rules.
4. Bounded token tests cover:
   - before `validFrom`;
   - exactly at `validFrom`;
   - one second before `validUntil`;
   - exactly at `validUntil`;
   - after `validUntil`.
5. Mint, single transfer, ERC-1155 batch transfer, and burn behavior match the approved policy.
6. A mixed batch containing one inactive token reverts atomically.
7. Existing `createNFT()` / `createNFTs()` ABI selectors remain unchanged if backward-compatible wrappers are retained.
8. Any new selector is checked for diamond collisions.
9. Existing full Hardhat and Foundry suites remain green.
10. Slither findings for the changed contracts are reviewed before the contract submodule PR is opened.
</validation>

---

<out_of_scope>
## Out of Scope

- Per-wallet vesting or lockups.
- Per-mint-lot expiration for fungible balances sharing one ERC-1155 ID.
- Automatic burning or confiscation at expiry.
- On-chain iteration over holders.
- Subscription billing, payment streaming, or recurring renewal logic.
- Off-chain keepers required merely to mark a token expired.
- Changes to reserve economics except where necessary to preserve an expired holder's approved exit rights.
</out_of_scope>

---

<canonical_refs>
## Canonical References

Downstream planning and implementation agents must read these before proposing code:

- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — canonical `NFT` struct and diamond storage position.
- `contracts/gnus-ai/GNUSNFTFactory.sol` — creation, minting, struct initialization, and `getNFTInfo()`.
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` — ordinary ERC-1155 mint/transfer/burn hook.
- `contracts/gnus-ai/ERC20TransferBatch.sol` — direct GNUS balance mutation path that bypasses the normal ERC-1155 hook.
- `contracts/gnus-ai/GNUSBridge.sol` — bridge-out and withdrawal behavior.
- `.planning/ROADMAP.md` — current phases 1–12; Phase 13 must not be marked active until this context is approved.
- `.planning/REQUIREMENTS.md` — add TIME-01 through TIME-06 only after approval.
- User-provided design discussion: https://grok.com/share/bGVnYWN5_1fcc8abf-f66b-4dc5-9718-14ec27870006
</canonical_refs>

---

<approval_gate>
## Approval Gate

- [ ] User approves the temporal field model.
- [ ] User approves exact active-window boundary semantics.
- [ ] User approves behavior for mint, transfer, burn, redemption, and bridging after expiry.
- [ ] User approves mutation and parent/child inheritance rules.
- [ ] Only after all four approvals may the phase be promoted from **Discussion** to **Ready for planning**.
- [ ] No PLAN.md, implementation branch, contract change, test change, or submodule-pointer update may begin before that promotion.
</approval_gate>

---

*Phase: 13-time-bound-erc1155*  
*Context gathered: 2026-07-27*  
*Approval: pending*
