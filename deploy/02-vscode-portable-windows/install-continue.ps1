# =============================================================================
# install-continue.ps1 — Install Continue VSIX into portable VSCode (Windows)
# =============================================================================
param(
  [string]$InstallDir = "$env:USERPROFILE\.apps\vscode-windows",
  [string]$VsixFile   = ""   # auto-detect nếu để trống
)

$ErrorActionPreference = "Stop"
function Write-Info { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Err  { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red; exit 1 }

# Auto-detect VSIX
if (-not $VsixFile) {
  $VsixFile = Get-ChildItem "$PSScriptRoot\continue-win32-x64-*.vsix" |
              Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
  # Fallback: check 01-build-extension output
  if (-not $VsixFile) {
    $BuildDir = "$PSScriptRoot\..\..\..\extensions\vscode\build"
    $VsixFile = Get-ChildItem "$BuildDir\continue-win32-x64-*.vsix" -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
  }
}
if (-not $VsixFile -or -not (Test-Path $VsixFile)) {
  Write-Err "No VSIX found. Build first: deploy\01-build-extension\build-windows.ps1"
}

$CodeExe = "$InstallDir\Code.exe"
if (-not (Test-Path $CodeExe)) {
  Write-Err "VSCode not found at $InstallDir. Run setup-portable.ps1 first."
}

Write-Info "Installing $(Split-Path $VsixFile -Leaf) into portable VSCode..."

# Install using portable VSCode binary với extensions dir override
& "$CodeExe" --extensions-dir "$InstallDir\data\extensions" `
             --user-data-dir  "$InstallDir\data\user-data" `
             --install-extension "$VsixFile" --force

Write-Ok "Continue extension installed"

# Verify
$ExtDir = "$InstallDir\data\extensions"
$Installed = Get-ChildItem "$ExtDir\continue.*" -ErrorAction SilentlyContinue
if ($Installed) {
  Write-Ok "Verified: $($Installed.Name)"
} else {
  Write-Host "[WARN]  Could not verify — check $ExtDir manually" -ForegroundColor Yellow
}

Write-Host "`n  Launch: $InstallDir\Code.exe`n" -ForegroundColor Green
