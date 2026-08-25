---
phase: 14
slug: private-network-ai-licensing
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 14-xx-01 | TBD | TBD | LIC-xx | TBD | TBD | unit | `npx hardhat test test/unit/...` | TBD (planner fills) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Planner will replace the placeholder row with the concrete task map once plans exist.)*

---

## Wave 0 Requirements

- [ ] New Phase 14 test suite files created alongside facet work (follow GNUSLifecycle*.test.ts patterns)
- [ ] If Foundry invariants are added: verify `npx hardhat node` prerequisite documented in plan

*Existing infrastructure covers all phase requirements; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fiat-paid license creation (off-chain GV ops flow) | LIC-04 (as amended) | Off-chain operator process, no contract surface | Verify contract state after operator mint; confirm no USDC/Banxa contract code exists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 min
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
