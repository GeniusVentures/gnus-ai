# Phase 17: Test-Suite Determinism - Research

**Researched:** 2026-08-31
**Domain:** Test-harness determinism — Hardhat cross-suite snapshot pollution (EIP-2535 shared-diamond singleton), Foundry invariant-surface soundness, forge fork-dependency declaration, baseline ledger consolidation
**Confidence:** HIGH (nearly every claim verified against repo source at exact line numbers; forge skip semantics verified empirically on the installed forge 1.7.1)

## Summary

This phase is a test-harness-only fix wave with three code targets and one record target. All four root causes are already diagnosed in 17-CONTEXT.md; this research supplies the implementation granularity: the exact blast radius (which is larger than the discuss estimate — 17 scaffold-snapshot suites, not 10-12), the exact contract-level revert conditions that shape the shared helper, the exact forge 1.7.1 counting semantics that make D-05's skip arithmetic correct, and the exact wrapper-level invocation for the invariant-only N-run proof.

The most consequential discoveries: (1) the D-03 blast radius is **17 files that take a scaffold-level `initialSnapshotId`** (13 in `test/unit/`, 2 in `test/integration/`, 1 in `test/gas/`, plus `test/deployment/GeniusDiamondDeployment.test.ts` which snapshots with a different shape) out of 35 files that load the shared diamond — the "~10-12" estimate was low, and there is a second tier of ~18 beforeEach-only suites that should get the call for full order-independence. (2) The probe-guard pattern the helper generalizes already exists in **13 suites**, not 6 (the CONTEXT's 6 cited precedents plus GNUSBridge, GNUSTreasury, NFTFactory, GNUSLifecycleSettle, and others). (3) A scratch forge project on the installed forge 1.7.1 **empirically confirmed** that a reverting `setUp()` counts as exactly ONE failed test per contract and a `vm.skip()` in `setUp()` counts as exactly ONE skipped test per contract — D-05's "2 failed → 0, skips 3 → 5" arithmetic is correct as stated. (4) The wrapper task accepts `--match-test`/`--match-contract` (no `--match-path`), which gives a clean invariant-only N-run command through the required bridge-node path.

**Primary recommendation:** Build `ensureDiamondTestBaseline()` in a new `test/utils/diamond-baseline.ts` (probe-then-seed + two idempotent writes), insert it into all 17 Tier-A scaffolds before `initialSnapshotId` (and fold the 13 duplicated probe bodies into it as you pass them), delete the `:69-73` test-side guard, apply the two-file `attacker` re-target, add the `vm.skip` line as the first statement of both Safe `setUp()`s, then run the N=5/N=10 proof and write the STATE.md ledger.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Re-target the invariant assertion subject from `user3` to `attacker` at `test/foundry/invariant/AccessControlInvariant.t.sol:276`, and fix the stale comment at `:275`. Root cause (verified): `user3` = `actors[3]` sits inside the handler's fuzz grant surface (`roles[3]` = UPGRADER_ROLE per `test/foundry/handlers/GeniusDiamondHandler.sol:85-88, 540-547`), so the invariant can be legitimately violated by the fuzzer. The file's own never-granted convention is `attacker` (`:165, :193`). Sound by construction.
- **D-02 (rejected alternative, not to be re-proposed):** Seeding the invariant config is **not implementable** — forge 1.7.1 has no `invariant.seed` config key, and `fuzz.seed = "0x1234"` provably does not govern invariant campaigns.
- **D-03:** Full sweep with a shared baseline helper. Add `ensureDiamondTestBaseline()` to the shared test harness — probe-guarded `GNUSTreasury_SetSeedSupply(0n)` + `setChainID(0)` + `updateBridgeFee(0)` — called in every suite's `before()` BEFORE `initialSnapshotId` is taken. Delete the test-side guard at `test/unit/GNUSControlStorage.test.ts:73`. Bridge suites that need chainID=31337 re-alias it AFTER the baseline call, inside their own snapshot window.
- **D-04:** Declare the fork dependency with a conditional skip: `vm.skip(SAFE_PROXY_FACTORY.code.length == 0, "requires sepolia/anvil fork with canonical Safe deployments")` at the top of both `setUp()`s.
- **D-05:** Success criterion 3 is recorded as **setUp-green-with-declared-skip**: the gate goes 0-fail with the skip count rising 3→5; the tests' real value is preserved in their documented manual fork/anvil flows (`ENCODED_CUT_PATH`). The phase gate record must reflect the new skip count explicitly.
- **D-06:** Local N-run proof + single baseline ledger: N=5 consecutive `yarn test:all` runs + N=10 invariant-only runs, results recorded in the phase record. `STATE.md` becomes the single canonical baseline ledger; `PROJECT.md` and the ROADMAPs are re-pointed at it.
- **D-07:** No CI determinism guard. CI cannot run the Foundry suite at all.

### Claude's Discretion

- Exact shape/location of `ensureDiamondTestBaseline()` within the shared harness (`test/utils/`), provided every suite calls it before `initialSnapshotId` and the probe guards stay idempotent.
- Wording of the corrected `:275` comment and the skip reason strings.

### Deferred Ideas (OUT OF SCOPE)

- Fork CI job for the Foundry Safe tests (needs `SEPOLIA_RPC` secret + owner ruling).
- Self-contained Safe setUp (deploy Safe singleton+factory locally) — blocked on solc-0.7.6/OZ-3.x dependency and `solc_version = "0.8.19"` pin.
- Foundry upgrade for `invariant.seed` — D-01 removes the need.
- `.mocharc` explicit suite ordering — unnecessary once every suite declares its own baseline.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-04 | GNUSControlStorage "should return initial protocol info" passes in the FULL suite — root fix, no test-side workaround | Blast-radius enumeration (17 Tier-A files), helper design with verified contract revert conditions, exact insertion shapes for all 3 scaffold styles, pollution-source precision (which suites actually mutate pre-snapshot) |
| TEST-05 | AccessControlInvariant deterministic across runs — align invariant with handler's grant surface | Exact current text of `:275-276` + `:257`, the `attacker` convention at `:165/:193`, handler grant/revoke surface verification, adjacency audit of every other invariant in the file, suggested replacement wording |
| TEST-06 | Phase 08.1 Safe setUp reverts resolved — SafeSingleShotUpgrade + SafeDiamondCut green | Exact setUp heads + insertion points, constant names, `vm.skip` availability in vendored forge-std, empirically verified skip/fail counting semantics (3→5 arithmetic), gate-output expectations |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No project-level `CLAUDE.md` exists in the gnus-ai repo (verified — absent). The user's global CLAUDE.md directives that bind this phase:

- **Minimal change philosophy:** tiny surgical insertions; no refactoring beyond what D-03 explicitly mandates (the helper + sweep IS the mandate; nothing more).
- **No scope creep:** do not touch production contracts, CI workflows, or add dependencies (also locked in CONTEXT).
- **Project-grounded analysis only:** every insertion point below was read from the actual files at the stated lines.
- **Never commit without permission; always run the gates before committing.**
- Multi-repo rule: all work in the `gnus-ai` submodule; planning artifacts go under `gnus-ai/.planning/` (this phase dir).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-suite state baseline declaration | Test harness (Hardhat TS, `test/utils/`) | — | The defect is harness-scaffold ordering, not contract logic; the diamond singleton (LocalDiamondDeployer static Map, keyed `cutKey(diamondName, networkName, chainId)`) is a read-only given |
| Invariant-subject soundness | Foundry invariant test file | Foundry handler contract (read-only context) | The invariant file owns its assertion subjects; the handler's `actors[]` surface is fixed context the subject must stay outside |
| Fork-dependency declaration | Foundry test `setUp()` | — | `vm.skip` in setUp is forge's contract-level gate; the dependency (canonical Safe code at a fixed address) is environmental |
| Baseline ledger of record | Planning docs (`.planning/STATE.md`) | PROJECT.md pointer | Precedent: `security-audit.yml:8` already commits the audit baseline in STATE.md |
| Proof execution (N-runs) | Local gate commands via bridge node | — | Foundry must run through `yarn forge:test` wrapper; CI cannot host it (D-07) |

## Standard Stack

### Core

No new packages — locked by CONTEXT (no new dependencies). Existing toolchain, versions verified this session:

| Tool | Version | Purpose | Provenance |
|------|---------|---------|------------|
| forge | 1.7.1-Homebrew (Commit 4072e48) | Foundry gate runner | [VERIFIED: `forge --version` this session] |
| forge-std (vendored `lib/forge-std`) | provides `vm.skip(bool,string)` at `Vm.sol:2540` | D-04 skip mechanism — already in scope via `Test` import, no import change needed | [VERIFIED: repo file] |
| Hardhat | 2.26.5 (per TESTING.md) + mocha glob (no `.mocharc`) | Hardhat gate runner; alphabetical suite order | [CITED: .planning/codebase/TESTING.md] |
| yarn | 4.10.3 | script runner | [CITED: project root description] |

### Alternatives Considered

None applicable — stack is frozen by the no-new-dependencies lock.

## Package Legitimacy Audit

None — this phase installs zero external packages (locked decision). All changes are to `test/` TypeScript, `test/foundry/` Solidity, and `.planning/` records.

## Architecture Patterns

### System Architecture Diagram

```
npx hardhat test (one mocha process, alphabetical suite order)
│
├─ Suite 1..N (35 files load the shared GeniusDiamond via LocalDiamondDeployer)
│   │
│   ├─ before(): deploy-or-reuse diamond (singleton Map, cutKey name/network/chainId)
│   ├─ ensureDiamondTestBaseline(diamond, diamondAddress)   << NEW (Tier A mandatory)
│   │   ├─ eth_getStorageAt(slot+1) → provenanceInitialized?
│   │   │    └─ if 0 → GNUSTreasury_SetSeedSupply(0n)      (one-shot, probe-guarded)
│   │   ├─ setChainID(0)                                    (idempotent write)
│   │   └─ updateBridgeFee(0)                               (idempotent write)
│   ├─ [bridge suites only] setChainID(31337n)  ← AFTER baseline, INSIDE snapshot window
│   └─ initialSnapshotId = evm_snapshot()      ← snapshot now bakes the declared baseline
│
└─ after(): evm_revert(initialSnapshotId) → leaves baseline-or-31337 state
        │
        ▼ next suite's before() re-declares baseline → order-independent

yarn forge:test (wrapper: npx hardhat diamonds-forge:test --network localhost --force)
│
├─ requires externally-running `npx hardhat node` (localhost:8545) — wrapper does NOT start it
├─ deploy diamond to node → regenerate helpers (DiamondDeployment.sol) → forge build
└─ forge test --fork-url http://127.0.0.1:8545 [-vv]
     ├─ Safe* contracts: setUp() head → vm.skip(factory.code.length == 0)  << NEW
     │    └─ bridge-node fork has no Safe code → 1 skip per contract (2 total)
     └─ AccessControlInvariant: attacker (outside actors[]) never granted    << FIXED
```

### Recommended Project Structure

```
test/
├── utils/
│   └── diamond-baseline.ts        # NEW — ensureDiamondTestBaseline() + TREASURY_STORAGE_SLOT
├── unit/
│   ├── GNUSControlStorage.test.ts # :69-73 guard DELETED; before() gains baseline call
│   ├── GNUSBridgeIn.test.ts       # :259-265 probe block → helper; :272 re-alias stays AFTER
│   └── ... (15 more Tier-A scaffolds)
└── foundry/
    ├── invariant/AccessControlInvariant.t.sol   # :257/:275/:276 re-target
    └── unit/Safe{SingleShotUpgrade,DiamondCut}.t.sol  # setUp() head vm.skip
```

### Pattern 1: The shared baseline helper (D-03 core)

**What:** One function declaring the cross-suite protocol baseline: provenance initialized with zero seed, chainID 0, bridgeFee 0.
**When to use:** Top of every shared-diamond suite's `before()`, before the suite takes its snapshot.
**Why this exact shape (contract-source verified):**

- `GNUSTreasury_SetSeedSupply` (`contracts/gnus-ai/GNUSTreasury.sol:171-179`) is `onlyRole(DEFAULT_ADMIN_ROLE)` with `require(l.ownChainId != 0, "Chain id not recorded")` and `require(!l.provenanceInitialized, "Already initialized")` — the ONLY revert risk on a re-run is "Already initialized", so the probe is required. `ownChainId` is always set: `diamonds/GeniusDiamond/geniusdiamond.config.json:123` runs `GNUSTreasury_Initialize260()` as deployInit. [VERIFIED: repo source]
- Storage probe target (`contracts/gnus-ai/GNUSTreasuryStorage.sol:15-23`): slot = `keccak256("gnus.ai.treasury.storage")`; layout is `globalSupply` (+0), `provenanceInitialized` (+1, bool), `chainSupply` (+2, mapping), `ownChainId` (+3). The probe reads slot **+1**. [VERIFIED: repo source]
- `setChainID` (`contracts/gnus-ai/GNUSControl.sol:176-178`) is `onlySuperAdminRole` with **no require at all** — idempotent, unconditional-safe for the owner. [VERIFIED: repo source]
- `updateBridgeFee` (`contracts/gnus-ai/GNUSControl.sol:166-170`) is `onlySuperAdminRole` with `require(newFee <= MAX_FEE /*200*/)` — fee 0 passes; idempotent. [VERIFIED: repo source]
- `onlySuperAdminRole` = `LibDiamond.diamondStorage().contractOwner == msg.sender` (`contracts/gnus-ai/GeniusAccessControl.sol:73-76`). On the local shared diamond the contractOwner is the deployer = signer0, and signer0 also holds DEFAULT_ADMIN_ROLE — proven by the 13 existing suites that call all three functions via the default-connected `geniusDiamond`. Pass the suite's default (unconnected or signer0-connected) instance.

**Implementation (recommended shape — final wording is Claude's discretion per CONTEXT):**

```typescript
// test/utils/diamond-baseline.ts
// Source: generalized from the probe-guard pattern in test/unit/GNUSBridgeIn.test.ts:259-265
// (same body duplicated in 12 other suites as of 2026-08-31)
import { ethers } from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';

/// keccak256("gnus.ai.treasury.storage") — GNUSTreasuryStorage.GNUS_TREASURY_STORAGE_POSITION
export const TREASURY_STORAGE_SLOT = ethers.keccak256(
	ethers.toUtf8Bytes('gnus.ai.treasury.storage'),
);

/**
 * Declares the cross-suite protocol baseline on the shared GeniusDiamond.
 * MUST be called in a suite's before() BEFORE initialSnapshotId is taken, so every
 * snapshot revert restores the declared baseline instead of inherited mutations
 * (bridge suites re-alias setChainID(31337n) AFTER this, inside their own window).
 *
 * Idempotency: the seed call is one-shot on-chain (reverts "Already initialized"),
 * so it is probe-guarded on provenanceInitialized (storage slot +1). setChainID(0)
 * and updateBridgeFee(0) are unconditional writes with no revert path for the owner.
 *
 * Caller must hold DEFAULT_ADMIN_ROLE + be the LibDiamond contractOwner — the
 * default signer (signer0/deployer) on the local shared diamond satisfies both.
 */
export async function ensureDiamondTestBaseline(
	geniusDiamond: GeniusDiamond,
	diamondAddress: string,
): Promise<void> {
	const initialized = await ethers.provider.send('eth_getStorageAt', [
		diamondAddress,
		ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
	]);
	if (BigInt(initialized) === 0n) {
		await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
	}
	await geniusDiamond.setChainID(0);
	await geniusDiamond.updateBridgeFee(0);
}
```

**Insertion shapes (three scaffold styles verified in repo):**

1. **Initial-snapshot scaffold (Tier A, e.g. GNUSControlStorage.test.ts):** insert after `loadDiamondContract(...)`, immediately before `initialSnapshotId = await hre.network.provider.send('evm_snapshot')`.
2. **Bridge scaffold (GNUSBridgeIn.test.ts:239-282, GNUSBridgeAttestorIn.test.ts:391-420):** REPLACE the existing probe block (`:259-265` / `:396-402`) with the helper call, then keep `setChainID(localChainId)` where it is — it already sits after the probe block and before the snapshot.
3. **beforeEach-only scaffold (GNUSBridge.test.ts etc.):** insert at the end of `before()`; mocha runs it once before the first `beforeEach` snapshot.

### Tier A — the 17 scaffold-snapshot files that MUST get the call (blast radius, verified by grep)

`initialSnapshotId` assignment in `before()`, all load the shared diamond (LocalDiamondDeployer usage verified in every file):

| # | File | Snapshot line |
|---|------|---------------|
| 1 | test/unit/DiamondInitFacet-limiter.test.ts | :97 |
| 2 | test/unit/ERC1155ProxyOperator.test.ts | :61 |
| 3 | test/unit/ERC20TransferBatch.test.ts | :52 |
| 4 | test/unit/GNUSBridgeAttestorIn.test.ts | :419 (bridge — re-alias :409) |
| 5 | test/unit/GNUSBridgeAttestorUpgrade.test.ts | :148 |
| 6 | test/unit/GNUSBridgeEnhanced.test.ts | :62 |
| 7 | test/unit/GNUSBridgeIn.test.ts | :281 (bridge — re-alias :272) |
| 8 | test/unit/GNUSContractAssets.test.ts | :69 |
| 9 | test/unit/GNUSControlStorage.test.ts | :52 (the TEST-04 victim) |
| 10 | test/unit/GNUSNFTFactoryEnhanced.test.ts | :61 |
| 11 | test/unit/GNUSWithdrawLimiter.test.ts | :97 |
| 12 | test/unit/GNUSWithdrawLimiterStorage.test.ts | :87 |
| 13 | test/unit/GeniusOwnershipFacet.test.ts | :45 |
| 14 | test/gas/withdraw-limiter-gas-comparison.test.ts | :88 |
| 15 | test/integration/erc1155-transfer-hook-limiter.test.ts | :107 |
| 16 | test/integration/erc20-transfer-batch-limiter.test.ts | :96 |
| 17 | test/deployment/GeniusDiamondDeployment.test.ts | uses evm_snapshot (different variable shape — locate the first snapshot in its before) |

Plus `test/utils/test-template.ts` (the pattern anchor) — update it so new suites inherit the baseline call.

### Tier B — remaining shared-diamond suites (recommended for full order-independence, 1-line each)

Erc20Batch, GNUSBridge, GNUSBridgePolicy, GNUSERC20, GNUSLicensing, GNUSLifecycle, GNUSLifecycleAICredits, GNUSLifecyclePolicy, GNUSLifecycleSettle, GNUSLifecycleUpgrade, GNUSNFTFactoryAntiScalping, GNUSRedeemAdapter, GNUSTreasury, NFTFactory, Phase5-circuit-breaker, TransferHelper, integration/withdraw-limiter-integration, and the rpc/safe suites as applicable. **Eight of these carry the duplicated probe block to fold** (GNUSBridge:230-237, GNUSTreasury:163-176, NFTFactory:121-128, GNUSLifecycleSettle:240-249, GNUSLifecycleUpgrade:161-171, GNUSLifecycleAICredits:154-162, GNUSLicensing:~179, GNUSRedeemAdapter:~154) — D-03 says the helper replaces the copies. **Do NOT touch test-body `SetSeedSupply` calls in GNUSTreasury.test.ts (:504-:987) — those test the one-shot behavior itself.**

### Pollution-source precision (refines CONTEXT, does not change D-03)

Only **two** suites mutate chainID pre-snapshot: `GNUSBridgeIn.test.ts:272` and `GNUSBridgeAttestorIn.test.ts:409`. `GNUSBridgeAttestorUpgrade.test.ts:244` (cited in CONTEXT as a third ordering defect) actually calls `setChainID` **inside a test** (`it(...)` starting :238) — it is reverted by afterEach and does not pollute downstream; its scaffold-level mutation is only the seed flip (desired baseline). The sweep covers it regardless; the planner should not chase a non-defect there.

### Pattern 2: Invariant-subject soundness rule (D-01)

**What:** An invariant may only assert a fixed negative role expectation for an address OUTSIDE the handler's fuzz surface. The surface is `actors[]` = `[handler(this), user1, user2, user3]` (`GeniusDiamondHandler.sol:85-88`) for BOTH `handler_grantRole` (:535-557) and `handler_revokeRole` (:587-608) — `roles[seed % 4]` × `actors[targetSeed % actors.length]`.
**When to use:** Any time an invariant asserts "X should not have role Y".
**Verified adjacency audit of AccessControlInvariant.t.sol (280 lines total):** every other invariant asserts on `address(0)`, `attacker`, `address(this)`, `owner`, or is a self-consistent double-query (`invariant_roleConsistency`) — all sound against the surface. `:276` is the only unsound assertion. No `afterInvariant` exists in the file.

### Anti-Patterns to Avoid

- **Test-side normalization (the bug being deleted):** `GNUSControlStorage.test.ts:69-73` calls `setChainID(0)` inside the test to mask inherited pollution. TEST-04 explicitly forbids this.
- **Probe-less seed call:** `GNUSTreasury_SetSeedSupply(0n)` unguarded reverts "Already initialized" on a cached diamond — every existing site guards it; the helper must too.
- **Baseline call after the snapshot:** makes the suite's own revert window restore pre-baseline state — the exact defect class being fixed.
- **Deleting the bridge re-alias:** bridge suites NEED chainID=31337 for `bridgeIn`'s destination-chain guard; only the inherited-state leak dies, not the alias.
- **Verifying the Foundry gate with bare `forge test`:** invalid without the bridge node ("Diamond has no code"; DiamondDeployment.sol points at `0xE8addD62feD354203d079926a8e563BC1A7FE81e`, a wrapper-deployed localhost diamond).
- **Silent skip-count drift:** the 3→5 change must be written into the gate record (D-05) — skips are baseline, not noise.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Suite state reset | Per-suite bespoke guards (13 copies exist today) | `ensureDiamondTestBaseline()` shared helper | The copies ARE the current tech debt; D-3 exists to collapse them |
| Conditional test skip | Hand-rolled flags/reverts in setUp | forge-std `vm.skip(bool, string)` (Vm.sol:2540) | Contract-level skip is first-class; counts correctly in the gate summary (empirically verified) |
| Invariant seeding | Custom seed plumbing / config keys | Nothing — D-01 soundness fix | `invariant.seed` does not exist on forge 1.7.1 (D-02 verified); re-target the subject instead |

**Key insight:** every mechanism this phase needs already exists in the repo or the vendored toolchain — the work is declaration and wiring, not construction.

## Runtime State Inventory

> This phase migrates recorded baselines (a documentation-state migration) — included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None on-chain or in DBs — all mutations are per-process test-chain state, discarded at run end | None |
| Live service config | None | None — verified: no external service registers the baselines |
| OS-registered state | None | None |
| Secrets/env vars | `ENCODED_CUT_PATH` (optional anvil artifact path referenced by SafeSingleShotUpgrade:182) — unchanged | None |
| Build artifacts / recorded baselines | **The real migration:** `.planning/STATE.md` 07-01/07-04 gate lines (665/2/1, 215/2/3), STATE.md Next Actions #4 (test-suite cleanup entry), `.planning/PROJECT.md:11` ("Test gate: 666 passing / 2 pending / 0 failing"), `.planning/ROADMAP.md:36` (phase-entry baselines — historical record, stays) | Ledger consolidation per D-06: new canonical baseline section in STATE.md, re-point PROJECT.md:11, retire the stale STATE cleanup entry |

## Common Pitfalls

### Pitfall 1: The 666 vs 665 Hardhat count ambiguity
**What goes wrong:** Historical records disagree (STATE 07-01/07-04 = 665/2/1; PROJECT.md = 666/2/0; ROADMAP = "666/2/0 with 1 known-stale"). Writing a "new baseline" from memory reproduces the RETROSPECTIVE.md:26 failure mode ("Stale baselines propagated through plans", 661 → 665 → 666).
**How to avoid:** The N=5 runs ARE the count derivation — record only what they print, per run, in the phase record; the ledger gets the observed stable figure. Note the count may legitimately land at 665 or 666 depending on suite set; do not "reconcile" by editing test lists.

### Pitfall 2: A non-bridge suite silently depends on inherited chainID=31337
**What goes wrong:** The baseline reset (`setChainID(0)`) lands in a suite whose tests previously inherited 31337 from an earlier bridge suite's leftover — its `bridgeIn`-style assertions then fail.
**Why it happens:** The current suites were written against polluted state either deliberately (bridge suites — they self-alias) or accidentally.
**How to avoid:** Bridge suites self-alias (verified pattern); run the full `yarn test` after each scaffold wave rather than batching all 35 files into one commit. **Warning signs:** any new failure mentioning chain/destination-chain guards in a non-bridge suite.

### Pitfall 3: Skip-count arithmetic surprises
**What goes wrong:** Expecting per-test skip counting — with 5 test functions across the two Safe contracts one might predict skips 3→8.
**Why it happens:** Uncertainty about forge's setUp semantics.
**How to avoid:** **Empirically settled this session** on forge 1.7.1 with a scratch project: reverting setUp = exactly 1 failed entry per contract (`[FAIL: msg] setUp()`); skipping setUp = exactly 1 skipped entry per contract (`[SKIP: reason] setUp()`). Therefore 2 failed → 0 failed, 3 skipped → 5 skipped, passed count unchanged (215 expected). The in-test skips at SafeSingleShotUpgrade:153/:182 currently never execute (setUp reverts first) and contribute nothing to today's 3 — those 3 come from `test/foundry/integration/diamonds-hardhat-foundry/deployment.t.sol` skip sites (:50, :91, :117, :124, :155, :179 — runtime-conditional).

### Pitfall 4: The wrapper needs an externally-running hardhat node
**What goes wrong:** Running `yarn forge:test` without `npx hardhat node` at localhost:8545 — deployment cannot happen / fork fails.
**Why it happens:** The wrapper (`diamonds-hardhat-foundry`) does NOT start the node (verified: no spawn/exec in DeploymentManager; the framework itself warns "Make sure to start Hardhat node first").
**How to avoid:** Proof protocol = terminal 1: `npx hardhat node`; terminal 2: gates. `yarn test` (Hardhat half) needs no node — in-process network.

### Pitfall 5: `--match-path` does not exist on the wrapper
**What goes wrong:** Trying `yarn forge:test --match-path test/foundry/invariant/*` — the task only defines `--match-test` and `--match-contract` params (test.ts:24-34), forwarded to `forge test --match-test/--match-contract` (utils/foundry.ts:99-103).
**How to avoid:** Use `--match-contract` (regex, contains-match on contract name). `AccessControlInvariant` matches exactly one contract; `Invariant` matches all 9 invariant/ contracts plus `DiamondInvariants` (fuzz/) — 10 total.

### Pitfall 6: mocha before() ordering inside multichain-style suites
**What goes wrong:** Inserting the baseline call inside a nested loop body or after provider iteration completes.
**How to avoid:** The call needs only the loaded `geniusDiamond` + `diamondAddress` in scope — insert at the point both exist and before the snapshot statement, in the same `before()` block. Verified workable in all three scaffold shapes.

## Code Examples

### TEST-04a: delete the test-side guard (GNUSControlStorage.test.ts:68-74)

Current (verified):
```typescript
it('should return initial protocol info', async function () {
	// Bridge suites alias the shared diamond's chainID to the local
	// chain (GNUSBridgeIn scaffold) and that mutation intentionally
	// outlives their snapshots — normalize it before asserting
	// defaults (same reset as the zero-chain-ID edge case below).
	await geniusDiamond.setChainID(0);
	const info = await geniusDiamond.protocolInfo();
```
After: comment + `setChainID(0)` line deleted (5 lines, :69-73); the test body starts at `const info = ...`. The separate `it('should handle zero chain ID')` at :408-413 keeps its own `setChainID(0)` — it is an edge-case test, not a guard.

### TEST-04b: bridge scaffold re-alias ordering (GNUSBridgeIn.test.ts)

```typescript
// :259-265 REPLACED by the helper call:
await ensureDiamondTestBaseline(geniusDiamond, diamondAddress);

// :267-272 UNCHANGED — re-alias AFTER the baseline, inside the snapshot window:
const network = await ethers.provider.getNetwork();
localChainId = network.chainId;
await geniusDiamond.setChainID(localChainId);
// ... attestor trees ...
// :281 initialSnapshotId = await hre.network.provider.send('evm_snapshot');
```

### TEST-05: the D-01 re-target (AccessControlInvariant.t.sol)

Current text (verified, :274-278 — the file's last invariant):
```solidity
function invariant_revokingUnownedRoleIsSafe() public view {
    // User3 shouldn't have UPGRADER_ROLE (never granted)
    assertFalse(_hasRole(UPGRADER_ROLE, user3), "User3 should not have UPGRADER_ROLE");

    console.log("[OK] Ungranted roles verified");
}
```
After (suggested wording — Claude's discretion per CONTEXT; matches the file's own convention at :165/:193):
```solidity
function invariant_revokingUnownedRoleIsSafe() public view {
    // attacker is outside the handler's actor set (GeniusDiamondHandler.actors),
    // so no fuzz sequence can grant it any role — user3 (actors[3]) was legitimately
    // grantable via handler_grantRole (roles[3] = UPGRADER_ROLE)
    assertFalse(_hasRole(UPGRADER_ROLE, attacker), "Attacker should not have UPGRADER_ROLE");

    console.log("[OK] Ungranted roles verified");
}
```
Also fix the stale doc line :257 `@dev View-only: Just checks that user3 doesn't have roles` → reference `attacker`. `user3` appears nowhere else in the file after this (verified: only :257 and :276).

### TEST-06: the setUp skip head (both Safe files)

SafeSingleShotUpgrade.t.sol setUp at :62 (first statement :63); SafeDiamondCut.t.sol setUp at :49 (first statement :50). Insert as the new first statement of each:

```solidity
// Fork dependency declared (D-04): the canonical Sepolia Safe v1.3.0 deployments
// exist only on a sepolia/anvil fork — the yarn forge:test bridge-node fork carries
// only the locally deployed diamond, so the factory call below would revert.
vm.skip(SAFE_PROXY_FACTORY.code.length == 0, "requires sepolia/anvil fork with canonical Safe deployments");
```

Constants (verified identical in both files): `SAFE_PROXY_FACTORY = 0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC` (SafeSingleShotUpgrade:49, SafeDiamondCut:37), `SAFE_SINGLETON = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` (:48 / :35). The reverting calls: `ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(...)` at :74 / :69. `vm` is already in scope via `import {Test} from "forge-std/Test.sol"` (:4 in both) — **no import change needed**.

### Empirical verification: forge 1.7.1 setUp semantics (scratch run this session)

```
Ran 1 test for test/SkipSem.t.sol:BRevertsInSetUp
[FAIL: no safe code] setUp() (gas: 0)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped

Ran 1 test for test/SkipSem.t.sol:ASkipsInSetUp
[SKIP: skipped: fork dependency absent] setUp() (gas: 0)
Suite result: ok. 0 passed; 0 failed; 1 skipped
```
(BRevertsInSetUp had 3 test functions — still exactly 1 failed entry. ASkipsInSetUp had 2 — exactly 1 skipped entry.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Test-side guards masking cross-suite pollution | Shared baseline declaration in every scaffold | This phase (D-03) | Full-suite runs become order-independent |
| Invariant subject inside fuzz grant surface | Subject outside `actors[]` (sound by construction) | This phase (D-01) | Flake eliminated without config seeding |
| Undeclared fork dependency (setUp reverts counted as failures) | `vm.skip` fork gate in setUp | This phase (D-04) | Gate goes 0-fail; skips are recorded, not silent |
| Baselines scattered across STATE/PROJECT/ROADMAP | Single STATE.md ledger | This phase (D-06) | Ends the 665/666/661 stale-propagation failure mode |

**Deprecated/outdated:** `invariant.seed` config key — does not exist on forge 1.7.1 (`forge config` warns "Found unknown `seed` config key in section `invariant`"); `fuzz.seed` provably does not govern invariant campaigns (set since 007410a, 2025-12-29, six months before the flake). Do not propose either (D-02).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Wall-time estimates: `yarn test:all` ~5-15 min per run, invariant-only wrapper run ~2-6 min (N=5 ≈ 0.5-1.5 h, N=10 ≈ 0.5-1 h sequential) | Proof bar | Only planning-window impact — no recorded timings exist anywhere in .planning; the plan must capture actuals on run 1 and the ledger should record per-run duration going forward |
| A2 | `--match-contract AccessControlInvariant` via the wrapper runs the invariant suite with identical fork semantics to the full gate | Proof bar | Low — the flag only filters which tests forge collects; deployment/helper/build steps are identical (verified in task source) |
| A3 | No non-bridge Hardhat suite depends on inherited chainID=31337 | Pitfall 2 | Moderate — a hidden dependency surfaces as a new failure in the N=5 runs; caught by per-wave full `yarn test`, fixed by adding a self-alias in that suite (same pattern as bridge suites) |

**Everything else in this research was verified against repo source, the installed toolchain, or an empirical forge run this session.**

## Open Questions (RESOLVED)

>All three resolved before planning: Q2 by the operator's post-research scope ruling (2026-08-31) — Tier A 17 + dedup of the duplicated-probe-guard Tier-B suites (9 verified sites, including the 9th at `test/integration/withdraw-limiter-integration.test.ts:114-122` the planner found); guard-free Tier-B suites untouched. Q1 by the derive-from-run-1 rule encoded in every plan's record rules. Q3 by the locked N=10 `AccessControlInvariant` bar in 17-05 plus N=5 `yarn test:all` covering the family. Downstream agents: do not re-litigate these.

1. **Exact Hardhat pass count post-fix**
   - What we know: historical records say 665 or 666 (2 pending); the count depends on suite set, not on this phase's changes (which add no tests).
   - What's unclear: which figure the current tree prints.
   - Recommendation: derive from run 1 of the N=5 proof; record per-run in the phase record; ledger gets the stable observed figure.

2. **Tier B scope ruling**
   - What we know: Tier A (17 files) satisfies D-03's letter ("every suite's before() BEFORE initialSnapshotId"); Tier B (~18 more) gives full order-independence for suites without initial snapshots.
   - What's unclear: whether the owner wants the full 35-file sweep or the snapshot-taking subset.
   - Recommendation: do Tier A + the 8 Tier-B suites carrying duplicate probe blocks (pure dedup, same behavior), then decide on the remainder after the first full `yarn test` — the gate output is the arbiter. This keeps the change minimal while still collapsing every duplicate.

3. **Invariant-only proof breadth**
   - What we know: `--match-contract AccessControlInvariant` isolates the fixed suite; `--match-contract Invariant` covers all 10 invariant-family contracts.
   - What's unclear: whether the owner wants the family-wide determinism signal at 2-3x the wall-time.
   - Recommendation: N=10 on `AccessControlInvariant` (the TEST-05 subject — success criterion 2 says "AccessControlInvariant passes across N consecutive runs"); the N=5 `yarn test:all` runs already exercise the whole Foundry suite 5 times as a family-level signal.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| forge | Foundry gate + D-04/D-05 semantics | ✓ | 1.7.1-Homebrew (4072e48) | — |
| forge-std `vm.skip(bool,string)` | D-04 | ✓ | vendored lib/forge-std (Vm.sol:2540) | — |
| node + yarn | all gates | ✓ | yarn 4.10.3 | — |
| `npx hardhat node` (localhost:8545) | `yarn forge:test` / invariant-only runs | external — must be started manually | hardhat 2.26.5 | none (wrapper does not start it) |
| LocalDiamondDeployer plugin | Hardhat suites | ✓ | @geniusventures/hardhat-diamonds (static Map singleton) | — |
| Sepolia RPC (`SEPOLIA_RPC`) | Nothing in this phase — Safe tests stay skipped locally | — | — | vm.skip is the declared state (D-04/D-05) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Sepolia fork capability — by design out of scope (deferred idea); skip declaration is the phase's answer.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Dual: Hardhat/mocha (`yarn test`) + Foundry forge 1.7.1 via bridge-node wrapper (`yarn forge:test`) |
| Config file | `hardhat.config.ts` (no .mocharc — alphabetical glob); `foundry.toml` (`invariant = { runs = 5, depth = 10, fail_on_revert = false }`, `fuzz.seed = "0x1234"`) |
| Quick run command | `npx hardhat test test/unit/GNUSControlStorage.test.ts` (isolated) and `npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --network localhost --force --match-contract AccessControlInvariant` (invariant-only; node required) |
| Full suite command | `yarn test:all` (both; node required for the forge half) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-04 | "should return initial protocol info" passes with ALL suites in one process | full-suite gate | `yarn test` → grep the suite result: 0 failing | ✅ test exists (`test/unit/GNUSControlStorage.test.ts:68`); full-suite runner exists |
| TEST-04 (no-workaround proof) | `:69-73` guard absent | static check | `grep -n "normalize it before asserting" test/unit/GNUSControlStorage.test.ts` → no hits | n/a (verification command) |
| TEST-05 | AccessControlInvariant green across N=10 runs | invariant campaign | wrapper `--match-contract AccessControlInvariant` × 10, each exit 0 | ✅ test exists (`test/foundry/invariant/AccessControlInvariant.t.sol:274`) |
| TEST-05 (subject proof) | assertion target is `attacker` | static check | `grep -n "UPGRADER_ROLE, user3" test/foundry/invariant/AccessControlInvariant.t.sol` → no hits | n/a |
| TEST-06 | Safe setUps green-with-declared-skip | full Foundry gate | `yarn forge:test` → "0 failed", skipped = 5 (was 3), passed unchanged | ✅ tests exist (both files) |
| Baseline ledger | STATE.md holds single canonical baseline; PROJECT.md re-pointed | record check | `grep -n "666 passing" .planning/PROJECT.md` re-pointed; STATE ledger section present | ❌ Wave 0 (ledger section is phase output) |

### Sampling Rate
- **Per task commit (scaffold waves):** `yarn test` — catches Pitfall 2 (a suite broken by the baseline reset) at the wave that caused it, not at phase end. For Foundry-touching tasks: the invariant-only wrapper command.
- **Per wave merge:** `yarn test:all` (node running).
- **Phase gate (success criterion 4):** N=5 consecutive `yarn test:all` + N=10 invariant-only runs, all green, counts recorded per run; ledger + re-points committed in the same change.

### Wave 0 Gaps
- `test/utils/diamond-baseline.ts` — the helper itself (no test file needed; it is exercised by every suite that calls it — its correctness signal IS the full-suite gate).
- No framework installs required — existing infra covers all phase requirements.

## Security Domain

Test-harness-only phase; no production contract, dependency, or CI changes (locked). Applicable categories:

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | test-surface only | D-01 keeps an access-control invariant SOUND (assertions outside the fuzz grant surface) — this is the phase's one security-relevant artifact |
| V5 Input Validation | no | — |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Masking a real state bug with a test-side guard (the `:73` pattern) | Tampering (evidence) | Delete the guard; declare the baseline at the scaffold (D-03) — the test becomes a true specification again |
| Invariant that cannot fail (subject outside fuzz surface by construction) | Repudiation | `attacker` convention — never in `actors[]`, so neither grant nor revoke handlers can touch it |

## Sources

### Primary (HIGH confidence — repo source, read this session)
- `contracts/gnus-ai/GNUSControl.sol:166-198` — updateBridgeFee/setChainID/protocolInfo revert conditions + modifiers
- `contracts/gnus-ai/GNUSTreasury.sol:157-179` — SetSeedSupply one-shot + ownChainId precondition
- `contracts/gnus-ai/GNUSTreasuryStorage.sol:15-33` — layout order (probe target = slot+1)
- `contracts/gnus-ai/GeniusAccessControl.sol:73-76` — onlySuperAdminRole = LibDiamond contractOwner
- `diamonds/GeniusDiamond/geniusdiamond.config.json:123` — deployInit `GNUSTreasury_Initialize260()`
- `test/unit/GNUSControlStorage.test.ts:27-97, 398-413` — victim test, guard to delete, edge-case test to keep
- `test/unit/GNUSBridgeIn.test.ts:239-294`, `GNUSBridgeAttestorIn.test.ts:391-424`, `GNUSBridgeAttestorUpgrade.test.ts:125-153, 238-244` — bridge scaffolds; the :244 in-test nuance
- `test/foundry/invariant/AccessControlInvariant.t.sol` (full read; :158-196, :274-278) — attacker convention + D-01 target
- `test/foundry/handlers/GeniusDiamondHandler.sol:81-94, 535-608` — actors array + grant/revoke surfaces
- `test/foundry/base/GeniusDiamondTestBase.sol:60-97, 80-140` — user/attacker declarations (attacker :97)
- `test/foundry/unit/SafeSingleShotUpgrade.t.sol:40-115, 151-182`, `SafeDiamondCut.t.sol:28-92, 106-175` — setUp heads, constants, test inventory
- `lib/forge-std/src/Vm.sol:2537-2540` — vm.skip signatures
- `foundry.toml` (full) — invariant/fuzz config, remappings, rpc_endpoints
- `package.json:7-33` — all gate scripts
- `node_modules/@geniusventures/diamonds-hardhat-foundry/src/tasks/test.ts` + `framework/ForgeFuzzingFramework.ts` + `utils/foundry.ts:85-125` — wrapper params, node expectation, forge arg construction
- `node_modules/@geniusventures/hardhat-diamonds/dist/lib/LocalDiamondDeployer.js:7,51-64,133` — static Map singleton + cutKey
- `test/foundry/helpers/DiamondDeployment.sol` — auto-generated localhost diamond `0xE8addD62feD354203d079926a8e563BC1A7FE81e`, deployer = hardhat signer0
- `.github/workflows/tests.yml:1-8, 85` (Hardhat-only CI) and `.github/workflows/security-audit.yml:8` (STATE.md ledger precedent)
- `.planning/PROJECT.md:11`, `.planning/ROADMAP.md:25-41`, `.planning/RETROSPECTIVE.md:26,41` — baseline re-point targets + stale-baseline failure mode
- Blast-radius greps: `evm_snapshot`/`initialSnapshotId`/`LocalDiamondDeployer`/`SetSeedSupply`/`setChainID`/`vm.skip` across test/

### Empirical (HIGH confidence — executed this session)
- Scratch forge project on the installed forge 1.7.1 (`/tmp/skipsem`): reverting setUp = 1 failed/contract; vm.skip in setUp = 1 skipped/contract

## Metadata

**Confidence breakdown:**
- Blast radius / scaffold enumeration: HIGH — every file grepped and the key files read at line level
- Contract revert conditions / helper design: HIGH — verified against facet source
- TEST-05 target + adjacency: HIGH — full file read; grant/revoke surfaces read; only soundness hole confirmed
- TEST-06 mechanics + skip arithmetic: HIGH — setUp heads read; vm.skip availability confirmed; counting semantics empirically verified
- Proof commands: HIGH — wrapper task source read end-to-end (wall-time only: LOW, flagged A1)
- Ledger re-point targets: HIGH — exact stale lines located

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 (stable domain — test harness; re-verify forge version if the toolchain changes)
