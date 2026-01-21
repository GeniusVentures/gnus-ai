# Product Requirements Document: Fix Foundry Invariant Tests for GeniusDiamond

## 1. Introduction/Overview

The GeniusDiamond smart contract system has 6 invariant test suites (33 total tests) that are currently non-functional, failing with "failed to set up invariant testing environment: No contracts to fuzz" errors. These invariant tests are critical for verifying that security properties, economic rules, and system invariants hold under all possible state transitions.

**Problem Statement:** The current invariant tests have fundamental design flaws:
1. They target the diamond contract directly instead of using a handler contract
2. Invariant check functions contain state-changing calls instead of only verifying properties
3. The existing `GeniusDiamondHandler.sol` is incomplete and not properly integrated
4. Tests don't follow Foundry's handler pattern for stateful invariant testing

**Goal:** Redesign and implement enterprise-grade Foundry invariant tests following best practices for the `@diamondslab/diamonds-hardhat-foundry` framework, ensuring all 33 invariant tests pass with 256+ fuzz runs.

---

## 2. Goals

1. **Fix all 33 failing invariant tests** across 6 test suites to achieve 100% pass rate with 256 runs per test
2. **Complete the GeniusDiamondHandler** with all critical diamond operations properly bounded and tracked
3. **Achieve 90%+ code coverage** across all GeniusDiamond facets through invariant testing
4. **Prioritize security-critical tests** (AccessControl, Economic, ERC20) for immediate completion
5. **Document all invariant properties** with clear explanations of what each property verifies
6. **Follow enterprise-grade standards** using proper handler patterns and ghost variable tracking
7. **Integrate with existing CI/CD** using the existing Hardhat task infrastructure using `npx hardhat diamonds-forge:test --match-contract '.*Invariant.*' --diamond-name GeniusDiamond --network localhost --force` for test execution

---

## 3. User Stories

### As a Smart Contract Security Engineer
- I want invariant tests that use proper handler patterns so that the fuzzer can explore valid state spaces
- I want all security-critical invariants (access control, economic rules) verified first so that I can audit the highest-risk areas
- I want clear documentation for each invariant property so that I can understand what security guarantees are being tested

### As a Smart Contract Developer
- I want invariant tests that run with 256+ iterations so that I have confidence in edge case coverage
- I want handler functions that properly bound inputs so that tests focus on valid scenarios
- I want ghost variables tracking expected state so that I can verify complex state transitions

### As a DevOps Engineer
- I want all 33 invariant tests passing reliably so that I can include them in CI/CD pipelines
- I want tests that complete in reasonable time (under 5 minutes total) so that they don't block deployments
- I want clear test output showing which invariants passed/failed so that I can diagnose failures quickly

---

## 4. Functional Requirements

### Phase 0: Research & Design (MUST BE COMPLETED FIRST)

**FR-001:** MUST conduct comprehensive research on Foundry invariant testing best practices
- Review Foundry Book documentation on invariant testing
- Analyze handler pattern examples from production codebases
- Document findings and design approach before implementation

**FR-002:** MUST analyze the existing `GeniusDiamondHandler.sol` to determine:
- Which operations are already implemented
- Which critical operations are missing
- Whether to use single handler or domain-specific handlers
- How to properly integrate handler with all 6 invariant test suites

**FR-003:** MUST document the handler integration architecture decision:
- Option A: Single `GeniusDiamondHandler` used by all invariant tests
- Option B: Domain-specific handlers extending `GeniusDiamondHandler`
- Option C: Multiple independent handlers per test suite
- Document chosen approach with rationale in PRD or separate design doc

**FR-004:** MUST create implementation plan specifying:
- Order of test suite fixes (security-critical first)
- Which handler functions are needed for each test suite
- Ghost variables required for state tracking
- Estimated complexity/timeline per test suite

### Phase 1: Handler Implementation

**FR-005:** The `GeniusDiamondHandler` MUST implement bounded handler functions for all critical operations:
- ERC20 transfers with balance bounds
- ERC20 approvals with reasonable limits
- ERC1155 minting with max supply constraints
- Access control role grants/revokes with role validation
- NFT collection creation with valid parameters
- Bridge deposits/withdrawals with proper bounds

**FR-006:** The handler MUST track state changes using ghost variables:
- `ghost_totalMinted` - Total GNUS tokens minted
- `ghost_totalBurned` - Total GNUS tokens burned
- `ghost_totalTransfers` - Count of transfer operations
- `ghost_totalCollectionsCreated` - Count of NFT collections
- Additional ghost variables as needed per operation type

**FR-007:** The handler MUST implement proper actor management:
- Maintain list of valid actor addresses
- Seed-based actor selection for deterministic fuzzing
- Proper `vm.prank()` usage for actor impersonation
- Prevent invalid actors (address(0), etc.)

