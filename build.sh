#!/bin/sh

# 1. Remove unwanted stuff
rm -rf build
rm -rf env
rm -rf dist
rm -rf server/.venv

# 2. Create a new virtual environment and activate it
python3 -m venv env
. env/bin/activate

# 3. Install the required packages
pip install -r server/requirements.txt
pip install pyinstaller

# 4. Detect M1 architecture or allow manual override
if [ "$1" = "m1" ]; then
    echo "Building for M1 architecture"
    SPEC_FILE="continue_server.m1.spec"
elif [ "$1" = "regular" ]; then
    echo "Building for regular architecture"
    SPEC_FILE="continue_server.spec"
else
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        echo "$ARCH architecture detected, using M1 spec file"
        SPEC_FILE="continue_server.m1.spec"
    else
        echo "$ARCH architecture detected, using regular spec file"
        SPEC_FILE="continue_server.spec"
    fi
fi

echo "Using $SPEC_FILE"

# 5. Call PyInstaller from within the virtual environment
env/bin/pyinstaller $SPEC_FILE

# 6. Deactivate the virtual environment
deactivate
