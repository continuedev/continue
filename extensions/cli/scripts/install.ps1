#Requires -Version 5.1
<#
.SYNOPSIS
    Continue CLI Installer for Windows
.DESCRIPTION
    Installs Node.js (if needed) and the Continue CLI globally
.EXAMPLE
    irm https://continue.dev/install.ps1 | iex
.NOTES
    Supports Windows 10/11, Windows Server 2016+
    Requires internet connectivity
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [int]$Timeout = 60
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # Faster downloads

$script:RequiredNodeVersion = [version]"20.19.0"
$script:PackageName = "@continuedev/cli"
$script:CliCommand = "cn"
$script:FnmInstalled = $false
$script:FnmPath = "$env:LOCALAPPDATA\fnm"

function Write-Info { param($Message) Write-Host "==> " -ForegroundColor Cyan -NoNewline; Write-Host $Message }
function Write-Success { param($Message) Write-Host "==> " -ForegroundColor Green -NoNewline; Write-Host $Message }
function Write-Warn { param($Message) Write-Host "==> Warning: " -ForegroundColor Yellow -NoNewline; Write-Host $Message }
function Write-Err { param($Message) Write-Host "==> Error: " -ForegroundColor Red -NoNewline; Write-Host $Message }

function Test-InternetConnection {
    try {
        $request = [System.Net.WebRequest]::Create("https://registry.npmjs.org")
        $request.Timeout = 5000
        $request.Method = "HEAD"
        $response = $request.GetResponse()
        $response.Close()
        return $true
    } catch {
        return $false
    }
}

function Invoke-SafeWebRequest {
    param(
        [Parameter(Mandatory)]
        [string]$Uri,
        [string]$OutFile
    )

    $webClient = New-Object System.Net.WebClient
    try {
        if ($OutFile) {
            $webClient.DownloadFile($Uri, $OutFile)
        } else {
            return $webClient.DownloadString($Uri)
        }
    } catch [System.Net.WebException] {
        Write-Err "Failed to download from $Uri`: $($_.Exception.Message)"
        throw
    } finally {
        $webClient.Dispose()
    }
}

function Remove-FnmInstallation {
    if ($script:FnmInstalled -and (Test-Path $script:FnmPath)) {
        Write-Warn "Cleaning up partial fnm installation..."
        Remove-Item -Path $script:FnmPath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-NodeVersion {
    try {
        $nodeOutput = & node -v 2>$null
        if ($nodeOutput -match '^v?(\d+\.\d+\.\d+)') {
            return [version]$Matches[1]
        }
    } catch {}
    return $null
}

function Test-NodeInstalled {
    $currentVersion = Get-NodeVersion
    if ($null -eq $currentVersion) {
        Write-Warn "Node.js is not installed"
        return $false
    }

    Write-Info "Found Node.js v$currentVersion"
    if ($currentVersion -ge $RequiredNodeVersion) {
        Write-Success "Node.js meets requirements (>= v$RequiredNodeVersion)"
        return $true
    }

    Write-Warn "Node.js v$currentVersion is below required v$RequiredNodeVersion"
    return $false
}

function Install-Fnm {
    Write-Info "Installing fnm (Fast Node Manager)..."

    $fnmInstalled = $false

    # Method 1: Try winget (preferred - more reliable)
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Info "Using winget to install fnm..."
        try {
            $wingetResult = winget install Schniz.fnm --accept-package-agreements --accept-source-agreements -h 2>&1
            if ($LASTEXITCODE -eq 0 -or $wingetResult -match "already installed") {
                $fnmInstalled = $true
            } else {
                Write-Warn "winget installation returned non-zero exit code, trying alternative method..."
            }
        } catch {
            Write-Warn "winget failed: $($_.Exception.Message). Trying alternative method..."
        }
    }

    # Method 2: Direct binary download (safer than executing remote script)
    if (-not $fnmInstalled) {
        Write-Info "Downloading fnm binary directly..."
        try {
            $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
            $fnmZipUrl = "https://github.com/Schniz/fnm/releases/latest/download/fnm-windows.zip"
            $tempZip = Join-Path $env:TEMP "fnm-windows.zip"
            $extractPath = $script:FnmPath

            # Download the zip file
            Invoke-SafeWebRequest -Uri $fnmZipUrl -OutFile $tempZip

            # Create fnm directory if it doesn't exist
            if (-not (Test-Path $extractPath)) {
                New-Item -ItemType Directory -Path $extractPath -Force | Out-Null
            }

            # Extract the zip
            Expand-Archive -Path $tempZip -DestinationPath $extractPath -Force

            # Clean up temp file
            Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue

            if (Test-Path "$extractPath\fnm.exe") {
                $fnmInstalled = $true
                $script:FnmInstalled = $true
            }
        } catch {
            Write-Warn "Direct download failed: $($_.Exception.Message)"
        }
    }

    if (-not $fnmInstalled) {
        Write-Err "Failed to install fnm using all available methods."
        Write-Err "Please install Node.js manually from https://nodejs.org or install fnm from https://github.com/Schniz/fnm"
        exit 1
    }

    # Add fnm to current session PATH
    $fnmPaths = @(
        $script:FnmPath,
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Schniz.fnm_*",
        "$env:USERPROFILE\.fnm",
        "$env:APPDATA\fnm"
    )

    foreach ($pathPattern in $fnmPaths) {
        $resolvedPaths = Resolve-Path -Path $pathPattern -ErrorAction SilentlyContinue
        foreach ($resolvedPath in $resolvedPaths) {
            if (Test-Path "$resolvedPath\fnm.exe") {
                $env:PATH = "$resolvedPath;$env:PATH"
                Write-Info "Found fnm at: $resolvedPath"
                return
            }
        }
    }
}

function Install-Node {
    Install-Fnm

    if (-not (Get-Command fnm -ErrorAction SilentlyContinue)) {
        Remove-FnmInstallation
        Write-Err "Failed to install fnm. Please install Node.js manually from https://nodejs.org"
        exit 1
    }

    Write-Info "Installing Node.js v$RequiredNodeVersion..."

    try {
        # Initialize fnm for current session
        $fnmEnvOutput = fnm env --use-on-cd 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "fnm env failed: $fnmEnvOutput"
        }
        $fnmEnvOutput | Out-String | Invoke-Expression

        # Install Node.js
        $installOutput = fnm install $RequiredNodeVersion.ToString() 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "fnm install failed: $installOutput"
        }

        fnm use $RequiredNodeVersion.ToString()
        if ($LASTEXITCODE -ne 0) {
            throw "fnm use failed"
        }

        fnm default $RequiredNodeVersion.ToString()

        # Re-initialize to pick up the new node
        fnm env --use-on-cd | Out-String | Invoke-Expression

        # Verify node is now available
        $nodeVersion = Get-NodeVersion
        if ($null -eq $nodeVersion) {
            throw "Node.js installation completed but node command not found"
        }

        Write-Success "Node.js v$nodeVersion installed"

        # Add fnm setup to PowerShell profile
        Add-ToProfile
    } catch {
        Remove-FnmInstallation
        Write-Err "Failed to install Node.js: $($_.Exception.Message)"
        exit 1
    }
}

