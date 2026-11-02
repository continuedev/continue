# Patch 12 — Windows Build Pipeline Fix (npm/Nexus 403, stderr, PS 5.1 encoding)

> **Ngày:** 2026-10-12
> **Custom version:** `2.2.1`
> **Commit:** `e2b3dff4b` — `feature - own titleSession Name`
> **Status:** Active (local only — internal tooling, không upstream)
> **PR:** —

---

## Bối cảnh

Extension host của Continue chạy **native Windows** (Continue không phải Remote extension),
nên VSIX phải build với target `win32-x64` từ PowerShell. `build-windows.ps1` fail liên tiếp
ở 3 tầng khác nhau. Ba lỗi này **độc lập** nhưng che khuất lẫn nhau — sửa lần lượt mới thấy hết.

---

## Lỗi 1 — PowerShell 5.1 không đọc được file `.ps1` UTF-8 không BOM

### Triệu chứng

```
The string is missing the terminator: '.
Missing closing ')' in expression.
At ...\build-windows.ps1:264 char:86
+ ... e (Ctrl+Shift+P â†' Developer: Reload Window)"
```

### Root cause

File `.ps1` chứa ký tự Unicode (`—` U+2014, `→` U+2192) nhưng **không có UTF-8 BOM**.
Windows PowerShell 5.1 suy đoán encoding theo ANSI/CP1252 khi không có BOM →
`→` (`E2 86 92`) đọc thành `â†'` → sinh ký tự quote "mở" không đóng → parser hỏng.

PowerShell 7 mặc định UTF-8 nên **không** lỗi này — vì vậy build qua `pwsh.exe` trông vẫn ổn,
gây nhầm là lỗi do shell.

### Fix

Thêm UTF-8 BOM (`EF BB BF`) vào **cả 6** file `.ps1` trong `deploy/`:

```
01-build-extension/00-pre-install.ps1
01-build-extension/build-windows.ps1
02-vscode-portable-windows/download-vscode.ps1
02-vscode-portable-windows/install-continue.ps1
02-vscode-portable-windows/setup-portable.ps1
02-vscode-portable-windows/verify.ps1
```

Nội dung không đổi — chỉ thêm 3 byte đầu file.

### Prevent

```bash
# Kiểm tra BOM
head -c 3 file.ps1 | xxd -p     # phải ra: efbbbf

# Verify parse trên cả PS 5.1 và PS 7
powershell.exe -NoProfile -Command '
$e=$null
Get-ChildItem -Recurse -Filter *.ps1 | ForEach-Object {
  [System.Management.Automation.Language.Parser]::ParseFile($_.FullName,[ref]$null,[ref]$e) > $null
  if($e.Count){ "FAIL $($_.Name): $($e[0].Message)" } else { "OK   $($_.Name)" }
}'
```

> Nếu về sau muốn bỏ BOM: thay mọi `—`/`→` bằng ASCII (`-`, `->`). Nhưng BOM là fix bền hơn.

---

## Lỗi 2 — npm 403 vì đẩy request tới Nexus qua corporate proxy

### Triệu chứng

```
npm error 403 Forbidden - GET http://localhost:7081/repository/npm-group/npm/-/npm-11.12.0.tgz
```

Đánh lạc hướng: thông báo gợi ý "security policy / forbidden package version", và tarball
`npm-11.12.0.tgz` (npm tự tải chính nó) trông như nguyên nhân. Thực tế `curl` vào đúng URL đó
luôn trả **200**.

### Root cause

`~/.npmrc` đặt proxy **toàn cục** mà không có `noproxy`:

```ini
proxy=http://nor%5C...:****@ho-proxy02.tpb.vn:8080
https-proxy=http://nor%5C...:****@ho-proxy02.tpb.vn:8080
```

npm đẩy **mọi** request qua corporate proxy — kể cả request tới `localhost:7081`.
Corporate proxy chặn Nexus nội bộ. Bằng chứng với cùng credential:

| Đường đi | Kết quả |
|----------|---------|
| `curl -x <corporate proxy> http://localhost:7081/...` | **403** (0.05s) |
| `curl --noproxy '*' http://localhost:7081/...` | **200** (0.12s) |

