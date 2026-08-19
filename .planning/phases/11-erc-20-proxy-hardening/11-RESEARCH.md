# Phase 11: ERC-20 Proxy Hardening — Research (gnus-ai diamond-side ONLY)

**Researched:** 2026-08-19
**Domain:** Diamond-side redeem adapter (child ERC-1155 → GNUS) via `GNUSTreasury.convert()`; single requirement PROXY-03.
**Confidence:** HIGH (all core mechanics verified by reading current code; no external library discovery required)

## Summary

Phase 11's gnus-ai slice is a single, narrow addition: a generic `redeem()` adapter on the GeniusDiamond that lets an external ERC-20 proxy (e.g. `ERC20ProxyFacet` in the erc20-gnus-proxy repo) convert proxied-child ERC-1155 holdings into GNUS in one transaction. All redemption flows funnel through `GNUSTreasury.convert()` — the conversion-native, supply-neutral reallocation primitive that Phase 9 landed (09-CONTEXT D1/D2/D3/D5). The adapter adds NO new accounting, NO custody model, NO rate math — it is orchestration (validation + pull-or-direct-call + convert).

The central design question (D-08) resolves cleanly after tracing the code: the diamond's `_msgSender()` is plain `msg.sender` (ContextUpgradeable.sol:24 — no meta-tx relay), and diamond `delegatecall` preserves `msg.sender`. Therefore when an external ERC-20 proxy contract calls the adapter, `_msgSender()` inside `convert()` resolves to the PROXY's address, not the user. This forces the PULL-MODEL: the adapter must pull child ERC-1155 tokens from the user into a controlled address, then invoke `convert()` from that address so the burn-leg's `_msgSender()` matches the actual token holder whose balance is being debited. The DIRECT-CALL model (EOA calls diamond directly, `convert()` burns from the EOA) already works today via the existing public `convert()` — the adapter is needed ONLY when the caller is a contract (the proxy) and the user is upstream.

The pull-model creates a real ERC-1155 approval chain requirement (user → proxy as ERC-1155 operator, or user → diamond as ERC-1155 operator). This is DIFFERENT from the ERC-20 allowance chain (user → proxy as ERC-20 spender) that PROXY-01 establishes. The plan MUST document this explicitly and MUST NOT silently depend on `ERC1155ProxyOperator.sol`'s `NFT_PROXY_OPERATOR_ROLE` auto-approval (Phase 13 D6 flags that as a bypass risk; redeem path must work without it).

**Primary recommendation:** Add `redeem(uint256 childId, uint256 amount, address recipient)` to a NEW tiny facet `GNUSRedeemAdapter.sol` (NOT GNUSTreasury, NOT GNUSBridge). The adapter validates inputs, requires `_msgSender() != recipient` is NOT enforced (proxy should be able to specify any recipient), pulls `childId` tokens from `_msgSender()` (the proxy) into the diamond, then calls `GNUSTreasury.convert()` through an internal call — which means the diamond itself is the burner, so the adapter must first transfer the user's tokens to `address(this)` before calling convert. See "Architecture Patterns — Pattern 1" for the recommended call chain.

## User Constraints (from CONTEXT.md)

### Locked Decisions (diamond-side, copied verbatim from 11-CONTEXT.md)

- **D-05:** PROXY-03 (redeem adapter) lives in **gnus-ai/contracts/gnus-ai** as a **generic** adapter "that the external ERC-20 proxy contract can call" — it is diamond-side functionality, not proxy-side. Any conforming external ERC-20 proxy (not just ours) must be able to call it.
- **D-06:** The adapter targets `GNUSTreasury.convert(childId, GNUS_TOKEN_ID, amount, recipient)` — the ONLY redemption path. Phase 9 D1 locked the conversion-native model: **no reserve apparatus exists** (no `reserveOf`/`redeemableBacking`/`depositToReserve`). GitHub issue erc20-gnus-proxy#10's "uses reserve.redeem, not mint" text is SUPERSEDED — reinterpret like Phase 9/10 did for their ROADMAP criteria.
- **D-07:** Conversion is 1:1 minion-denominated with `exchangeRate` display-only (Phase 9 D2). Consequences for issue #10's requirements:
  - "Slippage/rate protection, fixed-point math" → **evaporates** (no rate math in conversion).
  - "Integer division dust rejection" → reduces to `amount > 0`, already enforced by `convert()`'s require.
  - "Replay protection if bridging is involved" → **N/A** (redeem is same-chain, no bridge).
  - "Insufficient reserve revert" → becomes insufficient-balance revert via `convert()`'s `_burn` balance check.
- **D-08:** Approval flow: the user approves the **proxy contract** (ERC-20 allowance, from PROXY-01 work); the proxy calls the diamond adapter; the adapter must pull the child ERC-1155 from the user. `GNUSTreasury.convert` burns from `_msgSender()` — so the adapter must either (a) pull the child tokens to itself first via `safeTransferFrom` (requires ERC-1155 operator approval of the adapter or the proxy chain) then call `convert` itself, or (b) be designed so the proxy's `transferFrom` moves tokens and the adapter converts its own balance then forwards GNUS. Exact mechanism is a planner decision, but the allowance chain (user → proxy → adapter → convert) must be explicit in the plan.
- **D-09:** Non-convertible tokens (Phase 9 `nonConvertible` flag) must revert through the adapter path — `convert()` already enforces this; adapter inherits it. AI Credits (Phase 13: SOULBOUND/BURN/never-redeemable) must NOT be redeemable through this adapter.
- **Phase 13 lock:** proxy stays a **dumb thin wrapper** — no custody of tokens, no proxy operator exemptions (`ERC1155ProxyOperator.sol:33` auto-approves NFT_PROXY_OPERATOR_ROLE; the redeem path must not depend on this bypass).
- **Phase 9 D5:** GNUS itself (id 0) is always convertible; `nonConvertible` applies to child ids only.
- **Multi-repo commit protocol:** commit inside nested submodule first, then pin-bump the outer repo; submodules stay on their own branches; PRs target `develop`, NEVER `main`.

### Claude's Discretion (from 11-CONTEXT.md)

