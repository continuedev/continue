<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Continue is an AI code agent that works across VS Code, JetBrains, CLI, and cloud. The codebase is a **TypeScript monorepo** with a protocol-based architecture enabling shared core logic across all platforms.

**Node Version:** 20.19.0 (LTS) or higher

## Architecture

### Three-Layer Communication Model

Continue uses protocol-based message passing between three main components:

1. **IDE Layer** (`/extensions`) - Platform-specific extensions (VS Code/JetBrains/CLI)
2. **Core Layer** (`/core`) - Shared business logic and AI orchestration (~115k lines)
3. **GUI Layer** (`/gui`) - React-based UI that renders in webviews

**Communication:**

- IDE ↔ Core: stdin/stdout or TCP (for debugging)
- Core ↔ GUI: Webview messaging protocol
- All protocol definitions in `/core/protocol/`

### Key Directories

- **`/core`** - Platform-agnostic business logic shared across all extensions

  - `/autocomplete` - Tab completion and "next edit" prediction
  - `/llm` - 20+ LLM provider integrations
  - `/config` - Configuration management with hot reload
  - `/indexing` - Content-addressed codebase indexing (SQLite + LanceDB)
  - `/context` - 20+ context providers for RAG
  - `/tools` - Agentic tool system with security policies
  - `/protocol` - Type-safe message passing contracts

- **`/gui`** - React UI (Vite + Redux + TailwindCSS)

- **`/extensions/vscode`** - VS Code extension (TypeScript + esbuild)

- **`/extensions/intellij`** - JetBrains extension (Kotlin + Gradle, JDK 17)

- **`/extensions/cli`** - Command-line interface (Node.js CLI)

- **`/binary`** - Core packaged as platform-specific binaries for JetBrains

- **`/packages`** - Reusable NPM packages (config-types, config-yaml, etc.)

- **`/sync`** - Rust module for efficient Merkle tree-based indexing

## Common Commands

### Root Level

```bash
# Install all dependencies
npm install

# Type checking all packages (watch mode)
npm run tsc:watch

# Format all files
npm run format
npm run format:check
```

### Core (`/core`)

```bash
cd core

# Run tests
npm test                # Jest tests
npm run vitest          # Vitest tests
npm run test:coverage   # Coverage report

# Build
npm run build

# Type checking
npm run tsc:check

# Lint
npm run lint
npm run lint:fix
```

### GUI (`/gui`)

```bash
cd gui

# Development server
npm run dev

# Tests
npm run test            # Run once
npm run test:watch      # Watch mode
npm run test:ui         # Vitest UI
npm run test:coverage

# Build
npm run build
npm run preview         # Preview production build
```

### VS Code Extension (`/extensions/vscode`)

```bash
cd extensions/vscode

# Build
npm run esbuild         # One-time build
npm run esbuild-watch   # Watch mode

# Package
npm run package         # Create .vsix file

# Tests
npm run test            # Unit tests
npm run e2e:all         # Full E2E suite
npm run e2e:quick       # Quick E2E tests
```

**Development:** Use the "Launch Extension" debug configuration in VS Code. Reload the extension host window (Cmd+R) to pick up changes.

### IntelliJ Extension (`/extensions/intellij`)

```bash
cd extensions/intellij

# Install dependencies (Unix)
./scripts/install-dependencies.sh

# Install dependencies (Windows)
.\scripts\install-dependencies.ps1

# Build and run (via Gradle)
./gradlew buildPlugin
./gradlew runIde

# Tests
./gradlew test
./gradlew testIntegration
```

**Development:** Use the "Run Continue" debug configuration in IntelliJ. Stop and restart to pick up changes.

### CLI Extension (`/extensions/cli`)

```bash
cd extensions/cli

# Install globally
npm install -g .

# Or run locally
npm start

# Tests
npm test
```

**Usage:**

- `cn` - Start interactive session
- `cn -p "prompt"` - Headless mode
- `cn ls` - List/resume sessions
- `cn serve` - HTTP server mode

## Important Architectural Patterns

### 1. Protocol-First Development

When adding features that require new IDE capabilities:

