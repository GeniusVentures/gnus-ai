# Testing Patterns

**Analysis Date:** 2026-05-26

## Dual Test Framework Architecture

This project runs **two independent test frameworks** — Hardhat (TypeScript/Mocha) and Foundry (Solidity) — targeting the same diamond contracts. Tests can be run individually or together via `yarn test:all`.

## Hardhat / TypeScript Tests

### Framework

**Runner:** Mocha via Hardhat (`hardhat test`)
**Version:** mocha (bundled with hardhat 2.26.5)
**Config:** `hardhat.config.ts` (no separate mocha config)

**Assertion Library:**

- `chai` v4.5.0 with `chai-as-promised` v7.1.2
- `@nomicfoundation/hardhat-chai-matchers` v2.1.2
- `sinon` v21.0.1 available but not widely used

**Run Commands:**

```bash
yarn test                                    # Run all Hardhat tests
yarn test-multichain --chains hardhat        # Run multichain tests
yarn coverage                                # Run solidity-coverage
npx hardhat test test/unit/GNUSWithdrawLimiter.test.ts  # Run specific file
```

### Test File Organization

**Location:**

- Unit tests: `test/unit/` — one file per facet/contract
- Integration tests: `test/integration/` — cross-contract interaction tests
- Deployment tests: `test/deployment/` — deployment validation
- Gas tests: `test/gas/` — gas comparison benchmarks
- RPC tests: `test/unit/rpc/` — remote deployment tests
- Utils: `test/utils/` — test template and network utilities

**Naming:**

- Test files: `{ContractName}.test.ts` or `{ContractName}Enhanced.test.ts`
- Example: `GNUSWithdrawLimiter.test.ts`, `GNUSBridgeEnhanced.test.ts`, `NFTFactory.test.ts`
- Integration files: `{feature}-integration.test.ts`

**Structure:**

```
test/
├── unit/
│   ├── GNUSWithdrawLimiter.test.ts
│   ├── GNUSBridge.test.ts
│   ├── GNUSBridgeEnhanced.test.ts
│   ├── GNUSERC20.test.ts
│   ├── NFTFactory.test.ts
│   ├── GNUSNFTFactoryEnhanced.test.ts
│   ├── GeniusAI.test.ts
│   ├── GeniusAIStorage.test.ts
│   ├── GeniusOwnershipFacet.test.ts
│   ├── Erc20Batch.test.ts
│   ├── ERC20TransferBatch.test.ts
│   ├── ERC1155ProxyOperator.test.ts
│   ├── TransferHelper.test.ts
│   ├── GNUSControlStorage.test.ts
│   ├── GNUSContractAssets.test.ts
│   ├── GNUSWithdrawLimiterStorage.test.ts
│   ├── DiamondInitFacet-limiter.test.ts
│   └── rpc/
│       ├── RPCDiamondDeployer.test.ts
│       └── RPCDiamondDeployer.hardhat.test.ts
├── integration/
│   ├── withdraw-limiter-integration.test.ts
│   ├── erc1155-transfer-hook-limiter.test.ts
│   ├── erc20-transfer-batch-limiter.test.ts
│   └── rpc/
│       └── rpc-deployment.test.ts
├── deployment/
│   └── GeniusDiamondDeployment.test.ts
├── gas/
│   └── withdraw-limiter-gas-comparison.test.ts
└── utils/
    ├── test-template.ts
    ├── network-utils.ts
    └── logger.ts
```

### Test Structure

**Suite Organization (standard pattern from `test/utils/test-template.ts`):**

