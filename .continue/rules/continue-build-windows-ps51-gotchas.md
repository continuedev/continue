---
globs: '["deploy/01-build-extension/**"]'
description: Load khi build Continue VSIX trên Windows gặp lỗi parse PowerShell,
  GUI build fail do Browserslist warning, hoặc khi chạy build-windows.ps1
---

Khi build Continue VSIX trên Windows (PowerShell 5.1), nhớ 3 điểm sau trong deploy/01-build-extension/build-windows.ps1:
1. File .ps1 chứa Unicode (—, →) PHẢI có UTF-8 BOM, nếu không PS5.1 báo "string is missing the terminator". Fix: [System.IO.File]::WriteAllText($path, (Get-Content -Raw -Encoding UTF8 $path), (New-Object System.Text.UTF8Encoding($true))).
2. $ErrorActionPreference='Stop' khiến PS5.1 biến stderr WARNING (vd: Browserslist caniuse-lite is old) thành terminating NativeCommandError -> build fail nhầm ở bước GUI. Fix: trong Invoke-Cmd/npm-install, set $ErrorActionPreference='Continue' quanh Invoke-Expression, chỉ dựa vào $LASTEXITCODE để bắt lỗi thật.
3. KHÔNG pipe build qua Tee-Object (cùng lỗi NativeCommandError). Dùng: cmd /c "powershell.exe -File ... > build-log.txt 2>&1" rồi đọc log bằng Get-Content -Encoding UTF8.
Registry build LUÔN qua Nexus localhost:7081/npm-group (script auto-detect). npm cache local + Nexus contentMaxAge=-1 => build gần offline. Code thay đổi ở core/ hoặc extensions/vscode/src/ => phải full build, KHÔNG dùng -OnlyExt.