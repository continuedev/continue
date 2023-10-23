@echo off

REM 1. Remove unwanted stuff
rmdir /s /q build
rmdir /s /q env
rmdir /s /q dist
rmdir /s /q server\.venv

REM 2. Create a new virtual environment and activate it
python -m venv env
call env\Scripts\activate

REM 3. Install the required packages
pip install -r server\requirements.txt

pip install pyinstaller

REM 4. Call PyInstaller from within the virtual environment
env\Scripts\pyinstaller continue_server.spec

REM 5. Deactivate the virtual environment
call env\Scripts\deactivate.bat
