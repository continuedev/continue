#!/bin/bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Server + Extension

# Server
echo "Installing server dependencies..."
pushd continuedev || exit
./install-dependencies.sh
popd || exit

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extension || exit

# This does way too many things inline but is the common denominator between many of the scripts
npm run package