---
phase: 13-time-bound-erc1155-entitlements
reviewed: 2026-08-24T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - contracts/gnus-ai/GNUSBridge.sol
  - contracts/gnus-ai/GNUSERC1155MaxSupply.sol
  - contracts/gnus-ai/GNUSLifecycle.sol
  - contracts/gnus-ai/GNUSLifecycleMint.sol
  - contracts/gnus-ai/GNUSLifecyclePolicy.sol
  - contracts/gnus-ai/GNUSLifecycleStorage.sol
  - contracts/gnus-ai/GNUSLifecycleTypes.sol
  - contracts/gnus-ai/GNUSNFTFactory.sol
  - contracts/gnus-ai/GNUSNFTFactoryStorage.sol
  - contracts/gnus-ai/interfaces/IAllowlistRegistry.sol
  - contracts/gnus-ai/interfaces/ICredentialVerifier.sol
  - contracts/mocks/MockAllowlistRegistry.sol
  - contracts/mocks/MockCredentialVerifier.sol
  - diamonds/GeniusDiamond/geniusdiamond.config.json
  - scripts/utils/GNUSLifecyclePolicyLinking.ts
  - test/foundry/handlers/GeniusDiamondHandler.sol
  - test/foundry/invariant/LifecycleInvariant.t.sol
  - test/unit/GNUSBridgePolicy.test.ts
  - test/unit/GNUSLifecycle.test.ts
  - test/unit/GNUSLifecycleAICredits.test.ts
  - test/unit/GNUSLifecyclePolicy.test.ts
  - test/unit/GNUSLifecycleSettle.test.ts
  - test/unit/GNUSLifecycleUpgrade.test.ts
  - test/unit/GNUSNFTFactoryAntiScalping.test.ts
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: fixed
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-24
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the Phase 13 lifecycle facets, the shared hook, the linked policy library, the bridge policy gate, mocks, the linking harness, and the full test surface. The core architecture holds up under tracing: the single hook enforcement point, the single cap write point in `enforceMintGate`, the CEI clock-clear before settlement dispatch, the bridge policy-before-limiter ordering, and the D3 settle-first renewal all behave as documented and are well covered by the unit + invariant suites. No Critical findings. The findings below are edge-case correctness gaps (unvalidated enum ordinals with silent fall-through, a sale-end bypass on the legacy mint path, settlement paths that can be blocked by sibling-token gates or the transfer predicate itself), one harness defect in the library-linking cache for multi-network processes, and test-reliability/doc-drift items.

## Structural Findings (fallow)

No structural pre-pass was provided for this review.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: No enum-range validation on lifecycle ordinals — out-of-range values silently fall through as permissive

**File:** `contracts/gnus-ai/GNUSLifecycle.sol:168-208` and `contracts/gnus-ai/GNUSLifecycle.sol:318-381`
**Outcome:** fixed: contracts/gnus-ai @ 50fd9ed — range requires added in configureLifecycle + createNFTWithLifecycle; regression tests in GNUSLifecycle.test.ts (e2/e3).
**Issue:** `configureLifecycle` and `createNFTWithLifecycle` accept `cfg.expirationMode`, `cfg.transferPolicy`, and `cfg.expirationDisposition` as raw `uint8` with no upper-bound check. Every downstream consumer dispatches with `==` equality checks and falls off the end when nothing matches:
- `GNUSLifecyclePolicy.enforceTransferPolicy` (lines 143-215): `transferPolicy = 99` matches no branch and the function returns silently — an invalid policy behaves exactly like UNRESTRICTED. A creator intending SOULBOUND who fat-fingers an ordinal beyond 5 ships an unrestricted token, and because policy is immutable after first mint (Q6) it cannot be fixed without a fresh token id.
- `_isExpired` (GNUSLifecycle.sol:289-299, GNUSLifecycleMint.sol:331-341): `expirationMode >= 3` falls into the PerHolder branch — a typo is silently treated as per-holder expiry.
- `_dispatchSettlement` (GNUSLifecycleMint.sol:266-298): `expirationDisposition >= 5` emits nothing and moves nothing — `settleExpired` still clears the PerHolder clock and returns "successfully" with no `Settled` event, breaking the documented event contract.

**Fix:** In both entry points, before any writes:
```solidity
require(cfg.expirationMode <= uint8(ExpirationMode.PerHolder), "Invalid expirationMode");
require(cfg.transferPolicy <= uint8(TransferPolicy.LOCKED_AFTER_START), "Invalid transferPolicy");
require(cfg.expirationDisposition <= uint8(ExpirationDisposition.REDEEM_TO_PARENT), "Invalid disposition");
```

