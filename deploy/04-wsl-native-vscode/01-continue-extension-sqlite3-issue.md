# Continue Extension trên VS Code Native WSL — Issue & Solution

> Ngày: 2026-10-30 · Trạng thái: ✅ **ĐÃ XỬ LÝ XONG** (hotfix) + build pipeline fix (xem `deploy/01-build-extension`)

---

## 1. Bối cảnh & Mục tiêu

### Nhu cầu

| # | Target | Lý do |
|---|--------|-------|
| 1 | Chạy **VS Code native WSL** (`code-wsl`) | Continue extension resolve DNS theo môi trường nó chạy. Custom domain `security-ai-h200.tpb.vn` (WireGuard `10.8.0.1`) chỉ có trong `/etc/hosts` của WSL. Windows native không có quyền sửa `hosts` (enterprise client) → model `apiBase: https://security-ai-h200.tpb.vn/flash-next/v1` không resolve được từ VS Code Windows |
| 2 | **Shared root config** giữa Windows và WSL | `~/.continue` (WSL) là symlink → `/mnt/c/Users/thanhnn14/.continue` (→ `.tiep-tuc`). Single source of truth: config models + history đồng bộ 2 môi trường |

### Các bước đã thực hiện

1. ✅ Cài VS Code native trong WSL (`/usr/share/code/code`), symlink `code-wsl` trỏ đúng Linux ELF binary
   - ⚠️ Bẫy từng gặp: `sudo ln -sf "$(which code)"` lấy `code` đầu tiên trong PATH là `/mnt/c/.../code` (Windows wrapper) → trỏ sai. Phải link thẳng `/usr/share/code/code`
2. ✅ Manual build `.vsix` từ source repo + cài vào VS Code WSL
3. ✅ Symlink `~/.continue` → Windows config folder

---

## 2. Triệu chứng

- Mở `code-wsl` → Continue extension **stuck**, notification:
  `Error activating the Continue extension. Source: Continue OnPrem — AI code agent`
- Extension host log (`~/.config/Code/logs/<ts>/window1/exthost/exthost.log`) cho thấy extension activate nhưng không lên được GUI

---

## 3. Trace & Root cause

### Loại trừ

- **Symlink `~/.continue` KHÔNG phải nguyên nhân** — verify bằng node:
  ```
  homedir: /home/app
  continue path: /home/app/.continue
  isSymlink: true → realpath: /mnt/c/Users/thanhnn14/.tiep-tuc  ✅
  ```
  `core/util/paths.ts` → `CONTINUE_GLOBAL_DIR = path.join(os.homedir(), ".continue")` resolve đúng.
- Extension bản này chạy **in-process** (`InProcessMessenger`, không spawn `continue-binary`) → không phải lỗi thiếu core binary platform.

### Nguyên nhân gốc: `node_sqlite3.node` sai platform

Extension build từ source repo trên **Windows** → native module đóng gói vào vsix là **Windows PE32**:

```
out/Release/node_sqlite3.node      → PE32+ executable (DLL), for MS Windows  ❌
out/build/Release/node_sqlite3.node → PE32+ (Windows)                         ❌
```

Khi activate trên Linux (WSL): `core/data/devdataSqlite.ts` → `import sqlite3 from "sqlite3"` →
`dlopen()` gặp PE32 → **`invalid ELF header`** → activation fail.

Test xác nhận trực tiếp:

```
$ node -e "require('.../out/Release/node_sqlite3.node')"
Error: .../node_sqlite3.node: invalid ELF header
```

### Tại sao build pipeline sinh ra binary sai?

`extensions/vscode/scripts/prepackage.js` copy sqlite3 binding từ:

```
core/node_modules/sqlite3/build/Release/node_sqlite3.node
```

Chuỗi lỗi (3 tầng):

| Tầng | Vấn đề |
|------|--------|
| 1 | `core/node_modules` được `npm install` trên **Windows** → sqlite3 build ra PE32 |
| 2 | Lẽ ra `copySqlite(target)` đã download prebuilt ELF từ GitHub releases để thay thế — nhưng build scripts đặt **`SKIP_INSTALLS=true`** → `copySqlite` bị **skip** (`prepackage.js`: `if (!skipInstalls) await copySqlite(target)`) |
| 3 | `00-pre-install.sh` chỉ fix `@vscode/ripgrep` + `@lancedb` — **không để ý tới sqlite3** |

