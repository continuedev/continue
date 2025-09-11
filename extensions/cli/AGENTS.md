# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript in dist/
- **Test**: `npm test` - Runs Vitest tests with ESM support
- **Type Check**: `npm run lint` - Runs TypeScript compiler without emitting files for type checking
- **Format**: `npm run format` - Runs Prettier with --write flag to check + fix formatting
- **Start**: `npm start` - Runs the built CLI from dist/index.js
- **Development**: After building, test locally with `node dist/index.js`

## Architecture Overview

This is a CLI tool for Continue Dev that provides an interactive AI-assisted development experience. The architecture consists of:

### Core Components

1. **Entry Point** (`src/index.ts`): Main CLI logic with two modes:

   - **Headless mode**: Non-interactive mode for automation/CI
   - **TUI mode**: Terminal User Interface using Ink/React
   - **Standard mode**: Traditional readline-based chat interface

2. **Authentication** (`src/auth/`): WorkOS-based authentication system

   - `ensureAuth.ts`: Handles authentication flow
   - `workos.ts`: WorkOS configuration and token management

3. **Continue SDK Integration** (`src/continueSDK.ts`): Initializes the Continue SDK client with:

   - API key authentication
   - Assistant configuration (slug-based)
   - Organization support

4. **Terminal UI** (`src/ui/`): React/Ink-based TUI components

   - `TUIChat.tsx`: Main chat interface component
   - `UserInput.tsx`: Input handling with multi-line support
   - `TextBuffer.ts`: Text display utilities

5. **Tools System** (`src/tools/`): Built-in development tools including:

   - File operations (read, write, list)
   - Code search functionality
   - Terminal command execution
   - Diff viewing
   - Exit tool (headless mode only)

6. **MCP Integration** (`src/mcp.ts`): Model Context Protocol service for extended tool capabilities

### Key Features

- **Streaming Responses**: Real-time AI response streaming (`streamChatResponse.ts`)
- **Slash Commands**: Built-in commands like `/help`, `/exit` (`slashCommands.ts`)
- **Multi-mode Operation**: Supports TUI, headless, and standard chat modes
- **Tool Integration**: Extensible tool system for development tasks

### Testing Setup

- Uses Vitest with TypeScript and ESM support
- Configuration in `vitest.config.ts`
- Tests should be written with `.test.ts` extension
- No existing test files found - tests should be added when writing new functionality
- Run tests using `npm run test path/or/pattern`

### Build System

- TypeScript compilation with declaration files
- ESNext target with NodeNext module resolution
- Outputs to `dist/` directory
- Source maps and inline sources enabled
- JSX support for React components
- Relative import paths require explicit file extensions, e.g. 'from "./test.js"' instead of 'from "./test"'

### Important rules

- Whenever you create / update a test, you should run the test to be certain that it passes
- If you ever create a PR, you should be sure to check the formatting and linting first with `npm run format` and `npm run lint` / `npm run lint:fix`.
