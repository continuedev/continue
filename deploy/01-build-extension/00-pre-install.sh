#!/usr/bin/env bash
# =============================================================================
# 00-pre-install.sh — Pre-install native dependencies cho build
#
# Vấn đề: node_modules trong repo thường được install trên Windows (rg.exe),
# nhưng build linux-x64 cần Linux binaries (rg, .so files).
# Script này fix tất cả platform-specific dependencies trước khi build.
#
# Những gì script làm:
#   1. Kiểm tra / cài conda env node20 (hoặc dùng system Node.js)
#   2. Auto-detect npm registry (Nexus internal → fallback public npmjs.org)
#   3. npm install trong extensions/vscode (lấy đúng platform packages)
#   4. Fix @vscode/ripgrep → install platform binary + symlink
#   5. Fix @lancedb → install platform binary
#   6. Fix esbuild → install @esbuild/<platform> binary khớp version (mọi workspace)
#   7. Verify tất cả required files có mặt
#
# Registry fallback:
#   - Thử Nexus internal (http://localhost:7081/repository/npm-group/) trước
#   - Nếu không accessible → tự động fallback sang https://registry.npmjs.org/
#   - Override bằng env var: NPM_REGISTRY="https://..." hoặc --registry <url>
#
# Usage:
#   bash deploy/01-build-extension/00-pre-install.sh [--target linux-x64|win32-x64|darwin-arm64|darwin-x64]
#   bash deploy/01-build-extension/00-pre-install.sh --check-only
#   bash deploy/01-build-extension/00-pre-install.sh --registry https://registry.npmjs.org/
# =============================================================================
set -euo pipefail

TARGET="${TARGET:-linux-x64}"
CHECK_ONLY=false
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
USER_REGISTRY=""

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)     TARGET="$2"; shift 2 ;;
    --check-only) CHECK_ONLY=true; shift ;;
    --registry)   USER_REGISTRY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# --- Colors ---
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# =============================================================================
# Registry detection with fallback
# =============================================================================
NEXUS_REGISTRY="http://localhost:7081/repository/npm-group/"
PUBLIC_REGISTRY="https://registry.npmjs.org/"

detect_npm_registry() {
  # Priority: --registry arg > NPM_REGISTRY env var > auto-detect
  if [[ -n "$USER_REGISTRY" ]]; then
    NPM_REGISTRY="$USER_REGISTRY"
    info "Using registry from --registry arg: $NPM_REGISTRY"
    return
  fi

  if [[ -n "${NPM_REGISTRY:-}" ]]; then
    info "Using registry from NPM_REGISTRY env: $NPM_REGISTRY"
    return
  fi

  # Auto-detect: try Nexus first, fallback to public
  info "Auto-detecting npm registry..."
  if curl -sf --connect-timeout 3 --max-time 5 "${NEXUS_REGISTRY}-/ping" >/dev/null 2>&1 ||
     curl -sf --connect-timeout 3 --max-time 5 "${NEXUS_REGISTRY}" >/dev/null 2>&1; then
    NPM_REGISTRY="$NEXUS_REGISTRY"
    success "Nexus internal registry available: $NPM_REGISTRY"
  else
    NPM_REGISTRY="$PUBLIC_REGISTRY"
    warn "Nexus not available — falling back to public registry: $NPM_REGISTRY"
  fi
}

detect_npm_registry

# Derive platform info from target
case "$TARGET" in
  linux-x64)    OS=linux; ARCH=x64; EXE="";     LANCEDB_SUFFIX="-gnu" ;;
  win32-x64)    OS=win32; ARCH=x64; EXE=".exe";  LANCEDB_SUFFIX="-msvc" ;;
  darwin-arm64) OS=darwin; ARCH=arm64; EXE="";   LANCEDB_SUFFIX="" ;;
  darwin-x64)   OS=darwin; ARCH=x64; EXE="";     LANCEDB_SUFFIX="" ;;
  *) error "Unknown target: $TARGET" ;;
esac

