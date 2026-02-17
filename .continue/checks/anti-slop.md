---
name: Anti-Slop
description: Catch AI-generated code patterns that harm readability and maintainability.
---

## Context

This project has a strict anti-slop policy. AI-generated code is common in this codebase, and when it isn't cleaned up, it creates bloat that compounds over time. This check enforces the standards in `.continue/rules/anti-slop.md`.

## What to Check

Review the PR diff for these patterns:

### Overly verbose comments

Comments that restate what the code already says.

```typescript
// Bad - comment restates the code
// Increment the counter by one
counter++;

// Set the user's name to the provided value
user.name = name;

// Good - comment explains WHY, not WHAT
// Reset after overflow to prevent stale cache entries
counter = 0;
```

### Filler documentation

JSDoc or docstrings that add no information beyond the function signature.

```typescript
// Bad
/**
 * Gets the user by ID.
 * @param id - The user ID.
 * @returns The user.
 */
function getUserById(id: string): User { ... }

// Good - no docs needed, the signature is self-documenting
function getUserById(id: string): User { ... }
```

### Over-abstraction

Interfaces with single implementations, factories that create one thing, strategy patterns for two options, unnecessary wrapper functions.

```typescript
// Bad - abstraction for one implementation
interface IUserService { getUser(id: string): User }
class UserService implements IUserService { ... }

// Good - just use the class directly
class UserService { getUser(id: string): User { ... } }
```

### Unnecessary intermediate variables

Variables used exactly once on the next line purely to "name" a step.

```typescript
// Bad
const trimmedInput = input.trim();
const result = processInput(trimmedInput);
return result;

// Good
return processInput(input.trim());
```

### Boilerplate explosion

Creating separate classes, functions, or files for trivial operations that could be a simple expression.

### Excessive defensive programming

Unnecessary null checks, try-catches, or validations that clutter the logic without real safety value. Trust internal code and framework guarantees.

### Redundant type annotations

Type declarations that TypeScript already infers.

```typescript
// Bad
const count: number = 0;
const name: string = "hello";
const items: string[] = ["a", "b"];

// Good
const count = 0;
const name = "hello";
const items = ["a", "b"];
```

## Pass/Fail Criteria

- **Pass** if the diff is free of the patterns above, or only has minor instances that don't impact readability.
- **Fail** if the diff introduces multiple instances of slop patterns, especially verbose comments, filler docs, or unnecessary abstractions. Call out specific lines.

## Exclusions

- Test files (_.test.ts, _.vitest.ts) where some verbosity aids clarity.
- Generated files or vendored code.
- Comments that explain complex business logic, workarounds, or non-obvious decisions (these are valuable, not slop).
