# TUI Testing Framework

This directory contains a comprehensive testing framework for the Continue CLI's Terminal User Interface (TUI) that supports running tests in both normal (local) and remote modes.

## Overview

The testing framework ensures that the TUI behaves consistently whether running locally or connected to a remote `cn serve` instance. Most tests run in both modes automatically, verifying feature parity between local and remote operation.

## Key Components

### 1. Mock Remote Server (`mockRemoteServer.ts`)

A mock Express server that simulates the `cn serve` endpoints:

- `GET /state` - Returns current chat state
- `POST /message` - Receives user messages and can simulate responses

### 2. Test Helper (`TUIChat.testHelper.ts`)

Provides utilities for writing tests that work in both modes:

- `runTest()` - Run a single test in specified mode(s)
- `runTestSuite()` - Run a test suite in specified mode(s)
- Helper functions for common operations

### 3. Test Files

- `TUIChat.basic.test.tsx` - Basic UI and layout tests
- `TUIChat.messages.test.tsx` - Message handling tests
- `TUIChat.remote.test.tsx` - Remote-specific behavior tests
- Additional test files for other features...

## Writing Tests

### Basic Test (runs in both modes)

```typescript
import { runTest } from "./TUIChat.testHelper.js";

runTest("my test name", async (ctx) => {
  const { renderResult, mode, server } = ctx;

  // Your test code here
  const frame = renderResult.lastFrame();
  expect(frame).toContain("Expected content");

  // Mode-specific logic if needed
  if (mode === "remote" && server) {
    // Remote-specific assertions
  }
});
```

### Test Suite (runs all tests in both modes)

```typescript
import { runTestSuite } from "./TUIChat.testHelper.js";

runTestSuite("My Test Suite", () => {
  runTest("test 1", async (ctx) => {
    // Test code
  });

  runTest("test 2", async (ctx) => {
    // Test code
  });
});
```

### Mode-Specific Tests

```typescript
// Remote-only test
runTest(
  "remote-specific behavior",
  async (ctx) => {
    // This only runs in remote mode
  },
  { mode: "remote" },
);

// Normal-only test
runTest(
  "local-specific behavior",
  async (ctx) => {
    // This only runs in normal mode
  },
  { mode: "normal" },
);
```

## Helper Functions

### `sendMessage(ctx, message, waitTime?)`

Sends a message and waits for it to be processed:

```typescript
await sendMessage(ctx, "Hello world");
```

### `waitForServerState(server, predicate, timeout?)`

Waits for server state to match a condition (remote mode only):

```typescript
await waitForServerState(server, (state) => state.messages.length > 0, 5000);
```

### `expectRemoteMode(frame)` / `expectNormalMode(frame)`

Verify mode-specific UI indicators:

```typescript
if (mode === "remote") {
  expectRemoteMode(frame);
} else {
  expectNormalMode(frame);
}
```

## Server Setup

For tests that need specific server behavior:

```typescript
runTest(
  "test with custom server",
  async (ctx) => {
    // Test code
  },
  {
    serverSetup: (server) => {
      server.onMessage((msg) => {
        // Custom response logic
        server.simulateResponse(`Echo: ${msg}`);
      });
    },
  },
);
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test TUIChat.basic.test.tsx

# Run with coverage
npm test -- --coverage
```

## Best Practices

1. **Write mode-agnostic tests by default** - Most functionality should work the same in both modes
2. **Use helper functions** - They handle mode-specific details automatically
3. **Test server state in remote mode** - Verify both UI and server state for comprehensive coverage
4. **Handle async operations properly** - Use appropriate wait times and state checks
5. **Clean up resources** - The framework handles server lifecycle automatically

## Debugging

- Tests output the current mode in brackets: `[NORMAL MODE]` or `[REMOTE MODE]`
- Server state can be inspected with `server.getState()`
- Use `console.log(renderResult.lastFrame())` to see the current UI state
- Mock server runs on a random port to avoid conflicts
