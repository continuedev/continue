# Build @continuedev packages for monorepo style linking

# Use npm ci in CI, npm install in development
if [ "$CI" = "true" ]; then
    NPM_INSTALL_CMD="npm ci"
else
    NPM_INSTALL_CMD="npm install"
fi

cd packages

# Build fetch first
cd fetch
$NPM_INSTALL_CMD
npm run build
cd ..

# After building fetch, reinstall openai-adapters to pick up the new build
cd openai-adapters
$NPM_INSTALL_CMD
npm run build
cd ..

# Build config-yaml
cd config-yaml
$NPM_INSTALL_CMD
npm run build
cd ..

# Build llm-info
cd llm-info
$NPM_INSTALL_CMD
npm run build
