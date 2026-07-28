# Phase 13: Time-Bound ERC-1155 Entitlements - Context

**Gathered:** 2026-07-27
**Status:** Discussion - user approval required before planning or implementation

<domain>
## Phase Boundary

Add a general-purpose time-bound lifecycle to the existing GNUS ERC-1155 child-token model so a token class can declare when it becomes usable and when it expires.

The primary initial use case is a non-rollover annual AI allocation: a user purchases a $5 annual GNUS AI allocation, receives ERC-1155 child-token credits, spends them on Writer, Reader, Spam/Safety, and other GCS/ELM services, and loses any unused allocation after expiration. Those utility credits must burn when spent or expired and must not redeem into, credit, or replenish the parent GNUS token or a parent-token treasury.

The same primitive must remain reusable for album releases, ticket sales, event access, seasonal passes, timed software access, limited drops, and other tokenized entitlements.

This phase is limited to lifecycle metadata, lifecycle validation, burn-only utility-token behavior, view functions, events, and tests. It does not implement the email product, GCS billing, pricing, payment collection, off-chain access control, or the Phase 9 treasury/reserve system.
</domain>

<problem_statement>
## Existing Code Facts

The current `NFT` struct in `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` contains:

- name
- symbol
- URI
- exchange rate
- max supply
- creator
- child index
- creation status

It has no start time, expiration time, lifecycle policy, or burn-only utility classification.

`GNUSNFTFactory.createNFT()` and `createNFTs()` construct this struct directly. `GNUSERC1155MaxSupply._beforeTokenTransfer()` is the common ERC-1155 mint/transfer/burn hook, but `ERC20TransferBatch` contains separate GNUS-only batch paths that bypass the standard hook and enforce selected controls independently.

A time-bound feature therefore cannot be implemented safely by appending timestamps alone. The phase must define where time validity is checked, which operations are restricted, how expired balances are handled, and which token classes burn rather than redeem to the parent or treasury.
</problem_statement>

<proposed_direction>
## Proposed Direction - Not Yet Approved

### ERC-1155 Token-Class Lifecycle Metadata

Append lifecycle fields to the existing `NFT` struct rather than introducing a parallel token registry. The minimum proposed fields are:

```solidity
uint64 startsAt;   // 0 = immediately active
uint64 expiresAt;  // 0 = no expiration
```

These fields are token-ID-level metadata. Every balance of the same ERC-1155 token ID shares the same lifecycle window.

A separate lifecycle or settlement policy is also required for burn-only utility children. The exact representation remains open for approval. Candidate representations include:

- a compact enum appended to `NFT`;
- bit flags appended to `NFT`;
- a dedicated policy mapping keyed by token ID.

The policy must distinguish at least:

1. normal child-token economics, including any future Phase 9 reserve/redemption behavior;
2. burn-only utility entitlement, where spending or expiration destroys the child token and never credits the parent token or treasury.

### Time Semantics

Proposed canonical rules:

- `startsAt == 0` means the entitlement is active immediately.
- `expiresAt == 0` means the entitlement does not expire.
- When both values are nonzero, `expiresAt` must be greater than `startsAt`.
- The active window is `block.timestamp >= startsAt && (expiresAt == 0 || block.timestamp < expiresAt)`.
- Expiration is exclusive at `expiresAt`.
- Existing deployed token IDs receive zero-initialized fields and remain immediately active with no expiration.

### Validity Is Separate From Transferability

Do not automatically block every transfer before `startsAt` or after `expiresAt`.

Time validity and transfer policy are separate concerns:

- An album or event token may be sold or transferred before its release/event start.
- A ticket may need transferability during a resale window but only be consumable during the event window.
- AI allocation credits may need to be non-transferable and consumable only during their annual allocation window.

The lifecycle primitive should therefore expose deterministic status checks and enforce active-window rules on consumption/redemption/access paths. Transfer restrictions, when desired, must be expressed by an explicit token policy rather than inferred solely from `startsAt` and `expiresAt`.

### Expiration Cannot Execute Automatically

Smart contracts do not wake up when a timestamp is reached. At expiration, balances become invalid or inert immediately by view/validation logic, but burning requires a transaction.

The phase should support one or both of these patterns:

- lazy burn when an expired token is next presented to a consume, spend, redeem, or cleanup path;
- explicit permissionless `burnExpired(account, id, amount)` or equivalent cleanup function, constrained so it can only destroy expired burn-only entitlements and cannot redirect value.

