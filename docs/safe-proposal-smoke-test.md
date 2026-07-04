# Safe Proposal Smoke Test — Sepolia

Manual smoke-test procedure for verifying the Safe wallet proposal retrofit
end-to-end on Sepolia. This document is a runbook, not an automated test.

---

## 1. Prerequisites

- **Safe wallet** deployed on Sepolia with at least 1 signer configured
- **Deployer EOA** added as a **Proposer** in the Safe UI (Settings -> Proposers)
- **Sepolia RPC URL** (e.g. Infura, Alchemy, or local node)
- **Funded deployer EOA** — enough ETH to deploy any new facets and cover gas
- **GeniusDiamond** already deployed on Sepolia (address in `diamonds/GeniusDiamond/deployments/`)
- The deployer EOA's private key set as `PRIVATE_KEY` in `.env` or passed via env

```bash
# Verify the diamond exists on Sepolia
cat diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155111.json | jq .DiamondAddress
```

---

## 2. Dry-Run Command

> **How these scripts run:** The `@diamondslab/diamonds` library loads Hardhat's plugin
> context at import time, so every `*-rpc.ts` entry script imports `hardhat` first (so it
> runs under plain `npx ts-node`, not only `npx hardhat run`). Pass `--transpile-only`
> because the library's Hardhat type-augmentations don't merge under ts-node's full
> type-check — Hardhat's own `run` uses the same transpile-only behavior. **Hardhat is not
> used to broadcast anything**: all transactions are signed and sent directly via ethers over
> the configured RPC URL; Safe proposals go through the Safe Transaction Service.

Verifies that the configuration loads correctly, the upgrade is analyzed,
but **no transaction is sent and no Safe proposal is created**.

```bash
SAFE_PROPOSE=true \
SAFE_ADDRESS=0xYourSafeAddressHere \
PRIVATE_KEY=0xYourDeployerPrivateKeyHere \
RPC_URL=https://sepolia.infura.io/v3/your-project-id \
NETWORK_NAME=sepolia \
CHAIN_ID=11155111 \
npx ts-node --transpile-only scripts/deploy/rpc/upgrade-rpc.ts upgrade GeniusDiamond sepolia --dry-run
```

**Expected output:**

- The upgrade analysis prints (current version, target version, facet changes)
- The script exits with "DRY RUN COMPLETE — no transactions were sent"
- No Safe proposal is visible in the Safe UI

---

## 3. Real Proposal Command

Same command but **without `--dry-run`**. This will:

1. Deploy any new/updated facets directly via RPC (normal flow — unchanged)
2. Encode the `diamondCut` calldata
3. Submit a Safe proposal to the Safe Transaction Service (instead of sending the tx directly)
4. Write a local artifact under `diamonds/GeniusDiamond/safe-proposals/`

```bash
SAFE_PROPOSE=true \
SAFE_ADDRESS=0xYourSafeAddressHere \
PRIVATE_KEY=0xYourDeployerPrivateKeyHere \
RPC_URL=https://sepolia.infura.io/v3/your-project-id \
NETWORK_NAME=sepolia \
CHAIN_ID=11155111 \
npx ts-node --transpile-only scripts/deploy/rpc/upgrade-rpc.ts upgrade GeniusDiamond sepolia
```

**Expected console output:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Safe Proposal Created Successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💎 Diamond:  GeniusDiamond
  🌐 Network:  sepolia (Chain ID: 11155111)
  🛡️  Safe:     0xYourSafeAddress...
  👤 Proposer: 0xYourDeployerAddress...
  🎯 Target:   0xDiamondAddress...
  💰 Value:    0
  ⚙️  Op:       CALL
  🔑 SafeTx:   0x...
  📄 Artifact: diamonds/GeniusDiamond/safe-proposals/sepolia-11155111-<timestamp>-<safeTxHash>.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  The diamondCut has been proposed but NOT yet executed.
   Safe signers must approve and execute it via the Safe UI.
```

---

## 4. CLI Flag Form (Alternative)

If you prefer CLI flags over env vars:

```bash
npx ts-node --transpile-only scripts/deploy/rpc/upgrade-rpc.ts upgrade GeniusDiamond sepolia \
  --safe-propose \
  --safe-address 0xYourSafeAddressHere \
  --private-key 0xYourDeployerPrivateKeyHere
```

Flags take precedence over env vars for `safePropose`, `safeAddress`, and `safeProposerPrivateKey`.

---

## 5. Acceptance Checklist

After running the real proposal command, verify each of the following:

- [ ] **New facets deployed directly** — transaction hashes visible in console output for any new/changed facet contracts
- [ ] **Diamond cut NOT executed directly by the EOA** — no `diamondCut` transaction from the deployer address appears on Sepolia block explorer
- [ ] **Safe proposal appears in the Safe UI** — visit `https://app.safe.global` and open the target Safe; the proposed transaction should appear in the Transactions queue
- [ ] **Proposal target equals the GeniusDiamond address** — the `to` field in the Safe UI matches the diamond address from `diamonds/GeniusDiamond/deployments/`
- [ ] **Proposal calldata starts with `0x1f931c1c`** — this is the `diamondCut((address,uint8,bytes4[])[],address,bytes)` selector; verify in the Safe UI's transaction details or by inspecting the local artifact
- [ ] **Local artifact file written** — verify the file exists:
  ```bash
  ls diamonds/GeniusDiamond/safe-proposals/sepolia-11155111-*.json
  cat diamonds/GeniusDiamond/safe-proposals/sepolia-11155111-*.json | jq .
  ```
  The `safeTxHash` in the artifact must match the Safe UI transaction hash.
- [ ] **Safe owners can review/sign/execute the proposal** — signers can approve and queue execution from the Safe UI

---

## 6. Rollback / Retry

If the proposal is rejected in the Safe UI, or the Safe transaction fails on-chain:

- The GeniusDiamond on Sepolia is **unchanged** (no direct `diamondCut` was performed)
- The local artifact under `diamonds/GeniusDiamond/safe-proposals/` is a historical record
- To re-propose, fix the underlying issue and re-run the real proposal command
- A new Safe proposal with a new `safeTxHash` will be created

---

## 7. Mainnet Note

Direct privileged diamondCut/admin upgrades on **mainnet** are **blocked** unless
`SAFE_PROPOSE=true` is set. Attempting a direct upgrade on mainnet without
`SAFE_PROPOSE=true` will produce:

```
Configuration validation failed:
  - Mainnet privileged Diamond cut/admin upgrades require SAFE_PROPOSE=true — refusing to deploy directly
```

Sepolia direct upgrades (without Safe) trigger a warning but are allowed:

```
⚠️  Direct privileged upgrade on sepolia without Safe proposal — this is allowed but not recommended. Set SAFE_PROPOSE=true for the safe path.
```

---

## 8. Verification Command (Quick Sanity)

Before running the full smoke test, verify the CLI loads correctly:

```bash
SAFE_PROPOSE=true \
SAFE_ADDRESS=0x0000000000000000000000000000000000000000 \
npx ts-node --transpile-only scripts/deploy/rpc/upgrade-rpc.ts upgrade GeniusDiamond sepolia --dry-run 2>&1 | head -5
```

Should print the upgrade analysis (with the diamond address) and exit without error.
The fake Safe address will pass `ethers.isAddress` — the dry-run stops before any Safe API call.
