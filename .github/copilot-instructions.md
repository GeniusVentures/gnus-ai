# GNUS.ai Smart Contracts - AI Coding Agent Instructions

## Project Overview

GNUS.ai is an **ERC-2535 Diamond Standard** smart contract system implementing a hybrid token framework:

- **GNUS Token**: ERC-20 compatible fungible token (50M max supply)
- **Hierarchical NFTs**: ERC-1155 multi-token with parent-child relationships
- **Burn-for-Mint**: Convert GNUS tokens to NFTs at defined exchange rates
- **Multi-chain**: Ethereum, Polygon, Base, BSC with bridge support

**Architecture Philosophy**: Modular facet-based upgradability using Diamond proxy pattern. Each facet handles distinct functionality (ownership, access control, NFT factory, AI escrow, bridge operations).

**Diamond Management System**: Uses the `@diamondslab` package suite providing comprehensive tooling for ERC-2535 Diamond development:

- **@diamondslab/hardhat-diamonds**: Deployment, ABI generation, configuration management
- **@diamondslab/diamonds-hardhat-foundry**: Foundry integration, fuzz testing base contracts
- **@diamondslab/diamonds-monitor**: Runtime monitoring and analytics

## Critical Development Workflows

### Building & Testing

```bash
# Clean rebuild (required after Diamond config changes)
yarn clean-compile

# Run Hardhat tests across multiple chains
yarn test                          # Alias for test-multichain
yarn test-multichain test/unit/*.test.ts --chains sepolia,polygon_amoy

# Foundry fuzz tests (use for property-based testing)
yarn forge:test                    # Basic Foundry tests
yarn forge:fuzz                    # Fuzz tests with 256 runs
yarn forge:coverage                # Coverage report

# Coverage baseline
yarn coverage                      # Hardhat coverage via Solidity Coverage
```

### Diamond Configuration & Management

**Core Configuration**: `diamonds/GeniusDiamond/geniusdiamond.config.json`

- **Priority**: Determines facet cut order (10, 20, 30...)
- **Versions**: Track facet iterations (0.0, 2.0, 2.3)
- **deployInit/upgradeInit**: Init function signatures for deployment/upgrades
- **fromVersions**: Specifies which versions can upgrade to current

**@diamondslab Hardhat Tasks** (from `@diamondslab/hardhat-diamonds`):

```bash
# Generate combined Diamond ABI from all facets
npx hardhat diamond:generate-abi --diamond-name GeniusDiamond

# Generate TypeChain types from Diamond ABI
npx hardhat diamond:generate-abi-typechain --diamond-name GeniusDiamond

# Foundry test helpers auto-generation
npx hardhat diamonds-forge:generate-helpers --diamond-name GeniusDiamond

# Deploy Diamond via Foundry (testing)
npx hardhat diamonds-forge:deploy --diamond-name GeniusDiamond --network localhost

# Run Foundry tests via Hardhat integration
npx hardhat diamonds-forge:test --diamond-name GeniusDiamond --network localhost --force
npx hardhat diamonds-forge:fuzz --diamond-name GeniusDiamond --network localhost
```

After modifying facets, ALWAYS run `yarn clean-compile` to regenerate Diamond ABI and TypeChain types.

### Test Structure Patterns

**Hardhat/TypeScript Tests** - Multi-chain nested describe pattern:

```typescript
import {
  LocalDiamondDeployer,
  loadDiamondContract,
} from "@diamondslab/hardhat-diamonds/dist/utils";

describe("Contract Tests", function () {
  const networkNames = process.argv[
    process.argv.indexOf("--chains") + 1
  ]?.split(",") || ["hardhat"];

  for (const networkName of networkNames) {
    describe(`🔗 Chain: ${networkName}`, function () {
      let geniusDiamond: GeniusDiamond;
      let owner: SignerWithAddress;

      before(async function () {
        // Deploy Diamond using LocalDiamondDeployer (Multiton pattern)
        const config = { diamondName: "GeniusDiamond", network: networkName };
        const deployer = await LocalDiamondDeployer.getInstance(hre, config);

        // Load typed contract instance with full ABI
        geniusDiamond = await loadDiamondContract<GeniusDiamond>(
          hre,
          "GeniusDiamond",
          deployer.deployedDiamond.address,
        );
        owner = deployer.accounts[0];
      });

      beforeEach(async () => {
        await hre.network.provider.send("evm_snapshot"); // Test isolation
      });
    });
  }
});
```