```typescript
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Diamond } from "@diamondslab/diamonds";
import {
  loadDiamondContract,
  LocalDiamondDeployer,
  LocalDiamondDeployerConfig,
} from "@diamondslab/hardhat-diamonds/dist/utils";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { multichain } from "hardhat-multichain";
import { GeniusDiamond } from "../../diamond-typechain-types";

chai.use(chaiAsPromised);

describe("ContractName Tests", async function () {
  const diamondName = "GeniusDiamond";
  this.timeout(0); // Extended for diamond deployment

  const networkProviders =
    multichain.getProviders() || new Map<string, JsonRpcProvider>();

  // Setup network providers (multichain or single)
  if (process.argv.includes("test-multichain")) {
    // ... multichain setup
  } else if (
    process.argv.includes("test") ||
    process.argv.includes("coverage")
  ) {
    networkProviders.set("hardhat", hre.ethers.provider as any);
  }

  for (const [networkName, provider] of networkProviders.entries()) {
    describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
      let diamond: Diamond;
      let signers: SignerWithAddress[];
      let geniusDiamond: GeniusDiamond;
      let ownerDiamond: GeniusDiamond;
      let snapshotId: string;

      // === LIFECYCLE HOOKS ===
      before(async function () {
        const config = {
          diamondName: diamondName,
          networkName: networkName,
          provider: provider,
          chainId: (await provider.getNetwork()).chainId,
          writeDeployedDiamondData: false,
          configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
        } as LocalDiamondDeployerConfig;

        const diamondDeployer = await LocalDiamondDeployer.getInstance(
          hre,
          config,
        );
        diamond = await diamondDeployer.getDiamondDeployed();
        const deployedData = diamond.getDeployedDiamondData();

        geniusDiamond = await loadDiamondContract<GeniusDiamond>(
          diamond,
          deployedData.DiamondAddress!,
          hre.ethers,
        );

        signers = await ethers.getSigners();
        ownerDiamond = geniusDiamond.connect(signers[0]);
      });

      beforeEach(async function () {
        snapshotId = await provider.send("evm_snapshot", []);
      });

      afterEach(async function () {
        await provider.send("evm_revert", [snapshotId]);
      });

      // === TEST CASES ===
      describe("Feature Group", function () {
        it("should handle happy path", async () => {
          // Arrange / Act / Assert
        });

        it("should reject invalid input", async () => {
          await expect(badCall).to.be.rejectedWith(/Expected error/);
        });
      });
    });
  }
});
```

**Key patterns:**

- **Diamond deployment:** `LocalDiamondDeployer.getInstance()` + `loadDiamondContract<GeniusDiamond>()` — deployed once in `before`, reused across tests
- **Test isolation:** EVM snapshots via `evm_snapshot`/`evm_revert` in `beforeEach`/`afterEach` — each test starts with clean state
- **Signer management:** Multiple diamond instances connected to different signers (`ownerDiamond`, `signer0Diamond`, `signer1Diamond`)
- **Multichain support:** Tests iterate over `networkProviders.entries()`, wrapping tests in `describe(Chain: ${networkName})` blocks
- **Timeout:** `this.timeout(0)` (unlimited) to handle diamond deployment times
- **Assertion style:** `expect()` with chai (primary), `assert` for boolean checks

### Mocking

**Framework:** Not applicable in blockchain context. Instead:

- `contracts/mocks/` contains test-only Solidity contracts: `MockERC20.sol`, `MockBadERC20.sol`, `MockNonPayable.sol`, `TransferHelperWrapper.sol`
- Hardhat local network provides isolated blockchain environment
- `vm.prank()` in Foundry tests simulates calls from specific addresses
- Forking from mainnet/testnet for integration tests via `FORK_URL` env var

### Fixtures and Factories

**Test Data:**

- `toWei()` helper in `scripts/utils/helpers.ts` converts human-readable amounts to wei: `toWei('100000')`
- Constants defined at test level: `GNUS_TOKEN_ID = 0n`, `INITIAL_GNUS_SUPPLY = 1000000 ether`
- Test actors created via `makeAddr("user1")` in Foundry, `signers[0].address` in Hardhat

### Coverage

**Tool:** `solidity-coverage` v0.8.17
**Requirements:** No enforced minimum
**View Coverage:**

```bash
yarn coverage        # Runs hardhat coverage (sets HARDHAT_NETWORK=hardhat)
forge coverage       # Runs Foundry coverage
```

## Foundry / Solidity Tests

### Framework

**Runner:** Foundry (forge)
**Config:** `foundry.toml` (profile: `default`)
**Solidity Version:** `0.8.19` (matches contracts)

**Assertion Library:**

- `forge-std/Test.sol` — `assertTrue`, `assertEq`, `assertNotEq`, `assertGt`, `assertFalse`
- Custom assertion helpers in `GeniusDiamondTestBase`: `assertHasRole()`, `assertGNUSBalance()`, `assertAllSelectorsValid()`

**Run Commands:**

```bash
yarn forge:test                    # Run Foundry tests via hardhat bridge
yarn forge:test:verbose            # forge test -vvv (verbose output)
yarn forge:test:gas                # forge test --gas-report
yarn forge:coverage                # forge coverage
yarn forge:fuzz                    # Run fuzz tests
forge test --match-test testFuzz_  # Run specific fuzz tests
```

