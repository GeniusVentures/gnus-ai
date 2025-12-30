# Task List: Fix Foundry Invariant Tests for GeniusDiamond

Based on the PRD, here is the task list for fixing all 33 failing invariant tests.

---

## Relevant Files

- `test/foundry/handlers/GeniusDiamondHandler.sol` - Handler contract for stateful invariant testing with bounded inputs (needs completion)
- `test/foundry/invariant/AccessControlInvariant.t.sol` - Role-based access control invariant tests (Priority 1 - Security)
- `test/foundry/invariant/EconomicInvariant.t.sol` - Economic/tokenomics invariant tests (Priority 1 - Security)
- `test/foundry/invariant/ERC20Invariant.t.sol` - GNUS ERC20 token invariant tests (Priority 1 - Security)
- `test/foundry/invariant/DiamondCoreInvariant.t.sol` - Diamond proxy core invariant tests (Priority 2 - Core)
- `test/foundry/invariant/ERC1155Invariant.t.sol` - ERC1155 multi-token invariant tests (Priority 2 - Core)
- `test/foundry/invariant/NFTFactoryInvariant.t.sol` - NFT Factory invariant tests (Priority 2 - Core)
- `test/foundry/base/GeniusDiamondTestBase.sol` - Shared base contract extending DiamondFuzzBase (may need minor updates)
- `foundry.toml` - Foundry configuration with fuzz/invariant settings (already configured)

### Notes

- All test files use `.t.sol` suffix per Foundry convention
- Tests extend `GeniusDiamondTestBase` which extends `DiamondFuzzBase` from `@diamondslab/diamonds-hardhat-foundry`
- Run tests with `npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --network localhost --force --match-contract '.*Invariant.*'`
- The Anvil local node must be running in a separate terminal (`anvil`)
- Current status: All 33 invariant tests failing with "No contracts to fuzz" error

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

---

## Tasks

- [x] 0.0 Verify feature branch and environment setup
  - [x] 0.1 Confirm on `feature/foundry-fuzz-tests` branch with `git branch --show-current`
  - [x] 0.2 Verify Anvil local node is running in separate terminal
  - [x] 0.3 Verify diamond deployment with `npx hardhat diamonds-forge:deploy --diamond-name GeniusDiamond --network localhost`
  - [x] 0.4 Confirm all 33 invariant tests currently failing with `npx hardhat diamonds-forge:test --match-contract '.*Invariant.*' --diamond-name GeniusDiamond --network localhost --force`

- [x] 1.0 Phase 0: Research & Design (MUST BE COMPLETED FIRST)
  - [x] 1.1 Research Foundry invariant testing best practices
    - [x] 1.1.1 Read Foundry Book invariant testing section: https://book.getfoundry.sh/forge/invariant-testing
    - [x] 1.1.2 Review handler pattern documentation and examples
    - [x] 1.1.3 Document key findings: when to use handlers vs direct targeting, ghost variable patterns
  - [x] 1.2 Analyze existing `GeniusDiamondHandler.sol` implementation
    - [x] 1.2.1 Read entire file and document existing handler functions (transfer, approve, mint, createCollection, bridgeDeposit)
    - [x] 1.2.2 Identify which operations are already implemented with proper bounds
    - [x] 1.2.3 List existing ghost variables and their purposes
    - [x] 1.2.4 Check if actor management is properly implemented
  - [x] 1.3 Map required operations for each invariant test suite
    - [x] 1.3.1 Review `AccessControlInvariant.t.sol` - identify needed operations (grantRole, revokeRole, etc.)
    - [x] 1.3.2 Review `EconomicInvariant.t.sol` - identify needed operations (mint, burn, transfer)
    - [x] 1.3.3 Review `ERC20Invariant.t.sol` - identify needed operations (transfer, approve, mint, burn)
    - [x] 1.3.4 Review `DiamondCoreInvariant.t.sol` - identify needed operations (may need none if testing proxy state)
    - [x] 1.3.5 Review `ERC1155Invariant.t.sol` - identify needed operations (mint, transfer, burn)
    - [x] 1.3.6 Review `NFTFactoryInvariant.t.sol` - identify needed operations (createCollection)
  - [x] 1.4 Make handler architecture decision
    - [x] 1.4.1 Evaluate Option A: Single `GeniusDiamondHandler` for all tests (simplest)
    - [x] 1.4.2 Evaluate Option B: Domain-specific handlers extending base handler (more modular)
    - [x] 1.4.3 Evaluate Option C: Multiple independent handlers (most flexible but duplicative)
    - [x] 1.4.4 Document chosen approach and rationale (update PRD Section 8 Open Questions)
  - [x] 1.5 Create detailed implementation plan
    - [x] 1.5.1 List all missing handler functions that need to be added to `GeniusDiamondHandler.sol`
    - [x] 1.5.2 Document ghost variables to add for state tracking
    - [x] 1.5.3 Create priority order for fixing test suites (AccessControl → Economic → ERC20 → DiamondCore → ERC1155 → NFTFactory)
    - [x] 1.5.4 Estimate complexity for each test suite (simple/medium/complex)
  - [x] 1.6 Document findings in code comments or PRD updates
    - [x] 1.6.1 Add findings to PRD Section 8 (Open Questions) with decisions made
    - [x] 1.6.2 Create inline comments plan for handler functions to be added

