#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e

# Set the correct Node version at the start of the script
setup_node_version() {
  # Get required node version from .node-version or .nvmrc
  if [ -f .node-version ]; then
    required_node_version=$(cat .node-version)
  elif [ -f .nvmrc ]; then
    required_node_version=$(cat .nvmrc)
  else
    echo "No .node-version or .nvmrc file found. Skipping Node.js version check."
    return
  fi

  # Remove 'v' prefix if present
  required_version=${required_node_version#v}

  # Try fnm first
  if command -v fnm &> /dev/null; then
    echo "📦 Using fnm to set Node.js version to $required_version..."
    # Capture output to avoid duplicate messages
    eval "$(fnm env --use-on-cd)" &> /dev/null
    fnm use "$required_version" &> /dev/null || fnm use &> /dev/null
  # Then try nvm
  elif command -v nvm &> /dev/null || [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "📦 Using nvm to set Node.js version to $required_version..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # Load nvm
    nvm use "$required_version" &> /dev/null || nvm use &> /dev/null
  # Fall back to version check only
  else
    echo "Neither fnm nor nvm found. Proceeding with current Node.js version."
  fi

  # Verify the current Node.js version after our attempt to set it
  current_node_version=$(node -v)
  current_version=${current_node_version#v}

  if [ "$required_version" != "$current_version" ]; then
    echo "⚠️  Warning: Your Node.js version ($current_node_version) does not match the required version (v$required_version)"
    echo "Even after attempting to use version managers, the correct version couldn't be activated."
    if [ -t 0 ]; then
      read -p "Press Enter to continue with installation anyway..."
    else
      echo "Continuing with installation anyway..."
    fi
    echo
  else
    echo "✅ Using Node.js $current_node_version as required."
  fi
}

# Run the node version setup
setup_node_version

echo "Installing root-level dependencies..."
npm install

echo "Building config-yaml..."
pushd packages/config-yaml
npm install
npm run build
popd

echo "Installing Core extension dependencies..."
pushd core
## This flag is set because we pull down Chromium at runtime
export PUPPETEER_SKIP_DOWNLOAD='true'
npm install
npm link
popd

echo "Installing GUI extension dependencies..."
pushd gui
npm install
npm link @continuedev/core
npm run build
popd

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode
# This does way too many things inline but is the common denominator between many of the scripts
npm install
npm link @continuedev/core
npm run prepackage
npm run package
popd

echo "Installing binary dependencies..."
pushd binary
npm install
npm run build
popd

echo "Installing docs dependencies..."
pushd docs
npm install
popd
