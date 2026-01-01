# Task List: Solidity Test Coverage Improvement to 90%+

## Relevant Files

### Contracts Under Test (Zero Coverage - Phase 1)
- `contracts/gnus-ai/GNUSContractAssets.sol` - Contract asset management functionality (0% coverage)
- `contracts/gnus-ai/GeniusAI.sol` - AI-related functionality (0% coverage)
- `contracts/gnus-ai/GeniusAIStorage.sol` - Storage for AI-related data (0% coverage)
- `contracts/gnus-ai/GeniusOwnershipFacet.sol` - Ownership management for Diamond proxy (12.5% coverage)
- `contracts/gnus-ai/libraries/TransferHelper.sol` - Safe ERC20 transfer utilities (0% coverage)

### Test Files to Create (Phase 1)
- `test/unit/GNUSContractAssets.test.ts` - Unit tests for contract asset management
- `test/unit/GeniusAI.test.ts` - Unit tests for AI functionality
- `test/unit/GeniusAIStorage.test.ts` - Unit tests for AI storage
- `test/unit/GeniusOwnershipFacet.test.ts` - Unit tests for ownership management
- `test/unit/TransferHelper.test.ts` - Unit tests for transfer helper library

### Contracts Under Test (Low Coverage - Phase 2)
- `contracts/gnus-ai/ERC1155ProxyOperator.sol` - Proxy operator for ERC1155 (20% coverage)
- `contracts/gnus-ai/ERC20TransferBatch.sol` - Batch ERC20 transfers (47.73% coverage)
- `contracts/gnus-ai/GNUSControlStorage.sol` - Storage for control parameters (50% coverage)

### Test Files to Create (Phase 2)
- `test/unit/ERC1155ProxyOperator.test.ts` - Unit tests for proxy operator
- `test/unit/ERC20TransferBatch.test.ts` - Unit tests for batch transfers
- `test/unit/GNUSControlStorage.test.ts` - Unit tests for control storage

### Contracts to Improve (Phase 3)
- `contracts/gnus-ai/GNUSBridge.sol` - Bridge functionality (73.68% coverage - needs improvement)
- `contracts/gnus-ai/GNUSControl.sol` - Control functions (68% coverage - needs improvement)
- `contracts/gnus-ai/GNUSNFTFactory.sol` - NFT factory (77.97% coverage - needs improvement)
- `contracts/gnus-ai/GeniusAccessControl.sol` - Access control (63.64% coverage - needs improvement)
- `contracts/gnus-ai/DiamondInitFacet.sol` - Initialization (83.33% coverage - needs improvement)