- [x] 2.0 Phase 1: Complete Handler Implementation
  - [x] 2.1 Add missing access control handler functions
    - [x] 2.1.1 Implement `handler_grantRole(uint256 actorSeed, bytes32 role, uint256 targetSeed)` with proper role validation
    - [x] 2.1.2 Implement `handler_revokeRole(uint256 actorSeed, bytes32 role, uint256 targetSeed)` with proper role validation
    - [x] 2.1.3 Add ghost variable `ghost_totalRoleGrants` to track role grants
    - [x] 2.1.4 Add ghost variable `ghost_totalRoleRevokes` to track role revokes
    - [x] 2.1.5 Add call counters `calls_grantRole` and `calls_revokeRole`
  - [x] 2.2 Add missing ERC20 handler functions (if not already complete)
    - [x] 2.2.1 Verify `handler_transfer` is properly bounded to balance
    - [x] 2.2.2 Verify `handler_approve` has reasonable approval limits
    - [x] 2.2.3 Verify `handler_mint` is only callable by MINTER_ROLE and properly bounded
    - [x] 2.2.4 Add `handler_burn(uint256 actorSeed, uint256 amount)` if missing
  - [x] 2.3 Add missing ERC1155 handler functions
    - [x] 2.3.1 Implement `handler_mint1155(uint256 recipientSeed, uint256 tokenId, uint256 amount)` with max supply bounds
    - [x] 2.3.2 Implement `handler_burn1155(uint256 actorSeed, uint256 tokenId, uint256 amount)` with balance bounds
    - [x] 2.3.3 Add ghost variables for ERC1155 tracking if needed
  - [x] 2.4 Verify NFT Factory handler functions
    - [x] 2.4.1 Review existing `handler_createCollection` implementation
    - [x] 2.4.2 Ensure GNUS burn cost is properly tracked in ghost variables
    - [x] 2.4.3 Verify collection ID tracking works correctly
  - [x] 2.5 Add actor management enhancements if needed
    - [x] 2.5.1 Verify actor list has sufficient addresses (minimum 4: this, user1, user2, user3)
    - [x] 2.5.2 Add helper function `_getActor(uint256 seed)` if not exists
    - [x] 2.5.3 Ensure no address(0) can be selected as actor
  - [x] 2.6 Compile and verify handler compiles without errors
    - [x] 2.6.1 Run `forge build` and fix any compilation errors
    - [x] 2.6.2 Verify no missing imports or syntax errors
  - [x] 2.7 Test handler functions in isolation (optional but recommended)
    - [x] 2.7.1 Create simple test to call handler functions directly
    - [x] 2.7.2 Verify ghost variables update correctly
    - [x] 2.7.3 Verify bounds are respected

