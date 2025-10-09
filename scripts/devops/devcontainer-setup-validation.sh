#!/bin/bash
# GNUS-DAO DevContainer CI/CD Setup Validation
# Validates the complete DevContainer CI/CD integration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
REPORTS_DIR="${PROJECT_ROOT}/reports/devcontainer-validation"

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

# Function to create reports directory
setup_reports_dir() {
    mkdir -p "$REPORTS_DIR"
    log_success "Reports directory created: $REPORTS_DIR"
}

# Function to validate DevContainer configuration
validate_devcontainer_config() {
    log_info "Validating DevContainer configuration..."

    local errors=0

    # Check Dockerfile exists
    if [ -f ".devcontainer/Dockerfile" ]; then
        log_success "Dockerfile exists"
    else
        log_error "Dockerfile not found"
        ((errors++))
    fi

    # Check devcontainer.json exists
    if [ -f ".devcontainer/devcontainer.json" ]; then
        log_success "devcontainer.json exists"

        # Validate JSON syntax
        if jq empty ".devcontainer/devcontainer.json" >/dev/null 2>&1; then
            log_success "devcontainer.json is valid JSON"
        else
            log_error "devcontainer.json contains invalid JSON"
            ((errors++))
        fi
    else
        log_error "devcontainer.json not found"
        ((errors++))
    fi

    # Check post-create script
    if [ -f ".devcontainer/scripts/post-create.sh" ]; then
        log_success "post-create.sh exists"
    else
        log_warning "post-create.sh not found (optional)"
    fi

    return $errors
}

# Function to validate GitHub Actions workflows
validate_workflows() {
    log_info "Validating GitHub Actions workflows..."

    local errors=0

    # Check DevContainer CI workflow
    if [ -f ".github/workflows/devcontainer-ci.yml" ]; then
        log_success "DevContainer CI workflow exists"

        # Basic syntax check - look for obvious issues
        if grep -q "name:" .github/workflows/devcontainer-ci.yml && grep -q "on:" .github/workflows/devcontainer-ci.yml; then
            log_success "DevContainer CI workflow has basic YAML structure"
        else
            log_error "DevContainer CI workflow missing basic YAML structure"
            ((errors++))
        fi
    else
        log_error "DevContainer CI workflow not found"
        ((errors++))
    fi

    # Check hybrid CI workflow
    if [ -f ".github/workflows/ci-hybrid.yml" ]; then
        log_success "Hybrid CI workflow exists"
    else
        log_warning "Hybrid CI workflow not found (optional)"
    fi

    return $errors
}

# Function to validate scripts
validate_scripts() {
    log_info "Validating DevContainer scripts..."

    local errors=0

    local scripts=(
        "scripts/devops/environment-parity-validation.sh"
        "scripts/devops/container-registry-manager.sh"
        "scripts/devops/devcontainer-performance-benchmark.sh"
    )

    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            log_success "$script exists"

            # Check if executable
            if [ -x "$script" ]; then
                log_success "$script is executable"
            else
                log_warning "$script is not executable"
                chmod +x "$script"
                log_success "$script made executable"
            fi
        else
            log_error "$script not found"
            ((errors++))
        fi
    done

    return $errors
}

# Function to validate package.json scripts
validate_package_scripts() {
    log_info "Validating package.json DevContainer scripts..."

    local errors=0

    if [ -f "package.json" ]; then
        # Check for DevContainer-related scripts
        local scripts=("container:build" "env:parity" "perf:benchmark")

        for script in "${scripts[@]}"; do
            if jq -e ".scripts.\"$script\"" package.json >/dev/null 2>&1; then
                log_success "package.json script '$script' exists"
            else
                log_error "package.json script '$script' not found"
                ((errors++))
            fi
        done
    else
        log_error "package.json not found"
        ((errors++))
    fi

    return $errors
}

# Function to validate documentation
validate_documentation() {
    log_info "Validating DevContainer documentation..."

    local errors=0

    if [ -f "docs/devs/devcontainer-ci-cd-integration.md" ]; then
        log_success "DevContainer documentation exists"
    else
        log_error "DevContainer documentation not found"
        ((errors++))
    fi

    return $errors
}

# Function to test DevContainer build (dry run)
test_devcontainer_build() {
    log_info "Testing DevContainer build (dry run)..."

    if command -v docker >/dev/null 2>&1; then
        if docker build --dry-run --file .devcontainer/Dockerfile . >/dev/null 2>&1; then
            log_success "DevContainer build syntax is valid"
            return 0
        else
            log_error "DevContainer build contains syntax errors"
            return 1
        fi
    else
        log_warning "Docker not available, skipping build test"
        return 0
    fi
}

