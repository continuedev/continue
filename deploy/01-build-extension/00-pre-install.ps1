# =============================================================================
# 00-pre-install.ps1 — Pre-install native dependencies cho build Windows
#
# Vấn đề: Khi node_modules chưa đầy đủ hoặc cần refresh platform binaries.
# Script này đảm bảo tất cả native dependencies cho win32-x64 có mặt.
#
# Những gì script làm:
#   1. Verify Node.js 20.x
#   2. Auto-detect npm registry (Nexus internal → fallback public npmjs.org)
#   3. npm install trong extensions/vscode
#   4. Fix @vscode/ripgrep → verify win32-x64 binary
#   5. Fix @lancedb → verify win32-x64-msvc binary
#   6. Verify tất cả required files có mặt
#
# Registry fallback:
#   - Thử Nexus internal (http://localhost:7081/repository/npm-group/) trước
#   - Nếu không accessible → tự động fallback sang https://registry.npmjs.org/
#   - Override bằng param: -Registry "https://..."
#
# Usage:
#   .\00-pre-install.ps1 [-Target win32-x64] [-CheckOnly] [-Registry "https://..."]
# =============================================================================
param(
  [string]$Target = "win32-x64",
  [switch]$CheckOnly,
  [string]$Registry = ""
)

$ErrorActionPreference = "Stop"

