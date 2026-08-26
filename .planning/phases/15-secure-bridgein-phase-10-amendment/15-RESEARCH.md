# Phase 15: Secure BridgeIn (Phase 10 Amendment) - Research

**Researched:** 2026-08-26
**Domain:** Solidity diamond facet (EIP-2535) — rolling API-attestor bridge-in certificates, ECDSA threshold verification, Merkle membership proofs, EIP-170 bytecode budget, diamond-cut selector surgery
**Confidence:** HIGH (facet strategy verified by compiled bytecode probe; upgrade mechanics verified against the diamonds framework source; no CONTEXT.md exists yet — owner rulings sourced from `.planning/intel/decisions.md`)

## Summary

Phase 15 replaces the Phase 10 manual validator-set `bridgeIn` surface with the rolling API-attestor certificate design of `docs/Secure-BridgeIn.md` (the SPEC). The contract-side work is: append V2 fields to `GNUSBridgeValidatorStorage`, add a one-time Genesis bootstrap, replace the certificate digest/verification with `BRIDGE_CERTIFICATE_V2` (root/epoch-bound), implement the new struct-based `bridgeIn` with CEI ordering (replay-mark + root transition before mint), delete the legacy `bridgeIn(bytes32,uint256,address,uint256,bytes[],bytes32[][])` selector, and convert `setValidatorSet` into `emergencyRecoverAttestorSet` per the 2026-08-26 owner ruling.

The decisive engineering question was EIP-170: `GNUSBridge` measures **23,276 B** deployed (1,300 B headroom) and the V2 surface does not fit. I compiled three strategy probes with production settings (Solidity 0.8.19, optimizer runs=1000, no viaIR, evm paris): **all-in-one** = 25,772 B (**2,196 B over — rejected**), **library-split** = 24,723 B (**147 B over — rejected**, plus stack-too-deep and linker-generalization hazards), **sibling facet** = GNUSBridge-minus-bridge-in at **19,938 B** + new `GNUSBridgeAttestor` facet at **21,461 B** (**both fit with multi-KB headroom**). The probe also surfaced a load-bearing compiler fact: the SPEC's flat 13-field `abi.encode` digest hits **"Stack too deep"** in every facet shape tried; the byte-identical `bytes.concat` split-encode (three partial `abi.encode` groups) is required and must be proven equivalent by the BRIDGE-18 vectors.

**Primary recommendation:** New sibling facet `GNUSBridgeAttestor` (priority 116, `versions["2.6"]`) owning the entire V2 bridge-in surface with an inline `_mintWithBridgeFee` replica (GNUSRedeemAdapter precedent); `GNUSBridge` deletes the legacy bridge-in block (registry auto-emits Remove cuts on redeploy); digest uses split-encode; no new libraries, no linker changes, protocolVersion stays 2.6.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRIDGE-10 | Append `bridgeAttestorRoot`, `bridgeAttestorEpoch`, `bridgeAttestorV2Initialized` (+ PD-BR-2 revised threshold-override field) to `GNUSBridgeValidatorStorage.Layout`; legacy fields frozen byte-identical | §Storage Append — exact slots 3/4/5 computed; probe storage copy compiled and measured |
| BRIDGE-11 | One-time `initializeBridgeAttestorV2(address)` (onlySuperAdminRole); first certificate must advance off Genesis | §Genesis Bootstrap — one-time flag semantics; epoch-0 `nextAttestorRoot != currentRoot` rule; probe code compiled |
| BRIDGE-12 | Canonical `BridgeMessage` + `BRIDGE_MESSAGE_ID_V2` composite replay key (amends D-06); reuses `processedMessages` | §Code Examples — `_bridgeMessageId` compiled in probe; new selector `0x4d2e0756` |
| BRIDGE-13 | `BRIDGE_CERTIFICATE_V2` digest binding currentRoot/Epoch + nextAttestorRoot (extends D-08/D-10) | §The Digest — exact field order + MANDATORY split-encode (stack-too-deep finding) |
| BRIDGE-14 | `_verifyBridgeAttestorCertificate` — strict-ascending signers, per-signer proof vs currentRoot, epoch-derived threshold, 16-sig cap (amends D-12/D-15) | §Code Examples — compiled probe body; threshold override per PD-BR-2 revised |
| BRIDGE-15 | New `bridgeIn` — CEI: replay-mark + root transition BEFORE `_mintWithBridgeFee`; atomic revert | §Code Examples — full body compiled in probe; event/ordering analysis |
| BRIDGE-16 | Legacy selector removed/stubbed; `setValidatorSet` → named emergency recovery (paused + superAdmin + nonzero + never Genesis + epoch increment + event) | §Selector Surgery — registry Remove mechanics verified in framework source; §Emergency Recovery |
| BRIDGE-17 | SuperGenius #363/#364 tracked in parallel — production-activation gate only | §External Dependencies — not local blockers (owner ruling 2026-08-26) |
| BRIDGE-18 | Cross-language test vectors checked in, run in CI | §Test Strategy — EVM-side vector generation recipe without the C++ side |
| BRIDGE-19 | Amendment test matrix (SPEC lines 654-727), extends Phase 10 suite | §Test Strategy — break analysis of `GNUSBridgeIn.test.ts` (21 references) + foundry handler |
</phase_requirements>

## Owner Decisions (locked — do not re-open)

Sourced from `.planning/intel/decisions.md` PD-BR-1..8 + the 2026-08-26 owner rulings [VERIFIED: .planning/intel/decisions.md:74-159]:

