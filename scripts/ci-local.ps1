# Local CI - mirrors .github/workflows/pr-checks.yaml (verify jobs)
#
# Usage (from continue/):
#   powershell -File scripts/ci-local.ps1
#   powershell -File scripts/ci-local.ps1 -Docker
#   powershell -File scripts/ci-local.ps1 -Docker -Full
#   powershell -File scripts/ci-local.ps1 -Fix

param(
    [switch]$Docker,
    [switch]$Full,
    [switch]$FullPackages,
    [switch]$FullPrettier,
    [switch]$Fix
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

if ($Fix) {
    Write-Step "Prettier write (auto-format)"
    npx prettier --write "**/*.{js,jsx,ts,tsx,json,css,md}" --ignore-path .gitignore --ignore-path .prettierignore
    if ($LASTEXITCODE -ne 0) { throw "Prettier write failed" }
}

if ($Docker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker requis pour -Docker"
    }

    Write-Step "Build image continue-ci-local"
    docker build -f scripts/ci-local.Dockerfile -t continue-ci-local .
    if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

    $mount = (Get-Location).Path
    $args = @(
      "run", "--rm",
      "-e", "IGNORE_API_KEY_TESTS=true",
      "-e", "CI=true",
      "-e", "FORCE_NPM_CI=true",
      "-v", "${mount}:/workspace",
      "-w", "/workspace",
      "continue-ci-local"
    )
    if ($FullPrettier) {
        $args += @("-e", "PRETTIER_SCOPE=all")
    }
    $args += "bash"
    $args += "scripts/ci-local.sh"
    if ($Full) {
        $args += "--full"
    }
    if ($FullPackages) {
        $args += "--full-packages"
    }

    Write-Step "Run CI in Docker (Linux / Node 20.20.1)"
    docker @args
    if ($LASTEXITCODE -ne 0) { throw "CI Docker failed (exit $LASTEXITCODE)" }

    Write-Host ""
    Write-Host "CI Docker OK" -ForegroundColor Green
    exit 0
}

Write-Step "Run CI natif (Git Bash)"
$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
    throw "bash introuvable. Installez Git Bash ou utilisez -Docker"
}

$ciArgs = @("scripts/ci-local.sh")
if ($Full) { $ciArgs += "--full" }
if ($FullPackages) { $ciArgs += "--full-packages" }

$env:IGNORE_API_KEY_TESTS = "true"
$env:CI = "true"
& bash @ciArgs
if ($LASTEXITCODE -ne 0) { throw "CI failed (exit $LASTEXITCODE)" }

Write-Host ""
Write-Host "CI locale OK" -ForegroundColor Green