### Test File Organization

**Location:**

- All Foundry tests under `test/foundry/`
- Organized by test type: `base/`, `unit/`, `fuzz/`, `invariant/`, `integration/`, `security/`, `poc/`, `handlers/`, `helpers/`

**Naming:**

- Test contracts: `{ContractName}{TestType}.t.sol` — `.t.sol` extension
- Fuzz: `{ContractName}Fuzz.t.sol` (e.g., `DiamondCoreFuzz.t.sol`, `BridgeFuzz.t.sol`)
- Invariant: `{ContractName}Invariant.t.sol` (e.g., `DiamondCoreInvariant.t.sol`, `EconomicInvariant.t.sol`)
- Security: `{ContractName}SybilAttack.t.sol`
- Unit: `{ContractName}Unit.t.sol`

**Structure:**

```
test/foundry/
├── base/
│   └── GeniusDiamondTestBase.sol       # Base contract for all tests
├── handlers/
│   └── GeniusDiamondHandler.sol        # Stateful fuzz handler
├── helpers/
│   └── DiamondDeployment.sol           # Deployment address/ABI helpers
├── unit/
│   ├── GNUSUnit.t.sol
│   └── GNUSConstantsFacet.t.sol
├── fuzz/
│   ├── DiamondCoreFuzz.t.sol
│   ├── DiamondRouting.t.sol
│   ├── DiamondOwnership.t.sol
│   ├── DiamondAccessControl.t.sol
│   ├── DiamondInvariants.t.sol
│   ├── AccessControlFuzz.t.sol
│   ├── ERC20Fuzz.t.sol
│   ├── ERC1155Fuzz.t.sol
│   ├── BridgeFuzz.t.sol
│   ├── NFTFactoryFuzz.t.sol
│   ├── SecurityFuzz.t.sol
│   ├── GNUSWithdrawLimiterFuzz.t.sol
│   └── ExampleFuzz.t.sol
├── invariant/
│   ├── DiamondCoreInvariant.t.sol
│   ├── DiamondProxyInvariant.t.sol
│   ├── AccessControlInvariant.t.sol
│   ├── ERC20Invariant.t.sol
│   ├── ERC1155Invariant.t.sol
│   ├── BridgeInvariant.t.sol
│   ├── NFTFactoryInvariant.t.sol
│   └── EconomicInvariant.t.sol
├── integration/
│   ├── BasicDiamondIntegration.t.sol
│   ├── BasicDiamondIntegrationDeployed.t.sol
│   ├── ExampleIntegration.t.sol
│   ├── SnapshotExample.t.sol
│   └── diamonds-hardhat-foundry/
│       ├── deployment.t.sol
│       ├── end-to-end.t.sol
│       └── helper-generation.t.sol
├── security/
│   └── GNUSWithdrawLimiterSybilAttack.t.sol
└── poc/
    ├── DiamondABIDebugTest.t.sol
    ├── DiamondABILoadingPOC.t.sol
    └── JSONParseTest.t.sol
```

### Test Structure

**Unit Test Pattern:**

```solidity
contract GNUSUnitTest is Test {
    using DiamondForgeHelpers for address;

    address diamond;
    address deployer;

    function setUp() public {
        diamond = DiamondDeployment.getDiamondAddress();
        deployer = DiamondDeployment.getDeployerAddress();
        DiamondForgeHelpers.assertValidDiamond(diamond);
    }

    function test_DiamondDeployed() public view {
        assertNotEq(diamond, address(0), "Diamond address should not be zero");
        uint256 codeSize;
        assembly { codeSize := extcodesize(diamondAddr) }
        assertGt(codeSize, 0, "Diamond should have code deployed");
    }
}
```

**Fuzz Test Pattern (inherits `GeniusDiamondTestBase`):**

```solidity
contract DiamondCoreFuzz is GeniusDiamondTestBase {
    function setUp() public override {
        super.setUp();
    }

    function testFuzz_ownershipTransfer(address newOwner) public {
        newOwner = _boundAddress(newOwner);
        vm.assume(newOwner != owner);

        bytes4 selector = bytes4(keccak256("transferOwnership(address)"));
        bytes memory data = abi.encode(newOwner);

        vm.prank(owner);
        (bool success, ) = _callDiamond(selector, data);
        assertTrue(success, "Ownership transfer failed");

        address updatedOwner = _getDiamondOwner();
        assertEq(updatedOwner, newOwner, "Owner not updated");
    }
}
```

