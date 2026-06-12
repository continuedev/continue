#!/usr/bin/env bash
# Local CI mirroring .github/workflows/pr-checks.yaml (verify jobs only).
#
# Usage (from continue/):
#   bash scripts/ci-local.sh              # PR RodiumAi (recommandé avant commit)
#   bash scripts/ci-local.sh --full       # suite complète (comme GitHub CI)
#   bash scripts/ci-local.sh --full-packages
#   IGNORE_API_KEY_TESTS=false bash scripts/ci-local.sh --full

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CI_MODE="rodiumai"
FULL_PACKAGES=false
for arg in "$@"; do
  case "$arg" in
    --rodiumai) CI_MODE="rodiumai" ;;
    --full) CI_MODE="full" ;;
    --full-packages) FULL_PACKAGES=true ;;
    -h | --help)
      echo "Usage: bash scripts/ci-local.sh [--rodiumai|--full] [--full-packages]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

export IGNORE_API_KEY_TESTS="${IGNORE_API_KEY_TESTS:-true}"
export CI=true
PRETTIER_SCOPE="${PRETTIER_SCOPE:-pr}"
PR_FILES_MANIFEST="${PR_FILES_MANIFEST:-scripts/ci-local-pr-files.txt}"

step() {
  echo ""
  echo "==> $1"
}

fail() {
  echo "CI FAILED at: $1" >&2
  exit 1
}

run() {
  echo "+ $*"
  "$@" || fail "$1"
}

step "Node $(node -v) | mode=$CI_MODE | IGNORE_API_KEY_TESTS=$IGNORE_API_KEY_TESTS"

if [[ "${FORCE_NPM_CI:-false}" == "true" ]]; then
  step "Clean node_modules for Linux reinstall"
  rm -rf core/node_modules gui/node_modules binary/node_modules extensions/vscode/node_modules
fi

step "Install root dependencies"
if [[ ! -d node_modules ]]; then
  run npm ci
fi

step "Prettier check ($PRETTIER_SCOPE)"
if [[ "$PRETTIER_SCOPE" == "all" ]]; then
  run npx prettier --check "**/*.{js,jsx,ts,tsx,json,css,md}" --ignore-path .gitignore --ignore-path .prettierignore
elif [[ "$PRETTIER_SCOPE" == "pr" && -f "$PR_FILES_MANIFEST" ]]; then
  mapfile -t CHANGED_FILES < <(
    grep -Ev '^\s*(#|$)' "$PR_FILES_MANIFEST" | while read -r f; do
      [[ -f "$f" ]] && echo "$f"
    done
  )
  if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
    echo "No PR manifest files found; skipping Prettier."
  else
    echo "Checking ${#CHANGED_FILES[@]} PR file(s) from $PR_FILES_MANIFEST"
    run npx prettier --check "${CHANGED_FILES[@]}"
  fi
else
  echo "Unknown PRETTIER_SCOPE=$PRETTIER_SCOPE; skipping Prettier."
fi

step "Build packages"
run node ./scripts/build-packages.js

step "Core: install"
if [[ "${FORCE_NPM_CI:-false}" == "true" || ! -d core/node_modules ]]; then
  run bash -c "cd core && npm ci"
fi

step "Core: typecheck + lint"
run bash -c "cd core && npx tsc --noEmit"
run bash -c "cd core && npm run lint"

if [[ "$CI_MODE" == "rodiumai" ]]; then
  step "Core: RodiumAi tests (jest + vitest)"
  run bash -c "cd core && npm test -- fetchRodiumAiModels.test.ts"
  run bash -c "cd core && npm run vitest -- llm/llms/RodiumAi.vitest.ts llm/llms/OpenRouter.vitest.ts"
else
  step "Core: jest + vitest (full)"
  run bash -c "cd core && npm test"
  run bash -c "cd core && npm run vitest"
fi

if [[ "$CI_MODE" == "full" ]]; then
  step "GUI: install"
  if [[ "${FORCE_NPM_CI:-false}" == "true" || ! -d gui/node_modules ]]; then
    run bash -c "cd gui && npm ci"
  fi

  step "GUI: typecheck + lint + tests"
  run bash -c "cd gui && npx tsc --noEmit"
  run bash -c "cd gui && npm run lint"
  run bash -c "cd gui && npm test"

  step "Binary: install"
  if [[ "${FORCE_NPM_CI:-false}" == "true" || ! -d binary/node_modules ]]; then
    run bash -c "cd binary && npm ci"
  fi

  step "Binary: typecheck"
  run bash -c "cd binary && npx tsc --noEmit"

  step "VS Code extension: install"
  if [[ "${FORCE_NPM_CI:-false}" == "true" || ! -d extensions/vscode/node_modules ]]; then
    run bash -c "cd extensions/vscode && npm ci"
  fi

  step "VS Code extension: typecheck + lint + vitest"
  run bash -c "cd extensions/vscode && npm run write-build-timestamp"
  run bash -c "cd extensions/vscode && npx tsc --noEmit"
  run bash -c "cd extensions/vscode && npm run lint"
  run bash -c "cd extensions/vscode && npm run vitest"
else
  step "GUI: typecheck (PR RodiumAi)"
  if [[ "${FORCE_NPM_CI:-false}" == "true" || ! -d gui/node_modules ]]; then
    run bash -c "cd gui && npm ci"
  fi
  run bash -c "cd gui && npx tsc --noEmit"
fi

PACKAGES=(openai-adapters)
if [[ "$FULL_PACKAGES" == "true" ]]; then
  PACKAGES=(config-types config-yaml continue-sdk fetch llm-info openai-adapters terminal-security)
fi

for pkg in "${PACKAGES[@]}"; do
  step "Package $pkg: install + test"
  run bash -c "cd packages/$pkg && npm ci"
  if [[ "$pkg" == "openai-adapters" && "$IGNORE_API_KEY_TESTS" == "true" ]]; then
    run bash -c "cd packages/$pkg && npm test -- --run --exclude '**/vercel-sdk.test.ts'"
  else
    run bash -c "cd packages/$pkg && npm test"
  fi
done

echo ""
if [[ "$CI_MODE" == "rodiumai" ]]; then
  echo "CI locale OK (mode PR RodiumAi: prettier, core, gui tsc, openai-adapters)."
  echo "Pour la suite complète GitHub: bash scripts/ci-local.sh --full (ou -Full sur ps1)."
else
  echo "CI locale OK (mode full: prettier, core, gui, binary, vscode, packages)."
fi
echo "Non exécuté localement: vscode-e2e-tests, jetbrains-tests (infra CI GitHub)."
