---
phase: 13-time-bound-erc1155-entitlements
plan: 06
subsystem: testing
tags: [erc1155, transfer-policy, bridge, soulbound, expiration, eip-2535, hardhat]

requires:
  - phase: 13-time-bound-erc1155-entitlements
    provides: "13-04 single-predicate GNUSLifecyclePolicy library + linking harness; 13-05 settlement + lazy linker via extendEnvironment"
provides:
  - "GNUSBridge._enforceBridgePolicy — bridgeOut honors TransferPolicy (D7/SC4)"
  - "Bridge policy test matrix incl. limiter-not-charged-on-revert ordering proof"
  - "AI Credits end-to-end product tests (SC7/D11) + Phase 13 selector-collision loupe assertion"
  - "Signer-honoring lazy library linker for production RPC/Safe deploy paths"
affects: [phase-14-private-network-ai-licensing, bridge, deployment]

tech-stack:
  added: []
  patterns:
    - "Sender-side ALLOWLISTED bridge check (Q4 v1) against per-token registry"
    - "Policy gate placed before withdrawal-limiter charge so reverted bridges consume no allowance"

key-files:
  created:
    - test/unit/GNUSBridgePolicy.test.ts
    - test/unit/GNUSLifecycleAICredits.test.ts
  modified:
    - contracts/gnus-ai/GNUSBridge.sol
    - scripts/utils/GNUSLifecyclePolicyLinking.ts

key-decisions:
  - "v1 bridge policy simplification: SOULBOUND/ISSUER_ONLY/CONTROLLED_RESALE hard-revert; LOCKED_AFTER_START reverts only when validFrom != 0 && block.timestamp >= validFrom; ALLOWLISTED checks the SENDER against the per-token registry (Q4)"
  - "AI Credits SKU uses explicit maxSupply (1M) — plan's maxSupply=0-as-unlimited is stale: the max-supply hook runs after ERC1155Supply's increment, so 0 permits no mints"
  - "Production linker fix is minimal: when the intercepted getContractFactory call carries a signer, deploy GNUSLifecyclePolicy WITH that signer so the library lands on the RPC target network"

patterns-established:
  - "Ordering proof pattern: warm the withdrawal limiter with a successful bridge, then assert a policy-bound revert leaves usage unchanged"
  - "Selector-collision assertion: iterate facetAddresses/facetFunctionSelectors and require each Phase 13 selector exactly once"

requirements-completed: [SC4, SC7]

duration: 170min
completed: 2026-08-24
---

# Phase 13 Plan 06: Bridge Policy Gate + AI Credits E2E Summary

**GNUSBridge.bridgeOut now enforces per-token TransferPolicy via a single internal gate placed before the withdrawal-limiter charge, with a 7-test policy matrix, a 7-test AI Credits end-to-end suite (SOULBOUND/BURN/PerHolder zero-credit economics), a loupe selector-collision assertion, and a signer-honoring production library-linking fix.**

## Performance

- **Duration:** ~170 min
- **Completed:** 2026-08-24
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments
- `GNUSBridge.sol`: added `_enforceBridgePolicy(address,uint256) internal view` + one call site after the four existing requires, BEFORE the limiter-charge block. GNUS_TOKEN_ID and UNRESTRICTED bridge freely; ALLOWLISTED checks sender against per-token registry; LOCKED_AFTER_START reverts only post-start; other policies revert "Policy-bound token cannot bridge in v1".
- `GNUSLifecycleAICredits.test.ts`: full AI Credits product flow (createNFTWithLifecycle D11 config, treasury-direct purchase, spend-burn, permissionless settleExpired, zero-credit conservation, SOULBOUND transfer/bridge blocks, 11-selector exactly-once loupe assertion).
- `GNUSLifecyclePolicyLinking.ts`: production deploy paths (RPCDiamondDeployer / BaseDeploymentStrategy `getContractFactory(name,{signer})`) now get the library deployed WITH the intercepted signer instead of the HRE default network (minimal fix; no deployment-script restructuring).

