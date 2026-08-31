# Phase 17: Test-Suite Determinism - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 33 (1 new + 29 modified code/test + 3 records)
**Analogs found:** 33 / 33 (every target has an in-repo analog; the "new" helper is a generalization of 13 existing duplicates)

> All paths relative to the `gnus-ai` submodule root. Every excerpt below was read from the working tree this session.

## File Classification

### New file

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `test/utils/diamond-baseline.ts` | utility (shared test helper) | state-probe + request-response writes | `test/unit/GNUSTreasury.test.ts:167-178` (`seedProvenanceIfNeeded` — parameterized local helper, same body) | exact (body duplicated in 13 suites) |

### Modified — shared scaffold anchor

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `test/utils/test-template.ts` | config (suite scaffold template) | snapshot isolation | itself (`:126-128` snapshot site); `test/unit/GNUSBridgeEnhanced.test.ts` probe placement | exact |

### Modified — Tier A: 17 scaffold-snapshot suites (baseline call inserted before first `evm_snapshot`)

| File | Snapshot site | Scaffold style | Probe block to fold | Match Quality |
|------|---------------|----------------|---------------------|---------------|
| `test/unit/GNUSControlStorage.test.ts` | `:52` | plain (`hre.network.provider`) | none (also DELETE guard `:69-73`) | exact |
| `test/unit/GNUSBridgeIn.test.ts` | `:281` | **bridge** (re-alias `:272`) | `:259-265` (slot const `:61`) | exact |
| `test/unit/GNUSBridgeAttestorIn.test.ts` | `:419` | **bridge** (re-alias `:409`) | `:396-402` (slot const `:173`) | exact |
| `test/unit/GNUSBridgeAttestorUpgrade.test.ts` | `:148` | plain + in-test setChainID `:244` (NOT a defect — see research) | slot const `:54` | exact |
| `test/unit/GNUSBridgeEnhanced.test.ts` | `:62` | plain | `:49-59` (slot const `:19`) | exact |
| `test/unit/DiamondInitFacet-limiter.test.ts` | `:97` | plain | none | exact |
| `test/unit/ERC1155ProxyOperator.test.ts` | `:61` | plain | none | exact |
| `test/unit/ERC20TransferBatch.test.ts` | `:52` | plain | none | exact |
| `test/unit/GNUSContractAssets.test.ts` | `:69` | plain | none | exact |
| `test/unit/GNUSNFTFactoryEnhanced.test.ts` | `:61` | plain | slot const `:16` (fold if probe body present) | exact |
| `test/unit/GNUSWithdrawLimiter.test.ts` | `:97` | plain | none | exact |
| `test/unit/GNUSWithdrawLimiterStorage.test.ts` | `:87` | plain | none | exact |
| `test/unit/GeniusOwnershipFacet.test.ts` | `:45` | plain | none | exact |
| `test/gas/withdraw-limiter-gas-comparison.test.ts` | `:88` | multichain-nested (`provider.send`) | slot const `:94` | exact |
| `test/integration/erc1155-transfer-hook-limiter.test.ts` | `:107` | multichain-nested | none | exact |
| `test/integration/erc20-transfer-batch-limiter.test.ts` | `:96` | multichain-nested | none | exact |
| `test/deployment/GeniusDiamondDeployment.test.ts` | `:110` (beforeEach; before() ends `:107`) | multichain-nested (template shape) | none | exact |

### Modified — Tier B: 8 suites carrying duplicated probe blocks to fold

| File | Duplicate site | Notes | Match Quality |
|------|----------------|-------|---------------|
| `test/unit/GNUSBridge.test.ts` | `:230-237` (slot const `:56`) | beforeEach-only scaffold | exact |
| `test/unit/GNUSTreasury.test.ts` | `:163-178` local fn (slot const `:65`) | **DO NOT touch test-body `SetSeedSupply` calls `:504-:987`** — they test the one-shot itself | exact |
| `test/unit/NFTFactory.test.ts` | `:121-128` (slot const `:36`, `hre.ethers.` prefix) | | exact |
| `test/unit/GNUSLifecycleSettle.test.ts` | `:240-249` (slot const `:80`) | | exact |
| `test/unit/GNUSLifecycleUpgrade.test.ts` | `:165-173` local fn `seedProvenanceIfNeeded` (slot const `:59`) | calls via `ownerDiamond` | exact |
| `test/unit/GNUSLifecycleAICredits.test.ts` | `:154-162` | | exact |
| `test/unit/GNUSLicensing.test.ts` | `~:179` | | exact |
| `test/unit/GNUSRedeemAdapter.test.ts` | `~:154` (slot const `:60`) | | exact |

