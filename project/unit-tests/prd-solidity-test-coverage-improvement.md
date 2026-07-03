# PRD: Solidity Test Coverage Improvement to 90%+

## Introduction/Overview

The GNUS AI smart contract system currently has 63.98% test coverage, which is below the industry standard for production-ready smart contracts. This initiative aims to systematically increase test coverage to over 90% by focusing on contracts with low coverage (<50%) and implementing comprehensive unit tests that cover happy paths and major error conditions.

The current testing framework uses:

- **ERC-2535 Diamond Proxy Standard** via `@diamondslab/diamonds` management system
- **Multi-chain testing** capability via `hardhat-multichain`
- **Deployment utilities** including `LocalDiamondDeployer` from `@diamondslab/hardhat-diamonds` (part of the Diamonds ecosystem) and `loadDiamondContract`

This PRD outlines a phased approach to incrementally improve coverage while maintaining test quality and consistency with the existing testing architecture.

## Goals

1. **Primary Goal**: Achieve >90% test coverage across all Solidity contracts
2. **Coverage Milestones**:
   - Phase 1: Reach 75% coverage (focusing on 0% coverage contracts)
   - Phase 2: Reach 85% coverage (addressing <50% coverage contracts)
   - Phase 3: Reach 90%+ coverage (comprehensive coverage for remaining gaps)
3. **Test Quality**: Ensure all tests cover happy paths and major error conditions
4. **Maintainability**: Follow existing test patterns and maintain consistency with the Diamond deployment framework
5. **Documentation**: Provide clear test descriptions that serve as functional specifications

## User Stories

**As a smart contract developer**, I need comprehensive test coverage so that I can confidently deploy contracts to production knowing critical functions are validated.

**As a security auditor**, I need tests that cover error conditions and access control so that I can verify the contract behaves correctly under adverse conditions.

**As a project maintainer**, I need tests that follow consistent patterns so that I can easily understand, debug, and extend the test suite.

**As a QA engineer**, I need incremental coverage milestones so that I can track progress and identify high-risk areas that remain untested.

## Functional Requirements

### Phase 1: Zero-Coverage Contracts (Target: 75% Overall Coverage)

#### 1. GNUSContractAssets.sol (Currently 0%)

- **1.1** Test `setContractAsset()` function with valid parameters
- **1.2** Test `setContractAsset()` access control (should reject non-authorized callers)
- **1.3** Test `getContractAsset()` retrieval for stored assets
- **1.4** Test `getContractAsset()` returns appropriate values for non-existent assets
- **1.5** Test asset update scenarios (overwriting existing assets)

#### 2. GeniusAI.sol (Currently 0%)

- **2.1** Test AI-related state initialization
- **2.2** Test AI function calls with valid inputs
- **2.3** Test AI function access control restrictions
- **2.4** Test AI configuration updates
- **2.5** Test interaction with GeniusAIStorage

#### 3. GeniusAIStorage.sol (Currently 0%)

- **3.1** Test storage initialization for AI-related data
- **3.2** Test storage read/write operations
- **3.3** Test storage access control
- **3.4** Test storage state persistence across transactions

#### 4. GeniusOwnershipFacet.sol (Currently 12.5% lines)

- **4.1** Test `transferOwnership()` with valid new owner
- **4.2** Test `transferOwnership()` rejects non-owner callers
- **4.3** Test `transferOwnership()` rejects zero address
- **4.4** Test ownership verification functions
- **4.5** Test ownership transfer events emission

#### 5. TransferHelper.sol (Currently 0%)

- **5.1** Test safe ERC20 transfer functionality
- **5.2** Test safe ERC20 transferFrom functionality
- **5.3** Test safe ERC20 approve functionality
- **5.4** Test handling of non-compliant ERC20 tokens
- **5.5** Test revert conditions for failed transfers

### Phase 2: Low-Coverage Contracts (Target: 85% Overall Coverage)

#### 6. ERC1155ProxyOperator.sol (Currently 20%)

- **6.1** Test proxy operator approval functionality
- **6.2** Test proxy operator transfer operations
- **6.3** Test proxy operator access control
- **6.4** Test proxy operator revocation
- **6.5** Test batch operations via proxy

#### 7. ERC20TransferBatch.sol (Currently 47.73% lines)

- **7.1** Test batch transfer functionality with multiple recipients
- **7.2** Test batch transfer with insufficient balance
- **7.3** Test batch transfer with mismatched array lengths
- **7.4** Test batch transfer events emission
- **7.5** Test batch transfer gas optimization scenarios
- **7.6** Test edge cases (empty arrays, single recipient, max recipients)

