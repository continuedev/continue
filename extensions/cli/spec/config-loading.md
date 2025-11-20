# Configuration Loading Behavior Specification

## Overview

This document specifies the behavior of the CLI's configuration loading system, including precedence rules, authentication interactions, and error handling.

## Authentication Precedence

**Authentication Source Priority:**

1. **Environment Variable**: `CONTINUE_API_KEY` environment variable
2. **File-Based Auth**: `~/.continue/auth.json` file
3. **No Authentication**: Unauthenticated mode

**Authentication Effects:**

- **Environment Auth**: Always uses personal organization, no config URI persistence
- **File Auth**: Supports organizations, persists config URIs, token refresh
- **No Auth**: Limited to default assistant, no personalization

## Configuration Source Precedence

**When CLI is invoked, config source is determined in this order:**

1. **CLI `--config` Flag** (highest priority)

   - File path (starts with `.`, `/`, `~`): Loads local YAML file
   - Assistant slug (`owner/package`): Fetches from Continue platform
   - Overrides any saved preferences

2. **Saved Config URI** (if no `--config` flag)

   - Retrieved from authentication config
   - Converts `file://` URIs back to file paths
   - Converts `slug://` URIs back to assistant slugs

3. **Default Resolution** (if no flag and no saved URI)
   - **Authenticated**: First user assistant from `listAssistants()`
   - **config.yaml**: The saved config file at `~/.continue/config.yaml`
   - **Unauthenticated**: Falls back to `continuedev/default-cli-config`

## Authentication State Interactions

### Authenticated Users

**Available Options:**

- Personal assistants
- Organization assistants (if organization selected)
- Local YAML files
- Public assistants

**Behavior:**

- `listAssistants()` returns personalized results
- Config selections are saved as URIs in auth config
- Organization context affects available assistants

### Unauthenticated Users

**Available Options:**

- Local YAML files only
- Default assistant (`continuedev/default-cli-config`)

**Behavior:**

- No access to personal or organization assistants
- No config URI persistence
- Direct fallback to default when no config specified

### Environment Variable Auth (`CONTINUE_API_KEY`)

**Behavior:**

- Treated as authenticated for API access
- Always uses personal organization context
- No persistence of config URIs
- Cannot switch organizations

## Organization Context

**Organization Selection:**

- **Interactive Mode**: Auto-selects first available organization
- **Headless Mode**: Defaults to personal organization
- **Environment Auth**: Always personal organization

**Effects on Config Loading:**

- Organization ID passed to all API calls
- Affects which assistants appear in `listAssistants()`
- Organization changes trigger complete config reload

## Error Handling Behavior

### Config Loading Errors

**File Not Found:**

- Local file specified but doesn't exist
- **Result**: Error thrown, CLI exits

**Invalid YAML:**

- Local file exists but has syntax errors
- **Result**: Parsing error thrown, CLI exits

**Network Failures:**

- API calls fail for assistant slugs
- **Result**: Network error bubbled up, CLI exits

**Assistant Not Found:**

- Valid slug format but assistant doesn't exist
- **Result**: 404 error from API, CLI exits

### Fallback Scenarios

**No User Assistants:**

- Authenticated user has no personal assistants
- **Result**: Falls back to `continuedev/default-cli-config`

**Default Agent Unavailable:**

- Fallback to default agent fails
- **Result**: Error thrown, CLI cannot start

**Token Expired:**

- Saved auth token is expired
- **Result**: Automatic refresh attempted, re-auth required if refresh fails

## Config URI Persistence

**When URIs are Saved:**

- Any successful config load via service layer
- File paths converted to `file://path/to/config.yaml`
- Assistant slugs converted to `slug://owner/package`

**When URIs are NOT Saved:**

- Environment variable authentication in use
- Config loading failures
- Unauthenticated sessions

## Rule Integration

**Rule Processing:**

- `--rule` flags processed independently of config loading
- Multiple rules supported, injected into system message
- Rule failures are warnings, don't prevent config loading
- Rule sources: file paths, hub slugs, direct strings

## Session Continuity

**Next Session Behavior:**

- **With Saved URI**: Uses saved config automatically
- **CLI Override**: `--config` flag overrides saved URI and updates it
- **Config Switching**: UI actions update saved URI for future sessions

**Cross-Session State:**

- Authentication persists until logout
- Organization selection persists
- Config URI persists (except for environment auth)

## Complete Decision Flow

```
1. Parse CLI arguments
2. Load authentication state (env var > file > none)
3. Determine config source:
   - CLI --config flag provided? Use it
   - Saved config URI exists? Use it
   - Default resolution based on auth state
4. Load configuration:
   - File path? Parse YAML locally
   - Assistant slug? Fetch from API
   - Default resolution? List assistants or use default
5. Process and inject rules
6. Save config URI (if authenticated via file)
7. Initialize services with loaded config
```

This behavior ensures users get predictable config loading with clear precedence rules while maintaining session continuity and graceful fallbacks.
