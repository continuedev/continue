import * as http from "http";

import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import {
  cleanupMockLLMServer,
  setupMockLLMTest,
  type MockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("E2E: Headless Mode with Tool Calls", () => {
  let context: any;
  let mockServer: MockLLMServer;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    if (mockServer) {
      await cleanupMockLLMServer(mockServer);
    }
    await cleanupTestContext(context);
  });

  it("should print nothing when response contains only tool calls in headless mode", async () => {
    // In headless mode, the CLI makes only one request and exits
    // If that response contains only tool calls, nothing is printed

    mockServer = await setupMockLLMTest(context, {
      customHandler: (req: http.IncomingMessage, res: http.ServerResponse) => {
        // Collect request body first
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          if (req.method === "POST" && req.url === "/chat/completions") {
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });

            // Send only tool call (no text content)
            res.write(
              `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"search_code"}}]},"index":0}]}\n\n`,
            );
            res.write(
              `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"pattern\\":\\"createTestContext\\"}"}}]},"index":0}]}\n\n`,
            );

            // Send usage data
            res.write(
              `data: {"usage":{"prompt_tokens":10,"completion_tokens":20}}\n\n`,
            );

            // End the stream
            res.write(`data: [DONE]\n\n`);
            res.end();
          } else {
            res.writeHead(404);
            res.end("Not found");
          }
        });
      },
    });

    // Run the CLI with print mode (-p)
    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Test with tool calls"],
      timeout: 15000,
    });

    // In headless mode with only tool calls, nothing should be printed
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  }, 20000);
});
