---
name: Breaking Change Detector
description: Flag renamed commands, APIs, or config options with stale references
---

# Breaking Change Detector

Analyze this pull request for breaking changes that may leave stale references elsewhere in the codebase.

## What Constitutes a Breaking Change

1. **CLI command renames or removals** - If a command registered in `extensions/cli/src/commands/` is renamed, removed, or has its flags changed, check that:
   - Documentation in `docs/` reflects the new name
   - Agent definitions in `.continue/agents/` don't reference the old command
   - Skills in `skills/` are updated
   - README and CONTRIBUTING.md are current
   - GitHub Actions workflows don't invoke the old command

2. **Public API changes** - If exported functions, interfaces, or types in `core/` or `packages/` are renamed or have signature changes, check that:
   - All callers in `gui/`, `extensions/`, and `binary/` are updated
   - Type definitions in `packages/config-types/` are consistent

3. **Configuration schema changes** - If config file formats (YAML or JSON) are modified, check that:
   - Validation logic handles both old and new formats (or migration is provided)
   - Documentation examples use the new format
   - Default configs are updated

4. **URL changes** - If any hardcoded URLs (e.g., `hub.continue.dev`, `api.continue.dev`) are changed, scan for stale references across the repo.

## What to Do

- If you find stale references, fix them directly.
- If a breaking change has no migration path and could affect users, add a comment noting the concern but do not block.
- Focus only on changes introduced in this PR. Do not flag pre-existing issues.

## What NOT to Flag

- Internal refactors where all references are updated in the same PR
- Changes to test-only code
- Changes to development tooling that don't affect users
