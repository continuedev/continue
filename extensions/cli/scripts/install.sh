#!/usr/bin/env bash
set -euo pipefail

# Continue CLI Installer - Unix (macOS, Linux, WSL, Git Bash)
# curl -fsSL https://continue.dev/install.sh | bash

REQUIRED_NODE_VERSION="20.19.0"
PACKAGE_NAME="@continuedev/cli"
CLI_COMMAND="cn"
NETWORK_TIMEOUT=60
FNM_INSTALL_DIR="$HOME/.local/share/fnm"

# Cleanup tracking
CLEANUP_FNM=false

# Colors
if [ -t 1 ] && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
    RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
    BLUE='\033[0;34m' BOLD='\033[1m' NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

info()    { printf "${BLUE}==>${NC} ${BOLD}%s${NC}\n" "$1"; }
success() { printf "${GREEN}==>${NC} ${BOLD}%s${NC}\n" "$1"; }
warn()    { printf "${YELLOW}==> Warning:${NC} %s\n" "$1"; }
error()   { printf "${RED}==> Error:${NC} %s\n" "$1" >&2; exit 1; }

cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        warn "Installation failed. Cleaning up..."
        if [ "$CLEANUP_FNM" = true ] && [ -d "$FNM_INSTALL_DIR" ]; then
            rm -rf "$FNM_INSTALL_DIR" 2>/dev/null || true
        fi
    fi
    exit $exit_code
}
trap cleanup EXIT

PLATFORM=""
ARCH=""
SHELL_PROFILE=""
SHELL_TYPE=""

check_dependencies() {
    local missing_deps=()

    if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
        missing_deps+=("curl or wget")
    fi

    if ! command -v tar &>/dev/null; then
        missing_deps+=("tar")
    fi

    if ! command -v unzip &>/dev/null; then
        missing_deps+=("unzip")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}. Please install them first."
    fi
}

download() {
    local url="$1"
    local output="${2:-}"

    if command -v curl &>/dev/null; then
        if [ -n "$output" ]; then
            curl -fsSL --connect-timeout "$NETWORK_TIMEOUT" --max-time $((NETWORK_TIMEOUT * 3)) -o "$output" "$url"
        else
            curl -fsSL --connect-timeout "$NETWORK_TIMEOUT" --max-time $((NETWORK_TIMEOUT * 3)) "$url"
        fi
    elif command -v wget &>/dev/null; then
        if [ -n "$output" ]; then
            wget -q --timeout="$NETWORK_TIMEOUT" -O "$output" "$url"
        else
            wget -q --timeout="$NETWORK_TIMEOUT" -O - "$url"
        fi
    else
        error "Neither curl nor wget found. Please install one of them."
    fi
}

detect_platform() {
    local os arch
    os="$(uname -s)"
    arch="$(uname -m)"

    case "$os" in
        Linux*)                          PLATFORM="linux" ;;
        Darwin*)                         PLATFORM="darwin" ;;
        MINGW*|MSYS*|CYGWIN*|Windows_NT) PLATFORM="windows" ;;
        *)                               error "Unsupported OS: $os. Use install.ps1 for Windows." ;;
    esac

    case "$arch" in
        x86_64|amd64)  ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        armv7l)        ARCH="armv7l" ;;
        i386|i686)     error "32-bit systems are not supported" ;;
        *)             error "Unsupported architecture: $arch" ;;
    esac

    info "Detected platform: $PLATFORM-$ARCH"
}

detect_shell_profile() {
    local current_shell
    current_shell="$(basename "${SHELL:-/bin/bash}")"
    SHELL_TYPE="$current_shell"

    case "$current_shell" in
        zsh)  SHELL_PROFILE="$HOME/.zshrc" ;;
        bash)
            if [ "$PLATFORM" = "darwin" ]; then
                SHELL_PROFILE="$HOME/.bash_profile"
            else
                SHELL_PROFILE="$HOME/.bashrc"
            fi
            ;;
        fish)
            SHELL_PROFILE="$HOME/.config/fish/config.fish"
            mkdir -p "$HOME/.config/fish"
            ;;
        *)
            for f in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
                [ -f "$f" ] && SHELL_PROFILE="$f" && break
            done
            [ -z "$SHELL_PROFILE" ] && SHELL_PROFILE="$HOME/.bashrc"
            ;;
    esac
    touch "$SHELL_PROFILE"
    info "Using shell profile: $SHELL_PROFILE"
}

