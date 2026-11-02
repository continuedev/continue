# build-windows.ps1 - Build Continue VSCode Extension on Windows (Fresh or Incremental)
#
# ONE-COMMAND BUILD: handles everything from npm install to final VSIX.
# Safe to run on fresh environment or after clean.
#
# Requirements (install once):
#   - Miniconda/Anaconda with env "node20":
#       conda create -n node20 -y nodejs=20
#   - Git for Windows
#
# Usage (run from repo root OR deploy/01-build-extension/):
#   .\deploy\01-build-extension\build-windows.ps1
#   .\deploy\01-build-extension\build-windows.ps1 -SkipPackages  # skip if packages already built
#   .\deploy\01-build-extension\build-windows.ps1 -OnlyExt       # prepackage+vsce only (~15s)
#   .\deploy\01-build-extension\build-windows.ps1 -ShowOutput    # verbose npm output
#   .\deploy\01-build-extension\build-windows.ps1 -NoInstall     # khong hoi/install (CI, background, tail -f)
#   .\deploy\01-build-extension\build-windows.ps1 -Registry "https://registry.npmjs.org/"
#
# Non-interactive: dat `-NoInstall` hoac pipe stdin ("n" | .\build-windows.ps1).
# Neu stdin bi redirect ma khong co -NoInstall, script tu bo prompt, khong treo.
param(
    [string]$Target     = "win32-x64",
    [switch]$SkipPackages,
    [switch]$OnlyExt,
    [switch]$ShowOutput,
    [switch]$NoInstall,           # never prompt/install (CI, background, piped log)
    [string]$Registry   = ""
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date
$RepoRoot  = Resolve-Path "$PSScriptRoot\..\.."
$ExtDir    = Join-Path $RepoRoot "extensions\vscode"

function Write-Info { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }
function Write-Step { param($msg) Write-Host ""; Write-Host "==> $msg" -ForegroundColor Magenta }
function Get-Elapsed { "$([int]((Get-Date) - $StartTime).TotalSeconds)s" }

function Invoke-Cmd {
    param([string]$CmdStr, [string]$WorkDir = $RepoRoot, [string]$Label = "", [int]$Tail = 5)
    if ($Label -eq "") { $Label = $CmdStr.Split(" ")[0] }
    Write-Info "[$Label] $CmdStr"
    Push-Location $WorkDir
    # $ErrorActionPreference = "Stop" + `2>&1` makes PowerShell wrap every line a
    # native command writes to stderr into an ErrorRecord. Tools legitimately use
    # stderr for warnings (vite/Browserslist "caniuse-lite is old", npm notices,
    # tsc watch messages), which would abort a successful build. Success is decided
    # by $LASTEXITCODE below, so stderr must stay a plain data stream here.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        if ($ShowOutput) { Invoke-Expression $CmdStr }
        else {
            $out = Invoke-Expression "$CmdStr 2>&1"
            $out | Select-Object -Last $Tail | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        }
        if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit $LASTEXITCODE)" }
    } finally {
        $ErrorActionPreference = $prevEap
        Pop-Location
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor White
Write-Host "  Continue Extension Build - Windows"
Write-Host "  Target:  $Target"
Write-Host "  Repo:    $RepoRoot"
Write-Host "  Started: $($StartTime.ToString('HH:mm:ss'))"
Write-Host "================================================" -ForegroundColor White

# --- Step 1: Resolve Node.js runtime ---
Write-Step "Resolving Node.js runtime..."
# conda writes to stderr even on success - keep it a data stream (see Invoke-Cmd).
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$UseCondaNode = $false
$condaEnvList = (conda env list 2>&1) | Out-String
if ($condaEnvList -match "node20") {
    $testVer = conda run -n node20 node --version 2>&1
    if ($LASTEXITCODE -eq 0 -and "$testVer" -match "^v20") {
        $UseCondaNode = $true
        Write-Ok "Using conda env node20: $testVer"
    }
}
if (-not $UseCondaNode) {
    $sysVer = node --version 2>&1
    $ErrorActionPreference = $prevEap
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Node.js not found. Run: conda create -n node20 -y nodejs=20"
    }
    $sysMajor = ($sysVer -replace 'v','').Split('.')[0]
    if ($sysMajor -ne "20") { Write-Warn "System Node $sysVer - expected v20.x" }
    Write-Ok "Using system Node: $sysVer"
}
$ErrorActionPreference = $prevEap