**FR-008:** The handler MUST include input bounding logic:
- Use `_boundUint256()` or similar for safe amount ranges
- Prevent overflows and underflows
- Ensure amounts don't exceed balances/allowances
- Validate token IDs exist before operations

### Phase 2: Invariant Test Redesign

**FR-009:** ALL invariant test `setUp()` functions MUST:
- Call `super.setUp()` to initialize diamond deployment
- Target the handler contract: `targetContract(address(handler))`
- NOT target the diamond directly
- Initialize any test-specific state needed

**FR-010:** ALL invariant check functions MUST:
- Be view/pure functions that only read state
- NOT make state-changing calls (no `_grantRole()`, transfers, etc.)
- Verify properties using assertions only
- Use descriptive assertion failure messages

**FR-011:** Each invariant test suite MUST verify 3-5 key invariant properties minimum:
- Properties must be specific and testable
- Each property should have a dedicated `invariant_*` function
- Functions must be properly named describing the property

**FR-012:** Invariant tests MUST be prioritized in this order:
1. **Security-Critical (Priority 1):**
   - `AccessControlInvariant.t.sol` - Role-based access control properties
   - `EconomicInvariant.t.sol` - Token economics and burn rules
   - `ERC20Invariant.t.sol` - GNUS token supply and balance properties
2. **Core Functionality (Priority 2):**
   - `DiamondCoreInvariant.t.sol` - Diamond proxy integrity
   - `ERC1155Invariant.t.sol` - Multi-token properties
   - `NFTFactoryInvariant.t.sol` - NFT creation properties

### Phase 3: Documentation & Verification

**FR-013:** Each invariant test file MUST include:
- Clear NatSpec comments explaining the test suite's purpose
- Documentation for each invariant property being tested
- Examples or references to expected behavior

**FR-014:** Each `invariant_*` function MUST include:
- NatSpec comment describing the invariant property
- Explanation of why the property must hold
- Clear assertion messages for failures

**FR-015:** ALL 33 invariant tests MUST:
- Pass with 256 fuzz runs (as configured in `foundry.toml`)
- Complete without "No contracts to fuzz" errors
- Show non-zero calls count (runs: 256, calls: >0)

**FR-016:** The test suite MUST achieve 90%+ code coverage across:
- All GeniusDiamond facet contracts
- Core state-changing functions
- Access control modifiers and role checks

### Phase 4: Integration & CI/CD

**FR-017:** Invariant tests MUST integrate with existing Hardhat tasks:
- Run via `npx hardhat diamonds-forge:test --match-contract '.*Invariant.*'`
- Work with `--network localhost` against deployed diamond
- Support `--force` flag for clean test runs

**FR-018:** Test execution MUST be reliable and deterministic:
- Same seed produces same test sequence
- Tests complete in under 5 minutes total
- No flaky failures or timeouts

---

## 5. Non-Goals (Out of Scope)

1. **NOT implementing new facet functionality** - Only testing existing facets
2. **NOT modifying the diamond contracts** - Tests should work with deployed contracts as-is
3. **NOT creating additional fuzz tests** - Focus is on fixing invariant tests only
4. **NOT refactoring GeniusDiamondTestBase** - Use existing base contract unless required for fixes
5. **NOT implementing fuzzing for AI processing or bridge withdrawal features** - Focus on core token and access control invariants

---

## 6. Technical Considerations

### Foundry Invariant Testing Framework

- **Handler Pattern:** Foundry's invariant testing requires a handler contract with state-changing functions that the fuzzer can call randomly. The handler encapsulates valid operations.
- **Ghost Variables:** Track expected state separately from contract state to verify consistency
- **targetContract():** Must target the handler, not the diamond directly
- **excludeSender():** May be needed to prevent test contract from being called

### Integration with @diamondslab/diamonds-hardhat-foundry

- Tests extend `GeniusDiamondTestBase` which extends `DiamondFuzzBase`
- Use `_getDiamondABIPath()` for diamond interface loading
- Leverage existing helper functions: `_hasRole()`, `_grantRole()`, `_getGNUSBalance()`, etc.
- Work with auto-generated `DiamondDeployment.sol` for addresses

### Current State Analysis

Existing issues to fix:
1. `targetContract(diamond)` - Should be `targetContract(address(handler))`
2. Invariant functions call state-changing methods - Should be view-only property checks
3. Handler has functions but they're not being called - Need proper integration
4. Missing handler functions for some operations - Need completion

### Dependencies

- Foundry forge-std (already installed)
- @diamondslab/diamonds-hardhat-foundry (already configured)
- Hardhat with diamond deployment tasks (already working)
- Local Anvil node for testing (already running)

