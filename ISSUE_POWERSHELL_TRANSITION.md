# Issue: Hardcoded legacy Windows PowerShell (powershell.exe) causes runtime failures

## Problem Statement
The codebase currently contains multiple hardcoded invocations of `powershell.exe` or the `powershell` command. These refer specifically to **Windows PowerShell 5.1**, which is legacy software and no longer receives feature updates. 

Modern PowerShell development focuses on **PowerShell Core (pwsh) 6+**, which is cross-platform and contains significant breaking changes and new language features not present in version 5.1.

## Impact
1. **Silent Failures:** When the IDE or CLI attempts to run modern `.ps1` scripts or commands that utilize Core-specific syntax, legacy PowerShell will fail to parse or execute them. These failures often present as obscure syntax errors or "command not found" errors within the sub-shell, making them extremely difficult for the end user to diagnose.
2. **User Inaction:** Since the invocation is hardcoded within the application logic, users who have PowerShell Core installed cannot opt-in to using it. Even if they update their system shell, the application continues to force the use of the legacy binary.
3. **Cross-Platform Inconsistency:** Hardcoding `powershell.exe` is Windows-specific, whereas PowerShell Core (`pwsh`) is the standard naming convention across Windows, macOS, and Linux. This creates divergence in how terminal commands and utilities (like clipboard management) are handled across different operating systems.

## Proposed Solution
Replace all hardcoded legacy PowerShell invocations with a dynamic detection utility that:
1. Prefers `pwsh` (PowerShell Core) if it is available in the system PATH.
2. Falls back to `powershell` (Legacy Windows PowerShell) only as a secondary option on Windows.
3. Corrects the naming convention on macOS and Linux to always prefer `pwsh`.