**Invariant Test Pattern (uses handler + targetContract):**

```solidity
contract DiamondCoreInvariant is GeniusDiamondTestBase {
    GeniusDiamondHandler public handler;

    function setUp() public override {
        super.setUp();
        handler = new GeniusDiamondHandler();
        handler.setUp();
        targetContract(address(handler));
    }

    function invariant_ownerNeverZero() public view {
        address currentOwner = _getDiamondOwner();
        assertTrue(currentOwner != address(0), "Diamond owner is address(0)");
    }
}
```

**Fuzz Configuration (`foundry.toml`):**

```toml
[profile.default]
fuzz = { runs = 256, max_test_rejects = 65536, seed = "0x1234" }
invariant = { runs = 5, depth = 10, fail_on_revert = false }

[profile.ci]
fuzz = { runs = 10000 }
verbosity = 3

[profile.intense]
fuzz = { runs = 50000 }
```

### Test Lifecycle

**Base contract (`GeniusDiamondTestBase.sol`):**

1. `setUp()` (virtual, called before each test):
   - `super.setUp()` — loads diamond and ABI via `DiamondFuzzBase`
   - Loads deployer/owner from deployment data
   - Creates test actors: `user1`, `user2`, `user3`, `attacker`
   - Grants `DEFAULT_ADMIN_ROLE` to test contract
   - Sets up initial GNUS balances via `_setupInitialBalances()`

**Test contracts override `setUp()`:**

- Call `super.setUp()` first
- Add test-specific initialization

### Mocking

- **Foundry cheatcodes:** `vm.prank()` for impersonation, `vm.assume()` for input constraints, `vm.deal()` for ETH funding
- **Bounded fuzz inputs:** `_boundUint256()`, `_boundAddress()` helpers in base contract
- **Handler contracts:** `GeniusDiamondHandler.sol` acts as target for stateful fuzzing, providing bounded action handlers

### Fixtures and Factories

**Test Data:**

- Constants in base contract: `GNUS_TOKEN_ID = 0`, `INITIAL_GNUS_SUPPLY = 1000000 ether`
- Role constants: `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE`
- Actors created via `makeAddr("name")` pattern
- Initial balances distributed by owner (super admin bypasses limiter)

### Coverage

**Tool:** `forge coverage`
**Requirements:** No enforced minimum
**Run:**

```bash
yarn forge:coverage
```

## Common Patterns Across Both Frameworks

### Test Isolation

- **Hardhat:** EVM snapshots (`evm_snapshot`/`evm_revert`) in `beforeEach`/`afterEach`
- **Foundry:** Fresh contract state per test (forge deploys new instances); `vm.prank()` for isolation
- **Invariant tests:** Handler contract created fresh in `setUp()`

### Async Testing (TypeScript)

```typescript
// Standard async test
it("should initialize with correct values", async function () {
  const config = await ownerDiamond.getWithdrawLimiterConfig();
  expect(config.defaultLimitAmount).to.equal(toWei("100000"));
});

// Rejection testing
await expect(signer1Diamond.setLimiterEnabled(true)).to.be.rejectedWith(
  Error,
  /Only SuperAdmin allowed/,
);
```

### Error Testing

**Solidity (Foundry):**

```solidity
// Expect revert - use try/call pattern
vm.prank(attacker);
(bool success, ) = _callDiamond(selector, data);
assertFalse(success, "Non-owner should not be able to transfer ownership");
```

**TypeScript (Hardhat):**

```typescript
// Using chai-as-promised
await expect(signer1Diamond.pause()).to.be.rejected;

// With error message matching
await expect(badCall).to.be.rejectedWith(/Only SuperAdmin allowed/);
```

### Diamond Contract Testing Pattern

Both frameworks follow the same high-level workflow:

1. Diamond is deployed once (via `LocalDiamondDeployer` for Hardhat, `DiamondDeployment` helper for Foundry)
2. Test contract loads diamond address and full ABI
3. Test contract connects to diamond as different signers/roles
4. Tests exercise diamond functions via proxy, verifying facet routing and state
5. Lifecycle hooks manage test isolation

## Run All Tests

```bash
yarn test:all          # Runs both Hardhat and Foundry tests
yarn test              # Hardhat only
yarn forge:test        # Foundry only

# CI profile (higher fuzz runs)
FOUNDRY_PROFILE=ci forge test
```

---

_Testing analysis: 2026-05-26_
