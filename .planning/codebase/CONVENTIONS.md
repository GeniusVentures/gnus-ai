# Coding Conventions

**Analysis Date:** 2026-05-26

## Naming Patterns

### Solidity

**Files:**
- Contracts: PascalCase matching contract name (`GeniusAccessControl.sol`, `GNUSNFTFactory.sol`, `GNUSWithdrawLimiterStorage.sol`)
- Libraries: PascalCase (`TransferHelper.sol`, `GNUSWithdrawLimiterStorage.sol` [library, not contract])
- Mocks: PascalCase with `Mock` prefix (`MockERC20.sol`, `MockBadERC20.sol`, `MockNonPayable.sol`)
- Interface files: Names reflect interface name

**Contracts:**
- PascalCase: `GeniusDiamond`, `GNUSNFTFactory`, `GeniusAccessControl`, `GNUSWithdrawLimiter`
- Libraries: PascalCase, appended to contract if storage-only (`GNUSNFTFactoryStorage`, `GNUSWithdrawLimiterStorage`)
- Use `GNUS` prefix for GNUS-token-specific contracts, `Genius` prefix for diamond/infrastructure contracts

**Functions:**
- camelCase for public/external functions: `createNFT()`, `setURI()`, `withdrawToken()`, `pause()`
- Internal initializers use `__` double-underscore prefix: `__GeniusAccessControl_init()`, `__GeniusAccessControl_init_unchained()`
- Versioned initializers use `_InitializeXXX` suffix: `GNUSNFTFactory_Initialize()`, `GNUSNFTFactory_Initialize230()`
- Internal helper functions prefixed with `_`: `_mintGNUS()`, `_transferGNUS()`, `_setupInitialBalances()`
- Foundry test functions: `test_` prefix for unit tests, `testFuzz_` for fuzz tests, `invariant_` for invariants
- Handler functions in stateful fuzz tests: `handler_` prefix (`handler_transfer()`, `handler_mint()`)

**Constants:**
- UPPER_SNAKE_CASE: `DEFAULT_ADMIN_ROLE`, `CREATOR_ROLE`, `UPGRADER_ROLE`, `GNUS_TOKEN_ID`
- Role identifiers via `keccak256("ROLE_NAME")`: `bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE")`
- Storage position constants: `GNUS_WITHDRAW_LIMITER_STORAGE_POSITION`, `GNUS_NFT_FACTORY_STORAGE_POSITION`

**Variables/State:**
- camelCase: `defaultLimitAmount`, `defaultWindowSeconds`, `limiterEnabled`
- Layout struct members follow same camelCase pattern
- Mappings: descriptive names (`accountStates`, `accountConfigs`)

### TypeScript

**Files:**
- kebab-case for test and script files: `gnus-withdraw-limiter.test.ts`, `network-utils.ts`, `gnus-bridge-enhanced.test.ts`
- Deployment/utility files: `PascalCase.ts` for large utility modules (`RPCDiamondDeployer.ts`) and `camelCase.ts` for simple helpers (`common.ts`, `helpers.ts`)

**Functions:**
- camelCase: `getInterfaceID()`, `toWei()`, `waitForNetwork()`, `loadDiamondContract()`

**Interfaces/Types:**
- `I` prefix for interfaces: `IFacetDeployedInfo`, `INetworkDeployInfo`, `IVersionInfo`, `IDefenderViaInfo`
- No prefix for type aliases: `FacetDeployedInfo`, `FacetToDeployInfo`, `DeployedContracts`

**Constants:**
- UPPER_SNAKE_CASE in TypeScript: `GNUS_TOKEN_ID`
- Module-level `const` uses camelCase: `diamondCutFuncAbi`, `dc` (for DeployedContracts)

## Code Style

### Solidity

**Pragma:**
- `^0.8.19` in production contracts
- `^0.8.2` in older contracts and storage libraries
- `^0.8.0` in Foundry test files

**License:**
- Always `// SPDX-License-Identifier: MIT` as first line

**Formatting:**
- Tool: `prettier-plugin-solidity` v1.4.3 + `forge fmt`
- Tab width: 4 spaces (via `foundry.toml` `tab_width = 4` and `.prettierrc` override for `*.sol`)
- Line length: 100 (`.prettierrc` sol override) / 120 (`foundry.toml` `line_length = 120`)
- Bracket spacing: true
- Quote style: double quotes (`foundry.toml` `quote_style = "double"`)
- Integer types: long form (`foundry.toml` `int_types = "long"`)
- Number underscore: thousands (`foundry.toml` `number_underscore = "thousands"`)

