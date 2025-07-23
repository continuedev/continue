# oneper Tool - GUI Build Issue

## Summary

The `oneper` tool (PR testing workflow) is complete and working, but has one remaining build issue preventing final VSIX creation.

## What is oneper?

`oneper` is a new tool in `./scripts/oneper` that allows developers to quickly test PRs and different git refs without disrupting their main development environment. It:

- Creates isolated git worktrees with separate node_modules
- Builds VS Code extensions for any git ref (PRs, branches, commits)
- Provides install commands for easy testing
- Supports incremental builds and cleanup

## Current Status

✅ **Working perfectly:**
- Git worktree creation and management
- npm workspace dependency resolution 
- Internal package building (`@continuedev/config-yaml`, `@continuedev/openai-adapters`)
- Extension dependency installation
- Prepackage step execution
- State management and cleanup commands

❌ **Single remaining issue:**
GUI build fails with TypeScript error, preventing final VSIX creation.

## The Issue

### Error Message
```
error TS2688: Cannot find type definition file for 'vitest/globals'.
  The file is in the program because:
    Entry point of type library 'vitest/globals' specified in compilerOptions
```

### Root Cause
The `gui/tsconfig.json` file contains:
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

But `vitest` is not being installed in the workspace properly, causing TypeScript compilation to fail.

### Impact
1. GUI build fails (`npm run build` in `gui/`)
2. No `gui/dist/assets/index.js` file is created
3. Extension prepackage step fails with: `"gui build did not produce index.js"`
4. No VSIX file is generated

## Attempted Solutions

1. **npm workspace approach** ✅ - Fixed all major module resolution issues
2. **Internal package building** ✅ - Resolved `@continuedev/*` package dependencies  
3. **Extension dependency installation** ✅ - Fixed prepackage script dependencies
4. **Error handling** ✅ - GUI build failure doesn't crash the entire process

## Test Case

To reproduce:
```bash
./scripts/oneper checkout main --no-install
```

The build progresses through all steps but fails at GUI compilation.

## Questions for Engineering

1. **Is vitest required for GUI production builds?** The error suggests it's only needed for testing.

2. **Should we modify the build process?** Options:
   - Remove `"types": ["vitest/globals"]` from production tsconfig
   - Install vitest properly in the workspace
   - Skip TypeScript check for GUI builds (`vite build` only)
   - Use a different GUI build approach for oneper

3. **Workspace configuration:** Is there a missing step in our npm workspace setup that should install vitest globally?

## Current Workaround

The tool works for everything except the final VSIX creation. Developers can still:
- Create isolated worktrees
- Install dependencies correctly
- Test the build process
- Use all management commands (`list`, `clean`, `rm`, `prune`)

## Architecture Success

The core npm workspace path resolution issues are completely solved. We went from hundreds of module resolution errors to a single TypeScript configuration issue, proving the oneper architecture is sound.

---

**Request:** Please help identify the correct approach to resolve the vitest/GUI build issue so oneper can generate working VSIX files.