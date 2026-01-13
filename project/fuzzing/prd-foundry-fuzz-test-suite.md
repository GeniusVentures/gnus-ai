# Product Requirements Document: Foundry Fuzz Test Suite for GeniusDiamond

## 1. Introduction/Overview

This document outlines the requirements for a comprehensive Foundry fuzz test suite targeting the GeniusDiamond ERC-2535 Diamond Proxy contract. The test suite will provide robust property-based testing with randomized inputs to discover edge cases, security vulnerabilities, and ensure contract invariants hold under all conditions.

The GeniusDiamond is a complex multi-facet smart contract system that implements:
- ERC20/ERC1155 hybrid token functionality (GNUS token)
- NFT Factory for creating and managing NFT collections
- Cross-chain bridge functionality
- Role-based access control
- Proxy operator patterns

**Problem Statement:** The existing Hardhat tests provide functional coverage but lack the randomized input testing and invariant verification that Foundry's fuzz testing excels at. Security-critical smart contracts require exhaustive testing to prevent exploits and ensure economic invariants are maintained.

**Goal:** Create a production-ready Foundry fuzz test suite achieving 85% code coverage with comprehensive invariant testing across all facets.

---

## 2. Goals

1. **Achieve 85% code coverage** across all GeniusDiamond facets using Foundry fuzz tests
2. **Validate all critical invariants** including state consistency, access control, and economic rules
3. **Discover edge cases and failure modes** through property-based testing with randomized inputs
4. **Test security attack vectors** including reentrancy, overflow, and access control bypass attempts
5. **Integrate with existing CI/CD pipeline** using the `@diamondslab/diamonds-hardhat-foundry` tooling
6. **Provide clear, maintainable test code** following professional Solidity standards

---

## 3. User Stories

### As a Smart Contract Developer
- I want fuzz tests that automatically discover edge cases so that I can fix bugs before deployment
- I want invariant tests that verify contract state consistency so that I can be confident in contract correctness
- I want clear test failure messages so that I can quickly identify and fix issues

### As a Security Auditor
- I want comprehensive access control tests so that I can verify role-based permissions work correctly
- I want attack vector tests so that I can verify the contract resists common exploit patterns
- I want economic invariant tests so that I can verify token economics cannot be manipulated

### As a DevOps Engineer
- I want tests that integrate with the existing deployment tooling so that I can run them in CI/CD
- I want tests that run quickly and reliably so that they don't block deployments
- I want clear coverage reports so that I can track test quality over time

---

## 4. Functional Requirements

### 4.1 Test Infrastructure

1. **FR-001:** The test suite MUST use the auto-generated `DiamondDeployment.sol` helper contract for all deployed addresses
2. **FR-002:** The test suite MUST extend the `DiamondFuzzBase` base contract from `@diamondslab/diamonds-hardhat-foundry`
3. **FR-003:** The test suite MUST use `DiamondForgeHelpers` utility library for validation and assertions
4. **FR-004:** The test suite MUST be organized in a hierarchical structure with a shared base contract and domain-specific extensions
5. **FR-005:** All test contracts MUST be placed in the `test/foundry/` directory following the existing structure

### 4.2 Diamond Core Invariants

6. **FR-006:** The test suite MUST verify that the Diamond owner address is never `address(0)` after initialization
7. **FR-007:** The test suite MUST verify that ownership transfers only succeed when called by the current owner
8. **FR-008:** The test suite MUST verify that `diamondCut` operations only succeed when called by the owner
9. **FR-009:** The test suite MUST verify that function selectors never overlap across facets
10. **FR-010:** The test suite MUST verify that all registered selectors route to valid facet addresses (non-zero)
11. **FR-011:** The test suite MUST verify that facet replacement maintains selector routing integrity

### 4.3 Access Control Invariants