- [ ] 3.0 Phase 2A: Fix Security-Critical Invariant Tests (Priority 1)
  - [x] 3.1 Fix `AccessControlInvariant.t.sol` (8 tests)
    - [x] 3.1.1 Remove `targetContract(diamond)` and `excludeSender()` from setUp()
    - [x] 3.1.2 Instantiate handler: `GeniusDiamondHandler handler = new GeniusDiamondHandler()`
    - [x] 3.1.3 Call `handler.setUp()` to initialize handler
    - [x] 3.1.4 Add `targetContract(address(handler))` to setUp()
    - [x] 3.1.5 Review `invariant_adminRoleCanGrantAll()` - remove state-changing calls, make view-only
    - [x] 3.1.6 Review `invariant_roleConsistency()` - ensure view-only property check
    - [x] 3.1.7 Review `invariant_ownerHasAdminRole()` - ensure view-only (likely already correct)
    - [x] 3.1.8 Review `invariant_nonAdminsLackAdminRole()` - ensure view-only
    - [x] 3.1.9 Review `invariant_minterRoleRestricted()` - ensure view-only
    - [x] 3.1.10 Review `invariant_roleQueriesNeverRevert()` - ensure view-only
    - [x] 3.1.11 Review `invariant_multipleAdminsSupported()` - remove state-changing calls
    - [x] 3.1.12 Review `invariant_revokingUnownedRoleIsSafe()` - remove state-changing calls
    - [x] 3.1.13 Compile with `forge build` and fix any errors
    - [x] 3.1.14 Run tests: `npx hardhat diamonds-forge:test --match-contract 'AccessControlInvariant' --diamond-name GeniusDiamond --network localhost --force`
    - [x] 3.1.15 Verify all 8 tests passing with 256 runs, calls > 0
  - [x] 3.2 Fix `EconomicInvariant.t.sol` (3 tests)
    - [x] 3.2.1 Remove `targetContract(diamond)` and `excludeSender()` from setUp()
    - [x] 3.2.2 Instantiate and setup handler with `targetContract(address(handler))`
    - [x] 3.2.3 Review `invariant_noFreeTokenCreation()` - ensure view-only, verifies total supply integrity
    - [x] 3.2.4 Review `invariant_burnMechanicsCorrect()` - ensure view-only, verifies supply decreases
    - [x] 3.2.5 Review `invariant_tokenEconomicsConsistent()` - ensure view-only, verifies balance conservation
    - [x] 3.2.6 Add ghost variable checks if needed (compare contract state to handler ghost variables)
    - [x] 3.2.7 Compile and fix any errors
    - [x] 3.2.8 Run tests: `npx hardhat diamonds-forge:test --match-contract 'EconomicInvariant' --diamond-name GeniusDiamond --network localhost --force`
    - [x] 3.2.9 Verify all 3 tests passing with 256 runs
  - [x] 3.3 Fix `ERC20Invariant.t.sol` (8 tests)
    - [x] 3.3.1 Remove `targetContract(diamond)` and `excludeSender()` from setUp()
    - [x] 3.3.2 Instantiate and setup handler with `targetContract(address(handler))`
    - [x] 3.3.3 Review `invariant_totalSupplyNeverExceedsMax()` - ensure view-only (likely already correct)
    - [x] 3.3.4 Review `invariant_balancesSumToTotalSupply()` - ensure view-only
    - [x] 3.3.5 Review `invariant_balanceConservation()` - add ghost variable comparison
    - [x] 3.3.6 Update ghost variables: Use handler's `ghost_totalMinted` and `ghost_totalBurned`
    - [x] 3.3.7 Review remaining 5 invariant functions - ensure all are view-only
    - [x] 3.3.8 Compile and fix any errors
    - [x] 3.3.9 Run tests: `npx hardhat diamonds-forge:test --match-contract 'ERC20Invariant' --diamond-name GeniusDiamond --network localhost --force`
    - [x] 3.3.10 Verify all 8 tests passing with 256 runs
  - [ ] 3.4 Verify all Priority 1 tests passing
    - [ ] 3.4.1 Run all security-critical tests together
    - [ ] 3.4.2 Confirm 19 tests passing (8 + 3 + 8)
    - [ ] 3.4.3 Review any failures and iterate if needed

