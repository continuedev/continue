#!/bin/bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode || exit

# This does way too many things inline but is the common denominator between many of the scripts
npm install || exit
npm run package