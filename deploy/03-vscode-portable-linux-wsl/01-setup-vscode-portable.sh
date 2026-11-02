#!/usr/bin/env bash
# =============================================================================
# 01-setup-vscode-portable.sh
# Setup VSCode Linux Portable in ~/.apps for WSL (air-gap friendly)
#
# Usage:
#   bash 01-setup-vscode-portable.sh [--tarball <path>] [--force]
#
# Options:
#   --tarball <path>   Path to vscode-linux-x64-*.tar.gz (default: auto-detect)
#   --force            Reinstall even if already installed
#
# Result:
#   - VSCode portable installed at ~/.apps/vscode-linux/
#   - Portable data dir at ~/.apps/vscode-linux/data/
#   - Wrapper script at ~/.local/bin/code-wsl
#   - Shell alias in ~/.bashrc
# =============================================================================
set -euo pipefail

# --- Config ---
VSCODE_VERSION="1.132.0"
VSCODE_COMMIT="df53daabb18cd157bdb08c7f01c34df936cf12f4"
INSTALL_DIR="${HOME}/.apps/vscode-linux"
BIN_DIR="${HOME}/.local/bin"
WRAPPER="${BIN_DIR}/code-wsl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Colors ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Parse args ---
TARBALL=""
FORCE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tarball) TARBALL="$2"; shift 2 ;;
    --force)   FORCE=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# --- Auto-detect tarball if not specified ---
if [[ -z "$TARBALL" ]]; then
  TARBALL=$(ls "${SCRIPT_DIR}/vscode-linux-x64-"*.tar.gz 2>/dev/null | head -1 || true)
  if [[ -z "$TARBALL" ]]; then
    error "No VSCode tarball found. Place vscode-linux-x64-${VSCODE_VERSION}.tar.gz next to this script, or use --tarball <path>"
  fi
fi

echo ""
echo "=============================================="
echo "  VSCode Linux Portable Setup for WSL"
echo "  Version: $VSCODE_VERSION"
echo "  Commit:  ${VSCODE_COMMIT:0:12}"
echo "  Install: $INSTALL_DIR"
echo "=============================================="
echo ""

# --- Check WSLg ---
info "Checking WSLg availability..."
if [[ -d /mnt/wslg ]] && [[ -n "${DISPLAY:-}" ]]; then
  success "WSLg available (DISPLAY=$DISPLAY)"
else
  warn "WSLg not detected (DISPLAY=${DISPLAY:-unset}). GUI may not work."
  warn "Make sure you're on Windows 11 with WSL2 and WSLg enabled."
fi

# --- Check already installed ---
if [[ -f "${INSTALL_DIR}/code" ]] && [[ "$FORCE" == "false" ]]; then
  INSTALLED_VERSION=$(cat "${INSTALL_DIR}/resources/app/package.json" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','?'))" 2>/dev/null || echo "?")
  warn "VSCode already installed at $INSTALL_DIR (version: $INSTALLED_VERSION)"
  warn "Use --force to reinstall"
  exit 0
fi

# --- Create dirs ---
info "Creating install directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR" "$BIN_DIR"

# --- Extract tarball ---
info "Extracting $TARBALL..."
info "This may take 1-2 minutes..."
tar -xzf "$TARBALL" -C "$INSTALL_DIR" --strip-components=1
success "VSCode extracted"

# --- Verify extraction ---
[[ -f "${INSTALL_DIR}/code" ]] || error "Extraction failed — 'code' binary not found"
ACTUAL_VERSION=$(cat "${INSTALL_DIR}/resources/app/product.json" 2>/dev/null | python3 -c "import sys,json; p=json.load(sys.stdin); print(p.get('version','?'))" 2>/dev/null || echo "?")
success "Extracted version: $ACTUAL_VERSION"

# --- Setup Portable Mode ---
# VSCode portable mode: khi tồn tại folder 'data/' bên cạnh binary,
# VSCode sẽ lưu tất cả user data (extensions, settings, cache) vào đó.
# => Hoàn toàn isolated khỏi VSCode Windows và ~/.vscode
info "Setting up Portable Mode (data/ folder)..."
mkdir -p "${INSTALL_DIR}/data/user-data"
mkdir -p "${INSTALL_DIR}/data/extensions"
mkdir -p "${INSTALL_DIR}/data/logs"
success "Portable data dir: ${INSTALL_DIR}/data/"

# --- Create wrapper script: code-wsl ---
info "Creating wrapper: $WRAPPER"
cat > "$WRAPPER" << 'WRAPPER_EOF'
#!/usr/bin/env bash
# code-wsl — Launch VSCode Linux Portable in WSL
# Wrapper tránh conflict với 'code' (VSCode Windows Remote WSL)
#
# Portable mode: luôn inject --extensions-dir và --user-data-dir
# Áp dụng cả GUI launch lẫn CLI (--install-extension, --list-extensions...)

VSCODE_DIR="${HOME}/.apps/vscode-linux"
BINARY="${VSCODE_DIR}/code"
EXTENSIONS_DIR="${VSCODE_DIR}/data/extensions"
USER_DATA_DIR="${VSCODE_DIR}/data/user-data"

if [[ ! -f "$BINARY" ]]; then
  echo "ERROR: VSCode Linux not found at $VSCODE_DIR"
  echo "Run: bash deploy/03-vscode-portable-linux-wsl/01-setup-vscode-portable.sh"
  exit 1
fi

# WSLg DISPLAY
if [[ -z "${DISPLAY:-}" ]]; then
  export DISPLAY=:0
fi

exec "$BINARY" \
  --extensions-dir "$EXTENSIONS_DIR" \
  --user-data-dir  "$USER_DATA_DIR" \
  --no-sandbox \
  "$@"
WRAPPER_EOF
chmod +x "$WRAPPER"
success "Wrapper created: $WRAPPER"

# --- Add to PATH and alias in ~/.bashrc ---
info "Configuring ~/.bashrc..."
BASHRC="${HOME}/.bashrc"

# Remove old entries nếu có
sed -i '/# code-wsl VSCode Linux Portable/,/# end code-wsl/d' "$BASHRC" 2>/dev/null || true

# Add new entries
cat >> "$BASHRC" << BASHRC_EOF

# code-wsl VSCode Linux Portable
export PATH="\${HOME}/.local/bin:\${PATH}"
alias code-wsl="${WRAPPER}"
# end code-wsl
BASHRC_EOF
success "~/.bashrc updated"

# --- Print summary ---
echo ""
echo "=============================================="
echo -e "${GREEN}  Setup completed!${NC}"
echo "=============================================="
echo ""
echo "  VSCode ${ACTUAL_VERSION} installed at:"
echo "  ${INSTALL_DIR}"
echo ""
echo "  Portable data dir (extensions, settings):"
echo "  ${INSTALL_DIR}/data/"
echo ""
echo "  Launch with:"
echo "  $ code-wsl                    # open current folder"
echo "  $ code-wsl /path/to/project   # open specific folder"
echo "  $ code-wsl --new-window       # new window"
echo ""
echo "  Next steps:"
echo "  1. source ~/.bashrc  (or open new terminal)"
echo "  2. bash deploy/linux-wsl/02-install-continue.sh"
echo ""
echo -e "  ${YELLOW}Note:${NC} 'code' still opens VSCode Windows (Remote WSL)"
echo -e "  ${YELLOW}Note:${NC} 'code-wsl' opens this Linux portable instance"
echo ""
