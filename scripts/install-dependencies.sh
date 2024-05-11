#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e
echo "Installing Core extension dependencies..."
pushd core
pnpm install
pnpm link --global
popd

echo "Installing GUI extension dependencies..."
pushd gui
pnpm install
pnpm link --global @continuedev/core
pnpm run build
popd
# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode

# This does way too many things inline but is the common denominator between many of the scripts
pnpm install
pnpm link --global @continuedev/core
pnpm run package

popd

echo "Installing binary dependencies..."
pushd binary
pnpm install
pnpm run build