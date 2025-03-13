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
npm run build

popd

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode
# This does way too many things inline but is the common denominator between many of the scripts
npm install
npm link @continuedev/core
npm run prepackage
npm run package

popd

echo "Installing binary dependencies..."
pushd binary
npm install
npm run build

popd

echo "Installing docs dependencies..."
pushd docs
npm install

popd
