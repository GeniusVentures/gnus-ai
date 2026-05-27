<!-- refreshed: 2026-05-26 -->
# Architecture

**Analysis Date:** 2026-05-26

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     GeniusDiamond (EIP-2535 Proxy)                        │
│                       `contracts/gnus-ai/GeniusDiamond.sol`               │
├──────────────────────────┬──────────────────────┬────────────────────────┤
│     DiamondCutFacet      │   DiamondLoupeFacet   │  GeniusOwnershipFacet  │
│   (Upgrade Management)   │    (Introspection)    │     (Ownership)        │
│  `DiamondCutFacet.sol`   │  `DiamondLoupeFacet*` │ `GeniusOwnershipFacet*`│
├──────────────────────────┼──────────────────────┼────────────────────────┤
│   GNUSNFTFactory          │    GNUSBridge         │   ERC20TransferBatch   │
│   (NFT Crud/Mint)        │  (Cross-chain Bridge)  │   (Batch Transfers)    │
│  `GNUSNFTFactory.sol`     │  `GNUSBridge.sol`      │ `ERC20TransferBatch*`  │
├──────────────────────────┼──────────────────────┼────────────────────────┤
│   GNUSControl             │ ERC1155ProxyOperator  │   GeniusAI             │
│  (Protocol Controls)      │ (Marketplace Proxy)   │   (AI Escrow)          │
│  `GNUSControl.sol`        │ `ERC1155ProxyOp*`     │  `GeniusAI.sol`        │
├──────────────────────────┼──────────────────────┼────────────────────────┤
│  GNUSContractAssets       │  DiamondInitFacet     │ GNUSWithdrawLimiter    │
│   (Asset Recovery)        │  (Initialization)     │  (Rate Limiting)       │
│ `GNUSContractAssets.sol`  │ `DiamondInitFacet*`   │ `GNUSWithdrawLimiter*` │
├──────────────────────────┼──────────────────────┼────────────────────────┤
│  GNUSNFTCollectionName    │                                               │
│  (Collection Metadata)    │                                               │
│ `GNUSNFTCollectionName*`  │                                               │
└──────────────────────────┴──────────────────────┴────────────────────────┘
                                    │
                    delegatecall ────▼──── delegatecall ────►
                                    │
┌───────────────────────────────────┴──────────────────────────────────────┐
│                      Storage Libraries (Diamond Slots)                     │
│  `GNUSNFTFactoryStorage.sol` `GNUSControlStorage.sol`                     │
│  `GeniusAIStorage.sol` `GNUSWithdrawLimiterStorage.sol`                   │
│  `ERC20Storage` `ERC1155Storage` `ERC1155SupplyStorage` (external pkgs)   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Pattern Overview

**Overall:** EIP-2535 Diamond Standard — modular, upgradeable proxy with facet-based logic separation

