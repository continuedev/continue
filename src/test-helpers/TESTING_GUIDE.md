# Testing Guide for Continue CLI

This guide explains how to write reliable cross-platform tests for the Continue CLI, with special attention to Windows compatibility.

## Overview

The Continue CLI test suite uses standard test helpers with minimal Windows-specific accommodations. The CLI itself handles output flushing properly, ensuring tests work reliably across all platforms.

Key considerations:
- Windows may need slightly more time for process cleanup
- Output should be trimmed when comparing exact strings
- Mock servers should be properly cleaned up

## Key Test Helpers

### 1. CLI Test Context (`cli-helpers.ts`)

Always use the provided test context and helpers:

```typescript
import {
  createTestContext,
  cleanupTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";

describe("Your Test Suite", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  it("should do something", async () => {
    const result = await runCLI(context, {
      args: ["-p", "Hello"],
      timeout: 15000, // Optional: default is 10000ms
    });

    expect(result.stdout).toContain("Expected output");
    expect(result.exitCode).toBe(0);
  });
});
```

**Important:** Always use `runCLI()` instead of directly spawning processes. It handles:
- Cross-platform process execution
- Proper output capture
- Windows-specific environment variables
- Automatic cleanup

### 2. Mock LLM Server (`mock-llm-server.ts`)

For tests that need to mock LLM responses:

```typescript
import {
  setupMockLLMTest,
  cleanupMockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("LLM Test", () => {
  let context: any;
  let mockServer: MockLLMServer;

  beforeEach(async () => {
    context = await createTestContext();
    mockServer = await setupMockLLMTest(context, {
      response: "Mock response",
      // or dynamic responses:
      response: (prompt: string) => {
        if (prompt.includes("weather")) {
          return "It's sunny!";
        }
        return "Default response";
      },
    });
  });

  afterEach(async () => {
    await cleanupMockLLMServer(mockServer);
    await cleanupTestContext(context);
  });
});
```

**Important:** Always clean up mock servers in `afterEach` to prevent port conflicts and hanging processes.

## Best Practices

### 1. Test Timeouts

- Default timeout is 10 seconds
- For tests involving network operations or multiple CLI calls, use 15-20 seconds
- Example: `runCLI(context, { args: [...], timeout: 15000 })`

### 2. Output Assertions

Always trim output when comparing exact strings to handle platform differences:

```typescript
// Good
expect(result.stdout.trim()).toBe("Expected output");

// Bad - may fail due to trailing whitespace
expect(result.stdout).toBe("Expected output");

// For partial matches, use toContain (no trim needed)
expect(result.stdout).toContain("partial match");
```

### 3. Multiple Mock Servers

When using multiple mock servers, track them for cleanup:

```typescript
let extraServers: MockLLMServer[] = [];

beforeEach(async () => {
  extraServers = [];
});

afterEach(async () => {
  // Clean up extra servers first
  await Promise.all(extraServers.map(server => cleanupMockLLMServer(server)));
  extraServers = [];
  
  // Then clean up main server and context
  if (mockServer) {
    await cleanupMockLLMServer(mockServer);
  }
  await cleanupTestContext(context);
});

it("test with multiple servers", async () => {
  const server2 = await createMockLLMServer({ response: "Server 2" });
  extraServers.push(server2);
  // ... test logic
});
```

### 4. Session and File Management

The test context provides an isolated temporary directory. Use it for all file operations:

```typescript
// Good - uses test directory
const configPath = path.join(context.testDir, "config.yaml");

// Bad - uses system directories
const configPath = "/tmp/config.yaml";
```

### 5. Environment Variables

Test-specific environment variables are automatically set. You can add more:

```typescript
const result = await runCLI(context, {
  args: ["-p", "Hello"],
  env: {
    MY_CUSTOM_VAR: "value",
    // These are set automatically:
    // CONTINUE_CLI_TEST: "true"
    // HOME/USERPROFILE: context.testDir
  },
});
```

### 6. Error Handling

Use `expectError` for tests that should fail:

```typescript
const result = await runCLI(context, {
  args: ["--invalid-flag"],
  expectError: true,
});

expect(result.exitCode).not.toBe(0);
expect(result.stderr).toContain("error message");
```

## Common Pitfalls to Avoid

1. **Don't use `process.exit()` in test code** - Use the CLI's built-in exit handling
2. **Don't use `execSync` or `spawn` directly** - Use `runCLI()`
3. **Don't hardcode paths** - Use `context.testDir` for file operations
4. **Don't skip cleanup** - Always clean up servers and contexts
5. **Don't use short timeouts** - Windows needs more time for process operations

## Platform-Specific Considerations

### Windows
- Process creation is slower
- Output buffering behaves differently
- Socket cleanup requires explicit connection destruction
- File paths must use forward slashes or `path.join()`

### macOS/Linux
- Generally faster process creation
- More predictable output flushing
- Cleaner socket cleanup

## Debugging Failed Tests

1. **Check for timing issues**: Increase timeouts
2. **Check for cleanup issues**: Ensure all servers are properly cleaned up
3. **Check output format**: Use `.trim()` for exact comparisons
4. **Check file paths**: Use `path.join()` for cross-platform paths
5. **Enable verbose logging**: Set `NODE_ENV=test` for more detailed output

## Example: Complete Test File

```typescript
import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import {
  setupMockLLMTest,
  cleanupMockLLMServer,
  type MockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("E2E: My Feature", () => {
  let context: any;
  let mockServer: MockLLMServer;

  beforeEach(async () => {
    context = await createTestContext();
    mockServer = await setupMockLLMTest(context, {
      response: "Test response",
    });
  });

  afterEach(async () => {
    await cleanupMockLLMServer(mockServer);
    await cleanupTestContext(context);
  });

  it("should handle basic prompt", async () => {
    const result = await runCLI(context, {
      args: ["-p", "Hello", "--config", context.configPath],
      timeout: 15000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Test response");
    expect(mockServer.requests).toHaveLength(1);
  });

  it("should handle errors gracefully", async () => {
    const result = await runCLI(context, {
      args: ["--invalid-command"],
      expectError: true,
    });

    expect(result.exitCode).not.toBe(0);
  });
});
```

## Summary

By following these guidelines and using the provided test helpers, you can write reliable tests that work across all platforms. The key is to:

1. Always use the provided test helpers
2. Clean up resources properly
3. Handle output with platform differences in mind
4. Use appropriate timeouts
5. Test error cases explicitly

Remember: The test helpers handle the complexity of cross-platform compatibility, so you can focus on testing your feature's behavior.