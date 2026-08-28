---
phase: 9
slug: per-child-gnus-treasury-reserve
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 09-RESEARCH.md §Validation Architecture (revision 2, conversion-native model).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit)** | Hardhat + Mocha/Chai + TypeScript (test/unit/*.test.ts) |
| **Framework (fuzz/invariant)** | Foundry (test/foundry/{fuzz,invariant,handlers}/) — `GeniusDiamondHandler.sol`, `DiamondInvariants.t.sol` exist |
| **Config files** | hardhat.config.ts; test/foundry/GeniusDiamond.forge.config.json |
| **Quick run command** | `cd gnus-ai && npx hardhat test test/unit/GNUSTreasury.test.ts` (once Wave 0 lands) |
| **Full suite command** | `cd gnus-ai && npx hardhat test` + `forge test` (foundry tree) |
| **Estimated runtime** | ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx hardhat test test/unit/GNUSTreasury.test.ts` (or the task's touched test file)
- **After every plan wave:** Run `npx hardhat test` + `forge test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-W0-01 | W0 | 0 | TREASURY-03 | — | GNUSTreasury.test.ts stubs + two-diamond fixture scaffold | unit | `npx hardhat test test/unit/GNUSTreasury.test.ts` | ❌ W0 | ⬜ pending |
| 9-W0-02 | W0 | 0 | TREASURY-01 | — | Foundry handler updated for convert/issue paths | invariant | `forge test --match-contract DiamondInvariants` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-01 | Conservation | I1: Σ supply changes only via root mint/burn/bridge | invariant (forge) | `forge test --match-contract ConservationInvariant` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-02 | Unbacked issuance | beforeMint: 1:1 minion move, depth-gate revert ≥2, creator/admin gate | unit | `npx hardhat test test/unit/NFTFactory.test.ts` | ✅ rewrite | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-03 | Limiter bypass | convert child→GNUS: exact amounts, I2 neutrality, limiter once (I6), super-admin bypass | unit | `npx hardhat test test/unit/GNUSTreasury.test.ts -g "convert to GNUS"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-03 | Double-charge | convert GNUS→child: hook charges once (no explicit charge), cap check on to-leg | unit | `-g "GNUS to child"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-03 | — | convert child→child: no limiter, neutrality | unit | `-g "child to child"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-03 | — | convert grandchild→GNUS single hop | unit | `-g "deep"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-03 | — | Reverts: same-id, zero amount, uncreated id, insufficient balance, nonConvertible | unit | `-g reverts` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-03 | Selector squatting | withdraw() selector gone — loupe + stale-calldata revert | unit | `-g "selector removed"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-04 | Uninitialized read | Initialize seed; re-init revert; sync event + role gate; totalSupplyOfAll reverts pre-seed | unit | `-g provenance` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-04 | Provenance drift | I3: two-diamond bridge — source bridgeOut + dest mint → counters consistent | unit (two fixtures) | `-g "cross chain"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-04 | Cap bypass | I5: global cap on root mint & bridge-in (post-fee amount); convert-to-GNUS never cap-checked | unit | `-g "global cap"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-05 | Rate inflation | unitsOf/totalUnitsOf floor rounding; id-0 revert; rate=0 revert | unit | `-g display` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | TREASURY-02/04 | Counter corruption | convert & factory mint do NOT touch globalSupply | unit | `-g "counter untouched"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | D7 | ID collision | createNFTs collision guard + parentId at depth ≥2 | unit | NFTFactory.test.ts (extend) | ✅ extend | ⬜ pending |
| 9-XX | per planner | 1+ | D10 | Conservation hole | MINTER_ROLE mint: id 0 succeeds, non-zero id reverts | unit | `-g "minter restriction"` | ❌ W0 | ⬜ pending |
| 9-XX | per planner | 1+ | §C | Cap bypass | Per-id maxSupply as minion cap: exactly-cap OK, cap+1 reverts | unit | `-g "minion cap"` | ❌ W0 | ⬜ pending |

*Task IDs finalized by planner; Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/GNUSTreasury.test.ts` — stubs for convert/provenance/display/global-cap suites + two-diamond fixture scaffold
- [ ] Foundry handler update — `GeniusDiamondHandler.sol` gains convert/mint-depth actions for I1–I6
- [ ] `test/unit/NFTFactory.test.ts` — rewrite sites identified in research §E (5 sites) for minion-denominated mint semantics

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deploy-time provenance seed value per chain | TREASURY-04 | Deployment parameter, environment-specific | Verify initializer calldata in deploy script review; seed = expected global figure for target chain |

---

## Invariant Suite (Foundry)

From research §I — the conversion-native invariant set:

| ID | Invariant |
|----|-----------|
| I1 | Conservation: Σ supply across ids changes only via root mint / burn / bridge |
| I2 | Convert-neutrality: convert() never changes tree-wide supply |
| I3 | Provenance consistency: totalSupplyOfAll tracks bridge operations (two-diamond fixture) |
| I4 | Free-GNUS identity: supply(0) == totalSupplyOfAll − Σ child supplies (single-chain) |
| I5 | Global cap: totalSupplyOfAll ≤ 50M after any operation |
| I6 | Limiter charge matrix: exactly-once per GNUS-terminal convert; hook-only per GNUS→child; never token-to-token |
