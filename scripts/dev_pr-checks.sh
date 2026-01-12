#!/bin/bash
set -e          # Exit on error
set -o pipefail # Fail if any command in a pipe fails

# Ensure we are in the root of the repo
cd "$(dirname "$0")/.."

echo "🚀 Starting Local CI Simulation..."

# 0. Merge Check
echo "-----------------------------------"
echo "🔀 Checking for merge conflicts with main..."
git fetch origin main >/dev/null 2>&1
# Using merge-tree to check for conflicts without touching working directory
# grep returns 0 (true) if found, 1 (false) if not. We want to fail if found.
if git merge-tree "$(git merge-base HEAD origin/main)" HEAD origin/main | grep -q "<<<<<<<"; then
	echo "❌ Merge conflicts detected with origin/main! Please rebase or merge main."
	exit 1
else
	echo "✅ Branch merges cleanly with main"
fi

# 1. Prettier Check
echo "-----------------------------------"
echo "📝 Checking Formatting (Prettier)..."
npx prettier --check "**/*.{js,jsx,ts,tsx,json,css,md}" --ignore-path .gitignore --ignore-path .prettierignore

# Helper to check command
run_install() {
	local dir=$1
	echo "📦 Installing in $dir..."
	pushd "$dir" >/dev/null
	if ! npm ci; then
		echo "❌ 'npm ci' failed in $dir."
		echo "💡 Try running './scripts/dev_lockfile-sync.sh' to update package-lock.json."
		popd >/dev/null
		exit 1
	fi
	popd >/dev/null
}

# 2. Core Checks
echo "-----------------------------------"
echo "🧠 Checking Core (Lint, Types, Test)..."
run_install core
cd core
npx tsc --noEmit
npm run lint
# Skip API tests locally since we don't have secrets
export IGNORE_API_KEY_TESTS=true
npm test -- --detectOpenHandles
# npm run vitest # Optional: heavy
cd ..

# 3. GUI Checks
echo "-----------------------------------"
echo "🖥️ Checking GUI (Lint, Types, Test)..."
run_install gui
cd gui
npx tsc --noEmit
npm run lint
npm test
cd ..

# 4. VS Code Extension Checks
echo "-----------------------------------"
echo "🆚 Checking VS Code Extension (Lint, Types, Test)..."
run_install extensions/vscode
cd extensions/vscode
npm run write-build-timestamp
npx tsc --noEmit
npm run lint
npm run vitest
cd ../..

echo "-----------------------------------"
echo "✅ All Checks Passed! Your branch is likely ready for PR."
