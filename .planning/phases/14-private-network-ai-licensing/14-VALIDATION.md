---
phase: 14
slug: private-network-ai-licensing
status: final
nyquist_compliant: true
wave_0_complete: false  # planner note: Wave-0 gaps are created inside 14-02/14-03 tasks (new files), not a separate wave
created: 2026-08-25
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Hardhat (mocha/chai) + Foundry (invariant fuzzing) |
| **Config file** | `hardhat.config.ts` / `foundry.toml` |
| **Quick run command** | `npx hardhat test test/unit/<suite>.test.ts` |
| **Full suite command** | `npx hardhat test` (Hardhat) + `yarn forge:test` (needs running `npx hardhat node`) |
| **Estimated runtime** | ~10-15 min full suite (diamond deploys dominate) |

**Known baselines (never "fix" these):** Hardhat 571 passing / 2 pending / 1 known-stale GNUSControlStorage chainID failure; Foundry 215 passed / 2 known-stale Phase 08.1 setUp reverts / 3 skipped.

---

## Sampling Rate

- **After every task commit:** Run the touched suite(s) via `npx hardhat test test/unit/<suite>.test.ts`
- **After every plan wave:** `npx hardhat test` full suite (+ `yarn forge:test` when invariants touched)
- **Before `/gsd:verify-work`:** Full suite green at the known baselines
- **Max feedback latency:** ~10 minutes

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 14-01 | 1 | LIC-07 | T-14-01-02 | stale rail wording removed from spec docs | source assertion (grep) | `grep -c "Banxa" .planning/REQUIREMENTS.md` | ✅ exists | ✅ green |
| 14-01-02 | 14-01 | 1 | LIC-02 | T-14-01-01 | zero-default decode of appended fields; round-trip probe | unit (upgrade probe) | `npx hardhat test test/unit/GNUSLifecycleUpgrade.test.ts` | ✅ extend | ✅ green |
| 14-02-01 | 14-02 | 1 | LIC-03 | T-14-02-01/02 | SKU CRUD role-gated, events emitted | compile + bytecode ≤24,576B | `npx hardhat compile` | ❌ Wave 0 (new) | ✅ green |
| 14-02-02 | 14-02 | 1 | LIC-03 | T-14-02-03 | facet registered at versions["2.6"], never 2.7 | config assertion (grep) | `grep -A4 '"GNUSLicensing"' diamonds/GeniusDiamond/geniusdiamond.config.json` | ✅ exists | ✅ green |
| 14-03-01 | 14-03 | 2 | LIC-04 | T-14-03-01/05 | GNUS-burn payment (totalSupply delta), policy-hook mints | compile + unit | `npx hardhat compile` then `npx hardhat test test/unit/GNUSLicensing.test.ts` | ❌ Wave 0 (new) | ✅ green |
| 14-03-02 | 14-03 | 2 | LIC-01, LIC-03, LIC-04, LIC-05, LIC-06 | T-14-03-01..04 | hierarchy, SKU gating, burn accounting, LicenseActivated on create+renew, hybrid redeem config | unit | `npx hardhat test test/unit/GNUSLicensing.test.ts` | ❌ Wave 0 (new) | ✅ green |
| 14-04-01 | 14-04 | 1 | LIC-05 | T-14-04-01..04 | expired/unprivileged bridgeOut reverts; privileged unexpired passes; burn carve-out intact | unit | `npx hardhat test test/unit/GNUSBridgePolicy.test.ts` | ✅ extend | ✅ green |

| 14-05-01 | 14-05 | 3 | LIC-01, LIC-04 | T-14-05-01/02 | zero/duplicate network id rejection; lazy propagation + mismatch revert | unit | `npx hardhat test test/unit/GNUSLicensing.test.ts` | ✅ extend | ✅ green |
| 14-05-02 | 14-05 | 3 | LIC-01, LIC-04 | T-14-05-03..06 | split-mint SKU: both legs in one tx, ONE price burn; public leg network-zero; no-leg SKU gate | unit | `npx hardhat test test/unit/GNUSLicensing.test.ts` | ✅ extend | ✅ green |

*(14-05 gap-closure rows verified 2026-08-25: 22 passing licensing suite; full suite 601/2/1 at known baselines.)*

*(Nyquist audit 2026-08-25: all 9 map rows verified against actual test cases — licensing 31 `it()` (14 original + 8 gap-closure + 3 review-fix CR-01/WR-01/WR-03 + IN-02/IN-03 extensions), bridge policy 19, lifecycle upgrade 6 (incl. two Phase 14 slot-probe cases). Grep assertions re-run: Banxa 0/0; facets at priority 122/123, protocolVersion 2.6. Full suite re-run: 604 passing / 2 pending / 1 known-stale failing (GNUSControlStorage chainID — never fix). No new tests needed; every LIC-01..07 and roadmap SC1-7 already covered.)*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Planner will replace the placeholder row with the concrete task map once plans exist.)*

---

## Wave 0 Requirements

- [x] New Phase 14 test suite files created alongside facet work (follow GNUSLifecycle*.test.ts patterns) — `test/unit/GNUSLicensing.test.ts` and `test/unit/GNUSBridgePolicy.test.ts` created during 14-03/14-04
- [x] If Foundry invariants are added: verify `npx hardhat node` prerequisite documented in plan — N/A; no Phase 14 Foundry invariants added

*Existing infrastructure covers all phase requirements; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fiat-paid license creation (off-chain GV ops flow) | LIC-04 (as amended) | Off-chain operator process, no contract surface | Verify contract state after operator mint; confirm no USDC/Banxa contract code exists |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every one of the 9 rows carries an automated command)
- [x] Wave 0 covers all MISSING references (all Wave-0 "new" suites created; no MISSING refs remain)
- [x] No watch-mode flags (no `--watch` in any map command)
- [x] Feedback latency < 10 min (~10-15 min full suite; touched-suite runs ~1-2 min)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-25 (nyquist audit — all rows verified against actual test files; full suite 604/2/1 at known-stale baseline)
