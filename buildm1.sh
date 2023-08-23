
#!/bin/sh

# 1. Remove continuedev/.venv
rm -rf continuedev/.venv

# 2. Run pyinstaller run.m1.spec
pyinstaller run.m1.spec

# 3. Reinstall poetry deps
cd continuedev && poetry install