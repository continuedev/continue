#!/usr/bin/env bash
# Forbid old Continue identifiers from creeping back in during the Yuto Agentic rebrand.
# See NAMING.md for the spec.
#
# Usage:
#   scripts/check-rebrand.sh           # check the working tree
#   scripts/check-rebrand.sh --staged  # check only staged files (for pre-commit)
#
# Exits non-zero if any forbidden identifier is found outside the allowlist.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Patterns that must not appear in source. Each is anchored to a brand-tied
# prefix/suffix so unrelated uses of the word "continue" (the JS keyword,
# prose, etc.) do not match.
PATTERNS=(
  '@continuedev/'
  'continue\.dev'
  'continue-binary'
  'CONTINUE_GLOBAL_DIR'
  'Continue\.continue'
  'com\.github\.continuedev'
  '\.continueignore'
  '\.continuerc'
)

# Paths/files allowed to keep mentioning the old identifiers (history, vendored
# code, third-party manifests, the rebrand spec itself, this script).
ALLOWLIST=(
  ':!NAMING.md'
  ':!scripts/check-rebrand.sh'
  ':!CHANGELOG.md'
  ':!**/CHANGELOG.md'
  ':!core/vendor/**'
  ':!manual-testing-sandbox/**'
  ':!**/node_modules/**'
  ':!**/dist/**'
  ':!**/out/**'
  ':!**/build/**'
  ':!**/.gradle/**'
  ':!**/*.lock'
  ':!**/package-lock.json'
  ':!**/pnpm-lock.yaml'
  ':!**/yarn.lock'
)

mode="working"
if [[ "${1:-}" == "--staged" ]]; then
  mode="staged"
fi

violations=0
for pat in "${PATTERNS[@]}"; do
  if [[ "$mode" == "staged" ]]; then
    files=$(git diff --cached --name-only --diff-filter=ACMR -- "${ALLOWLIST[@]}" || true)
    [[ -z "$files" ]] && continue
    matches=$(printf '%s\n' "$files" | xargs -I{} git grep -nE -- "$pat" -- {} 2>/dev/null || true)
  else
    matches=$(git grep -nE -- "$pat" -- "${ALLOWLIST[@]}" 2>/dev/null || true)
  fi
  if [[ -n "$matches" ]]; then
    echo "Forbidden identifier matching /$pat/:" >&2
    printf '%s\n' "$matches" >&2
    echo >&2
    violations=$((violations + 1))
  fi
done

if [[ "$violations" -gt 0 ]]; then
  echo "check-rebrand: $violations forbidden pattern(s) detected. See NAMING.md." >&2
  exit 1
fi

echo "check-rebrand: OK"
