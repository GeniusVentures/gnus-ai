---
phase: 09-per-child-gnus-treasury-reserve
plan: 04
subsystem: smart-contracts
tags: [diamond, eip2535, erc1155, treasury, conversion-native, hardhat, ethers-v6]

requires:
  - phase: 09-per-child-gnus-treasury-reserve (plans 09-01..09-03)
    provides: GNUSTreasury facet, convert() supply-neutral reallocation, GNUSBridge provenance hooks + global cap, NFT struct v3.0 fields (parentId, nonConvertible)
provides:
  - beforeMint rewritten to 1:1 minion burn with D6 depth gate (direct children only)
  - Diamond config at protocolVersion 3.0 with GNUSTreasury registered at priority 117
  - Full GNUSTreasury unit suite — 15 suites, 31 passing assertions, zero skips
  - GeniusDiamondChainB test mock enabling two-diamond cross-chain fixtures
affects: [09-05-test-migration, deployment-runbook, phase-13]

tech-stack:
  added: []
  patterns:
    - "ownerMintChild helper: factory mints burn caller's id-0, so tests fund owner then mint child to recipient"
    - "Library-declared events (SuperAdminBypass) asserted via raw log topic, not chai .to.emit (absent from proxy ABI)"
    - "hardhat_setStorageAt for struct-field simulation (nonConvertible flips, legacy record decode, rate=0)"
    - "Two-diamond fixture: thin name-matching mock contract + explicit diamonds.paths entry + attach via generated diamond-abi JSON"

key-files:
  created:
    - gnus-ai/contracts/mocks/GeniusDiamondChainB.sol
    - gnus-ai/contracts/gnus-ai/.gitignore (cache_hardhat ignore)
  modified:
    - gnus-ai/contracts/gnus-ai/GNUSNFTFactory.sol (beforeMint rewrite — submodule 10ff27e)
    - gnus-ai/diamonds/GeniusDiamond/geniusdiamond.config.json (3.0 registration — submodule 919ee4c, f249ade)
    - gnus-ai/test/unit/GNUSTreasury.test.ts (full suite)
    - gnus-ai/hardhat.config.ts (GeniusDiamondChainB path entry)

key-decisions:
  - "beforeMint burns exactly `amount` id-0 minions (D1); exchangeRate never referenced in mint path (D2 display-only)"
  - "D6 depth gate is an unconditional require in beforeMint — descendants route through GNUSTreasury.convert"
  - "GNUSTreasury deployInit/upgradeInit left EMPTY in diamond config (tooling cannot pass args); signature preserved in custom deployInitSignature/upgradeInitSignature fields; tests call GNUSTreasury_Initialize300(seed) explicitly post-deploy"
  - "DiamondInitFacet version key is \"3\" not \"3.0\" — protocolInitFacet lookup stringifies protocolVersion to a JS number"
  - "GNUSNFTFactory 3.0 entry carries deployInit/upgradeInit GNUSNFTFactory_Initialize230() — otherwise NFTs[0] is never created on fresh 3.0 deploys"
  - "Chain B fixture attaches via generated diamond-abi/GeniusDiamond.json ABI (identical facet set) instead of generating a second ABI artifact"

patterns-established:
  - "Caller-funded factory mints: beforeMint burns from _msgSender, so any test minting a child must fund the caller with id-0 first"
  - "Cap-at-limit test setup: fund owner first, then mint cap-minus-funding to user, keeping counter exactly at cap while leaving burn funding available"

requirements-completed: [TREASURY-01, TREASURY-02, TREASURY-03, TREASURY-04]

duration: 3h 10m
completed: 2026-08-05
---

# Phase 9 Plan 04: beforeMint Rewrite + Diamond Config 3.0 + GNUSTreasury Suite Summary

**Conversion-native mint path is live: factory mints burn id-0 minions 1:1 behind a direct-children-only depth gate, the diamond runs protocolVersion 3.0 with GNUSTreasury registered, and the treasury behavior is pinned by 31 passing assertions across 15 suites.**

## Performance

- **Duration:** ~3h 10m (incl. debugging tooling initializer limitations)
- **Completed:** 2026-08-05
- **Tasks:** 3/3
- **Files modified:** 5 (+1 created mock, +1 submodule .gitignore)

## Accomplishments

- `beforeMint` rewritten: deletes the `amount * exchangeRate` conversion, burns exactly `amount` minions of GNUS from the caller, enforces the D6 depth gate (`(id >> 128) == GNUS_TOKEN_ID`), zero `exchangeRate`/`convAmount` references in the function body; deployed bytecode 23,417 B (under the 24,576 B limit).
- Diamond config at protocolVersion 3.0: GNUSTreasury at priority 117, GNUSBridge 3.0 (fromVersions [0.0, 2.4, 2.5]), GNUSNFTFactory 3.0 (fromVersions [0.0, 2.0, 2.3]).
- GNUSTreasury.test.ts: all 13 stub suites from 09-01 implemented plus the two revision-added suites (`legacy decode`, `upgrade init seed`) — 15 suites, 31 passing, 0 `it.skip`, 0 sleep-style hacks (snapshot/revert isolation only). Covers both convert directions, child-to-child zero-charge, deep single-hop, full revert matrix (incl. nonConvertible src/dst via `hardhat_setStorageAt`), loupe selector absence + stale-calldata revert, provenance seed/sync/re-init, two-diamond cross-chain convergence under B1, global cap (exact-50M, cap+1, convert-never-capped, Pitfall 3 post-fee increment), display floor rounding + revert matrix, Pitfall 2 counter-untouched, MINTER id-0 restriction, and per-id minion cap.

## Task Commits