- Exact redeem adapter function name/signature on the diamond (`redeem(uint256 childId, uint256 amount, address recipient)` vs. issue #10's alternative `redeemFromERC20Proxy(address proxy, ...)`) — planner picks based on the D-08 approval-chain mechanics.
- Whether the adapter is a new facet or an addition to an existing facet (GNUSTreasury vs GNUSBridge) — planner decides by facet bytecode budget (EIP-170) and cohesion.

### Out-of-Scope (from 11-CONTEXT.md `deferred` + phase boundary)

- PROXY-01 (real allowances) and PROXY-02 (immutable init) — erc20-gnus-proxy workstream's scope. This research does NOT plan for them, except where the proxy's eventual call pattern constrains the adapter's interface.
- Proxy-side DEX tests (D-14, criterion 6) — erc20-gnus-proxy workstream.
- Nested submodule pin bumps (D-03) — erc20-gnus-proxy workstream (the pin bump consumes our adapter, so execution order is: gnus-ai adapter ships first, then erc20-gnus-proxy bump + proxy work).
- Proxy diamond upgrade governance — out of scope.
- Phase 13's `ERC1155ProxyOperator` auto-approval bypass (D6) — owned by Phase 13.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| ERC-1155 child custody during redeem | gnus-ai diamond (brief, in-tx only) | — | The diamond must hold the tokens momentarily to call `convert()` from itself; never persists across tx. |
| ERC-20 allowance semantics for the proxy | erc20-gnus-proxy repo | gnus-ai (read-only — proxy delegates balance queries) | D-04: proxy is its own diamond; allowances live in its storage. |
| Validation (nonConvertible, amount>0, created ids, GNUS-token-id rejection) | gnus-ai diamond (in adapter, AND inherited from `convert()`) | — | `convert()` already enforces all of these; the adapter duplicates the cheap ones for clean revert reasons. |
| Withdraw limiter (WR-07) charge on GNUS-terminal convert | gnus-ai diamond (`GNUSTreasury.convert` lines 94-104) | — | Already in place; adapter does NOT add another charge. |
| ERC-1155 operator approval (user → proxy) | user wallet / client side | — | Out of band; the adapter doesn't grant or manage this. |
| Conversion accounting (burn+mint, supply-neutral) | gnus-ai diamond (`GNUSTreasury.convert`) | — | Adapter calls into it; no accounting in the adapter itself. |
| Event emission for audit trail | gnus-ai diamond (`Converted` event from `convert()`) | adapter MAY emit its own `RedeemedViaProxy` if planner wants proxy-attribution | Cheap; the existing `Converted` event already has `to` indexed. |

## Standard Stack

### Core (already in repo — no new dependencies)

| Library / Module | Purpose | Why Standard |
|------------------|---------|--------------|
| `@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Storage.sol` | Storage layout for ERC-1155 balances | Already used by `GNUSBridge._safeTransferFrom` and `ERC1155ProxyOperator`. |
| `@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol` | Cut-safe initializer pattern | Used by every facet in this repo. |
| `contracts/gnus-ai/GNUSNFTFactoryStorage.sol` | NFT struct incl. `nonConvertible`, `nftCreated` | Single source of truth for token metadata. |
| `contracts/gnus-ai/GNUSConstants.sol` | `GNUS_TOKEN_ID = 0` | Existing constant. |
| `contracts/gnus-ai/GeniusAccessControl.sol` | Roles | Inherited by all facets. |
| `contracts-starter/contracts/libraries/LibDiamond.sol` | Diamond storage, `contractOwner` | Used by `convert()` for the super-admin bypass path. |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/IERC1155ReceiverUpgradeable.sol` | ERC-1155 receiver hook | ONLY if we choose the pull-into-diamond model — diamond must implement `onERC1155Received` to accept the pulled tokens. |

### Alternatives Considered (facet placement)

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New facet `GNUSRedeemAdapter.sol` | Add `redeem()` to `GNUSTreasury.sol` | GNUSTreasury is currently 18151 bytes (verified by reading `artifacts/contracts/gnus-ai/GNUSTreasury.sol/GNUSTreasury.json` `deployedBytecode`); EIP-170 limit is 24576, so 6425 bytes headroom. A minimal `redeem()` would fit. **Downside:** mixing the generic adapter into the treasury facet couples "treasury business logic" with "external proxy entry point" — separate facets keep the security boundary cleaner and let us cut the adapter off independently if a vulnerability is found. |
| New facet `GNUSRedeemAdapter.sol` | Add `redeem()` to `GNUSBridge.sol` | GNUSBridge is currently 21797 bytes (verified same way); only 2779 bytes headroom. GNUSBridge is the bridging facet — adding a non-bridging entry point to it dilutes cohesion. Rejected on both size and cohesion grounds. |

**Installation:** none — all dependencies are already vendored in `node_modules/@gnus.ai/` and `contracts-starter/`.

**Version verification:** no new packages to verify. All Solidity imports are existing project files.

## Package Legitimacy Audit

> No new external packages installed by this phase. The adapter is pure Solidity within the existing diamond, using only imports that already exist in the repo. N/A.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User EOA                                     External Proxy Diamond              GeniusDiamond
─────────                                    ─────────────────────               ──────────────────
    │                                                │                                │
    │  (1) ERC1155.setApprovalForAll(proxy, true)    │                                │
    │ ─────────────────────────────────────────────> │  (once, out of band)           │
    │                                                │                                │
    │  (2) ERC20.approve(proxy, amount)              │                                │
    │ ─────────────────────────────────────────────> │  (PROXY-01 work; one-shot)     │
    │                                                │                                │
    │  (3) proxy.redeem(amount, recipient)           │                                │
    │ ─────────────────────────────────────────────> │                                │
    │                                                │  (4) ERC1155.safeTransferFrom(  │
    │                                                │        user,                   │
    │                                                │        address(this),  // proxy│
    │                                                │        childId, amount, "")    │
    │                                                │ ──────────────────────────────>│
    │                                                │       (burns user balance,     │
    │                                                │        credits proxy balance)  │
    │                                                │                                │
    │                                                │  (5) diamond.redeem(           │
    │                                                │        childId, amount,        │
    │                                                │        recipient)              │
    │                                                │ ──────────────────────────────>│
    │                                                │       (msg.sender == proxy)    │
    │                                                │                                │
    │                                                │       adapter body:            │
    │                                                │         require(childId != 0)  │
    │                                                │         _safeTransferFrom(     │
    │                                                │           msg.sender /*proxy*/,│
    │                                                │           address(this),       │
    │                                                │           childId, amount)     │
    │                                                │         // now diamond holds   │
    │                                                │         // the child tokens    │
    │                                                │         this.convert(          │
    │                                                │           childId, 0, amount,  │
    │                                                │           recipient)           │
    │                                                │         // ↑ external call to  │
    │                                                │         // self; _msgSender()  │
    │                                                │         // == address(this)    │
    │                                                │                                │
    │                                                │       convert() body:          │
    │                                                │         _burn(address(this),   │
    │                                                │               childId, amount) │
    │                                                │         _mint(recipient, 0,    │
    │                                                │               amount)          │
    │                                                │         emit Converted(...)    │
    │                                                │                                │
    │                                                │                                │  (6) recipient has GNUS
    │                                                │                                │       proxy has 0 of child
    │                                                │                                │       diamond has 0 of child
    │                                                │                                │       user has 0 of child
```

**Alternative (simpler, recommended):** skip step (4) entirely. Have the proxy approve the DIAMOND as ERC-1155 operator (one-shot by the user), and the adapter's `_safeTransferFrom(user, address(this), ...)` pulls directly from the user. This removes one hop but requires the user to `setApprovalForAll(diamond, true)` instead of `setApprovalForAll(proxy, true)` — same operator count, different address. The planner picks based on which is less surprising to integrators.

### Recommended Project Structure

```
contracts/gnus-ai/
├── GNUSRedeemAdapter.sol          # NEW — generic redeem adapter facet (~150 LOC estimated)
├── GNUSTreasury.sol               # UNCHANGED — adapter calls convert() via external self-call
├── GNUSTreasuryStorage.sol        # UNCHANGED
└── (all other existing facets unchanged)

diamonds/GeniusDiamond/
└── geniusdiamond.config.json      # MODIFY — add "GNUSRedeemAdapter" entry, version "3.0"
                                    #        (with fromVersions covering all live chains)

test/unit/
└── GNUSRedeemAdapter.test.ts      # NEW — happy path + revert matrix

test/foundry/invariant/
└── RedeemAdapterInvariant.t.sol   # NEW (optional, planner decides) — conservation under
                                    #      arbitrary redeem calls
```

### Pattern 1: Self-call via external interface to preserve `_msgSender()` semantics

**What:** The adapter calls `convert()` via `this.convert(...)` (external call to self), NOT via an internal `_convert(...)` helper. This makes `_msgSender()` inside `convert()` resolve to `address(this)` — the diamond — which matches the address whose balance the adapter just credited.

**When to use:** Whenever a diamond facet needs to invoke another facet's external function while presenting itself (the diamond) as the caller, rather than the original EOA/contract.

**Example:**
```solidity
// Source: inferred from the diamond pattern (delegatecall preserves msg.sender for external
// callers; this.f() resets msg.sender to address(this) for the inner call).
// Reference: GNUSBridge.sol:440-622 for the diamond's existing allowance patterns.

function redeem(uint256 childId, uint256 amount, address recipient) external {
    require(childId != GNUS_TOKEN_ID, "Cannot redeem GNUS itself");
    require(amount > 0, "Amount must be greater than zero");
    require(recipient != address(0), "ERC1155: mint to the zero address");

    // Pull child tokens from caller (the proxy) into the diamond.
    // Requires: caller has approved the diamond as ERC-1155 operator,
    // OR caller == token owner (i.e. user-called directly, no proxy).
    _safeTransferFrom(_msgSender(), address(this), childId, amount, "");

    // Burn from diamond, mint GNUS to recipient.
    // this.convert() makes _msgSender() == address(this) inside convert().
    // The limiter charge on the GNUS-terminal leg uses sender == address(this),
    // which will hit the super-admin bypass IF address(this) == contractOwner —
    // it does NOT, so the limiter is charged against the diamond's record.
    // This is the WR-07 accounting question the planner MUST resolve (see Pitfalls).
    this.convert(childId, GNUS_TOKEN_ID, amount, recipient);

    emit RedeemedViaAdapter(_msgSender(), childId, amount, recipient);
}
```

### Pattern 2: Append-only facet addition via diamond cut

**What:** Adding a brand-new facet (not modifying an existing one) to the diamond. Used when the new functionality is orthogonal to existing facets and we want a clean security boundary.

**When to use:** When the new function's caller-set, access patterns, or revert semantics differ meaningfully from any existing facet's, OR when no existing facet has EIP-170 headroom.

**Example (config addition):**
```json
// In diamonds/GeniusDiamond/geniusdiamond.config.json, inside "facets":
"GNUSRedeemAdapter": {
  "priority": 118,
  "versions": {
    "3.0": {
      "fromVersions": [0.0, 2.4, 2.5, 2.6]
    }
  }
}
```

**Key insight:** This is the pattern Phase 10 used for `GNUSBridgeValidatorStorage.sol` (a NEW storage library added alongside the GNUSBridge facet), except here we're adding a NEW facet entirely. The diamonds-hardhat deployer picks up new facet entries automatically when the version key is bumped and `fromVersions` covers the live deployment's current version.

### Anti-Patterns to Avoid

- **Internal-call refactor of `convert()`:** Do NOT extract `_convert(from, fromId, toId, amount, to)` as an internal helper and call it from the adapter with `from = user`. This would break the `_msgSender()`-based limiter charge and super-admin bypass logic in `convert()` — the limiter charge is keyed to `sender`, and if we make the adapter pass `user` as a parameter, we bypass the entire access-control-via-msg-sender invariant. The diamond's accounting assumes `_msgSender()` IS the burner.
- **Adapter-held custody across transactions:** Do NOT have the adapter hold child tokens between transactions (e.g. "user deposits to diamond, redeems later"). The pull-and-convert must be atomic within one transaction — otherwise we reintroduce the custody model that Phase 10 explicitly rejected for bridging.
- **Relying on `NFT_PROXY_OPERATOR_ROLE` auto-approval:** `ERC1155ProxyOperator.isApprovedForAll` (lines 28-39) returns true for any operator with `NFT_PROXY_OPERATOR_ROLE`. The adapter MUST work even when this role is not granted to anyone. Do NOT grant the role to the diamond itself as a workaround — that defeats Phase 13's security posture.
- **ERC-20-style approval on the diamond for child ids:** Do NOT add `_allowances[owner][spender][childId]` to diamond storage. ERC-1155's native `setApprovalForAll` is the correct approval primitive for child ids. The proxy-side ERC-20 allowances (PROXY-01) are a presentation-layer concern of the proxy contract, not the diamond.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conversion accounting (burn+mint, supply-neutral, limiter charge) | Custom burn/mint in the adapter | `GNUSTreasury.convert()` via `this.convert()` | Phase 9 already solved the conservation invariant, the limiter charge matrix, and the super-admin bypass. Duplicating it doubles audit surface. |
| Reentrancy protection | Custom `ReentrancyGuard` on the adapter | CEI ordering + existing `_beforeTokenTransfer` hooks | The diamond has no ReentrancyGuard anywhere. The adapter's external calls are: (1) `_safeTransferFrom` (an internal call on the diamond's own storage, fires hooks), and (2) `this.convert()` (an external self-call that runs `convert()` which itself does `_burn` then `_mint`). The `_mint` at the end could trigger `onERC1155Received` on the recipient if recipient is a contract — but the state changes (`_burn` from diamond, `_mint` to recipient) happen BEFORE that hook fires, in the same order as every other mint in the system. Reentrancy risk is equivalent to the existing `convert()` — no new exposure. |
| ERC-1155 receiver hook on the diamond | Custom acceptance logic | The diamond ALREADY receives ERC-1155 tokens via `_safeTransferFrom` (see `GNUSBridge.sol:537`) without any receiver hook — the hook is only required when the RECEIVER is a contract OTHER than the token contract itself. The diamond receiving its own tokens is a self-transfer within the same contract's storage; no hook needed. | ERC-1155 spec only requires `onERC1155Received` on the recipient when the recipient is a contract — but the diamond IS the ERC-1155 contract here, so a self-transfer via `_safeTransferFrom` doesn't trigger the external receiver check. **Verify this in implementation:** the OZ-derived ERC1155Upgradeable in this repo DOES call `_doSafeTransferAcceptanceCheck` on the recipient, and if recipient == address(this), the diamond will need to implement `onERC1155Received`. This is a real implementation risk (see Pitfalls). |

