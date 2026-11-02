# Troubleshooting — Build Extension

## Checklist đầu tiên

```bash
# Chạy check nhanh
bash deploy/01-build-extension/00-pre-install.sh --target linux-x64 --check-only

# Verify khác
conda run -n node20 node --version  # v20.x
git branch --show-current           # develop hoặc release/v2.1.x-onprem
```

---

## Lỗi quan trọng nhất — Platform binary mismatch

### Triệu chứng

```
Error: The following files were missing:
- node_modules/@vscode/ripgrep/bin/rg
- out/node_modules/@vscode/ripgrep/bin/rg
```

hoặc:

```
Could not find @vscode/ripgrep-linux-x64. Ensure optionalDependencies are installed
```

### Nguyên nhân

`node_modules` trong repo thường được install trên **Windows** → chỉ có `rg.exe`.
Build trên Linux/WSL cần `rg` (Linux ELF binary).

Tương tự với `@lancedb/vectordb`: cần `vectordb-linux-x64-gnu` thay vì `vectordb-win32-x64-msvc`.

### Fix

```bash
# Fix tự động tất cả platform dependencies
bash deploy/01-build-extension/00-pre-install.sh --target linux-x64
```

Script sẽ:

1. Install `@vscode/ripgrep-linux-x64` → tạo symlink vào `@vscode/ripgrep/bin/rg`
2. Install `@lancedb/vectordb-linux-x64-gnu`
3. Verify tất cả required files

---

## Các lỗi khác

### `prepackage.js` hangs trên macOS (hoặc bất kỳ platform)

**Triệu chứng:** `npm run prepackage` hoặc `npm run package` treo vô thời hạn.
Process ở trạng thái Sleep (S), CPU 0%.

**Nguyên nhân:** `npmInstall()` trong prepackage.js fork 2 child processes chạy
`npm install` trong gui/ và extensions/vscode/. Khi node_modules đã có đầy đủ,
npm vẫn chạy lifecycle scripts và lock files → deadlock.

Ngoài ra, `npm run package` tự động trigger `prepackage` (npm lifecycle convention
`pre<script>`) → chạy lại prepackage lần nữa.

**Fix:**

```bash
# Dùng SKIP_INSTALLS=true + gọi script trực tiếp
cd extensions/vscode
SKIP_INSTALLS=true node scripts/prepackage.js --target darwin-arm64
npx @vscode/vsce package --out ./build --no-dependencies --target darwin-arm64
```

Hoặc dùng `build-macos.sh` đã được fix sẵn:

```bash
bash deploy/01-build-extension/build-macos.sh --target darwin-arm64
```

### `conda: command not found`

```bash
source ~/miniconda3/etc/profile.d/conda.sh && conda init bash && source ~/.bashrc
```

### `EBADENGINE` warnings

Node v20.17.0 build vẫn thành công dù require >=20.20.1. Bỏ qua.

### `Cannot find module '@continuedev/config-types'`

Build sai thứ tự. Chạy lại không có `--skip-packages`.

### `gui build did not produce index.js`

```bash
conda run -n node20 bash -c "cd gui && npm install && npm run build"
```

### `npm install` timeout qua Nexus

```bash
conda run -n node20 npm config set fetch-timeout 120000
curl -s http://localhost:7081/service/rest/v1/status  # kiểm tra Nexus up
```

### Patch bị mất sau rebase

```bash
grep -c "retry\|without.*tools" packages/openai-adapters/src/apis/OpenAI.ts
# Nếu = 0: xem .patches/01-nim-empty-response-retry.md
```

---

## Khi nào cần chạy 00-pre-install.sh

| Tình huống                                      | Cần pre-install?                  |
| ----------------------------------------------- | --------------------------------- |
| Lần đầu build trên máy Linux/WSL                | ✅ Luôn cần                       |
| `node_modules` vừa install trên Windows         | ✅ Cần fix platform binaries      |
| Đã build thành công trước đó, chỉ thay đổi code | ❌ Không cần, dùng `--only-ext`   |
| Sau `git pull` có thay đổi package.json         | ✅ Nên chạy lại                   |
| Sau `npm install` thủ công trong WSL            | ❌ Không cần (đã đúng platform)   |
| Build trên macOS local (đã có node_modules)     | ❌ Không cần (native npm install) |

---

## Summary: Build flow chuẩn (tất cả platforms)

### Nguyên tắc chung

Tất cả scripts build đã được fix để:

1. **Không dùng `npm run prepackage`** — tránh `npmInstall()` fork child processes bị hang
2. **Không dùng `npm run package`** — tránh npm lifecycle auto-trigger prepackage
3. **Dùng `SKIP_INSTALLS=true` + `node scripts/prepackage.js`** — chỉ copy files
4. **Dùng `npx @vscode/vsce package`** — trigger `vscode:prepublish` (esbuild) đúng cách

### Prerequisite: node_modules phải có sẵn

Trước khi chạy build scripts, đảm bảo:

```bash
# macOS / Windows: npm install thông thường
cd extensions/vscode && npm install
cd gui && npm install
cd core && npm install

# Linux/WSL: dùng 00-pre-install.sh (fix platform binaries)
bash deploy/01-build-extension/00-pre-install.sh --target linux-x64
```