**Key Characteristics:**
- Single proxy contract (`GeniusDiamond`) delegates all calls to facet contracts
- Facets are independent Solidity contracts sharing a single storage context
- Storage is managed via Diamond Storage Pattern (keccak256-based slot addressing) to avoid collisions
- Facets can be added, replaced, or removed via `DiamondCutFacet`
- ERC-165 interface introspection registers supported interfaces at construction time
- Dual ERC-20/ERC-1155 token standard: GNUS token (ID: 0) implements both interfaces
- Hierarchical token ID system: upper 128 bits = parent, lower 128 bits = child index
- Multi-network support: Ethereum Mainnet, Polygon, Sepolia, Base, BSC, Amoy

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| GeniusDiamond | EIP-2535 proxy; delegates to facets; registers ERC-165 interfaces | `contracts/gnus-ai/GeniusDiamond.sol` |
| DiamondCutFacet | Add/replace/remove facets (EIP-2535 diamondCut) | External: `contracts-starter/contracts/facets/DiamondCutFacet.sol` |
| DiamondLoupeFacet | Query facets, function selectors, and facet addresses | External: `contracts-starter/contracts/facets/DiamondLoupeFacet.sol` |
| GeniusOwnershipFacet | Contract ownership transfer per EIP-173 | `contracts/gnus-ai/GeniusOwnershipFacet.sol` |
| DiamondInitFacet | Diamond initialization; role setup; withdraw limiter defaults | `contracts/gnus-ai/DiamondInitFacet.sol` |
| GNUSNFTFactory | NFT creation (hierarchical), minting, URI management, exchange rates | `contracts/gnus-ai/GNUSNFTFactory.sol` |
| GNUSBridge | Cross-chain bridging (burn/mint), ERC-20 interface for GNUS, withdraw child→GNUS | `contracts/gnus-ai/GNUSBridge.sol` |
| ERC20TransferBatch | Batch mint/transfer/burn of GNUS tokens for gas efficiency | `contracts/gnus-ai/ERC20TransferBatch.sol` |
| GNUSControl | Global/per-token blacklists, bridge fee config, protocol version, chain ID | `contracts/gnus-ai/GNUSControl.sol` |
| ERC1155ProxyOperator | Marketplace proxy operator approvals; totalSupply/creators queries | `contracts/gnus-ai/ERC1155ProxyOperator.sol` |
| GeniusAI | AI processing job escrow system | `contracts/gnus-ai/GeniusAI.sol` |
| GNUSContractAssets | Recovery of non-GNUS tokens/ETH accidentally sent to contract | `contracts/gnus-ai/GNUSContractAssets.sol` |
| GNUSNFTCollectionName | Static collection name constant | `contracts/gnus-ai/GNUSNFTCollectionName.sol` |
| GNUSWithdrawLimiter | Per-account configurable withdrawal rate limiting | `contracts/gnus-ai/GNUSWithdrawLimiter.sol` |
| GeniusAccessControl | Role-based access control with super admin guard; abstract base for all facets | `contracts/gnus-ai/GeniusAccessControl.sol` |
| GNUSConstants | Shared constants (token names, supply, IDs, masks, ETHER address) | `contracts/gnus-ai/GNUSConstants.sol` |

## Layers

**Proxy Layer:**
- Purpose: Single entry point for all external calls; delegates to facets via `delegatecall`
- Location: `contracts/gnus-ai/GeniusDiamond.sol`
- Contains: EIP-2535 `fallback()`, `supportsInterface()`, ERC-165 registration, `Initializable` setup
- Depends on: `LibDiamond`, `ERC165StorageUpgradeable`, `Diamond` base
- Used by: All external callers (users, wallets, marketplaces, relayers)

**Facet Layer:**
- Purpose: Business logic for all token operations — mint, burn, transfer, bridge, control, escrow, limiting
- Location: `contracts/gnus-ai/*.sol` (all contracts except `GeniusDiamond.sol`, `libraries/`, and `mocks/`)
- Contains: 14 Solidity contracts implementing EIP-2535 facets
- Depends on: Storage libraries (`GNUSNFTFactoryStorage`, `GNUSControlStorage`, `GeniusAIStorage`, `GNUSWithdrawLimiterStorage`, external `ERC20Storage`/`ERC1155Storage`), `GeniusAccessControl`, `LibDiamond`
- Used by: Proxy layer (via `delegatecall`)

**Storage Layer:**
- Purpose: Diamond storage slot definitions — data structures and typed accessors using assembly slot pointers
- Location: `contracts/gnus-ai/GNUSNFTFactoryStorage.sol`, `contracts/gnus-ai/GNUSControlStorage.sol`, `contracts/gnus-ai/GeniusAIStorage.sol`, `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol`
- Contains: `Layout` structs, `layout()` pure functions with assembly slot pointers, helper functions
- Depends on: Nothing (pure storage definitions)
- Used by: Facet layer

**Library Layer:**
- Purpose: Shared utilities — safe token transfers, diamond standard library
- Location: `contracts/gnus-ai/libraries/TransferHelper.sol`, External: `contracts-starter/contracts/libraries/LibDiamond.sol`
- Contains: `TransferHelper` (safeApprove/safeTransfer/safeTransferFrom/safeTransferETH), `LibDiamond` (diamond storage pointer, ownership enforcement, facet management)
- Depends on: Low-level `call`/`delegatecall`
- Used by: Facet layer, Proxy layer

