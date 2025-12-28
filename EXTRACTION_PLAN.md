# Autocomplete Extension Extraction Plan

This document outlines the plan to extract a standalone autocomplete VSCode extension from the Continue AI coding assistant monorepo.

## Goals

1. **Minimal footprint**: Remove all non-autocomplete features (chat, agents, edit, etc.)
2. **Maintainable**: Keep monorepo structure for easier updates from upstream
3. **Extensible**: Add clean hook points for custom snippet filtering (e.g., code scanning)
4. **Functional**: Preserve all autocomplete capabilities including context collection, caching, and streaming

---

## Current Architecture Overview

```
autocomplete-poc/
├── core/                          # Shared core logic (~623 files)
│   ├── autocomplete/              # ✅ KEEP - Main autocomplete engine (81 files)
│   ├── config/                    # ✅ KEEP - Configuration management
│   ├── llm/                       # ✅ KEEP - LLM providers
│   ├── util/                      # ✅ KEEP - Utilities
│   ├── indexing/                  # ⚠️  PARTIAL - Only ignore.ts needed
│   ├── context/                   # ❌ REMOVE - Chat context providers
│   ├── commands/                  # ❌ REMOVE - Slash commands
│   ├── edit/                      # ❌ REMOVE - Code editing
│   └── ...                        # ❌ REMOVE - Other features
├── extensions/
│   ├── vscode/                    # ⚠️  PARTIAL - Keep autocomplete parts
│   ├── intellij/                  # ❌ REMOVE - JetBrains plugin
│   └── cli/                       # ❌ REMOVE - CLI extension
├── gui/                           # ❌ REMOVE - React chat interface
├── binary/                        # ❌ REMOVE - Binary components
├── packages/                      # ⚠️  PARTIAL - Keep required packages
└── docs/                          # ❌ REMOVE - Documentation
```

---

## Phase 1: Remove Unused Extensions and GUI

**Estimated files to remove**: ~2000+

### Step 1.1: Remove JetBrains Extension
```bash
rm -rf extensions/intellij/
```

### Step 1.2: Remove CLI Extension
```bash
rm -rf extensions/cli/
```

### Step 1.3: Remove GUI (React Chat Interface)
```bash
rm -rf gui/
```

### Step 1.4: Remove Binary Components
```bash
rm -rf binary/
```

### Step 1.5: Remove Documentation
```bash
rm -rf docs/
```

### Step 1.6: Update Root Configuration
- Update root `package.json` to remove workspace references to deleted directories
- Update `turbo.json` if present
- Remove any CI/CD references to deleted components

---

## Phase 2: Simplify VSCode Extension

**Location**: `extensions/vscode/`

### Step 2.1: Identify Files to Keep

#### Must Keep (Autocomplete Core):
```
extensions/vscode/src/
├── autocomplete/                    # ✅ All 7 files
│   ├── completionProvider.ts
│   ├── statusBar.ts
│   ├── lsp.ts
│   ├── GhostTextAcceptanceTracker.ts
│   ├── recentlyEdited.ts
│   ├── RecentlyVisitedRangesService.ts
│   └── index.ts (if exists)
├── VsCodeIde.ts                     # ✅ IDE implementation
├── extension.ts                     # ⚠️  Simplify - remove non-autocomplete activation
├── util/                            # ✅ Keep utilities
└── activation/                      # ⚠️  Partial - keep autocomplete activation only
```

#### Remove (Non-Autocomplete Features):
```
extensions/vscode/src/
├── ContinueGUIWebviewViewProvider.ts   # ❌ Chat UI
├── commands.ts                          # ⚠️  Keep only autocomplete commands
├── diff/                                # ❌ Diff UI (unless needed for inline diff)
├── quickEdit/                           # ❌ Quick edit feature
├── lang-server/                         # ⚠️  Partial - keep if LSP used for context
├── debugPanel.ts                        # ❌ Debug panel
├── stubs/                               # ❌ Test stubs
└── [other chat/edit related files]
```

### Step 2.2: Simplify `extension.ts`

Current `extension.ts` activates many features. Reduce to:

```typescript
import * as vscode from "vscode";
import { setupAutocomplete } from "./autocomplete";
import { VsCodeIde } from "./VsCodeIde";
import { ConfigHandler } from "core/config/ConfigHandler";

export async function activate(context: vscode.ExtensionContext) {
  const ide = new VsCodeIde();
  const configHandler = new ConfigHandler(/* minimal config */);

  // Only autocomplete activation
  await setupAutocomplete(context, ide, configHandler);
}

export function deactivate() {}
```

### Step 2.3: Simplify `commands.ts`

Keep only autocomplete-related commands:
- `continue.toggleTabAutocompleteEnabled`
- `continue.acceptAutocompleteCompletion`
- `continue.rejectAutocompleteCompletion`
- Remove all chat, edit, and agent commands

### Step 2.4: Update `package.json`

Remove from `contributes`:
- Chat viewContainers
- Webview panels
- Non-autocomplete commands
- Non-autocomplete keybindings
- Non-autocomplete configuration options

Keep:
- Autocomplete configuration (`tabAutocompleteEnabled`, `tabAutocompleteModel`, etc.)
- Inline completion provider registration
- Status bar items for autocomplete

---

## Phase 3: Trim Core Directory

**Location**: `core/`

### Step 3.1: Files to Keep

```
core/
├── autocomplete/                    # ✅ ALL (81 files) - Main engine
├── config/
│   ├── ConfigHandler.ts             # ✅ Configuration management
│   ├── types.ts                     # ✅ Type definitions
│   ├── load.ts                      # ⚠️  Simplify - remove non-autocomplete config
│   └── [yaml/json loaders]          # ✅ Keep config loaders
├── llm/
│   ├── index.ts                     # ✅ LLM interface
│   ├── llms/                        # ⚠️  Keep only needed providers
│   │   ├── OpenAI.ts
│   │   ├── Anthropic.ts
│   │   ├── Ollama.ts
│   │   └── [others as needed]
│   └── countTokens.ts               # ✅ Token counting
├── util/
│   ├── paths.ts                     # ✅ Path utilities
│   ├── GlobalContext.ts             # ✅ Global state
│   ├── parameters.ts                # ✅ Default options
│   └── [other utilities]            # ✅ Keep most utilities
├── indexing/
│   └── ignore.ts                    # ✅ Security concern checking
└── diff/
    └── util.ts                      # ⚠️  Keep if used by autocomplete
```

### Step 3.2: Files to Remove

```
core/
├── context/                         # ❌ Chat context providers
├── commands/                        # ❌ Slash commands
├── edit/                            # ❌ Code editing
├── tools/                           # ❌ Agent tools
├── protocol/                        # ❌ Communication protocol (unless needed)
├── promptFiles/                     # ❌ Prompt file handling
├── [agent-related files]            # ❌ Agent logic
└── [chat-related files]             # ❌ Chat logic
```

### Step 3.3: Analyze and Remove Unused Exports

After removing directories, check for broken imports and either:
- Remove the importing code if not needed
- Create stub implementations if interface is required

---

## Phase 4: Clean Up Packages

**Location**: `packages/`

### Step 4.1: Required Packages

```
packages/
├── config-types/                    # ✅ Type definitions
├── config-yaml/                     # ✅ YAML config support
├── fetch/                           # ✅ HTTP utilities
├── llm-info/                        # ✅ LLM provider info
└── openai-adapters/                 # ✅ OpenAI compatibility
```

### Step 4.2: Packages to Remove

```
packages/
├── continue-sdk/                    # ❌ SDK for integrations
├── hub/                             # ❌ Hub integration
├── terminal-security/               # ❌ Terminal security (unless used)
└── [other unused packages]
```

### Step 4.3: Update Package Dependencies

- Remove internal package references that no longer exist
- Update `package.json` files in remaining packages

---

## Phase 5: Add Custom Snippet Filter Hook

**Goal**: Create a clean extension point for custom code scanning/filtering.

### Step 5.1: Create Filter Service Interface

**New file**: `core/autocomplete/filtering/SnippetFilterService.ts`