No keeper dependency is required for correctness. Cleanup only affects storage/accounting hygiene; validity must be determined directly from timestamps.

### Burn-Only Utility Behavior

For AI allocation tokens and other use-it-or-lose-it utility children:

- successful consumption burns the amount used;
- expiration makes the remaining balance unusable;
- expiration cleanup burns the remaining amount when invoked;
- no GNUS or parent-child token value is minted, released, credited, deposited, or returned;
- the child token must not enter a future parent reserve redemption path;
- no rollover occurs after the allocation period.

This burn-only policy is intentionally different from normal child tokens that may participate in Phase 9 reserve-backed redemption.
</proposed_direction>

<use_cases>
## Representative Uses

| Use case | startsAt | expiresAt | Consumption | Transfer policy example |
| --- | --- | --- | --- | --- |
| Annual AI allocation | purchase/start date | one-year end date | Burn credits per AI job; unused credits become invalid | Non-transferable |
| Album release | release timestamp | optional license end | Gate content access; token may remain collectible | Presale transfer allowed |
| Event ticket | event/admission start | admission cutoff/event end | Burn or mark consumed on admission | Transferable until cutoff |
| Seasonal pass | season start | season end | Validate on each use or burn usage units | Product-specific |
| Limited software access | activation date | license end | Gate capability invocation | Usually non-transferable |
</use_cases>

<integration_points>
## Expected Integration Points

### Contract Submodule (`contracts/gnus-ai` -> `GeniusVentures/gnus-ai-contracts`)

Likely affected files after approval and planning:

- `GNUSNFTFactoryStorage.sol` - append lifecycle metadata and approved policy representation.
- `GNUSNFTFactory.sol` - creation APIs, validation, lifecycle getters, lifecycle events, and backward-compatible creation behavior.
- `GNUSERC1155MaxSupply.sol` - only if the approved transfer policy requires common-hook enforcement.
- `ERC20TransferBatch.sol` - review required because its GNUS-only custom batch paths bypass the common ERC-1155 hook.
- future Phase 9 reserve/redemption facets - explicitly exclude burn-only utility token IDs from parent-credit or treasury redemption.
- ABI and diamond deployment configuration - regenerate and upgrade affected facets.

### Parent Repository (`GeniusVentures/gnus-ai`)

- Hardhat unit tests for time boundaries, creation, spending, transfer policy, and burn-only behavior.
- Foundry fuzz/invariant tests for timestamp boundaries and no-parent-credit guarantees.
- Submodule pointer update after the contract PR is merged.
- Deployment and Safe diamond-upgrade artifacts for testnet before mainnet consideration.
</integration_points>

<api_surface>
## Candidate API Surface - Names Not Approved

View helpers should make time status unambiguous for applications and GCS nodes:

```solidity
function isTokenActive(uint256 id) external view returns (bool);
function isTokenStarted(uint256 id) external view returns (bool);
function isTokenExpired(uint256 id) external view returns (bool);
function getTokenLifecycle(uint256 id)
    external
    view
    returns (uint64 startsAt, uint64 expiresAt, uint8 policy);
```

Creation APIs may either:

- add lifecycle-aware overloads while retaining current `createNFT`/`createNFTs` behavior as timeless defaults; or
- add dedicated `createTimeBoundNFT`/batch functions.

Existing selectors and callers must remain compatible unless an explicit diamond-upgrade migration plan approves a breaking change.

A burn/consume function for burn-only entitlements must clearly separate utility consumption from reserve redemption. It must validate active status for ordinary consumption and permit post-expiry destruction only through the approved cleanup path.
</api_surface>

<security_and_upgrade>
## Security and Upgrade Requirements

1. **Storage-layout verification is mandatory.** Lifecycle fields must be appended safely to the deployed `NFT` struct or placed in a new namespaced storage mapping. No existing field may be reordered or have its type changed.
2. **Existing token behavior must remain unchanged.** Zero-valued lifecycle fields mean active and non-expiring.
3. **No automatic parent credit.** Burn-only utility tokens must never trigger normal child-to-parent conversion, reserve withdrawal, treasury credit, or GNUS minting.
4. **Boundary tests are mandatory.** Test immediately before `startsAt`, exactly at `startsAt`, immediately before `expiresAt`, exactly at `expiresAt`, and after expiration.
5. **Timestamp authority is block time.** Applications may display calendar dates, but contract enforcement uses `block.timestamp` with normal validator timestamp tolerance.
6. **No hidden metadata enforcement.** Off-chain JSON metadata may mirror the dates, but contract decisions must use on-chain fields.
7. **Batch-path parity is mandatory.** Any lifecycle or transfer restriction that applies to standard ERC-1155 paths must also be tested against custom batch paths that can bypass the standard hook.
8. **No unbounded cleanup loops.** Expired-token cleanup must operate on caller-supplied bounded items; the contract must not enumerate all owners or all token IDs.
9. **Authorization must be explicit.** Only approved creator/admin paths may configure lifecycle metadata. Whether dates may be changed after minting remains an open decision.
10. **Diamond upgrade and rollback plan required.** Testnet upgrade, selector verification, storage inspection, and full regression suite are required before mainnet deployment.
</security_and_upgrade>

