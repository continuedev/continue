# Handoff — Build linux-x64 VSIX trong WSL — 2026-10-31

## Target

Build `continue-linux-x64-2.2.x.vsix` trong WSL Ubuntu 24.04 để cài vào
VS Code native WSL (`code-wsl`).

**Lý do cần build trên WSL (không dùng bản Windows):**
`node_sqlite3.node` trong VSIX build từ Windows là PE32 (Windows DLL) →
khi extension activate trên WSL Linux, `dlopen()` gặp invalid ELF header →
extension crash. Phải build trên Linux để có ELF binding.

---

## Môi trường

| Hạng mục | Giá trị |
|----------|---------|
| WSL distro | Ubuntu 24.04.4 LTS |
| Repo path (WSL) | `/mnt/e/08-Sources/1.AI/continue` |
| Repo path (Windows) | `E:\08-Sources\1.AI\continue` |
| Git branch | `feature/20261031.build-wsl` |
| Extension version | `2.2.x` (xem `extensions/vscode/package.json`) |
| Node WSL system | v23.11.1 (KHÔNG dùng) |
| Node target | v20.x via **conda env `node20`** |
| Nexus registry | `http://localhost:7081/repository/npm-group/` (WSL only) |

### Conda trong WSL

Conda có thể chưa available trong WSL session Kiro (thường cần source profile):

```bash
# Nếu conda not found:
source ~/miniconda3/etc/profile.d/conda.sh
# Hoặc:
source ~/anaconda3/etc/profile.d/conda.sh
# Verify:
conda run -n node20 node --version   # phai ra v20.x
```

---

## Tình trạng repo hiện tại

```
node_modules/         node_modules tren Windows → symlinks va binaries sai platform
  core/node_modules/@continuedev/config-yaml → co the tro sai path
  core/node_modules/sqlite3/build/Release/node_sqlite3.node → PE32 (Windows)
  extensions/vscode/node_modules/@vscode/ripgrep/bin/ → rg.exe (Windows)
  extensions/vscode/node_modules/@lancedb/ → win32-x64-msvc (Windows)

extensions/vscode/build/
  continue-win32-x64-2.1.1.vsix  (Windows build cu)
  continue-win32-x64-2.2.0.vsix  (Windows build cu)
  continue-win32-x64-2.2.2.vsix  (Windows build moi nhat)
```

**Chua co** `continue-linux-x64-*.vsix` — day la muc tieu can build.

---

## Scripts va documents lien quan

| File | Mo ta |
|------|-------|
| `deploy/01-build-extension/build-linux.sh` | Main build script — da duoc fix |
| `deploy/01-build-extension/00-pre-install.sh` | Fix platform binaries (rg, lancedb, sqlite3, esbuild) — da duoc fix |
| `deploy/01-build-extension/README.md` | Huong dan chi tiet |
| `deploy/01-build-extension/troubleshooting.md` | Xu ly loi thuong gap |
| `deploy/04-wsl-native-vscode/01-continue-extension-sqlite3-issue.md` | Root cause analysis + hotfix history |

### Nhung gi da duoc fix trong session nay (Windows Kiro)

**`build-linux.sh`** — 3 fixes:
1. Bo `TARGET="${1:-linux-x64}"` (conflict voi `--target` flag)
2. **Pre-install luon chay** — khong gate tren ripgrep check nua (ke ca khi rg.exe ton tai tu Windows build, sqlite3 van co the sai platform)
3. Them `npm install` cho tat ca workspaces voi symlink validation (`@continuedev/*` phai tro dung `REPO_ROOT`)

**`00-pre-install.sh`** — 2 fixes:
4. STEP 1 skip condition kiem tra them sqlite3 platform (neu OS=linux va binding la PE32 thi khong skip npm install)
5. STEP 3b kiem tra `gcc/g++/make` truoc khi node-gyp rebuild sqlite3, in ro huong fix neu thieu

---

## Chien luoc thuc thi

### Buoc 0: Check prerequisites trong WSL

```bash
cd /mnt/e/08-Sources/1.AI/continue

# 1. Conda va node20
conda run -n node20 node --version   # phai: v20.x
conda run -n node20 npm --version    # phai: 10.x

# 2. Build tools cho sqlite3 (node-gyp can gcc)
gcc --version 2>/dev/null || echo "MISSING"
g++ --version 2>/dev/null || echo "MISSING"
make --version 2>/dev/null || echo "MISSING"
# Neu missing:
# sudo apt install -y build-essential

# 3. Nexus check (optional — script tu fallback public neu khong co)
curl -sf --connect-timeout 3 http://localhost:7081/repository/npm-group/ > /dev/null && echo "Nexus OK" || echo "Nexus unavailable — will use public"

# 4. python3-pip cho node headers (neu can download)
python3 --version
```

