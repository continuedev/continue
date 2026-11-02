# 01 — Build Continue Extension

> Build VSIX từ source cho các platform: Linux/WSL, Windows, macOS.
> Output VSIX được dùng bởi `02-vscode-portable-windows` và `03-vscode-portable-linux-wsl`.

---

## Tổng quan flow build

```mermaid
flowchart TD
    subgraph "Prerequisites"
        N[Node.js 20.x\nconda node20 / nvm / brew]
        DEP[00-pre-install\nnative binaries + npm registry fallback]
    end

    subgraph "Build Pipeline"
        PKG[Packages build\nconfig-types → llm-info → fetch → openai-adapters → config-yaml → terminal-security]
        CORE[Core build\ntsc]
        GUI[GUI build\nvite]
        PRE[Prepackage\ncopy binaries, wasm, assets]
        VSCE[vsce package\nesbuild minify → VSIX]
    end

    N --> DEP
    DEP --> PKG
    PKG --> CORE
    CORE --> GUI
    GUI --> PRE
    PRE --> VSCE
    VSCE --> OUT[continue-target-version.vsix\n~70-80 MB]

    style DEP fill:#ffa726,color:#fff
    style VSCE fill:#66bb6a,color:#fff
    style OUT fill:#42a5f5,color:#fff
```

---

## ⚠️ Node.js version — QUAN TRỌNG

Project yêu cầu **Node.js 20.x** (`.node-version` = `20.20.1`).

| Platform      | Quản lý Node                           | Command                              |
| ------------- | -------------------------------------- | ------------------------------------ |
| **Linux/WSL** | conda env `node20`                     | `conda run -n node20 node --version` |
| **Windows**   | Node.js cài trực tiếp hoặc nvm-windows | `node --version`                     |
| **macOS**     | conda env `node20` hoặc nvm/brew       | `conda run -n node20 node --version` |

> **Linux/WSL:** LUÔN dùng `conda run -n node20` — không dùng system Node.
> **macOS:** Ưu tiên conda env `node20`, fallback system Node nếu đúng version.
> Setup conda: `conda create -n node20 -y nodejs=20`

---

## Pre-install (native dependencies)

Script `00-pre-install` đảm bảo native binaries đúng platform có mặt trước khi build.
**Chạy lần đầu hoặc sau khi `package.json` thay đổi.**

### Registry auto-fallback

```mermaid
flowchart LR
    A{Registry<br/>chỉ định?} -->|--registry arg| USE[Dùng arg]
    A -->|NPM_REGISTRY env| USE
    A -->|Không| B{Nexus<br/>localhost:7081?}
    B -->|Available| C[Dùng Nexus]
    B -->|Timeout 3s| D[Dùng npmjs.org]
    C -->|Fail giữa chừng| D
```

### Bash (Linux/WSL/macOS)

```bash
# Auto-detect registry (Nexus → fallback public)
bash deploy/01-build-extension/00-pre-install.sh --target linux-x64
bash deploy/01-build-extension/00-pre-install.sh --target darwin-arm64

# Force public registry (macOS khi không có Nexus)
bash deploy/01-build-extension/00-pre-install.sh --target darwin-arm64 --registry https://registry.npmjs.org/

# Check only (không install, chỉ verify)
bash deploy/01-build-extension/00-pre-install.sh --target darwin-arm64 --check-only
```

### PowerShell (Windows)

```powershell
# Auto-detect registry
.\deploy\01-build-extension\00-pre-install.ps1 -Target win32-x64

# Force public registry
.\deploy\01-build-extension\00-pre-install.ps1 -Target win32-x64 -Registry "https://registry.npmjs.org/"

# Check only
.\deploy\01-build-extension\00-pre-install.ps1 -Target win32-x64 -CheckOnly
```

### Khi nào cần chạy pre-install?

| Tình huống                                                          |         Cần?         |
| ------------------------------------------------------------------- | :------------------: |
| Lần đầu build trên máy                                              |          ✅          |
| Sau `git pull` có thay đổi package.json                             |          ✅          |
| `node_modules` install trên platform khác (vd: Windows → build WSL) |          ✅          |
| Đã build thành công, chỉ thay đổi code                              | ❌ dùng `--only-ext` |
| Sau `npm install` thủ công trên đúng platform                       |          ❌          |

### sqlite3 platform binding (linux target) — QUAN TRỌNG

`prepackage.js` copy `node_sqlite3.node` từ `core/node_modules/sqlite3/build/` vào vsix.
Đây là **native binding compile theo máy** (không phải platform package như ripgrep/lancedb):

- `core/node_modules` install trên Windows → binding là **PE32** → vsix linux cài vào
  VS Code WSL fail khi activate: `Error: ... node_sqlite3.node: invalid ELF header`
  (extension import `sqlite3` ngay lúc activate để mở `devdata.sqlite`)
- Cơ chế download prebuilt của upstream (`copySqlite`) bị **skip** vì build scripts đặt
  `SKIP_INSTALLS=true`