version_gte() {
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

source_nvm() {
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
}

source_fnm() {
    for fnm_path in "$HOME/.local/share/fnm" "$HOME/.fnm" "${FNM_DIR:-}"; do
        if [ -n "$fnm_path" ] && [ -d "$fnm_path" ]; then
            export PATH="$fnm_path:$PATH"
            break
        fi
    done
    command -v fnm &>/dev/null && eval "$(fnm env --shell bash 2>/dev/null || true)"
}

check_node() {
    source_nvm
    source_fnm

    if command -v node &>/dev/null; then
        local current_version
        current_version=$(node -v 2>/dev/null | sed 's/^v//')

        if [ -n "$current_version" ]; then
            info "Found Node.js v$current_version"
            if version_gte "$current_version" "$REQUIRED_NODE_VERSION"; then
                success "Node.js meets requirements (>= v$REQUIRED_NODE_VERSION)"
                return 0
            fi
            warn "Node.js v$current_version is below required v$REQUIRED_NODE_VERSION"
            return 1
        fi
    fi

    warn "Node.js is not installed"
    return 1
}

install_node() {
    # Only mark for cleanup if fnm directory doesn't already exist
    if [ ! -d "$FNM_INSTALL_DIR" ]; then
        CLEANUP_FNM=true
    fi
    info "Installing fnm (Fast Node Manager)..."

    mkdir -p "$FNM_INSTALL_DIR"

    if ! download "https://fnm.vercel.app/install" | bash -s -- --install-dir "$FNM_INSTALL_DIR" --skip-shell; then
        error "Failed to install fnm. Check your network connection and try again."
    fi

    if [ ! -x "$FNM_INSTALL_DIR/fnm" ]; then
        error "fnm installation failed - binary not found at $FNM_INSTALL_DIR/fnm"
    fi

    export PATH="$FNM_INSTALL_DIR:$PATH"

    # Initialize fnm for current session
    if ! eval "$(fnm env --shell bash 2>/dev/null)"; then
        error "Failed to initialize fnm environment"
    fi

    info "Installing Node.js v$REQUIRED_NODE_VERSION..."
    if ! fnm install "$REQUIRED_NODE_VERSION"; then
        error "Failed to install Node.js v$REQUIRED_NODE_VERSION"
    fi

    fnm use "$REQUIRED_NODE_VERSION"
    fnm default "$REQUIRED_NODE_VERSION"

    # Verify node is working
    if ! command -v node &>/dev/null; then
        error "Node.js installation succeeded but 'node' command not found in PATH"
    fi

    # Add to shell profile with shell-specific syntax
    add_fnm_to_profile

    CLEANUP_FNM=false
    success "Node.js v$REQUIRED_NODE_VERSION installed"
}

add_fnm_to_profile() {
    case "$SHELL_TYPE" in
        fish)
            add_to_profile "set -gx PATH \"$FNM_INSTALL_DIR\" \$PATH" "$FNM_INSTALL_DIR"
            add_to_profile 'fnm env --use-on-cd --shell fish | source' 'fnm env'
            ;;
        zsh|bash|*)
            add_to_profile "export PATH=\"$FNM_INSTALL_DIR:\$PATH\"" "$FNM_INSTALL_DIR"
            add_to_profile "eval \"\$(fnm env --use-on-cd --shell $SHELL_TYPE)\"" 'fnm env'
            ;;
    esac
}

add_to_profile() {
    local line="$1" check="$2"
    grep -q "$check" "$SHELL_PROFILE" 2>/dev/null || echo "$line" >> "$SHELL_PROFILE"
}

setup_npm_path() {
    local npm_bin
    npm_bin="$(npm config get prefix 2>/dev/null)/bin"
    [ -d "$npm_bin" ] && export PATH="$npm_bin:$PATH"
}

check_npm_permissions() {
    local npm_prefix
    npm_prefix="$(npm config get prefix 2>/dev/null)"

    # Check if we can write to npm global directory
    if [ -d "$npm_prefix/lib" ] && [ ! -w "$npm_prefix/lib" ]; then
        warn "Cannot write to npm global directory: $npm_prefix/lib"
        info "Attempting to fix npm permissions..."

        # Try to use npm prefix in user directory
        local user_npm_dir="$HOME/.npm-global"
        mkdir -p "$user_npm_dir"
        npm config set prefix "$user_npm_dir"
        export PATH="$user_npm_dir/bin:$PATH"

        add_to_profile "export PATH=\"$user_npm_dir/bin:\$PATH\"" ".npm-global/bin"
        info "Configured npm to use $user_npm_dir"
    fi
}

install_cli() {
    info "Installing $PACKAGE_NAME..."

    check_npm_permissions

    local npm_output
    local npm_exit_code=0

    npm_output=$(npm install -g "$PACKAGE_NAME" 2>&1) || npm_exit_code=$?

    if [ $npm_exit_code -ne 0 ]; then
        echo "$npm_output" >&2
        error "Failed to install $PACKAGE_NAME (exit code: $npm_exit_code)"
    fi

    # Verify installation
    setup_npm_path
    if ! command -v "$CLI_COMMAND" &>/dev/null; then
        warn "$CLI_COMMAND not found in PATH after installation"
        warn "You may need to restart your shell or source your profile"
    fi

    success "$PACKAGE_NAME installed!"
}

finalize() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    success "Continue CLI installation complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if command -v "$CLI_COMMAND" &>/dev/null; then
        success "Ready! Run: $CLI_COMMAND --help"
    else
        printf "Run ${BOLD}source %s${NC} or open a new terminal\n" "$SHELL_PROFILE"
        printf "Then: ${BOLD}%s --help${NC}\n" "$CLI_COMMAND"
    fi
    echo ""
}

main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "${BOLD}           Continue CLI Installer${NC}\n"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    check_dependencies
    detect_platform
    detect_shell_profile
    check_node || install_node
    setup_npm_path
    install_cli
    finalize
}

# Allow sourcing without running
if [[ "${BASH_SOURCE[0]}" == "${0}" ]] || [ -z "${BASH_SOURCE[0]:-}" ]; then
    main "$@"
fi