- [ ] 4.0 Phase 2B: Fix Core Functionality Invariant Tests (Priority 2)
  - [ ] 4.1 Fix `DiamondCoreInvariant.t.sol` (8 tests)
    - [ ] 4.1.1 Remove `targetContract(diamond)` and `excludeSender()` from setUp()
    - [ ] 4.1.2 Instantiate and setup handler with `targetContract(address(handler))`
    - [ ] 4.1.3 Review all 8 invariant functions - these should already be view-only (checking proxy state)
    - [ ] 4.1.4 Verify `invariant_ownerNeverZero()` checks diamond owner
    - [ ] 4.1.5 Verify `invariant_allSelectorsHaveValidFacets()` checks facet addresses
    - [ ] 4.1.6 Verify remaining invariants check diamond structure integrity
    - [ ] 4.1.7 Compile and fix any errors
    - [ ] 4.1.8 Run tests: `npx hardhat diamonds-forge:test --match-contract 'DiamondCoreInvariant' --diamond-name GeniusDiamond --network localhost --force`
    - [ ] 4.1.9 Verify all 8 tests passing with 256 runs
  - [ ] 4.2 Fix `ERC1155Invariant.t.sol` (4 tests)
    - [ ] 4.2.1 Remove `targetContract(diamond)` and `excludeSender()` from setUp()
    - [ ] 4.2.2 Instantiate and setup handler with `targetContract(address(handler))`
    - [ ] 4.2.3 Review `invariant_tokenSupplyNeverExceedsMax()` - ensure view-only
    - [ ] 4.2.4 Review `invariant_balanceConsistency()` - ensure view-only
    - [ ] 4.2.5 Review `invariant_zeroAddressBalanceZero()` - ensure view-only (likely correct)
    - [ ] 4.2.6 Review `invariant_individualBalancesValid()` - ensure view-only
    - [ ] 4.2.7 Compile and fix any errors
    - [ ] 4.2.8 Run tests: `npx hardhat diamonds-forge:test --match-contract 'ERC1155Invariant' --diamond-name GeniusDiamond --network localhost --force`
    - [ ] 4.2.9 Verify all 4 tests passing with 256 runs
  - [ ] 4.3 Fix `NFTFactoryInvariant.t.sol` (2 tests)
    - [ ] 4.3.1 Remove `targetContract(diamond)` and `excludeSender()` from setUp()
    - [ ] 4.3.2 Instantiate and setup handler with `targetContract(address(handler))`
    - [ ] 4.3.3 Review `invariant_collectionIdsUnique()` - ensure view-only
    - [ ] 4.3.4 Review `invariant_gnusBurnedOnCollectionCreate()` - ensure view-only, add ghost variable check
    - [ ] 4.3.5 Compile and fix any errors
    - [ ] 4.3.6 Run tests: `npx hardhat diamonds-forge:test --match-contract 'NFTFactoryInvariant' --diamond-name GeniusDiamond --network localhost --force`
    - [ ] 4.3.7 Verify all 2 tests passing with 256 runs
  - [ ] 4.4 Verify all Priority 2 tests passing
    - [ ] 4.4.1 Run all core functionality tests together
    - [ ] 4.4.2 Confirm 14 tests passing (8 + 4 + 2)
    - [ ] 4.4.3 Review any failures and iterate if needed