**Foundry/Solidity Tests** - Extend DiamondFuzzBase:

```solidity
import {DiamondFuzzBase} from "@diamondslab/diamonds-hardhat-foundry/contracts/DiamondFuzzBase.sol";
import {DiamondDeployment} from "../helpers/DiamondDeployment.sol"; // Auto-generated

contract MyTest is DiamondFuzzBase {
  function _loadDiamondAddress() internal pure override returns (address) {
    return DiamondDeployment.getDiamondAddress(); // From generated helper
  }

  function _getDiamondABIPath() internal pure override returns (string memory) {
    return DiamondDeployment.getDiamondABIPath(); // "diamond-abi/GeniusDiamond.json"
  }

  function setUp() public virtual override {
    super.setUp(); // Loads Diamond and parses ABI automatically
    // Your setup here
  }
}
```

See `test/utils/test-template.ts` (Hardhat) and `test/foundry/base/GeniusDiamondTestBase.sol` (Foundry) for canonical templates.

## Project-Specific Conventions

### Access Control Pattern

Three-tier role system via `GeniusAccessControl.sol`:

- **onlySuperAdminRole**: Contract owner (Diamond storage), cannot be revoked
- **DEFAULT_ADMIN_ROLE**: Can grant/revoke other roles
- **Specialized roles**: `MINTER_ROLE`, `CREATOR_ROLE`, `NFT_PROXY_OPERATOR_ROLE`, `UPGRADER_ROLE`

Example: Minting requires EITHER `MINTER_ROLE` OR `onlySuperAdminRole`.

### Facet Communication

Facets share state via storage libraries (e.g., `GNUSNFTFactoryStorage`, `GeniusAIStorage`). Use diamond storage pattern:

```solidity
library LibFacetStorage {
  bytes32 constant STORAGE_POSITION = keccak256("diamond.storage.facet");

  function facetStorage() internal pure returns (FacetStorage storage ds) {
    bytes32 position = STORAGE_POSITION;
    assembly { ds.slot := position }
  }
}
```

### TypeChain Generated Types & Diamond Helpers

After compilation, multiple generated directories exist:

- `typechain-types/`: Regular contract types (individual facets)
- `diamond-typechain-types/`: Combined Diamond ABI types (GeniusDiamond.ts)
- `diamond-abi/GeniusDiamond.json`: Merged ABI from all facets (used by Foundry)
- `test/foundry/helpers/DiamondDeployment.sol`: Auto-generated constants for Foundry tests

**Always import from `diamond-typechain-types/`** when interacting with deployed Diamond in TypeScript tests.

**Diamond Helper Generation**: The `diamonds-forge:generate-helpers` task creates `DiamondDeployment.sol` with:

- Diamond proxy address from latest deployment
- All facet addresses as constants
- Helper functions (`getDiamondAddress()`, `getDiamondABIPath()`)
- Regenerated automatically after each Foundry deployment

### Network Configuration

Networks defined in `hardhat.config.ts` under `chainManager.chains`. Test suites auto-detect chains via `--chains` CLI arg.

RPC URLs/blocks set in `.env`:

- `SEPOLIA_RPC`, `SEPOLIA_BLOCK`
- `POLYGON_AMOY_RPC`, `POLYGON_AMOY_BLOCK`
- etc.

## Security & Quality Standards

### Required Checks Before Commit

```bash
yarn security-check      # Runs: audit, snyk, socket, osv, semgrep, slither, git-secrets
yarn lint                # ESLint with TypeScript rules
yarn forge:fmt:check     # Solidity formatting
```

### Deployment Strategies

**Hardhat Tests** (TypeScript):

