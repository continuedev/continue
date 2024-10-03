#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e

export PUPPETEER_SKIP_DOWNLOAD='true'

npm install
npm run build
npm run prepackage -w extensions/vscode
npm run package -w extensions/vscode