# TTY-less Environment Support

## Overview

The Continue CLI supports running in TTY-less environments (environments without a terminal/TTY), which is essential for:

- VSCode and IntelliJ extensions using the `run_terminal_command` tool
- Docker containers without TTY allocation
- CI/CD pipelines
- Automated scripts and tools
- Background processes

## Architecture

### Mode Separation

The CLI has two distinct execution modes with complete separation:

1. **Interactive Mode (TUI)**: Requires a TTY, uses Ink for rendering
2. **Headless Mode**: Works in TTY-less environments, outputs to stdout/stderr

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry Point                       │
│                         (src/index.ts)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
    ┌───────▼────────┐       ┌───────▼─────────┐
    │ Interactive    │       │   Headless      │
    │ Mode (TUI)     │       │   Mode (-p)     │
    │                │       │                 │
    │ • Requires TTY │       │ • No TTY needed │
    │ • Uses Ink     │       │ • Stdin/stdout  │
    │ • Keyboard UI  │       │ • One-shot exec │
    └────────────────┘       └─────────────────┘
```

### Safeguards Implemented

#### 1. **TTY Detection Utilities** (`src/util/cli.ts`)

```typescript
// Check if running in TTY-less environment
export function isTTYless(): boolean;

// Check if environment supports interactive features
export function supportsInteractive(): boolean;

// Check if prompt was supplied via CLI arguments
export function hasSuppliedPrompt(): boolean;
```

#### 2. **Stdin Reading Protection** (`src/util/stdin.ts`)

Prevents stdin reading when:

- In headless mode with supplied prompt
- `FORCE_NO_TTY` environment variable is set
- In test environments

This avoids blocking/hanging in TTY-less environments where stdin is not available or not readable.

#### 3. **TUI Initialization Guards** (`src/ui/index.ts`)

The `startTUIChat()` function now includes multiple safeguards:

- **Headless mode check**: Throws error if called in headless mode
- **TTY-less check**: Throws error if no TTY is available
- **Raw mode test**: Validates stdin supports raw mode (required by Ink)
- **Explicit stdin/stdout**: Passes streams explicitly to Ink

```typescript
// Critical safeguard: Prevent TUI in headless mode
if (isHeadlessMode()) {
  throw new Error("Cannot start TUI in headless mode");
}

// Critical safeguard: Prevent TUI in TTY-less environment
if (isTTYless() && !customStdin) {
  throw new Error("Cannot start TUI in TTY-less environment");
}
```

#### 4. **Headless Mode Validation** (`src/commands/chat.ts`)

Ensures headless mode has all required inputs:

```typescript
if (!prompt) {
  throw new Error("Headless mode requires a prompt");
}
```

#### 5. **Logger Configuration** (`src/util/logger.ts`)

Configures output handling for TTY-less environments:

- Sets UTF-8 encoding
- Leaves stdout/stderr buffering unchanged in headless mode.
- Disables progress indicators

## Usage Examples

### From VSCode/IntelliJ Extension

```typescript
// Using the run_terminal_command tool
const command = 'cn -p "Analyze the current git diff"';
const result = await runTerminalCommand(command);
```

### From Docker Container

```bash
# Without TTY allocation (-t flag)
docker run --rm my-image cn -p "Generate a README"
```

### From CI/CD Pipeline

```yaml
- name: Run Continue CLI
  run: |
    cn -p "Review code changes" --format json
```

### From Automated Script

```bash
#!/bin/bash
# Non-interactive script
cn -p "Generate commit message for current changes" --silent
```

## Environment Variables

- `FORCE_NO_TTY`: Forces TTY-less mode, prevents stdin reading
- `CONTINUE_CLI_TEST`: Marks test environment, prevents stdin reading

## Testing

### TTY-less Test

```typescript
const result = await runCLI(context, {
  args: ["-p", "Hello, world!"],
  env: {
    FORCE_NO_TTY: "true",
  },
});
```

### Expected Behavior

- ✅ Should not hang on stdin
- ✅ Should not attempt to initialize Ink
- ✅ Should output results to stdout
- ✅ Should exit cleanly

## Error Messages

### Attempting TUI in TTY-less Environment

```
Error: Cannot start TUI in TTY-less environment. No TTY available for interactive mode.
For non-interactive use, run with -p flag:
  cn -p "your prompt here"
```

### Missing Prompt in Headless Mode

```
Error: A prompt is required when using the -p/--print flag, unless --prompt or --agent is provided.

Usage examples:
  cn -p "please review my current git diff"
  echo "hello" | cn -p
  cn -p "analyze the code in src/"
  cn -p --agent my-org/my-agent
```

## Troubleshooting

### CLI Hangs in Docker/CI

**Cause**: CLI attempting to read stdin in TTY-less environment

**Solution**: Ensure using `-p` flag with a prompt:

```bash
cn -p "your prompt" --config config.yaml
```

### "Cannot start TUI" Error

**Cause**: Attempting interactive mode in TTY-less environment

**Solution**: Use headless mode:

```bash
cn -p "your prompt"
```

### Raw Mode Error

**Cause**: Terminal doesn't support raw mode (required by Ink)

**Solution**: Use headless mode instead of interactive mode

## Design Principles

1. **Fail Fast**: Detect environment early and fail with clear messages
2. **Explicit Separation**: No code path should allow Ink to load in headless mode
3. **No Blocking**: Never block on stdin in TTY-less environments
4. **Clear Errors**: Provide actionable error messages with examples
5. **Testing**: Comprehensive tests for TTY-less scenarios

## Implementation Checklist

- [x] Add TTY detection utilities
- [x] Protect stdin reading in headless mode
- [x] Guard TUI initialization
- [x] Validate headless mode inputs
- [x] Configure logger for TTY-less output
- [x] Update test helpers
- [x] Add TTY-less tests
- [x] Document TTY-less support

## Related Files

- `src/util/cli.ts` - TTY detection utilities
- `src/util/stdin.ts` - Stdin reading protection
- `src/ui/index.ts` - TUI initialization guards
- `src/commands/chat.ts` - Mode routing and validation
- `src/util/logger.ts` - Output configuration
- `src/test-helpers/cli-helpers.ts` - Test support
- `src/e2e/headless-minimal.test.ts` - TTY-less tests
