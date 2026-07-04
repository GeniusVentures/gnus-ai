#!/bin/bash
# TDD Test: Plan 02-02 — Remove GeniusAI facet (DEBT-01)
set -euo pipefail

PASS=0
FAIL=0
inc_pass() { PASS=$((PASS + 1)); }
inc_fail() { FAIL=$((FAIL + 1)); }

echo "=== TDD Test Suite: Plan 02-02 – GeniusAI Facet Removal ==="
echo ""
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

# Test 1: GeniusAI.sol deleted
echo "--- Test 1: GeniusAI.sol deleted ---"
if test ! -f contracts/gnus-ai/GeniusAI.sol; then
    echo "  PASS: GeniusAI.sol deleted"
    inc_pass
else
    echo "  FAIL: GeniusAI.sol still exists"
    inc_fail
fi

# Test 2: GeniusAIStorage.sol deleted
echo "--- Test 2: GeniusAIStorage.sol deleted ---"
if test ! -f contracts/gnus-ai/GeniusAIStorage.sol; then
    echo "  PASS: GeniusAIStorage.sol deleted"
    inc_pass
else
    echo "  FAIL: GeniusAIStorage.sol still exists"
    inc_fail
fi

# Test 3: Test files deleted
echo "--- Test 3: Test files deleted ---"
if test ! -f test/unit/GeniusAI.test.ts && test ! -f test/unit/GeniusAIStorage.test.ts; then
    echo "  PASS: test files deleted"
    inc_pass
else
    echo "  FAIL: test files still exist"
    inc_fail
fi

# Test 4: No GeniusAI in primary config
echo "--- Test 4: No GeniusAI in primary config ---"
if ! grep -q '"GeniusAI"' diamonds/GeniusDiamond/geniusdiamond.config.json 2>/dev/null; then
    echo "  PASS: no GeniusAI in primary config"
    inc_pass
else
    echo "  FAIL: GeniusAI found in primary config"
    inc_fail
fi

# Test 5: No GeniusAI in override config
echo "--- Test 5: No GeniusAI in override config ---"
if ! grep -q '"GeniusAI"' diamonds/GeniusDiamond/geniusdiamond-erc1155override.config.json 2>/dev/null; then
    echo "  PASS: no GeniusAI in override config"
    inc_pass
else
    echo "  FAIL: GeniusAI found in override config"
    inc_fail
fi

# Test 6: No GeniusAI in test config
echo "--- Test 6: No GeniusAI in test config ---"
if ! grep -q '"GeniusAI"' test-assets/test-diamonds/GeniusDiamond/geniusdiamond.config.json 2>/dev/null; then
    echo "  PASS: no GeniusAI in test config"
    inc_pass
else
    echo "  FAIL: GeniusAI found in test config"
    inc_fail
fi

# Test 7: Config JSON validity
echo "--- Test 7: Config JSON validity ---"
VALID=true
node -e "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/diamonds/GeniusDiamond/geniusdiamond.config.json', 'utf8'))" 2>/dev/null || VALID=false
node -e "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/diamonds/GeniusDiamond/geniusdiamond-erc1155override.config.json', 'utf8'))" 2>/dev/null || VALID=false
node -e "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/test-assets/test-diamonds/GeniusDiamond/geniusdiamond.config.json', 'utf8'))" 2>/dev/null || VALID=false
if $VALID; then
    echo "  PASS: all configs valid JSON"
    inc_pass
else
    echo "  FAIL: config JSON invalid"
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

# Test 9: No GeniusAI in typechain
echo "--- Test 9: No GeniusAI in typechain-types ---"
if ! grep -rq "GeniusAI" "$PROJECT_ROOT/typechain-types/" 2>/dev/null; then
    echo "  PASS: no GeniusAI in typechain exports"
    inc_pass
else
    echo "  FAIL: GeniusAI found in typechain exports"
    inc_fail
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
