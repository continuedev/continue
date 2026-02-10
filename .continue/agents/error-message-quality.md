---
name: Error Message Quality
description: Ensure error handling surfaces actionable messages to users
---

# Error Message Quality Check

Review this pull request for error handling quality. The most common user-facing issues in this codebase are generic "Unknown error" messages and swallowed error details that prevent users from diagnosing problems themselves.

## What to Check

1. **Catch blocks that discard error details** - Look for `catch` blocks that re-throw or return a generic message without including the original error's message, status code, or context.

2. **HTTP status codes without user-friendly mapping** - When making API calls (especially to LLM providers), ensure that common HTTP errors produce distinct, actionable messages:
   - `401` → "Invalid API key" (not "Unknown error")
   - `402` → "Insufficient funds or quota exceeded"
   - `403` → "Access denied - check your API key permissions"
   - `429` → "Rate limited - please wait and retry"
   - `5xx` → "Provider service error - try again later"

3. **Silent failures** - Look for empty catch blocks, caught errors that are only logged but not surfaced, or promise rejections that are swallowed.

4. **Error messages that lack context** - Error messages should include what operation failed and what the user can do about it, not just the raw error string.

## What NOT to Flag

- Internal error handling between modules where errors are properly propagated up
- Test files
- Debug/development-only error logging
- Errors that are intentionally caught and handled silently (with a clear code comment explaining why)

## Scope

Only review files changed in this PR. Do not audit the entire codebase. If you find issues, make targeted fixes to improve the error messages in the changed code. If no error handling issues exist in the changed files, do nothing.