---

## 7. Success Metrics

### Primary Success Criteria

1. **100% invariant test pass rate:** All 33 tests passing with 256 runs each
   - Measured by: `forge test --match-contract '.*Invariant.*'` output
   
2. **Zero "No contracts to fuzz" errors:** All tests show `runs: 256, calls: >0`
   - Measured by: Test output showing valid call counts

3. **Clear property documentation:** Each of 33 tests has documented invariant property
   - Measured by: Code review of NatSpec comments

### Secondary Success Criteria

4. **90%+ code coverage:** Achieved through invariant tests
   - Measured by: `forge coverage --match-contract '.*Invariant.*'`

5. **Security-critical tests completed first:** AccessControl, Economic, ERC20 passing before others
   - Measured by: Git commit history showing phased completion

6. **Test execution performance:** All invariant tests complete in under 5 minutes
   - Measured by: CI/CD pipeline execution time

### Quality Gates

- [ ] Phase 0 (Research & Design) complete with documented architecture decision
- [ ] Priority 1 tests passing (AccessControl, Economic, ERC20)
- [ ] Priority 2 tests passing (DiamondCore, ERC1155, NFTFactory)
- [ ] Code coverage report shows 90%+ across facets
- [ ] All tests documented with clear invariant property explanations
- [ ] Tests integrated with CI/CD and passing in pipeline

---

## 8. Open Questions

### Critical Questions (Requires Research in Phase 0)

1. **Handler Architecture:** Should we use single `GeniusDiamondHandler` for all tests, or create domain-specific handlers per test suite?
   - **DECISION: Option A - Single Handler (CHOSEN)**
   - **Rationale:** 
     - Simplest to implement and maintain
     - Existing `GeniusDiamondHandler` already has good structure
     - All 6 test suites can share same handler instance
     - Reduces code duplication
     - Easier to track global ghost variables (totalMinted, totalBurned, etc.)
     - Foundry Book recommends this approach for most cases

2. **Ghost Variable Scope:** Should ghost variables be in the handler, in test contracts, or both?
   - **DECISION: Ghost variables in Handler (CHOSEN)**
   - **Rationale:**
     - Handler tracks state changes as they happen
     - Invariant tests read handler's ghost variables to compare against contract state
     - Cleaner separation: handler manages state tracking, tests verify properties
     - Follows Foundry Book pattern

3. **Handler Function Completeness:** What are ALL the operations each test suite needs from the handler?
   - **MAPPED OPERATIONS:**
     - **AccessControlInvariant:** NEEDS handler_grantRole, handler_revokeRole (MISSING)
     - **EconomicInvariant:** Uses existing transfer, mint; NEEDS handler_burn (MISSING)
     - **ERC20Invariant:** Uses transfer, approve, mint; NEEDS handler_burn (MISSING)
     - **DiamondCoreInvariant:** No handler calls needed (tests proxy state only)
     - **ERC1155Invariant:** Uses existing mint; NEEDS handler_mint1155, handler_burn1155 (MISSING)
     - **NFTFactoryInvariant:** Uses existing handler_createCollection (OK)

### Implementation Questions

4. **Actor Management:** How many actors should the handler maintain for realistic multi-user scenarios?
   - Current handler has 4 actors (this, user1, user2, user3)
   - May need more for complex access control scenarios

5. **Input Bounds:** What are appropriate bounds for amounts, token IDs, and other parameters?
   - Must prevent overflows while still testing edge cases
   - May need different bounds per operation type

6. **Test Independence:** Should each invariant test suite have isolated state, or share handler state?
   - Consider: Test execution order, state accumulation, debugging

---

## 9. Implementation Phases

### Phase 0: Research & Design (1-2 days)
- [ ] Review Foundry invariant testing documentation
- [ ] Analyze existing `GeniusDiamondHandler.sol` structure
- [ ] Document handler architecture decision (single vs. multiple handlers)
- [ ] Create detailed function mapping (test suite → required handler functions)
- [ ] Update this PRD with findings and design decisions

### Phase 1: Handler Implementation (2-3 days)
- [ ] Complete missing handler functions
- [ ] Add ghost variables for all tracked operations
- [ ] Implement proper input bounding logic
- [ ] Add actor management enhancements if needed
- [ ] Test handler functions in isolation

### Phase 2: Security-Critical Invariant Tests (Priority 1) (3-4 days)
- [ ] Fix `AccessControlInvariant.t.sol` - 8 tests
- [ ] Fix `EconomicInvariant.t.sol` - 3 tests
- [ ] Fix `ERC20Invariant.t.sol` - 8 tests
- [ ] Verify all 19 Priority 1 tests passing with 256 runs

