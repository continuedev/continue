#!/usr/bin/env bash
# =============================================================================
# build-linux.sh — Build Continue VSIX on Linux/WSL
#
# Requirements:
#   - Miniconda with env 'node20' (Node.js v20.17.0)
#   - conda create -n node20 -y nodejs=20
#   - gcc/g++/make (cho sqlite3 rebuild): sudo apt install -y build-essential
#
# Usage:
#   bash deploy/01-build-extension/build-linux.sh
#   bash deploy/01-build-extension/build-linux.sh --target linux-x64
#   bash deploy/01-build-extension/build-linux.sh --skip-packages
#   bash deploy/01-build-extension/build-linux.sh --only-ext
# =============================================================================
set -euo pipefail

# --- Defaults (NO positional $1 shorthand — use --target flag only) ---
TARGET="linux-x64"
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
elapsed() { echo "$(( $(date +%s) - START_TIME ))s"; }

echo ""
echo "================================================"
echo "  Continue Extension Build — Linux/WSL"
echo "  Target:  $TARGET"
echo "  Repo:    $REPO_ROOT"
echo "  Started: $(date +%H:%M:%S)"
echo "================================================"
echo ""

cd "$REPO_ROOT"

# =============================================================================
# Step 1: ALWAYS run pre-install
# (do NOT gate on ripgrep only — sqlite3 binding may be wrong platform even
#  when ripgrep exists from a previous Windows build)
# =============================================================================
timer "Running pre-install for $TARGET..."
bash "$(dirname "${BASH_SOURCE[0]}")/00-pre-install.sh" --target "$TARGET"

# =============================================================================
# Step 2: Verify conda node20
# =============================================================================
info "Checking conda env 'node20'..."
if ! conda env list 2>/dev/null | grep -q "^node20"; then
  error "conda env 'node20' not found.\n  Fix: conda create -n node20 -y nodejs=20"
