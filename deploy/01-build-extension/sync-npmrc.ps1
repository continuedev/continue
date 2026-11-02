# =============================================================================
# sync-npmrc.ps1 - Sinh .npmrc cho build offline (Nexus la upstream proxy)
# =============================================================================
#
# Kien truc dung:
#
#   npm --(localhost, KHONG proxy)--> Nexus npm-group --> npmjs --> npmjs.org
#                                     ^
#                                     Nexus tu lo phan di ra internet,
#                                     npm khong can proxy.
#
#   Da kiem chung:
#     npm-group members  = ["npmjs"]
#     npmjs remoteUrl    = https://registry.npmjs.org
#     goi package moi (left-pad) -> 200 (0.76s lan dau fetch upstream,
#                                     0.02s lan sau tu cache)
#     => Nexus ra duoc internet, khong phai cache tinh.
#
# Van de cua .npmrc cu:
#   Dat proxy toan cuc ma KHONG co `noproxy`, nen npm day ca request toi
#   localhost:7081 qua corporate proxy. Corporate proxy chan Nexus noi bo:
#     qua corporate proxy -> 403 (0.05s)
#     khong proxy         -> 200 (0.12s)
#   (ket qua curl voi cung credential)
#
# Cach xu ly: bo proxy khoi .npmrc, them `noproxy`, tat audit (Nexus khong
# ho tro npm audit API: POST /-/npm/v1/security/* -> 400/403).
#
# Luu y: proxy Windows cua ban van dung binh thuong cho trinh duyet va MCP
# servers. File nay chi anh huong toi npm.
#
# Usage:
#   .\deploy\01-build-extension\sync-npmrc.ps1 -DryRun    # xem truoc, khong ghi
#   .\deploy\01-build-extension\sync-npmrc.ps1            # ghi that (co backup)
# =============================================================================
param(
  [string]$NpmrcOut  = "$env:USERPROFILE\.npmrc",
  [string]$Registry  = "http://localhost:7081/repository/npm-group/",
  [string]$NexusAuth = "YWRtaW46YWRtaW4xMjM=",   # base64("admin:admin123")
  [string]$NoProxy   = "localhost,127.0.0.1,::1,*.tpb.vn,tpb.vn,*.local,mynexus.local",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Info { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "================================================" -ForegroundColor White
Write-Host "  Sync .npmrc - Nexus la upstream proxy" -ForegroundColor White
Write-Host "================================================" -ForegroundColor White

# --- Kiem tra Nexus song truoc khi ghi ---
# Timeout 10s: Nexus cold-start / lan dau proxy co the cham hon 5s.
Write-Info "Kiem tra Nexus: $Registry"
$registryHost = ([System.Uri]$Registry).Host
try {
  Invoke-WebRequest -Uri $Registry -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop | Out-Null
  Write-Ok "Nexus dang phuc vu"
} catch {
  Write-Warn "Khong voi toi Nexus ($Registry) sau 10s."
  Write-Warn "Noi mang? kiem tra container Nexus truoc khi build."
  Write-Warn "File .npmrc van se ghi - khi Nexus song lai thi npm se dung Nexus."
}

# --- Sinh noi dung ---
$lines = @(
  "# Sinh boi deploy/01-build-extension/sync-npmrc.ps1"
  "# Chi anh huong npm. Proxy trinh duyet / MCP khong bi doi."
  "registry=$Registry"
  "always-auth=true"
  "//localhost:7081/repository/npm-group/:_auth=$NexusAuth"
  "strict-ssl=false"
  ""
  "# KHONG dat proxy o day. Nexus (npm-group -> npmjs -> registry.npmjs.org)"
  "# tu lo phan fetch upstream. npm chi can noi thang toi localhost:7081."
  "# Neu nhom proxy toan cuc vao, npm se day request toi Nexus qua corporate"
  "# proxy va nhan 403 Forbidden."
  "noproxy=$NoProxy"
  ""
  "# Nexus khong ho tro npm audit API"
  "# (POST /-/npm/v1/security/advisories/bulk -> 400/403 lam fail npm install)"
  "audit=false"
  "fund=false"
)

$content = ($lines -join "`r`n") + "`r`n"

if ($DryRun) {
  Write-Info "[DryRun] Noi dung se ghi ra $NpmrcOut :"
  Write-Host ("-" * 46) -ForegroundColor DarkGray
  $lines | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
  Write-Host ("-" * 46) -ForegroundColor DarkGray
  return
}

# --- Backup .npmrc cu ---
if (Test-Path $NpmrcOut) {
  $bak = "$NpmrcOut.bak.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
  Copy-Item $NpmrcOut $bak -Force
  Write-Ok "Backup: $bak"
}

[System.IO.File]::WriteAllText($NpmrcOut, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Ok "Da ghi: $NpmrcOut"

# --- Verify bang chinh npm ---
Write-Info "Verify qua npm config..."
try {
  Write-Info "  registry = $(npm config get registry)"
  Write-Info "  proxy    = $(npm config get proxy)"
  Write-Info "  noproxy  = $(npm config get noproxy)"
  Write-Info "  audit    = $(npm config get audit)"
} catch {
  Write-Warn "Khong goi duoc npm (chua co trong PATH?)."
}

Write-Host ""
Write-Ok "Hoan tat."
Write-Host ""
