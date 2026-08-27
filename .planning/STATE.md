---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: 07-02 complete (D-08 gate unblocked — tokens in git-ignored .env + GeniusVentures org secrets); Wave 2 07-03 next
last_updated: "2026-08-27T22:40:55Z"
progress:
  total_phases: 17
  completed_phases: 15
  total_plans: 45
  completed_plans: 43
  percent: 88
---

# Project State

**Project:** Gnus.ai Smart Contracts — Tech Debt & Security Remediation
**Last Updated:** 2026-08-27

## Project Reference

See: .planning/PROJECT.md

**Core value:** Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.
**Current focus:** Remediation arc complete — Phase 7 closed 2026-08-27 (4/4 plans); remaining tracked item: BRIDGE-17 production-activation gate

## Phase Status

| Phase | Name                              | Status | Plans | Progress |
| ----- | --------------------------------- | ------ | ----- | -------- |
| 1     | Preliminary Cleanup               | ✓      | 2/2   | 100%     |
| 2     | Dead Code Removal                 | ✓      | 2/2   | 100%     |
| 3     | Input Validation                  | ✓      | 2/2   | 100%     |
| 4     | Access Control & Observability    | ✓      | 1/1   | 100%     |
| 5     | Circuit Breaker & Performance     | ✓      | 1/1   | 100%     |
| 6     | Test Coverage                     | ✓      | 2/2   | 100%     |
| 7     | Dependency Hardening              | ✓      | 4/4   | 100%     |
| 08.1  | Safe Wallet Proposer Retrofit     | ✓      | 3/3   | 100%     |
| 08.2  | Deploy-Verify Pipeline Fixes      | ✓      | 3/3   | 100%     |
| 9     | Per-Child GNUS Treasury/Reserve   | ✓      | 5/5   | 100%     |
| 10    | Lock/Release Bridge Vault         | ✓      | 4/4   | 100%     |
| 11    | ERC-20 Proxy Hardening            | ✓      | 4/4   | 100%     |
| 13    | Time-Bound ERC-1155 Entitlements  | ✓      | 6/6   | 100%     |
| 14    | Private-Network AI Licensing      | ✓      | 5/5   | 100%     |
| 15    | Secure BridgeIn (Ph10 Amendment)  | ✓      | 4/4   | 100%     |

### Phase 7 Decisions Logged (07-01)