**Access Control Layer:**
- Purpose: Role-based authorization shared across all facets
- Location: `contracts/gnus-ai/GeniusAccessControl.sol`
- Contains: Abstract contract with `onlySuperAdminRole` modifier, role management guards
- Depends on: `AccessControlEnumerableUpgradeable`, `Initializable`, `LibDiamond`
- Used by: Every facet (inherited as base)

**Scripting / Deployment Layer:**
- Purpose: TypeScript deployment, upgrade, verification, and DevOps automation
- Location: `scripts/deploy/`, `scripts/setup/`, `scripts/devops/`, `scripts/utils/`
- Contains: RPC Diamond Deployer (`scripts/setup/RPCDiamondDeployer.ts`), deploy/upgrade/verify/status scripts, security tooling, performance monitoring
- Depends on: `hardhat`, `ethers`, `@diamondslab/diamonds-hardhat-foundry`
- Used by: DevOps, CI/CD pipelines

**Testing Layer:**
- Purpose: Comprehensive test coverage across unit, integration, fuzz, invariant, security, and deployment tests
- Location: `test/unit/`, `test/integration/`, `test/foundry/`, `test/gas/`, `test/deployment/`
- Contains: Hardhat TypeScript tests (ethers v6) and Foundry Solidity tests (forge)
- Depends on: `@nomicfoundation/hardhat-toolbox`, `forge-std`
- Used by: CI/CD, pre-commit hooks, local development

## Data Flow

### Primary Request Path (External Call → Diamond Proxy → Facet)

1. External caller sends transaction to `GeniusDiamond` address with calldata containing function selector (`contracts/gnus-ai/GeniusDiamond.sol` — `fallback()` via inherited Diamond)
2. `LibDiamond` resolves the selector to a facet address from `diamondStorage().facets` (`contracts-starter/contracts/libraries/LibDiamond.sol`)
3. Proxy `delegatecall`s to the resolved facet address with the original calldata
4. Facet executes logic in the diamond's storage context, reading/writing via storage libraries
5. Result returned to caller

### NFT Minting Flow

1. User holds GNUS tokens, calls `mint(address to, uint256 id, uint256 amount, bytes data)` on `GNUSNFTFactory` (`contracts/gnus-ai/GNUSNFTFactory.sol:115`)
2. `beforeMint()` checks: id ≠ GNUS_TOKEN_ID, `to` ≠ zero address, NFT exists, caller is creator or admin, burns GNUS if child of GNUS (`contracts/gnus-ai/GNUSNFTFactory.sol:96–107`)
3. `_mint()` (inherited from ERC1155Upgradeable) increments balances, emits `TransferSingle`
4. `_beforeTokenTransfer` hook runs supply cap and banned-transferor checks (`contracts/gnus-ai/GNUSERC1155MaxSupply.sol:33–73`)

### Cross-Chain Bridge Flow (Outbound)

1. User calls `bridgeOut(amount, id, destChainID)` on `GNUSBridge` (`contracts/gnus-ai/GNUSBridge.sol:173`)
2. Validates NFT exists, user has sufficient balance
3. `_burn()` removes tokens from sender
4. Emits `BridgeSourceBurned` event with source chain ID and destination chain ID
5. Off-chain relayer detects event, calls `mint()` with `MINTER_ROLE` on destination chain

### Withdraw Child NFT → GNUS Flow

1. User calls `withdraw(amount, id)` on `GNUSBridge` (`contracts/gnus-ai/GNUSBridge.sol:149`)
2. Validates NFT created, `id ≠ GNUS_TOKEN_ID`, sufficient balance
3. Calculates `convAmount = amount / exchangeRate`
4. Applies withdrawal limiter check (unless super admin) via `GNUSWithdrawLimiterStorage.checkAndRecordWithdraw()` (`contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol:183`)
5. Burns child NFT from sender
6. Mints equivalent GNUS to sender (with optional bridge fee applied)

### Diamond Initialization Flow

