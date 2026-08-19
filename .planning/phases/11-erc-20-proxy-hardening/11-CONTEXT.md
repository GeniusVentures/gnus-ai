# Phase 11: ERC-20 Proxy Hardening - Context

**Gathered:** 2026-08-19
**Status:** Ready for planning (requires planning restructure FIRST — see D-01/D-02)

<domain>
## Phase Boundary

Fix ERC-20 proxy approval/allowance semantics, make proxy configuration immutable, and add a generic redeem adapter (proxied child → GNUS). **This phase spans TWO repos**: the `erc20-gnus-proxy` standalone contract repo (allowances + immutability) and the `gnus-ai` diamond (the generic redeem adapter the proxy calls). The diamond-side GNUS ERC-20 facade (GNUSBridge.sol:440-622) already has real allowances for id 0 — it is NOT the target of this phase.

</domain>

<decisions>
## Implementation Decisions

### Repo Logistics & Planning Structure
- **D-01 [informational]:** `erc20-gnus-proxy` is a pinned submodule of TokenContracts (`git ls-tree HEAD` → `160000 commit 3a28aaf`), checked out as an independent clone (own `.git/` directory, remote `git@github.com:GeniusVentures/erc20-gnus-proxy.git`, branch `develop`). Phase 11 proxy-side work happens **in that submodule**. (Repo fact — nothing for a gnus-ai plan to implement.)
- **D-02 [informational]:** Planning bifurcation required BEFORE planning can proceed:
  1. Create `.planning/workstreams/erc20-gnus-proxy/` in TokenContracts (mirror the `gnus-ai` workstream pattern: config.json with `"submodule": "erc20-gnus-proxy"`, `"planning_root": "erc20-gnus-proxy/.planning"`).
  2. Bootstrap `erc20-gnus-proxy/.planning/` via `/gsd:new-project` (or minimal equivalent) — the proxy repo has no `.planning/` today.
  3. Proxy-side Phase 11 work (criteria 1,2,3,4,6) is planned/executed under the new erc20-gnus-proxy workstream.
  4. gnus-ai ROADMAP Phase 11 keeps ONLY the redeem adapter (criterion 5, PROXY-03) as its diamond-side plan; proxy criteria are cross-repo references.
  5. Update `.planning/SUBREPOS.md` with the new workstream row.
  (All 5 steps completed: workstream config+STATE at TokenContracts d3b307f, proxy `.planning` at 0dc54d7, ROADMAP rewrite at 69ebbb4, SUBREPOS.md row added.)
- **D-03 [informational]:** Bump the proxy repo's nested submodules to current code as part of Phase 11 — `erc20-gnus-proxy/contracts/gnus-ai` is pinned at stale `7c0b237` (Oct 2024, pre-Phase-9/10). User directive: "bump is needed for nested dependencies to match all our updates, otherwise what's the point?" The nested pin must reach a gnus-ai commit that includes the Phase 11 redeem adapter (chicken-and-egg: diamond-side redeem lands first, then the nested bump + proxy-side tests consume it). Also bump `diamonds/GeniusDiamond` nested pin to match what current gnus-ai uses.

### Scope Split (user-locked)
- **D-04 [informational]:** PROXY-01/02 (real allowances, immutable init) live in **erc20-gnus-proxy** — "this really should not be in the proxy at all, as really it's not a facet it's a separate proxy contract" (i.e., the work belongs to the standalone proxy contract repo, NOT the gnus-ai diamond). The proxy is its own diamond (ProxyDiamond) with `ERC20ProxyFacet.sol`, `ERC20ProxyStorage.sol`, `ProxyDiamond.sol`.
- **D-05:** PROXY-03 (redeem adapter) lives in **gnus-ai/contracts/gnus-ai** as a **generic** adapter "that the external ERC-20 proxy contract can call" — it is diamond-side functionality, not proxy-side. Any conforming external ERC-20 proxy (not just ours) must be able to call it.