### Phase 3: Core Functionality Invariant Tests (Priority 2) (2-3 days)
- [ ] Fix `DiamondCoreInvariant.t.sol` - 8 tests
- [ ] Fix `ERC1155Invariant.t.sol` - 4 tests
- [ ] Fix `NFTFactoryInvariant.t.sol` - 2 tests
- [ ] Verify all 14 Priority 2 tests passing with 256 runs

### Phase 4: Documentation & Verification (1 day)
- [ ] Add NatSpec documentation to all invariant functions
- [ ] Generate coverage report and verify 90%+ target
- [ ] Update task list markdown with completion status
- [ ] Create summary of fixed tests and verified properties

### Phase 5: Integration & CI/CD (1 day)
- [ ] Verify tests work with Hardhat task commands
- [ ] Test against localhost deployed diamond
- [ ] Confirm tests run in under 5 minutes
- [ ] Document any CI/CD configuration changes needed

**Total Estimated Timeline:** 10-14 days

---

## 10. Definition of Done

This feature is complete when:

1. ✅ All 33 invariant tests pass with 256 runs each
2. ✅ Zero "No contracts to fuzz" errors in test output
3. ✅ All tests show non-zero call counts (calls: >0)
4. ✅ Each invariant function has clear NatSpec documentation
5. ✅ Code coverage report shows 90%+ across facets
6. ✅ Tests run via Hardhat task: `npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --match-contract '.*Invariant.*' --network localhost --force`
7. ✅ Security-critical tests (Priority 1) verified and documented
8. ✅ All tests complete in under 5 minutes total execution time
9. ✅ Task list markdown updated with [x] completion markers
10. ✅ Code committed to `feature/foundry-fuzz-tests` branch with clear commit messages

---

## Appendix A: Current Test Status

### Failing Tests (33 total)

| Test Suite | Tests | Status | Priority | Notes |
|------------|-------|--------|----------|-------|
| AccessControlInvariant | 8 | ❌ All failing | P1 - Security | Role-based access control |
| EconomicInvariant | 3 | ❌ All failing | P1 - Security | Token economics, burn rules |
| ERC20Invariant | 8 | ❌ All failing | P1 - Security | GNUS token properties |
| DiamondCoreInvariant | 8 | ❌ All failing | P2 - Core | Proxy structure integrity |
| ERC1155Invariant | 4 | ❌ All failing | P2 - Core | Multi-token properties |
| NFTFactoryInvariant | 2 | ❌ All failing | P2 - Core | NFT creation properties |

**Error:** `failed to set up invariant testing environment: No contracts to fuzz. (runs: 0, calls: 0, reverts: 0)`

### Related Passing Tests

- ✅ SecurityFuzz.t.sol - 9/9 tests passing
- ✅ AccessControlFuzz.t.sol - 10/10 tests passing

---

## Appendix B: Key Invariant Properties to Verify

### AccessControlInvariant (8 properties)
1. Admin role can grant all other roles
2. Role state consistency (hasRole matches granted/revoked)
3. Owner always has DEFAULT_ADMIN_ROLE
4. Non-admins cannot have admin role
5. MINTER_ROLE is properly restricted
6. Role queries never revert
7. Multiple admins supported
8. Revoking unowned role is safe

### EconomicInvariant (3 properties)
1. No free token creation (all minting has authorization)
2. Burn mechanics reduce supply correctly
3. Token economics internally consistent

### ERC20Invariant (8 properties)
1. Total supply never exceeds max
2. Sum of balances equals total supply
3. Balance conservation in transfers
4. Total supply non-negative
5. Individual balances valid
6. Zero address has zero balance
7. Balance query consistency
8. Total supply query consistency

### DiamondCoreInvariant (8 properties)
1. Owner never address(0)
2. All selectors have valid facets
3. No selector overlap
4. Facet addresses consistent
5. Minimum facets present
6. diamondCut function exists
7. Diamond loupe functions exist
8. Owner function callable

### ERC1155Invariant (4 properties)
1. Token supply never exceeds max
2. Balance query consistency
3. Zero address balance always zero
4. Individual balances never exceed total supply

### NFTFactoryInvariant (2 properties)
1. Collection IDs are unique
2. GNUS burned on collection creation

---

## Appendix C: Resources

- **Foundry Book - Invariant Testing:** https://book.getfoundry.sh/forge/invariant-testing
- **Handler Pattern Examples:** Review production codebases using Foundry invariant tests
- **@diamondslab/diamonds-hardhat-foundry README:** `/node_modules/@diamondslab/diamonds-hardhat-foundry/README.md`
- **Existing Task List:** `/project/fuzzing-prompts/tasks-foundry-fuzz-test-suite.md`
- **Original PRD:** `/project/fuzzing-prompts/prd-foundry-fuzz-test-suite.md`
