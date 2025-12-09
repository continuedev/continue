# Background Process Execution (Beta)

## Overview

This experiment adds the ability for the CN agent to run terminal commands in the background, enabling workflows where long-running processes (like dev servers) need to continue while the agent performs other tasks.

## Motivation

Previously, the Bash tool would block until a command completed. This made it impossible for the agent to:

- Start a dev server and then take screenshots of the running application
- Launch multiple long-running processes concurrently
- Monitor ongoing processes while continuing other work

This feature unlocks new capabilities like automated testing of live applications, parallel command execution, and better handling of persistent services.

## Implementation

### Core Components

1. **BackgroundProcessService** - Manages background process lifecycle, output buffering, and cleanup
2. **Modified Bash Tool** - Added `run_in_background` parameter
3. **Three New Tools**:
   - `ReadBackgroundProcessOutput` - Read buffered output from background processes
   - `KillProcess` - Terminate a background process
   - `ListProcesses` - List all running background processes

### Technical Details

- **Process Registry**: Sequential IDs (1, 2, 3...) for simple reference
- **Output Buffering**: Circular buffer (10K lines per process) prevents memory exhaustion
- **Process Limit**: Max 10 concurrent background processes
- **Lifecycle**: Automatic cleanup on session end via `gracefulExit()`
- **Readiness Detection**: Agent uses regex filtering in `ReadBackgroundProcessOutput` to detect "ready" signals

## Usage

### Enabling the Feature

```bash
cn chat --beta-persistent-terminal-tools "help me build and test my app"
```

### Example Workflow

```typescript
// 1. Start dev server in background
Bash({
  command: "npm run dev",
  run_in_background: true,
});
// Returns: "Background process started with ID 1..."

// 2. Poll for ready signal
ReadBackgroundProcessOutput({
  bash_id: 1,
  filter: "Local:.*http://localhost",
});
// Returns filtered output showing server URL

// 3. Take screenshots or run tests
// ... other agent work ...

// 4. Clean up when done
KillProcess({ bash_id: 1 });
```

## Beta Status

This feature is gated behind the `--beta-persistent-terminal-tools` flag to:

- Test with select users before wider release
- Gather feedback on UX and reliability
- Monitor for edge cases and resource issues
- Iterate on the design based on real usage

### Limitations

- Processes are session-scoped (killed on CLI exit)
- No persistence across agent sessions
- Output buffer limited to 10K lines
- No built-in readiness detection (agent must parse output)

## Future Considerations

- Persistent processes across sessions
- Process groups and orchestration
- Built-in readiness detection for common frameworks
- Extended output history and streaming
- Process resource monitoring and alerts

## Files

- `services/BackgroundProcessService.ts` - Core service
- `tools/runTerminalCommand.ts` - Modified Bash tool
- `tools/bashOutput.ts` - Output monitoring tool
- `tools/killProcess.ts` - Process termination tool
- `tools/listProcesses.ts` - Process listing tool
- `util/exit.ts` - Cleanup integration
