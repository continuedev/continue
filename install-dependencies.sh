#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e
echo "Installing Core extension dependencies..."
pushd core
yarn install
yarn link
popd

echo "Installing GUI extension dependencies..."
pushd gui
yarn install
yarn link @continuedev/core
yarn run build
popd
# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode

# This does way too many things inline but is the common denominator between many of the scripts
yarn install
yarn link @continuedev/core
yarn run package

popd

echo "Installing binary dependencies..."
pushd binary
yarn install
yarn run build