- [ ] 5.0 Phase 3: Documentation & Verification
  - [ ] 5.1 Document invariant properties in test files
    - [ ] 5.1.1 Add/enhance NatSpec comments for all `invariant_*` functions in AccessControlInvariant
    - [ ] 5.1.2 Add/enhance NatSpec comments for all `invariant_*` functions in EconomicInvariant
    - [ ] 5.1.3 Add/enhance NatSpec comments for all `invariant_*` functions in ERC20Invariant
    - [ ] 5.1.4 Add/enhance NatSpec comments for all `invariant_*` functions in DiamondCoreInvariant
    - [ ] 5.1.5 Add/enhance NatSpec comments for all `invariant_*` functions in ERC1155Invariant
    - [ ] 5.1.6 Add/enhance NatSpec comments for all `invariant_*` functions in NFTFactoryInvariant
    - [ ] 5.1.7 Ensure each comment explains: what property is tested, why it must hold, what would break if violated
  - [ ] 5.2 Document handler functions
    - [ ] 5.2.1 Add/enhance NatSpec comments for all handler functions in `GeniusDiamondHandler.sol`
    - [ ] 5.2.2 Document input bounds and rationale
    - [ ] 5.2.3 Document ghost variable updates
    - [ ] 5.2.4 Add usage examples if helpful
  - [ ] 5.3 Generate and review coverage report
    - [ ] 5.3.1 Run coverage: `forge coverage --match-contract '.*Invariant.*' > coverage-invariant.txt`
    - [ ] 5.3.2 Review coverage report and identify gaps
    - [ ] 5.3.3 Verify 90%+ coverage target achieved across facets
    - [ ] 5.3.4 Document any uncovered code paths with justification (if acceptable)
  - [ ] 5.4 Update task list completion status
    - [ ] 5.4.1 Mark all completed sub-tasks with [x] in this file
    - [ ] 5.4.2 Verify all 33 tests have been fixed and documented
    - [ ] 5.4.3 Update PRD if any open questions were resolved

- [ ] 6.0 Phase 4: Integration & Final Testing
  - [ ] 6.1 Run full invariant test suite
    - [ ] 6.1.1 Ensure Anvil node is running
    - [ ] 6.1.2 Deploy diamond: `npx hardhat diamonds-forge:deploy --diamond-name GeniusDiamond --network localhost --force`
    - [ ] 6.1.3 Run all invariant tests: `npx hardhat diamonds-forge:test --match-contract '.*Invariant.*' --diamond-name GeniusDiamond --network localhost --force`
    - [ ] 6.1.4 Verify output shows: "33 tests passed, 0 failed"
    - [ ] 6.1.5 Verify all tests show "runs: 256, calls: >0"
  - [ ] 6.2 Verify test execution performance
    - [ ] 6.2.1 Measure total test execution time
    - [ ] 6.2.2 Confirm tests complete in under 5 minutes
    - [ ] 6.2.3 Identify any slow tests and optimize if needed
  - [ ] 6.3 Test determinism and reliability
    - [ ] 6.3.1 Run invariant tests 3 times back-to-back
    - [ ] 6.3.2 Verify consistent pass/fail results
    - [ ] 6.3.3 Verify no flaky tests or random failures
  - [ ] 6.4 Commit all changes
    - [ ] 6.4.1 Stage all modified test files: `git add test/foundry/invariant/*.sol`
    - [ ] 6.4.2 Stage handler: `git add test/foundry/handlers/GeniusDiamondHandler.sol`
    - [ ] 6.4.3 Stage task list and PRD updates: `git add project/fuzzing-prompts/`
    - [ ] 6.4.4 Commit with clear message: `git commit -m "fix: complete all 33 Foundry invariant tests with handler pattern"`
  - [ ] 6.5 Create pull request summary
    - [ ] 6.5.1 Document what was changed (handler completion, test redesign)
    - [ ] 6.5.2 Document test results (33/33 passing with 256 runs)
    - [ ] 6.5.3 Document coverage achieved (target: 90%+)
    - [ ] 6.5.4 List key invariant properties verified
  - [ ] 6.6 Final verification checklist
    - [ ] 6.6.1 ✅ All 33 invariant tests passing
    - [ ] 6.6.2 ✅ Zero "No contracts to fuzz" errors
    - [ ] 6.6.3 ✅ All tests show runs: 256, calls: >0
    - [ ] 6.6.4 ✅ All invariant functions documented with NatSpec
    - [ ] 6.6.5 ✅ Coverage report shows 90%+ across facets
    - [ ] 6.6.6 ✅ Tests run in under 5 minutes
    - [ ] 6.6.7 ✅ Tests integrated with Hardhat task commands
    - [ ] 6.6.8 ✅ Code committed with clear commit messages
