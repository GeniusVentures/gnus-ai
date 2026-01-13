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

- [x] 2.0 Implement Diamond Core invariant and fuzz tests
  - [x] 2.1 Create `DiamondCoreInvariant.t.sol` with base setup extending `GeniusDiamondTestBase`
  - [x] 2.2 Implement `invariant_ownerNeverZero`: verify owner is never `address(0)`
  - [x] 2.3 Implement `invariant_allSelectorsHaveValidFacets`: verify all selectors route to non-zero addresses
  - [x] 2.4 Implement `invariant_noSelectorOverlap`: verify no duplicate selectors across facets
  - [x] 2.5 Implement `invariant_facetAddressesConsistent`: verify loupe returns consistent facet data
  - [x] 2.6 Create `DiamondCoreFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [x] 2.7 Implement `testFuzz_ownershipTransfer`: fuzz ownership transfer with random addresses
  - [x] 2.8 Implement `testFuzz_RevertWhen_nonOwnerTransfersOwnership`: verify non-owner cannot transfer
  - [x] 2.9 Implement `testFuzz_diamondCut_addFacet`: fuzz adding facets with random selectors
  - [x] 2.10 Implement `testFuzz_RevertWhen_nonOwnerCallsDiamondCut`: verify non-owner cannot cut
  - [x] 2.11 Implement `testFuzz_diamondCut_replaceFacet`: fuzz replacing facet implementations
  - [x] 2.12 Implement `testFuzz_diamondCut_removeFacet`: fuzz removing facets

- [x] 3.0 Implement Access Control invariant and fuzz tests
  - [x] 3.1 Create `AccessControlInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [x] 3.2 Implement `invariant_adminRoleCanGrantAll`: verify DEFAULT_ADMIN_ROLE can grant any role
  - [x] 3.3 Implement `invariant_roleConsistency`: verify hasRole matches granted/revoked state
  - [x] 3.4 Create `AccessControlFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [x] 3.5 Implement `testFuzz_grantRole`: fuzz granting roles to random addresses
  - [x] 3.6 Implement `testFuzz_revokeRole`: fuzz revoking roles from random addresses
  - [x] 3.7 Implement `testFuzz_renounceRole`: fuzz renouncing roles
  - [x] 3.8 Implement `testFuzz_RevertWhen_unauthorizedGrantRole`: verify non-admin cannot grant
  - [x] 3.9 Implement `testFuzz_RevertWhen_unauthorizedRevokeRole`: verify non-admin cannot revoke
  - [x] 3.10 Implement `testFuzz_roleProtectedFunctions`: fuzz calling protected functions without role

- [x] 4.0 Implement ERC20 (GNUS Token) invariant and fuzz tests
  - [x] 4.1 Create `ERC20Invariant.t.sol` extending `GeniusDiamondTestBase`
  - [x] 4.2 Implement `invariant_totalSupplyNeverExceedsMax`: verify total supply <= max supply
  - [x] 4.3 Implement `invariant_balancesSumToTotalSupply`: verify sum of all balances equals total supply
  - [x] 4.4 Implement `invariant_balanceConservation`: verify transfers don't create/destroy tokens
  - [x] 4.5 Create `ERC20Fuzz.t.sol` extending `GeniusDiamondTestBase`
  - [x] 4.6 Implement `testFuzz_transfer`: fuzz transfers with random amounts and recipients
  - [x] 4.7 Implement `testFuzz_RevertWhen_transferExceedsBalance`: verify insufficient balance reverts
  - [x] 4.8 Implement `testFuzz_RevertWhen_transferToZeroAddress`: verify transfer to zero reverts
  - [x] 4.9 Implement `testFuzz_RevertWhen_transferFromZeroAddress`: verify transfer from zero reverts
  - [x] 4.10 Implement `testFuzz_approve`: fuzz approvals with random spenders and amounts
  - [x] 4.11 Implement `testFuzz_transferFrom`: fuzz transferFrom with random parameters
  - [x] 4.12 Implement `testFuzz_RevertWhen_transferFromExceedsAllowance`: verify allowance check
  - [x] 4.13 Implement `testFuzz_increaseAllowance`: fuzz increasing allowance
  - [x] 4.14 Implement `testFuzz_decreaseAllowance`: fuzz decreasing allowance
  - [x] 4.15 Implement `testFuzz_batchTransfer`: fuzz batch transfers (ERC20TransferBatch)
  - [x] 4.16 Implement `testFuzz_mint`: fuzz minting with MINTER_ROLE
  - [x] 4.17 Implement `testFuzz_RevertWhen_mintWithoutRole`: verify minting without role reverts

- [x] 5.0 Implement ERC1155 invariant and fuzz tests
  - [x] 5.1 Create `ERC1155Invariant.t.sol` extending `GeniusDiamondTestBase`
  - [x] 5.2 Implement `invariant_tokenSupplyNeverExceedsMax`: verify each token ID respects max supply
  - [x] 5.3 Implement `invariant_balanceConsistency`: verify balanceOf returns correct values
  - [x] 5.4 Create `ERC1155Fuzz.t.sol` extending `GeniusDiamondTestBase`
  - [x] 5.5 Implement `testFuzz_safeTransferFrom`: fuzz single token transfers
  - [x] 5.6 Implement `testFuzz_safeBatchTransferFrom`: fuzz batch token transfers
  - [x] 5.7 Implement `testFuzz_setApprovalForAll`: fuzz operator approvals
  - [x] 5.8 Implement `testFuzz_RevertWhen_transferWithoutApproval`: verify unauthorized transfers revert
  - [x] 5.9 Implement `testFuzz_proxyOperator`: fuzz ERC1155ProxyOperator functionality
  - [x] 5.10 Implement `testFuzz_RevertWhen_transferExceedsBalance`: verify insufficient balance reverts

- [x] 6.0 Implement NFT Factory invariant and fuzz tests
  - [x] 6.1 Create `NFTFactoryInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [x] 6.2 Implement `invariant_collectionIdsUnique`: verify NFT collection IDs are unique
  - [x] 6.3 Implement `invariant_collectionIdsIncrementing`: verify collection IDs increment
  - [x] 6.4 Implement `invariant_gnusBurnedOnCollectionCreate`: verify GNUS burned correctly
  - [x] 6.5 Create `NFTFactoryFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [x] 6.6 Implement `testFuzz_createNFTCollection`: fuzz collection creation with random params
  - [x] 6.7 Implement `testFuzz_RevertWhen_insufficientGnusForCollection`: verify insufficient GNUS reverts
  - [x] 6.8 Implement `testFuzz_mintNFT`: fuzz minting NFTs in collections
  - [x] 6.9 Implement `testFuzz_RevertWhen_nonOwnerMintsNFT`: verify only collection owner can mint
  - [x] 6.10 Implement `testFuzz_collectionMetadata`: fuzz collection name and URI setting
  - [x] 6.11 Implement `testFuzz_RevertWhen_mintExceedsMaxSupply`: verify max supply enforcement

- [x] 7.0 Implement Bridge invariant and fuzz tests
  - [x] 7.1 Create `BridgeInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [x] 7.2 Implement `invariant_bridgeLockedTokensConsistent`: verify locked tokens tracked correctly
  - [x] 7.3 Implement `invariant_totalSupplyConsistentAcrossBridge`: verify bridge maintains supply
  - [x] 7.4 Create `BridgeFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [x] 7.5 Implement `testFuzz_bridgeDeposit`: fuzz bridge deposits with random amounts
  - [x] 7.6 Implement `testFuzz_RevertWhen_depositExceedsBalance`: verify insufficient balance reverts
  - [x] 7.7 Implement `testFuzz_bridgeWithdraw`: fuzz bridge withdrawals (if applicable)
  - [x] 7.8 Implement `testFuzz_RevertWhen_invalidBridgeProof`: verify invalid proofs rejected
  - [x] 7.9 Implement `testFuzz_bridgeAmountEdgeCases`: fuzz zero amounts, max amounts

- [x] 8.0 Implement Economic invariant tests
  - [x] 8.1 Create `EconomicInvariant.t.sol` extending `GeniusDiamondTestBase`
  - [x] 8.2 Implement `invariant_gnusBurnRateCorrect`: verify NFT creation burns correct GNUS amount
  - [x] 8.3 Implement `invariant_noFreeTokenCreation`: verify tokens cannot be created without cost
  - [x] 8.4 Implement `invariant_exchangeRatesMaintained`: verify exchange rates consistent
  - [x] 8.5 Implement `invariant_feesMaintained`: verify fee calculations correct
  - [x] 8.6 Implement `invariant_burnMechanicsCorrect`: verify burn operations reduce supply

- [x] 9.0 Implement Security attack vector fuzz tests
  - [x] 9.1 Create `SecurityFuzz.t.sol` extending `GeniusDiamondTestBase`
  - [x] 9.2 Implement `testFuzz_reentrancyOnTransfer`: test reentrancy on ERC20 transfers
  - [x] 9.3 Implement `testFuzz_reentrancyOnERC1155Transfer`: test reentrancy on ERC1155 transfers
  - [x] 9.4 Implement `testFuzz_reentrancyOnMint`: test reentrancy on minting operations
  - [x] 9.5 Implement `testFuzz_overflowOnBalances`: test arithmetic overflow on balances
  - [x] 9.6 Implement `testFuzz_overflowOnAllowances`: test arithmetic overflow on allowances
  - [x] 9.7 Implement `testFuzz_accessControlBypass`: test access control with random callers
  - [x] 9.8 Implement `testFuzz_diamondCutBypass`: test unauthorized diamond modifications
  - [x] 9.9 Implement `testFuzz_selfAsRecipient`: test contract as sender/receiver edge cases
  - [x] 9.10 Implement `testFuzz_zeroAmountOperations`: test all operations with zero amounts
  - [x] 9.11 Implement `testFuzz_maxUint256Operations`: test operations with max uint256 values
  - [x] 9.12 Implement `testFuzz_signatureReplay`: test signature replay on bridge (if applicable)

- [x] 10.0 Create Handler contract for stateful invariant testing
  - [x] 10.1 Create `GeniusDiamondHandler.sol` in `test/foundry/handlers/`
  - [x] 10.2 Implement ghost variables to track expected state (totalMinted, totalBurned, etc.)
  - [x] 10.3 Implement `handle_transfer`: bounded transfer handler
  - [x] 10.4 Implement `handle_approve`: bounded approval handler
  - [x] 10.5 Implement `handle_mint`: bounded minting handler (with role setup)
  - [x] 10.6 Implement `handle_burn`: bounded burning handler
  - [x] 10.7 Implement `handle_createCollection`: bounded NFT collection creation handler
  - [x] 10.8 Implement `handle_bridgeDeposit`: bounded bridge deposit handler
  - [x] 10.9 Implement input bounding functions using `bound()` from forge-std
  - [x] 10.10 Implement action weighting for realistic usage patterns
  - [x] 10.11 Add call summary logging for debugging failed invariants
  - [x] 10.12 Wire handler into invariant test contracts using `targetContract()`

- [x] 11.0 Configure Foundry and integrate with CI/CD
  - [x] 11.1 Update foundry.toml with fuzz configuration (runs = 10000)
  - [x] 11.2 Update foundry.toml with invariant configuration (runs = 1000, depth = 50)
  - [x] 11.3 Configure remappings for `@diamondslab/diamonds-hardhat-foundry` and other dependencies
  - [x] 11.4 Add seed configuration for reproducible test runs
  - [x] 11.5 Configure `fail_on_revert = false` for invariant tests
  - [x] 11.6 Add GitHub Actions workflow step for Foundry fuzz tests
  - [x] 11.7 Add coverage reporting step using `forge coverage`
  - [x] 11.8 Configure coverage thresholds (85% minimum)
  - [x] 11.9 Test CI integration locally with `act` or manual workflow trigger

- [x] 12.0 Validate coverage targets and finalize documentation
  - [x] 12.1 Run full test suite with `forge test -vvv`
  - [x] 12.2 Generate coverage report with `forge coverage --report summary`
  - [x] 12.3 Identify coverage gaps and add additional tests as needed
  - [x] 12.4 Verify 85% overall coverage target is met
  - [x] 12.5 Verify per-facet coverage targets (see PRD Section 8.1)
  - [x] 12.6 Document any known limitations or exclusions
  - [x] 12.7 Update README with instructions for running fuzz tests
  - [x] 12.8 Create PR with complete fuzz test suite
  - [x] 12.9 Address code review feedback
