---
phase: 10-lock-release-bridge-vault
plan: 03
subsystem: testing
tags: [bridge, threshold-ecdsa, merkle-proof, eip-191, hardhat, mocha, chai, ethers-v6]

dependency_graph:
  requires:
    - phase: 10-lock-release-bridge-vault
      provides: "GNUSBridge.bridgeIn + setValidatorSet (Plan 10-02) and GNUSBridgeValidatorStorage (Plan 10-01)"
  provides:
    - "test/utils/bridge-certificate.ts — signBridgeInCertificate, aggregateCertificate, buildValidatorMerkleTree, computeBridgeInStructHash, BridgeInMessage type"
    - "test/unit/GNUSBridgeIn.test.ts — 20 it blocks covering every bridgeIn revert path and happy path"
    - "Canonical cross-repo test vector logged for SG-side SignEVM verification (Pitfall 1 / Pitfall 3 mitigation)"
  affects:
    - Plan 10-04 (Foundry invariant tests reuse the merkle + signing conventions from the helper module)
    - Phase 12 (in-flight accounting may add bridgeIn-adjacent test cases here)
    - SuperGenius repo (SignEVM C++ implementation must byte-match the canonical vector logged by this suite)

tech-stack:
  added: []
  patterns:
    - "Off-chain EIP-191 certificate construction (compute structHash, signMessage, aggregate by recovered address ascending)"
    - "OpenZeppelin-compatible keccak256 merkle tree over abi.encodePacked(address) leaves (20-byte packed, Pitfall 3)"
    - "Sorted-sig-to-parallel-proof mapping via ethers.recoverAddress on the EIP-191 digest"
    - "Diamond chainID aliasing in tests (setChainID to live Hardhat chainid so bridgeIn's D-08 guard passes)"

key-files:
  created:
    - test/utils/bridge-certificate.ts
    - test/unit/GNUSBridgeIn.test.ts
  modified: []

key-decisions:
  - "Helper accepts BaseWallet (not Wallet) so HDNodeWallet from Wallet.createRandom type-checks — signMessage lives on BaseWallet in ethers v6"
  - "Merkle tree builder tracks member SETS per internal node (not a single inherited leaf index) so every descendant leaf receives the sibling append when its ancestor merges — fixes an early draft that produced incomplete proofs for right-subtree leaves"
  - "Test suite aliases GeniusDiamond.chainID to the live Hardhat chainid (31337) via setChainID in before() — bridgeIn's require(block.chainid == chainID) is the D-08 cross-chain guard, and it must pass for happy-path tests while still being exercised by the wrong-chain revert test"
  - "Validator keys are freshly generated via Wallet.createRandom() per suite run (no relationship to Hardhat accounts); the merkle root is derived from the resulting addresses at suite boot, so tests are self-contained"
  - "Global-cap test uses amount = GNUS_MAX_SUPPLY + 1 directly (no need to seed globalSupply near the cap — the require fires on the very first bridgeIn)"
  - "chainSupply is not exposed via a public reader on the diamond ABI — suite asserts only the observable totalSupplyOfAll delta; per-chain partition is covered by Foundry invariant tests in Plan 10-04 (documented inline)"

patterns-established:
  - "Bridge-certificate test scaffold: buildCertificate helper computes structHash, signs with N wallets, sorts by recovered address, returns parallel proofs — reusable by Plan 10-04 Foundry tests"
  - "Cross-diamond / wrong-chain revert tests: override exactly one digest field (diamondAddress OR destChainID) and assert generic revert — do not pin the exact string since either 'Bad signature' or 'Not a registered validator' is acceptable evidence of digest mismatch"

requirements-completed:
  - BRIDGE-02
  - BRIDGE-03
  - BRIDGE-04

metrics:
  duration_seconds: 666
  completed_date: "2026-08-17"
---

# Phase 10 Plan 03: bridgeIn Unit Test Suite + Certificate Helper Summary

**Off-chain EIP-191 certificate helper module (sign / aggregate / merkle-tree) plus a 20-test Hardhat suite covering every `bridgeIn` and `setValidatorSet` revert path, the happy path with fee + cap accounting, the D-18 manual Super Admin regression, and the canonical cross-repo test vector for SG-side `SignEVM` verification.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-17T23:22:59Z
- **Completed:** 2026-08-17T23:34:05Z
- **Tasks:** 2
- **Files created:** 2 (test/utils/bridge-certificate.ts, test/unit/GNUSBridgeIn.test.ts)