### WR-02: Legacy `GNUSNFTFactory.mint` path enforces validFrom but NOT the PerTokenId validUntil sale-end

**File:** `contracts/gnus-ai/GNUSLifecyclePolicy.sol:71-74`, `contracts/gnus-ai/GNUSNFTFactory.sol:87-108`
**Outcome:** fixed: contracts/gnus-ai @ 204dc8f — PerTokenId "Sale ended" gate added to GNUSLifecyclePolicy.enforceMintGate (single window authority, both issuance paths); regression test in GNUSNFTFactoryAntiScalping.test.ts.
**Issue:** `_checkMintPolicy` enforces `block.timestamp < validUntil` ("Sale ended") for PerTokenId tokens, but it only runs on the `mintWithCredential` path. The legacy `mint`/`mintBatch` path routes through `beforeMint` → `_mint` → `enforceMintGate`, which gates only `validFrom`. Result: the creator/admin can mint a PerTokenId token after `validUntil` (i.e., after the sale window AND after the token class is expired) via the legacy path — tokens are minted already-expired and immediately settleable, bypassing the sale-end gate. It is issuer-gated (creator-or-admin), so not attacker-reachable, but it is an inconsistency between the two issuance paths on the same token.

**Fix:** Add the PerTokenId validUntil check to `GNUSLifecyclePolicy.enforceMintGate` (it already reads `nftMint`), e.g. after the validFrom require:
```solidity
if (nftMint.expirationMode == uint8(ExpirationMode.PerTokenId)) {
    require(nftMint.validUntil == 0 || block.timestamp < nftMint.validUntil, "Sale ended");
}
```
(This also makes the hook the single window-authority, matching the cap precedent.)

### WR-03: `settleExpired` is NOT permissionless for ISSUER_ONLY / ALLOWLISTED tokens with RETURN_TO_ADDRESS — third-party settles revert

**File:** `contracts/gnus-ai/GNUSLifecycleMint.sol:185-203` with `contracts/gnus-ai/GNUSLifecyclePolicy.sol:183-200`
**Outcome:** fixed: contracts/gnus-ai @ 204dc8f — ISSUER_ONLY gains the fixed-recipient settlement carve-out mirroring the D5/D6 SOULBOUND carve-out; third-party settle regression test in GNUSLifecycleSettle.test.ts (ordinary ISSUER_ONLY transfers still blocked). ALLOWLISTED left registry-governed (issuer must pick an allowlisted recipient) — recorded as accepted residual.
**Issue:** The contract doc states "settleExpired is permissionless" and the tests assert a third party can settle. But for a PerTokenId token configured `transferPolicy = ISSUER_ONLY` + `expirationDisposition = RETURN_TO_ADDRESS`, `_dispatchSettlement` calls `_safeTransferFrom(account, recipient, ...)`, which fires the hook with `operator = _msgSender()` (the settle caller). The predicate then requires `operator == nft.creator || admin` — a third-party caller reverts, so the expired pile is stuck until the creator/admin happens to call settle. Same shape for ALLOWLISTED if `expirationRecipient` is not allowlisted. Q2 forbids PerHolder + transferable policies but PerTokenId + ISSUER_ONLY + RETURN_TO_ADDRESS is a legal, reachable configuration. Either the permissionlessness claim or the configuration gate is wrong.

**Fix:** Either (a) add a configuration gate forbidding `RETURN_TO_ADDRESS` (and any value-moving disposition) combined with ISSUER_ONLY/ALLOWLISTED, or (b) pass the settle through a path the predicate recognizes as a settlement (e.g. check `to == nft.expirationRecipient && expired(from)` carve-out in the ISSUER_ONLY branch, mirroring the existing SOULBOUND carve-out).

### WR-04: REDEEM_TO_PARENT settlement can be permanently blocked by the parent token's mint gate

**File:** `contracts/gnus-ai/GNUSLifecycleMint.sol:311-315` with `contracts/gnus-ai/GNUSLifecyclePolicy.sol:61-85`
**Outcome:** fixed: contracts/gnus-ai @ 204dc8f — transient GNUSLifecycleStorage.settleRedeemMintActive carve-out around the single internal _mint in _settleRedeemToParent exempts the redemption leg from the parent sale window + per-wallet cap; the parent max-supply check deliberately STILL applies (hard supply invariant, same posture as GNUSRedeemAdapter.redeem). Regression test proves settle succeeds under a hostile parent config and the carve-out is transient.
**Issue:** `_settleRedeemToParent` does `_mint(account, parentId, amount, "")`, which runs `enforceMintGate(parentId, account, amount)`:
- If the parent's `maxSupply` is at cap, the settle reverts — expired child funds are stuck forever (settlement is the only exit for an expired pile with this disposition).
- If a `perWalletMintCap` is configured on the parent, redemption *consumes the holder's mint cap* on the parent — redeeming is counted as a fresh mint against the wallet.
- If the parent has a future `validFrom`, redemption reverts "Token not yet active".
The Q1 gate only checks `nonConvertible`; it does not check parent supply headroom.

