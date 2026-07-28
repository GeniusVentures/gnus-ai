# Phase 13: Time-Bound ERC-1155 Entitlements - Context

**Gathered:** 2026-07-27
**Status:** Discussion - user approval required before planning or implementation

<domain>
## Phase Boundary

Add a general-purpose time-bound lifecycle to the existing GNUS ERC-1155 child-token model so a token class can declare:

- when it becomes usable;
- when it expires;
- what transfers are permitted during its lifecycle; and
- what happens to any remaining balance after expiration.

The primary initial use case is a non-rollover annual AI allocation: a user purchases a $5 annual GNUS AI allocation, receives ERC-1155 child-token credits, spends them on Writer, Reader, Spam/Safety, and other GCS/ELM services, and loses any unused allocation after expiration. Those utility credits must burn when spent or expired and must not redeem into, credit, or replenish the parent GNUS token or a parent-token treasury.

The same primitive must remain reusable for album releases, ticket sales, event access, seasonal passes, timed software access, limited drops, refundable or returnable entitlements, and other tokenized rights.

This phase is limited to lifecycle metadata, lifecycle validation, expiration disposition, burn-only utility-token behavior, view functions, events, and tests. It does not implement the email product, GCS billing, pricing, payment collection, off-chain access control, or the Phase 9 treasury/reserve system.
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

It has no start time, expiration time, transfer policy, expiration disposition, or burn-only utility classification.

`GNUSNFTFactory.createNFT()` and `createNFTs()` construct this struct directly. `GNUSERC1155MaxSupply._beforeTokenTransfer()` is the common ERC-1155 mint/transfer/burn hook, but `ERC20TransferBatch` contains separate GNUS-only batch paths that bypass the standard hook and enforce selected controls independently.

A time-bound feature therefore cannot be implemented safely by appending timestamps alone. The phase must define where time validity is checked, which operations are restricted, how expired balances are settled, and which token classes burn rather than redeem to the parent or treasury.
</problem_statement>

<proposed_direction>
## Proposed Direction - Not Yet Approved

### ERC-1155 Token-Class Lifecycle Metadata

Append lifecycle fields to the existing `NFT` struct rather than introducing a parallel token registry. The minimum proposed time fields are:

```solidity
uint64 startsAt;   // 0 = immediately active
uint64 expiresAt;  // 0 = no expiration
```

These fields are token-ID-level metadata. Every balance of the same ERC-1155 token ID shares the same lifecycle window.

Separate policy metadata is also required. Time validity, transferability, active-use settlement, and expiration settlement are different dimensions and must not be collapsed into one boolean.

The exact storage representation remains open for approval. Candidate representations include:

- compact enums appended to `NFT`;
- bit flags appended to `NFT`;
- a dedicated namespaced policy mapping keyed by token ID.

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
- An expired collectible may remain transferable even though it no longer grants access.

The lifecycle primitive should therefore expose deterministic status checks and enforce active-window rules on consumption, redemption, access, or settlement paths. Transfer restrictions, when desired, must be expressed by an explicit token policy rather than inferred solely from `startsAt` and `expiresAt`.

### Expiration Disposition

A token class needs an explicit rule for what happens to a holder's remaining balance after `expiresAt`. Proposed baseline dispositions are:

```solidity
enum ExpirationDisposition {
    NONE,                // Token does not expire or has no automatic settlement rule
    KEEP_INERT,          // Balance remains but no longer grants the timed entitlement
    BURN,                // Destroy the expired balance with no value returned
    RETURN_TO_ISSUER,    // Move expired units to the configured issuer/creator
    RETURN_TO_TREASURY,  // Move expired units to a configured treasury address
    REDEEM_TO_PARENT     // Settle through an approved parent/reserve conversion path
}
```

The final enum names and supported modes are not approved. A generic `RETURN_TO_ADDRESS` plus an explicit `expirationRecipient` may be cleaner than separate issuer and treasury enum values.

#### Why "Return to Sender" Is Not Sufficient

ERC-1155 balances are fungible within a token ID. Units can be transferred repeatedly and merged into one account balance. The contract cannot reliably determine the original sender for each remaining unit without introducing per-mint-lot or per-transfer provenance storage.

Therefore a token-ID-level return policy must use an explicit deterministic recipient, such as:

- token creator;
- token issuer;
- parent-token treasury;
- event organizer;
- rental owner; or
- another address fixed in the token policy.

