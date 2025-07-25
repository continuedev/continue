# Build @continuedev packages for monorepo style linking

# Use npm ci in CI, npm install in development
if [ "$CI" = "true" ]; then
    NPM_INSTALL_CMD="npm ci"
else
    NPM_INSTALL_CMD="npm install"
fi

cd packages

# Phase 1: Build config-types (foundation - no dependencies)
cd config-types
$NPM_INSTALL_CMD
npm run build
cd ..

# Phase 2: Build packages that depend on config-types
cd fetch
$NPM_INSTALL_CMD
npm run build
cd ..

cd config-yaml
$NPM_INSTALL_CMD
npm run build
cd ..

cd llm-info
$NPM_INSTALL_CMD
npm run build
cd ..

# Phase 3: Build packages that depend on other local packages
cd openai-adapters
$NPM_INSTALL_CMD
npm run build
cd ..

cd continue-sdk
$NPM_INSTALL_CMD
npm run build
cd ..