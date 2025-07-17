# GNUS.ai Smart Contracts

## Table of Contents

1. [Overview](#overview)
2. [Technical Explanation](#technical-explanation)
3. [Contract Architecture](#contract-architecture)

---

## Overview

### What is GNUS.ai?

GNUS.ai is a revolutionary blockchain platform that combines fungible cryptocurrency tokens with NFTs (Non-Fungible Tokens) in a unique hierarchical system across a variety L1 and L2 blockchains. These are utilized vis a vis the Genius blockchain for utility on ,   Think of it as a digital ecosystem where different types of digital assets can interact, transform, and evolve together.

### GNUS.ai Smart Contracts



### Key Concepts Explained Simply

#### 1. **The GNUS Token - Your Base Currency**

- GNUS is the main currency of the ecosystem, like dollars in the traditional economy
- You can send, receive, and store GNUS tokens just like any other cryptocurrency
- Total supply is capped at 50 million tokens to maintain value
- Works on multiple blockchain networks (Ethereum, Polygon, etc.)

#### 2. **NFT Collections - Digital Assets with Superpowers**

- Beyond just being collectibles, GNUS NFTs can be "burned" (destroyed) to create new tokens
- Each NFT has an exchange rate that determines how many GNUS tokens it's worth
- NFTs can have "children" - creating a family tree of digital assets
- Creators can set maximum supplies for their NFTs to ensure scarcity

#### 3. **The Hierarchical System - Parent and Child Relationships**

Imagine a family tree of digital assets:

- **GNUS Token** is the grandparent at the top
- **First-level NFTs** are created by burning GNUS tokens (like converting dollars to gold coins)
- **Child NFTs** can be created from parent NFTs, forming multiple generations
- Each generation can have different properties, values, and uses

#### 4. **Smart Contract Upgradability - Future-Proof Technology**

- The system uses a "Diamond Pattern" - think of it as a modular smartphone where you can upgrade individual components
- New features can be added without disrupting existing functionality
- Security updates and improvements can be implemented seamlessly

#### 5. **Cross-Chain Bridging - Moving Assets Between Blockchains**

- Like having a universal passport for your digital assets
- You can move your GNUS tokens and NFTs between different blockchain networks
- Small fees apply for bridging to maintain network security
- Your assets are burned on one chain and recreated on another

#### 6. **AI Integration - The Genius Behind GNUS**

- Built-in escrow system for AI processing jobs
- Users can pay for AI services using GNUS tokens
- Smart contracts ensure secure and automated payments for computational work

### Real-World Use Cases

1. **Digital Art and Collectibles**
   - Artists create limited edition NFT collections
   - Collectors can trade or convert NFTs back to GNUS tokens
   - Nested collections allow for themed series and variations

2. **Gaming Assets**
   - Game items as NFTs with real value
   - Players can craft new items by combining existing ones
   - Cross-game compatibility through the hierarchical system

3. **AI Services Marketplace**
   - Pay for AI processing power with GNUS tokens
   - Automated escrow ensures fair transactions
   - Transparent pricing and execution

4. **DeFi Applications**
   - Use GNUS tokens for lending and borrowing
   - NFTs as collateral with clear valuation mechanisms
   - Yield farming opportunities through token conversions

### Benefits for Different Users

**For Token Holders:**

- Flexible asset management - switch between tokens and NFTs as needed
- Protection against inflation through maximum supply caps
- Access to multiple blockchain ecosystems

**For Creators:**

- Launch your own NFT collections without coding knowledge
- Set your own exchange rates and supply limits
- Earn from secondary market transactions

**For Developers:**

- Build on top of a robust, upgradeable infrastructure
- Access to both fungible and non-fungible token standards
- Cross-chain compatibility out of the box

**For Businesses:**

- Accept GNUS tokens as payment
- Create branded NFT collections for customers
- Integrate AI services with blockchain payments

---

## Technical Overview

### System Architecture

GNUS.ai implements a sophisticated multi-token ecosystem using the ERC-2535 Diamond Standard for upgradeability, combining ERC-20 fungible token functionality with ERC-1155 multi-token capabilities in a single upgradeable smart contract system.

### Core Components

#### 1. **Diamond Proxy Architecture**

- **GeniusDiamond.sol**: The main diamond proxy contract that delegates calls to various facets
- Implements EIP-2535 for modular upgradeability
- Supports hot-swapping of contract logic without changing state or addresses
- Maintains a registry of function selectors mapped to facet addresses

#### 2. **Token Standards Implementation**

- **Hybrid ERC-20/ERC-1155**: GNUS token (ID: 0) functions as both ERC-20 and ERC-1155
- **ERC-165 Introspection**: Supports interface detection for compatibility
- **Batch Operations**: Efficient multi-recipient transfers and minting

#### 3. **Hierarchical Token System**

- **Token ID Structure**: 256-bit IDs split into 128-bit parent and child components
- **Parent Mask**: Upper 128 bits identify parent token
- **Child Mask**: Lower 128 bits identify child within parent's collection
- **Burn-to-Mint Mechanism**: Parent tokens burned at defined exchange rates to mint children

### Key Contracts

#### **GNUSNFTFactory.sol**

Core factory contract managing NFT creation and minting:

- Creates hierarchical NFT structures with parent-child relationships
- Enforces role-based permissions (CREATOR_ROLE, DEFAULT_ADMIN_ROLE)
- Implements maximum supply constraints per token ID
- Manages token metadata (name, symbol, URI, exchange rates)

#### **GNUSBridge.sol**

Cross-chain bridge functionality:

- Burn tokens on source chain, emit events for off-chain relayers
- Mint tokens on destination chain with optional bridge fees
- Supports both GNUS tokens and NFTs
- Implements role-based minting (MINTER_ROLE)

#### **GNUSERC1155MaxSupply.sol**

Extended ERC-1155 implementation with supply management:

- Enforces maximum supply limits per token ID
- Integrates pausable functionality for emergency stops
- Implements burnable token interface
- Prevents transfers from banned addresses

#### **GeniusAccessControl.sol**

Role-based access control system:

- Extends OpenZeppelin's AccessControlEnumerable
- Defines roles: DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, MINTER_ROLE, CREATOR_ROLE
- Prevents super admin from renouncing critical roles
- Integrates with diamond storage for ownership management

#### **GNUSControl.sol**

Protocol-level control mechanisms:

- Global and per-token blacklist management
- Bridge fee configuration (max 20%)
- Protocol version management
- Chain ID configuration for cross-chain operations

#### **ERC20TransferBatch.sol**

Batch transfer operations for gas efficiency:

- Mint to multiple recipients in single transaction
- Supports batch burns with supply tracking
- Emits batch transfer events for efficient indexing

#### **GeniusAI.sol**

AI service integration:

- Escrow system for AI processing jobs
- UUID-based job tracking (128-bit identifiers)
- Maps escrow amounts to specific AI tasks

### Storage Architecture

#### **Diamond Storage Pattern**

All contracts use the diamond storage pattern for upgrade-safe state management:

```solidity
bytes32 constant STORAGE_POSITION = keccak256("domain.storage.location");
struct Layout { /* state variables */ }
function layout() internal pure returns (Layout storage l) {
    bytes32 slot = STORAGE_POSITION;
    assembly { l.slot := slot }
}
```

#### **Key Storage Structures**

**NFT Storage (GNUSNFTFactoryStorage)**

- Mapping of token IDs to NFT metadata
- Tracks creator, max supply, exchange rates
- Maintains child token counter for ID generation

**Control Storage (GNUSControlStorage)**

- Banned transferor mappings (global and per-token)
- Bridge fee percentage
- Protocol version tracking
- Chain ID for cross-chain operations

**AI Storage (GeniusAIStorage)**

- Escrow counter per address
- Job details including UUID and amounts

### Technical Features

#### **Gas Optimizations**

- Batch operations reduce transaction costs
- Unchecked arithmetic where overflow impossible
- Efficient storage packing in structs
- Minimal external calls

#### **Security Measures**

- Reentrancy protection through checks-effects-interactions
- Role-based access control at multiple levels
- Pausable functionality for emergency response
- Transfer blacklisting capabilities

#### **Upgradeability Patterns**

- Facet-based logic separation
- Initialization functions for version migrations
- Backward compatibility maintenance
- State migration capabilities

#### **Cross-Chain Architecture**

- Event-based bridging with off-chain relayers
- Burn verification on source chain
- Controlled minting on destination chain
- Fee mechanism for bridge operators

### Integration Points

#### **For DeFi Protocols**

- Standard ERC-20 interface for GNUS token
- ERC-1155 batch operations for efficiency
- Approval mechanisms for automated transfers
- Supply queries for price calculations

#### **For NFT Marketplaces**

- Full ERC-1155 compatibility
- Metadata URI support
- Creator royalty tracking
- Batch transfer support

#### **For Wallet Providers**

- ERC-165 interface detection
- Both ERC-20 and ERC-1155 support
- Event emission for transaction tracking
- Balance query optimization

---

## Contract Architecture

### Diamond Facets Structure

```bash
GeniusDiamond (Proxy)
├── DiamondCutFacet (Upgrade Management)
├── DiamondLoupeFacet (Introspection)
├── GeniusOwnershipFacet (Ownership)
├── GNUSNFTFactory (NFT Creation/Minting)
├── GNUSBridge (Cross-chain Operations)
├── ERC20TransferBatch (Batch Transfers)
├── GNUSControl (Protocol Controls)
├── ERC1155ProxyOperator (Marketplace Integration)
├── GeniusAI (AI Service Escrow)
└── GNUSContractAssets (Asset Recovery)
```

### Token Hierarchy Example

```bash
GNUS Token (ID: 0)
├── NFT Collection A (ID: 0x00000000...00000001)
│   ├── Sub-NFT A1 (ID: 0x00000001...00000001)
│   └── Sub-NFT A2 (ID: 0x00000001...00000002)
└── NFT Collection B (ID: 0x00000000...00000002)
    └── Sub-NFT B1 (ID: 0x00000002...00000001)
```

### Transaction Flow Diagrams

#### **NFT Minting Flow**

1. User holds GNUS tokens
2. Calls `createNFT()` to define new NFT type
3. Burns GNUS tokens via `mint()` at exchange rate
4. Receives newly minted NFTs

#### **Bridge Transfer Flow**

1. User calls `bridgeOut()` on source chain
2. Tokens burned, event emitted
3. Off-chain relayer detects event
4. Relayer calls `mint()` on destination chain
5. User receives tokens on new chain

#### **AI Service Flow**

1. User deposits GNUS to escrow via `OpenEscrow()`
2. AI service processes job linked to UUID
3. Payment released upon completion
4. Escrow tracking maintained on-chain

### Access Control Matrix

| Role | Permissions |
|------|------------|
| Super Admin | All operations, ownership transfer |
| DEFAULT_ADMIN_ROLE | Pause/unpause, URI updates, minting |
| UPGRADER_ROLE | Add/remove facets, upgrade logic |
| MINTER_ROLE | Mint tokens via bridge |
| CREATOR_ROLE | Create child NFTs |
| NFT_PROXY_OPERATOR_ROLE | Approve all transfers (marketplaces) |

### State Variables Summary

| Contract | Key State | Purpose |
|----------|-----------|---------|
| GNUSNFTFactory | NFTs mapping | Token metadata storage |
| GNUSBridge | Balance mappings | Token ownership tracking |
| GNUSControl | Blacklists, fees | Security and protocol parameters |
| GeniusAI | Escrow mappings | AI job payment tracking |
| ERC20Storage | Allowances | ERC-20 approval system |

### Events Architecture

The system emits comprehensive events for off-chain monitoring:

- `Transfer` (ERC-20 compatible)
- `TransferSingle/Batch` (ERC-1155)
- `BridgeSourceBurned` (Cross-chain)
- `InitLog` (Upgrade tracking)
- Blacklist management events
- Protocol parameter updates

This architecture ensures a robust, scalable, and upgradeable multi-token ecosystem suitable for DeFi, NFT, and AI service integration.
