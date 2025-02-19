# GNUS.ai Smart Contract Documentation

## Overview
GNUS.ai is a cutting-edge blockchain protocol designed to facilitate the creation, management, and interaction with NFTs and tokens. This repository contains a set of Solidity contracts that implement the protocol’s core features, including ERC-1155 token management, access control, bridging, and advanced NFT functionality.

This documentation provides an overview of the key contracts, their functionality, and how they interact.

---

## Contracts

### **GNUSERC1155MaxSupply.sol**
Extends the ERC-1155 token standard with features for maximum supply enforcement and pausable/burnable capabilities.

#### Key Features:
- **`_beforeTokenTransfer`**: Enforces supply limits and checks banned transferors.
- **Singleton Array Utilities**: `asSingletonArray` helps to convert single values to arrays for uniformity.

---

### **ERC20TransferBatch.sol**
Manages batch transfers and minting of ERC20 tokens with supply checks.

#### Key Features:
- **Batch Minting**: `mintBatch` allows batch minting of tokens.
- **Batch Transfers**: `transferBatch` supports multi-recipient transfers with optional burn capabilities.

---

### **GeniusAI.sol**
Handles escrow operations for AI processing jobs.

#### Key Features:
- **Escrow Management**: Allows users to open escrow for AI jobs with a UUID identifier.

---

### **GeniusAccessControl.sol**
Implements advanced access control using roles.

#### Key Features:
- **Role Management**: Supports `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE` for fine-grained control.
- **Restrictions**: Prevents super admin roles from being renounced or revoked.

---

### **GeniusAIStorage.sol**
Defines the storage layout for AI processing jobs.

#### Key Features:
- **Job Management**: Stores and retrieves escrow information for AI jobs.

---

### **TransferHelper.sol**
Utility library for safe interactions with ERC20 tokens and ETH transfers.

#### Key Features:
- **Safe Transfers**: Functions like `safeTransfer` and `safeTransferETH` ensure secure operations.

---

### **GNUSContractAssets.sol**
Allows the withdrawal of mistakenly sent tokens and manages asset security.

#### Key Features:
- **Token Withdrawals**: Restricts GNUS token withdrawals but allows external tokens to be reclaimed.

---

### **Utils.sol**
Mathematical and cryptographic utility functions for group and field operations.

#### Key Features:
- **Group Operations**: Includes `add`, `mul`, and `inv` for modular arithmetic.
- **Point Mapping**: Converts data into elliptic curve points.

---

### **GNUSNFTFactoryStorage.sol**
Handles storage for NFTs created in the protocol.

#### Key Features:
- **NFT Metadata**: Stores name, symbol, URI, max supply, and creator information for NFTs.

---

### **GNUSNFTFactory.sol**
Facilitates the creation and management of NFTs.

#### Key Features:
- **NFT Creation**: Functions like `createNFT` and `createNFTs` to mint parent and child NFTs.
- **Minting Restrictions**: Ensures only authorized users can mint NFTs.

---

### **GeniusDiamond.sol**
Implements the core diamond proxy for GNUS.ai using the EIP-2535 Diamond Standard.

#### Key Features:
- **Proxy Support**: Registers interfaces dynamically.
- **Upgradeable**: Uses facets for modular upgrades.

---

### **MockERC20Upgradeable.sol**
A mock ERC20 implementation for testing purposes.

#### Key Features:
- **Token Minting**: Simulates ERC20 token creation for testing.

---

### **GNUSNFTCollectionName.sol**
Defines the name of the NFT collection.

#### Key Features:
- **`name`**: Returns the static name of the collection: "Genius NFT Collection".

---

### **ERC1155ProxyOperator.sol**
Customizes the operator approvals and supply management for ERC1155 tokens.

#### Key Features:
- **Proxy Support**: Implements OpenSea proxy whitelisting.

---

### **GeniusOwnershipFacet.sol**
Implements ownership transfer functionality for the diamond proxy.

#### Key Features:
- **Ownership Transfer**: Allows secure transfer of contract ownership.

---

### 16. **GNUSBridge.sol**
Manages bridging of GNUS tokens and NFTs across chains.

#### Key Features:
- **Bridge Functionality**: Supports token burning and minting for cross-chain operations.
- **Mint/Burn**: Allows minting and burning of both ERC20 and ERC1155 tokens.

---

### 17. **GNUSConstants.sol**
Defines global constants for the protocol.

#### Key Constants:
- **GNUS Token Details**: Includes name, symbol, URI, and supply limits.

---

### 18. **GNUSControl.sol**
Handles protocol-level controls and security.

#### Key Features:
- **Blacklist Management**: Supports banning/unbanning addresses globally or per token.
- **Protocol Upgrades**: Manages versioning and upgrade logic.

---

### 19. **GNUSControlStorage.sol**
Defines storage layout for protocol controls.

#### Key Features:
- **Blacklist Storage**: Maps banned addresses globally and per token.
- **Bridge Fees**: Configurable fee for bridging tokens.

---

## Notes

- **Security**: The contracts implement several layers of access control and validation to ensure secure operations.
- **Upgradeable Design**: Many contracts utilize modular design patterns, such as the Diamond Standard, to enable seamless upgrades.
- **Extensibility**: Designed to integrate with external systems like OpenSea and Axelar Network.

For any questions or issues, please contact support@gnus.ai.

Version 2:

### README.md for GNUS-AI Smart Contracts

---

# GNUS.ai Smart Contracts Documentation

## Overview

