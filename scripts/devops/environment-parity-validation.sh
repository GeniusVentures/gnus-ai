#!/bin/bash
# GNUS-DAO Environment Parity Validation Script
# Validates that DevContainer environment matches local development environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check version compatibility
check_version() {
    local tool="$1"
    local expected="$2"
    local actual="$3"

    if [[ "$actual" == *"$expected"* ]]; then
        log_success "$tool version matches: $actual"
        return 0
    else
        log_error "$tool version mismatch: expected $expected*, got $actual"
        return 1
    fi
}

# Function to check tool availability
check_tool() {
    local tool="$1"
    local required="${2:-true}"

    if command -v "$tool" >/dev/null 2>&1; then
        local version
        version=$("$tool" --version 2>/dev/null | head -1 || echo "Version unknown")
        log_success "$tool available: $version"
        return 0
    else
        if [[ "$required" == "true" ]]; then
            log_error "$tool not available (required)"
            return 1
        else
            log_warning "$tool not available (optional)"
            return 0
        fi
    fi
}

# Function to validate Node.js environment
validate_nodejs() {
    log_info "Validating Node.js environment..."

    # Check Node.js version
    local node_version
    node_version=$(node --version)
    check_version "Node.js" "v22." "$node_version"

    # Check npm
    check_tool "npm"

    # Check yarn
    check_tool "yarn"

    # Check corepack
    check_tool "corepack"

    # Check package.json integrity
    if [ -f "package.json" ]; then
        log_success "package.json found"
    else
        log_error "package.json not found"
        return 1
    fi

    # Check yarn.lock
    if [ -f "yarn.lock" ]; then
        log_success "yarn.lock found"
    else
        log_error "yarn.lock not found"
        return 1
    fi
}

# Function to validate Python environment
validate_python() {
    log_info "Validating Python environment..."

    # Check Python version
    local python_version
    python_version=$(python3 --version)
    check_version "Python" "3.11" "$python_version"

    # Check pip
    check_tool "pip3"

    # Check pipx (optional)
    check_tool "pipx" false
}

# Function to validate Go environment (optional)
validate_go() {
    log_info "Validating Go environment..."

    # Check Go version (optional)
    if command -v go >/dev/null 2>&1; then
        local go_version
        go_version=$(go version)
        log_success "Go available: $go_version"
    else
        log_warning "Go not available (optional)"
    fi
}

# Function to validate development tools
validate_dev_tools() {
    log_info "Validating development tools..."

    # Essential tools
    check_tool "hardhat"
    check_tool "tsc"
    check_tool "eslint"
    check_tool "prettier"

    # Git
    check_tool "git"

    # Build tools
    check_tool "make" false
    check_tool "cmake" false
}

# Function to validate security tools
validate_security_tools() {
    log_info "Validating security tools..."

    # Required security tools
    check_tool "slither" false  # May not be available in all environments
    check_tool "semgrep" false
    check_tool "snyk" false

    # Git secrets
    check_tool "git-secrets" false

    # OSV Scanner
    if [ -f "bin/osv-scanner" ]; then
        log_success "OSV Scanner available"
    else
        log_warning "OSV Scanner not found in bin/"
    fi
}

# Function to validate project structure
validate_project_structure() {
    log_info "Validating project structure..."

    local required_dirs=("contracts" "test" "scripts" "artifacts" "diamond-abi" "diamond-typechain-types")
    local required_files=("hardhat.config.ts" "tsconfig.json" ".eslintrc.js" ".prettierrc")

    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_success "Directory $dir exists"
        else
            log_error "Directory $dir missing"
            return 1
        fi
    done

    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log_success "File $file exists"
        else
            log_error "File $file missing"
            return 1
        fi
    done
}

# Function to validate Diamond configuration
validate_diamond_config() {
    log_info "Validating Diamond configuration..."

    if [ -f "diamonds/GNUSDAODiamond/gnusdaodiamond.config.json" ]; then
        log_success "Diamond configuration file exists"

        # Validate JSON syntax
        if jq empty "diamonds/GNUSDAODiamond/gnusdaodiamond.config.json" 2>/dev/null; then
            log_success "Diamond configuration JSON is valid"
        else
            log_error "Diamond configuration JSON is invalid"
            return 1
        fi
    else
        log_error "Diamond configuration file not found"
        return 1
    fi
}

# Function to test compilation
test_compilation() {
    log_info "Testing compilation..."

    # Clean and compile
    if yarn clean && yarn compile; then
        log_success "Compilation successful"

        # Check if artifacts were generated
        if [ -d "artifacts" ] && [ "$(ls -A artifacts)" ]; then
            log_success "Artifacts generated successfully"
        else
            log_error "No artifacts generated"
            return 1
        fi
    else
        log_error "Compilation failed"
        return 1
    fi
}

# Function to generate environment report
generate_report() {
    log_info "Generating environment report..."

    local report_file="environment-parity-report.json"

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "environment": "devcontainer",
  "validation_results": {
    "nodejs": $(validate_nodejs && echo "true" || echo "false"),
    "python": $(validate_python && echo "true" || echo "false"),
    "go": $(validate_go && echo "true" || echo "false"),
    "dev_tools": $(validate_dev_tools && echo "true" || echo "false"),
    "security_tools": $(validate_security_tools && echo "true" || echo "false"),
    "project_structure": $(validate_project_structure && echo "true" || echo "false"),
    "diamond_config": $(validate_diamond_config && echo "true" || echo "false"),
    "compilation": $(test_compilation && echo "true" || echo "false")
  },
  "system_info": {
    "os": "$(uname -a)",
    "node_version": "$(node --version)",
    "yarn_version": "$(yarn --version)",
    "python_version": "$(python3 --version)",
    "git_version": "$(git --version | head -1)"
  }
}
EOF

    log_success "Environment report generated: $report_file"
}

# Main validation function
main() {
    log_info "Starting GNUS-DAO DevContainer Environment Parity Validation"
    echo

    local errors=0

    # Run all validations
    validate_nodejs || ((errors++))
    echo
    validate_python || ((errors++))
    echo
    validate_go || ((errors++))
    echo
    validate_dev_tools || ((errors++))
    echo
    validate_security_tools || ((errors++))
    echo
    validate_project_structure || ((errors++))
    echo
    validate_diamond_config || ((errors++))
    echo

    # Generate report
    generate_report

    echo
    if [ $errors -eq 0 ]; then
        log_success "✅ All environment parity checks passed!"
        log_success "DevContainer environment matches local development requirements."
        exit 0
    else
        log_error "❌ $errors environment parity check(s) failed!"
        log_error "DevContainer environment does not match local development requirements."
        exit 1
    fi
}

# Run main function
main "$@"