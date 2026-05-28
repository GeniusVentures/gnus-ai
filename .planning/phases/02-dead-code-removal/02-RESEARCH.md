# Phase 2 Research: Dead Code Removal

**Researched:** 2026-05-27
**Phase:** 02 — Dead Code Removal
**Requirements:** DEBT-01, DEBT-04, DEBT-05, QUAL-01

---

## Domain Analysis

### Requirement Breakdown

| ID | Requirement | Type |
|----|-------------|------|
| DEBT-01 | Remove GeniusAI facet — delete `GeniusAI.sol`, `GeniusAIStorage.sol`, and remove from diamond config | Dead code removal |
| DEBT-04 | Remove duplicate `_setupRole`/`_grantRole` calls in `DiamondInitFacet.diamondInitialize250()` | Code deduplication |
| DEBT-05 | Remove duplicated `onlySuperAdminRole` modifier from `DiamondInitFacet.sol` | Code deduplication |
| QUAL-01 | Add `supportsInterface()` override to `DiamondInitFacet.sol` | ERC-165 compliance |

### Current State

**DEBT-01 — GeniusAI facet removal:**
- `contracts/gnus-ai/GeniusAI.sol` (40 lines): Escrow contract for AI processing jobs. Uses `GeniusAIStorage` library and extends `GeniusAccessControl`.
- `contracts/gnus-ai/GeniusAIStorage.sol` (39 lines): Diamond storage library with `AIProcessingJob` struct and storage layout.
- Active in `diamonds/GeniusDiamond/geniusdiamond.config.json` at priority 70 with deployInit `GeniusAI_Initialize()`.
- Also present in: `geniusdiamond-erc1155override.config.json`, `test-assets/test-diamonds/GeniusDiamond/geniusdiamond.config.json`, and all deployment files.
- Referenced nowhere else in Solidity code (zero imports from other contracts).
- Test files: `test/unit/GeniusAI.test.ts`, `test/unit/GeniusAIStorage.test.ts`.
- Docs: `docs/GeniusAI.md`, `docs/GeniusAIStorage.md`.
- Build artifacts: `artifacts/contracts/gnus-ai/GeniusAI.sol/`, `artifacts/contracts/gnus-ai/GeniusAIStorage.sol/`, `cache/solidity-files-cache.json`.
- TypeChain: `typechain-types/contracts/gnus-ai/GeniusAI.ts`, `typechain-types/factories/contracts/gnus-ai/GeniusAI__factory.ts`, plus index exports.

**DEBT-04 — Duplicate role calls:**
In `DiamondInitFacet.diamondInitialize250()` (lines 48-55):
```solidity
_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // line 49
_setupRole(MINTER_ROLE, _msgSender());           // line 50
_setupRole(UPGRADER_ROLE, _msgSender());         // line 51

_grantRole(DEFAULT_ADMIN_ROLE, sender);          // line 53
_grantRole(MINTER_ROLE, sender);                // line 54
_grantRole(UPGRADER_ROLE, sender);              // line 55
```
`_setupRole` internally calls `_grantRole` AND sets the role's admin role. Calling both for the same role/sender pair is redundant. The `_grantRole` calls on lines 53-55 are duplicates since `_setupRole` already grants.

**DEBT-05 — Duplicate modifier:**
`DiamondInitFacet.sol` lines 33-39 define its own `onlySuperAdminRole` modifier:
```solidity
modifier onlySuperAdminRole() {
    require(LibDiamond.diamondStorage().contractOwner == _msgSender(), "Only SuperAdmin allowed");
    _;
}
```
`GeniusAccessControl.sol` line 73 defines the identical modifier. DiamondInitFacet does NOT currently import or inherit from `GeniusAccessControl` — it inherits directly from `ContextUpgradeable, AccessControlEnumerableUpgradeable`.

**QUAL-01 — Missing supportsInterface:**
`DiamondInitFacet.sol` has no `supportsInterface()` override. Other facets implement this:

*GNUSBridge pattern (lines 49-59):*
```solidity
function supportsInterface(bytes4 interfaceId)
    public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable)
    returns (bool)
{
    return (ERC1155Upgradeable.supportsInterface(interfaceId) ||
        AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
}
```

*GNUSNFTFactory pattern (lines 140-142):*
```solidity
function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
    return (ERC1155Upgradeable.supportsInterface(interfaceId) || AccessControlEnumerableUpgradeable.supportsInterface(interfaceId) ||
    (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true));
}
```

*GNUSWithdrawLimiter pattern (lines 238-239):*
```solidity
function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return super.supportsInterface(interfaceId);
}
```

