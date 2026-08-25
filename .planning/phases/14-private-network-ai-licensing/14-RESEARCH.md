# Phase 14: Private-Network AI Licensing - Research

**Researched:** 2026-08-25
**Domain:** Solidity diamond facets (licensing/SKU/payment) on the gnus-ai GeniusDiamond; EVM↔SuperGenius expiry transport
**Confidence:** HIGH (EVM contract surface verified against source; bridge/UTXO determinism questions are spec-level, MEDIUM)

## Summary

Phase 14's EVM-side surface is small and sharp. After the D-19..D-23 deflations, the genuine contract work is: (1) the D-03 `NFT` struct append of three network-scope fields (LIC-02); (2) a new licensing facet pair holding the D-04 SKU registry plus a GNUS-burn purchase/renewal rail (LIC-03/LIC-04-amended); (3) the `LicenseActivated` event on creation and renewal (LIC-05); (4) a D-23 expiry gate in `GNUSBridge._enforceBridgePolicy` (questions.md #4); and (5) one newly-discovered decision the CONTEXT does not cover — **Phase 13 D7 currently makes SOULBOUND credits non-bridgeable**, which conflicts with the D-21/D-22 model where credits `bridgeOut` to become SG timed UTXOs (see Pitfall 1). LIC-01 and LIC-06 are configuration over existing Phase 13/9 machinery (`createNFTWithLifecycle`, `REDEEM_TO_PARENT`, conversion-native collateralization), and LIC-07 is **fully resolved by D-07 with zero contract work** — ROADMAP success-criterion 7 should be marked resolved.

Two CONTEXT references are stale and must not be planned literally: **`mintBackedChild` does not exist** — Phase 9 pivoted to the conversion-native model (all supplies minion-denominated; `GNUSTreasury.convert()` is the collateralization path) [VERIFIED: contracts/gnus-ai/GNUSTreasury.sol:74, 09-CONTEXT D1 amendment]. And LIC-04's "USDC / Banxa rails" contradicts D-04's no-oracle SKU pricing and D-09's lean; recommend amending LIC-04 to a single on-chain rail (GNUS burn, D-10) with fiat handled off-chain by the operator.

**Primary recommendation:** Build two new facets (`GNUSLicensing` registry + `GNUSLicensingPurchase` rail, both re-keyed into `versions["2.6"]`), append the D-03 struct fields, add the expiry check to `_enforceBridgePolicy`, and explicitly amend Phase 13 D7 to allow SOULBOUND bridgeOut when unexpired (cheapest path to the D-21/D-22 transport model).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Copied verbatim from `.planning/phases/14-private-network-ai-licensing/14-CONTEXT.md` §Implementation Decisions (D-01 through D-23). Highlights the planner must honor:

- **D-01:** Public EVM diamond = canonical billing/settlement/audit layer; SuperGenius = private execution. No new mirroring system.
- **D-02:** License NFTs = children of GNUS AI Product Root; company AI Credits = children of the License NFT; individual AI Credits stay direct product-root children.
- **D-03:** Append `networkScope` {PublicOnly=0, PrivateOnly, Hybrid}, `uint256 privateNetworkId`, `bool publicSettlementEnabled` after Phase 13 fields — append-only, zero-default, decode-compat upgrade test required.
- **D-04:** SKU registry with `priceInMinions`, `creditAmount`, `duration`, `createsLicense`, `renewsLicense`, `active`. NO USD oracle, no `priceUsd`.
- **D-05:** Hybrid tokens MUST be REDEEM_TO_PARENT-capable (exchangeRate > 0, Phase 13 D8, Phase 9 collateralization). Burn-only credits non-redeemable.
- **D-06:** Phase 13 mechanisms referenced, never redefined/extended.
- **D-07/D-08:** NO new on-chain spend-settlement mechanism; SG spend → GV wallet → Phase 10 `bridgeIn` → ops burn. `publicSettlementEnabled` is informational/SG-consumed.
- **D-10:** On-chain GNUS payments are BURNED (totalSupply decreases); no treasury custody.
- **D-12:** License NFTs = PerTokenId `validUntil`; credits = PerHolder + BURN (D-17: balance-removing disposition). Creation behind CREATOR_ROLE/ADMIN_ROLE.
- **D-13/D-20:** `companyAdmin` is an event/config data field only — NO governance machinery.
- **D-14:** `LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)` on creation AND every renewal; SG derives state from events alone.
- **D-19:** Credits mint directly into device wallets; p2p private keys are the true SG-side access control.
- **D-21:** Expiry crosses to SG via bridge-attestation EVM RPC lookup — NO bridgeOut event/message change.
- **D-22:** SG timed UTXOs live in the SuperGenius repo (seed) — out of scope here.
- **D-15:** protocolVersion stays 2.6 — new facets re-key into `versions["2.6"]`, fromVersions [0.0, 2.4, 2.5].
- **D-16/D-18:** Facet-split, compile-time-linked libraries only (no delegatecall trampolines); Solidity 0.8.19; append-only storage; EIP-170 ≤24,576 B/facet; no magic numbers; no viaIR.