**Fix:** At minimum, document the constraint; better, in `_settleRedeemToParent` bypass the mint gate for the redemption leg (mint via a path that skips `enforceMintGate`, e.g. a `_mint` variant whose hook invocation knows the operator is the diamond settling an expired balance), or add a creation-time/config-time check that the parent has headroom semantics compatible with redemption.

### WR-05: Library-linking harness caches ONE library address per process — wrong address on any second network

**File:** `scripts/utils/GNUSLifecyclePolicyLinking.ts:60-110, 184-187`
**Outcome:** fixed: c73b877 — linker cache keyed per network (chain id via signer provider / hre.network.config.chainId ?? network name); 13-06 signer-honoring deploy preserved.
**Issue:** `linkedLibraryAddress` is a single module-level cache. `deployAndLinkLifecyclePolicyWithSigner` and `deployAndLinkLifecyclePolicy` return the cached address without checking the target network. In a multichain test run (`test-multichain`) or any single process that deploys to two networks, the library is deployed on chain A, cached, and then every facet "linked" on chain B gets chain A's address baked into its bytecode — the DELEGATECALL stub targets an address with no code on chain B, and every mint/transfer/burn reverts. The 13-06 comment block explicitly claims production coverage for every hardhat process, which multiplies the exposure: an RPC entry point that iterates networks in one process would ship dead-linked facets.

**Fix:** Key the cache by chain id (and provider), e.g. `linkedLibraryAddressByChain: Map<number, string>` keyed off `(await env.ethers.provider.getNetwork()).chainId` / the signer's provider, and fall through to a fresh deploy on a cache miss.

### WR-06: Upgrade/smoke tests hardcode token id `1n` — broken on the shared/cached diamond fixture

**File:** `test/unit/GNUSLifecycleUpgrade.test.ts:201, 259`, `test/unit/GNUSLifecycle.test.ts:172`
**Outcome:** fixed: 2335314 — legacy/probe ids now derived from childCurIndex BEFORE createNFT (settle-suite pattern) in GNUSLifecycleUpgrade.test.ts and GNUSLifecycle.test.ts createFreshNFT.
**Issue:** `GNUSLifecycleUpgrade` asserts `legacyId = 1n` / `probeId = 1n` and `GNUSLifecycle.test.ts` `createFreshNFT` returns `1n` unconditionally. Other suites in the same file set (`GNUSLifecycleSettle.test.ts:198-211`, comment "robust to a shared/cached diamond fixture") deliberately read `childCurIndex` before creating because the fixture is shared and cached across suites in one process. When these suites run after any suite that already created children (alphabetical ordering puts `GNUSLifecycleAICredits` / `GNUSLifecyclePolicy` / `GNUSLifecycleSettle` before `GNUSLifecycleUpgrade`... and `GNUSLifecycle.test.ts` after `GNUSLifecycleAICredits`), the first created token is NOT id 1: the slot-zeroing writes hit some other suite's token and the `getNFTInfo` assertions read the wrong record. These tests can pass vacuously or corrupt fixture state depending on suite order.

**Fix:** Read `childCurIndex` from `getNFTInfo(GNUS_TOKEN_ID)` before `createNFT` and return `(GNUS_TOKEN_ID << 128n) | childIndex`, matching `createFundedNFT` in GNUSLifecycleSettle.test.ts.

## Info

### IN-01: SOULBOUND carve-out lets ANY holder transfer to `expirationRecipient` at any time — not only via settlement

**File:** `contracts/gnus-ai/GNUSLifecyclePolicy.sol:169-173`
**Outcome:** documented (accepted risk): contracts/gnus-ai @ 204dc8f — explicit permanent-transfer-sink note on the fixed-recipient carve-out in GNUSLifecyclePolicy (applies to SOULBOUND and the new ISSUER_ONLY carve-out); no behavior change per D5.
**Issue:** The `to == nft.expirationRecipient` early-return is not scoped to the settlement flow — any holder can `safeTransferFrom` their whole balance directly to the recipient whenever they like, pre-expiry. If the recipient is an issuer hot address (common for refunds), this is a standing voluntary-exit channel through SOULBOUND. Documented as the D5 carve-out, so recording as a trust assumption rather than a defect.
**Fix:** Document explicitly in the D5 notes that the recipient address is a permanent transfer sink for every holder, and that it must be a contract that handles unsolicited transfers.

