# This is used in a task in .vscode/tasks.json when on windows
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension

# Everything needs node and npm
Write-Host "`nChecking for dependencies that may require manual installation...`n" -ForegroundColor White

$cargo = (get-command cargo -ErrorAction SilentlyContinue)
if ($null -eq $cargo) {
    Write-Host "Not Found " -ForegroundColor Red -NoNewLine
    Write-Host "cargo"
} else {
    Write-Host "Found " -ForegroundColor Green -NoNewLine
    & cargo --version
}

$node  = (get-command node -ErrorAction SilentlyContinue)
if ($null -eq $node) {
    Write-Host "Not Found " -ForegroundColor Red -NoNewLine
    Write-Host "node"
} else {
    Write-Host "Found " -ForegroundColor Green -NoNewLine
    Write-Host "node "  -NoNewLine
    & node --version
}

Push-Location extensions/vscode
$yarn  = (get-command yarn -ErrorAction SilentlyContinue)
if ($null -eq $yarn) {
    Write-Host "Not Found " -ForegroundColor Red -NoNewLine
    Write-Host "yarn"
} else {
    Write-Host "Found " -ForegroundColor Green -NoNewLine
    Write-Host "yarn " -NoNewLine
    & yarn --version
}
Pop-Location

if ($null -eq $cargo) {
    Write-Host "`n...`n"
    Write-Host "Cargo`n" -ForegroundColor  White
    Write-Host "Doesn't appear to be installed or is not on your Path."
    Write-Host "For how to install cargo see:" -NoNewline
    Write-Host "https://doc.rust-lang.org/cargo/getting-started/installation.html" -ForegroundColor Green
}

if ($null -eq $node) {
    Write-Host "`n...`n"
    Write-Host "NodeJS`n" -ForegroundColor White
    Write-Host "Doesn't appear to be installed or is not on your Path."
    Write-Host "On most Windows systems you can install node using: " -NoNewLine
    Write-Host "winget install OpenJS.NodeJS.LTS " -ForegroundColor Green
    Write-Host "After installing restart your Terminal to update your Path."
    Write-Host "Alternatively see: " -NoNewLine
    Write-Host "https://nodejs.org/" -ForegroundColor Yellow
}

if ($null -eq $yarn) {
    Write-Host "`n...`n"
    Write-Host "Yarn`n" -ForegroundColor White
    Write-Host "Doesn't appear to be installed or is not accessible from .\extensions\vscode"
    Write-Host "For how to install Yarn 1.x see:"
    Write-Host "https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable" -ForegroundColor Yellow
    Write-Host "For how to install Yarn 2.x or 3.x see: "
    Write-Host "https://yarnpkg.com/getting-started/install" -ForegroundColor Yellow
}

if (($null -eq $cargo) -or ($null -eq $node) -or ($null -eq $yarn)) {
    return "`nSome dependencies that may require installation could not be found. Exiting"
}

Write-Host "`nInstalling Core extension dependencies..." -ForegroundColor White
Push-Location core
npm install
npm link
Pop-Location

Write-Output "`nInstalling GUI extension dependencies..." -ForegroundColor White
Push-Location gui
npm install
npm link @continuedev/core
npm run build
Pop-Location

# VSCode Extension (will also package GUI)
Write-Output "`nInstalling VSCode extension dependencies..." -ForegroundColor White
Push-Location extensions/vscode

# This does way too many things inline but is the common denominator between many of the scripts
npm install
npm link @continuedev/core

npm run package

Pop-Location


Write-Output "`nInstalling binary dependencies..." -ForegroundColor White
Push-Location binary

npm install
npm run build

Pop-Location


