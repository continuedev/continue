# Deploy — Continue Extension On-Prem

> Feature-based structure: mỗi folder là một squad tự chứa đủ scripts + docs.

---

## Structure

```
deploy/
├── 01-build-extension/           Build VSIX từ source (Linux/WSL, Windows, macOS)
│   ├── 00-pre-install.sh         Pre-install native deps (bash, registry fallback)
│   ├── 00-pre-install.ps1        Pre-install native deps (PowerShell, registry fallback)
│   ├── sync-npmrc.ps1            Sinh ~/.npmrc cho npm offline (xem Patch 12)
│   ├── build-linux.sh            Build trên Linux/WSL (conda node20)
│   ├── build-macos.sh            Build trên macOS (conda hoặc system node)
│   ├── build-windows.ps1         Build trên Windows (PowerShell)
│   ├── README.md                 Hướng dẫn chi tiết
│   └── troubleshooting.md        Xử lý lỗi thường gặp
├── 02-vscode-portable-windows/   VSCode portable air-gap cho Windows
└── 03-vscode-portable-linux-wsl/ VSCode portable air-gap cho Linux/WSL (WSLg)
```

---

## Workflow tổng quát

```mermaid
flowchart TD
    subgraph "01-build-extension"
        PRE[00-pre-install\nnative deps + registry fallback]
        BUILD[build script\npackages → core → gui → VSIX]
        PRE --> BUILD
    end

    BUILD --> W[02-vscode-portable-windows\nWindows air-gap deploy]
    BUILD --> L[03-vscode-portable-linux-wsl\nWSL deploy - WSLg]
    W --> WR[VSCode Windows\nwith Continue]
    L --> LR[VSCode Linux WSL\ncode-wsl command]
```

---

## Build pipeline (tất cả platforms)

```mermaid
flowchart LR
    subgraph "Packages (~5s)"
        P1[config-types] --> P2[llm-info]
        P1 --> P3[fetch]
        P2 --> P4[openai-adapters]
        P3 --> P4
        P4 --> P5[config-yaml]
        P4 --> P6[terminal-security]
    end

    subgraph "Core + GUI (~15s)"
        P5 --> CORE[core]
        P6 --> CORE
        CORE --> GUI[gui - vite build]
    end

    subgraph "Extension (~15s)"
        GUI --> PRE[prepackage\ncopy binaries + assets]
        PRE --> VSCE[vsce package\nesbuild + VSIX]
    end

    VSCE --> OUT[continue-target-2.1.1.vsix\n~70-80 MB]
```

---

## Quickstart theo platform

### macOS (Apple Silicon / Intel)

```bash
# Pre-install (lần đầu hoặc sau git pull thay đổi deps)
bash deploy/01-build-extension/00-pre-install.sh --target darwin-arm64

# Full build (~43s)
bash deploy/01-build-extension/build-macos.sh

# Quick rebuild khi chỉ sửa extension/GUI code (~12s)
bash deploy/01-build-extension/build-macos.sh --only-ext

# Output: extensions/vscode/build/continue-darwin-arm64-2.1.1.vsix
```

### Linux / WSL

```bash
# Pre-install (fix platform binaries, auto-detect Nexus/public registry)
bash deploy/01-build-extension/00-pre-install.sh --target linux-x64

# Full build
bash deploy/01-build-extension/build-linux.sh --target linux-x64

# Quick rebuild
bash deploy/01-build-extension/build-linux.sh --target linux-x64 --only-ext

# Cross-compile win32-x64 (cần rg.exe từ Windows npm install trước đó)
bash deploy/01-build-extension/build-linux.sh --target win32-x64
```

### Windows (PowerShell)

