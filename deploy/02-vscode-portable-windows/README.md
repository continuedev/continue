# 02 — VSCode Portable Windows (Air-gap)

> Setup VSCode portable trên Windows không cần internet.
> Dùng cho deployment đến máy developer trong môi trường air-gap.

---

## Cơ chế Portable Mode và Update

VSCode portable mode hoạt động bằng cách tạo folder `data/` bên cạnh binary:

```
VSCode-win32-x64/
├── Code.exe                ← binary
├── data/                   ← TẠO THỦ CÔNG → kích hoạt portable mode
│   ├── user-data/          ← settings, keybindings, themes
│   ├── extensions/         ← extensions cài vào đây
│   └── logs/
└── ...
```

**Update trong air-gap:** VSCode portable KHÔNG tự update được (không có internet).
Để update version mới:
1. Download tarball/zip mới vào folder này (từ máy có internet)
2. Giải nén vào thư mục mới (ví dụ `VSCode-win32-x64-1.133.0/`)
3. Copy folder `data/` từ version cũ sang version mới
4. Update shortcut/script trỏ vào version mới
5. Rebuild VSIX nếu có code changes → install lại

---

## Workflow

```
[Máy có internet]                    [Máy air-gap]
       │                                    │
  1. Download VSCode zip                    │
  2. Build Continue VSIX                   │
  3. Copy cả 2 vào USB/share  ──────────►  │
                                    4. Chạy setup-portable.ps1
                                    5. Chạy install-continue.ps1
                                    6. Verify
```

---

## Quickstart

```powershell
# Bước 1: Download VSCode (máy có internet)
.\download-vscode.ps1

# Bước 2: Build VSIX (hoặc copy từ 01-build-extension/)
# copy ..\01-build-extension\continue-win32-x64-2.1.1.vsix .

# Bước 3: Setup portable
.\setup-portable.ps1

# Bước 4: Install Continue extension
.\install-continue.ps1

# Bước 5: Verify
.\verify.ps1
```

---

## Files

| File | Mô tả |
|------|-------|
| `download-vscode.ps1` | Download VSCode zip từ internet (chạy 1 lần, máy có net) |
| `setup-portable.ps1` | Giải nén + tạo data/ folder + shortcut |
| `install-continue.ps1` | Install Continue VSIX vào portable VSCode |
| `verify.ps1` | Kiểm tra setup hoạt động đúng |
| `VSCode-win32-x64-*.zip` | Binary (gitignored — download 1 lần, share cho air-gap) |
| `continue-win32-x64-*.vsix` | VSIX từ `01-build-extension/` (gitignored) |

---

## VSCode version hiện tại

| Property | Value |
|----------|-------|
| Version | `1.132.0` |
| Commit | `df53daabb1` |
| Date | `2026-08-04` |
| Zip URL | `https://update.code.visualstudio.com/1.132.0/win32-x64-archive/stable` |
