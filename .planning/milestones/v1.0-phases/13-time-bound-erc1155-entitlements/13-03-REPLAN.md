---
phase: 13-time-bound-erc1155-entitlements
plan: 03
type: replan-amendment
supersedes: 13-03-PLAN.md (Task 1 & Task 2 mechanism only; Task 3 test suite retained)
wave: 2
depends_on: ["13-01", "13-02"]
amends: ["13-02 (facet file split)", "diamonds/GeniusDiamond config (new facet registration)", "13-04 (mint-branch gate scope)"]
requirements: [SC6]
created: 2026-08-22
---

# 13-03 REPLAN — Entitlements Facet Split, No Delegatecall

> **Why this replan exists.** The first 13-03 executor (killed on provider quota) introduced a
> `_delegateToFacet` trampoline on the shared base `GNUSERC1155MaxSupply` and added `viaIR: true`
> to `hardhat.config.ts`. Both were out-of-spec:
> - `viaIR` detonated a pre-existing solc 0.8.19 via-IR stack-allocation bug in
>   `GNUSBridge._verifyThresholdCertificate` (HH600 YulException). **Reverted.**
> - The trampoline is a diamond anti-pattern: facets never delegatecall each other — the diamond
>   fallback already routes by selector into shared storage. Placing a generic
>   "delegatecall-any-registered-selector" primitive on the shared base **clones it into every
>   inheriting facet, including GNUSBridge** — the exact facet a parallel workstream is
>   restructuring. **Removed.**
>
> **Decision (locked with user):** the entitlement logic lives on its own facet(s) reached
> directly through the diamond fallback. **No delegatecall anywhere.** GNUSLifecycle is split into
> two facets because it overflows EIP-170 once it absorbs the mint path (measured 24,369 B with
> only part of the mint logic inlined; adding `mintWithCredential` tips it over 24,576).

---

## Architectural Decision (supersedes the trampoline)

**Diamond-native routing, zero delegatecall:**

| Concern | Facet | Visibility | Reached via |
|---------|-------|-----------|-------------|
| `createNFTWithLifecycle` | `GNUSLifecycle` (config facet) | external | diamond fallback → selector |
| `configureLifecycle`, `setValidFrom/Until`, `setPerWalletMintCap`, `setAllowlistRegistry` | `GNUSLifecycle` | external | diamond fallback |
| `isTokenActive`, `isSpendable`, `holderExpiresAt` | `GNUSLifecycle` | external view | diamond fallback |
| `mintWithCredential` (sale window + cap CEI + credential + renewal + `_mint`) | **`GNUSLifecycleMint`** (new) | external | diamond fallback |
| `settleExpired`, `_dispatchSettlement`, `_settleRedeemToParent` | **`GNUSLifecycleMint`** | external / internal | diamond fallback / intra-facet |
| `_applyPerHolderRenewal`, `_checkMintPolicy` | **`GNUSLifecycleMint`** | **internal** (attack closed) | intra-facet only |
| Legacy `mint`/`mintBatch` gating (window + cap) | `GNUSERC1155MaxSupply._beforeTokenTransfer` **mint branch** | internal hook | every mint, any selector |
| Transfer policy (13-04) | `GNUSERC1155MaxSupply._beforeTokenTransfer` | internal hook | every transfer |

**The two facets never call each other.** They share state only through diamond storage
(`GNUSNFTFactoryStorage`, `GNUSLifecycleStorage`). The mint facet reads config written by the
config facet; it never invokes a config-facet function.

---

## Facet Split Line

**`GNUSLifecycle`** (existing file, 13-02) — *config & views*:
`supportsInterface`, `isTokenActive`, `isSpendable`, `holderExpiresAt`, `configureLifecycle`,
`setValidFrom`, `setValidUntil`, `setPerWalletMintCap`, `setAllowlistRegistry`,
`createNFTWithLifecycle`, and the shared `_isExpired` predicate (view, used by `isSpendable`).

**`GNUSLifecycleMint`** (new file) — *mint & settle*:
`mintWithCredential`, `settleExpired`, `_dispatchSettlement`, `_settleRedeemToParent`,
`_applyPerHolderRenewal` (internal), `_checkMintPolicy` (internal).

`_isExpired` is needed by both `isSpendable` (config facet) and `settleExpired` (mint facet).
To avoid cross-facet calls it is **duplicated as a small internal view in each facet** (the
~12-line predicate), NOT shared via inheritance or delegation. This is a deliberate, documented
duplication of a pure storage-read predicate — the alternative (a shared base) reintroduces the
coupling this replan removes. Both copies carry a `// KEEP IN SYNC` comment.