# --- Colors ---
function Write-Info    { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok      { param($msg) Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

$RepoRoot = Resolve-Path "$PSScriptRoot\..\.."
$ExtDir = Join-Path $RepoRoot "extensions\vscode"
$Failed = 0

# --- Derive platform info ---
switch ($Target) {
  "win32-x64"    { $OS = "win32";  $Arch = "x64";   $Exe = ".exe"; $LancedbSuffix = "-msvc" }
  "win32-arm64"  { $OS = "win32";  $Arch = "arm64"; $Exe = ".exe"; $LancedbSuffix = "-msvc" }
  "linux-x64"    { $OS = "linux";  $Arch = "x64";   $Exe = "";     $LancedbSuffix = "-gnu" }
  "darwin-arm64" { $OS = "darwin"; $Arch = "arm64"; $Exe = "";     $LancedbSuffix = "" }
  "darwin-x64"   { $OS = "darwin"; $Arch = "x64";   $Exe = "";     $LancedbSuffix = "" }
  default        { Write-Err "Unknown target: $Target" }
}

$LancedbPkg = "@lancedb/vectordb-${Target}${LancedbSuffix}"
$RipgrepPkg = "@vscode/ripgrep-${OS}-${Arch}"

# =============================================================================
# Registry detection with fallback
# =============================================================================
$NexusRegistry = "http://localhost:7081/repository/npm-group/"
$PublicRegistry = "https://registry.npmjs.org/"

function Detect-NpmRegistry {
  # Priority: -Registry param > env var > auto-detect
  if ($Registry -ne "") {
    $script:NpmRegistry = $Registry
    Write-Info "Using registry from -Registry param: $script:NpmRegistry"
    return
  }

  if ($env:NPM_REGISTRY) {
    $script:NpmRegistry = $env:NPM_REGISTRY
    Write-Info "Using registry from NPM_REGISTRY env: $script:NpmRegistry"
    return
  }

  # Auto-detect: UU TIEN TUYET DOI Nexus local. Timeout 10s (khong phai 3s) vi
  # Nexus cold-start hoac lan dau proxy package co the cham hon 3s, de tranh vo
  # tinh fallback sang npmjs khi Nexus van con song.
  Write-Info "Auto-detecting npm registry (uu tien Nexus)..."
  try {
    $response = Invoke-WebRequest -Uri $NexusRegistry -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    $script:NpmRegistry = $NexusRegistry
    Write-Ok "Nexus internal registry available: $script:NpmRegistry"
  } catch {
    $script:NpmRegistry = $PublicRegistry
    Write-Warn "Nexus khong voi toi (timeout 10s) - fallback public: $script:NpmRegistry"
  }
}

$NpmRegistry = ""
Detect-NpmRegistry

# =============================================================================
# Helper: Run npm with fallback
# =============================================================================
function Invoke-NpmWithFallback {
  param(
    [string]$WorkDir,
    [string]$NpmArgs
  )

  Push-Location $WorkDir
  try {
    $fullCmd = "npm $NpmArgs --registry `"$NpmRegistry`""
    Write-Info "Running: $fullCmd"
    $output = Invoke-Expression $fullCmd 2>&1
    $output | Select-Object -Last 4 | Write-Host
    if ($LASTEXITCODE -ne 0) { throw "npm failed with exit code $LASTEXITCODE" }
  } catch {
    # UU TIEN NEXUS TRIET DE: neu dang dung Nexus ma fail (Nexus chet giua chung /
    # timeout proxy), THU LAI QUA NEXUS once. Chi khi van fail moi roi sang public,
    # va in canh bao ro de user biet prod build dang ra ngoai internet.
    if ($NpmRegistry -ne $PublicRegistry) {
      Write-Warn "npm fail qua $NpmRegistry - thu lai qua Nexus lan 2..."
      $fullCmd = "npm $NpmArgs --registry `"$NpmRegistry`""
      $output = Invoke-Expression $fullCmd 2>&1
      $output | Select-Object -Last 4 | Write-Host
      if ($LASTEXITCODE -eq 0) {
        Write-Ok "Retry qua Nexus thanh cong"
      } else {
        Write-Warn "Van fail sau 2 lan qua Nexus - fallback public registry..."
        $script:NpmRegistry = $PublicRegistry
        $fullCmd = "npm $NpmArgs --registry `"$PublicRegistry`""
        $output = Invoke-Expression $fullCmd 2>&1
        $output | Select-Object -Last 4 | Write-Host
        if ($LASTEXITCODE -ne 0) {
          Pop-Location
          Write-Err "npm command failed even with public registry"
        } else {
          Write-Warn "CAINH: build dang dung PUBLIC registry, KHONG phai Nexus. Prod nen fix Nexus roi build lai."
        }
      }
    } else {
      Pop-Location
      Write-Err "npm command failed: $NpmArgs"
    }
  } finally {
    Pop-Location
  }
}

# =============================================================================
Write-Host ""
Write-Host "==============================================" -ForegroundColor White
Write-Host "  Continue Pre-install - $Target"
Write-Host "  Repo: $RepoRoot"
Write-Host "  npm:  $NpmRegistry"
Write-Host "==============================================" -ForegroundColor White
Write-Host ""

# =============================================================================
# STEP 0: Verify Node.js
# =============================================================================
Write-Info "Checking Node.js..."
try {
  $NodeVer = node --version 2>&1
  $NpmVer  = npm --version 2>&1
  $NodeMajor = ($NodeVer -replace 'v','').Split('.')[0]
  if ($NodeMajor -ne "20") {
    Write-Warn "Node.js version is $NodeVer - expected v20.x"
  }
  Write-Ok "Node: $NodeVer | npm: $NpmVer"
} catch {
  if ($CheckOnly) {
    Write-Host "  [FAIL] Node.js not found" -ForegroundColor Red
    $Failed++
  } else {
    Write-Err "Node.js not found. Install Node.js 20.x from https://nodejs.org/"
  }
}

# =============================================================================
# STEP 1: npm install trong extensions/vscode
# =============================================================================
if (-not $CheckOnly) {
  Write-Info "Running npm install in extensions\vscode..."
  Invoke-NpmWithFallback -WorkDir $ExtDir -NpmArgs "install"
  Write-Ok "npm install done"
}

# =============================================================================
# STEP 2: Fix @vscode/ripgrep
# =============================================================================
$RipgrepBin = Join-Path $ExtDir "node_modules\$RipgrepPkg\bin\rg${Exe}"
$RipgrepTarget = Join-Path $ExtDir "node_modules\@vscode\ripgrep\bin\rg${Exe}"

Write-Host ""
Write-Info "[@vscode/ripgrep] target: $RipgrepPkg"

if (-not (Test-Path $RipgrepBin)) {
  if ($CheckOnly) {
    Write-Host "  [MISSING] $RipgrepPkg binary" -ForegroundColor Red
    $Failed++
  } else {
    Write-Info "Installing $RipgrepPkg..."
    Invoke-NpmWithFallback -WorkDir $ExtDir -NpmArgs "install `"$RipgrepPkg`" --no-save"
    Write-Ok "$RipgrepPkg installed"
  }
} else {
  Write-Ok "$RipgrepPkg binary exists"
}

# Verify ripgrep is in expected location
if ((Test-Path $RipgrepBin) -and -not (Test-Path $RipgrepTarget)) {
  if (-not $CheckOnly) {
    Write-Info "Copying ripgrep binary to expected location..."
    $targetDir = Split-Path $RipgrepTarget -Parent
    if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
    Copy-Item $RipgrepBin $RipgrepTarget -Force
    Write-Ok "Ripgrep binary copied"
  } else {
    Write-Host "  [MISSING] ripgrep at: $RipgrepTarget" -ForegroundColor Red
    $Failed++
  }
} elseif (Test-Path $RipgrepTarget) {
  Write-Ok "ripgrep binary at expected location"
}

# =============================================================================
# STEP 3: Fix @lancedb
# =============================================================================
$LancedbNode = Join-Path $ExtDir "node_modules\$LancedbPkg\index.node"

Write-Host ""
Write-Info "[@lancedb] target: $LancedbPkg"

if (-not (Test-Path $LancedbNode)) {
  if ($CheckOnly) {
    Write-Host "  [MISSING] $LancedbPkg" -ForegroundColor Red
    $Failed++
  } else {
    Write-Info "Installing $LancedbPkg..."
    Invoke-NpmWithFallback -WorkDir $ExtDir -NpmArgs "install `"$LancedbPkg`" --no-save"
    Write-Ok "$LancedbPkg installed"
  }
} else {
  Write-Ok "$LancedbPkg binary exists"
}

# =============================================================================
# STEP 4: Verify required files
# =============================================================================
Write-Host ""
Write-Info "Verifying required files for prepackage ($Target)..."

function Check-File {
  param([string]$FilePath, [string]$Desc)
  if (Test-Path $FilePath) {
    Write-Host "  [OK]    $Desc" -ForegroundColor Green
  } else {
    Write-Host "  [MISSING] $Desc" -ForegroundColor Red
    Write-Host "            -> $FilePath" -ForegroundColor Gray
    $script:Failed++
  }
}

Check-File (Join-Path $ExtDir "node_modules\@vscode\ripgrep\bin\rg${Exe}") "ripgrep binary"
Check-File (Join-Path $RepoRoot "core\node_modules\onnxruntime-node\bin\napi-v3\${OS}\${Arch}\onnxruntime_binding.node") "onnxruntime binding (${OS}/${Arch})"
Check-File (Join-Path $ExtDir "node_modules\$LancedbPkg\index.node") "lancedb binary ($LancedbPkg)"

# GUI check (optional — may not be built yet)
$guiAssets = Join-Path $RepoRoot "gui\dist\assets\index.js"
if (Test-Path $guiAssets) {
  Write-Host "  [OK]    gui assets (gui/dist/assets/index.js)" -ForegroundColor Green
} else {
  Write-Host "  [WARN]  gui/dist/assets not built yet - OK if running full build" -ForegroundColor Yellow
}

# =============================================================================
# Summary
# =============================================================================
Write-Host ""
Write-Host "==============================================" -ForegroundColor White
if ($Failed -eq 0) {
  Write-Host "  Pre-install complete - ready to build!" -ForegroundColor Green
  if ($CheckOnly) {
    Write-Host "  All checks passed" -ForegroundColor Green
  }
  Write-Host ""
  Write-Host "  Next:"
  Write-Host "  .\deploy\01-build-extension\build-windows.ps1 -Target $Target"
} else {
  if ($CheckOnly) {
    Write-Host "  $Failed check(s) failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Fix with:"
    Write-Host "  .\deploy\01-build-extension\00-pre-install.ps1 -Target $Target"
  } else {
    Write-Host "  $Failed item(s) may still be missing" -ForegroundColor Yellow
    Write-Host "  Re-run with -CheckOnly to verify"
  }
}
Write-Host "==============================================" -ForegroundColor White
Write-Host ""
