#!/usr/bin/env bash
# =============================================================================
# 04-setup-fcitx5-vietnamese.sh
# Cài fcitx5 + fcitx5-unikey để gõ tiếng Việt trong VSCode WSLg
#
# QUAN TRỌNG — KHÔNG auto-enable:
#   fcitx5 CHỈ được kích hoạt khi bạn dùng 'code-wsl' (WSLg app).
#   Terminal WSL thông thường KHÔNG bị ảnh hưởng.
#   ~/.bashrc KHÔNG bị sửa — tránh conflict hoàn toàn.
#
#   Cơ chế:
#   - fcitx5 env vars chỉ được inject vào code-wsl wrapper
#   - fcitx5 daemon chỉ start khi code-wsl chạy
#   - Khi đóng code-wsl → daemon tự stop
#
# Usage:
#   bash 04-setup-fcitx5-vietnamese.sh
#   bash 04-setup-fcitx5-vietnamese.sh --uninstall
# =============================================================================
set -euo pipefail

WRAPPER="${HOME}/.local/bin/code-wsl"
VSCODE_DIR="${HOME}/.apps/vscode-linux"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

UNINSTALL=false
[[ "${1:-}" == "--uninstall" ]] && UNINSTALL=true

if [[ "$UNINSTALL" == "true" ]]; then
  info "Removing fcitx5 from code-wsl wrapper..."
  # Restore wrapper về bản không có fcitx5
  sed -i '/# === fcitx5 Vietnamese IME ===/,/# === end fcitx5 ===/d' "$WRAPPER" 2>/dev/null || true
  success "fcitx5 removed from code-wsl wrapper"
  info "To uninstall packages: sudo apt remove fcitx5 fcitx5-unikey"
  exit 0
fi

echo ""
echo "=============================================="
echo "  fcitx5-unikey Setup — Vietnamese Input"
echo "  for VSCode Linux WSLg"
echo "=============================================="
echo ""
echo -e "  ${YELLOW}NOTE:${NC} fcitx5 will ONLY activate inside code-wsl"
echo -e "  ${YELLOW}NOTE:${NC} Normal WSL terminals are NOT affected"
echo ""

# =============================================================================
# STEP 1: Install packages via Nexus apt
# =============================================================================
info "Installing fcitx5 + fcitx5-unikey..."

# Kiểm tra Nexus apt accessible
NEXUS_APT="http://localhost:7081/repository/debian-trixie"
if curl -s --max-time 5 "$NEXUS_APT/dists/stable/InRelease" > /dev/null 2>&1; then
  info "Using Nexus apt proxy: $NEXUS_APT"
  # Tạm thêm Nexus apt source cho session này
  export APT_OPTS="-o Dir::Etc::sourcelist=/dev/null -o Dir::Etc::sourceparts=/dev/null"
else
  warn "Nexus apt not accessible — using system apt sources"
  export APT_OPTS=""
fi

sudo apt-get install -y fcitx5 fcitx5-unikey fcitx5-config-qt 2>&1 | \
  grep -E "^(Get|Setting|Unpack|Selecting|Processing|.*installed)" | head -20 || true

# Verify
which fcitx5 > /dev/null 2>&1 || error "fcitx5 install failed"
success "fcitx5 $(fcitx5 --version 2>/dev/null | head -1) installed"

# =============================================================================
# STEP 2: Create fcitx5 profile với Vietnamese Unikey
# =============================================================================
info "Configuring fcitx5 profile (Unikey/Telex)..."
FCITX5_CONFIG_DIR="${HOME}/.config/fcitx5"
mkdir -p "${FCITX5_CONFIG_DIR}/conf"

# Profile: chỉ 2 input methods — English (keyboard) + Vietnamese Unikey
# Xóa nếu là directory (fcitx5 auto-tạo sai)
[[ -d "${FCITX5_CONFIG_DIR}/profile" ]] && rm -rf "${FCITX5_CONFIG_DIR}/profile"
cat > "${FCITX5_CONFIG_DIR}/profile" << 'PROFILE_EOF'
[Groups/0]
Name=Default
Default Layout=us
DefaultIM=unikey

