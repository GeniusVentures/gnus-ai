# Roadmap: Gnus.ai Smart Contracts

**Updated:** 2026-08-31

## Shipped Milestones

### v1.0 — Tech Debt & Security Remediation ✅ (2026-05-26 → 2026-08-28)

16 phases, 45 plans — security remediation arc (Phases 1–7), Safe-proposed upgrades + deploy-verify (08.1/08.2), conversion-native treasury (9), provenance-relocation bridge + Secure BridgeIn V2 (10, 15), redeem adapter (11), time-bound AI entitlements (13), private-network AI licensing (14). 50/53 requirements satisfied; PROXY-01/02 deferred to `erc20-gnus-proxy`, BRIDGE-17 gated on SuperGenius #363.

[Full details](milestones/v1.0-ROADMAP.md) · [Requirements](milestones/v1.0-REQUIREMENTS.md) · [Audit](milestones/v1.0-MILESTONE-AUDIT.md)

---

## Active Milestone

### v1.1 — Proxy Completion & Production Readiness (2026-08-28 →)

**Parent-level milestone** — planned and tracked at `TokenContracts/.planning/` (REQUIREMENTS.md / ROADMAP.md / v1.1-MILESTONE-AUDIT.md); this file mirrors the **gnus-ai-executed slice**. Phase numbers continue from v1.0. Phase 16 (ERC-20 Proxy Hardening) executed in `erc20-gnus-proxy/` as its Phase 1 — ✅ Complete 2026-08-30 (PR #12, PROXY-01/02/04 satisfied). Phase 21 (Child-NFT Economics Research) is cross-repo and stays parent-planned; Phase 22 depends on its exit. Phases 17–20 are order-independent.

## Phase Summary

| #   | Phase                         | Goal                                                              | Requirements    | Success Criteria |
| --- | ----------------------------- | ----------------------------------------------------------------- | --------------- | ---------------- |
| 17  | Test-Suite Determinism        | Full-suite green, no flakes, no known-stale failures              | TEST-04, 05, 06 | 4                |
| 18  | Scanner Triage Upgrades       | slither + semgrep gates expressed as real severity triage         | SEC-09, 10      | 3                |
| 19  | Dependency & Secrets Hygiene  | OSV remainder refreshed; every git-secrets hit dispositioned      | DEP-02, SEC-11  | 3                |
| 20  | BridgeIn Activation Readiness | #363 gate checked; bridgeIn activated or readiness-shipped        | BRIDGE-17       | 4                |
| 22  | Child-NFT Economics Build     | Implement what Phase 21 validated (scope confirmed at 21 exit)    | NFT-04, 05, 06  | 4                |

## Phase Details

### Phase 17: Test-Suite Determinism

**Goal:** Eliminate every known non-deterministic or known-stale failure in the gnus-ai suites at the root cause.
**Depends on:** nothing. Baselines: Hardhat 666/2/0 with 1 known-stale failure; Foundry 215/2/3 with setUp reverts + flaky invariant.
**Success criteria:**

1. GNUSControlStorage "should return initial protocol info" passes in the FULL suite (root fix, no test-side guard)
2. AccessControlInvariant passes across N consecutive runs without seed-luck (config seeded or invariant aligned to handler)
3. SafeSingleShotUpgrade + SafeDiamondCut setUp green
4. New baselines recorded with zero known-stale/failing entries

**Requirements:** TEST-04, TEST-05, TEST-06
**Plans:** 5 plans

Plans:
**Wave 1**

- [ ] 17-01-PLAN.md — Shared baseline helper (ensureDiamondTestBaseline) + TEST-04 victim wiring + guard deletion
- [ ] 17-04-PLAN.md — Foundry: invariant attacker re-target (D-01) + Safe setUp vm.skip fork gate (D-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 17-02-PLAN.md — Tier-A test/unit scaffold sweep (12 files; bridge re-alias ordering preserved)
- [ ] 17-03-PLAN.md — Tier-B probe-guard dedup (9 files) + non-unit Tier-A scaffolds (gas/integration/deployment)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 17-05-PLAN.md — N=5/N=10 determinism proof + STATE.md canonical baseline ledger (D-06)

**Priority:** P1 (CI reliability)
**Source:** mirrored from `TokenContracts/.planning/ROADMAP.md` Phase 17 (2026-08-31)

### Phase 18: Scanner Triage Upgrades

**Goal:** Express scanner severity gates as real triage instead of version-specific exit-code workarounds.
**Depends on:** nothing (17's clean baselines help but are not required).
**Success criteria:**

1. slither on a triage-capable line; known Phase-9 FPs triaged in config, gate exits 0 with triage visible
2. semgrep `unsafe-external-call` pattern parses and executes
3. CI semgrep step promoted to hard gate (continue-on-error dropped) on a stable recorded baseline

**Requirements:** SEC-09, SEC-10
**Source:** mirrored from `TokenContracts/.planning/ROADMAP.md` Phase 18 (2026-08-31)

### Phase 19: Dependency & Secrets Hygiene

**Goal:** Close the OSV advisory remainder and give every git-secrets hit an explicit provenance disposition.
**Depends on:** nothing. Owner participation likely for git-secrets rulings and any OSV residuals.
**Success criteria:**

1. `yarn osv:scan` exit 0, or every residual advisory carries an owner-ruling disposition
2. All 37 git-secrets hits dispositioned (fixture keys proven test-only, remediated, or `.gitallowed` by owner ruling)
3. `yarn install --immutable` + audit gates still green after resolutions

**Requirements:** DEP-02, SEC-11
**Source:** mirrored from `TokenContracts/.planning/ROADMAP.md` Phase 19 (2026-08-31)

### Phase 20: BridgeIn Activation Readiness

**Goal:** BRIDGE-17 resolved either way — activation if the external gate closed, packaged readiness if not.
**Depends on:** nothing (external gate: SuperGenius #363). Verify state at phase start.
**Success criteria:**

1. SuperGenius #363 state verified and recorded in the phase record
2. If closed: bridgeIn activated on Sepolia (attestor set bootstrapped, first certificate processed, epoch advanced)
3. If open: activation runbook + config shipped; BRIDGE-17 remains the only blocker
4. Exporter ABI doc §5 gate record updated to current state

**Requirements:** BRIDGE-17
**Source:** mirrored from `TokenContracts/.planning/ROADMAP.md` Phase 20 (2026-08-31)

### Phase 22: Child-NFT Economics Build

**Goal:** Implement what Phase 21 validated, under the conversion-native conservation model.
**Depends on:** Phase 21 (Child-NFT Economics Research — cross-repo, parent-planned; go/no-go per NFT-04/05/06 recorded at its exit).
**Success criteria:**

1. Every go-item from Phase 21 implemented with tests on the gnus-ai diamond
2. Conservation invariants extended and green over any new treasury/swap surface
3. No-go items moved to Out of Scope with the refuting evidence referenced
4. Full-suite + security gates green

**Requirements:** NFT-04, NFT-05, NFT-06
**Source:** mirrored from `TokenContracts/.planning/ROADMAP.md` Phase 22 (2026-08-31)
