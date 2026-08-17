---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 10 context gathered
last_updated: "2026-08-17T21:34:52.346Z"
progress:
  total_phases: 16
  completed_phases: 10
  total_plans: 20
  completed_plans: 20
  percent: 63
---

# Project State

**Project:** Gnus.ai Smart Contracts — Tech Debt & Security Remediation
**Last Updated:** 2026-07-02

## Project Reference

See: .planning/PROJECT.md

**Core value:** Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.
**Current focus:** Phase 10 — lock/release bridge vault (next per ROADMAP; phases 6, 08.2, 9 complete)

## Phase Status

| Phase | Name                              | Status | Plans | Progress |
| ----- | --------------------------------- | ------ | ----- | -------- |
| 1     | Preliminary Cleanup               | ✓      | 2/2   | 100%     |
| 2     | Dead Code Removal                 | ✓      | 2/2   | 100%     |
| 3     | Input Validation                  | ✓      | 2/2   | 100%     |
| 4     | Access Control & Observability    | ✓      | 1/1   | 100%     |
| 5     | Circuit Breaker & Performance     | ✓      | 1/1   | 100%     |
| 6     | Test Coverage                     | ✓      | 2/2   | 100%     |
| 7     | Dependency Hardening              | ○      | 0/0   | 0%       |
| 08.1  | Safe Wallet Proposer Retrofit     | ✓      | 3/3   | 100%     |
| 08.2  | Deploy-Verify Pipeline Fixes      | ✓      | 3/3   | 100%     |
| 9     | Per-Child GNUS Treasury/Reserve   | ✓      | 5/5   | 100%     |

## Next Actions

1. Phases 6, 08.2, and 9 complete. Next phase per ROADMAP: Phase 10 (bridge vault). Phase 7 audit gate is unblocked once Phases 10-14 land.
2. Cleanup follow-up (not blocking): full `npx hardhat test` shows 25 residual failures — 6 Safe proposer (Phase 08.1 pre-existing), 4 ERC1155ProxyOperator D10 side-effects, 12+ GNUSTreasury cross-suite "Already initialized" pollution (Phase 09-04 fixture isolation), 2 factory/deployer cross-suite pollution. Each file passes individually; a Phase 9 sweep should refactor provenance-initializer calls into idempotent helpers.

### Phase 9 Decisions Logged (09-05)

- ConservationInvariant Foundry suite lands I1/I2/I5 only — I3 (two-diamond bridge) and I6 (limiter charge matrix) are pinned by GNUSTreasury.test.ts unit suites per plan; I4 covered by unit tests
- Handler ghost variables come in two flavors: call counters (coverage) and amount sums (invariants) — `ghost_totalBridgedOutAmount` distinct from `ghost_totalBridgeDeposits`; `ghost_totalAdminBurned` distinct from `ghost_totalBurned`
- T-09-28 mitigation: handler draws ids from `ghost_createdIds` only — random id seeds almost never hit created ids
- Slither 0.11.5 run on 5 changed contracts: 3 unique findings, all false-positives (weak-prng on deterministic bin indexing; erc721-interface on intentional ERC-20 facade `approve`/`transferFrom` return-bool). Committed slither.config.json NOT modified.
- Slither inclusion gap: `contracts/gnus-ai/` is NOT actually excluded in the committed filter_paths (CONCERNS.md is stale on this point), but `yarn slither:scan` is evidently not running in CI — Phase 7 owns wiring it into the audit gate
- smart-trigger.ts:389 `'mint'` label confirmed inert (function-NAME risk classifier, not calldata builder) — dispositioned with comment, no semantic change

### Phase 9 Decisions Logged (09-04)

- GNUSTreasury deployInit/upgradeInit left EMPTY in diamond config (tooling calls initializers with no args); real signature kept in custom deployInitSignature/upgradeInitSignature fields; tests seed via explicit GNUSTreasury_Initialize300 call
- DiamondInitFacet version key is "3" not "3.0" — protocolInitFacet lookup stringifies protocolVersion to a JS number, so "3.0" never matches
- GNUSNFTFactory 3.0 entry carries deployInit/upgradeInit GNUSNFTFactory_Initialize230() — without it NFTs[0] is never created on fresh 3.0 deploys
- Two-diamond test fixtures need a name-matching artifact (GeniusDiamondChainB mock) + diamonds.paths entry; attach via the generated diamond-abi/GeniusDiamond.json ABI
- Library-declared events (SuperAdminBypass) are absent from the proxy ABI — assert via raw log topic, not chai .to.emit
- beforeMint burns from the CALLER — tests fund owner first, then owner factory-mints child to recipient (ownerMintChild pattern)

### Phase 9 Decisions Logged (09-03)

- Provenance counter increments use the post-fee `amount` local variable (not a separately captured pre-fee value) — Pitfall 3 compliance
- Cap check placed inside `if (tokenID == GNUS_TOKEN_ID)` — defense-in-depth after D10 restriction
- bridgeOut limiter charge uses `amount` directly — minion-denominated under D1/D2; division removed entirely
- No globalSupply hook on bridgeOut — B1 model (destination chain's bridge-in mint is the + side)
- GNUSBridge deployedBytecode: 18181 bytes (down from ~18872 baseline; net negative byte impact per research §H)

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Safe Wallet Proposer retrofit for diamondCut proposals (URGENT)
- Phase 08.2 inserted after Phase 08.1: Deploy-verify pipeline fixes (URGENT)

## Session Continuity

Last session: 2026-08-17T21:34:52.337Z
Stopped at: Phase 10 context gathered
Resume file: .planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md