If a future product requires each unit to return to its actual original sender, that is a different per-lot provenance design and is out of scope for this token-ID-level phase.

### Expiration Cannot Execute Automatically

Smart contracts do not wake up when a timestamp is reached. At expiration, balances become expired immediately by view and validation logic, but burn, return, redemption, or conversion requires a transaction.

The phase should support deterministic lazy settlement and an explicit bounded settlement function:

- lazy settlement when an expired token is next presented to a consume, transfer, redeem, or cleanup path, where safe and unambiguous;
- explicit `settleExpired(account, id, amount)` or equivalent function that applies the configured expiration disposition;
- optional batch settlement over caller-supplied bounded arrays.

No keeper dependency is required for correctness. Expired balances must stop granting the entitlement based solely on timestamps. Settlement affects balances, supply, and accounting hygiene but not whether the entitlement is valid.

A permissionless settlement call may be safe for `BURN`, `RETURN_TO_ISSUER`, or `RETURN_TO_TREASURY` only if the disposition and recipient were fixed before holders acquired the token. Settlement must not allow the caller to redirect value.

### Burn-Only Utility Behavior

For AI allocation tokens and other use-it-or-lose-it utility children:

- successful consumption burns the amount used;
- expiration makes the remaining balance unusable;
- expiration disposition is `BURN`;
- expiration settlement burns the remaining amount when invoked;
- no GNUS or parent-child token value is minted, released, credited, deposited, refunded, or returned;
- the child token must not enter a future parent reserve redemption path;
- no rollover occurs after the allocation period.

This burn-only policy is intentionally different from normal child tokens that may participate in Phase 9 reserve-backed redemption.

### Other Disposition Examples

- **Album release/access token:** `KEEP_INERT` after the access window so it remains a collectible.
- **Event ticket:** `BURN` when admitted; after the event it may use `KEEP_INERT` for a collectible ticket stub or `BURN` for pure admission credentials.
- **Rental or checked-out asset:** `RETURN_TO_ISSUER` after the rental period.
- **Promotional inventory:** `RETURN_TO_TREASURY` when the campaign ends.
- **Reserve-backed voucher:** `REDEEM_TO_PARENT` if the approved economics guarantee backing and define post-expiry redemption.
</proposed_direction>

<use_cases>
## Representative Uses

| Use case | startsAt | expiresAt | Active use | Expiration disposition | Transfer policy example |
| --- | --- | --- | --- | --- | --- |
| Annual AI allocation | purchase/start date | one-year end date | Burn credits per AI job | `BURN` | Non-transferable |
| Album access/release | release timestamp | optional access end | Gate content access | `KEEP_INERT` | Presale and collectible transfer allowed |
| Event ticket | admission start | admission cutoff/event end | Burn or mark consumed on admission | `BURN` or `KEEP_INERT` | Transferable until cutoff |
| Seasonal pass | season start | season end | Validate on each use or burn usage units | `BURN` or `KEEP_INERT` | Product-specific |
| Limited software access | activation date | license end | Gate capability invocation | `BURN` or `KEEP_INERT` | Usually non-transferable |
| Rental entitlement | rental start | return deadline | Gate possession/use | `RETURN_TO_ISSUER` | Usually non-transferable |
| Promotional allocation | campaign start | campaign end | Spend promotional units | `RETURN_TO_TREASURY` or `BURN` | Product-specific |
| Reserve-backed voucher | issue/start date | redemption deadline | Redeem under reserve rules | `REDEEM_TO_PARENT` if approved | Product-specific |
</use_cases>

<integration_points>
## Expected Integration Points

### Contract Submodule (`contracts/gnus-ai` -> `GeniusVentures/gnus-ai-contracts`)

Likely affected files after approval and planning:

- `GNUSNFTFactoryStorage.sol` - append lifecycle metadata and the approved policy/disposition representation.
- `GNUSNFTFactory.sol` - creation APIs, validation, lifecycle getters, policy getters, lifecycle events, and backward-compatible creation behavior.
- `GNUSERC1155MaxSupply.sol` - only if the approved transfer policy or lazy-settlement policy requires common-hook enforcement.
- `ERC20TransferBatch.sol` - review required because its GNUS-only custom batch paths bypass the common ERC-1155 hook.
- a dedicated entitlement/settlement facet, if approved, for consume and `settleExpired` operations.
- future Phase 9 reserve/redemption facets - explicitly exclude burn-only utility token IDs and honor only the approved `REDEEM_TO_PARENT` disposition.
- ABI and diamond deployment configuration - regenerate and upgrade affected facets.

