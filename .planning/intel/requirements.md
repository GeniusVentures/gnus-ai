# Synthesized Requirements

**Synthesized:** 2026-05-26
**Mode:** merge

## No New Smart-Contract Requirements Surfaced

The 22 existing requirements in `.planning/REQUIREMENTS.md` (DEBT-01 through DEP-01) fully cover the scope of this remediation project. No ingested document introduces additional smart-contract requirements, gaps, or remediation needs beyond what is already captured.

The contract API docs (18 files) confirm the existence and behavior of each facet but do not introduce new acceptance criteria.

## Infrastructure PRDs (Out of Scope for This Remediation)

Three PRD-type documents were ingested. They define requirements for DevContainer infrastructure — not for smart-contract remediation. These are acknowledged for context but not added to the Active requirements set:

- **INFRA-PRD-01**: DevContainer Docker-Compose and HashiCorp Vault Integration
  - Source: `.devcontainer/project/prd/docker-compose-prd.md`
  - Scope: Migration to docker-compose, Vault secret management, environment variable loading

- **INFRA-PRD-02**: HashiCorp Vault Persistence & CLI Installation
  - Source: `.devcontainer/project/prd/vault-persistence-cli-prd.md`
  - Scope: File-based persistence (Raft storage), Vault CLI installation

- **INFRA-PRD-03**: HashiCorp Vault Remote Connectivity
  - Source: `.devcontainer/project/prd/vault-remote-connectivity-prd.md`
  - Scope: Remote Vault instances (HCP, AWS, GCP), failover to local Vault

These PRDs concern the development environment tooling, not the production smart contracts. They should be tracked separately if the DevContainer infrastructure becomes a focus.

---

_Source: synthesis of 35 classification files in `.planning/intel/classifications/`_
