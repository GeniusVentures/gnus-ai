---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: shipped
stopped_at: Phase 11 merged to develop via PR #75 (ec825c1; Codex P1 fix included); proxy half in erc20-gnus-proxy workstream
last_updated: "2026-08-20T20:05:00.000Z"
progress:
  total_phases: 16
  completed_phases: 12
  total_plans: 26
  completed_plans: 26
  percent: 75
---

# Project State

**Project:** Gnus.ai Smart Contracts — Tech Debt & Security Remediation
**Last Updated:** 2026-07-02

## Project Reference

See: .planning/PROJECT.md

**Core value:** Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.
**Current focus:** Phase 13 — time bound erc1155 entitlements

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
| 10    | Lock/Release Bridge Vault         | ✓      | 4/4   | 100%     |

## Next Actions

1. Phases 6, 08.2, and 9 complete. Next phase per ROADMAP: Phase 10 (bridge vault). Phase 7 audit gate is unblocked once Phases 10-14 land.
2. Cleanup follow-up (not blocking): full `npx hardhat test` on develop (verified 2026-08-17, Phase 10 work in place) shows **477 passing / 2 pending / 1 failing** — the single failure is `GNUSControlStorage.test.ts` "should return initial protocol info" (`chainID` 31337 vs 0), a cross-suite pollution issue: the file passes 38/38 in isolation on both pre- and post-Phase-10 HEADs. The earlier "25 residual failures" note was stale. Root fix belongs to a Phase 9 sweep: make the shared provenance initializer idempotent so suites don't leak chainID/supply state into each other. Foundry side (verified same day via `yarn forge:test`): 213 passed / 2 failed / 3 skipped — the 2 failures are the Phase 08.1 SafeDiamondCut + SafeSingleShotUpgrade setUp reverts, unchanged from Phase 9's record.

### Phase 10 Decisions Logged (10-04)

- Deterministic-invalid certificate derived from fuzz seed (`sigs[0] = abi.encodePacked(bytes32(seed), bytes32(seed^1), uint8(27))`) — random garbage that must NEVER verify; `invariant_noValidCertFromFuzzedSigs` asserts `ghost_bridgeInSuccesses == 0` (BRIDGE-03 soundness)
- Validator set configured in setUp with fixed nonzero root + threshold=1 (T-10-F02) — an unconfigured set would vacuously revert before reaching signature checks, making the soundness invariant meaningless
- Handler swallows reverts and only tracks state — reverting in the handler would cause the fuzzer to discard runs on expected reverts
- `GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION` declared once as a constant in BridgeInvariant with the mapping-slot formula documented (T-10-F05) — invariants read `processedMessages[transferId]` via direct `vm.load` of `keccak256(abi.encode(transferId, POSITION))`
- Bridge-pair conservation formula: `globalSupply == globalSupplyAtSeed + totalMinted - totalBurned + totalBridgedInAmount` — bridgeOut burn (already subtracted in I1's tree-supply check) and bridgeIn mint cancel globally (D-01/D-02)
- Full clean-tree `yarn forge:test` verified 213 passed / 2 failed / 3 skipped — identical to Phase 9's documented baseline; the 2 failures are Phase 08.1 Safe-proposer setUp reverts, unchanged

### Phase 10 Decisions Logged (10-03)

- Helper module accepts `BaseWallet` (not `Wallet`) — `Wallet.createRandom()` returns `HDNodeWallet` which extends `BaseWallet` but not `Wallet`; `signMessage` lives on `BaseWallet` in ethers v6, so widening the type is the minimal-change fix
- Merkle tree builder tracks per-node member SETS (not a single inherited leaf index) — fixes a draft bug where right-subtree leaves were missing sibling appends when their ancestor merged
- Diamond `chainID` aliased to live Hardhat chainid (31337) in test setup via `setChainID` so `bridgeIn`'s D-08 cross-chain guard passes for happy-path tests; wrong-chain test exercises digest mismatch by overriding `destChainID` off-chain
- Global-cap test uses `amount = GNUS_MAX_SUPPLY + 1` directly — no need to seed `globalSupply` near the cap, the require fires on the very first bridgeIn
- `chainSupply` assertion dropped in favor of `totalSupplyOfAll` — GNUSTreasury does not expose a public per-chain reader; per-chain partition is covered by Plan 10-04 Foundry invariants
- Canonical test vector (Hardhat account #0 private key, fixed BridgeInMessage) is logged for SG-side `SignEVM` C++ cross-check — closes Pitfall 1 / Pitfall 3 mitigation

### Phase 10 Decisions Logged (10-02)

- bridgeIn lives on the existing GNUSBridge facet (not a new facet) — final deployedBytecode is 21635 bytes (2941 headroom under EIP-170)
- Digest binds transferId, srcChainID, block.chainid, address(this), recipient, GNUS_TOKEN_ID, amount via abi.encode, then EIP-191-wraps with toEthSignedMessageHash — cross-chain (D-08) and cross-diamond replay protection
- Merkle leaf is keccak256(abi.encodePacked(signer)) — 20-byte packed encoding per Pitfall 3 (NOT abi.encode which pads to 32); SG side must match
- GNUS_TOKEN_ID hardcoded in bridgeIn (D-14) — child-token bridge-in is mint-of-id-0 followed by GNUSTreasury convert; no tokenId parameter on bridgeIn
- Explicit require(v.validatorThreshold > 0, "Validator set not configured") placed BEFORE the signatures.length >= threshold check (Pitfall 7) — without it, an unconfigured set would vacuously pass any certificate
- setValidatorSet emits ValidatorSetUpdated BEFORE the write so the event captures the OLD root (D-18 multisig audit trail)
- No deployInit/upgradeInit on the GNUSBridge 3.0 diamond-config entry — explicit setValidatorSet post-upgrade beats magic defaults for security-critical parameters (RESEARCH Pitfall 7)

### Phase 10 Decisions Logged (10-01)

- Pure storage library with no imports — mirrors GNUSTreasuryStorage.sol exactly (no LibDiamond dependency needed for a data-only layout)
- Slot string is `gnus.ai.bridge.validator.storage` (with .validator infix), NOT `gnus.ai.bridge.storage` — 10-RESEARCH.md Pitfall 6 reserves the shorter name for a future facet
- No Initialize function on the storage library — Phase 10 uses explicit configuration via `setValidatorSet` (10-RESEARCH.md Pitfall 7: explicit configuration beats magic defaults)
- Field order is load-bearing for append-only compatibility: `processedMessages` → `validatorMerkleRoot` → `validatorThreshold`; Phase 12 may append after these fields

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

Last session: 2026-08-19T19:19:41.679Z
Stopped at: Phase 11 context gathered — cross-repo split locked; planning restructure required before plan-phase
Resume file: None