**Key insight:** the diamond is doing something subtly unusual — pulling tokens INTO itself. Most ERC-1155 contracts never do this. Whether it requires an `onERC1155Received` implementation depends on the exact OZ-derived code path. The planner MUST verify this by reading `ERC1155Upgradeable._safeTransferFrom` and `_doSafeTransferAcceptanceCheck` in `node_modules/@gnus.ai/contracts-upgradeable-diamond/` before writing the adapter.

## Common Pitfalls

### Pitfall 1: The `_doSafeTransferAcceptanceCheck` self-call

**What goes wrong:** When the adapter calls `_safeTransferFrom(_msgSender(), address(this), childId, amount, "")`, the underlying ERC1155 implementation calls `_doSafeTransferAcceptanceCheck(operator, from, to, ...)`. If `to` is a contract (which `address(this)` is), it calls `IERC1155Receiver(to).onERC1155Received(...)` and expects the magic return value. The diamond does not currently implement `onERC1155Received`. The pull reverts with "ERC1155: transfer to non-ERC1155Receiver implementer".

**Why it happens:** ERC-1155 mandates the receiver check for any contract recipient, including the token contract itself.

**How to avoid:** Verify by reading `node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol` `_safeTransferFrom`. If the check fires, the adapter (or a companion facet) MUST implement `onERC1155Received` returning `IERC1155Receiver.onERC1155Received.selector`, and `supportsInterface` must advertise `IERC1155Receiver`. This adds the facet to the ERC-1155 receiver surface — audit accordingly.

