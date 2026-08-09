---
name: Stale & Misleading Comments
description: Flag comments that no longer match the code they describe.
---

# Stale & Misleading Comments

## Context

In a fast-moving TypeScript monorepo with many contributors, comments frequently fall out of sync with the code they describe. A misleading comment is worse than no comment — it actively misdirects developers and causes bugs. This check catches comments that contradict, no longer match, or misrepresent adjacent code.

## What to Check

### 1. Comments That Contradict the Code

Look for inline comments (`//`) and block comments (`/* */`) where the description no longer matches what the code actually does.

**BAD — comment says "retry" but code doesn't retry:**

```typescript
// Retry the request on failure
const result = await fetch(url);
```

**BAD — comment describes old parameter list:**

```typescript
// Takes a model name and returns the provider
function getProvider(config: ModelConfig, context: ContextManager) {
```

**GOOD — comment matches behavior:**

```typescript
// Resolve provider from full model configuration and context
function getProvider(config: ModelConfig, context: ContextManager) {
```

### 2. TODO/FIXME/HACK Comments for Completed Work

Flag TODO, FIXME, and HACK comments where the described work appears to already be done in the surrounding code.

**BAD — TODO says to add validation, but validation exists below:**

```typescript
// TODO: add input validation
if (!input || typeof input !== "string") {
  throw new Error("Invalid input");
}
```

### 3. Commented-Out Code With Misleading Annotations

Flag blocks of commented-out code that have an annotation suggesting they're still needed, when the functionality has been replaced or removed.

**BAD:**

```typescript
// Keep this for fallback support
// const oldProvider = new LegacyProvider(config);
// oldProvider.initialize();
const provider = new ModernProvider(config);
```

### 4. JSDoc / Docstrings That Mismatch Signatures

Check that `@param`, `@returns`, and `@throws` tags in JSDoc comments match the actual function signature — correct parameter names, types, and return type.

**BAD — documents a param that doesn't exist:**

```typescript
/**
 * @param modelName - The model to use
 * @returns The completion text
 */
async function complete(config: AutocompleteConfig): Promise<Result> {
```

## Key Files to Check

- `core/` — shared logic across all extensions
- `extensions/vscode/src/` — VS Code extension source
- `extensions/cli/src/` — CLI extension source
- `gui/src/` — React GUI components
- `packages/` — shared npm packages

## Exclusions

- License headers and copyright notices
- Comments in generated files, vendored code, or `node_modules`
- Comments in test files that describe expected (intentionally wrong) behavior
- Commented-out code in test fixtures used as test data
