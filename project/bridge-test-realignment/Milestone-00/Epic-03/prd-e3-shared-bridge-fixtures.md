# PRD — Shared Bridge Test Fixtures (M0-E3)

> **Epic:** [e3-shared-bridge-fixtures](./overview/e3-shared-bridge-fixtures.md) ·
> **Milestone:** [M0 — Green Baseline](../overview/milestone-01-green-baseline.md) ·
> **Plan:** [project-plan §5 M0-E3](../../bridge-test-realignment-project-plan.md)
> **Status:** 📋 ready for `/generate-tasks` · **Author:** Am0rfu5 · **Date:** 2026-06-19

## 1. Introduction / Overview

The GNUS test suite has the same bridge constants — the SuperGenius (SGNS) destination
key, its Y-parity, the destination chain id, and the GNUS token id — **copy-pasted into
multiple test files**. When the `bridgeOut` contract signature changed, only one file
(`GNUSBridgeEnhanced.test.ts`) was updated; the Hardhat gas test and the Foundry fuzz
suite were left behind on stale signatures and broke. That divergence is the root cause of
this whole milestone's failures.

This feature creates **one shared source of truth per test runner** for bridge constants:
a TypeScript fixture for Hardhat tests and a constants block on the Foundry test base. From
then on, a bridge signature or value change is a **single-file edit**, not a hunt across
the suite.

This is a **test-infrastructure** change. It touches no production contract code and
changes no test's behavior — only where its constants come from.

## 2. Goals

- **G1** — A single TypeScript module exports every bridge constant Hardhat tests need.
- **G2** — The Foundry test base exposes the matching constants in the new
  `bytes32` + `bool` shape, replacing the obsolete 64-byte `bytes` destination.
- **G3** — Constant values are **identical** to those in today's passing tests, so no test
  changes behavior as a result of this refactor (zero regressions).
- **G4** — The three known bridge test sites import from the shared fixtures with **no
  inline duplicate literals** remaining.
- **G5** — A future signature/value change requires editing **one file per runner**.

## 3. User Stories

- **As a developer changing the bridge interface,** I want to update the destination key
  or chain id in one place per runner, so a future change can't silently leave some tests
  on a stale signature.
- **As a developer writing a new bridge test,** I want to `import` the canonical fixtures,
  so I don't copy stale literals from another file.
- **As a reviewer,** I want a single, documented definition of `SGNS_DESTINATION` /
  `destChainID`, so I can verify a test uses the agreed values at a glance.

## 4. Functional Requirements

**TypeScript fixture (Hardhat)**

1. The system must provide a new file `test/utils/bridge-fixtures.ts`.
2. It must export `SGNS_DESTINATION` — the 32-byte (`bytes32`) X component of the SGNS
   destination key — with the **same value** currently used in `GNUSBridgeEnhanced.test.ts`
   (`ethers.zeroPadValue('0x1234', 32)`).
3. It must export `SGNS_DESTINATION_Y_ODD` — the boolean Y-parity — with the current value
   (`false`).