**Linting:**
- Tool: `solhint` v5.2.0
- Config: `.solhint.json` extending `solhint:recommended`
- Key rules: `compiler-version` ^0.8.0 enforced as error, `func-visibility` as warning
- Additional: `.semgrep.yml` with 20+ custom rules for diamond patterns, security, access control
- Semgrep checks: diamond-storage-violation, reentrancy-risk, unsafe-external-call, missing-access-control, etc.
- Foundry lint: excludes `test/foundry` path

**NatSpec Documentation:**
- Heavy use of `/// @title`, `/// @notice`, `/// @dev`, `/// @param`, `/// @return`, `/// @custom:security-contact`
- Every contract has a `@title` and `@notice` description
- State-changing functions have `@notice` describing behavior
- Structs use `///<` inline field documentation
- Invariant tests include extensive NatSpec with `PROPERTY TESTED`, `WHY IT MUST HOLD`, `WHAT BREAKS IF VIOLATED` sections
- Security contact: `@custom:security-contact support@gnus.ai` on sensitive contracts

### TypeScript

**Formatting:**
- Tool: `prettier` v3.7.4
- Tab width: 2 spaces with tabs (via `.prettierrc`: `tabWidth: 2`, `useTabs: true`)
- Single quotes: true
- Semicolons: required (`semi: true`)
- Trailing commas: all
- Print width: 92

**Linting:**
- Tool: `eslint` v9.39.2 with `@typescript-eslint` plugin
- Config: `eslint.config.mjs` (flat config format)
- Extends: `plugin:@typescript-eslint/recommended`, `plugin:prettier/recommended`
- Disabled rules: `@typescript-eslint/no-namespace` (off), `@typescript-eslint/no-var-requires` (off), `@typescript-eslint/no-unused-expressions` (off)
- Ignores: `node_modules`, `artifacts`, `cache`, `coverage`
- Additional custom rules: `eslint-diamond-rules.js` (diamond-storage-pattern, diamond-selector-validation, secure-external-calls)
- Precommit: `lint-staged` runs prettier on `*.{ts,js}`, `git secrets` on non-artifact files, semgrep on `*.sol`

**TypeScript Config:**
- Target: `es2020`
- Module: `commonjs`
- Strict: true
- Root dirs: `scripts/`, `test/`, `test-suites/`, `typechain-types/`
- Skip lib check: true (for typechain compatibility)

## Import Organization

### Solidity

**Standard order:**
1. External dependencies from `node_modules` (`@gnus.ai/`, `@diamondslab/`, `contracts-starter/`)
2. Internal library references (`./libraries/TransferHelper.sol`)
3. Internal contract references (`./GeniusAccessControl.sol`, `./GNUSConstants.sol`)

**Import style (production contracts):**
```solidity
import "@gnus.ai/contracts-upgradeable-diamond/access/AccessControlUpgradeable.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";
import "./GNUSNFTFactoryStorage.sol";
import "./GeniusAccessControl.sol";
```

**Import style (Foundry test files):**
```solidity
import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
import {DiamondFuzzBase} from "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
```

- Bare imports in older Solidity files, named imports in Foundry test files
- Remappings defined in `foundry.toml`: `@gnus.ai/`, `@diamondslab/`, `@helpers/`, `forge-std/`

### TypeScript

**Standard order:**
1. Third-party packages (chai, ethers, hardhat)
2. @diamondslab packages
3. Hardhat plugins (@nomicfoundation, typechain)
4. Internal project modules (`../../diamond-typechain-types`, `../../scripts/utils/helpers`)

No path aliases configured in tsconfig.

## Error Handling

### Solidity

**Three patterns observed:**

1. **`require()` statements** (most common in older/central contracts):
   ```solidity
   require(id != GNUS_TOKEN_ID, "Shouldn't mint GNUS tokens tokens, only deposit and withdraw");
   require(nft.nftCreated, "Cannot mint NFT that doesn't exist");
   ```

2. **Custom `error` definitions** (newer contracts like `GNUSContractAssets.sol`):
   ```solidity
   error ErrorWithdrawingEther();
   error CannotWithdrawGNUS();
   
   if (token == address(this)) {
       revert CannotWithdrawGNUS();
   }
   ```

3. **`revert()` with string** (used in storage libraries):
   ```solidity
   revert("Withdrawal limit exceeded for time window");
   ```