### Modified — Foundry

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `test/foundry/invariant/AccessControlInvariant.t.sol` | test (invariant) | fuzz campaign + view assertions | the file's own `attacker` convention `:165`, `:193` | exact |
| `test/foundry/unit/SafeSingleShotUpgrade.t.sol` | test (fork-dependent unit) | request-response via Safe proxy | the file's own in-test skips `:153`, `:182` | exact |
| `test/foundry/unit/SafeDiamondCut.t.sol` | test (fork-dependent unit) | request-response via Safe proxy | `SafeSingleShotUpgrade.t.sol` (same shape; skip precedent `:153`) | exact |

### Modified — records (D-06 ledger)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `.planning/STATE.md` | record (baseline ledger) | documentation | existing gate-line format `:88-89` (07-04 entries) | role-match (new section, existing entry format) |
| `.planning/PROJECT.md` | record (status pointer) | documentation | current line `:11` ("Test gate: 666 passing / 2 pending / 0 failing") | role-match |
| `.planning/ROADMAP.md` | record (milestone pointer) | documentation | `:36` phase-entry baselines (**historical record — stays**; only the forward pointer changes) | role-match |

## Pattern Assignments

### `test/utils/diamond-baseline.ts` (utility, probe + writes)

**Analogs:** `test/unit/GNUSTreasury.test.ts:167-178` (best signature precedent — parameterized), `test/unit/GNUSBridgeEnhanced.test.ts:49-59` (best inline-body precedent), `test/utils/network-utils.ts` (module conventions).

**Module conventions** — copy from `test/utils/network-utils.ts` (JSDoc on every export, named export, no default export):
```typescript
/**
 * Waits for the network to be available by polling the JSON-RPC endpoint.
 * @param url - The JSON-RPC endpoint URL.
 ...
 */
async function waitForNetwork(url: string, timeout: number = 30000): Promise<void> { ... }

export { waitForNetwork };
```

**Core probe-body to generalize** — `test/unit/GNUSBridgeEnhanced.test.ts:49-59` (in-`before()` form):
```typescript
// Seed the provenance counter so the global-cap check in _mintWithBridgeFee
// can run (reverts when uninitialized, Phase 9 D8/Pitfall 4). The GeniusDiamond
// fixture is shared (cached) across suites, so a prior suite may already have
// seeded the one-shot SetSeedSupply — guard on provenanceInitialized (slot +1).
const initialized = await hre.network.provider.send('eth_getStorageAt', [
	diamondAddress,
	ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
]);
if (BigInt(initialized) === 0n) {
	await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
}
```

**Signature precedent** — `test/unit/GNUSTreasury.test.ts:167-178` (parameterized caller + address; the new helper should take the connected instance + diamond address the same way):
```typescript
async function seedProvenanceIfNeeded(
	diamond: GeniusDiamond = ownerDiamond,
	address: string = diamondAddress,
): Promise<void> {
	const initialized = await provider.send('eth_getStorageAt', [
		address,
		ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
	]);
	if (BigInt(initialized) === 0n) {
		await diamond.GNUSTreasury_SetSeedSupply(0n);
	}
}
```

**Slot constant to hoist** (currently defined independently in 13 files — grep-verified sites):
`test/unit/GNUSBridgeEnhanced.test.ts:19`, `GNUSLifecycleUpgrade:59`, `GNUSBridge:56`, `GNUSBridgeAttestorUpgrade:54`, `GNUSBridgeIn:61`, `GNUSRedeemAdapter:60`, `GNUSBridgeAttestorIn:173`, `GNUSTreasury:65`, `GNUSLifecycleSettle:80`, `test/gas/withdraw-limiter-gas-comparison.test.ts:94`, `test/unit/GNUSNFTFactoryEnhanced.test.ts:16`, `test/unit/NFTFactory.test.ts:36`, `test/integration/withdraw-limiter-integration.test.ts:114`:
```typescript
const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));
```