For DiamondInitFacet (inherits `ContextUpgradeable, AccessControlEnumerableUpgradeable`), the pattern should be:
```solidity
function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return super.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true);
}
```
Only one parent contract (`AccessControlEnumerableUpgradeable`) has `supportsInterface`, so it uses `super` rather than explicit parent references. The `LibDiamond.diamondStorage().supportedInterfaces` check matches the pattern from GNUSBridge/GNUSNFTFactory.

---

## Standard Stack & Patterns

**Language:** Solidity ^0.8.19 (standardized in Phase 1)
**Framework:** Hardhat + Foundry hybrid
**Diamond Standard:** EIP-2535 via contracts-starter (mudgen/diamond-2-hardhat)
**Upgradeable libs:** @gnus.ai/contracts-upgradeable-diamond (local fork)

**Phase 1 established patterns:**
- TDD bash verification scripts in `test/unit/` for contract property checks
- Commit format: `{type}({phase}): {description}`
- Artifact cleanup after file deletion (artifacts, cache, typechain)

---

## Architecture Decisions

### DEBT-05 + DEBT-04: Refactor DiamondInitFacet Inheritance

**Decision:** Change DiamondInitFacet to inherit from `GeniusAccessControl` instead of `AccessControlEnumerableUpgradeable` directly, which solves both DEBT-04 and DEBT-05:

```solidity
// Before:
contract DiamondInitFacet is ContextUpgradeable, AccessControlEnumerableUpgradeable {
    // ... duplicate onlySuperAdminRole modifier (DEBT-05)
    // ... duplicate _setupRole + _grantRole calls (DEBT-04)
}

// After:
import "./GeniusAccessControl.sol";

contract DiamondInitFacet is ContextUpgradeable, GeniusAccessControl {
    // onlySuperAdminRole inherited from GeniusAccessControl (DEBT-05 solved)
    // diamondInitialize250() uses only _setupRole (DEBT-04 solved)
}
```

**Rationale:**
- `GeniusAccessControl` is `abstract contract GeniusAccessControl is Initializable, AccessControlEnumerableUpgradeable`
- DiamondInitFacet already imports `Initializable` and uses `InitializableStorage`
- The modifier in GeniusAccessControl is byte-for-byte identical (both check `LibDiamond.diamondStorage().contractOwner`)
- No other contract behavior changes — GeniusAccessControl adds `renounceRole`/`revokeRole` overrides with super-admin protection, which are desirable in DiamondInitFacet
- For DEBT-04: keep `_setupRole()` calls (which internally call `_grantRole` AND set admin role), remove the standalone `_grantRole()` calls on lines 53-55

**Risk:** None. GeniusAccessControl is designed to be inherited by diamond facets (already used by GeniusAI, GeniusOwnershipFacet, GNUSBridge, GNUSContractAssets, GNUSControl).

### DEBT-01: GeniusAI Removal Scope

**Files to delete:**
1. `contracts/gnus-ai/GeniusAI.sol`
2. `contracts/gnus-ai/GeniusAIStorage.sol`
3. `test/unit/GeniusAI.test.ts`
4. `test/unit/GeniusAIStorage.test.ts`
5. `docs/GeniusAI.md`
6. `docs/GeniusAIStorage.md`

**Configs to update (remove GeniusAI facet entry):**
1. `diamonds/GeniusDiamond/geniusdiamond.config.json` — primary config (lines 62-69)
2. `diamonds/GeniusDiamond/geniusdiamond-erc1155override.config.json` — override variant (lines 58-64)
3. `test-assets/test-diamonds/GeniusDiamond/geniusdiamond.config.json` — test config (lines 52-58)

**Configs intentionally NOT modified:**
- `diamonds/GeniusDiamond/archive/` — historical archives, preserved as-is
- `diamonds/GeniusDiamond/deployments/` — deployment state files, updated on redeploy only
- All `deployments/*.json` files — runtime-only, reflect live state

**Artifacts regenerated by `npx hardhat compile`:**
- `artifacts/contracts/gnus-ai/GeniusAI.sol/` and `GeniusAIStorage.sol/` — removed
- `cache/solidity-files-cache.json` — GeniusAI entry removed
- `typechain-types/contracts/gnus-ai/GeniusAI.ts` — removed
- `typechain-types/factories/contracts/gnus-ai/GeniusAI__factory.ts` — removed
- `typechain-types/contracts/gnus-ai/index.ts` — GeniusAI export removed
- `typechain-types/index.ts` — GeniusAI export removed
- `typechain-types/hardhat.d.ts` — GeniusAI entries removed

### QUAL-01: supportsInterface Implementation

**Pattern to follow:** GNUSBridge/GNUSNFTFactory pattern with `LibDiamond.diamondStorage().supportedInterfaces` check.

