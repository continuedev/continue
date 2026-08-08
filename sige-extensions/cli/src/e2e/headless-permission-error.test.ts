/**
 * E2E test for headless mode permission errors
 * Verifies that when a tool requires permission in headless mode,
 * an appropriate error message is displayed suggesting the --auto flag
 */
import * as http from "http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

describe("E2E: Headless Mode Permission Errors", () => {
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

  it("should succeed with --auto flag when tool requires permission", async () => {
    // Set up mock LLM to return a Write tool call
    mockServer = await setupMockLLMTest(context, {
      customHandler: (req: http.IncomingMessage, res: http.ServerResponse) => {
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

            // Send a Write tool call
            res.write(
              `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_write","type":"function","function":{"name":"Write"}}]},"index":0}]}\n\n`,
            );
            res.write(
              `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"filepath\\":\\"test.txt\\",\\"content\\":\\"hello\\"}"}}]},"index":0}]}\n\n`,
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

    // Run CLI with --auto flag
    const result = await runCLI(context, {
      args: [
        "-p",
        "--auto",
        "--config",
        context.configPath,
        "Create a file test.txt",
      ],
      timeout: 15000,
    });

    // Should succeed
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("requires permission");
  }, 20000);

  it("should succeed with --allow flag for specific tool", async () => {
    // Set up mock LLM to return a Write tool call
    mockServer = await setupMockLLMTest(context, {
      customHandler: (req: http.IncomingMessage, res: http.ServerResponse) => {
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

            // Send a Write tool call
            res.write(
              `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_write","type":"function","function":{"name":"Write"}}]},"index":0}]}\n\n`,
            );
            res.write(
              `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"filepath\\":\\"test.txt\\",\\"content\\":\\"hello\\"}"}}]},"index":0}]}\n\n`,
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

    // Run CLI with --allow Write flag
    const result = await runCLI(context, {
      args: [
        "-p",
        "--allow",
        "Write",
        "--config",
        context.configPath,
        "Create a file test.txt",
      ],
      timeout: 15000,
    });

    // Should succeed
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("requires permission");
  }, 20000);
});