**Caller/permission nuance:** some suites call the seed via `ownerDiamond` (`GNUSLifecycleUpgrade.test.ts:171`, `GNUSTreasury.test.ts:176`), others via default-connected `geniusDiamond` (`GNUSBridgeEnhanced:58`, `GNUSControlStorage` — `:32` comment "Owner has SUPER_ADMIN_ROLE by default"). Both satisfy `onlySuperAdminRole` + `DEFAULT_ADMIN_ROLE` on the local shared diamond (research-verified). `updateBridgeFee(0)` usage precedent: `test/unit/GNUSControlStorage.test.ts:402`.

**No test file for the helper** — it is exercised by every suite that calls it; its correctness signal IS the full-suite gate (research Wave 0).

---

### `test/utils/test-template.ts` (scaffold anchor)

**Insertion point** — between `loadDiamondContract` (`:94-98`) and the snapshot (`:126-128`):
```typescript
			// Take initial snapshot
			snapshotId = await provider.send('evm_snapshot', []);
```
Insert `await ensureDiamondTestBaseline(geniusDiamond, diamondAddress!)` immediately before the "Take initial snapshot" comment. Note this template uses `provider.send('evm_snapshot', [])` (multichain provider) and `snapshotId` — not `initialSnapshotId` — so the baseline call goes at the end of `before()` (`:76-128`), before any snapshot is taken anywhere in the file.

---

### Tier A plain scaffolds (15 files, non-bridge)

**Analog:** `test/unit/GNUSControlStorage.test.ts` — the TEST-04 victim itself is the cleanest plain scaffold.

**Scaffold shape** (`test/unit/GNUSControlStorage.test.ts:27-53`):
```typescript
	before(async function () {
				// 13-04: deploy GNUSLifecyclePolicy library + install factory linker before diamond deploy.
				await setupLifecyclePolicyLinking();
		// Get signers
		const signers = await hre.ethers.getSigners();
		owner = signers[0]; // Owner has SUPER_ADMIN_ROLE by default
		...
		const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
		const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
		const diamond = await diamondDeployer.getDiamondDeployed();
		const deployedDiamondData = diamond.getDeployedDiamondData();
		const diamondAddress = deployedDiamondData.DiamondAddress || '';

		geniusDiamond = await loadDiamondContract<GeniusDiamond>(
			diamond,
			diamondAddress,
			hre.ethers,
		);

		// Take initial snapshot for test isolation
		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
	});
```

**Insert:** `await ensureDiamondTestBaseline(geniusDiamond, diamondAddress);` between the `loadDiamondContract` call and the `// Take initial snapshot` comment. In `GNUSControlStorage.test.ts` the local `diamondAddress` (`:42`) is in scope — same holds in the other plain scaffolds (same shape at `GNUSBridgeEnhanced.test.ts:39-62`).

**Guard to DELETE** — `test/unit/GNUSControlStorage.test.ts:68-74` (the anti-pattern being removed):
```typescript
	it('should return initial protocol info', async function () {
		// Bridge suites alias the shared diamond's chainID to the local
		// chain (GNUSBridgeIn scaffold) and that mutation intentionally
		// outlives their snapshots — normalize it before asserting
		// defaults (same reset as the zero-chain-ID edge case below).
		await geniusDiamond.setChainID(0);
		const info = await geniusDiamond.protocolInfo();
```
Delete the 4 comment lines + the `setChainID(0)` line (`:69-73`); the test body starts at `const info = ...`.

**Do NOT touch the edge-case test** — `test/unit/GNUSControlStorage.test.ts:408-413` keeps its own reset (it is a test of the zero case, not a guard):
```typescript
		it('should handle zero chain ID', async function () {
			await geniusDiamond.setChainID(0);
			const info = await geniusDiamond.protocolInfo();
			expect(info.chainID).to.equal(0);
		});
```

**Verification command (planner):** `grep -n "normalize it before asserting" test/unit/GNUSControlStorage.test.ts` → must return no hits after the change.

---

### Tier A bridge scaffolds (GNUSBridgeIn, GNUSBridgeAttestorIn)

**Analog:** `test/unit/GNUSBridgeIn.test.ts:259-281` — the canonical probe → re-alias → snapshot ordering.

**REPLACE the probe block** (`:259-265`):
```typescript
		const initialized = await hre.network.provider.send('eth_getStorageAt', [
			diamondAddress,
			ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
		]);
		if (BigInt(initialized) === 0n) {
			await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
		}
```
with `await ensureDiamondTestBaseline(geniusDiamond, diamondAddress);`

