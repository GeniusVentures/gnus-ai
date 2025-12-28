# Task List: Foundry Fuzz Test Suite for GeniusDiamond

Based on the PRD, here is the complete task list with sub-tasks.

---

## Relevant Files

- `test/foundry/base/GeniusDiamondTestBase.sol` - Shared base contract extending DiamondFuzzBase with GeniusDiamond-specific setup
- `test/foundry/handlers/GeniusDiamondHandler.sol` - Handler contract for stateful invariant testing with bounded inputs
- `test/foundry/invariant/DiamondCoreInvariant.t.sol` - Diamond proxy core invariant tests
- `test/foundry/invariant/AccessControlInvariant.t.sol` - Role-based access control invariant tests
- `test/foundry/invariant/ERC20Invariant.t.sol` - GNUS ERC20 token invariant tests
- `test/foundry/invariant/ERC1155Invariant.t.sol` - ERC1155 multi-token invariant tests
- `test/foundry/invariant/NFTFactoryInvariant.t.sol` - NFT Factory invariant tests
- `test/foundry/invariant/BridgeInvariant.t.sol` - Bridge functionality invariant tests
- `test/foundry/invariant/EconomicInvariant.t.sol` - Economic/tokenomics invariant tests
- `test/foundry/fuzz/DiamondCoreFuzz.t.sol` - Diamond core operations fuzz tests
- `test/foundry/fuzz/AccessControlFuzz.t.sol` - Access control fuzz tests
- `test/foundry/fuzz/ERC20Fuzz.t.sol` - ERC20 operations fuzz tests
- `test/foundry/fuzz/ERC1155Fuzz.t.sol` - ERC1155 operations fuzz tests
- `test/foundry/fuzz/NFTFactoryFuzz.t.sol` - NFT Factory fuzz tests
- `test/foundry/fuzz/BridgeFuzz.t.sol` - Bridge operations fuzz tests
- `test/foundry/fuzz/SecurityFuzz.t.sol` - Security attack vector fuzz tests
- `test/foundry/helpers/DiamondDeployment.sol` - Auto-generated deployment constants (existing)
- `foundry.toml` - Foundry configuration with fuzz/invariant settings

### Notes

- All test files use `.t.sol` suffix per Foundry convention
- Tests extend `GeniusDiamondTestBase` which extends `DiamondFuzzBase` from `@diamondslab/diamonds-hardhat-foundry`
- Run tests with `forge test` or `forge test --match-contract <ContractName>`
- Run coverage with `forge coverage --report summary`
- Invariant tests use the Handler pattern for bounded, stateful testing

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

---

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch for the fuzz test suite (e.g., `git checkout -b feature/foundry-fuzz-tests`)
  - [x] 0.2 Verify the branch is based on `feature/add-diamonds-hardhat-foundry` to inherit existing Foundry setup

- [x] 1.0 Set up test infrastructure and base contracts
  - [x] 1.1 Create directory structure: `test/foundry/base/`, `test/foundry/handlers/`, invariant, fuzz
  - [x] 1.2 Verify DiamondDeployment.sol exists and contains correct deployment addresses
  - [x] 1.3 Create `GeniusDiamondTestBase.sol` extending `DiamondFuzzBase` from `@diamondslab/diamonds-hardhat-foundry`
  - [x] 1.4 Implement common setup in base contract: load diamond address, set up deployer impersonation, create interface casts
  - [x] 1.5 Add helper functions for role setup (grant MINTER_ROLE, DEFAULT_ADMIN_ROLE, etc.)
  - [x] 1.6 Add helper functions for token setup (mint initial GNUS tokens for testing)
  - [x] 1.7 Verify base contract compiles and can access diamond functions