#### 8. GNUSControlStorage.sol (Currently 50% lines)

- **8.1** Test all storage slot initialization
- **8.2** Test storage read operations for control parameters
- **8.3** Test storage write operations with access control
- **8.4** Test storage state consistency

### Phase 3: Comprehensive Coverage (Target: 90%+ Overall Coverage)

#### 9. GNUSBridge.sol (Currently 73.68% lines)

- **9.1** Test uncovered branch conditions in bridge operations
- **9.2** Test bridge security checks that are currently uncovered
- **9.3** Test bridge error handling paths (lines 231-252)
- **9.4** Test edge cases in cross-chain messaging

#### 10. GNUSControl.sol (Currently 68% lines)

- **10.1** Test uncovered control functions (lines 139-148)
- **10.2** Test control parameter boundary conditions
- **10.3** Test control access restrictions
- **10.4** Test control state transitions

#### 11. GNUSNFTFactory.sol (Currently 77.97% lines)

- **11.1** Test uncovered NFT creation edge cases (lines 75, 81, 87, 141)
- **11.2** Test NFT factory boundary conditions
- **11.3** Test complex multi-NFT creation scenarios
- **11.4** Test NFT factory error recovery

#### 12. GeniusAccessControl.sol (Currently 63.64% lines)

- **12.1** Test uncovered role management functions (lines 47, 51, 62, 66)
- **12.2** Test role hierarchy and permissions
- **12.3** Test role revocation scenarios
- **12.4** Test access control edge cases

#### 13. DiamondInitFacet.sol (Currently 83.33% lines)

- **13.1** Test uncovered initialization paths (lines 34, 35)
- **13.2** Test re-initialization prevention
- **13.3** Test initialization with edge case parameters

### Technical Test Requirements

All tests must:

- **TR1**: Use the `LocalDiamondDeployer` pattern for Diamond contract deployment
- **TR2**: Utilize `loadDiamondContract` utility for contract instance loading
- **TR3**: Support `hardhat-multichain` provider structure (even if testing on single chain)
- **TR4**: Implement `before`, `beforeEach`, `after`, `afterEach` hooks with EVM snapshots
- **TR5**: Use `chai` and `chai-as-promised` for assertions
- **TR6**: Follow the existing test file structure and naming conventions
- **TR7**: Include descriptive test names that explain the scenario being tested
- **TR8**: Use `SignerWithAddress` from `@nomicfoundation/hardhat-ethers/signers`
- **TR9**: Test with multiple signers to validate access control
- **TR10**: Use helper functions like `toWei()`, `toBN()`, and constants like `GNUS_TOKEN_ID`

## Non-Goals (Out of Scope)

1. **Foundry/Forge Integration**: This PRD focuses on Hardhat tests only; Foundry fuzz tests are separate
2. **Multi-chain Testing**: While infrastructure supports it, tests will focus on single-chain scenarios
3. **Gas Optimization Testing**: Unless specifically related to coverage gaps
4. **Integration Tests**: Focus is on unit tests for individual functions
5. **Performance Testing**: Load and stress testing are out of scope
6. **Contract Refactoring**: Tests should be written for existing code structure
7. **New Feature Development**: Only testing existing functionality

## Design Considerations

### Test File Organization

- Create separate test files for each contract or logical grouping
- Follow naming convention: `[ContractName].test.ts`
- Place tests in `/test/unit/` directory
- Group related tests using nested `describe` blocks

### Test Structure Pattern

```typescript
describe('Contract Name Tests', function () {
    // Diamond deployment setup
    before(async function () {
        // LocalDiamondDeployer configuration
        // Load Diamond contract
        // Setup signers
    });

    // Snapshot management
    beforeEach/afterEach with EVM snapshots

    describe('Function Group', function () {
        it('should [expected behavior]', async () => {
            // Test implementation
        });
    });
});
```

### Code Coverage Analysis Tools

- Use `yarn coverage` to generate Istanbul coverage reports
- Review `coverage/index.html` for detailed line-by-line coverage
- Track uncovered lines from coverage reports
- Generate coverage reports after each phase

## Technical Considerations

### Diamond Proxy Architecture

- All contracts are facets of the GeniusDiamond proxy
- Tests must load the complete Diamond ABI to access all functions
- Function selectors must be unique across all facets
- Storage layout must follow Diamond storage pattern

### Multi-chain Provider Setup

- Tests use `hardhat-multichain` provider map
- Default to 'hardhat' network for coverage tests
- Provider setup required even for single-chain tests
- Snapshot functionality via provider's `send()` method

### TypeScript Type Safety

