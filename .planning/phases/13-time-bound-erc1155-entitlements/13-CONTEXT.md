# Phase 13: Time-Bound ERC-1155 Entitlements - Context

**Gathered:** 2026-07-27
**Status:** Discussion - user approval required before planning or implementation

<domain>
## Phase Boundary

Add a general-purpose lifecycle and transfer-policy model to the existing GNUS ERC-1155 child-token system so a token class can declare:

- when it becomes usable;
- when it expires;
- whether and how it may be transferred;
- how primary issuance is limited; and
- what happens to the remaining balance after expiration.

The primary initial use case is a non-rollover annual AI allocation: a user purchases a $5 annual GNUS AI allocation, receives ERC-1155 child-token credits, spends them on GCS/ELM services, and loses any unused allocation after expiration. AI allocation credits must be non-transferable, burn when spent or expired, and never redeem into or replenish GNUS, a parent token, a reserve, or a treasury.

The same primitive must remain reusable for album releases, tickets, event access, seasonal passes, software access, rentals, promotional allocations, and other tokenized rights.

This phase is limited to lifecycle metadata, transfer policy, issuance controls required by anti-scalping policies, expiration disposition, view functions, events, and tests. It does not implement a marketplace UI, fiat payment processing, the email product, GCS billing, or the Phase 9 reserve system.
</domain>

<existing_code>
## Existing Code Facts

The current `NFT` struct in `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` has no start time, expiration time, transfer policy, issuance policy, expiration disposition, or burn-only utility classification.

`GNUSNFTFactory.createNFT()` and `createNFTs()` construct the struct directly. `GNUSERC1155MaxSupply._beforeTokenTransfer()` is the common ERC-1155 mint/transfer/burn hook, while `ERC20TransferBatch` contains separate GNUS-only balance paths that bypass that standard hook.

The feature therefore cannot safely be implemented by adding timestamps alone. The design must define lifecycle validity, transfer enforcement, controlled resale, issuance limits, expired-balance settlement, and compatibility with future reserve-backed child tokens.
</existing_code>

<proposed_model>
## Proposed Model - Not Yet Approved

### Time Fields

Proposed token-ID-level fields:

```solidity
uint64 startsAt;   // 0 = immediately active
uint64 expiresAt;  // 0 = no expiration
```

Proposed semantics:

- `startsAt == 0`: active immediately.
- `expiresAt == 0`: does not expire.
- If both are nonzero, `expiresAt > startsAt`.
- Active when `block.timestamp >= startsAt && (expiresAt == 0 || block.timestamp < expiresAt)`.
- Expiration is exclusive at `expiresAt`.
- Existing deployed token IDs remain immediately active and non-expiring through zero-value defaults.

These values apply to the token ID, not independently to each holder or mint lot. Holder-specific expiration would require a different accounting model.

### Transfer Policy

Time validity and transferability are independent. A token may be transferable before its access window, non-transferable during use, or remain collectible after its entitlement expires.

Candidate policy model:

```solidity
enum TransferPolicy {
    UNRESTRICTED,
    SOULBOUND,
    ISSUER_ONLY,
    ALLOWLISTED,
    CONTROLLED_RESALE,
    LOCKED_AFTER_START
}
```

Final names and modes are not approved.

#### `UNRESTRICTED`

Normal ERC-1155 transfer behavior subject to existing pause, ban, and authorization rules.

#### `SOULBOUND`

Holder-to-holder transfers are prohibited. Minting, approved consumption/burning, expiration settlement, and an explicitly approved issuer correction or refund path may still be allowed.

Recommended for:

- annual AI allocation credits;
- personal software licenses;
- identity-bound memberships;
- non-resalable credentials.

#### `ISSUER_ONLY`

Only the issuer or approved system operator can move the token. This supports custody correction, return, rental, and administrative fulfillment without allowing an open secondary market.

#### `ALLOWLISTED`

Transfers are allowed only when the destination, operator, or both satisfy an approved registry or role check.

#### `CONTROLLED_RESALE`

Ordinary ERC-1155 holder-to-holder transfer functions are blocked. Transfer is permitted only through an approved resale or gifting function/facet that enforces the token's resale rules.

