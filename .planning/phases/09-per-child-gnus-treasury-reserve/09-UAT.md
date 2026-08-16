---
status: partial
phase: 09-per-child-gnus-treasury-reserve
source:
  - 09-01-SUMMARY.md
  - 09-02-SUMMARY.md
  - 09-03-SUMMARY.md
  - 09-04-SUMMARY.md
  - 09-05-SUMMARY.md
started: 2026-08-16T03:10:21Z
updated: 2026-08-16T03:10:21Z
---

## Current Test

[testing complete]

## Tests

### 1. Conversion-native mint path (beforeMint 1:1 + depth gate)
expected: `npx hardhat test test/unit/GNUSTreasury.test.ts` green; factory mints burn caller's id-0 minions 1:1; deep mints revert at D6 depth gate and route through convert.
result: pass

### 2. GNUSBridge rewiring (withdraw deleted, MINTER id-0 only, cap)
expected: `grep -c "function withdraw" contracts/gnus-ai/GNUSBridge.sol` returns 0; 3-arg mint reverts "MINTER_ROLE mints GNUS only" for non-zero id; global cap enforced on GNUS-terminal mints; bridgeOut charges limiter with amount directly (no exchangeRate division).
result: pass

### 3. Per-chain provenance redesign (SetSeedSupply + setSisterChainSupply)
expected: GNUSTreasury_Initialize260 (no-arg) records block.chainid; GNUSTreasury_SetSeedSupply(uint256) is a one-shot DEFAULT_ADMIN seeder flipping provenanceInitialized; setSisterChainSupply(uint256[],uint256[]) emits SisterChainSupplyUpdated; mint/burn maintain chainSupply[block.chainid].
result: pass

### 4. Test migration to convert() (withdraw-era suites)
expected: The 5 withdraw-driven files (GNUSBridge, GNUSBridgeEnhanced, GNUSWithdrawLimiterStorage, withdraw-limiter-integration, withdraw-limiter-gas-comparison) and the 2 mint-semantics files (NFTFactory, GNUSNFTFactoryEnhanced) each pass `npx hardhat test <file>` individually with `.withdraw(` count 0 in active code.
result: pass

### 5. Foundry conservation invariants (I1/I2/I5)
expected: `forge test --match-contract ConservationInvariant` passes 4/4 — I1 conservation, I2 convert-neutral, I5 global cap, convert-call-count monotonic.
result: blocked
blocked_by: other
reason: "diamonds-forge:test deployment fails with HH701 'multiple artifacts for contract GeniusDiamond' (contracts/gnus-ai/GeniusDiamond.sol vs diamond-abi/GeniusDiamond.sol). Tooling/artifact-qualification issue, not the invariant logic. Raw `forge test` also fails setUp with 'Diamond has no code' — needs live localhost diamond via the diamonds-forge harness."
result_note: "Invariant source verified: 4 invariant functions present in ConservationInvariant.t.sol. SUMMARY records 4/4 PASS at phase-completion time (2026-08-05)."

### 6. Full suite green + safe/rpc latent-bug repair
expected: bare `npx hardhat test` runs the full suite green (458 passing, 0 failing) INCLUDING the subdirectory suites test/unit/safe/ and test/unit/rpc/ (proposeSafeTransaction, RPCDiamondDeployer).
result: pass

## Summary

total: 6
passed: 4
issues: 0
pending: 1
skipped: 0
blocked: 1

## Gaps

[none yet]
