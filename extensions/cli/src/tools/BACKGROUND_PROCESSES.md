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
// Returns: "Background process started with ID 1 (PID: 12345).
//           Use ReadBackgroundProcessOutput to monitor output:
//           ReadBackgroundProcessOutput(bash_id: 1)"

// 2. Monitor output incrementally (returns only NEW lines each call)
ReadBackgroundProcessOutput({ bash_id: 1 });
// First call: Shows all output up to this point
// Later calls: Only shows lines written since previous call

// 3. Use regex filter to detect specific events
ReadBackgroundProcessOutput({
  bash_id: 1,
  filter: "Local:.*http://localhost",
});
// Returns only lines matching the pattern

// 4. Check all processes
ListProcesses();
// Shows all background processes with status, runtime, PIDs

// 5. Take screenshots, run tests, or do other work
// ... processes continue running ...

// 6. Clean up when done
KillProcess({ bash_id: 1 });
// Terminates the process immediately (SIGTERM)
```

### Common Usage Patterns

**Pattern 1: Wait for Server to Start**

```typescript
// Start server
Bash({ command: "npm run dev", run_in_background: true });

// Poll until ready
while (true) {
  const output = ReadBackgroundProcessOutput({
    bash_id: 1,
    filter: "server.*listening|ready.*http",
  });
  if (output includes server URL) break;
  // Wait a moment before next check
}

// Now safe to proceed with tests/screenshots
```

**Pattern 2: Monitor Build Progress**

```typescript
// Start build
Bash({ command: "npm run build:watch", run_in_background: true });

// Check for completion
const output = ReadBackgroundProcessOutput({
  bash_id: 1,
  filter: "Build complete|Error",
});

// Handle success or error
```

**Pattern 3: Parallel Execution**

```typescript
// Start multiple processes
Bash({ command: "npm run backend", run_in_background: true }); // ID 1
Bash({ command: "npm run frontend", run_in_background: true }); // ID 2

// Monitor both
ReadBackgroundProcessOutput({ bash_id: 1 }); // Backend output
ReadBackgroundProcessOutput({ bash_id: 2 }); // Frontend output

// List all
ListProcesses(); // Shows both processes

// Clean up
KillProcess({ bash_id: 1 });
KillProcess({ bash_id: 2 });
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