LANCEDB_PKG="@lancedb/vectordb-${TARGET}${LANCEDB_SUFFIX}"
RIPGREP_PKG="@vscode/ripgrep-${OS}-${ARCH}"

echo ""
echo "=============================================="
echo "  Continue Pre-install — $TARGET"
echo "  Repo: $REPO_ROOT"
echo "  npm:  $NPM_REGISTRY"
echo "=============================================="
echo ""

EXT_DIR="${REPO_ROOT}/extensions/vscode"
FAILED=0

# =============================================================================
# STEP 0: Verify Node.js environment (conda node20 OR system Node 20.x)
# =============================================================================
info "Checking Node.js environment..."

USE_CONDA=false
NODE_PREFIX=""

if command -v conda &>/dev/null && conda env list 2>/dev/null | grep -q "^node20"; then
  USE_CONDA=true
  NODE_PREFIX="conda run -n node20"
  NODE_VER=$($NODE_PREFIX node --version 2>/dev/null || echo "N/A")
  success "Using conda env 'node20': $NODE_VER"
elif command -v node &>/dev/null; then
  NODE_VER=$(node --version 2>/dev/null || echo "N/A")
  NODE_MAJOR=$(echo "$NODE_VER" | grep -oE '[0-9]+' | head -1)
  if [[ "$NODE_MAJOR" != "20" ]]; then
    warn "System Node.js is $NODE_VER — expected v20.x"
    warn "Consider: conda create -n node20 -y nodejs=20"
  fi
  success "Using system Node.js: $NODE_VER"
else
  if [[ "$CHECK_ONLY" == "true" ]]; then
    echo -e "  ${RED}[FAIL]${NC} Node.js not found (no conda node20, no system node)"
    FAILED=$((FAILED+1))
  else
    error "Node.js not found. Install via:\n" \
          "  conda create -n node20 -y nodejs=20   (recommended)\n" \
          "  nvm install 20 && nvm use 20\n" \
          "  brew install node@20                  (macOS)"
  fi
fi

# Helper: run npm command with correct environment
run_npm_cmd() {
  if [[ "$USE_CONDA" == "true" ]]; then
    conda run -n node20 "$@"
  else
    "$@"
  fi
}

# =============================================================================
# Helper: check_or_install
# =============================================================================
check_file() {
  local file="$1"
  local desc="$2"
  if [[ -e "$file" ]]; then
    echo -e "  ${GREEN}[OK]${NC}    $desc"
    return 0
  else
    echo -e "  ${RED}[MISSING]${NC} $desc"
    echo -e "            → $file"
    FAILED=$((FAILED+1))
    return 1
  fi
}

# =============================================================================
# STEP 1: npm install trong extensions/vscode
#
# QUAN TRONG: npm install se PRUNE cac platform binary da install bang
# --no-save (ripgrep-linux, lancedb-*-gnu, @esbuild/linux-x64) neu chung
# khong phai dependency truc tiep cua package.json. Vi vay chi chay
# npm install khi node_modules CHUA san — neu binaries platform da co thi
# bo qua, de cac STEP 2/3/3c o sau (cai bang --no-save) khong bi xoa.
#
# Ngoai ra kiem tra sqlite3 binding platform: neu da co EXT_DIR/node_modules
# nhung sqlite3 sai platform (Windows PE32 khi target=linux) thi van phai
# chay npm install de dam bao node_modules fresh va symlinks dung path.
# =============================================================================