- Use `LocalDiamondDeployer.getInstance()` from `@diamondslab/hardhat-diamonds`
- Multiton pattern: one deployment per network, reused across tests
- Load contracts with `loadDiamondContract<T>()` for full type safety

**Foundry Tests** (Solidity):

```bash
# Deploy Diamond for testing (creates/updates deployment record)
npx hardhat diamonds-forge:deploy --diamond-name GeniusDiamond --network localhost --force

# Generate test helpers from deployment record
npx hardhat diamonds-forge:generate-helpers --diamond-name GeniusDiamond

# Run tests against deployed Diamond
yarn forge:test
```

**Deployment Records**: Stored in `diamonds/GeniusDiamond/deployments/` as JSON files, containing:

- Diamond proxy address
- All facet addresses
- Deployment transaction hashes
- Block numbers and timestamps
- Used by both Hardhat and Foundry test systems

### Test Coverage Expectations

- **Hardhat Tests**: Focus on integration and multi-facet workflows
- **Foundry Fuzz Tests**: Property invariants (see `docs/FOUNDRY_FUZZ_TESTS.md`)
  - 85% coverage target
  - Invariant tests for core properties (supply, ownership, roles)
  - Fuzz tests with 256-10000 runs depending on stability

## Key Files & Directories

| Path                      | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `contracts/gnus-ai/*.sol` | Core Diamond facets                                           |
| `diamonds/GeniusDiamond/` | Diamond deployment config and records                         |
| `test/unit/`              | Single-facet unit tests                                       |
| `test/integration/`       | Cross-facet integration tests                                 |
| `test/foundry/`           | Fuzz and invariant tests                                      |
| `scripts/deploy/`         | Deployment automation scripts                                 |
| `docs/`                   | Detailed facet documentation (e.g., `GeniusAccessControl.md`) |

## Common Pitfalls

1. **Forgot to clean-compile after facet changes**: Old ABIs cause mysterious test failures
2. **Wrong TypeChain import**: Use `diamond-typechain-types/`, not `typechain-types/`
3. **Missing network in chainManager**: Tests fail silently if RPC URL not in `.env`
4. **Snapshot not restored**: Use `beforeEach` with `evm_snapshot` for test isolation
5. **Role confusion**: Minting requires MINTER_ROLE, not DEFAULT_ADMIN_ROLE
6. **Foundry tests fail with "Unknown selector"**: Run `diamonds-forge:generate-helpers` to update deployment addresses
7. **DiamondFuzzBase setup issues**: Must override both `_loadDiamondAddress()` and `_getDiamondABIPath()`
8. **LocalDiamondDeployer singleton conflicts**: Use correct network name matching `chainManager.chains` in hardhat.config.ts

## When Creating New Facets

1. Add Solidity contract to `contracts/gnus-ai/`
2. Update `diamonds/GeniusDiamond/geniusdiamond.config.json` with:
   - Priority (determines cut order)
   - Version (e.g., "0.0" for new facets)
   - `deployInit` function if initialization needed
3. Run `yarn clean-compile` to regenerate ABIs and TypeChain types
4. For Hardhat tests:
   - Use `LocalDiamondDeployer` pattern in `test/unit/`
   - Import from `diamond-typechain-types/` for full ABI access
5. For Foundry tests:
   - Deploy: `npx hardhat diamonds-forge:deploy --diamond-name GeniusDiamond --network localhost --force`
   - Generate helpers: `npx hardhat diamonds-forge:generate-helpers --diamond-name GeniusDiamond`
   - Extend `GeniusDiamondTestBase` in `test/foundry/`
6. Document in `docs/` with API reference
7. Add security checks: access control, input validation, reentrancy guards

## Additional Resources

- **Diamond Standard**: [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535)
- **Architecture**: `docs/Smart-Contracts-Overview.md`
- **Access Control**: `docs/GeniusAccessControl.md`
- **NFT Factory**: `docs/GNUSNFTFactory.md`
- **Bridge**: `docs/GNUSBridge.md`
- **DevContainer**: `.devcontainer/README.md` (reproducible dev environment)
