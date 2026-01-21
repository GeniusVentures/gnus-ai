#!/bin/bash
# GNUS-DAO Container Registry Configuration
# Manages DevContainer image caching and registry operations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
ORG="${GITHUB_REPOSITORY_OWNER:-Am0rfu5}"
REPO="${GITHUB_REPOSITORY#*/:-gnus-dao}"
IMAGE_NAME="${REGISTRY}/${ORG}/${REPO}"
DOCKERFILE_PATH=".devcontainer/Dockerfile"

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

# Function to check if Docker is available
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not available"
        return 1
    fi

    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        return 1
    fi

    log_success "Docker is available"
}

# Function to authenticate with registry
authenticate() {
    local token="$1"

    if [ -z "$token" ]; then
        log_error "GitHub token not provided"
        return 1
    fi

    log_info "Authenticating with container registry..."
    echo "$token" | docker login "$REGISTRY" -u "$ORG" --password-stdin

    if [ $? -eq 0 ]; then
        log_success "Authenticated with $REGISTRY"
    else
        log_error "Failed to authenticate with $REGISTRY"
        return 1
    fi
}

# Function to generate cache key
generate_cache_key() {
    local base_key="devcontainer"

    # Include Dockerfile hash
    if [ -f "$DOCKERFILE_PATH" ]; then
        local dockerfile_hash
        dockerfile_hash=$(sha256sum "$DOCKERFILE_PATH" | cut -d' ' -f1 | head -c 16)
        base_key="${base_key}-dockerfile-${dockerfile_hash}"
    fi

    # Include devcontainer.json hash
    if [ -f ".devcontainer/devcontainer.json" ]; then
        local devcontainer_hash
        devcontainer_hash=$(sha256sum ".devcontainer/devcontainer.json" | cut -d' ' -f1 | head -c 16)
        base_key="${base_key}-config-${devcontainer_hash}"
    fi

    # Include package.json hash
    if [ -f "package.json" ]; then
        local package_hash
        package_hash=$(sha256sum "package.json" | cut -d' ' -f1 | head -c 16)
        base_key="${base_key}-package-${package_hash}"
    fi

    # Include yarn.lock hash
    if [ -f "yarn.lock" ]; then
        local yarn_hash
        yarn_hash=$(sha256sum "yarn.lock" | cut -d' ' -f1 | head -c 16)
        base_key="${base_key}-yarn-${yarn_hash}"
    fi

    echo "$base_key"
}

# Function to check if image exists in registry
image_exists() {
    local image_tag="$1"

    log_info "Checking if image exists: $IMAGE_NAME:$image_tag"

    if docker manifest inspect "$IMAGE_NAME:$image_tag" >/dev/null 2>&1; then
        log_success "Image exists in registry"
        return 0
    else
        log_warning "Image does not exist in registry"
        return 1
    fi
}

# Function to build DevContainer image
build_image() {
    local image_tag="$1"
    local cache_key="$2"
    local use_cache="${3:-true}"

    log_info "Building DevContainer image: $IMAGE_NAME:$image_tag"

    local build_args=(
        --file "$DOCKERFILE_PATH"
        --tag "$IMAGE_NAME:$image_tag"
        --platform linux/amd64
        --build-arg NODE_VERSION=22
        --build-arg PYTHON_VERSION=3.11
        --provenance=true
        --sbom=true
    )

    if [ "$use_cache" = "true" ]; then
        # Try to pull cache image first
        if image_exists "$cache_key"; then
            log_info "Using cached image as build cache"
            build_args+=(--cache-from "$IMAGE_NAME:$cache_key")
        fi
    fi

    # Build the image
    docker build "${build_args[@]}" .

    if [ $? -eq 0 ]; then
        log_success "Image built successfully"
    else
        log_error "Failed to build image"
        return 1
    fi
}

# Function to push image to registry
push_image() {
    local image_tag="$1"

    log_info "Pushing image to registry: $IMAGE_NAME:$image_tag"

    docker push "$IMAGE_NAME:$image_tag"

    if [ $? -eq 0 ]; then
        log_success "Image pushed successfully"
    else
        log_error "Failed to push image"
        return 1
    fi
}

# Function to generate image tags
generate_tags() {
    local base_tag="devcontainer"
    local tags=()

    # Add branch-based tag
    if [ -n "${GITHUB_HEAD_REF:-}" ]; then
        # Pull request
        local branch_name
        branch_name=$(echo "${GITHUB_HEAD_REF}" | sed 's/[^a-zA-Z0-9._-]/-/g')
        tags+=("${base_tag}-pr-${branch_name}")
    elif [ -n "${GITHUB_REF_NAME:-}" ]; then
        # Branch push
        local branch_name
        branch_name=$(echo "${GITHUB_REF_NAME}" | sed 's/[^a-zA-Z0-9._-]/-/g')
        tags+=("${base_tag}-${branch_name}")
    fi

    # Add SHA-based tag
    if [ -n "${GITHUB_SHA:-}" ]; then
        tags+=("${base_tag}-${GITHUB_SHA:0:8}")
    fi

    # Add latest tag for main/develop branches
    if [[ "${GITHUB_REF_NAME:-}" == "main" || "${GITHUB_REF_NAME:-}" == "develop" ]]; then
        tags+=("${base_tag}-latest")
    fi

    # Add timestamp-based tag
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    tags+=("${base_tag}-${timestamp}")

    echo "${tags[@]}"
}