1. Add method to `IDE` interface in `/core/index.d.ts`
2. Add to protocol in `/core/protocol/ide.ts`
3. Implement in each extension (VS Code, IntelliJ, CLI)
4. Add message handler in `/core/protocol/messenger/`

The protocol provides ~80+ methods for file operations, git, terminal access, etc.

### 2. Content-Addressed Indexing

The indexing system uses file content hashes, not paths:

- Renaming a file doesn't trigger re-indexing
- Same file across branches shares index entries
- Tags track which (workspace, branch, provider) needs which content
- Rust sync module (`/sync`) computes Merkle trees for change detection

**Index locations:**

- `~/.continue/index/tags/<dir>/<branch>/<provider>/merkle_tree`
- `~/.continue/index/.index_cache` - Global cache
- `~/.continue/index/rev_tags` - Hash to tag mappings

### 3. Binary Architecture for JetBrains

The `/binary` directory packages the entire TypeScript core into platform-specific executables:

- Allows Java-based IDEs to run Continue core
- Communication via stdin/stdout or TCP (debugging)
- Native modules (sqlite3, @lancedb) included separately
- Must include .wasm files (tree-sitter)

### 4. Multi-Platform GUI

The same React GUI code runs in:

- VS Code webviews
- JetBrains JCEF panels
- Browser (web version)
- Electron (standalone app)

Theme system maps VS Code color tokens to TailwindCSS classes.

### 5. Configuration Hot Reload

ConfigHandler watches config files and automatically reloads, emitting events to update:

- LLM models
- Context providers
- Tools
- Indexes

Supports layered configuration:

1. Local config (`.continue/config.yaml` or `config.json`)
2. Workspace config
3. Platform config (team/org settings from cloud)
4. Multiple profiles per user/org

### 6. Plugin Architecture

**LLM Providers:** Extend `BaseLLM` class in `/core/llm/llms/`

**Context Providers:** Implement `IContextProvider` interface in `/core/context/providers/`

**Tools:** Define schema + implementation in `/core/tools/`

**Indexes:** Extend `CodebaseIndex` class in `/core/indexing/`

**MCP (Model Context Protocol):** Continue supports MCP servers for dynamic tool/resource registration with OAuth support.

### 7. Autocomplete Optimization

Tab autocomplete is highly optimized:

- Debouncing to reduce LLM requests
- LRU caching for repeated contexts
- Prefiltering to avoid unnecessary calls
- Multiline classification
- Bracket matching for valid completions

### 8. Hot Reloading Behavior

Different components hot reload differently:

- **GUI:** Automatic via Vite
- **VS Code Extension:** Reload window (Cmd+R)
- **Core:** Reload VS Code window to restart
- **IntelliJ:** Stop and restart debug session

## Development Workflow

1. **Use VS Code Tasks:** Common operations have predefined tasks
2. **Watch Mode:** `npm run tsc:watch` catches errors across all packages
3. **Format on Save:** Enable Prettier formatting
4. **Check Logs:**
   - VS Code: Developer: Toggle Developer Tools
   - IntelliJ: Build → Debugging → Show Log in Finder
   - CLI: Terminal output

## Monorepo Benefits

- **Shared Types:** Single source of truth in `/core/index.d.ts`
- **Code Reuse:** Core logic shared across all platforms
- **Atomic Changes:** Protocol updates across all extensions in one PR
- **Unified Releases:** Coordinated version bumps

## Testing Strategy

- **Unit tests:** Jest/Vitest for core logic
- **Integration tests:** Protocol communication
- **E2E tests:** VS Code Extension Tester framework
- **Visual tests:** Playwright (select areas)

Run tests at the package level (see commands above) rather than at root.

## Security Model

- Terminal command evaluation before execution (see `/packages/terminal-security`)
- Tool execution policies in `/core/tools/policies/`
- MCP OAuth for external services
- Telemetry opt-in/opt-out

## Resources

- **Docs:** https://docs.continue.dev
- **Contributing Guide:** `/CONTRIBUTING.md`
- **Discord:** https://discord.gg/vapESyrFmJ
- **VS Code Extension Contributing:** `/extensions/vscode/README.md`
- **IntelliJ Contributing:** `/extensions/intellij/CONTRIBUTING.md`