- Use generated TypeScript types from `diamond-typechain-types`
- Import `GeniusDiamond` type for full contract interface
- Maintain type safety for all contract interactions
- Use `SignerWithAddress` for signer typing

### Access Control Testing

- Test role-based access with `CREATOR_ROLE`, `ADMIN_ROLE`, etc.
- Use `utils.id('ROLE_NAME')` for role identifiers
- Test both authorized and unauthorized access scenarios
- Verify role granting and revocation

### Helper Utilities Required

- `toWei()`: Convert numbers to wei (BigInt with 18 decimals)
- `toBN()`: Convert to BigInt for large numbers
- `formatEther()`: Format wei to readable ether strings
- `loadDiamondContract()`: Load Diamond instance with full ABI
- `logEvents()`: Debug event emissions (optional)

## Success Metrics

### Coverage Metrics

- **Phase 1 Complete**: Overall coverage reaches 75%+ (Zero-coverage contracts at 80%+)
- **Phase 2 Complete**: Overall coverage reaches 85%+ (All contracts at 50%+)
- **Phase 3 Complete**: Overall coverage reaches 90%+ (Target achieved)
- **Statement Coverage**: >90%
- **Branch Coverage**: >85%
- **Function Coverage**: >90%
- **Line Coverage**: >90%

### Quality Metrics

- All tests pass consistently
- No flaky tests (inconsistent pass/fail)
- Test execution time remains reasonable (<5 minutes for full suite)
- Zero regression in existing test coverage
- All new tests follow established patterns

### Tracking Metrics

- Coverage reports generated after each phase
- Uncovered lines tracked in coverage reports
- Test file count increases systematically
- Documentation of test scenarios completed

## Implementation Plan

### Phase 1: Zero-Coverage Contracts (Week 1-2)

1. Analyze zero-coverage contracts to understand functionality
2. Create test files for each contract
3. Implement happy path tests
4. Implement major error condition tests
5. Run coverage report and verify 75%+ overall coverage
6. Review and refactor tests for consistency

### Phase 2: Low-Coverage Contracts (Week 3-4)

1. Analyze coverage gaps in <50% coverage contracts
2. Identify uncovered lines and branches
3. Create additional test cases targeting gaps
4. Implement tests following existing patterns
5. Run coverage report and verify 85%+ overall coverage
6. Review test quality and completeness

### Phase 3: Final Coverage Push (Week 5-6)

1. Analyze remaining coverage gaps across all contracts
2. Prioritize high-impact uncovered lines
3. Create targeted test cases for each gap
4. Address edge cases and complex scenarios
5. Run final coverage report and verify 90%+ overall coverage
6. Conduct comprehensive test suite review

### Continuous Activities

- Run `yarn coverage` after each test file creation
- Document test patterns and learnings
- Update this PRD with insights and adjustments
- Maintain test suite quality and consistency

## Open Questions

1. **Contract Analysis**: Need to analyze contracts with 0% coverage to understand their functionality before writing tests. Should this be done systematically or on-demand?

2. **Test Priorities**: Are there specific business-critical functions that should be prioritized even if their contracts have higher coverage?

3. **Coverage Tooling**: Should we integrate additional coverage analysis tools or is Istanbul sufficient?

4. **Test Documentation**: Should tests include additional inline documentation beyond descriptive test names?

5. **Regression Testing**: How should we ensure that improving coverage doesn't introduce regressions in existing functionality?

6. **External Dependencies**: Are there external contract dependencies (like TransferHelper with ERC20 tokens) that need mock implementations?

7. **Storage Testing**: GNUSControlStorage and GeniusAIStorage use Diamond storage pattern - do we need specific storage collision tests?

8. **Bridge Testing**: GNUSBridge has complex cross-chain logic - should we mock cross-chain calls or implement simplified scenarios?

9. **Access Control Matrix**: Should we create a comprehensive access control matrix documenting all roles and permissions for testing reference?

10. **Performance Benchmarks**: At what test count or execution time should we consider test suite optimization?

## Next Steps

1. **Contract Analysis Phase**: Analyze all contracts with <50% coverage to understand their functionality
2. **Test Template Creation**: Create test file templates following the NFTFactory.test.ts pattern
3. **Phase 1 Kickoff**: Begin implementing tests for zero-coverage contracts
4. **Coverage Baseline**: Document current coverage as baseline for progress tracking
5. **Review Cycle**: Establish review process for new tests before merging

---

**Document Version**: 1.0  
**Created**: December 31, 2025  
**Target Completion**: February 2026 (6-week phased approach)  
**Success Criteria**: >90% test coverage with all tests passing
