# PR: Centralize and Modernize PowerShell Command Detection

## Overview
This PR eliminates hardcoded dependencies on legacy Windows PowerShell (`powershell.exe`) across the codebase and introduces a dynamic, centralized detection mechanism. By intelligently preferring modern PowerShell Core (`pwsh`), we resolve critical runtime failures caused by executing modern scripts in legacy environments, while maintaining backward compatibility.

## Rationale & Technical Implementation Choices

### 1. Centralized Synchronous Detection
A new utility `getPowerShellCommand()` has been added to `core/util/shell.ts`.
- **Why Synchronous (`spawnSync`)?** Several call sites, notably `core/tools/definitions/runTerminalCommand.ts`, invoke the shell detection during module initialization to populate static metadata and configuration. A synchronous implementation was mandatory to prevent `[object Promise]` from bleeding into module-level constants.
- **Performance Tradeoff:** While synchronous process spawning blocks the event loop, this is an explicitly accepted tradeoff. The detection result is cached at the module level for the process lifetime. In the context of a CLI or local developer tool (which is already I/O bound), a one-time synchronous probe does not meaningfully degrade the performance profile.

### 2. Architectural Boundaries & Public API
- **Module Isolation:** The detection logic utilizing the Node.js `child_process` module is strictly isolated in `core/util/shell.ts`. This prevents Node-specific dependencies from being accidentally pulled into non-Node environments (like browser extensions or WASM contexts) that might import from the general utility barrel.
- **Enforcing the Public API:** Instead of allowing consumers (like the CLI extensions) to perform deep internal imports directly from `core/util/shell.js`, the function is re-exported via `core/util/index.ts`. This enforces strict encapsulation and provides a stable import path through the `core` package's public API.

### 3. Robust Test Infrastructure
- **Broad Vitest Aliasing:** Updated `extensions/cli/vitest.config.ts` with a broad `core` alias mapping to the source directory (`../../core/src`). This correctly mirrors the `tsconfig.json` path resolution, allowing tests to run directly against the source files via the public API without requiring tightly coupled, file-specific aliases or a prior build step.
- **Interface Mocking:** Tests now mock the `core/util/index.js` public API rather than intercepting internal `execAsync` or `child_process` calls. This makes the tests resilient to internal implementation changes and focuses verification strictly on the logic's boundaries.

## Verification Results
- Confirmed `pwsh` is correctly preferred when available on Windows.
- Confirmed safe fallback to `powershell` on legacy Windows environments.
- Verified zero module resolution errors during testing via the new public API alias.
- All CLI tests, including refactored clipboard utility tests, pass successfully.