**Fix (tự động trong `00-pre-install.sh` — STEP 3b):**

1. Detect platform binding hiện có bằng `file` (ELF/PE32/Mach-O theo target)
2. Nếu sai platform → `node-gyp rebuild --release` trong `core/node_modules/sqlite3`
   trên đúng máy build (cần gcc/g++, có sẵn trên Ubuntu)
3. Node headers: dùng cache `~/.cache/node-gyp/<ver>/` → fallback download
   (trực tiếp → `proxy_windows` khi air-gap) → override bằng `NODE_HEADERS_TGZ=<path>`
4. Backup binding cũ thành `node_sqlite3.node.prev`; rollback nếu build fail
5. STEP 4 verify ELF/PE32/Mach-O đúng target trước khi cho phép build

**Hệ quả phụ cần biết:** rebuild để lại binding **Linux** trong `core/node_modules`.
Nếu sau đó build `win32-x64` trên Windows, chạy `00-pre-install.ps1` (hoặc
`npm rebuild sqlite3` trong `core/`) để trả binding Windows. Xem
[`../04-wsl-native-vscode/01-continue-extension-sqlite3-issue.md`](../04-wsl-native-vscode/01-continue-extension-sqlite3-issue.md)
để biết full trace của sự cố.

---

## Build theo platform

### macOS

```bash
# Full build — auto-detect arch (~43-50s)
bash deploy/01-build-extension/build-macos.sh

# Force target
bash deploy/01-build-extension/build-macos.sh --target darwin-arm64

# Skip packages (đã build trước đó) — ~42s
bash deploy/01-build-extension/build-macos.sh --skip-packages

# Chỉ rebuild extension — ~12-14s
bash deploy/01-build-extension/build-macos.sh --only-ext
```

### Linux / WSL

```bash
# Full build linux-x64
bash deploy/01-build-extension/build-linux.sh --target linux-x64

# Cross-compile win32-x64 (xem điều kiện bên dưới)
bash deploy/01-build-extension/build-linux.sh --target win32-x64

# Skip packages
bash deploy/01-build-extension/build-linux.sh --target linux-x64 --skip-packages

# Chỉ rebuild extension
bash deploy/01-build-extension/build-linux.sh --target linux-x64 --only-ext
```

### Windows (PowerShell)

```powershell
# Full build win32-x64
.\deploy\01-build-extension\build-windows.ps1

# Custom target
.\deploy\01-build-extension\build-windows.ps1 -Target win32-x64

# Skip packages
.\deploy\01-build-extension\build-windows.ps1 -SkipPackages

# Chỉ rebuild extension
.\deploy\01-build-extension\build-windows.ps1 -OnlyExt
```

---

## Build options

| Option         | Bash                    | PowerShell             | Ý nghĩa                            |
| -------------- | ----------------------- | ---------------------- | ---------------------------------- |
| Target         | `--target darwin-arm64` | `-Target darwin-arm64` | Platform đích                      |
| Skip packages  | `--skip-packages`       | `-SkipPackages`        | Bỏ qua build 6 packages            |
| Only extension | `--only-ext`            | `-OnlyExt`             | Chỉ prepackage + vsce (nhanh nhất) |

---

## Build time tham chiếu

| Mode            | macOS arm64 | Linux/WSL x64 | Windows x64 |
| --------------- | :---------: | :-----------: | :---------: |
| Full build      |    ~50s     |    ~60-90s    |   ~60-90s   |
| --skip-packages |    ~42s     |     ~50s      |    ~50s     |
| --only-ext      |   ~12-14s   |    ~15-20s    |   ~15-20s   |

> ⚠️ Bảng trên đo trên **filesystem local** (macOS arm64). Trên Windows 11 với repo ở
> `/mnt/e` (WSL 9P), v2.2.1 đo được: **full ~8m**, `-SkipPackages` ~5m,
> `-OnlyExt -SkipPackages` ~2m45s. 9P chậm hơn ext4 nhiều lần, và `conda run` thêm độ trễ
> khởi tạo cho mỗi lời gọi npm. Chi tiết: [Patch 12](../../.patches/12-windows-build-pipeline-fix.md).

---

## Kiến trúc build (chi tiết kỹ thuật)

### Tại sao không dùng `npm run prepackage` / `npm run package`?

Các build scripts gọi **trực tiếp** `node scripts/prepackage.js` và `npx @vscode/vsce`
thay vì dùng npm scripts. Lý do:

```mermaid
flowchart TD
    subgraph "❌ npm run package (BỊ HANG)"
        A1[npm run package] --> A2[npm lifecycle: auto-run prepackage]
        A2 --> A3[prepackage.js → npmInstall]
        A3 --> A4[fork child: npm install gui/]
        A3 --> A5[fork child: npm install vscode/]
        A4 --> A6[HANG — node_modules đã có]
        A5 --> A6
    end

    subgraph "✅ Direct calls (HOẠT ĐỘNG)"
        B1[SKIP_INSTALLS=true<br/>node scripts/prepackage.js] --> B2[Copy binaries + assets<br/>~0.4s]
        B2 --> B3[npx @vscode/vsce package]
        B3 --> B4[vscode:prepublish → esbuild]
        B4 --> B5[VSIX created<br/>~15s]
    end
```

