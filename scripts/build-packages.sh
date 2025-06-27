# Build @continuedev packages for monorepo style linking

cd packages
cd openai-adapters

npm ci
npm run build

cd ..
cd config-yaml

npm ci
npm run build