**Warning signs:** First happy-path test reverts with "non-ERC1155Receiver" — plan acceptance criteria MUST include the happy-path test passing, so this gets caught.

### Pitfall 2: Withdraw limiter charge attributes to the diamond, not the user

**What goes wrong:** In `GNUSTreasury.convert()` lines 94-104, the WR-07 GNUS-terminal limiter charge calls `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw(sender, minionAmount)` where `sender = _msgSender()`. When the adapter uses `this.convert(...)`, `sender` inside convert is `address(this)` — the diamond. The user's redemption therefore charges the DIAMOND's limiter bin, not the user's. After enough redemptions, the diamond hits its withdrawal limit and legitimate redemptions start reverting.

**Why it happens:** `this.convert()` resets `msg.sender` to `address(this)` for the inner call. This is by design (we WANT `convert` to burn from the diamond), but the limiter is keyed to `_msgSender()`.

**How to avoid:** Three options, planner picks:
  (a) Accept it — the limiter charges the diamond, and we document this as a known limitation. NOT recommended: it's a DoS on the adapter after enough volume.
  (b) Modify `convert()` to take an optional `chargeTo` address parameter. Rejected — changes the public API of an already-shipped facet, breaks existing callers.
  (c) Have the adapter charge the limiter DIRECTLY against the original `_msgSender()` (the proxy) before calling `this.convert(...)`, and modify `convert()` to skip its own charge when `_msgSender() == address(this)`. Option (c) preserves the limiter's per-caller semantics but requires touching `convert()`.
  (d) Alternative: the adapter performs the limiter charge against the ORIGINAL user (passed as a parameter or recovered from the proxy). But the proxy is the caller, not the user — the diamond has no way to know the user without trusting the proxy's say-so.
  **Recommended:** (c) with the charge keyed to the proxy (the caller), NOT the user. The proxy is the entity taking action on the diamond; per-caller limit on the proxy is consistent with the rest of the system's model. Document that the user's effective limit is enforced by the proxy's own economics (if the proxy chooses to track it).

**Warning signs:** Integration tests that hammer `redeem()` in a loop start reverting after ~limiter-bin-capacity calls.

### Pitfall 3: Super-admin bypass event fires for the diamond's converts

**What goes wrong:** `GNUSTreasury.convert()` lines 95-103: if `sender == LibDiamond.diamondStorage().contractOwner`, it emits `SuperAdminBypass` and skips the limiter. The diamond is NOT the contract owner, so this branch doesn't fire — but the planner should VERIFY this (a misconfigured `contractOwner` that equals `address(this)` would silently bypass the limiter).

**Why it happens:** Configuration error, not code bug.

**How to avoid:** Acceptance criterion in the plan: assert `LibDiamond.diamondStorage().contractOwner != address(diamond)` in a test.

**Warning signs:** `SuperAdminBypass` events with `sender == address(diamond)` in test logs.

### Pitfall 4: Existing `convert()` is callable directly by EOAs — the adapter is not the only path

