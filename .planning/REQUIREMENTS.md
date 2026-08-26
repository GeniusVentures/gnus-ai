# Requirements: Gnus.ai Tech Debt & Security Remediation

**Defined:** 2026-05-26
**Core Value:** Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.

## v1 Requirements

### Technical Debt

- [ ] **DEBT-01**: Remove GeniusAI facet — delete `GeniusAI.sol`, `GeniusAIStorage.sol`, and remove from diamond config. Escrow moved to SuperGenius chain.
- [x] **DEBT-02**: Remove `hardhat/console.sol` import and `console.log()` from `DiamondInitFacet.sol`. Replace with event emission.
- [x] **DEBT-03**: Standardize all contract pragmas to `^0.8.19` (currently mixed: `^0.8.0`, `^0.8.2`, `^0.8.19`).
- [ ] **DEBT-04**: Remove duplicate `_setupRole`/`_grantRole` calls in `DiamondInitFacet.diamondInitialize250()` (lines 51-57).
- [ ] **DEBT-05**: Remove duplicated `onlySuperAdminRole` modifier from `DiamondInitFacet.sol` — use inherited modifier from `GeniusAccessControl.sol`.
- [ ] **DEBT-06**: Remove commented-out network configuration blocks from `hardhat.config.ts` (lines 237-241, 282-324).

### Security

- [ ] **SEC-01**: Fix `ERC20TransferBatch.mintBatch()` — marked `payable` but does not use ETH. Add `require(msg.value == 0, "ETH not accepted")`.
- [ ] **SEC-02**: Add input validation to `GNUSBridge.withdraw()` — validate `amount >= exchangeRate` and `exchangeRate > 0` to prevent division truncation losses.
- [ ] **SEC-03**: Add input validation to `GNUSBridge.bridgeOut()` — validate `destChainID != chainID` to prevent self-bridging.
- [ ] **SEC-04**: Add array length validation to `GNUSControl.banTransferorBatch()` and `allowTransferorBatch()` — `tokenIds.length == bannedAddresses.length`.
- [x] **SEC-05**: Add `onlySuperAdminRole` modifier to `DiamondInitFacet.diamondInitialize250()`.
- [x] **SEC-06**: Emit events when super admin bypasses withdrawal limiter in three code paths (`GNUSBridge.sol:159`, `GNUSERC1155MaxSupply.sol:57`, `ERC20TransferBatch.sol:155`).
- [x] **SEC-07**: Enable Slither static analysis on all production contracts — remove `contracts/gnus-ai/` from `slither.config.json` filter_paths. Run scan and fix findings.
- [ ] **SEC-08**: Add diamond-level emergency pause mechanism — circuit breaker halting all state-changing operations.

### Performance

- [ ] **PERF-01**: Merge double loop in `GNUSERC1155MaxSupply._beforeTokenTransfer()` into single loop — aggregate GNUS amounts and validate transferors in one pass.
- [ ] **PERF-02**: Cap `binCount` maximum in `GNUSWithdrawLimiterStorage.setDefaultBinCount()` and fix type inconsistency (default `uint256` vs per-account `uint32`).

### Testing

- [x] **TEST-01**: Replace stub fuzz tests in `test/foundry/fuzz/ExampleFuzz.t.sol` with real fuzz tests for diamond functions, or remove file entirely.
- [x] **TEST-02**: Complete 2nd-gen child token minting assertions in `test/unit/NFTFactory.test.ts` (lines 371, 375, 522-525) — validate GNUS burn logic.
- [x] **TEST-03**: Add banned transferor getter to `GNUSControlStorage.sol` and corresponding test coverage.

### Quality

- [ ] **QUAL-01**: Add `supportsInterface()` override to `DiamondInitFacet.sol` — check both parent contracts and `LibDiamond.diamondStorage().supportedInterfaces`, matching pattern in other facets.

### Dependencies

- [ ] **DEP-01**: Pin `contracts-starter` to a specific commit hash in `package.json` — currently pointed at `https://github.com/mudgen/diamond-2-hardhat.git` without a commit reference.

### Safe Wallet Proposer

