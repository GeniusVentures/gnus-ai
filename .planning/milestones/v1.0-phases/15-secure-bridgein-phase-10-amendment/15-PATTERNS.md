# Phase 15: Secure BridgeIn (Phase 10 Amendment) - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 13 (7 modified, 4 new, 2 conditional on the facet-split decision)
**Analogs found:** 13 / 13 (2 are compositions — see No Analog Found)

**EIP-170 budget (measured from `artifacts/`, 2026-08-26):**

| Facet | Runtime bytecode | Headroom vs 24,576 B |
|-------|------------------|----------------------|
| `GNUSBridge` | **23,276 B** | **1,300 B** |
| `GNUSLicensingPurchase` (newest split sibling) | 22,886 B | 1,690 B |
| `GNUSLicensing` | 16,739 B | 7,837 B |
| `GNUSControl` | 7,287 B | 17,289 B |

GNUSBridge has 1,300 B of headroom. The V2 surface (BridgeMessage + BRIDGE_MESSAGE_ID_V2, 3-field-extended digest, new verifier with cap + epoch thresholds, second `bridgeIn` with root-transition CEI, one-time init, emergency recovery, threshold-override setter, 3 new events) does not fit in place. This is the driver for the conditional `GNUSBridgeAttestor` facet split — research decides; both paths are mapped below.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` (modify: BRIDGE-10 append) | model/storage | CRUD | `GNUSLicensingStorage.sol` Phase 14 append + `GNUSNFTFactoryStorage.sol` NFT append discipline | exact |
| `contracts/gnus-ai/GNUSBridge.sol` (modify: V2 digest/verifier/bridgeIn or slim-down) | facet | request-response | same file, legacy `bridgeIn`/`_verifyThresholdCertificate`/`setValidatorSet` | exact |
| `contracts/gnus-ai/GNUSBridgeAttestor.sol` (new — CONDITIONAL facet split) | facet | request-response | `GNUSLicensing.sol` / `GNUSLicensingPurchase.sol` sibling-split pair | role-match |
| `contracts/gnus-ai/GNUSBridgeTypes.sol` (new — only if split; else types inline) | model/types | — | `GNUSLicensingTypes.sol` | exact |
| `diamonds/GeniusDiamond/geniusdiamond.config.json` (modify: 2.6 re-swap + selector removal) | config | — | `GNUSLicensing`/`GNUSLicensingPurchase` entries + `protocolExcludeFuncSelectors` + action-2 encoded cuts | exact |
| `test/utils/bridge-certificate.ts` (modify: V2 digest + attestor helpers) | utility | transform | same file (Phase 10 reference implementation) | exact |
| `test/utils/bridge-vectors.v2.json` (new — BRIDGE-18 fixtures, name planner's choice) | test-fixture | file-I/O | `CANONICAL_TEST_PRIVATE_KEY` vector block in `GNUSBridgeIn.test.ts:39-42` | role-match |
| `test/unit/GNUSBridgeInV2.test.ts` (new sibling — or extend `GNUSBridgeIn.test.ts`) | test | request-response | `GNUSBridgeIn.test.ts` scaffold + `GNUSBridgePolicy.test.ts` matrix style | exact |
| `test/unit/GNUSBridgeAttestorUpgrade.test.ts` (new — BRIDGE-10 slot probe) | test | file-I/O (storage probe) | `GNUSLifecycleUpgrade.test.ts` slot-probe | exact |
| `test/foundry/handlers/GeniusDiamondHandler.sol` (modify: `handler_bridgeIn` selector) | test/handler | event-driven | same file, `handler_bridgeIn:427-473` | exact |
| `test/foundry/invariant/BridgeInvariant.t.sol` + `ConservationInvariant.t.sol` (modify: allowlist) | test/invariant | batch | same files (see handler comment lines 470-472) | exact |
| `docs/` exporter ABI + digest spec (new — spec Deliverable 5) | docs | — | `bridge-certificate.ts` header reference-implementation block | role-match |
| `.planning/REQUIREMENTS.md` BRIDGE-10..19 + ROADMAP SC flips (docs amend) | docs | — | prior phase amendment precedent | role-match |

## Pattern Assignments

### `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` (modify — BRIDGE-10 append)

**Analog:** same file + `GNUSLicensingStorage.sol` (whole file, 38 lines) + `GNUSNFTFactoryStorage.sol:19-41` append discipline

**Existing layout to append after** (lines 12-19 — preserved byte-for-byte, becomes dead once V2 is active):
```solidity
struct Layout {
    mapping(bytes32 => bool) processedMessages;  // slot 0 (D-07 — reused by V2 under derived key)
    bytes32 validatorMerkleRoot;                 // slot +1 (D-15 — dead once attestor V2 active)
    uint256 validatorThreshold;                  // slot +2 (D-12 — dead once attestor V2 active)
}
```

**Append-banner discipline** (copy `GNUSNFTFactoryStorage.sol:22-23` / `:34-35` verbatim shape):
```solidity
// Phase 15 appends below - do not reorder, do not insert above this line
// Slot annotations verified by storage probe in GNUSBridgeAttestorUpgrade.test.ts (BRIDGE-10):
```
Append: `bytes32 bridgeAttestorRoot` (slot +3; `bytes32(0)` = not bootstrapped), `uint256 bridgeAttestorEpoch` (slot +4; 0 = Genesis), `bool bridgeAttestorV2Initialized` (slot +5), plus the threshold-override field for the superAdmin setter (slot +6; 0 = epoch-derived default). Full slots — no packing concerns (unlike the NFT struct's 28-byte-packed slot +8 lesson, `GNUSLifecycleUpgrade.test.ts:80-83`).

**What differs:** legacy fields stay (BRIDGE-10: "preserved byte-for-byte, become dead once active") — do NOT delete `validatorMerkleRoot`/`validatorThreshold`. Update the stale header `@dev Append-only; Phase 12 may add in-flight accounting` (line 6) to reflect Phase 15. Keep the slot constant `keccak256("gnus.ai.bridge.validator.storage")` (line 22) and `layout()` assembly accessor (lines 27-32) untouched.

---

### `contracts/gnus-ai/GNUSBridge.sol` (modify — V2 surface)

**Analog:** same file. Four extract points:

**1. Digest being extended — `_bridgeInDigest` (lines 379-397):**
```solidity
bytes32 structHash = keccak256(
    abi.encode(
        transferId, srcChainID, block.chainid, address(this),
        recipient, GNUS_TOKEN_ID, amount
    )
);
return ECDSAUpgradeable.toEthSignedMessageHash(structHash);
```
Copy the shape; BRIDGE-13 adds the `BRIDGE_CERTIFICATE_V2` domain constant plus `currentAttestorRoot, currentAttestorEpoch, nextAttestorRoot` into the `abi.encode` (dest-chain + `address(this)` binding preserved). Domain constant follows the named-constant precedent at lines 31-43 (`MINTER_ROLE`, `FEE_DENOMINATOR`, `LICENSE_EXPIRED_ERROR`).

**2. Verifier being replaced — `_verifyThresholdCertificate` (lines 415-443):** keep the load-bearing mechanics exactly — sig/proof length parity (line 420), `tryRecover` + `RecoverError.NoError` (427-431), strict-ascending `require(signer > lastSigner)` (432), leaf `keccak256(abi.encodePacked(signer))` (434), `MerkleProofUpgradeable.verify` (435-438). BRIDGE-14 changes: verify against `bridgeAttestorRoot`; threshold becomes epoch-derived (epoch 0 → `GENESIS_ATTESTOR_THRESHOLD = 1`, epoch > 0 → `ACTIVE_ATTESTOR_THRESHOLD = 2`, overridable by the threshold-override field); add `MAX_ATTESTOR_SIGNATURES = 16` cap — all three as named constants (no magic numbers; `FEE_DENOMINATOR` line 37 precedent).

**3. Body being superseded — legacy `bridgeIn` (lines 465-487):** copy the numbered ordering (pause FIRST line 473 → replay/chain/recipient/amount → digest → verify → replay-mark BEFORE mint → `_mintWithBridgeFee` → emit). BRIDGE-15 inserts the root transition into the pre-mint effects block:
```solidity
v.processedMessages[messageId] = true;
if (nextAttestorRoot != v.bridgeAttestorRoot) {
    // emit-after-write, read-old-into-locals — ValidatorSetUpdated pattern (lines 499-508)
    v.bridgeAttestorRoot = nextAttestorRoot;
    ++v.bridgeAttestorEpoch;
    emit BridgeAttestorSetAdvanced(...);
}
_mintWithBridgeFee(recipient, GNUS_TOKEN_ID, amount);
```
Unchanged root → claim processes with no epoch bump. Epoch-0 certificate MUST change root (reject `nextAttestorRoot == currentRoot` at epoch 0 — no permanent Genesis). Failed mint reverts everything (atomicity by revert). Keep `_mintWithBridgeFee` (lines 127-153) untouched per spec Non-goals; keep the D-22 fee/cap path and the `BridgeReleased` event (68-85) with its CEI NatSpec.

**4. One-time initializer — `initializeBridgeAttestorV2` (BRIDGE-11):** analog `GNUSTreasury_SetSeedSupply` (`GNUSTreasury.sol:163-179`):
```solidity
function GNUSTreasury_SetSeedSupply(uint256 seedGlobalSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!l.provenanceInitialized, "Already initialized");
    ...
    l.provenanceInitialized = true;
    emit GlobalSupplyInitialized(seedGlobalSupply, _msgSender());
}
```
Copy: one-shot bool guard, guarded-use companion (`require(l.provenanceInitialized, ...)` at line 146 — mirror for "Attestor set not initialized" in `bridgeIn` V2 and views), emit-after-write. Use `onlySuperAdminRole` (BRIDGE-11; `GNUSBridge.sol:499` precedent, not DEFAULT_ADMIN). **Differs:** it takes an argument (`address genesisAttestor`), so it CANNOT be a cut-time `deployInit`/`upgradeInit` — those encode zero-arg calls (`GNUSTreasury_Initialize260` note, `GNUSTreasury.sol:150-156`); invoke post-cut like `SetSeedSupply`. Bootstrap writes the one-leaf root (`root = keccak256(abi.encodePacked(genesisAttestor))`, `genesisAttestor != address(0)`) at epoch 0 and emits `BridgeAttestorSetInitialized`.

**5. Emergency-recovery conversion — `setValidatorSet` (lines 499-508) → named emergency reset (BRIDGE-16):** keep `onlySuperAdminRole`, `require(newRoot != bytes32(0))`, read-old-into-locals + `ValidatorSetUpdated`-style event. Add (per spec lines 609-618): `require(GNUSControlStorage.layout().paused, ...)` — inverted pause gate (consumer pattern `GNUSBridge.sol:473`; setters `GNUSControl.emergencyPause/emergencyUnpause` at `GNUSControl.sol:70-82`), never restores Genesis (reject when the result would re-enter single-signature mode at epoch 0), increments epoch, emits an explicit emergency-reset event. The threshold-override setter copies the same `onlySuperAdminRole` + validate + event shape (`GNUSControl.updateBridgeFee`, `GNUSControl.sol:166`, is the closest simple setter).

**What differs overall:** legacy `bridgeIn` selector is REMOVED or stubbed to always-revert (see config mapping below); `_verifyThresholdCertificate` and `_bridgeInDigest` are superseded (delete, don't leave callable alongside V2 — spec line 600).

---

### `contracts/gnus-ai/GNUSBridgeAttestor.sol` + `GNUSBridgeTypes.sol` (new — CONDITIONAL)

**Analog:** the Phase 14 facet-creation trio — `GNUSLicensing.sol` (config/view half, 16,739 B) / `GNUSLicensingPurchase.sol` (action half, 22,886 B) / `GNUSLicensingStorage.sol` + `GNUSLicensingTypes.sol`.

**Facet-split header** (copy `GNUSLicensing.sol:14-22` / `GNUSLicensingPurchase.sol:17-38` paragraph shape):
```
@dev Plan 15-xx facet split: this facet owns ... only. ... lives on the sibling
facet. The two facets NEVER call each other — they share state only through
diamond storage (GNUSBridgeValidatorStorage).
```

**Imports pattern** (`GNUSLicensingPurchase.sol:1-15`): `GNUSERC1155MaxSupply`, `GeniusAccessControl`, `GNUSConstants`, storage files, `contracts-starter/contracts/libraries/LibDiamond.sol` for the diamond-aware `supportsInterface` (copy `GNUSLicensing.sol:42-45` triple-OR verbatim).

**Types file** (`GNUSLicensingTypes.sol` precedent): file-level `struct BridgeMessage { uint256 srcChainID; bytes32 sourceBridgeID; bytes32 sourceTxHash; uint256 sourceEventIndex; address recipient; uint256 amount; }` with per-field `@param` Doxygen; Solidity 0.8.19 has no file-level events — declare `BridgeAttestorSetInitialized` / `BridgeAttestorSetAdvanced` / the emergency-reset event in an `interface IGNUSBridgeAttestorEvents` that the facet inherits (`IGNUSLicensingEvents` pattern, `GNUSLicensingTypes.sol:36-50`). BRIDGE_MESSAGE_ID_V2 derivation: `keccak256(abi.encode(BRIDGE_MESSAGE_ID_V2, srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex))` (PD-BR-3) — key feeds the existing `processedMessages` mapping, so no storage migration.

**CRITICAL difference from the analog:** the new `bridgeIn` needs `_mintWithBridgeFee`, which is `internal` to GNUSBridge — sibling facets never call each other. Precedented options: (i) duplicate the small predicate — `GNUSLifecycleMint._isExpired` duplication precedent, cited in `GNUSLicensingPurchase.sol:28-30`; (ii) compile-time-linked library — `GNUSLifecyclePolicy.sol` + the `scripts/utils/GNUSLifecyclePolicyLinking.ts` harness (monkey-patches `ethers.getContractFactory` for `linkReferences`; every test `before` hook calls `setupLifecyclePolicyLinking()`); (iii) keep `bridgeIn` on GNUSBridge and split only the attestor admin/init/view surface (init, emergency recovery, threshold override, epoch/root views) — smallest delta, bounded by the 1,300 B GNUSBridge headroom minus what the admin surface frees. Research/planner picks; do NOT introduce a delegatecall trampoline between facets (D-16 discipline).

---

### `diamonds/GeniusDiamond/geniusdiamond.config.json` (modify)

**Analog:** `GNUSLicensing`/`GNUSLicensingPurchase` entries (lines 144-159):
```json
"GNUSLicensing": {
  "priority": 122,
  "versions": { "2.6": { "fromVersions": [0.0, 2.4, 2.5] } }
}
```
A new facet takes the next free priority (124 — 123 is `GNUSLicensingPurchase`; `GNUSWithdrawLimiter` at 120 shows priorities need only be unique, not monotonic). Re-key into `versions["2.6"]` with `fromVersions: [0.0, 2.4, 2.5]` — NEVER a 2.7 key (no protocolVersion bump past 2.6; reverted twice already). GNUSBridge already has a 2.6 entry (lines 99-110) — Phase 15 re-swaps the 2.6 artifact (same re-key discipline the Phase 11 CR-01 fixes used).

**Selector-removal precedents (BRIDGE-16):**
1. `"protocolExcludeFuncSelectors": []` — config line 4; the built-in exclusion key, currently unused (empty).
2. Explicit action-2 cuts — `diamonds/GeniusDiamond/encoded-cuts/sepolia-11155111-1782944617821.json` contains 9 `"action": 2` removal entries alongside replaces; a replace-only swap does NOT remove a selector that vanished from the artifact, so the legacy `bridgeIn(bytes32,uint256,address,uint256,bytes[],bytes32[][])` selector needs either an action-2 cut or an always-revert stub in the new artifact.
3. Whole-facet removal — commit `20d1b92` ("remove GeniusAI facet"): deleted facet + storage + tests + docs, stripped config entries, added `test/unit/cleanup-02-02.test.sh` TDD guard. Follow its shape if `setValidatorSet` is removed outright rather than converted.

**Initializer wiring:** `initializeBridgeAttestorV2(address)` takes an argument → it is NOT a `deployInit`/`upgradeInit` string (those are zero-arg encoded; `GNUSTreasury` uses `"upgradeInit": ""` at line 116 to explicitly suppress). Post-cut invocation, like `GNUSTreasury_SetSeedSupply`.

---

### `test/utils/bridge-certificate.ts` (modify — V2 helpers)

**Analog:** same file (192 lines) — it is the documented reference implementation for the SuperGenius C++ `SignEVM` (header lines 22-24: "keep it readable and side-effect free").

**What to copy/extend:** `BridgeInMessage` interface → add a V2 interface with the six `BridgeMessage` fields + `currentRoot/currentEpoch/nextRoot`; `computeBridgeInStructHash` (lines 60-74) → V2 struct hash mirroring the on-chain `abi.encode` field order EXACTLY (the header comment block at lines 27-35 documenting field-order lockstep with `_bridgeInDigest` is the pattern to replicate for `BRIDGE_CERTIFICATE_V2`); `signBridgeInCertificate` (83-89 — never manually prepend the EIP-191 prefix, Pitfall 1); `aggregateCertificate` (97-113 — strict-ascending sort + duplicate throw); `buildValidatorMerkleTree` (127-192 — `ethers.solidityPacked(['address'])` leaves, sorted-pair hashing, odd-node promotion, single-leaf `root == leaf, proof == []` — exactly the Genesis one-leaf case BRIDGE-11 needs). **Differs:** tree builder stays as-is (same leaf convention per spec lines 636-649); add epoch/threshold selection helpers and a genesis-vs-active certificate builder.

### `test/utils/bridge-vectors.v2.json` (new — BRIDGE-18, name planner's choice)

**Analog:** the hardcoded canonical vector in `GNUSBridgeIn.test.ts:39-42` (`CANONICAL_TEST_PRIVATE_KEY` — Hardhat account #0, "ONLY used for the canonical cross-repo test vector ... NEVER used to send transactions"). Fields per spec lines 712-725: private key, 64-byte SG pubkey, derived EVM address, current root, epoch, next root, all BridgeMessage fields, raw ABI struct hash, EIP-191 digest, 65-byte r‖s‖v signature, recovered address, Merkle proof. Checked in + CI-consumed. The C++ exporter side lives in the SuperGenius repo (no local analog — PD-BR-7/#363/#364 are parallel non-blockers).

---

### `test/unit/GNUSBridgeInV2.test.ts` (new sibling) / `GNUSBridgeIn.test.ts` (extend)

**Analog:** `GNUSBridgeIn.test.ts` scaffold (BRIDGE-19: amendment matrix EXTENDS the Phase 10 legacy suite — do not replace it; a sibling V2 file keeps the legacy-path coverage intact while the legacy selector exists).

**Scaffold to copy** (lines 63-127): `setupLifecyclePolicyLinking()` before deploy (line 65), `LocalDiamondDeployer.getInstance` + `loadDiamondContract<GeniusDiamond>` (71-76), treasury-seed probe guard via `eth_getStorageAt` on `TREASURY_STORAGE_SLOT + 1n` (83-89 — reuses cleanly for `bridgeAttestorV2Initialized` probes), `setChainID(localChainId)` (96), `Wallet.createRandom()` validator sets + `buildValidatorMerkleTree` (101-112), snapshot isolation `evm_snapshot`/`evm_revert` in beforeEach/afterEach/after (114-127), `buildCertificate` helper with `destChainID`/`diamondAddress` overrides for wrong-chain/cross-diamond reverts (139-150+).

**Matrix style** (from `GNUSBridgePolicy.test.ts:28-52`): numbered behavior block in the file header, each mapping to a spec checklist line. Test matrix source of truth: spec lines 657-707 (Bootstrap / Current-root verification / Root transitions / Replay and domain binding / Existing token behavior — 36 checkboxes).

### `test/unit/GNUSBridgeAttestorUpgrade.test.ts` (new — BRIDGE-10 slot probe)

**Analog:** `GNUSLifecycleUpgrade.test.ts` — `nftSlot(tokenId, offset)` helper (lines 85-90: `keccak256(abi.encode(key, baseSlot)) + offset`), the documented slot-layout comment block (61-84, including the "the plan spec assumed wrong offsets and the probe corrected them" lesson at 80-83), `eth_getStorageAt` probes (273-285), zero-the-slots-then-prove-legacy-behavior pattern (210-228). Adapt: base slot `keccak256("gnus.ai.bridge.validator.storage")`; probe `+1` (validatorMerkleRoot) / `+2` (validatorThreshold) decode from pre-upgrade state, `+3..+6` (appended fields) read zero-default on the legacy diamond. Fixture shell: `GNUSLicensing.test.ts:48-105` (multichain provider loop, named-constants block, `chai.use(chaiAsPromised)`, `this.timeout(0)`, debug logger).

### `test/foundry/handlers/GeniusDiamondHandler.sol` (modify)

**Analog:** same file, `handler_bridgeIn` (lines 427-473). Update the raw selector string at lines 450-460 — `"bridgeIn(bytes32,uint256,address,uint256,bytes[],bytes32[][])"` — to the V2 signature (or keep as the always-revert probe if stubbed). Keep: `bound`/`vm.assume` input bounds, the deterministic-but-invalid seed certificate (443-446), ghost counters (`ghost_bridgeInCalls`/`ghost_bridgeInSuccesses`/`ghost_totalBridgedInAmount`/`ghost_releasedIds*`), and the low-level `(bool ok, ) = diamond.call(...)` shape. Honor the in-file note (470-472): `BridgeInvariant.t.sol` and `ConservationInvariant.t.sol` must list `handler_bridgeIn.selector` in their `targetSelector` allowlists — re-verify both after the signature change.

## Shared Patterns

### Diamond storage access
**Source:** `GNUSBridgeValidatorStorage.sol:22-32`
**Apply to:** storage append (and any new facet reading it)
```solidity
bytes32 constant GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION = keccak256("gnus.ai.bridge.validator.storage");
function layout() internal pure returns (Layout storage l) {
    bytes32 slot = GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION;
    assembly { l.slot := slot }
}
```

### Merkle leaf + EIP-191 conventions (both sides must stay in lockstep)
**Source:** `GNUSBridge.sol:434` and `test/utils/bridge-certificate.ts:136-137`
**Apply to:** verifier, tree builder, cross-language vectors
`leaf = keccak256(abi.encodePacked(signer))` (20-byte packed, NOT `abi.encode`); digest = `toEthSignedMessageHash(structHash)` / `wallet.signMessage(structHash)` (never manually prepend the prefix). Spec lines 636-649 confirm the same sorted-pair convention for `nextAttestorRoot`.

### SuperAdmin mutation + emit-after-write
**Source:** `GNUSBridge.sol:499-508` (`setValidatorSet`)
**Apply to:** `initializeBridgeAttestorV2`, emergency recovery, threshold-override setter — `onlySuperAdminRole`, validate inputs, read old values into locals, write, emit with old+new.

### Pause gating
**Source:** `GNUSBridge.sol:473` (consumer: `require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused")`) + `GNUSControl.sol:70-82`
**Apply to:** new `bridgeIn` (unpaused required, FIRST check — spec "Pause check occurs before certificate work") and emergency recovery (inverted: paused REQUIRED).