**KEEP the re-alias UNCHANGED and AFTER the baseline call** (`:270-272`) — bridge suites NEED chainID=31337 for `bridgeIn`'s destination-chain check:
```typescript
		const network = await ethers.provider.getNetwork();
		localChainId = network.chainId;
		await geniusDiamond.setChainID(localChainId);
```

**Snapshot stays last** (`:281`):
```typescript
		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
```

Same shape at `test/unit/GNUSBridgeAttestorIn.test.ts:396-409` (probe → re-alias → `:419` snapshot):
```typescript
		const network = await ethers.provider.getNetwork();
		localChainId = network.chainId;
		await geniusDiamond.setChainID(localChainId);
```

---

### Tier A multichain-nested scaffolds (gas, 2x integration, deployment)

**Analog:** `test/deployment/GeniusDiamondDeployment.test.ts:104-111` — template-shaped, uses `provider.send(...)` not `hre.network.provider.send(...)`:
```typescript
				ownerSigner = await ethersMultichain.getSigner(owner);

				ownerDiamond = geniusDiamond.connect(ownerSigner);
			});

			beforeEach(async function () {
				snapshotId = await provider.send('evm_snapshot', []);
			});
```
Its `before()` ends at `:107`; insert the baseline call as the last statement of `before()`. **Permission nuance:** this suite resolves `owner` from `DeployerAddress` (`:98`) and connects `ownerDiamond` (`:106`) — pass `ownerDiamond` here, not the default-connected `geniusDiamond`.

Same treatment for `test/gas/withdraw-limiter-gas-comparison.test.ts` (before `:88` snapshot; slot const `:94` also to be folded/dropped), `test/integration/erc1155-transfer-hook-limiter.test.ts` (`:107`), `test/integration/erc20-transfer-batch-limiter.test.ts` (`:96`).

---

### Tier B folds (8 suites)

**Analog:** `test/unit/GNUSLifecycleUpgrade.test.ts:165-173` — local helper form; replace the local fn + its call sites with the shared helper:
```typescript
            async function seedProvenanceIfNeeded(): Promise<void> {
                const initialized = await provider.send('eth_getStorageAt', [
                    diamondAddress,
                    ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
                ]);
                if (BigInt(initialized) === 0n) {
                    await ownerDiamond.GNUSTreasury_SetSeedSupply(0n);
                }
            }
```
Called ad-hoc inside tests (`:187` `await seedProvenanceIfNeeded();`) — the shared helper keeps this usable; these suites have no `initialSnapshotId` (beforeEach-only isolation, `:148-156`), so the baseline call goes at the end of their `before()`.

**`GNUSTreasury.test.ts` caution:** fold only the scaffold-side helper (`:163-178`); the test-body `SetSeedSupply` calls (`:504-:987`) exercise the one-shot revert behavior itself and MUST remain untouched.

---

### `test/foundry/invariant/AccessControlInvariant.t.sol` (test, invariant)

**Analog:** the file's own never-granted convention — `:165` and `:193`:
```solidity
        // Attacker (not in handler actors) should not have admin role
        assertFalse(_hasRole(DEFAULT_ADMIN_ROLE, attacker), "Attacker should not have admin role");
```
```solidity
        // Attacker (not in handler actors) should not have role
        assertFalse(_hasRole(MINTER_ROLE, attacker), "Attacker should not have MINTER_ROLE");
```

