#!/bin/bash
# GNUS-AI Post-Start Script
# Runs every time the DevContainer starts

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

# Function to check environment health
check_environment_health() {
    log_info "Checking environment health..."

    local issues_found=0

    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        log_error "Not in project root directory"
        ((issues_found++))
    fi

    # Check Node.js version
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version | sed 's/v//')
        if [[ "$(printf '%s\n' "$node_version" "22.0.0" | sort -V | head -n1)" != "22.0.0" ]]; then
            log_warning "Node.js version $node_version may be outdated"
        fi
    else
        log_error "Node.js not found"
        ((issues_found++))
    fi

    # Check if dependencies are installed
    if [[ ! -d "node_modules" ]]; then
        log_warning "node_modules not found. Run 'yarn install'"
        ((issues_found++))
    fi

    # Check if contracts are compiled
    if [[ ! -d "artifacts" ]]; then
        log_warning "Contracts not compiled. Run 'yarn compile'"
    fi

    if [[ $issues_found -eq 0 ]]; then
        log_success "Environment health check passed"
    else
        log_warning "Found $issues_found environment issues"
    fi
}

# Function to check for dependency updates
check_dependency_updates() {
    log_info "Checking for dependency updates..."

    if [[ -f "yarn.lock" ]]; then
        # Check if yarn install is needed
        if yarn check --silent >/dev/null 2>&1; then
            log_success "Dependencies are up to date"
        else
            log_warning "Dependencies may be outdated. Consider running 'yarn install'"
        fi
    fi
}

# Function to setup environment variables
setup_environment_variables() {
    log_info "Setting up environment variables..."

    # Load .env file if it exists
    if [[ -f ".env" ]]; then
        log_info "Loading environment variables from .env"
        # Note: .env is already mounted and should be loaded by the shell
    else
        log_warning ".env file not found. Copy from .env.example if needed"
    fi

    # Set default values for missing environment variables
    export NODE_ENV=${NODE_ENV:-development}
    export HARDHAT_NETWORK=${HARDHAT_NETWORK:-hardhat}
    export CI_MODE=${CI_MODE:-false}
    export GAS_REPORTER_ENABLED=${GAS_REPORTER_ENABLED:-false}
    export REPORT_GAS=${REPORT_GAS:-false}

    log_success "Environment variables configured"
}

# Function to check security tools
check_security_tools() {
    log_info "Checking security tools status..."

    local tools_checked=0
    local tools_available=0

    # Check git-secrets
    ((tools_checked++))
    if command -v git-secrets >/dev/null 2>&1; then
        ((tools_available++))
    fi

    # Check semgrep
    ((tools_checked++))
    if command -v semgrep >/dev/null 2>&1; then
        ((tools_available++))
    fi

    # Check snyk
    ((tools_checked++))
    if command -v snyk >/dev/null 2>&1; then
        ((tools_available++))
    fi

    # Check socket
    ((tools_checked++))
    if command -v socket >/dev/null 2>&1; then
        ((tools_available++))
    fi

    # Check osv-scanner
    ((tools_checked++))
    if command -v osv-scanner >/dev/null 2>&1; then
        ((tools_available++))
    fi

    # Check slither
    ((tools_checked++))
    if command -v slither >/dev/null 2>&1; then
        ((tools_available++))
    fi

    log_info "Security tools: $tools_available/$tools_checked available"

    if [[ $tools_available -lt $tools_checked ]]; then
        log_warning "Some security tools are missing. Run setup-security.sh"
    fi
}

# Function to check git status
check_git_status() {
    log_info "Checking git repository status..."

    if [[ -d ".git" ]]; then
        # Check if there are uncommitted changes
        if [[ -n $(git status --porcelain) ]]; then
            log_warning "Uncommitted changes detected"
        else
            log_success "Working directory is clean"
        fi

        # Check current branch
        local current_branch=$(git branch --show-current)
        log_info "Current branch: $current_branch"

        # Check if branch is behind remote
        if git fetch --quiet 2>/dev/null; then
            local behind_count=$(git rev-list HEAD...origin/$current_branch --count 2>/dev/null || echo "0")
            if [[ "$behind_count" -gt 0 ]]; then
                log_warning "Branch is $behind_count commits behind remote"
            fi
        fi
    else
        log_warning "Not in a git repository"
    fi
}

# Function to setup development server if needed
setup_development_server() {
    log_info "Checking development server setup..."

    # Check if Hardhat network should be running
    if [[ "${START_HARDHAT_NETWORK:-false}" == "true" ]]; then
        log_info "Starting Hardhat network in background..."

        # Check if port 8545 is already in use
        if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_info "Hardhat network already running on port 8545"
        else
            nohup npx hardhat node > logs/hardhat-network.log 2>&1 &
            log_success "Hardhat network started in background"
        fi
    fi
}

# Function to display welcome message
display_welcome_message() {
    echo
    log_success "GNUS-AI DevContainer is ready!"
    echo
    log_info "Available commands:"
    echo "  yarn test              - Run test suite"
    echo "  yarn compile           - Compile contracts"
    echo "  yarn security-check    - Run security scans"
    echo "  npx hardhat node       - Start local blockchain"
    echo "  npx hardhat test       - Run contract tests"
    echo "  yarn lint              - Run linting"
    echo "  yarn build             - Build project"
    echo
    log_info "Security tools:"
    echo "  git secrets --scan     - Scan for secrets"
    echo "  semgrep --config .semgrep.yml --scan ."
    echo "  slither .              - Analyze contracts"
    echo "  snyk test              - Check dependencies"
    echo
    log_info "Happy coding! 🚀"
}

# Function to run startup health checks
run_startup_health_checks() {
    log_info "Running startup health checks..."

    # Quick compilation check
    if [[ -d "artifacts" ]] && [[ -d "diamond-abi" ]]; then
        log_success "Contracts appear to be compiled"
    else
        log_info "Contracts may need compilation. Run 'yarn compile'"
    fi

    # Check if TypeScript types are generated
    if [[ -d "typechain-types" ]] && [[ -d "diamond-typechain-types" ]]; then
        log_success "TypeChain types are generated"
    else
        log_info "TypeChain types may need generation. Run 'yarn compile'"
    fi
}

# Main execution
main() {
    log_info "Starting GNUS-AI post-start initialization..."

    # Run all setup functions
    check_environment_health
    check_dependency_updates
    setup_environment_variables
    check_security_tools
    check_git_status
    setup_development_server
    run_startup_health_checks

    # Display welcome message
    display_welcome_message
}

# Run main function
main "$@"