<testing>
## Required Test Categories

- timeless existing NFT remains active forever;
- future-start token exists but is not yet consumable;
- token becomes consumable exactly at `startsAt`;
- token becomes invalid exactly at `expiresAt`;
- invalid timestamp combinations revert;
- burn-only AI credit spending decreases balance and supply;
- expired burn-only cleanup decreases balance and supply;
- burn-only spending/expiry produces zero parent, GNUS, treasury, or reserve credit;
- normal child-token economics remain unchanged;
- presale/release token transfer behavior follows its explicit transfer policy rather than implicit time validity;
- unauthorized lifecycle modification reverts;
- batch and single-item operations enforce equivalent approved rules;
- fuzz tests cover timestamp ordering and boundary arithmetic;
- upgrade test proves pre-existing `NFT` records decode correctly with zero lifecycle fields.
</testing>

<open_decisions>
## Decisions Requiring User Approval

No item below is locked by this document.

1. **Field names:** `startsAt` / `expiresAt` versus `validFrom` / `validUntil`.
2. **Policy representation:** enum, flags, or separate token-policy mapping.
3. **Date mutability:** immutable after token creation, mutable only before first mint, or admin/creator adjustable with restrictions and events.
4. **AI allocation ID strategy:** unique token ID per user purchase, shared annual/calendar cohort IDs, or another issuance model. Token-ID-level timestamps cannot represent different expiration dates for different holders of the same ID.
5. **Transfer rules:** whether burn-only AI allocations are strictly soulbound and which other lifecycle policies are needed initially.
6. **Cleanup authorization:** token holder only, approved operator, or permissionless burn of expired burn-only balances.
7. **Consumption interface:** generic burn/consume function in the NFT facet versus a dedicated entitlement facet.
8. **Metadata update:** whether ERC-1155 JSON metadata must include mirrored ISO-8601 start/end dates and lifecycle policy.
9. **Dependency on Phase 9:** whether Phase 13 ships before reserve accounting with explicit future exclusions, or after Phase 9 so burn-only and redeemable settlement modes are implemented together.
10. **Annual period definition:** exact 365-day duration, calendar-year expiration, or application-supplied approved timestamps.
</open_decisions>

<canonical_refs>
## Canonical References

Downstream research, planning, or implementation agents must read all of the following before proposing changes:

- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` - deployed `NFT` struct and namespaced storage.
- `contracts/gnus-ai/GNUSNFTFactory.sol` - token creation, minting, child-ID generation, and NFT getters.
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` - common ERC-1155 transfer hook.
- `contracts/gnus-ai/ERC20TransferBatch.sol` - custom batch paths that bypass the standard ERC-1155 hook.
- `.planning/ROADMAP.md` - Phases 9-12 treasury, bridge, proxy, and supply-ledger dependencies.
- `.planning/Update-Smart-Contracts-Architecture.md` - current token-economics architecture.
- External product/design discussion supplied by the user: `https://grok.com/share/bGVnYWN5_1fcc8abf-f66b-4dc5-9718-14ec27870006`.
</canonical_refs>

<approval_gate>
## Approval Gate

This context document is intentionally marked **Discussion**.

- Do not mark decisions as locked.
- Do not generate an autonomous execution plan.
- Do not modify Solidity, tests, ABI, deployment configuration, or submodule pointers.
- Do not begin implementation until Kenneth Hurley explicitly approves the lifecycle semantics and issuance model in this document.

After approval, the next step is a code-grounded research pass across both `GeniusVentures/gnus-ai` and `GeniusVentures/gnus-ai-contracts`, followed by a separate reviewable Phase 13 plan.
</approval_gate>

---

*Phase: 13-Time-Bound ERC-1155 Entitlements*
*Context gathered: 2026-07-27*
*Approval: pending*
