# Continue Codebase Overview

This document provides a comprehensive overview of the Continue codebase architecture, structure, and key components.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Extensions](#extensions)
- [Development Workflow](#development-workflow)

## Architecture Overview

Continue is a platform for building continuous AI workflows that can run in multiple environments:

1. **Mission Control** - Cloud-based agents that run on schedules or event triggers
2. **CLI (Headless Mode)** - Command-line agents for automation
3. **CLI (TUI Mode)** - Terminal UI for interactive agent execution
4. **IDE Extensions** - VS Code and JetBrains plugins for in-editor AI assistance

The codebase is organized as a monorepo with shared core functionality and environment-specific implementations.

## Directory Structure

### `/core`

The heart of the Continue platform - contains all shared logic used across different environments.

**Key subdirectories:**

- `/autocomplete` - AI-powered code completion
  - `/context` - Context gathering for autocomplete (imports, recent edits, etc.)
  - `/filtering` - Post-processing and filtering of completion results
  - `/generation` - Completion generation and streaming logic
  - `/templating` - Prompt construction for autocomplete
- `/commands` - Slash commands implementation
  - `/slash` - Built-in and custom slash commands
- `/config` - Configuration management
  - `/profile` - User profile and settings
  - `/yaml` - YAML config parsing
  - `/markdown` - Markdown-based configuration (rules, docs)
- `/context` - Context providers for AI interactions
  - `/providers` - Built-in context providers (@codebase, @file, @docs, etc.)
  - `/retrieval` - Codebase retrieval and ranking
  - `/mcp` - Model Context Protocol integration
- `/control-plane` - Analytics and policy management
- `/data` - Data persistence (SQLite)
- `/diff` - Code diff generation and streaming
- `/edit` - Code editing and modification
  - `/lazy` - Lazy evaluation for code edits
  - `/searchAndReplace` - Find and replace operations
- `/indexing` - Codebase indexing
  - `/chunk` - Code chunking strategies
  - `/docs` - Documentation indexing
- `/llm` - LLM integrations
  - `/llms` - Provider implementations (OpenAI, Anthropic, etc.)
  - `/rules` - Rule-based system messages
  - `/templates` - Chat and edit templates

### `/extensions`

IDE-specific extensions for VS Code and JetBrains.

- `/vscode` - VS Code extension
  - Main extension entry point
  - Webview communication
  - VS Code API integrations
- `/intellij` - JetBrains plugin (Kotlin/Java)
  - IntelliJ platform integrations
  - IDE-specific features

### `/gui`

The React-based user interface shared between IDE extensions and CLI TUI.

**Key areas:**

- `/src/components` - Reusable UI components
- `/src/pages` - Main application pages/views
- `/src/redux` - State management
- `/src/hooks` - Custom React hooks

### `/binary`

CLI application and headless mode implementation.

**Key features:**

- Terminal UI (TUI) mode
- Headless execution
- Workflow orchestration

### `/packages`

Shared packages used across the monorepo:

- `@continuedev/fetch` - Unified fetch implementation
- Other utility packages

### `/docs`

Documentation site built with a static site generator.

**Structure:**

- `/agents` - Agent/workflow documentation
- `/cli` - CLI documentation
- `/chat` - Chat features
- `/customize` - Customization guides
- `/guides` - User guides
- `/reference` - API reference

### `/scripts`

Build scripts, deployment scripts, and automation utilities.

### `/eval`

Evaluation and testing infrastructure for AI outputs.

## Core Components

### 1. Configuration System

Continue uses a flexible configuration system that supports multiple formats:

- **YAML configs** (`config.yaml`) - Main configuration format
- **JSON configs** (`.continuerc.json`) - Legacy/shared configs
- **Markdown rules** (`.continuerules`) - Natural language rules
- **Assistant files** - Local assistant definitions

**Key files:**

- `core/config/ConfigHandler.ts` - Main configuration handler
- `core/config/load.ts` - Configuration loading logic
- `core/config/yaml/loadYaml.ts` - YAML parsing

### 2. LLM Integration Layer

Unified interface for multiple LLM providers with consistent APIs:

- Streaming support
- Tool/function calling
- Token counting
- Cost calculation
- Rate limiting

**Key files:**

- `core/llm/llms/llm.ts` - Base LLM interface
- `core/llm/index.ts` - Main LLM orchestration
- `core/llm/llms/OpenAI.ts` - Example provider implementation

### 3. Context System

Gathers relevant context for AI interactions through various providers:

- **@codebase** - Semantic search across codebase
- **@file** - Specific file contents
- **@docs** - Documentation retrieval
- **@git** - Git history and commits
- **MCP** - Model Context Protocol servers

**Key files:**

- `core/context/providers/index.ts` - Provider registry
- `core/context/retrieval/retrieval.ts` - Retrieval logic
- `core/context/mcp/MCPManagerSingleton.ts` - MCP management

### 4. Autocomplete System

AI-powered code completion with intelligent context gathering:

**Pipeline:**

1. **Context Retrieval** - Gather relevant code context
2. **Template Construction** - Build completion prompt
3. **Generation** - Stream completions from LLM
4. **Filtering** - Post-process and validate results
5. **Display** - Show inline suggestions

**Key files:**

- `core/autocomplete/CompletionProvider.ts` - Main completion logic
- `core/autocomplete/context/ContextRetrievalService.ts` - Context gathering
- `core/autocomplete/templating/AutocompleteTemplate.ts` - Prompt construction

### 5. Indexing System

Maintains searchable indexes of codebases and documentation:

- **Full-text search** - Fast keyword-based search
- **Vector embeddings** - Semantic code search
- **Documentation crawler** - Index external docs

**Key files:**

- `core/indexing/CodebaseIndexer.ts` - Main indexing orchestrator
- `core/indexing/chunk/ChunkCodebaseIndex.ts` - Chunked indexing
- `core/indexing/docs/DocsService.ts` - Documentation indexing

### 6. Edit System

Code modification with multiple strategies:

- **Search and replace** - Precise find/replace operations
- **Lazy evaluation** - Deferred code transformations
- **Diff streaming** - Real-time diff generation
- **AST-based edits** - Syntax-aware modifications

**Key files:**

- `core/edit/searchAndReplace/findAndReplaceUtils.ts` - Find/replace logic
- `core/edit/lazy/streamLazyApply.ts` - Lazy evaluation
- `core/diff/streamDiff.ts` - Diff streaming

## Extensions

### VS Code Extension

**Entry point:** `extensions/vscode/src/extension.ts`

**Key components:**

- **Webview** - React GUI embedded in VS Code
- **Commands** - VS Code command palette integration
- **Keybindings** - Keyboard shortcuts
- **Status bar** - Status indicators
- **Sidebar** - Continue panel

### JetBrains Extension

**Entry point:** `extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/`

**Key components:**

- **Tool windows** - Continue panel
- **Actions** - Menu/toolbar actions
- **Listeners** - Editor event handlers
- **Services** - Background services

## Development Workflow

### Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build core:**

   ```bash
   cd core
   npm run build
   ```

3. **Run VS Code extension:**

   ```bash
   cd extensions/vscode
   npm run dev
   ```

4. **Run CLI:**
   ```bash
   cd binary
   npm run dev
   ```

### Key Build Commands

- `npm run build` - Build all packages
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run typecheck` - Type checking

### Testing

- **Unit tests** - `*.test.ts` or `*.vitest.ts` files
- **E2E tests** - `.github/workflows` directory
- **Manual testing** - `manual-testing-sandbox/` directory

### Code Organization Principles

1. **Core is environment-agnostic** - No IDE or CLI-specific code in core
2. **Shared types** - Type definitions in `core/index.d.ts`
3. **Configuration-driven** - Most behavior configurable via YAML
4. **Plugin architecture** - Extensible through context providers, slash commands, etc.
5. **Streaming by default** - All LLM interactions support streaming

## Key Technologies

- **TypeScript** - Primary language
- **React** - GUI framework
- **Redux** - State management
- **Vitest** - Testing framework
- **Tree-sitter** - Code parsing
- **LanceDB** - Vector database
- **SQLite** - Local persistence

## Architecture Patterns

### 1. Provider Pattern

Used for extensible components (LLMs, context providers, etc.):

```typescript
interface IContextProvider {
  title: string;
  getContextItems(query: string): Promise<ContextItem[]>;
}
```

### 2. Singleton Pattern

Used for shared services (MCP manager, analytics, etc.):

```typescript
class MCPManagerSingleton {
  private static instance: MCPManagerSingleton;
  static getInstance() { ... }
}
```

### 3. Strategy Pattern

Used for different completion/edit strategies:

```typescript
interface IEditStrategy {
  apply(code: string, edit: Edit): string;
}
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

### Quick Tips

1. **Core changes** - Most logic belongs in `/core`
2. **New LLM providers** - Add to `/core/llm/llms/`
3. **New context providers** - Add to `/core/context/providers/`
4. **UI changes** - Modify `/gui/src/`
5. **Extension-specific** - Only add to `/extensions/` if truly IDE-specific

## Resources

- [Documentation](https://docs.continue.dev)
- [Discord Community](https://discord.gg/vapESyrFmJ)
- [Contributing Guide](./CONTRIBUTING.md)
- [Changelog](https://changelog.continue.dev)

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