```typescript
import { AutocompleteCodeSnippet, AutocompleteStaticSnippet } from "../util/types";

export type AutocompleteSnippet = AutocompleteCodeSnippet | AutocompleteStaticSnippet;

export interface SnippetFilter {
  /**
   * Check if a snippet should be blocked from reaching the LLM.
   * @param snippet The snippet to check
   * @returns true if the snippet should be BLOCKED, false to allow
   */
  shouldBlock(snippet: AutocompleteSnippet): boolean | Promise<boolean>;

  /**
   * Optional name for logging/debugging
   */
  name?: string;
}

export class SnippetFilterService {
  private filters: SnippetFilter[] = [];
  private enabled: boolean = true;

  /**
   * Register a custom filter
   */
  registerFilter(filter: SnippetFilter): void {
    this.filters.push(filter);
    console.log(`Registered snippet filter: ${filter.name ?? 'unnamed'}`);
  }

  /**
   * Unregister a filter
   */
  unregisterFilter(filter: SnippetFilter): void {
    const index = this.filters.indexOf(filter);
    if (index > -1) {
      this.filters.splice(index, 1);
    }
  }

  /**
   * Enable/disable all filtering
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Filter an array of snippets, removing blocked ones
   */
  async filterSnippets<T extends AutocompleteSnippet>(snippets: T[]): Promise<T[]> {
    if (!this.enabled || this.filters.length === 0) {
      return snippets;
    }

    const results: T[] = [];

    for (const snippet of snippets) {
      let blocked = false;

      for (const filter of this.filters) {
        try {
          if (await filter.shouldBlock(snippet)) {
            blocked = true;
            break;
          }
        } catch (error) {
          console.warn(`Filter ${filter.name ?? 'unnamed'} threw error:`, error);
          // Don't block on filter errors
        }
      }

      if (!blocked) {
        results.push(snippet);
      }
    }

    return results;
  }

  /**
   * Check a single snippet
   */
  async isBlocked(snippet: AutocompleteSnippet): Promise<boolean> {
    if (!this.enabled || this.filters.length === 0) {
      return false;
    }

    for (const filter of this.filters) {
      try {
        if (await filter.shouldBlock(snippet)) {
          return true;
        }
      } catch (error) {
        console.warn(`Filter ${filter.name ?? 'unnamed'} threw error:`, error);
      }
    }

    return false;
  }
}

// Singleton instance
export const snippetFilterService = new SnippetFilterService();
```

### Step 5.2: Integrate Filter Service

**Modify**: `core/autocomplete/templating/filtering.ts`

```typescript
import { snippetFilterService } from "../filtering/SnippetFilterService";

export async function getSnippets(helper: HelperVars): Promise<FilteredSnippets> {
  let { baseSnippets, clipboard, recentlyVisitedRanges, recentlyEditedRanges, diff } =
    helper.input.snippets;

  // Apply custom filters to all snippet sources
  baseSnippets = await snippetFilterService.filterSnippets(baseSnippets);
  if (clipboard) {
    clipboard = await snippetFilterService.filterSnippets(clipboard);
  }
  // ... filter other sources

  // ... rest of existing logic
}
```

### Step 5.3: Export Filter Service from Extension

**Modify**: `extensions/vscode/src/extension.ts`

```typescript
import { snippetFilterService, SnippetFilter } from "core/autocomplete/filtering/SnippetFilterService";

// Export for external use
export { snippetFilterService, SnippetFilter };

// Or provide registration API
export function registerSnippetFilter(filter: SnippetFilter): void {
  snippetFilterService.registerFilter(filter);
}
```

### Step 5.4: Example Custom Filter Implementation

```typescript
// Example: Block snippets containing sensitive patterns
import { SnippetFilter, registerSnippetFilter } from "your-autocomplete-extension";

const sensitivePatternFilter: SnippetFilter = {
  name: "SensitivePatternFilter",

  shouldBlock(snippet) {
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]/i,
      /password\s*[:=]/i,
      /secret\s*[:=]/i,
      /private[_-]?key/i,
      /BEGIN\s+(RSA|DSA|EC)\s+PRIVATE\s+KEY/,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(snippet.content)) {
        console.log(`Blocked snippet from ${snippet.filepath}: matched ${pattern}`);
        return true;
      }
    }

    return false;
  }
};

registerSnippetFilter(sensitivePatternFilter);
```

---

