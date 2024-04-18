#!/bin/bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e
echo "Installing Core extension dependencies..."
pushd core
npm install
npm link
popd

# https://github.com/continuedev/continue/issues/1100#issuecomment-2062447808
# temporary workaround for the dependency between gui and extension
pushd extensions/vscode
npm link @continuedev/core
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
npm run package

popd

echo "Installing binary dependencies..."
pushd binary
npm install
npm run build
