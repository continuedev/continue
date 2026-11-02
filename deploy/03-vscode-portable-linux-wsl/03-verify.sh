#!/usr/bin/env bash
# =============================================================================
# 03-verify.sh — Verify VSCode portable Linux/WSL setup
# =============================================================================
set -uo pipefail

INSTALL_DIR="${HOME}/.apps/vscode-linux"
CONTINUE_CONFIG="${HOME}/.continue-wsl"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
pass() { echo -e "  ${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $*"; FAILED=$((FAILED+1)); }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $*"; }
info() { echo -e "  ${BLUE}[INFO]${NC} $*"; }

FAILED=0

echo ""
echo "=== VSCode Portable Linux/WSL — Verification ==="
echo ""

# 1. WSLg
echo "[ WSLg ]"
if [[ -d /mnt/wslg ]]; then
  pass "WSLg available (/mnt/wslg exists)"
else
  fail "WSLg not available — Windows 11 required with WSLg enabled"
fi

if [[ -n "${DISPLAY:-}" ]]; then
  pass "DISPLAY=$DISPLAY"
else
  warn "DISPLAY not set — GUI may not launch. Try: export DISPLAY=:0"
fi

# 2. VSCode binary
echo ""
echo "[ VSCode Portable ]"
if [[ -f "${INSTALL_DIR}/code" ]]; then
  VER=$(python3 -c "import json; print(json.load(open('${INSTALL_DIR}/resources/app/product.json')).get('version','?'))" 2>/dev/null || echo "?")
  pass "Binary: ${INSTALL_DIR}/code (version $VER)"
else
  fail "VSCode not found at $INSTALL_DIR — run 01-setup-vscode-portable.sh"
fi

if [[ -d "${INSTALL_DIR}/data/extensions" ]]; then
  pass "Portable mode: data/extensions exists"
else
  fail "Portable mode not configured — missing ${INSTALL_DIR}/data/"
fi

# 3. code-wsl wrapper
echo ""
echo "[ code-wsl wrapper ]"
if command -v code-wsl &>/dev/null; then
  pass "code-wsl in PATH: $(which code-wsl)"
elif [[ -f "${HOME}/.local/bin/code-wsl" ]]; then
  warn "code-wsl exists but not in PATH — run: source ~/.bashrc"
else
  fail "code-wsl not found — run 01-setup-vscode-portable.sh"
fi

# 4. Continue extension
echo ""
echo "[ Continue Extension ]"
EXT=$(ls "${INSTALL_DIR}/data/extensions/" 2>/dev/null | grep -i "continue" || true)
if [[ -n "$EXT" ]]; then
  pass "Extension installed: $EXT"
  # Check platform
  PKG=$(find "${INSTALL_DIR}/data/extensions/" -name "package.json" -path "*/continue*" 2>/dev/null | head -1)
  if [[ -n "$PKG" ]]; then
    EXT_VER=$(python3 -c "import json; print(json.load(open('$PKG')).get('version','?'))" 2>/dev/null || echo "?")
    info "Extension version: $EXT_VER"
  fi
else
  fail "Continue extension not installed — run 02-install-continue.sh"
fi

# 5. Continue config
echo ""
echo "[ Continue Config ]"
if [[ -f "${HOME}/.continue/config.yaml" ]]; then
  pass "WSL config: ${HOME}/.continue/config.yaml"
else
  warn "~/.continue/config.yaml not found — run 02-install-continue.sh"
fi

# 6. Node.js (for build)
echo ""
echo "[ Build Tools ]"
if conda run -n node20 node --version &>/dev/null 2>&1; then
  NODE_VER=$(conda run -n node20 node --version 2>/dev/null)
  pass "conda node20: $NODE_VER"
else
  warn "conda env node20 not found — needed for building VSIX"
fi

# --- Summary ---
echo ""
echo "======================================="
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}  All checks passed!${NC}"
  echo ""
  echo "  Launch VSCode Linux:"
  echo "  source ~/.bashrc && code-wsl /mnt/e/08-Sources/1.AI/continue"
else
  echo -e "${RED}  $FAILED check(s) failed${NC}"
  echo "  Fix issues above and re-run this script"
fi
echo "======================================="
echo ""
