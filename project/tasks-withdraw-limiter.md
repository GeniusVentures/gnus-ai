# Tasks: GNUS.AI Withdraw Limiter Implementation

## Relevant Files

- `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` - ✅ COMPLETE - Diamond storage library with bin-based withdrawal tracking (Task 1.0)
- `test/unit/GNUSWithdrawLimiterStorage.test.ts` - ✅ COMPLETE - Unit tests for storage functions (9 tests, Task 1.0)
- `contracts/gnus-ai/GNUSWithdrawLimiter.sol` - ✅ COMPLETE - Facet with administrative functions (Task 2.0)
- `test/unit/GNUSWithdrawLimiter.test.ts` - ✅ COMPLETE - Unit tests for facet (10 tests, Task 2.0)
- `contracts/gnus-ai/DiamondInitFacet.sol` - ✅ COMPLETE - Initialization with defaults (Task 2.0)
- `diamonds/GeniusDiamond/geniusdiamond.config.json` - ✅ COMPLETE - Diamond configuration with priority 115 (Task 2.0, partial Task 7.0)
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

- This implementation follows Test-Driven Development (TDD) methodology - write tests FIRST, then implement code to pass tests
- Each major task follows RED-GREEN-REFACTOR cycle: write failing test → implement code → refactor
- Minimum 95% code coverage required as specified in PRD FR-62
- Use `yarn test test/unit/GNUSWithdrawLimiter.test.ts` for Hardhat tests
- Use `yarn forge:test` for Foundry tests, `yarn forge:fuzz` for fuzz tests with 256 runs
- After modifying facets, always run `yarn clean-compile` to regenerate Diamond ABIs and TypeChain types
- Follow the bin-based aggregation design: fixed-size arrays with modulo wrap-around for O(binCount) complexity
- Mark each sub-task complete immediately after finishing it
- Run tests and commit after completing all sub-tasks in a parent task

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Feature branch already created (feature/47-withdrawal-throttle-for-gnus-ai-contracts)

- [x] 1.0 Create GNUSWithdrawLimiterStorage.sol with Diamond storage pattern (TDD)
  - [x] 1.1 Create test file `test/unit/GNUSWithdrawLimiterStorage.test.ts` with test setup
  - [x] 1.2 Write test: "should calculate bin length correctly" (windowSeconds / binCount)
  - [x] 1.3 Write test: "should calculate bin index using modulo arithmetic" (FR-55)
  - [x] 1.4 Write test: "should handle bin wrap-around at array boundary" (FR-30)
  - [x] 1.5 Write test: "should initialize baseTimestamp on first withdrawal" (FR-4, FR-56)
  - [x] 1.6 Write test: "should zero expired bins during validation" (FR-28, FR-57)
  - [x] 1.7 Write test: "should sum only active bins within window" (FR-7)
  - [x] 1.8 Write test: "should accumulate withdrawals in current bin" (FR-6)
  - [x] 1.9 Write test: "should revert when withdrawal exceeds limit" (FR-9)
  - [x] 1.10 Write test: "should use default config when account config is zero" (FR-12)
  - [x] 1.11 Create file `contracts/gnus-ai/GNUSWithdrawLimiterStorage.sol` with SPDX and pragma
  - [x] 1.12 Define `WithdrawBin` struct with `uint128 timestamp` and `uint128 totalAmount` (FR-2)
  - [x] 1.13 Define `AccountConfig` struct with `uint32 binCount`, `uint64 windowSeconds`, `uint256 limitAmount` (FR-10)
  - [x] 1.14 Define `AccountState` struct with `uint128 baseTimestamp` and `WithdrawBin[] bins` (FR-4, FR-26)
  - [x] 1.15 Define `Layout` struct with mappings and default values (accountStates, accountConfigs, defaults, limiterEnabled)
  - [x] 1.16 Implement storage position constant using `keccak256("gnus.ai.withdraw.limiter.storage")` (FR-35)
  - [x] 1.17 Implement `layout()` internal pure function returning storage reference
  - [x] 1.18 Implement `getAccountConfigOrDefaults(address)` internal view returning effective config with zero-fallback logic (FR-12)
  - [x] 1.19 Implement `calculateCurrentBin(address, uint256, AccountConfig)` internal view calculating bin index (FR-55)
  - [x] 1.20 Implement `zeroExpiredBins(address, uint256, AccountConfig)` internal function for lazy cleanup (FR-27, FR-28)
  - [x] 1.21 Implement `sumActiveBins(address, uint256, AccountConfig)` internal view returning total active withdrawals (FR-7)
  - [x] 1.22 Implement `checkAndRecordWithdraw(address, uint256)` internal function with core validation logic (FR-1 to FR-9)
  - [x] 1.23 Add import statements for GeniusAccessControl and necessary OpenZeppelin libraries
  - [x] 1.24 Run tests to verify all storage tests pass: `yarn test test/unit/GNUSWithdrawLimiterStorage.test.ts --chains sepolia`
  - [x] 1.25 Refactor code for clarity and gas optimization