# Check xem node_modules co valid khong (sqlite3 binding phai dung platform)
_ext_nm_is_valid() {
  [[ -d "${EXT_DIR}/node_modules" ]] || return 1
  [[ -d "${EXT_DIR}/node_modules/@vscode/ripgrep" ]] || return 1
  [[ -d "${EXT_DIR}/node_modules/esbuild" ]] || return 1
  # Sanity check: cac packages core phai co package.json (detect corrupted install)
  # Neu thieu package.json -> node_modules bi partial/corrupt -> phai reinstall
  for _pkg in rimraf ncp @vscode/vsce; do
    local _pkgdir="${EXT_DIR}/node_modules/${_pkg}"
    if [[ -d "$_pkgdir" && ! -f "${_pkgdir}/package.json" ]]; then
      warn "Corrupted package detected: ${_pkg} (missing package.json) — will reinstall"
      return 1  # trigger fresh npm install
    fi
  done
  # Kiem tra sqlite3 binding neu target la linux
  if [[ "$OS" == "linux" ]]; then
    local sqlite_src="${REPO_ROOT}/core/node_modules/sqlite3/build/Release/node_sqlite3.node"
    if [[ -f "$sqlite_src" ]] && ! file -b "$sqlite_src" 2>/dev/null | grep -q "ELF"; then
      return 1  # sqlite3 sai platform -> can fresh install
    fi
  fi
  return 0
}

if [[ "$CHECK_ONLY" == "false" ]]; then
  if _ext_nm_is_valid; then
    success "extensions/vscode/node_modules da ton tai va hop le — bo qua npm install (tranh prune platform binaries)"
  else
    info "Running npm install in extensions/vscode (registry: $NPM_REGISTRY)..."
    run_npm_cmd bash -c "
      cd '${EXT_DIR}'
      npm install --registry '${NPM_REGISTRY}' 2>&1 | tail -4
    " || {
      # Fallback: if Nexus failed mid-install, retry with public registry
      if [[ "$NPM_REGISTRY" != "$PUBLIC_REGISTRY" ]]; then
        warn "npm install failed with $NPM_REGISTRY — retrying with public registry..."
        NPM_REGISTRY="$PUBLIC_REGISTRY"
        run_npm_cmd bash -c "
          cd '${EXT_DIR}'
          npm install --registry '${NPM_REGISTRY}' 2>&1 | tail -4
        "
      else
        error "npm install failed"
      fi
    }
    success "npm install done"
  fi

  # Đảm bảo 'yaml' package có mặt — source code dùng `import * as YAML from "yaml"`
  # nhưng package này không được khai báo trong extensions/vscode/package.json
  # (nó là transitive dep của core/config-yaml). Thiếu nó → esbuild crash khi bundle.
  if [[ ! -f "${EXT_DIR}/node_modules/yaml/package.json" ]]; then
    info "Installing missing 'yaml' package (used by src/commands.ts)..."
    run_npm_cmd bash -c "
      cd '${EXT_DIR}'
      npm install yaml --registry '${NPM_REGISTRY}' --no-save --no-package-lock 2>&1 | tail -3
    " || run_npm_cmd bash -c "
      cd '${EXT_DIR}'
      npm install yaml --registry '${PUBLIC_REGISTRY}' --no-save --no-package-lock 2>&1 | tail -3
    "
    success "yaml installed"
  else
    success "yaml package present"
  fi
fi

# =============================================================================
# STEP 2: Fix @vscode/ripgrep — install platform binary
# =============================================================================
RIPGREP_BIN="${EXT_DIR}/node_modules/${RIPGREP_PKG}/bin/rg${EXE}"
RIPGREP_SYMLINK="${EXT_DIR}/node_modules/@vscode/ripgrep/bin/rg${EXE}"

echo ""
info "[@vscode/ripgrep] target: $RIPGREP_PKG"

if [[ ! -f "$RIPGREP_BIN" ]]; then
  if [[ "$CHECK_ONLY" == "true" ]]; then
    echo -e "  ${RED}[MISSING]${NC} $RIPGREP_PKG binary"
    FAILED=$((FAILED+1))
  else
    info "Installing $RIPGREP_PKG..."
    run_npm_cmd bash -c "
      cd '${EXT_DIR}'
      npm install '${RIPGREP_PKG}' --registry '${NPM_REGISTRY}' --no-save --no-package-lock 2>&1 | tail -3
    " || {
      if [[ "$NPM_REGISTRY" != "$PUBLIC_REGISTRY" ]]; then
        warn "Failed with $NPM_REGISTRY — retrying with public registry..."
        run_npm_cmd bash -c "
          cd '${EXT_DIR}'
          npm install '${RIPGREP_PKG}' --registry '${PUBLIC_REGISTRY}' --no-save --no-package-lock 2>&1 | tail -3
        "
      else
        error "Failed to install $RIPGREP_PKG"
      fi
    }
    success "$RIPGREP_PKG installed"
  fi