- **PD-BR-6 / BRIDGE-16 (REVISED 2026-08-26):** legacy `bridgeIn` selector REMOVED/stubbed; `setValidatorSet` CONVERTED to explicitly-named `emergencyRecoverAttestorSet`: requires paused state + `onlySuperAdminRole` + nonzero new root, NEVER restores single-signature Genesis mode, increments epoch, emits emergency-reset event. Genesis-node specification stays with the one-time `initializeBridgeAttestorV2(genesisAttestor)`.
- **PD-BR-2:** epoch-derived thresholds DEFAULT to SPEC constants at `initializeBridgeAttestorV2` (GENESIS=1, ACTIVE=2, MAX_ATTESTOR_SIGNATURES=16) with a superAdmin-gated setter to override; genesis threshold stays fixed at 1 for epoch 0.
- **PD-BR-8 ruling:** SuperGenius #363/#364 are parallel external work, NOT local blockers — production-activation gate only (BRIDGE-17). #364 already CLOSED; #363 OPEN.
- **Amendment scope:** D-06/D-08/D-10/D-12/D-15/D-16 are NOT deprecated — Phase 15 explicitly amends/supersedes them in CONTEXT. D-01..D-05, D-07, D-09, D-11, D-13, D-14, D-17, D-20..D-22 carry forward unchanged.
- **PD-BR-3 divergence accepted by SPEC:** the SG-side `/bridge/executed/{chainid}:{tx_hash}` replay key is not preserved by the composite `BridgeMessage` ID; SG-side alignment is SuperGenius-repo work.