# Function to clean up old images
cleanup_old_images() {
    local keep_days="${1:-30}"
    local keep_count="${2:-10}"

    log_info "Cleaning up old DevContainer images (keeping last $keep_count images, or images newer than $keep_days days)..."

    # This is a simplified cleanup - in production, you'd want more sophisticated logic
    # For now, just log what would be cleaned up
    log_info "Cleanup logic would be implemented here"
    log_warning "Automated cleanup not yet implemented - manual cleanup recommended"
}

# Function to generate container registry report
generate_report() {
    local cache_key="$1"
    local image_tags=("$2")

    local report_file="container-registry-report.json"

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "registry": "$REGISTRY",
  "organization": "$ORG",
  "repository": "$REPO",
  "image_name": "$IMAGE_NAME",
  "cache_key": "$cache_key",
  "image_tags": $(printf '%s\n' "${image_tags[@]}" | jq -R . | jq -s .),
  "dockerfile_hash": "$(sha256sum "$DOCKERFILE_PATH" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')",
  "devcontainer_config_hash": "$(sha256sum ".devcontainer/devcontainer.json" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')",
  "package_hash": "$(sha256sum "package.json" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')",
  "yarn_lock_hash": "$(sha256sum "yarn.lock" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')"
}
EOF

    log_success "Container registry report generated: $report_file"
}

# Function to show usage
usage() {
    cat << EOF
GNUS-DAO Container Registry Manager

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  build       Build DevContainer image
  push        Push image to registry
  pull        Pull image from registry
  exists      Check if image exists
  cleanup     Clean up old images
  report      Generate registry report

Options:
  --tag TAG           Image tag (default: auto-generated)
  --cache-key KEY     Cache key (default: auto-generated)
  --no-cache          Disable build cache
  --keep-days DAYS    Days to keep images (default: 30)
  --keep-count COUNT  Number of images to keep (default: 10)
  --help              Show this help

Environment Variables:
  GITHUB_TOKEN        GitHub token for authentication
  GITHUB_SHA          Commit SHA for tagging
  GITHUB_REF_NAME     Branch name for tagging

Examples:
  $0 build
  $0 build --tag my-custom-tag
  $0 push
  $0 exists --tag latest
  $0 cleanup --keep-days 7 --keep-count 5
EOF
}

# Main function
main() {
    local command="${1:-help}"
    shift

    case "$command" in
        build)
            local tag=""
            local cache_key=""
            local use_cache=true

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --tag)
                        tag="$2"
                        shift 2
                        ;;
                    --cache-key)
                        cache_key="$2"
                        shift 2
                        ;;
                    --no-cache)
                        use_cache=false
                        shift
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        usage
                        exit 1
                        ;;
                esac
            done

            check_docker
            authenticate "${GITHUB_TOKEN:-}"

            if [ -z "$tag" ]; then
                mapfile -t tags < <(generate_tags)
                tag="${tags[0]}"
            fi

            if [ -z "$cache_key" ]; then
                cache_key=$(generate_cache_key)
            fi

            build_image "$tag" "$cache_key" "$use_cache"
            generate_report "$cache_key" "$tag"
            ;;

        push)
            local tag=""

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --tag)
                        tag="$2"
                        shift 2
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        usage
                        exit 1
                        ;;
                esac
            done

            check_docker
            authenticate "${GITHUB_TOKEN:-}"

            if [ -z "$tag" ]; then
                mapfile -t tags < <(generate_tags)
                tag="${tags[0]}"
            fi

            push_image "$tag"
            ;;

        pull)
            local tag="latest"

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --tag)
                        tag="$2"
                        shift 2
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        usage
                        exit 1
                        ;;
                esac
            done

            check_docker
            authenticate "${GITHUB_TOKEN:-}"

            log_info "Pulling image: $IMAGE_NAME:$tag"
            docker pull "$IMAGE_NAME:$tag"
            ;;

        exists)
            local tag="latest"

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --tag)
                        tag="$2"
                        shift 2
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        usage
                        exit 1
                        ;;
                esac
            done

            authenticate "${GITHUB_TOKEN:-}"

            if image_exists "$tag"; then
                log_success "Image $IMAGE_NAME:$tag exists"
                exit 0
            else
                log_error "Image $IMAGE_NAME:$tag does not exist"
                exit 1
            fi
            ;;

        cleanup)
            local keep_days=30
            local keep_count=10

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --keep-days)
                        keep_days="$2"
                        shift 2
                        ;;
                    --keep-count)
                        keep_count="$2"
                        shift 2
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        usage
                        exit 1
                        ;;
                esac
            done

            cleanup_old_images "$keep_days" "$keep_count"
            ;;

        report)
            local cache_key
            cache_key=$(generate_cache_key)
            local tags
            mapfile -t tags < <(generate_tags)

            generate_report "$cache_key" "${tags[*]}"
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