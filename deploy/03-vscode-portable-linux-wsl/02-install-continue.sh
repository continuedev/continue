#!/usr/bin/env bash
# =============================================================================
# 02-install-continue.sh
# Install Continue VSIX (linux-x64) vào VSCode portable Linux/WSL
#
# Continue config resolution trong WSL:
#   - Node.js os.homedir() = /home/<user> (WSL home, KHÔNG phải Windows home)
#   - Continue tự động dùng ~/.continue/ (WSL native)
#   - Hoàn toàn isolate với VSCode Windows (~/.continue trên Windows)
#   - Không cần config riêng — ~/.continue/ đã là WSL-specific
#
# Nếu ~/.continue chưa có → sync từ Windows user folder (nếu accessible)
#
# Usage:
#   bash 02-install-continue.sh [--vsix <path>]
# =============================================================================
set -euo pipefail

INSTALL_DIR="${HOME}/.apps/vscode-linux"
CONTINUE_CONFIG="${HOME}/.continue"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Parse args ---
VSIX_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vsix) VSIX_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# --- Auto-detect VSIX ---
if [[ -z "$VSIX_FILE" ]]; then
  VSIX_FILE=$(ls "${SCRIPT_DIR}/continue-linux-x64-"*.vsix 2>/dev/null | sort -r | head -1 || true)
  if [[ -z "$VSIX_FILE" ]]; then
    VSIX_FILE=$(ls "${REPO_ROOT}/extensions/vscode/build/continue-linux-x64-"*.vsix 2>/dev/null | sort -r | head -1 || true)
  fi
fi

[[ -z "$VSIX_FILE" ]] && \
  error "No linux-x64 VSIX found. Build first:
  bash deploy/01-build-extension/build-linux.sh --target linux-x64"

[[ -f "${INSTALL_DIR}/code" ]] || \
  error "VSCode portable not found at $INSTALL_DIR. Run 01-setup-vscode-portable.sh first."

echo ""
echo "=============================================="
echo "  Continue Extension Install — Linux/WSL"
echo "  VSIX:   $(basename "$VSIX_FILE")"
echo "  VSCode: $INSTALL_DIR"
echo "=============================================="
echo ""

# =============================================================================
# STEP 1: Install extension vào portable VSCode
# =============================================================================
info "Installing Continue extension (manual VSIX extract)..."
# VSCode CLI --install-extension với WSLg active sẽ khởi động full GUI process
# và block rất lâu. Giải pháp: extract VSIX thủ công (VSIX = zip file).
python3 -c "
import zipfile, os, shutil, json, sys, time

vsix = sys.argv[1]
ext_dir = sys.argv[2]

# Đọc metadata từ VSIX
with zipfile.ZipFile(vsix) as z:
    with z.open('extension/package.json') as f:
        pkg = json.load(f)

publisher = pkg.get('publisher', 'unknown')
name      = pkg.get('name', 'unknown')
version   = pkg.get('version', '0.0.0')
ext_id    = f'{publisher}.{name}-{version}'
target    = os.path.join(ext_dir, ext_id)

print(f'  Publisher: {publisher}')
print(f'  Name:      {name}')
print(f'  Version:   {version}')
print(f'  Target:    {target}')

# Clean install
if os.path.exists(target):
    shutil.rmtree(target)
os.makedirs(target, exist_ok=True)