12. **FR-012:** The test suite MUST verify that `DEFAULT_ADMIN_ROLE` can grant and revoke all other roles
13. **FR-013:** The test suite MUST verify that role-protected functions revert when called by unauthorized addresses
14. **FR-014:** The test suite MUST verify that `MINTER_ROLE` is required for minting operations
15. **FR-015:** The test suite MUST verify that `PAUSER_ROLE` is required for pause/unpause operations (if applicable)
16. **FR-016:** The test suite MUST fuzz test role granting/revoking with random addresses and roles

### 4.4 ERC20 Token Invariants (GNUS Token)

17. **FR-017:** The test suite MUST verify that total supply never exceeds the maximum supply constant
18. **FR-018:** The test suite MUST verify that the sum of all balances equals total supply
19. **FR-019:** The test suite MUST verify that transfers do not create or destroy tokens (balance conservation)
20. **FR-020:** The test suite MUST verify that transfers from `address(0)` revert
21. **FR-021:** The test suite MUST verify that transfers to `address(0)` revert (unless burning is intended)
22. **FR-022:** The test suite MUST fuzz test `transfer`, `transferFrom`, and `approve` with random amounts and addresses
23. **FR-023:** The test suite MUST verify that allowance updates correctly with `approve` and `increaseAllowance`/`decreaseAllowance`
24. **FR-024:** The test suite MUST test batch transfer functionality (`ERC20TransferBatch`)

### 4.5 ERC1155 Token Invariants

25. **FR-025:** The test suite MUST verify that token IDs with max supply constraints cannot exceed their limits
26. **FR-026:** The test suite MUST verify that `balanceOf` returns correct values after mint/burn/transfer operations
27. **FR-027:** The test suite MUST verify that `safeTransferFrom` and `safeBatchTransferFrom` work correctly
28. **FR-028:** The test suite MUST verify that approval operators are correctly managed (`setApprovalForAll`)
29. **FR-029:** The test suite MUST test the `ERC1155ProxyOperator` functionality with random operators

### 4.6 NFT Factory Invariants

30. **FR-030:** The test suite MUST verify that NFT collection creation burns the correct amount of GNUS tokens
31. **FR-031:** The test suite MUST verify that NFT collection IDs are unique and incrementing
32. **FR-032:** The test suite MUST verify that only collection owners can mint NFTs in their collections
33. **FR-033:** The test suite MUST verify that NFT metadata (name, URI) is correctly stored and retrievable
34. **FR-034:** The test suite MUST fuzz test NFT creation with random parameters (supply, price, metadata)

### 4.7 Bridge Invariants

35. **FR-035:** The test suite MUST verify that bridge deposits correctly lock tokens
36. **FR-036:** The test suite MUST verify that bridge withdrawals only succeed with valid signatures/proofs (if applicable)
37. **FR-037:** The test suite MUST verify that bridge operations maintain total supply consistency across chains
38. **FR-038:** The test suite MUST fuzz test bridge amounts and recipient addresses

### 4.8 Economic Invariants

39. **FR-039:** The test suite MUST verify that GNUS burn rates for NFT creation are correctly calculated
40. **FR-040:** The test suite MUST verify that exchange rates and fees are maintained correctly
41. **FR-041:** The test suite MUST verify that no operations create "free" tokens or bypass burn requirements

### 4.9 Security Attack Vector Tests

42. **FR-042:** The test suite MUST test for reentrancy vulnerabilities in all external calls
43. **FR-043:** The test suite MUST test for integer overflow/underflow in arithmetic operations
44. **FR-044:** The test suite MUST test for access control bypass attempts with random callers
45. **FR-045:** The test suite MUST test for front-running vulnerabilities in critical operations
46. **FR-046:** The test suite MUST test for signature replay attacks in bridge operations (if applicable)

### 4.10 Edge Cases and Failure Modes

47. **FR-047:** The test suite MUST test operations with zero amounts
48. **FR-048:** The test suite MUST test operations with maximum uint256 values
49. **FR-049:** The test suite MUST test operations with the contract itself as sender/receiver
50. **FR-050:** The test suite MUST test operations during paused state (if pausable)
51. **FR-051:** The test suite MUST verify that failed operations correctly revert without state changes

