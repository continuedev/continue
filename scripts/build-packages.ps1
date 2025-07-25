# Use npm ci in CI, npm install in development
if ($env:CI -eq "true") {
    $npmInstallCmd = "npm ci"
} else {
    $npmInstallCmd = "npm install"
}

Push-Location packages

# Build fetch first
Push-Location "fetch"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

# After building fetch, reinstall openai-adapters to pick up the new build
Push-Location "openai-adapters"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

# Build config-yaml
Push-Location "config-yaml"
& cmd /c $npmInstallCmd
npm run build
Pop-Location

Pop-Location