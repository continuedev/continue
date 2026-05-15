#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e

# Check if node version matches .nvmrc
if [ -f .nvmrc ]; then
    required_node_version=$(cat .nvmrc)
    current_node_version=$(node -v)
    
    # Remove 'v' prefix from versions for comparison
    required_version=${required_node_version#v}
    current_version=${current_node_version#v}

    if [ "$required_version" != "$current_version" ]; then
        echo "⚠️  Warning: Your Node.js version ($current_node_version) does not match the required version ($required_node_version)"
        echo "Please consider switching to the correct version using: nvm use"
        
        if [ -t 0 ]; then
            read -p "Press Enter to continue with installation anyway..."
        else
            echo "Continuing with installation anyway..."
        fi
        echo
    fi
fi

echo "Installing root-level dependencies..."
npm install

echo "Building packages (fetch, openai-adapters, config-yaml)..."
node ./scripts/build-packages.js

echo "Installing Core extension dependencies..."
pushd core
## This flag is set because we pull down Chromium at runtime
export PUPPETEER_SKIP_DOWNLOAD='true'
npm install
npm link
popd

echo "Installing GUI extension dependencies..."
pushd gui
npm install
npm link @continuedev/core
NODE_OPTIONS="--max-old-space-size=4096" npm run build
popd

echo "Installing and compiling binary dependencies (Node SEA)..."
pushd binary
npm install
npm run build
popd

## --- Ensure ripgrep folders before packaging
echo "Ensure ripgrep folders before packaging..."
mkdir -p extensions/vscode/node_modules/@vscode/ripgrep/bin
mkdir -p extensions/vscode/out/node_modules/@vscode/ripgrep/bin

if command -v rg &> /dev/null; then
    cp $(which rg) extensions/vscode/node_modules/@vscode/ripgrep/bin/rg
    cp $(which rg) extensions/vscode/out/node_modules/@vscode/ripgrep/bin/rg
    chmod +x extensions/vscode/node_modules/@vscode/ripgrep/bin/rg
    chmod +x extensions/vscode/out/node_modules/@vscode/ripgrep/bin/rg
fi

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies and packaging..."
pushd extensions/vscode
npm install
npm link @continuedev/core

# --- Ensure Ripgrep folders are preserved after NPM installation.
echo "Ensure Ripgrep folders are preserved after NPM installation..."
mkdir -p node_modules/@vscode/ripgrep/bin
mkdir -p out/node_modules/@vscode/ripgrep/bin

if command -v rg &> /dev/null; then
    cp $(which rg) node_modules/@vscode/ripgrep/bin/rg
    cp $(which rg) out/node_modules/@vscode/ripgrep/bin/rg
    chmod +x node_modules/@vscode/ripgrep/bin/rg
    chmod +x out/node_modules/@vscode/ripgrep/bin/rg
fi

npm run package
popd

echo "Installing docs dependencies..."
pushd docs
npm install
popd