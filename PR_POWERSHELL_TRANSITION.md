# PR: Centralize and Modernize PowerShell Command Detection

## Overview
This PR eliminates hardcoded dependencies on legacy Windows PowerShell (`powershell.exe`) and introduces a dynamic detection mechanism that prefers modern PowerShell Core (`pwsh`). 

## Implementation Details

### 1. Centralized Synchronous Detection
A new utility `getPowerShellCommand()` has been added to `core/util/shell.ts`. 
- **Why Synchronous?** Several call sites, notably `core/tools/definitions/runTerminalCommand.ts`, invoke the shell detection during module initialization to populate static metadata. A synchronous implementation (using `spawnSync`) was required to prevent `[object Promise]` from being embedded in these module-level constants.
- **Caching:** To avoid the overhead of spawning a process on every call, the detection result is cached for the duration of the process lifetime.

### 2. Architectural Cleanliness
- **Isolation:** The logic is placed in `core/util/shell.ts` rather than the general `core/util/index.ts` barrel. This ensures that the Node.js `child_process` dependency is not accidentally pulled into non-Node environments (like browsers or WASM) that might import from the main utility barrel.
- **Public API:** The utility is re-exported from `core/util/index.ts` to provide a stable import path via the `core/*` alias.

### 3. De-duplication in CLI
The CLI clipboard utility has been refactored to remove its local, asynchronous PowerShell detection. By standardizing on the core utility:
- We fix a bug where non-Windows platforms erroneously fell back to the legacy `"powershell"` command.
- We reduce the maintenance burden by having a single source of truth for shell detection.

### 4. Test Infrastructure
- **Vitest Aliasing:** Updated `extensions/cli/vitest.config.ts` to resolve the `core` package alias during test execution. This allows CLI tests to run against core source files without requiring a separate build step.
- **Improved Mocking:** Tests now mock the `getPowerShellCommand` interface rather than internal process execution details, resulting in more robust and readable test cases.

## Verification Results
- Verified that `pwsh` is used when available on Windows.
- Verified correct fallback to `powershell` when `pwsh` is missing.
- Verified that macOS/Linux correctly default to `pwsh`.
- All 16 clipboard utility tests pass with the new centralized logic.