Project constraints (CLAUDE.md / repo conventions): Solidity ^0.8.19 only; named constants (no magic numbers); append-only storage; sibling facets never call each other; no `viaIR`; protocolVersion stays 2.6 (new facets re-key into `versions["2.6"]`); no Co-Authored-By trailers; never commit without tests/lint/build.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bridge-in execution (mint on destination) | New facet `GNUSBridgeAttestor` (diamond) | — | EIP-170 forces the split (probe-verified); owns cert verify + root transitions |
| Bridge-out (burn on source) + policy gate + limiter | `GNUSBridge` facet (unchanged) | — | D-24 `_enforceBridgePolicy` + limiter ordering live in `bridgeOut`, which Phase 15 does not touch |
| Attestor set commitment (rolling root, epoch) | Diamond storage (`GNUSBridgeValidatorStorage` V2 append) | `GNUSBridgeAttestor` (sole writer) | Shared slots readable by any facet; single-writer avoids cross-facet races |
| Replay protection (`processedMessages`) | Diamond storage (existing slot 0) | `GNUSBridgeAttestor` (sole writer) | D-07 unchanged; key derivation changes (BRIDGE-12), mapping reused |
| Routine attestor rotation | Certificate itself (off-chain signer set) | `bridgeIn` side-effect | PD-BR-1: rotation is a side-effect of `bridgeIn`, not an admin call |
| Emergency root recovery | `GNUSBridgeAttestor` `emergencyRecoverAttestorSet` | `GNUSControl.emergencyPause` precondition | Paused + superAdmin gating; never restores Genesis |
| Fee / global cap / chain supply on bridge mint | Inline `_mintWithBridgeFee` replica in `GNUSBridgeAttestor` | `GNUSBridge` keeps its own copy for `mint()` | Sibling-facet inline rule (repo precedent: `_mint` in GNUSRedeemAdapter) |
| Certificate production (signing, root construction) | SuperGenius exporter (off-chain, other repo) | EVM verifies only | PD-BR-7: native `ConsensusVote.signature` NOT EVM-verifiable; 65-byte r‖s‖v EIP-191 signature required |
| Pause state | `GNUSControlStorage.paused` (shared diamond storage) | read by both facets | D-20/D-21 strict semantics; emergency recovery requires paused, bridgeIn requires unpaused |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@gnus.ai/contracts-upgradeable-diamond` ECDSAUpgradeable | repo-pinned (`package.json`) | `tryRecover` per signature | Already used by `_verifyThresholdCertificate` (GNUSBridge.sol:427) |
| `@gnus.ai/contracts-upgradeable-diamond` MerkleProofUpgradeable | repo-pinned | per-signer membership vs `currentRoot` | Already used (GNUSBridge.sol:436); SPEC mandates the same sorted-pair convention |
| Solidity | 0.8.19 (exact pin, optimizer runs=1000, no viaIR) | compiler | Project standard; probe numbers measured on this pipeline |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `test/utils/bridge-certificate.ts` (existing) | — | Merkle builder (`leaf = keccak256(solidityPacked(['address']))`, sorted-pair, single-leaf `root == leaf`), struct-hash + sign + aggregate helpers | Extend with V2 variants; conventions already match the SPEC exactly |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sibling facet `GNUSBridgeAttestor` | All-in-one V2 in `GNUSBridge` | **25,772 B — 2,196 B over EIP-170** (probe-verified). Rejected. |
| Sibling facet `GNUSBridgeAttestor` | Public library (`GNUSLifecyclePolicy` linking model) for digest+verify | **24,723 B — still 147 B over** for the facet (probe-verified), requires linker generalization (FQN-hardcoded today), public library functions force calldata→memory struct copies that hit stack-too-deep, and the library boundary needs the split-encode workaround anyway. Rejected. |
| Full selector removal of legacy `bridgeIn` | Always-revert stub kept in `GNUSBridge` | Stub preserves a self-describing revert string but wastes bytecode in a size-constrained facet and keeps dead ABI surface. Removal is pre-deployment-safe (see Runtime State Inventory). Owner-visible choice — see Open Questions. |

**Installation:** none — no new packages. All dependencies are existing repo contracts/pinned packages.

**Version verification:** no new installs; `@gnus.ai/contracts-upgradeable-diamond` pinned in `package.json` (unchanged).

## Package Legitimacy Audit

No external packages are installed by this phase (contracts + tests only, all existing dependencies). Audit not applicable; no `[ASSUMED]` package claims made. The only "new" artifact is first-party source (`GNUSBridgeAttestor.sol`, test files).

## Architecture Patterns

### System Architecture Diagram

```text
                       SUPERGENIUS CHAIN (off-chain, other repo)
  eligible API attestors (slot-0 verified, #363/#364) ──sign──┐
  root construction: sorted-address merkle tree,              │
  leaf = keccak256(abi.encodePacked(addr))                    │
                                                              v
  EVM certificate: BridgeMessage + currentRoot/Epoch + nextAttestorRoot
  + per-signer (65B r‖s‖v EIP-191 sig, low-s) + per-signer merkle proof
                                                              │
     anyone (permissionless relay, D-09)                       v
  ┌─────────────────────────────────────────────────────────────────┐
  │ GeniusDiamond (proxy)                                           │
  │  ┌──────────────────────┐        ┌───────────────────────────┐  │
  │  │ GNUSBridge (B1)      │        │ GNUSBridgeAttestor (B2)   │  │
  │  │ bridgeOut + D-24     │        │ initializeBridgeAttestorV2│  │
  │  │ policy gate, limiter │        │ bridgeIn (V2, 0x4d2e0756) │  │
  │  │ mint/burn, ERC20     │        │ emergencyRecoverAttestorSet │  │
  │  │ (legacy bridgeIn +   │        │ setBridgeAttestorActive-  │  │
  │  │  setValidatorSet     │        │  Threshold                │  │
  │  │  DELETED)            │        │  ▼ writes ▼               │  │
  │  └──────────┬───────────┘        └───────────┬───────────────┘  │
  │             │  shared diamond storage (no sibling calls)        │
  │             ▼                                ▼                  │
  │  GNUSBridgeValidatorStorage.Layout (appended, BRIDGE-10)        │
  │   slot0 processedMessages │ slot1/2 legacy (frozen, dead)       │
  │   slot3 bridgeAttestorRoot │ slot4 epoch+init │ slot5 threshold │
  │  GNUSControlStorage.paused / chainID  (shared reads)            │
  │  GNUSTreasuryStorage.globalSupply / chainSupply (B2 inline fee) │
  └─────────────────────────────────────────────────────────────────┘
       bridgeIn flow: pause→init→dest/msg→replay→digest→cert-verify
       → [replay-mark + root/epoch update] → _mintWithBridgeFee → BridgeReleased
                        (CEI: state writes strictly before mint)
```

### Recommended Project Structure

```text
contracts/gnus-ai/
├── GNUSBridge.sol                 # B1: legacy bridge-in block DELETED; bridgeOut/policy/mint/burn stay
├── GNUSBridgeAttestor.sol         # B2: NEW sibling facet — entire V2 bridge-in surface
└── GNUSBridgeValidatorStorage.sol # BRIDGE-10 append (4 new fields, slots 3/4/5)
diamonds/GeniusDiamond/geniusdiamond.config.json  # register GNUSBridgeAttestor @ priority 116, versions["2.6"]
test/unit/GNUSBridgeAttestorIn.test.ts  # V2 matrix (BRIDGE-19) + vectors (BRIDGE-18)
test/unit/GNUSBridgeIn.test.ts          # REWORKED legacy suite (removal/revert + carried semantics)
test/utils/bridge-certificate.ts        # extended with V2 digest/message helpers
test/fixtures/bridge-attestor-vectors.json  # checked-in cross-language vectors (BRIDGE-18)
test/foundry/handlers/GeniusDiamondHandler.sol  # V2 handlers
test/foundry/invariant/BridgeInvariant.t.sol    # extended root-transition invariants
```

### Pattern 1: Sibling facet with inline replication (the B strategy)

**What:** `GNUSBridgeAttestor` inherits `GNUSERC1155MaxSupply, GeniusAccessControl` (GNUSRedeemAdapter shape: own `supportsInterface` override, own `_mint` override with no receiver hook, own local `Transfer` event declaration) and carries an inline replica of `_mintWithBridgeFee`.
**When to use:** whenever one facet's responsibility outgrows EIP-170.
**Why here (measured):**

| Contract | Deployed size | EIP-170 verdict |
|----------|--------------|-----------------|
| `GNUSBridge` (current, develop) | **23,276 B** | 1,300 B headroom |
| Probe A: all-in-one V2 | **25,772 B** | **2,196 B OVER — fails** |
| Probe B1: bridge-in deleted | **19,938 B** | 4,638 B headroom |
| Probe B2: sibling attestor facet | **21,461 B** | 3,115 B headroom |
| Probe C1: facet w/ library stubs | **24,723 B** | **147 B OVER — fails** |
| Probe C-lib | 2,799 B | (facet still fails) |

[VERIFIED: local `npx hardhat compile` probe, production settings (0.8.19, optimizer 1000, no viaIR, evm paris), 2026-08-26. Probe sources deleted after measurement; regenerate via the split-encode/B2 shapes in §Code Examples. B2 measurement includes the inline `_mint`, `_mintWithBridgeFee`, `supportsInterface`, and all four V2 events; real-impl view getters (~+300-450 B) still leave >2.5 KB headroom.]
**Rule honored:** sibling facets never call each other — state is shared only through diamond storage; the fee-mint replica follows the `GNUSRedeemAdapter._mint` / Phase-14 `_isExpired` duplication precedents [VERIFIED: 14-PATTERNS.md:81,179].

### Pattern 2: Split-encode digest (MANDATORY — compiler constraint)

**What:** compute the `BRIDGE_CERTIFICATE_V2` struct hash as `keccak256(bytes.concat(abi.encode(group1), abi.encode(group2), abi.encode(group3)))` instead of one flat 13-argument `abi.encode`.
**Why:** the flat form hits `CompilerError: Stack too deep` under Solidity 0.8.19 + optimizer(1000) + no viaIR in **every** facet shape probed (the sibling's inheritance frame and the library's memory-copy boundary both overflow; the all-in-one overflowed once sibling errors cleared). The split form compiles everywhere.
**Correctness:** every digest field is a value type occupying exactly one 32-byte word (`bytes32`/`uint256`/`uint64`-padded/`address`), so per-group `abi.encode` concatenated is **byte-identical** to the flat encode. Equivalence is load-bearing for the C++ exporter (which will compute the flat form) and MUST be proven by the BRIDGE-18 vectors (off-chain flat compute ↔ on-chain split compute → successful verify) plus an explicit unit test asserting `keccak256(concat) == keccak256(flat)` in TS.
[VERIFIED: probe compile failures at the flat encode; split form compiled and measured.]

### Pattern 3: Registry-diff selector removal (upgrade mechanics)

**What:** deleting `bridgeIn`/`setValidatorSet` from `GNUSBridge` source and redeploying the facet makes `@geniusventures/diamonds` emit Remove cuts automatically: the function-selector registry (seeded from `deployedDiamondData` `FacetDeployedInfo`) keeps the old facet address for selectors absent from the new ABI, and `updateFunctionSelectorRegistryTasks`'s "Remove Old Function Selectors from facets" pass converts them to `action: Remove` [VERIFIED: node_modules/@geniusventures/diamonds/dist/strategies/BaseDeploymentStrategy.js:322-336].
**Config change needed:** only the ADD side — register `GNUSBridgeAttestor` (priority 116, `versions["2.6"]: { fromVersions: [0.0, 2.4, 2.5] }` matching the GNUSRedeemAdapter 2.6 pattern). `GNUSBridge` already has a `2.6` entry; its recompile produces a new address → Replace for surviving selectors, Remove for deleted ones.
**Inherited-function collisions** (the sibling inherits `balanceOf`, `hasRole`, `safeTransferFrom`, … from shared bases): resolved by priority — the registry only re-assigns a selector to a new facet when the new facet's priority number is LOWER than the existing owner's; at 116 the sibling never steals from GNUSBridge (115) or GNUSNFTFactory (40) [VERIFIED: BaseDeploymentStrategy.js priority-resolution pass]. Empirically proven by GNUSRedeemAdapter/GNUSLifecycle/GNUSLicensing (118-123) coexisting on the same bases in every local 2.6 deploy. `deployExclude`/`deployInclude` remain available if a specific inherited selector must be excluded (precedent: `geniusdiamond-erc1155override.config.json` moved `isApprovedForAll` GNUSNFTFactory→ERC1155ProxyOperator).

### Pattern 4: Storage append with explicit slot map

Append to `GNUSBridgeValidatorStorage.Layout` — never reorder or retype slots 0-2:

| Slot | Field | Type | Notes |
|------|-------|------|-------|
| 0 | `processedMessages` | `mapping(bytes32 => bool)` | existing (D-07); key derivation changes to messageId (BRIDGE-12) |
| 1 | `validatorMerkleRoot` | `bytes32` | existing — FROZEN, dead once V2 active |
| 2 | `validatorThreshold` | `uint256` | existing — FROZEN, dead once V2 active |
| 3 | `bridgeAttestorRoot` | `bytes32` | one-leaf genesis root = `keccak256(abi.encodePacked(genesisAttestor))` |
| 4 | `bridgeAttestorEpoch` (offset 0) + `bridgeAttestorV2Initialized` (offset 8) | `uint64` + `bool` | packs into one slot |
| 5 | `activeAttestorThreshold` | `uint256` | PD-BR-2 revised; `0` ⇒ SPEC default 2 while unset |

[VERIFIED: probe storage library compiled; packing follows Solidity slot rules for uint64+bool.]

### Anti-Patterns to Avoid

- **Keeping both bridgeIn paths live** — the legacy selector alongside V2 bypasses the rolling-root design (SPEC lines 598-600). Remove or stub; never register both.
- **Verifying signers against `nextAttestorRoot`** — newly accepted attestors must NOT authorize the certificate that installs them (SPEC line 349, 452).
- **Letting the certificate choose its threshold** — threshold is epoch-derived + superAdmin-override only (SPEC line 199).
- **Flat 13-field `abi.encode` in the digest** — stack-too-deep in this compiler configuration (Pattern 2).
- **Registering the new facet with a priority below 115** — would re-assign shared inherited selectors (balanceOf, hasRole, …) to `GNUSBridgeAttestor` and break the loupe uniqueness the 13-06 collision test asserts.
- **Resetting `bridgeAttestorV2Initialized` in emergency recovery** — the one-time flag never resets; recovery installs a new root at epoch+1, never re-enters Genesis bootstrap.
- **Writing root/epoch after the mint** — CEI requires replay-mark + root transition BEFORE `_mintWithBridgeFee` (BRIDGE-15); a reverting mint must revert the root transition atomically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ECDSA recovery + canonical checks | custom ecrecover assembly | `ECDSAUpgradeable.tryRecover` (+ require NoError) | malleability/canonical-form edge cases; already the repo standard |
| Merkle membership | custom tree verify | `MerkleProofUpgradeable.verify` | sorted-pair convention must match the SG exporter exactly |
| EIP-191 wrapping | manual `"\x19Ethereum Signed Message"` concat | `ECDSAUpgradeable.toEthSignedMessageHash` | identical to Phase 10 path; SG exporter parity depends on it |
| Diamond selector diff/removal | hand-built diamondCut arrays | `@geniusventures/diamonds` registry diff | verified Remove/Replace/Add emission (Pattern 3) |
| Fee/cap/supply mint logic in B2 | novel mint path | inline replica of `_mintWithBridgeFee` verbatim | replica must stay byte-for-byte semantics-identical; drift = forked fee behavior (documented duplication risk, see Pitfall 1) |

**Key insight:** every cryptographic primitive here already ships in the pinned `@gnus.ai` upgradeable-diamond package and is exercised by Phase 10 tests; the only new "mechanism" is the rolling-root state machine, which is 40 lines of requires and two storage writes.

## Runtime State Inventory

> Phase 15 includes selector removal (rename/refactor-class work), so all five categories were explicitly audited.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `GNUSBridgeValidatorStorage` diamond slots on live networks: **legacy `validatorMerkleRoot`/`validatorThreshold`/`processedMessages` are unset everywhere** — sepolia (the only recorded deployment, protocolVersion 2.5) does NOT have `bridgeIn` (0x0bee6121) or `setValidatorSet` (0x1abd0f1e) in its registered `GNUSBridge.funcSelectors` [VERIFIED: diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155111.json decoded against the current artifact ABI]. No mainnet/production deployment exists. | **None — no data migration.** V2 fields initialize from zero; legacy fields stay frozen at zero (dead-on-arrival, exactly the BRIDGE-10 end state). A storage-upgrade test still must prove existing state decodes (SC1). |
| Live service config | `diamonds/GeniusDiamond/deployments/*.json` record facet history (seeds the upgrade registry); `encoded-cuts/` + `safe-proposals/` hold historical Phase-11-era artifacts; sepolia diamond loupe still exposes the 2.5 surface. | Code edit only (config: add `GNUSBridgeAttestor`). The registry diff computes Remove cuts for the two deleted selectors — but they are **not yet present on sepolia**, so the 2.5→2.6 upgrade adds them via the new shape directly (nothing to remove on-chain yet). |
| OS-registered state | None — no OS tasks/services reference bridge selectors. | None — verified by inspection of repo scope (contracts + tests only). |
| Secrets/env vars | None — bridge paths use no secrets; SG-side keys live in the SuperGenius repo. | None. |
| Build artifacts | `artifacts/`, `typechain-types/`, `diamond-abi/` (generated, git-ignored); known-stale regeneration pitfall documented in 13-06 (Rule 3: identical double `generate-abi-typechain` runs break the typechain index — use `yarn clean-compile` when it recurs). | Regenerate after adding the facet; expect `GeniusDiamond` typechain to gain the V2 signatures. |

**Canonical question answer:** after every repo file is updated, the only systems still holding the old shape are (a) the generated typechain (regenerated by compile) and (b) the SG-side exporter — which is precisely the parallel SuperGenius work tracked by BRIDGE-17 and the PD-BR-3 accepted divergence.

## Common Pitfalls

### Pitfall 1: Fee-mint replica drift (B strategy)
**What goes wrong:** `GNUSBridge._mintWithBridgeFee` and the `GNUSBridgeAttestor` inline copy diverge in a later phase (fee math, WR-02/WR-04 guards, cap hooks).
**Why it happens:** two copies of load-bearing economics; future editors see only one.
**How to avoid:** copy VERBATIM with a cross-reference comment naming the twin in both files; add a paired test asserting identical post-fee amounts through `mint()` and `bridgeIn` (the existing fee tests port to both paths).
**Warning signs:** a fee/cap PR touches only one facet.

### Pitfall 2: Stack-too-deep on the digest (compiler)
**What goes wrong:** the flat 13-field `abi.encode` compiles in one facet frame but not another (it failed in the sibling and the library after passing initially in isolation contexts).
**How to avoid:** use the split-encode (Pattern 2) unconditionally; add the TS equivalence test; do not "fix" by reordering fields — field order is protocol.
**Warning signs:** any PR touching digest fields failing with `CompilerError: Stack too deep`.

### Pitfall 3: Merkle proof conventions
**What goes wrong:** leaf padded via `abi.encode` (32-byte) instead of `abi.encodePacked` (20-byte) — Phase 10 Pitfall 3, still live; or unsorted-pair hashing that mismatches `MerkleProofUpgradeable`.
**How to avoid:** reuse `buildValidatorMerkleTree` (already correct); vectors prove it cross-language.
**Warning signs:** valid certificate reverting "Not a registered attestor".

### Pitfall 4: Emergency recovery while unpaused / restoring Genesis
**What goes wrong:** superAdmin silently rotates the root during normal operation (recreates the admin-trust model Phase 15 removes), or recovery sets epoch 0.
**How to avoid:** require `GNUSControlStorage.layout().paused` AND always write `epoch = oldEpoch + 1` (post-state can never be epoch 0, structurally satisfying "never restores Genesis"); emit the reset event; tests cover both.
**Warning signs:** any path writing `bridgeAttestorEpoch` without the +1, or an emergency function without the paused require.

### Pitfall 5: Genesis mode persistence
**What goes wrong:** epoch 0 keeps signing claims with `nextAttestorRoot == currentRoot`, permanently in 1-of-1 mode.
**How to avoid:** the `currentEpoch == 0 → require(nextAttestorRoot != currentRoot)` gate (SPEC lines 341-347, 512-518); dedicated bootstrap tests.
**Warning signs:** a bridgeIn test that succeeds at epoch 0 without a root change.

### Pitfall 6: In-flight certificates invalidated by rotation/emergency
**What goes wrong:** certificates signed against an old root fail after any root change (routine or emergency) — relayers hold now-invalid certificates.
**Why:** accepted risk (same as Phase 10 T-10-13; D-05 allows re-signing).
**How to avoid:** document in the security note; emit `BridgeAttestorSetAdvanced`/`BridgeAttestorEmergencyReset` so monitors can detect and re-request signatures.

### Pitfall 7: Stale test/typechain baselines
**What goes wrong:** plans quote stale sizes/counts (13-06 documented 22,711 B; reality is now 23,276 B after Phase 14 D-24 additions).
**How to avoid:** measure at execution time (the 13-06 node one-liner); hardhat baseline 606/2/1 (known-stale `GNUSControlStorage` chainID cross-suite pollution), Foundry 215/2/3 (known-stale Phase 08.1 Safe-proposer setUp reverts) — deltas, not absolutes, are the gate.

### Pitfall 8: Merkle gas at the 16-signature cap
**What goes wrong:** full 16-signature certificates with 4-deep proofs cost noticeably more than Phase 10's 2-of-3 (~roughly 150-250k gas total [ASSUMED — estimate, not measured]; each `tryRecover` ~3k + proof hashing per level).
**How to avoid:** acceptable by design (cap is the bound); record gas in the test matrix so regressions are visible.

## Code Examples

### The V2 digest (split-encode — from the compiled probe)

```solidity
// Source: docs/Secure-BridgeIn.md:357-395 (field order) + probe-verified split-encode
function _bridgeInDigestV2(
    BridgeMessage calldata message,
    bytes32 currentAttestorRoot,
    uint64 currentAttestorEpoch,
    bytes32 nextAttestorRoot
) internal view returns (bytes32) {
    // Split-encode: byte-identical to the flat 13-field abi.encode (every field is one
    // 32-byte word) — required to stay under the 0.8.19 stack limit (no viaIR).
    bytes32 structHash = keccak256(
        bytes.concat(
            abi.encode(BRIDGE_CERTIFICATE_V2, currentAttestorEpoch, currentAttestorRoot, nextAttestorRoot),
            abi.encode(message.srcChainID, message.sourceBridgeID, message.sourceTxHash, message.sourceEventIndex),
            abi.encode(block.chainid, address(this), message.recipient, GNUS_TOKEN_ID, message.amount)
        )
    );
    return ECDSAUpgradeable.toEthSignedMessageHash(structHash);
}
```

### Certificate verification (compiled probe body)

```solidity
// Source: docs/Secure-BridgeIn.md:415-458; body mirrors GNUSBridge.sol:415-443 conventions
function _verifyBridgeAttestorCertificate(
    bytes32 digest,
    bytes32 currentRoot,
    uint256 requiredSignatures,
    bytes[] calldata signatures,
    bytes32[][] calldata merkleProofs
) internal view {
    require(signatures.length == merkleProofs.length, "Sig/proof length mismatch");
    require(signatures.length >= requiredSignatures, "Below threshold");
    require(signatures.length <= MAX_ATTESTOR_SIGNATURES, "Too many attestor signatures");
    address lastSigner = address(0);
    for (uint256 i = 0; i < signatures.length; ++i) {
        (address signer, ECDSAUpgradeable.RecoverError err) = ECDSAUpgradeable.tryRecover(digest, signatures[i]);
        require(err == ECDSAUpgradeable.RecoverError.NoError, "Bad signature");
        require(signer > lastSigner, "Signers not strictly ascending");
        lastSigner = signer;
        bytes32 leaf = keccak256(abi.encodePacked(signer)); // 20-byte packed (Pitfall 3)
        require(MerkleProofUpgradeable.verify(merkleProofs[i], currentRoot, leaf), "Not a registered attestor");
    }
}
```

### bridgeIn ordering (BRIDGE-15 / CEI)

```solidity
// Source: docs/Secure-BridgeIn.md:476-567 — compiled in probe B2
require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused"); // D-20/D-21 first
// ... init/dest/message/replay requires; epoch-0 advance gate ...
bytes32 digest = _bridgeInDigestV2(message, currentRoot, currentEpoch, nextAttestorRoot);
_verifyBridgeAttestorCertificate(digest, currentRoot, _bridgeAttestorThreshold(currentEpoch), signatures, merkleProofs);
v.processedMessages[messageId] = true;               // effects BEFORE mint (CEI)
if (nextAttestorRoot != currentRoot) {
    v.bridgeAttestorRoot = nextAttestorRoot;          // root transition BEFORE mint
    v.bridgeAttestorEpoch = currentEpoch + 1;         // exactly one
    emit BridgeAttestorSetAdvanced(currentEpoch, currentEpoch + 1, currentRoot, nextAttestorRoot);
}
_mintWithBridgeFee(message.recipient, GNUS_TOKEN_ID, message.amount); // inline replica in B2
emit BridgeReleased(messageId, message.recipient, message.amount, message.srcChainID, block.chainid);
```

### Emergency recovery (PD-BR-6 revised, compiled in probe)

```solidity
function emergencyRecoverAttestorSet(bytes32 newRoot) external onlySuperAdminRole {
    require(GNUSControlStorage.layout().paused, "GNUSControl: contract must be paused");
    require(newRoot != bytes32(0), "Invalid recovery root");
    GNUSBridgeValidatorStorage.Layout storage v = GNUSBridgeValidatorStorage.layout();
    uint64 oldEpoch = v.bridgeAttestorEpoch;
    bytes32 oldRoot = v.bridgeAttestorRoot;
    v.bridgeAttestorRoot = newRoot;
    v.bridgeAttestorEpoch = oldEpoch + 1; // post-state can NEVER be epoch 0 — Genesis unrecoverable
    emit BridgeAttestorEmergencyReset(oldEpoch, oldEpoch + 1, oldRoot, newRoot);
}
```

### Selectors (computed, for tests/config)

```text
0x4d2e0756  bridgeIn((uint256,bytes32,bytes32,uint256,address,uint256),bytes32,bytes[],bytes32[][])
0x8c864f52  initializeBridgeAttestorV2(address)
0x604c3b10  setBridgeAttestorActiveThreshold(uint256)
0x669588d5  emergencyRecoverAttestorSet(bytes32)
0x0bee6121  bridgeIn(bytes32,uint256,address,uint256,bytes[],bytes32[][])   ← legacy, REMOVE
0x1abd0f1e  setValidatorSet(bytes32,uint256)                                 ← legacy, REMOVE
```
[VERIFIED: ethers `id()` selector computation, 2026-08-26]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static validator root + `setValidatorSet` (Phase 10 D-15/D-16) | Rolling attestor root rotated as a `bridgeIn` side-effect (PD-BR-1) | SPEC 2026-08-23; owner-scheduled 2026-08-26 | Routine rotation no longer admin-only; admin path becomes paused-gated emergency only |
| Free-form `transferId` replay key (D-06) | Canonical `BridgeMessage` composite ID incl. `sourceEventIndex` (BRIDGE-12) | SPEC | Same-tx multi-event bridging becomes representable; SG-side replay key alignment diverges (accepted, PD-BR-3) |
| 7-field digest (D-08/D-10) | `BRIDGE_CERTIFICATE_V2` 13-field domain-separated digest | SPEC | Certificates now bind the root transition — cross-root replay impossible |
| Operator-chosen threshold (D-12) | Epoch-derived defaults (1/2/16-cap) + superAdmin override | PD-BR-2 revised 2026-08-26 | Certificates cannot pick their own difficulty |

**Deprecated/outdated:** `setValidatorSet` as routine rotation (replaced by `emergencyRecoverAttestorSet`); `ValidatorSetUpdated` event (superseded by the V2 event set); `BridgeReleased.transferId` parameter semantics (same event signature, re-keyed to messageId — keep the signature byte-identical for off-chain monitors, rename only in docs).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 16-signature certificate gas ≈ 150-250k | Pitfall 8 | Minor — budget/planning only; measure in the test matrix |
| A2 | View getters (~+300-450 B) fit B2's headroom | Pattern 1 | Minimal — 3,115 B headroom vs ~450 B addition |
| A3 | `GNUSControl.emergencyPause()` is the pause lever intended for the emergency-recovery precondition | Owner Decisions / Pitfall 4 | Low — pause access verified onlySuperAdminRole [VERIFIED: GNUSControl.sol:70]; if a separate guardian-pause path exists it does not change the contract-side require |
| A4 | `tryRecover` + `require(err == NoError)` compiles in the real B2 exactly as in the probe | Code Examples | Low — probe B2 compiled with this exact body; stack pressure is frame-sensitive so a recompile check belongs in Wave 0 of implementation |

**Everything else in this research is VERIFIED (local probe/compile/codebase/framework-source) or CITED (docs/Secure-BridgeIn.md, decisions.md, planning artifacts).**

## Open Questions

1. **Active-threshold bounds in `setBridgeAttestorActiveThreshold`** (PD-BR-2 revised allows override but does not set bounds)
   - What we know: SPEC fixes GENESIS=1, ACTIVE=2, MAX=16; owner allows a superAdmin override with genesis pinned at 1.
   - What's unclear: whether the override may go below 2 (a 1-of-N active threshold would recreate single-signer risk under superAdmin control) or above 16 (unusable — cert cap rejects it anyway).
   - Recommendation: enforce `newThreshold >= ACTIVE_ATTESTOR_THRESHOLD (2)` AND `<= MAX_ATTESTOR_SIGNATURES (16)`; reverts "Active threshold below floor" / "Active threshold above signature cap" (probe implements exactly this).
2. **Genesis bootstrap wiring on upgrade**
   - What we know: `initializeBridgeAttestorV2(genesisAttestor)` is one-time, onlySuperAdminRole; the genesis address is an out-of-band owner input; fresh 2.6 local deploys would auto-run any configured `deployInit`.
   - What's unclear: whether the owner wants config `upgradeInit`/`deployInit` wiring (requires hardcoding the genesis address in `geniusdiamond.config.json` — it would also execute automatically on every new-chain deploy).
   - Recommendation: NO config init — manual superAdmin call after the cut, documented in the deployment runbook; keeps the genesis address out of the repo and the operator in the loop.
3. **Legacy `bridgeIn`: full selector removal vs always-revert stub**
   - What we know: SPEC allows either; removal is automatic via the registry diff; a stub keeps a self-describing revert but costs bytecode and ABI surface in the size-constrained facet; no live chain has the selector yet.
   - Recommendation: full removal (delete from source; nothing to remove on sepolia; future callers get the diamond fallback revert). Choose the stub only if the owner wants an explicit "use V2 bridgeIn" revert message.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | hardhat pipeline | ✓ | v24.13.0 [VERIFIED: probe runs] | — |
| Hardhat + pinned deps | compile/test | ✓ | repo `package.json` pinning (compile ran clean) | — |
| `@geniusventures/diamonds` + `@geniusventures/hardhat-diamonds` 1.1.15-gv.2 | facet registration/upgrade diff | ✓ | installed; Remove/Replace/Add logic verified in source | — |
| Foundry (`yarn forge:test`) | invariant suite | ✓ | per repo baseline 215/2/3 | — |
| SuperGenius exporter (C++ parity) | BRIDGE-18 C++ side | ✗ (separate repo) | — | EVM-side fixed vectors checked in here; C++ parity is SuperGenius-repo work (BRIDGE-17 posture: parallel, non-blocking) |

**Missing dependencies with no fallback:** none for this repo's scope.
**Missing dependencies with fallback:** C++ parity (covered by checked-in vectors; production activation gated on BRIDGE-17 anyway).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Hardhat/mocha (unit) + Foundry via `yarn forge:test` (invariants) |
| Config file | `hardhat.config.ts` (0.8.19, optimizer 1000) / `test/foundry/GeniusDiamond.forge.config.json` |
| Quick run command | `npx hardhat test test/unit/GNUSBridgeAttestorIn.test.ts` |
| Full suite command | `npx hardhat test && yarn forge:test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRIDGE-10 | storage append decodes; legacy slots frozen | unit (storage probe, Phase-9 pattern) | `npx hardhat test test/unit/GNUSBridgeAttestorIn.test.ts` | ❌ Wave 0 |
| BRIDGE-11 | bootstrap matrix (7 SPEC rows) | unit | same | ❌ Wave 0 |
| BRIDGE-12 | messageId derivation + same-tx event-index disambiguation | unit | same | ❌ Wave 0 |
| BRIDGE-13 | digest domain binding (chain/diamond/recipient/amount/root/epoch) | unit | same | ❌ Wave 0 |
| BRIDGE-14 | verify matrix (8 SPEC rows) | unit | same | ❌ Wave 0 |
| BRIDGE-15 | CEI atomicity (failed mint reverts root+replay) | unit + invariant | unit: same; invariant: `yarn forge:test` | ❌ Wave 0 |
| BRIDGE-16 | legacy selector gone/reverts; emergency shape (paused/superAdmin/epoch+1/never-genesis/event) | unit | same | ❌ Wave 0 (rewrite of `GNUSBridgeIn.test.ts`) |
| BRIDGE-17 | production-gate tracking (docs only) | manual-only | — | n/a (external, documented in SUBREPOS.md when scheduled) |
| BRIDGE-18 | cross-language vectors consumed + parity assertions | unit | same (+ `test/fixtures/bridge-attestor-vectors.json`) | ❌ Wave 0 |
| BRIDGE-19 | full matrix incl. carried token behavior (fee/cap/supply/pause) | unit | same + `npx hardhat test test/unit/GNUSBridgeIn.test.ts` (reworked) | partial — rework Wave 0 |

### Sampling Rate
- **Per task commit:** the file-scoped `npx hardhat test test/unit/<file>.test.ts` for touched suites + `yarn compile` size print (EIP-170 gate: `GNUSBridge ≤ 24,576` AND `GNUSBridgeAttestor ≤ 24,576`).
- **Per wave merge:** `npx hardhat test && yarn forge:test`.
- **Phase gate:** full suite green vs baselines (Hardhat 606/2/1 known-stale chainID; Foundry 215/2/3 known-stale 08.1 setUp) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `test/unit/GNUSBridgeAttestorIn.test.ts` — V2 matrix (BRIDGE-10..16, 18, 19)
- [ ] rework `test/unit/GNUSBridgeIn.test.ts` — legacy-path tests rewritten to expect removal/revert; carried semantics (fee/cap/pause/replay) re-keyed to V2; `setValidatorSet` block rewritten for the emergency-recovery shape
- [ ] extend `test/utils/bridge-certificate.ts` — V2 digest/messageId helpers + genesis/root-transition tree builders
- [ ] `test/fixtures/bridge-attestor-vectors.json` + generator test (BRIDGE-18)
- [ ] foundry: update `GeniusDiamondHandler.handler_bridgeIn` selector string to `0x4d2e0756` shape (struct-encoding via `abi.encodeWithSelector` + tuple) and add V2 handlers; extend `BridgeInvariant.t.sol`
- [ ] config: register `GNUSBridgeAttestor` (priority 116, `versions["2.6"]`) — regenerates diamond-abi typechain
- Framework install: none needed (existing infrastructure covers all phase requirements)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no user auth on-chain | certificate = authorization (D-09 permissionless relay) |
| V3 Session Management | n/a | replay protection via `processedMessages` (D-07) |
| V4 Access Control | yes | `onlySuperAdminRole` on init/threshold-override/emergency (GeniusAccessControl); paused-gate on emergency |
| V5 Input Validation | yes | explicit requires on all BridgeMessage fields, nextRoot, lengths, cap |
| V6 Cryptography | yes | `ECDSAUpgradeable` + `MerkleProofUpgradeable` — never hand-roll |

### Known Threat Patterns for diamond bridge-in facets

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Certificate replay (same event twice) | Tampering | composite messageId + `processedMessages` (BRIDGE-12) |
| Cross-chain / cross-diamond replay | Tampering | `block.chainid` + `address(this)` in digest (D-08/D-10 carried) |
| Rogue attestor (in next root, not current) | Elevation | proofs verified against `currentRoot` ONLY (SPEC 349) |
| Duplicate/confused-deputy signer | Spoofing | strictly-ascending recovered addresses (D-13/PD-BR-5) |
| Threshold manipulation | Elevation | epoch-derived threshold; certificate cannot choose (SPEC 199) |
| Genesis-mode persistence | Elevation | epoch-0 must-advance gate (SPEC 341-347) |
| Admin silent rotation while live | Tampering | emergency path requires paused + superAdmin + event (PD-BR-6) |
| Failed-mint partial state | Tampering | CEI — root+replay writes before mint; atomic revert (BRIDGE-15) |
| Native SG signature confusion | Spoofing | PD-BR-7: 65-byte EIP-191-only; native vote-bytes signature test must fail |

## Sources

### Primary (HIGH confidence)
- `docs/Secure-BridgeIn.md` — THE SPEC (784 lines; digest 357-395, verify 415-458, bridgeIn 476-567, removal 583-618, tests 654-727, non-goals 729-742)
- Local compile probe (this session, 2026-08-26) — deployedBytecode measurements for strategies A/B1/B2/C1/C-lib; stack-too-deep findings; production compiler settings
- `contracts/gnus-ai/GNUSBridge.sol` (develop) — 23,276 B artifact measure; bridge-in block at :367-508; `_enforceBridgePolicy` D-24 at :312-365; `_mintWithBridgeFee` at :127-153
- `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol` — current 3-field layout
- `node_modules/@geniusventures/diamonds/dist/strategies/BaseDeploymentStrategy.js:200-340` — registry diff (deployExclude, priority resolution, auto-Remove, deleted-facet Remove)
- `scripts/setup/RPCDiamondDeployer.ts:274-366` — FacetDeployedInfo registry seeding for upgrade diffs
- `diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155111.json` — sepolia at 2.5; legacy selectors absent on-chain
- `.planning/intel/decisions.md:74-159` — PD-BR-1..8 + 2026-08-26 owner rulings
- `.planning/phases/10-lock-release-bridge-vault/10-CONTEXT.md` — D-01..D-22
- `test/utils/bridge-certificate.ts` — existing merkle/sign conventions (single-leaf root==leaf, sorted pairs, 20-byte packed leaves)
- `contracts/gnus-ai/GNUSLifecyclePolicy.sol` + `scripts/utils/GNUSLifecyclePolicyLinking.ts` — library linking model (rejected here, documented)

### Secondary (MEDIUM confidence)
- `test/foundry/handlers/GeniusDiamondHandler.sol:36-47,396-470` + `test/foundry/invariant/BridgeInvariant.t.sol` — ghost-variable invariant pattern to extend
- `.planning/phases/13-time-bound-erc1155-entitlements/13-06-PLAN.md` / `13-06-SUMMARY.md` — size-verification one-liner, selector-collision loupe test, stale-baseline discipline
- `diamonds/GeniusDiamond/geniusdiamond-erc1155override.config.json` — deployInclude/deployExclude selector-migration precedent
- Repo test baselines (Hardhat 606/2/1, Foundry 215/2/3) as provided by the phase orchestrator, consistent with 13-06/14-04 records

### Tertiary (LOW confidence)
- None — no WebSearch-derived claims used

## Metadata

**Confidence breakdown:**
- Facet strategy / EIP-170: HIGH — measured by compiling all three strategies with production settings; decisive margins (2,196 B / 147 B over vs 3,115 B headroom)
- Upgrade/selector mechanics: HIGH — read from framework source + sepolia deployment data + override-config precedent
- Digest/verify/bootstrap logic: HIGH — SPEC-cited and probe-compiled; A4 flags frame-sensitivity as a Wave-0 recompile check
- Test break analysis: HIGH — 21 references located in exactly one Hardhat file + two Foundry files
- Gas estimates: LOW (A1) — flagged, measure in tests

**Research date:** 2026-08-26
**Valid until:** 2026-09-25 (stable domain; re-verify bytecode numbers if Phase 14 follow-ups land first — Pitfall 7)
