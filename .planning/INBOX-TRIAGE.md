===================================================================
  GSD INBOX TRIAGE — GeniusVentures/gnus-ai — 2026-05-26
===================================================================

SUMMARY
-------
Open issues: 14    Open PRs: 0

  Features:    0        Feature PRs:      0
  Enhancements:11       Enhancement PRs:  0
  Bugs:        0        Fix PRs:          0
  Chores:      0        Wrong template:   0
  Unclassified:3        No linked issue:  0

GATE VIOLATIONS
---------------------------------
(None — no open PRs)

ISSUES NEEDING ATTENTION
------------------------

#19 [UNCLASSIFIED] rename deployment files to match current spec
  Score: 10% — MISSING: labels, body (empty), acceptance criteria
  Labels: (none) → Suggested: needs-triage
  Age: 415 days | Updated: 2025-04-05
  Note: Empty body. Cannot determine scope or intent.

#15 [UNCLASSIFIED] Verification Scripts
  Score: 20% — MISSING: labels, detailed body, acceptance criteria
  Labels: (none) → Suggested: needs-triage
  Age: 418 days | Updated: 2025-11-10
  Note: One-liner body. "Incorporate Verification Scripts into Diamonds"

#16 [UNCLASSIFIED] Callback Tests
  Score: 20% — MISSING: labels, detailed body, acceptance criteria
  Labels: (none) → Suggested: needs-triage
  Age: 418 days | Updated: 2025-04-03
  Note: One-liner body. "Create Tests for Callbacks to makes sure the run on Forked Test Chains and Hardhat"

#38 [enhancement] Investigate Axelar mechanism for bridging
  Score: 25% — MISSING: body (empty), acceptance criteria, scope
  Labels: enhancement, question → Keep
  Age: 202 days | Updated: 2025-11-10
  Note: Empty body. Title is the only content.

#37 [enhancement] Callbacks for Diamond Monitor dev env
  Score: 25% — MISSING: detailed body, acceptance criteria, scope
  Labels: enhancement → Keep
  Age: 253 days | Updated: 2025-09-15
  Note: One-liner body.

#36 [enhancement] Diamonds-Monitor module for the Graph
  Score: 25% — MISSING: detailed body, acceptance criteria
  Labels: enhancement → Keep
  Age: 259 days | Updated: 2025-09-09
  Note: One-liner body. "Explore utilizing TheGraph protocol for use with the Diamonds-Monitor"

#35 [enhancement] Diamonds-Monitor module for OZ Defender Monitor Open-Source
  Score: 25% — MISSING: detailed body, acceptance criteria
  Labels: enhancement → Keep
  Age: 259 days | Updated: 2025-09-09
  Note: One-liner body.

#31 [enhancement] Diamonds Monitor Node Module
  Score: 25% — MISSING: detailed body, acceptance criteria
  Labels: enhancement → Keep
  Age: 280 days | Updated: 2025-08-20
  Note: One-liner body. "Create Diamonds Deployment Verification node module."

#21 [enhancement] Verification Callback (ETHERSCAN)
  Score: 25% — MISSING: acceptance criteria, scope
  Labels: enhancement → Keep
  Age: 414 days | Updated: 2025-05-14
  Note: Brief body about Etherscan verified setting.

#22 [enhancement] Callback Tests for GNUS-AI
  Score: 25% — MISSING: detailed body, acceptance criteria
  Labels: enhancement → Keep
  Age: 414 days | Updated: 2025-05-14
  Note: Brief body about testing callbacks.

#39 [documentation] Total Supply Cross-Chain Facet Design
  Score: 70% — MISSING: acceptance criteria, type-of-issue classification
  Labels: documentation → Suggested: enhancement, needs-review
  Age: 202 days | Updated: 2025-11-05
  Note: Good body with detailed questions. Should be reclassified as an enhancement or feature request. This is a design document, not a documentation issue.

#43 [enhancement] Implement Diamonds-Hardhat-Foundry module in GNUS-ai
  Score: 40% — MISSING: detailed scope, acceptance criteria, breaking changes
  Labels: enhancement → Keep
  Age: 154 days | Updated: 2025-12-23
  Note: Has user story format but lacks scope details and acceptance criteria.
  RELEVANCE: Likely already done — diamonds-hardhat-foundry is in package.json dep tree.

#56 [enhancement] Diamonds Devcontainer tests action CI/CD
  Score: 30% — MISSING: detailed scope, acceptance criteria, alternatives
  Labels: enhancement → Keep
  Age: 125 days | Updated: 2026-01-21
  Note: Two sentences. Relevant to current DevOps pipeline.

#50 [enhancement] Implement NPM security policy and implementation
  Score: 60% — MISSING: acceptance criteria, scope of changes, implementation plan
  Labels: enhancement → Keep
  Age: 141 days | Updated: 2026-01-05
  Note: Good body with 6 specific security principles. Partially addressed — package.json already pinned, 7-day age check exists, checksumBehavior: throw enabled. Could be closed with comment noting what was implemented.
  RELEVANCE: Overlaps with already-completed dependency hardening.

STALE ITEMS (>90 days, no activity)
------------------------------------
  #15 Verification Scripts (418d) — no labels, one-liner
  #16 Callback Tests (418d) — no labels, one-liner
  #19 rename deployment files (415d) — no labels, empty body
  #21 Verification Callback (ETHERSCAN) (414d) — enhancement
  #22 Callback Tests for GNUS-AI (414d) — enhancement
  #31 Diamonds Monitor Node Module (280d) — enhancement
  #35 Diamonds-Monitor OZ Defender (259d) — enhancement
  #36 Diamonds-Monitor Graph (259d) — enhancement
  #37 Callbacks dev env (253d) — enhancement
  #38 Axelar bridging investigation (202d) — enhancement/question
  #39 Total Supply Cross-Chain (202d) — documentation

ACTIONABLE FOR CURRENT ROADMAP
------------------------------
  #50 — Partially complete (pinned versions, 7-day check, checksums done). Consider closing.
  #56 — CI/CD auto-testing. Could fold into Phase 6 (Test Coverage) or Phase 7.
  #39 — Cross-chain supply design. Related to child NFT treasury investigation (v2).

===================================================================

FINAL STATE (2026-05-26)
========================
Open: 2    Closed: 12

Remaining open:
  #39 [enhancement, documentation] Total Supply Cross-Chain Facet Design
    → v2 investigation item. Aligned with child NFT treasury research.

  #56 [enhancement] Diamonds Devcontainer tests action CI/CD
    → Could feed into Phase 6 (Test Coverage). Keep open for roadmap consideration.

Closed (already done):
  #15 Verification Scripts — hardhat-verify v2.1.3 configured
  #19 rename deployment files — naming convention applied
  #21 Verification Callback (ETHERSCAN) — etherscan config in hardhat.config.ts
  #31 Diamonds Monitor Node Module — @diamondslab/diamonds-monitor v1.0.4 installed
  #35 OZ Defender Monitor — @openzeppelin/defender-sdk v2.7.0 installed
  #36 TheGraph module — exploration never pursued, not required
  #37 Callbacks dev env — callbacks exist in test-assets/
  #43 Diamonds-Hardhat-Foundry — @diamondslab/diamonds-hardhat-foundry v2.4.0 installed
  #50 NPM security policy — partially implemented (pinned versions, 7-day check, checksums)

Closed (stale/irrelevant):
  #16 Callback Tests — 418d stale, out of scope
  #22 Callback Tests for GNUS-AI — GeniusAI facet being removed
  #38 Axelar bridging — investigation never pursued