### Named constants — no magic numbers
**Source:** `GNUSBridge.sol:31-43`, `GNUSLicensing.sol:29-34` (named revert-string constants)
**Apply to:** `GENESIS_ATTESTOR_THRESHOLD = 1`, `ACTIVE_ATTESTOR_THRESHOLD = 2`, `MAX_ATTESTOR_SIGNATURES = 16`, `BRIDGE_MESSAGE_ID_V2`, `BRIDGE_CERTIFICATE_V2` — and named revert-string constants; Hardhat tests assert exact strings (`GNUSBridgeIn.test.ts:32-33`).

### Versioning constraint
New/changed facets re-key into `versions["2.6"]`, `fromVersions: [0.0, 2.4, 2.5]` — never 2.7 (twice-reverted rule).

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| C++ SuperGenius exporter side of BRIDGE-18 vectors | external | transform | Lives in the SuperGenius repo (PD-BR-7; #363/#364 parallel non-blockers). Local side: `bridge-certificate.ts` is the reference implementation; compose vectors from `CANONICAL_TEST_PRIVATE_KEY` pattern. |
| Rolling-root rotation as a bridgeIn side-effect | facet logic | request-response | No on-chain analog rotates authority inside a permissionless action. Compose: legacy `bridgeIn` CEI body (`GNUSBridge.sol:465-487`) + emit-after-write transition (`:499-508`) + one-shot bootstrap (`GNUSTreasury.sol:163-179`). |
| Paused-gated emergency authority rotation | facet logic | request-response | Novel gate combination. Compose: `setValidatorSet` shape + inverted pause require + `emergencyPause` semantics. |

## Metadata

**Analog search scope:** `contracts/gnus-ai/`, `test/unit/`, `test/utils/`, `test/foundry/`, `diamonds/GeniusDiamond/`, `docs/Secure-BridgeIn.md`, `.planning/intel/decisions.md`, git history (`20d1b92`, encoded-cuts)
**Primary analogs:** GNUSBridge.sol, GNUSBridgeValidatorStorage.sol, GNUSLicensing.sol, GNUSLicensingPurchase.sol, GNUSLicensingStorage.sol, GNUSLicensingTypes.sol, GNUSTreasury.sol, GNUSControl.sol, GNUSNFTFactoryStorage.sol, bridge-certificate.ts, GNUSBridgeIn.test.ts, GNUSBridgePolicy.test.ts, GNUSLifecycleUpgrade.test.ts, GNUSLicensing.test.ts, GeniusDiamondHandler.sol, geniusdiamond.config.json
**Runtime sizes measured from `artifacts/` (post-Phase-14 build): GNUSBridge 23,276 B / GNUSLicensingPurchase 22,886 B / GNUSLicensing 16,739 B / GNUSControl 7,287 B (EIP-170 limit 24,576 B)**
**Pattern extraction date:** 2026-08-26