fi
NODE_VER=$(conda run -n node20 node --version 2>/dev/null)
NPM_VER=$(conda run -n node20 npm --version 2>/dev/null)
success "Node: $NODE_VER | npm: $NPM_VER"

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
info "Branch: $BRANCH"
if [[ "$BRANCH" != "develop" && "$BRANCH" != release/* ]]; then
  warn "Not on develop/release branch — continuing anyway"
fi

# =============================================================================
# Step 3: npm install all workspaces (skip individual if node_modules present
# AND symlinks look correct for this machine)
# =============================================================================
if [[ "$ONLY_EXT" == "false" ]]; then
  timer "Checking/installing npm dependencies... $(elapsed)"

  # Helper: check if node_modules exists AND symlinks in @continuedev/* point
  # to THIS repo root (not a stale path from a different machine/rename)
  nm_is_valid() {
    local dir="$1"
    local nm="${REPO_ROOT}/${dir}/node_modules"
    [[ -d "$nm" ]] || return 1
    # For core: verify @continuedev symlinks point to correct repo root
    if [[ "$dir" == "core" ]]; then
      local link
      link=$(readlink "${nm}/@continuedev/config-yaml" 2>/dev/null || true)
      [[ "$link" == "${REPO_ROOT}/packages/config-yaml"* ]] || return 1
    fi
    return 0
  }

  INSTALL_DIRS=(
    "packages/config-types"
    "packages/terminal-security"
    "packages/llm-info"
    "packages/fetch"
    "packages/openai-adapters"
    "packages/config-yaml"
    "core"
    "gui"
  )

  for d in "${INSTALL_DIRS[@]}"; do
    if nm_is_valid "$d"; then
      info "[$d] node_modules valid — skip install"
    else
      info "[$d] npm install..."
      conda run -n node20 bash -c "
        cd '${REPO_ROOT}/${d}'
        npm install --registry '${NPM_REGISTRY:-https://registry.npmjs.org/}' 2>&1 | tail -3
      "
      success "[$d] installed"
    fi
  done
fi

# extensions/vscode: already handled by pre-install, just confirm
if [[ ! -d "$REPO_ROOT/extensions/vscode/node_modules" ]]; then
  warn "extensions/vscode/node_modules missing after pre-install — re-running..."
  bash "$(dirname "${BASH_SOURCE[0]}")/00-pre-install.sh" --target "$TARGET"
fi

# =============================================================================
# Step 4: Build packages (parallel via build-packages.js)
# =============================================================================
if [[ "$SKIP_PACKAGES" == "false" ]]; then
  timer "Building packages (parallel)... $(elapsed)"
  conda run -n node20 node "${REPO_ROOT}/scripts/build-packages.js"
  success "Packages built  $(elapsed)"
fi

# =============================================================================
# Step 5: Build core
# =============================================================================
if [[ "$ONLY_EXT" == "false" ]]; then
  timer "Building core... $(elapsed)"
  conda run -n node20 bash -c "cd '${REPO_ROOT}/core' && npm run build 2>&1 | tail -3"
  success "Core built  $(elapsed)"

  timer "Building GUI... $(elapsed)"
  conda run -n node20 bash -c "cd '${REPO_ROOT}/gui' && npm run build 2>&1 | tail -3"
  success "GUI built  $(elapsed)"
fi

# =============================================================================
# Step 6: Prepackage
# NOTE: SKIP_INSTALLS=true — prepackage.js ko chay npm install (se hang).
#       sqlite3 binding da duoc pre-install fix sang ELF (linux) truoc buoc nay.
# =============================================================================
timer "Prepackage (target: $TARGET)... $(elapsed)"

# Clean stale out/ nếu thiếu rg (out/ được copy từ lần build trước platform khác)
OUT_DIR="${REPO_ROOT}/extensions/vscode/out"
OUT_RG="${OUT_DIR}/node_modules/@vscode/ripgrep/bin/rg"
if [[ "$TARGET" == "win32-x64" ]]; then OUT_RG="${OUT_RG}.exe"; fi
if [[ -d "$OUT_DIR" && ! -f "$OUT_RG" ]]; then
  warn "Stale out/ detected (missing rg binary) — removing..."
  rm -rf "$OUT_DIR"
  success "Removed stale out/"
fi

mkdir -p "${REPO_ROOT}/extensions/vscode/build"

conda run -n node20 bash -c "
  cd '${REPO_ROOT}/extensions/vscode'
  SKIP_INSTALLS=true node scripts/prepackage.js --target $TARGET 2>&1 | tail -10
"
success "Prepackage done  $(elapsed)"

# =============================================================================
# Step 7: Package VSIX via vsce
# NOTE: npx @vscode/vsce trực tiếp (KHÔNG dùng npm run package) vì:
#   - npm run package tự trigger prepackage lifecycle → chạy lại 2 lần
#   - package.js không trigger vscode:prepublish (thiếu esbuild minify)
#   - npx @vscode/vsce trigger đúng vscode:prepublish hook
# =============================================================================
timer "Packaging VSIX (target: $TARGET)... $(elapsed)"
conda run -n node20 bash -c "
  cd '${REPO_ROOT}/extensions/vscode'
  npx @vscode/vsce package --out ./build --no-dependencies --target $TARGET 2>&1 | tail -12
"

# =============================================================================
# Result
# =============================================================================
VSIX=$(ls "${REPO_ROOT}/extensions/vscode/build/continue-${TARGET}-"*.vsix 2>/dev/null | sort -t- -k5 -V | tail -1)
if [[ -z "$VSIX" ]]; then
  error "Build failed — no VSIX found in extensions/vscode/build/"
fi

END_TIME=$(date +%s)
ELAPSED=$(( END_TIME - START_TIME ))

echo ""
echo "================================================"
echo -e "${GREEN}  BUILD COMPLETE  ${NC}$(printf '%dm%ds' $((ELAPSED/60)) $((ELAPSED%60)))"
echo "  Output:  $(basename "$VSIX")"
echo "  Size:    $(du -sh "$VSIX" | cut -f1)"
echo "================================================"
echo ""
echo "  Install:"
echo "  code --install-extension $VSIX --force"
echo ""
