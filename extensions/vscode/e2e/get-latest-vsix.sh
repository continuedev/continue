#!/bin/bash

# echo pwd
echo "Current directory: $(pwd)"

# Find the latest VSIX file in the build directory
latest_vsix=$(ls -t ./build/continue-*.vsix | head -n1)

if [ -z "$latest_vsix" ]; then
    echo "No VSIX file found in build directory"
    exit 1
fi

# Create e2e/vsix directory if it doesn't exist
mkdir -p "./e2e/vsix"

# Copy the file to e2e directory with fixed name
cp "$latest_vsix" "./e2e/vsix/continue.vsix"