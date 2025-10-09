#!/bin/bash
# GNUS-AI Post-Create Script
# Runs after DevContainer creation to set up the development environment

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

# Function to install dependencies
install_dependencies() {
    log_info "Installing project dependencies..."

    if [ -f yarn.lock ]; then
        log_info "Using Yarn for dependency management..."

        # Configure Yarn for better performance (Yarn 4.x compatible)
        yarn config set nodeLinker node-modules 2>/dev/null || log_warning "Could not set node linker"

        # Check if we have permission issues with .yarn directory
        if [ -d "/home/node/.yarn" ] && [ ! -w "/home/node/.yarn" ]; then
            log_warning ".yarn directory has permission issues. This should be fixed in devcontainer.json"
        fi

        # Install dependencies (don't fail completely on git dependency issues)
        log_info "Running yarn install..."
        if yarn install --immutable; then
            log_success "Dependencies installed successfully"
        else
            log_warning "Some dependencies failed to install, but continuing with setup..."
            # Check if essential dependencies are available
            if [ -d "node_modules" ] && [ -f "node_modules/.bin/hardhat" ] && [ -f "node_modules/.bin/tsc" ]; then
                log_info "Essential dependencies (hardhat, typescript) are available"
            else
                log_error "Essential dependencies are missing"
                return 1
            fi
        fi
    else
        log_warning "yarn.lock not found. Running yarn install without lockfile..."
        yarn install
    fi
}

# Function to compile TypeScript
compile_typescript() {
    log_info "Compiling TypeScript..."

    if command_exists tsc; then
        if tsc --noEmit; then
            log_success "TypeScript compilation successful"
        else
            log_warning "TypeScript compilation failed, but continuing..."
        fi
    else
        log_warning "TypeScript compiler not found. Installing..."
        if yarn add -D typescript; then
            if npx tsc --noEmit; then
                log_success "TypeScript compilation successful"
            else
                log_warning "TypeScript compilation failed after install, but continuing..."
            fi
        else
            log_warning "Failed to install TypeScript, but continuing with setup..."
        fi
    fi
}

# Function to compile Solidity contracts
compile_solidity() {
    log_info "Compiling Solidity contracts..."

    if command_exists npx; then
        if npx hardhat compile; then
            log_success "Solidity compilation successful"
        else
            log_error "Solidity compilation failed"
            return 1
        fi
    else
        log_error "npx not found. Cannot compile contracts."
        return 1
    fi
}

# Function to generate TypeChain types
generate_typechain() {
    log_info "Generating TypeChain types..."

    if yarn clean-compile; then
        log_success "TypeChain types generated successfully"
    else
        log_warning "TypeChain generation failed. This may be expected if contracts haven't been compiled yet."
    fi
}

# Function to setup Husky git hooks
setup_husky_hooks() {
    log_info "Setting up Husky git hooks..."

    if [ -d .husky ]; then
        if yarn prepare; then
            log_success "Husky hooks set up successfully"
        else
            log_warning "Failed to set up Husky hooks"
        fi
    else
        log_info "No .husky directory found. Skipping Husky setup."
    fi
}

# Function to run initial linting
run_linting() {
    log_info "Running initial linting..."

    if [ -f "eslint.config.mjs" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
        if yarn lint; then
            log_success "Linting passed"
        else
            log_warning "Linting found issues. Check the output above."
        fi
    else
        log_info "No ESLint configuration found. Skipping linting."
    fi
}

# Function to run initial security scan
run_initial_security_scan() {
    log_info "Running initial security scan..."

    # Run a quick security check
    if yarn security-check >/dev/null 2>&1; then
        log_success "Initial security scan passed"
    else
        log_warning "Initial security scan found issues. Run 'yarn security-check' for details."
    fi
}

# Function to setup Hardhat configuration
setup_hardhat_config() {
    log_info "Setting up Hardhat configuration..."

    if [ -f "hardhat.config.ts" ]; then
        log_info "Hardhat configuration found"

        # Test Hardhat setup
        if npx hardhat --version >/dev/null 2>&1; then
            log_success "Hardhat is properly configured"
        else
            log_warning "Hardhat configuration may need attention"
        fi
    else
        log_warning "hardhat.config.ts not found"
    fi
}

# Function to setup multi-chain testing
setup_multichain_testing() {
    log_info "Setting up multi-chain testing environment..."

    if [ -f ".multichain.yml" ]; then
        log_info "Multi-chain configuration found"

        # Check if hardhat-multichain is available
        if yarn list | grep -q hardhat-multichain; then
            log_success "Multi-chain testing is configured"
        else
            log_warning "hardhat-multichain not found in dependencies"
        fi
    else
        log_info "No multi-chain configuration found"
    fi
}

# Function to verify environment
verify_environment() {
    log_info "Verifying development environment..."

    local checks_passed=0
    local total_checks=0

    # Check Node.js
    ((total_checks++))
    if command_exists node && node --version >/dev/null 2>&1; then
        ((checks_passed++))
        log_success "Node.js: $(node --version)"
    else
        log_error "Node.js check failed"
    fi

    # Check Yarn
    ((total_checks++))
    if command_exists yarn && yarn --version >/dev/null 2>&1; then
        ((checks_passed++))
        log_success "Yarn: $(yarn --version)"
    else
        log_error "Yarn check failed"
    fi

    # Check TypeScript
    ((total_checks++))
    if command_exists tsc && tsc --version >/dev/null 2>&1; then
        ((checks_passed++))
        log_success "TypeScript compiler available"
    else
        log_warning "TypeScript compiler not found"
    fi

    # Check Hardhat
    ((total_checks++))
    if npx hardhat --version >/dev/null 2>&1; then
        ((checks_passed++))
        log_success "Hardhat available"
    else
        log_error "Hardhat check failed"
    fi

    # Check Git
    ((total_checks++))
    if command_exists git && git --version >/dev/null 2>&1; then
        ((checks_passed++))
        log_success "Git available"
        
        # Configure git pager to use 'more' for better readability
        git config --global core.pager more
        log_info "Git pager configured to use 'more'"
    else
        log_error "Git check failed"
    fi

    log_info "Environment verification: $checks_passed/$total_checks checks passed"
}

# Function to display next steps
display_next_steps() {
    log_success "GNUS-AI DevContainer setup completed!"
    echo
    log_info "Next steps:"
    echo "  1. Run 'yarn test' to execute the test suite"
    echo "  2. Run 'yarn compile' to compile contracts and generate types"
    echo "  3. Run 'yarn security-check' to run all security scans"
    echo "  4. Use 'npx hardhat node' to start a local blockchain"
    echo "  5. Use 'npx hardhat test --network hardhat' for local testing"
    echo
    log_info "Available commands:"
    echo "  yarn dev          - Start development environment"
    echo "  yarn build        - Build the project"
    echo "  yarn test         - Run tests"
    echo "  yarn lint         - Run linting"
    echo "  yarn security-check - Run security scans"
    echo "  npx hardhat help  - Show Hardhat commands"
}

# Main execution
main() {
    log_info "Starting GNUS-AI post-create setup..."

    # Run setup steps
    install_dependencies
    compile_typescript
    compile_solidity
    generate_typechain
    setup_husky_hooks
    run_linting
    run_initial_security_scan
    setup_hardhat_config
    setup_multichain_testing
    verify_environment

    # Display next steps
    display_next_steps
}

# Run main function with error handling
if main "$@"; then
    log_success "Post-create setup completed successfully"
    exit 0
else
    log_error "Post-create setup failed"
    exit 1
fi