# Function to run environment parity validation
run_parity_validation() {
    log_info "Running environment parity validation..."

    if [ -f "scripts/devops/environment-parity-validation.sh" ]; then
        if bash scripts/devops/environment-parity-validation.sh; then
            log_success "Environment parity validation passed"
            return 0
        else
            log_error "Environment parity validation failed"
            return 1
        fi
    else
        log_error "Environment parity validation script not found"
        return 1
    fi
}

# Function to generate validation report
generate_validation_report() {
    local report_file="$REPORTS_DIR/setup-validation-report.json"

    log_info "Generating validation report..."

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "validation_type": "devcontainer_ci_cd_setup",
  "results": {
    "devcontainer_config": $(validate_devcontainer_config >/dev/null 2>&1 && echo "true" || echo "false"),
    "workflows": $(validate_workflows >/dev/null 2>&1 && echo "true" || echo "false"),
    "scripts": $(validate_scripts >/dev/null 2>&1 && echo "true" || echo "false"),
    "package_scripts": $(validate_package_scripts >/dev/null 2>&1 && echo "true" || echo "false"),
    "documentation": $(validate_documentation >/dev/null 2>&1 && echo "true" || echo "false"),
    "build_test": $(test_devcontainer_build >/dev/null 2>&1 && echo "true" || echo "false"),
    "parity_validation": $(run_parity_validation >/dev/null 2>&1 && echo "true" || echo "false")
  },
  "system_info": {
    "os": "$(uname -a)",
    "docker_version": "$(docker --version 2>/dev/null || echo 'not available')",
    "node_version": "$(node --version 2>/dev/null || echo 'not available')",
    "yarn_version": "$(yarn --version 2>/dev/null || echo 'not available')"
  },
  "recommendations": [
    "Ensure Docker is available for local DevContainer testing",
    "Test DevContainer build in GitHub Actions before production use",
    "Validate environment parity between local and CI environments",
    "Monitor performance benchmarks for regressions",
    "Keep DevContainer images updated for security patches"
  ]
}
EOF

    log_success "Validation report generated: $report_file"
}

# Function to show usage
usage() {
    cat << EOF
GNUS-DAO DevContainer CI/CD Setup Validation

Usage: $0 [OPTIONS]

Options:
  --quick          Quick validation (skip build tests)
  --parity         Run full parity validation
  --report-only    Only generate report (skip validation)
  --help           Show this help

This script validates the complete DevContainer CI/CD integration including:
- DevContainer configuration files
- GitHub Actions workflows
- Management scripts
- Package.json scripts
- Documentation
- Build syntax validation
- Environment parity checks

Examples:
  $0                          # Full validation
  $0 --quick                  # Quick validation
  $0 --parity                 # Include parity validation
EOF
}

# Main function
main() {
    local quick_mode=false
    local parity_mode=false
    local report_only=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                quick_mode=true
                shift
                ;;
            --parity)
                parity_mode=true
                shift
                ;;
            --report-only)
                report_only=true
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    log_info "Starting GNUS-DAO DevContainer CI/CD Setup Validation"

    setup_reports_dir

    if [ "$report_only" = false ]; then
        local total_errors=0

        # Run validations
        validate_devcontainer_config || ((total_errors++))
        echo
        validate_workflows || ((total_errors++))
        echo
        validate_scripts || ((total_errors++))
        echo
        validate_package_scripts || ((total_errors++))
        echo
        validate_documentation || ((total_errors++))
        echo

        if [ "$quick_mode" = false ]; then
            test_devcontainer_build || ((total_errors++))
            echo
        fi

        if [ "$parity_mode" = true ]; then
            run_parity_validation || ((total_errors++))
            echo
        fi

        # Generate report
        generate_validation_report

        echo
        if [ $total_errors -eq 0 ]; then
            log_success "✅ DevContainer CI/CD setup validation completed successfully!"
            log_success "All components are properly configured."
            exit 0
        else
            log_error "❌ DevContainer CI/CD setup validation failed with $total_errors error(s)!"
            log_error "Please review the issues above and fix the configuration."
            exit 1
        fi
    else
        generate_validation_report
        log_success "Validation report generated (validation skipped)"
    fi
}

# Run main function
main "$@"