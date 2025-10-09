#!/bin/bash
# GNUS-AI GitHub Actions Environment Parity Setup
# Ensures DevContainer matches GitHub Actions CI/CD environment exactly

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get tool version
get_tool_version() {
    local tool=$1
    local version_cmd=$2

    if command_exists "$tool"; then
        eval "$version_cmd" 2>/dev/null || echo "unknown"
    else
        echo "not installed"
    fi
}

# Function to setup Node.js environment
setup_nodejs_environment() {
    log_info "Setting up Node.js environment to match GitHub Actions..."

    # Set Node.js options to match CI
    export NODE_ENV=production
    export CI=true
    export GITHUB_ACTIONS=true

    # Configure npm
    npm config set fund false
    npm config set audit false

    # Configure Yarn
    yarn config set enableGlobalCache true
    yarn config set globalFolder /home/node/.yarn/global
    yarn config set cacheFolder /home/node/.yarn/cache

    log_success "Node.js environment configured"
}

# Function to install CI-specific tools
install_ci_tools() {
    log_info "Installing CI-specific tools..."

    # Install tools that might differ from local development
    if ! command_exists jq; then
        apt-get update && apt-get install -y jq
    fi

    # Ensure all CI-required tools are available
    local required_tools=("node" "yarn" "git" "curl" "wget" "jq")
    local missing_tools=()

    for tool in "${required_tools[@]}"; do
        if ! command_exists "$tool"; then
            missing_tools+=("$tool")
        fi
    done

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        return 1
    fi

    log_success "All CI tools are available"
}

# Function to setup cache directories
setup_cache_directories() {
    log_info "Setting up cache directories to match CI/CD..."

    # Create cache directories matching GitHub Actions
    mkdir -p \
        /home/node/.npm \
        /home/node/.yarn/cache \
        /home/node/.cache/pip \
        /tmp/.cache \
        ./node_modules \
        ./artifacts \
        ./cache \
        ./diamond-abi \
        ./diamond-typechain-types \
        ./typechain-types \
        ./coverage \
        ./reports

    # Set proper permissions
    chown -R node:node /home/node/.npm /home/node/.yarn ./node_modules ./artifacts ./cache

    log_success "Cache directories configured"
}

# Function to validate tool versions
validate_tool_versions() {
    log_info "Validating tool versions against CI/CD requirements..."

    local version_issues=0

    # Node.js version check
    local node_version=$(get_tool_version "node" "node --version | sed 's/v//'")
    if [[ "$node_version" != "22."* ]]; then
        log_warning "Node.js version $node_version may not match CI (expected 22.x)"
        ((version_issues++))
    fi

    # Yarn version check
    local yarn_version=$(get_tool_version "yarn" "yarn --version")
    if [[ "$yarn_version" != "4."* ]]; then
        log_warning "Yarn version $yarn_version may not match CI (expected 4.x)"
        ((version_issues++))
    fi

    # Git version check
    local git_version=$(get_tool_version "git" "git --version | awk '{print \$3}'")
    log_info "Git version: $git_version"

    # Python version check (for security tools)
    local python_version=$(get_tool_version "python3" "python3 --version | awk '{print \$2}'")
    if [[ "$python_version" != "3.11"* ]]; then
        log_warning "Python version $python_version may not match CI (expected 3.11.x)"
        ((version_issues++))
    fi

    if [ $version_issues -eq 0 ]; then
        log_success "Tool versions are compatible with CI/CD"
    else
        log_warning "Found $version_issues version compatibility issues"
    fi
}

# Function to setup environment variables
setup_ci_environment_variables() {
    log_info "Setting up environment variables to match CI/CD..."

    # CI/CD specific environment variables
    export CI=true
    export GITHUB_ACTIONS=true
    export GITHUB_WORKFLOW="DevContainer Parity Check"
    export GITHUB_RUN_ID="devcontainer-run"
    export GITHUB_RUN_NUMBER="1"

    # Disable telemetry and interactive prompts
    export HARDHAT_TELEMETRY_DISABLED=true
    export NEXT_TELEMETRY_DISABLED=true

    # Set production-like settings
    export NODE_ENV=production
    export LOG_LEVEL=warn

    # Gas reporting (disabled in CI for speed)
    export GAS_REPORTER_ENABLED=false
    export REPORT_GAS=false

    log_success "CI/CD environment variables configured"
}