1. **Task 1: beforeMint rewrite** — `10ff27e` (contracts/gnus-ai submodule, feat)
2. **Task 2: diamond config 3.0** — `919ee4c` + `f249ade` (diamonds/GeniusDiamond submodule, feat + fix)
3. **Supporting: submodule gitignore** — `f37e19a` (contracts/gnus-ai submodule, chore)
4. **Task 3: full GNUSTreasury suite** — `653f056` (outer gnus-ai, test) — includes hardhat.config.ts, GeniusDiamondChainB mock, submodule pointer bumps
5. **Submodule pointer bump** — `dc89da6` (outer gnus-ai, chore)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Diamonds tooling cannot pass args to initializers**
- **Found during:** Task 3 fixture bring-up
- **Issue:** `BaseDeploymentStrategy.js` line 414 invokes `initContract[initFunction]()` with NO arguments; `GNUSTreasury_Initialize300(uint256)` crashed deployment with "fragment inputs doesn't match arguments".
- **Fix:** Emptied `deployInit`/`upgradeInit` for GNUSTreasury 3.0 in geniusdiamond.config.json; preserved the real signature in custom `deployInitSignature`/`upgradeInitSignature` fields (tooling ignores unknown fields, runbook retains the signature). Tests call `GNUSTreasury_Initialize300(seed)` explicitly post-deploy.
- **Files modified:** diamonds/GeniusDiamond/geniusdiamond.config.json
- **Commit:** 919ee4c

**2. [Rule 3 - Blocking] protocolInitFacet version-key stringification mismatch**
- **Found during:** Task 3 ("missing role MINTER_ROLE" on every mint)
- **Issue:** `protocolVersion: 3.0` parses to JS number 3; the tooling's strict `versions[protocolVersion]` lookup stringifies to `"3"`, so a `"3.0"` key never matches and `diamondInitialize250()` silently never ran.
- **Fix:** Added `"3"` version key (not `"3.0"`) to DiamondInitFacet with deployInit/upgradeInit `diamondInitialize250()` and fromVersions [0.0, 2.2, 2.3, 2.4, 2.41, 2.5].
- **Files modified:** diamonds/GeniusDiamond/geniusdiamond.config.json
- **Commit:** f249ade

**3. [Rule 3 - Blocking] GNUSNFTFactory 3.0 had no init hook**
- **Found during:** Task 3 ("Max Supply for NFT would be exceeded" on root mints)
- **Issue:** The new 3.0 version became the max deployed version; with no deployInit, `GNUSNFTFactory_Initialize230()` never ran and NFTs[0] was never created.
- **Fix:** Added `deployInit`/`upgradeInit: GNUSNFTFactory_Initialize230()` to the 3.0 entry.
- **Files modified:** diamonds/GeniusDiamond/geniusdiamond.config.json
- **Commit:** f249ade

**4. [Rule 3 - Blocking] Diamonds tooling resolves the diamond contract artifact by diamond NAME**
- **Found during:** Task 3 cross-chain suite ("Artifact for contract GeniusDiamondChainB not found")
- **Issue:** A second logical diamond instance (`GeniusDiamondChainB`) requires a name-matching artifact; `getDiamondContractName` has no alias hook for it.
- **Fix:** Added `contracts/mocks/GeniusDiamondChainB.sol` (thin `is GeniusDiamond` alias, no behavior change) and a `GeniusDiamondChainB` entry in `diamonds.paths`; attached chain B via the generated `diamond-abi/GeniusDiamond.json` ABI since the facet set is identical.
- **Files modified:** contracts/mocks/GeniusDiamondChainB.sol (created), hardhat.config.ts, test/unit/GNUSTreasury.test.ts
- **Commit:** 653f056

**5. [Rule 1 - Bug] Test-side assertion corrections during suite bring-up**
- `SuperAdminBypass` is declared in the GNUSWithdrawLimiterStorage library, not a facet, so it is absent from the proxy ABI — chai `.to.emit` cannot see it. Asserted via raw log topic + ABI-decoded data (same pattern as Phase5-circuit-breaker.test.ts).
- Display floor test: `unitsOf` floors at WEI precision (balance*1e18/rate); dust case changed to +1 wei so floored units stay exactly 50e18.
- Counter-untouched test: factory mint burns the CALLER's id-0 — funding order changed (owner 100 + signer1 900) so the counter stays exactly 1000 across all steps.
- Cap test: funded owner BEFORE reaching the 50M cap (owner's id-0 mint is itself cap-checked).
- **Commit:** 653f056

### Auth Gates

None.

## Out-of-Scope Observations (09-05 migration scope, NOT fixed per plan)

Full-suite run: 408 passing / 50 failing / 2 pending. The 50 failures are the known exchange-rate/withdraw migration surface owned by Plan 09-05 (withdraw limiter integration, bridge fee on ERC1155 mints, NFT factory burn-rate assertions, ERC1155ProxyOperator transfer expectations, Safe proposer kit mocks). Task 1's beforeMint rewrite deliberately invalidated the old `amount * exchangeRate` burn assertions (e.g. NFTFactory.test.ts "Burnt Supply should equal minted * exchange rate") — these are precisely the tests 09-05 rewrites. GNUSTreasury.test.ts passes 31/31 and no previously-passing suite outside the 09-05 scope regressed.

## Self-Check

- `contracts/mocks/GeniusDiamondChainB.sol` — FOUND
- `test/unit/GNUSTreasury.test.ts` (15 describe suites, 31 passing, 0 skips) — FOUND
- Commits 10ff27e, 919ee4c, f249ade, f37e19a, 653f056, dc89da6 — all FOUND in git log
- `npx hardhat test test/unit/GNUSTreasury.test.ts` — exits 0 (31 passing)

## Self-Check: PASSED