1. During deployment, `GeniusDiamond` constructor sets owner and DiamondCutFacet, registers ERC-165 interfaces, marks uninitialized (`contracts/gnus-ai/GeniusDiamond.sol:26–41`)
2. `DiamondInitFacet.diamondInitialize250()` called via diamondCut to set up roles (DEFAULT_ADMIN_ROLE, MINTER_ROLE, UPGRADER_ROLE), enable ERC-20 interface support, initialize withdraw limiter defaults (`contracts/gnus-ai/DiamondInitFacet.sol:45–64`)
3. Version-specific init calls (`GNUSNFTFactory_Initialize()`, `GNUSNFTFactory_Initialize230()`, `GNUSControl_Initialize230()`, `GeniusAI_Initialize()`) configure each facet's state

### GNUS ERC20 Transfer with Limiter Check Flow

1. User calls `transfer(to, amount)` on `GNUSBridge` (`contracts/gnus-ai/GNUSBridge.sol:214`)
2. Internally calls `_safeTransferFrom()` → `_beforeTokenTransfer()` hook (`contracts/gnus-ai/GNUSERC1155MaxSupply.sol:33–73`)
3. For non-minting transfers with GNUS amounts > 0, `checkAndRecordWithdraw()` verifies limiter enabled, zeros expired bins, sums active withdrawals, checks against limit, records to current bin
4. If limit exceeded: emits `WithdrawLimiterTriggered`, reverts with "Withdrawal limit exceeded for time window"
5. Super admin (contract owner) bypasses all limiter checks

**State Management:**
- All persistent state is stored in the diamond proxy's storage context, never in facet contracts
- Each storage concern uses a unique `keccak256` slot to prevent collisions: `keccak256("gnus.ai.nft.factory.storage")`, `keccak256("gnus.ai.control.storage")`, `keccak256("gnus.ai.storage")`, `keccak256("gnus.ai.withdraw.limiter.storage")`
- Immutable/fixed data in `GNUSConstants.sol` (constants only, no storage)
- No centralized state manager — storage is distributed across purpose-specific libraries

## Key Abstractions

**Diamond Storage Pattern (Storage Layout):**
- Purpose: Each storage domain defines a `Layout` struct and a `layout()` function using assembly to resolve a `keccak256`-derived slot. This prevents storage collisions between facets and across upgrades.
- Examples: `GNUSNFTFactoryStorage.sol` (NFT metadata), `GNUSControlStorage.sol` (blacklists, fees), `GeniusAIStorage.sol` (escrow data), `GNUSWithdrawLimiterStorage.sol` (rate limiting)
- Pattern:
```solidity
bytes32 constant STORAGE_POSITION = keccak256("domain.storage.location");
struct Layout { /* state variables */ }
function layout() internal pure returns (Layout storage l) {
    bytes32 slot = STORAGE_POSITION;
    assembly { l.slot := slot }
}
```

**Hierarchical Token ID:**
- Purpose: Encode parent-child NFT relationships in a single 256-bit integer. Upper 128 bits = parent token ID; lower 128 bits = child index within parent. `GNUS_TOKEN_ID` (0) is the root.
- Examples: `contracts/gnus-ai/GNUSConstants.sol:37–41`, `contracts/gnus-ai/GNUSNFTFactory.sol:181`
- Pattern: `newTokenID = (parentID << 128) | nft.childCurIndex++`

**Role-Based Access Control (RBAC):**
- Purpose: Multi-tier permission system with super admin override. `GeniusAccessControl` extends `AccessControlEnumerableUpgradeable` with diamond ownership integration.
- Examples: `contracts/gnus-ai/GeniusAccessControl.sol` — `onlySuperAdminRole` modifier, `renounceRole`/`revokeRole` guards
- Roles: `DEFAULT_ADMIN_ROLE`, `UPGRADER_ROLE`, `MINTER_ROLE`, `CREATOR_ROLE`, `NFT_PROXY_OPERATOR_ROLE`

**Versioned Initialization:**
- Purpose: Facets use version-specific initialize functions (e.g., `diamondInitialize250()`, `GNUSNFTFactory_Initialize230()`) controlled by the diamond config. Supports upgrade migrations via `deployInit` and `upgradeInit` directives.
- Examples: `contracts/gnus-ai/DiamondInitFacet.sol:45`, `contracts/gnus-ai/GNUSNFTFactory.sol:42`, `diamonds/GeniusDiamond/geniusdiamond.config.json`

