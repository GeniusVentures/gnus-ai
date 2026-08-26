
## Phase 14 — expiry transport & timed UTXOs (from /gsd-explore, 2026-08-25)

1. **Expiry determinism across SG validators:** attest-time RPC read vs snapshot at the burn
   block — how do all signers guarantee they attest the same expiry value?
2. **Field/encoding spec EVM↔SG:** exact representation of expiry (and future metadata) in the
   attestation message and the GeniusUTXO payload.
3. **Renewal semantics on SG:** does renewal require re-bridging fresh UTXOs, or can SG extend
   an existing UTXO's `expiresAt` (and under whose attestation)?
4. **Expired-bridge gate placement:** symmetric "expired tokens cannot bridgeOut" check —
   EVM-side policy gate vs SG-side rejection only?

## Phase 14.1 — network-key mint validation (from /gsd-explore, 2026-08-25)

5. **Hybrid SKU surface:** for a split-mint SKU (private + public credit legs), is the
   public/private allocation fixed in the SKU by the operator, buyer-chosen at purchase
   time, or both (SKU defines allowed range, buyer picks within it)? Consider griefing,
   refund handling, and GNUS-burn accounting implications of buyer-chosen splits.