- [x] **SWP-01**: Install Safe SDK dependencies — @safe-global/api-kit, @safe-global/protocol-kit, @safe-global/types-kit as exact-pinned devDependencies.
- [ ] **SWP-02**: Extend config/CLI/environment validation for Safe proposal mode.
- [ ] **SWP-03**: Wire CLI options (--safe-propose, --safe-address, etc.) and env loading.
- [x] **SWP-04**: Implement proposeSafeTransaction() helper using Safe SDK — builds, signs, and submits Safe transaction proposals.
- [x] **SWP-05**: Implement writeSafeProposalArtifact() — writes local JSON fallback artifact with calldata, selector, metadata.
- [ ] **SWP-06**: Implement SafeProposerRPCDeploymentStrategy — intercepts diamondCut transactions for Safe proposal instead of direct send.
- [ ] **SWP-07**: Wire strategy selection in RPCDiamondDeployer — SafeProposerRPCDeploymentStrategy when safePropose=true, RPCDeploymentStrategy otherwise.
- [x] **SWP-08**: Extend .env.example with Safe proposal section (SAFE_PROPOSE, SAFE_ADDRESS, SAFE_PROPOSER_PRIVATE_KEY, SAFE_TX_SERVICE_URL, SAFE_API_KEY, SAFE_ORIGIN).
- [ ] **SWP-09**: Add mainnet guard — block direct privileged upgrades on mainnet unless SAFE_PROPOSE=true.
- [x] **SWP-10**: Unit tests covering config validation, env loading, strategy selection, diamondCut intercept.
- [x] **SWP-11**: Sepolia smoke test — manual verification that Safe proposal appears in Safe UI.

### ERC-20 Proxy

- [ ] **PROXY-01**: Real amount-specific ERC-20 allowances on the erc20-gnus-proxy contract — `_allowances` mapping; `approve(spender, amount)` sets a real allowance (NOT `setApprovalForAll`); `transferFrom()` spends via `_spendAllowance()`. Implemented in the `erc20-gnus-proxy` repo (see Phase 11).
- [ ] **PROXY-02**: Immutable proxy configuration — one-shot initialization of `childTokenId`, `erc1155Contract`, `name`, `symbol` on the erc20-gnus-proxy contract. Implemented in the `erc20-gnus-proxy` repo (see Phase 11).
- [ ] **PROXY-03**: Generic redeem adapter on the gnus-ai diamond — single-transaction proxied-child → GNUS via `GNUSTreasury.convert()`, callable by any conforming external ERC-20 proxy. Implemented in this repo (see Phase 11).

## v2 Requirements

### NFT Token Economics

- **NFT-01**: Investigate child NFT treasury GNUS tokens — can child NFTs (2nd+ generation) hold GNUS token treasuries for token swap operations?
- **NFT-02**: Investigate childToken/grandchild NFT-to-GNUS swap mechanism — allow child NFT holders to swap their tokens for GNUS from the treasury.
- **NFT-03**: Investigate GNUS token transfer to external swap contracts — pipe treasury GNUS to a designated swap/liquidity contract.

_These are investigation items only — no implementation committed until research validates feasibility and security of the approach._

## v3 Requirements — Private-Network AI Licensing (ingested 2026-08-03)

### Licensing

- [x] **LIC-01**: Per-tenant License NFT model — GNUS AI Product Root token serves as the public AI network; per-company License NFTs created as its children; company AI Credits as children of the License NFT. Individual AI Credits remain direct children of the product root (no Individual License NFT branch). License NFT's `privateNetworkId` identifies the SuperGenius private network/tenant for AI processing.
- [ ] **LIC-02**: NFT struct network-scope fields — append `networkScope` (enum: `PublicOnly`=0, `PrivateOnly`, `Hybrid`), `privateNetworkId`, `publicSettlementEnabled` after Phase 13 lifecycle fields. Append-only; existing token IDs decode with zero defaults (PublicOnly, 0, false) and remain behaviorally unchanged; upgrade test required.
- [x] **LIC-03**: Product/SKU registry — on-chain registry mapping SKUs to fixed minion-denominated prices (`priceInMinions`, `creditAmount`, `duration`, `createsLicense`, `renewsLicense`, `active`). No USD oracle, no `priceUsd` field.
- [x] **LIC-04**: Payment router facet — accepts GNUS-minions payment only (paid GNUS BURNED per D-10), producing License NFT creation/renewal + AI Credit minting/top-up. Off-chain operator fiat path (~$20 → GV buys GNUS → CREATOR_ROLE mint) per D-26. Payment asset and license/credit assets remain distinct. (amended 2026-08-25, D-26 — no USDC or fiat-onramp contract code)
- [x] **LIC-05**: `LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)` event emitted on license creation and every renewal; SuperGenius consumers derive license state from events alone.
- [x] **LIC-06**: Hybrid-scope redeemability — Hybrid-scope tokens configured with `exchangeRate > 0` and `REDEEM_TO_PARENT` disposition (Phase 13 D8 path), collateralized via the existing Phase 9 `GNUSTreasury.convert()` conversion-native model. Hybrid redeemability is provided by Phase 13 REDEEM_TO_PARENT settlement plus Phase 9 `convert()` collateralization; the Phase 9 backed-child mint helper referenced by the original text never shipped. Pure burn-only AI Credits remain non-redeemable. (amended 2026-08-25, D-28 — Phase 9 convert() model; the backed-child mint helper does not exist)
- [ ] **LIC-07**: Private-network spend design — resolve how AI credits are spent on SuperGenius against public-canonical balances (bridged burn events vs mirror + periodic settlement). Open design question (PD-7) to be resolved in Phase 14 discuss/plan, informed by Phase 10 bridge vault work. **RESOLVED by D-07/D-08** — SG spend → GV wallet → existing Phase 10 bridgeIn → ops burn; `publicSettlementEnabled` is an informational flag consumed by the SG side; no new on-chain settlement mechanism.

