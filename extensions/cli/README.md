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
