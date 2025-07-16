# Continue CLI

The Continue CLI (`cn`) is a customizable command line coding agent.

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
```

Each terminal window maintains its own separate session, so you can have multiple concurrent conversations without them interfering with each other.

### Advanced Usage

```bash
# Resume session with specific assistant
cn --resume --config my-assistant

# Resume session in headless mode
cn --resume -p
```

## Command Line Options

- `-p`: Run in headless mode (no TUI)
- `--config <path>`: Specify assistant configuration path
- `--resume`: Resume the last session for this terminal
- `<prompt>`: Optional prompt to start with

## Session Storage

Sessions are stored in `~/.continue-cli/sessions/` and are automatically managed per terminal window using environment variables like:

- `TERM_SESSION_ID`
- `SSH_TTY`
- `TMUX`
- `STY`

If none of these are available, the process ID is used as a fallback.