function npm-run {
    param([string]$NpmCmd, [string]$WorkDir, [string]$Label)
    if ($UseCondaNode) { Invoke-Cmd "conda run -n node20 --no-capture-output npm $NpmCmd" $WorkDir $Label }
    else               { Invoke-Cmd "npm $NpmCmd" $WorkDir $Label }
}
function npx-run {
    param([string]$NpxCmd, [string]$WorkDir, [string]$Label)
    if ($UseCondaNode) { Invoke-Cmd "conda run -n node20 --no-capture-output npx $NpxCmd" $WorkDir $Label }
    else               { Invoke-Cmd "npx $NpxCmd" $WorkDir $Label }
}
function node-run {
    param([string]$NodeCmd, [string]$WorkDir, [string]$Label, [string]$EnvVar = "")
    $saved = if ($EnvVar -ne "") { $EnvVar.Split("=",2) } else { $null }
    if ($saved) { [System.Environment]::SetEnvironmentVariable($saved[0], $saved[1]) }
    try {
        # --no-capture-output: conda run forwards child stdout/stderr & exit code directly.
        # Without it, conda buffers output and can return a non-zero exit code even when
        # the node script succeeds (any stderr write confuses the wrapper).
        if ($UseCondaNode) { Invoke-Cmd "conda run -n node20 --no-capture-output node $NodeCmd" $WorkDir $Label 10 }
        else               { Invoke-Cmd "node $NodeCmd" $WorkDir $Label 10 }
    } finally {
        if ($saved) { [System.Environment]::SetEnvironmentVariable($saved[0], $null) }
    }
}

# --- Step 2: Detect npm registry ---
Write-Step "Detecting npm registry..."
$NexusUrl  = "http://localhost:7081/repository/npm-group/"
$PublicUrl = "https://registry.npmjs.org/"
if ($Registry -ne "") {
    $NpmRegistry = $Registry; Write-Ok "Using -Registry: $NpmRegistry"
} elseif ($env:NPM_REGISTRY) {
    $NpmRegistry = $env:NPM_REGISTRY; Write-Ok "Using env NPM_REGISTRY: $NpmRegistry"
} else {
    # UU TIEN TUYET DOI Nexus local. Timeout 10s (khong phai 3s) vi Nexus cold-start
    # hoac lan dau proxy package co the cham hon 3s -> de tranh vo tinh fallback
    # sang npmjs khi Nexus van con song.
    try {
        Invoke-WebRequest -Uri $NexusUrl -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop | Out-Null
        $NpmRegistry = $NexusUrl; Write-Ok "Nexus available: $NpmRegistry"
    } catch {
        $NpmRegistry = $PublicUrl; Write-Warn "Nexus khong voi toi (timeout 10s) - fallback public: $NpmRegistry"
    }
}