Các native module khác đều ổn vì có platform-specific packages: `@lancedb/vectordb-linux-x64-gnu` (ELF ✅), `onnxruntime-node` copy nguyên `bin/napi-v3/linux/x64` (ELF ✅). Riêng sqlite3 là **binding compile theo máy install** → dễ漏 nhất.

---

## 4. Giải pháp hotfix (đã áp dụng — DONE)

Rebuild `node_sqlite3.node` trên Linux và thay vào extension đã cài:

```bash
# 1. Download node headers (air-gap: qua proxy_windows)
bash -ic 'proxy_windows >/dev/null 2>&1; curl -sL -o /tmp/node-headers.tar.gz \
  https://nodejs.org/download/release/v20.20.2/node-v20.20.2-headers.tar.gz'

# 2. Install vào node-gyp cache + tạo common.gypi / config.gypi
mkdir -p ~/.cache/node-gyp/20.20.2
tar -xzf /tmp/node-headers.tar.gz -C ~/.cache/node-gyp/20.20.2 --strip-components=1
# (kèm common.gypi + config.gypi — node-gyp 8.x yêu cầu)

# 3. npm install sqlite3 build-from-source, trỏ nodedir vào cache
cd /tmp/sqlite3-linux
npm install --build-from-source --nodedir=$HOME/.cache/node-gyp/20.20.2

# 4. Verify ELF + load test qua package wrapper (không require trực tiếp file .node)
file node_modules/sqlite3/build/Release/node_sqlite3.node   # → ELF ✅

# 5. Backup + thay vào extension đã cài
EXT=~/.vscode/extensions/continue.continue-2.2.2/out
cp $EXT/Release/node_sqlite3.node{,.win.bak}
cp $EXT/build/Release/node_sqlite3.node{,.win.bak}
cp node_modules/sqlite3/build/Release/node_sqlite3.node $EXT/Release/
cp node_modules/sqlite3/build/Release/node_sqlite3.node $EXT/build/Release/
```

### Lưu ý kỹ thuật khi test binding

- **KHÔNG** `require()` trực tiếp file `.node` để test API — binding raw thiếu `Database.prototype.run/get/all`
  (các method này được `sqlite3/lib/sqlite3.js` wrapper gán vào qua `normalizeMethod`).
  Test đúng: `require("sqlite3")` từ package folder.
- **ABI**: build bằng node20 (ABI 115) tương thích Electron của VS Code 1.144 (Node 24.22.1, ABI 137)
  vì sqlite3 5.1.7 build theo **N-API (napi_versions: 3,6)** — ABI-stable across Node/Electron versions.

---

## 5. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|----------|-----------|
| VS Code native WSL (`code-wsl` → `/usr/share/code/code`) | ✅ |
| Continue extension activate trên WSL | ✅ (sau hotfix sqlite3) |
| History + config đồng bộ Windows ↔ WSL qua symlink `~/.continue` | ✅ |
| `security-ai-h200.tpb.vn` resolve từ Continue (WSL `/etc/hosts` → `10.8.0.1` WireGuard) | ✅ |
| Model `Qwen3.8-Flash-Next Direct (Agent)` qua `https://security-ai-h200.tpb.vn/flash-next/v1` | ✅ |
| Backup bản Windows: `node_sqlite3.node.win.bak` trong extension folder | ✅ (rollback được) |

### Ghi chú vận hành

- Mỗi lần **cài lại vsix build từ Windows** → lỗi quay lại. Dùng build script Linux mới (mục 6) để hết hẳn.
- `devdata.sqlite` (telemetry, ghi liên tục) nằm trên 9P mount `/mnt/c` — SQLite locking qua 9P chậm hơn native fs; chấp nhận được, nếu về sau chậm có thể cân nhắc tách `dev_data` khỏi shared folder.

---

## 6. Fix triệt để trong build pipeline

Xem chi tiết + scripts: [`deploy/01-build-extension/README.md`](../deploy/01-build-extension/README.md) —
mục **"sqlite3 platform binding (linux target)"**.

Tóm tắt: `00-pre-install.sh` được bổ sung **STEP 3b** — build `node_sqlite3.node` bằng
`node-gyp` trên đúng máy build (hoặc dùng cache headers offline), đặt vào
`core/node_modules/sqlite3/build/Release/` **trước** khi `prepackage.js` copy.
Kèm verify ELF trong STEP 4. → `build-linux.sh --target linux-x64` sinh vsix đúng platform,
không cần hotfix thủ công nữa.