## Bytecode (measured from artifacts)
- GNUSBridge deployedBytecode before: **21,945 B** (docs' 21,797/21,635 were stale)
- GNUSBridge deployedBytecode after: **22,711 B** (+766) — 1,865 B headroom under EIP-170's 24,576 B limit.

## Task Commits
1. **Task 1: bridge transfer-policy gate** — submodule `contracts/gnus-ai` @ `70edadc` (feat)
2. **Task 2: GNUSBridgePolicy.test.ts (7 tests)** — outer `319a192` (test)
3. **Task 3: GNUSLifecycleAICredits.test.ts (7 tests)** — outer `9bfe1d9` (test)
4. **Additional deliverable: production linking fix** — outer `b0d5afb` (fix)
5. **Plan metadata** — docs commit (this file + STATE/ROADMAP)

## Files Created/Modified
- `contracts/gnus-ai/GNUSBridge.sol` — `_enforceBridgePolicy` + call site (+3 imports)
- `test/unit/GNUSBridgePolicy.test.ts` — 7 bridge-policy tests (SC4/D7)
- `test/unit/GNUSLifecycleAICredits.test.ts` — 7 AI Credits E2E tests (SC7/D11)
- `scripts/utils/GNUSLifecyclePolicyLinking.ts` — `deployAndLinkLifecyclePolicyWithSigner` + lazy-branch signer routing

## Test Results
- `GNUSBridgePolicy.test.ts`: **7 passing** (incl. limiter-not-charged ordering proof)
- `GNUSLifecycleAICredits.test.ts`: **7 passing** (incl. selector-collision loupe)
- Full Hardhat regression (`npx hardhat test`): **564 passing / 2 pending / 1 failing** — the 1 failure is the known-stale `GNUSControlStorage` chainID cross-suite pollution (unchanged from the current 550/2/1 baseline + 14 new tests). Delta: +14, zero new failures.
- Foundry regression (`yarn forge:test` vs local anvil): **215 passed / 2 failed / 3 skipped** — identical to the documented baseline; the 2 failures are the known Phase 08.1 Safe-proposer setUp reverts. Zero new failures.

## Decisions Made
- Q4 v1 sender-side ALLOWLISTED semantics implemented as planned (registry configured + isAllowed(sender)).
- LOCKED_AFTER_START pre-start test uses post-mint `setValidFrom` (D4 mutator) since the mint window blocks pre-start minting.
- AI Credits maxSupply set to an explicit 1M cap (see Deviation 1).
- Zero-credit conservation proven via `totalSupply` sums; `totalSupplyOfAll` asserted UNCHANGED (it is the cumulative cross-chain provenance counter, never decremented by burns).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's maxSupply=0-as-unlimited is stale**
- **Found during:** Task 3 (AI Credits purchase)
- **Issue:** `GNUSERC1155MaxSupply._beforeTokenTransfer` calls super (supply increment) BEFORE the max check, so maxSupply=0 permits no mints.
- **Fix:** Explicit `AI_CREDITS_MAX_SUPPLY = toWei('1000000')` named constant with explanatory comment.
- **Committed in:** `9bfe1d9`

**2. [Rule 2 - Missing Critical] Production linker would deploy library to the wrong network**
- **Found during:** Additional deliverable (production-linking investigation)
- **Issue:** extendEnvironment lazy linker intercepts production factory calls, but its library deploy used `hre.ethers.getSigners()` — under RPC ts-node entry points that deploys to the HRE default network, linking production facets against a library address absent from the target chain.
- **Fix:** When the intercepted call carries a signer, deploy the library with that signer (`deployAndLinkLifecyclePolicyWithSigner`). tsc clean; 28 tests across the three linking-dependent suites pass.
- **Committed in:** `b0d5afb`

**3. [Rule 3 - Blocking] Stale/inconsistent generated typechain blocked full regression**
- **Found during:** Verification (full `npx hardhat test`)
- **Issue:** `Cannot find module './GeniusDiamond__factory'` from `typechain-types/factories/diamond-abi/index.ts` — the two identical `generate-abi-typechain` runs in `yarn compile` left an index re-exporting a factory file that landed under `factories/contracts/gnus-ai/`. Generated, git-ignored output only.
- **Fix:** `yarn clean-compile` (documented full clean regeneration); suite then ran green.
- **Committed in:** nothing (generated artifacts are git-ignored)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All fixes required for correctness. No scope creep; GNUSBridge.sol change is exactly one internal function + one call site.

## Issues Encountered
- Stale plan baselines corrected: GNUSBridge base size measured 21,945 B (not 21,797/21,635); Hardhat baseline 550/2/1 (not 477/2/1); `settleExpired(address,uint256)` signature verified against diamond-abi before the selector test.

## User Setup Required
None.

## Next Phase Readiness
- Phase 13 complete: **6/6 plans**. Wave 4 closed. Next per ROADMAP: Phase 14 (Private-Network AI Licensing); Phase 7 audit gate unblocked once Phases 10-14 land.

## Self-Check: PASSED
- Files exist: GNUSBridge.sol (submodule), both test suites, linker script.
- Commits found: 70edadc (submodule), 319a192, 9bfe1d9, b0d5afb (outer).

---
*Phase: 13-time-bound-erc1155-entitlements*
*Completed: 2026-08-24*
