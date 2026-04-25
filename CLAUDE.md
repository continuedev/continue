# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Continue?

Continue is an open-source AI coding assistant with two main products:

1. **IDE Extensions** — VS Code and JetBrains plugins that provide chat, autocomplete, inline edit, and agent features powered by any LLM.
2. **Continue CLI (`cn`)** — A standalone CLI tool that runs AI checks (`.continue/checks/*.yaml`) as GitHub status checks on pull requests.

Docs: https://docs.continue.dev

## Monorepo Structure

```
core/               # Shared TypeScript engine (LLM, config, indexing, autocomplete, tools)
gui/                # React/Vite webview UI embedded in all IDE extensions
extensions/
  vscode/           # VS Code extension (TypeScript)
  intellij/         # JetBrains extension (Kotlin/Gradle)
  cli/              # Continue CLI (`cn` binary, TypeScript/esbuild)
binary/             # Packages core into a standalone binary for JetBrains
packages/
  config-types/     # TypeScript types for config
  config-yaml/      # YAML config parsing and schema generation
  llm-info/         # LLM metadata (context lengths, pricing, etc.)
  fetch/            # Shared fetch abstraction
  openai-adapters/  # OpenAI-compatible API adapters
  continue-sdk/     # OpenAPI-generated SDK client
  terminal-security/# Tool policy/security for terminal commands
actions/            # GitHub Actions for automated PR review
docs/               # Documentation site (Docusaurus)
```

## Development Setup

**Prerequisites:** Node.js ≥ 20.20.1, Vite installed globally (`npm i -g vite`).

```bash
nvm use                          # use .nvmrc-specified Node version
# Install all dependencies via VS Code task: "install-all-dependencies"
# or manually per package: npm install in each subdirectory
```

### Running the VS Code Extension

1. Open VS Code command palette → `Tasks: Run Task` → `install-all-dependencies`
2. Switch to Run and Debug view, select `Launch extension`, press play.
3. The Host VS Code window has the extension loaded with hot-reload enabled.

Hot reloading:

- `gui/` changes reload automatically via Vite.
- `core/` and `extensions/vscode/` changes: reload Host VS Code window (`Cmd/Ctrl+Shift+P` → `Reload Window`).

Breakpoints work in `core/` and `extensions/vscode/`, but **not** inside `gui/`.

### Running the JetBrains Extension

See [`extensions/intellij/CONTRIBUTING.md`](extensions/intellij/CONTRIBUTING.md). Uses Gradle `runIde` task. JDK 17 required.

### Running the CLI

```bash
cd extensions/cli
npm install
npm run dev               # run via tsx (dev mode)
npm run build             # bundle with esbuild → dist/cn.js
npm start                 # run built CLI
```

## Commands

### Root (formatting / type-check)

```bash
npm run format             # Prettier across entire repo
npm run format:check       # Check formatting without writing
npm run tsc:watch          # Watch all packages for TS errors simultaneously
```

### core/

```bash
cd core
npm test                   # Jest (*.test.ts files), requires --experimental-vm-modules
npm run vitest             # Vitest (*.vitest.ts files)
npm run tsc:check          # TypeScript type check
npm run build              # Compile for npm publishing
npm run lint               # ESLint
npm run lint:fix
```

Run a single Jest test file:

```bash
cd core && npx jest path/to/file.test.ts
```

Run a single Vitest file:

```bash
cd core && npx vitest run path/to/file.vitest.ts
```

### gui/

```bash
cd gui
npm run dev                # Vite dev server
npm test                   # Vitest
npm run build              # Production build
npm run tsc:check
```

### extensions/vscode/

```bash
cd extensions/vscode
npm test                   # Vitest unit tests
npm run package            # Build .vsix file → build/continue-{VERSION}.vsix
npm run tsc:check
npm run lint
```

E2E tests (requires full setup):

```bash
npm run e2e:all            # Full e2e suite (Mac)
npm run e2e:all-non-mac    # Full e2e suite (non-Mac)
```

### extensions/cli/

```bash
cd extensions/cli
npm test                   # Vitest
npm run lint               # tsc --noEmit + ESLint
npm run build              # esbuild bundle
```

### extensions/intellij/ (Gradle)

```bash
cd extensions/intellij
./gradlew test             # Unit tests
./gradlew runIde           # Launch plugin in sandbox IDE
./gradlew buildPlugin      # Package plugin
```

## Architecture

### Three-Layer Communication Model

```
GUI (React webview) ←→ Core (TypeScript engine) ←→ IDE (VS Code / JetBrains)
```