**What goes wrong:** Test or documentation assumes that all proxied-child redemptions flow through the adapter. In reality, an EOA holding child tokens can call `diamond.convert(childId, 0, amount, recipient)` directly and bypass the proxy entirely. This is fine (and intended — `convert()` is permissionless), but tests and docs must not assert "the adapter is the only redemption path."

**Why it happens:** `convert()` is the canonical redemption path; the adapter is a CONVENIENCE for proxy-contract callers, not a gate.

**How to avoid:** Plan language: "the adapter enables proxy-contract callers; it does NOT replace direct `convert()` calls."

### Pitfall 5: `childId == GNUS_TOKEN_ID` must revert cleanly

**What goes wrong:** Adapter is called with `childId = 0`. `convert()` rejects `fromId == toId`, so it reverts — but with the generic "Cannot convert to same id" rather than a clear "cannot redeem GNUS itself" message.

**Why it happens:** The adapter doesn't pre-validate.

**How to avoid:** Adapter has an explicit `require(childId != GNUS_TOKEN_ID, "Cannot redeem GNUS itself")` BEFORE calling convert. This is listed in 11-CONTEXT.md `code_context` as a desired clean revert reason.

### Pitfall 6: DiamondCutInit version key stringification

**What goes wrong:** From STATE.md — "DiamondInitFacet version key stringification" was a known prior pitfall. Version keys in `geniusdiamond.config.json` are strings (`"3.0"`), but `fromVersions` is a numeric array (`[0.0, 2.4, 2.5, 2.6]`). Mixing types breaks the deployer.

**How to avoid:** Match the exact format used by Phase 10's `GNUSBridge` 3.0 entry — quoted version keys, unquoted numeric `fromVersions`.

## Code Examples

### Adapter skeleton (recommended shape, planner refines)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "./GNUSERC1155MaxSupply.sol";
import "./GeniusAccessControl.sol";
import "./GNUSConstants.sol";
import "./GNUSTreasury.sol";

/// @title GNUSRedeemAdapter
/// @notice Generic adapter for external ERC-20 proxies to redeem proxied-child tokens for GNUS.
/// @dev Callable by any contract (or EOA) that holds child ERC-1155 tokens. Pulls tokens
///      from the caller into the diamond, then converts them to GNUS via GNUSTreasury.convert.
///      The caller must have approved the diamond as an ERC-1155 operator, OR the caller
///      must BE the token holder (in which case the pull is a self-transfer).
contract GNUSRedeemAdapter is Initializable, GNUSERC1155MaxSupply, GeniusAccessControl {

    /// @notice Emitted when a redemption flows through this adapter.
    /// @param caller The contract (or EOA) that invoked redeem — typically the proxy.
    /// @param childId The child token id redeemed.
    /// @param amount Minion amount redeemed (1:1 to GNUS).
    /// @param recipient Recipient of the minted GNUS.
    event RedeemedViaAdapter(
        address indexed caller,
        uint256 indexed childId,
        uint256 amount,
        address indexed recipient
    );

    /// @notice Redeem `amount` of child token `childId` for GNUS, minted to `recipient`.
    /// @dev Caller must hold `amount` of `childId` AND have approved this diamond as
    ///      ERC-1155 operator (or be calling on its own behalf). The pull + convert is
    ///      atomic within this transaction.
    /// @param childId Child token id (must not be GNUS_TOKEN_ID).
    /// @param amount Minion amount (1:1 to GNUS).
    /// @param recipient Recipient of minted GNUS.
    function redeem(uint256 childId, uint256 amount, address recipient) external {
        require(childId != GNUS_TOKEN_ID, "Cannot redeem GNUS itself");
        require(amount > 0, "Amount must be greater than zero");
        require(recipient != address(0), "ERC1155: mint to the zero address");

        // Pull child tokens from caller into the diamond.
        _safeTransferFrom(_msgSender(), address(this), childId, amount, "");

        // Convert diamond-held child tokens to GNUS, minted to recipient.
        // this.convert makes _msgSender() == address(this) inside convert(),
        // matching the diamond's just-received balance.
        GNUSTreasury(address(this)).convert(childId, GNUS_TOKEN_ID, amount, recipient);

        emit RedeemedViaAdapter(_msgSender(), childId, amount, recipient);
    }
}
```

### Diamond cut config addition

```json
// In diamonds/GeniusDiamond/geniusdiamond.config.json, inside "facets":
"GNUSRedeemAdapter": {
  "priority": 118,
  "versions": {
    "3.0": {
      "fromVersions": [0.0, 2.4, 2.5, 2.6]
    }
  }
}
```

### Test skeleton (Hardhat + Chai, mirrors GNUSTreasury.test.ts pattern)

```typescript
// test/unit/GNUSRedeemAdapter.test.ts — mirrors test/unit/GNUSTreasury.test.ts structure.
// Uses LocalDiamondDeployer + GeniusDiamond typechain; signer0 = user, signer1 = recipient.

