#!/bin/bash
# TDD Test: Plan 02-01 — DiamondInitFacet refactor (DEBT-04, DEBT-05, QUAL-01)
# Task 1: GeniusAccessControl inheritance, remove duplicate modifier (DEBT-05)
# Task 2: Remove duplicate _grantRole calls (DEBT-04)
# Task 3: Add supportsInterface() override (QUAL-01)
set -euo pipefail

PASS=0
FAIL=0

inc_pass() { PASS=$((PASS + 1)); }
inc_fail() { FAIL=$((FAIL + 1)); }

echo "=== TDD Test Suite: Plan 02-01 – DiamondInitFacet Refactor ==="
echo ""

DIAMOND_INIT="contracts/gnus-ai/DiamondInitFacet.sol"
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

# Test 1: No local onlySuperAdminRole modifier (DEBT-05)
echo "--- Test 1: No local onlySuperAdminRole modifier ---"
if grep -q 'modifier onlySuperAdminRole' "$DIAMOND_INIT" 2>/dev/null; then
    echo "  FAIL: local onlySuperAdminRole modifier found"
    inc_fail
else
    echo "  PASS: no local onlySuperAdminRole modifier"
    inc_pass
fi

# Test 2: Inherits from GeniusAccessControl (DEBT-05)
echo "--- Test 2: Inherits from GeniusAccessControl ---"
if grep -q 'contract DiamondInitFacet is ContextUpgradeable, GeniusAccessControl' "$DIAMOND_INIT" 2>/dev/null; then
    echo "  PASS: DiamondInitFacet inherits GeniusAccessControl"
    inc_pass
else
    echo "  FAIL: DiamondInitFacet does not inherit GeniusAccessControl"
    inc_fail
fi

# Test 3: No _grantRole calls (DEBT-04)
echo "--- Test 3: No duplicate _grantRole calls ---"
if grep -q '_grantRole' "$DIAMOND_INIT" 2>/dev/null; then
    echo "  FAIL: _grantRole calls found (should use _setupRole only)"
    inc_fail
else
    echo "  PASS: no _grantRole calls"
    inc_pass
fi

# Test 4: _setupRole calls preserved for all 3 roles (DEBT-04)
echo "--- Test 4: _setupRole calls preserved ---"
SETUP_COUNT=$(grep -c '_setupRole' "$DIAMOND_INIT" 2>/dev/null || echo 0)
if [ "$SETUP_COUNT" -eq 3 ]; then
    echo "  PASS: 3 _setupRole calls found"
    inc_pass
else
    echo "  FAIL: expected 3 _setupRole calls, found $SETUP_COUNT"
    inc_fail
fi

# Test 5: supportsInterface override present (QUAL-01)
echo "--- Test 5: supportsInterface override ---"
if grep -q 'function supportsInterface' "$DIAMOND_INIT" 2>/dev/null; then
    echo "  PASS: supportsInterface override found"
    inc_pass
else
    echo "  FAIL: supportsInterface override missing"
    inc_fail
fi

# Test 6: supportsInterface checks LibDiamond storage (QUAL-01)
echo "--- Test 6: LibDiamond storage check in supportsInterface ---"
if grep -q 'LibDiamond.diamondStorage().supportedInterfaces\[interfaceId\]' "$DIAMOND_INIT" 2>/dev/null; then
    echo "  PASS: LibDiamond storage check in supportsInterface"
    inc_pass
else
    echo "  FAIL: LibDiamond storage check missing in supportsInterface"
    inc_fail
fi

# Test 7: super.supportsInterface call (QUAL-01)
echo "--- Test 7: super.supportsInterface call ---"
if grep -q 'super.supportsInterface(interfaceId)' "$DIAMOND_INIT" 2>/dev/null; then
    echo "  PASS: super.supportsInterface call found"
    inc_pass
else
    echo "  FAIL: super.supportsInterface call missing"
    inc_fail
fi

# Test 8: Compilation
echo "--- Test 8: Hardhat compilation ---"
if (cd "$PROJECT_ROOT" && yarn hardhat compile 2>/dev/null); then
    echo "  PASS: compilation successful"
    inc_pass
else
    echo "  FAIL: compilation failed"
    inc_fail
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