npm còn retry 3 lần với timeout dài → log hiện `113830ms attempt #3`, càng giống lỗi mạng.

### Kiến trúc đúng

```
npm --(localhost, KHONG proxy)--> Nexus npm-group --> npmjs --> registry.npmjs.org
```

Nexus **đã là proxy repository** — nó tự lo việc ra internet. npm không cần proxy.
Đã kiểm chứng Nexus ra internet thật (không phải cache tĩnh):

```
npm-group members = ["npmjs"]
npmjs remoteUrl   = https://registry.npmjs.org
goi package moi   -> 200 (0.76s lan dau fetch upstream, 0.02s lan sau tu cache)
```

### Fix — `deploy/01-build-extension/sync-npmrc.ps1` (mới)

Sinh `~/.npmrc` không proxy, có `noproxy`, tắt audit. Có `-DryRun`, tự backup file cũ.

```powershell
.\deploy\01-build-extension\sync-npmrc.ps1 -DryRun   # xem truoc
.\deploy\01-build-extension\sync-npmrc.ps1           # ghi that
```

Kết quả:

```powershell
npm config get proxy    # null
npm config get noproxy  # localhost,127.0.0.1,::1,*.tpb.vn,...
npm config get audit    # false
```

> Proxy Windows cho trình duyệt và MCP servers **không bị ảnh hưởng** — file này chỉ tác động npm.

---

## Lỗi 3 — npm audit API không được Nexus hỗ trợ

### Triệu chứng (hiện ra sau khi sửa lỗi 2)

```
http fetch POST 403 .../npm-group/-/npm/v1/security/advisories/bulk
verbose audit error HttpErrorGeneral: 403 Forbidden - POST .../security/audits/quick
```

### Root cause

Nexus **không implement** npm audit API. `POST /-/npm/v1/security/advisories/bulk` trả
403 (400 với body trống). npm chạy audit tự động mỗi `npm install` → fail cả build.

### Fix

`audit=false` + `fund=false` trong `.npmrc` (do `sync-npmrc.ps1` sinh ra).
Tạm thời có thể dùng env `npm_config_audit=false`, nhưng env **không truyền** vào
`npm install` con trong `build-packages.js` một cách chắc chắn — viết vào `.npmrc` là bền.

---

## Lỗi 4 — `$ErrorActionPreference = "Stop"` biến stderr thành lỗi chết

### Triệu chứng

Build chết ở bước GUI, nhưng GUI build **thành công**:

```
✓ built in 59.52s
conda : Browserslist: browsers data (caniuse-lite) is 13 months old. Please run:
    + CategoryInfo          : NotSpecified: (Browserslist: b...ld. Please run::String) [], RemoteException
    + FullyQualifiedErrorId: NativeCommandError
```

### Root cause

Trong PowerShell, khi `$ErrorActionPreference = "Stop"`, phép gộp `2>&1` **không chỉ** gộp
stream — nó biến **mỗi dòng stderr của native command thành `ErrorRecord`**, và ErrorRecord
gặp `Stop` thì dừng script.

`vite`/Browserslist, `npm`, `conda` đều dùng stderr cho **warning hợp lệ**. Build exit 0 vẫn chết.

### Fix — `build-windows.ps1`

Hạ `ErrorActionPreference` xuống `Continue` quanh lời gọi, để stderr là data stream thuần;
thành bại quyết định bằng `$LASTEXITCODE`:

```powershell
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $out = Invoke-Expression "$CmdStr 2>&1"
    $out | Select-Object -Last $Tail | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit $LASTEXITCODE)" }
} finally {
    $ErrorActionPreference = $prevEap
    Pop-Location
}
```

Áp dụng cho 3 chỗ: `Invoke-Cmd`, `npm-install`, và block resolve Node ở Step 1
(`conda env list` cũng ghi stderr khi thành công).

---

## Lỗi 5 — `Read-Host` làm treo build phi tương tác

### Triệu chứng

Chạy build nền / redirect log / `tail -f` → script dừng ở `Auto-install now? (y/N)` và
**không có ai trả lời được**.

### Fix

Thêm switch `-NoInstall` + tự phát hiện stdin bị redirect:

