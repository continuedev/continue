# 03 — VSCode Portable Linux/WSL (Air-gap, WSLg)

> Setup VSCode Linux portable trong WSL với lệnh `code-wsl`.
> Giải quyết vấn đề **tool call terminal không hoạt động** khi dùng VSCode Windows + Remote WSL.

---

## Tại sao cần setup này?

**Vấn đề với VSCode Windows + Remote WSL:**
- Continue extension chạy ở Windows extension host → tool call terminal spawn process trong Windows context
- Working directory và shell là WSL → không nhất quán → tool call fail

**Giải pháp B2 — VSCode Linux native trong WSL:**
- VSCode và Continue extension chạy 100% trong Linux context
- Tool call terminal = WSL bash terminal → hoạt động hoàn toàn
- GUI hiển thị qua **WSLg** (Windows 11 built-in X server)

---

## Cơ chế Portable Mode và Update

```
~/.apps/vscode-linux/
├── code                    ← Linux binary
├── data/                   ← TẠO THỦ CÔNG → kích hoạt portable mode
│   ├── user-data/          ← settings riêng (KHÔNG dùng chung với VSCode Windows)
│   ├── extensions/         ← Continue linux-x64 cài vào đây
│   └── logs/
└── resources/
```

**Config `.continue/` riêng:** `~/.continue-wsl/` — tách biệt với Windows để có thể
cấu hình riêng (ví dụ: shell path, terminal type khác nhau).

**Update trong air-gap:**
1. Download tarball mới vào folder này
2. Chạy lại `01-setup-vscode-portable.sh --force`
3. Portable `data/` được giữ nguyên (settings, extensions không mất)
4. Rebuild VSIX linux-x64 nếu có code changes → install lại

---

## Yêu cầu

| Requirement | Kiểm tra |
|---|---|
| Windows 11 với WSLg | `ls /mnt/wslg` — phải tồn tại |
| DISPLAY set | `echo $DISPLAY` — phải là `:0` |
| Miniconda node20 | `conda run -n node20 node --version` |
| ~500MB free space | `df -h ~` |

---

## Quickstart

```bash
cd /mnt/e/08-Sources/1.AI/continue

# Bước 1: Setup VSCode portable
bash deploy/03-vscode-portable-linux-wsl/01-setup-vscode-portable.sh

# Bước 2: Build linux-x64 VSIX
bash deploy/01-build-extension/build-linux.sh --target linux-x64

# Bước 3: Install Continue extension
bash deploy/03-vscode-portable-linux-wsl/02-install-continue.sh

# Bước 4: Verify
bash deploy/03-vscode-portable-linux-wsl/03-verify.sh

# Bước 5: Reload shell và mở
source ~/.bashrc
code-wsl /mnt/e/08-Sources/1.AI/continue
```

---

## Lệnh `code-wsl` vs `code`

| Lệnh | Mở cái gì | Context |
|------|-----------|---------|
| `code <folder>` | VSCode Windows (Remote WSL mode) | Windows + WSL |
| `code-wsl <folder>` | VSCode Linux portable (native WSL) | 100% Linux/WSL |

---

## Files

| File | Mô tả |
|------|-------|
| `01-setup-vscode-portable.sh` | Download + giải nén + setup `~/.apps/vscode-linux/` + tạo `code-wsl` |
| `02-install-continue.sh` | Install Continue VSIX linux-x64 + setup `~/.continue-wsl/` |
| `03-verify.sh` | Kiểm tra WSLg, extension, tool call terminal |
| `vscode-linux-x64-1.132.0.tar.gz` | Binary tarball (gitignored — 335MB) |
| `continue-linux-x64-*.vsix` | VSIX output từ `01-build-extension/` (gitignored) |

---

## VSCode version

| Property | Value |
|----------|-------|
| Version | `1.132.0` |
| Commit | `df53daabb1` |
| Date | `2026-08-04` |
| Tarball URL | `https://code.visualstudio.com/sha/download?build=stable&os=linux-x64` |
