# =============================================================================
# verify.ps1 — Verify VSCode portable Windows setup
# =============================================================================
param([string]$InstallDir = "$env:USERPROFILE\.apps\vscode-windows")

function Pass { param($m) Write-Host "  [PASS] $m" -ForegroundColor Green }
function Fail { param($m) Write-Host "  [FAIL] $m" -ForegroundColor Red }
function Info { param($m) Write-Host "  [INFO] $m" -ForegroundColor Cyan }

Write-Host "`n=== VSCode Portable Windows — Verification ===`n"

# 1. Binary
if (Test-Path "$InstallDir\Code.exe") {
  $ver = (Get-Content "$InstallDir\resources\app\product.json" | ConvertFrom-Json).version
  Pass "Code.exe found — version $ver"
} else { Fail "Code.exe not found at $InstallDir" }

# 2. Portable mode (data/ folder)
if (Test-Path "$InstallDir\data\extensions") {
  Pass "Portable mode: data\extensions exists"
} else { Fail "Portable mode not setup — missing data\extensions" }

# 3. Continue extension
$Ext = Get-ChildItem "$InstallDir\data\extensions\continue.*" -ErrorAction SilentlyContinue
if ($Ext) {
  Pass "Continue extension: $($Ext.Name)"
} else { Fail "Continue extension not installed in $InstallDir\data\extensions" }

# 4. VSIX platform check
$ExtJson = Get-ChildItem "$InstallDir\data\extensions\continue.*\package.json" -ErrorAction SilentlyContinue
if ($ExtJson) {
  $pkg = Get-Content $ExtJson | ConvertFrom-Json
  Info "Extension version: $($pkg.version)"
}

Write-Host ""