Potential controls include:

- approved marketplace or transfer operator;
- resale cutoff timestamp;
- maximum resale price or face-value cap;
- maximum transfer count;
- destination wallet eligibility;
- organizer royalty or fee;
- refund-to-issuer option;
- optional gift transfer with no consideration;
- event-specific allowlist or identity proof.

The contract cannot determine whether an unrestricted transfer was accompanied by an off-chain payment. Therefore price-cap enforcement only works when direct transfers are disabled and the approved resale path handles or verifies the consideration.

#### `LOCKED_AFTER_START`

Presale transfers are allowed before `startsAt`, but holder-to-holder transfers stop once the access, release, or event window begins.

### Anti-Scalping Requires Issuance Controls Too

Non-transferability prevents secondary resale but does not stop a scalper from purchasing many tokens in the primary sale. Ticket anti-scalping should therefore be able to combine transfer policy with issuance controls such as:

- maximum tokens per wallet;
- maximum tokens per verified purchaser or entitlement proof;
- allowlist or presale allocation;
- per-transaction mint cap;
- sale start and sale end timestamps;
- rate limiting or phased issuance;
- issuer-controlled refund and reissue;
- optional randomized or delayed seat/token assignment.

Wallet limits alone are vulnerable to Sybil wallets. Stronger limits require an external eligibility credential, signed authorization, allowlist proof, or another identity-resistant mechanism. Phase 13 should define the contract hooks and policy data but need not choose a universal identity provider.

### Recommended Initial Product Policies

| Product | Transfer policy | Primary issuance control | Expiration disposition |
| --- | --- | --- | --- |
| Annual AI allocation | `SOULBOUND` | One active allocation/cohort policy as approved | `BURN` |
| Concert/event ticket | `CONTROLLED_RESALE` | Wallet/purchaser cap and sale window | `BURN` or `KEEP_INERT` |
| Strict non-resale ticket | `SOULBOUND` | Wallet/purchaser cap | `BURN` or `KEEP_INERT` |
| Album presale/access | `LOCKED_AFTER_START` or `UNRESTRICTED` | Drop limit | `KEEP_INERT` |
| Rental entitlement | `ISSUER_ONLY` | Issuer fulfillment | `RETURN_TO_ADDRESS` |
| Promotional allocation | `SOULBOUND` or `ALLOWLISTED` | Per-user allocation | `BURN` or `RETURN_TO_ADDRESS` |
| Reserve-backed voucher | Product-specific | Product-specific | `REDEEM_TO_PARENT` if approved |

For tickets, `CONTROLLED_RESALE` is generally preferable to mandatory soulbound behavior because it can block scalpers while still supporting legitimate resale, gifting, refunds, and accessibility-related transfers.

### Expiration Disposition

A separate expiration policy determines what happens to a remaining balance after `expiresAt`:

```solidity
enum ExpirationDisposition {
    NONE,
    KEEP_INERT,
    BURN,
    RETURN_TO_ADDRESS,
    REDEEM_TO_PARENT
}
```

An explicit `expirationRecipient` would be used for `RETURN_TO_ADDRESS`.

- `KEEP_INERT`: balance remains, but the timed entitlement no longer works.
- `BURN`: expired units are destroyed with no value returned.
- `RETURN_TO_ADDRESS`: expired units move to a fixed issuer, organizer, owner, or treasury.
- `REDEEM_TO_PARENT`: settlement uses an approved and solvent reserve/redemption path.

True return to the historical original sender cannot be inferred reliably for fungible ERC-1155 balances after transfers and balance merging. That would require per-mint-lot or per-unit provenance and is outside this token-ID-level phase.

### Expiration Settlement

Contracts do not execute automatically when time passes. The entitlement becomes invalid directly from `block.timestamp`, while balance movement requires a transaction.

Candidate settlement path:

```solidity
function settleExpired(address account, uint256 id, uint256 amount) external;
```

The function must:

- require the token to be expired;
- apply only the configured disposition;
- use only a fixed configured return recipient;
- prevent the caller from redirecting value;
- avoid unbounded holder enumeration;
- emit the holder, ID, amount, disposition, and destination;
- support bounded batch settlement if approved.