### Test Files to Enhance (Phase 3)
- `test/unit/GNUSBridge.test.ts` - Enhanced tests for bridge (may need to create if doesn't exist)
- `test/unit/GNUSControl.test.ts` - Enhanced tests for control functions
- `test/unit/NFTFactory.test.ts` - Enhanced tests for NFT factory (already exists, needs additions)
- `test/unit/GeniusAccessControl.test.ts` - Enhanced tests for access control
- `test/unit/DiamondInitFacet.test.ts` - Enhanced tests for initialization

### Supporting Files
- `scripts/utils/loadDiamondArtifact.ts` - Utility for loading Diamond contracts (already exists)
- `scripts/utils/helpers.ts` - Helper utilities including `toWei()`, `toBN()` (already exists)
- `scripts/common.ts` - Common constants like `GNUS_TOKEN_ID` (already exists)
- `diamonds/GeniusDiamond/geniusdiamond.config.json` - Diamond configuration (already exists)

### Notes

- All tests must use the `LocalDiamondDeployer` pattern from `@diamondslab/hardhat-diamonds`
- Tests must support `hardhat-multichain` provider structure
- Use `loadDiamondContract` utility to load Diamond instances
- Follow the pattern established in `test/unit/NFTFactory.test.ts`
- Run coverage with `yarn coverage`
- Review coverage reports at `coverage/index.html` after each phase

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch (e.g., `git checkout -b feature/test-coverage-improvement`)

- [x] 1.0 Analyze existing contracts and prepare test infrastructure
  - [x] 1.1 Run baseline coverage report with `yarn coverage` and document current state
  - [x] 1.2 Review existing test file `test/unit/NFTFactory.test.ts` to understand the test pattern
  - [x] 1.3 Verify `LocalDiamondDeployer` and `loadDiamondContract` utilities are working correctly
  - [x] 1.4 Create a test template file based on NFTFactory.test.ts pattern for reuse
  - [x] 1.5 Read and analyze zero-coverage contracts to understand their functionality:
    - [x] 1.5.1 Read `contracts/gnus-ai/GNUSContractAssets.sol`
    - [x] 1.5.2 Read `contracts/gnus-ai/GeniusAI.sol`
    - [x] 1.5.3 Read `contracts/gnus-ai/GeniusAIStorage.sol`
    - [x] 1.5.4 Read `contracts/gnus-ai/GeniusOwnershipFacet.sol`
    - [x] 1.5.5 Read `contracts/gnus-ai/libraries/TransferHelper.sol`

- [ ] 2.0 Phase 1: Implement tests for zero-coverage contracts (Target: 75% overall coverage)
  - [x] 2.1 GNUSContractAssets.sol tests
    - [x] 2.1.1 Create `test/unit/GNUSContractAssets.test.ts` with Diamond deployment setup
    - [x] 2.1.2 Implement test for `withdrawToken()` access control (super admin and non-admin)
    - [x] 2.1.3 Implement test for `withdrawToken()` GNUS token protection
    - [x] 2.1.4 Implement test for `withdrawToken()` ERC20 token withdrawal (full amount)
    - [x] 2.1.5 Implement test for `withdrawToken()` ERC20 token withdrawal (partial amount)
    - [x] 2.1.6 Implement test for `withdrawToken()` ETH withdrawal (single transaction)
    - [x] 2.1.7 Implement test for `withdrawToken()` ETH withdrawal (multiple transactions)
    - [x] 2.1.8 Implement test for WithdrawToken event emission
    - [x] 2.1.9 Run tests and verify they pass: `npx hardhat test test/unit/GNUSContractAssets.test.ts`
    - [x] 2.1.10 Commit: Task 2.1 completed with 8 passing tests
  - [x] 2.2 GeniusAI.sol tests
    - [x] 2.2.1 Create `test/unit/GeniusAI.test.ts` with Diamond deployment setup
    - [x] 2.2.2 Implement test for GeniusAI_Initialize() function
    - [x] 2.2.3 Implement test for OpenEscrow() with various msg.value amounts
    - [x] 2.2.4 Implement test for multiple escrows per address
    - [x] 2.2.5 Implement test for escrow storage and ID incrementing
    - [x] 2.2.6 Implement test for contract balance verification
    - [x] 2.2.7 Implement test for UUID handling (empty, max, shared)
    - [x] 2.2.8 Run tests and verify they pass: `npx hardhat test test/unit/GeniusAI.test.ts`
    - [x] 2.2.9 Commit: Task 2.2 completed with 14 passing tests
  - [x] 2.3 GeniusAIStorage.sol tests
    - [x] 2.3.1 Create `test/unit/GeniusAIStorage.test.ts` with Diamond deployment setup
    - [x] 2.3.2 Implement test for storage initialization for new addresses
    - [x] 2.3.3 Implement test for storage read/write operations and persistence
    - [x] 2.3.4 Implement test for storage isolation between users
    - [x] 2.3.5 Implement test for storage state persistence across blocks/snapshots
    - [x] 2.3.6 Implement test for Diamond storage pattern and no collisions
    - [x] 2.3.7 Run tests and verify they pass: `npx hardhat test test/unit/GeniusAIStorage.test.ts`
    - [x] 2.3.8 Commit: Task 2.3 completed with 15 passing tests
  - [x] 2.4 GeniusOwnershipFacet.sol tests
    - [x] 2.4.1 Create `test/unit/GeniusOwnershipFacet.test.ts` with Diamond deployment setup
    - [x] 2.4.2 Implement test for `transferOwnership()` with valid new owner
    - [x] 2.4.3 Implement test for `transferOwnership()` rejects non-owner callers
    - [x] 2.4.4 Implement test for ownership transfer event emission
    - [x] 2.4.5 Implement test for role grants/revocations during transfer
    - [x] 2.4.6 Implement test for owner() verification function
    - [x] 2.4.7 Run tests and verify they pass: `npx hardhat test test/unit/GeniusOwnershipFacet.test.ts`
    - [x] 2.4.8 Commit: Task 2.4 completed with 19 passing tests
  - [ ] 2.5 TransferHelper.sol tests
    - [ ] 2.5.1 Create `test/unit/TransferHelper.test.ts` with Diamond deployment setup
    - [ ] 2.5.2 Deploy mock ERC20 token for testing transfer helper
    - [ ] 2.5.3 Implement test for safe ERC20 transfer functionality
    - [ ] 2.5.4 Implement test for safe ERC20 transferFrom functionality
    - [ ] 2.5.5 Implement test for safe ERC20 approve functionality
    - [ ] 2.5.6 Implement test for handling of non-compliant ERC20 tokens
    - [ ] 2.5.7 Implement test for revert conditions for failed transfers
    - [ ] 2.5.8 Run tests and verify they pass: `npx hardhat test test/unit/TransferHelper.test.ts`
  - [ ] 2.6 Run coverage report after Phase 1: `yarn coverage`
  - [ ] 2.7 Verify overall coverage is at least 75%, document results

- [ ] 3.0 Phase 2: Implement tests for low-coverage contracts (Target: 85% overall coverage)
  - [ ] 3.1 Analyze low-coverage contracts:
    - [ ] 3.1.1 Read `contracts/gnus-ai/ERC1155ProxyOperator.sol` and identify uncovered lines
    - [ ] 3.1.2 Read `contracts/gnus-ai/ERC20TransferBatch.sol` and identify uncovered lines
    - [ ] 3.1.3 Read `contracts/gnus-ai/GNUSControlStorage.sol` and identify uncovered lines
  - [ ] 3.2 ERC1155ProxyOperator.sol tests
    - [ ] 3.2.1 Create `test/unit/ERC1155ProxyOperator.test.ts` with Diamond deployment setup
    - [ ] 3.2.2 Implement test for proxy operator approval functionality
    - [ ] 3.2.3 Implement test for proxy operator transfer operations
    - [ ] 3.2.4 Implement test for proxy operator access control
    - [ ] 3.2.5 Implement test for proxy operator revocation
    - [ ] 3.2.6 Implement test for batch operations via proxy
    - [ ] 3.2.7 Run tests and verify they pass: `npx hardhat test test/unit/ERC1155ProxyOperator.test.ts`
  - [ ] 3.3 ERC20TransferBatch.sol tests
    - [ ] 3.3.1 Create `test/unit/ERC20TransferBatch.test.ts` with Diamond deployment setup
    - [ ] 3.3.2 Implement test for batch transfer with multiple recipients
    - [ ] 3.3.3 Implement test for batch transfer with insufficient balance
    - [ ] 3.3.4 Implement test for batch transfer with mismatched array lengths
    - [ ] 3.3.5 Implement test for batch transfer events emission
    - [ ] 3.3.6 Implement test for batch transfer gas optimization scenarios
    - [ ] 3.3.7 Implement test for edge cases (empty arrays, single recipient, max recipients)
    - [ ] 3.3.8 Run tests and verify they pass: `npx hardhat test test/unit/ERC20TransferBatch.test.ts`
  - [ ] 3.4 GNUSControlStorage.sol tests
    - [ ] 3.4.1 Create `test/unit/GNUSControlStorage.test.ts` with Diamond deployment setup
    - [ ] 3.4.2 Implement test for all storage slot initialization
    - [ ] 3.4.3 Implement test for storage read operations for control parameters
    - [ ] 3.4.4 Implement test for storage write operations with access control
    - [ ] 3.4.5 Implement test for storage state consistency
    - [ ] 3.4.6 Run tests and verify they pass: `npx hardhat test test/unit/GNUSControlStorage.test.ts`
  - [ ] 3.5 Run coverage report after Phase 2: `yarn coverage`
  - [ ] 3.6 Verify overall coverage is at least 85%, document results

- [ ] 4.0 Phase 3: Implement tests for comprehensive coverage (Target: 90%+ overall coverage)
  - [ ] 4.1 Analyze coverage gaps in higher-coverage contracts:
    - [ ] 4.1.1 Review coverage report for `GNUSBridge.sol` and identify uncovered lines (231-252)
    - [ ] 4.1.2 Review coverage report for `GNUSControl.sol` and identify uncovered lines (139-148)
    - [ ] 4.1.3 Review coverage report for `GNUSNFTFactory.sol` and identify uncovered lines (75, 81, 87, 141)
    - [ ] 4.1.4 Review coverage report for `GeniusAccessControl.sol` and identify uncovered lines (47, 51, 62, 66)
    - [ ] 4.1.5 Review coverage report for `DiamondInitFacet.sol` and identify uncovered lines (34, 35)
  - [ ] 4.2 GNUSBridge.sol additional tests
    - [ ] 4.2.1 Check if `test/unit/GNUSBridge.test.ts` exists, create if needed
    - [ ] 4.2.2 Implement test for uncovered branch conditions in bridge operations
    - [ ] 4.2.3 Implement test for bridge security checks that are currently uncovered
    - [ ] 4.2.4 Implement test for bridge error handling paths (lines 231-252)
    - [ ] 4.2.5 Implement test for edge cases in cross-chain messaging
    - [ ] 4.2.6 Run tests and verify they pass: `npx hardhat test test/unit/GNUSBridge.test.ts`
  - [ ] 4.3 GNUSControl.sol additional tests
    - [ ] 4.3.1 Check if `test/unit/GNUSControl.test.ts` exists, create if needed
    - [ ] 4.3.2 Implement test for uncovered control functions (lines 139-148)
    - [ ] 4.3.3 Implement test for control parameter boundary conditions
    - [ ] 4.3.4 Implement test for control access restrictions
    - [ ] 4.3.5 Implement test for control state transitions
    - [ ] 4.3.6 Run tests and verify they pass: `npx hardhat test test/unit/GNUSControl.test.ts`
  - [ ] 4.4 GNUSNFTFactory.sol additional tests (enhance existing NFTFactory.test.ts)
    - [ ] 4.4.1 Review existing `test/unit/NFTFactory.test.ts` to understand current coverage
    - [ ] 4.4.2 Add test for uncovered NFT creation edge cases (lines 75, 81, 87, 141)
    - [ ] 4.4.3 Add test for NFT factory boundary conditions
    - [ ] 4.4.4 Add test for complex multi-NFT creation scenarios
    - [ ] 4.4.5 Add test for NFT factory error recovery
    - [ ] 4.4.6 Run tests and verify they pass: `npx hardhat test test/unit/NFTFactory.test.ts`
  - [ ] 4.5 GeniusAccessControl.sol additional tests
    - [ ] 4.5.1 Check if `test/unit/GeniusAccessControl.test.ts` exists, create if needed
    - [ ] 4.5.2 Implement test for uncovered role management functions (lines 47, 51, 62, 66)
    - [ ] 4.5.3 Implement test for role hierarchy and permissions
    - [ ] 4.5.4 Implement test for role revocation scenarios
    - [ ] 4.5.5 Implement test for access control edge cases
    - [ ] 4.5.6 Run tests and verify they pass: `npx hardhat test test/unit/GeniusAccessControl.test.ts`
  - [ ] 4.6 DiamondInitFacet.sol additional tests
    - [ ] 4.6.1 Check if `test/unit/DiamondInitFacet.test.ts` exists, create if needed
    - [ ] 4.6.2 Implement test for uncovered initialization paths (lines 34, 35)
    - [ ] 4.6.3 Implement test for re-initialization prevention
    - [ ] 4.6.4 Implement test for initialization with edge case parameters
    - [ ] 4.6.5 Run tests and verify they pass: `npx hardhat test test/unit/DiamondInitFacet.test.ts`
  - [ ] 4.7 Run coverage report after Phase 3: `yarn coverage`
  - [ ] 4.8 Verify overall coverage is at least 90%, document results

- [ ] 5.0 Final validation and documentation
  - [ ] 5.1 Run full test suite to ensure all tests pass: `npx hardhat test`
  - [ ] 5.2 Run final coverage report: `yarn coverage`
  - [ ] 5.3 Review coverage report at `coverage/index.html` and verify all targets met:
    - [ ] 5.3.1 Verify Statement Coverage >90%
    - [ ] 5.3.2 Verify Branch Coverage >85%
    - [ ] 5.3.3 Verify Function Coverage >90%
    - [ ] 5.3.4 Verify Line Coverage >90%
  - [ ] 5.4 Document final coverage metrics in PRD or create summary document
  - [ ] 5.5 Review all test files for code quality and consistency
  - [ ] 5.6 Ensure all tests follow the established patterns (Diamond deployment, snapshots, etc.)
  - [ ] 5.7 Create pull request with comprehensive description of coverage improvements
  - [ ] 5.8 Update project documentation with new test coverage information