else
  success "$RIPGREP_PKG binary exists"
fi

# Create symlink nếu chưa có
if [[ ! -e "$RIPGREP_SYMLINK" ]] && [[ -f "$RIPGREP_BIN" ]]; then
  if [[ "$CHECK_ONLY" == "true" ]]; then
    echo -e "  ${RED}[MISSING]${NC} ripgrep symlink: $RIPGREP_SYMLINK"
    FAILED=$((FAILED+1))
  else
    info "Creating ripgrep symlink..."
    mkdir -p "$(dirname "$RIPGREP_SYMLINK")"
    ln -sf "$RIPGREP_BIN" "$RIPGREP_SYMLINK"
    success "Symlink: @vscode/ripgrep/bin/rg${EXE} → ${RIPGREP_PKG}/bin/rg${EXE}"
  fi
elif [[ -e "$RIPGREP_SYMLINK" ]]; then
  success "ripgrep symlink exists"
fi

# =============================================================================
# STEP 3: Fix @lancedb — install platform binary
# =============================================================================
LANCEDB_NODE="${EXT_DIR}/node_modules/${LANCEDB_PKG}/index.node"

echo ""
info "[@lancedb] target: $LANCEDB_PKG"

if [[ ! -f "$LANCEDB_NODE" ]]; then
  if [[ "$CHECK_ONLY" == "true" ]]; then
    echo -e "  ${RED}[MISSING]${NC} $LANCEDB_PKG"
    FAILED=$((FAILED+1))
  else
    info "Installing $LANCEDB_PKG..."
    run_npm_cmd bash -c "
      cd '${EXT_DIR}'
      npm install '${LANCEDB_PKG}' --registry '${NPM_REGISTRY}' --no-save --no-package-lock 2>&1 | tail -3
    " || {
      if [[ "$NPM_REGISTRY" != "$PUBLIC_REGISTRY" ]]; then
        warn "Failed with $NPM_REGISTRY — retrying with public registry..."
        run_npm_cmd bash -c "
          cd '${EXT_DIR}'
          npm install '${LANCEDB_PKG}' --registry '${PUBLIC_REGISTRY}' --no-save --no-package-lock 2>&1 | tail -3
        "
      else
        error "Failed to install $LANCEDB_PKG"
      fi
    }
    success "$LANCEDB_PKG installed"
  fi
else
  success "$LANCEDB_PKG binary exists"
fi

# =============================================================================
# STEP 3b: Fix sqlite3 native binding (node_sqlite3.node)
#
# prepackage.js (SKIP_INSTALLS=true) copy binding từ:
#   core/node_modules/sqlite3/build/Release/node_sqlite3.node
#
# Nếu core/node_modules được npm install trên Windows → binding là PE32 →
# VS Code Linux/WSL activate fail: "invalid ELF header".
#
# Fix: download prebuilt binary từ TryGhost/node-sqlite3 GitHub releases
# (đúng approach của copySqlite() trong prepackage.js — KHÔNG dùng node-gyp).
# URL: https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/
#      sqlite3-v5.1.7-napi-v6-{target}.tar.gz
#
# Đảm bảo core/node_modules tồn tại trước: nếu chưa có (fresh Linux build),
# chạy core npm install để lấy đúng package.json + folder structure.
# =============================================================================
CORE_SQLITE="${REPO_ROOT}/core/node_modules/sqlite3"
SQLITE_BINDING="${CORE_SQLITE}/build/Release/node_sqlite3.node"
SQLITE_VERSION="5.1.7"