Permissionless settlement may be safe when the result was fixed before issuance and cannot benefit or be redirected by the caller.

### AI Allocation Behavior

For annual AI credits:

- transfer policy is `SOULBOUND`;
- active use burns the amount consumed;
- expiration disposition is `BURN`;
- unused balance becomes invalid exactly at expiration;
- settlement burns expired balance when invoked;
- no GNUS, parent-token, reserve, treasury, refund, or rollover value is created.
</proposed_model>

<enforcement>
## Enforcement Requirements

Transfer policy must be enforced in every applicable balance-moving path, not only in UI metadata.

Likely enforcement points after approval:

- ordinary ERC-1155 single transfers;
- ordinary ERC-1155 batch transfers;
- mint and burn paths where policy-specific restrictions apply;
- approved controlled-resale or gifting facet;
- bridge paths if time-bound tokens may bridge;
- custom direct-balance batch paths;
- proxy or adapter paths capable of moving the underlying ERC-1155 balance;
- expiration settlement paths.

A common internal policy predicate should be reused where possible. Custom paths that bypass the standard hook require explicit parity checks.

For `SOULBOUND`, the policy must distinguish prohibited holder-to-holder transfers from allowed operations such as minting, consumption burns, expiration burns, fixed-recipient returns, and any narrowly approved issuer correction.

For `CONTROLLED_RESALE`, standard direct transfers must revert unless the operator and call path are the approved resale mechanism. Merely adding a marketplace function without blocking ordinary transfers would not enforce a price cap.
</enforcement>

<api_surface>
## Candidate API Surface - Names Not Approved

```solidity
function isTokenActive(uint256 id) external view returns (bool);
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

Potential controlled-transfer interfaces:

```solidity
function giftTransfer(address to, uint256 id, uint256 amount, bytes calldata authorization) external;

