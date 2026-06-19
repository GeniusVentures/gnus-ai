# Bridge Test Realignment — Companion Design Doc

> **Status:** 🧭 design of record (read this before the project plan)
> **Author:** Am0rfu5 · **Date:** 2026-06-19
> **Scope:** Captures the *already-decided* contract design that the test suite must
> conform to. This is descriptive (the target the tests verify), not a proposal.

This document records the contract-level design decisions introduced on
`feature/bridge-out-initiated` so the test suite can be realigned against a single
source of truth. The implementation is done; the tests are catching up.

---

## 1. `bridgeOut` signature change

The cross-chain bridge-out entrypoint expanded from a 3-argument call (which carried
only routing) to a 5-argument call that carries the **destination recipient identity**
on the SuperGenius (SGNS) chain.

| | Old (main) | New (`feature/bridge-out-initiated`) |
|---|---|---|
| Signature | `bridgeOut(uint256 amount, uint256 id, uint256 destChainID)` | `bridgeOut(uint256 amount, uint256 id, uint256 destChainID, bytes32 sgnsDestination, bool destinationYOdd)` |
| Event | (prior name) | `BridgeOutInitiated(address indexed sender, uint256 id, uint256 amount, uint256 srcChainID, uint256 destChainID, bytes32 sgnsDestination, bool destinationYOdd)` |

Reference: [GNUSBridge.sol:187-209](../../contracts/gnus-ai/GNUSBridge.sol#L187-L209).

### Behavioral contract (what tests must assert)

- **Burn-then-emit:** `bridgeOut` burns `amount` of token `id` from the sender, then
  emits `BridgeOutInitiated`. There is no mint on the source chain — value is
  reconstructed on the destination chain by an off-chain relayer reading the event.
- **Guards:**
  - `NFTs[id].nftCreated` must be true → `"Token not created."`
  - `balanceOf(sender, id) >= amount` → `"Insufficient tokens."`
  - `destChainID != layout().chainID` → `"Cannot bridge to same chain"`
- **Event field provenance:** `srcChainID` is read from `GNUSControlStorage.layout().chainID`
  (it is **not** a caller argument); `sender` is `_msgSender()`; the remaining fields echo
  the call arguments.

---

## 2. Destination key: `bytes32 sgnsDestination` + `bool destinationYOdd`

The destination recipient on the SGNS chain is **not** an Ethereum address. It is an
elliptic-curve public key. To carry it compactly the design uses **compressed-point
encoding**:

- `sgnsDestination` — the 32-byte **X coordinate** of the recipient's public key.
- `destinationYOdd` — the **parity of the Y coordinate** (`false` = even, `true` = odd).

Together these reconstruct the full public key on the destination side (standard
compressed-point reconstruction). Test fixtures model this as:

```ts
const SGNS_DESTINATION = ethers.zeroPadValue('0x1234', 32); // 32-byte X component
const SGNS_DESTINATION_Y_ODD = false;                       // Y parity (even)
```

Reference: [GNUSBridgeEnhanced.test.ts:21-23](../../test/unit/GNUSBridgeEnhanced.test.ts#L21-L23).

### Test obligations for the destination key

- Event assertions must match **all seven** event fields, including `sgnsDestination`
  and `destinationYOdd` (current passing tests in `GNUSBridgeEnhanced.test.ts` already do;
  the gas test and any new tests must follow).
- Edge cases worth covering: zero-X value, max `bytes32` X, both parity values.
- The destination key is opaque to the source contract — there is **no on-chain
  validation** of curve membership, so tests should assert the contract faithfully
  forwards whatever it is given rather than expecting rejection.

---

## 3. Removal of GeniusAI / `OpenEscrow`

The `GeniusAI` contract — which provided the `OpenEscrow` payable function — was removed
from the diamond. This is a **submodule** change in `diamonds/GeniusDiamond`
(commit `5d26a14 feat: remove GeniusAI contract from config`), surfaced in the
superproject as the modified `diamonds/GeniusDiamond` pointer.

### Implications for the suite

- No `OpenEscrow` selector should remain wired into the diamond. Any test that called it
  (e.g. `GeniusOwnershipFacet` "maintain contract state across ownership transfer") must
  be rewritten to exercise state persistence **without** escrow, or removed.
- A conformance test should assert the `OpenEscrow` selector is **absent** from the
  diamond's facets (negative coverage), so accidental re-introduction is caught.

---

## 4. DiamondInitFacet changes (submodule)

`DiamondInitFacet.sol` was modified in the `diamonds/GeniusDiamond` submodule as part of
the same cleanup (GeniusAI removed from init wiring; `GNUSWithdrawLimiter` added to the
diamond configuration — submodule commits `5d26a14` and `6800205`). The superproject's
`contracts/gnus-ai/DiamondInitFacet.sol` shows no diff vs `main`; the change of record is
in the submodule.

### Test obligations

- Diamond initialization tests must reflect the **current** facet set: WithdrawLimiter
  present, GeniusAI/OpenEscrow absent.
- Init wiring (roles, storage defaults such as `chainID`, `bridgeFee`) must be asserted
  against the new config so a stale submodule pointer is caught by a failing test rather
  than silently drifting.

---

## 5. Source-of-truth & fixtures

To prevent the exact drift this project is fixing, the design calls for **one shared
fixture module per runner** for bridge test constants (`SGNS_DESTINATION`,
`SGNS_DESTINATION_Y_ODD`, `GNUS_TOKEN_ID`, canonical `destChainID`) imported by every
bridge-touching spec. Today they are redefined per-file, which is why
`GNUSBridgeEnhanced.test.ts` was updated but the Hardhat gas test was not.

### Signature evolution (three forms seen in the tree)

The destination parameter went through **two** revisions, and the test tree still
contains all three forms — this is the source of the drift:

1. `bridgeOut(uint256,uint256,uint256)` — original, no destination. (Hardhat gas test.)
2. `bridgeOut(uint256,uint256,uint256,bytes)` — interim `bytes`-encoded destination key.
   Still used by the **Foundry** suite (`BridgeFuzz.t.sol` + the 64-byte `bytes
   TEST_SGNS_DEST` in `GeniusDiamondTestBase.sol`). This selector no longer exists on the
   diamond, so every Foundry `bridgeOut` call silently reverts — failing one test and
   producing **false-greens** in the negative tests.
3. `bridgeOut(uint256,uint256,uint256,bytes32,bool)` — **current** (X + Y-parity). Only
   `GNUSBridgeEnhanced.test.ts` is aligned to it.

Because the current form is a fixed-length `bytes32`, the interim "invalid destination key
length" test is **obsolete** and should be removed — a `bytes32` cannot have a wrong length.

### Foundry environment prerequisite

`yarn forge:test` must be preceded by `yarn clean-compile` and requires a running
**`anvil`** instance. Without it the Foundry suite cannot execute against the diamond, so
this is a prerequisite for every Foundry-touching change and for the final green gate.

---

## 6. Decision log

| Decision | Rationale |
|---|---|
| Carry destination as compressed pubkey (X + Y-parity), not address | SGNS recipients are EC keys, not EVM addresses; compressed form fits `bytes32 + bool` and is relayer-reconstructable. |
| `srcChainID` read from storage, not passed in | Prevents caller spoofing of source chain in the emitted event. |
| Remove GeniusAI/`OpenEscrow` from diamond | Escrow feature retired; removing the facet shrinks attack surface and selector table. |
| Add negative test for absent `OpenEscrow` selector | Guards against accidental facet re-introduction. |
| Centralize bridge test fixtures | Root-causes the per-file constant drift that caused these failures. |