# Ensure core/node_modules exists (fresh Linux build — node_modules not synced)
# Dùng --ignore-scripts để tránh sqlite3 tự compile (sẽ fail trên NTFS / air-gap).
# Prebuilt binary sẽ được download riêng ở bước dưới.
if [[ "$CHECK_ONLY" == "false" && ! -d "${REPO_ROOT}/core/node_modules" ]]; then
  info "[sqlite3] core/node_modules chưa có — chạy core npm install --ignore-scripts..."
  run_npm_cmd bash -c "
    cd '${REPO_ROOT}/core'
    npm install --ignore-scripts --registry '${NPM_REGISTRY}' 2>&1 | tail -3
  " || run_npm_cmd bash -c "
    cd '${REPO_ROOT}/core'
    npm install --ignore-scripts --registry '${PUBLIC_REGISTRY}' 2>&1 | tail -3
  "
  success "core/node_modules installed (--ignore-scripts)"
fi

echo ""
info "[sqlite3] target binding: ${SQLITE_BINDING}"

sqlite_binding_is_target_platform() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  local ftype
  ftype=$(file -b "$f" 2>/dev/null)
  case "$OS" in
    linux)  echo "$ftype" | grep -q "ELF" ;;
    win32)  echo "$ftype" | grep -q "PE32" ;;
    darwin) echo "$ftype" | grep -q "Mach-O" ;;
  esac
}

if sqlite_binding_is_target_platform "$SQLITE_BINDING"; then
  success "sqlite3 binding đúng platform ($OS)"
elif [[ "$CHECK_ONLY" == "true" ]]; then
  echo -e "  ${RED}[WRONG PLATFORM]${NC} sqlite3 binding: $(file -b "$SQLITE_BINDING" 2>/dev/null || echo 'missing')"
  FAILED=$((FAILED+1))
else
  warn "sqlite3 binding sai platform hoặc thiếu — downloading prebuilt cho $OS..."

  # Ensure sqlite3 package folder exists (sau --ignore-scripts, folder có thể thiếu)
  if [[ ! -d "$CORE_SQLITE" ]]; then
    info "sqlite3 package folder missing — installing sqlite3 package only (--ignore-scripts)..."
    run_npm_cmd bash -c "
      cd '${REPO_ROOT}/core'
      npm install sqlite3 --ignore-scripts --registry '${NPM_REGISTRY}' 2>&1 | tail -3
    " || run_npm_cmd bash -c "
      cd '${REPO_ROOT}/core'
      npm install sqlite3 --ignore-scripts --registry '${PUBLIC_REGISTRY}' 2>&1 | tail -3
    "
    [[ -d "$CORE_SQLITE" ]] || error "core/node_modules/sqlite3 vẫn không tồn tại sau npm install"
    success "sqlite3 package installed (no native build)"
  fi

  # Download prebuilt binary từ GitHub releases (N-API — ABI-stable)
  # Đây là cách prepackage.js dùng (copySqlite), không cần build-from-source / node-gyp
  SQLITE_URL="https://github.com/TryGhost/node-sqlite3/releases/download/v${SQLITE_VERSION}/sqlite3-v${SQLITE_VERSION}-napi-v6-${TARGET}.tar.gz"
  SQLITE_TGZ="/tmp/sqlite3-${TARGET}.tar.gz"

  info "Downloading prebuilt sqlite3 from: $SQLITE_URL"
  DOWNLOAD_OK=false

  # Thử trực tiếp trước
  if curl -sfL --connect-timeout 10 --max-time 120 -o "$SQLITE_TGZ" "$SQLITE_URL" 2>/dev/null \
     && file "$SQLITE_TGZ" 2>/dev/null | grep -q gzip; then
    DOWNLOAD_OK=true
    success "Downloaded directly"
  fi

  # Fallback: proxy_windows (air-gap WSL)
  if [[ "$DOWNLOAD_OK" == "false" ]]; then
    warn "Direct download failed — trying proxy_windows..."
    bash -ic "proxy_windows >/dev/null 2>&1; curl -sL --max-time 120 -o '$SQLITE_TGZ' '$SQLITE_URL'" 2>/dev/null || true
    if file "$SQLITE_TGZ" 2>/dev/null | grep -q gzip; then
      DOWNLOAD_OK=true
      success "Downloaded via proxy_windows"
    fi
  fi

  if [[ "$DOWNLOAD_OK" == "false" ]]; then
    error "Không download được prebuilt sqlite3.
  URL: $SQLITE_URL
  Air-gap: download thủ công rồi đặt vào $SQLITE_TGZ"
  fi

  # Extract prebuilt vào core/node_modules/sqlite3 (giống copySqlite)
  info "Extracting prebuilt sqlite3 binding..."
  rm -rf "${CORE_SQLITE}/build"
  tar -xzf "$SQLITE_TGZ" -C "$CORE_SQLITE"
  rm -f "$SQLITE_TGZ"

  # Verify đúng platform sau extract
  if sqlite_binding_is_target_platform "$SQLITE_BINDING"; then
    success "sqlite3 prebuilt extracted: $(file -b "$SQLITE_BINDING" | cut -d, -f1-2)"
  else
    error "sqlite3 binding sau extract vẫn sai platform: $(file -b "$SQLITE_BINDING" 2>/dev/null || echo missing)"
  fi