### Redeem Adapter Design (diamond-side, gnus-ai)
- **D-06:** The adapter targets `GNUSTreasury.convert(childId, GNUS_TOKEN_ID, amount, recipient)` — the ONLY redemption path. Phase 9 D1 locked the conversion-native model: **no reserve apparatus exists** (no `reserveOf`/`redeemableBacking`/`depositToReserve`). GitHub issue erc20-gnus-proxy#10's "uses reserve.redeem, not mint" text is SUPERSEDED — reinterpret like Phase 9/10 did for their ROADMAP criteria.
- **D-07:** Conversion is 1:1 minion-denominated with `exchangeRate` display-only (Phase 9 D2). Consequences for issue #10's requirements:
  - "Slippage/rate protection, fixed-point math" → **evaporates** (no rate math in conversion).
  - "Integer division dust rejection" → reduces to `amount > 0`, already enforced by `convert()`'s require.
  - "Replay protection if bridging is involved" → **N/A** (redeem is same-chain, no bridge).
  - "Insufficient reserve revert" → becomes insufficient-balance revert via `convert()`'s `_burn` balance check.
- **D-08:** Approval flow: the user approves the **proxy contract** (ERC-20 allowance, from PROXY-01 work); the proxy calls the diamond adapter; the adapter must pull the child ERC-1155 from the user. `GNUSTreasury.convert` burns from `_msgSender()` — so the adapter must either (a) pull the child tokens to itself first via `safeTransferFrom` (requires ERC-1155 operator approval of the adapter or the proxy chain) then call `convert` itself, or (b) be designed so the proxy's `transferFrom` moves tokens and the adapter converts its own balance then forwards GNUS. Exact mechanism is a planner decision, but the allowance chain (user → proxy → adapter → convert) must be explicit in the plan.
- **D-09:** Non-convertible tokens (Phase 9 `nonConvertible` flag) must revert through the adapter path — `convert()` already enforces this; adapter inherits it. AI Credits (Phase 13: SOULBOUND/BURN/never-redeemable) must NOT be redeemable through this adapter.

