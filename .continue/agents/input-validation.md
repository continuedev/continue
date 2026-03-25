---
name: Input Validation
description: Ensure user-facing inputs have proper validation and error feedback
---

# Input Validation Check

Review this pull request for input validation quality. The most common user issues in this codebase stem from malformed API keys, blank inputs, and missing configuration values that produce confusing downstream errors.

## What to Check

1. **API keys and secrets** - Any code that accepts API keys, tokens, or credentials should:

   - Reject obviously invalid values (empty strings, whitespace-only, placeholder text like "your-api-key-here")
   - Validate format where possible (e.g., OpenAI keys start with `sk-`, Anthropic keys start with `sk-ant-`)
   - Provide a clear error message before making a network request with a bad key

2. **Configuration values** - New or modified config parsing should:

   - Validate required fields are present and non-empty
   - Validate types (e.g., numbers are actually numbers, URLs are valid URLs)
   - Provide clear error messages that name the specific field and expected format
   - Not crash the entire config loading process for a single invalid value

3. **User text inputs** - New or modified UI inputs should:

   - Handle empty/whitespace-only submissions gracefully
   - Sanitize inputs that will be used in file paths, URLs, or shell commands
   - Not allow submission of invalid data that will fail silently later

4. **URL and endpoint validation** - When users provide custom URLs (e.g., for self-hosted LLM endpoints):
   - Validate URL format
   - Handle missing protocol (add `https://` if missing)
   - Provide feedback before attempting connection

## What NOT to Flag

- Internal function parameters (trust internal callers)
- Test inputs
- Validation that already exists and is working correctly
- Configuration values with sensible defaults that don't require user input

## Scope

Only review files changed in this PR. If you find missing validation, add it directly. Keep fixes minimal and focused. If no user-facing input handling was changed, do nothing.