4. It must export `DEST_CHAIN_ID = 137` (Polygon) as the single canonical destination chain
   id for both runners. (137 is guaranteed `!=` the local Hardhat/anvil chain id, so
   `bridgeOut`'s same-chain guard is satisfied.)
5. It must **re-export** `GNUS_TOKEN_ID` from `scripts/common` so bridge specs get all four
   constants from one import. It must **not** redefine `GNUS_TOKEN_ID` with a new literal.

**Foundry fixture (base contract)**

6. The system must add to `test/foundry/base/GeniusDiamondTestBase.sol` a `bytes32` constant
   holding the **same** X value as the TS `SGNS_DESTINATION`, and a `bool` constant for the
   Y-parity (matching `SGNS_DESTINATION_Y_ODD`).
7. The system must **remove** the obsolete 64-byte `bytes public constant TEST_SGNS_DEST`
   once its consumers are migrated (consumer migration itself is M0-E4; this epic provides
   the replacement constants and removes `TEST_SGNS_DEST` when nothing references it).
8. The Foundry constants must carry a comment pairing them with the TS fixture so the two
   cannot silently drift.

**Refactor of known sites**

9. The system must update `GNUSBridgeEnhanced.test.ts` to import `SGNS_DESTINATION`,
   `SGNS_DESTINATION_Y_ODD`, and `DEST_CHAIN_ID` from `test/utils/bridge-fixtures.ts`,
   removing its inline definitions.
10. The scope of refactor is the **three known bridge sites only**: the gas test
    (`test/gas/withdraw-limiter-gas-comparison.test.ts`), `GNUSBridgeEnhanced.test.ts`, and
    the Foundry suite (`BridgeFuzz.t.sol` + base). Unrelated files must not be touched.
    _(Wiring the gas test and Foundry fuzz to the fixtures is completed in M0-E1 and M0-E4
    respectively; this epic must leave the fixtures ready and migrate `GNUSBridgeEnhanced`.)_

**Verification**

11. After the refactor, a search of the three known sites must find no inline
    `zeroPadValue('0x1234', 32)`, `SGNS_DESTINATION` literal, or `TEST_SGNS_DEST` definition
    outside the fixtures.
12. The full Hardhat suite (`npx hardhat test`) and Foundry suite
    (`yarn clean-compile && yarn forge:test` against a running `anvil`) must pass with pass
    counts **no lower** than before this epic.

## 5. Non-Goals (Out of Scope)

- Fixing the failing gas test call site (M0-E1) or the Foundry fuzz selectors/assertions
  (M0-E4) — this epic only provides the fixtures and migrates `GNUSBridgeEnhanced.test.ts`.
- Deepened conformance assertions — full 7-field event matching, destination-key edge
  cases, guard-reason coverage (M1).
- A repo-wide grep sweep of every test file for any bridge-ish literal (explicitly
  declined; known sites only).
- Any change to production contracts or to `scripts/common`'s `GNUS_TOKEN_ID` value.
- Standardizing non-bridge constants (roles, supply, actors) already on the Foundry base.

## 6. Technical Considerations

- **Existing source of truth:** `GNUS_TOKEN_ID` already lives in `scripts/common` (imported
  by `test/unit/NFTFactory.test.ts`). Re-export it — do not fork the value.
- **TS home:** `test/utils/` already holds `logger.ts`, `network-utils.ts`,
  `test-template.ts`; `bridge-fixtures.ts` fits the convention.
- **Foundry home:** `GeniusDiamondTestBase.sol` already centralizes role/token constants;
  add the bridge constants to that same block.
- **Value fidelity:** copy `SGNS_DESTINATION` / Y-parity verbatim from
  `GNUSBridgeEnhanced.test.ts` (the currently-passing reference) to avoid behavior drift.
- **Same-chain guard:** `bridgeOut` reverts when `destChainID == local chainID`; `137` is
  safe for both Hardhat and anvil local chains.
- **Cross-runner pairing:** the TS `bytes32` and the Foundry `bytes32` must encode the same
  X value; document the pairing so future edits keep them in lockstep.

## 7. Success Metrics

- **One import** brings all four bridge constants into a Hardhat spec (verified in
  `GNUSBridgeEnhanced.test.ts`).
- **Zero** inline bridge-constant duplicates remain across the three known sites.
- **Zero** test-behavior regressions: Hardhat and Foundry pass counts ≥ pre-epic counts.
- A simulated future signature change is expressible as a **single-file edit per runner**
  (demonstrated conceptually, not committed).

## 8. Open Questions

- Exact export style for the TS module (named consts vs a single `BRIDGE_FIXTURES` object)?
  _Default: individual named exports, matching how the constants are consumed today._ —
  defer to `/generate-tasks`.
- Should `DEST_CHAIN_ID` be typed as `number` or `bigint` for ethers v6 call ergonomics?
  _Default: match what the existing passing call sites pass (number literal `137`)._ —
  resolve during implementation.