function npm-install {
    param([string]$WorkDir, [string]$ExtraArgs = "", [string]$Label = "npm install")
    $cmd = "npm install --registry `"$NpmRegistry`" $ExtraArgs".Trim()
    Write-Info "[$Label] $cmd"
    Push-Location $WorkDir
    # See Invoke-Cmd: npm writes warnings to stderr, which "Stop" + `2>&1` turns
    # into terminating errors. Judge success by exit code + real "npm error" lines.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = Invoke-Expression "$cmd 2>&1"
        if ($ShowOutput) { $out | Write-Host }
        else { $out | Select-Object -Last 4 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray } }
        # ERESOLVE is a warning, not fatal error
        $realErr = $out | Where-Object { $_ -match "^npm error " -and $_ -notmatch "ERESOLVE" }
        # UU TIEN NEXUS TRIET DE: neu dang dung Nexus ma npm fail (Nexus chet giua
        # chung / timeout proxy), thu LAI QUA NEXUS once truoc khi bo cuoc. Khong
        # im lang roi Nexus - loi phai duoc bao ro rang de fix Nexus, khong phai build lot.
        if ($LASTEXITCODE -ne 0 -and $NpmRegistry -eq $NexusUrl) {
            Write-Warn "[$Label] npm fail qua Nexus - thu lai qua Nexus lan 2..."
            $out = Invoke-Expression "$cmd 2>&1"
            if ($ShowOutput) { $out | Write-Host }
            else { $out | Select-Object -Last 4 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray } }
            $realErr = $out | Where-Object { $_ -match "^npm error " -and $_ -notmatch "ERESOLVE" }
            if ($LASTEXITCODE -ne 0) {
                throw "npm install qua Nexus that bai (sau 2 lan thu). Kiem tra Nexus: $NexusUrl. Loi: $($realErr -join '; ')"
            }
        }
        if ($LASTEXITCODE -ne 0 -and $realErr) { throw "npm install failed: $($realErr -join '; ')" }
        if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit $LASTEXITCODE)" }
        Write-Ok "$Label done"
    } finally {
        $ErrorActionPreference = $prevEap
        Pop-Location
    }
}

# --- Step 3: npm install all (skip if node_modules already present) ---
if (-not $OnlyExt) {
    Write-Step "npm install packages + core + gui... $(Get-Elapsed)"
    $installDirs = @(
        "packages\config-types", "packages\terminal-security",
        "packages\llm-info", "packages\fetch",
        "packages\openai-adapters", "packages\config-yaml",
        "core", "gui"
    )
    foreach ($d in $installDirs) {
        $nm = Join-Path $RepoRoot "$d\node_modules"
        if (Test-Path $nm) { Write-Info "[$d] node_modules exists - skip" }
        else { npm-install -WorkDir (Join-Path $RepoRoot $d) -Label $d }
    }
}

# extensions/vscode always
$extNm = Join-Path $ExtDir "node_modules"
if (Test-Path $extNm) { Write-Info "[extensions/vscode] node_modules exists - skip" }
else { npm-install -WorkDir $ExtDir -Label "extensions/vscode" }

# --- Step 4: Fix native binaries ---
Write-Step "Verifying native binaries... $(Get-Elapsed)"

# @vscode/ripgrep - postinstall often skipped via Nexus proxy
$rgTarget = Join-Path $ExtDir "node_modules\@vscode\ripgrep\bin\rg.exe"
$rgSource  = Join-Path $ExtDir "node_modules\@vscode\ripgrep-win32-x64\bin\rg.exe"
if (-not (Test-Path $rgTarget)) {
    if (-not (Test-Path $rgSource)) {
        Write-Info "Installing @vscode/ripgrep-win32-x64..."
        npm-install -WorkDir $ExtDir -ExtraArgs "@vscode/ripgrep-win32-x64 --no-save" -Label "@vscode/ripgrep-win32-x64"
    }
    if (Test-Path $rgSource) {
        $binDir = Split-Path $rgTarget -Parent
        if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
        Copy-Item $rgSource $rgTarget -Force
        Write-Ok "Copied rg.exe -> @vscode/ripgrep/bin/"
    } else { Write-Err "Cannot find rg.exe after install" }
} else { Write-Ok "rg.exe present" }

# @lancedb
$lancedb = Join-Path $ExtDir "node_modules\@lancedb\vectordb-win32-x64-msvc\index.node"
if (-not (Test-Path $lancedb)) {
    npm-install -WorkDir $ExtDir -ExtraArgs "@lancedb/vectordb-win32-x64-msvc --no-save" -Label "@lancedb"
}
if (Test-Path $lancedb) { Write-Ok "lancedb binary present" }
else { Write-Err "lancedb binary missing" }

# --- Step 5: Build packages (parallel) ---
if (-not $SkipPackages -and -not $OnlyExt) {
    Write-Step "Building packages (parallel)... $(Get-Elapsed)"
    node-run -NodeCmd "`"$(Join-Path $RepoRoot 'scripts\build-packages.js')`"" -WorkDir $RepoRoot -Label "build-packages"
    Write-Ok "Packages built  $(Get-Elapsed)"
}

# --- Step 6: Build core ---
if (-not $OnlyExt) {
    Write-Step "Building core... $(Get-Elapsed)"
    npm-run -NpmCmd "run build" -WorkDir (Join-Path $RepoRoot "core") -Label "core"
    Write-Ok "Core built  $(Get-Elapsed)"

    Write-Step "Building GUI... $(Get-Elapsed)"
    npm-run -NpmCmd "run build" -WorkDir (Join-Path $RepoRoot "gui") -Label "gui"
    Write-Ok "GUI built  $(Get-Elapsed)"
}

