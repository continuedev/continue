# This is used in a task in .vscode/tasks.json when on windows
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension

# Everything needs node and npm
Write-Output "Checking for node..."

if ($null -eq (get-command node -ErrorAction SilentlyContinue)) {
    Write-Output "No node found, installing node LTS using winget"
    winget install OpenJS.NodeJS.LTS

    # we still won't find it in this script if we don't also refresh our path
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    node --version
}

Write-Output "Installing Core extension dependencies..."
Push-Location core
npm install
npm link
Pop-Location

Write-Output "Installing GUI extension dependencies..."
Push-Location gui
npm install
npm link core
Pop-Location

# VSCode Extension (will also package GUI)
Write-Output "Installing VSCode extension dependencies..."
Push-Location extensions/vscode

# This does way too many things inline but is the common denominator between many of the scripts
npm install
npm link core

#Yarn is required for the package build apparently
Write-Output "Checking for yarn..."
if ($null -eq (get-command yarn -ErrorAction SilentlyContinue)) {
    Write-Output "No yarn found, installing 1.x"
    npm install yarn
} else {
    yarn --version
}

npm run package

Pop-Location