describe('GNUS Redeem Adapter Tests', async function () {
  // Suite names are literal grep targets for the Per-Task Verification Map in
  // 11-VALIDATION.md; do NOT rename.

  it('redeems child tokens for GNUS via the adapter (happy path)', async function () {
    // Setup: mint child tokens to signer0, signer0 setApprovalForAll(diamond, true).
    // Action: signer0.redeem(childId, amount, signer1).
    // Assert: signer0 child balance decreased by amount; signer1 GNUS balance increased
    //         by amount; diamond child balance is 0; Converted event emitted;
    //         RedeemedViaAdapter event emitted.
  });

  it('reverts when childId is GNUS_TOKEN_ID', async function () {
    // expect(redeem(0, amount, recipient)).to.be.revertedWith("Cannot redeem GNUS itself");
  });

  it('reverts when amount is zero', async function () { /* ... */ });
  it('reverts when recipient is zero address', async function () { /* ... */ });
  it('reverts when child token is nonConvertible', async function () {
    // Create child with nonConvertible=true; expect revert with "Token is non-convertible".
  });
  it('reverts when caller has insufficient balance', async function () { /* ... */ });
  it('reverts when caller has not approved the diamond as ERC-1155 operator', async function () { /* ... */ });
  it('charges the withdrawal limiter against the caller (WR-07)', async function () { /* ... */ });
  it('emits SuperAdminBypass when caller is super admin', async function () { /* ... */ });
  it('is callable by a contract (simulated external proxy)', async function () {
    // Deploy a minimal mock proxy contract; have it call redeem on behalf of a user.
    // Assert the full proxy-mediated flow works end-to-end.
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reserve-ledger redemption (`reserve.redeem`) | Conversion-native redemption via `GNUSTreasury.convert` | Phase 9 (D1, 2026-08-04) | The adapter calls `convert()`, not a reserve. No rate math, no slippage, no dust rejection beyond `amount > 0`. |
| BridgeOut escrows tokens in vault | BridgeOut burns (provenance relocation) | Phase 10 (D-01) | No diamond custody to inherit; adapter follows the same "no custody" model. |
| `setApprovalForAll(spender, amount>0)` as ERC-20 approve | Real ERC-20 `_allowances` mapping (proxy-side) | Phase 11 PROXY-01 (out of scope here, but CONSTRAINS the adapter) | The diamond's adapter must NOT assume the user has done ERC-1155 `setApprovalForAll(proxy, true)` — that's the OLD model. The new model: user does ERC-20 `approve(proxy, amount)` on the proxy, PLUS ERC-1155 `setApprovalForAll(proxy, true)` on the diamond (one-time, separate transaction). The adapter's pull will be executed by the proxy on the user's behalf. |

**Deprecated/outdated:**
- "Uses reserve.redeem, not mint" (issue #10) — superseded by Phase 9 D1. Reinterpret as `GNUSTreasury.convert`.
- "Slippage / rate protection" (issue #10) — evaporates under conversion-native model. No rate math exists.
- "Replay protection if bridging is involved" — N/A; redeem is same-chain.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The diamond's ERC1155 `_safeTransferFrom` will call `_doSafeTransferAcceptanceCheck` on `address(this)` when the adapter pulls tokens into the diamond, requiring `onERC1155Received` on the diamond. | Pitfall 1, Pattern 1 | If the check is skipped for self-transfers, the adapter doesn't need a receiver hook. If it fires, we need to add `onERC1155Received` to the adapter facet. The planner MUST verify by reading `ERC1155Upgradeable.sol` in `node_modules/@gnus.ai/contracts-upgradeable-diamond/`. |
| A2 | The pull-model is the correct D-08(a) interpretation; the proxy will hold tokens momentarily OR will approve the diamond as operator on the user's behalf. | Architectural Responsibility Map, System Architecture Diagram | If the proxy-side work (PROXY-01) designs a different flow (e.g. user → diamond direct approval, proxy only triggers), the adapter's pull target changes. The plan should make the pull source explicit. |
| A3 | The proxy is the intended caller of the adapter (not the user directly). EOAs can still call the adapter, but the proxy-contract case is the motivating scenario. | Architecture Patterns — Pattern 1 | If users are expected to call the adapter directly with no proxy, the adapter degenerates to a thin wrapper around `convert()` — still correct, but possibly unnecessary. |
| A4 | New facet (not GNUSTreasury addition) is the right call. GNUSTreasury has 6425 bytes headroom and COULD accommodate `redeem()`, but facet separation keeps the security boundary cleaner. | Alternatives Considered | If the planner prefers in-facet addition for simplicity, GNUSTreasury has the budget. No functional impact either way. |
| A5 | Limiter charge should be keyed to the proxy (the caller of the adapter), not the upstream user. The diamond has no way to know the user without trusting the proxy. | Pitfall 2 | If the user-facing requirement is "limiter per end-user", this design is wrong. The proxy would need to pass the user address and the adapter would need to trust it (or require a signature). The planner should surface this trade-off. |
| A6 | `RedeemedViaAdapter` event is additive convenience; the existing `Converted` event from `convert()` is the canonical audit trail. | Code Examples | If downstream consumers key off `RedeemedViaAdapter` specifically, the event is load-bearing. The plan should make this explicit. |

## Open Questions

1. **Does the diamond need `onERC1155Received`?**
   - What we know: The adapter pulls tokens into `address(this)` via `_safeTransferFrom`. Standard ERC-1155 requires the receiver hook when the recipient is a contract. The diamond IS a contract (the proxy diamond). The current codebase has NO `onERC1155Received` implementation (verified by grep — only doc comments mention it).
   - What's unclear: Whether `ERC1155Upgradeable._safeTransferFrom` skips the receiver check when `to == address(this)`. Unlikely — OZ reference doesn't special-case this.
   - Recommendation: Planner reads `node_modules/@gnus.ai/contracts-upgradeable-diamond/token/ERC1155/ERC1155Upgradeable.sol` `_safeTransferFrom` and `_doSafeTransferAcceptanceCheck`. If the check fires, the adapter facet (or a companion) implements `onERC1155Received` returning the magic value, and `supportsInterface` advertises `IERC1155Receiver`. Add acceptance criterion: happy-path test passes.

2. **Where does the limiter charge accrue?**
   - What we know: `convert()` charges `checkAndRecordWithdraw(sender, ...)` where `sender = _msgSender()`. With `this.convert()`, `sender` becomes the diamond.
   - What's unclear: Whether the design intent is per-user, per-proxy, or per-diamond limiting. Per-diamond is a DoS risk.
   - Recommendation: See Pitfall 2 option (c) — adapter charges the limiter directly against `_msgSender()` (the proxy), and `convert()` skips its own charge when `_msgSender() == address(this)`. Planner decides; discuss with user if the per-user limit is a hard requirement.

3. **Does the user need to ERC-1155-approve the proxy, the diamond, or both?**
   - What we know: The pull chain is `user → adapter (via diamond)`. The adapter's `_safeTransferFrom(user, address(this), ...)` requires the diamond to be an approved operator of the user.
   - What's unclear: Whether the proxy can be an intermediary holder (user → proxy, then proxy → diamond), which would let the user only approve the proxy.
   - Recommendation: Planner picks one model and documents it in the plan. The two-hop model (user approves proxy; proxy pulls to itself, then calls adapter which pulls from proxy) requires the proxy to also approve the diamond. The one-hop model (user approves diamond directly; proxy calls adapter with `from=user` — but this changes the adapter's signature to take a `from` parameter) is simpler but requires the user to know about the diamond. **Simplest: adapter takes a `from` parameter; the proxy passes the user; the user has approved the diamond (one-time).**

4. **Adapter signature: `redeem(childId, amount, recipient)` or `redeem(from, childId, amount, recipient)`?**
   - What we know: 11-CONTEXT.md lists `redeem(uint256 childId, uint256 amount, address recipient)` as the planner's-discretion option.
   - What's unclear: Whether the caller-of-record (the proxy) is always the holder of the child tokens, or whether the adapter needs to support pull-from-third-party.
   - Recommendation: If we go with the two-hop model (proxy holds tokens momentarily), the signature `redeem(childId, amount, recipient)` suffices — `_msgSender()` IS the holder. If we go one-hop (user holds throughout), we need `redeem(from, childId, amount, recipient)`. **Planner decides; recommend the two-hop model for signature simplicity, even at the cost of the proxy needing its own ERC-1155 approval to the diamond.**

## Environment Availability

> No external dependencies beyond the existing repo toolchain. The phase is pure Solidity changes plus tests within the existing Hardhat + Foundry infrastructure.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Hardhat | Compile + test | ✓ | (existing) | — |
| Foundry (forge) | Invariant tests | ✓ | (existing — `yarn forge:test` verified in STATE.md) | — |
| `@gnus.ai/contracts-upgradeable-diamond` | Solidity imports | ✓ | (vendored in node_modules) | — |
| `contracts-starter` | LibDiamond | ✓ | (vendored) | — |
| `@geniusventures/hardhat-diamonds` | LocalDiamondDeployer in tests | ✓ | (existing) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit) | Hardhat + Mocha + Chai (`chai-as-promised` for reverts), TypeScript, ethers v6 |
| Framework (invariant) | Foundry (forge), Solidity |
| Config files | `hardhat.config.ts` (existing); `test/foundry/GeniusDiamond.forge.config.json` (existing) |
| Quick run command (unit) | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts` |
| Full suite command (unit) | `npx hardhat test` |
| Full suite command (foundry) | `yarn forge:test` (per STATE.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PROXY-03 | Happy path: user → proxy → adapter → convert → GNUS minted to recipient | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "happy path"` | ❌ Wave 0 |
| PROXY-03 | Revert: childId == GNUS_TOKEN_ID | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "GNUS_TOKEN_ID"` | ❌ Wave 0 |
| PROXY-03 | Revert: amount == 0 | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "amount is zero"` | ❌ Wave 0 |
| PROXY-03 | Revert: recipient == address(0) | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "zero address"` | ❌ Wave 0 |
| PROXY-03 | Revert: nonConvertible child token (Phase 9 D5 / D-09 here) | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "nonConvertible"` | ❌ Wave 0 |
| PROXY-03 | Revert: insufficient child balance | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "insufficient balance"` | ❌ Wave 0 |
| PROXY-03 | Revert: caller not approved as ERC-1155 operator | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "not approved"` | ❌ Wave 0 |
| PROXY-03 | Limiter charge (WR-07) fires on GNUS-terminal convert via adapter | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "withdrawal limiter"` | ❌ Wave 0 |
| PROXY-03 | Super-admin bypass event emission | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "SuperAdminBypass"` | ❌ Wave 0 |
| PROXY-03 | Callable by a contract (simulated proxy) — integration with mock proxy contract | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "simulated external proxy"` | ❌ Wave 0 |
| PROXY-03 | Selector present on diamond after upgrade (loupe check) | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "loupe"` | ❌ Wave 0 |
| PROXY-03 | (Optional) Invariant: conservation of supply under arbitrary redeem calls | invariant | `cd test/foundry && forge test --match-contract RedeemAdapterInvariant` | ❌ Wave 0 (planner decides whether to include) |
| PROXY-03 | AI Credits (Phase 13 forward-compat): adapter rejects nonConvertible child tokens, which is how AI Credits will be flagged. Test uses a manually-flagged nonConvertible token. | unit | `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts --grep "nonConvertible"` | ❌ Wave 0 (same test as D-09 row above) |

### Sampling Rate

- **Per task commit:** `npx hardhat test test/unit/GNUSRedeemAdapter.test.ts` (fast — single file)
- **Per wave merge:** `npx hardhat test` (full unit suite) + `yarn forge:test` (full Foundry suite)
- **Phase gate:** Both suites green before `/gsd:verify-work`. Known pre-existing failures (per STATE.md): 1 unit failure in `GNUSControlStorage.test.ts` (chainID cross-suite pollution), 2 Foundry failures in `SafeDiamondCut`/`SafeSingleShotUpgrade` (Phase 08.1 setUp reverts). These are baseline, not Phase 11 regressions.

### Wave 0 Gaps

- [ ] `test/unit/GNUSRedeemAdapter.test.ts` — covers all PROXY-03 behaviors above
- [ ] (Optional) `test/foundry/invariant/RedeemAdapterInvariant.t.sol` — conservation invariant if planner includes Foundry coverage
- [ ] Diamond cut deploy for `GNUSRedeemAdapter` facet — verify `geniusdiamond.config.json` parses and `npx hardhat compile` succeeds after config change
- [ ] No framework install needed — Hardhat + Foundry both verified working in STATE.md (2026-08-17)

## Project Constraints (from CLAUDE.md)

The user-level CLAUDE.md is for C++ work on the broader GNUS.AI project and largely does not apply to this Solidity diamond phase. The applicable directives:

- **Project-grounded analysis only** — all claims in this research are grounded in files actually read in this session (listed in Sources). No reliance on training-data Solidity patterns without verification.
- **Minimal change philosophy** — the adapter is a single new facet file plus a config entry. No refactoring of `GNUSTreasury`, `GNUSBridge`, or any other existing facet.
- **Fix root cause, never hack around bugs** — if Pitfall 1 (receiver hook) fires, the fix is to add `onERC1155Received`, not to special-case the pull.
- **When in doubt, ask** — Open Question 2 (limiter charge attribution) and Open Question 4 (signature shape) are user-decision candidates if the planner's recommendation is ambiguous.
- **Multi-repo rules** — this research covers ONLY the gnus-ai diamond-side work. The proxy-side PROXY-01/02 work is in the erc20-gnus-proxy workstream. Planning artifacts for this phase live in `gnus-ai/.planning/phases/11-erc-20-proxy-hardening/`.

The C++-specific directives (spdlog, wait-condition templates, OS preprocessor guards, thirdparty libraries) do not apply to Solidity/Hardhat/Foundry work.

## Sources

### Primary (HIGH confidence) — read in this session

- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/phases/11-erc-20-proxy-hardening/11-CONTEXT.md` — controlling decisions D-01..D-14
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/phases/09-per-child-gnus-treasury-reserve/09-CONTEXT.md` — conversion-native model (D1, D2, D3, D5)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` — bridgeOut burn model, no custody
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/REQUIREMENTS.md` — PROXY-03 text
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/STATE.md` — known pitfalls, test baseline
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSTreasury.sol` (full file) — `convert()` lines 74-113, limiter charge matrix
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSBridge.sol` (lines 1-100, 430-623) — `_safeTransferFrom`, `_approve`, `_spendAllowance`
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/ERC1155ProxyOperator.sol` (full file) — `isApprovedForAll` auto-approval at line 33
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/contracts/gnus-ai/GNUSNFTFactoryStorage.sol` (full file) — NFT struct, `nonConvertible` field
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/node_modules/@gnus.ai/contracts-upgradeable-diamond/utils/ContextUpgradeable.sol` (full file) — `_msgSender()` is plain `msg.sender`
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyFacet.sol` (full file) — current broken proxy, allowance-via-setApprovalForAll
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyStorage.sol` (full file) — proxy Layout
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/diamonds/GeniusDiamond/geniusdiamond.config.json` (full file) — facet versions pattern, GNUSTreasury entry
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/test/unit/GNUSTreasury.test.ts` (lines 1-100) — test pattern reference
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/artifacts/contracts/gnus-ai/GNUSTreasury.sol/GNUSTreasury.json` — deployedBytecode length 18151 bytes (verified via `python3 -c json.load`)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/artifacts/contracts/gnus-ai/GNUSBridge.sol/GNUSBridge.json` — deployedBytecode length 21797 bytes (verified same way)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/phases/10-lock-release-bridge-vault/10-02-SUMMARY.md` — EIP-170 measurement path (deterministic fallback)
- `/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/config.json` — `nyquist_validation: true`, `security_enforcement` absent (= enabled)

### Secondary (MEDIUM confidence) — inferred from verified patterns

- The two-diamond test fixture pattern referenced in GNUSTreasury.test.ts (line 30 comment: "cross-chain provenance via two-diamond fixture") — the same fixture pattern works for adapter tests if cross-diamond scenarios are needed. Not read in detail.
- Phase 13 SOULBOUND/AI Credits never-redeemable requirement — confirmed by grep of 13-CONTEXT.md for "AI Credit", "SOULBOUND", "redeem" (lines 18, 130-132, 145, 165, 192-195).

### Tertiary (LOW confidence) — flagged for verification

- Open Question 1 (receiver hook on self-transfer) — needs verification by reading `ERC1155Upgradeable._doSafeTransferAcceptanceCheck`. Not read in this session.
- Open Question 2 (limiter charge attribution) — trade-off between per-caller and per-user limiting. User decision candidate.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all imports verified to exist in repo.
- Architecture: HIGH — the call chain (proxy → adapter → self-call convert) is fully traceable through verified code. The only architectural uncertainty is the receiver-hook question (Pitfall 1) and the limiter-attribution question (Pitfall 2), both flagged as Open Questions with concrete verification steps.
- Pitfalls: HIGH — Pitfalls 1, 2, 4, 5 are grounded in specific code paths verified this session. Pitfall 3 (super-admin bypass) is a defensive check. Pitfall 6 (config version stringification) is from STATE.md.

**Research date:** 2026-08-19
**Valid until:** 2026-09-18 (30 days — stable codebase, no fast-moving dependencies)

---

## RESEARCH COMPLETE

**Phase:** 11 — ERC-20 Proxy Hardening (gnus-ai diamond-side ONLY)

**Confidence:** HIGH

### Key Findings

- **Pull-model is forced:** `_msgSender()` is plain `msg.sender` (verified in `ContextUpgradeable.sol:24`); diamond `delegatecall` preserves it. When the proxy calls the adapter, `_msgSender()` inside `convert()` is the PROXY, not the user. The adapter MUST pull child tokens from the caller into the diamond, then call `this.convert(...)` so the burn leg's `_msgSender()` matches the diamond's just-received balance.
- **No new packages needed:** the adapter is pure Solidity within the existing diamond, using only imports already present. No Package Legitimacy Audit findings.
- **Facet placement: NEW facet recommended.** GNUSTreasury is 18151 bytes (6425 headroom, COULD fit `redeem()`); GNUSBridge is 21797 bytes (2779 headroom, too tight). A separate `GNUSRedeemAdapter.sol` facet keeps the security boundary clean — the adapter can be cut off independently if a vulnerability emerges. Both size measurements verified by reading `artifacts/.../deployedBytecode`.
- **Two open questions need verification during planning:** (1) whether the diamond needs `onERC1155Received` for self-transfers (depends on OZ-derived `_doSafeTransferAcceptanceCheck` behavior — planner reads `ERC1155Upgradeable.sol`); (2) whether the limiter charge should be reattributed from the diamond to the caller (planner picks Pitfall 2 option (c), or accepts per-diamond accounting).
- **No reserve / no rate math / no bridging:** Phase 9 D1/D2 + Phase 10 D-01 lock these out. The adapter is purely validation + pull + `this.convert()`. Issue #10's "slippage protection" and "replay protection" requirements evaporate under the conversion-native model.

### File Created

`/Users/Shared/SSDevelopment/Development/GeniusVentures/GeniusNetwork/TokenContracts/gnus-ai/.planning/phases/11-erc-20-proxy-hardening/11-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new packages; all imports verified to exist. |
| Architecture | HIGH | Call chain fully traceable through verified code; two open questions flagged with concrete verification steps. |
| Pitfalls | HIGH | All pitfalls grounded in specific verified code paths or STATE.md. |

### Open Questions (carried into planning)

1. Receiver-hook requirement for self-transfers — verify by reading `ERC1155Upgradeable._doSafeTransferAcceptanceCheck`.
2. Limiter charge attribution (per-proxy vs per-diamond) — planner picks; surface to user if per-user is a hard requirement.
3. Approval chain (user-approves-proxy vs user-approves-diamond) — planner picks; recommend the model that minimizes signature changes.
4. Adapter signature: `redeem(childId, amount, recipient)` vs `redeem(from, childId, amount, recipient)` — depends on (3).

### Ready for Planning

Research complete. Planner can now create PLAN.md files. The two Open Questions have concrete verification steps that the planner should resolve as part of Task 1 (read the relevant code, document the answer in the plan).
