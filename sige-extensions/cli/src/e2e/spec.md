# End-to-End Testing for Continue CLI

This document describes the principles, practices, and patterns for writing end-to-end (E2E) tests for the Continue CLI.

## Overview

End-to-end tests verify that the CLI functions correctly as a whole by executing the actual CLI binary and validating its behavior from the user's perspective. These tests help ensure that all components work together properly in a real-world environment.

## Key Principles

1. **Isolation**: Each test runs in a completely isolated environment with its own temporary directory
2. **Independence**: Tests should not depend on each other and can be run in any order
3. **Realistic Usage**: Tests should simulate how users actually interact with the CLI
4. **Minimal Mocking**: Mock only external dependencies (like LLM APIs) when necessary
5. **Thorough Cleanup**: Tests should clean up after themselves to avoid leaking resources

## Test Structure

A typical E2E test follows this structure:

```typescript
describe("E2E: Feature", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  it("should do something", async () => {
    const result = await runCLI(context, {
      args: ["command", "--flag"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Expected output");
  });
});
```

## Test Context

The test context (`createTestContext()`) provides:

- Temporary test directory (`context.testDir`)
- Path to the CLI binary (`context.cliPath`)
- Optional paths for config and session files

## Core Testing Utilities

### Basic CLI Execution

```typescript
// Run CLI with arguments
const result = await runCLI(context, {
  args: ["--help"],
});

// Verify output and exit code
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain("Continue CLI");
```

### Testing with Input

```typescript
// Run CLI with input
const result = await runCLI(context, {
  args: ["-p", "Prompt with input"],
  input: "User input\n",
});
```

### Interactive Testing

```typescript
// For complex interactive flows
const result = await withInteractiveInput(
  context,
  ["chat"],
  ["First input", "Second input"],
);
```

### Testing Error Cases

```typescript
// Test error scenarios
const result = await runCLI(context, {
  args: ["--invalid-flag"],
  expectError: true,
});

expect(result.exitCode).not.toBe(0);
expect(result.stderr).toContain("error");
```

## Testing with Mock LLM

For tests involving AI models, we use a mock LLM server:

```typescript
let mockServer: MockLLMServer;

beforeEach(async () => {
  context = await createTestContext();
  mockServer = await setupMockLLMTest(context, {
    response: "Hello World!",
  });
});

afterEach(async () => {
  await cleanupMockLLMServer(mockServer);
  await cleanupTestContext(context);
});

it("should get response from mock LLM", async () => {
  const result = await runCLI(context, {
    args: ["-p", "--config", context.configPath, "Hi"],
  });

  expect(result.stdout).toContain("Hello World!");
});
```

### Advanced Mock LLM Features

- **Dynamic responses** based on prompts:

  ```typescript
  mockServer = await setupMockLLMTest(context, {
    response: (prompt) =>
      prompt.includes("weather") ? "It's sunny!" : "I don't know",
  });
  ```

- **Non-streaming responses**:

  ```typescript
  mockServer = await setupMockLLMTest(context, {
    response: "All at once response",
    streaming: false,
  });
  ```

- **Request tracking**:
  ```typescript
  expect(mockServer.requests).toHaveLength(1);
  expect(mockServer.requests[0].body.messages[0].content).toBe("User prompt");
  ```

## Testing Sessions and Configuration

### Creating Test Configuration

```typescript
const configPath = await createTestConfig(context, {
  // Config object
});
```

### Creating and Reading Sessions

```typescript
// Create a mock session
await createMockSession(context, [
  { role: "user", content: "Hello" },
  { role: "assistant", content: "Hi there!" },
]);

// Read the session
const session = await readSession(context);
```

## Best Practices

1. **Use descriptive test names** that explain what functionality is being tested
2. **Keep tests focused** on specific functionality or user flows
3. **Set appropriate timeouts** for tests that may take longer (especially with mock LLM)
4. **Validate both happy path and error cases**
5. **Test CLI flags and commands** thoroughly
6. **Clean up resources** even if tests fail (use try/finally if needed)
7. **Use realistic inputs** that match how users would interact with the CLI

## Testing Specific Features

### Testing Headless Mode

```typescript
const result = await runCLI(context, {
  args: ["-p", "Prompt in headless mode"],
});
```

### Testing Interactive Mode

```typescript
const result = await withInteractiveInput(
  context,
  ["chat"],
  ["User input", "/exit"],
);
```

### Testing Subcommands

```typescript
const result = await runCLI(context, {
  args: ["login", "--help"],
});
```

## Debugging Tests

- Set longer timeouts for complex tests: `}, 30000);` (30 seconds)
- Examine the full output: `console.log(result.stdout, result.stderr)`
- Check the test directory: `console.log(context.testDir)`
- For intermittent failures, try running the test in isolation