## v4 Requirements — Secure BridgeIn Amendment (ingested 2026-08-23)

> Source: `docs/Secure-BridgeIn.md` (SPEC). **Pre-deployment update to the unreleased Phase 10 bridge** — the Phase 10 bridgeIn code is merged/tested but never deployed (no facet records in `config/networks/sepolia.json`), so these are revisions to the Phase 10 design, NOT a "V2" of a live system. **Scheduling:** Phase 10 CONTEXT re-lock + implementation run **after Phase 13 ships** (13-06 also edits `GNUSBridge.sol`). Six items amend locked Phase 10 decisions (noted per-item); two align with existing D-11/D-13. Full candidate detail at `.planning/intel/requirements.md`; conflict analysis at `.planning/INGEST-CONFLICTS.md`.

### BridgeIn Amendment

- [ ] **BRIDGE-10**: Rolling-attestor storage — append `bridgeAttestorRoot`, `bridgeAttestorEpoch`, `bridgeAttestorV2Initialized` to `GNUSBridgeValidatorStorage.Layout` (append-only; legacy `validatorMerkleRoot`/`validatorThreshold` preserved byte-for-byte, become dead once active). Diamond storage upgrade test proves existing state decodes.
- [ ] **BRIDGE-11**: One-time `initializeBridgeAttestorV2(address genesisAttestor)` (onlySuperAdminRole) — bootstraps the rolling root with a single Genesis attestor (one-leaf root, epoch 0, emits `BridgeAttestorSetInitialized`). First successful certificate must advance off Genesis (no permanent Genesis mode).
- [ ] **BRIDGE-12**: Canonical `BridgeMessage` struct (`srcChainID, sourceBridgeID, sourceTxHash, sourceEventIndex, recipient, amount`) replacing free-form `transferId`; replay message ID derived on-chain via `BRIDGE_MESSAGE_ID_V2` domain + composite key; `sourceEventIndex` disambiguates same-tx events. Replay protection reuses `processedMessages` (D-07 unchanged). **Amends locked D-06.**
- [ ] **BRIDGE-13**: `BRIDGE_CERTIFICATE_V2` digest — binds `currentAttestorRoot, currentAttestorEpoch, nextAttestorRoot` into the EIP-191 struct hash alongside existing fields; preserves dest-chain + diamond-address binding. **Extends locked D-08/D-10.**
- [ ] **BRIDGE-14**: `_verifyBridgeAttestorCertificate` replaces `_verifyThresholdCertificate` — strict-ascending signers, per-signer Merkle proof against `currentRoot`, epoch-derived threshold, 16-signature cap, no MMR/multiproof. **Amends locked D-12/D-15.**
- [ ] **BRIDGE-15**: New `bridgeIn(BridgeMessage calldata, bytes32 nextAttestorRoot, bytes[] calldata signatures, bytes32[][] calldata merkleProofs)` — pause/init → dest/message → replay → digest → cert-verify → (replay-mark + root-update BEFORE mint, CEI) → `_mintWithBridgeFee` (D-22 unchanged) → `BridgeReleased`. Atomic: failed mint reverts root update + replay marker. Root transition installs `nextAttestorRoot` + increments epoch by 1 (emits `BridgeAttestorSetAdvanced`); unchanged root processes claim with no epoch bump.
- [ ] **BRIDGE-16**: Legacy-selector removal — legacy `bridgeIn(bytes32,uint256,address,uint256,bytes[],bytes32[][])` removed or stubbed to always-revert; `setValidatorSet` removed or converted to an explicitly-named emergency-recovery (requires paused + onlySuperAdminRole + nonzero root + never restores Genesis + increments epoch + emits emergency-reset). **Amends locked D-15.**
- [ ] **BRIDGE-17**: SuperGenius prerequisites — #363 (slot quorum uses only signature-verified votes) and #364 (slot 0 identifies the API RPC that actually succeeded for that exact claim) must close before production activation. EVM-side work may proceed in parallel; track in `.planning/SUBREPOS.md` when scheduled.
- [ ] **BRIDGE-18**: Cross-language test vectors — fixed vectors proving the C++ SuperGenius exporter and the Solidity verifier compute identical digests/signatures/proofs (private key, 64-byte SG pubkey, EVM address, roots, epoch, BridgeMessage fields, struct hash, EIP-191 digest, 65-byte r‖s‖v sig, recovered address, Merkle proof). Checked into repo, run in CI.
- [ ] **BRIDGE-19**: BridgeIn-amendment test matrix — bootstrap, current-root verification, root transitions, replay/domain binding, existing-token behavior, cross-language vectors (source doc lines 654-727). Extends (does not replace) the Phase 10 suite, which covers the legacy path being removed.