fi


# =============================================================================
# STEP 3c: Fix esbuild platform binary (@esbuild/<platform>)
#
# Van de: node_modules thuong npm install tren Windows → esbuild chi tai
# binary @esbuild/win32-x64 (esbuild.exe). Build tren Linux/WSL, buoc
# "Packaging VSIX" (vsce → vscode:prepublish → esbuild minify) can
# @esbuild/linux-x64. Esbuild resolve binary bang cach require package
# @esbuild/<os>-<arch> → neu khong co → crash:
#   The package "@esbuild/linux-x64" could not be found, and is needed by esbuild.
#
# Vi sao build gui/core (vite) khong fail: Windows .exe van chay duoc qua
# WSL interop nen binary win32-x64 "van xong" o do. Nhung extensions/vscode
# @esbuild/ rong hoan toan → that bai o buoc package. Fix dai han: dam bao
# binary @esbuild/<platform> ton tai o MOI workspace co esbuild, KHOP version
# cua esbuild tai cho (versions khac nhau gitua cac workspace).
# =============================================================================
ESBUILD_PKG="@esbuild/${OS}-${ARCH}"

echo ""
info "[esbuild] target binary package: $ESBUILD_PKG"

# Liet ke workspace co esbuild (monorepo): extensions/vscode, core, gui, packages/*
ESBUILD_WORKSPACES=()
for ws in "extensions/vscode" "core" "gui" packages/*/; do
  ws="${ws%/}"
  if [[ -f "${REPO_ROOT}/${ws}/node_modules/esbuild/package.json" ]]; then
    ESBUILD_WORKSPACES+=("$ws")
  fi
done

if [[ ${#ESBUILD_WORKSPACES[@]} -eq 0 ]]; then
  warn "Khong thay workspace nao co esbuild — bo qua buoc esbuild"
else
  for ws in "${ESBUILD_WORKSPACES[@]}"; do
    esb_dir="${REPO_ROOT}/${ws}/node_modules/esbuild"
    esb_target_bin="${REPO_ROOT}/${ws}/node_modules/@esbuild/${OS}-${ARCH}"
    # Binary nam trong bin/ (win32: bin/esbuild.exe, khac: bin/esbuild) — xem esbuild main.js
    esb_target_exe="${esb_target_bin}/bin/esbuild${EXE}"
    esb_ver=$(grep '"version"' "${esb_dir}/package.json" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

    need_install=false
    if [[ ! -f "$esb_target_exe" ]]; then
      need_install=true
    elif [[ -n "$esb_ver" ]]; then
      installed_bin_ver=$(grep '"version"' "${esb_target_bin}/package.json" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
      [[ "$installed_bin_ver" != "$esb_ver" ]] && need_install=true
    fi

    if [[ "$need_install" == "false" ]]; then
      success "${ws}: @esbuild/${OS}-${ARCH}@${esb_ver} da dung"
      continue
    fi

    if [[ "$CHECK_ONLY" == "true" ]]; then
      echo -e "  ${RED}[MISSING/WRONG VER]${NC} ${ws}: @esbuild/${OS}-${ARCH}@${esb_ver}"
      FAILED=$((FAILED+1))
      continue
    fi

    info "${ws}: cai @esbuild/${OS}-${ARCH}@${esb_ver}..."
    run_npm_cmd bash -c "
      cd '${REPO_ROOT}/${ws}'
      npm install '${ESBUILD_PKG}@${esb_ver}' --registry '${NPM_REGISTRY}' --no-save --no-package-lock --force 2>&1 | tail -3
    " || {
      if [[ "$NPM_REGISTRY" != "$PUBLIC_REGISTRY" ]]; then
        warn "Failed with $NPM_REGISTRY — retrying with public registry..."
        run_npm_cmd bash -c "
          cd '${REPO_ROOT}/${ws}'
          npm install '${ESBUILD_PKG}@${esb_ver}' --registry '${PUBLIC_REGISTRY}' --no-save --no-package-lock --force 2>&1 | tail -3
        " || error "Khong cai duoc ${ESBUILD_PKG}@${esb_ver} cho ${ws}"
      else
        error "Khong cai duoc ${ESBUILD_PKG}@${esb_ver} cho ${ws}"
      fi
    }

    if [[ -f "$esb_target_exe" ]]; then
      success "${ws}: @esbuild/${OS}-${ARCH}@${esb_ver} installed"
    else
      error "${ws}: binary van thieu sau khi install: $esb_target_exe"
    fi
  done
fi

# =============================================================================
# STEP 4: Verify tất cả required files
# =============================================================================
echo ""
info "Verifying required files for prepackage ($TARGET)..."

cd "$EXT_DIR"

# Core required files
check_file "node_modules/@vscode/ripgrep/bin/rg${EXE}"          "ripgrep binary (node_modules)"

# onnxruntime — luôn có sau npm install core
check_file "${REPO_ROOT}/core/node_modules/onnxruntime-node/bin/napi-v3/${OS}/${ARCH}/onnxruntime_binding.node" \
           "onnxruntime binding (${OS}/${ARCH})"

# lancedb
check_file "node_modules/${LANCEDB_PKG}/index.node" \
           "lancedb binary (${LANCEDB_PKG})"

# sqlite3 binding (đúng platform — đã build/verify ở STEP 3b)
if sqlite_binding_is_target_platform "$SQLITE_BINDING"; then
  echo -e "  ${GREEN}[OK]${NC}    sqlite3 binding ($OS): core/node_modules/sqlite3/build/Release/node_sqlite3.node"
else
  echo -e "  ${RED}[WRONG PLATFORM]${NC} sqlite3 binding: $(file -b "$SQLITE_BINDING" 2>/dev/null || echo 'missing')"
  FAILED=$((FAILED+1))
fi

# GUI build output — prepackage.js expects gui/assets/ symlinked or copied
# Kiểm tra cả 2 locations có thể có
if [[ -f "gui/assets/index.js" ]] || [[ -f "../../gui/out/assets/index.js" ]]; then
  echo -e "  ${GREEN}[OK]${NC}    gui assets (gui/assets/index.js)"
else
  echo -e "  ${YELLOW}[WARN]${NC}  gui/assets not built yet — OK if running full build"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=============================================="
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}  Pre-install complete — ready to build!${NC}"
  if [[ "$CHECK_ONLY" == "true" ]]; then
    echo -e "${GREEN}  All checks passed${NC}"
  fi
  echo ""
  echo "  Next:"
  echo "  bash deploy/01-build-extension/build-linux.sh --target $TARGET"
else
  if [[ "$CHECK_ONLY" == "true" ]]; then
    echo -e "${RED}  $FAILED check(s) failed${NC}"
    echo ""
    echo "  Fix with:"
    echo "  bash deploy/01-build-extension/00-pre-install.sh --target $TARGET"
  else
    echo -e "${YELLOW}  $FAILED item(s) may still be missing${NC}"
    echo "  Re-run with --check-only to verify"
  fi
fi
echo "=============================================="
echo ""
