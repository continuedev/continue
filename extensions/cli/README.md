# Yuto Agentic CLI

The Yuto Agentic CLI (`yt`) is a customizable command line coding agent.

![Yuto Agentic CLI Demo](./media/demo.gif)

## Installation

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/continuedev/continue/main/extensions/cli/scripts/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/continuedev/continue/main/extensions/cli/scripts/install.ps1 | iex
```

Or install with npm if you have Node.js 20+:

```bash
npm i -g @yutoagentic/cli
```

## Usage

```bash
yt
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
yt -p "Generate a conventional commit name for the current git changes."

# With piped input
echo "Review this code" | yt -p

# JSON output for scripting
yt -p "Analyze the code" --format json

# Silent mode (strips thinking tags)
yt -p "Write a README" --silent
```

**TTY-less Environments**: Headless mode is designed to work in environments without a terminal (TTY), such as when called from VSCode/IntelliJ extensions using terminal commands. The CLI will not attempt to read stdin or initialize the interactive UI when running in headless mode with a supplied prompt.

### Session Management

The CLI automatically saves your chat history for each terminal session. You can resume where you left off:

```bash
# Resume the last session in this terminal
yt --resume

# List recent sessions and choose one to resume
yt ls

# List sessions in JSON format (for scripting)
yt ls --json
```

## Command Line Options

- `-p`: Run in headless mode (no TUI)
- `--config <path>`: Specify agent configuration path
- `--resume`: Resume the last session for this terminal
- `<prompt>`: Optional prompt to start with

## Environment Variables

- `CONTINUE_CLI_DISABLE_COMMIT_SIGNATURE`: Disable adding the Yuto Agentic commit signature to generated commit messages
- `FORCE_NO_TTY`: Force TTY-less mode, prevents stdin reading (useful for testing and automation)

## Commands

- `yt`: Start an interactive chat session
- `yt ls`: List recent sessions with TUI selector to choose one to resume
- `yt login`: Authenticate with Yuto Agentic
- `yt logout`: Sign out of current session
- `yt remote`: Launch a remote instance
- `yt serve`: Start HTTP server mode

### Modes and Permissions

In interactive mode, use `/mode` to switch between execution profiles:

- `normal`: default edit-and-run behavior
- `plan`: read-only investigation with no file edits or shell execution
- `auto`: continuous tool execution with fewer confirmation stops
- `explore`: reconnaissance-focused analysis
- `verify`: review and validation
- `coordinator`: delegate work to subagents while keeping direct writes blocked on the coordinator

`/coordinator` is a shortcut for `/mode coordinator`. In coordinator mode, the CLI auto-allows common read-only shell probes such as `rg` and `git status`, blocks common mutating shell commands, and expects delegated workers to use the `coordinator-worker` profile so they share the same scratchpad.

### Session Listing (`yt ls`)

Shows recent sessions, limited by screen height to ensure it fits on your terminal.

- `--json`: Output in JSON format for scripting (always shows 10 sessions)

## TTY-less Support

The CLI fully supports running in environments without a TTY (terminal):

```bash
# From Docker without TTY allocation
docker run --rm my-image yt -p "Generate docs"

# From CI/CD pipeline
yt -p "Review changes" --format json

# From VSCode/IntelliJ extension terminal tool
yt -p "Analyze code" --silent
```

The CLI automatically detects TTY-less environments and adjusts its behavior:

- Skips stdin reading when a prompt is supplied
- Disables interactive UI components
- Ensures clean stdout/stderr output

For more details, see [`spec/tty-less-support.md`](./spec/tty-less-support.md).
