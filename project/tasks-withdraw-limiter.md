# Tasks: GNUS.AI Withdraw Limiter Implementation

## Relevant Files

- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` - Diamond storage library for limiter configuration and bin-based withdrawal tracking
- `contracts/gnus-ai/GNUSWithdrawLimiter.sol` - Facet implementing limiter logic and administrative functions
- `contracts/gnus-ai/GNUSBridge.sol` - Modified to integrate limiter checks into withdraw() function
- `contracts/gnus-ai/ERC20TransferBatch.sol` - Modified to integrate limiter checks into _transferBatch() to prevent Sybil attacks
- `contracts/gnus-ai/GNUSERC1155MaxSupply.sol` - Modified to integrate limiter checks into _beforeTokenTransfer() hook
- `contracts/gnus-ai/DiamondInitFacet.sol` - Modified to add initializeGNUSWithdrawLimiter() function
- `diamonds/GeniusDiamond/geniusdiamond.config.json` - Diamond configuration with GNUSWithdrawLimiter facet entry
- `test/unit/GNUSWithdrawLimiter.test.ts` - Hardhat unit tests for limiter configuration and bin calculations
- `test/integration/withdraw-limiter-integration.test.ts` - Integration tests across all three integration points
- `test/foundry/GNUSWithdrawLimiterFuzz.t.sol` - Foundry fuzz tests for bin mathematics and edge cases
- `test/foundry/GNUSWithdrawLimiterSybilAttack.t.sol` - Foundry tests for Sybil attack prevention scenarios
- `docs/GNUSWithdrawLimiter.md` - API documentation for the withdraw limiter facet

### Notes

- This implementation follows Test-Driven Development (TDD) methodology - write tests before implementation code
- Minimum 95% code coverage required as specified in PRD FR-62
- Use `yarn test test/unit/GNUSWithdrawLimiter.test.ts` for Hardhat tests
- Use `yarn forge:test` for Foundry tests, `yarn forge:fuzz` for fuzz tests with 256 runs
- After modifying facets, always run `yarn clean-compile` to regenerate Diamond ABIs and TypeChain types
- Follow the bin-based aggregation design: fixed-size arrays with modulo wrap-around for O(binCount) complexity

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [ ] 0.0 Feature branch already created (feature/47-withdrawal-throttle-for-gnus-ai-contracts)

- [ ] 1.0 Create GNUSWithdrawLimiterStorage.sol with Diamond storage pattern
  - [ ] 1.1 Create file `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` with SPDX and pragma
  - [ ] 1.2 Define `WithdrawBin` struct with `uint128 timestamp` and `uint128 totalAmount` (FR-2)
  - [ ] 1.3 Define `AccountConfig` struct with `uint32 binCount`, `uint64 windowSeconds`, `uint256 limitAmount` (FR-10)
  - [ ] 1.4 Define `AccountState` struct with `uint128 baseTimestamp` and `WithdrawBin[] bins` (FR-4, FR-26)
  - [ ] 1.5 Define `Layout` struct with mappings and default values (accountStates, accountConfigs, defaults, limiterEnabled)
  - [ ] 1.6 Implement storage position constant using `keccak256("gnus.ai.withdraw.limiter.storage")` (FR-35)
  - [ ] 1.7 Implement `layout()` internal pure function returning storage reference
  - [ ] 1.8 Implement `getAccountConfigOrDefaults(address)` internal view returning effective config with zero-fallback logic (FR-12)
  - [ ] 1.9 Implement `calculateCurrentBin(address, uint256, AccountConfig)` internal view calculating bin index using formula: `((currentTime - baseTimestamp) / binLengthSeconds) % binCount` (FR-55)
  - [ ] 1.10 Implement `zeroExpiredBins(address, uint256, AccountConfig)` internal function for lazy cleanup (FR-27, FR-28)
  - [ ] 1.11 Implement `sumActiveBins(address, uint256, AccountConfig)` internal view returning total active withdrawals (FR-7)
  - [ ] 1.12 Implement `checkAndRecordWithdraw(address, uint256)` internal function with core validation logic: check enabled, get config, zero expired bins, sum bins, validate limit, update current bin (FR-1 to FR-9)
  - [ ] 1.13 Add import statements for GeniusAccessControl and necessary OpenZeppelin libraries

- [ ] 2.0 Create GNUSWithdrawLimiter.sol facet with administrative functions
  - [ ] 2.1 Create file `contracts/gnus-ai/GNUSWithdrawLimiter.sol` extending GeniusAccessControl
  - [ ] 2.2 Import GNUSWithdrawLimiterStorage library
  - [ ] 2.3 Define events: `WithdrawLimiterConfigUpdated`, `AccountConfigUpdated`, `WithdrawLimiterTriggered`, `WithdrawRecorded` (FR-47 to FR-50)
  - [ ] 2.4 Implement `setDefaultLimitAmount(uint256)` external onlySuperAdminRole with event emission (FR-19)
  - [ ] 2.5 Implement `setDefaultWindowSeconds(uint256)` external onlySuperAdminRole with event emission (FR-19)
  - [ ] 2.6 Implement `setDefaultBinCount(uint256)` external onlySuperAdminRole with validation (must be > 0) (FR-19)
  - [ ] 2.7 Implement `setAccountConfig(address, uint32, uint64, uint256)` external onlySuperAdminRole with event emission (FR-11, FR-20)
  - [ ] 2.8 Implement `setLimiterEnabled(bool)` external onlySuperAdminRole with event emission (FR-17)
  - [ ] 2.9 Implement `getWithdrawLimiterConfig()` external view returning default config tuple (FR-13)
  - [ ] 2.10 Implement `getAccountConfig(address)` external view returning effective config (custom or defaults) (FR-13)
  - [ ] 2.11 Implement `getAccountWithdrawStatus(address)` external view returning current usage, remaining capacity, and window end timestamp (FR-14)
  - [ ] 2.12 Implement `supportsInterface(bytes4)` override for ERC-165 compatibility
  - [ ] 2.13 Add NatSpec documentation for all public/external functions

- [ ] 3.0 Integrate limiter into GNUSBridge.sol withdraw() function
  - [ ] 3.1 Read current `GNUSBridge.sol` withdraw() function implementation
  - [ ] 3.2 Import GNUSWithdrawLimiterStorage at top of file
  - [ ] 3.3 Add limiter check after amount validation, before _burn(): calculate gnusAmount from exchange rate (FR-33)
  - [ ] 3.4 Add super admin bypass: only call limiter if `!hasRole(SUPER_ADMIN_ROLE, sender)` (FR-18)
  - [ ] 3.5 Call `GNUSWithdrawLimiterStorage.layout().checkAndRecordWithdraw(sender, gnusAmount)` (FR-31, FR-32, FR-36)
  - [ ] 3.6 Verify limiter check occurs BEFORE _burn() operation (FR-32)
  - [ ] 3.7 Add error message for limiter trigger: "Withdrawal limit exceeded for time window"

- [ ] 4.0 Integrate limiter into ERC20TransferBatch.sol for Sybil attack prevention
  - [ ] 4.1 Read current `ERC20TransferBatch.sol` _transferBatch() function implementation
  - [ ] 4.2 Import GNUSWithdrawLimiterStorage at top of file
  - [ ] 4.3 Add limiter check at start of _transferBatch(), after parameter validation (FR-39)
  - [ ] 4.4 Implement super admin bypass: `if (!hasRole(SUPER_ADMIN_ROLE, operator))` (FR-40)
  - [ ] 4.5 Aggregate total amount across all destinations in loop: `totalAmount += amounts[i]` (FR-38)
  - [ ] 4.6 Call `GNUSWithdrawLimiterStorage.layout().checkAndRecordWithdraw(operator, totalAmount)` with aggregated amount (FR-37)
  - [ ] 4.7 Verify this integration covers both `transferBatch()` and `transferOrBurnBatch()` (FR-45)
  - [ ] 4.8 Add error message for Sybil attack prevention: "Batch transfer exceeds withdrawal limit"

- [ ] 5.0 Integrate limiter into GNUSERC1155MaxSupply.sol transfer hook
  - [ ] 5.1 Read current `GNUSERC1155MaxSupply.sol` _beforeTokenTransfer() hook implementation
  - [ ] 5.2 Import GNUSWithdrawLimiterStorage and GNUSConstants (for GNUS_TOKEN_ID)
  - [ ] 5.3 Add limiter check after super._beforeTokenTransfer() call in _beforeTokenTransfer() hook (FR-41)
  - [ ] 5.4 Add condition checks: skip if from==0 (minting) or to==0 (burning) (FR-43, FR-44)
  - [ ] 5.5 Add super admin bypass: `!hasRole(SUPER_ADMIN_ROLE, operator)` (FR-40)
  - [ ] 5.6 Loop through ids array and accumulate amounts where `ids[i] == GNUS_TOKEN_ID` (FR-42, FR-46)
  - [ ] 5.7 Call `GNUSWithdrawLimiterStorage.layout().checkAndRecordWithdraw(from, totalGnusAmount)` if totalGnusAmount > 0 (FR-41)
  - [ ] 5.8 Add error message: "ERC1155 transfer exceeds withdrawal limit"

- [ ] 6.0 Add initialization function to DiamondInitFacet.sol
  - [ ] 6.1 Read current `DiamondInitFacet.sol` to understand initialization pattern
  - [ ] 6.2 Import GNUSWithdrawLimiterStorage
  - [ ] 6.3 Create `initializeGNUSWithdrawLimiter()` internal function (FR-22)
  - [ ] 6.4 Set `defaultLimitAmount = 100_000 * 10**18` (100,000 GNUS tokens) (FR-24)
  - [ ] 6.5 Set `defaultWindowSeconds = 86400` (1 day) (FR-24)
  - [ ] 6.6 Set `defaultBinCount = 24` (hourly bins) (FR-24)
  - [ ] 6.7 Set `limiterEnabled = true` (FR-24)
  - [ ] 6.8 Add call to `initializeGNUSWithdrawLimiter()` in appropriate protocol initializer function (e.g., diamondInitialize250) (FR-23)
  - [ ] 6.9 Add NatSpec documentation explaining initialization parameters

- [ ] 7.0 Configure Diamond with GNUSWithdrawLimiter facet
  - [ ] 7.1 Open `diamonds/GeniusDiamond/geniusdiamond.config.json`
  - [ ] 7.2 Add new entry for GNUSWithdrawLimiter with priority 115 (after GNUSBridge at 110)
  - [ ] 7.3 Set version to "0.0" for initial implementation
  - [ ] 7.4 No deployInit or upgradeInit needed (initialization via DiamondInitFacet)
  - [ ] 7.5 Run `yarn clean-compile` to regenerate Diamond ABI and TypeChain types
  - [ ] 7.6 Verify Diamond ABI includes all GNUSWithdrawLimiter functions in `diamond-abi/GeniusDiamond.json`
  - [ ] 7.7 Verify TypeChain types generated in `diamond-typechain-types/GeniusDiamond.ts`

- [ ] 8.0 Implement comprehensive test suite (TDD approach - write tests FIRST before implementation)
  - [ ] 8.1 Create `test/unit/GNUSWithdrawLimiter.test.ts` Hardhat test file
  - [ ] 8.2 Write test: "should initialize with correct default values" (FR-24)
  - [ ] 8.3 Write test: "should allow super admin to set default limit amount" (FR-19)
  - [ ] 8.4 Write test: "should allow super admin to set default window seconds" (FR-19)
  - [ ] 8.5 Write test: "should allow super admin to set default bin count" (FR-19)
  - [ ] 8.6 Write test: "should allow super admin to set per-account config" (FR-11, FR-20)
  - [ ] 8.7 Write test: "should use default values when account config is zero" (FR-12)
  - [ ] 8.8 Write test: "should calculate bin index correctly using modulo arithmetic" (FR-55)
  - [ ] 8.9 Write test: "should handle bin wrap-around at array boundary" (FR-30)
  - [ ] 8.10 Write test: "should initialize baseTimestamp on first withdrawal" (FR-4, FR-56)
  - [ ] 8.11 Write test: "should accumulate withdrawals in current bin" (FR-6)
  - [ ] 8.12 Write test: "should sum only active bins within window" (FR-7)
  - [ ] 8.13 Write test: "should zero expired bins during validation" (FR-8, FR-27, FR-28, FR-57)
  - [ ] 8.14 Write test: "should revert when withdrawal exceeds limit" (FR-9, FR-41)
  - [ ] 8.15 Write test: "should allow super admin to bypass limiter" (FR-18)
  - [ ] 8.16 Write test: "should allow super admin to enable/disable limiter globally" (FR-17)
  - [ ] 8.17 Write test: "should return correct account withdrawal status" (FR-14)
  - [ ] 8.18 Write test: "should emit WithdrawLimiterTriggered event on block" (FR-47)
  - [ ] 8.19 Write test: "should emit WithdrawRecorded event on success" (FR-48)
  - [ ] 8.20 Write test: "should emit config update events" (FR-49, FR-50)
  - [ ] 8.21 Create `test/integration/withdraw-limiter-integration.test.ts` for cross-facet tests
  - [ ] 8.22 Write integration test: "GNUSBridge.withdraw() triggers limiter" (FR-31, FR-69)
  - [ ] 8.23 Write integration test: "GNUSBridge.withdraw() calculates GNUS amount from exchange rate" (FR-33)
  - [ ] 8.24 Write integration test: "ERC20TransferBatch.transferBatch() aggregates amounts and triggers limiter" (FR-37, FR-38, FR-69)
  - [ ] 8.25 Write integration test: "ERC20TransferBatch.transferOrBurnBatch() triggers limiter" (FR-45)
  - [ ] 8.26 Write integration test: "GNUSERC1155MaxSupply transfer hook filters GNUS_TOKEN_ID" (FR-42, FR-46, FR-69, FR-70)
  - [ ] 8.27 Write integration test: "Transfer hook skips minting and burning operations" (FR-43, FR-44)
  - [ ] 8.28 Create `test/foundry/GNUSWithdrawLimiterFuzz.t.sol` extending GeniusDiamondTestBase
  - [ ] 8.29 Write fuzz test: "bin index calculation with random timestamps and configs" (FR-55)
  - [ ] 8.30 Write fuzz test: "bin wrap-around with random bin counts" (FR-30)
  - [ ] 8.31 Write fuzz test: "withdrawal amounts near limit boundaries" (FR-9)
  - [ ] 8.32 Write fuzz test: "multiple sequential withdrawals over time" (FR-6, FR-7)
  - [ ] 8.33 Write fuzz test: "expired bin cleanup with various time gaps" (FR-28)
  - [ ] 8.34 Create `test/foundry/GNUSWithdrawLimiterSybilAttack.t.sol` for security tests
  - [ ] 8.35 Write Sybil test: "cannot bypass limit by distributing to multiple accounts via transferBatch" (FR-67, FR-68)
  - [ ] 8.36 Write Sybil test: "batch transfer aggregation prevents N×limit extraction" (FR-38, FR-67)
  - [ ] 8.37 Write Sybil test: "mixed-token batch only counts GNUS tokens" (FR-46, FR-70)
  - [ ] 8.38 Run all unit tests: `yarn test test/unit/GNUSWithdrawLimiter.test.ts --chains sepolia,polygon_amoy`
  - [ ] 8.39 Run all integration tests: `yarn test test/integration/withdraw-limiter-integration.test.ts --chains sepolia`
  - [ ] 8.40 Run Foundry fuzz tests: `yarn forge:fuzz` (256 runs minimum)
  - [ ] 8.41 Generate coverage report: `yarn coverage` and verify ≥95% coverage (FR-62)
  - [ ] 8.42 Run gas benchmarks for bin operations and batch transfers, verify ~30k overhead (FR-71)
  - [ ] 8.43 Fix any failing tests or coverage gaps until all pass

- [ ] 9.0 Generate API documentation
  - [ ] 9.1 Create `docs/GNUSWithdrawLimiter.md` file
  - [ ] 9.2 Document purpose and security scope (all GNUS transfer paths)
  - [ ] 9.3 Document bin-based aggregation design and benefits
  - [ ] 9.4 Document all public/external functions with parameters, return values, access control, and events
  - [ ] 9.5 Document storage structures (WithdrawBin, AccountConfig, AccountState, Layout)
  - [ ] 9.6 Document bin calculation mathematics with examples (FR-54, FR-55, FR-56, FR-57)
  - [ ] 9.7 Document Sybil attack prevention strategy and integration points
  - [ ] 9.8 Document configuration parameters and default values
  - [ ] 9.9 Document example configurations for different use cases (daily, weekly, high-frequency)
  - [ ] 9.10 Document integration guide for each of the three integration points
  - [ ] 9.11 Document security considerations and super admin bypass
  - [ ] 9.12 Add usage examples with code snippets
  - [ ] 9.13 Document gas optimization benefits (76% storage reduction vs individual records)
  - [ ] 9.14 Document testing approach and coverage achieved
