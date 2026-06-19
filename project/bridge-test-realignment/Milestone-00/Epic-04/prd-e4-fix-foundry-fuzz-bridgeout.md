# PRD — Fix Foundry Fuzz bridgeOut (M0-E4)

> **Epic:** [e4-fix-foundry-fuzz-bridgeout](./overview/e4-fix-foundry-fuzz-bridgeout.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md) ·
> **Plan:** [project-plan §5 M0-E4](../../bridge-test-realignment-project-plan.md)
> **Status:** 📋 ready for `/generate-tasks` · **Author:** Am0rfu5 · **Date:** 2026-06-19

## 1. Introduction / Overview

The Foundry bridge fuzz suite, [BridgeFuzz.t.sol](../../../../../test/foundry/fuzz/BridgeFuzz.t.sol),
calls `bridgeOut` using the **interim `bytes`-based** signature
`bridgeOut(uint256,uint256,uint256,bytes)` (selector `0xf7587f7d`). That selector **no
longer exists** on the diamond — the current function is
`bridgeOut(uint256,uint256,uint256,bytes32,bool)`. Every low-level `diamond.call(...)`
therefore reverts, regardless of input. The consequences:

- `testFuzz_bridgeAmountEdgeCases` **fails** — it asserts `success == true`, but the call
  always reverts (failed on run 0).
- `testFuzz_RevertWhen_depositExceedsBalance` and `test_RevertWhen_InvalidDestinationKeyLength`
  are **false-greens** — they assert `success == false` and "pass," but only because the
  selector is missing, not because the contract logic rejected anything.
- `testFuzz_bridgeDeposit` has **no assertion** — it passes silently no matter what.

This feature migrates the suite to the current signature and makes every test assert a real,
intended outcome. It is a test-only change.

## 2. Goals

- **G1** — Every `bridgeOut` call uses `bridgeOut(uint256,uint256,uint256,bytes32,bool)`.
- **G2** — `testFuzz_bridgeAmountEdgeCases` passes against a **real** (existing) bridge call.
- **G3** — Negative tests assert the **specific** intended revert reason, not bare failure.
- **G4** — The happy-path test asserts observable effects (balance burned **and**
  `BridgeOutInitiated` emitted), not a silent no-op.
- **G5** — The obsolete `test_RevertWhen_InvalidDestinationKeyLength` is removed.
- **G6** — `yarn clean-compile && yarn forge:test` (with `anvil` running) reports 0 failing.

## 3. User Stories

- **As a developer,** I want the fuzz suite to call the real bridge, so a passing run
  actually means the bridge accepted/rejected the input — not that a selector was missing.
- **As a reviewer,** I want negative tests to assert *why* a call failed, so a future
  signature change can't turn them back into false-greens.

## 4. Functional Requirements

**Signature & fixtures**

1. The system must replace every `abi.encodeWithSignature("bridgeOut(uint256,uint256,uint256,bytes)", ...)`
   in `BridgeFuzz.t.sol` with the current 5-parameter form
   `bridgeOut(uint256 amount, uint256 id, uint256 destChainID, bytes32 sgnsDestination, bool destinationYOdd)`.
2. Destination arguments must come from the Foundry base constants added in M0-E3
   (`bytes32 SGNS_DESTINATION` + `bool SGNS_DESTINATION_Y_ODD`), replacing the 64-byte
   `bytes TEST_SGNS_DEST`.

**Assertion approach**

3. `bridgeOut` calls intended to succeed or to revert for a checkable reason must be made
   through a **typed interface** (not a raw `diamond.call`), so failures can be asserted
   precisely.
4. `testFuzz_RevertWhen_depositExceedsBalance` must use `vm.expectRevert` with the specific
   reason for an over-balance bridge (`"Insufficient tokens."`) rather than asserting a bare
   boolean.
5. `testFuzz_bridgeAmountEdgeCases` must call the real bridge for a valid bounded amount and
   pass because the bridge **accepted** it (mint sufficient balance first if needed).
6. `testFuzz_bridgeDeposit` must assert observable effects: the sender's token balance
   decreased by the bridged `amount` **and** a `BridgeOutInitiated` event was emitted (use
   `vm.expectEmit`; full 7-field arg matching is deferred to M1-E1).

**Cleanup**

7. The system must delete `test_RevertWhen_InvalidDestinationKeyLength` — a `bytes32`
   destination is fixed-length, so "wrong length" is unreachable.
8. After migration, `TEST_SGNS_DEST` must be unreferenced in `test/foundry`; its removal
   from the base is coordinated with M0-E3/M0-E4 (whichever lands last removes it).

**Verification**

9. `yarn clean-compile && yarn forge:test`, run against a live `anvil`, must report 0
   failing and the previously-failing fuzz test must pass for the right reason.

## 5. Non-Goals (Out of Scope)

- Full 7-field `BridgeOutInitiated` argument matching and broader guard coverage (M1).
- Standing up `anvil` itself — that is an environment prerequisite (owner gate OP-1), not a
  code task.
- Any production contract change.
- Adding new fuzz dimensions beyond repairing the existing tests.

## 6. Technical Considerations

- **Dependency:** M0-E3 must add the Foundry `bytes32`/`bool` constants first.
- **Owner gate (OP-1, blocking):** a running `anvil` instance is required to verify
  `yarn forge:test`; without it the suite cannot execute against the diamond.
- **Typed interface:** define or reuse an interface exposing
  `bridgeOut(uint256,uint256,uint256,bytes32,bool)` so `vm.expectRevert`/`vm.expectEmit`
  attach to a typed call; the base (`GeniusDiamondTestBase`) already provides `diamond`,
  `_mintGNUS`, `_getGNUSBalance`, and `GNUS_TOKEN_ID`.
- **Balance setup:** edge-case and happy-path tests must ensure the sender holds enough
  tokens before bridging (mint via `_mintGNUS`).
- **Same-chain guard:** use a `destChainID` `!=` the local anvil chain id (the M0-E3
  canonical value).

## 7. Success Metrics

- Foundry suite: 0 failing; the prior 1 failing fuzz test now green for the right reason.
- The two former false-greens now fail if the *intended* revert reason changes (verified by
  the specificity of `vm.expectRevert`).
- `testFuzz_bridgeDeposit` fails if the balance isn't burned or the event isn't emitted
  (no silent-pass path remains).
- No `encodeWithSignature("bridgeOut(...,bytes)")` and no `TEST_SGNS_DEST` reference remain.

## 8. Open Questions

- Where to declare the typed `bridgeOut` interface — a shared test interface file vs inline
  in the base? *Default: add it to the Foundry base/test interfaces alongside existing
  helpers.* Resolve during `/generate-tasks`.