- [x] 2.0 Create GNUSWithdrawLimiter.sol facet with administrative functions (TDD)
  - [x] 2.1 Create test file `test/unit/GNUSWithdrawLimiter.test.ts` with Diamond deployment setup
  - [x] 2.2 Write test: "should initialize with correct default values" (FR-24)
  - [x] 2.3 Write test: "should allow super admin to set default limit amount" (FR-19)
  - [x] 2.4 Write test: "should allow super admin to set default window seconds" (FR-19)
  - [x] 2.5 Write test: "should allow super admin to set default bin count with validation" (FR-19)
  - [x] 2.6 Write test: "should allow super admin to set per-account config" (FR-11, FR-20)
  - [x] 2.7 Write test: "should allow super admin to enable/disable limiter globally" (FR-17)
  - [x] 2.8 Write test: "should return correct account withdrawal status" (FR-14)
  - [x] 2.9 Write test: "should emit WithdrawLimiterConfigUpdated event" (FR-49)
  - [x] 2.10 Write test: "should emit AccountConfigUpdated event" (FR-50)
  - [x] 2.11 Write test: "should revert when non-admin tries to configure" (FR-16)
  - [x] 2.12 Create file `contracts/gnus-ai/GNUSWithdrawLimiter.sol` extending GeniusAccessControl
  - [x] 2.13 Import GNUSWithdrawLimiterStorage library
  - [x] 2.14 Define events: `WithdrawLimiterConfigUpdated`, `AccountConfigUpdated`, `WithdrawLimiterTriggered`, `WithdrawRecorded` (FR-47 to FR-50)
  - [x] 2.15 Implement `setDefaultLimitAmount(uint256)` external onlySuperAdminRole with event emission (FR-19)
  - [x] 2.16 Implement `setDefaultWindowSeconds(uint256)` external onlySuperAdminRole with event emission (FR-19)
  - [x] 2.17 Implement `setDefaultBinCount(uint256)` external onlySuperAdminRole with validation (must be > 0) (FR-19)
  - [x] 2.18 Implement `setAccountConfig(address, uint32, uint64, uint256)` external onlySuperAdminRole with event emission (FR-11, FR-20)
  - [x] 2.19 Implement `setLimiterEnabled(bool)` external onlySuperAdminRole with event emission (FR-17)
  - [x] 2.20 Implement `getWithdrawLimiterConfig()` external view returning default config tuple (FR-13)
  - [x] 2.21 Implement `getAccountConfig(address)` external view returning effective config (custom or defaults) (FR-13)
  - [x] 2.22 Implement `getAccountWithdrawStatus(address)` external view returning current usage, remaining capacity, window end (FR-14)
  - [x] 2.23 Implement `supportsInterface(bytes4)` override for ERC-165 compatibility
  - [x] 2.24 Add NatSpec documentation for all public/external functions
  - [x] 2.25 Run tests to verify all facet tests pass: `yarn test test/unit/GNUSWithdrawLimiter.test.ts`
  - [x] 2.26 Refactor for code clarity and consistency

- [x] 3.0 Integrate limiter into GNUSBridge.sol withdraw() function (TDD)
  - [x] 3.1 Write integration test: "GNUSBridge.withdraw() should trigger limiter" (FR-31)
  - [x] 3.2 Write integration test: "GNUSBridge.withdraw() should calculate GNUS amount from exchange rate" (FR-33)
  - [x] 3.3 Write integration test: "GNUSBridge.withdraw() should allow super admin bypass" (FR-18)
  - [x] 3.4 Write integration test: "GNUSBridge.withdraw() should emit WithdrawRecorded event" (FR-48)
  - [x] 3.5 Write integration test: "GNUSBridge.withdraw() should revert with clear message when limit exceeded" (FR-41, FR-51)
  - [x] 3.6 Read current `GNUSBridge.sol` withdraw() function implementation
  - [x] 3.7 Import GNUSWithdrawLimiterStorage at top of file
  - [x] 3.8 Add limiter check after amount validation, before _burn(): calculate gnusAmount from exchange rate (FR-33)
  - [x] 3.9 Add super admin bypass: only call limiter if `!hasRole(SUPER_ADMIN_ROLE, sender)` (FR-18)
  - [x] 3.10 Call `GNUSWithdrawLimiterStorage.layout().checkAndRecordWithdraw(sender, gnusAmount)` (FR-31, FR-32, FR-36)
  - [x] 3.11 Verify limiter check occurs BEFORE _burn() operation (FR-32)
  - [x] 3.12 Add error message for limiter trigger: "Withdrawal limit exceeded for time window"
  - [x] 3.13 Run integration tests: `yarn test test/integration/withdraw-limiter-integration.test.ts`
  - [x] 3.14 Verify limiter blocks excessive withdrawals and allows normal ones