function Add-ToProfile {
    $profileDir = Split-Path $PROFILE -Parent
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }

    if (-not (Test-Path $PROFILE)) {
        New-Item -ItemType File -Path $PROFILE -Force | Out-Null
    }

    $fnmInit = 'fnm env --use-on-cd | Out-String | Invoke-Expression'
    $profileContent = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue

    if ($profileContent -notmatch 'fnm env') {
        Write-Info "Adding fnm to PowerShell profile..."
        Add-Content -Path $PROFILE -Value "`n# fnm (Node version manager)`n$fnmInit"
    }
}

function Install-Cli {
    Write-Info "Installing $PackageName..."

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Err "npm not found. Please restart PowerShell and try again."
        exit 1
    }

    # Check npm global directory permissions
    $npmPrefix = npm config get prefix 2>$null
    if ($npmPrefix -and (Test-Path $npmPrefix)) {
        try {
            $testFile = Join-Path $npmPrefix "_continue_test_write"
            [IO.File]::WriteAllText($testFile, "test")
            Remove-Item $testFile -Force
        } catch {
            Write-Warn "Cannot write to npm global directory. Configuring user-local prefix..."
            $userNpmDir = "$env:USERPROFILE\.npm-global"
            if (-not (Test-Path $userNpmDir)) {
                New-Item -ItemType Directory -Path $userNpmDir -Force | Out-Null
            }
            npm config set prefix $userNpmDir
            $env:PATH = "$userNpmDir;$env:PATH"
        }
    }

    $npmOutput = npm install -g $PackageName 2>&1
    $npmExitCode = $LASTEXITCODE

    if ($npmExitCode -ne 0) {
        Write-Host $npmOutput -ForegroundColor Red
        Write-Err "Failed to install $PackageName (exit code: $npmExitCode)"
        exit 1
    }

    # Verify the CLI was installed
    $npmBinPath = npm config get prefix 2>$null
    if ($npmBinPath) {
        $env:PATH = "$npmBinPath;$env:PATH"
    }

    Write-Success "$PackageName installed!"
}

function Show-Complete {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Success "Continue CLI installation complete!"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""

    # Check if CLI is available
    if (Get-Command $CliCommand -ErrorAction SilentlyContinue) {
        Write-Success "Ready! Run: $CliCommand --help"
    } else {
        Write-Host "Restart PowerShell, then run: " -NoNewline
        Write-Host "$CliCommand --help" -ForegroundColor White
    }
    Write-Host ""
}

function Main {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "           Continue CLI Installer" -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""

    # Detect architecture properly
    $arch = if ([Environment]::Is64BitOperatingSystem) {
        if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
    } else {
        "x86"
    }
    Write-Info "Detected platform: Windows-$arch"

    # Check internet connectivity
    Write-Info "Checking internet connectivity..."
    if (-not (Test-InternetConnection)) {
        Write-Err "Cannot reach npm registry. Please check your internet connection and try again."
        exit 1
    }

    # Check Windows version
    $osVersion = [Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-Warn "Windows version $osVersion may not be fully supported. Windows 10 or later is recommended."
    }

    if (-not (Test-NodeInstalled)) {
        Install-Node
    }

    Install-Cli
    Show-Complete
}

# Run main function
try {
    Main
} catch {
    Remove-FnmInstallation
    Write-Err "Installation failed: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    exit 1
}