# --- Step 7: Prepackage ---
Write-Step "Prepackage... $(Get-Elapsed)"

# Detect stale out/ (out/node_modules/@vscode/ripgrep/bin/rg.exe missing = stale)
$outDir = Join-Path $ExtDir "out"
if (Test-Path $outDir) {
    $outRg = Join-Path $outDir "node_modules\@vscode\ripgrep\bin\rg.exe"
    if (-not (Test-Path $outRg)) {
        Write-Warn "Stale out/ (missing rg.exe) - cleaning..."
        Remove-Item -Recurse -Force $outDir
        Write-Ok "Removed stale out/"
    }
}

if (-not (Test-Path (Join-Path $ExtDir "build"))) {
    New-Item -ItemType Directory -Path (Join-Path $ExtDir "build") -Force | Out-Null
}
node-run -NodeCmd "scripts/prepackage.js --target $Target" -WorkDir $ExtDir -Label "prepackage" -EnvVar "SKIP_INSTALLS=true"
Write-Ok "Prepackage done  $(Get-Elapsed)"

# --- Step 8: Package VSIX ---
Write-Step "Packaging VSIX... $(Get-Elapsed)"
npx-run -NpxCmd "@vscode/vsce package --out ./build --no-dependencies --target $Target" -WorkDir $ExtDir -Label "vsce"

# --- Result ---
$vsix = Get-ChildItem (Join-Path $ExtDir "build\continue-${Target}-*.vsix") `
    -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $vsix) { Write-Err "Build failed - no VSIX found in extensions\vscode\build\" }

$elapsed = (Get-Date) - $StartTime
$sizeMB  = [math]::Round($vsix.Length / 1MB, 1)

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE  $($elapsed.Minutes)m$($elapsed.Seconds)s" -ForegroundColor Green
Write-Host "  $($vsix.Name)"
Write-Host "  $sizeMB MB"
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Determine the correct code CLI path
$codeCli = "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd"
if (-not (Test-Path $codeCli)) { $codeCli = "code" }

Write-Host "Install (PowerShell 7 / pwsh):" -ForegroundColor White
Write-Host "  cmd /c `"$codeCli`" --install-extension `"$($vsix.FullName)`" --force" -ForegroundColor Cyan
Write-Host ""
Write-Host "Install (CMD):" -ForegroundColor White
Write-Host "  `"$codeCli`" --install-extension `"$($vsix.FullName)`" --force" -ForegroundColor Cyan
Write-Host ""

# Non-interactive modes must never block on Read-Host: a background run, a
# redirected log, or `tail -f` leaves nobody to answer the prompt.
# -NoInstall or redirected stdin skips the prompt; the install command above
# is always printed so it can be run manually.

if ($NoInstall) {
    Write-Host "[INFO]  -NoInstall: bo qua buoc cai dat." -ForegroundColor Gray
    Write-Host "  Chay lenh install o tren khi ban san sang." -ForegroundColor Gray
} elseif (-not [Console]::IsInputRedirected) {
    Write-Host "Auto-install now? (y/N)" -ForegroundColor Yellow -NoNewline
    $answer = Read-Host " "
    if ($answer -match "^[yY]$") {
        Write-Host "Installing..." -ForegroundColor Cyan
        $proc = Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c `"`"$codeCli`" --install-extension `"$($vsix.FullName)`" --force`"" `
            -Wait -PassThru -NoNewWindow
        if ($proc.ExitCode -eq 0) {
            Write-Host "[OK]    Installed successfully — reload VSCode (Ctrl+Shift+P → Developer: Reload Window)" -ForegroundColor Green
        } else {
            Write-Host "[WARN]  Install exited $($proc.ExitCode) — try the CMD command above manually" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Run the Install command above in CMD to install." -ForegroundColor Gray
    }
} else {
    Write-Host "[INFO]  stdin is redirected - khong hoi install. Dung -NoInstall hoac chay lenh install o tren." -ForegroundColor Gray
}
Write-Host ""