## Out of Scope

| Feature                                   | Reason                                                      |
| ----------------------------------------- | ----------------------------------------------------------- |
| Escrow release/closing/dispute            | Moved to SuperGenius chain, different contracts handle this |
| New feature development                   | This is a remediation pass — no greenfield features         |
| Mainnet deployment                        | Gated on audit completion and remediation verification      |
| Real-time chat / video NFTs               | Not part of the GNUS token ecosystem                        |
| GNUSNFTCollectionName facet consolidation | Low-priority refactor, defer to future cleanup              |
| Multisig/timelock for super admin         | Defer to governance phase                                   |

## Traceability

| Requirement | Phase      | Status   |
| ----------- | ---------- | -------- |
| DEBT-01     | Phase 2    | Pending  |
| DEBT-02     | Phase 1    | Complete |
| DEBT-03     | Phase 1    | Complete |
| DEBT-04     | Phase 2    | Pending  |
| DEBT-05     | Phase 2    | Pending  |
| DEBT-06     | Phase 1    | Pending  |
| SEC-01      | Phase 3    | Pending  |
| SEC-02      | Phase 3    | Pending  |
| SEC-03      | Phase 3    | Pending  |
| SEC-04      | Phase 3    | Pending  |
| SEC-05      | Phase 4    | Complete |
| SEC-06      | Phase 4    | Complete |
| SEC-07      | Phase 4    | Complete |
| SEC-08      | Phase 5    | Pending  |
| PERF-01     | Phase 5    | Pending  |
| PERF-02     | Phase 5    | Pending  |
| TEST-01     | Phase 6    | Complete |
| TEST-02     | Phase 6    | Complete |
| TEST-03     | Phase 6    | Complete |
| QUAL-01     | Phase 2    | Pending  |
| DEP-01      | Phase 7    | Pending  |
| SWP-01      | Phase 08.1 | Complete |
| SWP-02      | Phase 08.1 | Pending  |
| SWP-03      | Phase 08.1 | Pending  |
| SWP-04      | Phase 08.1 | Complete |
| SWP-05      | Phase 08.1 | Complete |
| SWP-06      | Phase 08.1 | Pending  |
| SWP-07      | Phase 08.1 | Pending  |
| SWP-08      | Phase 08.1 | Complete |
| SWP-09      | Phase 08.1 | Pending  |
| SWP-10      | Phase 08.1 | Complete |
| SWP-11      | Phase 08.1 | Complete |
| PROXY-01    | Phase 11 (erc20-gnus-proxy repo) | Pending  |
| PROXY-02    | Phase 11 (erc20-gnus-proxy repo) | Pending  |
| PROXY-03    | Phase 11   | Pending  |
| LIC-01      | Phase 14   | Complete |
| LIC-02      | Phase 14   | Pending  |
| LIC-03      | Phase 14   | Complete |
| LIC-04      | Phase 14   | Complete |
| LIC-05      | Phase 14   | Complete |
| LIC-06      | Phase 14   | Complete |
| LIC-07      | Phase 14   | Pending  |
| BRIDGE-10   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-11   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-12   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-13   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-14   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-15   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-16   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-17   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-18   | Phase 10 (amendment, post-Phase-13) | Pending  |
| BRIDGE-19   | Phase 10 (amendment, post-Phase-13) | Pending  |

**Coverage:**

- v1 requirements: 25 total (22 + PROXY-01/02/03)
- v2 requirements (SWP): 11 total
- v3 requirements (LIC): 7 total
- v4 requirements (BRIDGE amendment): 10 total
- Mapped to phases: 53
- Unmapped: 0

---

_Requirements defined: 2026-05-26_
_Last updated: 2026-08-23 — BRIDGE-10..19 ingested from `docs/Secure-BridgeIn.md` as a pre-deployment Phase 10 amendment (scheduled post-Phase-13)_
