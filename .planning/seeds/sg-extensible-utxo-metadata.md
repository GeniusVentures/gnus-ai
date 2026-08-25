---
title: Extensible UTXO metadata on SuperGenius (timed UTXOs)
trigger_condition: Phase 14 EVM side lands, or SuperGenius-side protocol capacity opens
planted_date: 2026-08-25
---

Add an **extensible metadata payload to GeniusUTXO** on the SuperGenius chain:

- **Field 1 — `expiresAt` (timestamp):** consensus-enforced. UTXOs become unspendable once
  expired and are prunable from the UTXO set. Populated by the bridge attestation from an EVM
  RPC lookup of the token's expiry (see notes/bridge-expiry-transport.md).
- **Validation rule:** SG rejects (or creates-as-already-expired) UTXOs whose attested expiry
  is in the past — expired credits cannot be revived by bridging.
- **Future fields (inert data until consumed):** NFT meta.json URI pointer, other token
  metadata the attestation can source via RPC.

Design stance (owner, 2026-08-25): this is the destination, not an app-level lazy-validation
interim — if timed UTXOs are inevitable, skip building the throwaway app-layer enforcement.

Implementation home: SuperGenius repo (NOT TokenContracts). Sequencing: EVM minting/recording
can go live first; wallets perform soft expiry checks until this lands.

Sources: docs.gnus.ai Super Genius Blockchain Technical Details (GeniusUTXO/UTXOManager/
OutPoint, MMR proofs; no existing timelock primitive documented).