- [x] 4.0 Integrate limiter into ERC20TransferBatch.sol for Sybil attack prevention (TDD)
  - [x] 4.1 Write test: "transferBatch() should aggregate amounts and trigger limiter" (FR-37, FR-38)
  - [x] 4.2 Write test: "transferBatch() should allow super admin bypass" (FR-40)
  - [x] 4.3 Write test: "transferBatch() should prevent Sybil attack by checking sender limit" (FR-67, FR-68)
  - [x] 4.4 Write test: "transferOrBurnBatch() should also trigger limiter" (FR-45)
  - [x] 4.5 Write test: "transferBatch() should emit WithdrawRecorded with total amount" (FR-48, FR-53)
  - [x] 4.6 Read current `ERC20TransferBatch.sol` _transferBatch() function implementation
  - [x] 4.7 Import GNUSWithdrawLimiterStorage at top of file
  - [x] 4.8 Add limiter check at start of _transferBatch(), after parameter validation (FR-39)
  - [x] 4.9 Implement super admin bypass: `if (!hasRole(SUPER_ADMIN_ROLE, operator))` (FR-40)
  - [x] 4.10 Aggregate total amount across all destinations in loop: `totalAmount += amounts[i]` (FR-38)
  - [x] 4.11 Call `GNUSWithdrawLimiterStorage.layout().checkAndRecordWithdraw(operator, totalAmount)` (FR-37)
  - [x] 4.12 Verify this integration covers both `transferBatch()` and `transferOrBurnBatch()` (FR-45)
  - [x] 4.13 Add error message for Sybil attack prevention: "Batch transfer exceeds withdrawal limit"
  - [x] 4.14 Run tests to verify Sybil attack prevention works
  - [x] 4.15 Verify batch transfers cannot bypass per-account limits

- [x] 5.0 Integrate limiter into GNUSERC1155MaxSupply.sol transfer hook (TDD)
  - [x] 5.1 Write test: "transfer hook should filter GNUS_TOKEN_ID and accumulate amounts" (FR-42, FR-46)
  - [x] 5.2 Write test: "transfer hook should skip minting operations (from==0)" (FR-43)
  - [x] 5.3 Write test: "transfer hook should skip burning operations (to==0)" (FR-44)
  - [x] 5.4 Write test: "transfer hook should allow super admin bypass" (FR-40)
  - [x] 5.5 Write test: "mixed-token batch should only count GNUS tokens" (FR-46, FR-70)
  - [x] 5.6 Read current `GNUSERC1155MaxSupply.sol` _beforeTokenTransfer() hook implementation
  - [x] 5.7 Import GNUSWithdrawLimiterStorage and GNUSConstants (for GNUS_TOKEN_ID)
  - [x] 5.8 Add limiter check after super._beforeTokenTransfer() call in _beforeTokenTransfer() hook (FR-41)
  - [x] 5.9 Add condition checks: skip if from==0 (minting) or to==0 (burning) (FR-43, FR-44)
  - [x] 5.10 Add super admin bypass: `!hasRole(SUPER_ADMIN_ROLE, operator)` (FR-40)
  - [x] 5.11 Loop through ids array and accumulate amounts where `ids[i] == GNUS_TOKEN_ID` (FR-42, FR-46)
  - [x] 5.12 Call `GNUSWithdrawLimiterStorage.layout().checkAndRecordWithdraw(from, totalGnusAmount)` if totalGnusAmount > 0 (FR-41)
  - [x] 5.13 Add error message: "ERC1155 transfer exceeds withdrawal limit"
  - [x] 5.14 Run tests to verify transfer hook integration works correctly
  - [x] 5.15 Verify fallback coverage for all ERC-1155 GNUS transfers

- [x] 6.0 Add initialization function to DiamondInitFacet.sol (TDD)
  - [x] 6.1 Write test: "should initialize limiter with correct default values" (FR-24)
  - [x] 6.2 Write test: "should set limiter enabled to true after initialization" (FR-24)
  - [x] 6.3 Write test: "should emit initialization event"
  - [x] 6.4 Read current `DiamondInitFacet.sol` to understand initialization pattern
  - [x] 6.5 Import GNUSWithdrawLimiterStorage
  - [x] 6.6 Create `initializeGNUSWithdrawLimiter()` internal function (FR-22)
  - [x] 6.7 Set `defaultLimitAmount = 100_000 * 10**18` (100,000 GNUS tokens) (FR-24)
  - [x] 6.8 Set `defaultWindowSeconds = 86400` (1 day) (FR-24)
  - [x] 6.9 Set `defaultBinCount = 24` (hourly bins) (FR-24)
  - [x] 6.10 Set `limiterEnabled = true` (FR-24)
  - [x] 6.11 Add call to `initializeGNUSWithdrawLimiter()` in appropriate protocol initializer (FR-23)
  - [x] 6.12 Add NatSpec documentation explaining initialization parameters
  - [x] 6.13 Run tests to verify initialization works correctly