---

## 5. Non-Goals (Out of Scope)

1. **NOT** modifying existing Hardhat tests - this suite complements them
2. **NOT** testing external contract integrations (e.g., Chainlink, other protocols)
3. **NOT** testing off-chain components (indexers, APIs, front-end)
4. **NOT** testing deployment scripts - only deployed contract behavior
5. **NOT** fork testing from live networks - only fresh local deployments
6. **NOT** gas optimization - focus is on correctness, not efficiency
7. **NOT** formal verification - only property-based testing

---

## 6. Design Considerations

### 6.1 Test File Structure

```
test/foundry/
├── helpers/
│   └── DiamondDeployment.sol          # Auto-generated (existing)
├── base/
│   └── GeniusDiamondTestBase.sol      # Shared base contract for all tests
├── invariant/
│   ├── DiamondCoreInvariant.t.sol     # Diamond proxy invariants
│   ├── AccessControlInvariant.t.sol   # Role-based access invariants
│   ├── ERC20Invariant.t.sol           # GNUS token invariants
│   ├── ERC1155Invariant.t.sol         # Multi-token invariants
│   ├── NFTFactoryInvariant.t.sol      # NFT factory invariants
│   ├── BridgeInvariant.t.sol          # Bridge invariants
│   └── EconomicInvariant.t.sol        # Economic/tokenomics invariants
├── fuzz/
│   ├── DiamondCoreFuzz.t.sol          # Diamond operations fuzz
│   ├── AccessControlFuzz.t.sol        # Access control fuzz
│   ├── ERC20Fuzz.t.sol                # ERC20 operations fuzz
│   ├── ERC1155Fuzz.t.sol              # ERC1155 operations fuzz
│   ├── NFTFactoryFuzz.t.sol           # NFT factory fuzz
│   ├── BridgeFuzz.t.sol               # Bridge operations fuzz
│   └── SecurityFuzz.t.sol             # Attack vector fuzz tests
└── handlers/
    └── GeniusDiamondHandler.sol       # Handler for invariant testing
```

### 6.2 Base Contract Pattern

```solidity
// GeniusDiamondTestBase.sol extends DiamondFuzzBase
// Provides:
// - Diamond address from DiamondDeployment.sol
// - Common setup (deployer impersonation, role setup)
// - Helper functions specific to GeniusDiamond
// - Interface casting helpers
```

### 6.3 Naming Conventions

- Invariant tests: `invariant_<description>`
- Fuzz tests: `testFuzz_<description>`
- Failure tests: `testFuzz_RevertWhen_<condition>`
- Handler functions: `<action>_<target>`

---

## 7. Technical Considerations

### 7.1 Dependencies

- **Foundry** (forge-std v1.12.0+)
- **@diamondslab/diamonds-hardhat-foundry** (for `DiamondFuzzBase`, `DiamondForgeHelpers`)
- **OpenZeppelin Contracts** (for interface definitions)

### 7.2 Foundry Configuration

```toml
# foundry.toml additions
[fuzz]
runs = 10000              # Extended fuzz runs for 85% coverage target
max_test_rejects = 65536
seed = 0x1234             # Reproducible tests

[invariant]
runs = 1000
depth = 50
fail_on_revert = false    # Allow some reverts in invariant testing
```

### 7.3 Remappings

```
@diamondslab/diamonds-hardhat-foundry/=node_modules/@diamondslab/diamonds-hardhat-foundry/
@openzeppelin/=node_modules/@openzeppelin/
forge-std/=lib/forge-std/src/
```

### 7.4 Handler Contract

A `GeniusDiamondHandler` contract will be used for invariant testing to:
- Bound fuzz inputs to valid ranges
- Track ghost variables for invariant assertions
- Provide weighted action selection
- Filter invalid state transitions

