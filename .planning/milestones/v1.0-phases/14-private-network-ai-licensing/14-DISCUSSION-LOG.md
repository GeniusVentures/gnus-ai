# Phase 14 Discussion Log — 2026-08-25

Human audit trail only. Decisions live in `14-CONTEXT.md`.

## Areas discussed (all 4 selected)

### 1. PD-7 private-spend settlement
- Options: bridged burn certificates / mirror+periodic / no-public-burn / per-token flag.
- User (freeform): spend probably does NOT burn on SG — credits go to the GeniusVentures wallet, which bridges in to EVM via existing bridgeIn, then burns manually.
- Follow-up confirmed: Phase 14 ships no new settlement mechanism. → D-07/D-08.

### 2. Payment rails & Banxa auth
- Initial USDC-custody / Banxa-auth questions confused the user — flagged that Banxa is already integrated in ../GeniusWallet (verified: `lib/banxa`, PROJECT.md on-ramp + Squid Router) and Uniswap/swap acquisition is wallet-side.
- Rails scope: RESEARCH-OPEN (D-09). User sketch: $20 fiat off-chain → GV buys $5 GNUS → mints private child token. Research to weigh operator-mediated vs permissionless + whether any direct USDC contract rail is needed.
- Payment sink: burn paid GNUS (chosen). → D-10.

### 3. License lifecycle & admin
- License expiry: PerTokenId validUntil chosen (doc's lean; license = account object). Credits stay PerHolder+BURN. → D-12.
- companyAdmin question confused the user; clarified: creation stays behind CREATOR_ROLE / GV multisig ADMIN (existing gates). companyAdmin = operator-set data field + event payload. → D-12/D-13.

### 4. Registry/router access control
- Purchase auth: user leans permissionless ("who cares if they buy more $5/month non-transferrable time-boxed tokens") but asked for pros/cons → RESEARCH-OPEN (D-11).
- SKU registry administration left to Claude's discretion (existing roles + LIC-03 active flag).

## Deferred
- LIC-04 three-rail wording pending D-09 research (possible amendment to GNUS-only + operator fiat).
- PD-BR-1..8 (Secure-BridgeIn) — separate Phase 10 amendment, not Phase 14.

## Checkpoint history
- Checkpoints not needed (single-session completion).
