<p align="center">
  <img src="https://img.shields.io/npm/v/@continuedev/cli" alt="npm version">
  <img src="https://img.shields.io/node/v/@continuedev/cli" alt="Node version">
  <img src="https://img.shields.io/npm/l/@continuedev/cli" alt="License">
  <img src="https://img.shields.io/github/issues/continuedev/cli" alt="Issues">
</p>

# Continue CLI

The Continue CLI (`cn`) is a powerful, customizable command-line AI coding agent that brings the power of Continue directly to your terminal. It provides an interactive AI-assisted development experience with streaming responses, built-in tools, and flexible configuration options.

## ✨ Key Features

- 🤖 **Interactive AI Assistant**: Chat with AI models directly in your terminal
- 🔧 **Built-in Development Tools**: File operations, code search, terminal commands, and more
- 📝 **Multiple Interface Modes**: TUI (Terminal UI), headless, and standard chat modes
- 🔄 **Session Management**: Automatic chat history saving and resumption
- ⚙️ **Flexible Configuration**: Support for multiple AI models and custom assistants
- 🌐 **Hub Integration**: Access to shared rules and configurations from hub.continue.dev
- 🔒 **Authentication**: Secure WorkOS-based authentication

![Continue CLI Demo](./media/demo.gif)

## 🔧 Prerequisites

- Node.js >= 18
- npm or yarn package manager
- An active Continue account and API key

## 📦 Installation

```bash
npm i -g @continuedev/cli
```

## 🚀 Getting Started

### Basic Usage

```bash
# Start an interactive session
cn

# Start with a specific prompt
cn "Help me refactor this function"

# Run in headless mode (no interactive UI)
cn -p "Generate a conventional commit name for the current git changes."
```

### First Time Setup

On first run, the CLI will guide you through authentication and configuration:

1. **Authentication**: You'll be redirected to authenticate with Continue
2. **API Key**: Enter your Continue API key when prompted
3. **Configuration**: The CLI will help you set up your `~/.continue/config.yaml`

## 🎛️ Command Line Options

| Flag | Description | Example |
|------|-------------|--------|
| `-p, --print` | Run in headless mode (non-interactive) | `cn -p "Explain this code"` |
| `--config <path>` | Specify custom configuration file | `cn --config ./custom-config.yaml` |
| `--resume` | Resume the last session in this terminal | `cn --resume` |
| `--readonly` | Start in plan mode (deprecated) | `cn --readonly` |
| `--rule <spec>` | Apply custom rules (file path, hub slug, or content) | `cn --rule "continuedev/typescript"` |
| `--format <format>` | Output format for headless mode | `cn --format json -p "List files"` |
| `<prompt>` | Initial prompt to start the conversation | `cn "Review my latest changes"` |

## ⚙️ Configuration

### Config File Location

The CLI uses `~/.continue/config.yaml` for configuration. Here's an example:

```yaml
name: CLI Agent
version: 0.0.1
schema: v1

models:
  - uses: anthropic/claude-3-5-sonnet
    with:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  - uses: openai/gpt-4
    with:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

mcpServers:
  - uses: repomix/repomix-mcp
  - uses: anthropic/memory-mcp
```

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Required: Your Continue API key
CONTINUE_API_KEY=your_api_key_here

# Optional: API base URL (defaults to https://api.continue.dev/)
CONTINUE_API_BASE=https://api.continue.dev/
```

### Rules and Customization

You can apply custom rules using the `--rule` flag:

```bash
# From hub.continue.dev
cn --rule "continuedev/typescript" "Review this code"

# From local file
cn --rule "./my-coding-rules.md" "Help me code"

# Direct rule content
cn --rule "Always use TypeScript" "Write a function"
```

## 🛠️ Available Tools

The CLI comes with powerful built-in tools that the AI can use:

### File Operations
- **read_file**: Read file contents
- **write_file**: Create or overwrite files
- **list_files**: List directory contents
- **search_and_replace**: Edit files with precise search/replace

### Code Analysis
- **search_code**: Search codebase with ripgrep
- **view_diff**: View file differences

### System Integration
- **run_terminal_command**: Execute shell commands
- **fetch**: Fetch content from URLs
- **write_checklist**: Create task checklists

### Headless Mode Only
- **exit**: Exit with specific status codes (for CI/CD)

## 📋 Examples

### Interactive Development
```bash
# Start coding session
cn
> "Help me implement a REST API for user management"

# Review git changes
cn "Review my uncommitted changes and suggest improvements"

# Refactor code
cn "Help me refactor the authentication module for better security"
```

### Headless Automation
```bash
# Generate commit messages
cn -p "Generate a conventional commit message for current changes"

# Code review in CI
cn -p "Review the changes in this PR for security issues"

# JSON output for scripts
cn --format json -p "List all TODO comments in the codebase"
```

### Session Management
```bash
# Resume previous conversation
cn --resume

# Start fresh session
cn "New topic: API documentation"
```

## 🔄 Session Management

The CLI automatically saves your chat history for each terminal session:

- **Automatic Saving**: Conversations are saved to `~/.continue-cli/sessions/`
- **Session Isolation**: Each terminal session has its own history
- **Easy Resumption**: Use `--resume` to continue where you left off

```bash
# Continue your last conversation
cn --resume

# Start a new session (doesn't resume)
cn
```

## 🔐 Authentication

The CLI uses WorkOS for secure authentication:

1. **First Run**: You'll be redirected to authenticate in your browser
2. **Token Storage**: Auth tokens are stored in `~/.continue/auth.json`
3. **Organization Support**: Switch between different Continue organizations
4. **API Key**: Required for accessing Continue's AI models

## 🔧 Troubleshooting

### Common Issues

**Command not found: cn**
```bash
# Ensure global install completed
npm i -g @continuedev/cli

# Check if npm global bin is in PATH
npm config get prefix
```

**Authentication errors**
```bash
# Clear auth cache and re-authenticate
rm ~/.continue/auth.json
cn
```

**Configuration issues**
```bash
# Check your config file
cat ~/.continue/config.yaml

# Use a specific config
cn --config /path/to/custom-config.yaml
```

**Session not resuming**
```bash
# Check session directory
ls ~/.continue-cli/sessions/

# Force new session
cn "New conversation"
```

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
export LOG_LEVEL=debug
cn
```

Logs are stored in `~/.continue/logs/`

## 🧪 Development

For contributors and developers:

```bash
# Clone the repository
git clone https://github.com/continuedev/cli.git
cd cli

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run in development mode
npm run dev

# Type checking
npm run lint
```

### Testing

```bash
# Run all tests
npm test

# Run specific test pattern
npm test -- --testNamePattern="headless"

# Run with coverage
npm test -- --coverage
```

## 📚 Resources

- **Documentation**: [continue.dev/docs](https://continue.dev/docs)
- **Community**: [Discord](https://discord.gg/vapESyrFmJ)
- **Hub**: [hub.continue.dev](https://hub.continue.dev) - Shared rules and configurations
- **Issues**: [GitHub Issues](https://github.com/continuedev/continue/issues)
- **Contributing**: [Contributing Guide](https://continue.dev/docs/contributing)

## 📄 License

Apache-2.0 © [Continue Dev, Inc.](https://continue.dev)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://continue.dev/docs/contributing) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

**Made with ❤️ by the Continue team**