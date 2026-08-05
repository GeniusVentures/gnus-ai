---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
last_updated: "2026-08-05T21:06:00.000Z"
progress:
  total_phases: 16
  completed_phases: 9
  total_plans: 20
  completed_plans: 19
  percent: 60
---

# Project State

**Project:** Gnus.ai Smart Contracts — Tech Debt & Security Remediation
**Last Updated:** 2026-07-02

## Project Reference

See: .planning/PROJECT.md

**Core value:** Production-ready smart contracts that have passed comprehensive security review and are safe for mainnet deployment.
**Current focus:** Phase 09 — per-child-gnus-treasury-reserve

## Phase Status

| Phase | Name                              | Status | Plans | Progress |
| ----- | --------------------------------- | ------ | ----- | -------- |
| 1     | Preliminary Cleanup               | ✓      | 2/2   | 100%     |
| 2     | Dead Code Removal                 | ✓      | 2/2   | 100%     |
| 3     | Input Validation                  | ✓      | 2/2   | 100%     |
| 4     | Access Control & Observability    | ✓      | 1/1   | 100%     |
| 5     | Circuit Breaker & Performance     | ⎇ PR #68 | 1/1 | review (05-VERIFICATION pass) |
| 6     | Test Coverage                     | ⏳     | 1/2   | 50%      |
| 7     | Dependency Hardening              | ○      | 0/0   | 0%       |
| 08.1  | Safe Wallet Proposer Retrofit     | ✓      | 3/3   | 100%     |
| 08.2  | Deploy-Verify Pipeline Fixes      | ○      | 0/3   | 0%       |
| 9     | Per-Child GNUS Treasury/Reserve   | ⏳     | 3/5   | 60%      |

## Next Actions

1. Execute Plan 09-04: beforeMint rewrite (1:1 minion + depth gate) + diamond config 3.0 + GNUSTreasury unit suite

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