### 7.5 Known Constraints

- Tests run against fresh Anvil deployment only (not fork mode)
- Some operations require specific roles - tests must set up roles in `setUp()`
- Bridge tests may be limited if they require external chain state

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Code Coverage | ≥85% | `forge coverage --report summary` |
| Test Pass Rate | 100% | All tests pass with 10,000 fuzz runs |
| Invariant Stability | 100% | No invariant failures in 1,000 runs |
| CI Integration | ✓ | Tests run in GitHub Actions |
| Execution Time | <10 min | Full suite completes in CI |

### 8.1 Coverage Breakdown Targets

| Facet | Target Coverage |
|-------|-----------------|
| DiamondCutFacet | 90% |
| DiamondLoupeFacet | 85% |
| GeniusOwnershipFacet | 90% |
| GeniusAccessControl | 90% |
| GeniusAI (ERC20) | 85% |
| ERC1155ProxyOperator | 85% |
| GNUSNFTFactory | 85% |
| GNUSBridge | 80% |
| ERC20TransferBatch | 85% |
| GNUSControl | 85% |

---

## 9. Open Questions

1. **Q:** Are there specific bridge signature/proof mechanisms that need testing, or is bridge functionality simpler?
2. **Q:** What are the exact GNUS burn rates for NFT collection creation? (Need constants)
3. **Q:** Are there any pausable facets, and which roles control pause state?
4. **Q:** Should invariant tests include time-based scenarios (block.timestamp manipulation)?
5. **Q:** Are there any facets with upgrade restrictions or immutable selectors?
6. **Q:** What is the relationship between GNUS token ID 0 (fungible) and other token IDs (NFTs)?

---

## Appendix A: Reference Materials

- **Existing Hardhat Tests:**
  - `test/unit/Erc20Batch.test.ts`
  - `test/unit/ERC1155ProxyOperator.test.ts`
  - `test/unit/GNUSBridge.test.ts`
  - `test/unit/GNUSERC20.test.ts`
  - `test/unit/NFTFactory.test.ts`

- **Contract Sources:** `contracts/gnus-ai/`
- **Diamond ABI:** `diamond-abi/GeniusDiamond.json`
- **TypeChain Types:** `diamond-typechain-types/`
- **Deployment Helper:** `test/foundry/helpers/DiamondDeployment.sol`

---

## Appendix B: Facet Function Summary

Based on `DiamondDeployment.sol`, the following facets are deployed:

| Facet | Address Constant | Primary Functions |
|-------|-----------------|-------------------|
| DiamondCutFacet | `DIAMOND_CUT_FACET` | `diamondCut` |
| DiamondLoupeFacet | `DIAMOND_LOUPE_FACET` | `facets`, `facetAddresses`, `facetFunctionSelectors` |
| GeniusOwnershipFacet | `GENIUS_OWNERSHIP_FACET` | `transferOwnership`, `owner` |
| GNUSNFTFactory | `G_N_U_S_N_F_T_FACTORY_FACET` | NFT collection creation |
| ERC1155ProxyOperator | `E_R_C1155_PROXY_OPERATOR_FACET` | Proxy operator management |
| GeniusAI | `GENIUS_A_I_FACET` | ERC20 functions (transfer, approve, etc.) |
| GNUSNFTCollectionName | `G_N_U_S_N_F_T_COLLECTION_NAME_FACET` | Collection naming |
| ERC20TransferBatch | `E_R_C20_TRANSFER_BATCH_FACET` | Batch transfers |
| GNUSContractAssets | `G_N_U_S_CONTRACT_ASSETS_FACET` | Asset management |
| GNUSControl | `G_N_U_S_CONTROL_FACET` | Control functions |
| GNUSBridge | `G_N_U_S_BRIDGE_FACET` | Cross-chain bridge |
| DiamondInitFacet | `DIAMOND_INIT_FACET` | Initialization |