# Issues & Solutions — Build linux-x64 VSIX cho VSCode Native WSL

> **Ngày ghi nhận:** 2026-10-31
> **Môi trường:** WSL2 Ubuntu 24.04 / Windows 11 Home
> **Kết quả cuối:** ✅ `continue-linux-x64-2.2.2.vsix` (76MB) build thành công

---

## Tổng quan

Build Continue Extension cho VSCode native WSL (`code-wsl`) gặp một chuỗi issues liên tiếp.
Document này ghi lại theo đúng thứ tự phát hiện, root cause và cách fix.

---

## Issue 1 — sqlite3 binding sai platform (PE32 → ELF)

### Triệu chứng

Extension cài xong nhưng không activate được:

```
Error activating the Continue extension.
Source: Continue OnPrem — AI code agent
```

Log exthost:

```
Error: .../out/Release/node_sqlite3.node: invalid ELF header
```

### Root cause

`node_modules` được `npm install` trên **Windows** →
`core/node_modules/sqlite3/build/Release/node_sqlite3.node` là **PE32 (Windows DLL)**.

`prepackage.js` copy binding này vào VSIX. Khi activate trên Linux:
`dlopen()` nhận PE32 → fail ngay.

Lý do tưởng sẽ tự fix nhưng không: `prepackage.js` có hàm `copySqlite(target)` download
prebuilt ELF từ GitHub, nhưng build script dùng `SKIP_INSTALLS=true` → hàm đó bị skip hoàn toàn.

### Fix sai (đã thử)

**node-gyp rebuild** trong `core/node_modules/sqlite3` — fail vì:
- `core/node_modules` chưa tồn tại khi build fresh trên Linux filesystem
- Kể cả khi có, `npm install core` tự trigger node-gyp build sqlite3 và fail trên NTFS (`ENOTEMPTY`)

### Fix đúng (theo `01-continue-extension-sqlite3-issue.md`)

Download **prebuilt binary** từ GitHub releases (cách `copySqlite()` làm), **KHÔNG dùng node-gyp**:

```bash
SQLITE_URL="https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-linux-x64.tar.gz"
curl -sL -o /tmp/sqlite3-linux-x64.tar.gz "$SQLITE_URL"
# Extract vào core/node_modules/sqlite3 (xóa build/ cũ trước)
rm -rf core/node_modules/sqlite3/build
tar -xzf /tmp/sqlite3-linux-x64.tar.gz -C core/node_modules/sqlite3
```

`sqlite3` dùng **N-API (napi_versions: 3,6)** → ABI-stable across Node versions.
Build bằng node20 (ABI 115) tương thích Electron của VS Code 1.144.

**Script đã fix:** `deploy/01-build-extension/00-pre-install.sh` — STEP 3b.

---

## Issue 2 — NTFS cross-filesystem ENOTEMPTY

### Triệu chứng

Khi chạy `npm install` trong `/mnt/e/...` (Windows NTFS qua 9P):

```
npm error ENOTEMPTY: directory not empty,
rename '.../node_modules/entities' -> '.../node_modules/.entities-dN1hDFsZ'
```

### Root cause

npm dùng rename atomic để install/update packages. NTFS qua WSL 9P mount không
hỗ trợ atomic rename đáng tin cậy → race condition khi nhiều packages rename đồng thời.

### Fix

**Build trên Linux filesystem** (`/home/app/`) thay vì trực tiếp từ `/mnt/e/`:

```bash
# Sync source (không sync node_modules)
rsync -a --exclude='**/node_modules/' \
  /mnt/e/08-Sources/1.AI/continue/ \
  /home/app/continue-build/

# Build trên Linux fs
cd /home/app/continue-build
bash deploy/01-build-extension/build-linux.sh --target linux-x64

# Copy VSIX về repo gốc
cp extensions/vscode/build/continue-linux-x64-*.vsix \
  /mnt/e/08-Sources/1.AI/continue/extensions/vscode/build/
```

**Lý do:** Linux ext4 filesystem không có vấn đề atomic rename.
Build nhanh hơn đáng kể (~5 phút so với 15+ phút trên NTFS).

---

## Issue 3 — extensions/vscode/node_modules bị corrupt

### Triệu chứng

```
Error: Cannot find module 'rimraf'
Require stack:
- .../extensions/vscode/scripts/prepackage.js
```

`rimraf` folder có `dist/` và `node_modules/` nhưng **thiếu `package.json`** → partial install.

### Root cause

`core npm install` hoist một số packages lên `extensions/vscode/node_modules` nhưng không
đầy đủ (thiếu `package.json`). Xảy ra khi npm install bị interrupt hoặc conflict version.

### Fix