- [x] 7.0 Configure Diamond with GNUSWithdrawLimiter facet
  - [x] 7.1 Open `diamonds/GeniusDiamond/geniusdiamond.config.json`
  - [x] 7.2 Add new entry for GNUSWithdrawLimiter with priority 120 (after GNUSBridge at 115)
  - [x] 7.3 Set version to "0.0" for initial implementation
  - [x] 7.4 No deployInit or upgradeInit needed (initialization via DiamondInitFacet)
  - [x] 7.5 Run `yarn compile` to regenerate Diamond ABI and TypeChain types
  - [x] 7.6 Verify Diamond ABI includes all GNUSWithdrawLimiter functions in `diamond-abi/GeniusDiamond.json`
  - [x] 7.7 Verify TypeChain types generated in `diamond-typechain-types/GeniusDiamond.ts`

- [ ] 8.0 Run comprehensive test suite and security tests
  - [ ] 8.1 Run all unit tests on multiple chains: `yarn test test/unit/*.test.ts,polygon_amoy`
  - [ ] 8.2 Run all integration tests: `yarn test test/integration/withdraw-limiter-integration.test.ts`
  - [ ] 8.3 Create `test/foundry/GNUSWithdrawLimiterFuzz.t.sol` extending GeniusDiamondTestBase
  - [ ] 8.4 Write fuzz test: "bin index calculation with random timestamps and configs" (FR-55)
  - [ ] 8.5 Write fuzz test: "bin wrap-around with random bin counts" (FR-30)
  - [ ] 8.6 Write fuzz test: "withdrawal amounts near limit boundaries" (FR-9)
  - [ ] 8.7 Write fuzz test: "multiple sequential withdrawals over time" (FR-6, FR-7)
  - [ ] 8.8 Write fuzz test: "expired bin cleanup with various time gaps" (FR-28)
  - [ ] 8.9 Create `test/foundry/GNUSWithdrawLimiterSybilAttack.t.sol` for security tests
  - [ ] 8.10 Write Sybil test: "cannot bypass limit by distributing to multiple accounts" (FR-67, FR-68)
  - [ ] 8.11 Write Sybil test: "batch transfer aggregation prevents N×limit extraction" (FR-38, FR-67)
  - [ ] 8.12 Write Sybil test: "mixed-token batch only counts GNUS tokens" (FR-46, FR-70)
  - [ ] 8.13 Run Foundry tests: `yarn forge:test`
  - [ ] 8.14 Run Foundry fuzz tests: `yarn forge:fuzz` (256 runs minimum)
  - [ ] 8.15 Generate coverage report: `yarn coverage` and verify ≥90% coverage (FR-62)
  - [ ] 8.16 Run gas benchmarks and verify ~30k overhead for batch transfers (FR-71)
  - [ ] 8.17 Fix any failing tests or coverage gaps
  - [ ] 8.18 Verify all 71 functional requirements are tested and passing

- [ ] 9.0 Generate API documentation
  - [ ] 9.1 Create `docs/GNUSWithdrawLimiter.md` file
  - [ ] 9.2 Document purpose and comprehensive security scope (all GNUS transfer paths)
  - [ ] 9.3 Document bin-based aggregation design and benefits (76% storage reduction)
  - [ ] 9.4 Document all public/external functions with parameters, return values, access control, and events
  - [ ] 9.5 Document storage structures (WithdrawBin, AccountConfig, AccountState, Layout)
  - [ ] 9.6 Document bin calculation mathematics with examples (FR-54, FR-55, FR-56, FR-57)
  - [ ] 9.7 Document Sybil attack prevention strategy and three integration points
  - [ ] 9.8 Document configuration parameters and default values
  - [ ] 9.9 Document example configurations for different use cases (daily, weekly, high-frequency)
  - [ ] 9.10 Document integration guide for each of the three integration points
  - [ ] 9.11 Document security considerations and super admin bypass
  - [ ] 9.12 Add usage examples with code snippets
  - [ ] 9.13 Document gas optimization benefits and benchmarks
  - [ ] 9.14 Document testing approach and coverage achieved (≥95%)

- [ ] 10.0 Cleanup
  - [ ] 10.1 Remove references to Tasks (e.g. FR-54) and affirm coding comments are up to professional standards in files touched during previous tasks