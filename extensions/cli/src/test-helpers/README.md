# Test Helpers

This directory contains helper functions for testing the Continue CLI.

## Mock LLM Server

The `mock-llm-server.ts` module provides utilities for creating mock LLM servers in tests. This allows you to test the CLI's behavior without making real API calls.

### Basic Usage

```typescript
import {
  setupMockLLMTest,
  cleanupMockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("My Test", () => {
  let context: any;
  let mockServer: MockLLMServer;

  beforeEach(async () => {
    context = await createTestContext();
    mockServer = await setupMockLLMTest(context, {
      response: "Hello from mock LLM!",
    });
  });

  afterEach(async () => {
    await cleanupMockLLMServer(mockServer);
    await cleanupTestContext(context);
  });

  it("should get response from mock", async () => {
    const result = await runCLI(context, {
      args: ["-p", "Test prompt", "--config", context.configPath],
    });
    expect(result.stdout).toContain("Hello from mock LLM!");
  });
});
```

### Advanced Usage

#### Dynamic Responses

```typescript
mockServer = await setupMockLLMTest(context, {
  response: (prompt: string) => {
    if (prompt.includes("weather")) {
      return "It's sunny!";
    }
    return "Default response";
  },
});
```

#### Non-Streaming Responses

```typescript
mockServer = await setupMockLLMTest(context, {
  response: "Non-streaming response",
  streaming: false, // Sends entire response at once instead of word-by-word
});
```

Note: The CLI always expects SSE format, so responses are always sent as streaming events. The `streaming` option only controls whether the response is chunked word-by-word or sent all at once.

#### Custom Request Handling

```typescript
const mockServer = await createMockLLMServer({
  customHandler: (req, res) => {
    // Custom logic here
    res.writeHead(200);
    res.end("Custom response");
  },
});
```

#### Request Tracking

The mock server tracks all requests it receives:

```typescript
// After making requests...
expect(mockServer.requests).toHaveLength(1);
expect(mockServer.requests[0].body.messages[0].content).toBe("User prompt");
```

### API Reference

#### `setupMockLLMTest(context, options)`

Sets up a complete test environment with mock LLM server, config file, and skips onboarding.

#### `createMockLLMServer(options)`

Creates just the mock server without test environment setup.

#### `createMockLLMConfig(mockServer, modelName)`

Generates a config YAML string for the mock server.

#### `cleanupMockLLMServer(mockServer)`

Properly shuts down the mock server.
