# Phase 11: ERC-20 Proxy Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-19
**Phase:** 11-erc-20-proxy-hardening
**Areas discussed:** Proxy repo logistics, Allowance storage model, Immutability mechanism, Redeem adapter design, Nested submodule bump

---

## Proxy Repo Logistics

| Option | Description | Selected |
|--------|-------------|----------|
| Clone/vendor into TokenContracts | Copy the proxy source into the workspace | |
| Sibling checkout | Work in a separate clone outside TokenContracts | |
| Existing submodule + new workstream | erc20-gnus-proxy is already a pinned submodule of TokenContracts (3a28aaf, develop); create a new GSD workstream and bifurcate .planning into it | ✓ |

**User's choice:** "it's in the main repo as a submodule, so you can use that and I think it may require a new workspace and bifrication of the .planning into that submodule"
**Notes:** Scout initially reported the repo as "not checked out locally" — wrong; `ls` had failed pre-compaction but `git ls-tree HEAD` shows it pinned at `160000 commit 3a28aaf` and the checkout exists as an independent clone (own `.git/` dir, GitHub remote, on `develop`). Verified contents: contracts (ERC20ProxyFacet/ERC20ProxyStorage/ProxyDiamond), test/{unit,integration,deployment}, hardhat.config.ts, nested submodules `contracts/gnus-ai` (stale pin 7c0b237, Oct 2024) and `diamonds/GeniusDiamond`. No `.planning/` in the submodule yet. Workstream pattern to mirror: `.planning/workstreams/gnus-ai/config.json` (submodule + planning_root keys).

## Allowance Storage Model

| Option | Description | Selected |
|--------|-------------|----------|
| In proxy facet (self-contained) | `_allowances` mapping appended to ERC20ProxyStorage.Layout; approve/transferFrom/_spendAllowance in ERC20ProxyFacet | ✓ |
| Delegated to gnus-ai diamond | Diamond stores per-proxy allowances | |

**User's choice:** "this really should not be in the proxy at all, as really it's not a facet it's a separate proxy contract"
**Notes:** Interpretation confirmed with user intent: the gnus-ai diamond must NOT absorb proxy logic — the standalone proxy contract repo owns its ERC-20 semantics. The diamond-side GNUS facade (GNUSBridge.sol:440-622) already has real allowances for id 0 and serves as the reference implementation, but it is not the phase target. `setApprovalForAll`-backed approve (the current bug, concern #5) is removed from the ERC-20 surface entirely; breaking change accepted, no migration shim.

## Immutability Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Initializer one-shot guard | `initializeERC20Proxy` gets `initializer` modifier from already-imported Initializable.sol | ✓ |
| Write-once-if-zero checks | Per-field zero checks | |

**User's choice:** "again not in this repo" (i.e., proxy-side concern, handled in erc20-gnus-proxy — mechanism at implementer/planner level)
**Notes:** All four init fields (erc1155Contract, childTokenId, name, symbol) become write-once. Current bug: owner can re-call initializeERC20Proxy and re-point the proxy at a different child id (issue #9 attack vector).

## Redeem Adapter Design

| Option | Description | Selected |
|--------|-------------|----------|
| On the proxy facet | Proxy holds convert logic; needs custody | |
| Separate adapter contract | Third contract deployed somewhere | |
| Generic adapter on gnus-ai diamond | Diamond-side, callable by any conforming external ERC-20 proxy | ✓ |

**User's choice:** "this should be in the gnus-ai/contracts/gnus-ai submodule as generic that the external ERC-20 proxy contract can call."
**Notes:** Adapter targets `GNUSTreasury.convert(childId, GNUS_TOKEN_ID, amount, recipient)` — the ONLY redemption path (Phase 9 D1 conversion-native; NO reserve apparatus exists). Issue #10's requirements reinterpreted: "reserve.redeem" → superseded; slippage/rate math → evaporates (1:1 minions, exchangeRate display-only); dust → `amount > 0` already in convert; replay → N/A same-chain. Approval chain (user → proxy → adapter → convert's `_msgSender()` burn) must be designed explicitly by the planner. AI Credits (Phase 13 SOULBOUND/BURN/never-redeemable) and Phase 9 `nonConvertible` tokens must revert through the adapter (inherited from convert's checks).

## Nested Submodule Bump

| Option | Description | Selected |
|--------|-------------|----------|
| Bump nested pins to current | contracts/gnus-ai → develop-with-redeem; diamonds/GeniusDiamond → match | ✓ |
| Keep stale pins | Proxy tests run against pre-Phase-9 diamond | |

**User's choice:** "Yes, bump is needed for nested dependencies to match all our updates, otherwise what's the point?"
**Notes:** Chicken-and-egg ordering: diamond-side redeem adapter lands in gnus-ai first, THEN the proxy's nested `contracts/gnus-ai` pin bumps to that commit, THEN proxy-side tests consume it.

## Replan Directive

**User's choice:** "Seems like we need to do something to replan this part"
**Notes:** gnus-ai ROADMAP Phase 11 gets restructured: criteria 1,2,3,4,6 (PROXY-01/02 + DEX tests) become cross-repo references owned by the new erc20-gnus-proxy workstream; criterion 5 (PROXY-03 redeem) remains as the gnus-ai diamond-side plan. PROXY IDs are also missing from REQUIREMENTS.md (same housekeeping gap as BRIDGE IDs) — fold into the restructure.

## Claude's Discretion

- Exact redeem adapter function name/signature (`redeem(childId, amount, recipient)` vs `redeemFromERC20Proxy(proxy, ...)`)
- Facet placement of the adapter (GNUSTreasury vs GNUSBridge vs new facet) — EIP-170 bytecode budget check required
- Proxy-side `_spendAllowance` infinite-allowance optimization (OZ-style max no-decrement)

## Deferred Ideas

- PROXY-01/02/03 missing from REQUIREMENTS.md — housekeeping, fold into planning restructure
- erc20-gnus-proxy repo hygiene (committed coverage/, stale TODOs) — new workstream's setup concern, not Phase 11
- Proxy diamond upgrade governance — out of scope
- ERC1155ProxyOperator auto-approval bypass — owned by Phase 13 (D6 there)