### Parent Repository (`GeniusVentures/gnus-ai`)

- Hardhat unit tests for time boundaries, creation, spending, transfer policy, and every approved expiration disposition.
- Foundry fuzz/invariant tests for timestamp boundaries, fixed-recipient settlement, and no-parent-credit guarantees.
- Submodule pointer update after the contract PR is merged.
- Deployment and Safe diamond-upgrade artifacts for testnet before mainnet consideration.
</integration_points>

<api_surface>
## Candidate API Surface - Names Not Approved

View helpers should make time status and expiration settlement unambiguous for applications and GCS nodes:

```solidity
function isTokenActive(uint256 id) external view returns (bool);
function isTokenStarted(uint256 id) external view returns (bool);
function isTokenExpired(uint256 id) external view returns (bool);
function getTokenLifecycle(uint256 id)
    external
    view
    returns (
        uint64 startsAt,
        uint64 expiresAt,
        uint8 transferPolicy,
        uint8 expirationDisposition,
        address expirationRecipient
    );
```

Creation APIs may either:

- add lifecycle-aware overloads while retaining current `createNFT`/`createNFTs` behavior as timeless defaults; or
- add dedicated `createTimeBoundNFT`/batch functions.

Existing selectors and callers must remain compatible unless an explicit diamond-upgrade migration plan approves a breaking change.

Candidate settlement interfaces include:

```solidity
function settleExpired(address account, uint256 id, uint256 amount) external;
function settleExpiredBatch(
    address[] calldata accounts,
    uint256[] calldata ids,
    uint256[] calldata amounts
) external;
```

The exact interface is open. It must:

- require the token to be expired;
- apply only the disposition configured for that token ID;
- prevent the caller from selecting or changing the recipient;
- avoid unbounded holder or token enumeration;
- emit an event describing the holder, token ID, amount, disposition, and destination; and
- clearly separate burn-only utility consumption from reserve redemption.
</api_surface>

<security_and_upgrade>
## Security and Upgrade Requirements

1. **Storage-layout verification is mandatory.** Lifecycle and policy fields must be appended safely to the deployed `NFT` struct or placed in a new namespaced storage mapping. No existing field may be reordered or have its type changed.
2. **Existing token behavior must remain unchanged.** Zero-valued lifecycle and policy fields must map to an explicitly defined legacy behavior that leaves existing tokens active and non-expiring.
3. **No automatic parent credit.** Burn-only utility tokens must never trigger normal child-to-parent conversion, reserve withdrawal, treasury credit, GNUS minting, or refunds.
4. **Disposition is fixed and deterministic.** Settlement callers may trigger the approved action but may not choose the action or recipient.
5. **No inferred sender.** Return settlement uses a configured address. It must not attempt to infer an original sender from transfer history.
6. **Forced-return disclosure.** A return or redemption disposition must be fixed or tightly restricted before first mint and exposed through view functions and events so holders know the post-expiry rule.
7. **Boundary tests are mandatory.** Test immediately before `startsAt`, exactly at `startsAt`, immediately before `expiresAt`, exactly at `expiresAt`, and after expiration.
8. **Timestamp authority is block time.** Applications may display calendar dates, but contract enforcement uses `block.timestamp` with normal validator timestamp tolerance.
9. **No hidden metadata enforcement.** Off-chain JSON metadata may mirror the dates and disposition, but contract decisions must use on-chain fields.
10. **Batch-path parity is mandatory.** Any lifecycle, transfer, or settlement restriction that applies to standard ERC-1155 paths must also be tested against custom batch paths that can bypass the standard hook.
11. **No unbounded cleanup loops.** Expired-token settlement must operate on caller-supplied bounded items; the contract must not enumerate all owners or all token IDs.
12. **Authorization must be explicit.** Only approved creator/admin paths may configure lifecycle metadata, disposition, or recipient. Whether policies may change after minting remains an open decision.
13. **No arbitrary confiscation.** A creator or administrator must not be able to change an existing holder's expiration disposition from inert/burn to forced return after issuance.
14. **Reserve solvency applies to redemption.** `REDEEM_TO_PARENT` can only be enabled where the reserve and exchange-rate invariants are defined and tested.
15. **Diamond upgrade and rollback plan required.** Testnet upgrade, selector verification, storage inspection, and full regression suite are required before mainnet deployment.
</security_and_upgrade>