**Withdraw Limiter (Bin-Based Rate Limiting):**
- Purpose: Per-account withdrawal rate limiting using a sliding window of fixed-size bins. Custom per-account configs override global defaults. Super admin bypasses all checks.
- Examples: `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` (bin aggregation, expiry, sum), `contracts/gnus-ai/GNUSWithdrawLimiter.sol` (admin config)
- Pattern: `WithdrawBin` structs store `(timestamp, totalAmount)`; bins expire when `timestamp < currentTime - windowSeconds`

## Entry Points

**GeniusDiamond (Proxy Contract):**
- Location: `contracts/gnus-ai/GeniusDiamond.sol`
- Triggers: All external calls to the diamond address. The proxy's `fallback()` delegates to the appropriate facet.
- Responsibilities: Entry routing, ERC-165 interface registration, `supportsInterface()` override

**GNUSBridge (ERC-20 Interface for GNUS):**
- Location: `contracts/gnus-ai/GNUSBridge.sol`
- Functions: `mint()`, `burn()`, `bridgeOut()`, `withdraw()`, `transfer()`, `transferFrom()`, `approve()`, `balanceOf()`, `totalSupply()`
- Triggers: Token holders, relayers (for bridging), wallets, DEX integrations

**GNUSNFTFactory (NFT Operations):**
- Location: `contracts/gnus-ai/GNUSNFTFactory.sol`
- Functions: `createNFT()`, `createNFTs()`, `mint()`, `mintBatch()`, `setURI()`, `getNFTInfo()`
- Triggers: Creators, admins, DApps

**GNUSControl (Protocol Admin):**
- Location: `contracts/gnus-ai/GNUSControl.sol`
- Functions: `banTransferorForAll()`, `banTransferorBatch()`, `updateBridgeFee()`, `setChainID()`, `setProtocolVersion()`
- Triggers: Super admin only

**GeniusAI (AI Escrow):**
- Location: `contracts/gnus-ai/GeniusAI.sol`
- Functions: `OpenEscrow()`
- Triggers: AI service consumers

**Deployment Scripts (Off-chain Entry Points):**
- `scripts/deploy/rpc/deploy-rpc.ts` — Deploy GeniusDiamond to any RPC endpoint
- `scripts/deploy/rpc/upgrade-rpc.ts` — Upgrade facets on deployed diamond
- `scripts/deploy/rpc/verify-rpc.ts` — Verify deployed contracts on Etherscan/Basescan/Polygonscan
- `scripts/deploy/rpc/status-rpc.ts` — Query deployment status and facet configuration

## Architectural Constraints

- **Threading:** Single-threaded EVM execution context (blockchain smart contracts). Off-chain TypeScript scripts use Node.js event loop (single-threaded async).
- **Global state:** All diamond state stored in the proxy — accessed only through typed storage library functions with `keccak256`-slotted `Layout` structs. No mutable module-level singletons in TypeScript beyond the Hardhat Runtime Environment.
- **Circular imports:** Not detected. Solidity uses explicit imports; TypeScript scripts follow top-down dependency flow (deploy scripts → RPCDiamondDeployer → hardhat config).
- **Contract size:** Facets must stay under the 24KB Spurious Dragon limit. Now 14 facets — if any grow too large, logic must be split into sub-facets.
- **Storage compatibility:** New facet versions must extend the `Layout` struct by appending fields only. Existing field order/types must never change.

## Anti-Patterns

### Direct Diamond Storage Access Outside Libraries

**What happens:** A facet contract directly accesses storage state without going through the `Layout` struct in a storage library.
**Why it's wrong:** Risks storage collisions with other facets and breaks upgrade safety. All storage access must go through `keccak256`-slotted `Layout` functions.
**Do this instead:** Define storage in a dedicated `*Storage.sol` library (e.g., `GNUSNFTFactoryStorage.sol`) with `layout()` pure function. Access only via `GNUSNFTFactoryStorage.layout().someField`.

### Multiple Inheritance Chain Complexity