- [ ] 2.0 Implement Diamond Core invariant and fuzz tests
  - [ ] 2.1 Create `DiamondCoreInvariant.t.sol` with base setup extending `GeniusDiamondTestBase`
  - [ ] 2.2 Implement `invariant_ownerNeverZero`: verify owner is never `address(0)`
  - [ ] 2.3 Implement `invariant_allSelectorsHaveValidFacets`: verify all selectors route to non-zero addresses
  - [ ] 2.4 Implement `invariant_noSelectorOverlap`: verify no duplicate selectors across facets
  - [ ] 2.5 Implement `invariant_facetAddressesConsistent`: verify loupe returns consistent facet data
  - [ ] 2.6 Create `DiamondCoreFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 2.7 Implement `testFuzz_ownershipTransfer`: fuzz ownership transfer with random addresses
  - [ ] 2.8 Implement `testFuzz_RevertWhen_nonOwnerTransfersOwnership`: verify non-owner cannot transfer
  - [ ] 2.9 Implement `testFuzz_diamondCut_addFacet`: fuzz adding facets with random selectors
  - [ ] 2.10 Implement `testFuzz_RevertWhen_nonOwnerCallsDiamondCut`: verify non-owner cannot cut
  - [ ] 2.11 Implement `testFuzz_diamondCut_replaceFacet`: fuzz replacing facet implementations
  - [ ] 2.12 Implement `testFuzz_diamondCut_removeFacet`: fuzz removing facets

- [ ] 3.0 Implement Access Control invariant and fuzz tests
  - [ ] 3.1 Create `AccessControlInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 3.2 Implement `invariant_adminRoleCanGrantAll`: verify DEFAULT_ADMIN_ROLE can grant any role
  - [ ] 3.3 Implement `invariant_roleConsistency`: verify hasRole matches granted/revoked state
  - [ ] 3.4 Create `AccessControlFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 3.5 Implement `testFuzz_grantRole`: fuzz granting roles to random addresses
  - [ ] 3.6 Implement `testFuzz_revokeRole`: fuzz revoking roles from random addresses
  - [ ] 3.7 Implement `testFuzz_renounceRole`: fuzz renouncing roles
  - [ ] 3.8 Implement `testFuzz_RevertWhen_unauthorizedGrantRole`: verify non-admin cannot grant
  - [ ] 3.9 Implement `testFuzz_RevertWhen_unauthorizedRevokeRole`: verify non-admin cannot revoke
  - [ ] 3.10 Implement `testFuzz_roleProtectedFunctions`: fuzz calling protected functions without role

- [ ] 4.0 Implement ERC20 (GNUS Token) invariant and fuzz tests
  - [ ] 4.1 Create `ERC20Invariant.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 4.2 Implement `invariant_totalSupplyNeverExceedsMax`: verify total supply <= max supply
  - [ ] 4.3 Implement `invariant_balancesSumToTotalSupply`: verify sum of all balances equals total supply
  - [ ] 4.4 Implement `invariant_balanceConservation`: verify transfers don't create/destroy tokens
  - [ ] 4.5 Create `ERC20Fuzz.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 4.6 Implement `testFuzz_transfer`: fuzz transfers with random amounts and recipients
  - [ ] 4.7 Implement `testFuzz_RevertWhen_transferExceedsBalance`: verify insufficient balance reverts
  - [ ] 4.8 Implement `testFuzz_RevertWhen_transferToZeroAddress`: verify transfer to zero reverts
  - [ ] 4.9 Implement `testFuzz_RevertWhen_transferFromZeroAddress`: verify transfer from zero reverts
  - [ ] 4.10 Implement `testFuzz_approve`: fuzz approvals with random spenders and amounts
  - [ ] 4.11 Implement `testFuzz_transferFrom`: fuzz transferFrom with random parameters
  - [ ] 4.12 Implement `testFuzz_RevertWhen_transferFromExceedsAllowance`: verify allowance check
  - [ ] 4.13 Implement `testFuzz_increaseAllowance`: fuzz increasing allowance
  - [ ] 4.14 Implement `testFuzz_decreaseAllowance`: fuzz decreasing allowance
  - [ ] 4.15 Implement `testFuzz_batchTransfer`: fuzz batch transfers (ERC20TransferBatch)
  - [ ] 4.16 Implement `testFuzz_mint`: fuzz minting with MINTER_ROLE
  - [ ] 4.17 Implement `testFuzz_RevertWhen_mintWithoutRole`: verify minting without role reverts

- [ ] 5.0 Implement ERC1155 invariant and fuzz tests
  - [ ] 5.1 Create `ERC1155Invariant.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 5.2 Implement `invariant_tokenSupplyNeverExceedsMax`: verify each token ID respects max supply
  - [ ] 5.3 Implement `invariant_balanceConsistency`: verify balanceOf returns correct values
  - [ ] 5.4 Create `ERC1155Fuzz.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 5.5 Implement `testFuzz_safeTransferFrom`: fuzz single token transfers
  - [ ] 5.6 Implement `testFuzz_safeBatchTransferFrom`: fuzz batch token transfers
  - [ ] 5.7 Implement `testFuzz_setApprovalForAll`: fuzz operator approvals
  - [ ] 5.8 Implement `testFuzz_RevertWhen_transferWithoutApproval`: verify unauthorized transfers revert
  - [ ] 5.9 Implement `testFuzz_proxyOperator`: fuzz ERC1155ProxyOperator functionality
  - [ ] 5.10 Implement `testFuzz_RevertWhen_transferExceedsBalance`: verify insufficient balance reverts

- [ ] 6.0 Implement NFT Factory invariant and fuzz tests
  - [ ] 6.1 Create `NFTFactoryInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 6.2 Implement `invariant_collectionIdsUnique`: verify NFT collection IDs are unique
  - [ ] 6.3 Implement `invariant_collectionIdsIncrementing`: verify collection IDs increment
  - [ ] 6.4 Implement `invariant_gnusBurnedOnCollectionCreate`: verify GNUS burned correctly
  - [ ] 6.5 Create `NFTFactoryFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 6.6 Implement `testFuzz_createNFTCollection`: fuzz collection creation with random params
  - [ ] 6.7 Implement `testFuzz_RevertWhen_insufficientGnusForCollection`: verify insufficient GNUS reverts
  - [ ] 6.8 Implement `testFuzz_mintNFT`: fuzz minting NFTs in collections
  - [ ] 6.9 Implement `testFuzz_RevertWhen_nonOwnerMintsNFT`: verify only collection owner can mint
  - [ ] 6.10 Implement `testFuzz_collectionMetadata`: fuzz collection name and URI setting
  - [ ] 6.11 Implement `testFuzz_RevertWhen_mintExceedsMaxSupply`: verify max supply enforcement

- [ ] 7.0 Implement Bridge invariant and fuzz tests
  - [ ] 7.1 Create `BridgeInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 7.2 Implement `invariant_bridgeLockedTokensConsistent`: verify locked tokens tracked correctly
  - [ ] 7.3 Implement `invariant_totalSupplyConsistentAcrossBridge`: verify bridge maintains supply
  - [ ] 7.4 Create `BridgeFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 7.5 Implement `testFuzz_bridgeDeposit`: fuzz bridge deposits with random amounts
  - [ ] 7.6 Implement `testFuzz_RevertWhen_depositExceedsBalance`: verify insufficient balance reverts
  - [ ] 7.7 Implement `testFuzz_bridgeWithdraw`: fuzz bridge withdrawals (if applicable)
  - [ ] 7.8 Implement `testFuzz_RevertWhen_invalidBridgeProof`: verify invalid proofs rejected
  - [ ] 7.9 Implement `testFuzz_bridgeAmountEdgeCases`: fuzz zero amounts, max amounts

- [ ] 8.0 Implement Economic invariant tests
  - [ ] 8.1 Create `EconomicInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 8.2 Implement `invariant_gnusBurnRateCorrect`: verify NFT creation burns correct GNUS amount
  - [ ] 8.3 Implement `invariant_noFreeTokenCreation`: verify tokens cannot be created without cost
  - [ ] 8.4 Implement `invariant_exchangeRatesMaintained`: verify exchange rates consistent
  - [ ] 8.5 Implement `invariant_feesMaintained`: verify fee calculations correct
  - [ ] 8.6 Implement `invariant_burnMechanicsCorrect`: verify burn operations reduce supply