The implementation for DiamondInitFacet:
```solidity
function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return super.supportsInterface(interfaceId) ||
        (LibDiamond.diamondStorage().supportedInterfaces[interfaceId] == true);
}
```

Must import `LibDiamond` (already imported at line 7).

---

## Common Pitfalls

1. **ABI mismatch after removal:** The diamond ABI will change after removing GeniusAI selectors. The `hardhat.config.ts` diamond deploy scripts reference the config. A full `npx hardhat compile` is required after config changes.
2. **Test fixture breakage:** Test diamond fixtures in `test-assets/` may reference GeniusAI. The test config must be updated.
3. **Deployment scripts:** Check `deploy/` and `tasks/` directories for scripts that reference GeniusAI by name.
4. **Slither results:** `.vscode/slither-results.json` contains GeniusAI references — should be regenerated after removal.
5. **Cache staleness:** Hardhat cache must be cleared (`npx hardhat clean`) before recompiling to avoid stale ABI artifacts.

---

## Dependency Analysis

**In-phase dependencies:**
- DEBT-05 (change inheritance) must be done BEFORE DEBT-04 (remove duplicate _grantRole calls), since the new inheritance chain may affect which role functions are available.
- QUAL-01 (add supportsInterface) is independent of DEBT-01/DEBT-04/DEBT-05.

**Cross-phase dependencies:**
- Phase 3 (Input Validation) touches GNUSBridge and ERC20TransferBatch — no direct dependency on Phase 2 changes.
- Phase 4 (Access Control) touches DiamondInitFacet.diamondInitialize250() — Phase 2 must leave the function correctly protected with onlySuperAdminRole.
- Phase 5 (Circuit Breaker) adds pause mechanism — independent.
- Phase 6 (Test Coverage) expects GeniusAI tests to be gone or repurposed.

---

## Validation Architecture

### Nyquist Sampling Strategy

| Requirement | Verification Method | Critical Path |
|-------------|-------------------|---------------|
| DEBT-01 | File existence grep + config grep + compile | Delete .sol files → remove from config → compile → verify |
| DEBT-04 | Source grep for `_grantRole` in DiamondInitFacet | Remove lines → compile → verify |
| DEBT-05 | Source grep for local `onlySuperAdminRole` in DiamondInitFacet | Change inheritance → remove modifier → compile → verify |
| QUAL-01 | Source grep for `supportsInterface` in DiamondInitFacet | Add override → compile → verify |

### Verification Commands

```bash
# DEBT-01 verification
test ! -f contracts/gnus-ai/GeniusAI.sol && echo "PASS: GeniusAI.sol deleted"
test ! -f contracts/gnus-ai/GeniusAIStorage.sol && echo "PASS: GeniusAIStorage.sol deleted"
! grep -q '"GeniusAI"' diamonds/GeniusDiamond/geniusdiamond.config.json && echo "PASS: GeniusAI removed from config"
! grep -q '"GeniusAI"' test-assets/test-diamonds/GeniusDiamond/geniusdiamond.config.json && echo "PASS: GeniusAI removed from test config"
npx hardhat compile && echo "PASS: Compilation succeeds"

# DEBT-04 verification
grep -c '_grantRole' contracts/gnus-ai/DiamondInitFacet.sol  # should be 0 or only in non-d2550 context

# DEBT-05 verification
! grep -q 'modifier onlySuperAdminRole' contracts/gnus-ai/DiamondInitFacet.sol && echo "PASS: No local modifier"
grep -q 'GeniusAccessControl' contracts/gnus-ai/DiamondInitFacet.sol && echo "PASS: Inherits GeniusAccessControl"

# QUAL-01 verification
grep -q 'function supportsInterface' contracts/gnus-ai/DiamondInitFacet.sol && echo "PASS: supportsInterface present"
grep -q 'LibDiamond.diamondStorage().supportedInterfaces' contracts/gnus-ai/DiamondInitFacet.sol && echo "PASS: Diamond storage check present"
```

---

## Summary

Phase 2 is a surgical dead code removal and deduplication phase. The core challenge is:

1. **DEBT-01:** Remove GeniusAI — a clean deletion with cascading config/test/doc/artifact cleanup.
2. **DEBT-05 + DEBT-04:** Refactor DiamondInitFacet to inherit from GeniusAccessControl, which eliminates both the duplicate modifier AND the duplicate role-granting calls in one architectural change.
3. **QUAL-01:** Add ERC-165 support following the established GNUSBridge/GNUSNFTFactory pattern.

All changes are testnet-safe (no mainnet deployment exists). Diamond upgrade will be required to remove GeniusAI from deployed testnet instances — the config change + recompile is sufficient for the contract side; redeployment is a separate concern.
