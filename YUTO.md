# YUTO.md — Agent Instructions for the Yuto Project

This file contains rules and context for AI coding agents working in this repository.
The repository is a fork of [continuedev/continue](https://github.com/continuedev/continue) being extended with utilities ported from **Marcel** (`/home/fran/dev/yuto-code/marcel/`).

---

## Repository Structure

```
continue/
  core/           # Core library — LLM clients, tools, context, indexing
  extensions/
    vscode/       # VS Code extension
    intellij/     # IntelliJ plugin
    cli/          # CLI tool
  gui/            # React frontend (Vite + Tailwind)
  packages/       # Shared packages (config-types, llm-info, etc.)
  binary/         # Standalone binary build
  docs/           # Documentation site
```

---

## Build & Test Commands

All commands run from the **monorepo root** (`continue/`) unless noted.

| Task | Command | Notes |
|------|---------|-------|
| Type-check all packages | `npm run tsc:watch` | Watches all packages concurrently |
| Type-check core only | `cd core && tsc -p ./ --noEmit` | |
| Run core tests (Jest) | `cd core && npm test` | |
| Run core tests (Vitest) | `cd core && npm run vitest` | |
| Lint core | `cd core && npm run lint` | ESLint |
| Lint fix core | `cd core && npm run lint:fix` | |
| Build core (for npm) | `cd core && npm run build` | Outputs to dist/ |

> **Never run `npm run build` or `git push` without being asked.** Type-check with `tsc --noEmit` to validate.

---

## Code Conventions

- **TypeScript only** — no `.js` source files in `core/` or `extensions/`
- **No `.js` extensions** in local `import` paths within `core/` (the tsconfig resolves them)
- **No `lodash`** in `core/` — use native array/object methods or utilities in `core/util/`
- **No `execa`** in `core/` — use `child_process` (Node built-in) or the existing `core/util/` shell helpers
- Double quotes for strings in most files; follow the style of the file being edited
- Prefer `const` over `let`; avoid `var`

---

## Tool System

Built-in tools live in three layers:

1. **`core/tools/builtIn.ts`** — `BuiltInToolNames` enum + `CLIENT_TOOLS_IMPLS` list
2. **`core/tools/definitions/`** — Static `Tool` descriptor objects (name, description, parameters schema)
   - `index.ts` re-exports all definitions
3. **`core/tools/implementations/`** — Runtime logic (`ToolImpl` functions)
   - `index.ts` maps tool names to implementations
4. **`core/tools/callTool.ts`** — Dispatcher — add a `case` here when adding a new tool
5. **`core/tools/index.ts`** — Assembles base tool list from definitions

### Adding a new built-in tool checklist

- [ ] Add entry to `BuiltInToolNames` enum in `builtIn.ts`
- [ ] Create `definitions/<toolName>.ts` exporting a `Tool` object
- [ ] Export from `definitions/index.ts`
- [ ] Add to base list in `tools/index.ts`
- [ ] Create `implementations/<toolName>.ts` exporting a `ToolImpl`
- [ ] Export from `implementations/index.ts`
- [ ] Add `case` in `callTool.ts`

---

## Ported Utilities (Marcel → Continue)

Ported files live under `core/util/` mirroring Marcel's `src/utils/` structure.

| Continue path | Marcel source | Notes |
|---------------|--------------|-------|
| `core/util/generators.ts` | `src/utils/generators.ts` | Async generator helpers |
| `core/util/format.ts` | `src/utils/format.ts` | String formatting |
| `core/util/array.ts` | `src/utils/array.ts` | Array utilities |
| `core/util/shellPromptDetection.ts` | `src/utils/shellPromptDetection.ts` | Shell prompt heuristics |
| `core/util/progressTracker.ts` | `src/utils/progressTracker.ts` | Progress tracking |
| `core/util/agentContext.ts` | `src/utils/agentContext.ts` | Agent context helpers |
| `core/util/contextAnalysis.ts` | `src/utils/contextAnalysis.ts` | Token/message analysis |
| `core/util/bash/` | `src/utils/bash/` | Shell parsing & quoting |

### Marcel → Continue porting rules

1. **Remove** `// modified by fif` header comments
2. **Replace** Marcel local imports with Continue equivalents or inline the logic:
   - `logError(e)` → `console.error(e)`
   - `jsonStringify(x)` → `JSON.stringify(x)`
   - `memoizeWithLRU(fn, key)` → simple `Map`-based cache
3. **Strip `.js` extensions** from local import paths
4. **Do not port** files that depend on Marcel-specific internals:
   - `getFsImplementation`, `getCwd`, `getGlobalConfig`, `registerCleanup`, `waitForScrollIdle`
   - Any file importing from `../../bootstrap/`, `../../entrypoints/`, `../../services/`
   - Feature-flag files using `feature()` or `bun:bundle`
5. **`execa`** is not available in `core/` — use `child_process.execFile` instead
6. **`@withfig/autocomplete`** is not installed — wrap imports in `try/catch` and return `null` on failure

---

## Off-Limits / Do Not Touch

- **`core/llm/`** — LLM provider implementations; do not modify without explicit instruction
- **`core/indexing/`** — Codebase indexing pipeline; complex, do not touch
- **`extensions/vscode/`** — VS Code extension; only modify when explicitly asked
- **`packages/`** — Shared packages published to npm; do not modify without explicit instruction
- **`.git/`**, **`node_modules/`** — Never touch
- **Telegram token in `marcel/yuto.md`** — That file is misnamed and contains a bot token, ignore it

---

## Marcel Source Reference

Marcel lives at `/home/fran/dev/yuto-code/marcel/src/`. When auditing files for portability:

| Verdict | Criteria |
|---------|----------|
| ✅ Portable | Only Node built-ins (`fs`, `path`, `crypto`, `os`) and/or npm packages already in `core/package.json` |
| ⚠️ Portable with changes | Needs `execa`→`execFile`, `logError`→`console.error`, etc. |
| ❌ Not portable | Imports Marcel internals (bootstrap, config, cwd, fsImplementation, teleport, signals) |

Always check `core/package.json` before assuming an npm package is available.