**Access control errors:**
- Modifier-based: `onlySuperAdminRole`, `onlyRole(DEFAULT_ADMIN_ROLE)` — reverts with descriptive message
- Inherited from `AccessControlUpgradeable` with standard messages

### TypeScript

**Standard pattern:**
```typescript
try {
    await execPromise('npx ts-node scripts/generate-diamond-abi-with-typechain.ts GeniusDiamond');
} catch (error) {
    console.log('Warning: Diamond ABI generation error:', error);
}
```

- `try/catch` with `console.log` warnings for non-critical failures
- `chai-as-promised` used for async rejection assertions in tests
- Debug logging via `debug` package: `const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}')`

## Logging

**Solidity:**
- `console.log` from `forge-std` used extensively in Foundry tests (setup, test execution, assertions)
- Events with indexed parameters for on-chain logging: `emit WithdrawLimiterConfigUpdated(...)`, `emit AccountConfigUpdated(...)`
- `[OK]`, `[ERR]`, `[WARN]`, `[SKIP]` prefix conventions in test console output

**TypeScript:**
- `debug` package (`const log = debug('namespace:log')`) for structured debug output
- `console.log` for development-time setup/info messages
- `winston` v3.19.0 listed as devDependency but not widely used in codebase

## Comments

**When to Comment:**
- Every public/external Solidity function has a NatSpec `@notice` block
- Complex logic gets inline `/// @dev` explanations
- Handler functions in fuzz tests have detailed `INPUT BOUNDS`, `RATIONALE`, and `GHOST VARIABLE UPDATES` sections
- TypeScript test files have `// Arrange / Act / Assert` comments in template

**Style:**
- Solidity: `///` for NatSpec, `//` for inline, `/* */` for block
- TypeScript: `//` for inline, `/** */` for JSDoc on utility functions
- `// TODO:` markers for stubs and incomplete tests (found in template files)

## Function Design

### Solidity

**Visibility:**
- Public functions declared with `public`, external with `external`
- Internal initializers use `internal`
- State-mutating functions must have access control modifiers or require statements

**Modifiers:**
- Custom modifiers defined in `GeniusAccessControl.sol`: `onlySuperAdminRole`
- Inherited from OpenZeppelin: `onlyRole(role)`, `onlyInitializing`
- Foundry's `vm.prank()` used in tests instead of modifier conditions

**Parameters:**
- Memory arrays for multi-value parameters: `string[] memory names`, `uint256[] memory amounts`
- `bytes memory data` for optional data parameters
- Address parameters typically come first, then token IDs, then amounts

**Return Values:**
- Named returns used in public functions: `returns (uint256 binCount, uint64 windowSeconds, uint256 limitAmount)`
- Multiple return values via tuples for configuration queries

### TypeScript

**Async/Await:**
- All test and deployment code uses `async/await`
- Promise chains avoided; explicit `await` preferred

**Size:**
- Test files range from ~30 to 520+ lines
- Solidity contracts range from ~30 to 240+ lines
- Storage libraries kept focused on one storage domain

## Module Design

### Solidity

**Diamond Storage Pattern:**
- Each facet uses a dedicated storage library with `Layout` struct
- Storage slot via `keccak256("unique.storage.identifier")`
- Access via `library.layout()` returning `Layout storage`
- Example: `GNUSWithdrawLimiterStorage`, `GNUSNFTFactoryStorage`

**Facet Pattern:**
- Contracts extend `GeniusAccessControl` for role-based access
- Use `Initializable` from OpenZeppelin upgradeable for initialization
- Versioned initializer functions for upgrades: `GNUSNFTFactory_Initialize230()`

**Exports:**
- No barrel files; imports reference specific files
- All contracts self-contained with explicit imports

### TypeScript

**Exports:**
- Named exports preferred (`export function`, `export const`)
- `export default` used only for Hardhat config
- Type exports via `export type` and `export interface`

**Barrel Files:**
- Not used; each file is imported directly by path

## Pre-Commit and Git Hooks

**Husky + lint-staged:**
- `.husky/` directory present for git hooks
- `lint-staged` configured in `.lintstagedrc.json`:
  - `*.{ts,js}` → prettier format + git-secrets scan
  - `*.sol` → semgrep security scan
- `precommit` script: `lint-staged && yarn audit && yarn test`

**Commit Messages:**
- Conventional commits enforced via `commitlint` with `@commitlint/config-conventional`
- Allowed types: build, chore, ci, docs, feat, fix, perf, refactor, revert, security, style, test
- Max header length: 100 chars
- No trailing period in subject

---

*Convention analysis: 2026-05-26*
