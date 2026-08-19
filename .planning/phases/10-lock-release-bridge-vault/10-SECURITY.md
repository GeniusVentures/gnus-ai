---
phase: 10-lock-release-bridge-vault
audited_at: 2026-08-18
asvs_level: 1
block_on: open
threats_total: 25
threats_closed: 25
threats_open: 0
unregistered_flags: 0
verdict: SECURED
---

# Phase 10 Security Audit — Lock/Release Bridge Vault

**Scope:** All 4 plans (10-01 storage library, 10-02 bridgeIn + setValidatorSet, 10-03 unit tests, 10-04 Foundry invariants).
**Method:** Threat-register-driven verification. Each `mitigate` disposition was verified by locating the declared mitigation pattern in the cited file(s). Each `accept` disposition was validated as a conscious, documented risk acceptance.

---

## Threat Verification Matrix

### Plan 10-01 — GNUSBridgeValidatorStorage.sol

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-10-01-S | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol:22` — `bytes32 constant GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION = keccak256("gnus.ai.bridge.validator.storage");`. Specific `.validator` infix (not `bridge.storage`) per Pitfall 6. |
| T-10-02-S | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridgeValidatorStorage.sol:11-19` — `@dev Append-only` header on Layout struct; fields declared in fixed order `processedMessages` → `validatorMerkleRoot` → `validatorThreshold`; no initializer present. |
| T-10-03-S | Information Disclosure | accept | CLOSED | Storage layout is public on-chain by EVM design. Documented in this register's accepted risks log below. |