This repository contains the smart contracts powering the GNUS.ai platform, an advanced blockchain ecosystem designed to manage and interact with Genius Tokens (GNUS), NFTs, and other blockchain assets. The contracts implement features like token minting, NFT creation, security controls, bridge functionality, and much more. Below is a detailed explanation of the contracts, their roles, and their primary methods.

---

## Contract Directory

### 1. **GNUSERC1155MaxSupply.sol**
   - **Purpose:** Implements an ERC-1155 token with maximum supply constraints.
   - **Features:**
     - Pausable and burnable ERC-1155 tokens.
     - Ensures token transfers respect the maximum supply limit.
     - Methods:
       - `_beforeTokenTransfer`: Enforces supply and transfer restrictions.
       - `asSingletonArray`: Utility to wrap elements in arrays for easy usage.

---

### 2. **ERC20TransferBatch.sol**
   - **Purpose:** Facilitates batch transfers and minting of ERC20-like tokens.
   - **Features:**
     - Supports minting, burning, and batch transfer operations.
     - Events:
       - `TransferBatch`: Logs batch transfers.
     - Methods:
       - `mintBatch`: Mints tokens in bulk to multiple recipients.
       - `transferBatch`: Transfers tokens in bulk.
       - `transferOrBurnBatch`: Handles token burns and transfers simultaneously.

---

### 3. **GeniusAI.sol**
   - **Purpose:** Manages AI-related jobs and escrow deposits on the blockchain.
   - **Features:**
     - Initializes the AI module.
     - Handles escrow operations for AI processing jobs.
     - Methods:
       - `OpenEscrow`: Opens an escrow for a job with a unique identifier.

---

### 4. **GeniusAccessControl.sol**
   - **Purpose:** Implements access control for administrative and operational roles.
   - **Features:**
     - Customizable roles like `UPGRADER_ROLE`.
     - Protection against accidental role revocations.
     - Methods:
       - `__GeniusAccessControl_init`: Initializes access control settings.
       - `revokeRole` and `renounceRole`: Safeguards against admin privilege mismanagement.

---

### 5. **GeniusAIStorage.sol**
   - **Purpose:** Defines the storage layout for managing AI processing jobs.
   - **Features:**
     - Structured storage for job data, including escrow amounts and UUIDs.
     - Library for accessing and manipulating job-related data.

---

### 6. **libraries/TransferHelper.sol**
   - **Purpose:** Utility library for safe token transfers.
   - **Features:**
     - Handles low-level calls for ERC20 transfers, approvals, and ETH transfers.
     - Methods:
       - `safeTransfer`, `safeApprove`, `safeTransferFrom`, `safeTransferETH`.

---

### 7. **GNUSContractAssets.sol**
   - **Purpose:** Manages withdrawal of non-GNUS tokens mistakenly sent to the contract.
   - **Features:**
     - Safeguards against accidental withdrawal of GNUS tokens.
     - Methods:
       - `withdrawToken`: Withdraws specified tokens to an external address.

---

### 8. **utils/Utils.sol**
   - **Purpose:** Provides utility functions for mathematical and cryptographic operations.
   - **Features:**
     - Arithmetic operations modulo group and field orders.
     - Point operations for elliptic curve computations.

---

### 9. **GNUSNFTFactory.sol**
   - **Purpose:** Factory for creating and managing NFTs under the GNUS ecosystem.
   - **Features:**
     - Supports child NFTs and batch minting.
     - Methods:
       - `createNFT`: Creates a new NFT with specified attributes.
       - `mintBatch`: Batch mints NFTs.
       - `getNFTInfo`: Retrieves metadata for a specific NFT.

---

### 10. **GeniusDiamond.sol**
   - **Purpose:** Implements the diamond standard architecture for modular smart contracts.
   - **Features:**
     - ERC165 interface support.
     - Diamond pattern for flexible upgrades.

---

### 11. **GNUSBridge.sol**
   - **Purpose:** Bridges tokens between chains.
   - **Features:**
     - Handles minting, burning, and bridging of tokens across chains.
     - Events:
       - `BridgeSourceBurned`: Logs bridge operations.
     - Methods:
       - `mint`: Mints tokens with a bridge fee.
       - `bridgeOut`: Initiates bridging to another chain.

---

### 12. **GNUSControl.sol**
   - **Purpose:** Manages security and protocol settings for the GNUS ecosystem.
   - **Features:**
     - Blacklist management for addresses and token IDs.
     - Bridge fee and protocol version management.
     - Methods:
       - `banTransferorForAll`: Globally bans an address from transferring tokens.
       - `updateBridgeFee`: Updates the fee for bridge operations.

---

## Key Constants
The **GNUSConstants.sol** file contains important constants used across the platform:
- **GNUS_NAME:** "Genius Tokens"
- **GNUS_SYMBOL:** "GNUS"
- **GNUS_MAX_SUPPLY:** 50 million tokens.
- **GNUS_URI:** Default URI for token metadata.

---

## Development Guidelines

- **Testing:** Use the provided scripts in the `package.json` file for testing and deploying.
- **Integration:** Ensure compatibility with the OpenZeppelin libraries and Hardhat environment.
- **Access Control:** Verify roles and permissions before executing administrative functions.

---

## Security

- All contracts are built with security in mind, employing features such as:
  - Role-based access control.
  - Strict validation of transfers and minting operations.
  - Safe token and ETH transfer utilities.
- Regular audits and updates are recommended.

---

## Contributions

We welcome contributions to improve the GNUS ecosystem. Please follow our coding standards and submit pull requests for review.

---

For further questions or support, please contact: **support@gnus.ai**.