### IN-02: `ICredentialVerifier` doc comment is stale and wrong

**File:** `contracts/gnus-ai/interfaces/ICredentialVerifier.sol:6-7`
**Outcome:** fixed: contracts/gnus-ai @ 246a9dc — ICredentialVerifier doc now reflects the GNUSLifecycleMint._checkMintPolicy call site and the accepted view-call-before-cap ordering.
**Issue:** Says "Called from GNUSNFTFactory.beforeMint AFTER per-wallet cap update (CEI ordering)". Reality: the verifier is called from `GNUSLifecycleMint._checkMintPolicy` BEFORE the cap write (the accepted 13-03 addendum trade-off), and `GNUSNFTFactory.beforeMint` never calls it.
**Fix:** Update the comment to reflect the mint-facet call site and the accepted view-call-before-cap ordering.

### IN-03: `GNUSLifecycleMint` contract doc contradicts the locked cap decision

**File:** `contracts/gnus-ai/GNUSLifecycleMint.sol:34-36`
**Outcome:** fixed: contracts/gnus-ai @ 204dc8f — GNUSLifecycleMint doc reworded: legacy path lacks only the credential; cap + windows ARE hook-enforced (and now sale-end too per WR-02).
**Issue:** "Legacy `mint` / `mintBatch` on GNUSNFTFactory do NOT enforce the per-wallet cap or credential" — but the CAP-INCREMENT LOCATION addendum (same file, lines 40-48) and `enforceMintGate` state the hook DOES enforce the cap on both paths. The stale sentence should be narrowed to the credential only (which WR-02 confirms is the remaining gap, plus sale-end).
**Fix:** Reword to "Legacy mint/mintBatch do NOT enforce the credential verifier or the PerTokenId sale-end window (the per-wallet cap IS enforced via the shared hook)."

### IN-04: Storage-layout comments in `GNUSNFTFactoryStorage.sol` disagree with the verified layout

**File:** `contracts/gnus-ai/GNUSNFTFactoryStorage.sol:23-30`
**Outcome:** fixed: contracts/gnus-ai @ 246a9dc — GNUSNFTFactoryStorage slot annotations corrected to the probe-verified layout (slot +8 packing, addresses at +9/+10).
**Issue:** The struct comments claim the three uint64s are "slot +9 bytes 0-23", the enums are "slot +10 byte 0..", and the verifier is "slot +11" — but `GNUSLifecycleUpgrade.test.ts:62-81` verified (by slot probe) that Solidity packs nonConvertible + 3xuint64 + 3xuint8 into slot **+8**, recipient into +9, verifier into +10. `GNUSLifecycleTypes.sol:37` ("slots +8/+9/+10") is the correct one. Anyone doing a future append using the FactoryStorage comments will compute the wrong slots.
**Fix:** Correct the byte/slot annotations in GNUSNFTFactoryStorage.sol to match the probe-verified layout.

### IN-05: `GNUSBridge.burn` subtracts `chainSupply` without an underflow guard

**File:** `contracts/gnus-ai/GNUSBridge.sol:183`
**Outcome:** fixed: contracts/gnus-ai @ 36e6838 — require(chainSupply >= amount, "Burn exceeds chain supply") before the subtraction; bridgeIn untouched.
**Issue:** `globalSupply` is guarded (`require(t.globalSupply >= amount, ...)`) but `t.chainSupply[block.chainid] -= amount` is not — if chain supply accounting ever drifts below the burn amount (upgrade mis-initialization, cross-chain bookkeeping), the call panics (0x11) with no message instead of reverting cleanly, mirroring the WR-04-style defense-in-depth the codebase applied to the bridge fee.
**Fix:** `require(t.chainSupply[block.chainid] >= amount, "Burn exceeds chain supply");` before the subtraction.

### IN-06: `MockCredentialVerifier` carries dead driver state

**File:** `contracts/mocks/MockCredentialVerifier.sol:29-41`
**Outcome:** fixed: 9da855f — dead reentrancy driver state removed from MockCredentialVerifier; unused reenterOnVerify slot constant dropped from the anti-scalping test.
**Issue:** `reenterOnVerify`, `reenterDiamond`, `reenterTo`, `reenterId`, `reenterAmount` are declared and documented as the reentrancy driver but `verify` never reads them — the actual driver is `reenterMint`'s parameters. The unused flags invite a future test to flip them expecting behavior that does not exist.
**Fix:** Remove the dead state variables (or wire them) and keep only `acceptCredentials` + `reenterMint`.

---

_Reviewed: 2026-08-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
