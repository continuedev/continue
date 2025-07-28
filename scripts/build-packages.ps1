# Use npm ci in CI, npm install in development
if ($env:CI -eq "true") {
    $npmInstallCmd = "npm ci"
} else {
    $npmInstallCmd = "npm install"
}

Push-Location packages

# Phase 1: Build config-types (foundation - no dependencies)
Push-Location "config-types"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

# Phase 2: Build packages that depend on config-types
Push-Location "fetch"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

Push-Location "config-yaml"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

Push-Location "llm-info"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

# Phase 3: Build packages that depend on other local packages
Push-Location "openai-adapters"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

Push-Location "continue-sdk"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

Pop-Location
