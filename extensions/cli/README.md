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

```bash
cn -p "Generate a conventional commit name for the current git changes."
```

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