### Buoc 1: Chay check-only truoc

```bash
cd /mnt/e/08-Sources/1.AI/continue

bash deploy/01-build-extension/00-pre-install.sh \
  --target linux-x64 \
  --check-only
```

Xem ket qua, ghi nhan cac `[MISSING]` / `[WRONG PLATFORM]`.

### Buoc 2: Full build

```bash
cd /mnt/e/08-Sources/1.AI/continue

bash deploy/01-build-extension/build-linux.sh --target linux-x64
```

Script se tu dong:
1. Chay `00-pre-install.sh` (fix rg, lancedb, sqlite3, esbuild)
2. `npm install` cac workspaces con thieu
3. Build packages (parallel) → core → GUI
4. Prepackage (`SKIP_INSTALLS=true`) → vsce package

**Output:** `extensions/vscode/build/continue-linux-x64-2.2.x.vsix` (~70-80 MB)

### Buoc 3: Verify VSIX va install

```bash
# Verify co linux-x64 VSIX
ls -lh extensions/vscode/build/continue-linux-x64-*.vsix

# Install vao VS Code native WSL
code --install-extension extensions/vscode/build/continue-linux-x64-*.vsix --force

# Reload VS Code va kiem tra Continue activate
```

---

## Cac van de co the gap va cach xu ly

### 1. `conda: command not found`

```bash
source ~/miniconda3/etc/profile.d/conda.sh
conda init bash
source ~/.bashrc
```

### 2. `gcc not found` — node-gyp fail

```bash
sudo apt install -y build-essential
# Retry build
```

### 3. `sqlite3 binding rebuild fail` — node headers download fail

Script se thu download headers tu `nodejs.org`. Neu air-gap:

```bash
# Download thu cong tren Windows, copy sang WSL
NODE_VER=$(conda run -n node20 node --version | sed 's/v//')
# Download: https://nodejs.org/download/release/v${NODE_VER}/node-v${NODE_VER}-headers.tar.gz
# Copy vao WSL:
export NODE_HEADERS_TGZ=/tmp/node-headers.tar.gz
bash deploy/01-build-extension/00-pre-install.sh --target linux-x64
```

### 4. `@types/node@20.17.x not found` qua Nexus

Nexus group cache cu. Fix:

```bash
# Trong WSL, curl truc tiep de force refresh metadata
curl -s -u admin:admin123 "http://localhost:7081/repository/npmjs/@types/node" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(list(d['versions'].keys())[-3:])"
# Sau do thu lai npm install
```

### 5. `SKIP_INSTALLS=true` khong hoat dong — prepackage van download

Nguyen nhan: `SKIP_INSTALLS` env var khong truyen qua `conda run`. Fix trong script da duoc giai quyet bang `[System.Environment]::SetEnvironmentVariable` truoc khi goi `conda run`. Neu van gap:

```bash
# Manual prepackage
cd extensions/vscode
export SKIP_INSTALLS=true
conda run -n node20 node scripts/prepackage.js --target linux-x64
conda run -n node20 npx @vscode/vsce package --out ./build --no-dependencies --target linux-x64
```

### 6. Prepackage fail `invalid ELF header` / sqlite3 sai platform sau khi build

Xac nhan binding da duoc fix:

```bash
file core/node_modules/sqlite3/build/Release/node_sqlite3.node
# phai: ELF 64-bit LSB shared object, x86-64
# neu: PE32+ executable (DLL) → pre-install chua chay thanh cong
```

---

## Ket qua ky vong

```
extensions/vscode/build/
  continue-linux-x64-2.2.x.vsix    ← target (moi)
  continue-win32-x64-2.2.2.vsix    ← giu lai (cu)
```

Sau khi cai VSIX linux-x64 vao `code-wsl` → Continue extension activate thanh cong,
`security-ai-h200.tpb.vn` resolve duoc qua WSL `/etc/hosts` → WireGuard `10.8.0.1`.

---

## Luu y quan trong

- **KHONG dung** `npm run prepackage` hay `npm run package` — se hang (deadlock trong npmInstall())
- **KHONG dung** system node WSL (v23) — phai dung `conda run -n node20`
- **KHONG build** tren Windows cho target `linux-x64` — sqlite3 se sai platform
- `build-linux.sh` se clean `out/` neu detect stale binaries tu build truoc

---

## Files lien quan de doc them

- `.patches/README.md` — tat ca custom patches
- `.patches/12-windows-build-pipeline-fix.md` — fix pipeline Windows (co nhieu lesson learned)
- `deploy/04-wsl-native-vscode/01-continue-extension-sqlite3-issue.md` — root cause sqlite3 day du
- `.kiro/handoff/handoff-install-gh-cli-ky-cla-pr-20260809-1055.md` — trang thai 3 PR cong dong
