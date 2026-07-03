# Safe Wallet Proposer Setup

**User:** Anonymous  
**Created:** 6/29/2026 14:05:18  
**Updated:** 6/29/2026 14:20:55  
**Exported:** 6/29/2026 14:22:14  
**Link:** [https://chatgpt.com/c/6a42de0d-2c88-83e8-9733-629788d2a11e](https://chatgpt.com/c/6a42de0d-2c88-83e8-9733-629788d2a11e)

## Response:

6/29/2026, 2:15:02 PM

You’re right — I overgeneralized instead of grounding this in the repo. I’ll inspect the actual deployment scripts and rewrite it as a smaller patch-oriented markdown focused on the minimal changes.

I found the main seam: `deploy-rpc.ts` and `upgrade-rpc.ts` both funnel into `RPCDiamondDeployer.deployDiamond()`, which creates DiamondSlab’s `RPCDeploymentStrategy`. The minimal ask is adding a proposal-capable strategy/mode at that boundary.

> **Verifying diamondcut ABI and Safe documentation**
>
> I think I should inspect the diamondcut ABI at line 111 to help build the calldata. It could be important to check the latest Safe API documentation to make sure it’s up to date. I’ll look for official sources on the web to verify everything.
>
> **Searching for latest Safe API and documentation**
>
> [SAFE: A Declarative Trust Management System with Linked Credentials](https://arxiv.org/abs/1510.04629)
>
> **Improving search for better results**
>
> I think the search might not be yielding good results because it's too generic. I'll refine it by using more specific domains to get better-targeted information. This should help narrow down the search and give more relevant results tailored to what I'm looking for.
>
> **Searching Safe API documentation for transaction proposals**
>
> **Making search more efficient**
>
> The search might be too broad right now, so I might need to refine it. By narrowing down the focus, I could improve the quality of the results and make sure I’m getting the most relevant information for the user’s needs. I'll adjust the search accordingly.
>
> **Searching for Safe API transaction and documentation**
>
> [A Typed Programmatic Interface to Contracts on the Blockchain](https://arxiv.org/abs/2108.11867)
>
> **Addressing web search limitations with Safe docs**
>
> The web search isn't yielding good results because of the "Safe" issue. Instead, I could try using direct URLs for the Safe documentation since I know which ones are reliable. I'll go ahead and access those directly and make sure to cite from the official sources.
>
> **Browsing for direct official documentation URLs**
>
> **Refining search strategy with URL**
>
> The web search seems to only show previous results or those shared by the user. I have the user’s URLs, like OZ, so I’m thinking a more direct search using those might help. Search by the domain seems tricky, but maybe I could try using direct URLs or Safe docs in this case.
>
> **Searching for user-specific URLs and documentation queries**
>
> [Safeguarded Progress in Reinforcement Learning: Safe Bayesian Exploration for Control Policy Synthesis](https://arxiv.org/abs/2312.11314)
>
> **Addressing search issue with user-provided URL**
>
> It looks like the search function isn’t working properly right now. Since the user provided an OZ relayer URL, I’ll open that link directly instead. That should allow me to access the relevant content without needing the search to work.
>
> **Troubleshooting search and using provided OZ relayer**
>
> [OpenZeppelin Relayer | OpenZeppelin Docs](https://docs.openzeppelin.com/relayer)
>
> **Considering Safe docs and citation approach**
>
> It seems like I won’t need to rely on a search for the Safe documents, especially since the user provided details directly. I can use those as my source, and I don’t think I need citations if we're using user-provided text. For final replies, I might skip exact citation, though they could be necessary for web-searched facts.
>
> **Providing concise answer with markdown**
>
> I need to revise my answer using markdown, focusing on delivering clear instructions. Since the user asked for instructions in markdown, I’ll avoid excess citations, but I could include comments like "Context observed in repo…" for clarity. The final answer should be clean markdown without external citation formatting, just streamlined instructions.
>
> **Considering changes for RPC deployment**
>
> I need to think through supporting a transaction interceptor within the DiamondDeployer process. The current setup deploys facets and does diamond cuts, but proposing just a diamond cut is tricky. It looks like a small change, possibly adding a new strategy extending RPCDeploymentStrategy, would let me handle this proposal safely. I'll need to verify the codebase and inspect @diamondslab/diamonds for transaction boundaries.
>
> **Designing Safe-Propose mode for diamondCut**
>
> I need to introduce a "safe-propose" mode in the upgrade process. This will still deploy facets through the existing RPC strategy but intercept and encode the final `diamondCut` transaction before sending it. To do this, I might subclass `RPCDeploymentStrategy` and create a `SafeProposerDeploymentStrategy`. I'll review module type definitions and avoid modifying `node_modules`, instead wrapping it in a subclass. If needed, I'll refer to the Safe API Kit documentation for a solution.
>
> **Configuring Safe Proposer Mode**
>
> I need to validate settings only when the "safePropose" mode is enabled. The `--private-key` should stay for deploying facets and paying gas, while the proposer key can default to the same EOA if explicit instructions aren't given. This design lets the current deployer EOA act as both proposer and deployer, with no extra private key needed. I'll add `SAFE_ADDRESS` and `SAFE_PROPOSE=true` instead, ensuring everything stays simple.
>
> **Finalizing Safe Proposal and Code Instructions**
>
> Since the proposer is the same as the signer using `PRIVATE_KEY`, the address should be added as a Proposer in Safe UI. Existing code already handles address construction. The security of intercepting the `diamondCut` method needs investigation, ideally by inspecting `@diamondslab/diamonds` methods. No
>
> **Citation Guidelines and Markdown Formatting**
>
> When using web sources, I need to cite factual statements outside code blocks but mention repo key points in a "What I tightened" paragraph with filecite. Code fences don't require citations directly, but I should include them before the code block. The user asked for markdown, so I'll ensure it's as concise as possible without over-explaining.
>
> **Clarifying citation rules for web-based content**
>
> **Searching for Safe Docs API transaction details**
>
> **Drafting Markdown for Safe Proposer Retrofit**
>
> I need to finalize a concise plan for adding the Safe-proposal mode to the existing RPC deployment without rewriting the entire pipeline. The goal is to preserve the current configuration and only introduce this change at the transaction strategy boundary. Additionally, I’ll be careful about excluding unnecessary details like UI changes for the owner.
>
> **Clarifying Safe Proposal Workflow**
>
> The `safe-propose` mode should only support upgrades to existing Safe-owned diamonds, not core contract deployments. For failed API submissions, a "manual calldata path" will output the target diamond address and calldata for easy error handling. To build calldata, the protocolKit will help create the necessary transactions and signatures.
>
> Thought for 5m 51s

Yep - fair call. The repo-specific version should be much smaller.

I checked the actual path: `deploy-rpc.ts` calls `RPCDiamondDeployer.getInstance(config)` and then `deployer.deployDiamond()`; `upgrade-rpc.ts` also analyzes, handles `--dry-run`, then calls `deployer.deployDiamond()` for the real upgrade. `RPCDiamondDeployer` creates the `RPCDeploymentStrategy` from `@diamondslab/diamonds`, then `deployDiamond()` delegates to `new DiamondDeployer(this.diamond!, this.strategy).deployDiamond()`. So the right target is **the strategy / transaction boundary**, not a whole new deploy pipeline.

````md
# GNUS.AI Minimal Safe Proposer Retrofit

## Objective

Retrofit the existing GNUS.AI RPC Diamond deployment flow so upgrades/admin Diamond cuts can be **proposed to a Safe wallet** instead of executed directly by the deployer EOA.

Do not rewrite deployment.

Do not add an executor proxy.

Do not replace the current RPC deployment system.

The smallest correct change is:

```text
current deploy / upgrade scripts
  -> RPCDiamondDeployer
    -> DiamondDeployer from @diamondslab/diamonds
      -> RPCDeploymentStrategy
        -> send tx directly today

new behavior:
current deploy / upgrade scripts
  -> RPCDiamondDeployer
    -> DiamondDeployer
      -> Safe-aware RPC strategy
        -> deploy normal contracts/facets directly as before
        -> when privileged Diamond cut/admin tx is about to be sent:
             propose tx to Safe Transaction Service instead of sending it
```
````

The Safe signers will review, sign, and execute in the Safe UI. No backend executor is needed for this first pass.

## Current Code Facts

The repo already has a direct RPC Diamond deployment path.

Important files:

```text
scripts/deploy/rpc/deploy-rpc.ts
scripts/deploy/rpc/upgrade-rpc.ts
scripts/deploy/rpc/common.ts
scripts/setup/RPCDiamondDeployer.ts
scripts/common.ts
package.json
.env.example
hardhat.config.ts
```

Current deployment flow:

```text
deploy-rpc.ts
  -> createRPCConfig(options)
  -> RPCDiamondDeployer.getInstance(config)
  -> deployer.deployDiamond()
```

Current upgrade flow:

```text
upgrade-rpc.ts
  -> createRPCConfig(options)
  -> RPCDiamondDeployer.getInstance(config)
  -> deployer.getDiamond()
  -> analyzeUpgrade(diamond)
  -> if dryRun, stop
  -> deployer.deployDiamond()
```

So upgrades are not a separate custom transaction path today. They reuse `RPCDiamondDeployer.deployDiamond()`.

`RPCDiamondDeployer` currently:

```text
- creates JsonRpcProvider(config.rpcUrl)
- creates ethers.Wallet(config.privateKey, provider)
- creates RPCDeploymentStrategy(config.rpcUrl, config.privateKey, ...)
- creates Diamond(this.config, repository)
- sets provider/signer on Diamond
- calls new DiamondDeployer(this.diamond!, this.strategy).deployDiamond()
```

Therefore, implement Safe proposal support at or just below `RPCDiamondDeployer`, preferably by adding a Safe-aware deployment strategy or transaction-sending wrapper.

## Important Constraint

Do not try to make the proposer the Safe owner.

The proposer is only the address allowed to submit a pending transaction to Safe Transaction Service.

The Safe owners/signers still approve and execute.

Use the current deployer/proposer EOA private key unless a separate proposer key is explicitly configured.

For the first version:

```text
PRIVATE_KEY = deployer EOA and Safe proposer signer
SAFE_ADDRESS = Safe that owns the Diamond
SAFE_PROPOSE = true enables proposal mode
```

A Safe owner must add the deployer/proposer address as a Safe Proposer in the Safe UI before this works.

## Desired User Command

Support this:

```bash
SAFE_PROPOSE=true \
SAFE_ADDRESS=0xSafe... \
PRIVATE_KEY=0xProposerOrDeployerKey... \
npx ts-node scripts/deploy/rpc/upgrade-rpc.ts upgrade GeniusDiamond sepolia
```

Also support quick mode via env:

```bash
SAFE_PROPOSE=true \
SAFE_ADDRESS=0xSafe... \
DIAMOND_NAME=GeniusDiamond \
NETWORK_NAME=sepolia \
PRIVATE_KEY=0xProposerOrDeployerKey... \
npx ts-node scripts/deploy/rpc/upgrade-rpc.ts quick
```

Optional CLI flags:

```bash
--safe-propose
--safe-address 0xSafe...
--safe-tx-service-url https://...
--safe-api-key ...
--safe-origin gnus-ai-upgrade
```

Do not require Safe owner private keys.

## Scope

### In scope

Implement Safe proposal mode for existing Diamond upgrades where the Diamond is already deployed and owned/administered by the Safe.

The proposal transaction should be:

```text
to: DiamondAddress
value: "0"
data: encoded Diamond cut/admin calldata
operation: CALL / 0
```

The proposal should appear in the Safe UI for Safe signers.

### Out of scope for this first pass

```text
- executor proxy
- automatic execution after threshold
- collecting owner signatures in code
- storing Safe owner keys
- replacing deployment with OpenZeppelin Relayer
- rewriting the Diamond deployment system
- copying/pasting calldata as the primary happy path
```

Manual calldata output is useful as a fallback artifact, but the primary flow should programmatically create the Safe proposal.

## Minimal Package Changes

Use the repo’s existing TypeScript/ethers stack.

The repo already uses:

```text
ethers 6.x
hardhat
ts-node
@diamondslab/diamonds
@diamondslab/hardhat-diamonds
```

Add Safe SDK dependencies:

```bash
yarn add -D @safe-global/api-kit @safe-global/protocol-kit @safe-global/types-kit
```

If the deployment runtime installs production dependencies only, use normal dependencies instead of devDependencies.

## Config Changes

Update `scripts/setup/RPCDiamondDeployer.ts`.

Extend `RPCDiamondDeployerConfig` with Safe proposal options:

```ts
export interface RPCDiamondDeployerConfig extends DiamondConfig {
  rpcUrl: string;
  privateKey: string;
  networkName: string;
  chainId: number;
  provider?: SupportedProvider;
  signer?: SignerWithAddress;
  gasLimitMultiplier?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  verbose?: boolean;
  rpcDiamondDeployerKey?: string;

  // New Safe proposal options
  safePropose?: boolean;
  safeAddress?: string;
  safeProposerPrivateKey?: string;
  safeTxServiceUrl?: string;
  safeApiKey?: string;
  safeOrigin?: string;
}
```

Default behavior must remain unchanged:

```text
safePropose unset/false -> existing direct RPC deployment behavior
safePropose true        -> Safe proposal behavior for privileged Diamond cut/admin tx
```

Use `config.safeProposerPrivateKey ?? config.privateKey` as the proposer key.

## Environment Variable Changes

Update `.env.example` with a small Safe section:

```dotenv
# Safe proposal mode for Diamond upgrades
SAFE_PROPOSE=false
SAFE_ADDRESS=
SAFE_PROPOSER_PRIVATE_KEY=
SAFE_TX_SERVICE_URL=
SAFE_API_KEY=
SAFE_ORIGIN=gnus-ai-rpc-upgrade
```

Notes:

```text
SAFE_PROPOSER_PRIVATE_KEY is optional.
If omitted, use PRIVATE_KEY as the proposer signer.

SAFE_TX_SERVICE_URL is optional.
Only use it if this repo needs a custom/self-hosted Transaction Service URL.

SAFE_API_KEY is optional.
Only use it if the currently installed Safe API Kit requires it for the selected service.
```

Do not remove existing RPC variables:

```dotenv
DIAMOND_NAME=GeniusDiamond
RPC_URL=https://...
NETWORK_NAME=sepolia
CHAIN_ID=11155111
PRIVATE_KEY=...
```

## CLI Changes

Update `scripts/deploy/rpc/common.ts`.

Extend `BaseRPCOptions`:

```ts
export interface BaseRPCOptions {
  diamondName: string;
  networkName?: string;
  rpcUrl?: string;
  privateKey?: string;
  verbose?: boolean;
  configPath?: string;
  deploymentsPath?: string;
  gasLimitMultiplier?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  useHardhatConfig?: boolean;

  // New
  safePropose?: boolean;
  safeAddress?: string;
  safeProposerPrivateKey?: string;
  safeTxServiceUrl?: string;
  safeApiKey?: string;
  safeOrigin?: string;
}
```

Add common CLI options:

```ts
.option(
  '--safe-propose',
  'Create a Safe proposal instead of directly executing privileged Diamond cut/admin tx',
  process.env.SAFE_PROPOSE === 'true'
)
.option(
  '--safe-address <address>',
  'Safe wallet address that owns/administers the Diamond',
  process.env.SAFE_ADDRESS
)
.option(
  '--safe-proposer-private-key <key>',
  'Optional proposer key. Defaults to PRIVATE_KEY.',
  process.env.SAFE_PROPOSER_PRIVATE_KEY
)
.option(
  '--safe-tx-service-url <url>',
  'Optional custom Safe Transaction Service URL',
  process.env.SAFE_TX_SERVICE_URL
)
.option(
  '--safe-api-key <key>',
  'Optional Safe API key if required by the configured Safe service',
  process.env.SAFE_API_KEY
)
.option(
  '--safe-origin <origin>',
  'Origin string shown/stored with the Safe proposal',
  process.env.SAFE_ORIGIN || 'gnus-ai-rpc-upgrade'
)
```

Update `createRPCConfig(options)` to pass these into `RPCDiamondDeployer.createConfigFromHardhat(...)` and the legacy config object:

```ts
{
  verbose: options.verbose,
  gasLimitMultiplier: options.gasLimitMultiplier,
  maxRetries: options.maxRetries,
  retryDelayMs: options.retryDelayMs,
  configFilePath: options.configPath,
  deploymentsPath: options.deploymentsPath,

  safePropose: options.safePropose,
  safeAddress: options.safeAddress,
  safeProposerPrivateKey: options.safeProposerPrivateKey,
  safeTxServiceUrl: options.safeTxServiceUrl,
  safeApiKey: options.safeApiKey,
  safeOrigin: options.safeOrigin,
}
```

Update `RPCDiamondDeployer.createConfigFromEnv()` similarly:

```ts
safePropose: process.env.SAFE_PROPOSE === 'true',
safeAddress: process.env.SAFE_ADDRESS,
safeProposerPrivateKey: process.env.SAFE_PROPOSER_PRIVATE_KEY,
safeTxServiceUrl: process.env.SAFE_TX_SERVICE_URL,
safeApiKey: process.env.SAFE_API_KEY,
safeOrigin: process.env.SAFE_ORIGIN || 'gnus-ai-rpc-upgrade',
```

## Validation Changes

Keep existing validation.

Add only these Safe-specific validations:

```ts
if (config.safePropose) {
  if (!config.safeAddress) {
    errors.push("SAFE_ADDRESS is required when SAFE_PROPOSE=true");
  }

  if (!ethers.isAddress(config.safeAddress)) {
    errors.push("SAFE_ADDRESS must be a valid address");
  }

  const proposerKey = config.safeProposerPrivateKey || config.privateKey;
  if (!proposerKey) {
    errors.push("A proposer private key is required when SAFE_PROPOSE=true");
  }

  if (!proposerKey.match(/^0x[a-fA-F0-9]{64}$/)) {
    errors.push(
      "Safe proposer private key must be 64 hex characters with 0x prefix",
    );
  }
}
```

Do not validate that the proposer is a Safe owner. It should not be.

Optionally warn if proposer equals Safe address, since that is impossible/wrong for an EOA proposer.

## Add Safe Proposal Helper

Create:

```text
scripts/safe/proposeSafeTransaction.ts
```

Purpose:

```text
Given target, value, calldata, chainId, Safe address, and proposer key:
- create Safe transaction
- compute Safe tx hash
- sign hash with proposer key
- submit proposal to Safe Transaction Service
- return safeTxHash and metadata
```

Skeleton:

```ts
import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import { OperationType } from "@safe-global/types-kit";
import type { MetaTransactionData } from "@safe-global/types-kit";
import { ethers } from "ethers";

export interface ProposeSafeTransactionInput {
  chainId: bigint;
  rpcUrl: string;
  safeAddress: string;
  proposerPrivateKey: string;
  safeTxServiceUrl?: string;
  safeApiKey?: string;
  to: string;
  value?: string;
  data: string;
  operation?: OperationType;
  origin?: string;
}

export interface ProposeSafeTransactionResult {
  safeAddress: string;
  safeTxHash: string;
  proposerAddress: string;
  to: string;
  value: string;
  data: string;
  operation: OperationType;
}

export async function proposeSafeTransaction(
  input: ProposeSafeTransactionInput,
): Promise<ProposeSafeTransactionResult> {
  const provider = new ethers.JsonRpcProvider(input.rpcUrl);
  const proposer = new ethers.Wallet(input.proposerPrivateKey, provider);
  const proposerAddress = await proposer.getAddress();

  const apiKit = new SafeApiKit({
    chainId: input.chainId,
    ...(input.safeTxServiceUrl ? { txServiceUrl: input.safeTxServiceUrl } : {}),
    ...(input.safeApiKey ? { apiKey: input.safeApiKey } : {}),
  } as any);

  const protocolKit = await Safe.init({
    provider: input.rpcUrl,
    signer: input.proposerPrivateKey,
    safeAddress: input.safeAddress,
  });

  const safeTransactionData: MetaTransactionData = {
    to: input.to,
    value: input.value || "0",
    data: input.data,
    operation: input.operation ?? OperationType.Call,
  };

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [safeTransactionData],
  });

  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
  const senderSignature = await protocolKit.signHash(safeTxHash);

  await apiKit.proposeTransaction({
    safeAddress: input.safeAddress,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: proposerAddress,
    senderSignature: senderSignature.data,
    origin: input.origin || "gnus-ai-rpc-upgrade",
  });

  return {
    safeAddress: input.safeAddress,
    safeTxHash,
    proposerAddress,
    to: input.to,
    value: input.value || "0",
    data: input.data,
    operation: input.operation ?? OperationType.Call,
  };
}
```

Adjust imports/types to match the installed Safe SDK version. Do not fight the type system with a broad rewrite; keep this helper isolated.

## Add Safe Proposal Artifact Helper

Create:

```text
scripts/safe/writeSafeProposalArtifact.ts
```

Write artifacts here:

```text
diamonds/<diamondName>/safe-proposals/<networkName>-<chainId>-<timestamp>-<safeTxHash>.json
```

Artifact shape:

```json
{
  "diamondName": "GeniusDiamond",
  "networkName": "sepolia",
  "chainId": 11155111,
  "safeAddress": "0x...",
  "proposerAddress": "0x...",
  "target": "0xDiamond...",
  "value": "0",
  "operation": "CALL",
  "safeTxHash": "0x...",
  "calldata": "0x...",
  "calldataSelector": "0x1f931c1c",
  "origin": "gnus-ai-rpc-upgrade",
  "createdAt": "2026-..."
}
```

This gives the team a manual fallback:

```text
target = Diamond address
calldata = encoded Diamond cut/admin tx
value = 0
operation = CALL
```

## Strategy-Level Change

In `scripts/setup/RPCDiamondDeployer.ts`, change only strategy creation.

Current behavior is roughly:

```ts
this.strategy = new RPCDeploymentStrategy(
  config.rpcUrl,
  config.privateKey,
  config.gasLimitMultiplier || 1.2,
  config.maxRetries || 3,
  config.retryDelayMs || 2000,
  this.verbose,
);
```

New behavior:

```ts
if (config.safePropose) {
  this.strategy = new SafeProposerRPCDeploymentStrategy({
    rpcUrl: config.rpcUrl,
    privateKey: config.privateKey,
    proposerPrivateKey: config.safeProposerPrivateKey || config.privateKey,
    safeAddress: config.safeAddress!,
    chainId: config.chainId,
    gasLimitMultiplier: config.gasLimitMultiplier || 1.2,
    maxRetries: config.maxRetries || 3,
    retryDelayMs: config.retryDelayMs || 2000,
    verbose: this.verbose,
    safeTxServiceUrl: config.safeTxServiceUrl,
    safeApiKey: config.safeApiKey,
    safeOrigin: config.safeOrigin || "gnus-ai-rpc-upgrade",
    diamondName: config.diamondName,
    networkName: config.networkName,
  });
} else {
  this.strategy = new RPCDeploymentStrategy(
    config.rpcUrl,
    config.privateKey,
    config.gasLimitMultiplier || 1.2,
    config.maxRetries || 3,
    config.retryDelayMs || 2000,
    this.verbose,
  );
}
```

Create the new strategy under:

```text
scripts/setup/strategies/SafeProposerRPCDeploymentStrategy.ts
```

## How the Safe Strategy Should Work

Inspect `node_modules/@diamondslab/diamonds` and find the method on `RPCDeploymentStrategy` that actually sends a transaction.

Look for methods like:

```text
executeTransaction
sendTransaction
executeContractCall
deployContract
diamondCut
upgradeDiamond
```

Do not patch `node_modules`.

Preferred approach:

```text
class SafeProposerRPCDeploymentStrategy extends RPCDeploymentStrategy
```

Then override only the narrow method that sends contract calls.

Behavior:

```text
- For normal contract deployments:
    call super and send directly.
    This keeps facet deployment exactly as it works now.

- For Diamond cut/admin calls to the deployed Diamond:
    do not send.
    submit Safe proposal instead.
    write proposal artifact.
    return a synthetic/minimal result if the DiamondDeployer expects a tx-like object.
```

The important identification is:

```text
target == deployed Diamond address
calldata selector == diamondCut selector
```

The repo already has `diamondCutFuncAbi` in `scripts/common.ts`. Use it if helpful for decoding/identification.

Expected selector:

```text
diamondCut((address,uint8,bytes4[])[],address,bytes)
```

Implementation note:

```ts
const selector = data.slice(0, 10);
```

If the strategy receives a populated tx object, use:

```ts
const to = tx.to;
const data = tx.data;
const value = tx.value || "0";
```

Then:

```ts
if (this.safePropose && this.isDiamondCutToDiamond(to, data)) {
  return await this.proposeInsteadOfSend({ to, data, value });
}

return await super.<same method>(...args);
```

If the existing strategy does not expose a clean override point, create a small wrapper around the provider/signer send method used by `RPCDeploymentStrategy`, but keep it localized to the new strategy file.

## Do Not Reimplement Diamond Diffing

The Diamond library already determines:

```text
- which facets are new
- which facets changed
- selector add/replace/remove actions
- init facet
- init calldata
- protocol version changes
```

Do not duplicate that logic.

The Safe retrofit should intercept the already-built transaction/calldata.

The only valid reason to build calldata manually is if the Diamond library exposes the cut data before sending but not the transaction object.

## Safe Proposal Behavior

When a Diamond cut/admin transaction is intercepted:

```ts
const result = await proposeSafeTransaction({
  chainId: BigInt(this.chainId),
  rpcUrl: this.rpcUrl,
  safeAddress: this.safeAddress,
  proposerPrivateKey: this.proposerPrivateKey,
  safeTxServiceUrl: this.safeTxServiceUrl,
  safeApiKey: this.safeApiKey,
  to,
  value: value?.toString() || "0",
  data,
  operation: OperationType.Call,
  origin: this.safeOrigin,
});
```

Then log:

```text
✅ Safe proposal created
Diamond: GeniusDiamond
Network: sepolia
Chain ID: 11155111
Safe: 0x...
Proposer: 0x...
Target: 0xDiamond...
Value: 0
Operation: CALL
SafeTxHash: 0x...
```

Then write the artifact.

Then stop before pretending the upgrade executed.

Important: proposing is not the same as execution. The local deployment data should not be marked as fully upgraded unless the Safe transaction has actually executed on-chain.

## Deployment Data Handling

Be careful with `writeDeployedDiamondData`.

In direct mode, existing behavior can remain.

In Safe proposal mode:

```text
- newly deployed facet addresses may be real and can be recorded
- Diamond protocol version / selector state should not be finalized as upgraded until the Safe tx executes
- if the library tries to write upgraded Diamond data immediately after proposing, prevent or defer that write
```

Preferred behavior:

```text
- write a Safe proposal artifact
- do not overwrite the canonical deployed Diamond state as if the cut executed
```

If the library makes this hard, add a warning and create a separate pending file:

```text
diamonds/GeniusDiamond/pending-safe-upgrades/...
```

Do not corrupt existing deployment records.

## First-Pass Mainnet Safety

Add this policy:

```text
if networkName === 'mainnet' && safePropose !== true:
  fail before executing privileged Diamond cut/admin tx
```

Do not block local/hardhat/direct Sepolia by default unless the team wants that.

Minimum safe policy:

```text
- hardhat/local: direct allowed
- sepolia: direct allowed only if SAFE_PROPOSE is false, but warn loudly
- mainnet: direct privileged upgrade blocked unless SAFE_PROPOSE=true
```

## Gas Handling

Do not implement manual executor gas logic in this pass.

Use Safe SDK defaults where possible.

If the SDK requires Safe transaction gas fields, set them before computing/signing the Safe transaction hash. Do not mutate gas fields after `safeTxHash` is computed.

Execution gas can be handled by the Safe UI when the final signer executes.

## OpenZeppelin Relayer

Do not make OpenZeppelin Relayer part of the required flow.

It can remain a future optional backend broadcaster/monitor. It is useful for relaying, signing, fee estimation, nonce management, and transaction status monitoring, but it is not the Safe multisig approval workflow.

For this task, Safe proposal creation belongs in the Safe API Kit / Transaction Service flow.

## Tests

Add unit tests near:

```text
test/unit/rpc/RPCDiamondDeployer.test.ts
```

Minimum tests:

```text
1. createConfigFromEnv reads SAFE_PROPOSE and SAFE_ADDRESS.
2. validateConfig fails when SAFE_PROPOSE=true and SAFE_ADDRESS is missing.
3. validateConfig accepts SAFE_PROPOSE=true with a valid Safe address.
4. RPCDiamondDeployer uses normal RPCDeploymentStrategy when SAFE_PROPOSE=false.
5. RPCDiamondDeployer uses SafeProposerRPCDeploymentStrategy when SAFE_PROPOSE=true.
6. SafeProposerRPCDeploymentStrategy passes normal contract deployments through to super.
7. SafeProposerRPCDeploymentStrategy proposes, rather than sends, Diamond cut txs.
8. Safe proposal artifact contains target, calldata, value, operation, safeTxHash, proposer, chainId.
```

Mock the Safe API helper in unit tests. Do not hit Safe Transaction Service from unit tests.

Add one manual Sepolia smoke test script or documented command:

```bash
SAFE_PROPOSE=true \
SAFE_ADDRESS=0xSafe... \
PRIVATE_KEY=0xProposer... \
npx ts-node scripts/deploy/rpc/upgrade-rpc.ts upgrade GeniusDiamond sepolia --dry-run
```

Then real proposal:

```bash
SAFE_PROPOSE=true \
SAFE_ADDRESS=0xSafe... \
PRIVATE_KEY=0xProposer... \
npx ts-node scripts/deploy/rpc/upgrade-rpc.ts upgrade GeniusDiamond sepolia
```

Acceptance for Sepolia smoke test:

```text
- new facets may deploy directly if needed
- Diamond cut is not executed directly by EOA
- Safe proposal appears in Safe UI
- proposal target is the Diamond address
- proposal calldata is the Diamond cut/admin calldata
- Safe owners can review/sign/execute manually
```

## Files to Touch

Likely files:

```text
package.json
.env.example
scripts/deploy/rpc/common.ts
scripts/setup/RPCDiamondDeployer.ts
scripts/setup/strategies/SafeProposerRPCDeploymentStrategy.ts
scripts/safe/proposeSafeTransaction.ts
scripts/safe/writeSafeProposalArtifact.ts
test/unit/rpc/RPCDiamondDeployer.test.ts
```

Avoid touching:

```text
scripts/deploy/rpc/deploy-rpc.ts
scripts/deploy/rpc/upgrade-rpc.ts
```

Only touch those if needed for a small log message showing Safe proposal mode.

## Acceptance Criteria

This retrofit is complete when:

```text
- Existing direct deploy/upgrade behavior remains unchanged when SAFE_PROPOSE=false.
- `upgrade-rpc.ts` can run with SAFE_PROPOSE=true.
- The existing deployment path is reused.
- Normal facet/contract deployments still use the existing RPC flow.
- The privileged Diamond cut/admin tx is proposed to Safe instead of sent directly.
- No Safe owner private key is required.
- No executor proxy is added.
- A proposal artifact is written locally.
- The proposal is visible in the Safe UI.
- The Safe proposal target is the deployed Diamond address.
- The Safe proposal calldata matches the pending Diamond cut/admin call.
- Mainnet direct privileged upgrades are blocked unless SAFE_PROPOSE=true.
```

```



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)
```