### Thời gian build tham chiếu

| Platform      | Full build | --skip-packages | --only-ext |
| ------------- | :--------: | :-------------: | :--------: |
| macOS arm64   |    ~50s    |      ~42s       |  ~12-14s   |
| Linux/WSL x64 |  ~60-90s   |      ~50s       |  ~15-20s   |
| Windows x64   |  ~60-90s   |      ~50s       |  ~15-20s   |

---

## Lỗi Windows build pipeline (v2.2.1 — 2026-10-12)

Năm lỗi độc lập, **che khuất lẫn nhau** — sửa lần lượt mới thấy hết.
Chi tiết đầy đủ: [Patch 12](../../.patches/12-windows-build-pipeline-fix.md).

### `The string is missing the terminator` khi chạy `.ps1`

```
At ...\build-windows.ps1:264 char:86
+ ... e (Ctrl+Shift+P â†' Developer: Reload Window)"
The string is missing the terminator: '.
```

**Nguyên nhân:** file `.ps1` chứa ký tự Unicode (`—`, `→`) nhưng không có UTF-8 BOM.
Windows PowerShell 5.1 suy đoán ANSI/CP1252 khi không có BOM → `→` (`E2 86 92`) thành `â†'`
→ sinh quote mở không đóng. PowerShell 7 mặc định UTF-8 nên **không** lỗi → dễ tưởng là lỗi shell.

**Fix:** thêm BOM `EF BB BF` vào đầu file.

```bash
head -c 3 file.ps1 | xxd -p     # phai ra: efbbbf
printf '\xef\xbb\xbf' > t.tmp && cat file.ps1 >> t.tmp && mv -f t.tmp file.ps1
```

### `npm error 403 Forbidden - GET http://localhost:7081/...`

**Đánh lạc hướng:** thông báo gợi ý "security policy / forbidden package version", và URL
chứa `npm-11.12.0.tgz` (npm tự tải chính nó). Nhưng `curl` vào đúng URL đó luôn trả **200**.

**Nguyên nhân thật:** `~/.npmrc` đặt `proxy=`/`https-proxy=` toàn cục mà **không có**
`noproxy`, nên npm đẩy cả request tới `localhost:7081` qua corporate proxy. Corporate proxy
chặn Nexus nội bộ.

```bash
curl -x <corporate-proxy> http://localhost:7081/...   # 403  (0.05s)
curl --noproxy '*'        http://localhost:7081/...   # 200  (0.12s)
```

npm retry 3 lần với timeout dài → log hiện `113830ms attempt #3`, càng giống lỗi mạng.

**Fix:** `.\deploy\01-build-extension\sync-npmrc.ps1` — sinh `~/.npmrc` không proxy, có
`noproxy`, tắt audit. npm **không cần** proxy: Nexus đã là proxy repo
(`npm-group` → `npmjs` → `registry.npmjs.org`) và tự lo việc ra internet.

```powershell
npm config get proxy    # -> null
npm config get noproxy  # -> localhost,127.0.0.1,::1,...
```

### `403 ... /-/npm/v1/security/advisories/bulk`

**Nguyên nhân:** Nexus **không implement** npm audit API (`POST /-/npm/v1/security/*` trả
400/403). npm tự chạy audit mỗi lần `npm install`.

**Fix:** `audit=false` + `fund=false` trong `.npmrc` (sync-npmrc.ps1 đã viết sẵn).
Env `npm_config_audit=false` không truyền chắc chắn vào `npm install` con trong
`build-packages.js` → phải ghi vào `.npmrc`.

### Build fail dù `✓ built in 59.52s` (GUI)

```
conda : Browserslist: browsers data (caniuse-lite) is 13 months old.
    + FullyQualifiedErrorId : NativeCommandError
```

**Nguyên nhân:** `$ErrorActionPreference = "Stop"` + gộp `2>&1` khiến PowerShell biến
**mỗi dòng stderr** của native command thành `ErrorRecord` → dừng script. vite/npm/conda đều
dùng stderr cho warning hợp lệ. Build exit 0 vẫn chết.

**Fix:** hạ preference quanh lời gọi, quyết định thành bại bằng `$LASTEXITCODE`:

```powershell
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $out = Invoke-Expression "$CmdStr 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit $LASTEXITCODE)" }
} finally { $ErrorActionPreference = $prevEap }
```

### Build treo ở `Auto-install now? (y/N)`

Chạy nền / redirect log / `tail -f` → không ai trả lời được `Read-Host`.

**Fix:** `-NoInstall`, hoặc script tự bỏ prompt khi stdin bị redirect. Lệnh install luôn được
in ra để chạy tay.

### `conda: The term 'conda' is not recognized`

Continue chạy `pwsh -NoProfile` → profile user không load → conda không trong PATH.

```powershell
$env:Path = "C:\Users\thanhnn14\miniconda3;C:\Users\thanhnn14\miniconda3\Scripts;C:\Users\thanhnn14\miniconda3\condabin;" + $env:Path
```

Terminal tương tác bình thường đã có sẵn — không cần thêm dòng này.
