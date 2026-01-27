# Continue CLI

The Continue CLI (`cn`) is a customizable command line coding agent.

![Continue CLI Demo](./media/demo.gif)

## Installation

```bash
npm i -g @continuedev/cli
```

## Usage

```bash
cn
```

### Headless Mode

Headless mode (`-p` flag) runs without an interactive terminal UI, making it perfect for:

- Scripts and automation
- CI/CD pipelines
- Docker containers
- VSCode/IntelliJ extension integration
- Environments without a TTY

```bash
# Basic usage
cn -p "Generate a conventional commit name for the current git changes."

# With piped input
echo "Review this code" | cn -p

# JSON output for scripting
cn -p "Analyze the code" --format json

# Silent mode (strips thinking tags)
cn -p "Write a README" --silent
```

**TTY-less Environments**: Headless mode is designed to work in environments without a terminal (TTY), such as when called from VSCode/IntelliJ extensions using terminal commands. The CLI will not attempt to read stdin or initialize the interactive UI when running in headless mode with a supplied prompt.

### Session Management

The CLI automatically saves your chat history for each terminal session. You can resume where you left off:

```bash
# Resume the last session in this terminal
cn --resume

# List recent sessions and choose one to resume
cn ls

# List sessions in JSON format (for scripting)
cn ls --json
```

## Command Line Options

- `-p`: Run in headless mode (no TUI)
- `--config <path>`: Specify agent configuration path
- `--resume`: Resume the last session for this terminal
- `<prompt>`: Optional prompt to start with

## Environment Variables

- `CONTINUE_CLI_DISABLE_COMMIT_SIGNATURE`: Disable adding the Continue commit signature to generated commit messages
- `FORCE_NO_TTY`: Force TTY-less mode, prevents stdin reading (useful for testing and automation)

## Commands

- `cn`: Start an interactive chat session
- `cn ls`: List recent sessions with TUI selector to choose one to resume
- `cn login`: Authenticate with Continue
- `cn logout`: Sign out of current session
- `cn remote`: Launch a remote instance
- `cn serve`: Start HTTP server mode
- `cn config`: Manage configuration file (see below)

### Configuration Management (`cn config`)

Manage your `config.yaml` file programmatically. Works with any OpenAI-compatible API.

```bash
# Verify configured models exist on provider
cn config verify --provider openai

# Sync config - remove models that don't exist
cn config sync --provider openai --dry-run
cn config sync --provider openai

# List available models
cn config list --provider openai --chat-only

# Add/remove models
cn config add gpt-4o --provider openai --role chat
cn config remove gpt-3.5-turbo

# Generate fresh config from available models
cn config generate --provider openai --chat-only

# Compare config to available models
cn config diff --provider openai

# Backup management
cn config backups
cn config restore config.backup-2026-01-27.yaml

# JSON output for scripting
cn config list --provider openai --json
```

**Subcommands:**

| Command            | Description                                       |
| ------------------ | ------------------------------------------------- |
| `verify`           | Check if configured models exist on provider      |
| `sync`             | Remove unavailable models (`--dry-run` supported) |
| `validate`         | Validate config file structure                    |
| `sections`         | Show config sections                              |
| `list`             | List available models from provider               |
| `test`             | Test each chat model with sample prompt           |
| `add <model>`      | Add model with `--name`, `--role` options         |
| `remove <model>`   | Remove model from config                          |
| `generate`         | Bootstrap config from available models            |
| `show`             | Display current config                            |
| `diff`             | Compare config vs available models                |
| `backups`          | List backup files                                 |
| `restore <backup>` | Restore from backup                               |

**Provider Presets:** `--provider` accepts: `openai`, `anthropic`, `azure`, `ollama`, `together`, `groq`, `mistral`

**Filter Options:** `--chat-only`, `--embed-only`, `--rerank-only`, `--filter <pattern>`

### Session Listing (`cn ls`)

Shows recent sessions, limited by screen height to ensure it fits on your terminal.

- `--json`: Output in JSON format for scripting (always shows 10 sessions)

## TTY-less Support

The CLI fully supports running in environments without a TTY (terminal):

```bash
# From Docker without TTY allocation
docker run --rm my-image cn -p "Generate docs"

# From CI/CD pipeline
cn -p "Review changes" --format json

# From VSCode/IntelliJ extension terminal tool
cn -p "Analyze code" --silent
```

The CLI automatically detects TTY-less environments and adjusts its behavior:

- Skips stdin reading when a prompt is supplied
- Disables interactive UI components
- Ensures clean stdout/stderr output

For more details, see [`spec/tty-less-support.md`](./spec/tty-less-support.md).