**Target to change** (`:274-279`, the file's last invariant):
```solidity
    function invariant_revokingUnownedRoleIsSafe() public view {
        // User3 shouldn't have UPGRADER_ROLE (never granted)
        assertFalse(_hasRole(UPGRADER_ROLE, user3), "User3 should not have UPGRADER_ROLE");

        console.log("[OK] Ungranted roles verified");
    }
```
Change assertion subject `user3` → `attacker` (`:276`), rewrite the `:275` comment, and fix the stale doc line `:257` (`@dev View-only: Just checks that user3 doesn't have roles`). `user3` appears nowhere else in the file after this (only `:257` and `:276`).

**Why attacker is sound (context, read-only):** the fuzz grant surface is `GeniusDiamondHandler.sol:84-88` (actors) × `:540-547` (roles/target selection):
```solidity
        // Initialize actor list
        actors.push(address(this));
        actors.push(user1);
        actors.push(user2);
        actors.push(user3);
```
```solidity
        bytes32[] memory roles = new bytes32[](4);
        roles[0] = DEFAULT_ADMIN_ROLE;
        roles[1] = MINTER_ROLE;
        roles[2] = PAUSER_ROLE;
        roles[3] = UPGRADER_ROLE;

        bytes32 role = roles[roleSeed % roles.length];
        address target = actors[targetSeed % actors.length];
```
`user3` = `actors[3]` is grantable `UPGRADER_ROLE` (`roles[3]`) by `handler_grantRole` — the flake. `attacker` is declared in `test/foundry/base/GeniusDiamondTestBase.sol:63` (`address public attacker;`, set `:97` via `makeAddr("attacker")`) and is never pushed into `actors`.

**File conventions to preserve:** 4-space indent, `function invariant_*() public view`, `console.log("[OK] ...")` closer on every invariant, NatSpec doc block with PROPERTY TESTED / WHY IT MUST HOLD / WHAT BREAKS IF VIOLATED above each invariant.

**Verification command (planner):** `grep -n "UPGRADER_ROLE, user3" test/foundry/invariant/AccessControlInvariant.t.sol` → must return no hits.

---

### `test/foundry/unit/SafeSingleShotUpgrade.t.sol` + `SafeDiamondCut.t.sol` (test, fork-dependent)

**Analog for the skip style:** each file's own in-test skips — `SafeSingleShotUpgrade.t.sol:151-154`:
```solidity
    function test_SepoliaCurrentState() public {
        if (_protocolVersion() >= 250) {
            vm.skip(true, "diamond already at v2.5; pre-upgrade baseline is stale");
        }
```
and `:179-183`:
```solidity
    function test_SingleShotUpgradeFromArtifact() external {
        string memory cutPath = vm.envOr("ENCODED_CUT_PATH", string(""));
        if (bytes(cutPath).length == 0) {
            vm.skip(true, "ENCODED_CUT_PATH unset; anvil artifact test skipped");
        }
```
Note the lowercase reason-string style (`"diamond already at v2.5; pre-upgrade baseline is stale"`) — match it in the new skip reason.

**Constants already in scope** — `SafeSingleShotUpgrade.t.sol:48-49`:
```solidity
    address private constant SAFE_SINGLETON     = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_PROXY_FACTORY = 0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC;
```
(identical in `SafeDiamondCut.t.sol:35-37`).

**Insertion points** — as the new first statement of each `setUp()`:
- `SafeSingleShotUpgrade.t.sol:62` — `function setUp() public {` (first statement currently `:63` `safeOwner = makeAddr("safeOwner");`)
- `SafeDiamondCut.t.sol:49` — `function setUp() public {` (first statement currently `:50` `safeOwner = makeAddr("safeOwner");`)

The reverting call each skip protects: `ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(...)` at `:74` / `:69`. `vm` is already in scope via `import {Test} from "forge-std/Test.sol"` (`:4` in both) — **no import change**.

```solidity
        vm.skip(SAFE_PROXY_FACTORY.code.length == 0, "requires sepolia/anvil fork with canonical Safe deployments");
```

**Where today's 3 skips come from (context):** `test/foundry/integration/diamonds-hardhat-foundry/deployment.t.sol:50, :91, :117, :124, :155, :179` (runtime-conditional `vm.skip(true)`). The Safe files' in-test skips at `:153`/`:182` currently never execute (setUp reverts first) — post-fix the gate reads 215 passed / 0 failed / 5 skipped (forge 1.7.1 setUp-skip = exactly 1 skipped entry per contract; research-verified empirically).

---

### Records (D-06 ledger)

**STATE.md gate-line format to extend** — `.planning/STATE.md:88` (existing entry shape):
```
- 07-04: phase-exit gate (deterministic hard gates) — `yarn install --immutable` exit 0; ... Hardhat 665/2/1 with the sole failure exactly GNUSControlStorage "should return initial protocol info" ... Foundry 215/2/3 with exactly the two Phase 08.1 setUp reverts ...
```
New canonical baseline ledger section follows this exact `command; counts; failure-set` prose style, plus per-run N=5/N=10 results.

**PROJECT.md re-point target** — `.planning/PROJECT.md:11`:
```
Test gate: 666 passing / 2 pending / 0 failing, green in CI (tests + tokenless security-audit).
```
Re-point at STATE.md as the single source (precedent: `.github/workflows/security-audit.yml:8` already points there). ROADMAP.md phase-entry lines (`:36` area) are historical — leave the recorded figures, change only the forward-looking pointer.

## Shared Patterns

### Probe-guard (idempotent one-shot seed)
**Source:** `test/unit/GNUSBridgeEnhanced.test.ts:49-59` (13 duplicates — full list under Pattern Assignments)
**Apply to:** `test/utils/diamond-baseline.ts` (the one true copy going forward)
`eth_getStorageAt(treasurySlot + 1)` → `if (BigInt(x) === 0n)` → `GNUSTreasury_SetSeedSupply(0n)`. NEVER call `SetSeedSupply` unguarded — it reverts "Already initialized" against a cached diamond (every existing site guards it).

### Snapshot lifecycle (4-hook isolation)
**Source:** `test/unit/GNUSBridgeEnhanced.test.ts:61-75` (canonical ordering)
**Apply to:** every Tier A scaffold
```typescript
		// Take initial snapshot
		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
	});
	beforeEach(async function () { snapshotId = await hre.network.provider.send('evm_snapshot'); });
	afterEach(async function () { await hre.network.provider.send('evm_revert', [snapshotId]); });
	after(async function () { await hre.network.provider.send('evm_revert', [initialSnapshotId]); });
```
The baseline call lands BEFORE `initialSnapshotId` — that ordering IS the fix (snapshot must bake the declared baseline).

### Shared-diamond scaffold (LocalDiamondDeployer singleton)
**Source:** `test/unit/GNUSControlStorage.test.ts:37-49`
**Apply to:** all scaffold edits (do not alter this block; only insert between it and the snapshot)
```typescript
		const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
		const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
		const diamond = await diamondDeployer.getDiamondDeployed();
		const deployedDiamondData = diamond.getDeployedDiamondData();
		const diamondAddress = deployedDiamondData.DiamondAddress || '';
		geniusDiamond = await loadDiamondContract<GeniusDiamond>(diamond, diamondAddress, hre.ethers);
```

### test/utils import convention
**Source:** `test/unit/GNUSBridgeEnhanced.test.ts:14`, `test/unit/GNUSBridgeIn.test.ts:21-22`
**Apply to:** all 25+ TS suites gaining the helper call
```typescript
import { ... } from '../utils/bridge-fixtures';
import type { AttestorMerkleTree } from '../utils/bridge-certificate';
```
Relative path is `'../utils/<module>'` from `test/unit/`, `'../../test/utils/<module>'` never used — suites under `test/integration|gas|deployment/` will need `'../utils/diamond-baseline'` (same depth as their existing `../utils/bridge-fixtures` imports, cf. `test/gas/withdraw-limiter-gas-comparison.test.ts:31`).

### Foundry conditional skip
**Source:** `test/foundry/unit/SafeSingleShotUpgrade.t.sol:153` (reason-string style)
**Apply to:** both Safe `setUp()`s (D-04)
`vm.skip(<condition>, "<lowercase reason>")` — forge 1.7.1 counts a setUp-skip as exactly 1 skipped entry per contract. Skip counts are recorded baseline, not noise (D-05).

### Invariant-subject soundness rule
**Source:** `test/foundry/handlers/GeniusDiamondHandler.sol:84-88, 540-547`
**Apply to:** any invariant asserting "X should not have role Y" — subject must be outside `actors[]` (`attacker`, `address(0)`, or `address(this)`-style fixed addresses). Every other invariant in `AccessControlInvariant.t.sol` already complies (`:158-168`, `:189-196`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | | | Every target has an in-repo analog. The two nearest-miss items: the STATE.md ledger *section* is new prose (but the entry format exists at `STATE.md:88`) and `diamond-baseline.ts` is a new *module* (but its body already exists in 13 suites). |

## Metadata

**Analog search scope:** `test/utils/`, `test/unit/`, `test/integration/`, `test/gas/`, `test/deployment/`, `test/foundry/{base,handlers,invariant,unit,integration}/`, `.planning/{STATE.md,PROJECT.md}`, `lib/forge-std` (via research)
**Files scanned:** 30 read/grep-verified this session (14 full or targeted reads; 4 repo-wide greps: `TREASURY_STORAGE_SLOT =`, `vm.skip(`, `evm_snapshot`/`before(` in deployment test, utils-import conventions)
**Pattern extraction date:** 2026-08-31
**Key line-number deltas vs research:** none material — every cited line (`GNUSBridgeIn:259-265/272/281`, `GNUSControlStorage:69-73/408-413`, `AccessControlInvariant:165/193/275-276/257`, handler `:84-88/540-547`, Safe setUps `:62`/`:49`, skips `:153/:182`) re-verified on the working tree at mapping time.