# Extract extension/ content
with zipfile.ZipFile(vsix) as z:
    count = 0
    for member in z.namelist():
        if not member.startswith('extension/'):
            continue
        dest = os.path.join(target, member[len('extension/'):])
        if member.endswith('/'):
            os.makedirs(dest, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with z.open(member) as src, open(dest, 'wb') as dst:
                shutil.copyfileobj(src, dst)
            count += 1

print(f'  Extracted: {count} files')

# Update extensions.json
ext_json_path = os.path.join(ext_dir, 'extensions.json')
try:
    ext_list = json.load(open(ext_json_path))
except:
    ext_list = []

# Remove old entries for same extension
ext_list = [e for e in ext_list
            if name.lower() not in e.get('identifier',{}).get('id','').lower()]

ext_list.append({
    'identifier': {'id': f'{publisher}.{name}', 'uuid': ''},
    'version': version,
    'location': {'\$mid': 1, 'path': target, 'scheme': 'file'},
    'relativeLocation': ext_id,
    'metadata': {
        'installedTimestamp': int(time.time() * 1000),
        'source': 'vsix',
        'pinned': False
    }
})

json.dump(ext_list, open(ext_json_path, 'w'), indent=2)
print(f'  extensions.json: {len(ext_list)} entries')
print('  DONE')
" "$VSIX_FILE" "${INSTALL_DIR}/data/extensions" 2>&1

success "Extension installed"

# =============================================================================
# STEP 2: Kiểm tra ~/.continue config (WSL native)
# =============================================================================
echo ""
info "Checking ~/.continue config (WSL native path)..."

if [[ -f "${CONTINUE_CONFIG}/config.yaml" ]]; then
  success "~/.continue/config.yaml exists — will be used automatically"
  info "Config preview:"
  head -5 "${CONTINUE_CONFIG}/config.yaml" | sed 's/^/  /'
else
  warn "~/.continue/config.yaml not found"

  # Thử sync từ Windows user folder nếu accessible
  WIN_CONTINUE=""
  for win_user in /mnt/c/Users/*/; do
    if [[ -f "${win_user}.continue/config.yaml" ]]; then
      WIN_CONTINUE="${win_user}.continue"
      break
    fi
  done

  if [[ -n "$WIN_CONTINUE" ]]; then
    info "Found Windows config at: $WIN_CONTINUE"
    info "Syncing to ~/.continue/ ..."
    mkdir -p "${CONTINUE_CONFIG}"
    # Copy config files (không copy sessions, dev_data, index — quá lớn)
    rsync -av --exclude='sessions/' \
               --exclude='dev_data/' \
               --exclude='index/' \
               --exclude='.utils/' \
               "${WIN_CONTINUE}/" "${CONTINUE_CONFIG}/" 2>&1 | grep -v "/$" | head -20
    success "Config synced from Windows: $WIN_CONTINUE"
    success "~/.continue/config.yaml ready"
  else
    warn "Windows config not accessible. Creating minimal config..."
    mkdir -p "${CONTINUE_CONFIG}"
    cat > "${CONTINUE_CONFIG}/config.yaml" << 'CONFIG_EOF'
name: WSL OnPrem
version: 1.0.0
schema: v1

allowAnonymousTelemetry: false

models:
  - name: "OnPrem LLM"
    provider: openai
    model: your-model-name
    apiBase: http://your-llm-server/v1
    apiKey: your-api-key
    requestOptions:
      verifySsl: false
CONFIG_EOF
    warn "Edit ${CONTINUE_CONFIG}/config.yaml with your model settings"
  fi
fi

# =============================================================================
# STEP 3: Configure portable VSCode settings (terminal + config path)
# =============================================================================
info "Configuring VSCode portable settings..."
USER_SETTINGS_DIR="${INSTALL_DIR}/data/user-data/User"
USER_SETTINGS="${USER_SETTINGS_DIR}/settings.json"
mkdir -p "$USER_SETTINGS_DIR"

if [[ ! -f "$USER_SETTINGS" ]]; then
  cat > "$USER_SETTINGS" << 'SETTINGS_EOF'
{
  "terminal.integrated.defaultProfile.linux": "bash",
  "terminal.integrated.profiles.linux": {
    "bash": {
      "path": "/bin/bash",
      "args": ["-l"]
    }
  },
  "terminal.integrated.env.linux": {},
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/**": true
  }
}
SETTINGS_EOF
  success "VSCode settings created (terminal: bash)"
else
  success "VSCode settings already exist: $USER_SETTINGS"
fi

# =============================================================================
# STEP 4: Verify extension installed
# =============================================================================
echo ""
info "Verifying extension..."
EXT_DIR="${INSTALL_DIR}/data/extensions"
INSTALLED=$(ls "$EXT_DIR" 2>/dev/null | grep -i "continue" || true)
if [[ -n "$INSTALLED" ]]; then
  success "Extension verified: $INSTALLED"
else
  warn "Extension not visible in $EXT_DIR (may appear after first VSCode launch)"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}  Install complete!${NC}"
echo "=============================================="
echo ""
echo "  Extension: $(basename "$VSIX_FILE")"
echo "  Config:    ${CONTINUE_CONFIG}/config.yaml"
echo "  Settings:  $USER_SETTINGS"
echo ""
echo "  Note: ~/.continue/ is WSL-native (isolated from Windows)"
echo "        VSCode Linux and VSCode Windows use SEPARATE configs"
echo ""
echo "  Launch:"
echo "  source ~/.bashrc && code-wsl /mnt/e/08-Sources/1.AI/continue"
echo ""
echo "  Next: bash deploy/03-vscode-portable-linux-wsl/03-verify.sh"
echo ""