### Claude's Discretion
- SKU registry administration via existing CREATOR_ROLE/ADMIN roles; enable/disable via the LIC-03 `active` flag (no new role machinery unless research shows need).
- Placement of router/registry logic across facets honoring facet-split + bytecode-budget constraints.

### Deferred Ideas (OUT OF SCOPE)
- On-chain Banxa/USDC contract-side payment rails (LIC-04 as written) — pending D-09 resolution here.
- PD-BR-1..PD-BR-8 (Secure-BridgeIn SPEC) — Phase 10 amendment candidates, queued separately.
- On-chain seat/operator management for tenants (v2).
- SG-side timed UTXO implementation (SuperGenius repo, issue #366).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIC-01 | License NFT hierarchy (root → license → credits) | Existing `createNFTWithLifecycle` supports grandchildren: only the parent's creator may create its children (GNUSLifecycle.sol:351-353), so the GV operator (license creator) creates credit tokens under each license. PerHolder+SOULBOUND combination is explicitly allowed (GNUSLifecycle.sol:362-365). Config + tests only; no new mechanism. |
| LIC-02 | NFT struct network-scope append | Slot-mapped append after `credentialVerifier` (currently slot +10): `privateNetworkId` → slot +11; `networkScope` (uint8) + `publicSettlementEnabled` (bool) pack → slot +12. Follow the Phase 13 `GNUSLifecycleUpgrade.test.ts` slot-probe pattern. |
| LIC-03 | SKU registry | New facet + storage library (pattern: GNUSLifecycleStorage). All seven D-04 fields; admin/creator-gated CRUD; `active` flag gating. |
| LIC-04 | Payment router | **Amend wording** (see D-09 recommendation): single on-chain rail = GNUS ERC-20 pull (`safeTransferFrom`) → burn, per D-10. No USDC/Banxa contract code. New purchase facet. |
| LIC-05 | `LicenseActivated` event | Emitted from the licensing facet on create + renew. Renewal = extend PerTokenId `validUntil` (semantics of existing `setValidUntil`, but invoked internally by the purchase path, not the role-gated external setter). |
| LIC-06 | Hybrid redeemability | Zero new code: Phase 13 `configureLifecycle` already enforces REDEEM_TO_PARENT ⇒ `!nonConvertible` (GNUSLifecycle.sol:205-207) and Phase 9 `convert()` provides collateralization both directions. Configuration + tests. **Note: CONTEXT's "Phase 9 `mintBackedChild`" does not exist — superseded by conversion-native model.** |
| LIC-07 | Private-spend design | **Resolved by D-07 — no contract work.** Reused as-is: Phase 10 `bridgeIn` + `GNUSBridge.burn(user, amount)` (onlyRole MINTER_ROLE, GNUSBridge.sol:178) is the ops-burn path. Roadmap SC7 should be closed as resolved. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SKU registry & pricing | EVM diamond (new licensing facet) | — | Canonical billing data; fixed minion prices need no oracle |
| License/credit creation & lifecycle config | EVM (existing `createNFTWithLifecycle`) | — | Phase 13 machinery referenced, not redefined (D-06) |
| GNUS payment + burn | EVM (new purchase facet) | — | D-10 burn sink; buyer allowance → pull → self-burn of ERC-1155 id 0 |
| Fiat acquisition ($20 → $5 GNUS) | Off-chain operator + GeniusWallet (Banxa/Squid) | — | D-09: wallet already owns acquisition; no contract rail |
| AI execution / spend | SuperGenius private network | — | D-01/D-19: p2p device keys are real access control |
| Expiry enforcement at spend time | SuperGenius (timed UTXOs, other repo) | EVM (mint gate + D-23 bridge gate) | D-22; EVM burn path intentionally permits expired burns (settlement carve-out) |
| Spend settlement back to EVM | Off-chain ops (GV wallet → bridgeIn → ops burn) | — | D-07; no new mechanism |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GeniusDiamond facets (in-repo) | protocolVersion 2.6 | All new logic lives in new facets of the existing diamond | D-15/D-16; verified `diamonds/GeniusDiamond/geniusdiamond.config.json` uses per-facet `versions["2.6"]` with fromVersions [0.0,2.4,2.5] |
| OpenZeppelin upgradeable (in-repo lib/) | existing | ERC1155Upgradeable, AccessControlEnumerableUpgradeable base | Same base as GNUSLifecycle et al. [VERIFIED: codebase] |
| Hardhat + ethers | 2.26.5 / repo lockfile | Unit + upgrade tests | Baseline 571 passing |
| Foundry | 1.7.1 (forge) | Invariant tests | 215 passing; `yarn forge:test` requires a running `npx hardhat node` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GNUSLifecyclePolicy (compile-time-linked lib pattern) | existing | Shared predicate pattern for any shared licensing predicates | Only if logic must be shared across facets without a trampoline (D-16) |

No new external packages. This phase installs nothing from npm/PyPI/crates.

## Package Legitimacy Audit

No external packages installed. Not applicable — all dependencies are in-repo contracts and the existing toolchain.

## Architecture Patterns

### System Architecture Diagram

```
Company (fiath path, D-09 operator rail)
  │  $20 fiat → GV (off-chain)
  │            GV buys ~$5 GNUS (Banxa/Squid, GeniusWallet)
  ▼
GV operator (CREATOR_ROLE)
  │  createNFTWithLifecycle → License NFT (child of Product Root,
  │    PerTokenId validUntil, networkScope/privateNetworkId/publicSettlementEnabled)
  │  emit LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)
  ▼
Anyone (permissionless path, D-11 recommendation)
  │  approve GNUS → purchase(creditSkuId, licenseId, deviceWallet)
  │    ├─ pull priceInMinions GNUS ─► BURN (D-10)
  │    └─ mint creditAmount into deviceWallet (PerHolder + BURN + SOULBOUND)
  ▼
Device wallet (embedded, D-19)
  │  bridgeOut(credits) ──► [D-23 expiry gate: revert if expired]
  │                          └─ burn + BridgeOutInitiated (unchanged)
  ▼
SG validators (existing attestation, D-21 — NO message change)
  │  EVM RPC lookup: holderExpiresAt(id, deviceWallet) @ burn block
  ▼
SuperGenius timed UTXO (expiresAt field, D-22 — other repo)
  │  AI spend (p2p keys are access control)
  ▼
SG-side spend → GV wallet → Phase 10 bridgeIn (unchanged) → ops `burn()` (D-07, done)
```

### Recommended Project Structure
```
contracts/gnus-ai/
├── GNUSLicensingTypes.sol        # NetworkScope enum, SKU struct, LicenseActivated event
├── GNUSLicensingStorage.sol      # diamond-storage Layout: skus, (optional) licenseId→companyAdmin
├── GNUSLicensing.sol             # registry facet: SKU CRUD, views (creator/admin-gated)
└── GNUSLicensingPurchase.sol     # rail facet: purchaseLicense/purchaseCredits/renewLicense,
                                  #   GNUS pull + burn, mints, LicenseActivated emission
test/unit/GNUSLicensing.test.ts   # registry + rail unit tests
test/unit/GNUSLifecycleUpgrade.test.ts  # extend: D-03 slot-probe append (LIC-02)
test/unit/GNUSBridgePolicy.test.ts      # extend: D-23 expired-bridgeOut gate
diamonds/GeniusDiamond/geniusdiamond.config.json  # register 2 facets at versions["2.6"]
```

### Pattern 1: Struct append with slot annotation (LIC-02)
Follow the Phase 13 comment/probe discipline exactly (GNUSNFTFactoryStorage.sol:19-33):
```solidity
// Phase 14 appends below - do not reorder, do not insert above this line
// privateNetworkId occupies slot +11; networkScope (1B) + publicSettlementEnabled (1B)
// pack into slot +12. Verified by storage probe in GNUSLifecycleUpgrade.test.ts.
uint8   networkScope;          ///< D-03/PD-3 — NetworkScope ordinal; 0 = PublicOnly (zero-default)
uint256 privateNetworkId;      ///< D-03/PD-3 — SG tenant/network ID; 0 = unset
bool    publicSettlementEnabled; ///< D-08 — informational, SG-consumed; false default
```
[VERIFIED: existing struct layout GNUSNFTFactoryStorage.sol:10-34]

### Pattern 2: GNUS-burn purchase rail (D-10)
No GNUS-paid mint exists today (Phase 13 launch pattern was treasury-direct operator minting), so this is new but composed of existing primitives: ERC-20 `safeTransferFrom(buyer, address(diamond), priceInMinions)` then burn the diamond's own GNUS via the existing ERC-1155 id-0 burn path so `totalSupply` decreases. Do NOT route the payment through `GNUSTreasury.convert()` — that reallocates rather than burns (D-10 requires burn).

### Pattern 3: Renewal via internal lifecycle semantics
Renewal SKU = extend PerTokenId `validUntil` to `max(current, block.timestamp) + duration` and re-emit `LicenseActivated` (D-14). Implement inside the purchase facet against the storage directly or via a narrow internal call — do not widen the existing role-gated `setValidUntil` external setter. For PerHolder credits, the mint path already extends `holderExpiresAt` (`_applyPerHolderRenewal`, GNUSLifecycleMint.sol:219-246) — top-up SKUs get renewal for free.

### Anti-Patterns to Avoid
- **Redefining Phase 13 semantics** (D-06): no new expiry modes, dispositions, or transfer policies. Licensing facet composes them.
- **Treasury custody of payments** (violates D-10) or `priceUsd`/oracle anything (violates D-04).
- **protocolVersion 2.7** (D-15) or editing existing facet selectors rather than appending.
- **Governance machinery for companyAdmin** (D-13/D-20) — event/config data only.
- **New bridgeOut message fields** (D-21) — expiry transport is RPC-lookup only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| License creation + lifecycle config | Custom creation path | `createNFTWithLifecycle` | Grandchild creation auth, enum validation, PerHolder+policy combination checks all exist (GNUSLifecycle.sol:335-365) |
| Hybrid redeemability | New redeem mechanism | Phase 13 `REDEEM_TO_PARENT` settlement + Phase 9 `convert()` | Already enforce `exchangeRate > 0`, `!nonConvertible`, reserve identity (D-05/D-06) |
| SG spend settlement | New bridge/settlement contract | Phase 10 `bridgeIn` + `GNUSBridge.burn` (MINTER_ROLE) | D-07 locked; verified burn entrypoint GNUSBridge.sol:178 |
| Expiry transport to SG | bridgeOut message/attestation change | SG-side RPC lookup at burn block (D-21) | Zero contract change; determinism via block-pinned `eth_call` |
| Role machinery for SKU admin | New roles | CREATOR_ROLE / DEFAULT_ADMIN_ROLE | D-discretion confirms; existing pattern |

## Runtime State Inventory

Not a rename/refactor/migration phase — however, the **append-only upgrade** dimension applies:
- **Stored data:** existing `NFTs` mapping entries decode with zero defaults (PublicOnly/0/false) — proven by the LIC-02 upgrade test; no data migration.
- **Live service config:** new facets require a `diamondCut` + re-registration in `geniusdiamond.config.json` under `versions["2.6"]`; deploy scripts/testnet-first per Phase 13 SC14 discipline.
- **SG-side consumers:** none exist yet (license program is greenfield) — `LicenseActivated` becomes the contract the future SG indexer codes against; get the event signature right first time (D-14 field order is the spec).
- Everything else: none — verified no `License`/`companyAdmin`/SKU strings exist anywhere in contracts (grep 2026-08-25).

## Common Pitfalls

### Pitfall 1: SOULBOUND credits cannot bridgeOut — Phase 13 D7 vs D-21/D-22 (NEW FINDING)
**What goes wrong:** `_enforceBridgePolicy` reverts for SOULBOUND/ISSUER_ONLY/CONTROLLED_RESALE ("Policy-bound token cannot bridge in v1", GNUSBridge.sol:330-331). Phase 13 D11 shapes AI Credits as SOULBOUND, yet D-19/D-21/D-22 require credits in device wallets to `bridgeOut` and become SG timed UTXOs. As written, the D-23 gate would sit on a path that already reverts for the exact token class that needs it.
**How to avoid:** Phase 14 must explicitly amend Phase 13 D7 (a documented CONTEXT amendment, like Phase 9's revision precedent): permit SOULBOUND `bridgeOut` when the holder is unexpired — naturally expressed inside the D-23 expiry gate itself (check expiry, revert if expired; allow SOULBOUND through otherwise). Alternative (rejected): ALLOWLISTED policy per tenant requires deploying an allowlist registry contract per credit token (`setAllowlistRegistry` + `IAllowlistRegistry.isAllowed(sender)`) — real per-tenant deployment overhead for no additional security given D-19 (p2p keys are the true access control). The planner should surface this as a one-checkpoint decision; recommendation: targeted D7 amendment.
**Warning signs:** a "policy-bound token cannot bridge in v1" revert in any Phase 14 bridge test.

### Pitfall 2: Expired burns are intentionally permitted on EVM — don't "fix" it
The policy predicate's burn branch (to == 0) always returns (GNUSLifecyclePolicy.sol:186-190) — spend/settlement burns must not be expiry-gated, by Phase 13 D5 design. The D-23 gate belongs ONLY in `_enforceBridgePolicy`/`bridgeOut`, never in the shared transfer predicate. Placement answer for questions.md #4: `_enforceBridgePolicy` in GNUSBridge.sol, before the limiter charge and `_burn`, so a revert consumes no limiter allowance (established ordering at GNUSBridge.sol:246-251).

### Pitfall 3: PerHolder + non-balance-removing disposition (D-17)
Every credit SKU config must use BURN/RETURN/REDEEM disposition — `configureLifecycle` and `createNFTWithLifecycle` already reject the bad combinations; ensure SKU-driven configs cannot bypass (they route through the same creation path, so they inherit the gates — keep it that way; never write lifecycle storage directly from the purchase facet).

### Pitfall 4: Slot-ordering regression in the struct append
`networkScope` (uint8) declared before `privateNetworkId` (uint256) would push the uint256 to the next slot anyway — fine — but any attempt to insert fields above the Phase 13 block breaks decode. Keep the "appends below - do not reorder" banner discipline and the slot-probe test (Phase 13 SC1 pattern, GNUSNFTFactoryStorage.sol:22-25).

### Pitfall 5: Burning payment GNUS via the wrong path
`GNUSTreasury.convert` reallocates minions between tokens (supply-neutral) — it does NOT burn. D-10 requires totalSupply to decrease: pull ERC-20 GNUS to the diamond, then burn the diamond's ERC-1155 id-0 balance through the existing burn machinery. Test must assert GNUS totalSupply delta = priceInMinions.

### Pitfall 6: Permissionless purchase griefing vectors (D-11)
Self-serve purchase is irreversible (payment burned — no refund path on-chain; disputes are off-chain operator policy). Max-supply exhaustion by whales is bounded by `maxSupply` per token and by the fact that credits are cheap, SOULBOUND, and time-boxed (user's own reasoning). Mint destination is caller-chosen (`deviceWallet`) — minting credits into arbitrary addresses is harmless (SOULBOUND + they paid). Verifier-free minting must route through the policy hook's mint branch so `perWalletMintCap`/window gates still apply.

### Pitfall 7: Known-stale tests masquerading as regressions
Hardhat baseline 571 passing / 2 pending / 1 known-stale chainID failure — never fix that one. Foundry 215 passed / 2 known-stale Phase 08.1 setUp reverts / 3 skipped; `yarn forge:test` needs a running `npx hardhat node`. Wave tasks must quote these baselines.

## Code Examples

### D-23 expiry gate (placement answer, questions.md #4)
```solidity
// Source: pattern derived from GNUSBridge._enforceBridgePolicy (GNUSBridge.sol:304-332)
// + GNUSLifecycle expiry views (GNUSLifecycle.sol:127-154)
function _enforceBridgePolicy(address sender, uint256 id) internal view {
    NFT storage nft = GNUSNFTFactoryStorage.layout().NFTs[id];
    if (id == GNUS_TOKEN_ID) { return; }
    if (nft.transferPolicy == uint8(TransferPolicy.UNRESTRICTED)) { return; }
    // D-23: expired holders cannot bridge out (symmetry with SG-side rejection).
    // PerTokenId: block.timestamp >= nft.validUntil && validUntil != 0 → revert.
    // PerHolder: use holderExpiresAt(id, sender) — mint-branch "Sale ended" analog.
    ...
    // Phase 14 D7 amendment (see Pitfall 1): SOULBOUND permitted here when unexpired.
}
```

### Deterministic expiry read (questions.md #1/#2 — spec, not contract code)
SG validators perform `eth_call` **pinned to the burn transaction's block number** (`holderExpiresAt(uint256,address)` → uint64, or `getNFTInfo(id).validUntil`, both existing external views [VERIFIED: GNUSLifecycle.sol:151, GNUSNFTFactory.sol:201]). State at a fixed past block is immutable, so all signers observing the same block hash observe the same expiry — determinism by pinning, no snapshot storage needed. Renewals after the burn block are irrelevant (the units are already burned). Encoding on the SG side (UTXO metadata field 1, `expiresAt` as uint64 epoch) is SuperGenius-repo scope per the seed doc.

## Answers to research/questions.md

1. **Expiry determinism:** block-pinned `eth_call` at the burn block (or block-1 pre-state) — deterministic for all validators observing the same chain; no EVM contract change. Spec note for the SG repo. [MEDIUM — protocol spec recommendation, no counter-example found]
2. **Field/encoding spec:** no EVM change; SG UTXO metadata field 1 = uint64 `expiresAt` sourced from the two existing view functions above. The referenced `notes/bridge-expiry-transport.md` does not exist yet in this repo — the plan should create it (or the seed doc's SG-repo issue owns it).
3. **Renewal on SG:** renewal is EVM-native (license `validUntil` extension + re-emit `LicenseActivated` + fresh credit mint). Already-bridged UTXOs are NOT extendable in v1 — fresh credits must re-bridge (fresh UTXOs). Extending in place would require SG consensus + attestation-authority design: SuperGenius-repo scope, defer.
4. **D-23 gate placement:** inside `GNUSBridge._enforceBridgePolicy` (before limiter + burn, matching the Phase 13 D7 ordering rationale), covering both PerTokenId (`validUntil`) and PerHolder (`holderExpiresAt[id][sender]`). This gate is also the natural vehicle for the Pitfall 1 SOULBOUND amendment.

## D-09 Recommendation (payment rails)

**Recommend: GNUS-only permissionless rail + operator-mediated fiat path; amend LIC-04 wording. No USDC contract rail, no Banxa contract integration.**

- GeniusWallet already ships Banxa on-ramp + Squid Router (CONTEXT canonical ref) — users and GV arrive holding GNUS; a USDC rail would need USDC↔GNUS pricing (an oracle by another name, contradicting D-04) plus USDC custody/treasury logic (contradicting D-10's no-custody stance).
- Banxa confirmation on-chain (signed-message mint) adds a trust/signature surface for zero benefit while the operator path exists.
- Operator path needs no contract code at all: GV buys GNUS, uses CREATOR_ROLE mint (Phase 13 treasury-direct launch pattern).
- ROADMAP §Phase 14 goal/SC4 ("payment router for USDC/GNUS/Banxa rails") should be amended to "GNUS-burn purchase rail + operator fiat path". Confidence HIGH — follows directly from locked D-04/D-09/D-10.

## D-11 Recommendation (purchase authorization)

| Dimension | Permissionless credit purchase | Operator-gated only |
|---|---|---|
| Griefing/Sybil | Bounded: credits SOULBOUND, time-boxed, burn-only; attacker only burns own GNUS | None |
| SKU/maxSupply exhaustion | Bounded by per-token `maxSupply` + `perWalletMintCap` (existing gates) | None |
| Refund/dispute | None on-chain (payment burned); off-chain policy; acceptable at $5 price point | Fiat disputes handled off-chain by GV |
| Gas/ops | Minimal — self-serve, no GV action per purchase | Every purchase is an ops ticket |
| License creation | **Keep gated** (D-12): CREATOR_ROLE creates License NFTs; permissionless SKUs are credit top-up + license renewal only | — |

**Recommend: permissionless for credit top-up SKUs and license-renewal SKUs (paying to extend someone's license has no harm vector); operator-gated for license creation (D-12, unchanged).** Matches the user's stated lean. Renewal permissionlessly re-emits `LicenseActivated` — ensure the event includes enough to identify who renewed if SG needs it (optional indexed `renewedBy`; planner's discretion within D-14's signature — if the signature is locked verbatim, skip).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Block-pinned `eth_call` is accepted by SG validators as the determinism mechanism | questions.md #1 | SG-side only; no EVM rework |
| A2 | Diamond can burn its own pulled ERC-20/ERC-1155 id-0 GNUS through the existing burn path without new MINTER_ROLE grants | Pattern 2 | May need a small internal burn helper in the purchase facet |
| A3 | `LicenseActivated` signature field order is final (companyAdmin, licenseId, privateNetworkId, expiresAt) | LIC-05 | Event is the cross-system contract — changing later breaks SG consumers |
| A4 | Phase 13 D7 SOULBOUND-bridge amendment is acceptable to the owner (Pitfall 1) | Pitfall 1 | Falls back to per-tenant ALLOWLISTED registries (more deployment overhead) |

## Open Questions

1. **Phase 13 D7 amendment (Pitfall 1)** — the single genuinely new decision. Recommend resolving at plan-checkpoint before implementation; recommended answer given above.
2. **Where does `companyAdmin` live?** Event payload only (zero storage) vs a `licenseId → companyAdmin` storage field for operator reference. D-13/D-20 permit either; recommend event-only + off-chain index, cheapest.
3. **Renewal SKU pricing across license tiers** — D-04 fields support it; whether renewal price differs per license is product data, not contract design.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | toolchain | ✓ | 24.13.0 | — |
| Hardhat | tests | ✓ | 2.26.5 | — |
| Yarn | scripts | ✓ | 4.10.3 | — |
| Foundry (forge) | invariants | ✓ | 1.7.1 | — |
| `npx hardhat node` | `yarn forge:test` | must be started before forge suite | — | Hardhat-only coverage (not preferred) |

No missing dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Hardhat 2.26.5 (unit) + Foundry 1.7.1 (invariants) |
| Config file | hardhat.config.ts, foundry.toml |
| Quick run command | `npx hardhat test test/unit/GNUSLicensing.test.ts` |
| Full suite command | `npx hardhat test` then (with `npx hardhat node` running) `yarn forge:test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIC-01 | hierarchy create root→license→credits; grandchild auth | unit | `npx hardhat test test/unit/GNUSLicensing.test.ts` | ❌ Wave 0 |
| LIC-02 | struct append zero-default decode | unit (upgrade probe) | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` | ✅ extend |
| LIC-03 | SKU registry CRUD + active gating + role auth | unit | `npx hardhat test test/unit/GNUSLicensing.test.ts` | ❌ Wave 0 |
| LIC-04 | purchase burns GNUS (totalSupply delta), mints to device wallet, reverts on inactive SKU/insufficient allowance | unit | same | ❌ Wave 0 |
| LIC-05 | LicenseActivated on create + renewal; expiry value correct | unit | same | ❌ Wave 0 |
| LIC-06 | Hybrid config accepted; burn-only rejected for redeem | unit | `npx hardhat test test/unit/GNUSLifecycle.test.ts` (extend) | ✅ extend |
| LIC-07 | no-op (resolved) — regression only: bridgeIn + ops burn path unchanged | unit (existing) | `npx hardhat test test/unit/GNUSBridgeIn.test.ts` | ✅ |
| D-23 | expired holder bridgeOut reverts; unexpired passes; SOULBOUND amendment behavior | unit | `npx hardhat test test/unit/GNUSBridgePolicy.test.ts` | ✅ extend |

### Sampling Rate
- Per task commit: targeted file per the table
- Per wave merge: `npx hardhat test` (expect 571+new passing, 2 pending, 1 known-stale chainID)
- Phase gate: full Hardhat + Foundry (215+ passing, 2 known-stale Phase 08.1 setUp reverts, 3 skipped)

### Wave 0 Gaps
- [ ] `test/unit/GNUSLicensing.test.ts` — LIC-01/03/04/05
- [ ] Extend `GNUSLifecycleUpgrade.test.ts` slot probe for D-03 fields — LIC-02
- [ ] Extend `GNUSBridgePolicy.test.ts` — D-23 + SOULBOUND-bridge amendment
- [ ] `diamond-abi` regeneration + config registration for the two new facets (follow existing pipeline)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 9 reserve ledger / `mintBackedChild` | Conversion-native `convert()` (superseded) | Phase 9 revision 2 | D-05's "mintBackedChild" is dead terminology — plan against `convert()` |
| LIC-04 "USDC/GNUS/Banxa contract rails" | GNUS-burn rail + off-chain fiat (D-09/D-10) | Phase 14 discuss | Amend LIC-04/ROADMAP wording at planning |
| ROADMAP SC7 "bridged burn vs mirror+settlement" | D-07: GV wallet → bridgeIn → ops burn | Phase 14 discuss (2026-08-25) | SC7 resolved; zero contract work |

## Sources

### Primary (HIGH confidence)
- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — NFT struct layout, slot annotations (lines 10-46)
- `contracts/gnus-ai/GNUSLifecycle.sol` — createNFTWithLifecycle auth/validation (335-365), expiry views (103-154), REDEEM_TO_PARENT gate (205-207)
- `contracts/gnus-ai/GNUSLifecyclePolicy.sol` — transfer predicate carve-outs incl. always-permitted burn branch (160-215)
- `contracts/gnus-ai/GNUSBridge.sol` — bridgeOut ordering (232-277), `_enforceBridgePolicy` (304-332), MINTER_ROLE `burn` (178)
- `contracts/gnus-ai/GNUSLifecycleMint.sol` — PerHolder renewal (219-246), mint expiry gate "Sale ended" (155)
- `.planning/phases/09-per-child-gnus-treasury-reserve/09-CONTEXT.md` — conversion-native amendment superseding mintBackedChild
- `.planning/intel/decisions.md` — PD-1..PD-7 full text
- `diamonds/GeniusDiamond/geniusdiamond.config.json` — per-facet versions["2.6"] pattern

### Secondary (MEDIUM)
- `.planning/private-network-ai.md` — original flows (partially superseded, flagged where)
- `.planning/seeds/sg-extensible-utxo-metadata.md` — SG-side timed-UTXO destination

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is in-repo, verified against source this session
- Architecture: HIGH for EVM surface; MEDIUM for SG transport spec (A1)
- Pitfalls: HIGH — Pitfall 1 verified directly in GNUSBridge.sol source

**Research date:** 2026-08-25
**Valid until:** 2026-09-24 (contract surface stable; SG-side spec items are open-ended)
