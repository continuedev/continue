#!/bin/bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension+

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
# Echo npm version
nvm use default
node --version

set -e
echo "Installing Core extension dependencies..."
pushd core
npm install
npm link
popd

echo "Installing GUI extension dependencies..."
pushd gui
npm install
npm link core
popd
# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode

# This does way too many things inline but is the common denominator between many of the scripts
npm install
npm link core
npm run package
