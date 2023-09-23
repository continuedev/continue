#!/bin/sh

# 1. Remove unwanted stuff
rm -rf build
rm -rf env
rm -rf dist
rm -rf continuedev/.venv

# 2. Create a new virtual environment and activate it
python3 -m venv env
. env/bin/activate

# 3. Install the required packages
pip install -r continuedev/requirements.txt

pip install pyinstaller

# 4. Call PyInstaller from within the virtual environment
env/bin/pyinstaller run.spec

# 5. Deactivate the virtual environment
deactivate