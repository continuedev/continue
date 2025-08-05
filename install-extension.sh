#!/bin/bash

# Build and install the Continue extension for VS Code
echo "Building Continue extension..."
cd extensions/vscode

# Run the build process
echo "Running prepackage..."
npm run prepackage

echo "Running esbuild..."
npm run esbuild

echo "Packaging extension..."
npm run package

# Go back to root directory
cd ../..

# Install the extension
echo "Installing Continue extension..."
code --install-extension extensions/vscode/build/continue-1.1.72.vsix --force

echo "Extension installed successfully!"
echo "You can now open VS Code and use the Continue extension with your EchoMCP backend."
echo ""
echo "Configuration is located at: ~/.continue/config.json"
echo "MCP Server should be running on: http://localhost:8000"