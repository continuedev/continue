# Contributing to Code Mode

Thank you for your interest in contributing to Code Mode! This document provides guidelines for contributing to this project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Project Structure](#project-structure)

---

## Code of Conduct

This project follows a simple code of conduct:

- **Be respectful** - Treat all contributors with respect
- **Be constructive** - Provide helpful feedback and suggestions
- **Be collaborative** - Work together to improve the project

---

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please [create an issue](https://github.com/Connorbelez/codeMode/issues) with:

- **Clear title** - Describe the issue concisely
- **Steps to reproduce** - How to trigger the bug
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happens
- **Environment** - OS, Node version, E2B configuration, etc.
- **Logs** - Relevant error messages or stack traces

### Suggesting Enhancements

Enhancement suggestions are welcome! Please include:

- **Use case** - What problem does this solve?
- **Proposed solution** - How should it work?
- **Token impact** - How does this affect token usage/performance?
- **Example** - Code snippet showing the desired API/behavior

### Contributing Code

1. **Fork the repository** on GitHub
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** with clear, descriptive commits
4. **Test your changes** thoroughly
5. **Submit a pull request** with a clear description

---

## Development Setup

### Prerequisites

- Node.js >= 20.19.0
- npm or yarn
- E2B API key (for code execution features)
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/codeMode.git
cd codeMode

# Install dependencies
npm install

# Build the project
npm run build
```

### Running Tests

```bash
# Run all tests
cd core && npm test

# Run with coverage
cd core && npm run test:coverage
```

### Development Workflow

```bash
# Watch mode for development
npm run tsc:watch

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

---

## Submitting Changes

### Pull Request Process

1. **Update documentation** - If you change APIs or behavior
2. **Add tests** - Cover new functionality
3. **Update examples** - If adding features, add examples to `/examples`
4. **Follow style guidelines** - Use Prettier
5. **Write clear commit messages** - Explain what and why

### Commit Message Format

Use conventional commits format:

```
type(scope): brief description

Longer explanation if needed.

Fixes #issue-number
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `perf`: Performance improvements
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(mcp): add support for WebSocket transport

Replace file-based IPC with WebSocket transport for lower
latency and better observability.

Closes #42
```

```
fix(sandbox): handle timeout errors gracefully

Previously, timeout errors would crash the sandbox. Now they're
caught and returned as proper error responses.

Fixes #56
```

---

## Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Provide type annotations for public APIs
- Avoid `any` - use `unknown` if type is truly unknown
- Use interfaces for object shapes
- Prefer `const` and `let` over `var`

### Code Style

We use Prettier for code formatting:

```bash
# Format all code
npm run format

# Check formatting
npm run format:check
```

### Documentation

- Add JSDoc comments for public APIs
- Include examples in documentation
- Update README if adding user-facing features
- Keep comments concise and relevant

### Testing

- Write tests for new functionality
- Test edge cases and error conditions
- Use descriptive test names

**Example:**
```typescript
describe('McpWrapperGenerator', () => {
  it('should convert JSON Schema to TypeScript types', () => {
    // Test implementation
  });

  it('should handle optional parameters correctly', () => {
    // Test implementation
  });

  it('should throw error for invalid schemas', () => {
    // Test implementation
  });
});
```

---

## Project Structure

```
codeMode/
├── core/                    # Core functionality
│   ├── tools/              # Tool implementations
│   │   └── executeCode.ts  # Code Mode implementation (MCP wrapper gen, E2B, IPC)
│   └── context/mcp/        # MCP integration
├── examples/               # Example workflows
│   └── advanced-composition/  # Production examples
├── docs/                   # Documentation
├── extensions/             # IDE extensions (Continue.dev)
│   ├── vscode/
│   └── cli/
└── packages/               # Shared packages
```

### Key Files for Code Mode

- **`core/tools/implementations/executeCode.ts`** - Main Code Mode implementation
  - `McpWrapperGenerator` - Generates TypeScript from MCP schemas
  - `McpRequestMonitor` - Handles sandbox IPC
  - `globalThis.__mcp_invoke` - Bridge function

- **`examples/advanced-composition/`** - Production examples showing token reduction

---

## Areas for Contribution

### High Priority

- **WebSocket/HTTP transport** - Replace file-based IPC for lower latency
- **Better error messages** - Improve developer experience
- **More examples** - Real-world use cases showing token reduction
- **Performance benchmarks** - Automated token usage tracking
- **Documentation** - Tutorials, guides, API docs

### Good First Issues

Look for issues labeled `good-first-issue`:

- **Add MCP server example** - Create examples for new MCP servers
- **Improve type generation** - Handle edge cases in JSON Schema conversion
- **Documentation improvements** - Fix typos, add clarifications
- **Add tests** - Improve test coverage

---

## Getting Help

- **Questions?** Open a [GitHub discussion](https://github.com/Connorbelez/codeMode/discussions)
- **Issues?** Check [existing issues](https://github.com/Connorbelez/codeMode/issues) or create a new one
- **Continue.dev** - Join the [Continue Discord](https://discord.gg/vapESyrFmJ) for general questions

---

## Attribution & Licensing

### Code Mode Enhancements

Code Mode enhancements are authored by **Connor Belez** and contributors.

### Continue.dev Framework

This project builds on Continue.dev (Apache 2.0). When modifying Continue.dev code:

1. Preserve original copyright notices
2. Document changes clearly
3. Follow Apache 2.0 license requirements

See [ATTRIBUTION.md](ATTRIBUTION.md) for detailed attribution.

### License

By contributing to Code Mode, you agree that your contributions will be licensed under the Apache 2.0 License.

---

## Development Notes

### Code Mode Specific

- **Token reduction is the priority** - Always consider token impact
- **Backwards compatibility** - Works with any MCP server out of the box
- **Type safety** - Generated TypeScript must be type-safe
- **Examples over docs** - Show, don't tell

### Continue.dev Framework

For questions about the underlying Continue.dev framework:
- See [Continue.dev docs](https://docs.continue.dev)
- Join [Continue Discord](https://discord.gg/vapESyrFmJ)
- Read the [Continue contributing guide](https://github.com/continuedev/continue/blob/main/CONTRIBUTING.md)

---

Thank you for contributing to Code Mode! 🚀

Your contributions help make AI agent workflows more efficient and cost-effective for everyone.
