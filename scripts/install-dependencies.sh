#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e

# Function to log the current Node.js and npm versions
log_versions() {
    echo "Using Node.js version: $(node -v)"
    echo "Using npm version: $(npm -v)"
}

# Try to load nvm
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    echo "nvm loaded successfully"
    
    # Try to use the Node.js version specified in .nvmrc We assume you are running from the root.
    if [ -f ".nvmrc" ]; then
        nvm use --silent $(cat .nvmrc) || nvm install $(cat .nvmrc)
        echo "Switched to Node.js version specified in .nvmrc"
    else
        echo "No .nvmrc file found, using current Node.js version"
    fi
else
    echo "nvm not found, using system Node.js version"
fi

# Log the versions being used
log_versions

echo "Installing Core extension dependencies..."
pushd core
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