1. Thêm sanity check trong `_ext_nm_is_valid()`:

```bash
# Kiểm tra packages cốt lõi có package.json không
for _pkg in rimraf ncp @vscode/vsce; do
  if [[ -d "$_pkgdir" && ! -f "${_pkgdir}/package.json" ]]; then
    return 1  # trigger fresh install
  fi
done
```

2. Clean và reinstall:

```bash
rm -rf extensions/vscode/node_modules
# Chạy lại build-linux.sh — pre-install tự npm install fresh
```

---

## Issue 4 — `yaml` package missing khi esbuild bundle

### Triệu chứng

```
✘ [ERROR] Could not resolve "yaml"
    src/commands.ts:20:22:
      20 │ import * as YAML from "yaml";
```

### Root cause

`extensions/vscode/src/commands.ts` import `yaml` nhưng package này **không có trong
`extensions/vscode/package.json`**. Nó là transitive dep của `core` và `packages/config-yaml`.

Khi `npm install` trong `extensions/vscode`, npm không pull transitive deps của workspace khác
→ `yaml` không có trong `extensions/vscode/node_modules`.

### Fix

Install `yaml` sau bước `npm install extensions/vscode` (không save vào package.json):

```bash
cd extensions/vscode
npm install yaml --no-save --no-package-lock
```

**Script đã fix:** `00-pre-install.sh` — thêm check `yaml` ngay sau STEP 1.

---

## Issue 5 — core npm install tự compile sqlite3 và fail

### Triệu chứng

Khi `core npm install` (fresh Linux build):

```
npm error gyp ERR! node-gyp -v v8.4.1
npm error gyp ERR! not ok
```

### Root cause

`core/package.json` có dependency `sqlite3` → npm install tự chạy `node-gyp rebuild`
→ cần `python`, `gcc`, node headers. Trên NTFS hoặc air-gap environment → fail.

### Fix

Dùng `--ignore-scripts` khi install core lần đầu, sau đó download prebuilt sqlite3 riêng:

```bash
cd core
npm install --ignore-scripts   # bỏ qua gyp build
# sqlite3 prebuilt được download riêng ở STEP 3b của pre-install.sh
```

---

## Issue 6 — VSCode `--install-extension` CLI bị stuck (WSLg)

### Triệu chứng

Khi chạy `code-wsl --install-extension continue-linux-x64.vsix`:
- Process không exit, log `AgentHostProcessManager`, GPU errors...
- Extension không được cài vào `data/extensions/`

### Root cause

VSCode portable với `--extensions-dir` + `--user-data-dir` trên WSLg vẫn khởi động
**full GUI process** khi nhận `--install-extension`. Không có `--headless` true CLI mode.

### Fix

Extract VSIX thủ công (VSIX = zip file), update `extensions.json`:

```python
import zipfile, os, json

with zipfile.ZipFile("continue-linux-x64.vsix") as z:
    for member in z.namelist():
        if member.startswith("extension/"):
            dest = os.path.join(target_dir, member[len("extension/"):])
            # extract...
```

**Script đã fix:** `deploy/03-vscode-portable-linux-wsl/02-install-continue.sh`

---

## Issue 7 — DNS / WireGuard trong WSL

### Bối cảnh

- Windows 11 Home chạy **WireGuard client** với DNS trỏ tới internal self-DNS server
- Custom domain `security-ai-h200.tpb.vn` (resolve tới `10.8.0.1` via WireGuard)
- Continue extension cần resolve domain này để kết nối LLM server

### Vấn đề

WSL2 mặc định **auto-generate `/etc/resolv.conf`** trỏ tới nameserver `10.255.255.254`
(Windows DNS relay). Khi WireGuard active trên Windows, DNS thay đổi nhưng WSL không
nhận được cập nhật ngay lập tức → domain `security-ai-h200.tpb.vn` không resolve được từ WSL.

### Giải pháp đã thử

**Thử 1: `generateResolvConf = false` trong `/etc/wsl.conf`**

```ini
[network]
generateResolvConf = false
```

→ Tự quản lý `/etc/resolv.conf` với DNS của WireGuard.

⚠️ **Vấn đề phát sinh:** Kiro IDE Remote WSL **không thể login** sau khi uncomment dòng này.
Nguyên nhân: Kiro dùng SSH/socket qua WSL networking — khi resolv.conf bị thay đổi thủ công
với DNS server không accessible trong một số trạng thái mạng → TCP timeout khi IDE cố resolve.

**Giải pháp hiện tại:** Comment lại dòng đó:

```ini
[network]
# generateResolvConf = false   ← comment lại để WSL tự manage
```

**Trạng thái:** `/etc/resolv.conf` hiện dùng `nameserver 10.255.255.254` (WSL auto).

