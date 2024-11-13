#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e

echo "Installing root-level dependencies..."
npm install --include=dev

echo "Installing Core extension dependencies..."
pushd core
## This flag is set because we pull down Chromium at runtime
export PUPPETEER_SKIP_DOWNLOAD='true'
npm install --include=dev
npm link

popd

echo "Installing GUI extension dependencies..."
pushd gui
npm install --include=dev
npm link @continuedev/core
npm run build

popd

echo "Installing binary dependencies..."
pushd binary
npm install --include=dev
npm run build

popd

echo "Installing docs dependencies..."
pushd docs
npm install --include=dev

popd

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode
# This does way too many things inline but is the common denominator between many of the scripts
npm install --include=dev
npm link @continuedev/core
npm run prepackage
npm run package

popd