## Accomplishments

- **`test/utils/bridge-certificate.ts`** — pure utility module exporting `BridgeInMessage`, `computeBridgeInStructHash`, `signBridgeInCertificate`, `aggregateCertificate`, and `buildValidatorMerkleTree`. Uses `ethers.AbiCoder.defaultAbiCoder().encode` with the seven-field type list that matches `_bridgeInDigest` in GNUSBridge.sol; never manually prepends the EIP-191 prefix (Pitfall 1); builds merkle leaves with `solidityPacked(['address'], ...)` (20-byte packed, Pitfall 3); sorts hash pairs before combining per OZ `_hashPair`.
- **`test/unit/GNUSBridgeIn.test.ts`** — 20 `it` blocks across 6 `describe` groups. All 7 plan-required exact revert strings asserted (`'GNUSControl: contract paused'`, `'Message already processed'`, `'Signers not strictly ascending'`, `'Not a registered validator'`, `'Below threshold'`, `'Validator set not configured'`, `'Only SuperAdmin allowed'`). Both events asserted via `.to.emit(geniusDiamond, 'BridgeReleased')` and `.to.emit(geniusDiamond, 'ValidatorSetUpdated')`. Raw `evm_snapshot`/`evm_revert` isolation per project standard — no `loadFixture`, no `setTimeout`.
- **Canonical cross-repo test vector** — hardcoded Hardhat account #0 private key signs a fixed `BridgeInMessage`; structHash, EIP-191 digest, signature, signer, and merkle leaf are `console.log`'d for the SuperGenius-side C++ `SignEVM` implementation to byte-match. Closes Pitfall 1 / Pitfall 3 mitigation.
- **D-18 regression coverage** — explicit `it` block asserting the existing 2-arg `mint(address,uint256)` path still works for Super Admin alongside the new certificate path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test/utils/bridge-certificate.ts helper module** - `c776c20` (feat)
2. **Task 2: Create test/unit/GNUSBridgeIn.test.ts unit suite** - `11eccca` (test)

**Plan metadata:** _pending — will be added by final metadata commit_

## Files Created/Modified

- `test/utils/bridge-certificate.ts` — EIP-191 certificate signer, aggregator/sorter, OZ-compatible merkle-tree builder. Pure module, no Hardhat network calls.
- `test/unit/GNUSBridgeIn.test.ts` — 20-test unit suite against Plan 10-02's production code. Includes canonical test vector logger.

## Decisions Made