### Proxy-Side Design (erc20-gnus-proxy repo)
- **D-10 [informational]:** Real allowances: add `mapping(address => mapping(address => uint256)) _allowances` to `ERC20ProxyStorage.Layout` (append-only storage layout change — the proxy diamond's existing storage must not be corrupted). `approve()` sets the mapping + emits `Approval`; `allowance()` reads it; `transferFrom()` runs `_spendAllowance()` then `safeTransferFrom` on the underlying child id. Reference implementation: the diamond-side facade in `gnus-ai/contracts/gnus-ai/GNUSBridge.sol:440-622` (already has `_approve`/`_spendAllowance` on `ERC20Storage.layout()._allowances`).
- **D-11 [informational]:** `setApprovalForAll` semantics are REMOVED from the ERC-20 surface (all-or-nothing was the bug — concern #5). `transferFrom` must NOT require ERC-1155 operator approval of the spender anymore. Note: the proxy contract itself still needs ERC-1155 operator approval mechanics internally only if the pull-model in D-08(a) is chosen.
- **D-12 [informational]:** Immutability: `initializeERC20Proxy` becomes one-shot (initializer guard — the repo already imports `Initializable.sol` from `@gnus.ai/contracts-upgradeable-diamond`). `childTokenId`, `erc1155Contract`, `name`, `symbol` all become write-once. Current bug: function is owner-callable repeatedly, letting owner re-point the proxy at a different child id (attack vector per issue #9).
- **D-13 [informational]:** Breaking-change acceptance: integrations relying on `approve → setApprovalForAll` behavior will break. Accepted — that behavior was the vulnerability. No migration shim.
- **D-14 [informational]:** DEX-style test requirement (criterion 6): approve → transferFrom with decreasing allowances, zero-allowance rejection, allowance independent of operator approval. Tests live in erc20-gnus-proxy repo (`test/unit`, `test/integration` pattern exists there) and run against a GeniusDiamond deployed from the BUMPED nested submodule (D-03).

### Constraints Carried Forward
- Phase 13 lock: proxy stays a **dumb thin wrapper** — no custody of tokens, no proxy operator exemptions (`ERC1155ProxyOperator.sol:33` auto-approves NFT_PROXY_OPERATOR_ROLE; the redeem path must not depend on this bypass).
- Phase 9 D5: GNUS itself (id 0) is always convertible; `nonConvertible` applies to child ids only.
- Multi-repo commit protocol: commit inside nested submodule first, then pin-bump the outer repo; submodules stay on their own branches (erc20-gnus-proxy: `develop`); PRs target `develop`, NEVER `main`; phase branches `gsd/phase-{N}-{slug}` created BEFORE work begins.

### Claude's Discretion
- Exact redeem adapter function name/signature on the diamond (`redeem(uint256 childId, uint256 amount, address recipient)` vs. issue #10's alternative `redeemFromERC20Proxy(address proxy, ...)`) — planner picks based on the D-08 approval-chain mechanics.
- Whether the adapter is a new facet or an addition to an existing facet (GNUSTreasury vs GNUSBridge) — planner decides by facet bytecode budget (EIP-170) and cohesion.
- Proxy-side `_spendAllowance` infinite-allowance optimization (OZ-style `type(uint256).max` no-decrement) — implementer decides.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-defining docs (this repo chain)
- `.planning/ROADMAP.md` §Phase 11 (TokenContracts root copy at `.planning/ROADMAP.md:326-347`) — goal/success criteria; NOTE: criteria 1,2,3,4,6 move to erc20-gnus-proxy workstream per D-02
- `gnus-ai/.planning/phases/09-per-child-gnus-treasury-reserve/09-CONTEXT.md` — D1 conversion-native model (no reserve apparatus), D2 minion-denominated supplies, D5 nonConvertible semantics — CONTROLLING design for the redeem adapter
- `gnus-ai/.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` — provenance-relocation bridge model (redeem does NOT bridge; same-chain only)
- `gnus-ai/.planning/phases/13-time-bound-erc1155-entitlements/13-CONTEXT.md` — D6 proxy-operator bypass risk; "keep the proxy dumb" constraint; AI Credits never-redeemable requirement

### GitHub issues (requirements source)
- [erc20-gnus-proxy#9](https://github.com/GeniusVentures/erc20-gnus-proxy/issues/9) — PROXY-01/02 text: real `_allowances`, amount-specific approve, `_spendAllowance` in transferFrom, immutable child token ID
- [erc20-gnus-proxy#10](https://github.com/GeniusVentures/erc20-gnus-proxy/issues/10) — PROXY-03 text: redeem adapter; SUPERSEDED parts reinterpreted per D-06/D-07 (reserve.redeem → GNUSTreasury.convert; slippage/dust → evaporate)

### Source files (current state)
- `erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyFacet.sol` — the broken proxy: `approve → setApprovalForAll(spender, amount>0)`, `allowance → max:0`, `transferFrom` requires `isApprovedForAll`, re-callable `initializeERC20Proxy`
- `erc20-gnus-proxy/contracts/erc20-gnus-proxy/ERC20ProxyStorage.sol` — Layout { erc1155Contract, childTokenId, name, symbol } — `_allowances` mapping appends here
- `gnus-ai/contracts/gnus-ai/GNUSBridge.sol:440-622` — reference ERC-20 facade with real allowances (`_approve`, `_spendAllowance` on `ERC20Storage.layout()._allowances`)
- `gnus-ai/contracts/gnus-ai/GNUSTreasury.sol:74-113` — `convert(fromId, toId, minionAmount, to)`: the redemption path; burns from `_msgSender()`, GNUS-terminal limiter charge, nonConvertible enforcement
- `gnus-ai/contracts/gnus-ai/ERC1155ProxyOperator.sol:33` — NFT_PROXY_OPERATOR_ROLE auto-approval (do NOT rely on for redeem)
- `gnus-ai/contracts/gnus-ai/GNUSNFTFactoryStorage.sol` — NFT struct incl. Phase 9 `parentId`/`nonConvertible` fields

### Multi-repo protocol
- `.planning/SUBREPOS.md` (TokenContracts root) — submodule map + planning-directory ownership rules
- `.planning/workstreams/gnus-ai/config.json` — workstream config pattern to mirror for erc20-gnus-proxy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GNUSBridge.sol:598-634` (`_approve`, `_spendAllowance` internals): copy-adapt for the proxy facet — same `ERC20Storage` library pattern available via `@gnus.ai/contracts-upgradeable-diamond/token/ERC20/ERC20Storage.sol` (already imported by ERC20ProxyFacet).
- `Initializable.sol` from `@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol` — already imported by ERC20ProxyFacet; use its `initializer` modifier for D-12 one-shot init.
- erc20-gnus-proxy test infrastructure: `test/unit`, `test/integration`, `test-assets/deployments-test/GeniusDiamond` callbacks pattern — tests deploy a GeniusDiamond from the nested submodule; bump pin per D-03 and existing deployment fixtures pick up convert/bridgeIn.

### Established Patterns
- Diamond storage append-only: `ERC20ProxyStorage.Layout` gets `_allowances` appended AFTER existing fields (storage-slot compatibility with any deployed proxy diamonds).
- Conversion-native redemption: all child→GNUS paths funnel through `GNUSTreasury.convert` — the adapter adds no new accounting, just orchestration (pull + convert + deliver).
- Limiter: GNUS-terminal convert charges the withdrawal limiter (WR-07 charge matrix in GNUSTreasury.sol:88-101) — redeem adapter callers are subject to it; super admin bypass emits `SuperAdminBypass`.
- Facet bytecode budget: GNUSBridge at 21635 bytes post-Phase-10 (2941 headroom); GNUSTreasury smaller — planner checks EIP-170 before placing the adapter.

### Integration Points
- Proxy → diamond: adapter is called BY the proxy (or by user via proxy) on the gnus-ai diamond; proxy identifies its child id from its own immutable storage.
- Diamond → proxy: none — diamond never calls back into the proxy (keeps proxy dumb, Phase 13 lock).
- `GNUSTreasury.convert` requires both ids created and convertible; adapter validates `childId != GNUS_TOKEN_ID` early for a clean revert reason.

</code_context>

<specifics>
## Specific Ideas

- User on scope split: "this really should not be in the proxy at all, as really it's not a facet it's a separate proxy contract" — the gnus-ai diamond must NOT absorb proxy logic; the proxy repo owns its own ERC-20 semantics.
- User on redeem: "this should be in the gnus-ai/contracts/gnus-ai submodule as generic that the external ERC-20 proxy contract can call" — generic adapter, not proxy-specific.
- User on nested bump: "bump is needed for nested dependencies to match all our updates, otherwise what's the point?" — Phase 11 includes bumping `erc20-gnus-proxy/contracts/gnus-ai` (and `diamonds/GeniusDiamond`) nested pins to current code.
- User on planning: "it may require a new workspace and bifurcation of the .planning into that submodule" — new workstream + bootstrap, per D-02.
- "Seems like we need to do something to replan this part" — the gnus-ai ROADMAP Phase 11 text gets restructured (criteria split) as part of this phase's setup.

</specifics>

<deferred>
## Deferred Ideas

- PROXY-01/02/03 requirement IDs missing from `gnus-ai/.planning/REQUIREMENTS.md` — same housekeeping gap as BRIDGE IDs; fold into the planning restructure (D-02 step 4) rather than a separate task.
- erc20-gnus-proxy repo hygiene observed during scout: `coverage/`, `coverage.json` committed at repo root; stale Oct-2024 commit messages about diamond-abi regeneration — NOT this phase's scope; note for the new workstream's first phase setup.
- Proxy diamond upgrade governance (who can diamondCut ProxyDiamond) — out of scope; no deployments of the proxy diamond are documented as live.
- Phase 13's ERC1155ProxyOperator auto-approval bypass (D6 in 13-CONTEXT) — owned by Phase 13, not this phase.

</deferred>

---

*Phase: 11-erc-20-proxy-hardening*
*Context gathered: 2026-08-19*