### Cách đang dùng để resolve domain internal

Thêm trực tiếp vào `/etc/hosts` trong WSL:

```bash
echo "10.8.0.1 security-ai-h200.tpb.vn" | sudo tee -a /etc/hosts
```

→ Continue extension (chạy trong WSL context) resolve domain qua `/etc/hosts` trước DNS
→ kết nối được LLM server qua WireGuard tunnel.

### Lưu ý khi WireGuard reconnect

`/etc/hosts` entry là static — không cần cập nhật khi WireGuard reconnect (IP WireGuard
interface `10.8.0.1` không đổi). Chỉ cần đảm bảo WireGuard tunnel active trên Windows.

### Trade-off

| Approach | Ưu điểm | Nhược điểm |
|---|---|---|
| `generateResolvConf=false` + custom DNS | DNS đúng hoàn toàn | Kiro IDE Remote WSL fail login |
| `/etc/hosts` static entry | Đơn giản, không ảnh hưởng tools khác | Chỉ fix domain cụ thể, không phải toàn bộ DNS |
| WireGuard DNS trong WSL (resolvectl) | Đúng nhất về mặt network | Cần systemd-resolved, phức tạp hơn |

**Khuyến nghị hiện tại:** Dùng `/etc/hosts` cho các domain cần thiết — đơn giản và ổn định.

---

## Issue 8 — Gõ tiếng Việt trong VSCode WSLg

### Triệu chứng

VSCode native WSL chạy qua WSLg (WSLg = Linux GUI qua XWayland trên Windows):
- Unikey (Windows) không hook được vào WSLg X11 apps
- Không gõ được tiếng Việt trong VSCode

### Fix

Cài `fcitx5` + `fcitx5-unikey` trong WSL, inject env vars **CHỈ** vào wrapper `code-wsl`:

```bash
# Cài (qua Nexus hoặc apt trực tiếp)
sudo apt install -y fcitx5 fcitx5-unikey

# Env vars được inject trong ~/.local/bin/code-wsl (KHÔNG trong ~/.bashrc)
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx

# Start fcitx5 daemon
export WAYLAND_DISPLAY=""           # ← BẮT BUỘC cho WSLg
fcitx5 -d --replace --disable=wayland
```

**Lưu ý quan trọng:** Phải dùng `--disable=wayland` khi start fcitx5 trong WSLg.
Không có flag này → lỗi `zwp_input_method_v1: permission to bind input_method denied`.

Terminal WSL thông thường **không bị ảnh hưởng** — env vars chỉ có trong `code-wsl` wrapper.

**Script setup:** `deploy/03-vscode-portable-linux-wsl/04-setup-fcitx5-vietnamese.sh`

---

## Quick Reference — Build Pipeline

```bash
# === CHUẨN BỊ (1 lần) ===
# Sync source về Linux fs (không sync node_modules)
rsync -a --exclude='**/node_modules/' \
  /mnt/e/08-Sources/1.AI/continue/ \
  /home/app/continue-build/

# === BUILD ===
cd /home/app/continue-build
bash deploy/01-build-extension/build-linux.sh --target linux-x64

# Output: extensions/vscode/build/continue-linux-x64-X.X.X.vsix

# === COPY KẾT QUẢ VỀ REPO ===
cp extensions/vscode/build/continue-linux-x64-*.vsix \
  /mnt/e/08-Sources/1.AI/continue/extensions/vscode/build/

# === INSTALL VÀO VSCODE WSL ===
code --install-extension /path/to/continue-linux-x64-*.vsix --force
```

### Rebuild nhanh (khi chỉ thay đổi source code, không thay đổi packages)

```bash
cd /home/app/continue-build
# Sync source files mới
rsync -a --exclude='**/node_modules/' \
  /mnt/e/08-Sources/1.AI/continue/ .
# Build chỉ extension (skip packages build)
bash deploy/01-build-extension/build-linux.sh --target linux-x64 --only-ext
```

---

## Files liên quan

| File | Nội dung |
|------|----------|
| `deploy/01-build-extension/build-linux.sh` | Main build script |
| `deploy/01-build-extension/00-pre-install.sh` | Fix platform binaries (ripgrep, lancedb, sqlite3, esbuild, yaml) |
| `deploy/04-wsl-native-vscode/01-continue-extension-sqlite3-issue.md` | Deep dive sqlite3 root cause + hotfix history |
| `deploy/03-vscode-portable-linux-wsl/04-setup-fcitx5-vietnamese.sh` | Setup tiếng Việt |
| `deploy/03-vscode-portable-linux-wsl/issues/fcitx5-vietnamese-wslg-guide.md` | Fcitx5 guide đầy đủ |