function resaleTransfer(
    address seller,
    address buyer,
    uint256 id,
    uint256 amount,
    uint256 price,
    bytes calldata authorization
) external payable;
```

These are discussion sketches only. The research and planning pass must determine whether consideration is handled natively, by an approved marketplace contract, or through signed settlement evidence.

Existing `createNFT()` and `createNFTs()` selectors should retain timeless, legacy-compatible behavior. Lifecycle-aware creation may use overloads, dedicated functions, or a separate configuration step before first mint.
</api_surface>

<security_and_upgrade>
## Security and Upgrade Requirements

1. Storage changes must be append-only or use a new namespaced policy mapping. Existing fields cannot be reordered or narrowed.
2. Existing token IDs must remain active, non-expiring, and behaviorally compatible through explicit zero-value defaults.
3. Transfer and expiration policies must be fixed before holders acquire tokens or only adjustable under narrowly defined, disclosed rules.
4. An administrator must not be able to convert a transferable token into a confiscatable or forced-return token after issuance.
5. `SOULBOUND` must still allow approved mint, consume/burn, expiration settlement, and correction/refund operations.
6. `CONTROLLED_RESALE` must block bypass through ordinary single transfers, batch transfers, operators, proxies, bridge paths, and custom balance mutations.
7. Resale-price enforcement is valid only when the approved transfer path controls or verifies consideration.
8. Purchase caps must account for Sybil limitations; wallet-only caps must not be described as identity-proof.
9. Return settlement must use a fixed configured recipient, never an inferred sender or caller-supplied destination.
10. Burn-only AI tokens must never credit GNUS, a parent token, a reserve, a treasury, or a refund balance.
11. `REDEEM_TO_PARENT` must be unavailable without approved reserve, rate, and solvency invariants.
12. No unbounded loops over holders or token IDs.
13. Lifecycle, transfer, disposition, resale, and policy changes require explicit events.
14. All new selectors require diamond collision checks.
15. Testnet upgrade, storage-layout verification, selector verification, rollback planning, Slither review, and full regression testing are required before mainnet deployment.
</security_and_upgrade>

<testing>
## Required Test Categories

- existing legacy NFT remains active, non-expiring, and behaviorally unchanged;
- future-start token exists but cannot be consumed before `startsAt`;
- exact `startsAt` and `expiresAt` boundary behavior;
- invalid timestamp combinations revert;
- `SOULBOUND` rejects direct and operator holder-to-holder transfers;
- `SOULBOUND` still permits approved mint and burn/consume paths;
- controlled-resale token rejects ordinary single and batch transfers;
- approved resale path succeeds only within sale/resale windows;
- resale price above an approved cap reverts where price enforcement is enabled;
- resale after cutoff reverts;
- transfer-count cap cannot be bypassed through batches or operators;
- gifting behavior follows its separate authorization and consideration rules;
- per-wallet primary mint cap works atomically in single and batch issuance;
- issuance cap cannot be bypassed by repeated calls from the same wallet;
- tests explicitly document that wallet caps do not prevent Sybil wallets;
- expired `BURN` decreases holder balance and total supply;
- `KEEP_INERT` leaves balance intact but denies entitlement;
- `RETURN_TO_ADDRESS` uses only the configured recipient;
- settlement caller cannot redirect returned balances;
- settlement before expiration reverts;
- burn-only AI spending and expiration create no parent, GNUS, reserve, treasury, refund, or rollover credit;
- unauthorized lifecycle, transfer-policy, disposition, recipient, resale, or issuance-policy changes revert;
- mixed-token batches revert atomically when any token violates policy;
- custom batch, proxy, bridge, and adapter paths cannot bypass approved rules;
- upgrade test proves pre-existing `NFT` records decode correctly.
</testing>

<open_decisions>
## Decisions Requiring User Approval

No item below is locked by this document.

1. Field names: `startsAt` / `expiresAt` versus `validFrom` / `validUntil`.
2. Policy storage: enums, flags, or a separate namespaced policy mapping.
3. Initial transfer modes required in v1.
4. Whether AI allocations are always strictly `SOULBOUND`.
5. Whether tickets default to `CONTROLLED_RESALE` or permit organizers to choose `SOULBOUND`.
6. Whether controlled resale supports price caps, gifting, refunds, transfer-count caps, and transfer cutoffs in v1.
7. Whether consideration is handled by the diamond, an approved marketplace, or signed external settlement evidence.
8. Which primary-sale anti-scalping controls belong in the token policy.
9. Whether purchaser limits are wallet-only or can consume an external eligibility credential.
10. Supported expiration dispositions in v1.
11. Policy and date mutability before and after first mint.
12. AI allocation ID strategy: per purchase, per annual cohort, or another model.
13. Settlement authorization: holder, approved operator, or permissionless fixed-result settlement.
14. Whether expired tickets and album tokens default to collectible `KEEP_INERT` behavior.
15. Whether `REDEEM_TO_PARENT` waits for Phase 9 reserve accounting.
16. Annual allocation period: 365 days, calendar year, or application-supplied timestamps.
17. Confirm true return-to-original-sender and per-mint-lot provenance are out of scope.
</open_decisions>

<canonical_refs>
## Canonical References

Downstream research, planning, or implementation agents must read:

- `contracts/gnus-ai/GNUSNFTFactoryStorage.sol`;
- `contracts/gnus-ai/GNUSNFTFactory.sol`;
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol`;
- `contracts/gnus-ai/ERC20TransferBatch.sol`;
- applicable bridge, proxy, and adapter contracts capable of moving balances;
- `.planning/ROADMAP.md`;
- `.planning/Update-Smart-Contracts-Architecture.md`;
- the user-supplied product/design discussion.
</canonical_refs>

<approval_gate>
## Approval Gate

This context remains **Discussion**.

- Do not mark decisions as locked.
- Do not generate an autonomous execution plan.
- Do not modify Solidity, tests, ABI, deployment configuration, or submodule pointers.
- Do not begin implementation until Kenneth Hurley explicitly approves lifecycle semantics, issuance controls, transfer policy, controlled-resale behavior, and expiration dispositions.

After approval, perform a code-grounded research pass across `GeniusVentures/gnus-ai` and `GeniusVentures/gnus-ai-contracts`, then produce a separate reviewable Phase 13 plan.
</approval_gate>

---

*Phase: 13-Time-Bound ERC-1155 Entitlements*
*Context gathered: 2026-07-27*
*Approval: pending*
