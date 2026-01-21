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

For further questions or support, please contact: **<support@gnus.ai>**.
