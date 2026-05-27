#!/bin/bash
# TDD Test: Plan 01-01 — Remove console.log and standardize pragmas
# RED phase: These tests MUST fail because the issues still exist.
# GREEN phase: After fixes, these tests MUST pass.
set -euo pipefail

PASS=0

echo "=== TDD Test Suite: Plan 01-01 – Cleanup ==="
echo ""

# Test 1: DiamondInitFacet.sol contains zero console references
echo "--- Test 1: Zero console references in DiamondInitFacet.sol ---"
if grep -q "console" contracts/gnus-ai/DiamondInitFacet.sol; then
    echo "FAIL: console reference found in DiamondInitFacet.sol"
    echo "  Lines containing 'console':"
    grep -n "console" contracts/gnus-ai/DiamondInitFacet.sol
    PASS=1
else
    echo "PASS: no console references in DiamondInitFacet.sol"
fi

# Test 2: DiamondInitFacet.sol uses pragma solidity ^0.8.19
echo ""
echo "--- Test 2: DiamondInitFacet.sol pragma is ^0.8.19 ---"
DI_PRAGMA=$(grep "pragma solidity" contracts/gnus-ai/DiamondInitFacet.sol)
if echo "$DI_PRAGMA" | grep -q "0.8.19"; then
    echo "PASS: DiamondInitFacet.sol pragma is ^0.8.19"
else
    echo "FAIL: DiamondInitFacet.sol pragma is not ^0.8.19"
    echo "  Current: $DI_PRAGMA"
    PASS=1
fi

# Test 3: All .sol files in contracts/gnus-ai/ use ^0.8.19 (excluding already-correct files)
echo ""
echo "--- Test 3: All production contracts use pragma ^0.8.19 ---"
NON_STANDARD=$(grep -rn "pragma solidity" contracts/gnus-ai/*.sol | grep -v "0.8.19" || true)
LIB_NON_STANDARD=$(grep -rn "pragma solidity" contracts/gnus-ai/libraries/*.sol 2>/dev/null | grep -v "0.8.19" || true)
COMBINED="$NON_STANDARD$LIB_NON_STANDARD"

TOTAL_PRG=$(grep -rc "pragma solidity" contracts/gnus-ai/*.sol contracts/gnus-ai/libraries/*.sol 2>/dev/null | grep -v ":0$" | wc -l)
STD_PRG=$(grep -c "pragma solidity.*0.8.19" contracts/gnus-ai/*.sol contracts/gnus-ai/libraries/*.sol 2>/dev/null | grep -v ":0$" | wc -l)

echo "  Total files with pragma: $TOTAL_PRG"
echo "  Currently at ^0.8.19: $STD_PRG"

if [ -z "$NON_STANDARD" ] && [ -z "$LIB_NON_STANDARD" ]; then
    echo "PASS: all pragmas are ^0.8.19"
else
    echo "FAIL: non-0.8.19 pragmas found:"
    [ -n "$NON_STANDARD" ] && echo "$NON_STANDARD"
    [ -n "$LIB_NON_STANDARD" ] && echo "$LIB_NON_STANDARD"
    PASS=1
fi

# Test 4: GeniusAccessControl.sol and GNUSWithdrawLimiter.sol remain at ^0.8.19
echo ""
echo "--- Test 4: Already-correct files remain at ^0.8.19 ---"
for FILE in GeniusAccessControl.sol GNUSWithdrawLimiter.sol; do
    if grep -q "pragma solidity.*0.8.19" "contracts/gnus-ai/$FILE"; then
        echo "PASS: $FILE pragma is ^0.8.19"
    else
        echo "FAIL: $FILE pragma changed unexpectedly"
        PASS=1
    fi
done

echo ""
echo "=== Test Suite Result ==="
if [ "$PASS" -eq 0 ]; then
    echo "ALL TESTS PASSED"
    exit 0
else
    echo "SOME TESTS FAILED (expected in RED phase)"
    exit 1
fi
