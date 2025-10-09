#!/bin/bash
# GNUS-DAO DevContainer Performance Benchmarking
# Compares performance between DevContainer and native execution

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
REPORT_DIR="${PROJECT_ROOT}/reports"
BENCHMARK_DIR="${REPORT_DIR}/benchmarks"

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

# Function to create benchmark directory
setup_benchmark_dir() {
    mkdir -p "$BENCHMARK_DIR"
    log_success "Benchmark directory created: $BENCHMARK_DIR"
}

# Function to measure execution time
measure_time() {
    local command="$1"
    local label="$2"
    local output_file="$3"

    log_info "Measuring: $label"

    local start_time
    start_time=$(date +%s.%3N)

    if eval "$command" > "$output_file" 2>&1; then
        local end_time
        end_time=$(date +%s.%3N)

        local duration
        duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0")

        log_success "$label completed in ${duration}s"

        # Return duration
        echo "$duration"
    else
        log_error "$label failed"
        return 1
    fi
}

# Function to benchmark dependency installation
benchmark_dependencies() {
    local environment="$1" # "native" or "container"
    local results_file="$BENCHMARK_DIR/dependencies-${environment}.json"

    log_info "Benchmarking dependency installation ($environment)"

    cd "$PROJECT_ROOT"

    local command
    local label

    if [ "$environment" = "native" ]; then
        command="yarn install --frozen-lockfile --prefer-offline"
        label="Native dependency installation"
    else
        # For container, we'd run this inside container
        # This is a placeholder - actual container testing would be done in CI
        command="echo 'Container dependency installation would be measured in CI'"
        label="Container dependency installation (simulated)"
    fi

    local duration
    duration=$(measure_time "$command" "$label" "$BENCHMARK_DIR/dependencies-${environment}.log")

    cat > "$results_file" << EOF
{
  "environment": "$environment",
  "operation": "dependencies",
  "duration_seconds": $duration,
  "timestamp": "$(date -Iseconds)",
  "command": "$command"
}
EOF
}

# Function to benchmark compilation
benchmark_compilation() {
    local environment="$1"
    local results_file="$BENCHMARK_DIR/compilation-${environment}.json"

    log_info "Benchmarking compilation ($environment)"

    cd "$PROJECT_ROOT"

    local command="yarn clean && yarn compile"
    local label="${environment} compilation"

    local duration
    duration=$(measure_time "$command" "$label" "$BENCHMARK_DIR/compilation-${environment}.log")

    cat > "$results_file" << EOF
{
  "environment": "$environment",
  "operation": "compilation",
  "duration_seconds": $duration,
  "timestamp": "$(date -Iseconds)",
  "command": "$command"
}
EOF
}

# Function to benchmark unit tests
benchmark_unit_tests() {
    local environment="$1"
    local results_file="$BENCHMARK_DIR/unit-tests-${environment}.json"

    log_info "Benchmarking unit tests ($environment)"

    cd "$PROJECT_ROOT"

    local command="npx hardhat test test/unit/ --parallel"
    local label="${environment} unit tests"

    local duration
    duration=$(measure_time "$command" "$label" "$BENCHMARK_DIR/unit-tests-${environment}.log")

    cat > "$results_file" << EOF
{
  "environment": "$environment",
  "operation": "unit_tests",
  "duration_seconds": $duration,
  "timestamp": "$(date -Iseconds)",
  "command": "$command"
}
EOF
}

# Function to benchmark security scanning
benchmark_security_scan() {
    local environment="$1"
    local results_file="$BENCHMARK_DIR/security-scan-${environment}.json"

    log_info "Benchmarking security scanning ($environment)"

    cd "$PROJECT_ROOT"

    local command="yarn slither:scan"
    local label="${environment} security scan (Slither)"

    local duration
    duration=$(measure_time "$command" "$label" "$BENCHMARK_DIR/security-scan-${environment}.log")

    cat > "$results_file" << EOF
{
  "environment": "$environment",
  "operation": "security_scan",
  "duration_seconds": $duration,
  "timestamp": "$(date -Iseconds)",
  "command": "$command",
  "tool": "slither"
}
EOF
}

# Function to benchmark coverage analysis
benchmark_coverage() {
    local environment="$1"
    local results_file="$BENCHMARK_DIR/coverage-${environment}.json"

    log_info "Benchmarking coverage analysis ($environment)"

    cd "$PROJECT_ROOT"

    local command="yarn coverage"
    local label="${environment} coverage analysis"

    local duration
    duration=$(measure_time "$command" "$label" "$BENCHMARK_DIR/coverage-${environment}.log")

    cat > "$results_file" << EOF
{
  "environment": "$environment",
  "operation": "coverage",
  "duration_seconds": $duration,
  "timestamp": "$(date -Iseconds)",
  "command": "$command"
}
EOF
}