```powershell
if ($NoInstall) {
    Write-Host "[INFO]  -NoInstall: bo qua buoc cai dat."
} elseif (-not [Console]::IsInputRedirected) {
    $answer = Read-Host " "          # chi hoi khi co terminal that
    ...
} else {
    Write-Host "[INFO]  stdin is redirected - khong hoi install."
}
```

Lệnh install luôn được in ra để chạy tay.

---

## Lỗi 6 — `conda` không có trong PATH khi chạy `-NoProfile`

`build-windows.ps1` gọi `conda env list` ngay Step 1. Continue chạy
`pwsh -NoProfile` → profile của user không được load → `conda` không trong PATH →
fail với `$ErrorActionPreference = "Stop"`.

Khi gọi script từ môi trường không có conda trong PATH:

```powershell
$env:Path = "C:\Users\thanhnn14\miniconda3;C:\Users\thanhnn14\miniconda3\Scripts;C:\Users\thanhnn14\miniconda3\condabin;" + $env:Path
```

Chạy trực tiếp từ terminal tương tác của bạn thì profile đã có sẵn — không cần dòng này.

---

## Quy trình build đã xác minh

```powershell
# 1. Lan dau / sau khi doi deps
.\deploy\01-build-extension\sync-npmrc.ps1
.\deploy\01-build-extension\00-pre-install.ps1 -Target win32-x64

# 2. Build
.\deploy\01-build-extension\build-windows.ps1                 # full
.\deploy\01-build-extension\build-windows.ps1 -SkipPackages   # bo build packages
.\deploy\01-build-extension\build-windows.ps1 -OnlyExt        # chi prepackage + vsce
.\deploy\01-build-extension\build-windows.ps1 -NoInstall      # CI / background

# 3. Cai vao VS Code installed
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" `
    --install-extension "E:\03-Sources\9.goku\continue\extensions\vscode\build\continue-win32-x64-2.2.1.vsix" --force
```

### Thời gian đo thực tế (Goku-P1G3, repo trên `/mnt/e`)

| Mode | Thời gian | Ghi chú |
|------|:---------:|---------|
| Full build | **7m59s** | packages 166s + core 68s + gui 54s + prepackage 18s + vsce |
| `-SkipPackages` | **5m00s** | bỏ build 6 packages |
| `-OnlyExt -SkipPackages` | **2m43s** | prepackage 75s + vsce |

> Lâu hơn nhiều so với bảng "build time tham chiếu" (~60-90s) trong
> `deploy/README.md`. Nguyên nhân: repo nằm trên `/mnt/e` (9P filesystem, chậm hơn
> ext4 nhiều lần) và `conda run` thêm độ trễ khởi tạo môi trường cho **mỗi** lời gọi npm.
> Bảng tham chiếu cũ được đo trên macOS arm64 / repo ở filesystem local.

### Output

```
extensions/vscode/build/continue-win32-x64-2.2.1.vsix   398 files, 106.1 MB
```

> 106 MB lớn hơn mức "~70-80 MB" ghi trong `deploy/README.md` — do `--sourcemap` không
> được bật nhưng VSIX gồm cả `out/node_modules` (lancedb, ripgrep, sqlite, onnxruntime).

---

## Lưu ý khi build từ WSL

`prepackage.js` dùng `autodetectPlatformAndArch()`. Chạy trong WSL → trả `linux` →
validate tìm `rg` (Linux) trong khi `npm install` trên Windows chỉ tạo `rg.exe` → fail:

```
File out/node_modules/@vscode/ripgrep/bin/rg does not exist
```

Cross-compile `win32-x64` từ WSL **chỉ** khả thi nếu build script truyền `--target win32-x64`
(explicit target làm `exe = ".exe"`). `build-linux.sh` có hỗ trợ flag này. Tuy nhiên cách
an toàn nhất cho VSIX Windows là build thẳng trên Windows như trên.

---

## Liên quan

- Patch 11 — config.yaml global settings & session title (cùng commit)
- [`deploy/01-build-extension/README.md`](../deploy/01-build-extension/README.md)
- [`deploy/01-build-extension/troubleshooting.md`](../deploy/01-build-extension/troubleshooting.md)
