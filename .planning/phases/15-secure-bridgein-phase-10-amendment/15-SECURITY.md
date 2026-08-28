---
phase: 15
slug: secure-bridgein-phase-10-amendment
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-27
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| superAdmin → facet admin fns | privileged calls cross here (init, threshold override, emergency recovery) | admin calldata; attestor root/threshold storage writes |
| diamond storage ← any facet | appended slots (+3..+6) are shared diamond state; sole-writer discipline starts here | V2 attestor root/epoch/threshold/init-flag fields |
| anyone (permissionless relay, D-09) → bridgeIn | untrusted certificate + proofs cross here — authorization IS the certificate | BridgeMessage, 65-byte EIP-191 signatures, Merkle proofs, next-root claim |
| certificate → root transition | the accepted certificate installs the next authority set | nextAttestorRoot + epoch increment |
| diamond → fee/supply economics | inline `_mintWithBridgeFee` replica writes treasury state | recipient, GNUS_TOKEN_ID, amount (post-fee mint) |
| fixture (repo file) → test → chain | vectors are trust anchors for the C++ exporter parity contract (BRIDGE-18) | frozen keys/roots/proofs/digests (conformance env 31337 / 0x1111…11) |
| test builder → on-chain verifier | the TS helper must not silently re-derive what it claims to prove | flat vs split digest derivation |
| rewritten suite → diamond | assertions must not weaken carried Phase 10 semantics | re-keyed legacy expectations |
| foundry fuzzer → diamond | campaign must actually reach the V2 selector (not silently no-op) | handler calls + ghost counters |
| docs → SuperGenius exporters | the doc is the cross-repo contract; wrong constants = forked verification | selectors, typechain types, digest field order |

---

## Threat Register

