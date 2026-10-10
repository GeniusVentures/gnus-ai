# Anthropic OSS Scanner threat model — GNUS.ai smart contracts

## Project and entry points

This repository contains GNUS.ai's upgradeable ERC-2535 diamond contracts, an ERC-20-compatible GNUS token surface, hierarchical ERC-1155 assets, token mint/burn conversion, licensing, bridge logic, and contracts that manage operator privileges. The authoritative Solidity sources include the pinned public `contracts/gnus-ai` and `diamonds/GeniusDiamond` submodules.

Treat all public transaction calldata, EOA and contract callers, token callbacks, external bridge/attestor messages, cross-chain origin data, and metadata as untrusted. A local Hardhat network is sufficient to reproduce most issues. Do not assume that off-chain user interfaces protect a contract entry point.

## High-value invariants

- No unauthorized mint, burn, withdrawal, ownership change, upgrade, facet cut, or privileged operator call.
- Total supply and balances remain sound across ERC-20-like, ERC-1155, and burn-for-mint paths.
- Upgradeable diamond storage slots, initializers, selector dispatch, and role checks remain safe under legitimate upgrades.
- Bridge messages and attestation proofs cannot be replayed, forged, counted twice, or credited on the wrong chain or token identifier.
- Reentrant hooks, callbacks, failed transfers, fee calculations, pause/withdraw limits, and emergency controls cannot bypass checks or strand funds.
- Arithmetic and signature verification protect the correct chain, domain, recipient, nonce, asset, and amount.

## Severity and report quality

**Critical:** A plausible public exploit lets an attacker steal or freeze significant funds, mint unbacked GNUS or NFTs, upgrade the diamond, seize governance/roles, or bypass bridge verification for material value.

**High:** Reliable privilege escalation, unauthorized balance manipulation, significant asset lockup, signature/nonce replay, or exploitable reentrancy without proven material loss.

**Medium:** Limited-value bypasses, service denial, economic griefing, or exploits that require privileged cooperation or unusual state.

**Low:** Non-exploitable best-practice issues and hardening ideas. Do not raise severity based on a hypothetical exploit with no reachable path.

For each finding, name the exact Solidity source, vulnerable function, attacker prerequisites, required state, concrete loss or impact, and a reproducible local test. Distinguish verified defects from speculation. Propose minimal fixes and tests that fail before the fix and pass after it.

## Build and local tests

The scanner image leaves checkout, source, Hardhat, Solidity compiler cache, artifacts, and TypeChain outputs under `/src`. Use the local Hardhat network, for example:

```bash
cd /src
node .yarn/releases/yarn-4.10.3.cjs hardhat test --no-compile test/unit/GNUSControlStorage.test.ts
```

To inspect other paths, use `test/unit` or targeted `test/integration` suites that do not need an outside RPC. The Solidity submodules are pinned to gitlink commits; their default branches need not match `develop`.

## Out of scope and restrictions

Do not contact live chain RPC endpoints, sign or broadcast transactions, ask for deployment keys, run fork tests that depend on outside services, or change production contracts. Do not report dependency-only vulnerabilities unless a reachable GNUS.ai code path uses them. Treat third-party vendored packages and generated ABIs as supporting context, not the principal audit target. Keep findings and exploit reproductions private to the maintainer at `admin@gnus.ai`.
