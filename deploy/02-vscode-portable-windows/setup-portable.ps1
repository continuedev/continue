# =============================================================================
# setup-portable.ps1 — Setup VSCode portable on Windows (air-gap)
# =============================================================================
param(
  [string]$InstallDir = "$env:USERPROFILE\.apps\vscode-windows",
  [string]$ZipFile    = "",   # auto-detect nếu để trống
  [switch]$Force
)

$ErrorActionPreference = "Stop"
function Write-Info  { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Write-Err   { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red; exit 1 }

# Auto-detect zip
if (-not $ZipFile) {
  $ZipFile = Get-ChildItem "$PSScriptRoot\VSCode-win32-x64-*.zip" |
             Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $ZipFile -or -not (Test-Path $ZipFile)) {
  Write-Err "No VSCode zip found. Run download-vscode.ps1 first, or specify -ZipFile"
}

Write-Host "`n==============================================" -ForegroundColor White
Write-Host "  VSCode Portable Setup — Windows" -ForegroundColor White
Write-Host "  Zip:     $ZipFile"
Write-Host "  Install: $InstallDir"
Write-Host "==============================================`n" -ForegroundColor White

# Check already installed
if ((Test-Path "$InstallDir\Code.exe") -and -not $Force) {
  $ver = (Get-Content "$InstallDir\resources\app\product.json" | ConvertFrom-Json).version
  Write-Warn "Already installed at $InstallDir (version: $ver). Use -Force to reinstall."
  exit 0
}

# Extract
Write-Info "Extracting $ZipFile..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Expand-Archive -Path $ZipFile -DestinationPath $InstallDir -Force
Write-Ok "Extracted"

# Verify
if (-not (Test-Path "$InstallDir\Code.exe")) {
  Write-Err "Extraction failed — Code.exe not found"
}
$version = (Get-Content "$InstallDir\resources\app\product.json" | ConvertFrom-Json).version
Write-Ok "Version: $version"

# Setup Portable Mode — tạo data/ folder
# VSCode tự nhận portable mode khi thấy data/ folder bên cạnh Code.exe
Write-Info "Setting up Portable Mode..."
@("data\user-data", "data\extensions", "data\logs") | ForEach-Object {
  New-Item -ItemType Directory -Force -Path "$InstallDir\$_" | Out-Null
}
Write-Ok "Portable data dir: $InstallDir\data\"

# Create launcher shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\VSCode-OnPrem.lnk")
$Shortcut.TargetPath  = "$InstallDir\Code.exe"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "VSCode OnPrem Portable"
$Shortcut.Save()
Write-Ok "Desktop shortcut created: VSCode-OnPrem.lnk"

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "  VSCode $version at: $InstallDir"
Write-Host "  Next: .\install-continue.ps1"
Write-Host "==============================================`n" -ForegroundColor Green