All communication is typed JSON messaging over well-defined protocols in `core/protocol/`:

| File                           | Direction                                     |
| ------------------------------ | --------------------------------------------- |
| `core/protocol/coreWebview.ts` | Core ↔ GUI                                   |
| `core/protocol/ideCore.ts`     | IDE → Core                                    |
| `core/protocol/ide.ts`         | Core → IDE                                    |
| `core/protocol/webview.ts`     | IDE → GUI                                     |
| `core/protocol/passThrough.ts` | Messages that pass through Core transparently |

In **VS Code**: everything runs in-process. `InProcessMessenger` connects `Core` to `VsCodeMessenger`, which routes messages to `VsCodeIde` (IDE operations) and `VsCodeWebviewProtocol` (GUI). The main orchestrator is `VsCodeExtension`.

In **JetBrains**: `core` is compiled into a standalone binary (`binary/`) and communicates with the Kotlin extension over stdin/stdout. `CoreMessenger.kt` manages that IPC channel. The GUI webview is the same React bundle.

### Core (`core/`)

The `Core` class (`core/core.ts`) is the main entry point. It owns:

- `ConfigHandler` — loads `config.yaml` / `config.json`, manages LLM profiles, and handles hot reload
- `CodebaseIndexer` — tree-sitter-based code indexing into LanceDB/SQLite
- `CompletionProvider` — tab autocomplete
- `NextEditProvider` — next-edit predictions

**LLM Providers** live in `core/llm/llms/` — each extends `BaseLLM`. New providers must be registered in `core/llm/llms/index.ts`.

**Context Providers** live in `core/context/` and `core/context/providers/` — they supply context items for `@mentions` in chat.

**Config** is YAML-first (`config.yaml`) with legacy JSON support. The schema is defined in `packages/config-yaml/`. Config can come from a local file or a remote control-plane profile.

### GUI (`gui/`)

A React + Redux + Vite SPA. Uses React Router (`createMemoryRouter`) for page navigation. Key pages: `Chat` (main), `History`, `Config`, `Stats`.

Communicates with Core/IDE through `IdeMessengerContext` — a typed wrapper around `window.postMessage` / `window.addEventListener("message", ...)`. The hook `useWebviewListener` is the idiomatic way to handle inbound messages. The hook `useIdeMessengerRequest` is the idiomatic way to send requests.

Theme colors are defined in `gui/src/styles/theme.ts` and mapped to Tailwind CSS classes and VS Code theme variables. Always use Tailwind + theme variables; avoid hardcoded colors.

### CLI (`extensions/cli/`)

Entry point: `src/index.ts`. Supports three modes:

- **TUI** — React/Ink terminal UI (`src/ui/TUIChat.tsx`)
- **Headless** — non-interactive CI/scripting mode
- **Standard** — readline chat

Uses the Continue SDK (`packages/continue-sdk/`) for API calls. Bundled into a single ES module with esbuild; local packages are inlined into the bundle.

## Protocol Rules

When adding a new protocol message (`core/protocol/`):

1. Define the type correctly in the appropriate protocol file.
2. If it's a webview ↔ core message, add it to `core/protocol/passThrough.ts` **and** `extensions/intellij/src/main/kotlin/.../constants/MessageTypes.kt`.
3. Implement it in `core/core.ts` (messages to core), `useWebviewListener` (messages to GUI), or `VsCodeMessenger.ts` / `IdeProtocolClient.kt` (messages to IDE).
4. Avoid duplicating existing message types.

## GUI Link Rule

When adding links in `gui/` that navigate to `continue.dev`, use:

```ts
ideMessenger.request("controlPlane/openUrl", { path, orgSlug: undefined });
```

Never use a plain `href` pointing to `continue.dev`.

## Testing Notes

- `core/` has two separate test runners: Jest (`*.test.ts`) and Vitest (`*.vitest.ts`). Do not mix them.
- `extensions/vscode/` uses Vitest only.
- `gui/` uses Vitest only.
- Jest in `core/` runs with `maxWorkers: 1` (serial) due to shared database state.
- After creating or modifying a test, always run it to confirm it passes before committing.

## Formatting

Prettier is the sole formatter. Run `npm run format` at the root before opening a PR. The pre-commit hook via Husky runs `lint-staged` automatically.

## Release & Git Workflow

Single permanent branch: `main`. Pre-release tags `v1.x.y-vscode` trigger a preview release; stable tags `v1.x.y-vscode` trigger a production release (see [releaseflow.org](http://releaseflow.org)). All PRs target `main`.