**What happens:** Facets inherit from deep chains: `Initializable → AccessControlEnumerableUpgradeable → GeniusAccessControl → GNUSERC1155MaxSupply (ERC1155SupplyUpgradeable, PausableUpgradeable, ERC1155BurnableUpgradeable) → GNUSBridge` — resulting in complex `supportsInterface` overrides.
**Why it's wrong:** Each override must manually call `super.supportsInterface()` for all parent types plus `LibDiamond.diamondStorage().supportedInterfaces`. Missing a parent means broken ERC-165 introspection.
**Do this instead:** Always include the `ERC1155Upgradeable.supportsInterface(interfaceId) || AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) || LibDiamond.diamondStorage().supportedInterfaces[interfaceId]` pattern, as shown in `GNUSBridge.sol:49–61` and `GNUSNFTFactory.sol:140–143`.

### constructor vs Initializer Confusion

**What happens:** `GeniusDiamond.sol` uses both a real `constructor()` *and* the `initializer` modifier from OpenZeppelin Upgradeable. Facets use functions like `GNUSNFTFactory_Initialize()` with `onlySuperAdminRole` + manual `InitializableStorage.layout()._initializing` toggling.
**Why it's wrong:** Mixing constructor logic (which runs in proxy context but stores in implementation) with `Initializable` patterns can lead to subtle initialization bugs. The `constructor` in `GeniusDiamond` sets storage on the proxy itself (correct), but uses `initializer` modifier which is atypical for constructors.
**Do this instead:** Follow the established pattern: `GeniusDiamond` constructor uses `initializer` + registers interfaces, then marks `_initialized = false`. Facets use explicit `_Initialize*()` functions called during diamondCut.

## Error Handling

**Strategy:** Require-based validation with custom error messages; revert-on-failure for all critical operations; event emission for admin actions.

**Patterns:**
- `require(condition, "Human-readable error message")` — Used throughout facets for input validation (e.g., `GNUSBridge.sol:151–153` for withdraw preconditions)
- Custom errors (`error CannotWithdrawGNUS();`, `error ErrorWithdrawingEther();`) — Used in `GNUSContractAssets.sol:25–26` for gas-efficient reverts
- `onlySuperAdminRole` modifier — Reverts with "Only SuperAdmin allowed" via `LibDiamond.contractOwner` check (`GeniusAccessControl.sol:73–76`)
- `onlyRole(MINTER_ROLE)` / `onlyRole(DEFAULT_ADMIN_ROLE)` — OpenZeppelin AccessControl modifiers
- Revert with reason string for limiter: `"Withdrawal limit exceeded for time window"` (`GNUSWithdrawLimiterStorage.sol:213`)
- Eth/ERC20 transfer failures: `require(success, 'STE')` / `require(success, 'ST')` in `TransferHelper.sol`

## Cross-Cutting Concerns

**Logging:** On-chain: Solidity `event` emissions (TransferSingle, TransferBatch, BridgeSourceBurned, WithdrawRecorded, WithdrawLimiterTriggered, AddToBlackList, etc.). Off-chain: `hardhat/console.sol` used in `DiamondInitFacet.sol:46` for deployment-time logging; TypeScript scripts use `chalk` for CLI output and `winston` for structured logging.

**Validation:** Input validation via `require()` statements at function entry points. Token transfer guards in `_beforeTokenTransfer` hook: blacklist checks (`GNUSControlStorage.isBannedTransferor`), supply cap checks, pausable checks (`whenNotPaused`), withdrawal limiter checks. Array length consistency enforced (`GNUSNFTFactory.sol:175–176`).

**Authentication:** Role-based via `GeniusAccessControl`. Super admin (contract owner) has unrestricted access. Each role grants specific permissions documented in `docs/Smart-Contracts-Overview.md` access control matrix. Ownership transfer via `GeniusOwnershipFacet.transferOwnership()` rotates both diamond owner and admin roles.

**Upgradability:** EIP-2535 Diamond Standard via `DiamondCutFacet`. Facet additions/replacements/removals specified through `diamonds/GeniusDiamond/geniusdiamond.config.json`. Versioned initialization functions control state migrations. Protocol version tracked in `GNUSControlStorage.layout().protocolVersion`.

---

*Architecture analysis: 2026-05-26*
