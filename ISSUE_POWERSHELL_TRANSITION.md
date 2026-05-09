# Issue: Hardcoded legacy Windows PowerShell (`powershell.exe`) causes runtime failures and degraded UX

## Problem Statement
The codebase currently contains multiple hardcoded invocations of `powershell.exe` or the legacy `powershell` command. These specifically target **Windows PowerShell 5.1**, which is legacy software that no longer receives feature updates. 

Modern PowerShell development, including scripts often generated or expected by modern developer tools, focuses heavily on **PowerShell Core (`pwsh`) 6+**. PowerShell Core is cross-platform and contains significant language features, performance improvements, and syntax changes not present in version 5.1.

## Impact & Friction
1. **Unpredictable and Silent Failures:** Running modern PowerShell Core scripts in legacy PowerShell will frequently fail. Because PowerShell 5.1 lacks newer language features (e.g., ternary operators, pipeline chain operators like `&&` and `||`, or modern JSON parsing), the execution will fail in ways that are difficult to diagnose. The errors often present as obscure syntax or parsing errors within a sub-shell, obscuring the root cause (a version mismatch).
2. **Uncorrectable by the End User:** Because the `powershell` invocation is hardcoded deep within the application logic (such as in clipboard utilities or terminal command execution), this issue is entirely uncorrectable by the end user. Even if a user has explicitly installed PowerShell Core and set it as their default terminal, the application bypasses this configuration and forces the legacy binary.
3. **Cross-Platform Inconsistency:** Hardcoding `powershell.exe` makes the execution logic strictly Windows-centric. While non-Windows platforms generally default to `pwsh` or `bash`, having fragmented fallback paths leads to inconsistent behaviors and duplicated logic across different extensions and core utilities.

## Proposed Solution
Implement a centralized, dynamic detection utility that:
1. Prefers `pwsh` (PowerShell Core) if it is available in the system environment.
2. Falls back to legacy `powershell` only as a secondary option on Windows to maintain backward compatibility for systems without Core installed.
3. Consolidates this detection into a single source of truth to eliminate duplicated checks across the CLI and IDE extensions.
