#!/usr/bin/env bash
# =============================================================================
# build-macos.sh — Build Continue VSIX on macOS
#
# Requirements:
#   - Node.js 20.x via conda env 'node20' (recommended, isolated)
#   - OR Node.js 20.x via nvm: nvm install 20 && nvm use 20
#   - OR Node.js 20.x via Homebrew: brew install node@20
#
# Usage:
#   bash build-macos.sh [--target darwin-arm64|darwin-x64]
#                       [--skip-packages] [--only-ext]
# =============================================================================
set -euo pipefail

# --- Defaults ---
# Auto-detect arch
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
  DEFAULT_TARGET="darwin-arm64"
else
  DEFAULT_TARGET="darwin-x64"
fi

TARGET="$DEFAULT_TARGET"
SKIP_PACKAGES=false
ONLY_EXT=false
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)        TARGET="$2"; shift 2 ;;
    --skip-packages) SKIP_PACKAGES=true; shift ;;
    --only-ext)      ONLY_EXT=true; SKIP_PACKAGES=true; shift ;;
    *) shift ;;
  esac
done

# --- Colors ---
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
timer()   { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }

START_TIME=$(date +%s)

echo ""
echo "================================================"
echo "  Continue Extension Build — macOS"
echo "  Arch:    $ARCH"
echo "  Target:  $TARGET"
echo "  Repo:    $REPO_ROOT"
echo "================================================"
echo ""

cd "$REPO_ROOT"