# Function to install dependencies like CI
install_dependencies_ci_style() {
    log_info "Installing dependencies using CI-style approach..."

    if [ -f "yarn.lock" ]; then
        # Use frozen lockfile like CI
        yarn install --frozen-lockfile --prefer-offline --cache-folder /home/node/.yarn/cache
        log_success "Dependencies installed with frozen lockfile"
    else
        log_warning "yarn.lock not found. Installing without lockfile."
        yarn install
    fi
}

# Function to run CI-style compilation
run_ci_compilation() {
    log_info "Running compilation to match CI/CD pipeline..."

    # TypeScript compilation
    if command_exists tsc; then
        if tsc --noEmit; then
            log_success "TypeScript compilation successful"
        else
            log_error "TypeScript compilation failed"
            return 1
        fi
    fi

    # Solidity compilation
    if npx hardhat compile --quiet; then
        log_success "Solidity compilation successful"
    else
        log_error "Solidity compilation failed"
        return 1
    fi

    # TypeChain generation
    if npx hardhat diamond:generate-abi-typechain --diamond-name GeniusDiamond; then
        log_success "TypeChain generation successful"
    else
        log_warning "TypeChain generation failed (may be expected)"
    fi
}

# Function to run security scans like CI
run_ci_security_scans() {
    log_info "Running security scans to match CI/CD pipeline..."

    local scan_results=()

    # Run security checks (non-blocking for setup)
    if yarn audit --audit-level moderate >/dev/null 2>&1; then
        scan_results+=("✅ yarn audit")
    else
        scan_results+=("❌ yarn audit")
    fi

    # Check if security tools are available
    if command_exists semgrep; then
        scan_results+=("✅ semgrep available")
    else
        scan_results+=("❌ semgrep not available")
    fi

    if command_exists slither; then
        scan_results+=("✅ slither available")
    else
        scan_results+=("❌ slither not available")
    fi

    if command_exists snyk; then
        scan_results+=("✅ snyk available")
    else
        scan_results+=("❌ snyk not available")
    fi

    # Print results
    log_info "Security scan availability:"
    for result in "${scan_results[@]}"; do
        echo "  $result"
    done
}

# Function to validate CI/CD parity
validate_ci_parity() {
    log_info "Validating CI/CD environment parity..."

    local parity_issues=0

    # Check if we're running in expected environment
    if [[ "${CI:-false}" != "true" ]]; then
        log_warning "CI environment variable not set"
        ((parity_issues++))
    fi

    # Check Node environment
    if [[ "${NODE_ENV:-}" != "production" ]]; then
        log_warning "NODE_ENV not set to production"
        ((parity_issues++))
    fi

    # Check cache directories exist
    local required_dirs=("./node_modules" "./artifacts" "./cache")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_warning "Required directory $dir does not exist"
            ((parity_issues++))
        fi
    done

    # Check if key files exist
    local required_files=("package.json" "hardhat.config.ts" "tsconfig.json")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_warning "Required file $file does not exist"
            ((parity_issues++))
        fi
    done

    if [ $parity_issues -eq 0 ]; then
        log_success "CI/CD environment parity validated"
    else
        log_warning "Found $parity_issues parity issues"
    fi
}

# Function to display CI/CD information
display_ci_info() {
    log_success "GitHub Actions environment parity setup complete!"
    echo
    log_info "CI/CD Environment Information:"
    echo "  Node.js: $(get_tool_version "node" "node --version")"
    echo "  Yarn: $(get_tool_version "yarn" "yarn --version")"
    echo "  Git: $(get_tool_version "git" "git --version")"
    echo "  Python: $(get_tool_version "python3" "python3 --version")"
    echo "  CI Mode: ${CI:-false}"
    echo "  Node Environment: ${NODE_ENV:-development}"
    echo
    log_info "Available CI/CD commands:"
    echo "  yarn test:ci          - Run tests in CI mode"
    echo "  yarn build:ci         - Build in CI mode"
    echo "  yarn security-check   - Run all security scans"
    echo "  yarn coverage:ci      - Generate coverage report"
    echo
    log_info "To run a full CI/CD simulation:"
    echo "  yarn install --frozen-lockfile"
    echo "  yarn build"
    echo "  yarn test"
    echo "  yarn security-check"
}

# Main execution
main() {
    log_info "Starting GitHub Actions environment parity setup..."

    # Setup components
    setup_nodejs_environment
    install_ci_tools
    setup_cache_directories
    validate_tool_versions
    setup_ci_environment_variables
    install_dependencies_ci_style
    run_ci_compilation
    run_ci_security_scans
    validate_ci_parity

    # Display information
    display_ci_info
}

# Run main function
main "$@"