---

## Changes to `GNUSNFTFactory.sol` — REVERT to committed state

- `beforeMint` loses the `credential` param and the `_enforceMintPolicy` call → back to the
  original 6-require + `_burn` body.
- Delete the `mintWithCredential` external (moves to `GNUSLifecycleMint`).
- Delete the `_applyPerHolderRenewal` trampoline call-sites from `mint`/`mintBatch`.
- **Net: factory returns to ~23,417 B baseline.** No new selectors on the factory.

## Changes to `GNUSERC1155MaxSupply.sol` — remove trampoline, add hook gate

- **Delete** `_delegateToFacet` and `_enforceMintPolicy` (the trampoline + wrapper).
- **Add** to `_beforeTokenTransfer`, in the mint branch (`from == address(0)`), the legacy-path
  gate (decision **b**):
  - `require(nft.validFrom == 0 || block.timestamp >= nft.validFrom, "Token not yet active")` —
    this is 13-04's planned defense-in-depth `validFrom` gate, now load-bearing.
  - Per-wallet cap CEI: if `perWalletMintCap[id] != 0`, `mintedPerWallet[id][to] += amount` with
    `require(newTotal <= cap)`. Because the hook fires on **every** mint (legacy `mint`,
    `mintBatch`, and the lifecycle mint path all funnel through `_beforeTokenTransfer`), the cap
    is enforced on the legacy path here — no delegation needed.
  - **Credential check is NOT in the hook** — `verify` is `view` and takes a `credential` the
    hook doesn't have; legacy `mint` has no credential to check. Documented limitation: legacy
    mint bypasses credential gating; configured tokens are expected to use `mintWithCredential`.
- **Note:** the cap increment lives in the hook, so `GNUSLifecycleMint._checkMintPolicy` must
  **not** double-count — it asserts the cap but does not re-increment (single write point = the
  hook). Documented in both files.

## Changes to `GNUSLifecycle.sol` — slim to config facet

- Remove `settleExpired`, `_dispatchSettlement`, `_settleRedeemToParent`, `applyPerHolderRenewal`,
  `checkMintPolicy` (all move to `GNUSLifecycleMint`).
- Keep config + views + `createNFTWithLifecycle` + `_isExpired`.
- Result: well under EIP-170.

## New file `GNUSLifecycleMint.sol`

- Inherits `GNUSERC1155MaxSupply, GeniusAccessControl` (same shape as `GNUSLifecycle`).
- External: `mintWithCredential`, `settleExpired`.
- Internal: `_checkMintPolicy` (window + credential; cap *assertion* only — increment is in the
  hook), `_applyPerHolderRenewal`, `_dispatchSettlement`, `_settleRedeemToParent`, `_isExpired`
  (duplicate, KEEP-IN-SYNC).
- `mintWithCredential` body order: (1) base mint requires (id != GNUS, to != 0, amount > 0,
  creator/admin, direct-child, sufficient GNUS) — **these 6 requires move here from
  `beforeMint`-equivalent logic**; (2) `_checkMintPolicy` (window + credential); (3)
  `_applyPerHolderRenewal` (pre-mint, Pitfall P5); (4) `_burn(sender, GNUS_TOKEN_ID, amount)`;
  (5) `_mint(to, id, amount, data)` — the `_mint` triggers the hook, which applies the cap CEI
  increment. **Ordering note:** the cap *increment* happens inside `_mint`'s hook (step 5), which
  is *after* the credential `view` call (step 2). Because `verify` is `view` (STATICCALL) it
  cannot reenter-with-effect, so this ordering is safe; the mock's `reenterMint` is a separate
  non-view driver the test calls directly to prove the cap write lands.

## Diamonds config (`diamonds/GeniusDiamond/geniusdiamond.config.json`)

- Register **`GNUSLifecycleMint`** at **priority 121** (120 = GNUSWithdrawLimiter taken; 121
  first free), `versions["2.7"] = { fromVersions: [0.0, 2.4, 2.5, 2.6] }` mirroring GNUSLifecycle.
