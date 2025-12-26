# Continue Development Notes

## WSL2 Development

### Building VSIX from WSL2

The VS Code extension VSIX built on Linux contains Linux-only native binaries (sqlite3, LanceDB, ripgrep). When VS Code runs in WSL remote mode, extensions can run in either:

- **Windows extension host** - needs Windows binaries
- **WSL extension host** - Linux binaries work

If both hosts try to load the extension, the Windows host fails with:

```
Error: node_sqlite3.node is not a valid Win32 application
```

**Workaround for local testing:**

1. Build VSIX normally: `npm run package` (in extensions/vscode)
2. Install: `code --install-extension extensions/vscode/build/continue-*.vsix`
3. Delete Windows installation to force WSL-only:
   ```bash
   rm -rf /mnt/c/Users/<username>/.vscode/extensions/continue.continue-*
   ```
4. Reload VS Code

This forces Continue to run exclusively in WSL extension host where Linux binaries work.

**Related:** GitHub Issue #9326

### File Count and Extension Activation

Large file counts (300K+) from node_modules and build artifacts can cause extension activation issues. If Continue fails to load:

1. Delete build artifacts:
   ```bash
   rm -rf */node_modules */*/node_modules node_modules
   rm -rf */dist */*/dist */out */*/out */build
   ```
2. Reload VS Code
3. Rebuild only when needed for testing

### Terminal Command Working Directory

The `run_terminal_command` tool resolves workspace directories from VS Code URIs. In WSL2:

- URIs are `vscode-remote://wsl+Ubuntu/path` (not `file://`)
- Must parse with `new URL()` and extract pathname
- Must `decodeURIComponent()` for paths with spaces/special chars

See: `core/tools/implementations/runTerminalCommand.ts`