# --- OneDrive / Cloud Storage Detection ---
info "Checking workspace location..."
if [[ "$REPO_ROOT" == *"CloudStorage"* ]] || [[ "$REPO_ROOT" == *"OneDrive"* ]] || [[ "$REPO_ROOT" == *"Dropbox"* ]] || [[ "$REPO_ROOT" == *"Google Drive"* ]] || [[ "$REPO_ROOT" == *"iCloud"* ]]; then
  echo ""
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  ⚠️  WARNING: Workspace on Cloud Storage${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  Path: $REPO_ROOT"
  echo ""
  echo "  Building on cloud-synced folders (OneDrive, Dropbox, etc.)"
  echo "  causes severe I/O bottleneck. prepackage.js may HANG"
  echo "  indefinitely due to file sync contention."
  echo ""
  echo -e "  ${YELLOW}Recommendation:${NC} Move workspace to local disk:"
  echo "    git clone <repo> ~/projects/continue-src"
  echo ""
  echo -e "  See: ${YELLOW}.patches/issues/01-onedrive-build-performance.md${NC}"
  echo ""
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  read -p "  Continue anyway? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Build cancelled. Move workspace to local disk and retry."
    exit 1
  fi
  warn "Proceeding with cloud storage — build may hang..."
  echo ""
else
  success "Workspace on local disk"
fi

# --- Detect Node.js environment ---
info "Detecting Node.js environment..."

USE_CONDA=false
NODE_CMD="node"
NPM_CMD="npm"

# Check conda env 'node20' first (isolated environment, recommended)
if command -v conda &>/dev/null && conda env list 2>/dev/null | grep -q "^node20"; then
  info "Found conda env 'node20' — using isolated environment"
  USE_CONDA=true
  NODE_CMD="conda run -n node20 node"
  NPM_CMD="conda run -n node20 npm"

  # Verify conda node20 works
  CONDA_NODE_VER=$($NODE_CMD --version 2>/dev/null || echo "N/A")
  if [[ "$CONDA_NODE_VER" == "N/A" ]]; then
    error "conda env 'node20' found but node command failed"
  fi
  success "conda node20: $CONDA_NODE_VER"
else
  info "conda env 'node20' not found — checking system Node.js..."
fi

# If not using conda, verify system Node.js
if [[ "$USE_CONDA" == "false" ]]; then
  if ! command -v node &>/dev/null; then
    error "Node.js not found. Install via one of:\n" \
          "  1. conda: conda create -n node20 -y nodejs=20  (recommended)\n" \
          "  2. nvm:   nvm install 20 && nvm use 20\n" \
          "  3. brew:  brew install node@20"
  fi

  NODE_VER=$(node --version)
  NPM_VER=$(npm --version)
  NODE_MAJOR=$(echo "$NODE_VER" | grep -oE '\d+' | head -1)

  if [[ "$NODE_MAJOR" != "20" ]]; then
    warn "Node.js version is $NODE_VER — expected v20.x"
    warn "Strongly recommend using conda env 'node20' for isolated builds:"
    warn "  conda create -n node20 -y nodejs=20"
  fi
  success "System Node: $NODE_VER | npm: $NPM_VER"
fi

# --- Verify branch ---
BRANCH=$(git branch --show-current)
info "Branch: $BRANCH"

# --- Verify critical dependencies ---
info "Checking critical build dependencies..."
MISSING=0

# ripgrep binary
if [[ ! -f "$REPO_ROOT/extensions/vscode/node_modules/@vscode/ripgrep/bin/rg" ]]; then
  warn "Missing: @vscode/ripgrep binary"
  MISSING=$((MISSING+1))
fi

# onnxruntime
if [[ ! -f "$REPO_ROOT/core/node_modules/onnxruntime-node/bin/napi-v3/darwin/${ARCH}/onnxruntime_binding.node" ]]; then
  warn "Missing: onnxruntime binding (darwin/${ARCH})"
  MISSING=$((MISSING+1))
fi

# lancedb
if [[ ! -f "$REPO_ROOT/extensions/vscode/node_modules/@lancedb/vectordb-${TARGET}/index.node" ]]; then
  warn "Missing: @lancedb/vectordb-${TARGET}"
  MISSING=$((MISSING+1))
fi

# node_modules existence
if [[ ! -d "$REPO_ROOT/extensions/vscode/node_modules" ]]; then
  warn "Missing: extensions/vscode/node_modules/"
  MISSING=$((MISSING+1))
fi

if [[ $MISSING -gt 0 ]]; then
  error "Missing $MISSING critical dependencies. Run:\n" \
        "  bash deploy/01-build-extension/00-pre-install.sh --target $TARGET\n" \
        "Or manually:\n" \
        "  cd extensions/vscode && npm install\n" \
        "  cd core && npm install"
fi
success "All critical dependencies present"

# --- Helper: run npm with correct environment ---
run_npm() {
  local dir="$1"
  shift
  if [[ "$USE_CONDA" == "true" ]]; then
    bash -c "cd '$dir' && $NPM_CMD $* 2>&1"
  else
    bash -c "cd '$dir' && npm $* 2>&1"
  fi
}

# --- Build packages ---
if [[ "$SKIP_PACKAGES" == "false" ]]; then
  timer "Building packages..."
  for pkg in config-types llm-info fetch openai-adapters config-yaml terminal-security; do
    timer "  packages/$pkg"
    run_npm "$REPO_ROOT/packages/$pkg" "run build" | tail -2
  done
  success "Packages built"
fi

# --- Build core & gui ---
if [[ "$ONLY_EXT" == "false" ]]; then
  timer "Building core..."
  run_npm "$REPO_ROOT/core" "run build" | tail -3
  success "Core built"

  timer "Building gui..."
  run_npm "$REPO_ROOT/gui" "run build" | tail -3
  success "GUI built"
fi

# --- Build extension ---
# NOTE: We avoid `npm run prepackage` and `npm run package` because:
#   1. npmInstall() in prepackage.js hangs when node_modules already exist
#      (child processes fork `npm install` which blocks indefinitely on macOS)
#   2. npm lifecycle auto-runs "prepackage" before "package" (naming convention)
#      causing a double-hang
#   3. package.js calls vsce directly without triggering vscode:prepublish
#      (esbuild step), resulting in missing out/extension.js
#
# Instead, we call scripts directly with SKIP_INSTALLS=true and use npx vsce
# which properly triggers vscode:prepublish → esbuild → package.

timer "Prepackage (target: $TARGET)..."
if [[ "$USE_CONDA" == "true" ]]; then
  bash -c "
    cd '$REPO_ROOT/extensions/vscode' &&
    SKIP_INSTALLS=true $NODE_CMD scripts/prepackage.js --target $TARGET 2>&1 | tail -10
  "
else
  bash -c "
    cd '$REPO_ROOT/extensions/vscode' &&
    SKIP_INSTALLS=true node scripts/prepackage.js --target $TARGET 2>&1 | tail -10
  "
fi
success "Prepackage done"

timer "Packaging VSIX (target: $TARGET)..."
if [[ "$USE_CONDA" == "true" ]]; then
  bash -c "
    cd '$REPO_ROOT/extensions/vscode' &&
    $NPM_CMD exec -- @vscode/vsce package --out ./build --no-dependencies --target $TARGET 2>&1 | tail -10
  "
else
  bash -c "
    cd '$REPO_ROOT/extensions/vscode' &&
    npx @vscode/vsce package --out ./build --no-dependencies --target $TARGET 2>&1 | tail -10
  "
fi

# --- Result ---
VSIX=$(ls "$REPO_ROOT/extensions/vscode/build/continue-${TARGET}-"*.vsix 2>/dev/null | head -1)
[[ -z "$VSIX" ]] && error "Build failed — no VSIX found"

END_TIME=$(date +%s)
ELAPSED=$(( END_TIME - START_TIME ))

echo ""
echo "================================================"
echo -e "${GREEN}  BUILD COMPLETE${NC}"
printf "  Time:    %dm %ds\n" $((ELAPSED/60)) $((ELAPSED%60))
echo "  Output:  $(basename "$VSIX")"
echo "  Size:    $(du -sh "$VSIX" | cut -f1)"
echo "================================================"
echo ""
echo "  Install:"
echo "  code --install-extension $VSIX --force"
echo ""
