#!/bin/sh

# 1. Remove unwanted stuff
rm -rf build
rm -rf env
rm -rf dist
rm -rf server/.venv
rm -rf .tiktoken_cache

# 2. Create a new virtual environment and activate it
python3 -m venv env
. env/bin/activate

# 3. Install the required packages
pip install -r server/requirements.txt || exit 1
pip install pyinstaller || exit 1

# 4. Detect M1 architecture or allow manual override
USE_ARCH="intel"
if [ "$1" = "m1" ]; then
    echo "Building for M1 architecture"
    USE_ARCH="m1"
elif [ "$1" = "regular" ]; then
    echo "Building for regular architecture"
    USE_ARCH="intel"
else
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        echo "$ARCH architecture detected, using M1 spec file"
        USE_ARCH="m1"
    else
        echo "$ARCH architecture detected, using regular spec file"
        USE_ARCH="intel"
    fi
fi

# 4.5. Make .tiktoken_cache directory, used to package with tiktoken vocab file
mkdir .tiktoken_cache

# 5. Call PyInstaller from within the virtual environment
env/bin/pyinstaller continue_server.spec -- --arch $USE_ARCH

# 6. Deactivate the virtual environment
deactivate