All 26 plan-time threats verified CLOSED against the implementation. Evidence anchors: `15-VERIFICATION.md` (verifier, 8/8 truths), `15-REVIEW.md` (reviewer, independent crypto re-derivation), the four `15-0N-SUMMARY.md` self-checks, and the cited commits.

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-15-01 | Tampering | GNUSBridgeValidatorStorage append | mitigate | Append-only banner + slot-probe suite: Layout exactly 7 fields, legacy slots +0..+2 byte-identical (git 4a7efaf→722d6cb), +3..+6 decode asserted — 12 passing (722d6cb, 466e7db) | closed |
| T-15-02 | Elevation of Privilege | setBridgeAttestorActiveThreshold | mitigate | Floor 2 (ACTIVE_ATTESTOR_THRESHOLD) structurally prevents 1-of-N; cap 16; live enforcement proven at threshold 3 — 2-of-3 reverts "Below threshold", 3-of-3 releases; zero-guard slot+6=0 → effective 2 (466e7db) | closed |
| T-15-03 | Tampering | emergencyRecoverAttestorSet | mitigate | paused require + onlySuperAdminRole + nonzero root + initialized + epoch = old+1 + emergency event; never resets the init flag (VERIFICATION truth 6) | closed |
| T-15-04 | Elevation of Privilege | Genesis re-entry after emergency | mitigate | Emergency requires bridgeAttestorV2Initialized; init is one-shot; epoch 0 structurally unreachable post-state (VERIFICATION truth 6; 15-01 decisions) | closed |
| T-15-05 | Information Disclosure | genesis attestor address | mitigate | No deployInit/upgradeInit wiring in geniusdiamond.config.json (priority 116 / versions["2.6"] entry, dfebdf0); genesis address never committed to the repo (D-04) | closed |
| T-15-06 | Tampering | facet registration priority | mitigate | Priority 116 (> 115) — registry's priority-resolution pass cannot steal inherited selectors; deploy success + diamond ABI checks green (VERIFICATION truth 1) | closed |
| T-15-07 | Denial of Service | storage append on legacy diamonds | accept | See Accepted Risks Log AR-15-01 | closed |
| T-15-08 | Spoofing | certificate forgery | mitigate | BRIDGE_CERTIFICATE_V2 split-encode binds all 13 fields (root/epoch/nextRoot + dest-chain + diamond + recipient + amount + token + event identity); strict-ascending; per-signer membership vs currentRoot; OZ tryRecover+NoError only — REVIEW confirmed high-s rejection closes malleability (VERIFICATION truths 3-4) | closed |
| T-15-09 | Tampering | root-transition atomicity | mitigate | CEI — replay mark (:527) + root/epoch writes strictly before the fee-mint (:539); reverting mint reverts the whole tx (R6 atomic-rollback row; VERIFICATION truth 5, source order re-machine-checked post-fix) | closed |
| T-15-10 | Elevation of Privilege | rogue next-root attestor | mitigate | Proofs verified against currentRoot ONLY — next-root members cannot authorize the certificate that installs them (VERIFICATION truth 4) | closed |
| T-15-11 | Tampering | replay across old/new identity schemes | mitigate | V2 replay key = domain-separated composite messageId (BRIDGE_MESSAGE_ID_V2 + 4 identity fields); legacy transferId path fully deleted — no writer of legacy keys remains; dest-chain + address(this) binding carried (VERIFICATION truth 2) | closed |
| T-15-12 | Elevation of Privilege | Genesis persistence | mitigate | Epoch-0 must-advance gate (nextAttestorRoot != currentRoot); threshold pinned GENESIS=1 at epoch 0 (VERIFICATION truths 1, 4) | closed |
| T-15-13 | Tampering | selector-removal upgrade risk | mitigate | Full source removal (fbc38f8); artifact AND diamond ABI free of 0x0bee6121/0x1abd0f1e; loupe selector-ownership removal proof green; nothing deployed carries them (sepolia 2.5 predates) (VERIFICATION truth 6) | closed |
| T-15-14 | Tampering | fee-replica drift | mitigate | `_mintWithBridgeFee`/`_mint` twins verbatim identical (REVIEW re-checked); paired fee-path test proves mint()/bridgeIn() post-fee balances identical (15-03 decisions) | closed |
| T-15-15 | Denial of Service | oversized certificates / in-flight invalidation | accept | See Accepted Risks Log AR-15-02 | closed |
| T-15-16 | Tampering | D-24 policy gate / limiter regression | mitigate | bridgeOut + _enforceBridgePolicy survive byte-for-byte (fbc38f8 diff: 182 deletions carry zero policy code); GNUSBridgePolicy.test.ts 13 passing (15-02 decisions) | closed |
| T-15-17 | Tampering | vectors that prove nothing | mitigate | flat == split == fixture equality asserted AND on-chain round-trips consume fixture values in recorded array order — vector 0 (V3) and vector 1 (V5, unsorted-order submission enforcing the ordering contract, 0a9f912); CR-01 fix made CI permanently enforce fixture ordering (VERIFICATION truth 7) | closed |
| T-15-18 | Spoofing | native SG signature acceptance | mitigate | PD-BR-7 negative test: non-EIP-191 vote-bytes signature reverts (D9 row — garbage recoveries sorted off-chain so membership is the pinned failure) | closed |
| T-15-19 | Tampering | fee-replica drift undetected | mitigate | Paired mint()/bridgeIn() fee test asserts identical post-fee outcomes (15-03 decisions, Pitfall 1) | closed |
| T-15-20 | Denial of Service | silent matrix shrink | mitigate | Header maps every `it` to a SPEC :654-727 checkpoint; matrix grew past the planned 36 to 44 passing rows across V1-V5/D/E/R/C/B/D9/A series (a04d848 + review-fix legs) | closed |
| T-15-21 | Repudiation | unmeasured 16-sig gas | accept | See Accepted Risks Log AR-15-03 | closed |
| T-15-22 | Tampering | weakened carried tests in the rewrite | mitigate | Every carried semantic (fee/cap/supply/replay/domain/pause/D-18) re-keyed and enumerated in the 23-test rewrite (8c8320a); removal proven via loupe selector ownership, not typechain (VERIFICATION truths 6-7) | closed |
| T-15-23 | Denial of Service | foundry campaign silently skipping bridgeIn | mitigate | afterInvariant coverage guard (ghost_bridgeInCalls > 0) + setUp setChainID bootstrap (4039f5b) — the soundness invariant now reaches the certificate verifier for the first time (15-04 decisions) | closed |
| T-15-24 | Tampering | wrong digest spec exported to C++ | mitigate | REVIEW independently re-derived every documented selector/constant/root/digest against facet source and fixture — all match; §3 ordering invariant stated post-CR-01 (88d8621, 0a9f912) | closed |
| T-15-25 | Repudiation | BRIDGE-17 production gate lost | mitigate | Gate recorded in docs/Secure-BridgeIn-Exporter-ABI.md §5 (#363 OPEN / #364 CLOSED, owner ruling 2026-08-26) AND 15-04-SUMMARY; REQUIREMENTS keeps BRIDGE-17 Pending by design (VERIFICATION truth 8) | closed |
| T-15-26 | Tampering | baseline drift masked as known-stale | mitigate | Phase-exit baselines recorded with exactly two tolerated known-stale classes: Hardhat (only GNUSControlStorage chainID cross-suite pollution) and Foundry (only Phase 08.1 setUp reverts) — 15-04 decisions; orchestrator re-ran both suites independently at closeout | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-01 | T-15-07 | Storage append is append-only with zero-default fields; a legacy diamond simply reads zeros (V2 inactive until initializeBridgeAttestorV2) — no legacy-path DoS vector; verified by the pre-init probe | GSD plan-time disposition (15-01-PLAN) | 2026-08-27 |
| AR-15-02 | T-15-15 | MAX_ATTESTOR_SIGNATURES=16 bounds verification gas (measured 313,844 gas for a 16-of-32 certificate); certificates invalidated mid-flight by a root rotation fail closed — accepted per T-10-13 precedent; BridgeAttestorSetAdvanced/Reset events let monitors re-request signatures | GSD plan-time disposition (15-02-PLAN, Pitfall 6) | 2026-08-27 |
| AR-15-03 | T-15-21 | 16-signature gas cost is measured and logged ([GAS] A1) but not bounded on-chain — the 16-sig cap is the design bound; no enforcement adds value without pricing policy | GSD plan-time disposition (15-03-PLAN) | 2026-08-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-27 | 26 | 26 | 0 | Claude (secure-phase, short-circuit path: plan-time register, all dispositions closed against VERIFICATION/REVIEW/SUMMARY evidence) |

Audit method note: `register_authored_at_plan_time: true` and `threats_open: 0` at classification — the workflow short-circuit applied (no separate auditor spawn). Closure evidence is the phase's own independent verification chain: gsd-verifier (8/8 truths, re-verification pass), gsd-code-reviewer (standard depth with cryptographic re-derivation of all selectors/constants/roots/digests/signatures/proofs; 9 findings all fixed), and four executor self-checks (all PASSED).

Related open item (not a threat-register entry): BRIDGE-17 production-activation gate — SuperGenius#363 must close before bridgeIn activation (tracked in REQUIREMENTS/PROJECT.md and docs/Secure-BridgeIn-Exporter-ABI.md §5). PD-WR-02 product decision (bridgeIn mint-leg exemption from enforceMintGate) recorded in 15-VERIFICATION.md notes.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-27
