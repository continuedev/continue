# =============================================================================
# download-vscode.ps1 — Download VSCode portable zip for Windows (air-gap prep)
# Chạy 1 lần trên máy có internet, kết quả share cho air-gap machines.
# =============================================================================
param(
  [string]$Version = "1.132.0",
  [string]$OutputDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

$Url = "https://update.code.visualstudio.com/${Version}/win32-x64-archive/stable"
$OutFile = Join-Path $OutputDir "VSCode-win32-x64-${Version}.zip"

Write-Host "Downloading VSCode $Version for Windows x64..." -ForegroundColor Cyan
Write-Host "URL: $Url"
Write-Host "Output: $OutFile"

if (Test-Path $OutFile) {
  Write-Host "Already exists: $OutFile" -ForegroundColor Yellow
  exit 0
}

$ProgressPreference = 'SilentlyContinue'  # faster download
Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing

$SizeMB = [math]::Round((Get-Item $OutFile).Length / 1MB, 1)
Write-Host "Downloaded: ${SizeMB} MB" -ForegroundColor Green
Write-Host "SHA256: $((Get-FileHash $OutFile -Algorithm SHA256).Hash)"