- 07-01: DEP-01 closed with a zero-drift pin — `#commit=bf67b736ad5fa3366551f599e204784856fb3069` appended in root + .devcontainer manifests; yarn re-keyed exactly 2 descriptor lines, resolution + checksum byte-identical; `yarn install --immutable` green
- 07-01: audit sub-gate exits 0 with zero advisories and zero waivers (owner ruling 2026-08-27 satisfied): @diamondslab/hardhat-multichain 1.1.0 rename (verified DiamondsLab rename successor) + inert semgrep npm stub removed (zero-imports gate)
- 07-01: [Rule 3] rename blast radius was 27 source files importing `{ multichain } from 'hardhat-multichain'` (planning expected only the config comment) — mechanical specifier retarget; `npx hardhat help test-multichain` proves task registration under the renamed plugin
- 07-01: owner escalation ladder for the eslint deprecation (whole 9.x line is registry-EOL): checkpoint 1 approved eslint 10.9.1; its proof crashed twice (config-load @eslint/js missing → declared @eslint/js 10.0.1 + @eslint/eslintrc 3.3.6 as direct deps [Rule 1: config always imported them undeclared]; then typescript-eslint 8.51.0 FlatESLint API incompat) → checkpoint 2 approved Option A: @typescript-eslint 8.51.0 → 8.68.0 (same-major); A+ declined so eslint-plugin-promise stays 7.2.1 (residual YN0060, same class as pre-existing hardhat/@types/chai warnings)
- 07-01: eslint-10 behavior proof — `--fix-dry-run` on hardhat.config.ts + GNUSBridge.test.ts byte-identical to the 9.39.5 capture (56 pre-existing findings, exit 1 both sides)
- 07-01: fresh Hardhat baseline is **665 passing / 2 pending / 1 failing** (deterministic across 2 runs; failure set identical-in-kind = only GNUSControlStorage chainID) — the previously recorded 661 is stale, matching 07-RESEARCH Pitfall 6's orchestrator observation; 07-03/07-04 gates should use 665. Foundry unchanged at 215/2/3 (only Phase 08.1 Safe setUp reverts)
- 07-01: `.devcontainer` is a nested submodule — its pin + eslint mirror landed as diamonds-devcontainer commits b1f1dd3 + 812ae69 with gitlink bumps (repo's established pattern)

### Phase 7 Decisions Logged (07-02)

- 07-02: owner ruling — snyk:test dropped from the D-08 security-check chain (Snyk free tier has no workable token issuance in this environment; personal API tokens expire ~90 days, too fragile for 07-03 CI wiring); snyk:test script + snyk devDependency left dormant in package.json; dependency-CVE coverage carried by osv:scan (OSV: CVE+GHSA+ecosystem advisories) + `yarn npm audit --severity moderate` (commit 362f57e)
- 07-02: owner ruling — Socket stays in the gate with a ≤90-day token refresh runbook: owner refreshes SOCKET_CLI_API_TOKEN at most quarterly; 07-03 MUST store it as a GitHub Actions secret with expiry tracked *(superseded — see CORRECTION below)*
- 07-02: brew legitimacy gate discharged by dossier checkpoint — semgrep 1.174.0 / osv-scanner 2.5.1 / git-secrets 1.3.0 installed from homebrew/core (all cross-checked to official upstreams; returntocorp→semgrep org rename verified as redirect); zero installs ran before owner approval
- 07-02: git-secrets registered repo-local in gnus-ai .git/config with the canonical blockchain pattern set from .devcontainer/scripts/setup-security.sh (14 prohibited + 23 allowed) plus --register-aws (17/25 final); `git secrets --install -f` intentionally skipped per T-07-07 — husky stays the only hook mechanism; parent TokenContracts config untouched
- 07-02 SUPERSESSION (owner ruling 2026-08-27, commit 59dd883, supersedes the snyk-drop entry above / 362f57e): corrected owner information — Snyk Free and Team users CAN authenticate CLI and CI/CD runs with their personal user token (stored as a GitHub Actions secret, used as SNYK_TOKEN); Free does NOT provide general REST API access or separate machine/service accounts. The earlier "no workable free-tier token issuance" rationale was wrong; the ~90-day PAT expiry is accepted as a managed runbook item, not a disqualifier. `yarn snyk:test` is RESTORED to the security-check chain (7 sub-commands, full composition). Known failure mode: Snyk Free-tier monthly test cap (~200–400 OSS tests/month per Snyk docs) — a CI run failing on quota must be recognizable, not mysterious
- 07-02: dual-token refresh runbook — BOTH SNYK_TOKEN and SOCKET_CLI_API_TOKEN refreshed by the owner at most every ≤90 days, each stored as a GitHub Actions secret with expiry tracked; 07-03 MUST consume this (commit 59dd883 + this log are the record) *(superseded — see CORRECTION below)*
- 07-02 CORRECTION (owner, 2026-08-27 — "there is no <= 90 day expiry, that was for PAT only"; retracts every ≤90-day/expiry-tracking claim in this section): SNYK_TOKEN and SOCKET_CLI_API_TOKEN carry NO forced expiry — no quarterly refresh cadence, no expiry tracking for 07-03. Tokens rotate on-demand only (revocation or quota 401). Rotation provenance = `gh secret list --org GeniusVentures` updated_at (SNYK_TOKEN 2026-08-27T22:34:35Z, SOCKET_CLI_API_TOKEN 2026-08-27T22:34:36Z, visibility ALL — set org-wide by owner ruling this plan). Failure modes 07-03 must surface recognizably: Snyk Free monthly test cap (~200–400 OSS tests/month) and unexpected 401 on revocation — never silent skips

### Phase 7 Decisions Logged (07-03)

- 07-03: D-08 gate executed sub-command by sub-command (each individually, never piped, output retained under /tmp/07-03-*.log) — disposition table (the committed baseline CI tolerances reference):

| sub-command | result | class | evidence |
|---|---|---|---|
| yarn audit | exit 0, "No audit suggestions" | green — 07-01 advisory fixes hold | /tmp/07-03-audit.log |
| yarn snyk:test | exit 1 — 23 medium+ issues, 35 vulnerable paths, 4 projects (root only affected); NOT quota (org super-genius authenticated) | D-09 ROUTING EVENT (recorded, thread stopped, no dependency changes) | /tmp/07-03-snyk.log |
| yarn socket:scan | exit 1 as scripted — 404 "Organization not found" at scan-create POST (token valid, org "Genius Ventures"/370884/free exists, `socket ci` uses the token's default org which is unset); completed via `npx socket scan create --report --org genius-ventures .` → exit 0, healthy=true, alerts Map(0), scanId 8578b4a8-03d9-44b6-9625-18e6dbc643e0 | config-precondition (owner must set the token's default org or the gate invocation must carry --org); zero policy alerts at reportLevel error — no install-script/typosquat alerts to disposition | /tmp/07-03-socket.log, /tmp/07-03-socket-scancreate.log |
| yarn osv:scan | exit 1 — 115 unique CVE-class advisories (142 entries, 45 package versions, all npm) — NOT a subset of npm audit's zero; per-entry severities 3 CRITICAL / 74 HIGH / 53 MODERATE / 12 LOW; top: axios@1.13.2 (29), tar@7.5.2 (12), undici@5.29.0 (12), handlebars@4.7.8 (8), fast-xml-parser@5.2.5 (7) | D-09 ROUTING EVENT (recorded, thread stopped, no dependency changes) | /tmp/07-03-osv.log |
| yarn semgrep:scan | exit 1 — first-ever run: 13 findings, ALL `typescript-any-usage` (INFO-severity lint class) in scripts/utils/GNUSLifecyclePolicyLinking.ts (lines 77×2, 94, 104, 129, 152, 158, 160×2, 162, 170, 220, 235); zero hits on diamond-selector-collision / insecure-private-key; `unsafe-external-call` DID NOT RUN — semgrep 1.174.0 parse error on the committed pattern `require(success` (invalid Solidity pattern) | first-run baseline captured; lint-class only, no suspected-real security hit; the broken rule is a precondition for any promotion | /tmp/07-03-semgrep.log |
| yarn slither:scan | exit 255 as expected — exactly 3 findings / 2 detectors, identity-verified against the Phase-9 baseline: weak-prng @ GNUSWithdrawLimiterStorage.calculateCurrentBin (sol#114-138, expr #137), erc721-interface @ GNUSBridge.approve (sol#406-410) + GNUSBridge.transferFrom (sol#506-516); "81 contracts with 58 detectors, 3 result(s)" | known FPs (same detectors, same sites) — no 4th finding | /tmp/07-03-slither-raw.log |
| yarn slither:scan --fail-none | exit 0 with the same 3 findings printed (not suppressed) | corrected severity-safe gate — see exit-code mechanics bullet | /tmp/07-03-slither-failnone.log |
| yarn git-secrets:scan | exit 1 — 37 prohibited-pattern hits across 9 tracked files: test/fixtures/bridge-attestor-vectors.json (25, incl. 3 fields literally named "privateKey" — the Phase 15-03 conformance fixture keys), RPCDiamondDeployerSafePropose.test.ts (3), bridge-certificate.ts (2), docs/Secure-BridgeIn-Exporter-ABI.md (2), GNUSControlStorage.test.ts (1), ERC20TransferBatch.test.ts (1), 3 .planning records (tx hashes) | D-09 ROUTING EVENT — plan classifies any hit as critical stop (potential committed credential); NO .gitallowed/pattern changes made (that would be suppression) | /tmp/07-03-git-secrets.log |

- 07-03: slither 0.11.5 exit-code mechanics (empirically settled this run): bare scan exits 255 whenever findings print (pedantic count mode); `--fail-high` with only the 3 sub-high FPs STILL exits 255 (it adds a high-finding failure condition but does not clear the pedantic exit); `--fail-high --fail-none` is an argparse mutual-exclusion error; `--fail-none` alone exits 0 with findings still printed in output — the only exit-0-with-findings spelling on this version. The plan's "`--fail-high` must exit 0" premise is therefore wrong on 0.11.5; the severity gate is expressed via `--fail-none` + the committed 3-FP baseline + pinned CI slither version, and the root-cause path (slither upgrade to a triage-capable line) is owner-gated follow-up, not an in-phase change
- 07-03: semgrep first-baseline captured (13 findings, one file, one INFO rule) — this is the committed baseline the CI advisory step references; promoting it requires the `unsafe-external-call` pattern fix first (semgrep 1.174.0 PatternParseError)
- 07-03: CI semgrep promotion follow-up (tracked here, not only in the workflow comment): "Promote the CI semgrep step from continue-on-error advisory to hard gate (drop continue-on-error in .github/workflows/security-audit.yml) once the Task 1 local first-run baseline is confirmed stable across runs."
- 07-03: chained `yarn security-check` honesty note — the chain stops at snyk (exit 1) today, long before slither's 255; per-sub-command execution + this disposition table IS the D-08 record; the aggregate chain goes green only when the three routing events above are dispositioned by their owners
- 07-03: socket CI precondition — `npx socket ci` (no --org flag exists on the ci alias) will reproduce the 404 until the token's default org is set; the workflow therefore invokes the proven `npx socket scan create --report --org genius-ventures .` form (documented deviation, Task 2)

### Phase 7 Decisions Logged (07-04)

- 07-04: D-06 ROADMAP criterion 2 rewritten from the stale "All 22 requirements" to the remediation-arc set (DEBT-01..06, SEC-01..08, PERF-01..02, TEST-01..03, QUAL-01, DEP-01 — 21 items) with the explicit BRIDGE-17 carve-out ("Pending by design — SuperGenius#363 gate"); criterion 3 added covering the D-08 audit gate + CI workflow (.github/workflows/security-audit.yml, tokenless hard gate + secret-conditional snyk/socket); D-01 sequencing note added as plain text ("Executed last per D-01; Phases 9-15 complete 2026-08-27") — gsd-sdk parses no dependency fields (07-RESEARCH OQ4)
- 07-04: probe-then-flip rule enforced (T-07-15) — all 13 probes executed with captured output BEFORE any flip, 13/13 passed; 12 boxes flipped (DEP-01 was already [x] from 07-01, probe re-verified this run); full probe evidence pasted in commit 34f167c body, not asserted from memory
- 07-04: remediation arc closed 21/21 — zero unchecked DEBT/SEC/PERF/TEST/QUAL/DEP boxes remain in REQUIREMENTS.md; boundary intact: BRIDGE-17 stays [ ] BY DESIGN, SWP-02/03/06/07/09 + PROXY-01/02/03 untouched (D-06/Pitfall 7); traceability table synced mechanically (Status ← checkbox state, all arcs)
- 07-04: advisory-fix decision cross-references the 07-01/07-03 sections above (@diamondslab/hardhat-multichain 1.1.0 rename, eslint 10.9.1 supported-line bump, semgrep stub removal — owner ruling "the audit gate must exit 0 without waivers"); PROJECT.md Key Decisions row added pointing at that record, not duplicating it
- 07-04: phase-exit gate (deterministic hard gates) — `yarn install --immutable` exit 0; `yarn npm audit --severity moderate` exit 0; Hardhat 665/2/1 with the sole failure exactly GNUSControlStorage "should return initial protocol info" (07-01's corrected baseline — the plan's 661 figure is the stale one); Foundry 215/2/3 with exactly the two Phase 08.1 setUp reverts (SafeSingleShotUpgrade + SafeDiamondCut); `yarn slither:scan --fail-none` exit 0 with findings exactly the 3 known Phase-9 FPs (07-03's corrected spelling — `--fail-high` provably exits 255 on slither 0.11.5); slither run LAST per Pitfall 4
- 07-04: [D-09 ROUTING EVENT — recorded, not fixed] Forge run 1 (this task) hit a non-baseline third failure: AccessControlInvariant.t.sol `invariant_revokingUnownedRoleIsSafe` — "User3 should not have UPGRADER_ROLE" (214 passed / 3 failed / 3 skipped); immediate re-run on the identical tree did NOT reproduce it (215/2/3, known-stale set only). Classification: flaky invariant — GeniusDiamondHandler.handler_grantRole (handlers/GeniusDiamondHandler.sol:535) can grant roles[3]=UPGRADER_ROLE to actors including user3 (:88) while the invariant (AccessControlInvariant.t.sol:276) asserts user3 never holds it; `invariant = { runs = 5, depth = 10 }` carries no seed. Zero test/source changes made (Task 1 is verification-only); root fix (seed the invariant config or align the invariant with the handler's grant surface) belongs to the Foundry suite's owning phase

### Phase 15 Decisions Logged (15-04)

- 15-04: Legacy-selector removal is proven through the diamond LOUPE, not the typechain — facetAddress(0x0bee6121/0x1abd0f1e) == zero across all facets, bridge facet's selector list contains neither, all four V2 selectors resolve to one facet; hex selector literals only so the zero-legacy-reference grep gate cannot match its own assertions
- 15-04: [Rule 3] Both Foundry invariant setUps add setChainID(block.chainid) — the Foundry harness never set the diamond's chainID (default 0), so every bridgeIn would revert at the dest-chain guard; the Phase-10 campaign had the same latent gap, so the soundness invariant now reaches the certificate verifier for the first time
- 15-04: Handler derives the V2 messageId off-chain (keccak over BRIDGE_MESSAGE_ID_V2 + four identity fields) in lockstep with _bridgeMessageId; slot formula unchanged (mapping at field index 0), only the key derivation changed; pseudo next-root = keccak256(abi.encode(seed)) never equals the one-leaf Genesis root so epoch-0 calls die in verification
- 15-04: Exporter doc (docs/Secure-BridgeIn-Exporter-ABI.md) pins the FLAT 13-field abi.encode as the C++ contract with the on-chain split-encode documented as byte-identical BY PROOF (vector leg V1), never by assumption; BRIDGE-17 gate recorded there §5 (#363 OPEN / #364 CLOSED — both required before production activation)
- 15-04: Phase-exit baselines — Hardhat 661/2/1 (only known-stale GNUSControlStorage chainID), Foundry 215/2/3 (only known Phase 08.1 setUp reverts), GNUSBridge 19,938 B / GNUSBridgeAttestor 21,536 B under EIP-170

### Phase 15 Decisions Logged (15-03)

- 15-03: Off-chain reference computes the FLAT 13-field abi.encode while the chain computes the D-02 split bytes.concat — byte-identity PROVEN by vector leg V1 (flat == split == fixture structHash), never assumed; BRIDGE-18 fixture freezes keys/roots/proofs/digests over the C++ conformance environment (31337 / 0x1111...11) with on-chain legs re-signed over LIVE chainid + deployed diamondAddress
- 15-03: Digest-mismatch negatives run at GENESIS epoch with a single signature (foreign recovery always passes strict-ascending, always fails membership → deterministic 'Not a registered attestor'); R4 (old root after rotation, 2 active sigs) asserts bare reversion per the Phase-10 precedent; D9 sorts native-vote-bytes garbage recoveries off-chain so ordering passes and membership is the pinned failure
- 15-03: [GAS] A1 answer — 16-of-32 certificate bridgeIn = 313,844 gas; fee-replica pairing proves mint() and bridgeIn() post-fee balances identical (no twin drift, Pitfall 1); suite 42 passing, 15-01 regression 10 passing, zero contract-source touches

### Phase 15 Decisions Logged (15-02)

- 15-02: Transfer event in GNUSBridgeAttestor is a LOCAL topic0-identical declaration (GNUSLicensingPurchase.sol precedent) — Solidity 0.8.19 cannot emit through a non-inherited imported interface (qualified event access is 0.8.21+); the plan's "import IERC20Upgradeable" wording is unimplementable at this compiler pin (Rule 3 deviation, semantics unchanged)
- 15-02: V2 certificate path live — split-encode BRIDGE_CERTIFICATE_V2 digest (D-02) compiled clean on the first try (research A4 frame-sensitivity check resolved), bridgeIn CEI root-transition before fee-mint (D-07), per-signer proofs vs currentRoot ONLY (T-15-10); GNUSBridgeAttestor 21,536 B / GNUSBridge 19,938 B (probe-exact); legacy 0x0bee6121/0x1abd0f1e fully removed from source + ABI (D-06; BRIDGE-16 complete)
- 15-02: bridgeIn carries NO D-24 policy gate and NO limiter charge by design (GNUS_TOKEN_ID-only mint is the Phase-13 predicate's carve-out; bridge-in never charged the withdrawal limiter — bridgeOut-only) — the D-07 carry-forward is satisfied by Task 2's byte-for-byte preservation of bridgeOut/_enforceBridgePolicy (GNUSBridgePolicy.test.ts 13 passing)
- 15-02: EXPECTED RED window opens — test/unit/GNUSBridgeIn.test.ts + Foundry Bridge/Conservation setUp now target removed selectors; rewrites owned by 15-03/15-04, full-suite baseline gate at end of 15-04

### Phase 15 Decisions Logged (15-01)

- 15-01: `activeBridgeAttestorThreshold()` returns the EFFECTIVE epoch-derived threshold (1 at Genesis epoch 0, stored override at epoch > 0) per D-03 — the stored default 2 is asserted via the raw slot +6 probe; plan's Task-3 "getter == 2" reading conflated override with effective value
- 15-01: emergency recovery requires an initialized V2 set + one-shot init ⇒ epoch 0 structurally unreachable (Genesis unrecoverable, T-15-04); emergency writes epoch = old+1, never touches the init flag
- 15-01: GNUSBridgeAttestor registered at priority 116 / versions["2.6"] / fromVersions [0.0, 2.4, 2.5], no deployInit/upgradeInit (genesis address stays out of the repo, D-04); facet 16,795 B, GNUSBridge unchanged at 23,276 B; full Hardhat suite 616/2/1 (baseline 606/2/1 + 10 new)
- 15-01: BRIDGE-16 left pending — conversion half done here, legacy-selector removal half is Plan 15-02 (which also claims BRIDGE-16)

### Phase 14 Decisions Logged (14-05)

- 14-05: split-mint per-leg amounts are FIXED IN THE SKU (research question #5 resolved) — buyer-chosen splits deferred; zero-amount legs skip renewal clock and mint (no zero-mint clocks); networkIdToLicense uniqueness registry (claim pre-creation, write at finalization)

## Quick Tasks

| Date | Slug | Description | Status |
| ---- | ---- | ----------- | ------ |
| 2026-08-26 | sku0-sentinel-guard | createLicense rejects SKU id 0 (licenseSku sentinel collision) | ✓ complete |

## Next Actions

1. BRIDGE-17 tracking (sole deliberate remainder): production bridgeIn activation gated on SuperGenius#363 closing (#364 already closed) — gate record at docs/Secure-BridgeIn-Exporter-ABI.md §5 + 15-04-SUMMARY.md; track in .planning/SUBREPOS.md when scheduled.
2. Milestone close-out is the next GSD step — all 17 phases complete (remediation arc closed 2026-08-27): `/gsd:complete-milestone`, then `/gsd:verify-work 07`.
3. Recorded follow-ups — on-record 07-03 D-09 audit output awaiting owner routing (no work started): (a) snyk 23 medium+ transitive finding-set + OSV 115-advisory set need an owner dependency-refresh decision in an owning phase (STATE 07-03 disposition table); (b) git-secrets 37 hits incl. the three "privateKey" fixture fields at test/fixtures/bridge-attestor-vectors.json:26,32,38 awaiting owner review — no suppressions added; (c) slither triage-capable-upgrade follow-up (root cause of the --fail-none-only severity gate); (d) semgrep `unsafe-external-call` pattern-parse fix + the promotion-to-hard-gate condition (baseline stability across runs).
4. Test-suite cleanup (not blocking, pre-existing): Hardhat single failure `GNUSControlStorage.test.ts` "should return initial protocol info" (chainID 31337 vs 0, cross-suite pollution — passes in isolation; root fix = idempotent shared provenance initializer, Phase 9-style sweep); Foundry Phase 08.1 Safe setUp reverts (SafeSingleShotUpgrade + SafeDiamondCut); NEW 07-04 record — AccessControlInvariant flaky failure (STATE 07-04 routing event).

### Phase 13 Decisions Logged (13-06)

- Bridge policy gate v1 (D7/Q4): GNUS_TOKEN_ID + UNRESTRICTED pass; ALLOWLISTED checks the SENDER against the per-token registry (no registry → revert); LOCKED_AFTER_START reverts only when validFrom != 0 && block.timestamp >= validFrom; SOULBOUND/ISSUER_ONLY/CONTROLLED_RESALE hard-revert — gate placed BEFORE checkAndRecordWithdraw so reverted bridges consume no limiter allowance
- AI Credits SKU uses explicit maxSupply (1M), NOT the plan's maxSupply=0 — the max-supply hook runs after ERC1155Supply's increment, so 0 permits no mints (GNUSBridge base size measured 21,945 B, docs were stale; +766 B after the gate → 22,711 B, 1,865 B EIP-170 headroom)
- Production linker (13-06): lazy library deploy honors the signer intercepted from getContractFactory(name,{signer}) so GNUSLifecyclePolicy deploys to the RPC target network, not the HRE default
- Regression baselines re-verified 2026-08-24: Hardhat 564/2/1 (only known-stale GNUSControlStorage chainID), Foundry 215/2/3 (only known Phase 08.1 setUp reverts)

### Phase 10 Decisions Logged (10-04)

- Deterministic-invalid certificate derived from fuzz seed (`sigs[0] = abi.encodePacked(bytes32(seed), bytes32(seed^1), uint8(27))`) — random garbage that must NEVER verify; `invariant_noValidCertFromFuzzedSigs` asserts `ghost_bridgeInSuccesses == 0` (BRIDGE-03 soundness)
- Validator set configured in setUp with fixed nonzero root + threshold=1 (T-10-F02) — an unconfigured set would vacuously revert before reaching signature checks, making the soundness invariant meaningless
- Handler swallows reverts and only tracks state — reverting in the handler would cause the fuzzer to discard runs on expected reverts
- `GNUS_BRIDGE_VALIDATOR_STORAGE_POSITION` declared once as a constant in BridgeInvariant with the mapping-slot formula documented (T-10-F05) — invariants read `processedMessages[transferId]` via direct `vm.load` of `keccak256(abi.encode(transferId, POSITION))`
- Bridge-pair conservation formula: `globalSupply == globalSupplyAtSeed + totalMinted - totalBurned + totalBridgedInAmount` — bridgeOut burn (already subtracted in I1's tree-supply check) and bridgeIn mint cancel globally (D-01/D-02)
- Full clean-tree `yarn forge:test` verified 213 passed / 2 failed / 3 skipped — identical to Phase 9's documented baseline; the 2 failures are Phase 08.1 Safe-proposer setUp reverts, unchanged

### Phase 10 Decisions Logged (10-03)

- Helper module accepts `BaseWallet` (not `Wallet`) — `Wallet.createRandom()` returns `HDNodeWallet` which extends `BaseWallet` but not `Wallet`; `signMessage` lives on `BaseWallet` in ethers v6, so widening the type is the minimal-change fix
- Merkle tree builder tracks per-node member SETS (not a single inherited leaf index) — fixes a draft bug where right-subtree leaves were missing sibling appends when their ancestor merged
- Diamond `chainID` aliased to live Hardhat chainid (31337) in test setup via `setChainID` so `bridgeIn`'s D-08 cross-chain guard passes for happy-path tests; wrong-chain test exercises digest mismatch by overriding `destChainID` off-chain
- Global-cap test uses `amount = GNUS_MAX_SUPPLY + 1` directly — no need to seed `globalSupply` near the cap, the require fires on the very first bridgeIn
- `chainSupply` assertion dropped in favor of `totalSupplyOfAll` — GNUSTreasury does not expose a public per-chain reader; per-chain partition is covered by Plan 10-04 Foundry invariants
- Canonical test vector (Hardhat account #0 private key, fixed BridgeInMessage) is logged for SG-side `SignEVM` C++ cross-check — closes Pitfall 1 / Pitfall 3 mitigation

### Phase 10 Decisions Logged (10-02)

- bridgeIn lives on the existing GNUSBridge facet (not a new facet) — final deployedBytecode is 21635 bytes (2941 headroom under EIP-170)
- Digest binds transferId, srcChainID, block.chainid, address(this), recipient, GNUS_TOKEN_ID, amount via abi.encode, then EIP-191-wraps with toEthSignedMessageHash — cross-chain (D-08) and cross-diamond replay protection
- Merkle leaf is keccak256(abi.encodePacked(signer)) — 20-byte packed encoding per Pitfall 3 (NOT abi.encode which pads to 32); SG side must match
- GNUS_TOKEN_ID hardcoded in bridgeIn (D-14) — child-token bridge-in is mint-of-id-0 followed by GNUSTreasury convert; no tokenId parameter on bridgeIn
- Explicit require(v.validatorThreshold > 0, "Validator set not configured") placed BEFORE the signatures.length >= threshold check (Pitfall 7) — without it, an unconfigured set would vacuously pass any certificate
- setValidatorSet emits ValidatorSetUpdated BEFORE the write so the event captures the OLD root (D-18 multisig audit trail)
- No deployInit/upgradeInit on the GNUSBridge 3.0 diamond-config entry — explicit setValidatorSet post-upgrade beats magic defaults for security-critical parameters (RESEARCH Pitfall 7)

### Phase 10 Decisions Logged (10-01)

- Pure storage library with no imports — mirrors GNUSTreasuryStorage.sol exactly (no LibDiamond dependency needed for a data-only layout)
- Slot string is `gnus.ai.bridge.validator.storage` (with .validator infix), NOT `gnus.ai.bridge.storage` — 10-RESEARCH.md Pitfall 6 reserves the shorter name for a future facet
- No Initialize function on the storage library — Phase 10 uses explicit configuration via `setValidatorSet` (10-RESEARCH.md Pitfall 7: explicit configuration beats magic defaults)
- Field order is load-bearing for append-only compatibility: `processedMessages` → `validatorMerkleRoot` → `validatorThreshold`; Phase 12 may append after these fields

### Phase 9 Decisions Logged (09-05)

- ConservationInvariant Foundry suite lands I1/I2/I5 only — I3 (two-diamond bridge) and I6 (limiter charge matrix) are pinned by GNUSTreasury.test.ts unit suites per plan; I4 covered by unit tests
- Handler ghost variables come in two flavors: call counters (coverage) and amount sums (invariants) — `ghost_totalBridgedOutAmount` distinct from `ghost_totalBridgeDeposits`; `ghost_totalAdminBurned` distinct from `ghost_totalBurned`
- T-09-28 mitigation: handler draws ids from `ghost_createdIds` only — random id seeds almost never hit created ids
- Slither 0.11.5 run on 5 changed contracts: 3 unique findings, all false-positives (weak-prng on deterministic bin indexing; erc721-interface on intentional ERC-20 facade `approve`/`transferFrom` return-bool). Committed slither.config.json NOT modified.
- Slither inclusion gap: `contracts/gnus-ai/` is NOT actually excluded in the committed filter_paths (CONCERNS.md is stale on this point), but `yarn slither:scan` is evidently not running in CI — Phase 7 owns wiring it into the audit gate
- smart-trigger.ts:389 `'mint'` label confirmed inert (function-NAME risk classifier, not calldata builder) — dispositioned with comment, no semantic change

### Phase 9 Decisions Logged (09-04)

- GNUSTreasury deployInit/upgradeInit left EMPTY in diamond config (tooling calls initializers with no args); real signature kept in custom deployInitSignature/upgradeInitSignature fields; tests seed via explicit GNUSTreasury_Initialize300 call
- DiamondInitFacet version key is "3" not "3.0" — protocolInitFacet lookup stringifies protocolVersion to a JS number, so "3.0" never matches
- GNUSNFTFactory 3.0 entry carries deployInit/upgradeInit GNUSNFTFactory_Initialize230() — without it NFTs[0] is never created on fresh 3.0 deploys
- Two-diamond test fixtures need a name-matching artifact (GeniusDiamondChainB mock) + diamonds.paths entry; attach via the generated diamond-abi/GeniusDiamond.json ABI
- Library-declared events (SuperAdminBypass) are absent from the proxy ABI — assert via raw log topic, not chai .to.emit
- beforeMint burns from the CALLER — tests fund owner first, then owner factory-mints child to recipient (ownerMintChild pattern)

### Phase 9 Decisions Logged (09-03)

- Provenance counter increments use the post-fee `amount` local variable (not a separately captured pre-fee value) — Pitfall 3 compliance
- Cap check placed inside `if (tokenID == GNUS_TOKEN_ID)` — defense-in-depth after D10 restriction
- bridgeOut limiter charge uses `amount` directly — minion-denominated under D1/D2; division removed entirely
- No globalSupply hook on bridgeOut — B1 model (destination chain's bridge-in mint is the + side)
- GNUSBridge deployedBytecode: 18181 bytes (down from ~18872 baseline; net negative byte impact per research §H)

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Safe Wallet Proposer retrofit for diamondCut proposals (URGENT)
- Phase 08.2 inserted after Phase 08.1: Deploy-verify pipeline fixes (URGENT)

## Session Continuity

Last session: 2026-08-27T22:21:32.889Z
Stopped at: Blocked at 07-02 Task 3 — awaiting owner placement of BOTH tokens in gnus-ai/.env (SNYK_TOKEN + SOCKET_CLI_API_TOKEN; snyk:test restored per superseding ruling, commit 59dd883)
Resume file: None
