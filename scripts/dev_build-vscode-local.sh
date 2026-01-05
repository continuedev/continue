#!/bin/bash
set -e

# Build VS Code Extension Locally (CI-Style)

# 0. Setup
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="$SCRIPT_DIR/.."
cd "$REPO_ROOT"

echo "Building from root: $REPO_ROOT"

# 1. Build Internal Packages
echo "--- 1. Building Internal Packages ---"
node scripts/build-packages.js

# 2. Install Core
echo "--- 2. Installing Core Dependencies ---"
cd core
# Use --ignore-scripts to avoid node-gyp/distutils errors on Python 3.12+
npm install --ignore-scripts
cd ..

# 3. Install GUI
echo "--- 3. Installing GUI Dependencies ---"
cd gui
npm install
# Workaround for Vite resolution issues (monorepo linking)
echo "Installing explicit dependencies for Vite resolution..."
npm install zod shell-quote
cd ..

# 4. Build GUI
echo "--- 4. Building GUI ---"
cd gui
npm run build
cd ..

# 5. Build VS Code Extension
echo "--- 5. Building VS Code Extension ---"
cd extensions/vscode
echo "Installing VS Code dependencies..."
npm install

echo "Running prepackage..."
npm run prepackage

echo "Running package..."
npm run package

echo "--- Build Complete ---"
echo "VS Code extension artifact created at:"
ARTIFACT_PATH=$(find build -maxdepth 1 -name "*.vsix" -print -quit)
echo "VS Code extension artifact created at: $ARTIFACT_PATH"

# Link to build/ directory
mkdir -p "$REPO_ROOT/build"
GIT_DESCRIBE=$(git describe --tags --dirty --always)
BASE_NAME=$(basename "$ARTIFACT_PATH" .vsix)
NEW_NAME="${BASE_NAME}-${GIT_DESCRIBE}.vsix"
mv "$ARTIFACT_PATH" "$REPO_ROOT/build/$NEW_NAME"
echo "✅ Moved to: $REPO_ROOT/build/$NEW_NAME"