- `GNUSLifecycle` (119) keeps its 2.7 entry; its selector set shrinks (settle/mint fns move off).
- `DiamondInitFacet.versions["2.7"]` unchanged (already mirrors 2.6).
- **Deployed-impact note:** protocol 2.7 has not shipped, so moving selectors between facets is a
  pre-release config change, not a live upgrade cut. No `deployed-data` JSON rewrite needed.

## Task 3 (test suite) — retained, adjusted

`test/unit/GNUSNFTFactoryAntiScalping.test.ts` target changes: mint paths now hit
`mintWithCredential` on the **mint facet** (via diamond) and legacy `mint` on the factory. The
10 behaviors are unchanged in intent; the cap assertions read the same `mintedPerWallet` storage;
the reentrancy test drives `MockCredentialVerifier.reenterMint` → `mintWithCredential` and proves
the hook's cap increment lands before the reentrant call is counted.

---

## Wave / dependency impact

- **13-03** (this replan): wave 2, depends on 13-01 + 13-02 (unchanged).
- **13-04** (transfer policy): scope **grows** — its mint branch now carries the load-bearing
  window + cap-increment gate (above), not just the `validFrom` defense-in-depth. 13-04 must land
  before legacy-path cap enforcement is active. Sequence 13-03 → 13-04 stays valid; both touch
  `GNUSERC1155MaxSupply` so they must **not** run in parallel worktrees (already serialized per
  checker W1).
- **13-05 / 13-06**: unchanged.

---

## ADDENDUM (2026-08-23, locked with user): cap increment = single write point in the hook

**Decision (option 1 of the two presented):** the per-wallet cap **increment** lives **once, in
`GNUSERC1155MaxSupply._beforeTokenTransfer`** (the mint branch), NOT in
`GNUSLifecycleMint._checkMintPolicy`. 13-04 implements this.

**Why this does NOT violate the no-cross-facet / no-delegatecall rule:** `_beforeTokenTransfer`
is an `internal` function defined on the shared base `GNUSERC1155MaxSupply`, which every facet
inherits. `_mint` (also internal, from ERC1155Upgradeable) calls it **inline, intra-contract** —
there is no selector routing, no cross-facet call, no delegatecall. It is the same mechanism the
existing max-supply check (base `:58-63`) and the withdraw-limiter charge (base `:78`) already
use. The legacy `GNUSNFTFactory.mint()` path and the `GNUSLifecycleMint.mintWithCredential` path
**both** funnel through `_mint` → `_beforeTokenTransfer`, so the hook is the single point that
gates both natively.

**The mechanism:**
- `_beforeTokenTransfer` mint branch gains: window gate (`validFrom`) + per-wallet cap
  **check-and-increment** (CEI). Because it fires on every mint on both paths, the legacy path is
  cap-gated (decision **b**) with a single write — no double-count.
- `GNUSLifecycleMint._checkMintPolicy` **drops its `mintedPerWallet[id][to] = newTotal` write**
  (13-03 shipped it there as the only enforcement point; it is now redundant and would
  double-count). `_checkMintPolicy` keeps the sale-window check and the credential-verifier call
  only. It may keep a read-only defensive cap assert or drop the cap logic entirely — 13-04
  chooses and documents.
- **Ordering note (accepted):** the cap increment now lands inside `_mint` (in the hook), which is
  *after* the mint facet's credential `view` call. This is safe because `verify` is `view`
  (STATICCALL) and cannot reenter-with-effect; the mock's `reenterMint` is a separate non-view
  driver the test calls directly. Strict "cap-before-credential" ordering is traded away for a
  single write point — accepted by the user.

**Test impact:** the 13-03 anti-scalping suite's cap assertions read `mintedPerWallet` — these
still hold (the storage write just moves from the facet to the hook). 13-04 must re-run
`test/unit/GNUSNFTFactoryAntiScalping.test.ts` and confirm the cap tests still pass with the
increment relocated.

## Verification gates (unchanged in spirit)

- `yarn compile` clean; **both** `GNUSLifecycle` and `GNUSLifecycleMint` deployedBytecode printed
  and ≤ 24,576; `GNUSNFTFactory` ≤ 24,576 (expected ~baseline).
- `grep -c "_delegateToFacet\|viaIR" contracts/gnus-ai/GNUSERC1155MaxSupply.sol hardhat.config.ts`
  returns 0 (trampoline + viaIR gone).
- `npx hardhat test test/unit/GNUSNFTFactoryAntiScalping.test.ts` green.
- `npx hardhat test` no new failures vs. baseline (502 passing / 2 pending / 1 known-stale).
