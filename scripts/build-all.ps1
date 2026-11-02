# Build all packages for Continue VSCode Extension on Windows
# Usage: .\build-all.ps1 [-Target win32-x64]

param(
    [string]$Target = "win32-x64"
)

$ROOT = $PWD.Path
$START = Get-Date

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Continue VSCode Extension Build All" -ForegroundColor Cyan
Write-Host "  Root: $ROOT" -ForegroundColor Cyan
Write-Host "  Target: $Target" -ForegroundColor Cyan
Write-Host "  Started: $($START.ToString('HH:mm:ss'))" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Step-Build {
    param([string]$Name, [string]$Dir)
    
    Write-Host ">>> [$Name] Installing dependencies..." -ForegroundColor Yellow
    $installStart = Get-Date
    
    Push-Location $Dir
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED: npm install in $Name" -ForegroundColor Red
        Pop-Location
        return $false
    }
    
    Write-Host ">>> [$Name] Building..." -ForegroundColor Yellow
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED: npm run build in $Name" -ForegroundColor Red
        Pop-Location
        return $false
    }
    Pop-Location
    
    $elapsed = (Get-Date) - $installStart
    Write-Host "  DONE [$Name] ($($elapsed.TotalSeconds.ToString('0.0'))s)" -ForegroundColor Green
    return $true
}

# ============================================
# Step 1-6: Build all packages
# ============================================

$packages = @(
    @{Name="config-types";      Dir="$ROOT\packages\config-types"}
    @{Name="llm-info";          Dir="$ROOT\packages\llm-info"}
    @{Name="fetch";             Dir="$ROOT\packages\fetch"}
    @{Name="openai-adapters";   Dir="$ROOT\packages\openai-adapters"}
    @{Name="config-yaml";       Dir="$ROOT\packages\config-yaml"}
    @{Name="terminal-security"; Dir="$ROOT\packages\terminal-security"}
)

foreach ($pkg in $packages) {
    $ok = Step-Build -Name $pkg.Name -Dir $pkg.Dir
    if (-not $ok) {
        Write-Host "BUILD FAILED at $($pkg.Name). Exiting." -ForegroundColor Red
        exit 1
    }
}

# ============================================
# Step 7: Build core
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Step 7: Building core" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ok = Step-Build -Name "core" -Dir "$ROOT\core"
if (-not $ok) { exit 1 }

# ============================================
# Step 8: Build GUI
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Step 8: Building GUI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ok = Step-Build -Name "gui" -Dir "$ROOT\gui"
if (-not $ok) { exit 1 }

# ============================================
# Step 9: Prepackage + Package VSCode extension
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Step 9: Building VSCode Extension" -ForegroundColor Cyan
Write-Host "  Target: $Target" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$vscodeStart = Get-Date

Push-Location "$ROOT\extensions\vscode"

Write-Host ">>> [vscode] npm install..." -ForegroundColor Yellow
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAILED: npm install in extensions/vscode" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ">>> [vscode] prepackage --target $Target..." -ForegroundColor Yellow
npm run prepackage -- --target $Target 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAILED: prepackage" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ">>> [vscode] package --target $Target..." -ForegroundColor Yellow
npm run package -- --target $Target 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAILED: package" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

$vscodeElapsed = (Get-Date) - $vscodeStart

# ============================================
# Done
# ============================================
$TOTAL = (Get-Date) - $START
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE!" -ForegroundColor Green
Write-Host "  Total time: $($TOTAL.TotalMinutes.ToString('0.0')) min" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Show the built VSIX files
Get-ChildItem "$ROOT\extensions\vscode\build\*.vsix" | ForEach-Object {
    Write-Host "  VSIX: $($_.Name) ($([math]::Round($_.Length/1MB, 2)) MB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Install with:" -ForegroundColor White
Write-Host "  code --install-extension extensions\vscode\build\continue-*.vsix --force" -ForegroundColor Gray