- [ ] 9.0 Implement Security attack vector fuzz tests
  - [ ] 9.1 Create `SecurityFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [ ] 9.2 Implement `testFuzz_reentrancyOnTransfer`: test reentrancy on ERC20 transfers
  - [ ] 9.3 Implement `testFuzz_reentrancyOnERC1155Transfer`: test reentrancy on ERC1155 transfers
  - [ ] 9.4 Implement `testFuzz_reentrancyOnMint`: test reentrancy on minting operations
  - [ ] 9.5 Implement `testFuzz_overflowOnBalances`: test arithmetic overflow on balances
  - [ ] 9.6 Implement `testFuzz_overflowOnAllowances`: test arithmetic overflow on allowances
  - [ ] 9.7 Implement `testFuzz_accessControlBypass`: test access control with random callers
  - [ ] 9.8 Implement `testFuzz_diamondCutBypass`: test unauthorized diamond modifications
  - [ ] 9.9 Implement `testFuzz_selfAsRecipient`: test contract as sender/receiver edge cases
  - [ ] 9.10 Implement `testFuzz_zeroAmountOperations`: test all operations with zero amounts
  - [ ] 9.11 Implement `testFuzz_maxUint256Operations`: test operations with max uint256 values
  - [ ] 9.12 Implement `testFuzz_signatureReplay`: test signature replay on bridge (if applicable)

- [ ] 10.0 Create Handler contract for stateful invariant testing
  - [ ] 10.1 Create `GeniusDiamondHandler.sol` in `test/foundry/handlers/`
  - [ ] 10.2 Implement ghost variables to track expected state (totalMinted, totalBurned, etc.)
  - [ ] 10.3 Implement `handle_transfer`: bounded transfer handler
  - [ ] 10.4 Implement `handle_approve`: bounded approval handler
  - [ ] 10.5 Implement `handle_mint`: bounded minting handler (with role setup)
  - [ ] 10.6 Implement `handle_burn`: bounded burning handler
  - [ ] 10.7 Implement `handle_createCollection`: bounded NFT collection creation handler
  - [ ] 10.8 Implement `handle_bridgeDeposit`: bounded bridge deposit handler
  - [ ] 10.9 Implement input bounding functions using `bound()` from forge-std
  - [ ] 10.10 Implement action weighting for realistic usage patterns
  - [ ] 10.11 Add call summary logging for debugging failed invariants
  - [ ] 10.12 Wire handler into invariant test contracts using `targetContract()`

- [ ] 11.0 Configure Foundry and integrate with CI/CD
  - [ ] 11.1 Update foundry.toml with fuzz configuration (runs = 10000)
  - [ ] 11.2 Update foundry.toml with invariant configuration (runs = 1000, depth = 50)
  - [ ] 11.3 Configure remappings for `@diamondslab/diamonds-hardhat-foundry` and other dependencies
  - [ ] 11.4 Add seed configuration for reproducible test runs
  - [ ] 11.5 Configure `fail_on_revert = false` for invariant tests
  - [ ] 11.6 Add GitHub Actions workflow step for Foundry fuzz tests
  - [ ] 11.7 Add coverage reporting step using `forge coverage`
  - [ ] 11.8 Configure coverage thresholds (85% minimum)
  - [ ] 11.9 Test CI integration locally with `act` or manual workflow trigger

- [ ] 12.0 Validate coverage targets and finalize documentation
  - [ ] 12.1 Run full test suite with `forge test -vvv`
  - [ ] 12.2 Generate coverage report with `forge coverage --report summary`
  - [ ] 12.3 Identify coverage gaps and add additional tests as needed
  - [ ] 12.4 Verify 85% overall coverage target is met
  - [ ] 12.5 Verify per-facet coverage targets (see PRD Section 8.1)
  - [ ] 12.6 Document any known limitations or exclusions
  - [ ] 12.7 Update README with instructions for running fuzz tests
  - [ ] 12.8 Create PR with complete fuzz test suite
  - [ ] 12.9 Address code review feedback
