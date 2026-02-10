---
name: Test Coverage
description: Ensure new functionality includes corresponding tests
---

# Test Coverage Check

Review this pull request to determine if new functionality has adequate test coverage.

## When Tests Are Expected

1. **New exported functions or classes** - Any new public function, class, or module that is exported and used by other parts of the codebase should have at least basic unit tests covering:
   - The happy path (expected inputs produce expected outputs)
   - Edge cases (empty inputs, null/undefined, boundary values)
   - Error cases (invalid inputs throw or return appropriate errors)

2. **New CLI commands or subcommands** - Should have:
   - Smoke tests verifying the command registers and runs
   - Tests for flag parsing and validation
   - Tests for expected output format

3. **Bug fixes** - If a PR fixes a bug, there should be a regression test that:
   - Reproduces the original bug condition
   - Verifies the fix resolves it

4. **New API endpoints or handlers** - Should have integration tests covering:
   - Successful request/response
   - Error responses for invalid inputs
   - Authentication/authorization (if applicable)

## When Tests Are NOT Expected

- Documentation-only changes
- Configuration file changes (YAML, JSON, Markdown)
- CSS/styling changes
- Dependency updates (unless they change behavior)
- Agent definition files (`.continue/agents/*.md`)
- Refactors that don't change behavior (existing tests should still pass)
- Internal implementation changes fully covered by existing tests

## What to Do

- If new functionality lacks tests, add a PR comment noting what should be tested and why.
- Do NOT write tests yourself. The author knows the intended behavior best.
- If the PR includes tests but they seem incomplete (missing edge cases, no error cases), note the gaps.
- If the PR is clearly a test-exempt category (docs, config, styling), do nothing.

## Test Infrastructure Reference

- **Core**: Jest (`*.test.ts`) + Vitest (`*.vitest.ts`) in `core/`
- **GUI**: Vitest (`*.test.ts`) in `gui/src/`
- **CLI**: Vitest (`*.test.ts`, `*.e2e.test.ts`) in `extensions/cli/`
- **Packages**: Vitest in each `packages/*/` directory