```powershell
# Sinh ~/.npmrc truoc (npm phai di THANG toi Nexus, khong qua corporate proxy)
.\deploy\01-build-extension\sync-npmrc.ps1

# Pre-install (auto-detect Nexus/public registry)
.\deploy\01-build-extension\00-pre-install.ps1

# Full build
.\deploy\01-build-extension\build-windows.ps1

# Quick rebuild
.\deploy\01-build-extension\build-windows.ps1 -OnlyExt

# Build nen / redirect log (khong hoi install)
.\deploy\01-build-extension\build-windows.ps1 -NoInstall
```

---

## npm Registry — Auto Fallback

Build scripts và pre-install tự động detect npm registry:

```mermaid
flowchart TD
    A{--registry arg<br/>hoặc NPM_REGISTRY env?} -->|Có| B[Dùng registry chỉ định]
    A -->|Không| C{Nexus localhost:7081<br/>accessible?}
    C -->|Có| D[Dùng Nexus internal]
    C -->|Không - timeout 3s| E[Dùng public npmjs.org]
    D -->|Install fail| E
```

| Env                  | Nexus | Registry sử dụng                              |
| -------------------- | :---: | --------------------------------------------- |
| Linux/WSL (có Nexus) |  ✅   | `http://localhost:7081/repository/npm-group/` |
| macOS local dev      |  ❌   | `https://registry.npmjs.org/` (auto fallback) |
| Windows (có Nexus)   |  ✅   | `http://localhost:7081/repository/npm-group/` |
| CI/CD                |   —   | Override qua `--registry` hoặc env var        |

---

## Setup VSCode portable Windows (air-gap)

```powershell
cd deploy\02-vscode-portable-windows
.\download-vscode.ps1      # 1 lần, máy có internet
.\setup-portable.ps1
.\install-continue.ps1
.\verify.ps1
```

## Setup VSCode portable Linux/WSL (WSLg)

```bash
bash deploy/03-vscode-portable-linux-wsl/01-setup-vscode-portable.sh
bash deploy/01-build-extension/build-linux.sh --target linux-x64
bash deploy/03-vscode-portable-linux-wsl/02-install-continue.sh
bash deploy/03-vscode-portable-linux-wsl/03-verify.sh
source ~/.bashrc && code-wsl .
```

---

## Build time tham chiếu

| Platform      | Full build | --skip-packages | --only-ext |
| ------------- | :--------: | :-------------: |  :------:  |
| macOS arm64   |    ~50s    |      ~42s       |  ~12-14s   |
| Linux/WSL x64 |  ~60-90s   |      ~50s       |  ~15-20s   |
| Windows x64   |  ~60-90s   |      ~50s       |  ~15-20s   |

> ⚠️ **Các con số trên đo trên filesystem local (macOS arm64).**
> Đo thực tế trên Windows 11 với repo nằm ở `/mnt/e` (WSL 9P filesystem),
> commit `e2b3dff4b` / v2.2.1:
>
> | Mode | Thời gian |
> | ---- | :-------: |
> | Full build | **~8m** |
> | `-SkipPackages` | **~5m** |
> | `-OnlyExt -SkipPackages` | **~2m45s** |
>
> Hai nguyên nhân chậm: 9P filesystem chậm hơn ext4 nhiều lần, và `conda run` cộng
> thêm độ trễ khởi tạo môi trường cho **mỗi** lời gọi npm.
> VSIX Windows 2.2.1 cũng nặng hơn mức "~70-80 MB" ở trên: **106 MB / 398 files**.

---

## VSCode version

| Property         | Value                                    |
| ---------------- | ---------------------------------------- |
| Version          | `1.132.0`                                |
| Commit           | `df53daabb1`                             |
| Date             | `2026-08-04`                             |
| Custom extension | `2.2.1` (branch `develop`)               |

---

## Notes

- Binaries (`*.tar.gz`, `*.zip`, `*.vsix`) được gitignore — không commit lên repo
- VSIX build output tại: `extensions/vscode/build/continue-{target}-{version}.vsix`
- Patches documentation: xem `.patches/README.md`
- Troubleshooting: xem `deploy/01-build-extension/troubleshooting.md`