<testing>
## Required Test Categories

- timeless existing NFT remains active forever with legacy disposition behavior;
- future-start token exists but is not yet consumable;
- token becomes consumable exactly at `startsAt`;
- token becomes invalid exactly at `expiresAt`;
- invalid timestamp combinations revert;
- burn-only AI credit spending decreases balance and supply;
- expired `BURN` settlement decreases holder balance and total supply;
- `KEEP_INERT` leaves balance and supply unchanged but denies the expired entitlement;
- `RETURN_TO_ISSUER` moves only the requested expired amount to the fixed issuer;
- `RETURN_TO_TREASURY` moves only the requested expired amount to the fixed treasury;
- settlement caller cannot redirect returned balances;
- settlement before expiration reverts;
- repeated settlement cannot exceed the holder's remaining balance;
- burn-only spending/expiry produces zero parent, GNUS, treasury, reserve, or refund credit;
- `REDEEM_TO_PARENT` is unavailable without approved reserve configuration and solvency;
- normal child-token economics remain unchanged;
- presale/release token transfer behavior follows its explicit transfer policy rather than implicit time validity;
- unauthorized lifecycle, disposition, or recipient modification reverts;
- post-mint malicious disposition changes are impossible under the approved mutability rule;
- batch and single-item operations enforce equivalent approved rules;
- fuzz tests cover timestamp ordering, boundary arithmetic, settlement amounts, and idempotency;
- upgrade test proves pre-existing `NFT` records decode correctly with zero lifecycle and policy fields.
</testing>

<open_decisions>
## Decisions Requiring User Approval

No item below is locked by this document.

1. **Field names:** `startsAt` / `expiresAt` versus `validFrom` / `validUntil`.
2. **Policy representation:** enums, flags, or separate token-policy mapping.
3. **Supported expiration dispositions:** which of `KEEP_INERT`, `BURN`, fixed-address return, and `REDEEM_TO_PARENT` are required in v1.
4. **Generic return model:** separate `RETURN_TO_ISSUER` and `RETURN_TO_TREASURY` modes versus one `RETURN_TO_ADDRESS` mode with `expirationRecipient`.
5. **Date and policy mutability:** immutable after token creation, mutable only before first mint, or admin/creator adjustable under tightly restricted rules and events.
6. **AI allocation ID strategy:** unique token ID per user purchase, shared annual/calendar cohort IDs, or another issuance model. Token-ID-level timestamps cannot represent different expiration dates for different holders of the same ID.
7. **Transfer rules:** whether burn-only AI allocations are strictly soulbound and which other lifecycle policies are needed initially.
8. **Settlement authorization:** token holder only, approved operator, or permissionless application of a fixed disposition.
9. **Partial settlement:** whether callers may settle any expired amount up to the balance or must settle the entire expired balance.
10. **Consumption interface:** generic burn/consume function in the NFT facet versus a dedicated entitlement facet.
11. **Collectible behavior:** whether expired tickets and album-access tokens default to `KEEP_INERT` or require an explicit disposition every time.
12. **Metadata update:** whether ERC-1155 JSON metadata must include mirrored ISO-8601 start/end dates, transfer policy, disposition, and recipient.
13. **Dependency on Phase 9:** whether Phase 13 ships before reserve accounting with `REDEEM_TO_PARENT` disabled, or after Phase 9 so redeemable settlement is implemented together.
14. **Annual period definition:** exact 365-day duration, calendar-year expiration, or application-supplied approved timestamps.
15. **Per-lot provenance:** confirm that true return-to-original-sender behavior is out of scope unless a future per-mint-lot model is added.
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
- Do not begin implementation until Kenneth Hurley explicitly approves the lifecycle semantics, issuance model, transfer policy, and expiration dispositions in this document.

After approval, the next step is a code-grounded research pass across both `GeniusVentures/gnus-ai` and `GeniusVentures/gnus-ai-contracts`, followed by a separate reviewable Phase 13 plan.
</approval_gate>

---

*Phase: 13-Time-Bound ERC-1155 Entitlements*
*Context gathered: 2026-07-27*
*Approval: pending*