## Phase 6: Enable Background Indexing (Optional Enhancement)

The infrastructure exists but is disabled. Re-enable for better performance.

### Step 6.1: Enable Recently Visited Ranges Service

**File**: `extensions/vscode/src/autocomplete/RecentlyVisitedRangesService.ts`

Uncomment lines 45-47:
```typescript
vscode.window.onDidChangeTextEditorSelection(
  this.cacheCurrentSelectionContext,
);
```

### Step 6.2: Enable Recently Edited Tracker

**File**: `extensions/vscode/src/autocomplete/recentlyEdited.ts`

Uncomment lines 27-44:
```typescript
vscode.workspace.onDidChangeTextDocument((event) => {
  event.contentChanges.forEach((change) => {
    // capture edited ranges...
  });
});

setInterval(() => {
  this.removeOldEntries();
}, 1000 * 15);
```

### Step 6.3: Test Performance Impact

After enabling, measure:
- Memory usage increase
- CPU usage during editing
- Autocomplete latency improvement

---

## Phase 7: Update Build Configuration

### Step 7.1: Update `extensions/vscode/scripts/esbuild.js`

Ensure external dependencies are correctly marked and unused code is tree-shaken.

### Step 7.2: Update `extensions/vscode/package.json`

- Remove dependencies for removed features
- Update extension metadata (name, description, etc.)
- Reduce extension size

### Step 7.3: Update TypeScript Configuration

**File**: `extensions/vscode/tsconfig.json`

Update includes to only reference kept files:
```json
{
  "include": [
    "src/**/*.ts",
    "../../core/autocomplete/**/*.ts",
    "../../core/config/**/*.ts",
    "../../core/llm/**/*.ts",
    "../../core/util/**/*.ts"
  ]
}
```

---

## Phase 8: Testing and Validation

### Step 8.1: Build Verification

```bash
cd extensions/vscode
npm run esbuild
npm run package
```

### Step 8.2: Functional Testing

Test the following scenarios:
- [ ] Basic autocomplete works
- [ ] Multi-line completion works
- [ ] Tab to accept completion
- [ ] Escape to dismiss completion
- [ ] Cache hits work (type same prefix twice)
- [ ] Different LLM providers work
- [ ] Configuration changes take effect
- [ ] Custom snippet filter blocks expected content

### Step 8.3: Size Comparison

Compare VSIX size before and after:
- Original Continue extension: ~XX MB
- Autocomplete-only extension: ~XX MB (target: <5MB)

---

## Implementation Order

| Phase | Description | Priority | Estimated Effort |
|-------|-------------|----------|------------------|
| 1 | Remove unused extensions/GUI | High | Low |
| 2 | Simplify VSCode extension | High | Medium |
| 3 | Trim core directory | High | Medium |
| 4 | Clean up packages | Medium | Low |
| 5 | Add snippet filter hook | High | Low |
| 6 | Enable background indexing | Low | Low |
| 7 | Update build configuration | High | Low |
| 8 | Testing and validation | High | Medium |

---

## Files Summary

### Files to Create
- `core/autocomplete/filtering/SnippetFilterService.ts` - Custom filter hook system

### Files to Heavily Modify
- `extensions/vscode/src/extension.ts` - Simplify activation
- `extensions/vscode/src/commands.ts` - Remove non-autocomplete commands
- `extensions/vscode/package.json` - Remove non-autocomplete contributions
- `core/autocomplete/templating/filtering.ts` - Integrate filter service

### Directories to Remove
- `extensions/intellij/`
- `extensions/cli/`
- `gui/`
- `binary/`
- `docs/`
- `core/context/`
- `core/commands/`
- `core/edit/`
- `core/tools/`
- (and others identified during implementation)

---

## Success Criteria

1. **Extension loads and provides autocomplete** in VSCode
2. **No chat/edit/agent UI** appears
3. **Custom snippet filter** can block content from LLM
4. **Extension size** reduced by >50%
5. **All autocomplete features** work as before
6. **Build succeeds** without errors

---

## Notes

- Keep monorepo structure to allow syncing improvements from upstream Continue
- Document any upstream dependencies for future updates
- Consider creating a fork-sync script to pull autocomplete-related changes
