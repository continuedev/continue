#!/bin/bash
set -e

# Build JetBrains Plugin Locally (CI-Style)
# This script mirrors the GitHub Actions workflow for a complete, functional build.

# 0. Setup
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT="$SCRIPT_DIR/.."
cd "$REPO_ROOT"

echo "Building from root: $REPO_ROOT"
echo "Target: $(uname -s)-$(uname -m)"

# 1. Build Internal Packages
echo "--- 1. Building Internal Packages ---"
node scripts/build-packages.js

# 2. Install Core
echo "--- 2. Installing Core Dependencies ---"
cd core
# Note: On Python 3.12+, node-gyp fails due to missing distutils.
# Fix: pip install setuptools OR use --ignore-scripts (sqlite3 builds may fail)
npm ci --ignore-scripts || npm install --ignore-scripts
cd ..

# 3. Install GUI and Build
echo "--- 3. Installing GUI Dependencies and Building ---"
cd gui
npm ci || npm install
npm run build
cd ..

# 4. Run Prepackage (Critical: copies native modules and assets)
echo "--- 4. Running Prepackage Script ---"
cd extensions/vscode
npm ci || npm install
npm run prepackage
cd ../..

# 5. Install Binary and Build
echo "--- 5. Building Binary ---"
cd binary
npm ci || npm install
npm run build
cd ..

# 6. Build IntelliJ Plugin
echo "--- 6. Building IntelliJ Plugin ---"
cd extensions/intellij

# Check for JAVA_HOME
if [ -z "$JAVA_HOME" ]; then
	echo "WARNING: JAVA_HOME is not set. Gradle might fail if it cannot find JDK 17."
	if [ -d "/usr/lib/jvm/java-17-openjdk" ]; then
		export JAVA_HOME="/usr/lib/jvm/java-17-openjdk"
		echo "Using autodetected JAVA_HOME=$JAVA_HOME"
	fi
fi

./gradlew buildPlugin

echo "--- Build Complete ---"
echo "Plugin artifact located at:"
ARTIFACT_PATH=$(find "$REPO_ROOT/extensions/intellij/build/distributions" -maxdepth 1 -name "continue-intellij-extension-*.zip" -print -quit)
echo "Plugin artifact located at: $ARTIFACT_PATH"

# Link to build/ directory
mkdir -p "$REPO_ROOT/build"
GIT_DESCRIBE=$(git describe --tags --dirty --always)
BASE_NAME=$(basename "$ARTIFACT_PATH" .zip)
NEW_NAME="${BASE_NAME}-${GIT_DESCRIBE}.zip"
mv "$ARTIFACT_PATH" "$REPO_ROOT/build/$NEW_NAME"
echo "✅ Moved to: $REPO_ROOT/build/$NEW_NAME"
