#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e

# Ensure nvm is available in non-interactive shells (like VS Code tasks).
if [ -z "${NVM_DIR:-}" ]; then
    export NVM_DIR="$HOME/.nvm"
fi

# VS Code task terminals can be reused, which may leave NPM_CONFIG_PREFIX set
# from prior runs. nvm refuses to initialize in that state.
unset NPM_CONFIG_PREFIX
unset npm_config_prefix

if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
fi

# Check if node version matches .nvmrc
if [ -f .nvmrc ]; then
    required_node_version=$(cat .nvmrc)

    # If nvm is available, automatically switch to the required version.
    if command -v nvm >/dev/null 2>&1; then
        nvm install "$required_node_version"
        nvm use "$required_node_version"
    fi

    current_node_version=$(node -v)
    
    # Remove 'v' prefix from versions for comparison
    required_version=${required_node_version#v}
    current_version=${current_node_version#v}

    if [ "$required_version" != "$current_version" ]; then
        echo "⚠️  Warning: Your Node.js version ($current_node_version) does not match the required version ($required_node_version)"
        echo "Please consider switching to the correct version using: nvm use"
        
        if [ -t 0 ]; then
            read -p "Press Enter to continue with installation anyway..."
        else
            echo "Continuing with installation anyway..."
        fi
        echo
    fi
fi

# Use a user-local npm global prefix so `npm link` works without sudo.
# This must be set after nvm install/use because nvm rejects shells
# where NPM_CONFIG_PREFIX is defined.
NPM_LOCAL_PREFIX="${HOME}/.npm-global"
mkdir -p "$NPM_LOCAL_PREFIX"
export NPM_CONFIG_PREFIX="$NPM_LOCAL_PREFIX"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

echo "Installing root-level dependencies..."
npm install

echo "Building packages (fetch, openai-adapters, config-yaml)..."
node ./scripts/build-packages.js

echo "Installing Core extension dependencies..."
pushd core
## This flag is set because we pull down Chromium at runtime
export PUPPETEER_SKIP_DOWNLOAD='true'
# Use --ignore-scripts first to avoid snap npm's PATH issue (node_modules/.bin
# not added to PATH for install scripts), then rebuild native addons explicitly.
npm install --ignore-scripts
npm rebuild
npm link
popd

echo "Installing GUI extension dependencies..."
pushd gui
npm install
npm link @continuedev/core --ignore-scripts
NODE_OPTIONS="--max-old-space-size=4096" npm run build
popd

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode
# Clear cached ripgrep archives that can become corrupted and break postinstall.
rm -rf /tmp/vscode-ripgrep-cache-*
# This does way too many things inline but is the common denominator between many of the scripts
npm install
npm link @continuedev/core --ignore-scripts
# npm run prepackage # not required since npm run package has prescript of prepackage
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