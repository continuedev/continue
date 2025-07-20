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

## Command Line Options

- `-p`: Run in headless mode (no TUI)
- `--config <path>`: Specify agent configuration path
- `--resume`: Resume the last session for this terminal
- `<prompt>`: Optional prompt to start with
