#!/bin/bash
set -e

# Core
echo "📦 Syncing core..."
cd core
npm install
cd ..

# GUI
echo "🖥️ Syncing gui..."
cd gui
npm install
cd ..

# VS Code Extension
echo "🆚 Syncing extensions/vscode..."
cd extensions/vscode
npm install
cd ../..

# Binary
echo "⚙️ Syncing binary..."
cd binary
npm install
cd ..

# Packages
echo "📦 Syncing packages..."
for dir in packages/*; do
	if [ -d "$dir" ]; then
		echo "  Syncing $dir..."
		cd "$dir"
		npm install
		cd ../..
	fi
done

echo "✅ All lockfiles synced!"