# Function to generate comparative report
generate_comparative_report() {
    local report_file="$BENCHMARK_DIR/comparative-report.json"

    log_info "Generating comparative performance report"

    # Collect all benchmark results
    local native_results=()
    local container_results=()

    for file in "$BENCHMARK_DIR"/*.json; do
        if [[ "$file" == *"native"* ]]; then
            native_results+=("$file")
        elif [[ "$file" == *"container"* ]]; then
            container_results+=("$file")
        fi
    done

    # Create comparative analysis
    cat > "$report_file" << EOF
{
  "report_type": "comparative_performance_analysis",
  "timestamp": "$(date -Iseconds)",
  "native_environment": {
EOF

    # Add native results
    local first=true
    for file in "${native_results[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$report_file"
        fi

        local operation
        operation=$(basename "$file" | sed 's/native\.json//' | sed 's/dependencies-//' | sed 's/compilation-//' | sed 's/unit-tests-//' | sed 's/security-scan-//' | sed 's/coverage-//' | sed 's/-$//')
        jq -r ". | {\"$operation\": .}" "$file" >> "$report_file"
    done

    cat >> "$report_file" << EOF
  },
  "container_environment": {
EOF

    # Add container results
    first=true
    for file in "${container_results[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$report_file"
        fi

        local operation
        operation=$(basename "$file" | sed 's/container\.json//' | sed 's/dependencies-//' | sed 's/compilation-//' | sed 's/unit-tests-//' | sed 's/security-scan-//' | sed 's/coverage-//' | sed 's/-$//')
        jq -r ". | {\"$operation\": .}" "$file" >> "$report_file"
    done

    cat >> "$report_file" << EOF
  },
  "analysis": {
    "recommendations": [],
    "performance_differences": {}
  }
}
EOF

    log_success "Comparative report generated: $report_file"
}

# Function to run all benchmarks
run_all_benchmarks() {
    local environment="$1"

    log_info "Running all benchmarks for $environment environment"

    benchmark_dependencies "$environment"
    benchmark_compilation "$environment"
    benchmark_unit_tests "$environment"
    benchmark_security_scan "$environment"
    benchmark_coverage "$environment"

    log_success "All benchmarks completed for $environment"
}

# Function to show usage
usage() {
    cat << EOF
GNUS-DAO DevContainer Performance Benchmarking

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  all             Run all benchmarks
  dependencies    Benchmark dependency installation
  compilation     Benchmark compilation
  unit-tests      Benchmark unit tests
  security-scan   Benchmark security scanning
  coverage        Benchmark coverage analysis
  compare         Generate comparative report
  report          Generate performance report

Options:
  --environment ENV    Environment to benchmark (native|container, default: native)
  --help               Show this help

Examples:
  $0 all --environment native
  $0 all --environment container
  $0 compare
  $0 report

Environment Variables:
  CI                 Set to 'true' for CI environment
  GITHUB_SHA         Commit SHA for reporting

Notes:
  - Container benchmarks are simulated when run locally
  - Actual container performance testing occurs in GitHub Actions
  - Results are stored in reports/benchmarks/
EOF
}

# Main function
main() {
    local command="${1:-help}"
    local environment="native"

    shift

    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                environment="$2"
                shift 2
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

    setup_benchmark_dir

    case "$command" in
        all)
            run_all_benchmarks "$environment"
            ;;

        dependencies)
            benchmark_dependencies "$environment"
            ;;

        compilation)
            benchmark_compilation "$environment"
            ;;

        unit-tests)
            benchmark_unit_tests "$environment"
            ;;

        security-scan)
            benchmark_security_scan "$environment"
            ;;

        coverage)
            benchmark_coverage "$environment"
            ;;

        compare)
            generate_comparative_report
            ;;

        report)
            # Generate a summary report
            local report_file="$BENCHMARK_DIR/performance-summary.json"

            cat > "$report_file" << EOF
{
  "report_type": "performance_summary",
  "timestamp": "$(date -Iseconds)",
  "environment": "$environment",
  "benchmarks": $(find "$BENCHMARK_DIR" -name "*.json" -not -name "*-summary.json" -not -name "*-comparative.json" | wc -l),
  "total_files": $(find "$BENCHMARK_DIR" -type f | wc -l),
  "recommendations": [
    "Run benchmarks in both native and container environments for comparison",
    "Monitor performance trends over time",
    "Consider container resource limits for optimal performance",
    "Use benchmark results to optimize CI/CD pipeline"
  ]
}
EOF

            log_success "Performance summary generated: $report_file"
            ;;

        help|--help|-h)
            usage
            ;;

        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"