| Vấn đề                            | Root cause                                                   | Fix                              |
| --------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `prepackage.js` hang              | `npmInstall()` fork child processes `npm install` → deadlock | `SKIP_INSTALLS=true`             |
| `npm run package` chạy prepackage | npm lifecycle convention `pre<script>`                       | Gọi `npx @vscode/vsce` trực tiếp |
| VSIX không tạo (exit 0)           | `package.js` không trigger `vscode:prepublish` (esbuild)     | `npx @vscode/vsce` trigger đúng  |

---

## Dependency chain (thứ tự build)

```mermaid
flowchart LR
    A[config-types] --> B[llm-info]
    A --> C[fetch]
    B --> D[openai-adapters]
    C --> D
    D --> E[config-yaml]
    D --> F[terminal-security]
    E --> G[core]
    F --> G
    G --> H[gui]
    G --> I[vscode ext]
    H --> I
    I --> J[VSIX]
```

- `--skip-packages`: Bỏ qua build 6 packages (khi chưa thay đổi package code)
- `--only-ext`: Chỉ chạy prepackage + vsce (khi chỉ sửa extension/GUI code)

---

## Output

```
extensions/vscode/build/
└── continue-{target}-{version}.vsix    ← ~70-80 MB
```

| Target         | Dùng cho                    | Build host                      |
| -------------- | --------------------------- | ------------------------------- |
| `linux-x64`    | VSCode Linux / WSL portable | Linux/WSL ✅                    |
| `win32-x64`    | VSCode Windows              | Windows ✅, WSL ⚠️ (cần rg.exe) |
| `darwin-arm64` | macOS Apple Silicon         | macOS arm64 ✅                  |
| `darwin-x64`   | macOS Intel                 | macOS x64 ✅                    |

---

## Cross-compile từ WSL: build win32-x64

**Kết luận: CÓ THỂ, với một điều kiện:**

`@vscode/ripgrep` trong `extensions/vscode/node_modules/` phải có `rg.exe`
(Windows binary) — chỉ đúng nếu `npm install` đã chạy trên Windows trước đó.

```bash
# Kiểm tra trước khi cross-compile
ls extensions/vscode/node_modules/@vscode/ripgrep/bin/
# Có rg.exe → OK
# Chỉ có rg (Linux) → KHÔNG được, build trên Windows
```

---

## Install VSIX

```bash
# macOS / Linux
code --install-extension extensions/vscode/build/continue-darwin-arm64-2.1.1.vsix --force

# Windows
code --install-extension extensions\vscode\build\continue-win32-x64-2.1.1.vsix --force

# VSCode portable Linux (code-wsl)
code-wsl --install-extension extensions/vscode/build/continue-linux-x64-2.1.1.vsix --force
```

---

## Verify patches sau build

```bash
# Patch 01 — NIM empty response retry
grep -c "retry\|without.*tools" packages/openai-adapters/src/apis/OpenAI.ts  # >= 1

# Patch 02 — JSON sanitize
grep -c "sanitize\|JSON.parse"   core/llm/openaiTypeConverters.ts             # >= 1

# Patch 04 — Vision proxy
test -f core/llm/visionProxy.ts && echo "OK"                                  # OK

# Patch 08 — TLS self-signed
grep -c "rejectUnauthorized"      packages/fetch/src/getAgentOptions.ts       # >= 1
```

---

## Files trong folder này

| File                 | Mô tả                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `00-pre-install.sh`  | Pre-install native deps — bash (Linux/WSL/macOS), registry fallback |
| `00-pre-install.ps1` | Pre-install native deps — PowerShell (Windows), registry fallback   |
| `sync-npmrc.ps1`     | Sinh `~/.npmrc` cho npm offline — Nexus là upstream proxy      |
| `build-linux.sh`     | Build script cho Linux/WSL (dùng conda node20)                      |
| `build-macos.sh`     | Build script cho macOS (conda hoặc system node, OneDrive detection) |
| `build-windows.ps1`  | Build script cho Windows (PowerShell)                               |
| `troubleshooting.md` | Xử lý lỗi thường gặp khi build                                      |
| `README.md`          | File này                                                            |

---

## Xem thêm

- [`troubleshooting.md`](./troubleshooting.md) — Lỗi thường gặp và cách xử lý
- [`../04-wsl-native-vscode/01-continue-extension-sqlite3-issue.md`](../04-wsl-native-vscode/01-continue-extension-sqlite3-issue.md) — Sự cố Continue trên VS Code native WSL (full trace)
- [`../../.patches/README.md`](../../.patches/README.md) — Custom patches documentation
- [`../README.md`](../README.md) — Deploy workflow tổng quát