- **Helper parameter type widened to `BaseWallet`.** `Wallet.createRandom()` returns `HDNodeWallet`, which extends `BaseWallet` but not `Wallet`. Since `signMessage` lives on `BaseWallet` (ethers v6), widening the helper signature is the minimal-change fix — no callers are affected, and the helper remains compatible with both `Wallet` (from a raw private key) and `HDNodeWallet` (from `createRandom`).
- **Diamond `chainID` aliased to live chainid in test setup.** `bridgeIn` requires `block.chainid == GNUSControlStorage.layout().chainID` (D-08). Setting `setChainID(31337n)` in `before()` lets happy-path certificates pass while the wrong-chain test exercises the digest mismatch path by overriding `destChainID` off-chain.
- **Global-cap test uses `amount = GNUS_MAX_SUPPLY + 1`.** No need to seed `globalSupply` near the cap — `_mintWithBridgeFee` fires the require on the very first bridgeIn when the amount alone exceeds the cap. Simpler and faster than the plan's optional "seed near cap" fallback.
- **`chainSupply` assertion dropped in favor of `totalSupplyOfAll`.** `GNUSTreasury` does not expose a public `chainSupply(chainId)` reader. The two writes happen in the same `_mintWithBridgeFee` block (GNUSBridge.sol:130-132), so the observable global delta is sufficient evidence. Per-chain partition is covered by Foundry invariant tests in Plan 10-04 (noted inline in the test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Merkle-tree builder produced incomplete proofs for right-subtree leaves**
- **Found during:** Task 2 (running the happy-path test with 3 validators)
- **Issue:** The initial `buildValidatorMerkleTree` tracked only a single "inherited leaf index" per internal node. When two nodes merged, only the left-child's leaf index received the new sibling — leaves in the right child's subtree never had the sibling appended. Result: `proofs.get(validator2.address)` and `proofs.get(validator3.address)` were missing one hash, so on-chain `MerkleProofUpgradeable.verify` reverted with `'Not a registered validator'` even for legitimate validators.
- **Fix:** Replaced single-index tracking with per-node member-set tracking (`levelMembers: number[][]`). When two nodes merge, every leaf in the left child's member set gets the right sibling appended, and vice versa. This is the standard OZ merkle-tree algorithm.
- **Files modified:** `test/utils/bridge-certificate.ts`
- **Verification:** Full test suite runs clean — all 20 tests pass, including the 3-validator happy path which exercises the right-subtree proof path.
- **Committed in:** `11eccca` (rolled into the Task 2 commit since the helper was created in Task 1 and the bug only manifested under test)

**2. [Rule 3 - Blocking] `ethers.Wallet` type namespace unresolved under `tsc --noEmit`**
- **Found during:** Task 1 (acceptance criterion `npx tsc --noEmit test/utils/bridge-certificate.ts`)
- **Issue:** `import { ethers } from 'hardhat'` imports the Hardhat runtime object, not a TypeScript namespace. Using `ethers.Wallet` as a type annotation fails under `tsc --noEmit` with `TS2503: Cannot find namespace 'ethers'`.
- **Fix:** Added `import type { BaseWallet } from 'ethers'` and used `BaseWallet` as the parameter type. Also satisfies the `HDNodeWallet` return from `Wallet.createRandom()` in the test file.
- **Files modified:** `test/utils/bridge-certificate.ts`
- **Verification:** `npx tsc --noEmit` clean on the full project.
- **Committed in:** `c776c20` (rolled into Task 1 commit)

**3. [Rule 3 - Blocking] `diamond-typechain-types` did not expose `bridgeIn` / `setValidatorSet`**
- **Found during:** Task 2 (writing the test file)
- **Issue:** Plan 10-02 modified `contracts/gnus-ai/GNUSBridge.sol` but did not regenerate the diamond ABI + TypeScript types. `import { GeniusDiamond } from '../../diamond-typechain-types'` had no `bridgeIn` or `setValidatorSet` members.
- **Fix:** Ran `yarn diamond:generate-proxy-abi-typechain`. Both files are gitignored so no commit needed — regenerated artifacts live in the working tree.
- **Files modified:** `diamond-abi/GeniusDiamond.json`, `diamond-typechain-types/*` (gitignored, not committed)
- **Verification:** `grep` confirms `bridgeIn`, `setValidatorSet`, `BridgeReleased` are present in the regenerated `GeniusDiamond.ts`. Test suite type-checks and runs.
- **Committed in:** N/A (gitignored build artifact)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 2 Rule 3 blocking)
**Impact on plan:** All auto-fixes were necessary for correctness — the merkle bug would have made the helper produce invalid proofs for any validator set larger than 2, and the two blocking issues prevented the test suite from compiling/running at all. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above. Test suite runtime is ~1s (well under the 30s budget).

## User Setup Required

None — no external service configuration required. The canonical test vector is captured in the test log output for the SuperGenius team to consume when implementing `SignEVM` in C++.

## Next Phase Readiness

- Plan 10-04 (Foundry invariant tests) can now proceed. The merkle helper + signing pattern established here is the reference for the Foundry-side certificate construction.
- The canonical test vector logged by the suite is the byte-exact input for SG-side `SignEVM` verification (10-RESEARCH.md §"SuperGenius-Side EVM Envelope Signer").
- All 14 unit-test rows in 10-VALIDATION.md (10-01-01 .. 10-01-14) are now GREEN.
- No blockers.

## Self-Check: PASSED

- `test/utils/bridge-certificate.ts` exists on disk (verified via `ls` in Task 1 acceptance)
- `test/unit/GNUSBridgeIn.test.ts` exists on disk (verified via `ls` in Task 2 acceptance)
- Commit `c776c20` (Task 1) exists: `git log --oneline -3` shows `c776c20 feat(10-03): add bridge-in certificate test helper module`
- Commit `11eccca` (Task 2) exists: `git log --oneline -1` shows `11eccca test(10-03): add GNUSBridge bridgeIn + setValidatorSet unit test suite`
- All 20 tests pass: `npx hardhat test test/unit/GNUSBridgeIn.test.ts` exits 0 with `20 passing (1s)`
- `npx tsc --noEmit` clean on both new files
- Canonical test vector output captured in test log (see "cross-repo test vector" section above)

---
*Phase: 10-lock-release-bridge-vault*
*Completed: 2026-08-17*