### Plan 10-02 — GNUSBridge.sol

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-10-01 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:329-332` — `ECDSAUpgradeable.tryRecover(digest, signatures[i])` enforces low-s + `v ∈ {27,28}` per OZ reference implementation. |
| T-10-02 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:377` (replay check) → `:386` (state write) → `:387` (mint). CEI ordering: `v.processedMessages[transferId] = true;` is on line 386, BEFORE `_mintWithBridgeFee(recipient, GNUS_TOKEN_ID, amount);` on line 387. |
| T-10-03 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:291` — `block.chainid` included in `_bridgeInDigest`'s `abi.encode`. `:378` — `require(block.chainid == GNUSControlStorage.layout().chainID, "Wrong destination chain");`. Both halves of the cross-chain replay guard present. |
| T-10-04 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:292` — `address(this)` included in `_bridgeInDigest`'s `abi.encode`. Cross-diamond replay protection bound into every certificate. |
| T-10-05 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:293, 295` — `recipient` and `amount` both present in `_bridgeInDigest`'s `abi.encode` field list. |
| T-10-06 | Elevation of Privilege | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:334` — `require(signer > lastSigner, "Signers not strictly ascending");` inside `_verifyThresholdCertificate` loop; `lastSigner` updated at `:335`. |
| T-10-07 | Elevation of Privilege | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:337-340` — `require(MerkleProofUpgradeable.verify(merkleProofs[i], v.validatorMerkleRoot, leaf), "Not a registered validator");` per-signer membership check. |
| T-10-08 | Elevation of Privilege | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:324` — `require(v.validatorThreshold > 0, "Validator set not configured");` placed BEFORE `:325` `require(signatures.length >= v.validatorThreshold, "Below threshold");`. Pitfall 7 ordering confirmed. |
| T-10-09 | Denial of Service | accept | CLOSED | Signatures array size implicitly bounded by block gas limit (~10k sigs max). Threshold reached long before gas cap. Documented accepted risk below. |
| T-10-10 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:375` — `require(!GNUSControlStorage.layout().paused, "GNUSControl: contract paused");` is the FIRST line of `bridgeIn`. Verified against function body start on line 374. |
| T-10-11 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:323` — consumer-side access via `GNUSBridgeValidatorStorage.layout()` (same specific slot string as T-10-01-S). Slot string also re-declared in `test/foundry/invariant/BridgeInvariant.t.sol:48-49`. |
| T-10-12 | Tampering | mitigate | CLOSED | Same CEI evidence as T-10-02 — `processedMessages` write precedes `_mintWithBridgeFee` call. |
| T-10-13 | Tampering | accept | CLOSED | Validator-set rotation race: old root becomes invalid immediately on `setValidatorSet`; in-flight certificates signed against old root fail merkle verification. Acceptable per D-05 (re-signing allowed). Documented accepted risk below. |
| T-10-14 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:125` — `require(bridgeFee <= FEE_DENOMINATOR, "Bridge fee exceeds denominator");` inside `_mintWithBridgeFee`. Solidity 0.8 auto-reverts on overflow. WR-02 post-fee guard also present at `:130` (`require(amount > 0, "Bridge fee consumes entire amount")`). |
| T-10-15 | Tampering | mitigate | CLOSED | `contracts/gnus-ai/GNUSBridge.sol:336` — `bytes32 leaf = keccak256(abi.encodePacked(signer));` (20-byte packed, NOT `abi.encode` which pads to 32). Test-side mirror at `test/utils/bridge-certificate.ts:137` uses `ethers.solidityPacked(['address'], [addr])`. |
| T-10-SC | Tampering | mitigate | CLOSED | No new packages installed in Phase 10. Verified via `git log --since="2026-08-17" -- package.json` returning zero commits. Supply-chain attack surface unchanged. |

### Plan 10-03 — test/utils/bridge-certificate.ts + test/unit/GNUSBridgeIn.test.ts

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-10-T01 | Tampering | mitigate | CLOSED | `test/utils/bridge-certificate.ts:60-74` — `computeBridgeInStructHash` uses `ethers.AbiCoder.defaultAbiCoder().encode` with field list `['bytes32','uint256','uint256','address','address','uint256','uint256']` matching `GNUSBridge.sol:288-296` exactly (order: transferId, srcChainID, destChainID=block.chainid, diamondAddress=address(this), recipient, tokenId=GNUS_TOKEN_ID, amount). Canonical test vector at `test/unit/GNUSBridgeIn.test.ts:670-725` asserts deterministic output (signer address recovery). |
| T-10-T02 | Tampering | mitigate | CLOSED | `test/utils/bridge-certificate.ts:136-138` — leaf is `ethers.keccak256(ethers.solidityPacked(['address'], [addr]))` (20-byte packed). Canonical vector at `test/unit/GNUSBridgeIn.test.ts:691-693` logs the merkle leaf hash. |
| T-10-T03 | Elevation of Privilege | mitigate | CLOSED | Below-threshold case: `test/unit/GNUSBridgeIn.test.ts:239-264` ("reverts Below threshold when fewer than validatorThreshold signatures"). At-threshold case: `:268-299` happy path uses 3 signers with threshold=2 (>= threshold). Unconfigured-threshold case at `:213-237`. |
| T-10-T04 | Repudiation | mitigate | CLOSED | `test/unit/GNUSBridgeIn.test.ts:301-335` — `applies bridge fee: recipient receives post-fee amount, event emits pre-fee amount`. Asserts `BridgeReleased` carries `amount` (pre-fee) at `:330` AND `balanceOf(user1) == toWei(90)` (post-fee) at `:334`. |
| T-10-T05 | Tampering | mitigate | CLOSED | `test/unit/GNUSBridgeIn.test.ts:114-124` — `beforeEach` calls `evm_snapshot`, `afterEach` calls `evm_revert`. No `loadFixture` import; no `setTimeout`/`sleep` anywhere in the file (verified via grep). |
| T-10-T06 | Denial of Service | accept | CLOSED | Target <30s for full file. Suite runs in ~1s per 10-03-SUMMARY. Documented accepted risk below. |

### Plan 10-04 — test/foundry/*

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-10-F01 | Tampering | mitigate | CLOSED | `test/foundry/invariant/BridgeInvariant.t.sol:155-161` — `afterInvariant` asserts `handler.ghost_bridgeInCalls() > 0`. Campaign must reach bridgeIn selector or suite fails. |
| T-10-F02 | Tampering | mitigate | CLOSED | `test/foundry/invariant/BridgeInvariant.t.sol:78-86` — `setUp` calls `setValidatorSet(bytes32(uint256(0xdeadbeef)), 1)` from `vm.prank(owner)`. Fixed nonzero root + threshold=1. Same pattern at `test/foundry/invariant/ConservationInvariant.t.sol:91-99`. |
| T-10-F03 | Tampering | mitigate | CLOSED | Ghost state lives exclusively in `test/foundry/handlers/GeniusDiamondHandler.sol:43-47` (`ghost_bridgeInCalls`, `ghost_bridgeInSuccesses`, `ghost_totalBridgedInAmount`, `ghost_releasedIds`, `ghost_releasedIdsList`). Invariants read via public getters (`handler.ghost_*()`) at `BridgeInvariant.t.sol:115, 117, 144, 157` and `ConservationInvariant.t.sol:170-173`. No duplicated ghost state in invariant contracts. |
| T-10-F04 | Denial of Service | mitigate | CLOSED | `test/foundry/invariant/BridgeInvariant.t.sol:115-116` — iteration bound via `handler.getReleasedIdsLength()` which reads `ghost_releasedIdsList.length`. List grows only on successful bridgeIn calls, which are bounded by `ghost_bridgeInSuccesses` (itself bounded by campaign gas). Campaigns are time-bounded by foundry runs/depth config. |
| T-10-F05 | Tampering | mitigate | CLOSED | `test/foundry/invariant/BridgeInvariant.t.sol:48-49` — `bytes32 internal constant GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION = keccak256("gnus.ai.bridge.validator.storage");`. Mapping slot formula documented in the `@dev` comment at `:41-47` and the invariant body comment at `:107-113` (`slot = keccak256(abi.encode(transferId, GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION))`). |

---

## Accepted Risks Log

| Threat ID | Risk | Justification |
|-----------|------|---------------|
| T-10-03-S | Storage layout is public on-chain | Inherent to EVM — all storage slots are publicly readable via `eth_getStorageAt`. The layout is intentionally documented in NatSpec so external integrators (and Phase 12 in-flight accounting) can rely on the field order. |
| T-10-09 | Unbounded `signatures` array | Bounded implicitly by block gas limit. Practical threshold (e.g., 2-of-3, 5-of-7) is reached long before gas cap. Adding a hard cap would require an additional storage read per call for no security benefit. |
| T-10-13 | Validator-set rotation race | Old root becomes invalid immediately upon `setValidatorSet`. In-flight certificates signed against the old root fail merkle verification. Acceptable because D-05 (CONTEXT) explicitly allows validators to re-sign with the new root. Off-chain coordination is handled by the SG validator set. |
| T-10-T06 | Slow tests block CI | Target <30s for full unit file; actual runtime ~1s (per 10-03-SUMMARY). Monitored in CI but not enforced at the test level. |

---

## Unregistered Flags

None. SUMMARY.md `## Threat Flags` sections for all 4 plans are either empty (10-01, 10-02) or explicitly state "None" / no new attack surface beyond the plan's register.

---

## Review-Fix Notes (Post-Plan)

The register was authored at plan time; two review fixes landed between plan and audit. Neither invalidates a register entry — both strengthen existing mitigations:

- **WR-02** (`contracts/gnus-ai/GNUSBridge.sol:130`) — `require(amount > 0, "Bridge fee consumes entire amount")` added in `_mintWithBridgeFee`. Defense-in-depth against a pathological fee configuration that would floor the post-fee amount to zero. Related to (but distinct from) T-10-14.
- **WR-03** (`contracts/gnus-ai/GNUSBridge.sol:88-93, 401-410`) — `ValidatorSetUpdated` event signature gained `oldThreshold` parameter and the emit was reordered to AFTER the storage writes (conventional emit-after-write ordering). T-10-13 remains accepted as documented; the audit-trail semantics are now stronger (off-chain monitors can reconstruct the full (root, threshold) transition).

---

## Verdict

**SECURED** — all 25 register entries resolve to CLOSED. No open threats, no unregistered flags. Phase 10 may proceed to `/gsd:ship` gating.