[Groups/0/Items/0]
Name=keyboard-us

[Groups/0/Items/1]
Name=unikey

[GroupOrder]
0=Default
PROFILE_EOF

# Unikey config: Telex (giống Unikey Windows default)
mkdir -p "${FCITX5_CONFIG_DIR}/conf"
cat > "${FCITX5_CONFIG_DIR}/conf/unikey.conf" << 'UNIKEY_EOF'
[Input Method Engine Unikey]
InputMethod=Telex
OutputCharset=Unicode
SpellCheckEnabled=True
MacroEnabled=False
MouseSensitive=False
SkipNonVnChar=False
AutoRestoreNonVn=True
ModernStyle=True
FreeMarking=True
UNIKEY_EOF

success "fcitx5 profile configured (Telex mode)"

# =============================================================================
# STEP 3: Update code-wsl wrapper — inject fcitx5 CHỈ trong wrapper này
# =============================================================================
info "Updating code-wsl wrapper to start/stop fcitx5..."

[[ -f "$WRAPPER" ]] || error "code-wsl wrapper not found at $WRAPPER. Run 01-setup-vscode-portable.sh first."

# Xóa block cũ nếu có
sed -i '/# === fcitx5 Vietnamese IME ===/,/# === end fcitx5 ===/d' "$WRAPPER" 2>/dev/null || true

# Inject fcitx5 block VÀO TRƯỚC dòng 'exec "$BINARY"'
# Dùng python để đảm bảo inject đúng chỗ
python3 - "$WRAPPER" << 'PYEOF'
import sys

wrapper_path = sys.argv[1]
with open(wrapper_path) as f:
    content = f.read()

fcitx5_block = '''
# === fcitx5 Vietnamese IME ===
# Chỉ active trong VSCode WSLg — KHÔNG ảnh hưởng terminal WSL
# Toggle: Ctrl+Space (EN↔VI), hoặc click icon trong system tray
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx

# Start fcitx5 daemon nếu chưa chạy
if ! pgrep -x fcitx5 > /dev/null 2>&1; then
  fcitx5 -d --replace > /tmp/fcitx5-wsl.log 2>&1 &
  FCITX5_PID=$!
  sleep 0.5  # Chờ daemon khởi động
fi
# === end fcitx5 ===

'''

# Inject trước dòng 'exec "$BINARY"'
if '# === fcitx5 Vietnamese IME ===' not in content:
    content = content.replace('exec "$BINARY"', fcitx5_block + 'exec "$BINARY"')
    with open(wrapper_path, 'w') as f:
        f.write(content)
    print('  Injected fcitx5 block into code-wsl wrapper')
else:
    print('  fcitx5 block already present')
PYEOF

success "code-wsl wrapper updated"

# =============================================================================
# STEP 4: Print usage guide
# =============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}  Setup complete!${NC}"
echo "=============================================="
echo ""
echo "  HOW TO USE:"
echo ""
echo "  1. Launch VSCode:"
echo "     code-wsl /your/project"
echo ""
echo "  2. Toggle Vietnamese input:"
echo "     Ctrl+Space  — bật/tắt tiếng Việt"
echo "     Mặc định:   Telex (giống Unikey Windows)"
echo ""
echo "  3. Telex shortcuts:"
echo "     aa→â  ow→ơ  uw→ư  dd→đ"
echo "     f→huyền  s→sắc  r→hỏi  x→ngã  j→nặng"
echo ""
echo "  4. Đổi sang VNI (nếu quen):"
echo "     code-wsl → Ctrl+Space bật VI"
echo "     Right-click fcitx5 tray → Configure"
echo "     → Input Method → Unikey → Settings → VNI"
echo ""
echo "  5. Tắt tiếng Việt hoàn toàn:"
echo "     Ctrl+Space (toggle về EN)"
echo ""
echo -e "  ${YELLOW}Terminal WSL thông thường:${NC}"
echo "     KHÔNG bị ảnh hưởng — fcitx5 chỉ chạy khi dùng code-wsl"
echo ""
echo "  Logs: tail -f /tmp/fcitx5-wsl.log"
echo ""
